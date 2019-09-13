import React from 'react';
import MonacoEditor from 'react-monaco-editor';

const deafultCode = `# Type your code here
import random

a = 1
b = True
c = 'String'
d = [1, 2, 3]


def print_random():
    print(random.randint(1, 10))
    print_hello()
    print(random.randint(1, 10))
    print_hello()
    return 4

while True:
  fill_var = random.randomrange(fill_arg, fill_arg)

def print_hello():
    if True:
        print('Hello')
        if True:
            print('World')


print('hello world')
print('aaaa')
print_random()
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
    this.showBallon();
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
          range: new this.monaco.Range(10, 1, 15, 100),
          options: {
            inlineClassName: 'color-kov-gray'
          }
        },
        {
          range: new this.monaco.Range(7, 1, 7, 100),
          options: {
            inlineClassName: 'color-kov-gray'
          }
        },
        {
          range: new this.monaco.Range(18, 1, 18, 100),
          options: {
            inlineClassName: 'color-kov-gray'
          }
        }
      ]
    );
    // this.editor.setPosition({ lineNumber: 5, column: 7 });
    // this.editor.focus();
  };

  showBallon = () => {
    this.commentContentWidget = {
      domNode: null,
      getId: function() {
        return 'comment.content.widget';
      },
      getDomNode: function() {
        if (!this.domNode) {
          this.domNode = document.createElement('div');
          this.domNode.innerHTML = 'Conmment line 10';
          this.domNode.className = 'comment-content-widget';
        }
        return this.domNode;
      },
      getPosition: function() {
        return {
          position: {
            lineNumber: 10,
            column: 22
          },
          preference: [
            window.monaco.editor.ContentWidgetPositionPreference.EXACT,
            window.monaco.editor.ContentWidgetPositionPreference.EXACT
          ]
        };
      }
    };
    this.otherCommentContentWidget = {
      domNode: null,
      getId: function() {
        return 'other_comment.content.widget';
      },
      getDomNode: function() {
        if (!this.domNode) {
          this.domNode = document.createElement('div');
          this.domNode.innerHTML = 'Conmment line 7';
          this.domNode.className = 'comment-content-widget';
        }
        return this.domNode;
      },
      getPosition: function() {
        return {
          position: {
            lineNumber: 7,
            column: 22
          },
          preference: [
            window.monaco.editor.ContentWidgetPositionPreference.EXACT,
            window.monaco.editor.ContentWidgetPositionPreference.EXACT
          ]
        };
      }
    };
    this.other2CommentContentWidget = {
      domNode: null,
      getId: function() {
        return 'other2_comment.content.widget';
      },
      getDomNode: function() {
        if (!this.domNode) {
          this.domNode = document.createElement('div');
          this.domNode.innerHTML = 'Conmment line 18';
          this.domNode.className = 'comment-content-widget';
        }
        return this.domNode;
      },
      getPosition: function() {
        return {
          position: {
            lineNumber: 18,
            column: 100
          },
          preference: [
            window.monaco.editor.ContentWidgetPositionPreference.EXACT,
            window.monaco.editor.ContentWidgetPositionPreference.EXACT
          ]
        };
      }
    };

    this.editor.addContentWidget(this.commentContentWidget);
    this.editor.addContentWidget(this.otherCommentContentWidget);
    this.editor.addContentWidget(this.other2CommentContentWidget);
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
