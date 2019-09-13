import React from 'react';
import NormalEditor from './NormalEditor';
import GrayoutEditor from './GrayoutEditor';
import './App.css';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      mode: 'normal'
    };
  }

  _switchToMode = mode => {
    this.setState({ mode });
  };

  render() {
    const { mode } = this.state;
    return (
      <div>
        <div className="mb-3 mt-3">
          <button
            className="btn btn-primary"
            onClick={() => this._switchToMode('normal')}
          >
            Normal
          </button>
          <button
            className="btn btn-default"
            onClick={() => this._switchToMode('grayout')}
          >
            Grayout
          </button>
        </div>
        {mode === 'normal' && <NormalEditor />}
        {mode === 'grayout' && <GrayoutEditor />}
      </div>
    );
  }
}

export default App;
