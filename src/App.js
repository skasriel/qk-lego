import React from 'react';
//import './App.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';


function App() {
  return null;
  return (
    <div className="App">
    </div>
  );
}
export default App;

class BasicBlock {
  constructor(length, width, height) {
    this.length = length;
    this.width = width;
    this.height = height;
  }
}


let scene, container, controls, camera, renderer;
let legos; // the world - currently an array of specific building block instances
let buildingBlocks = []; // all the available building blocks
const multX=1.0, multY=.4, multZ=1.0; // convert from Lego Units to Three.js units

setup();
render();
animate();

function setup() {
  basicSetup();
  groundSetup();
  lightSetup();
  buildingBlocksSetup();
  controlsSetup();
}

function controlsSetup() {
  controls = new OrbitControls( camera, renderer.domElement );
  controls.update();
}


function basicSetup() {
  container = document.createElement( 'div' );
  document.body.appendChild( container );
  camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 100 );
  camera.position.set(0,10,30);

  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  container.appendChild( renderer.domElement );
}

function groundSetup() {
  let ground = new THREE.Mesh( new THREE.PlaneBufferGeometry( 10000, 10000 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
  //    new THREE.MeshBasicMaterial( { color: 0x6e6a62, depthWrite: false } )

	ground.rotation.x = - Math.PI / 2;
	//ground.receiveShadow = true;
	scene.add( ground );
  ground.renderOrder = 1;

  let grid = new THREE.GridHelper( 400, 80, 0x000000, 0x000000 );
  grid.material.opacity = 0.1;
  grid.material.depthWrite = false;
  grid.material.transparent = true;
  //grid.receiveShadow = true;
  scene.add( grid );
}

function lightSetup() {
  // adds ambient light
  let ambientLight = new THREE.AmbientLight("rgb(100%, 90%, 90%)"); // soft white light
  scene.add( ambientLight );

  /*let dirLight = new THREE.DirectionalLight( 0xffffff );
	dirLight.position.set( -1, 100, -1000 );
	dirLight.castShadow = true;
  //Set up shadow properties for the light
  dirLight.shadow.mapSize.width = 512;  // default
  dirLight.shadow.mapSize.height = 512; // default
  dirLight.shadow.camera.near = 0.5;    // default
  dirLight.shadow.camera.far = 10000;     // default
  let dirLightTarget = new THREE.Object3D();
  scene.add(dirLightTarget);
  dirLight.target = dirLightTarget;
  scene.add( dirLight );*/
}

function buildingBlocksSetup() {
  buildingBlocks.push(new BasicBlock(2,2,4));
  buildingBlocks.push(new BasicBlock(4,2,4));
  buildingBlocks.push(new BasicBlock(6,2,4));
  buildingBlocks.push(new BasicBlock(6,2,1));

  let y = .5;
  for(let block of buildingBlocks) {
    let mesh = buildMeshFromBlock(block);
    mesh.position.x = 0;
    mesh.position.y = y;
    mesh.position.z = 0;
    scene.add(mesh);
    y+=3;
  }
}

function buildMeshFromBlock(block) {
  let material = new THREE.MeshStandardMaterial( {
    color: 0xff3333, // red
    flatShading: true,
  });
  material.color.convertSRGBToLinear();
  let cylinderMaterial = new THREE.MeshStandardMaterial( {
    color: 0xaa4444, // different red
    flatShading: true,
  });
  cylinderMaterial.color.convertSRGBToLinear();
  let group = new THREE.Group();
  let cube = new THREE.BoxBufferGeometry(block.length*multX, block.height*multY, block.width*multZ);
  let cubeMesh = new THREE.Mesh( cube, material );
  cubeMesh.position.x = block.length*multX/2;
  cubeMesh.position.y = 0;
  cubeMesh.position.z = 0;
  group.add(cubeMesh);
  let blockHeight = .4; // hauteur des ronds en taille Three.js
  let cylinder = new THREE.CylinderBufferGeometry(.4 /*radius top*/, .4 /*radius bottom*/, blockHeight /*height*/ )
  let cylinderMesh = new THREE.Mesh(cylinder, cylinderMaterial);
  for (let x=0; x<block.length; x++) {
    for (let z=0; z<block.width; z++) {
      let rond = cylinderMesh.clone();
      rond.position.x = 0 + (x + .5) * multX; // * (.5 + .2);
      rond.position.y = block.height*multY/2 + blockHeight/2;
      rond.position.z = 0 + (z - .5) * multZ; // * (.5 + .2);
      group.add(rond);
    }
  }
  return group;
}

function render() {
  renderer.render( scene, camera );
}

function animate() {
	requestAnimationFrame( animate );
  controls.update();
	render();
}
