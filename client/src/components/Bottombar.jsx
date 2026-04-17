import React from 'react';

import BrickPicker from './BrickPicker.jsx';
import ModelPicker from './ModelPicker.jsx';

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

styles.tabBar = {
  display: 'flex',
  padding: '0 15px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  marginBottom: '8px',
};

styles.tab = {
  padding: '8px 16px',
  cursor: 'pointer',
  color: 'rgba(255, 255, 255, 0.6)',
  fontSize: '0.9em',
  borderBottom: '2px solid transparent',
  transition: 'all 0.2s',
};

styles.tabActive = {
  padding: '8px 16px',
  cursor: 'pointer',
  color: '#FFFFFF',
  fontSize: '0.9em',
  borderBottom: '2px solid #60a5fa',
  backgroundColor: 'rgba(96, 165, 250, 0.1)',
};

class Bottombar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeTab: 'bricks', // 'bricks' or 'models'
    };
  }

  handleSelectModel = async (model) => {
    const { onSetModelRollOver } = this.props;
    if (onSetModelRollOver) {
      // Set the model as rollover (will follow mouse until placed)
      try {
        const res = await fetch(`/api/models/load/${encodeURIComponent(model.id || model.name)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.worldModel) {
            onSetModelRollOver(data.worldModel);
          }
        }
      } catch (err) {
        console.error('Failed to load model:', err);
      }
    }
  };

  render() {
    const { brickID, onClickSetBrick, children } = this.props;
    const { activeTab } = this.state;

    return (
      <div style={styles.bottombar}>
        <div style={styles.tabBar}>
          <div
            style={activeTab === 'bricks' ? styles.tabActive : styles.tab}
            onClick={() => this.setState({ activeTab: 'bricks' })}
          >
            Bricks
          </div>
          <div
            style={activeTab === 'models' ? styles.tabActive : styles.tab}
            onClick={() => this.setState({ activeTab: 'models' })}
          >
            Models
          </div>
        </div>
        <div style={styles.section}>
          {activeTab === 'bricks' ? (
            <BrickPicker selectedID={brickID} handleSetBrick={onClickSetBrick} />
          ) : (
            <ModelPicker onSelectModel={this.handleSelectModel} />
          )}
        </div>
        {children}
      </div>
    );
  }
}

export default Bottombar;
