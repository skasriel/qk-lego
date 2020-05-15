import * as THREE from 'three';
import v4 from 'uuid';

export default class Brick {
  constructor(model) {
    this._model = model;
    if (model.geometry)
      model.geometry.computeBoundingBox();
    this._uuid = v4();
    this._angle = 0;
  }

  addToScene(scene) {
    scene.add(this._model);
  }
  setMaterial(material) {
    this._model.setMaterial(material);
  }
  setPosition(position) {
    this._model.position.copy(position);
  }
  getPosition() {
    return this._model.position;
  }
  getModel() {
    return this._model;
  }
  rotateY(angle) {
    this._angle += angle;
    this._model.rotateY( angle );
  }
  save() {
    let state = {
      uuid: this._uuid,
      angle: this._angle,
      position: this._model.position
    };
    return state;
  }
}
