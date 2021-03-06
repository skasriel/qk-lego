export const SET_MODE = 'SET_MODE';
export function setMode(mode) {
  return {
    type: SET_MODE,
    payload: {
      mode,
    },
  };
}


export const SET_COLOR = 'SET_COLOR';
export function setColor(color, colorType) {
  console.log(`actions.setColor ${color} ${colorType}`);
  return {
    type: SET_COLOR,
    payload: {
      color, colorType
    },
  };
}


export const SET_BRICK = 'SET_BRICK';
export function setBrick(brickID) {
  console.log("Scene > addBrick "+brickID);
  return {
    type: SET_BRICK,
    payload: {
      brickID,
    },
  };
}
