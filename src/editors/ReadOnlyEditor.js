import React from 'react';
import MonacoEditor from 'react-monaco-editor';

class ReadOnlyEditor extends React.Component {
  constructor(props) {
    super(props);
    this.code = props.code;
  }

  editorDidMount = (editor, monaco) => {
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

  calculateHeight = () => {
    return this.code.split('\n').length * 19;
  };

  onChange = (newValue, e) => {};

  render() {
    const code = this.code;
    const options = {
      selectOnLineNumbers: true,
      readOnly: true,
      minimap: {
        enabled: false
      },
      scrollBeyondLastLine: false,
      selectionHighlight: false,
      lineNumbers: originalLineNumber => {
        const startFrom = this.props.lineNumberStartForm || 0;
        return startFrom + originalLineNumber;
      }
    };
    return (
      <MonacoEditor
        width="800"
        height={this.calculateHeight()}
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

export default ReadOnlyEditor;
