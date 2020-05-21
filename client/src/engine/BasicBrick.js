import * as THREE from 'three';
import { multX, multY, multZ } from '../util';
import {Brick} from './Brick';
import {MPDBrick} from './MPDBrick';
import {GLBBrick} from './GLBBrick';
import {OBJBrick} from './OBJBrick';
import { BrickCollections } from './BrickCollections';

const USE_SHADOWS=false;

export function CSSToHex(cssColor) {
  return parseInt(`#${cssColor.substring(1)}`, 16);
}


export class BasicBrick extends Brick {
  static BrickType = 'BASIC_BRICK';
  constructor(brickID, color, colorType, width, height, depth) {
    const mat = Brick.getMaterial(color, colorType);

    const geo = new THREE.BoxGeometry( width*multX, height*multY, depth*multZ );
    const cubeMesh = new THREE.Mesh(geo, mat);
    if (USE_SHADOWS) {
      cubeMesh.castShadow = true;
      cubeMesh.receiveShadow = true;
    }

    const meshes=[cubeMesh];
    const knobSize = 28;
    const cylinderGeo = new THREE.CylinderGeometry( knobSize, knobSize, knobSize, 12);

    for ( var i = 0; i < width; i++ ) {
      for ( var j = 0; j < depth; j++ ) {
        const cylinder = new THREE.Mesh(cylinderGeo, mat);
        cylinder.position.x = multX * i - ((width - 1) * multX / 2);
        cylinder.position.y = height*multY/2 + knobSize/2;
        cylinder.position.z = multZ * j - ((depth - 1) * multZ / 2);
        if (USE_SHADOWS) {
          cylinder.castShadow = true;
          cylinder.receiveShadow = true;
        }
        meshes.push( cylinder );
      }
    }

    var combined = new THREE.Geometry();
    for (var i = 0; i < meshes.length; i++) {
      meshes[i].updateMatrix();
      combined.merge(meshes[i].geometry, meshes[i].matrix);
    }

    let model = new THREE.Mesh(combined, mat);

    var edgeGeo = new THREE.EdgesGeometry( model.geometry ); // or WireframeGeometry
    var edgeMat = new THREE.LineBasicMaterial( { color: 0x333333, linewidth: 1 } );
    var wireframe = new THREE.LineSegments( edgeGeo, edgeMat );
    model.add( wireframe );

    if (USE_SHADOWS) {
      model.castShadow = true;
      model.receiveShadow = true;
    }

    super(brickID, color, colorType, model);

    this.ghostBlock = new THREE.Mesh(geo.clone(), mat);
    this.ghostBlock.brick = this;
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
        break;
      case BrickCollections.mpdBrick:
        return new MPDBrick(brickTemplate.id, color, colorType);
        break;
      case BrickCollections.glbBrick:
        return new GLBBrick(brickTemplate.id, color, colorType);
        break;
      case BrickCollections.objBrick:
      return new OBJBrick(brickTemplate.id, color, colorType);
      break;
      default:
        console.log("Unknown brick type: "+brickTemplate.type);
        break;
    }
  }


  /* Create a JSON representation of this brick for saving to server / localStorage */
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

  /* Create a new brick based on data from server / localStorage */
  static load(state) {
    let brick = new BasicBrick(state.brickID, state.color, state.colorType, state.width, state.height, state.depth);
    if (state.uuid)  brick._uuid = state.uuid; // override uuid when creating brick from server
    brick.setPosition(state.position, true);
    if (state.angle != 0) {
      brick.rotateY(state.angle);
    }
    return brick;
  }
}
