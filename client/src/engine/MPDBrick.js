import * as THREE from 'three';

import { Brick, BOUNDINGBOX_OFFSET } from './Brick';
import {multX, multY, multZ, _toStringVector3D, _toStringBox3} from '../util';
import { LDrawLoader } from 'three/examples/jsm/loaders/LDrawLoader.js';
import { BrickCollections } from './BrickCollections';

let brickTemplates = {};
let brickTemplatesLoaded=0, brickTemplatesToLoad=0;
let errorsLoadingTemplates=false;
let timeLoadingTemplates;
let staticCounter=0;

const USE_SHADOWS=false;

export class MPDBrick extends Brick {
  static ghostBlockMaterial = new THREE.MeshBasicMaterial();
  static BrickType = 'MPD_BRICK';

  constructor(brickID, color, colorType) {
    let model = brickTemplates[brickID].clone();
    super(brickID, color, colorType, model);
    if (model.geometry)
      model.geometry.computeBoundingBox();

    model.name = "MPD "+brickID+" #"+(staticCounter++);
    if (USE_SHADOWS) {
      model.castShadow = true;
      model.receiveShadow = true;
    }

    this.materials = brickTemplates[brickID].materials;

    // Now create a cube (the ghost block) whose dimensions are the bounding box of the brick
    let boundingBox = new THREE.Box3().setFromObject(model);
    let width = boundingBox.max.x - boundingBox.min.x;
    let height = boundingBox.max.y - boundingBox.min.y;
    let depth = boundingBox.max.z - boundingBox.min.z;
    let geo = new THREE.BoxBufferGeometry(width, height, depth);
    MPDBrick.ghostBlockMaterial.color = new THREE.Color(0x222244);
    let ghostMesh = new THREE.Mesh(geo, MPDBrick.ghostBlockMaterial); //new SKBoxHelper(brickMesh); //new THREE.BoxHelper( brickMesh, 0x00ff00 );///
    ghostMesh.position.copy(model.position);
    ghostMesh.position.y += BOUNDINGBOX_OFFSET; // HACK
    ghostMesh.name = "Bounding Box for object "+model.name;
    ghostMesh.brick = this;
    model.block = ghostMesh;
    this.ghostBlock = ghostMesh;
  }

  setColor(color) {
    //const material = this.materials[0].clone();
    //material.setValues({color: color});
    this.model.traverse( (child) => {
      if (child.material && child.material.length>0) {
        let childMaterial = child.material[0];
        //console.log(`Child ${child} material ${childMaterial} name ${childMaterial.name}`);
        //childMaterial.setValues({color: color});
        if (child.material[0] === this.materials[0]) {
          console.log("Replaced material");
          const material = childMaterial.clone();
          material.setValues({color: color});
          //childMaterial.setValues({color: color});
          child.material[0] = material;
          child.material[0].needsUpdate = true;
        }
      }
    });
  }


  /* Create a JSON representation of this brick for saving to server / localStorage */
  save() {
    let state = super.save();
    state = {...state,
      brickType: MPDBrick.BrickType,
    };
    return state;
  }

  /* Create a new brick based on data from server / localStorage */
  static load(state) {
    let brick = new MPDBrick(state.brickID);
    brick.setPosition(state.position, true);
    if (state.angle != 0) {
      brick.rotateY(state.angle);
    }
    if (state.uuid)  brick._uuid = state.uuid; // override uuid when creating brick from server
    return brick;
  }

  static areTemplatesReady() {
    return brickTemplatesLoaded == brickTemplatesToLoad;
  }

  /* Load all MPD files from server and create the corresponding MPDBrick objects */
  static loadAllTemplates(scene) {
    timeLoadingTemplates = new Date();
    return new Promise((resolve, reject) => {
      for (let collectionID in BrickCollections.collections) {
        let collection = BrickCollections.collections[collectionID];
        for (let brickTemplate of collection) {
          if (brickTemplate.type == BrickCollections.mpdBrick) {
            brickTemplatesToLoad++;
            _loadFromLDFile(brickTemplate.id, scene); // async so they all load in parrallel
          }
        }
      }
      let tick = setInterval(() => { // HACK - lazy way of doing this - just poll until we've loaded all templates
        if (MPDBrick.areTemplatesReady()) {
          clearInterval(tick);
          resolve('Done loading all templates');
        } else if (errorsLoadingTemplates) {
          clearInterval(tick);
          reject('Error loading MPD templates');
        } else {
          const currentTime = new Date();
          const elapsed = currentTime - timeLoadingTemplates;
          if (elapsed > 1000 * 60) { // number of milliseconds
            clearInterval(tick);
            reject('time out loading MPD templates');
          }
        }
      }, 100)
    });
  }

}


function _loadFromLDFile(id, scene) {
  const ldrawPath = '/models/bricks/';
  const modelFileName = id+'.dat.mpd';
  //console.log("Loading template: "+modelFileName);

  let lDrawLoader = new LDrawLoader();
  lDrawLoader.separateObjects = false; // todo
  lDrawLoader.smoothNormals = true; // todo

  lDrawLoader.setPath(ldrawPath).load(modelFileName, function(model) {
      //console.log("Loaded model "+id);

      // Convert from LDraw coordinates: rotate 180 degrees around OX
      model.rotation.x = Math.PI;
      const mdpScale = 5;
      model.scale.copy(new THREE.Vector3(mdpScale, mdpScale, mdpScale));

      // Adjust materials
      var materials = lDrawLoader.materials;
      model.materials = materials;

      /*  const envMapActivated = false;
        if ( envMapActivated ) {
        let textureCube;

        if ( ! textureCube ) { // Envmap texture
          var r = "textures/cube/Bridge2/";
          var urls = [ r + "posx.jpg", r + "negx.jpg",
            r + "posy.jpg", r + "negy.jpg",
            r + "posz.jpg", r + "negz.jpg" ];
          textureCube = new THREE.CubeTextureLoader().load( urls );
          textureCube.mapping = THREE.CubeReflectionMapping;
        }

        for (let i = 0, n = materials.length; i < n; i ++ ) {
          var material = materials[ i ];
          if ( material.userData.canHaveEnvMap ) {
            material.envMap = textureCube;
          }
        }
      }*/

      model.traverse(c => {
        const conditionalLines = true; // todo
        const displayLines = true; // todo
        if ( c.isLineSegments ) {
          if ( c.isConditionalLine ) {
            c.visible = conditionalLines;
          } else {
            c.visible = displayLines;
          }
        } else if ( c.isGroup ) {
          // Hide objects with construction step
          //const constructionStep = model.userData.numConstructionSteps - 1;
          c.visible = true; //c.userData.constructionStep <= constructionStep;
        }
      });

      brickTemplates[id] = model; // model.isGroup=true;
      brickTemplatesLoaded++;
    },
    null,
    (error) => {console.log("Error downloading LD file "+modelFileName+ ": "+error)});
}



    /*materials[0] = new THREE.MeshStandardMaterial({
      color: 0x444444,
      metalness: 0.4,
      roughness: 0.5,
    });
    materials[1] = new THREE.MeshStandardMaterial({
      color: 0xAA0000,
      metalness: 0.4,
      roughness: 0.5,
    });*/

    /*const material = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      metalness: 0.4,
      roughness: 0.5,
    });
    //model.material.color = 0xcc0000;
    model.traverse(function (child) {
      if (child.material) {
        child.material.color = 0x00cc00;
      }
    });*/
