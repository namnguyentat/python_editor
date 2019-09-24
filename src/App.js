import React from 'react';
import NormalEditor from './NormalEditor';
import LearningCourseEditor from './LearningCourseEditor';
import MultipleFilesEditor from './MultipleFilesEditor';
import './App.css';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      mode: 'multiple'
    };
  }

  _switchToMode = mode => {
    window.location.href = `/${mode}`;
  };

  render() {
    let mode = window.location.pathname;
    if (mode === '/') {
      mode = '/multiple';
    }
    return (
      <div>
        <div className="mb-3 mt-3">
          <button
            className="btn btn-success"
            onClick={() => this._switchToMode('multiple')}
          >
            Multiple files
          </button>
          <button
            className="btn btn-primary"
            onClick={() => this._switchToMode('normal')}
          >
            Normal
          </button>
          <button
            className="btn btn-default"
            onClick={() => this._switchToMode('learning')}
          >
            Learning Course
          </button>
        </div>
        {mode === '/normal' && <NormalEditor />}
        {mode === '/learning' && <LearningCourseEditor />}
        {mode === '/multiple' && <MultipleFilesEditor />}
      </div>
    );
  }
}

export default App;
