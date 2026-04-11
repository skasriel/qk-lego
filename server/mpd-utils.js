/**
 * MPD (LDraw) file format utilities
 * 
 * MPD format:
 * - Line starting with "0" is a comment
 * - Line starting with "1" is a part placement:
 *   1 <color> <x> <y> <z> <a> <b> <c> <d> <e> <f> <g> <h> <i> <file>
 *   Where a-i is a 3x3 rotation matrix, and file is the part filename
 */

const { LDRAW_COLORS } = require('../shared/constants.js');

// Convert our internal brick format to MPD
function bricksToMPD(bricks, name = 'Untitled') {
  const lines = [];
  
  // Header
  lines.push(`0 ${name}`);
  lines.push(`0 Name: ${name}.ldr`);
  lines.push('0 Author: QK Lego Builder');
  lines.push('0 !LDRAW_ORG Unofficial_Model');
  lines.push('0 !LICENSE Redistributable under CCAL version 2.0');
  lines.push('');
  
  // Convert each brick to MPD format
  // Using native LDraw units (LDU) - no scaling needed
  // LDraw: Y points down, our app Y points up, so flip Y
  bricks.forEach((brick, index) => {
    try {
      const color = brick.color || '#FFFFFF';
      // Find closest LDraw color by RGB distance
      let ldrawColor = 0;
      let minDist = Infinity;
      for (const [code, rgb] of Object.entries(LDRAW_COLORS)) {
        const r2 = parseInt(rgb.slice(1, 3), 16);
        const g2 = parseInt(rgb.slice(3, 5), 16);
        const b2 = parseInt(rgb.slice(5, 7), 16);
        const r1 = parseInt(color.slice(1, 3), 16);
        const g1 = parseInt(color.slice(3, 5), 16);
        const b1 = parseInt(color.slice(5, 7), 16);
        const dist = (r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2;
        if (dist < minDist) {
          minDist = dist;
          ldrawColor = parseInt(code);
        }
      }
      
      // Position: using native LDU units (no conversion needed)
      // Just flip Y axis (LDraw Y down, our Y up)
      const x = (brick.position?.x || 0);
      const y = -(brick.position?.y || 0); // Flip Y
      const z = (brick.position?.z || 0);
      
      // Rotation matrix - use stored matrix if available, otherwise identity
      let m_a = 1, m_b = 0, m_c = 0, m_d = 0, m_e = 1, m_f = 0, m_g = 0, m_h = 0, m_i = 1;
      if (brick.rotationMatrix && brick.rotationMatrix.length === 9) {
        [m_a, m_b, m_c, m_d, m_e, m_f, m_g, m_h, m_i] = brick.rotationMatrix;
      } else if (brick.angle) {
        // Fallback to Y rotation only
        const cos = Math.cos(brick.angle);
        const sin = Math.sin(brick.angle);
        m_a = cos; m_c = sin;
        m_g = -sin; m_i = cos;
      }
      
      // Part filename - add .dat extension if not present
      let partFile = brick.brickID || 'missing';
      if (typeof partFile !== 'string') {
        console.warn(`Brick ${index} has invalid brickID:`, brick.brickID);
        partFile = 'missing';
      }
      if (!partFile.endsWith('.dat')) {
        partFile += '.dat';
      }

      lines.push(`1 ${ldrawColor} ${x} ${y} ${z} ${m_a} ${m_b} ${m_c} ${m_d} ${m_e} ${m_f} ${m_g} ${m_h} ${m_i} ${partFile}`);
    } catch (err) {
      console.error(`Error serializing brick ${index}:`, err, brick);
      // Skip this brick rather than crashing
    }
  });
  
  return lines.join('\n');
}

// Parse MPD file to our internal format
function mpdToBricks(mpdContent) {
  const bricks = [];
  const lines = mpdContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('0')) continue;
    
    const parts = trimmed.split(/\s+/);
    // MPD part line: 1 <color> x y z a b c d e f g h i <file>
    if (parts[0] === '1' && parts.length >= 15) {
      const colorCode = parts[1];
      const x = parseFloat(parts[2]);
      const y = parseFloat(parts[3]);
      const z = parseFloat(parts[4]);
      const file = parts[14];
      
      // Using native LDraw units (LDU) - no conversion needed
      // Just flip Y axis (LDraw Y down, our Y up)
      const posX = x;
      const posY = -y; // Flip Y back
      const posZ = z;
      
      // Extract part number from filename
      const partNum = file.replace('.dat', '');
      const a = parseFloat(parts[5]); const b = parseFloat(parts[6]); const c = parseFloat(parts[7]);
      const d = parseFloat(parts[8]); const e = parseFloat(parts[9]); const f = parseFloat(parts[10]);
      const g = parseFloat(parts[11]); const h = parseFloat(parts[12]); const i = parseFloat(parts[13]);
      
      bricks.push({
        uuid: Math.random().toString(36).substr(2, 9),
        position: { x: posX, y: posY, z: posZ },
        color: '#FFFFFF', // Would need color mapping
        colorType: 'solid',
        brickID: partNum,
        angle: 0,
        brickType: 'BASIC_BRICK',
        width: 2, // Default, would need to look up from part database
        height: 3,
        depth: 4,
        rotationMatrix: [a, b, c, d, e, f, g, h, i],
      });
    }
  }
  
  return bricks;
}

// LDraw → app-space conversion constants.
// App grid: 1 stud = 100 units on X/Z, 1 brick = 99.9 units on Y.
// LDraw:    1 stud = 20 LDU on X/Z, 1 brick = 24 LDU on Y.
// Using native LDU units - no conversion needed, just flip Y

function ldrawToAppPoint(x, y, z) {
  return {
    x: x,
    y: -y, // Flip Y (LDraw Y down, our Y up)
    z: z,
  };
}

// Parse MPD/LDR file recursively.
// This parser handles line type 1 references and recursively expands nested
// .ldr/.mpd submodels, composing the full 3x3 transform + translation.

function multiplyMatrices3x3(a, b) {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

function transformPoint(matrix, point, translation) {
  return {
    x: matrix[0] * point.x + matrix[1] * point.y + matrix[2] * point.z + translation.x,
    y: matrix[3] * point.x + matrix[4] * point.y + matrix[5] * point.z + translation.y,
    z: matrix[6] * point.x + matrix[7] * point.y + matrix[8] * point.z + translation.z,
  };
}

function deriveYAngle(matrix) {
  const eps = 1e-5;
  const isYAxisOnly =
    Math.abs(matrix[1]) < eps &&
    Math.abs(matrix[3]) < eps &&
    Math.abs(matrix[5]) < eps &&
    Math.abs(matrix[7]) < eps &&
    Math.abs(matrix[4] - 1) < eps;

  if (!isYAxisOnly) {
    return 0;
  }

  return Math.atan2(matrix[2], matrix[0]);
}

function resolveColor(colorCode, parentColor = '#FFFFFF') {
  const numeric = parseInt(colorCode, 10);
  if (numeric === 16 || numeric === 24) {
    return parentColor;
  }
  return LDRAW_COLORS[numeric] || '#FFFFFF';
}

function inferDimensionsFromPartId(partNum) {
  // Very small fallback heuristic for the app's placement math.
  // Prefer common NxM naming in the id map if available elsewhere later.
  // Default to 1x1 brick height if unknown.
  return { width: 1, height: 3, depth: 1 };
}

const missingPartWarnings = new Set();

function ldrawPartExists(file) {
  const fs = require('fs');
  const path = require('path');
  const normalized = file.replace(/\\/g, '/');
  const lowerNormalized = normalized.toLowerCase();
  const lowerFile = file.toLowerCase();
  
  const candidates = [
    // Original paths
    path.join(__dirname, 'ldraw', 'parts', normalized),
    path.join(__dirname, 'ldraw', 'p', normalized),
    path.join(__dirname, 'ldraw', 'parts', 's', normalized),
    path.join(__dirname, 'ldraw', normalized),
    // Case-insensitive variants
    path.join(__dirname, 'ldraw', 'parts', lowerNormalized),
    path.join(__dirname, 'ldraw', 'p', lowerNormalized),
    path.join(__dirname, 'ldraw', 'parts', 's', lowerNormalized),
    // Also try original file with different case
    path.join(__dirname, 'ldraw', 'parts', file),
    path.join(__dirname, 'ldraw', 'p', file),
    path.join(__dirname, 'ldraw', 'parts', lowerFile),
    path.join(__dirname, 'ldraw', 'p', lowerFile),
  ];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

function splitMPDSections(mpdContent, fallbackName = 'main.ldr') {
  const lines = mpdContent.split('\n');
  const sections = new Map();
  let currentName = null;
  let currentLines = [];

  const flush = () => {
    if (currentName !== null) {
      sections.set(currentName.trim().toLowerCase(), currentLines.join('\n'));
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^0\s+FILE\s+[^:]/i.test(trimmed)) {
      flush();
      currentName = trimmed.replace(/^0\s+FILE\s+/i, '').trim();
      currentLines = [line];
    } else {
      if (currentName === null) currentName = fallbackName;
      currentLines.push(line);
    }
  }
  flush();
  return sections;
}

function parseModelContent(
  modelContent,
  sectionName,
  sectionMap,
  basePath,
  depth,
  maxDepth,
  parentColor = '#FFFFFF'
) {
  const fs = require('fs');
  const path = require('path');

  const normalizedSectionName = (sectionName || '').trim();
  const model = {
    type: 'model',
    name: path.basename(normalizedSectionName || basePath || 'Untitled').replace(/\.(mpd|ldr)$/i, ''),
    children: [],
  };

  if (depth > maxDepth) return model;

  const lines = modelContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('0')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts[0] !== '1' || parts.length < 15) continue;

    const colorCode = parts[1];
    const rawX = parseFloat(parts[2]);
    const rawY = parseFloat(parts[3]);
    const rawZ = parseFloat(parts[4]);
    const localPos = ldrawToAppPoint(rawX, rawY, rawZ);
    const localMatrix = [
      parseFloat(parts[5]),
      parseFloat(parts[6]),
      parseFloat(parts[7]),
      parseFloat(parts[8]),
      parseFloat(parts[9]),
      parseFloat(parts[10]),
      parseFloat(parts[11]),
      parseFloat(parts[12]),
      parseFloat(parts[13]),
    ];
    const file = parts.slice(14).join(' ').trim();
    const normalizedFile = file.toLowerCase();

    const resolvedColor = resolveColor(colorCode, parentColor);

    const isSubmodel = normalizedFile.endsWith('.ldr') || normalizedFile.endsWith('.mpd');

    if (isSubmodel) {
      try {
        if (sectionMap.has(normalizedFile)) {
          const subContent = sectionMap.get(normalizedFile);
          const subModel = parseModelContent(
            subContent,
            file,
            sectionMap,
            basePath,
            depth + 1,
            maxDepth,
            resolvedColor
          );
          model.children.push({
            type: 'model',
            object: subModel,
            transform: {
              position: localPos,
              rotationMatrix: localMatrix,
            },
          });
        } else {
          const normalizedFile = file.replace(/\\/g, '/');
          const subPath = path.join(path.dirname(basePath), normalizedFile);
          const subPathLower = path.join(path.dirname(basePath), normalizedFile.toLowerCase());
          
          let actualPath = null;
          if (fs.existsSync(subPath)) {
            actualPath = subPath;
          } else if (fs.existsSync(subPathLower)) {
            actualPath = subPathLower;
          } else {
            // Try without s\ prefix if present
            const withoutSPrefix = normalizedFile.replace(/^s\//i, '');
            const tryPath = path.join(path.dirname(basePath), withoutSPrefix);
            if (fs.existsSync(tryPath)) {
              actualPath = tryPath;
            }
          }
          
          if (actualPath) {
            const subContent = fs.readFileSync(actualPath, 'utf8');
            const externalSections = splitMPDSections(subContent, file);
            const rootName = externalSections.keys().next().value || file;
            const subModel = parseModelContent(
              externalSections.get(rootName),
              rootName,
              externalSections,
              actualPath,
              depth + 1,
              maxDepth,
              resolvedColor
            );
            model.children.push({
              type: 'model',
              object: subModel,
              transform: {
                position: localPos,
                rotationMatrix: localMatrix,
              },
            });
          }
        }
      } catch (e) {
        // Ignore missing/unreadable submodels for now.
      }
      continue;
    }

    const partNum = file.replace('.dat', '');
    if (!ldrawPartExists(file)) {
      if (!missingPartWarnings.has(file)) {
        missingPartWarnings.add(file);
        console.warn(`Skipping missing LDraw part reference: ${file}`);
      }
      continue;
    }
    const dims = inferDimensionsFromPartId(partNum);
    model.children.push({
      type: 'brick',
      object: {
        uuid: Math.random().toString(36).substr(2, 9),
        color: resolvedColor,
        colorType: 'solid',
        brickID: partNum,
        brickType: 'BASIC_BRICK',
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
      },
      transform: {
        position: localPos,
        rotationMatrix: localMatrix,
      },
    });
  }

  return model;
}

function parseMPD(
  mpdContent,
  basePath = '',
  depth = 0,
  maxDepth = 10,
  parentColor = '#FFFFFF'
) {
  const fallbackName = basePath ? require('path').basename(basePath) : 'main.ldr';
  const sections = splitMPDSections(mpdContent, fallbackName);
  const rootName = sections.keys().next().value || fallbackName;
  const rootContent = sections.get(rootName) || mpdContent;
  return parseModelContent(rootContent, rootName, sections, basePath, depth, maxDepth, parentColor);
}

function normalizeBricksToFloor(bricks) {
  if (!bricks || bricks.length === 0) return bricks;

  let minBottomY = Infinity;

  for (const brick of bricks) {
    const heightUnits = typeof brick.height === 'number' ? brick.height : 3;
    const brickHeight = heightUnits * 33.3;
    const bottomY = brick.position.y - brickHeight / 2;
    if (bottomY < minBottomY) {
      minBottomY = bottomY;
    }
  }

  if (!Number.isFinite(minBottomY)) return bricks;

  if (minBottomY !== 0) {
    for (const brick of bricks) {
      brick.position.y -= minBottomY;
    }
  }

  return bricks;
}

// Convert a hierarchical Model to MPD format (saves main model and sub-models)
function modelToMPD(model, basePath = '') {
  const fs = require('fs');
  const path = require('path');
  
  function closestLDrawColor(color) {
    const safe = color || '#FFFFFF';
    let ldrawColor = 0;
    let minDist = Infinity;
    for (const [code, rgb] of Object.entries(LDRAW_COLORS)) {
      const r2 = parseInt(rgb.slice(1, 3), 16);
      const g2 = parseInt(rgb.slice(3, 5), 16);
      const b2 = parseInt(rgb.slice(5, 7), 16);
      const r1 = parseInt(safe.slice(1, 3), 16);
      const g1 = parseInt(safe.slice(3, 5), 16);
      const b1 = parseInt(safe.slice(5, 7), 16);
      const dist = (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
      if (dist < minDist) {
        minDist = dist;
        ldrawColor = parseInt(code, 10);
      }
    }
    return ldrawColor;
  }
  
  let subModelCounter = 0;
  
  function writeModel(modelNode, filePath, parentName = '') {
    const lines = [];
    const modelName = modelNode.name || 'Untitled';
    
    // Header
    lines.push(`0 ${modelName}`);
    lines.push(`0 Name: ${modelName}.mpd`);
    lines.push('0 Author: QK Lego Builder');
    lines.push('0 !LDRAW_ORG Unofficial_Model');
    lines.push('');
    
    // Write children
    for (const child of (modelNode.children || [])) {
      if (child.type === 'brick') {
        // Write brick reference
        const pos = child.transform?.position || child.object?.position || { x: 0, y: 0, z: 0 };
        const rot = child.transform?.rotationMatrix || child.object?.rotationMatrix || [1,0,0,0,1,0,0,0,1];
        const color = closestLDrawColor(child.object?.color);
        const partFile = child.object?.brickID ? `${child.object.brickID}.dat` : 'missing.dat';
        // Using native LDU units - just flip Y axis
        const x = pos.x;
        const y = -pos.y;
        const z = pos.z;
        
        lines.push(`1 ${color} ${x} ${y} ${z} ${rot[0]} ${rot[1]} ${rot[2]} ${rot[3]} ${rot[4]} ${rot[5]} ${rot[6]} ${rot[7]} ${rot[8]} ${partFile}`);
      } else if (child.type === 'model') {
        // Generate name for sub-model if it doesn't have one
        let subModelName = child.object?.name || child.name;
        if (!subModelName || subModelName === 'Untitled') {
          subModelCounter++;
          subModelName = `${parentName || modelName}-${subModelCounter}`;
          if (child.object) child.object.name = subModelName;
        }

        const subFileName = `${subModelName}.mpd`;
        const subFilePath = path.join(path.dirname(filePath), subFileName);

        const pos = child.transform?.position || { x: 0, y: 0, z: 0 };
        const rot = child.transform?.rotationMatrix || [1, 0, 0, 0, 1, 0, 0, 0, 1];
        const x = pos.x;
        const y = -pos.y;
        const z = pos.z;
        lines.push(
          `1 16 ${x} ${y} ${z} ${rot[0]} ${rot[1]} ${rot[2]} ${rot[3]} ${rot[4]} ${rot[5]} ${rot[6]} ${rot[7]} ${rot[8]} ${subFileName}`
        );
        
        // Recursively write sub-model
        writeModel(child.object || child, subFilePath, subModelName);
      }
    }
    
    fs.writeFileSync(filePath, lines.join('\n'));
  }
  
  const mainPath = basePath || 'model.mpd';
  writeModel(model, mainPath, model.name);
  return mainPath;
}

module.exports = { bricksToMPD, mpdToBricks, parseMPD, normalizeBricksToFloor, modelToMPD };
