import React from 'react';
import { CompactPicker } from 'react-color';
import { ColorCollections} from '../util';

//import styles from '../styles/color-picker.css';

let styles = {};

styles.colorPicker = {
  position: 'relative',
  width: '200px',
  display: 'flex',
  justifyContent: 'flex-start',
  paddingLeft: '10px',
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
}



class ColorPicker extends React.Component {
  constructor(props) {
    super(props);
    this._handleSetSolidColor = this._handleSetSolidColor.bind(this);
    this._handleSetTransparentColor = this._handleSetTransparentColor.bind(this);
    this._handleSetMetallicColor = this._handleSetMetallicColor.bind(this);
  }

  componentDidMount() {
    const { background } = this.props;
    this.setState({
      background,
    });
  }

  componentWillUnmount() {
  }

  _handleSetSolidColor(color) {
    const { handleSetColor } = this.props;
    handleSetColor(color.hex, ColorCollections.colorTypes.Solid);
  }
  _handleSetTransparentColor(color) {
    const { handleSetColor } = this.props;
    handleSetColor(color.hex, ColorCollections.colorTypes.Transparent);
  }
  _handleSetMetallicColor(color) {
    const { handleSetColor } = this.props;
    handleSetColor(color.hex, ColorCollections.colorTypes.Metallic);
  }

  render() {
    let color = this.props.color;
    return (
      <div style={styles.colorPicker}>
        <div style={styles.visible} ref={(picker) => this.picker = picker}>
          <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.8em', fontWeight: '500', marginBottom: '6px' }}>Solid Colors</div>
          <CompactPicker
            color={color}
            colors={ColorCollections.SolidColors}
            onChangeComplete={this._handleSetSolidColor}
            onSwatchHover={(color) => this.setState({ background: color.hex })}
          />

          <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.8em', fontWeight: '500', marginTop: '12px', marginBottom: '6px' }}>Transparent Colors</div>
          <CompactPicker
            color={color}
            colors={ColorCollections.TransparentColors}
            onChangeComplete={this._handleSetTransparentColor}
            onSwatchHover={(color) => this.setState({ background: color.hex })}
          />

          <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.8em', fontWeight: '500', marginTop: '12px', marginBottom: '6px' }}>Metallic Colors</div>
          <CompactPicker
            color={color}
            colors={ColorCollections.MetallicColors}
            onChangeComplete={this._handleSetMetallicColor}
            onSwatchHover={(color) => this.setState({ background: color.hex })}
          />

        </div>
      </div>
    );
  }
}


export default ColorPicker;
