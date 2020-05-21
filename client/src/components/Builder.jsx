import React from 'react';
import { connect } from 'react-redux';

import {
  getMode,
  getColor,
  getColorType,
  getBrickID,
} from '../selectors';
import {
  setMode,
  setColor,
  setBrick,
  addBrick,
  removeBrick,
  updateBrick,
  resetScene,
} from '../actions';
import Scene from '../engine/Scene';
import Topbar from './Topbar';
import Bottombar from './Bottombar';
import Sidebar from './Sidebar';
import {Modes} from '../util';

//import styles from '../styles/builder.css';
let styles = {};
styles.builder = {
  color: '#000000',
}

function getCursor(mode) { // TODO: this doesn't work for some reason
  console.log("get cursor for mode "+mode);
  switch(mode) {
    case Modes.Delete: return 'no-drop'; break;
    case Modes.Clone: return 'copy'; break;
    case Modes.Move: return 'move'; break;
    default: return 'default'; break;
  }
}

class Builder extends React.Component {
  render() {
    const {
      mode,
      setMode,
      color,
      colorType,
      setColor,
      brickID,
      setBrick,
      removeBrick,
      addBrick,
      bricks,
      updateBrick,
      resetScene,
    } = this.props;
    return (
      <div style={styles.builder}>
        <Topbar
          onClickSetMode={setMode}
          mode={mode}>
          <Sidebar
            resetScene={resetScene}
            color={color}
            colorType={colorType}
            onClickSetColor={setColor}
            />
        </Topbar>

        <Scene
          setMode={setMode}
          mode={mode}
          brickColor={color}
          colorType={colorType}
          brickID={brickID}
          style={{cursor: getCursor(mode)}}
          />

        <Bottombar
          brickID={brickID}
          onClickSetBrick={setBrick} />
      </div>
    );
  }
}


const mapStateToProps = (state) => ({
  mode: getMode(state),
  color: getColor(state),
  colorType: getColorType(state),
  brickID: getBrickID(state),
});


const mapDispatchToProps = {
  setMode,
  setColor,
  setBrick,
  removeBrick,
  addBrick,
  updateBrick,
  resetScene,
};

export default connect(mapStateToProps, mapDispatchToProps)(Builder);
