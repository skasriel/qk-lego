import React from 'react';
import isEqual from 'lodash/isEqual';

import {BrickCollections} from '../engine/BrickCollections';
import {RebrickableParts, RebrickableCategories} from '../engine/RebrickableData';

let styles = {};

styles.picker = {
  position: 'relative',
  display: 'flex',
  height: '180px',
  background: 'rgba(15, 23, 42, 0.95)',
  backdropFilter: 'blur(12px)',
  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
}
styles.categoryList = {
  width: '180px',
  overflowY: 'auto',
  overflowX: 'hidden',
  borderRight: '1px solid rgba(255, 255, 255, 0.1)',
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
}
styles.categoryItem = {
  padding: '10px 15px',
  cursor: 'pointer',
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '0.85em',
  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  transition: 'all 0.2s',
}
styles.categoryItemActive = {
  padding: '10px 15px',
  cursor: 'pointer',
  color: '#FFFFFF',
  fontSize: '0.85em',
  backgroundColor: 'rgba(96, 165, 250, 0.2)',
  borderLeft: '3px solid #60a5fa',
  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
}
styles.partsGrid = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '10px',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
  gap: '8px',
  alignContent: 'start',
}
styles.brickThumb = {
  height: '50px',
  marginBottom: '7.5px',
  padding: '7.5px',
  backgroundColor: '#FFFFFF',
  borderRadius: '10px',
  boxShadow: '0px 3px 7px rgba(0, 0, 0, 0.6)',
  transition: 'all 0.15s ease-in-out',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
styles.label = {
  color: '#FFFFFF',
}

function displayNameFromID(brickID) {
  for (const category of Object.values(RebrickableParts)) {
    const found = category.find(p => p.id === String(brickID));
    if (found) return found.name;
  }
  return "Brick #"+brickID;
}

class BrickPicker extends React.Component {
  state = {
    open: true,
    selectedCategory: 'Bricks',
  }

  constructor(props) {
    super(props);
    this._togglePicker = this._togglePicker.bind(this);
    this._handleClickOutside = this._handleClickOutside.bind(this);
    this._handleChangeBrick = this._handleChangeBrick.bind(this);
  }

  componentDidMount() {
    document.addEventListener('mousedown', this._handleClickOutside);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this._handleClickOutside);
  }

  render() {
    const { selectedID, handleSetBrick } = this.props;
    const { selectedCategory } = this.state;
    const categories = RebrickableCategories;
    const currentParts = RebrickableParts[selectedCategory] || [];
    
    return (
      <div style={styles.picker} ref={(picker) => this.picker = picker}>
        <div style={styles.categoryList}>
          {categories.map(cat => (
            <div
              key={cat}
              onClick={() => this.setState({ selectedCategory: cat })}
              style={selectedCategory === cat ? styles.categoryItemActive : styles.categoryItem}
              onMouseEnter={(e) => {
                if (selectedCategory !== cat) {
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedCategory !== cat) {
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
            >
              {cat}
            </div>
          ))}
        </div>

        <div style={styles.partsGrid}>
          {currentParts.map((b, i) => (
            <div key={i} style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => this._handleChangeBrick(b)}>
              <div style={{
                ...styles.brickThumb,
                backgroundColor: selectedID.id == b.id ? '#60a5fa' : '#FFFFFF',
                border: selectedID.id == b.id ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.2)',
              }}>
                <div style={{ fontSize: '0.7em', fontWeight: 'bold', color: '#333' }}>{b.id}</div>
              </div>
              <div style={{ ...styles.label, fontSize: '0.7em', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  _handleChangeBrick(brickData) {
    console.log("_handle ", brickData);
    const { handleSetBrick } = this.props;
    
    let width = 2, height = 3, depth = 4;
    const name = brickData.name || '';
    const match = name.match(/(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+))?/);
    if (match) {
      width = parseInt(match[1]);
      depth = parseInt(match[2]);
      height = match[3] ? parseInt(match[3]) * 3 : 3;
    }
    
    const brick = {
      id: brickData.id,
      type: 'basic',
      width: width,
      height: height,
      depth: depth,
    };
    
    handleSetBrick(brick);
  }

  _togglePicker() {
    this.setState({
      open: !this.state.open,
    });
  }

  _handleClickOutside(event) {
    if (this.picker && !this.picker.contains(event.target)) {
      this.setState({
        open: false,
      });
    }
  }
}

export default BrickPicker;