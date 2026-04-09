/**
 * MPD (LDraw) file format utilities
 * 
 * MPD format:
 * - Line starting with "0" is a comment
 * - Line starting with "1" is a part placement:
 *   1 <color> <x> <y> <z> <a> <b> <c> <d> <e> <f> <g> <h> <i> <file>
 *   Where a-i is a 3x3 rotation matrix, and file is the part filename
 */

const LDRAW_COLORS = {
  0: '#05131D',
  1: '#0055BF',
  2: '#257A3E',
  3: '#C91A09',
  4: '#F2CD37',
  5: '#FFFFFF',
  6: '#F2705E',
  7: '#9BA19D',
  8: '#6D6E5C',
  9: '#B4D2E3',
  10: '#4B9F4A',
  11: '#55A5AF',
  12: '#F2705E',
  13: '#FC97AC',
  14: '#F2CD37',
  15: '#FFFFFF',
  16: '#FFFFFF',
  24: '#FFFFFF',
  40: '#C0FF00',
  41: '#56E646',
  42: '#C1DFF0',
  43: '#A5A5CB',
  47: '#FCFCFC',
  70: '#A0A5A9',
  71: '#6C6E68',
  72: '#5C9DD1',
  73: '#73DCA1',
  74: '#FECCCF',
  75: '#F6D7B3',
  76: '#C870A0',
  77: '#3F3691',
  78: '#923978',
  84: '#A95500',
  85: '#E6E3DA',
  92: '#C91A09',
  288: '#05131D',
};

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
  // Our coordinates: 1 unit = 1mm, Y up
  // LDraw coordinates: 1 unit = 0.4mm, Y up (after our flip), Z forward
  // Our origin is at brick center, LDraw origin is at brick bottom
  bricks.forEach(brick => {
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
    
    // Position: convert from our units (1 unit = 1mm) to LDraw units (1 LDU = 0.4mm)
    // So multiply by 2.5
    const x = brick.position.x * 2.5;
    const y = -brick.position.y * 2.5; // Flip Y (our Y up, LDraw Y down in file)
    const z = brick.position.z * 2.5;
    
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
    let partFile = brick.brickID;
    if (!partFile.endsWith('.dat')) {
      partFile += '.dat';
    }

    lines.push(`1 ${ldrawColor} ${x} ${y} ${z} ${m_a} ${m_b} ${m_c} ${m_d} ${m_e} ${m_f} ${m_g} ${m_h} ${m_i} ${partFile}`);
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
      
      // Convert from LDraw units to our units
      const posX = x / 2.5;
      const posY = -y / 2.5; // Flip Y back
      const posZ = z / 2.5;
      
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
const LDU_TO_APP_XZ = 5;
const LDU_TO_APP_Y = 99.9 / 24;

function ldrawToAppPoint(x, y, z) {
  return {
    x: x * LDU_TO_APP_XZ,
    y: -y * LDU_TO_APP_Y,
    z: z * LDU_TO_APP_XZ,
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

function parseMPD(
  mpdContent,
  basePath = '',
  depth = 0,
  maxDepth = 10,
  parentTransform = null,
  parentColor = '#FFFFFF'
) {
  if (depth > maxDepth) return [];

  const fs = require('fs');
  const path = require('path');
  const bricks = [];
  const lines = mpdContent.split('\n');

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
    const file = parts.slice(14).join(' ');

    const transform = {
      matrix: parentTransform
        ? multiplyMatrices3x3(parentTransform.matrix, localMatrix)
        : localMatrix,
      translation: parentTransform
        ? transformPoint(parentTransform.matrix, localPos, parentTransform.translation)
        : localPos,
    };

    const resolvedColor = resolveColor(colorCode, parentColor);

    const isSubmodel = file.endsWith('.ldr') || file.endsWith('.mpd');

    if (isSubmodel) {
      try {
        const subPath = path.join(path.dirname(basePath), file);
        if (fs.existsSync(subPath)) {
          const subContent = fs.readFileSync(subPath, 'utf8');
          const subBricks = parseMPD(
            subContent,
            subPath,
            depth + 1,
            maxDepth,
            transform,
            resolvedColor
          );
          bricks.push(...subBricks);
        }
      } catch (e) {
        // Ignore missing/unreadable submodels for now.
      }
      continue;
    }

    const partNum = file.replace('.dat', '');
    const dims = inferDimensionsFromPartId(partNum);
    bricks.push({
      uuid: Math.random().toString(36).substr(2, 9),
      position: transform.translation,
      color: resolvedColor,
      colorType: 'solid',
      brickID: partNum,
      angle: deriveYAngle(transform.matrix),
      brickType: 'BASIC_BRICK',
      width: dims.width,
      height: dims.height,
      depth: dims.depth,
    });
  }

  return bricks;
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

module.exports = { bricksToMPD, parseMPD, normalizeBricksToFloor };
