import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import uniq from 'lodash/uniq';

class GrayoutEditor extends React.Component {
  constructor(props) {
    super(props);
    this.defaultCode = props.code;
    this.characters = this.defaultCode.split('\n').map(line => line.split(''));
    this.state = {
      code: props.code
    };
    this.deltaDecorations = [];
    this.allPositions = this.getAllPositions();
    this.insertPositions = [];
    this.comments = props.comments;
    this.commentWidgets = [];
    this.isShownCorrect = false;
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
    this.showLineDecoration();
    this.showComments();
  };

  onChange = (newValue, e) => {
    const { lineNumber, column } = this.editor.getPosition();
    if (this.characters[lineNumber - 1][column - 1] !== ' ') {
      this.insertPositions.push(
        [lineNumber, column, lineNumber, column + 1].join(',')
      );
    }
    this.insertPositions = uniq(this.insertPositions);
    this.setState({
      code: this.defaultCode
    });
    this.showLineDecoration();
    if (
      this.props.showCorrectAfaterFinish &&
      !this.isShownCorrect &&
      this.isFinish()
    ) {
      this.showCorrectWidget();
    }
  };

  isFinish = () => {
    return this.allPositions.length <= this.insertPositions.length;
  };

  showLineDecoration = () => {
    this.deltaDecorations = this.editor.deltaDecorations(
      this.deltaDecorations,
      this.getAllDecorations()
    );
  };

  showComments = () => {
    if (!this.comments) {
      return;
    }
    this.commentWidgets = this.comments.map((comment, index) => {
      return {
        domNode: null,
        getId: function() {
          return `comment_${index}.content.widget`;
        },
        getDomNode: function() {
          if (!this.domNode) {
            this.domNode = document.createElement('div');
            this.domNode.innerHTML = comment.text;
            this.domNode.className = 'comment-content-widget';
          }
          return this.domNode;
        },
        getPosition: function() {
          return {
            position: {
              lineNumber: comment.line,
              column: 1000
            },
            preference: [
              window.monaco.editor.ContentWidgetPositionPreference.EXACT,
              window.monaco.editor.ContentWidgetPositionPreference.EXACT
            ]
          };
        }
      };
    });
    this.commentWidgets.forEach(widget => {
      this.editor.addContentWidget(widget);
    });
    this.isShownCorrect = true;
  };

  showCorrectWidget = () => {
    this.correctWidget = {
      domNode: null,
      getId: function() {
        return `correct.content.widget`;
      },
      getDomNode: function() {
        if (!this.domNode) {
          this.domNode = document.createElement('div');
          this.domNode.innerHTML = 'Correct';
          this.domNode.className = 'comment-content-widget';
        }
        return this.domNode;
      },
      getPosition: function() {
        return {
          position: {
            lineNumber: 1,
            column: 1000
          },
          preference: [
            window.monaco.editor.ContentWidgetPositionPreference.EXACT,
            window.monaco.editor.ContentWidgetPositionPreference.EXACT
          ]
        };
      }
    };
    this.editor.addContentWidget(this.correctWidget);
  };

  getAllPositions = () => {
    const lines = this.defaultCode.split('\n');
    const positions = [];
    lines.forEach((line, index) => {
      const codeLength = line.length;
      for (let i = 1; i <= codeLength; i++) {
        if (this.characters[index][i - 1] !== ' ') {
          positions.push([index + 1, i, index + 1, i + 1].join(','));
        }
      }
    });
    return positions;
  };

  getAllDecorations = () => {
    const decorations = [];
    this.allPositions.forEach(postion => {
      if (this.insertPositions.includes(postion)) {
        return;
      }
      const pos = postion.split(',').map(i => parseInt(i));
      decorations.push({
        range: new this.monaco.Range(...pos),
        options: {
          inlineClassName: 'color-kov-gray'
        }
      });
    });
    return decorations;
  };

  hideLineDecoration = () => {
    debugger;
    this.deltaDecorations = this.editor.deltaDecorations(
      this.deltaDecorations,
      []
    );
  };

  calculateHeight = () => {
    return this.defaultCode.split('\n').length * 19;
  };

  render() {
    const code = this.state.code;
    const options = {
      selectOnLineNumbers: true,
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

export default GrayoutEditor;
