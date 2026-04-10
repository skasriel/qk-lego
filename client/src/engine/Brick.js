import { v4 } from 'uuid';

import * as THREE from 'three';
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
    // Ensure matrix is up to date
    this.model.updateMatrixWorld(true);
    const me = this.model.matrixWorld.elements;
    // Three.js stores matrices in column-major order, but we need row-major for MPD
    // Extract 3x3 rotation and transpose from column-major to row-major
    let state = {
      uuid: this._uuid,
      position: {
        x: Math.round(this.model.position.x),
        y: Math.round(this.model.position.y),
        z: Math.round(this.model.position.z),
      },
      color: this.color,
      colorType: this.colorType,
      brickID: this._brickID,
      rotationMatrix: [
        me[0],
        me[4],
        me[8], // First row (was first column)
        me[1],
        me[5],
        me[9], // Second row (was second column)
        me[2],
        me[6],
        me[10], // Third row (was third column)
      ],
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
    if (!assumeCorrectAlignment) {
      position.x = Math.round(position.x / multX) * multX;
      position.y = Math.round(position.y / multY) * multY;
      position.z = Math.round(position.z / multZ) * multZ;
      position.y += BOUNDINGBOX_OFFSET;
    }

    // Both model and ghost block get the same position
    // The ghost block (simple box) is the authoritative reference
    this.ghostBlock.position.copy(position);
    this.model.position.copy(position);
  }

  static getMaterial(color, colorType) {
    // Default to white if color is undefined
    const safeColor = color || '#FFFFFF';
    switch (colorType) {
      case ColorCollections.colorTypes.Solid:
        return new THREE.MeshPhongMaterial({
          color: safeColor,
          polygonOffset: true,
          polygonOffsetFactor: 1, // positive value pushes polygon further away
          polygonOffsetUnits: 1,
        });
      case ColorCollections.colorTypes.Transparent:
        return new THREE.MeshPhongMaterial({
          color: color,
          opacity: 0.6,
          transparent: true,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: 1, // positive value pushes polygon further away
          polygonOffsetUnits: 1,
        });
      case ColorCollections.colorTypes.Metallic:
        return new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.2,
          metalness: 0.85,
          polygonOffset: true,
          polygonOffsetFactor: 1, // positive value pushes polygon further away
          polygonOffsetUnits: 1,
        });

      default:
        console.log('Unknown color type: ' + colorType);
        return new THREE.MeshPhongMaterial({
          color: color,
          roughness: 0.3,
          polygonOffset: true,
          polygonOffsetFactor: 1, // positive value pushes polygon further away
          polygonOffsetUnits: 1,
        });
    }
  }

  addToScene(scene, ghostScene) {
    scene.add(this.model);
    ghostScene.add(this.ghostBlock);
  }
  removeFromScene(scene, ghostScene) {
    scene.remove(this.model);
    ghostScene.remove(this.ghostBlock);
  }
  setColor(color, colorType = this.colorType) {
    this.color = color;
    this.colorType = colorType;
    const material = Brick.getMaterial(color, colorType);
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.material = material;
      }
    });
    if (this.ghostBlock) {
      this.ghostBlock.material = material;
    }
  }
  rotateY(angle) {
    this._angle += angle;
    this.model.rotateY(angle);
    this.ghostBlock.rotateY(angle);
  }
}
