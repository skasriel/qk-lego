import React from 'react';

import BrickPicker from './BrickPicker.jsx';

//import styles from '../styles/topbar.css';

let styles = {};

styles.bottombar = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  width: '100%',
  zIndex: 9,
  background: 'rgba(15, 23, 42, 0.9)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.3), 0 -2px 4px -1px rgba(0, 0, 0, 0.2)',
  transition: 'all 0.2s ease',
  padding: '8px 0',
};

styles.section = {
  marginLeft: '30px',
  textAlign: 'center',
  //display: 'flex',
  alignItems: 'center',
  //justifyContent: 'flex-start',
};

styles.section.firstChild = {
  marginLeft: 0,
};

styles.title = {
  color: '#FFFFFF',
  padding: '15px',
  textTransform: 'uppercase',
  fontSize: '1em',
};

const Bottombar = ({ brickID, onClickSetBrick, children }) => {
  return (
    <div style={styles.bottombar}>
      <div style={styles.section}>
        <BrickPicker selectedID={brickID} handleSetBrick={onClickSetBrick} />
      </div>
      {children}
    </div>
  );
};

export default Bottombar;
