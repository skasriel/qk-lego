import React from 'react';

import Button from './Button';
import ColorPicker from './ColorPicker';

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
  utilsOpen,
  onClickToggleUtils,
  children
}) => {
  return (
    <div style={styles.topbar}>
      <div style={styles.section}>
        <div style={styles.title}>
          Mode
        </div>
        <Button
          active={mode === 'build'}
          onClick={() => onClickSetMode('build')}
          icon="hammer"
          text="Build" />
        <Button
          active={mode === 'paint'}
          onClick={() => onClickSetMode('paint')}
          icon="paintbrush"
          text="Paint" />
      </div>
      <div style={styles.section}>
        <div style={styles.title}>
          COLOR
        </div>
        <ColorPicker background={color} handleSetColor={onClickSetColor} />
      </div>
      <div style={styles.rightSection}>
        <Button
          active={utilsOpen}
          onClick={onClickToggleUtils}
          icon="navicon-round"
          text="Utils" />
      </div>
      {children}
    </div>
  );
}


export default Topbar;
