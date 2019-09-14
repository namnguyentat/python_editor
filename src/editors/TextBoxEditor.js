import React from 'react';
import MonacoEditor from 'react-monaco-editor';
// import uniq from 'lodash/uniq';

class TextBoxEditor extends React.Component {
  constructor(props) {
    super(props);
    this.defaultCode = props.code;
    this.numberOfLines = props.numberOfLines || 10;
    this.state = {
      code: props.code
    };
    this.comments = props.comments;
    this.commentWidgets = [];
    this.isShownCorrect = false;
  }

  editorWillMount(monaco) {
    // monaco.editor.defineTheme('koovTheme', {
    //   base: 'vs',
    //   inherit: true,
    //   rules: [
        // { token: 'comment', foreground: '#9eaaad' },
        // { token: 'string', foreground: '#335780' },
        // { token: 'keyword', foreground: '#1691c0' },
        // { token: 'identifier', foreground: '#335780' },
        // { token: 'boolean', foreground: '#8787cc' },
        // { token: 'number', foreground: '#8787cc' },
        // { token: 'functionName', foreground: '#b85522' },
        // { token: 'operator', foreground: '#1691c0' },
        // { token: 'delimiter', foreground: '#335780' },
        // { token: 'koovMotion', foreground: '#59af0c' },
        // { token: 'koovControl', foreground: '#1691c0' },
        // { token: 'koovSensing', foreground: '#159479' },
        // { token: 'koovOperators', foreground: '#5589e0' },
        // { token: 'koovConnection', foreground: '#717f81' }
      // ],
      // colors: {
        // 'editor.background': '#f9f9f9'
        // 'editorCursor.foreground': '#5079ca',
        // 'editor.lineHighlightBackground': '#fff',
        // 'editorLineNumber.foreground': '#abb8bc',
        // 'editor.selectionBackground': '#e4f6f9',
        // 'editorIndentGuide.background': '#e0e0e0',
        // 'editorSuggestWidget.background': '#5d81a6',
        // 'editorSuggestWidget.border': '#5d81a6',
        // 'editorSuggestWidget.foreground': '#ffffff',
        // 'list.hoverBackground': '#456f97',
        // 'editorSuggestWidget.selectedBackground': '#456f97',
        // 'editorSuggestWidget.highlightForeground': '#9edded'
    //   }
    // });
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
    this.showComments();
  };

  onChange = (newValue, e) => {
    if (this.editor.getModel().getLineCount() <= this.numberOfLines) {
      this.setState({
        code: newValue
      });
    } else {
      const code = this.state.code;
      this.setState({
        code: code
      });
    }
    if (
      this.props.showCorrectAfaterFinish &&
      !this.isShownCorrect &&
      this.isFinish()
    ) {
      this.showCorrectWidget();
    }
  };

  isFinish = () => {
    return this.state.code.length >= 30;
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

  calculateHeight = () => {
    return this.numberOfLines * 19;
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
        editorWillMount={this.editorWillMount}
        editorDidMount={this.editorDidMount}
      />
    );
  }
}

export default TextBoxEditor;
