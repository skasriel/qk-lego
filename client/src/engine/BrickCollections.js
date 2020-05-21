import {BasicBrick} from './BasicBrick';
import {MPDBrick} from './MPDBrick';

// see https://www.bricklink.com/catalogList.asp?catType=P&catString=130
export class BrickCollections {
  static basicBrick = 'basic';
  static mpdBrick = 'mpd';
  static glbBrick = 'glb';
  static objBrick = 'obj';
  static collections = {
    "Bricks": [
      {type: BrickCollections.basicBrick, id: 3005, width: 1, height: 3, depth: 1},
      {type: BrickCollections.basicBrick, id: 3004, width: 2, height: 3, depth: 1},
      {type: BrickCollections.basicBrick, id: 3622, width: 3, height: 3, depth: 1},
      {type: BrickCollections.basicBrick, id: 3010, width: 4, height: 3, depth: 1},
      {type: BrickCollections.basicBrick, id: 3009, width: 6, height: 3, depth: 1},
      {type: BrickCollections.basicBrick, id: 3008, width: 8, height: 3, depth: 1},
      {type: BrickCollections.basicBrick, id: 6111, width: 10, height: 3, depth: 1},
      {type: BrickCollections.basicBrick, id: 6112, width: 12, height: 3, depth: 1},
      {type: BrickCollections.basicBrick, id: 3003, width: 2, height: 3, depth: 2},
      {type: BrickCollections.basicBrick, id: 3002, width: 3, height: 3, depth: 2},
      {type: BrickCollections.basicBrick, id: 3001, width: 4, height: 3, depth: 2},
      {type: BrickCollections.basicBrick, id: 44237, width: 6, height: 3, depth: 2},
      {type: BrickCollections.basicBrick, id: 3006, width: 10, height: 3, depth: 2},
      {type: BrickCollections.basicBrick, id: 14716, width: 1, height: 8, depth: 1},
      {type: BrickCollections.basicBrick, id: 22886, width: 2, height: 8, depth: 1},
      {type: BrickCollections.basicBrick, id: 49311, width: 4, height: 8, depth: 1},
      {type: BrickCollections.basicBrick, id: 30144, width: 4, height: 8, depth: 2},
      {type: BrickCollections.basicBrick, id: 6213, width: 6, height: 8, depth: 2},
      {type: BrickCollections.basicBrick, id: 2453, width: 1, height: 9, depth: 2},
      {type: BrickCollections.basicBrick, id: 2454, width: 2, height: 9, depth: 2},
      {type: BrickCollections.basicBrick, id: 3755, width: 3, height: 9, depth: 2},
      {type: BrickCollections.basicBrick, id: 3754, width: 6, height: 9, depth: 2},
      {type: BrickCollections.basicBrick, id: 4201, width: 8, height: 3, depth: 8},
      {type: BrickCollections.basicBrick, id: 30072, width: 12, height: 3, depth: 24}
        /*2465,*/ /*2357*/,
      /*3007,*/ /*44042*, 6212, 30400, 43802, 4204, */
    ],
    "Baseplates": [
      {type: BrickCollections.basicBrick, id: 3497, width: 8, height: 1, depth: 24},
      {type: BrickCollections.basicBrick, id: 3867, width: 16, height: 1, depth: 16},
      {type: BrickCollections.basicBrick, id: 3857, width: 16, height: 1, depth: 32},
      {type: BrickCollections.basicBrick, id: 3811, width: 32, height: 1, depth: 32}
    ],
    "Animals": [
      {type: BrickCollections.mpdBrick, id: 13392, description: 'Dolphin'}
    ],
    "Characters": [
      {type: BrickCollections.glbBrick, id:-1, path: '/models/qk_character1.glb'},
      {type: BrickCollections.objBrick, id:-2, mtl: '/models/characters/pirate-obj/pirate.mtl', obj: '/models/characters/pirate-obj/pirate.obj', scale: 4},
      {type: BrickCollections.objBrick, id:-3, mtl: '/models/characters/AnotherOne/lego_obj.mtl', obj: '/models/characters/AnotherOne/lego_obj.obj'},
      {type: BrickCollections.objBrick, id:-4, mtl: '/models/characters/Legoman/LegoMan.mtl', obj: '/models/characters/Legoman/LegoMan.obj', scale: 100},

    ]
    /*
    "Doors & Windows" : [
      '60592', '86209', '4035', '60594', 6154, 4131
    ],
    "Transportation - Aviation": [
      2421, 46667, 4591, 60208, 43121
    ],*/
  };

  static defaultBrick = BrickCollections.collections["Bricks"][0];
  static getAllBricks() {
    let bricks = [];
    for (let i in BrickCollections.collections) {
      bricks.push(...BrickCollections.collections[i]);
    }
    return bricks;
  }

  static getBrickFromID(id) {
    let brickTemplate = BrickCollections.getAllBricks().find(template => {return template.id == id});
    return brickTemplate;
  }

  static getNumberOfBricks() {
    let bricks = BrickCollections.getAllBricks();
    return bricks.length;
  }
};
