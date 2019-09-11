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
        koov.multicolormatrix("v2").display("par", 0)
    elif te == 2:
        koov.multicolormatrix("v2").display("choki", 0)
    else:
        exit(1)
`;

class GrayoutEditor extends React.Component {
  constructor(props) {
    super(props);
    this.code = deafultCode;
    this.deltaDecorations = [];
    this.isShowingDecoration = true;
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
    this.showLineDecoration();
  };

  onChange = (newValue, e) => {
    if (this.isShowingDecoration) {
      this.hideLineDecoration();
      this.forceUpdate();
    } else {
      this.code = newValue;
    }
  };

  showLineDecoration = () => {
    this.deltaDecorations = this.editor.deltaDecorations(
      this.deltaDecorations,
      [
        {
          range: new this.monaco.Range(5, 7, 12, 100),
          options: {
            inlineClassName: 'color-kov-gray'
          }
        }
      ]
    );
    this.editor.setPosition({ lineNumber: 5, column: 7 });
    this.editor.focus();
  };

  hideLineDecoration = () => {
    this.isShowingDecoration = false;
    this.deltaDecorations = this.editor.deltaDecorations(
      this.deltaDecorations,
      []
    );
  };

  render() {
    const code = this.code;
    const options = {
      selectOnLineNumbers: true
    };
    return (
      <MonacoEditor
        width="800"
        height="600"
        language="python"
        theme="vs"
        value={code}
        options={options}
        onChange={this.onChange}
        editorDidMount={this.editorDidMount}
      />
    );
  }
}

export default GrayoutEditor;
