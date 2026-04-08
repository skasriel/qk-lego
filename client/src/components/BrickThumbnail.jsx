import React from 'react';
import * as THREE from 'three';
import { LDrawLoader } from 'three/examples/jsm/loaders/LDrawLoader.js';

let sharedRenderer = null;
let sharedScene = null;
let sharedCamera = null;
let lDrawLoader = null;
const modelCache = new Map();

function getSharedRenderer() {
  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    sharedRenderer.setSize(64, 64);
    sharedRenderer.setClearColor(0x000000, 0);

    sharedScene = new THREE.Scene();
    sharedScene.background = null;

    sharedCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    sharedCamera.position.set(30, 40, 50);
    sharedCamera.lookAt(0, 0, 0);

    const light1 = new THREE.DirectionalLight(0xffffff, 0.8);
    light1.position.set(1, 1, 1);
    sharedScene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffffff, 0.4);
    light2.position.set(-1, -1, -1);
    sharedScene.add(light2);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    sharedScene.add(ambient);
  }
  return { renderer: sharedRenderer, scene: sharedScene, camera: sharedCamera };
}

function getLDrawLoader() {
  if (!lDrawLoader) {
    lDrawLoader = new LDrawLoader();
    lDrawLoader.setPath('/ldraw/parts/');
    lDrawLoader.setPartsLibraryPath('/ldraw/');
  }
  return lDrawLoader;
}

export class BrickThumbnail extends React.Component {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.state = { loaded: false, error: false };
  }

  componentDidMount() {
    this.loadModel();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.brickId !== this.props.brickId) {
      this.loadModel();
    }
  }

  loadModel = async () => {
    const { brickId } = this.props;
    const cacheKey = brickId;

    if (modelCache.has(cacheKey)) {
      this.renderModel(modelCache.get(cacheKey));
      return;
    }

    try {
      const loader = getLDrawLoader();
      const group = await new Promise((resolve, reject) => {
        loader.load(`${brickId}.dat`, resolve, null, reject);
      });

      // Center and scale the model
      const box = new THREE.Box3().setFromObject(group);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 40 / maxDim;

      group.position.sub(center);
      group.scale.setScalar(scale);
      // Flip upright and rotate for better view
      group.rotation.x = Math.PI - Math.PI / 6;
      group.rotation.y = Math.PI / 4;

      modelCache.set(cacheKey, group);
      this.renderModel(group);
    } catch (error) {
      console.log(`Could not load 3D preview for ${this.props.brickId}:`, error.message);
      this.setState({ error: true });
    }
  };

  renderModel = (model) => {
    const { renderer, scene, camera } = getSharedRenderer();
    const canvas = this.canvasRef.current;
    if (!canvas) return;

    // Clear scene
    while (scene.children.length > 3) {
      // Keep lights
      scene.remove(scene.children[3]);
    }

    scene.add(model.clone());
    renderer.render(scene, camera);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.drawImage(renderer.domElement, 0, 0, 64, 64);

    this.setState({ loaded: true });
  };

  render() {
    const { brickId, selected } = this.props;
    const { loaded, error } = this.state;

    return (
      <div
        style={{
          width: '64px',
          height: '64px',
          backgroundColor: selected ? '#60a5fa' : '#FFFFFF',
          border: selected ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.2)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={this.canvasRef}
          width={64}
          height={64}
          style={{
            width: '100%',
            height: '100%',
            display: loaded && !error ? 'block' : 'none',
          }}
        />
        {(!loaded || error) && (
          <div
            style={{
              fontSize: '0.65em',
              fontWeight: 'bold',
              color: '#333',
              textAlign: 'center',
              padding: '4px',
              wordBreak: 'break-all',
            }}
          >
            {brickId}
          </div>
        )}
      </div>
    );
  }
}
