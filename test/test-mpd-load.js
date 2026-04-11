const fs = require('fs');
const path = require('path');
const { bricksToMPD, mpdToBricks, parseMPD } = require('../server/mpd-utils');

function countBricks(node) {
  if (!node) return 0;
  if (node.type === 'brick') return 1;
  if (node.type === 'model') {
    return (node.children || []).reduce((sum, child) => {
      if (child.type === 'brick') return sum + 1;
      if (child.type === 'model') return sum + countBricks(child.object || child);
      return sum;
    }, 0);
  }
  return 0;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function testRoundTrip() {
  const original = [
    {
      uuid: 'test-1',
      position: { x: 100, y: 50, z: 200 },
      color: '#FF0000',
      colorType: 'solid',
      brickID: '3001',
      angle: 0,
    },
  ];

  const mpd = bricksToMPD(original, 'Test');
  const loaded = mpdToBricks(mpd);

  assert(loaded.length === 1, 'Round-trip should load 1 brick');
  assert(loaded[0].brickID === '3001', 'Round-trip brickID mismatch');
}

function testAllModels() {
  const modelsDir = path.join(__dirname, '../server/models');
  const files = fs
    .readdirSync(modelsDir)
    .filter((f) => f.endsWith('.mpd') || f.endsWith('.ldr'))
    .sort();

  const results = [];

  for (const file of files) {
    const filePath = path.join(modelsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const model = parseMPD(content, filePath);
      results.push({ file, ok: true, count: countBricks(model) });
    } catch (error) {
      results.push({ file, ok: false, error: error.message });
    }
  }

  return results;
}

function main() {
  testRoundTrip();

  const results = testAllModels();
  const failed = results.filter((r) => !r.ok);
  const succeeded = results.filter((r) => r.ok);
  const zeroCount = succeeded.filter((r) => r.count === 0);

  console.log(`Parsed ${succeeded.length}/${results.length} model files successfully.`);
  console.log(`${zeroCount.length} files parsed but returned 0 bricks.`);

  if (zeroCount.length > 0) {
    console.log('\nZero-brick files:');
    zeroCount.slice(0, 20).forEach((r) => console.log(`  ${r.file}`));
  }

  if (failed.length > 0) {
    console.log('\nFailed files:');
    failed.slice(0, 20).forEach((r) => console.log(`  ${r.file}: ${r.error}`));
    process.exitCode = 1;
  }

  console.log('\nSample successful files:');
  succeeded.slice(0, 10).forEach((r) => console.log(`  ${r.file}: ${r.count} bricks`));
}

main();
