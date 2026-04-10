const express = require('express');
const path = require('path');
const app = express();
const http = require('http');
const { parseMPD, modelToMPD } = require('./mpd-utils');

// Enable JSON parsing for POST requests
app.use(express.json());

// Serve LDraw library files - with path normalization
app.use('/ldraw', (req, res, next) => {
  // Convert backslashes to forward slashes in URL
  req.url = req.url.replace(/\\/g, '/');
  // Fix double 'parts/parts/' path issue from LDrawLoader
  req.url = req.url.replace(/\/parts\/parts\//g, '/parts/');
  // Fix 'p/parts/' path issue from LDrawLoader
  req.url = req.url.replace(/\/p\/parts\//g, '/parts/');
  // Fix 'models/parts/' path issue from LDrawLoader  
  req.url = req.url.replace(/\/models\/parts\//g, '/parts/');
  next();
}, express.static(path.join(__dirname, 'ldraw')), (req, res, next) => {
  // Fallback: try alternative locations for LDraw files
  // LDraw files can be in /parts/, /p/, /parts/s/, /p/48/, etc.
  const fs = require('fs');
  const originalUrl = req.url;
  
  const tryPaths = [];
  
  if (originalUrl.startsWith('/parts/')) {
    const filename = originalUrl.substring('/parts/'.length);
    // Try /p/ (primitives)
    tryPaths.push(`/p/${filename}`);
    // Try /parts/s/ (subfiles)
    tryPaths.push(`/parts/s/${filename}`);
    // If in a subdirectory like /parts/s/, also try /p/
    if (filename.includes('/')) {
      const basename = filename.split('/').pop();
      tryPaths.push(`/p/${basename}`);
      tryPaths.push(`/parts/s/${basename}`);
    }
  }
  
  for (const tryPath of tryPaths) {
    const fullPath = path.join(__dirname, 'ldraw', tryPath);
    if (fs.existsSync(fullPath)) {
      console.log(`LDraw fallback: ${originalUrl} -> ${tryPath}`);
      return res.sendFile(fullPath);
    }
  }
  
  next();
});

// Serve the React client build
app.use(express.static(path.join(__dirname, '..', 'client', 'build')));

/*const Datastore = require('nedb');
const db = {};
db.world = new Datastore({
  filename: '../world.db',
  autoload: true,
  timestampData: true,
  corruptAlertThreshold: 0,
});*/

const FILE_VERSION_CURRENT = 1.4;
let worldModel = { type: 'model', name: 'Current World', children: [] };

class Action {
  static Create = 'Create';
  static Delete = 'Delete';
  static Move = 'Move';
  static Clone = 'Clone';
  static Reload = 'Reload';
  static Reset = 'Reset';
}

const fs = require('fs');
const dataDir = process.env.PLATFORM_APP_DIR ? path.join(process.env.PLATFORM_APP_DIR, 'data') : path.join(__dirname, '..');
const worldFileName = path.join(dataDir, 'world.mpd');
const scenesDir = path.join(dataDir, 'scenes');

// Ensure scenes directory exists
if (!fs.existsSync(scenesDir)) {
  fs.mkdirSync(scenesDir, { recursive: true });
}
function loadWorldFromDisk() {
  const mpdWorldFile = worldFileName.replace('.json', '.mpd');
  if (!fs.existsSync(mpdWorldFile)) {
    // Try legacy JSON format
    if (!fs.existsSync(worldFileName)) {
      console.log(`File ${worldFileName} not found -> starting from empty world`);
      return;
    }
    console.log(`Loading legacy JSON world from ${worldFileName}`);
    let worldText = fs.readFileSync(worldFileName, 'utf8');
    if (worldText.length == 0) {
      console.log(`Empty file ${worldFileName} -> starting from empty world`);
      return;
    }
    let worldObject = JSON.parse(worldText);
    if (worldObject.version != FILE_VERSION_CURRENT) {
      console.log(`Incorrect file version ${worldObject.version}, expected ${FILE_VERSION_CURRENT}`);
      return;
    }
    worldModel = sceneDataToModel(worldObject.worldModel || worldObject.world || []);
    return;
  }
  
  // Load MPD format
  console.log(`Loading MPD world from ${mpdWorldFile}`);
  const mpdContent = fs.readFileSync(mpdWorldFile, 'utf8');
  worldModel = parseMPD(mpdContent, mpdWorldFile);
}
loadWorldFromDisk();

function persistWorld() {
  let response = {
    version: FILE_VERSION_CURRENT,
    worldModel: worldModel,
  };
  return response;
}
function saveWorldToDisk() { // TODO: use async version of writeFile
  modelToMPD(worldModel, worldFileName.replace('.json', '.mpd'));
}

app.use(function (req, res, next) { // TODO: either do something here or delete
  console.log(`request: ${req}`);
  req.testing = 'testing';
  return next();
});

/**
 * Send entire scene to client - presumably a client that just connected to this server
 */
app.get('/api/get-scene', function(req, res) {
  console.log(`Sending scene to client because they requested it`);
  let response = persistWorld();
  const worldHash = getWorldSignature();
  response.worldHash = worldHash;
  res.send(response);
  res.end();
});

/**
 * Reset scene - clear all bricks
 */
app.post('/api/reset', function(req, res) {
  worldModel = { type: 'model', name: 'Current World', children: [] };
  saveWorldToDisk();
  console.log('Reset scene via API - cleared all bricks');
  
  // Broadcast reset to all connected clients
  const resetAction = {
    type: Action.Reset,
    worldHash: getWorldSignature(),
  };
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(resetAction));
    }
  });
  
  res.json({ success: true });
});

/**
 * Save current scene with a name
 */
app.post('/api/scenes/save', function(req, res) {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Scene name is required' });
  }
  
  // Sanitize filename
  const safeNameSave = name.trim().replace(/[^a-z0-9_\-\.]/gi, '_').substring(0, 100);
  const sceneFile = path.join(scenesDir, `${safeNameSave}.mpd`);
  
  try {
    modelToMPD(worldModel, sceneFile);
    res.json({ success: true, name: name, path: safeNameSave });
  } catch (err) {
    console.error(`Failed to save scene: ${err}`);
    res.status(500).json({ error: 'Failed to save scene' });
  }
});

/**
 * List all saved scenes
 */
app.get('/api/scenes/list', function(req, res) {
  try {
    const scenes = [];
    
    // Add user-saved scenes
    if (fs.existsSync(scenesDir)) {
      const files = fs.readdirSync(scenesDir);
      files
        .filter(f => f.endsWith('.mpd') || f.endsWith('.json'))
        .forEach(f => {
          const filePath = path.join(scenesDir, f);
          const isMPD = f.endsWith('.mpd');
          const stats = fs.statSync(filePath);
          
          if (isMPD) {
            // For MPD files, count line type 1 references
            const content = fs.readFileSync(filePath, 'utf8');
            const brickCount = (content.match(/^1\s+/gm) || []).length;
            const name = f.replace('.mpd', '');
            scenes.push({
              name: name,
              filename: f.replace('.mpd', ''),
              savedAt: stats.mtime.toISOString(),
              numberBricks: brickCount,
              type: 'user',
            });
          } else {
            // Legacy JSON format
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            scenes.push({
              name: data.name || f.replace('.json', ''),
              filename: f.replace('.json', ''),
              savedAt: data.savedAt,
              numberBricks: data.numberBricks || 0,
              type: 'user',
            });
          }
        });
    }
    
    // Add pre-loaded models from server/models
    const modelsDir = path.join(__dirname, 'models');
    if (fs.existsSync(modelsDir)) {
      const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.mpd'));
      modelFiles.forEach(f => {
        const filePath = path.join(modelsDir, f);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const brickCount = (content.match(/^1\s+/gm) || []).length;
        
        // Extract name from MPD file (look for Name: line or use filename)
        const nameMatch = content.match(/^0\s+Name:\s*(.+?)$/m);
        let displayName = f.replace('.mpd', '');
        if (nameMatch) {
          displayName = nameMatch[1].trim();
        } else {
          // Try to extract from first comment line
          const firstLine = content.split('\n').find(l => l.startsWith('0 ') && !l.startsWith('0 FILE'));
          if (firstLine) {
            displayName = firstLine.replace(/^0\s+/, '').trim();
          }
        }
        
        scenes.push({
          name: displayName,
          filename: f.replace('.mpd', ''),
          savedAt: stats.mtime.toISOString(),
          numberBricks: brickCount,
          type: 'builtin',
          id: f.replace('.mpd', ''),
        });
      });
    }
    
    // Sort by type (builtin first), then by date
    scenes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'builtin' ? -1 : 1;
      }
      return new Date(b.savedAt) - new Date(a.savedAt);
    });
    
    res.json({ scenes });
  } catch (err) {
    console.error(`Failed to list scenes: ${err}`);
    res.status(500).json({ error: 'Failed to list scenes' });
  }
});

/**
 * Load a saved scene by name
 */
app.get('/api/scenes/load/:name', function(req, res) {
  const { name } = req.params;
  const safeName = name.replace(/[^a-z0-9_\-\.]/gi, '_');

  const candidates = [
    { file: path.join(scenesDir, `${name}.mpd`), isMPD: true },
    { file: path.join(scenesDir, `${safeName}.mpd`), isMPD: true },
    { file: path.join(scenesDir, `${name}.json`), isMPD: false },
    { file: path.join(scenesDir, `${safeName}.json`), isMPD: false },
    { file: path.join(__dirname, 'models', `${name}.mpd`), isMPD: true },
    { file: path.join(__dirname, 'models', `${safeName}.mpd`), isMPD: true },
    { file: path.join(__dirname, 'models', `${name}.ldr`), isMPD: true },
    { file: path.join(__dirname, 'models', `${safeName}.ldr`), isMPD: true },
  ];

  const match = candidates.find(({ file }) => fs.existsSync(file));

  if (!match) {
    return res.status(404).json({ error: 'Scene not found' });
  }

  const sceneFile = match.file;
  const isMPD = match.isMPD;
  
  try {
    console.log(`Loading scene: name="${name}", file="${sceneFile}", isMPD=${isMPD}`);
    if (isMPD) {
      // Load MPD file
      const mpdContent = fs.readFileSync(sceneFile, 'utf8');
      worldModel = parseMPD(mpdContent, sceneFile);
      saveWorldToDisk();
      
      console.log(`Loaded MPD scene "${name}"`);
      res.json({ 
        success: true, 
        name: name,
        worldModel: worldModel,
        worldHash: getWorldSignature()
      });
    } else {
      // Legacy JSON format
      const sceneData = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
      if (sceneData.version !== FILE_VERSION_CURRENT) {
        return res.status(400).json({ error: 'Incompatible scene version' });
      }
      
      // Load into current world
      worldModel = sceneDataToModel(sceneData.worldModel || sceneData.world || [] , sceneData.name || name);
      saveWorldToDisk();
      
      console.log(`Loaded scene "${sceneData.name || name}"`);
      res.json({ 
        success: true, 
        name: sceneData.name,
        worldModel: worldModel,
        worldHash: getWorldSignature()
      });
    }
  } catch (err) {
    console.error(`Failed to load scene: ${err}`);
    res.status(500).json({ error: 'Failed to load scene' });
  }
});

/**
 * Delete a saved scene
 */
app.delete('/api/scenes/:name', function(req, res) {
  const { name } = req.params;
  const safeName = name.replace(/[^a-z0-9_\-\.]/gi, '_');
  const sceneFile = path.join(scenesDir, `${safeName}.mpd`);

  if (!fs.existsSync(sceneFile)) {
    return res.status(404).json({ error: 'Scene not found' });
  }
  
  try {
    const filesToDelete = Array.from(collectSubmodelFiles(sceneFile));
    filesToDelete.forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
    console.log(`Deleted scene "${name}"`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete scene: ${err}`);
    res.status(500).json({ error: 'Failed to delete scene' });
  }
});
// Serve React app for any non-API, non-file routes (SPA fallback)
app.get('*', (req, res) => {
  // Don't serve index.html for requests that look like file paths (models, assets, etc.)
  if (path.extname(req.path)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
});

const port = process.env.PORT || 5001;
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

const WebSocket = require('ws');
const wss = new WebSocket.Server({ server, path: '/ws-api'});

function createAndAddBrickFromObject(brick) {
  // Add brick to world model
  if (!worldModel.children) worldModel.children = [];
  worldModel.children.push({
    type: 'brick',
    object: brick,
    transform: {
      position: brick.position,
      rotationMatrix: brick.rotationMatrix || [1, 0, 0, 0, 1, 0, 0, 0, 1],
    },
  });
  const count = countBricksInModel(worldModel);
  console.log(`Scene now contains ${count} bricks after adding ${brick}`);
  return brick;
}

function countBricksInModel(model) {
  if (!model || !model.children) return 0;
  let count = 0;
  for (const child of model.children) {
    if (child.type === 'brick') count++;
    else if (child.type === 'model') count += countBricksInModel(child.object || child);
  }
  return count;
}

function findBrickInModel(model, uuid) {
  if (!model || !model.children) return null;
  for (const child of model.children) {
    if (child.type === 'brick' && child.object?.uuid === uuid) {
      return child.object;
    }
    if (child.type === 'model') {
      const found = findBrickInModel(child.object || child, uuid);
      if (found) return found;
    }
  }
  return null;
}

function removeBrickFromModel(model, uuid) {
  if (!model || !model.children) return false;
  let removed = false;
  model.children = model.children.filter((child) => {
    if (child.type === 'brick' && child.object?.uuid === uuid) {
      removed = true;
      return false;
    }
    if (child.type === 'model') {
      const childModel = child.object || child;
      if (removeBrickFromModel(childModel, uuid)) removed = true;
    }
    return true;
  });
  return removed;
}

function composeTransform(parentTransform, childTransform) {
  const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const pRot = parentTransform?.rotationMatrix || identity;
  const pPos = parentTransform?.position || { x: 0, y: 0, z: 0 };
  const cRot = childTransform?.rotationMatrix || identity;
  const cPos = childTransform?.position || { x: 0, y: 0, z: 0 };

  const rot = [
    pRot[0] * cRot[0] + pRot[1] * cRot[3] + pRot[2] * cRot[6],
    pRot[0] * cRot[1] + pRot[1] * cRot[4] + pRot[2] * cRot[7],
    pRot[0] * cRot[2] + pRot[1] * cRot[5] + pRot[2] * cRot[8],
    pRot[3] * cRot[0] + pRot[4] * cRot[3] + pRot[5] * cRot[6],
    pRot[3] * cRot[1] + pRot[4] * cRot[4] + pRot[5] * cRot[7],
    pRot[3] * cRot[2] + pRot[4] * cRot[5] + pRot[5] * cRot[8],
    pRot[6] * cRot[0] + pRot[7] * cRot[3] + pRot[8] * cRot[6],
    pRot[6] * cRot[1] + pRot[7] * cRot[4] + pRot[8] * cRot[7],
    pRot[6] * cRot[2] + pRot[7] * cRot[5] + pRot[8] * cRot[8],
  ];

  const pos = {
    x: pRot[0] * cPos.x + pRot[1] * cPos.y + pRot[2] * cPos.z + pPos.x,
    y: pRot[3] * cPos.x + pRot[4] * cPos.y + pRot[5] * cPos.z + pPos.y,
    z: pRot[6] * cPos.x + pRot[7] * cPos.y + pRot[8] * cPos.z + pPos.z,
  };

  return { position: pos, rotationMatrix: rot };
}

function normalizeNodeForHash(node, parentTransform = null) {
  if (!node) return null;
  const identityTransform = {
    position: { x: 0, y: 0, z: 0 },
    rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  };
  if (node.type === 'brick') {
    const brick = node.object || node;
    const transform = composeTransform(parentTransform, node.transform || {
      position: brick.position,
      rotationMatrix: brick.rotationMatrix,
    });
    const pos = transform.position || brick.position || { x: 0, y: 0, z: 0 };
    return {
      type: 'brick',
      uuid: brick.uuid,
      brickID: brick.brickID,
      color: brick.color,
      colorType: brick.colorType,
      position: {
        x: Math.round(pos.x * 1000) / 1000,
        y: Math.round(pos.y * 1000) / 1000,
        z: Math.round(pos.z * 1000) / 1000,
      },
      rotationMatrix: transform.rotationMatrix || brick.rotationMatrix || [1, 0, 0, 0, 1, 0, 0, 0, 1],
    };
  }
  const childModel = node.object || node;
  const modelTransform = node.type === 'model' && node.object ? composeTransform(parentTransform, node.transform || identityTransform) : parentTransform;
  return {
    type: 'model',
    name: childModel.name,
    children: (childModel.children || []).map((child) => normalizeNodeForHash(child, modelTransform)),
  };
}

function sceneDataToModel(data, fallbackName = 'Current World') {
  if (Array.isArray(data)) {
    return {
      type: 'model',
      name: fallbackName,
      children: data.map((brick) => ({
        type: 'brick',
        object: brick,
        transform: {
          position: brick.position,
          rotationMatrix: brick.rotationMatrix || [1, 0, 0, 0, 1, 0, 0, 0, 1],
        },
      })),
    };
  }
  if (!data) {
    return { type: 'model', name: fallbackName, children: [] };
  }
  if (data.type === 'model') {
    return {
      type: 'model',
      name: data.name || fallbackName,
      children: (data.children || []).map((child) => {
        if (child.type === 'brick') {
          const brick = child.object || child;
          return {
            type: 'brick',
            object: brick,
            transform: child.transform || {
              position: brick.position,
              rotationMatrix: brick.rotationMatrix || [1, 0, 0, 0, 1, 0, 0, 0, 1],
            },
          };
        }
        if (child.type === 'model') {
          const model = child.object || child;
          return {
            type: 'model',
            object: sceneDataToModel(model, model.name || fallbackName),
            transform: child.transform || {
              position: { x: 0, y: 0, z: 0 },
              rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            },
          };
        }
        return child;
      }),
    };
  }
  return { type: 'model', name: fallbackName, children: [] };
}

function collectSubmodelFiles(filePath, seen = new Set()) {
  if (!fs.existsSync(filePath) || seen.has(filePath)) return seen;
  seen.add(filePath);
  const dir = path.dirname(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('1 ')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 15) continue;
    const ref = parts.slice(14).join(' ');
    if (/\.(mpd|ldr)$/i.test(ref)) {
      collectSubmodelFiles(path.join(dir, ref), seen);
    }
  }
  return seen;
}

function getWorldSignature() {
  const text = JSON.stringify(normalizeNodeForHash(worldModel));
  var hash = 0; // simple implementation of Java's String.hashCode();
  for (var i = 0; i < text.length; i++) {
    var char = text.charCodeAt(i);
    hash = ((hash<<5)-hash)+char;
    hash = hash & hash; // Convert to 32bit integer
  }
  console.log(`Signature is ${hash} based on ${text}`);
  return hash;
}


wss.on('connection', function connection(ws) {
  ws.isAlive = true;
  ws.on('pong', heartbeat); // respond to client heartbeat requests

  ws.on('message', function incoming(message) { // received a new message from a client
    console.log(`received: ${message}`);
    // TODO: log all received actions persistently for debug or undo / replay purposes
    try {
      const action = JSON.parse(message);
      const worldHash = getWorldSignature();
      if (action.worldHash != worldHash) {
        console.warn(
          `Warning: client is out-of-sync: their hash ${action.worldHash} != ours ${worldHash}. Continuing without forced reload.`
        );
      }
      switch (action.type) {
        case Action.Create:
          let brick = createAndAddBrickFromObject(action.brick);
          saveWorldToDisk();
          console.log("Added new brick because client asked us to "+JSON.stringify(brick));
          break;
        case Action.Delete:
          const brickToDelete = action.uuid;
          const numBricks = countBricksInModel(worldModel);
          removeBrickFromModel(worldModel, brickToDelete);
          saveWorldToDisk();
          const newCount = countBricksInModel(worldModel);
          console.log(`Deleted brick ${JSON.stringify(brickToDelete)} because client asked us to. # bricks was ${numBricks} and now ${newCount}`);
          break;
        case Action.Move:
          const brickID = action.brick.uuid;
          let brickToMove = findBrickInModel(worldModel, brickID);
          console.log(`Moved brick ${brickID} from ${_toStringVector3D(brickToMove.position)} to ${_toStringVector3D(action.brick.position)}`);
          brickToMove.position.x = action.brick.position.x;
          brickToMove.position.y = action.brick.position.y;
          brickToMove.position.z = action.brick.position.z;
          break;
        case Action.Reset:
          worldModel = { type: 'model', name: 'Current World', children: [] };
          saveWorldToDisk();
          console.log("Reset scene - cleared all bricks");
          break;
        default:
          console.log("Action type not supported yet: "+action.type);
          break;
      }
      wss.clients.forEach(function each(client) { // Broadcast (except to sender)
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          console.log(`Send message to client ${client}`);
          client.send(message);
        }
      });
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
      console.error('Message was:', message);
      // Don't crash the server, just log and continue
    }
  });
  //ws.send('something');
});

// Send keepalive heartbeat. See: https://www.npmjs.com/package/ws
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping(noop);
  });
}, 1000);
function noop() {
  // noop
}
function heartbeat() {
  this.isAlive = true;
}

wss.on('close', function close() {
  clearInterval(interval);
});

function _toStringVector3D(v) {
  return (`Vector3D [${Math.round(v.x)} ${Math.round(v.y)} ${Math.round(v.z)}]` );
}
