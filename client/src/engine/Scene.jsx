import * as THREE from 'three';
import React from 'react';
import If from 'if-only';
import ReconnectingWebSocket from 'reconnecting-websocket';

import {Brick, BOUNDINGBOX_OFFSET} from './Brick';
import {BasicBrick} from './BasicBrick';
import {MPDBrick} from './MPDBrick';
import {GLBBrick} from './GLBBrick';
import {OBJBrick} from './OBJBrick';
import { BrickCollections } from './BrickCollections';

import Message from '../components/Message';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls.js';
import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { MyControl } from './MyControl';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

import { multX, multY, multZ, _toStringBox3, _toStringVector3D } from '../util';
import {ColorCollections, Modes, Action} from '../util';

let styles = {};
const worldSize = 100000;

const FILE_VERSION_CURRENT = 1.4;

const PLANE_OFFSET = 50;

const USE_SHADOWS=false;

var moveForward = false;
var moveBackward = false;
var moveLeft = false;
var moveRight = false;
var velocity = new THREE.Vector3();
var direction = new THREE.Vector3();


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

// TODO: test this for speed: 				geometry = new THREE.BufferGeometry().fromGeometry( geometry );
// TODO: test vertex color: 					new THREE.MeshLambertMaterial( { map: texture, vertexColors: true, side: THREE.DoubleSide } )


class Scene extends React.Component {
  state = {
    drag: false,
    isShiftDown: false,
    isRDown: false,
  };

  constructor(props) {
    super(props);
    this._start = this._start.bind(this);
    this._stop = this._stop.bind(this);
    this._animate = this._animate.bind(this);
    this._needsRendering = true;
  }

  componentDidMount() {
    this._initWS();
    this._initCore();
    this._initEnv();

    let promise1 = MPDBrick.loadAllTemplates(this.scene);
    let promise2 = GLBBrick.loadAllTemplates(this.scene);
    let promise3 = OBJBrick.loadAllTemplates(this.scene);
    Promise.all([promise1, promise2, promise3]).then((result) => {
      this._init();
    });
  }

  // Handles messages from server - typically, because another client made changes to the scene
  _handleWSMessage(_this, message) { // normal "this" will be WS object for some reason, so don't use!
    //console.log("Received WS message: "+JSON.stringify(message.data));
    const action = JSON.parse(message.data);
    switch (action.type) {
      case Action.Create:
        let brick = _this.createAndAddBrickFromObject(action.brick);
        console.log("Added new brick because server told us to "); //+JSON.stringify(brick));
        break;
      case Action.Delete:
        let brickToDelete = this.bricks.find(brick => {return brick._uuid==action.uuid});
        console.log(`Server instructed me to delete brick ${action.uuid}`); //, found as ${brickToDelete}`);
        this._deleteBrick(brickToDelete);
        break;
      case Action.Move:
        let brickToMove = this.bricks.find(brick => {return brick._uuid==action.brick.uuid});
        console.log(`Server instructed me to move brick ${action.brick.uuid}`); //, found as ${brickToDelete}`);
        brickToMove.position.clone(action.brick.position); // TODO: also move ghost?
        break;
      case Action.Reload:
        console.log(`Server instructed me to do a full reload`);
        for (let i=0; i<this.bricks.length; i++) {
          this.bricks[i].removeFromScene(this.scene, this.ghostScene);
        }
        this.bricks=[];
        this.ghostBricks=[];
        let array = action.world;
        console.log(`Loading ${array.length} bricks`);
        for (let i=0; i<array.length; i++) {
          let state = array[i];
          let brick = this.createAndAddBrickFromObject(state);
        }
        this._renderScene();
        break;
      default:
        console.log("Action type not supported yet: "+action.type);
        break;
    }
  }
  /*heartbeat() {
    clearTimeout(this.pingTimeout);

    // Use `WebSocket#terminate()`, which immediately destroys the connection,
    // instead of `WebSocket#close()`, which waits for the close timer.
    // Delay should be equal to the interval at which your server
    // sends out pings plus a conservative assumption of the latency.
    this.pingTimeout = setTimeout(() => {
      this.ws.close();
    }, 1000 + 1000);
  }*/

  _initWS() {
    //let wsURL = ((window.location.protocol === "https:") ? "wss://" : "ws://") + window.location.host + "/ws-api";
    let wsURL = 'ws://localhost:5000/ws-api';
    console.log("WS Connection to "+wsURL);
    this.ws = new ReconnectingWebSocket(wsURL);

    this.ws.onopen = () => {
      // on connecting, do nothing but log it to the console
      console.log('connected to server via web socket');
      //this.heartbeat();
    }
    //this.ws.onping = this.heartbeat;

    this.ws.onmessage = (message)=>this._handleWSMessage(this, message);  // on receiving a message, add it to the list of messages

    /*this.ws.onclose = () => { // automatically try to reconnect on connection loss
      console.log('disconnected')
      clearTimeout(this.pingTimeout);
      this.setState({
        ws: new ReconnectingWebSocket(wsURL),
      });
    }*/
  }
  _sendActionToWebSocket(action) {
    console.log("Sending action to server: "); //+JSON.stringify(action));
    this.ws.send(JSON.stringify(action));
  }

  _init() {
    this._setEventListeners();
    this._start();
    this._loadState();
    this._needsRendering = true;
  }

  componentDidUpdate(prevProps) {
    const { mode, brickColor, colorType, brickID } = this.props;
    let rollOverBrick = this._getRollOverBrick();

    if (mode === Modes.Build) {
      rollOverBrick.visible = true;
    } else {
      rollOverBrick.visible = false;
    }
    if (mode !== prevProps.mode) {
      this.modeSetup(prevProps.mode);
    }

    if (prevProps.brickID !== brickID || prevProps.brickColor != brickColor) {
      // selected a new brick type or color!
      this.scene.remove(this.rollOverBrick.getModel());
      this.ghostScene.remove(this.rollOverGhostBlock);
      this.rollOverBrick = BasicBrick.createBrick(brickID.id, brickColor, colorType);
      this.rollOverBrick.addToScene(this.scene, this.ghostScene);
      this.rollOverGhostBlock = this.rollOverBrick.ghostBlock;
    }

    this._needsRendering = true;
  }

  _initCore() {
    const { mode } = this.props;

    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.ghostScene = new THREE.Scene();
    this.bricks = [];
    this.ghostBricks = [];

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor( 0xffffff );
    renderer.setPixelRatio( 1 );
    renderer.setSize( window.innerWidth, window.innerHeight );
    //renderer.gammaInput = true;
    //renderer.gammaOutput = true;
    renderer.outputEncoding = THREE.sRGBEncoding;

    if (USE_SHADOWS) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMapSoft = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
    }
    this.renderer = renderer;
    this.modeSetup(null);
    this.mount.appendChild(this.renderer.domElement);
  }

  modeSetup(prevMode) {
    const { mode } = this.props;
    if (mode === prevMode) {
      console.log("Shouldn't happen");
      return;
    }
    let camera, controls;

    if (mode === Modes.Explore) { // Switch from a non-Explore mode to Explore
      camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, worldSize/10);
      //camera.position.set(0, 100*multY, 0);
      //this.scene.background = new THREE.Color( 0xaaaaaa );
      camera.position.set(0, 3*multY, -25*multZ);
      camera.lookAt( new THREE.Vector3(0, 3*multY - 10, 0) );
      this.scene.fog = new THREE.FogExp2( 0xffffff, 0.00015 );
      //controls = new OrbitControls(camera, this.renderer.domElement);
      controls = new MyControl(camera, this.renderer.domElement);

      var rootObj = document.getElementById('root');
      //console.log("Root = "+rootObj+" "+rootObj.innerHTML.toString());
      var blocker = document.getElementById( 'blocker' );
      var instructions = document.getElementById( 'instructions' );

      controls.lock();
      instructions.addEventListener( 'click', function () {
        controls.lock();
      }, false );
      controls.addEventListener( 'lock', function () {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
      } );
      controls.addEventListener( 'unlock', function () {
        blocker.style.display = 'block';
        instructions.style.display = '';
      } );

      //this.scene.add( controls.getObject() );

      //let controls = new FirstPersonControls( this.camera, this.renderer.domElement );
      //controls.addEventListener( 'change', () => this._needsRendering=true );
      controls.movementSpeed = 1000;
      controls.lookSpeed = 0.125;
      controls.lookVertical = true;
      controls.constrainVertical = true;
      controls.verticalMin = 1.1;
      controls.verticalMax = 2.2;
      if (this.controls) {
        this.controls.dispose();
      }
      this.controls = controls;
      this.camera = camera;
    } else if (prevMode === Modes.Explore || prevMode == null) { // Switch from a Explore mode to a non Explore mode
      camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, worldSize/10);
      camera.position.set(-24*multX, 70*multY, 20*multZ);
      camera.lookAt( new THREE.Vector3() );
      controls = new OrbitControls(camera, this.renderer.domElement);
      controls.addEventListener( 'change', () => this._needsRendering=true );
      controls.enableDamping = true;
      controls.dampingFactor = 0.15;
      controls.rotateSpeed = 0.3;
      controls.maxPolarAngle = Math.PI/2;
      controls.minDistance = 200;
      controls.maxDistance = worldSize;
      if (this.controls) {
        this.controls.dispose();
      }
      this.controls = controls;
      this.camera = camera;
    }

    if (mode===Modes.Move) {
      const transformControl = new TransformControls( this.camera, this.renderer.domElement );
      transformControl.setMode( "translate" );
      transformControl.setTranslationSnap( multX );

      transformControl.addEventListener( 'change', () => {this._needsRendering = true} );
		  transformControl.addEventListener( 'dragging-changed', function ( event ) {
					if (this.controls)
            this.controls.enabled = ! event.value;
			});
      this.transformControl = transformControl;
      this.scene.add(transformControl);
    }
  }

  _initEnv() {
    /*const light = new THREE.SpotLight(0xffffff);
    light.position.set(-40*multX, 200*multY, -20*multZ );
    light.intensity = 0.6;
    light.castShadow = true;
    light.shadow = new THREE.LightShadow( new THREE.OrthographicCamera(window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, 1, 10000) );
    light.shadow.bias = - 0.0000022;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.penumbra = 0.5;
    light.decay = 2;
    this.scene.add(light);*/

    // var spotLightHelper = new THREE.SpotLightHelper( light );
    // this.scene.add( spotLightHelper );

    //const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
    //this.scene.add( directionalLight );


    const ambientLight = new THREE.AmbientLight(0x606060);
    this.scene.add(ambientLight);

    const geometry = new THREE.PlaneBufferGeometry( worldSize, worldSize );
    geometry.rotateX( - Math.PI / 2 );
    const planeMaterial = new THREE.ShadowMaterial();
    planeMaterial.opacity = 1.0;
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

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }



  _getRollOverBrick() { // returns the rollover brick and its ghost block
    if (!this.rollOverBrick) {
      const {brickID, color, colorType} = this.props;
      const brick = BasicBrick.createBrick(brickID.id, color, colorType);
      /*BrickCollections.defaultBrick.id,
        ColorCollections.getDefaultColor(),
        ColorCollections.getDefaultColorType());*/
      brick.addToScene(this.scene, this.ghostScene);
      this.rollOverBrick = brick;
      this.rollOverGhostBlock = brick.ghostBlock;
    }
    return {brick: this.rollOverBrick, block: this.rollOverGhostBlock};
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
    this.controls.handleResize();
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
    const {mode} = this.props;
    if (mode===Modes.Move && this.isBrickSelected) { // remove the brick we're moving from the raycaster
      intersectArray = intersectArray.filter((ghost) => {return (ghost !== this.rollOverGhostBlock)});
    }
    const intersects = this.raycaster.intersectObjects(intersectArray, true);
    if (intersects.length==0) {
      return null;
    }
    let intersect = intersects[0];
    return intersect;
  }

  isBuildMode() {
    return this.props.mode === Modes.Build;
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
        console.log("Not creating object due to collision!!!"+_toStringBox3(meshBoundingBox)+" vs "+_toStringBox3(brickBoundingBox));
        return;
      }
    }
    let position = rollOverGhostBlock.position.clone();
    //console.log(`Rollover brick supposedly is at ${_toStringVector3D(position)}`);
    position.y += BOUNDINGBOX_OFFSET;

    let brick = BasicBrick.createBrick(rollOverBrick._brickID, rollOverBrick.color, rollOverBrick.colorType);
    if (rollOverBrick._angle && rollOverBrick._angle != 0) {
      brick.rotateY(rollOverBrick._angle);
    }
    console.log(`create brick, no collisions. Added ${BOUNDINGBOX_OFFSET} to y=${position.y} will set position to ${_toStringVector3D(position)}`);
    brick.setPosition(position, true);

    // now send message to server (before adding to the scene, otherwise the world signature will be wrong!)
    let action = new Action(Action.Create, this.getWorldSignature());
    action.createBrick(brick);
    this._sendActionToWebSocket(action);

    this._setupNewBrick(brick);
  }

  /**
   * Returns a one way hash of the current view of the world, as a way to ensure consistency between client(s) and Server
   * Obviously the server needs to compute hashes with the same algorithm!
   */
  getWorldSignature() {
    let arrayOfBricks = [];
    for (let i in this.bricks) {
      let state = this.bricks[i].save();
      arrayOfBricks.push(state);
    }
    let text = JSON.stringify(arrayOfBricks);
    var hash = 0; // simple implementation of Java's String.hashCode();
    for (var i = 0; i < text.length; i++) {
      var char = text.charCodeAt(i);
      hash = ((hash<<5)-hash)+char;
      hash = hash & hash; // Convert to 32bit integer
    }
    //console.log(`getWorldSignature is ${hash} for ${text}`);
    return hash;
  }

  /**
   * Mouse Handlers
   */
  _onMouseMove(event) {
    const { mode } = this.props; // edit vs draw
    const {brick: rollOverBrick, block: rollOverGhostBlock} = this._getRollOverBrick();

    event.preventDefault();

    const drag = true;
    this.setState({ drag });

    if (mode===Modes.Delete || mode===Modes.Paint || mode===Modes.Explore) {
      rollOverBrick.getModel().visible = false;
      return;
    }
    if (mode===Modes.Move && !this.isBrickSelected) {
      rollOverBrick.getModel().visible = false;
      return;
    }

    const intersect = this._getIntersect(event);
    if (intersect == null) { // in the sky
      return;
    }

    const rollOverBrickMesh = rollOverBrick.getModel();

    const rollOverBoundingBox = new THREE.Box3().setFromObject(rollOverGhostBlock);
    const height = rollOverBoundingBox.max.y - rollOverBoundingBox.min.y;

    let intersectObject = intersect.object;
    let position = new THREE.Vector3().copy(intersect.point).add(intersect.face.normal);

    if (intersectObject === this.plane || intersectObject === this.ghostPlane) {
      position.y = height / 2 + PLANE_OFFSET;
      //console.log(`Intersect with plane. Setting height to ${position.y} object height=${height}`);
    } else {
      let intersectBox = new THREE.Box3().setFromObject(intersectObject);
      let intersectWidth = intersectBox.max.x - intersectBox.min.x;
      let intersectHeight = intersectBox.max.y - intersectBox.min.y;
      let intersectDepth = intersectBox.max.z - intersectBox.min.z;
      position.y = intersectBox.max.y + height / 2 - 10; // - 25;// +  // intersectHeight;
      //position.y -= 25; // Make the brick fit inside the one below.
      //console.log("Intersect object "+object.name+" point is "+this._toStringVector3D(intersect.point));
      //console.log("Bounding Box w="+intersectWidth+" h="+intersectHeight+" z="+intersectDepth);
    }
    rollOverBrick.setPosition(position);

    /*if (object == this.plane || object == this.ghostPlane) {
      const savedY = rollOverBrickMesh.position.y;
      rollOverBrickMesh.position.y = 600;
      const savedGhostY = rollOverGhostBlock.position.y;
      rollOverGhostBlock.position.y = 600;
      const pointOnPlane = new THREE.Vector3(rollOverBrickMesh.position.x, 0, rollOverBrickMesh.position.z);
      this.raycaster.set(pointOnPlane, new THREE.Vector3(0, 1, 0));
      const verticalIntersect = this.raycaster.intersectObject(rollOverGhostBlock, true);
      console.log(`Raycast from ${this._toStringVector3D(pointOnPlane)} towards ${this._toStringVector3D(rollOverBrickMesh.position)} Intersect = ${JSON.stringify(verticalIntersect)}`);
      if (verticalIntersect == null || verticalIntersect.length==0) {
        rollOverBrickMesh.position.y = savedY;
        rollOverGhostBlock.position.y = savedGhostY;
      } else {
        console.log("YAY THERE'S A MATCH");
        const height = verticalIntersect[0].point.y;
        rollOverBrickMesh.position.y -= height;
      }
      position.copy(rollOverBrickMesh.position);
      this._setRollOverBrickPosition(position);
    }*/

    this._needsRendering = true;
  }

  _onMouseUp(event) {
    if (event.target.localName !== 'canvas') return;
    event.preventDefault();
    const { mode } = this.props;
    const { drag } = this.state;
    if (drag) {
      return;
    }
    if (mode === Modes.Explore) {
      return;
    }

    const intersect = this._getIntersect(event);
    if (intersect != null) {
      switch (mode) {
        case Modes.Delete:
          if (intersect.object !== this.plane && intersect.object !== this.ghostPlane) {
            // intersect.object will be this.plane if building a brick at y=0, otherwise it's the brick below
            var ghost = intersect.object;
            var brick = ghost.brick;
            // now send message to server - before making the deletion locally, otherwise the world signature will be wrong!
            let action = new Action(Action.Delete, this.getWorldSignature());
            action.deleteBrick(brick);
            this._sendActionToWebSocket(action);
            // now delete the brick locally
            this._deleteBrick(brick);
          }
          break;
        case Modes.Build:
          this._createBrick(intersect);
          break;
        case Modes.Paint:
          this._paintBrick(intersect);
          break;
        case Modes.Move:
          this._moveBrick(intersect);
          break;
        default:
          console.log("Unsupported mode: "+mode);
          break;
      }
      this._saveState();
      this._needsRendering = true;
    }
  }

  _moveBrick(intersect) {
    console.log(`moveBrick isBrickSelected=${this.isBrickSelected}`);
    if (this.isBrickSelected) { // a brick was already selected, now I'm done with it
      let brickModel = this.rollOverBrick.getModel();
      // need to temporarily revert back to initial position otherwise WorldSignature is wrong and server will get upset
      let currentBrickPosition = brickModel.position.clone();
      brickModel.position.copy(this.brickStartingPosition);
      brickModel.material = this.brickStartingMaterial;
      let hash = this.getWorldSignature();
      brickModel.position.copy(currentBrickPosition);
      let action = new Action(Action.Move, hash);
      action.moveBrick(this.rollOverBrick);
      this._sendActionToWebSocket(action);
      this.isBrickSelected = false;
      this.rollOverBrick = null;
      this.rollOverGhostBlock = null;
      this.transformControl.detach();
    } else { // select the current brick
      if (intersect.object === this.plane || intersect.object === this.ghostPlane) {
        return;
      }
      this.isBrickSelected = true;
      let ghost = intersect.object;
      let brick = ghost.brick;
      let brickModel = brick.getModel();
      this.brickStartingPosition = brickModel.position.clone();
      this.brickStartingMaterial = brickModel.material;
      brickModel.material = brickModel.material.clone();
      brickModel.material.transparent=true;
      brickModel.material.opacity = .6;
      if (this.rollOverBrick) this.scene.remove(this.rollOverBrick);
      if (this.rollOverGhostBlock) this.ghostScene.remove(this.rollOverGhostBlock);
      this.rollOverBrick = brick;
      this.rollOverGhostBlock = ghost;
      console.log(`Setting rollover to ${this.rollOverBrick.getModel().name} // ${this.rollOverGhostBlock.name}`);
      this.transformControl.attach(brickModel);
    }
  }


  _onMouseDown( event ) {
    this.setState({
      drag: false,
    });
  }

  _deleteBrick(brick) { // intersect.object is the ghost box (or the ghost plane), need to delete it and its matching brick
    let ghost = brick.ghostBlock;
    let brickModel = brick.getModel();
    brick.removeFromScene(this.scene, this.ghostScene);
    console.log("Deleting brick: "+brickModel.name);
    //brick.geometry.dispose();
    this.bricks = this.bricks.filter((value) => {return (value !== brick)});
    this.ghostBricks = this.ghostBricks.filter((value) => {return (value !== ghost)});
    ghost.geometry.dispose();
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
    let {brick: rollOverBrick} = this._getRollOverBrick();
    let {mode} = this.props;

    if (mode === Modes.Explore) {       // Movements for Explore mode
      switch (event.keyCode) {
        case 38: // up
        case 87: // w
        moveForward = true;
        break;

        case 37: // left
        case 65: // a
        moveLeft = true;
        break;

        case 40: // down
        case 83: // s
        moveBackward = true;
        break;

        case 39: // right
        case 68: // d
        moveRight = true;
        break;
      }
    } else { // Keyboard shortcuts for non-Explore modes
      switch(event.keyCode) {
        case 16: // Shift
          scene.setState({
            isShiftDown: true,
          });
          break;
        case 66: // B
          this.props.setMode(Modes.Build);
          rollOverBrick.getModel().visible = true;
          break;

        case 67: // C
          this.props.setMode(Modes.Clone);
          rollOverBrick.getModel().visible = false;
          break;

        case 68: // D
          this.props.setMode(Modes.Delete);
          rollOverBrick.getModel().visible = false;
          break;

        case 77: // M
          this.props.setMode(Modes.Move);
          rollOverBrick.getModel().visible = false;
          break;

        case 80: // P
          this.props.setMode(Modes.Paint);
          rollOverBrick.getModel().visible = false;
          break;

        case 82: // R
          rollOverBrick.rotateY(Math.PI / 2);
          break;

        case 88: // X
          this.props.setMode(Modes.Explore);
          rollOverBrick.getModel().visible = false;
          break;
        default: break;
      }

    }
  }


  _onKeyUp(event) {
    const { mode } = this.props;
    if (mode === Modes.Explore) {
      switch (event.keyCode) {
        case 38: // up
        case 87: // w
        moveForward = false;
        break;

        case 37: // left
        case 65: // a
        moveLeft = false;
        break;

        case 40: // down
        case 83: // s
        moveBackward = false;
        break;

        case 39: // right
        case 68: // d
        moveRight = false;
        break;
      }
    } else {
      switch (event.keyCode) {
        case 16:
          this.setState({
            isShiftDown: false,
          });
          break;
        case 68: // D
          //if (mode === 'build')
          //  rollOverBrick.getModel().visible = true;
          //this._needsRendering = true;
          break;
        case 82: // R
          this.setState({
            isRDown: false,
          });
          break;
        default: break;
      }
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
    let delta = this.clock.getDelta();

    if ( this.controls.enabled && this.controls.update ) {
      this.controls.update(delta);
    }

    if (this.controls.target) {
      let currentOrbitZoom = this.controls.target.distanceTo( this.controls.object.position );
      if (currentOrbitZoom !== this._previousOrbitZoom) {
        // a hack: I need to re-render if the user is zooming in (drag on trackpad)
        this._previousOrbitZoom = currentOrbitZoom;
        this._needsRendering = true;
      }
    }

    const {mode} = this.props;

    if (mode===Modes.Explore /*&& this.controls.isLocked === true*/ ) {
      velocity.x -= velocity.x * 10.0 * delta;
      velocity.z -= velocity.z * 10.0 * delta;
      velocity.y -= 9.8 * delta; // 100.0 = mass

      direction.z = Number( moveForward ) - Number( moveBackward );
      direction.x = Number( moveRight ) - Number( moveLeft );
      direction.normalize(); // this ensures consistent movements in all directions

      if ( moveForward || moveBackward ) velocity.z -= direction.z * 100.0 * delta;
      if ( moveLeft || moveRight ) velocity.x -= direction.x * 100.0 * delta;

      /*if ( mainCharacter.position.y === 0) {
        velocity.y = Math.max( 0, velocity.y );
      }*/

      if (velocity.x>0 & velocity.x<0.01) velocity.x=0;
      if (velocity.y>0 & velocity.y<0.01) velocity.y=0;
      if (velocity.z>0 & velocity.z<0.01) velocity.z=0;
      if (velocity.x<0 & velocity.x>-0.01) velocity.x=0;
      if (velocity.y<0 & velocity.y>-0.01) velocity.y=0;
      if (velocity.z<0 & velocity.z>-0.01) velocity.z=0;

      let deltaX = - velocity.x * delta * 50.0;
      let deltaZ = - velocity.z * delta * 50.0;
      if (deltaX!==0 || deltaZ!==0) {
        this.controls.moveRight(deltaX);
        this.controls.moveForward(deltaZ);
        this._needsRendering = true;
      }

      //controls.getObject().position.y += ( velocity.y * delta );
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
    if (this.controls.update) {
      this.controls.update(this.clock.getDelta());
    }
    this.renderer.render(first, this.camera);
    this.renderer.render(second, this.camera);
  }

  createAndAddBrickFromObject(state) {
    let brick;
    switch(state.brickType) {
      case MPDBrick.BrickType:
        brick = MPDBrick.load(state);
        break;
      case BasicBrick.BrickType:
        brick = BasicBrick.load(state);
        break;
      case GLBBrick.BrickType:
        brick = GLBBrick.load(state);
        break;
      case OBJBrick.BrickType:
        brick = OBJBrick.load(state);
        break;
      default:
        console.log('Unknown brick type: '+JSON.stringify(state));
        return null;
        break;
    }
    this._setupNewBrick(brick);
    return brick;
  }

  /*this.callApi()
    .then(res => this.setState({ response: res.express }))
    .catch(err => console.log(err));*/

  /*callApi = async () => {
    const response = await fetch('/api/hello');
    const body = await response.json();
    if (response.status !== 200) throw Error(body.message);
    console.log("Body = "+JSON.stringify(body));
    return body;
  };*/


  _loadState() {
    //try {
    window.fetch("/api/get-scene")
    .then(res => res.json())
    .then((objectsLoaded) => {
      //let json = window.localStorage.getItem('world');
      //if (!json)
      //  return;
      // let objectsLoaded = JSON.parse(result);
      console.log(`Received World from server: ${objectsLoaded}`);
      let version = objectsLoaded.version;
      if (version != FILE_VERSION_CURRENT) {
        console.log("Wrong file version, can't load: "+version);
        return;
      }
      let array = objectsLoaded.world;
      console.log(`Loading ${array.length} bricks`);
      for (let i=0; i<array.length; i++) {
        let state = array[i];
        let brick = this.createAndAddBrickFromObject(state);
      }
      this._renderScene();
      console.log(`Done loading ${array.length} bricks`);
      }, (error) => {
        console.log(`Unable to load scene from server. Error ${error}`);
        this.setState({
          isLoaded: true,
          error
        });
      }
    );
    //} catch (e) {
  //    console.log("ERROR LOADING STATE: "+e);
    //}
  }

  _setupNewBrick(brick) {
    brick.addToScene(this.scene, this.ghostScene);
    this.bricks.push(brick);
    let ghostBrick = brick.ghostBlock;
    this.ghostBricks.push(ghostBrick);
    this._needsRendering = true;
  }

  _saveState() { // saves to localStorage (no longer useful!).
    let arrayOfBricks = [];
    for (let i in this.bricks) {
      let state = this.bricks[i].save();
      arrayOfBricks.push(state);
    }
    let objectToSave = {
      version: FILE_VERSION_CURRENT,
      world: arrayOfBricks
    };
    let json = JSON.stringify(objectToSave);
    //let json = new Blob([JSON.stringify(simplified)];
    window.localStorage.setItem('world', json);
  }

  render() { // React function to generate the HTML object containing the scene
    const { isShiftDown, isRDown } = this.state;
    const { mode, shifted } = this.props;
    return(
      <div>
        <div className={shifted ? styles.shifted : styles.scene} ref={(mount) => { this.mount = mount }} />
        <If cond={mode === Modes.Delete}>
          <Message>
            <i className="ion-trash-a" />
            <span>Deleting bricks</span>
          </Message>
        </If>
        <If cond={isRDown && mode === Modes.Build}>
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
