import * as THREE from 'three';

import { Brick, BOUNDINGBOX_OFFSET } from './Brick';
import {multX, multY, multZ, _toStringVector3D, _toStringBox3} from '../util';
import { DDSLoader } from 'three/examples/jsm/loaders/DDSLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { BrickCollections } from './BrickCollections';

let brickTemplates = {};
let brickTemplatesLoaded=0, brickTemplatesToLoad=0;
let errorsLoadingTemplates=false;
let timeLoadingTemplates;
let staticCounter=0;
const objScale = 6;
const USE_SHADOWS=false;

export class OBJBrick extends Brick {
  static ghostBlockMaterial = new THREE.MeshBasicMaterial();
  static BrickType = 'OBJ_BRICK';

  constructor(brickID, color, colorType) {
    let model = brickTemplates[brickID].clone();
    super(brickID, color, colorType, model);
    if (model.geometry)
      model.geometry.computeBoundingBox();

    model.name = "OBJ "+brickID+" #"+(staticCounter++);
    if (USE_SHADOWS) {
      model.castShadow = true;
      model.receiveShadow = true;
    }

    /*const material = Brick.getMaterial(color, colorType);
    let i=0
    this.model.traverse( (child) => {
      if (child.material) {
        console.log(`Material for child ${i} = ${JSON.stringify(child.material)}`);
        i++
        child.material = material;
        //child.material.clone();
        //child.material.setValues({color: color});
      }
    });
    this.materials = brickTemplates[brickID].materials;
    this.setColor(color);*/

    // Now create a cube (the ghost block) whose dimensions are the bounding box of the brick
    let boundingBox = new THREE.Box3().setFromObject(model);
    let width = boundingBox.max.x - boundingBox.min.x;
    let height = boundingBox.max.y - boundingBox.min.y;
    let depth = boundingBox.max.z - boundingBox.min.z;
    let geo = new THREE.BoxBufferGeometry(width, height, depth);
    OBJBrick.ghostBlockMaterial.color = new THREE.Color(0x222244);
    let ghostMesh = new THREE.Mesh(geo, OBJBrick.ghostBlockMaterial); //new SKBoxHelper(brickMesh); //new THREE.BoxHelper( brickMesh, 0x00ff00 );///
    ghostMesh.position.copy(model.position);
    ghostMesh.position.y += BOUNDINGBOX_OFFSET; // HACK
    ghostMesh.name = "Bounding Box for object "+model.name;
    ghostMesh.brick = this;
    model.block = ghostMesh;
    this.ghostBlock = ghostMesh;
  }

  /* Create a JSON representation of this brick for saving to server / localStorage */
  save() {
    let state = super.save();
    state = {...state,
      brickType: OBJBrick.BrickType,
    };
    return state;
  }

  /* Create a new brick based on data from server / localStorage */
  static load(state) {
    let brick = new OBJBrick(state.brickID, state.color, state.colorType);
    if (state.angle != 0) {
      brick.rotateY(state.angle);
    }
    brick.model.position.x = state.position.x;
    brick.model.position.y = state.position.y;
    brick.model.position.z = state.position.z;
    brick.ghostBlock.position.x = state.position.x;
    brick.ghostBlock.position.y = state.position.y; // TODO: needs to be fixed
    brick.ghostBlock.position.z = state.position.z;
    //brick.setPosition(state.position, true);
    if (state.uuid)  brick._uuid = state.uuid; // override uuid when creating brick from server
    return brick;
  }

  static areTemplatesReady() {
    return brickTemplatesLoaded == brickTemplatesToLoad;
  }

  /* Load all files from server and create the corresponding Brick objects */
  static loadAllTemplates(scene) {
    timeLoadingTemplates = new Date();
    return new Promise((resolve, reject) => {
      for (let collectionID in BrickCollections.collections) {
        let collection = BrickCollections.collections[collectionID];
        for (let brickTemplate of collection) {
          if (brickTemplate.type == BrickCollections.objBrick) {
            brickTemplatesToLoad++;
            _loadFromServer(brickTemplate, scene); // async so they all load in parrallel
          }
        }
      }
      let tick = setInterval(() => { // HACK - lazy way of doing this - just poll until we've loaded all templates
        if (OBJBrick.areTemplatesReady()) {
          clearInterval(tick);
          resolve('Done loading all templates');
        } else if (errorsLoadingTemplates) {
          clearInterval(tick);
          reject('Error loading OBJ templates');
        } else {
          const currentTime = new Date();
          const elapsed = currentTime - timeLoadingTemplates;
          if (elapsed > 1000 * 60) { // number of milliseconds
            clearInterval(tick);
            reject('time out loading OBJ templates');
          }
        }
      }, 100)
    });
  }

}


function _loadFromServer(brickTemplate, scene) {
  const id = brickTemplate.id;
  const mtlFileName = brickTemplate.mtl;
  const objFileName = brickTemplate.obj;
  //const modelFileName = BrickCollections.getBrickFromID(id).path;
  console.log("Loading OBJ template: "+mtlFileName+" & "+objFileName);

  const manager = new THREE.LoadingManager();
  manager.addHandler( /\.dds$/i, new DDSLoader() );
  // comment in the following line and import TGALoader if your asset uses TGA textures
  // manager.addHandler( /\.tga$/i, new TGALoader() );

  new MTLLoader( manager ).load(mtlFileName, function(materials) {
    materials.preload();
    new OBJLoader(manager).setMaterials(materials).load(objFileName, function (object) {
      //object.position.y = - 95;
      //scene.add( object );
      let model = object;
      let scale = objScale;
      if (brickTemplate.scale) {
        scale = brickTemplate.scale;
      }
      model.scale.copy(new THREE.Vector3(scale, scale, scale));
      brickTemplates[id] = model; // model.isGroup=true;
      brickTemplatesLoaded++;
    }, null, (error) => {console.log("Error downloading OBJ file "+objFileName+ ": "+error)}
  )}, null, (error) => {console.log("Error downloading MTL file "+mtlFileName+ ": "+error)}
  );
}
