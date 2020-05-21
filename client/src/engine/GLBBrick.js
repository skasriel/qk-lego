import * as THREE from 'three';

import { Brick, BOUNDINGBOX_OFFSET } from './Brick';
import {multX, multY, multZ, _toStringVector3D, _toStringBox3} from '../util';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BrickCollections } from './BrickCollections';

let brickTemplates = {};
let brickTemplatesLoaded=0, brickTemplatesToLoad=0;
let errorsLoadingTemplates=false;
let timeLoadingTemplates;
let staticCounter=0;
const glbScale = 6;

const USE_SHADOWS=false;

export class GLBBrick extends Brick {
  static ghostBlockMaterial = new THREE.MeshBasicMaterial();
  static BrickType = 'GLB_BRICK';

  constructor(brickID, color, colorType) {
    let model = brickTemplates[brickID].clone();
    super(brickID, color, colorType, model);
    if (model.geometry)
      model.geometry.computeBoundingBox();

    model.name = "GLB "+brickID+" #"+(staticCounter++);
    if (USE_SHADOWS) {
      model.castShadow = true;
      model.receiveShadow = true;
    }

    const material = Brick.getMaterial(color, colorType);
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
    this.setColor(color);

    // Now create a cube (the ghost block) whose dimensions are the bounding box of the brick
    let boundingBox = new THREE.Box3().setFromObject(model);
    let width = boundingBox.max.x - boundingBox.min.x;
    let height = boundingBox.max.y - boundingBox.min.y;
    let depth = boundingBox.max.z - boundingBox.min.z;
    let geo = new THREE.BoxBufferGeometry(width, height, depth);
    GLBBrick.ghostBlockMaterial.color = new THREE.Color(0x222244);
    let ghostMesh = new THREE.Mesh(geo, GLBBrick.ghostBlockMaterial); //new SKBoxHelper(brickMesh); //new THREE.BoxHelper( brickMesh, 0x00ff00 );///
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
      if (child.material) {
        child.material.setValues({color: color});
      }
    });
  }


  /* Create a JSON representation of this brick for saving to server / localStorage */
  save() {
    let state = super.save();
    state = {...state,
      brickType: GLBBrick.BrickType,
    };
    return state;
  }

  /* Create a new brick based on data from server / localStorage */
  static load(state) {
    let brick = new GLBBrick(state.brickID, state.color, state.colorType);
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
          if (brickTemplate.type == BrickCollections.glbBrick) {
            brickTemplatesToLoad++;
            _loadFromServer(brickTemplate, scene); // async so they all load in parrallel
          }
        }
      }
      let tick = setInterval(() => { // HACK - lazy way of doing this - just poll until we've loaded all templates
        if (GLBBrick.areTemplatesReady()) {
          clearInterval(tick);
          resolve('Done loading all templates');
        } else if (errorsLoadingTemplates) {
          clearInterval(tick);
          reject('Error loading GLB templates');
        } else {
          const currentTime = new Date();
          const elapsed = currentTime - timeLoadingTemplates;
          if (elapsed > 1000 * 60) { // number of milliseconds
            clearInterval(tick);
            reject('time out loading GLB templates');
          }
        }
      }, 100)
    });
  }

}


function _loadFromServer(brickTemplate, scene) {
  const id = brickTemplate.id;
  const modelFileName = brickTemplate.path;
  console.log("Loading GLTF template: "+modelFileName);

  let loader = new GLTFLoader();
  //lDrawLoader.separateObjects = false; // todo
  //lDrawLoader.smoothNormals = true; // todo

  loader.load(modelFileName, function(gltf) {
      console.log("Loaded model "+id);

      let model = gltf.scene; // THREE.Group
      /*gltf.animations; // Array<THREE.AnimationClip>
		    gltf.scene; // THREE.Group
		    gltf.scenes; // Array<THREE.Group>
		    gltf.cameras; // Array<THREE.Camera>
        gltf.asset; // Object*/

        /*console.log(`GLTF scene ${JSON.stringify(model)}`);
        console.log(`GLTF scenes ${JSON.stringify(gltf.scenes)}`);
        console.log(`GLTF asset ${JSON.stringify(gltf.asset)}`);
        console.log(`GLTF animation ${JSON.stringify(gltf.animations)}`);*/


      // Convert from LDraw coordinates: rotate 180 degrees around OX
      //model.rotation.x = Math.PI;
      model.scale.copy(new THREE.Vector3(glbScale, glbScale, glbScale));

      // Adjust materials
      //var materials = loader.materials;
      //model.materials = materials;

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

      /*model.traverse(c => {
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
      });*/

      brickTemplates[id] = model; // model.isGroup=true;
      brickTemplatesLoaded++;
    },
    null,
    (error) => {console.log("Error downloading GLB file "+modelFileName+ ": "+error)});
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
