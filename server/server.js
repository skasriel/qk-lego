const express = require('express');
const path = require('path');
const app = express();
const http = require('http');

// Enable JSON parsing for POST requests
app.use(express.json());

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
let bricks = []; // TODO: persist bricks to a database

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
const worldFileName = path.join(dataDir, 'world.json');
const scenesDir = path.join(dataDir, 'scenes');

// Ensure scenes directory exists
if (!fs.existsSync(scenesDir)) {
  fs.mkdirSync(scenesDir, { recursive: true });
}
function loadWorldFromDisk() {
  if (!fs.existsSync(worldFileName)) {
    console.log(`File ${worldFileName} not found -> starting from empty world`);
    return;
  }
  let worldText = fs.readFileSync(worldFileName, 'utf8');
  if (worldText.length==0) {
    console.log(`Empty file ${worldFileName} -> starting from empty world`);
    return;
  }
  let worldObject = JSON.parse(worldText);
  if (worldObject.version != FILE_VERSION_CURRENT) {
    console.log(`Incorrect file version ${worldObject.version}, expected ${FILE_VERSION_CURRENT}`);
    return;
  }
  let hash = worldObject.hash;
  bricks = worldObject.world;
}
loadWorldFromDisk();

function persistWorld() {
  let response = {
    version: FILE_VERSION_CURRENT,
    numberBricks: bricks.length,
    world: bricks,
  };
  return response;
}
function saveWorldToDisk() { // TODO: use async version of writeFile
  const object = persistWorld();
  const json = JSON.stringify(object, null, 2); // pretty-print to file
  fs.writeFileSync(worldFileName, json);
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
  bricks = [];
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
  const safeName = name.trim().replace(/[^a-z0-9_\-\.]/gi, '_').substring(0, 100);
  const sceneFile = path.join(scenesDir, `${safeName}.json`);
  
  const sceneData = {
    version: FILE_VERSION_CURRENT,
    name: name,
    savedAt: new Date().toISOString(),
    numberBricks: bricks.length,
    world: bricks,
  };
  
  try {
    fs.writeFileSync(sceneFile, JSON.stringify(sceneData, null, 2));
    console.log(`Saved scene "${name}" to ${sceneFile}`);
    res.json({ success: true, name: name, path: safeName });
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
    const files = fs.readdirSync(scenesDir);
    const scenes = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(scenesDir, f);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          name: data.name || f.replace('.json', ''),
          filename: f.replace('.json', ''),
          savedAt: data.savedAt,
          numberBricks: data.numberBricks || 0,
        };
      })
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    
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
  const sceneFile = path.join(scenesDir, `${safeName}.json`);
  
  if (!fs.existsSync(sceneFile)) {
    return res.status(404).json({ error: 'Scene not found' });
  }
  
  try {
    const sceneData = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
    if (sceneData.version !== FILE_VERSION_CURRENT) {
      return res.status(400).json({ error: 'Incompatible scene version' });
    }
    
    // Load into current world
    bricks = sceneData.world || [];
    saveWorldToDisk();
    
    console.log(`Loaded scene "${sceneData.name}" with ${bricks.length} bricks`);
    res.json({ 
      success: true, 
      name: sceneData.name,
      world: bricks,
      worldHash: getWorldSignature()
    });
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
  const sceneFile = path.join(scenesDir, `${safeName}.json`);
  
  if (!fs.existsSync(sceneFile)) {
    return res.status(404).json({ error: 'Scene not found' });
  }
  
  try {
    fs.unlinkSync(sceneFile);
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
  bricks.push(brick);
  console.log(`Scene now contains ${bricks.length} bricks after adding ${brick}`);
  return brick;
}

function getWorldSignature() {
  const text = JSON.stringify(bricks);
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
    const action = JSON.parse(message);
    const worldHash = getWorldSignature();
    if (action.worldHash != worldHash) {
      console.log(`Error: client is out-of-sync: their hash ${action.worldHash} != ours ${worldHash} instructing them to reload!`);
      let reload = persistWorld();
      reload.worldHash = worldHash;
      reload.type = Action.Reload;
      let message = JSON.stringify(reload);
      ws.send(message);
      return;
    }
    switch (action.type) {
      case Action.Create:
        let brick = createAndAddBrickFromObject(action.brick);
        saveWorldToDisk();
        console.log("Added new brick because client asked us to "+JSON.stringify(brick));
        break;
      case Action.Delete:
        const brickToDelete = action.uuid;
        const numBricks = bricks.length;
        bricks = bricks.filter(function(brick, index, arr){ return brick.uuid != brickToDelete;});
        saveWorldToDisk();
        console.log(`Deleted brick ${JSON.stringify(brickToDelete)} because client asked us to. # bricks was ${numBricks} and now ${bricks.length}`);
        break;
      case Action.Move:
        const brickID = action.brick.uuid;
        let brickToMove = bricks.find(brick => {return brick.uuid==brickID});
        console.log(`Moved brick ${brickID} from ${_toStringVector3D(brickToMove.position)} to ${_toStringVector3D(action.brick.position)}`);
        brickToMove.position.x = action.brick.position.x;
        brickToMove.position.y = action.brick.position.y;
        brickToMove.position.z = action.brick.position.z;
        break;
      case Action.Reset:
        bricks = [];
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
