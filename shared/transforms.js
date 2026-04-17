// Transform utilities for hierarchical models
// Works in both Node.js and browser environments

const IDENTITY_MATRIX = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const IDENTITY_POSITION = { x: 0, y: 0, z: 0 };

/**
 * Compose two transforms (parent + child) into world transform
 * Used for hierarchical model traversal
 */
export function composeTransform(parentTransform, childTransform) {
  const pRot = parentTransform?.rotationMatrix || IDENTITY_MATRIX;
  const pPos = parentTransform?.position || IDENTITY_POSITION;
  const cRot = childTransform?.rotationMatrix || IDENTITY_MATRIX;
  const cPos = childTransform?.position || IDENTITY_POSITION;

  // Multiply rotation matrices: R = Rp * Rc
  const rot = [
    pRot[0] * cRot[0] + pRot[1] * cRot[3] + pRot[2] * cRot[6],
    pRot[0] * cRot[1] + pRot[1] * cRot[4] + pRot[2] * cRot[7],
    pRot[0] * cRot[2] + pRot[1] * cRot[5] + pRot[2] * cRot[8],
    pRot[3] * cRot[0] + pRot[4] * cRot[3] + pRot[5] * cRot[6],
    pRot[3] * cRot[1] + pRot[4] * cRot[4] + pRot[5] * cRot[7],
    pRot[3] * cRot[2] + pRot[4] * cRot[5] + pRot[5] * cRot[8],
    pRot[6] * cRot[0] + pRot[7] * cRot[3] + pRot[8] * cRot[6],
    pRot[6] * cRot[1] + pRot[7] * cRot[4] + pRot[8] * cRot[7],
    pRot[6] * cRot[2] + pRot[7] * cRot[5] + pRot[8] * cRot[8],
  ];

  // Transform position: p' = Rp * cp + pp
  const pos = {
    x: pRot[0] * cPos.x + pRot[1] * cPos.y + pRot[2] * cPos.z + pPos.x,
    y: pRot[3] * cPos.x + pRot[4] * cPos.y + pRot[5] * cPos.z + pPos.y,
    z: pRot[6] * cPos.x + pRot[7] * cPos.y + pRot[8] * cPos.z + pPos.z,
  };

  return { position: pos, rotationMatrix: rot };
}

/**
 * Normalize a model tree for consistent hashing
 * Flattens hierarchy and rounds floating point values
 */
export function normalizeNodeForHash(node, parentTransform = null) {
  if (!node) return null;

  // Handle Model instances or plain objects
  if (node.type === 'model' && !node.object) {
    return {
      type: 'model',
      name: node.name,
      children: (node.children || []).map((child) =>
        normalizeNodeForHash(child, composeTransform(parentTransform, child.transform || null))
      ),
    };
  }

  if (node.type === 'brick') {
    const brick = node.object || node;
    const transform = composeTransform(parentTransform, node.transform || {
      position: brick.position,
      rotationMatrix: brick.rotationMatrix,
    });
    const pos = transform.position || brick.position || { x: 0, y: 0, z: 0 };
    const rot = transform.rotationMatrix || brick.rotationMatrix || IDENTITY_MATRIX;

    return {
      type: 'brick',
      uuid: brick.uuid,
      brickID: brick.brickID,
      color: brick.color,
      colorType: brick.colorType,
      position: {
        x: Math.round(pos.x * 1000) / 1000,
        y: Math.round(pos.y * 1000) / 1000,
        z: Math.round(pos.z * 1000) / 1000,
      },
      rotationMatrix: rot.map((v) => Math.round(v * 10000) / 10000),
    };
  }

  if (node.type === 'model') {
    const model = node.object || node;
    return {
      type: 'model',
      name: model.name,
      children: (model.children || []).map((child) =>
        normalizeNodeForHash(child, composeTransform(parentTransform, child.transform || null))
      ),
    };
  }

  return null;
}

/**
 * Calculate hash of world model for consistency checking
 * Uses Java String.hashCode() algorithm for compatibility
 */
export function getWorldHash(worldModel) {
  const normalized = normalizeNodeForHash(worldModel);
  const text = JSON.stringify(normalized);
  
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return hash;
}

/**
 * Count total bricks in a model tree
 */
export function countBricksInModel(model) {
  if (!model || !model.children) return 0;
  let count = 0;
  for (const child of model.children) {
    if (child.type === 'brick') {
      count++;
    } else if (child.type === 'model') {
      count += countBricksInModel(child.object || child);
    }
  }
  return count;
}

/**
 * Find a brick by UUID in model tree
 */
export function findBrickInModel(model, uuid) {
  if (!model || !model.children) return null;
  for (const child of model.children) {
    if (child.type === 'brick' && child.object?.uuid === uuid) {
      return child.object;
    }
    if (child.type === 'model') {
      const found = findBrickInModel(child.object || child, uuid);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Remove a brick by UUID from model tree
 */
export function removeBrickFromModel(model, uuid) {
  if (!model || !model.children) return false;
  let removed = false;
  model.children = model.children.filter((child) => {
    if (child.type === 'brick' && child.object?.uuid === uuid) {
      removed = true;
      return false;
    }
    if (child.type === 'model') {
      const childModel = child.object || child;
      if (removeBrickFromModel(childModel, uuid)) {
        removed = true;
      }
    }
    return true;
  });
  return removed;
}

/**
 * Calculate the bounding box of a model tree
 * Returns { min: {x, y, z}, max: {x, y, z} } in LDraw coordinates
 * 
 * @param {Object} model - Model object with children
 * @param {Object} parentTransform - Parent transform to apply
 * @returns {Object} Bounding box
 */
export function calculateModelBounds(model, parentTransform = null) {
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
export function getModelFloorOffset(bounds) {
  // In Y-down, bottom is max.y
  // To put bottom on floor (y=0), we need to subtract max.y
  return -bounds.max.y;
}