import * as BuilderActions from '../actions/builder';

import { colors, BrickCollections } from '../util';


const initialState = {
  mode: 'build',
  color: colors[0], //.Solid[0],
  brickID: BrickCollections.collections['Bricks'][0],
};


export default function builder(state=initialState, action) {
  switch (action.type) {
    case BuilderActions.SET_MODE: {
      const { mode } = action.payload;
      return {
        ...state,
        mode,
      };
    }
    case BuilderActions.SET_COLOR: {
      const { color } = action.payload;
      return {
        ...state,
        color,
      };
    }
    case BuilderActions.TOGGLE_GRID: {
      const { grid } = state;
      return {
        ...state,
        grid: !grid,
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
