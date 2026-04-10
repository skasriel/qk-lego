/**
 * Check MPD/LDR file dependencies
 * Finds all referenced .dat and .ldr files and checks if they exist
 */

const fs = require('fs');
const path = require('path');

const LDRAW_PARTS_DIR = path.join(__dirname, '../server/ldraw/parts');
const LDRAW_P_DIR = path.join(__dirname, '../server/ldraw/p');
const MODELS_DIR = path.join(__dirname, '../server/models');

function extractDependencies(mpdContent, baseFilePath = '') {
  const lines = mpdContent.split('\n');
  const dependencies = new Set();
  const submodels = new Set();
  
  // First pass: collect all submodels defined in file
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('0 FILE ')) {
      const fileName = trimmed.substring(7).trim();
      submodels.add(fileName.toLowerCase());
    }
  }

  // Second pass: collect dependencies, excluding submodels
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Parse Type 1 lines (part references)
    if (trimmed.startsWith('1 ')) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 15) {
        const fileName = parts[14];
        if (fileName) {
          const lowerName = fileName.toLowerCase();
          // Skip if it's a submodel defined in this file (case-insensitive)
          if (!submodels.has(lowerName)) {
            dependencies.add(fileName);
          }
        }
      }
    }
  }

  return {
    dependencies: Array.from(dependencies),
    submodels: Array.from(submodels)
  };
}

function checkFileExists(fileName, baseDir = '') {
  const checks = [];
  
  // Normalize Windows paths (48\file.dat -> 48/file.dat)
  const normalizedName = fileName.replace(/\\/g, '/');
  
  // Check in ldraw/parts
  const partsPath = path.join(LDRAW_PARTS_DIR, fileName);
  checks.push({ path: partsPath, type: 'ldraw_parts', exists: fs.existsSync(partsPath) });
  
  // Check normalized path in parts
  if (normalizedName !== fileName) {
    const normPartsPath = path.join(LDRAW_PARTS_DIR, normalizedName);
    checks.push({ path: normPartsPath, type: 'ldraw_parts_norm', exists: fs.existsSync(normPartsPath) });
  }
  
  // Check in ldraw/p (for primitives)
  const pPath = path.join(LDRAW_P_DIR, fileName);
  checks.push({ path: pPath, type: 'ldraw_p', exists: fs.existsSync(pPath) });
  
  // Check normalized path in p
  if (normalizedName !== fileName) {
    const normPPath = path.join(LDRAW_P_DIR, normalizedName);
    checks.push({ path: normPPath, type: 'ldraw_p_norm', exists: fs.existsSync(normPPath) });
  }
  
  // Check in models directory (for custom parts)
  const modelsPath = path.join(MODELS_DIR, fileName);
  checks.push({ path: modelsPath, type: 'models', exists: fs.existsSync(modelsPath) });
  
  // Check in same directory as base file
  if (baseDir) {
    const sameDirPath = path.join(path.dirname(baseDir), fileName);
    checks.push({ path: sameDirPath, type: 'same_dir', exists: fs.existsSync(sameDirPath) });
  }
  
  // Also check with different cases (LS50 vs ls50, .DAT vs .dat)
  const lowerPartsPath = path.join(LDRAW_PARTS_DIR, fileName.toLowerCase());
  if (lowerPartsPath !== partsPath) {
    checks.push({ path: lowerPartsPath, type: 'ldraw_parts_lower', exists: fs.existsSync(lowerPartsPath) });
  }
  
  const lowerPPath = path.join(LDRAW_P_DIR, fileName.toLowerCase());
  if (lowerPPath !== pPath) {
    checks.push({ path: lowerPPath, type: 'ldraw_p_lower', exists: fs.existsSync(lowerPPath) });
  }
  
  return checks;
}

function checkDependencies(mpdFilePath) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Checking: ${path.basename(mpdFilePath)}`);
  console.log(`Path: ${mpdFilePath}`);
  console.log(`${'='.repeat(80)}`);
  
  if (!fs.existsSync(mpdFilePath)) {
    console.log(`ERROR: File not found!`);
    return { found: 0, missing: 0, total: 0, missingFiles: [] };
  }

  const content = fs.readFileSync(mpdFilePath, 'utf8');
  const { dependencies, submodels } = extractDependencies(content, mpdFilePath);
  
  console.log(`\nFound ${submodels.length} submodel(s) defined in file:`);
  submodels.forEach(s => console.log(`  - ${s}`));
  
  console.log(`\nChecking ${dependencies.length} external dependencies...`);
  
  const results = {
    found: [],
    missing: [],
    primitives: []
  };

  for (const dep of dependencies.sort()) {
    const checks = checkFileExists(dep, mpdFilePath);
    const found = checks.find(c => c.exists);
    
    if (found) {
      results.found.push({ file: dep, location: found.type });
      // Check if it's a primitive (in p/ directory)
      if (found.type === 'ldraw_p' || found.type === 'ldraw_parts') {
        // Check file size to guess if primitive
        try {
          const stat = fs.statSync(found.path);
          if (stat.size < 5000) { // Small files likely primitives
            results.primitives.push(dep);
          }
        } catch {}
      }
    } else {
      results.missing.push({ file: dep, checked: checks.map(c => c.path) });
    }
  }

  console.log(`\n✓ Found: ${results.found.length}`);
  if (results.found.length > 0) {
    const byLocation = {};
    results.found.forEach(r => {
      byLocation[r.location] = (byLocation[r.location] || 0) + 1;
    });
    Object.entries(byLocation).forEach(([loc, count]) => {
      console.log(`  ${count} in ${loc}`);
    });
    if (results.found.length <= 15) {
      results.found.forEach(r => {
        console.log(`    ${r.file}`);
      });
    }
  }

  console.log(`\n✗ Missing: ${results.missing.length}`);
  if (results.missing.length > 0) {
    results.missing.forEach(r => {
      console.log(`  ${r.file}`);
    });
    console.log(`\n  Searched in:`);
    console.log(`    - ${LDRAW_PARTS_DIR}`);
    console.log(`    - ${LDRAW_P_DIR}`);
    console.log(`    - ${MODELS_DIR}`);
  }

  return {
    found: results.found.length,
    missing: results.missing.length,
    total: dependencies.length,
    missingFiles: results.missing.map(m => m.file),
    foundFiles: results.found.map(f => f.file)
  };
}

function checkModelInDirectory(modelName) {
  // Try to find the model
  const possiblePaths = [
    path.join(MODELS_DIR, modelName),
    path.join(MODELS_DIR, `${modelName}.mpd`),
    path.join(MODELS_DIR, `${modelName}.ldr`),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return checkDependencies(p);
    }
  }

  // Try case-insensitive search
  const files = fs.readdirSync(MODELS_DIR);
  const match = files.find(f => f.toLowerCase().includes(modelName.toLowerCase()));
  if (match) {
    return checkDependencies(path.join(MODELS_DIR, match));
  }

  console.log(`Could not find model: ${modelName}`);
  return null;
}

// Main
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node check-dependencies.js <mpd-file-or-name>');
    console.log('       node check-dependencies.js --all');
    console.log('Example: node check-dependencies.js "9754 Dark Side Development Kit"');
    console.log('         node check-dependencies.js /path/to/file.mpd');
    console.log('         node check-dependencies.js --all  (checks all models)');
    process.exit(1);
  }

  const input = args[0];
  
  if (input === '--all') {
    // Check all models
    const files = fs.readdirSync(MODELS_DIR)
      .filter(f => f.endsWith('.mpd') || f.endsWith('.ldr'))
      .sort();
    
    console.log(`\nChecking ${files.length} models in ${MODELS_DIR}...`);
    
    const allMissing = new Map();
    let totalChecked = 0;
    let totalWithMissing = 0;
    
    for (const file of files) {
      const filePath = path.join(MODELS_DIR, file);
      try {
        const result = checkDependencies(filePath);
        totalChecked++;
        if (result.missing > 0) {
          totalWithMissing++;
          result.missingFiles.forEach(mf => {
            if (!allMissing.has(mf)) {
              allMissing.set(mf, []);
            }
            allMissing.get(mf).push(file);
          });
        }
        // Only show details for files with missing deps to avoid spam
        if (result.missing === 0) {
          process.stdout.write('.');
        } else {
          process.stdout.write('X');
        }
      } catch (e) {
        console.log(`\nError checking ${file}: ${e.message}`);
      }
    }
    
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`SUMMARY: Checked ${totalChecked} models`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Models with all dependencies: ${totalChecked - totalWithMissing}`);
    console.log(`Models with missing dependencies: ${totalWithMissing}`);
    
    if (allMissing.size > 0) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`UNIQUE MISSING FILES (${allMissing.size} total):`);
      console.log(`${'='.repeat(80)}`);
      
      const sortedMissing = Array.from(allMissing.entries())
        .sort((a, b) => b[1].length - a[1].length);
      
      sortedMissing.forEach(([file, models]) => {
        console.log(`\n${file} (used in ${models.length} model${models.length > 1 ? 's' : ''}):`);
        models.slice(0, 5).forEach(m => console.log(`  - ${m}`));
        if (models.length > 5) {
          console.log(`  ... and ${models.length - 5} more`);
        }
      });
    }
    
    process.exit(allMissing.size > 0 ? 1 : 0);
  }
  
  let result;

  if (fs.existsSync(input)) {
    result = checkDependencies(path.resolve(input));
  } else {
    result = checkModelInDirectory(input);
  }

  if (result) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Summary: ${result.found}/${result.total} dependencies found`);
    if (result.missing > 0) {
      console.log(`⚠ ${result.missing} files are missing!`);
      process.exit(1);
    } else {
      console.log(`✓ All dependencies found!`);
      process.exit(0);
    }
  }
}

module.exports = { checkDependencies, extractDependencies, checkFileExists };