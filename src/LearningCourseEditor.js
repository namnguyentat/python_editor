import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import uniq from 'lodash/uniq';

const deafultCode = `# Type your code here
import random

a = 1
b = True
c = 'String'
d = [1, 2, 3] #{"ex": true, "cc": true}

def print_random():              #{"ex": true, "bl": {"lines": 6, "text": "print random function, user random"}}
    print(random.randint(1, 10)) #{"ex": true}
    print_hello()                #{"ex": true}
    print(random.randint(1, 10)) #{"ex": true}
    print_hello()                #{"ex": true}
    return 4                     #{"ex": true}

while True:
  fill_var = random.randomrange(fill_arg, fill_arg)

def print_hello():
    if True:
        print('Hello')
        if True:
            print('World')


print('hello world') #{"ww": ["hello world"]}
print('aaaa')
# show results #{"ex": true}
#{"wl": true, "bl": {"lines": 2, "text": "input code to show result"}}
#{"wl": true}
print_random() #{"ex": true, "cc": true}
`;

class LearningCourseEditor extends React.Component {
  constructor(props) {
    super(props);
    this.defaultCode = deafultCode;
    this.characters = this.defaultCode.split('\n').map(line => line.split(''));
    this.parsedCode = this.parseCode(deafultCode);
    console.log(this.parsedCode);
    this.state = {
      code: this.parsedCode.map(line => line.text).join('\n')
    };
    this.deltaDecorations = [];
    this.contentWidgets = [];
  }

  parseCode = code => {
    return code.split('\n').map((line, index) => {
      const splits = line.split('#');
      const anno = splits[splits.length - 1].trim();
      console.log(anno);
      if (splits.length > 1 && this.isValidJson(anno)) {
        const options = JSON.parse(anno);
        const text = splits.slice(0, splits.length - 1).join('#');
        if (options.ex) {
          const positions = [];
          const codeLength = text.length;
          for (let i = 1; i <= codeLength; i++) {
            if (this.characters[index][i - 1] !== ' ') {
              positions.push([index + 1, i, index + 1, i + 1].join(','));
            }
          }
          options.grayoutPositions = positions;
          options.insertPositions = [];
        }
        return {
          text: splits.slice(0, splits.length - 1).join('#'),
          options: options
        };
      } else {
        return {
          text: line,
          options: { readOnly: true }
        };
      }
    });
  };

  isValidJson = text => {
    try {
      return typeof JSON.parse(text) === 'object';
    } catch {
      return false;
    }
  };

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
    this.showDecorations();
    this.showContentWidgets();
  };

  onChange = (newValue, e) => {
    const { lineNumber, column } = this.editor.getPosition();
    const index = lineNumber - 1;
    const parsedLine = this.parsedCode[index];
    // If line is readOnly
    if (parsedLine.readOnly) {
      const code = this.state.code;
      this.setState({
        code: code
      });
      return;
    }
    // If line is grayout
    if (parsedLine.options.ex) {
      if (this.characters[index][column - 1] !== ' ') {
        const insertPositions = parsedLine.options.insertPositions;
        insertPositions.push(
          [lineNumber, column, lineNumber, column + 1].join(',')
        );
        parsedLine.options.insertPositions = uniq(insertPositions);
      }
    }
    this.setState({
      code: this.parsedCode.map(line => line.text).join('\n')
    });
    this.showDecorations();
    this.showContentWidgets();
  };

  isFinish = () => {
    return this.grayoutPositions.length <= this.insertPositions.length;
  };

  showDecorations = () => {
    this.deltaDecorations = this.editor.deltaDecorations(
      this.deltaDecorations,
      this.getAllDeltaDecorations()
    );
  };

  showContentWidgets = () => {
    this.getAllContentWidgets().forEach(widget => {
      this.editor.addContentWidget(widget);
    });
  };

  getAllContentWidgets = () => {
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
    return [];
  };

  getAllGrayoutPositions = () => {
    const lines = this.parsedCode;
    let positions = [];
    lines.forEach((line, index) => {
      if (!line.options.ex) {
        return;
      }
      const grayoutPositions = line.options.grayoutPositions;
      const insertPositions = line.options.insertPositions;
      positions = positions.concat(
        grayoutPositions.filter(pos => !insertPositions.includes(pos))
      );
    });
    return positions;
  };

  getAllDeltaDecorations = () => {
    const positions = this.getAllGrayoutPositions();
    return positions.map(postion => {
      const pos = postion.split(',').map(i => parseInt(i));
      return {
        range: new this.monaco.Range(...pos),
        options: {
          inlineClassName: 'color-kov-gray'
        }
      };
    });
  };

  hideLineDecoration = () => {
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
      selectionHighlight: false
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

export default LearningCourseEditor;
