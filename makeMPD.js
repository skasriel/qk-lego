const BrickCollections = {
  "Bricks": [
    3005, 3004, 3065, 3622, 3010, 3066, 3009, 3067, 3008, 6111, 6112, 2465, 2357,
    3003, 3002, 3001, 44237, 3007, 3006, 44042, 6212, 30400, 43802, 4204,
    14716, 22886, 49311, 30145, 30144, 6213, 2453, 2454, 46212, 3755, 3754
  ],
  "Doors & Windows" : [
    '60592', '86209', '4035', '60594', 6154
  ],
  "Transportation - Aviation": [
    2421, 46667, 4591, 60208, 43121
  ],
};


const fs = require('fs');
const path = require('path')
const yargs = require('yargs');

let alreadyProcessedFileSet;

let logLevel = 1;
function log(message, level) {
  if (level <= logLevel)
    console.log(message);
}

main();
function main() {
  const ldrawPath = '../ldraw/parts';
  const outputPath = 'public/models/bricks';
  const screenshotPath = '/public/models/icons';
  log("Input Path: "+ldrawPath+" Output Path: "+outputPath, 0);

  for (let collectionID in BrickCollections) {
    let collection = BrickCollections[collectionID];
    log("  Working on collection "+collectionID, 0);
    for (let brick of collection) {
      let inputFile = brick + '.dat';
      processFile(ldrawPath, inputFile, outputPath)
    }
  }

  log("All done! ", 0);
}

function processFile(ldrawPath, inputFile, outputPath) {
  log("Processing file "+inputFile, 1);
  alreadyProcessedFileSet = new Set();
  const fileContent = createMPD(ldrawPath, inputFile);
  const outputFileName = inputFile+'.mpd';
  writeToFile(outputPath, outputFileName, fileContent);
  log("All done with file "+inputFile, 1);
}

function createMPD(ldrawPath, ldrFileName, level) {
  if (ldrFileName == '') {
    log("!!!! Empty file name, returning empty string", 0);
    return '';
  }
  if (!level) level=0;
  log("  "+level+"> Processing file: "+ldrFileName, 2);
  alreadyProcessedFileSet.add(ldrFileName);
  let mpdFileContent = '';
  if (level) {
    mpdFileContent = '0 FILE '+ldrFileName+'\r\n';
  }
  let ldrFileContent = readFromFile(ldrawPath, ldrFileName);
  ldrFileContent = ldrFileContent.replace(/\\/g, '/');
  ldrFileContent = ldrFileContent.replace(/s\//g,''); // remove "/s/"
  ldrFileContent = ldrFileContent.replace(/part\//g,''); // remove "/part/"
  mpdFileContent += ldrFileContent;

  let ldrFileArray = ldrFileContent.replace(/\r\n/g, "\r").replace(/\n/g, "\r").split(/\r/);
  for (let line of ldrFileArray) {
    line = line.trim();
    if (!line.endsWith('.dat')) {
      // no file name in line, so continue to next line
      continue;
    }
    // line is something like this: 1 0 0 0 -90 1 0 0 0 1 0 0 0 1 parts/4315.dat
    let i = line.lastIndexOf(' ');
    let nextLdrFileName = line.substring(i+1);
    if (alreadyProcessedFileSet.has(nextLdrFileName)) {
      // file was already processed, so continue to next line
      continue;
    }
    alreadyProcessedFileSet.add(nextLdrFileName);
    mpdFileContent += createMPD(ldrawPath, nextLdrFileName, level+1);
  }

  log("   Done processing "+ldrFileName, 2);
  return mpdFileContent;
}

function readFromFile(ldrawPath, fileName) {
  fileName = fileName.replace('\\', '/');
  let fullFileName = path.join(ldrawPath, fileName);
  let found=true;
  if (! fs.existsSync(fullFileName)) {
    found=false;
    const pathsToTry = ['parts', 'p', 's', 'parts/p', 'parts/s', '../parts', '../parts/s', '../parts/p', '../p', '../s'];
    for (let pathToTry of pathsToTry) {
      fullFileName = path.join(ldrawPath, pathToTry, fileName);
      if (fs.existsSync(fullFileName)) {
        log("  Found file at "+fullFileName, 3);
        found=true;
        break;
      }
    }
  }
  if (!found) {
    log("!!! Unable to locate file: "+fileName+" at "+fullFileName+" from "+ldrawPath, 0);
    return '';
  }
  return fs.readFileSync(fullFileName, 'utf8').toString();
}

function writeToFile(outputPath, outputFileName, content) {
  if (content.length==0) {
    log("Skipping empty file: "+outputFileName, 1);
    return;
  }
  let outputFile = path.join(outputPath, outputFileName);
  let parentDir = path.dirname(outputFile);
  if (!fs.existsSync(parentDir)) {
    log("Creating directory: "+parentDir, 0);
    fs.mkdirSync(parentDir, { recursive: true });
  }
  log("Writing file: "+outputPath+" + "+outputFileName, 1);
  fs.writeFileSync(outputFile, content);
}

/*function processDirectory(ldrawPath, outputPath) {
  let files = fs.readdirSync(ldrawPath);
  for (file of files) {
    let inputFile = path.join(ldrawPath, file);
    if (!fs.existsSync(inputFile)) {
      log("!!! File doesn't exist: "+inputFile, 1);
      continue;
    }
    if (fs.lstatSync(inputFile).isDirectory()) {
      const newOutputPath = path.join(outputPath, file);
      log("Processing directory: "+inputFile+", output to "+newOutputPath, 1);
      processDirectory(inputFile, newOutputPath);
      log("Done processing directory: "+inputFile, 1);
      continue;
    }
    if (!inputFile.endsWith('.dat')) {
      log("Skipping file: "+inputFile, 5);
      continue;
    }
    processFile(ldrawPath, file, outputPath);
  }
}*/
