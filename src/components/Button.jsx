import React from 'react';

//import styles from '../styles/button.css';

let styles = {};

styles.button = {
  padding: '15px 30px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(160, 204, 255, 0.4)',
  transition: 'all 0.15s ease-in-out',
}
styles.button.hover = {
  color: '#A0CCFF',
  cursor: 'pointer',
}
styles.active = {
  composes: 'button',
  padding: '15px 30px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease-in-out',
  color: '#A0CCFF',
  background: '#22386E',
  boxShadow: 'inset -2px 0px 3px rgba(0, 0, 0, 0.25), inset 2px 0px 3px rgba(0, 0, 0, 0.25)',
}
styles.icon = {
  fontFamily: 'ionicons',
  fontSize: '1.5em',
  marginBottom: '7.5px',
}
styles.text = {
  textTransform: 'uppercase',
  fontWeight: '700',
  fontSize: '0.65em',
}



const Button = ({ text, icon, active, onClick }) => (
  <div style={active ? styles.active : styles.button} onClick={onClick}>
    <div style={styles.icon}>
      <i className={`ion-${icon}`} />
    </div>
    <div style={styles.text}>
      {text}
    </div>
  </div>
);


export default Button;
