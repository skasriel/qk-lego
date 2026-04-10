// LDraw Units (LDU) - native coordinate system
// 1 stud = 20 LDU, 1 brick height = 24 LDU
export const LDU_STUD_WIDTH = 20;
export const LDU_STUD_DEPTH = 20;
export const LDU_BRICK_HEIGHT = 24;
export const LDU_PLATE_HEIGHT = 8; // 1/3 brick

// For backward compatibility with existing code that uses multX/Y/Z
export const multX = LDU_STUD_WIDTH;
export const multY = LDU_BRICK_HEIGHT;
export const multZ = LDU_STUD_DEPTH;
export const STUD_HEIGHT_OVERLAP = 4; // stud nests 4 LDU into brick above

// Knob nesting - how far studs go into bricks above
export const KNOB_NESTING = 4; // LDU

// LDraw color codes mapping to hex colors
export const LDRAW_COLORS = {
  0: '#05131D',
  1: '#0055BF',
  2: '#257A3E',
  3: '#C91A09',
  4: '#C870A0',
  5: '#583927',
  6: '#9BA19D',
  7: '#6D6E5C',
  8: '#B4D2E3',
  9: '#4B9F4A',
  10: '#00838F',
  11: '#C91A09',
  12: '#583927',
  13: '#9BA19D',
  14: '#6D6E5C',
  15: '#FFFFFF',
};

// Color collections for UI
export class ColorCollections {
  static colorTypes = {
    Solid: 'solid',
    Transparent: 'transparent',
    Metallic: 'metallic',
  };

  static SolidColors = [
    '#05131D', '#0055BF', '#257A3E', '#00838F', '#C91A09',
    '#C870A0', '#583927', '#9BA19D', '#6D6E5C', '#B4D2E3',
    '#4B9F4A', '#55A5AF', '#F2705E', '#FC97AC', '#F2CD37',
    '#FFFFFF', '#C2DAB8', '#FBE696', '#E4CD9E', '#C9CAE2',
    '#81007B', '#2032B0', '#FE8A18', '#923978', '#BBE90B',
    '#958A73', '#E4ADC8', '#AC78BA', '#E1D5ED', '#F3CF9B',
    '#CD6298', '#582A12', '#A0A5A9', '#6C6E68', '#5C9DD1',
    '#73DCA1', '#FECCCF', '#F6D7B3', '#CC702A', '#3F3691',
    '#7C503A', '#4C61DB', '#D09168', '#FEBABD', '#4354A3',
    '#6874CA', '#C7D23C', '#B3D7D1', '#D9E4A7', '#F9BA61',
    '#E6E3E0', '#F8BB3D', '#86C1E1', '#B31004', '#FFF03A',
    '#56BED6', '#0D325B', '#184632', '#352100', '#54A9C8',
    '#720E0F', '#1498D7', '#3EC2DD', '#BDDCD8', '#DFEEA5',
    '#9B9A5A', '#D67572', '#F785B1', '#FA9C1C', '#845E84',
    '#A0BCAC', '#597184', '#B67B50', '#FFA70B', '#A95500',
    '#E6E3DA', '#8E5597', '#FF94C2', '#564E9D', '#AD6140',
  ];

  static TransparentColors = [
    '#FCFCFC', '#635F52', '#C91A09', '#FF800D', '#F08F1C',
    '#DAB000', '#F5CD2F', '#C0FF00', '#56E646', '#237841',
    '#0020A0', '#559AB7', '#AEE9EF', '#C1DFF0', '#96709F',
    '#A5A5CB', '#DF6695', '#FC97AC', '#7DC291', '#FBE890',
    '#6BABE4', '#FCB76D', '#C281A5',
  ];

  static MetallicColors = [
    '#767676', '#6A7944', '#DBAC34', '#0A1327',
    '#6D6E5C', '#C27F53', '#D60026', '#008E3C',
  ];

  static Colors = {
    Solid: ColorCollections.SolidColors,
    Transparent: ColorCollections.TransparentColors,
    Metallic: ColorCollections.MetallicColors,
  };

  static getDefaultColor() {
    return ColorCollections.SolidColors[0];
  }

  static getDefaultColorType() {
    return ColorCollections.colorTypes.Solid;
  }
}

// Action types for WebSocket communication
export class Action {
  static Create = 'Create';
  static Delete = 'Delete';
  static Move = 'Move';
  static Clone = 'Clone';
  static Reload = 'Reload';

  constructor(type, worldHash) {
    this.type = type;
    this.worldHash = worldHash;
  }

  createBrick(brick) {
    this.brick = brick.save();
  }

  moveBrick(brick) {
    this.brick = brick.save();
  }

  deleteBrick(brick) {
    this.uuid = brick._uuid;
  }
}

// Utility functions
export function _toStringVector3D(v) {
  return `Vector3D [${Math.round(v.x)} ${Math.round(v.y)} ${Math.round(v.z)}]`;
}

export function _toStringBox3(b) {
  return `Box3 [${Math.round(b.min.x)}, ${Math.round(b.min.y)}, ${Math.round(b.min.z)}] -> [${Math.round(b.max.x)}, ${Math.round(b.max.y)}, ${Math.round(b.max.z)}]`;
}