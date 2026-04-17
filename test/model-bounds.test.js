/**
 * Test model bounds calculation for rollover positioning
 * 
 * When placing a model as a rollover, we need to:
 * 1. Calculate its bounding box to determine size
 * 2. Find the bottom of the model (in Y-down coordinates, this is max.y)
 * 3. Position it so the bottom sits on the floor (y=0)
 */

const { composeTransform } = require('../shared/transforms');

/**
 * Calculate the bounding box of a model tree
 * Returns { min: {x, y, z}, max: {x, y, z} } in LDraw coordinates
 * 
 * @param {Object} model - Model object with children
 * @param {Object} parentTransform - Parent transform to apply
 * @returns {Object} Bounding box
 */
function calculateModelBounds(model, parentTransform = null) {
  if (!model || !model.children || model.children.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 }
    };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const child of model.children) {
    if (child.type === 'brick') {
      const brick = child.object || child;
      const transform = composeTransform(parentTransform, child.transform || {
        position: brick.position || { x: 0, y: 0, z: 0 },
        rotationMatrix: brick.rotationMatrix || [1, 0, 0, 0, 1, 0, 0, 0, 1]
      });

      const pos = transform.position;
      
      // Approximate brick size (1x1 brick is 20x24x20 LDU)
      // For bounds calculation, we use a simple approximation
      // In real usage, this would use actual brick geometry
      const halfWidth = 10;  // LDU
      const halfDepth = 10;  // LDU
      const height = 24;     // LDU (brick height)

      minX = Math.min(minX, pos.x - halfWidth);
      maxX = Math.max(maxX, pos.x + halfWidth);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + height);
      minZ = Math.min(minZ, pos.z - halfDepth);
      maxZ = Math.max(maxZ, pos.z + halfDepth);
    } else if (child.type === 'model') {
      const childModel = child.object || child;
      const childTransform = composeTransform(parentTransform, child.transform);
      const childBounds = calculateModelBounds(childModel, childTransform);
      
      minX = Math.min(minX, childBounds.min.x);
      maxX = Math.max(maxX, childBounds.max.x);
      minY = Math.min(minY, childBounds.min.y);
      maxY = Math.max(maxY, childBounds.max.y);
      minZ = Math.min(minZ, childBounds.min.z);
      maxZ = Math.max(maxZ, childBounds.max.z);
    }
  }

  // Handle empty model case
  if (minX === Infinity) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 }
    };
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ }
  };
}

/**
 * Calculate the offset needed to position a model on the floor
 * In LDraw Y-down coordinates:
 * - y=0 is the floor level
 * - Positive Y goes DOWN
 * - The bottom of a model is at max.y
 * - To place on floor: shift by -max.y
 * 
 * @param {Object} bounds - Bounding box from calculateModelBounds
 * @returns {number} Y offset to apply
 */
function getFloorOffset(bounds) {
  // In Y-down, bottom is max.y
  // To put bottom on floor (y=0), we need to subtract max.y
  return -bounds.max.y;
}

// Test cases
function runTests() {
  console.log('Testing model bounds calculation...\n');

  // Test 1: Single brick at origin
  const singleBrickModel = {
    children: [{
      type: 'brick',
      object: {
        position: { x: 0, y: 0, z: 0 },
        rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1]
      },
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1]
      }
    }]
  };

  const bounds1 = calculateModelBounds(singleBrickModel);
  console.log('Test 1 - Single brick at origin:');
  console.log(`  Bounds: min=(${bounds1.min.x}, ${bounds1.min.y}, ${bounds1.min.z}) max=(${bounds1.max.x}, ${bounds1.max.y}, ${bounds1.max.z})`);
  console.log(`  Expected: min around (-10, 0, -10), max around (10, 24, 10)`);
  const test1Pass = bounds1.min.x === -10 && bounds1.max.y === 24;
  console.log(`  Result: ${test1Pass ? 'PASS' : 'FAIL'}\n`);

  // Test 2: Brick at height (stacked)
  const stackedBrickModel = {
    children: [{
      type: 'brick',
      object: {
        position: { x: 0, y: 0, z: 0 },
        rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1]
      },
      transform: {
        position: { x: 0, y: -24, z: 0 }, // -24 means one brick up in Y-down
        rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1]
      }
    }]
  };

  const bounds2 = calculateModelBounds(stackedBrickModel);
  const offset2 = getFloorOffset(bounds2);
  console.log('Test 2 - Brick at height (y=-24, one brick up):');
  console.log(`  Bounds: min=(${bounds2.min.x}, ${bounds2.min.y}, ${bounds2.min.z}) max=(${bounds2.max.x}, ${bounds2.max.y}, ${bounds2.max.z})`);
  console.log(`  Floor offset: ${offset2}`);
  console.log(`  Expected: bounds max.y should be 0 (-24 + 24), offset should be 0`);
  const test2Pass = bounds2.max.y === 0 && offset2 === 0;
  console.log(`  Result: ${test2Pass ? 'PASS' : 'FAIL'}\n`);

  // Test 3: Two bricks forming a tower
  const towerModel = {
    children: [
      {
        type: 'brick',
        transform: { position: { x: 0, y: 0, z: 0 }, rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }
      },
      {
        type: 'brick',
        transform: { position: { x: 0, y: -24, z: 0 }, rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }
      },
      {
        type: 'brick',
        transform: { position: { x: 0, y: -48, z: 0 }, rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }
      }
    ]
  };

  const bounds3 = calculateModelBounds(towerModel);
  const offset3 = getFloorOffset(bounds3);
  console.log('Test 3 - Three-brick tower:');
  console.log(`  Bounds: min=(${bounds3.min.x}, ${bounds3.min.y}, ${bounds3.min.z}) max=(${bounds3.max.x}, ${bounds3.max.y}, ${bounds3.max.z})`);
  console.log(`  Floor offset: ${offset3}`);
  console.log(`  Expected: min.y=-48, max.y=24, offset=-24`);
  const test3Pass = bounds3.min.y === -48 && bounds3.max.y === 24 && offset3 === -24;
  console.log(`  Result: ${test3Pass ? 'PASS' : 'FAIL'}\n`);

  // Test 4: Nested model (model within model)
  const innerModel = {
    children: [{
      type: 'brick',
      transform: { position: { x: 0, y: 0, z: 0 }, rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }
    }]
  };

  const outerModel = {
    children: [{
      type: 'model',
      object: innerModel,
      transform: { position: { x: 100, y: -50, z: 200 }, rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }
    }]
  };

  const bounds4 = calculateModelBounds(outerModel);
  console.log('Test 4 - Nested model with transform:');
  console.log(`  Bounds: min=(${bounds4.min.x}, ${bounds4.min.y}, ${bounds4.min.z}) max=(${bounds4.max.x}, ${bounds4.max.y}, ${bounds4.max.z})`);
  console.log(`  Expected: offset by (100, -50, 200) -> min around (90, -50, 190)`);
  const test4Pass = Math.abs(bounds4.min.x - 90) < 0.1 && Math.abs(bounds4.min.y - (-50)) < 0.1;
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

module.exports = { calculateModelBounds, getFloorOffset };