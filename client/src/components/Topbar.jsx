import React from 'react';

import Button from './Button';
import ColorPicker from './ColorPicker';
import {Modes} from '../util'

import {ionicons} from 'ionicons';

//import styles from '../styles/topbar.css';

let styles = {};

styles.topbar = {
  position: 'absolute',
  top: 0,
  left: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  width: '100%',
  zIndex: 9,
  background: '#08173D',
  boxShadow: '0px 3px 12px rgba(0, 0, 0, 0.15)',
  transition: 'all 0.15s ease-in-out',
};

styles.section = {
  marginLeft: '30px',
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
}

styles.section.firstChild = {
  marginLeft: 0
}

styles.rightSection = {
  composes: 'section',
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  marginLeft: 'auto',
}
styles.title = {
  color: '#FFFFFF',
  padding: '15px',
  textTransform: 'uppercase',
  fontSize: '1em',
}


const Topbar = ({
  mode,
  onClickSetMode,
  color,
  onClickSetColor,
  children
}) => {
  return (
    <div style={styles.topbar}>
      <div style={styles.section}>
        <div style={styles.title}>
          Mode
        </div>
        <Button
          active={mode === Modes.Build}
          onClick={() => onClickSetMode(Modes.Build)}
          icon="hammer"
          text="Build (b)" />
        <Button
          active={mode === Modes.Paint}
          onClick={() => onClickSetMode(Modes.Paint)}
          icon="paintbrush"
          text="Paint (p)" />
        <Button
          active={mode === Modes.Delete}
          onClick={() => onClickSetMode(Modes.Delete)}
          icon="close-circle-outline"
          text="Delete (d)" />
        <Button
          active={mode === Modes.Move}
          onClick={() => onClickSetMode(Modes.Move)}
          icon="copy-outline"
          text="Move (m)" />
        <Button
          active={mode === Modes.Clone}
          onClick={() => onClickSetMode(Modes.Clone)}
          icon="color-wand-outline"
          text="Clone (c)" />
        <Button
          active={mode === Modes.Explore}
          onClick={() => onClickSetMode(Modes.Explore)}
          icon="color-wand-outline"
          text="Explore (x)" />

      </div>
      {children}
    </div>
  );
}


export default Topbar;

/*
<div style={styles.rightSection}>
  <Button
    active={utilsOpen}
    onClick={onClickToggleUtils}
    icon="navicon-round"
    text="Utils" />
</div>
*/
