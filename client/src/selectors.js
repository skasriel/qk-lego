export function getMode(state) {
  return state.builder.mode;
}

export function getColor(state) {
  return state.builder.color;
}
export function getColorType(state) {
  return state.builder.colorType;
}

export function getBrickID(state) {
  return state.builder.brickID;
}

export function getBricks(state) {
  return state.scene.bricks;
}

export function getAreUtilsOpen(state) {
  return state.ui.utilsOpen;
}
