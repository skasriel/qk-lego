export const multX = 100.0;
export const multY = 33.3;
export const multZ = 100.0;

/*
export const brickTemplateIDs = [
  99, 3004, 3005, 3065, 2357, 3622, 3010, 3066, 3009, 3067, 3008, 6111, 6112,
  3003, 3002, 3001, 44237, 3006,
];*/

export class BrickCollections {

  static collections = {
    "Bricks": [
      3005, 3004, 3065, 3622, 3010, 3066, 3009, 3067, 3008, 6111, 6112, /*2465,*/ 2357,
      3003, 3002, 3001, 44237, /*3007,*/ 3006, /*44042*, 6212, 30400, 43802, 4204, */
      14716, 22886, 49311, 30144, 6213, 2453, 2454, 46212, 3755, 3754
    ],
    "Animals": [
      13392
    ],/*
    "Doors & Windows" : [
      '60592', '86209', '4035', '60594', 6154, 4131
    ],
    "Transportation - Aviation": [
      2421, 46667, 4591, 60208, 43121
    ],*/
  };

  static getAllBricks() {
    let bricks = [];
    for (let i in BrickCollections.collections) {
      bricks.push(...BrickCollections.collections[i]);
    }
    return bricks;
  }

  static getNumberOfBricks() {
    let bricks = BrickCollections.getAllBricks();
    return bricks.length;
  }
};

/*export const colorsSolid = [
  0xF4F4F4,
];*/

export const colors =
  /*Solid: */['#FF0000', '#FF9800', '#F0E100', '#00DE00', '#A1BC24', '#0011CF', '#FFFFFF', '#000000', '#652A0C' ];


export function getMeasurementsFromDimensions({ x, y, z }) {
  if (y==0) {
    console.log("Calling getMeasurementsFromDimensions with y=0 :(");
  }
  return { width: multX * x, height: multY * y || (multY * 2.0) / 1.5, depth: multZ * z };

  //return { width: base * x, height: base * y / 3 || (base * 2.0 / 3.0) / 1.5, depth: base * z };
}
