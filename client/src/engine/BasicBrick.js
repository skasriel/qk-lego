import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { multX, multY, multZ } from '../util';
import {Brick} from './Brick';
import {MPDBrick} from './MPDBrick';
import {GLBBrick} from './GLBBrick';
import {OBJBrick} from './OBJBrick';
import { BrickCollections } from './BrickCollections';

const USE_SHADOWS=false;
let staticCounter=0;

export function CSSToHex(cssColor) {
  return parseInt(`#${cssColor.substring(1)}`, 16);
}


export class BasicBrick extends Brick {
  static BrickType = 'BASIC_BRICK';
  constructor(brickID, color, colorType, width, height, depth) {
    const mat = Brick.getMaterial(color, colorType);

    const geo = new THREE.BoxGeometry( width*multX, height*multY, depth*multZ );

    const geometries = [geo.clone()];
    const knobSize = 28;
    const cylinderGeo = new THREE.CylinderGeometry( knobSize, knobSize, knobSize, 12);

    for ( let i = 0; i < width; i++ ) {
      for ( let j = 0; j < depth; j++ ) {
        const knob = cylinderGeo.clone();
        knob.translate(
          multX * i - ((width - 1) * multX / 2),
          height*multY/2 + knobSize/2,
          multZ * j - ((depth - 1) * multZ / 2)
        );
        geometries.push(knob);
      }
    }

    const combined = BufferGeometryUtils.mergeGeometries(geometries);
    let model = new THREE.Mesh(combined, mat);

    const edgeGeo = new THREE.EdgesGeometry( model.geometry );
    const edgeMat = new THREE.LineBasicMaterial( { color: 0x333333, linewidth: 1 } );
    const wireframe = new THREE.LineSegments( edgeGeo, edgeMat );
    model.add( wireframe );

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
    switch (brickTemplate.type) {
      case BrickCollections.basicBrick:
        return new BasicBrick(brickTemplate.id, color, colorType, brickTemplate.width, brickTemplate.height, brickTemplate.depth);
      case BrickCollections.mpdBrick:
        return new MPDBrick(brickTemplate.id, color, colorType);
      case BrickCollections.glbBrick:
        return new GLBBrick(brickTemplate.id, color, colorType);
      case BrickCollections.objBrick:
        return new OBJBrick(brickTemplate.id, color, colorType);
      default:
        console.log("Unknown brick type: "+brickTemplate.type);
        break;
    }
  }


  save() {
    let state = super.save();
    state = {...state,
      brickType: BasicBrick.BrickType,
      width: this.width,
      height: this.height,
      depth: this.depth,
      position: this.model.position
    };
    return state;
  }

  static load(state) {
    let brick = new BasicBrick(state.brickID, state.color, state.colorType, state.width, state.height, state.depth);
    if (state.uuid)  brick._uuid = state.uuid;
    brick.setPosition(state.position, true);
    if (state.angle !== 0) {
      brick.rotateY(state.angle);
    }
    return brick;
  }
}
