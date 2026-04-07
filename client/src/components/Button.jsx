import React from 'react';

let styles = {};

styles.button = {
  padding: '12px 24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(255, 255, 255, 0.6)',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  borderRadius: '8px',
  margin: '0 4px',
  position: 'relative',
}
styles.buttonHover = {
  color: 'rgba(255, 255, 255, 0.9)',
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
}
styles.active = {
  padding: '12px 24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  color: '#ffffff',
  backgroundColor: 'rgba(96, 165, 250, 0.2)',
  cursor: 'pointer',
  borderRadius: '8px',
  margin: '0 4px',
  position: 'relative',
  boxShadow: '0 0 0 1px rgba(96, 165, 250, 0.5), 0 2px 8px rgba(96, 165, 250, 0.2)',
}
styles.activeAfter = {
  content: '""',
  position: 'absolute',
  bottom: '-1px',
  left: '12px',
  right: '12px',
  height: '2px',
  backgroundColor: '#60a5fa',
  borderRadius: '2px',
}
styles.icon = {
  fontSize: '1.4em',
  marginBottom: '6px',
  opacity: 0.9,
}
styles.text = {
  textTransform: 'none',
  fontWeight: '500',
  fontSize: '0.75em',
  letterSpacing: '0.01em',
}



const Button = ({ text, icon, active, onClick }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const buttonStyle = active ? styles.active : (isHovered ? { ...styles.button, ...styles.buttonHover } : styles.button);
  
  return (
    <div 
      style={buttonStyle} 
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ion-icon name={icon} style={styles.icon}></ion-icon>
      <div style={styles.text}>
        {text}
      </div>
      {active && <div style={styles.activeAfter}></div>}
    </div>
  );
};


export default Button;
