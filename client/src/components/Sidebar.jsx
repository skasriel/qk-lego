import React from 'react';
import ColorPicker from './ColorPicker';


let styles = {};

styles.sidebar = {
  position: 'absolute',
  top: '100%',
  right: '0',
  background: '#22386E',
  height: 'calc(100vh - 100%)',
  boxShadow: 'inset -2px -2px 3px rgba(0, 0, 0, 0.25), inset 2px -2px 3px rgba(0, 0, 0, 0.25)',
  transform: 'translateX(100%)',
  transition: 'all 0.15s ease-in-out',
}
styles.visible = {
  composes: 'sidebar',
  position: 'absolute',
  top: '100%',
  right: '0',
  background: '#22386E',
  height: 'calc(100vh - 100%)',
  boxShadow: 'inset -2px -2px 3px rgba(0, 0, 0, 0.25), inset 2px -2px 3px rgba(0, 0, 0, 0.25)',
  transition: 'all 0.15s ease-in-out',
  transform: 'translateX(0)',
}
styles.separator = {
  position: 'relative',
  height: '10px',
  background: '#A0CCFF',
  width: '100%',
  marginBottom: '7.5px',
}
styles.content = {
  padding: '15px',
}
styles.row = {
  margin: '30px 0',
  color: '#FFFFFF',
  fontSize: '0.9em',
  transition: 'all 0.15s ease-in-out',
}
styles.row.hover = {
  color: '#A0CCFF',
}
styles.text = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
}
styles.text.i = {
  marginRight: '10px',
}


class Sidebar extends React.Component {
  render() {
    const { resetScene, color, onClickSetColor } = this.props;
    return (
      <div style={styles.visible}>

        <div style={styles.content}>
          <div style={styles.row} onClick={resetScene}>
            <div style={styles.text}>
              <span>Materials</span>
              <ColorPicker color={color} handleSetColor={onClickSetColor} />
            </div>
          </div>
        </div>

        <div style={styles.content}>
          <div style={styles.row} onClick={resetScene}>
            <div style={styles.text}>
              <i className="ion-trash-a" />
              <span>Reset scene</span>
            </div>
          </div>
        </div>

      </div>
    );
  }
}


export default Sidebar;
