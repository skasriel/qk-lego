import React from 'react';
import { connect } from 'react-redux';

import {
  getMode,
  getColor,
  getBrickID,
  getAreUtilsOpen,
  getBricks,
} from '../selectors';
import {
  setMode,
  setColor,
  toggleGrid,
  setBrick,
  toggleUtils,
  addBrick,
  removeBrick,
  updateBrick,
  resetScene,
  setScene,
} from '../actions';
import Scene from '../engine/Scene';
import Topbar from './Topbar';
import Bottombar from './Bottombar';
import Sidebar from './Sidebar';

//import styles from '../styles/builder.css';
let styles = {};
styles.builder = {
  color: '#000000',
}


class Builder extends React.Component {
  render() {
    const {
      mode,
      setMode,
      color,
      setColor,
      toggleGrid,
      brickID,
      setBrick,
      utilsOpen,
      toggleUtils,
      removeBrick,
      addBrick,
      bricks,
      updateBrick,
      resetScene,
      setScene
    } = this.props;
    return (
      <div style={styles.builder}>
        <Topbar
          onClickSetMode={setMode}
          onClickSetColor={setColor}
          onClickToggleGrid={toggleGrid}
          mode={mode}
          color={color}
          brickID={brickID}
          onClickSetBrick={setBrick}
          utilsOpen={utilsOpen}
          onClickToggleUtils={toggleUtils}>
          <Sidebar utilsOpen={utilsOpen} resetScene={resetScene} bricks={bricks} importScene={setScene} />
        </Topbar>

        <Scene
          brickColor={color}
          bricks={bricks}
          mode={mode}
          brickID={brickID}
          removeObject={removeBrick}
          addObject={addBrick}
          updateObject={updateBrick} />

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
  brickID: getBrickID(state),
  utilsOpen: getAreUtilsOpen(state),
  bricks: getBricks(state),
});


const mapDispatchToProps = {
  setMode,
  setColor,
  toggleGrid,
  setBrick,
  toggleUtils,
  removeBrick,
  addBrick,
  updateBrick,
  resetScene,
  setScene,
};

export default connect(mapStateToProps, mapDispatchToProps)(Builder);
