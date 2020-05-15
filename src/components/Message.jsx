import React from 'react';

//import styles from '../styles/message.css';

let styles = {};

styles.message = {
  position: 'absolute',
  left: '15px',
  bottom: '15px',
  padding: '15px',
  color: '#FFFFFF',
  background: 'rgba(0, 0, 0, 0.4)',
  borderRadius: '15px',
  fontSize: '0.9em',
}
styles.message.i = {
  marginRight: '7.5px',
}


const Message = ({ text, children }) => {
  return (
    <div style={styles.message}>
      {children}
    </div>
  );
}


export default Message;
