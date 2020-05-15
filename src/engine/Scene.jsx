import * as THREE from 'three';
import React from 'react';
import If from 'if-only';

import Brick from './Brick';
import MPDBrick from './MPDBrick';

import Message from '../components/Message';
//import { RollOverBrick } from '../../components/engine/Helpers';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LDrawLoader } from 'three/examples/jsm/loaders/LDrawLoader.js';

import { multX, multY, multZ } from '../util';

let styles = {};
const worldSize = 1000000;
const BOUNDINGBOX_OFFSET = 50; // hack: for some reason the bricks are 50 too low on the Y axis

styles.scene = {
  position: 'absolute',
  height: '100%',
  width: '100%',
  pointerEvents: 'none',
  transition: 'transform 0.15s ease-in-out',
}
styles.shifted = {
  composes: 'scene',
  position: 'absolute',
  height: '100%',
  width: '100%',
  pointerEvents: 'none',
  transition: 'transform 0.15s ease-in-out',
  transform: 'translate3d(-100px, 0, 0)',
}


class Scene extends React.Component {
  state = {
    drag: false,
    isShiftDown: false,
    isDDown: false,
    isRDown: false,
    rotation: 0,
    coreObjects: [],
  }

  constructor(props) {
    super(props);

    this._start = this._start.bind(this);
    this._stop = this._stop.bind(this);
    this._animate = this._animate.bind(this);

    this._needsRendering = true;
  }

  componentDidMount() {
    this._initCore();
    this._initEnv();
    this._initUtils();

    let promise = MPDBrick.loadAllTemplates(this.scene);
    promise.then(result => {
      this._init()
    });
  }

  _init() {
    this._setEventListeners();
    this._start();
    this._loadState();
    this._needsRendering = true;
  }

  componentDidUpdate(prevProps) {
    const { mode } = this.props;
    let rollOverBrick = this._getRollOverBrick();

    if (mode !== prevProps.mode && mode === 'paint') {
      rollOverBrick.visible = false;
    } else if (mode !== prevProps.mode && mode === 'build') {
      rollOverBrick.visible = true;
    }

    if (prevProps.brickID!== this.props.brickID) {
      // selected a new brick type!
      this.scene.remove(this.rollOverBrick.getModel());
      this.ghostScene.remove(this.rollOverGhostBlock);
      this.rollOverBrick = new MPDBrick(this.props.brickID);
      this.rollOverBrick.setColor(0x6666ff);
      this.rollOverBrick.addToScene(this.scene);
      this.rollOverGhostBlock = this._createGhostBlock(this.rollOverBrick);
      this.ghostScene.add(this.rollOverGhostBlock);
    }

    this._needsRendering = true;
  }

  _initCore() {
    this.scene = new THREE.Scene();
    this.ghostScene = new THREE.Scene();
    this.bricks = [];
    this.ghostBricks = [];

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor( 0xffffff );
    renderer.setPixelRatio( 1 );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.gammaInput = true;
    renderer.gammaOutput = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMapSoft = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, worldSize);
    camera.position.set(-2400, 2000, 2000); //camera.position.set(0, 3000, 0);
    camera.lookAt( new THREE.Vector3() );
    this.camera = camera;

    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;
    controls.rotateSpeed = 0.3;
    controls.maxPolarAngle = Math.PI/2;
    controls.minDistance = 200;
    controls.maxDistance = worldSize;
    this.controls = controls;

    this.mount.appendChild(this.renderer.domElement);
  }

  _initEnv() {
    const light = new THREE.SpotLight(0xffffff); //(0xffffff, 2);
    light.position.set(-4000, 6000, -2000) //( -1000, 1500, -500 );
    light.intensity = 0.6;
    light.castShadow = true;
    light.shadow = new THREE.LightShadow( new THREE.OrthographicCamera(window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, 1, worldSize) );
    light.shadow.bias = - 0.0000022;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.penumbra = 0.5;
    light.decay = 1;
    this.ghostScene.add(light);
    this.scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x606060);
    this.ghostScene.add(ambientLight);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight( 0xfff0f0, 0.6, 100, 0 );
    pointLight.position.set(-4000,6000,2000); //( -1000, 1500, 500 );
    this.ghostScene.add(pointLight);
    this.scene.add( pointLight );

    const geometry = new THREE.PlaneBufferGeometry( worldSize, worldSize );
    geometry.rotateX( - Math.PI / 2 );
    const planeMaterial = new THREE.ShadowMaterial();
    planeMaterial.opacity = 0.8;
    const plane = new THREE.Mesh(geometry, planeMaterial);
    plane.name = 'plane';
    plane.receiveShadow = true;
    this.plane = plane;
    this.scene.add(plane);

    const ghostPlane = new THREE.Mesh(geometry, planeMaterial);
    ghostPlane.name = 'ghost plane';
    this.ghostPlane = ghostPlane;
    this.ghostScene.add(ghostPlane);

    const grid = new THREE.GridHelper( worldSize, worldSize / multX, new THREE.Color( 0xbfbfbf ), new THREE.Color( 0xdedede ) );
    this.scene.add(grid);

    const ghostGrid = new THREE.GridHelper( worldSize, worldSize / multX, new THREE.Color( 0xbfbfbf ), new THREE.Color( 0xdedede ) );
    this.ghostScene.add(ghostGrid);

    this.ghostBlockMaterial = new THREE.MeshBasicMaterial();
    this.ghostBlockMaterial.color = new THREE.Color(0x222244);
  }

  _createGhostBlock(brickObject) { // Creates a cube (the ghost block) whose dimensions are the bounding box of the brick
    let brickMesh = brickObject.getModel();
    let boundingBox = new THREE.Box3().setFromObject(brickMesh);
    let width = boundingBox.max.x - boundingBox.min.x;
    let height = boundingBox.max.y - boundingBox.min.y;
    let depth = boundingBox.max.z - boundingBox.min.z;
    let geo = new THREE.BoxBufferGeometry(width, height, depth);
    let ghostBlock = new THREE.Mesh(geo, this.ghostBlockMaterial);
    ghostBlock.position.copy(brickMesh.position);
    ghostBlock.position.y += BOUNDINGBOX_OFFSET; // HACK
    ghostBlock.name = "Bounding Box for object "+brickMesh.name;
    return ghostBlock;
  }

  _getRollOverBrick() { // returns the rollover brick and its ghost block
    if (!this.rollOverBrick) {
      const brick = new MPDBrick(3004); // HACK
      brick.setColor(0x6666ff);
      brick.addToScene(this.scene);
      this.rollOverBrick = brick;
      const block = this._createGhostBlock(brick); // a cube whose dimensions are the bounding box of the brick
      block.brick = this.rollOverBrick;
      brick.block = this.rollOverGhostBlock;
      this.ghostScene.add(block);
      this.rollOverGhostBlock = block;
    }
    return {brick: this.rollOverBrick, block: this.rollOverGhostBlock};
  }

  _initUtils() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  _setEventListeners() {
    document.addEventListener( 'mousemove', (event) => this._onMouseMove(event, this), false );
    document.addEventListener( 'mousedown', (event) => this._onMouseDown(event), false );
    document.addEventListener( 'mouseup', (event) => this._onMouseUp(event, this), false );
    document.addEventListener( 'keydown', (event) => this._onKeyDown(event, this), false );
    document.addEventListener( 'keyup', (event) => this._onKeyUp(event, this), false );
    window.addEventListener( 'resize', (event) => this._onWindowResize(event, this), false);
  }

  _onWindowResize(event) {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this._needsRendering = true;
  }

  /* Uses the ray caster to identify the object closest to the mouse position in the ghost space
      Returns { distance, point, face, faceIndex, object } see https://threejs.org/docs/#api/en/core/Raycaster
  */
  _getIntersect(event) {
    this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	  this.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    this.raycaster.setFromCamera( this.mouse, this.camera );

    var intersectArray = [...this.ghostBricks, this.ghostPlane];

    const intersects = this.raycaster.intersectObjects(intersectArray, true);
    if (intersects.length>0) {
      return intersects[0];
    } else {
      return null;
    }
  }

  _onMouseMove(event) {
    if (this.isDDown) { // "D" key is pressed (delete mode)
      return;
    }
    const { mode } = this.props; // edit vs draw
    event.preventDefault();
    const drag = true;
    this.setState({ drag });

    const intersect = this._getIntersect(event);
    if (intersect == null) { // in the sky
      return;
    }

    const {brick: rollOverBrickMesh, block: rollOverGhostBlock} = this._getRollOverBrick();

    const rollOverBoundingBox = new THREE.Box3().setFromObject(rollOverGhostBlock);
    const rollOverGhostBlockHeight = rollOverBoundingBox.max.y - rollOverBoundingBox.min.y;

    let object = intersect.object;
    let position = new THREE.Vector3();
    position.copy(intersect.point).add(intersect.face.normal);

    if (object == this.plane || object == this.ghostPlane) {
      position.y = rollOverGhostBlockHeight / 2;// + BOUNDINGBOX_OFFSET;
      //console.log("Intersect with plane. Setting height to "+position.y);
    } else {
      let intersectBox = new THREE.Box3().setFromObject(object);
      let intersectWidth = intersectBox.max.x - intersectBox.min.x;
      let intersectHeight = intersectBox.max.y - intersectBox.min.y;
      let intersectDepth = intersectBox.max.z - intersectBox.min.z;
      position.y = intersectBox.max.y + rollOverGhostBlockHeight/2;// +  // intersectHeight;
      position.y -= 23; // Make the brick fit inside the one below.

      //console.log("Intersect object "+object.name+" point is "+this._toStringVector3D(intersect.point));
      //console.log("Bounding Box w="+intersectWidth+" h="+intersectHeight+" z="+intersectDepth);
    }
    this._setRollOverBrickPosition(position);
    this._needsRendering = true;
  }


  _createBrick(intersect) {
    const {brick: rollOverBrick, block: rollOverGhostBlock} = this._getRollOverBrick();
    const meshBoundingBox = new THREE.Box3().setFromObject(rollOverGhostBlock);
    // first check that there is no collision with existing bricks
    // this isn't totally correct - for some bricks the bounding boxes collide, but the bricks don't!!!
    const fudge=24; // give some space to avoid detecting as collisions adjacent blocks
    meshBoundingBox.min.x += fudge;
    meshBoundingBox.min.y += fudge;
    meshBoundingBox.min.z += fudge;
    meshBoundingBox.max.x -= fudge;
    meshBoundingBox.max.y -= fudge;
    meshBoundingBox.max.z -= fudge;
    for (var i = 0; i < this.ghostBricks.length; i++) {
      const brickBoundingBox = new THREE.Box3().setFromObject(this.ghostBricks[i]);
      const collision = meshBoundingBox.intersectsBox(brickBoundingBox);
      if (collision) {
        console.log("Not creating object: collision!!!"+this.ghostBricks[i].name);
        console.log("Not creating object due to collision!!!"+this._toStringBox3(meshBoundingBox)+" vs "+this._toStringBox3(brickBoundingBox));
        return;
      }
    }
    let position = rollOverGhostBlock.position.clone();
    position.y += BOUNDINGBOX_OFFSET;

    let brick = new MPDBrick(rollOverBrick._brickID);
    brick.setPosition(position);
    if (rollOverBrick._angle != 0) {
      brick.rotateY(rollOverBrick._angle);
    }
    this._setupNewBrick(brick);
  }

  _onMouseUp(event) {
    const { mode } = this.props;
    const { drag, isDDown, isRDown } = this.state;
    if (event.target.localName !== 'canvas') return;
    event.preventDefault();
    if (drag) {
      return;
    }
    const intersect = this._getIntersect(event);
    if (intersect != null) {
      if (mode === 'build') {
        if ( isDDown ) {
          this._deleteBrick(intersect);
        } else {
          // intersect.object will be this.plane if building a brick at y=0, otherwise it's the brick below
          this._createBrick(intersect);
        }
      } else if (mode === 'paint') {
        this._paintBrick(intersect);
      }
      this._saveState();
    }
    this._needsRendering = true;
  }


  _onMouseDown( event ) {
    this.setState({
      drag: false,
    });
  }



  _deleteBrick(intersect) { // intersect.object is the box (or the ghost plane), need to delete it and the brick
    if (intersect.object === this.plane || intersect.object === this.ghostPlane) {
      return;
    }
    let block = intersect.object;
    let brick = block.brick.getModel();
    console.log("Deleting object: "+brick.name);
    //brick.geometry.dispose();
    this.scene.remove(brick);
    this.bricks = this.bricks.filter((value) => {value != brick});
    this.ghostScene.remove(block);
    this.ghostBricks = this.ghostBricks.filter((value) => {value != block});
    block.geometry.dispose();
    this._needsRendering = true;
  }

  _paintBrick(intersect) {
    if (intersect.object === this.plane || intersect.object === this.ghostPlane) {
      return;
    }
    const { brickColor } = this.props;
    intersect.object.brick.setColor(brickColor);
    this._needsRendering = true;
  }

  _onKeyDown(event, scene) {
    let {brick: rollOverBrick, block: rollOverGhostBlock} = this._getRollOverBrick();
    switch(event.keyCode) {
      case 16: // Shift
        scene.setState({
          isShiftDown: true,
        });
        break;
      case 68: // D
        scene.setState({
          isDDown: true,
        });
        rollOverBrick.getModel().visible = false;
        break;
      case 82: // R
        rollOverBrick.rotateY(Math.PI / 2);
        this.ghostScene.remove(rollOverGhostBlock);
        this.rollOverGhostBlock = this._createGhostBlock(rollOverBrick);
        rollOverGhostBlock = this.rollOverGhostBlock;
        this.ghostScene.add(rollOverGhostBlock);
        this._alignToGrid(rollOverGhostBlock);
        rollOverBrick.setPosition(rollOverGhostBlock.position);
        break;
      default: break;
    }
  }

  _alignToGrid(mesh) {
    let position = mesh.position;
    let boundingBox = new THREE.Box3().setFromObject(mesh);
    let width = boundingBox.max.x - boundingBox.min.x;
    let depth = boundingBox.max.z - boundingBox.min.z;
    position.x = Math.round(position.x/multX) * multX;
    position.y = Math.round(position.y/multY) * multY;
    position.z = Math.round(position.z/multZ) * multZ;
    position.x += width / 2; // because position in three.js is wrt the center of the object
    position.z += depth / 2;
  }
  _setRollOverBrickPosition(position) {
    let {brick, block} = this._getRollOverBrick();
    block.position.copy(position);
    this._alignToGrid(block);
    let brickPosition = block.position.clone();
    brickPosition.y += BOUNDINGBOX_OFFSET;
    brick.setPosition(brickPosition);
  }


  _onKeyUp(event) {
    let {brick: rollOverBrick, block: rollOverGhostBlock} = this._getRollOverBrick();
    const { mode } = this.props;
    switch (event.keyCode) {
      case 16:
        this.setState({
          isShiftDown: false,
        });
        break;
      case 68:
        this.setState({
          isDDown: false,
        });
        if (mode === 'build')
          rollOverBrick.getModel().visible = true;
        this._needsRendering = true;
        break;
      case 82:
        this.setState({
          isRDown: false,
        });
        break;
      default: break;
    }
  }

  _start() {
    if (!this.frameId) {
      this.frameId = requestAnimationFrame(this._animate);
    }
  }

  _stop() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
  }

  _animate() {
    this.controls.update();

    let currentOrbitZoom = this.controls.target.distanceTo( this.controls.object.position );
    if (currentOrbitZoom != this._previousOrbitZoom) {
      // a hack: I need to re-render if the user is zooming in (drag on trackpad)
      this._previousOrbitZoom = currentOrbitZoom;
      this._needsRendering = true;
    }


    if (this._needsRendering) {
      this._renderScene();
      this._needsRendering = false;
    }

    this.frameId = window.requestAnimationFrame(this._animate);
  }

  _renderScene() {
    let first, second;
    if (this.isShiftDown || (this.state && this.state.isShiftDown)) {
      first = this.scene;
      second = this.ghostScene;
    } else {
      first = this.ghostScene;
      second = this.scene;
    }
    this.renderer.render(first, this.camera);
    this.renderer.render(second, this.camera);
  }

  _loadState() {
    //try {
      let json = window.localStorage.getItem('world');
      if (!json)
        return;
      let objectsLoaded = JSON.parse(json);
      let version = objectsLoaded.version;
      if (version != 1) {
        console.log("Wrong file version, can't load: "+version);
        return;
      }
      let array = objectsLoaded.world;
      console.log(`Loading ${array.length} bricks`);
      for (let i=0; i<array.length; i++) {
        let state = array[i];
        //console.log(`Brick #${i} = ${JSON.stringify(state)}`);
        let brick = MPDBrick.load(state); //BasicBrick.load(state);
        this._setupNewBrick(brick);
      }
      this._renderScene();
      console.log(`Done loading ${array.length} bricks`);
    //} catch (e) {
  //    console.log("ERROR LOADING STATE: "+e);
    //}
  }

  _setupNewBrick(brick) {
    brick.addToScene(this.scene);
    this.bricks.push(brick);
    let ghostBrick = this._createGhostBlock(brick);
    // HACK force alignment on the Y coordinates between ghost and real...
    let bb1 = new THREE.Box3().setFromObject(brick.getModel());
    let bb2 = new THREE.Box3().setFromObject(ghostBrick);
    let deltaY = bb1.min.y - bb2.min.y;
    //console.log(`forcing alignment by ${deltaY}`);
    ghostBrick.position.y += deltaY;
    this.ghostBricks.push(ghostBrick);
    this.ghostScene.add(ghostBrick);
    brick.block = ghostBrick;
    ghostBrick.brick = brick;
    this._needsRendering = true;
  }

  _saveState() { // currently saves to localStorage. Todo: send to server
    let arrayOfBricks = [];
    for (let i in this.bricks) {
      let state = this.bricks[i].save();
      arrayOfBricks.push(state);
    }
    let objectToSave = {
      version: 1.0,
      world: arrayOfBricks
    };
    let json = JSON.stringify(objectToSave);
    //let json = new Blob([JSON.stringify(simplified)];
    window.localStorage.setItem('world', json);
  }

  _toStringVector3D(v) {
    return "Vector3D ["+v.x+","+v.y+","+v.z+"]";
  }
  _toStringBox3(b) {
    return `Box3 [${b.min.x}, ${b.min.y}, ${b.min.z}] -> [${b.max.x}, ${b.max.y}, ${b.max.z}]`;
  }

  render() { // React function to generate the HTML object containing the scene
    const { brickHover, isShiftDown, isDDown, isRDown } = this.state;
    const { mode, shifted } = this.props;
    return(
      <div>
        <div className={shifted ? styles.shifted : styles.scene} style={{ cursor: isShiftDown ? 'move' : (brickHover ? 'pointer' : 'default') }} ref={(mount) => { this.mount = mount }} />
        <If cond={isDDown && mode === 'build'}>
          <Message>
            <i className="ion-trash-a" />
            <span>Deleting bricks</span>
          </Message>
        </If>
        <If cond={isRDown && mode === 'build'}>
          <Message>
            <i className="ion-refresh" />
            <span>Rotating bricks</span>
          </Message>
        </If>
      </div>
    );
  }
}


export default Scene;




  /**
   * Compute the center of a THREE.Group by creating a bounding box
   * containing every children's bounding box.
   * @param {THREE.Group} group - the input group
   * @param {THREE.Vector3=} optionalTarget - an optional output point
   * @return {THREE.Vector3} the center of the group
   */
   /*_computeGroupCenter(group, optionalTarget) {
     var childBox = new THREE.Box3();
     var groupBox = new THREE.Box3();
     var invMatrixWorld = new THREE.Matrix4();
     if (!optionalTarget) optionalTarget = new THREE.Vector3();

     group.traverse(function (child) {
       if (child instanceof THREE.Mesh) {
         if (!child.geometry.boundingBox) {
           child.geometry.computeBoundingBox();
           childBox.copy(child.geometry.boundingBox);
           child.updateMatrixWorld(true);
           childBox.applyMatrix4(child.matrixWorld);
           groupBox.min.min(childBox.min);
           groupBox.max.max(childBox.max);
         }
       }
     });

          // All computations are in world space
          // But the group might not be in world space
          group.matrixWorld.getInverse(invMatrixWorld);
          groupBox.applyMatrix4(invMatrixWorld);

          groupBox.getCenter(optionalTarget);
          return optionalTarget;
        };*/
