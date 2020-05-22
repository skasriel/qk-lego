//import './App.css';

import React from 'react';
import { Provider } from 'react-redux';
import { AppContainer } from 'react-hot-loader';

import Builder from './components/Builder.jsx';
import './styles/app.css';

import { createStore } from 'redux';

import reducer from './reducer';

/*export default*/ function setupStore(initialState) {
  return createStore(
    reducer,
    initialState,
    (window.window.__REDUX_DEVTOOLS_EXTENSION__ && process.env.NODE_ENV === 'development') ?
      window.window.__REDUX_DEVTOOLS_EXTENSION__() : f => f
  );
}


const store = setupStore();

function App() {
  return (
    <AppContainer>
      <Provider store={store}>
        <Builder />
        <div id="blocker">
          <div id="instructions">
            <span style={{fontSsize:'36px'}}>Click to play</span>
            <br /><br />
            Move: WASD<br/>
            Jump: SPACE<br/>
            Look: MOUSE
          </div>
        </div>
        <div id="root"></div>

      </Provider>
    </AppContainer>
  );
}
export default App;
