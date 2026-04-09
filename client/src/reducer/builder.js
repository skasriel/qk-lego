import * as BuilderActions from '../actions/builder';

import { ColorCollections, Modes } from '../util';

const initialState = {
  mode: Modes.Build,
  color: ColorCollections.getDefaultColor(), //.Solid[0],
  colorType: ColorCollections.getDefaultColorType(),
  brickID: '3001', // Default to 2x4 brick
};

export default function builder(state = initialState, action) {
  switch (action.type) {
    case BuilderActions.SET_MODE: {
      const { mode } = action.payload;
      return {
        ...state,
        mode,
      };
    }
    case BuilderActions.SET_COLOR: {
      const { color, colorType } = action.payload;
      return {
        ...state,
        color,
        colorType,
      };
    }
    case BuilderActions.SET_BRICK: {
      const { brickID } = action.payload;
      return {
        ...state,
        brickID,
      };
    }
    default: {
      return state;
    }
  }
}
