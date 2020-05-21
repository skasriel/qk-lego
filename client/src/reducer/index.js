import { combineReducers } from 'redux';

import builder from './builder';
import scene from './scene';


export default combineReducers({
  builder,
  scene,
});
