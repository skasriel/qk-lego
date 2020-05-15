import React from 'react';
import { GithubPicker } from 'react-color';

import { SimpleBrick } from '../components/Icons';
import { colors } from '../util';

//import styles from '../styles/color-picker.css';

let styles = {};

styles.colorPicker = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
}
styles.colorPicker.hover = {
  cursor: 'pointer',
}
styles.brick = {
  width: '35px',
}
styles.picker = {
  position: 'absolute',
  top: 'calc(100% + 35px)',
  left: 'calc(50% - 15px)',
  display: 'none',
}
styles.visible = {
  composes: 'picker',
  position: 'absolute',
  top: 'calc(100% + 35px)',
  left: 'calc(50% - 15px)',
  display: 'block',
}



class ColorPicker extends React.Component {
  state = {
    open: false,
  }

  constructor(props) {
    super(props);
    this._handleChangeColor = this._handleChangeColor.bind(this);
    this._togglePicker = this._togglePicker.bind(this);
    this._handleClickOutside = this._handleClickOutside.bind(this);
  }

  componentDidMount() {
    const { background } = this.props;
    document.addEventListener('mousedown', this._handleClickOutside);
    this.setState({
      background,
    });
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this._handleClickOutside);
  }

  _handleChangeColor(color) {
    const { handleSetColor } = this.props;
    handleSetColor(color.hex);
    this._togglePicker();
  }

  _handleClickOutside(event /*SK: added event param*/) {
    const { background } = this.props;
    if (this.picker && !this.picker.contains(event.target)) {
      this.setState({
        open: false,
        background,
      });
    }
  }

  _togglePicker() {
    const { background } = this.props;
    this.setState({
      open: !this.state.open,
      background,
    });
  }

  render() {
    const { background, open } = this.state;
    return (
      <div style={styles.colorPicker}>
        <div style={styles.brick} onClick={this._togglePicker}>
          <SimpleBrick color={background} />
        </div>
        <div style={open ? styles.visible : styles.picker} ref={(picker) => this.picker = picker}>
          <GithubPicker
            color={background}
            colors={colors}
            onChangeComplete={this._handleChangeColor}
            onSwatchHover={(color) => this.setState({ background: color.hex })}
          />
        </div>
      </div>
    );
  }
}


export default ColorPicker;
