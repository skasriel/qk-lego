const express = require('express');
const app = express();
const http = require('http');

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
}

const fs = require('fs');
const worldFileName = '../world.json';
function loadWorldFromDisk() {
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
const server = http.createServer(app);
server.listen(5000);

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
