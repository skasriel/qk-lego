import * as THREE from 'three';

import {multX, multY, multZ, BrickCollections} from '../util';
import Brick from './Brick';
import { LDrawLoader } from 'three/examples/jsm/loaders/LDrawLoader.js';

let brickTemplates = {};
let brickTemplatesLoaded=0;
let errorsLoadingTemplates=false;
let timeLoadingTemplates;
let staticCounter=0;

export const MPD_BRICK = 'MPD_BRICK';

function CSSToHex(cssColor) {
  return parseInt(`0x${cssColor.substring(1)}`, 16);
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

export default class MPDBrick extends Brick {
  constructor(brickID) {
    let model = brickTemplates[brickID].clone();
    super(model);

    this.materials = brickTemplates[brickID].materials;
    this.setColor(0xff2222);

    model.name = "MPD "+brickID+" #"+(staticCounter++);
    model.castShadow = true;
    model.receiveShadow = true;

    this._brickID = brickID;
  }
  static areTemplatesReady() {
    return brickTemplatesLoaded == BrickCollections.getNumberOfBricks(); //brickTemplateIDs.length;
  }

  setColor(color) {
    this._color = color;
    //const material = this.materials[0].clone();
    //material.setValues({color: color});
    this._model.traverse( (child) => {
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


  /* Load all MPD files from server and create the corresponding MPDBrick objects */
  static loadAllTemplates(scene) {
    timeLoadingTemplates = new Date();
    return new Promise((resolve, reject) => {
      for (let collectionID in BrickCollections.collections) {
        let collection = BrickCollections.collections[collectionID];
        for (let id of collection) {
          console.log("Loading "+id);
          _loadFromLDFile(id, scene); // async so they all load in parrallel
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

  /* Create a JSON representation of this brick for saving to server / localStorage */
  save() {
    let state = super.save();
    state.brickID = this._brickID;
    state.brickType=MPD_BRICK;
    return state;
  }

  /* Create a new brick based on data from server / localStorage */
  static load(state) {
    let brick = new MPDBrick(state.brickID);
    brick.setPosition(state.position);
    if (state.angle != 0) {
      brick.rotateY(state.angle);
    }
    return brick;
  }
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
