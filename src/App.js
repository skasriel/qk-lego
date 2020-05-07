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
  constructor(length, width, height, x, y, z, color) {
    this.length = length;
    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;
    this.z = z;

    if (height!=1 && height!=3)
      console.log(`Wrong Lego height for block: {length}, {width}, {height}`);
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
  let ground = new THREE.Mesh(
    new THREE.PlaneBufferGeometry( 10000, 10000 ),
    new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } )
  );
  //    new THREE.MeshBasicMaterial( { color: 0x6e6a62, depthWrite: false } )

	ground.rotation.x = - Math.PI / 2;
	ground.receiveShadow = true;
	scene.add( ground );
  ground.renderOrder = 1;

  let grid = new THREE.GridHelper( 400, 80, 0x000000, 0x000000 );
  grid.material.opacity = 0.1;
  grid.material.depthWrite = false;
  grid.material.transparent = true;
  grid.receiveShadow = true;
  scene.add( grid );
}

function lightSetup() {
  // adds ambient light
  let ambientLight = new THREE.AmbientLight("rgb(100%, 90%, 90%)"); // soft white light
  scene.add( ambientLight );

  let dirLight = new THREE.DirectionalLight( 0xffffff );
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
  scene.add( dirLight );
}

function buildingBlocksSetup() {
  buildingBlocks.push(new BasicBlock(5,5,1,0,1,0)); // bas
  buildingBlocks.push(new BasicBlock(5,5,1,0,4,0)); // haut
  buildingBlocks.push(new BasicBlock(5,1,3, 0,2,0)); // gauche
  buildingBlocks.push(new BasicBlock(5,1,3, 0,2,4)); // droite
  buildingBlocks.push(new BasicBlock(2,5,3,0,2,0)); // fond
  buildingBlocks.push(new BasicBlock(2,5,3,3,2,0)); // devant

  for(let block of buildingBlocks) {
    let mesh = buildMeshFromBlock(block);
    mesh.position.x = block.x * multX;
    mesh.position.y = block.y * multY;
    mesh.position.z = block.z * multZ;
    scene.add(mesh);
  }
}

function buildMeshFromBlock(block) {
  let material = new THREE.MeshPhongMaterial( {
    color: 0xff3333, // red
    flatShading: true,
  });
  material.color.convertSRGBToLinear();
  let cylinderMaterial = new THREE.MeshPhongMaterial( {
    color: 0xaa4444, // different red
    flatShading: true,
  });
  cylinderMaterial.color.convertSRGBToLinear();
  let group = new THREE.Group();
  let cube = new THREE.BoxBufferGeometry(block.length*multX, block.height*multY - .1 /*leave some room above*/, block.width*multZ);
  let cubeMesh = new THREE.Mesh( cube, material );
  cubeMesh.position.x = block.length * multX/2;
  cubeMesh.position.y = block.height * multY/2;
  cubeMesh.position.z = block.width * multZ/2;
  group.add(cubeMesh);
  let rondRadius = .4;
  let rondHeight = .3; // hauteur des ronds en taille Three.js
  let cylinder = new THREE.CylinderBufferGeometry(rondRadius /*radius top*/, rondRadius /*radius bottom*/, rondHeight /*height*/ )
  let cylinderMesh = new THREE.Mesh(cylinder, cylinderMaterial);
  for (let x=0; x<block.length; x++) {
    for (let z=0; z<block.width; z++) {
      let rond = cylinderMesh.clone();
      rond.position.x = 0 + (x) * multX + rondRadius; // * (.5 + .2);
      rond.position.y = 0 + block.height * multY;// + rondHeight;
      rond.position.z = 0 + (z) * multZ + rondRadius; // * (.5 + .2);
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
