import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LDrawLoader } from 'three/examples/jsm/loaders/LDrawLoader.js';
import { multX, multY, multZ } from '../util';
import { Brick } from './Brick';
import { MPDBrick } from './MPDBrick';
import { GLBBrick } from './GLBBrick';
import { OBJBrick } from './OBJBrick';
import { BrickCollections } from './BrickCollections';

const USE_SHADOWS = false;
let staticCounter = 0;
let lDrawLoader = null;
let lDrawCache = {};

function getLDrawLoader() {
  if (!lDrawLoader) {
    lDrawLoader = new LDrawLoader();
    // setPath controls where load() fetches the main file from
    lDrawLoader.setPath('/ldraw/parts/');
    // setPartsLibraryPath controls where fetchData() looks for sub-parts
    lDrawLoader.setPartsLibraryPath('/ldraw/');
  }
  return lDrawLoader;
}

export function CSSToHex(cssColor) {
  return parseInt(`#${cssColor.substring(1)}`, 16);
}

export class BasicBrick extends Brick {
  static BrickType = 'BASIC_BRICK';

  static async loadLDrawModel(brickID, color, colorType) {
    const cacheKey = `${brickID}_${color}_${colorType}`;
    if (lDrawCache[cacheKey]) {
      return lDrawCache[cacheKey].clone();
    }

    return new Promise((resolve, reject) => {
      const loader = getLDrawLoader();
      // Try without the parts/ prefix since loader adds it
      const partPath = `${brickID}.dat`;

      console.log(`Attempting to load LDraw model: /ldraw/parts/${partPath}`);

      loader.load(
        partPath,
        (group) => {
          console.log(`Successfully loaded LDraw model for ${brickID}`, group);
          // Apply color
          const mat = Brick.getMaterial(color, colorType);
          group.traverse((child) => {
            if (child.isMesh) {
              child.material = mat;
            }
          });
          lDrawCache[cacheKey] = group;
          resolve(group.clone());
        },
        (progress) => {
          if (progress.total > 0) {
            console.log(
              `Loading ${brickID}: ${Math.round((progress.loaded / progress.total) * 100)}%`
            );
          }
        },
        (error) => {
          console.error(`Failed to load LDraw model for ${brickID}:`, error);
          console.error(`Tried to load from: /ldraw/parts/${partPath}`);
          resolve(null);
        }
      );
    });
  }

  constructor(brickID, color, colorType, width, height, depth) {
    const mat = Brick.getMaterial(color, colorType);

    const geo = new THREE.BoxGeometry(width * multX, height * multY, depth * multZ);

    const geometries = [geo.clone()];
    const knobSize = 28;
    const cylinderGeo = new THREE.CylinderGeometry(knobSize, knobSize, knobSize, 12);

    for (let i = 0; i < width; i++) {
      for (let j = 0; j < depth; j++) {
        const knob = cylinderGeo.clone();
        knob.translate(
          multX * i - ((width - 1) * multX) / 2,
          (height * multY) / 2 + knobSize / 2,
          multZ * j - ((depth - 1) * multZ) / 2
        );
        geometries.push(knob);
      }
    }

    const combined = BufferGeometryUtils.mergeGeometries(geometries);
    let model = new THREE.Mesh(combined, mat);

    const edgeGeo = new THREE.EdgesGeometry(model.geometry);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 1 });
    const wireframe = new THREE.LineSegments(edgeGeo, edgeMat);
    model.add(wireframe);

    if (USE_SHADOWS) {
      model.castShadow = true;
      model.receiveShadow = true;
    }

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
  }

  static createBrick(brickID, color, colorType) {
    const brickTemplate = BrickCollections.getBrickFromID(brickID);
    console.log(`Brick.createBrick with ${brickID} => ${JSON.stringify(brickTemplate)}`);

    // Try to create with LDraw model first (async)
    const brick = new BasicBrick(
      brickID,
      color,
      colorType,
      brickTemplate?.width || 2,
      brickTemplate?.height || 3,
      brickTemplate?.depth || 4
    );

    // Attempt to load LDraw model asynchronously
    BasicBrick.loadLDrawModel(brickID, color, colorType).then((ldrawModel) => {
      if (ldrawModel && brick.model) {
        // Replace the simple geometry with LDraw model
        const parent = brick.model.parent;
        console.log(
          `LDraw model ready for ${brickID}, parent=${parent ? 'yes' : 'null'}, position=${JSON.stringify(brick.model.position)}`
        );
        if (parent) {
          const position = brick.model.position.clone();
          const rotation = brick.model.rotation.clone();

          parent.remove(brick.model);
          // LDraw uses a different coordinate system and scale
          // LDraw units: 1 LDU = 0.4mm, standard brick = 20x24x20 LDU
          // Scale LDraw model to match our coordinate system
          const scaleFactor = 5;
          ldrawModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
          ldrawModel.position.copy(position);
          ldrawModel.rotation.copy(rotation);
          ldrawModel.rotation.x += Math.PI; // Flip upright (studs on top)
          ldrawModel.name = brick.model.name;
          parent.add(ldrawModel);
          brick.model = ldrawModel;
        }
      }
    });

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
      position: this.model.position,
    };
    return state;
  }

  static load(state) {
    let brick = new BasicBrick(
      state.brickID,
      state.color,
      state.colorType,
      state.width,
      state.height,
      state.depth
    );
    if (state.uuid) brick._uuid = state.uuid;
    brick.setPosition(state.position, true);
    if (state.angle !== 0) {
      brick.rotateY(state.angle);
    }
    return brick;
  }
}
