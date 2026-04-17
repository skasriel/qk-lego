import * as THREE from 'three';
import React from 'react';
import ReconnectingWebSocket from 'reconnecting-websocket';

import { BOUNDINGBOX_OFFSET } from './Brick';
import { BasicBrick } from './BasicBrick';
import { Model } from './Model';

import Message from '../components/Message';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MyControl } from './MyControl';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

import { multX, multY, multZ, _toStringBox3, _toStringVector3D } from '../util';
import {
  composeTransform,
  normalizeNodeForHash,
  getWorldHash,
} from '../../../shared/transforms.js';
import { Modes, Action } from '../util';

const If = ({ cond, children }) => (cond ? children : null);

THREE.ColorManagement.enabled = false;

let styles = {};
const worldSize = 100000;

const FILE_VERSION_CURRENT = 1.4;

const PLANE_OFFSET = 0;

const USE_SHADOWS = false;

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
  zIndex: 1,
};
styles.shifted = {
  composes: 'scene',
  position: 'absolute',
  height: '100%',
  width: '100%',
  pointerEvents: 'none',
  transition: 'transform 0.15s ease-in-out',
  transform: 'translate3d(0, 0, 0)',
};

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
    // Model rollover state (for placing full models, not just bricks)
    this.rollOverModel = null; // Three.js Group for the model preview
    this.rollOverModelData = null; // Original model data (worldModel format)
    this.rollOverModelGhost = null; // Ghost scene group for collision detection
    this._rollOverModelPromise = null; // Prevent concurrent preview creation
  }

  async componentDidMount() {
    this._initWS();
    this._initCore();
    this._initEnv();
    await this._init();
  }

  // Handles messages from server - typically, because another client made changes to the scene
  async _handleWSMessage(message) {
    const action = JSON.parse(message.data);
    switch (action.type) {
      case Action.Create: {
        await this.createAndAddBrickFromObject(action.brick);
        console.log('Added new brick because server told us to '); //+JSON.stringify(brick));
        break;
      }
      case Action.Delete: {
        let brickToDelete = this.findBrickInModel(action.uuid);
        console.log(`Server instructed me to delete brick ${action.uuid}`); //, found as ${brickToDelete}`);
        this._deleteBrick(brickToDelete);
        break;
      }
      case Action.Move: {
        let brickToMove = this.findBrickInModel(action.brick.uuid);
        console.log(`Server instructed me to move brick ${action.brick.uuid}`); //, found as ${brickToDelete}`);
        brickToMove.setPosition(action.brick.position, true);
        break;
      }
      case Action.Reload: {
        console.log(`Server instructed me to do a full reload`);
        // Remove all bricks from scene
        const allBricks = this.getAllBricks();
        for (let i = 0; i < allBricks.length; i++) {
          allBricks[i].removeFromScene(this.scene, this.ghostScene);
        }
        this.worldModel = new Model('Current World');
        this.ghostBricks = [];
        await this.loadWorldModel(action.worldModel);
        this._renderScene();
        break;
      }
      default:
        console.log('Action type not supported yet: ' + action.type);
        break;
    }
    console.log('_handleWSMessage: ' + JSON.stringify(action));
  }

  _initWS() {
    let wsURL =
      (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
      window.location.host +
      '/ws-api';
    console.log('WS Connection to ' + wsURL);
    this.ws = new ReconnectingWebSocket(wsURL);

    this.ws.onopen = () => {
      console.log('connected to server via web socket');
    };

    this.ws.onmessage = (message) => this._handleWSMessage(message); // on receiving a message, add it to the list of messages
  }

  _sendActionToWebSocket(action) {
    console.log('Sending action to server: '); //+JSON.stringify(action));
    this.ws.send(JSON.stringify(action));
  }

  async _init() {
    this._setEventListeners();
    this._start();
    await this._loadState();
    this._needsRendering = true;
    // Create initial rollover brick
    await this._getRollOverBrick();
  }

  async componentDidUpdate(prevProps) {
    const { mode, brickColor, colorType, brickID } = this.props;

    if (this.rollOverBrick) {
      const rollOverModel = this.rollOverBrick.getModel();
      if (mode === Modes.Build) {
        rollOverModel.visible = true;
      } else {
        rollOverModel.visible = false;
      }
    }

    if (mode !== prevProps.mode) {
      this.modeSetup(prevProps.mode);
    }

    if (prevProps.brickID !== brickID || prevProps.brickColor != brickColor) {
      // selected a new brick type or color!
      if (this.rollOverBrick) {
        this.scene.remove(this.rollOverBrick.getModel());
        this.ghostScene.remove(this.rollOverGhostBlock);
        this.rollOverBrick = null;
        this.rollOverGhostBlock = null;
        this._rollOverBrickPromise = null;
      }
      // Create brick asynchronously from DAT file
      const brick = await BasicBrick.createFromDAT(brickID, brickColor, colorType);
      this.rollOverBrick = brick;
      this.rollOverBrick.addToScene(this.scene, this.ghostScene);
      this._positionRollOverBrickOnFloor(this.rollOverBrick);
      this.rollOverGhostBlock = this.rollOverBrick.ghostBlock;
      this._needsRendering = true;
    }
    this._needsRendering = true;
  }

  _positionRollOverBrickOnFloor(brick) {
    const mesh = brick.getModel();
    const bb = this._getModelLocalBoundingBox(mesh);
    // In our Y-down convention, bottom is the largest local Y.
    const bottomOffset = bb.max.y;
    brick.setPosition({ x: 0, y: -Math.round(bottomOffset), z: 0 }, true);
  }

  _getModelLocalBoundingBox(object) {
    object.updateMatrixWorld(true);

    const rootInverse = new THREE.Matrix4().copy(object.matrixWorld).invert();
    const box = new THREE.Box3();
    const meshBox = new THREE.Box3();
    const localMatrix = new THREE.Matrix4();

    object.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;

      if (!child.geometry.boundingBox) {
        child.geometry.computeBoundingBox();
      }

      meshBox.copy(child.geometry.boundingBox);
      localMatrix.multiplyMatrices(rootInverse, child.matrixWorld);
      meshBox.applyMatrix4(localMatrix);
      box.union(meshBox);
    });

    return box;
  }

  _getModelFootprintBox(object) {
    object.updateMatrixWorld(true);
    const worldBox = new THREE.Box3().setFromObject(object);
    return {
      min: {
        x: worldBox.min.x - object.position.x,
        z: worldBox.min.z - object.position.z,
      },
      max: {
        x: worldBox.max.x - object.position.x,
        z: worldBox.max.z - object.position.z,
      },
    };
  }

  _initCore() {
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.scale.y = -1; // Flip Y axis to match LDraw coordinate system (Y-down)
    this.ghostScene = new THREE.Scene();
    this.ghostScene.scale.y = -1; // Flip Y axis for ghost scene too
    this.worldModel = new Model('Current World');
    this.ghostBricks = [];

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(0xffffff);
    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;

    this.modeSetup(null);
    this.mount.appendChild(this.renderer.domElement);
  }

  // Helper to get flat list of all bricks from model tree
  getAllBricks() {
    const bricks = [];
    const traverse = (node) => {
      if (!node) return;
      if (node instanceof BasicBrick) {
        bricks.push(node);
      } else if (node instanceof Model) {
        node.children.forEach((child) => traverse(child.object));
      } else if (node.type === 'brick' && node.object) {
        bricks.push(node.object);
      } else if (node.type === 'model' && (node.object || node.children)) {
        const model = node.object || node;
        (model.children || []).forEach((child) => traverse(child.object || child));
      }
    };
    traverse(this.worldModel);
    return bricks;
  }

  // Helper to find brick by UUID in model tree
  findBrickInModel(uuid) {
    const bricks = this.getAllBricks();
    return bricks.find((b) => b._uuid === uuid);
  }

  findBrickNodeInModel(model, brick) {
    if (!model || !model.children) return null;
    for (const child of model.children) {
      if (child.type === 'brick' && child.object === brick) {
        return child;
      }
      if (child.type === 'model') {
        const found = this.findBrickNodeInModel(child.object, brick);
        if (found) return found;
      }
    }
    return null;
  }

  syncBrickTransform(brick) {
    const node = this.findBrickNodeInModel(this.worldModel, brick);
    if (!node) return;
    const state = brick.save();
    node.transform = {
      position: state.position,
      rotationMatrix: state.rotationMatrix,
    };
  }

  modeSetup(prevMode) {
    const { mode } = this.props;
    if (mode === prevMode) {
      console.log("Shouldn't happen");
      return;
    }
    let camera, controls;

    if (mode === Modes.Explore) {
      // Switch from a non-Explore mode to Explore
      camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        1,
        2000 // LDraw scale: plenty for large models
      );
      // LDraw Y points down, so position camera above looking down
      camera.position.set(0, -25, 25);
      camera.up.set(0, 0, 1); // Make Z up in camera space to match LDraw Y-down
      camera.lookAt(new THREE.Vector3(0, 0, 0));
      this.scene.fog = new THREE.FogExp2(0xffffff, 0.00015);
      //controls = new OrbitControls(camera, this.renderer.domElement);
      controls = new MyControl(camera, this.renderer.domElement);

      var rootObj = document.getElementById('root');
      //console.log("Root = "+rootObj+" "+rootObj.innerHTML.toString());
      var blocker = document.getElementById('blocker');
      var instructions = document.getElementById('instructions');

      controls.lock();
      instructions.addEventListener(
        'click',
        function () {
          controls.lock();
        },
        false
      );
      controls.addEventListener('lock', function () {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
      });
      controls.addEventListener('unlock', function () {
        blocker.style.display = 'block';
        instructions.style.display = '';
      });

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
    } else if (prevMode === Modes.Explore || prevMode == null) {
      // Switch from a Explore mode to a non Explore mode
      camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        1,
        worldSize / 10
      );

      camera.position.set(-246, 454, 855);
      camera.lookAt(new THREE.Vector3());
      controls = new OrbitControls(camera, this.renderer.domElement);
      controls.addEventListener('change', () => (this._needsRendering = true));
      controls.enableDamping = true;
      controls.dampingFactor = 0.15;
      controls.rotateSpeed = 0.3;
      controls.maxPolarAngle = Math.PI / 2;
      controls.minDistance = 200;
      controls.maxDistance = worldSize;
      if (this.controls) {
        this.controls.dispose();
      }
      this.controls = controls;
      this.camera = camera;
    }

    if (mode === Modes.Move) {
      const transformControl = new TransformControls(this.camera, this.renderer.domElement);
      transformControl.setMode('translate');
      transformControl.setTranslationSnap(multX);

      transformControl.addEventListener('change', () => {
        this._needsRendering = true;
      });
      transformControl.addEventListener('dragging-changed', (event) => {
        if (this.controls) this.controls.enabled = !event.value;
      });
      this.transformControl = transformControl;
      this.scene.add(transformControl);
    }
  }

  _initEnv() {
    // Main directional light - creates highlights and shadows to show true colors
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 200, 100);
    directionalLight.castShadow = false;
    this.scene.add(directionalLight);

    // Fill light from opposite side - softens shadows
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-50, 100, -50);
    this.scene.add(fillLight);

    // Ambient light - provides base illumination so dark areas aren't black
    // Reduced intensity to let directional lights show the true colors
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(ambientLight);

    const geometry = new THREE.PlaneGeometry(worldSize, worldSize);
    geometry.rotateX(-Math.PI / 2);
    const planeMaterial = new THREE.ShadowMaterial();
    planeMaterial.opacity = 1.0;
    planeMaterial.side = THREE.DoubleSide;
    const plane = new THREE.Mesh(geometry, planeMaterial);
    plane.name = 'plane';
    plane.receiveShadow = true;
    this.plane = plane;
    this.scene.add(plane);

    const ghostPlane = new THREE.Mesh(geometry, planeMaterial);
    ghostPlane.name = 'ghost plane';
    this.ghostPlane = ghostPlane;
    this.ghostScene.add(ghostPlane);

    const grid = new THREE.GridHelper(
      worldSize,
      worldSize / multX,
      new THREE.Color(0xbfbfbf),
      new THREE.Color(0xdedede)
    );
    this.scene.add(grid);

    const ghostGrid = new THREE.GridHelper(
      worldSize,
      worldSize / multX,
      new THREE.Color(0xbfbfbf),
      new THREE.Color(0xdedede)
    );
    this.ghostScene.add(ghostGrid);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    console.log('initEnv');
  }

  async _getRollOverBrick() {
    // returns the rollover brick and its ghost block
    // Prevent race condition by storing promise
    if (this._rollOverBrickPromise) {
      await this._rollOverBrickPromise;
      return { brick: this.rollOverBrick, block: this.rollOverGhostBlock };
    }

    if (!this.rollOverBrick) {
      const { brickID, brickColor, colorType } = this.props;
      this._rollOverBrickPromise = (async () => {
        const brick = await BasicBrick.createFromDAT(brickID, brickColor, colorType);
        brick.addToScene(this.scene, this.ghostScene);
        this._positionRollOverBrickOnFloor(brick);
        this.rollOverBrick = brick;
        this.rollOverGhostBlock = brick.ghostBlock;
      })();
      await this._rollOverBrickPromise;
      this._rollOverBrickPromise = null;
    }
    return { brick: this.rollOverBrick, block: this.rollOverGhostBlock };
  }

  /**
   * Set a model as the current rollover (for placing)
   * This stores the model data and creates a preview that follows the mouse
   * @param {Object} modelData - The model data in worldModel format
   */
  async setModelRollOver(modelData) {
    // Clear any existing model rollover
    this.clearModelRollOver();

    this.rollOverModelData = modelData;

    // Hide the brick rollover while model is active
    if (this.rollOverBrick) {
      this.rollOverBrick.getModel().visible = false;
    }
  }


  /**
   * Clear the current model rollover
   */
  clearModelRollOver() {
    if (this.rollOverModel) {
      this.scene.remove(this.rollOverModel);
      this.rollOverModel = null;
    }
    if (this.rollOverModelGhost) {
      this.ghostScene.remove(this.rollOverModelGhost);
      this.rollOverModelGhost = null;
    }
    this.rollOverModelData = null;
    this._rollOverModelPromise = null;

    // Show brick rollover again
    if (this.rollOverBrick && this.props.mode === Modes.Build) {
      this.rollOverBrick.getModel().visible = true;
    }
  }

  /**
   * Check if a model rollover is currently active
   */
  isModelRollOverActive() {
    return this.rollOverModelData !== null;
  }

  /**
   * Create a Three.js preview group for the model rollover
   * This loads all bricks in the model and creates a group that follows the mouse
   */
  async _createModelRollOverPreview() {
    // Prevent concurrent creation
    if (this._rollOverModelPromise) {
      await this._rollOverModelPromise;
      return;
    }

    if (!this.rollOverModelData || this.rollOverModel) {
      return;
    }

    this._rollOverModelPromise = (async () => {
      const modelData = this.rollOverModelData;
      const previewGroup = new THREE.Group();
      previewGroup.name = `Preview_${modelData.name || 'Model'}`;

      // Load all bricks in the model
      const loadBricksRecursive = async (node, parentGroup) => {
        const children = node.children || [];
        for (const child of children) {
          if (child.type === 'brick') {
            const brickState = child.object || child;
            // For preview, use the brick's local transform, not composed world transform
            // The parentGroup hierarchy will handle the positioning
            const localTransform = child.transform || {};

            try {
              const brick = await BasicBrick.load({
                ...brickState,
                position: localTransform.position || brickState.position,
                rotationMatrix: localTransform.rotationMatrix || brickState.rotationMatrix,
              });

              // Clone the model for preview (don't add to scene via addToScene)
              const brickModel = brick.getModel().clone();
              brickModel.position.copy(brick.getModel().position);
              brickModel.rotation.copy(brick.getModel().rotation);
              parentGroup.add(brickModel);
            } catch (err) {
              console.error('Failed to load brick for preview:', err);
            }
          } else if (child.type === 'model') {
            const childModelData = child.object || child;
            const childGroup = new THREE.Group();
            childGroup.name = childModelData.name || 'SubModel';

            // Use local transform, not composed world transform
            const localTransform = child.transform || {};
            if (localTransform.position) {
              childGroup.position.set(
                localTransform.position.x,
                localTransform.position.y,
                localTransform.position.z
              );
            }

            parentGroup.add(childGroup);
            await loadBricksRecursive(childModelData, childGroup, null);
          }
        }
      };

      await loadBricksRecursive(modelData, previewGroup);


      // Position at origin initially (Y=0) - will be updated by mouse move
      previewGroup.position.set(0, 0, 0);

      // Add to scene
      this.scene.add(previewGroup);
      this.rollOverModel = previewGroup;


      // Create ghost version for collision detection
      const ghostGroup = previewGroup.clone();
      this.ghostScene.add(ghostGroup);
      this.rollOverModelGhost = ghostGroup;

    })();
    await this._rollOverModelPromise;
    this._rollOverModelPromise = null;
  }

  _setEventListeners() {
    document.addEventListener('mousemove', (event) => this._onMouseMove(event), false);
    document.addEventListener('mousedown', (event) => this._onMouseDown(event), false);
    document.addEventListener('mouseup', (event) => this._onMouseUp(event), false);
    document.addEventListener('keydown', (event) => this._onKeyDown(event, this), false);
    document.addEventListener('keyup', (event) => this._onKeyUp(event, this), false);
    window.addEventListener('resize', (event) => this._onWindowResize(event, this), false);
  }

  _onWindowResize(event) {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.controls && this.controls.handleResize) this.controls.handleResize();
    this._needsRendering = true;
  }

  /* Uses the ray caster to identify the object closest to the mouse position in the ghost space
      Returns { distance, point, face, faceIndex, object } see https://threejs.org/docs/#api/en/core/Raycaster
  */
  _getIntersect(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Use actual brick models for intersection, not ghost boxes
    // This allows accurate clicking on L-shaped bricks, etc.
    var intersectArray = [...this.getAllBricks().map((b) => b.getModel()), this.ghostPlane];
    const { mode } = this.props;
    if (mode === Modes.Move && this.isBrickSelected) {
      // remove the brick we're moving from the raycaster
      intersectArray = intersectArray.filter((model) => {
        return model !== this.rollOverBrick.getModel();
      });
    }
    const intersects = this.raycaster.intersectObjects(intersectArray, true);
    if (intersects.length == 0) {
      return null;
    }
    let intersect = intersects[0];
    return intersect;
  }

  isBuildMode() {
    return this.props.mode === Modes.Build;
  }

  async _createBrick(intersect) {
    const { brick: rollOverBrick, block: rollOverGhostBlock } = await this._getRollOverBrick();

    // For accurate collision detection with complex shapes (L-bricks, etc.),
    // we need to check actual geometry intersection, not just bounding boxes.
    // Use Three.js raycasting to check if the new brick's geometry intersects existing bricks.
    const rollOverMesh = rollOverBrick.getModel();

    const allBricks = this.getAllBricks();
    for (var i = 0; i < allBricks.length; i++) {
      const existingBrick = allBricks[i];
      const existingMesh = existingBrick.getModel();

      // Quick bounding box check first (for performance)
      const newBox = new THREE.Box3().setFromObject(rollOverMesh);
      const existingBox = new THREE.Box3().setFromObject(existingMesh);

      if (!newBox.intersectsBox(existingBox)) {
        continue; // No bounding box overlap, definitely no collision
      }

      // Bounding boxes overlap - do precise mesh intersection test
      // Check if any vertices of the new brick are inside the existing brick
      const newGeometry = rollOverMesh.geometry;
      const existingGeometry = existingMesh.geometry;

      if (!newGeometry || !existingGeometry) continue;

      // Get world matrices
      const newMatrix = rollOverMesh.matrixWorld;
      const existingMatrixInverse = new THREE.Matrix4().copy(existingMesh.matrixWorld).invert();

      // Check a sample of vertices from the new brick
      const posAttr = newGeometry.attributes.position;
      if (!posAttr) continue;

      let collision = false;
      const sampleStep = Math.max(1, Math.floor(posAttr.count / 20)); // Sample ~20 vertices for performance

      for (let v = 0; v < posAttr.count; v += sampleStep) {
        const vertex = new THREE.Vector3().fromBufferAttribute(posAttr, v);
        vertex.applyMatrix4(newMatrix); // Transform to world space
        vertex.applyMatrix4(existingMatrixInverse); // Transform to existing brick's local space

        // Check if this vertex is inside the existing brick's bounding box
        if (existingGeometry.boundingBox === null) {
          existingGeometry.computeBoundingBox();
        }
        if (existingGeometry.boundingBox.containsPoint(vertex)) {
          collision = true;
          break;
        }
      }

      if (collision) {
        console.log('Not creating object: collision with ' + existingBrick.getModel().name);
        return;
      }
    }

    let position = rollOverGhostBlock.position.clone();
    position.y += BOUNDINGBOX_OFFSET;

    // Create brick asynchronously from DAT file
    const brick = await BasicBrick.createFromDAT(
      rollOverBrick._brickID,
      rollOverBrick.color,
      rollOverBrick.colorType
    );

    if (rollOverBrick._angle && rollOverBrick._angle != 0) {
      brick.rotateY(rollOverBrick._angle);
    }
    console.log(
      `create brick, no collisions. Added ${BOUNDINGBOX_OFFSET} to y=${position.y} will set position to ${_toStringVector3D(position)}`
    );
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
    return getWorldHash(this.worldModel);
  }

  // onMouseMove Mouse Handlers
  async _onMouseMove(event) {
    // Ignore mouse moves not on canvas or in UI areas
    if (event.target.localName !== 'canvas') return;
    if (event.clientY > window.innerHeight - 180) return;

    const { mode } = this.props; // edit vs draw

    // Handle model rollover if active
    const isModelActive = this.isModelRollOverActive();

    if (isModelActive) {
      // Ensure model preview exists
      if (!this.rollOverModel) {
        await this._createModelRollOverPreview();
      }
      if (!this.rollOverModel) {
        console.log('No rollover model!');
        return;
      }
    } else {
      // Ensure rollover brick exists
      if (!this.rollOverBrick) {
        await this._getRollOverBrick();
      }
      if (!this.rollOverBrick) {
        console.log('No rollover brick!');
        return;
      }
    }

    event.preventDefault();

    const drag = true;
    this.setState({ drag });

    // Hide rollovers in non-build modes
    if (mode === Modes.Delete || mode === Modes.Paint || mode === Modes.Explore) {
      if (isModelActive && this.rollOverModel) {
        this.rollOverModel.visible = false;
      } else if (!isModelActive && this.rollOverBrick) {
        this.rollOverBrick.getModel().visible = false;
      }
      return;
    }
    if (mode === Modes.Move && !this.isBrickSelected) {
      if (isModelActive && this.rollOverModel) {
        this.rollOverModel.visible = false;
      } else if (!isModelActive && this.rollOverBrick) {
        this.rollOverBrick.getModel().visible = false;
      }
      return;
    }

    // Show rollovers in build mode
    if (isModelActive && this.rollOverModel) {
      this.rollOverModel.visible = true;
    } else if (!isModelActive && this.rollOverBrick) {
      this.rollOverBrick.getModel().visible = true;
    }

    const intersect = this._getIntersect(event);
    if (intersect == null) {
      return;
    }

    let intersectObject = intersect.object;
    let position = this.scene.worldToLocal(intersect.point.clone());

    // Handle model rollover positioning
    if (isModelActive) {
      console.log(
        intersectObject?.name || intersectObject?.type
      );

      if (intersectObject === this.plane || intersectObject === this.ghostPlane) {
        // Place model at intersect point with Y=0
        position.y = 0;
      } else {
        // For now, place at intersect point with Y=0
        // TODO: Add stacking support for models
        position.y = 0;
      }

      // Update model preview position
      this.rollOverModel.position.copy(position);
      if (this.rollOverModelGhost) {
        this.rollOverModelGhost.position.copy(position);
      }
      this._needsRendering = true;
      return; // Skip brick handling
    }

    // Handle brick rollover (existing code)
    const rollOverBrick = this.rollOverBrick;
    const rollOverGhostBlock = this.rollOverGhostBlock;

    // Recompute the rollover brick's LOCAL bounds so rotation is reflected correctly.
    const bb = this._getModelLocalBoundingBox(rollOverBrick.getModel());
    // In Y-down, bottom is max.y
    const bottomOffset = bb.max.y;

    if (intersectObject === this.plane || intersectObject === this.ghostPlane) {
      // Place brick so its bottom sits on the floor (y=0)
      position.y = Math.round(-bottomOffset);
    } else {
      const intersectRoot = intersectObject.userData?.brick?.getModel?.() || intersectObject;
      const intersectBrick = intersectObject.userData?.brick;
      // Use cached bbox if available, otherwise calculate once
      let intersectBox;
      if (intersectBrick && intersectBrick._localBBox) {
        intersectBox = intersectBrick._localBBox;
      } else {
        intersectBox = this._getModelLocalBoundingBox(intersectRoot);
      }
      // Place brick so its bottom sits on top of the intersected object
      // In Y-down coordinates with scene.scale.y = -1:
      // - intersectBox.min.y is the TOP of the existing brick (smallest Y value)
      // - We want new brick's bottom to be at that Y position
      // - new brick's bottom is at its position.y + bb.max.y (since max.y is bottom in local coords)
      // So: newPos.y + newBrickBottom = targetTop
      // newPos.y = targetTop - newBrickBottom
      const targetTopY = intersectRoot.position.y + intersectBox.min.y;
      const newBrickBottomOffset = bb.max.y;
      const knobNesting = 4; // Studs nest 4 LDU into the brick above
      position.y = Math.round(targetTopY - newBrickBottomOffset + knobNesting);
    }

    // Snap to grid - align brick edges to grid lines.
    // Use a world-axis-aligned footprint box so Y-rotation swaps the 2x3 / 3x2 footprint correctly.
    const footprint = this._getModelFootprintBox(rollOverBrick.getModel());
    const modelWidth = footprint.max.x - footprint.min.x;
    const modelDepth = footprint.max.z - footprint.min.z;
    // Round dimensions to nearest grid unit to avoid floating point issues
    // Add small epsilon to handle floating point errors consistently
    const eps = 0.001;
    const brickWidth = Math.round((modelWidth + eps) / multX) * multX;
    const brickDepth = Math.round((modelDepth + eps) / multZ) * multZ;

    // Snap using the brick footprint's current left/front edges in scene space.
    const leftEdge = position.x + footprint.min.x;
    const frontEdge = position.z + footprint.min.z;
    const snappedLeft = Math.round((leftEdge + eps) / multX) * multX;
    const snappedFront = Math.round((frontEdge + eps) / multZ) * multZ;
    position.x = snappedLeft - footprint.min.x;
    position.z = snappedFront - footprint.min.z;

    rollOverBrick.setPosition(position, true);
    this._needsRendering = true;
  }

  _onMouseUp(event) {
    // Ignore clicks not on canvas
    if (event.target.localName !== 'canvas') return;

    // Ignore clicks in UI areas (brick picker at bottom, etc.)
    // Brick picker is ~180px tall at bottom
    if (event.clientY > window.innerHeight - 180) {
      return;
    }

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
            const brick = this.resolveBrickFromObject(intersect.object);
            if (!brick) return;
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
          console.log('Unsupported mode: ' + mode);
          break;
      }
      this._saveState();
      this._needsRendering = true;
    }
  }

  _moveBrick(intersect) {
    console.log(`moveBrick isBrickSelected=${this.isBrickSelected}`);
    if (this.isBrickSelected) {
      // a brick was already selected, now I'm done with it
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
      this.syncBrickTransform(this.rollOverBrick);
      this.isBrickSelected = false;
      this.rollOverBrick = null;
      this.rollOverGhostBlock = null;
      this.transformControl.detach();
    } else {
      // select the current brick
      if (intersect.object === this.plane || intersect.object === this.ghostPlane) {
        return;
      }
      this.isBrickSelected = true;
      let brick = this.resolveBrickFromObject(intersect.object);
      if (!brick) return;
      let ghost = brick.ghostBlock;
      let brickModel = brick.getModel();
      this.brickStartingPosition = brickModel.position.clone();
      this.brickStartingMaterial = brickModel.material;
      brickModel.material = brickModel.material.clone();
      brickModel.material.transparent = true;
      brickModel.material.opacity = 0.6;
      if (this.rollOverBrick) this.scene.remove(this.rollOverBrick);
      if (this.rollOverGhostBlock) this.ghostScene.remove(this.rollOverGhostBlock);
      this.rollOverBrick = brick;
      this.rollOverGhostBlock = ghost;
      console.log(
        `Setting rollover to ${this.rollOverBrick.getModel().name} // ${this.rollOverGhostBlock.name}`
      );
      this.transformControl.attach(brickModel);
    }
  }

  _onMouseDown(event) {
    // Ignore clicks not on canvas or in UI areas
    if (event.target.localName !== 'canvas') return;
    if (event.clientY > window.innerHeight - 180) return;

    this.setState({
      drag: false,
    });
  }

  _deleteBrick(brick) {
    let brickModel = brick.getModel();
    brick.removeFromScene(this.scene, this.ghostScene);
    console.log('Deleting brick: ' + brickModel.name);
    // Remove from model tree
    const removeFromModel = (model, targetBrick) => {
      if (!model || !model.children) return false;
      let removed = false;
      model.children = model.children.filter((child) => {
        if (child.type === 'brick' && child.object === targetBrick) {
          removed = true;
          return false;
        } else if (child.type === 'model') {
          const childModel = child.object || child;
          if (removeFromModel(childModel, targetBrick)) removed = true;
          return true;
        }
        return true;
      });
      return removed;
    };
    removeFromModel(this.worldModel, brick);
    const ghost = brick.ghostBlock;
    this.ghostBricks = this.ghostBricks.filter((value) => {
      return value !== ghost;
    });
    ghost.geometry.dispose();
    this._needsRendering = true;
  }

  _paintBrick(intersect) {
    if (intersect.object === this.plane || intersect.object === this.ghostPlane) {
      return;
    }
    const { brickColor } = this.props;
    const brick = this.resolveBrickFromObject(intersect.object);
    if (!brick) return;
    brick.setColor(brickColor);
    this._needsRendering = true;
  }

  resolveBrickFromObject(object) {
    let current = object;
    while (current) {
      if (current.userData && current.userData.brick) return current.userData.brick;
      if (current.brick) return current.brick;
      current = current.parent;
    }
    return null;
  }

  async _onKeyDown(event, scene) {
    if (!this.rollOverBrick) {
      await this._getRollOverBrick();
    }
    let rollOverBrick = this.rollOverBrick;
    let { mode } = this.props;

    if (mode === Modes.Explore) {
      // Movements for Explore mode
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
    } else {
      // Keyboard shortcuts for non-Explore modes
      switch (event.keyCode) {
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
        default:
          break;
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
        default:
          break;
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

    if (this.controls && this.controls.enabled && this.controls.update) {
      this.controls.update(delta);
    }

    if (this.controls && this.controls.target) {
      let currentOrbitZoom = this.controls.target.distanceTo(this.controls.object.position);
      if (currentOrbitZoom !== this._previousOrbitZoom) {
        // a hack: I need to re-render if the user is zooming in (drag on trackpad)
        this._previousOrbitZoom = currentOrbitZoom;
        this._needsRendering = true;
      }
    }

    const { mode } = this.props;

    if (mode === Modes.Explore /*&& this.controls.isLocked === true*/) {
      velocity.x -= velocity.x * 10.0 * delta;
      velocity.z -= velocity.z * 10.0 * delta;
      velocity.y -= 9.8 * delta; // 100.0 = mass

      direction.z = Number(moveForward) - Number(moveBackward);
      direction.x = Number(moveRight) - Number(moveLeft);
      direction.normalize(); // this ensures consistent movements in all directions

      if (moveForward || moveBackward) velocity.z -= direction.z * 100.0 * delta;
      if (moveLeft || moveRight) velocity.x -= direction.x * 100.0 * delta;

      /*if ( mainCharacter.position.y === 0) {
        velocity.y = Math.max( 0, velocity.y );
      }*/

      if ((velocity.x > 0) & (velocity.x < 0.01)) velocity.x = 0;
      if ((velocity.y > 0) & (velocity.y < 0.01)) velocity.y = 0;
      if ((velocity.z > 0) & (velocity.z < 0.01)) velocity.z = 0;
      if ((velocity.x < 0) & (velocity.x > -0.01)) velocity.x = 0;
      if ((velocity.y < 0) & (velocity.y > -0.01)) velocity.y = 0;
      if ((velocity.z < 0) & (velocity.z > -0.01)) velocity.z = 0;

      let deltaX = -velocity.x * delta * 50.0;
      let deltaZ = -velocity.z * delta * 50.0;
      if (deltaX !== 0 || deltaZ !== 0) {
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
    if (!this.renderer || !this.camera) return;
    if (this.controls && this.controls.update) {
      this.controls.update(this.clock.getDelta());
    }
    this.renderer.clear();
    this.renderer.render(this.ghostScene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
  }

  async createAndAddBrickFromObject(state) {
    let brick = await BasicBrick.load(state);
    this._setupNewBrick(brick);
    return brick;
  }

  async loadWorldModel(node, parentModel = null, parentTransform = null) {
    if (!node) return null;
    if (!parentModel) {
      this.worldModel = new Model(node.name || 'Current World');
      parentModel = this.worldModel;
    }

    const children = node.children || [];
    for (const child of children) {
      if (child.type === 'brick') {
        const brickState = child.object || child;
        const transform = composeTransform(parentTransform, child.transform || {});
        const brick = await BasicBrick.load({
          ...brickState,
          position: transform.position || brickState.position,
          rotationMatrix: transform.rotationMatrix || brickState.rotationMatrix,
        });
        this._setupNewBrick(brick, parentModel, transform);
      } else if (child.type === 'model') {
        console.log('Child is a model - loading recursively');
        const childModelData = child.object || child;
        const runtimeModel = new Model(childModelData.name || 'Untitled');
        parentModel.addModel(runtimeModel, child.transform || null);
        await this.loadWorldModel(
          childModelData,
          runtimeModel,
          composeTransform(parentTransform, child.transform || {})
        );
      }
    }
    return parentModel;
  }

  async addModelToScene(modelData) {
    // Add a model to the existing scene (don't replace)
    // Position it at origin for now - could be enhanced to place at cursor
    await this.loadWorldModel(modelData, this.worldModel, null);
    this._renderScene();
  }

  async _loadState() {
    try {
      const res = await window.fetch('/api/get-scene');
      const objectsLoaded = await res.json();

      console.log(`Received World from server`);
      let version = objectsLoaded.version;
      if (version != FILE_VERSION_CURRENT) {
        console.log("Wrong file version, can't load: " + version);
        return;
      }
      await this.loadWorldModel(objectsLoaded.worldModel);

      // After loading, ensure the model sits on the floor (y=0)
      // In LDraw Y-down coordinates, find the lowest point (largest Y value)
      // and shift the entire model up so the bottom touches the floor
      // TEMPORARILY DISABLED FOR TESTING
      // this._positionModelOnFloor();

      this._renderScene();
      console.log(`Done loading world model`);
    } catch (error) {
      console.log(`Unable to load scene from server. Error ${error}`);
      this.setState({
        isLoaded: true,
        error,
      });
    }
  }

  _setupNewBrick(brick, parentModel = null, transform = null) {
    brick.addToScene(this.scene, this.ghostScene);
    const targetModel = parentModel || this.worldModel;
    targetModel.addBrick(brick, transform);

    brick.getModel().traverse((child) => {
      child.userData = child.userData || {};
      child.userData.brick = brick;
    });
    let ghostBrick = brick.ghostBlock;
    this.ghostBricks.push(ghostBrick);
    this._needsRendering = true;
  }

  _positionModelOnFloor() {
    const bricks = this.getAllBricks();
    if (bricks.length === 0) {
      console.log('No bricks found to position on floor');
      return;
    }

    // Work in scene-local LDraw coordinates, not world coordinates, because the scene
    // itself is flipped with scale.y = -1. Using expandByObject() gives world-space
    // bounds after that flip, which is the wrong basis for deciding what "lowest" means.
    let minY = Infinity;
    let maxY = -Infinity;

    for (const brick of bricks) {
      const bb = brick._localBBox || this._getModelLocalBoundingBox(brick.getModel());
      const pos = brick.getPosition();
      const brickMinY = pos.y + bb.min.y;
      const brickMaxY = pos.y + bb.max.y;
      minY = Math.min(minY, brickMinY);
      maxY = Math.max(maxY, brickMaxY);
    }

    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
      console.log('No brick bounds found to position on floor');
      return;
    }

    // In scene-local LDraw coordinates, Y points down, so the lowest point is maxY.
    const lowestY = maxY;
    console.log('floor fix debug', {
      brickCount: bricks.length,
      minY,
      maxY,
      lowestY,
    });
    console.log(
      `Model bounds: minY=${minY.toFixed(2)}, maxY=${maxY.toFixed(2)}, lowestY=${lowestY.toFixed(2)}`
    );

    if (Math.abs(lowestY) <= 0.1) {
      console.log('Model already positioned correctly on floor');
      return;
    }

    const offset = -lowestY;
    console.log(`Shifting model by ${offset.toFixed(2)} to place bottom at floor (y=0)`);

    // Move each brick as a whole unit so meshes, line segments, and ghost blocks stay aligned.
    for (const brick of bricks) {
      const position = brick.getPosition().clone();
      position.y += offset;
      brick.setPosition(position, true);
    }
  }

  _saveState() {
    // saves to localStorage (legacy/debug only).
    const serializeModel = (model) => ({
      type: 'model',
      name: model.name,
      children: (model.children || []).map((child) => {
        if (child.type === 'brick') {
          return {
            type: 'brick',
            object: child.object.save(),
            transform: child.transform || null,
          };
        }
        return {
          type: 'model',
          object: serializeModel(child.object),
          transform: child.transform || null,
        };
      }),
    });
    let objectToSave = {
      version: FILE_VERSION_CURRENT,
      worldModel: serializeModel(this.worldModel),
    };
    let json = JSON.stringify(objectToSave);
    //let json = new Blob([JSON.stringify(simplified)];
    window.localStorage.setItem('world', json);
  }

  render() {
    // React function to generate the HTML object containing the scene
    const { isShiftDown, isRDown } = this.state;
    const { mode, shifted } = this.props;
    return (
      <div>
        <div
          className={shifted ? styles.shifted : styles.scene}
          ref={(mount) => {
            this.mount = mount;
          }}
        />
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
