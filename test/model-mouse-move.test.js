/**
 * Test for model rollover mouse move handling
 * Verifies that model previews are created and positioned correctly
 */

const { calculateModelBounds, getModelFloorOffset } = require('../shared/transforms');

function runTests() {
  console.log('Testing model rollover mouse move handling...\n');

  // Test 1: Calculate bounds for model positioning
  console.log('Test 1 - Model bounds for mouse positioning:');
  const testModel = {
    name: 'Test Car',
    type: 'model',
    children: [
      {
        type: 'brick',
        object: { uuid: '1', brickID: '3001' },
        transform: { position: { x: 0, y: 0, z: 0 }, rotationMatrix: [1,0,0,0,1,0,0,0,1] }
      },
      {
        type: 'brick',
        object: { uuid: '2', brickID: '3001' },
        transform: { position: { x: 20, y: 0, z: 0 }, rotationMatrix: [1,0,0,0,1,0,0,0,1] }
      },
      {
        type: 'brick',
        object: { uuid: '3', brickID: '3001' },
        transform: { position: { x: 0, y: -24, z: 0 }, rotationMatrix: [1,0,0,0,1,0,0,0,1] }
      }
    ]
  };

  const bounds = calculateModelBounds(testModel);
  const floorOffset = getModelFloorOffset(bounds);
  
  console.log(`  Model bounds: min=(${bounds.min.x}, ${bounds.min.y}, ${bounds.min.z}) max=(${bounds.max.x}, ${bounds.max.y}, ${bounds.max.z})`);
  console.log(`  Floor offset: ${floorOffset}`);
  console.log(`  Expected: model is 2 bricks wide (40 LDU), 2 bricks tall, offset should be -24`);
  
  const test1Pass = bounds.max.x - bounds.min.x === 40 && floorOffset === -24;
  console.log(`  Result: ${test1Pass ? 'PASS' : 'FAIL'}\n`);

  // Test 2: Model at origin should sit on floor
  console.log('Test 2 - Model positioned on floor:');
  const flatModel = {
    name: 'Flat Plate',
    type: 'model',
    children: [
      {
        type: 'brick',
        transform: { position: { x: 0, y: 0, z: 0 }, rotationMatrix: [1,0,0,0,1,0,0,0,1] }
      }
    ]
  };

  const flatBounds = calculateModelBounds(flatModel);
  const flatOffset = getModelFloorOffset(flatBounds);
  const positionedY = 0 + flatOffset; // Simulating placement at y=0
  
  console.log(`  Flat model bounds max.y: ${flatBounds.max.y}`);
  console.log(`  Floor offset: ${flatOffset}`);
  console.log(`  Positioned at y=${positionedY}, bottom will be at y=${positionedY + flatBounds.max.y}`);
  console.log(`  Expected: bottom should be at y=0`);
  
  const test2Pass = positionedY + flatBounds.max.y === 0;
  console.log(`  Result: ${test2Pass ? 'PASS' : 'FAIL'}\n`);

  // Test 3: Tall model positioning
  console.log('Test 3 - Tall model positioning:');
  const tallModel = {
    name: 'Tower',
    type: 'model',
    children: [
      { type: 'brick', transform: { position: { x: 0, y: 0, z: 0 }, rotationMatrix: [1,0,0,0,1,0,0,0,1] } },
      { type: 'brick', transform: { position: { x: 0, y: -24, z: 0 }, rotationMatrix: [1,0,0,0,1,0,0,0,1] } },
      { type: 'brick', transform: { position: { x: 0, y: -48, z: 0 }, rotationMatrix: [1,0,0,0,1,0,0,0,1] } },
      { type: 'brick', transform: { position: { x: 0, y: -72, z: 0 }, rotationMatrix: [1,0,0,0,1,0,0,0,1] } },
      { type: 'brick', transform: { position: { x: 0, y: -96, z: 0 }, rotationMatrix: [1,0,0,0,1,0,0,0,1] } },
    ]
  };

  const tallBounds = calculateModelBounds(tallModel);
  const tallOffset = getModelFloorOffset(tallBounds);
  
  console.log(`  Tall model height: ${tallBounds.max.y - tallBounds.min.y} LDU`);
  console.log(`  Bounds: min.y=${tallBounds.min.y}, max.y=${tallBounds.max.y}`);
  console.log(`  Floor offset: ${tallOffset}`);
  console.log(`  Expected: 5 bricks tall = 120 LDU, offset = -24`);
  
  const test3Pass = tallBounds.max.y === 24 && tallOffset === -24;
  console.log(`  Result: ${test3Pass ? 'PASS' : 'FAIL'}\n`);

  // Test 4: Model with negative coordinates (below origin)
  console.log('Test 4 - Model with parts below origin:');
  const offsetModel = {
    name: 'Offset Model',
    type: 'model',
    children: [
      { type: 'brick', transform: { position: { x: 0, y: -50, z: 0 }, rotationMatrix: [1,0,0,0,1,0,0,0,1] } },
      { type: 'brick', transform: { position: { x: 0, y: -74, z: 0 }, rotationMatrix: [1,0,0,0,1,0,0,0,1] } },
    ]
  };

  const offsetBounds = calculateModelBounds(offsetModel);
  const offsetFloorOffset = getModelFloorOffset(offsetBounds);
  
  console.log(`  Model bounds: min.y=${offsetBounds.min.y}, max.y=${offsetBounds.max.y}`);
  console.log(`  Floor offset: ${offsetFloorOffset}`);
  console.log(`  When placed, bottom will be at: ${offsetFloorOffset + offsetBounds.max.y}`);
  console.log(`  Expected: offset should bring bottom to y=0`);
  
  const test4Pass = offsetFloorOffset + offsetBounds.max.y === 0;
  console.log(`  Result: ${test4Pass ? 'PASS' : 'FAIL'}\n`);

  const allPass = test1Pass && test2Pass && test3Pass && test4Pass;
  console.log(`\n=== Overall: ${allPass ? 'ALL TESTS PASS' : 'SOME TESTS FAILED'} ===`);
  
  return allPass;
}

// Run tests if this file is executed directly
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runTests };