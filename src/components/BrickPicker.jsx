import React from 'react';
import If from 'if-only';
import isEqual from 'lodash/isEqual';

import {BrickCollections} from '../util';

import { CarouselProvider, Slider, Slide, ButtonBack, ButtonNext, ButtonFirst, ButtonLast, DotGroup } from 'pure-react-carousel';
import 'pure-react-carousel/dist/react-carousel.es.css';

let styles = {};

/*styles.brickPicker = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
}*/
styles.brick = {
  color: '#FFFFFF',
  height: '60px',
  //display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
styles.brick.hover = {
  cursor: 'pointer',
}
styles.brickIcon = {
  height: '40px',
}
styles.picker = {
  position: 'relative',
  top: '0px',
  left: '0px',
  padding: '15px',
  background: '#22386E',
  //display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0px 5px 5px rgba(0, 0, 0, 0.15)',
  borderRadius: '4px',
  border: '1px solid #08173D',
}

styles.picker.after = {
  content: ' ',
  position: 'absolute',
  top: '-7px',
  left: '15px',
  borderLeft: '7px solid transparent !important',
  borderRight: '7px solid transparent !important',
  borderBottomWidth: '7px',
  borderBottomStyle: 'solid',
  borderColor: '#22386E',
}
styles.brickExample = {
  marginRight: '15px',
  //display: 'flex',
  //flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}
styles.brickExample.lastChild = {
  marginRight: '0',
}
styles.brickThumb = {
  height: '50px',
  marginBottom: '7.5px',
  padding: '7.5px',
  backgroundColor: '#FFFFFF',
  borderRadius: '10px',
  boxShadow: '0px 3px 7px rgba(0, 0, 0, 0.6)',
  transition: 'all 0.15s ease-in-out',
}
styles.brickThumb.hover = {
  cursor: 'pointer',
  transform: 'translateY(-2px)',
  boxShadow: '0px 5px 10px rgba(0, 0, 0, 0.4)',
}
styles.selected = {
  composes: 'brickThumb',
  height: '50px',
  marginBottom: '7.5px',
  padding: '7.5px',
  borderRadius: '10px',
  boxShadow: '0px 3px 7px rgba(0, 0, 0, 0.6)',
  transition: 'all 0.15s ease-in-out',
  backgroundColor: '#A0CCFF',
}
styles.label = {
  color: '#FFFFFF',
}

let selectedCollection = "Bricks";



function displayNameFromID(brickID) {
  return "Brick #"+brickID; //`${dimensions.x}x${dimensions.z}`
}
function getBrickIconFromID(brickID) {
  //const Icon = Icons[`B${dimensions.x}x${dimensions.z}`];
  //return <Icon />;
  return "#"+brickID;
}

class BrickPicker extends React.Component {
  state = {
    open: true,
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
    const { open } = this.state;
    return (
      <div style={styles.picker} ref={(picker) => this.picker = picker}>
        <CarouselProvider
          naturalSlideWidth={100}
          naturalSlideHeight={50}
          visibleSlides={12}
          totalSlides={BrickCollections.getNumberOfBricks()}>
          <Slider>

          {BrickCollections.getAllBricks().map((b, i) => (
            <Slide key={i} index={i}>
            <div key={i} style={styles.brickExample}>
                <div style={isEqual(selectedID, b) ? styles.selected : styles.brickThumb} onClick={() => this._handleChangeBrick(b)}>
                  {getBrickIconFromID(b)}
                </div>
                <div style={styles.label}>
                  {displayNameFromID(b)}
                </div>
            </div>
            </Slide>
          ))}
          </Slider>
          <ButtonFirst>First</ButtonFirst>
          <ButtonBack>Back</ButtonBack>
          <ButtonNext>Next</ButtonNext>
          <ButtonLast>Last</ButtonLast>
          <DotGroup dotNumbers />
        </CarouselProvider>
      </div>
    );
  }

  /*
    <div style={styles.brick} onClick={this._togglePicker}>
      <div style={styles.brickIcon}>
        {getBrickIconFromID(selectedID)}
      </div>
    </div>
    <If cond={open}>
    </If>
  */


  _handleChangeBrick(brickID) {
    console.log("_handle "+brickID);
    const { handleSetBrick } = this.props;
    handleSetBrick(brickID);
    //this._togglePicker();
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
