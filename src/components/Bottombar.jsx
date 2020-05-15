import React from 'react';

import Button from './Button';
import BrickPicker from './BrickPicker.jsx';

//import styles from '../styles/topbar.css';

let styles = {};

styles.bottombar = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  //display: 'flex',
  alignItems: 'center',
  //justifyContent: 'flex-start',
  width: '100%',
  zIndex: 9,
  background: '#08173D',
  boxShadow: '0px 3px 12px rgba(0, 0, 0, 0.15)',
  transition: 'all 0.15s ease-in-out',
};

styles.section = {
  marginLeft: '30px',
  textAlign: 'center',
  //display: 'flex',
  alignItems: 'center',
  //justifyContent: 'flex-start',
}

styles.section.firstChild = {
  marginLeft: 0
}

styles.title = {
  color: '#FFFFFF',
  padding: '15px',
  textTransform: 'uppercase',
  fontSize: '1em',
}


const Bottombar = ({
  brickID,
  onClickSetBrick,
  children
}) => {
  return (
    <div style={styles.bottombar}>
      <div style={styles.section}>
        <BrickPicker selectedID={brickID} handleSetBrick={onClickSetBrick} />
      </div>
      {children}
    </div>
  );
}


export default Bottombar;
