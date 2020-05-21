
class BasicBlock {
  constructor(length, width, height, x, y, z, color) {
    this.type = 'BasicBlock';
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
let selectMode=false, rotateMode=false, moveX=0, moveY=0, moveZ=0;

let gui;
let guiParams = {
      length: 4,
      width: 2,
      height: 3,
      x: 0,
      y: 0,
      z: 0,
      color: 0x4444ff
    };


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
  if (selectMode) {
    updateGui(selectedBlock.block);
  }
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
      moveX = 1; break;
    case 82: // r = rotate
      rotateMode = true; break;
  }

  if (rotateMode) {
    // this may be buggy - not clear that the lego and 3D values are aligned...
    let block = selectedBlock.block;
    [block.length, block.width] = [block.width, block.length];
    selectedBlock.group.rotation.y += Math.PI / 2;
    positionBlockOnScreen(block, selectedBlock);
    saveWorld();
  }
  if (moveX != 0 || moveY != 0 || moveZ != 0) {
    let block = selectedBlock.block;
    block.x += moveX;
    block.y += moveY;
    block.z += moveZ;
    if (block.y<0)  block.y=0;
    positionBlockOnScreen(block, selectedBlock);
    saveWorld();
  }
}

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
    case 82: // r = rotate
      rotateMode = false; break;
  }
}

function saveWorld() {
  let json = '';
  json = JSON.stringify(Object.assign({}, buildingBlocks));
  console.log(json);
  /*for(let block of buildingBlocks) {
    json = block.save(json);
  }*/
  window.localStorage.setItem('world', json);
}
function loadWorld() {
  var json = window.localStorage.getItem('world');
  if (! json) {
    buildingBlocks.push(new BasicBlock(6,5,1, 0,1,0, 0xff3333)); // bas
    buildingBlocks.push(new BasicBlock(6,5,1, 0,5,0, 0xff3333)); // haut
    buildingBlocks.push(new BasicBlock(4,1,3, 1,2,0, 0x44aa44)); // gauche
    buildingBlocks.push(new BasicBlock(4,1,3, 1,2,4, 0x44aa44)); // droite
    buildingBlocks.push(new BasicBlock(1,5,3, 0,2,0, 0x777777)); // fond
    buildingBlocks.push(new BasicBlock(1,5,3, 5,2,0, 0x777777)); // devant
    return;
  }
  var objects = JSON.parse(json);
  console.log("Loaded: "+objects);
  for (let i in objects) {
    let obj = objects[i];
    let block = new BasicBlock(obj.length, obj.width, obj.height, obj.x, obj.y, obj.z, obj.color);
    buildingBlocks.push(block);
    console.log("Obj "+i+" -> "+obj+" type: "+obj.type);
  }
}


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

  gui = new GUI();
  let blockUI = gui.addFolder('Block');
  blockUI.open();
	blockUI.add( guiParams, 'length' ).min(1).max(10).step(1).listen()
    .onChange(function(value) {
      if (selectedBlock) {
        let block = selectedBlock.block;
        block.length = value;
        positionBlockOnScreen(block, selectedBlock);
        saveWorld();
      }
    });
	blockUI.add( guiParams, 'width' ).min(1).max(10).step(1).listen();
	blockUI.add( guiParams, 'height' ).min(1).max(3).step(2).listen();
  blockUI.add( guiParams, 'x').step(1).listen()
  .onChange(function(value) {
    if (selectedBlock) {
      let block = selectedBlock.block;
      block.x = value;
      positionBlockOnScreen(block, selectedBlock);
      saveWorld();
    }
  });
  blockUI.add( guiParams, 'y').min(0).step(1).listen()
  .onChange(function(value) {
    if (selectedBlock) {
      let block = selectedBlock.block;
      block.y = value;
      positionBlockOnScreen(block, selectedBlock);
      saveWorld();
    }
  });
  blockUI.add( guiParams, 'z').step(1).listen()
  .onChange(function(value) {
    if (selectedBlock) {
      let block = selectedBlock.block;
      block.z = value;
      positionBlockOnScreen(block, selectedBlock);
      saveWorld();
    }
  });
  blockUI.addColor( guiParams, 'color').listen()
  .onChange(function(value) {
    if (selectedBlock) {
      let block = selectedBlock.block;
      block.color = value;
      selectedBlock.color = value;
      positionBlockOnScreen(block, selectedBlock);
      saveWorld();
      render();
    }
  });
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
  const worldDimension = 10000;
  let ground = new THREE.Mesh(
    new THREE.PlaneBufferGeometry( worldDimension, worldDimension ),
    new THREE.MeshBasicMaterial( { color: 0x111111, depthWrite: false } )
  );
  //    new THREE.MeshBasicMaterial( { color: 0x6e6a62, depthWrite: false } )

	ground.rotation.x = - Math.PI / 2;
	ground.receiveShadow = true;
	scene.add( ground );
  ground.renderOrder = 1;

  const gridColor = 0x4444ff; //0x8CBED7; //new THREE.Color("rgb(141,190, 215)");
  let grid = new THREE.GridHelper(worldDimension, worldDimension, gridColor, gridColor);
  grid.material.opacity = 0.1;
  grid.material.depthWrite = false;
  grid.material.transparent = true;
  grid.receiveShadow = true;
  scene.add( grid );

  var axesHelper = new THREE.AxesHelper( 10 );
  scene.add( axesHelper );

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
  loadWorld();

  for(let block of buildingBlocks) {
    let block3D = buildMeshFromBlock(block);
    positionBlockOnScreen(block, block3D);
    scene.add(block3D);
  }
}
function updateGui(block) {
  guiParams.length = block.length;
  guiParams.width = block.width;
  guiParams.height = block.height;
  guiParams.x = block.x;
  guiParams.y = block.y;
  guiParams.z = block.z;
  guiParams.color = block.color;
}
function positionBlockOnScreen(block, block3D) {
  if (block3D.group) {
    return positionBlockOnScreen(block, block3D.group);
  }
  block3D.position.x = block.x * multX;
  block3D.position.y = block.y * multY;
  block3D.position.z = block.z * multZ;
  updateGui(block);
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
  cubeMesh.isSelectable = true;
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
      rond.isSelectable = true;
    }
  }
  group.block = block;
  group.isSelectable = true;
  return group;
}

function raycasterLookup() {
  if (selectMode) // don't update the selectedBlock if we've clicked on it.
    return;
  raycaster.setFromCamera( mouse, camera );
  let intersects = raycaster.intersectObjects( scene.children, true );
  if ( intersects.length > 0 ) {
    if (selectedBlock!=intersects[0].object) {
      if (selectedBlock)
        selectedBlock.material.emissive.setHex( selectedBlock.currentHex );
      if (intersects[0].object.isSelectable) {
        selectedBlock = intersects[0].object;
        /*if (selectedBlock.group)
          selectedBlock = selectedBlock.group;*/
        selectedBlock.currentHex = selectedBlock.material.emissive.getHex();
        selectedBlock.material.emissive.setHex( 0xff0000 );
      }
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
