import React from 'react';
import { Provider } from 'react-redux';

import Builder from './components/Builder.jsx';
import './styles/app.css';

import { configureStore } from '@reduxjs/toolkit';

import reducer from './reducer';

function setupStore(initialState) {
  return configureStore({
    reducer,
    preloadedState: initialState,
    devTools: import.meta.env.DEV,
  });
}

const store = setupStore();

function App() {
  return (
    <Provider store={store}>
      <Builder />
      <div id="blocker">
        <div id="instructions">
          <span style={{ fontSize: '36px' }}>Click to play</span>
          <br />
          <br />
          Move: WASD
          <br />
          Jump: SPACE
          <br />
          Look: MOUSE
        </div>
      </div>
    </Provider>
  );
}
export default App;
