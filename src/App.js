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
    this.color = color;

    if (height!==1 && height!==3)
      console.log(`Wrong Lego height for block: {length}, {width}, {height}`);
  }
}


let scene, container, controls, camera, renderer;
let legos; // the world - currently an array of specific building block instances
let buildingBlocks = []; // all the available building blocks
const multX=1.0, multY=.4, multZ=1.0; // convert from Lego Units to Three.js units
const brickSeparationY = 0.05;

let raycaster, selectedBlock, mouse;
let selectMode = false, moveX=0, moveY=0, moveZ=0;

setup();
render();
animate();

function onMouseMove( event ) {
	// calculate mouse position in normalized device coordinates
	// (-1 to +1) for both components
  console.log("Move!");
  event.preventDefault();
  mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
}

function onMouseClick(event) {
  console.log("Click!");
  event.preventDefault();
  if (! selectedBlock)
    return;
  selectMode = ! selectMode;
  console.log("Selectmode = "+selectMode);
}

function onKeyDown(event) {
  if (!selectMode)
    return;
  switch ( event.keyCode ) {
    case 38: // up
      moveY = 1;
      break;
    case 87: // w
      moveZ = -1;
      break;
    case 37: // left
      moveX = -1;
      break;
    case 40: // down
      moveY = -1;
      break;
    case 83: // s
      moveZ = 1;
      break;
    case 39: // right
      moveX = 1;
    break;
  }

  if (moveX != 0 || moveY != 0 || moveZ != 0) {
    let block = selectedBlock.block;
    block.x += moveX;
    block.y += moveY;
    block.z += moveZ;
    let group = selectedBlock.group;
    group.position.x += moveX * multX;
    group.position.y += moveY * multY;
    group.position.z += moveZ * multZ;
  }
};

function onKeyUp ( event ) {
  switch ( event.keyCode ) {
    case 38: // up
      moveY = 0; break;
    case 83: // s
      moveZ = 0; break;
    case 87: // w
      moveZ = 0; break;
    case 37: // left
      moveX = 0; break;
    case 40: // down
      moveY = 0; break;
    case 39: // right
      moveX = 0; break;
  }
};


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

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  document.addEventListener( 'mousemove', onMouseMove, false );
  document.addEventListener( 'mouseclick', onMouseClick, false );
  document.addEventListener( 'mousedown', onMouseClick, false );

  document.addEventListener( 'keydown', onKeyDown, false );
  document.addEventListener( 'keyup', onKeyUp, false );
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
  return;
  let ground = new THREE.Mesh(
    new THREE.PlaneBufferGeometry( 10000, 10000 ),
    new THREE.MeshLambertMaterial/*THREE.MeshPhongMaterial*/( { color: 0x999999, depthWrite: false } )
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

  /*var geometry = new THREE.BufferGeometry();
	geometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( 4 * 3 ), 3 ) );
  var material = new THREE.LineBasicMaterial( { color: 0xffffff, transparent: true } );
  line = new THREE.Line( geometry, material );
	scene.add( line );*/
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
  buildingBlocks.push(new BasicBlock(6,5,1, 0,1,0, 0xff3333)); // bas
  buildingBlocks.push(new BasicBlock(6,5,1, 0,5,0, 0xff3333)); // haut
  buildingBlocks.push(new BasicBlock(4,1,3, 1,2,0, 0x44aa44)); // gauche
  buildingBlocks.push(new BasicBlock(4,1,3, 1,2,4, 0x44aa44)); // droite
  buildingBlocks.push(new BasicBlock(1,5,3, 0,2,0, 0x777777)); // fond
  buildingBlocks.push(new BasicBlock(1,5,3, 5,2,0, 0x777777)); // devant

  for(let block of buildingBlocks) {
    let mesh = buildMeshFromBlock(block);
    mesh.position.x = block.x * multX;
    mesh.position.y = block.y * multY;
    mesh.position.z = block.z * multZ;
    scene.add(mesh);
  }
}

function buildMeshFromBlock(block) {
  let material = new /*THREE.MeshPhongMaterial*/ THREE.MeshLambertMaterial( {
    color: block.color,
    //flatShading: true,
  });
  material.color.convertSRGBToLinear();
  let cylinderMaterial = new /*THREE.MeshPhongMaterial*/ THREE.MeshLambertMaterial( {
    color: block.color,
    //flatShading: true,
  });
  cylinderMaterial.color.convertSRGBToLinear();
  let group = new THREE.Group();
  let cube = new THREE.BoxBufferGeometry(block.length*multX, block.height*multY - brickSeparationY /*leave some room above*/, block.width*multZ);
  let cubeMesh = new THREE.Mesh( cube, material );
  cubeMesh.position.x = block.length * multX/2;
  cubeMesh.position.y = block.height * multY/2;
  cubeMesh.position.z = block.width * multZ/2;
  group.add(cubeMesh);
  cubeMesh.group = group;
  cubeMesh.block = block;
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
      rond.group = group;
      rond.block = block;
    }
  }
  group.block = block;
  return group;
}

function raycasterLookup() {
  if (selectMode) // don't update the selectedBlock if we've clicked on it.
    return;
  raycaster.setFromCamera( mouse, camera );
  let intersects = raycaster.intersectObjects( scene.children, true );
  if ( intersects.length > 0 ) {
    if ( selectedBlock != intersects[ 0 ].object ) {
      if ( selectedBlock )
        selectedBlock.material.emissive.setHex( selectedBlock.currentHex );
      selectedBlock = intersects[ 0 ].object;
      selectedBlock.currentHex = selectedBlock.material.emissive.getHex();
      selectedBlock.material.emissive.setHex( 0xff0000 );
    }
  } else {
    if ( selectedBlock )
      selectedBlock.material.emissive.setHex( selectedBlock.currentHex );
    selectedBlock = null;
  }
}
function render() {
  raycasterLookup();
  renderer.render( scene, camera );
}

function animate() {
	requestAnimationFrame( animate );
  controls.update();
	render();
}
