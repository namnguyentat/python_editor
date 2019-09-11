import React from 'react';
import MonacoEditor from 'react-monaco-editor';

const deafultCode = `# Type your code here
import koov
import random

while True:
    te = random.randomrang(0, 2)
    if te == 0:
        koov.multicolormatrix("v2").display("gu", 0)
    elif te == 1:
        koov.multicolormatrix("v2").display("par", 0)`;
const deafultCode2 = `    else:
        exit(1)`;

class WormEatenEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      code: '# Type your code here'
    };
  }

  editorDidMount = (editor, monaco) => {
    window.editor = editor;
    window.monaco = monaco;
    this.editor = editor;
    this.monaco = monaco;
    this.editor.getModel().updateOptions({ tabSize: 4 });
    monaco.languages.register({
      id: 'python',
      extensions: ['.py'],
      aliases: ['PYTHON', 'python'],
      mimetypes: ['application/json']
    });
  };

  onChange = (newValue, e) => {
    this.setState({ code: newValue });
  };

  render() {
    const code = this.state.code;
    const editorOneOptions = {
      selectOnLineNumbers: true,
      readOnly: true,
      minimap: {
        enabled: false
      },
      glyphMargin: true,
      lineNumbersMinChars: 3,
      scrollBeyondLastLine: false
    };
    const editableOptions = {
      selectOnLineNumbers: true,
      readOnly: false,
      minimap: {
        enabled: false
      },
      glyphMargin: true,
      lineNumbersMinChars: 3,
      scrollBeyondLastLine: false,
      lineNumbers: originalLineNumber => {
        return deafultCode.split('\n').length + originalLineNumber;
      }
    };
    const editorTwoOptions = {
      selectOnLineNumbers: true,
      readOnly: true,
      minimap: {
        enabled: false
      },
      glyphMargin: true,
      lineNumbersMinChars: 3,
      scrollBeyondLastLine: false,
      lineNumbers: originalLineNumber => {
        return (
          deafultCode.split('\n').length +
          code.split('\n').length +
          originalLineNumber
        );
      }
    };
    return (
      <div>
        <MonacoEditor
          width="800"
          height={deafultCode.split('\n').length * 19}
          language="python"
          theme="vs"
          value={deafultCode}
          options={editorOneOptions}
        />
        <MonacoEditor
          width="800"
          height={code.split('\n').length * 19}
          language="python"
          theme="vs"
          value={code}
          options={editableOptions}
          onChange={this.onChange}
          editorDidMount={this.editorDidMount}
          editorWillMount={this.editorWillMount}
        />
        <MonacoEditor
          width="800"
          height={deafultCode2.split('\n').length * 19}
          language="python"
          theme="vs"
          value={deafultCode2}
          options={editorTwoOptions}
        />
      </div>
    );
  }
}

export default WormEatenEditor;
