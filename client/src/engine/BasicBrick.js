import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// import { LDrawLoader } from 'three/examples/jsm/loaders/LDrawLoader.js';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/examples/jsm/materials/LDrawConditionalLineMaterial.js';
import { multX, multY, multZ } from '../util';
import { Brick } from './Brick';

// Set default for all LDrawLoader instances (required for three.js 0.183+)
LDrawLoader.prototype.ConditionalLineMaterial = LDrawConditionalLineMaterial;

const USE_SHADOWS = false;
let staticCounter = 0;
let lDrawLoader = null;
let lDrawCache = {};
let lDrawMaterialsPromise = null;

function getLDrawLoader() {
  if (!lDrawLoader) {
    lDrawLoader = new LDrawLoader();
    // setPath controls where load() fetches the main file from
    lDrawLoader.setPath('/ldraw/parts/');
    // setPartsLibraryPath controls where fetchData() looks for sub-parts
    lDrawLoader.setPartsLibraryPath('/ldraw/');
    // Required for three.js 0.183+ - set conditional line material
    console.log('LDrawConditionalLineMaterial import:', LDrawConditionalLineMaterial);
    console.log('Type:', typeof LDrawConditionalLineMaterial);
    lDrawLoader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
    console.log('After set, loader.ConditionalLineMaterial:', lDrawLoader.ConditionalLineMaterial);
    console.log('Are they equal?', lDrawLoader.ConditionalLineMaterial === LDrawConditionalLineMaterial);
    
    // Preload LDraw color definitions to avoid "Material properties not available" warnings
    // Use absolute path since LDConfig.ldr is in /ldraw/, not /ldraw/parts/
    const originalPath = lDrawLoader.path;
    lDrawLoader.setPath('/ldraw/');
    lDrawMaterialsPromise = lDrawLoader.preloadMaterials('LDConfig.ldr').then(() => {
      // Restore original path after preloading
      lDrawLoader.setPath(originalPath);
    }).catch(err => {
      console.warn('Failed to preload LDConfig.ldr:', err);
      lDrawLoader.setPath(originalPath);
    });
  }
  return lDrawLoader;
}

export function CSSToHex(cssColor) {
  return parseInt(`#${cssColor.substring(1)}`, 16);
}

function applyRequestedLDrawColor(group, color, colorType) {
  const requestedMaterial = Brick.getMaterial(color, colorType);

  group.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const code = child.material.userData?.code;

    // Only replace "current color" / edge-color driven materials.
    // Preserve fixed colors defined by the underlying LDraw part itself.
    if (code === 16 || code === 24 || code === '16' || code === '24') {
      child.material = requestedMaterial.clone();
      child.material.userData = {
        ...(child.material.userData || {}),
        code,
      };
    }
  });
}

export class BasicBrick extends Brick {
  static BrickType = 'BASIC_BRICK';

  static async loadLDrawModel(brickID, color, colorType) {
    // Cache by brickID and color since we apply the color when loading
    const cacheKey = `${brickID}_${color}_${colorType}`;
    if (lDrawCache[cacheKey]) {
      return lDrawCache[cacheKey].clone();
    }

    const loader = getLDrawLoader();
    
    // Wait for materials to be preloaded before loading any parts
    if (lDrawMaterialsPromise) {
      await lDrawMaterialsPromise;
    }
    
    return new Promise((resolve, reject) => {
      // Try without the parts/ prefix since loader adds it
      const partPath = brickID.toLowerCase().endsWith('.dat') ? brickID : `${brickID}.dat`;

      // console.log(`Attempting to load LDraw model: ${partPath}`);

      loader.load(
        partPath,
        (group) => {
          // Apply the requested color only to "current color" surfaces.
          // Preserve any fixed colors defined inside the LDraw part.
          applyRequestedLDrawColor(group, color, colorType);
          lDrawCache[cacheKey] = group;
          resolve(group.clone());
        },
        (progress) => {
        },
        (error) => {
          console.error(`Failed to load LDraw model for ${brickID}:`, error);
          resolve(null);
        }
      );
    });
  }

  constructor(brickID, color, colorType, width, height, depth, preloadedLDrawModel) {
    const mat = Brick.getMaterial(color, colorType);

    let model;
    let geo;

    if (!preloadedLDrawModel) {
      throw new Error(
        `BasicBrick requires preloaded LDraw model. Use createFromDAT() instead of direct constructor. BrickID: ${brickID}`
      );
    }

    // Use the preloaded LDraw model
    // Create a wrapper group to hold the model
    // This way the rotation doesn't get saved in the brick's transform
    const wrapper = new THREE.Group();
    model = wrapper;

    const ldrawGroup = preloadedLDrawModel;
    // Create a simple box for ghost (will be replaced once in scene)
    geo = new THREE.BoxGeometry(width * multX, height * multY, depth * multZ);
    // LDraw uses Y-down, Three.js uses Y-up, so flip - Was doing this but bad idea
    // ldrawGroup.rotation.x = Math.PI; // Flip upright (studs on top) - LDraw Y is down in file

    wrapper.add(ldrawGroup);

    super(brickID, color, colorType, model);

    model.name = `BasicBrick type ${brickID} #${staticCounter++}`;

    this.ghostBlock = new THREE.Mesh(geo.clone(), mat);
    this.ghostBlock.brick = this;
    this.ghostBlock.name = `Ghost block for ${this.model.name}`;
    this.model.ghost = this.ghostBlock;
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.rotated = null;
    
    // Cache the local bounding box for performance and to avoid jitter
    // from recalculating on every mouse move
    const bbox = new THREE.Box3().setFromObject(this.model);
    this._localBBox = {
      min: { x: bbox.min.x, y: bbox.min.y, z: bbox.min.z },
      max: { x: bbox.max.x, y: bbox.max.y, z: bbox.max.z }
    };
  }

  static async createFromDAT(brickID, color, colorType) {
    console.log(`BasicBrick.createFromDAT with ${brickID}`);

    // Load LDraw model first, before creating the brick
    const ldrawModel = await BasicBrick.loadLDrawModel(brickID, color, colorType);

    if (!ldrawModel) {
      throw new Error(
        `Failed to load LDraw model for ${brickID}. Cannot create brick without DAT data.`
      );
    }

    // Create brick with the loaded model
    const brick = new BasicBrick(brickID, color, colorType, 2, 3, 2, ldrawModel);

    return brick;
  }

  save() {
    let state = super.save();
    state = {
      ...state,
      brickType: BasicBrick.BrickType,
      width: this.width,
      height: this.height,
      depth: this.depth,
    };
    return state;
  }

  static async load(state) {
    // Load LDraw model first - REQUIRED, no fallback
    const ldrawModel = await BasicBrick.loadLDrawModel(state.brickID, state.color, state.colorType);

    if (!ldrawModel) {
      throw new Error(
        `Failed to load LDraw model for ${state.brickID} during load. Cannot restore brick from saved state.`
      );
    }

    let brick = new BasicBrick(
      state.brickID,
      state.color,
      state.colorType,
      state.width,
      state.height,
      state.depth,
      ldrawModel
    );
    if (state.uuid) brick._uuid = state.uuid;
    brick.setPosition(state.position, true);

    // Apply full rotation matrix if available, otherwise fall back to Y angle
    if (state.rotationMatrix && state.rotationMatrix.length === 9) {
      const m = state.rotationMatrix;
      brick.model.matrixAutoUpdate = false;
      brick.model.matrix.set(
        m[0],
        m[1],
        m[2],
        0,
        m[3],
        m[4],
        m[5],
        0,
        m[6],
        m[7],
        m[8],
        0,
        0,
        0,
        0,
        1
      );
      brick.model.matrix.setPosition(brick.model.position);
      brick.ghostBlock.matrix.copy(brick.model.matrix);
      brick.model.updateMatrixWorld(true);
      brick.ghostBlock.updateMatrixWorld(true);
    }

    return brick;
  }
}
