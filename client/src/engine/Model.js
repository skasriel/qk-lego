import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';

/**
 * Model represents a hierarchical LDraw model (MPD/LDR file).
 * Can contain both Bricks and other Models, mirroring the LDraw file structure.
 */
export class Model {
  constructor(name = 'Untitled') {
    this.uuid = uuidv4();
    this.name = name;
    this.children = []; // Array of { type: 'brick'|'model', object: Brick|Model, transform: Matrix4 }
    this.position = new THREE.Vector3(0, 0, 0);
    this.rotation = new THREE.Euler(0, 0, 0);
    this.scale = new THREE.Vector3(1, 1, 1);
  }

  addBrick(brick, transform = null) {
    this.children.push({
      type: 'brick',
      object: brick,
      transform:
        transform || {
          position: {
            x: brick.getModel().position.x,
            y: brick.getModel().position.y,
            z: brick.getModel().position.z,
          },
          rotationMatrix: brick.save().rotationMatrix,
        },
    });
  }

  addModel(model, transform = null) {
    this.children.push({
      type: 'model',
      object: model,
      transform:
        transform || {
          position: { x: model.position.x, y: model.position.y, z: model.position.z },
          rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        },
    });
  }

  // Convert to Three.js Group for rendering
  toThreeGroup() {
    const group = new THREE.Group();
    group.name = this.name;

    for (const child of this.children) {
      let childObject;
      if (child.type === 'brick') {
        childObject = child.object.model.clone();
      } else if (child.type === 'model') {
        childObject = child.object.toThreeGroup();
      }

      if (childObject) {
        // Apply the stored transform
        childObject.applyMatrix4(child.transform);
        group.add(childObject);
      }
    }

    // Apply this model's own transform
    group.position.copy(this.position);
    group.rotation.copy(this.rotation);
    group.scale.copy(this.scale);

    return group;
  }

  // Save to MPD format
  toMPD() {
    const lines = [];
    lines.push(`0 ${this.name}`);
    lines.push(`0 Name: ${this.name}.ldr`);
    lines.push('0 Author: QK Lego Builder');
    lines.push('0 !LDRAW_ORG Unofficial_Model');
    lines.push('');

    for (const child of this.children) {
      if (child.type === 'brick') {
        const brick = child.object;
        const pos = child.transform
          ? new THREE.Vector3().setFromMatrixPosition(child.transform)
          : brick.model.position;

        // Extract rotation matrix
        const m = child.transform
          ? child.transform.elements
          : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

        const colorCode = 0; // TODO: map color properly
        const partFile = `${brick._brickID}.dat`;

        lines.push(
          `1 ${colorCode} ${pos.x.toFixed(4)} ${pos.y.toFixed(4)} ${pos.z.toFixed(4)} ` +
            `${m[0].toFixed(6)} ${m[4].toFixed(6)} ${m[8].toFixed(6)} ` +
            `${m[1].toFixed(6)} ${m[5].toFixed(6)} ${m[9].toFixed(6)} ` +
            `${m[2].toFixed(6)} ${m[6].toFixed(6)} ${m[10].toFixed(6)} ${partFile}`
        );
      }
    }

    return lines.join('\n');
  }

  static fromMPD(mpdContent, name = 'Imported Model') {
    const model = new Model(name);
    const lines = mpdContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('1 ')) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length < 15) continue;

      const colorCode = parts[1];
      const x = parseFloat(parts[2]);
      const y = parseFloat(parts[3]);
      const z = parseFloat(parts[4]);
      const matrix = [
        parseFloat(parts[5]),
        parseFloat(parts[6]),
        parseFloat(parts[7]),
        0,
        parseFloat(parts[8]),
        parseFloat(parts[9]),
        parseFloat(parts[10]),
        0,
        parseFloat(parts[11]),
        parseFloat(parts[12]),
        parseFloat(parts[13]),
        0,
        0,
        0,
        0,
        1,
      ];
      const filename = parts.slice(14).join(' ');

      // Create a placeholder brick - in real implementation, load the actual part
      const partNum = filename.replace('.dat', '');

      model.children.push({
        type: 'brick',
        object: { brickID: partNum, color: '#FFFFFF' },
        transform: new THREE.Matrix4().fromArray(matrix).setPosition(x, y, z),
      });
    }

    return model;
  }
}
