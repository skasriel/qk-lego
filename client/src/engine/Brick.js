import v4 from 'uuid';

import * as THREE from 'three';
import {_toStringVector3D, _toStringBox3} from '../util';
import { multX, multY, multZ, ColorCollections } from '../util';
export const BOUNDINGBOX_OFFSET = 0; //50; // hack: for some reason the bricks are 50 too low on the Y axis

export const Materials = {
  FINISH_TYPE_DEFAULT: 0,
  FINISH_TYPE_CHROME: 1,
  FINISH_TYPE_PEARLESCENT: 2,
  FINISH_TYPE_RUBBER: 3,
  FINISH_TYPE_MATTE_METALLIC: 4,
  FINISH_TYPE_METAL: 5,
};

export class Brick {
  constructor(brickID, color, colorType, model) {
    this._brickID = brickID;
    this.model = model;
    this._uuid = v4();
    this._angle = 0;
    this.color = color;
    this.colorType = colorType;
  }

  /* Create a JSON representation of this brick for saving to server / localStorage */
  save() {
    let state = {
      uuid: this._uuid,
      position: this.model.position,
      color: this.color,
      colorType: this.colorType,
      brickID: this._brickID,
      angle: this._angle
    };
    return state;
  }

  getPosition() {
    return this.model.position;
  }
  getModel() {
    return this.model;
  }

  setPosition(position, assumeCorrectAlignment) {
    //console.log(`Brick.setPosition with ${_toStringVector3D(position)}`);
    if (!assumeCorrectAlignment) {
      let boundingBox = new THREE.Box3().setFromObject(this.model);
      let width = boundingBox.max.x - boundingBox.min.x;
      let height = boundingBox.max.y - boundingBox.min.y;
      let depth = boundingBox.max.z - boundingBox.min.z;
      position.x = Math.round(position.x/multX) * multX;
      position.y = Math.round(position.y/multY) * multY;
      position.z = Math.round(position.z/multZ) * multZ;
      //position.x += width / 2; // because position in three.js is wrt the center of the object
      //position.y += height / 2;
      //position.z += depth / 2;
      position.y += BOUNDINGBOX_OFFSET;
    }
    this.model.position.copy(position);
    this.ghostBlock.position.copy(position);

    // HACK force alignment on the Y coordinates between ghost and real...
    let bb1 = new THREE.Box3().setFromObject(this.model);
    let bb2 = new THREE.Box3().setFromObject(this.ghostBlock);
    let deltaY = bb1.min.y - bb2.min.y;
    //console.log(`Forcing ghost Y alignment by ${deltaY}`);
    this.model.position.y -= deltaY;

    if (!assumeCorrectAlignment) {
      // now align with grid again
      const offsetX = bb2.min.x - Math.round(bb2.min.x/multX) * multX;
      const offsetY = bb2.min.y - Math.round(bb2.min.y/multY) * multY;
      const offsetZ = bb2.min.z - Math.round(bb2.min.z/multZ) * multZ;
      //console.log(`Offsets: ${offsetX} ${offsetY} ${offsetZ}`)
      this.model.position.x += offsetX;
      this.model.position.y += offsetY;
      this.model.position.z += offsetZ;
      this.ghostBlock.position.x += offsetX;
      this.ghostBlock.position.y += offsetY;
      this.ghostBlock.position.z += offsetZ;
    }

    let bb4 = new THREE.Box3().setFromObject(this.ghostBlock);
    //console.log(`Brick Position now ${_toStringVector3D(this.model.position)} ; ghostPosition ${_toStringVector3D(this.ghostBlock.position)}`);
    //console.log(`Final BB = ${_toStringBox3(bb4)}`);
  }


  static getMaterial(color, colorType) {
   switch (colorType) {
     case ColorCollections.colorTypes.Solid:
       return new THREE.MeshPhongMaterial( {
         color: color,
         polygonOffset: true,
         polygonOffsetFactor: 1, // positive value pushes polygon further away
         polygonOffsetUnits: 1
       } );
       break;
     case ColorCollections.colorTypes.Transparent:
      return new THREE.MeshPhongMaterial( {
        color: color,
        opacity: 0.6,
        transparent: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1, // positive value pushes polygon further away
        polygonOffsetUnits: 1
      } );
       break;
    case ColorCollections.colorTypes.Metallic:
      return new THREE.MeshStandardMaterial( {
        color: color,
        roughness: 0.2,
        metalness: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: 1, // positive value pushes polygon further away
        polygonOffsetUnits: 1
      } );
      break;

    default:
      console.log("Unknown color type: "+colorType);
      return new THREE.MeshPhongMaterial( {
        color: color,
        roughness: 0.3,
        polygonOffset: true,
        polygonOffsetFactor: 1, // positive value pushes polygon further away
        polygonOffsetUnits: 1
      } );
      break;
   };

    /*var code = null;
    // Triangle and line colours
    var colour = 0xFF00FF;
    var edgeColour = 0xFF00FF;
    // Transparency
    var alpha = 1;
    var isTransparent = false;
    // Self-illumination:
    var luminance = 0;

    var finishType = Materials.FINISH_TYPE_DEFAULT;
    var canHaveEnvMap = true;

    var edgeMaterial = null;

    switch ( finishType ) {
      case Materials.FINISH_TYPE_DEFAULT:
        material = new THREE.MeshStandardMaterial( { color: colour, roughness: 0.3, envMapIntensity: 0.3, metalness: 0 } );
        material.name = `Default Finish color=${colour}`;
        break;

      case Materials.FINISH_TYPE_PEARLESCENT:
        // Try to imitate pearlescency by setting the specular to the complementary of the color, and low shininess
        var specular = new THREE.Color( colour );
        var hsl = specular.getHSL( { h: 0, s: 0, l: 0 } );
        hsl.h = ( hsl.h + 0.5 ) % 1;
        hsl.l = Math.min( 1, hsl.l + ( 1 - hsl.l ) * 0.7 );
        specular.setHSL( hsl.h, hsl.s, hsl.l );
        material = new THREE.MeshPhongMaterial( { color: colour, specular: specular, shininess: 10, reflectivity: 0.3 } );
        material.name = `PEARLESCENT Finish color=${colour}`;
        break;

      case Materials.FINISH_TYPE_CHROME:
        // Mirror finish surface
        material = new THREE.MeshStandardMaterial( { color: colour, roughness: 0, metalness: 1 } );
        material.name = `Chrome Finish color=${colour}`;
        break;

      case Materials.FINISH_TYPE_RUBBER:
        // Rubber finish
        material = new THREE.MeshStandardMaterial( { color: colour, roughness: 0.9, metalness: 0 } );
        canHaveEnvMap = false;
        material.name = `Rubber Finish color=${colour}`;
        break;

      case Materials.FINISH_TYPE_MATTE_METALLIC:
        // Brushed metal finish
        material = new THREE.MeshStandardMaterial( { color: colour, roughness: 0.8, metalness: 0.4 } );
        material.name = `Matte Finish color=${colour}`;
        break;

      case Materials.FINISH_TYPE_METAL:
        // Average metal finish
        material = new THREE.MeshStandardMaterial( { color: colour, roughness: 0.2, metalness: 0.85 } );
        material.name = `Metal Finish color=${colour}`;
        break;
      default: break;
    }*/
  }

  addToScene(scene, ghostScene) {
    scene.add(this.model);
    ghostScene.add(this.ghostBlock);
  }
  removeFromScene(scene, ghostScene) {
    scene.remove(this.model);
    ghostScene.remove(this.ghostBlock);
  }
  rotateY(angle) {
    this._angle += angle;
    this.model.rotateY(angle);
    this.ghostBlock.rotateY(angle);
  }


}
