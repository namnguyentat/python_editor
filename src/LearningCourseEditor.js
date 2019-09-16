import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import uniq from 'lodash/uniq';
import max from 'lodash/max';
import { listen } from '@sourcegraph/vscode-ws-jsonrpc';
import {
  MonacoLanguageClient,
  CloseAction,
  ErrorAction,
  MonacoServices,
  createConnection
} from 'monaco-languageclient';
import normalizeUrl from 'normalize-url';
import ReconnectingWebSocket from 'reconnecting-websocket';

const deafultCode = `# Type your code here
import random

a = 1
b = True
c = 'String'
d = [1, 2, 3]#{"ex": true, "cc": true}


def print_random():#{"ex": true, "bl": {"lines": 6, "text": "print random function, user random"}}
    print(random.randint(1, 10))#{"ex": true}
    print_hello()#{"ex": true}
    print(random.randint(1, 10))#{"ex": true}
    print_hello()#{"ex": true}
    return 4#{"ex": true}


while True:
    fill_var = random.randomrange('fill_arg', 'fill_arg')


def print_hello():
    if True:
        print('Hello')
        if True:
            print('World')


print('hello world')#{"ww": ["hello world"]}
print('aaaa')
# show results#{"ex": true}
#{"wl": true,"bl": {"lines": 2, "text": "input code to show result"}}
#{"wl": true}
print_random()#{"ex": true, "cc": true}
`;

class LearningCourseEditor extends React.Component {
  constructor(props) {
    super(props);
    this.defaultCode = deafultCode;
    this.defaultCharacters = this.defaultCode
      .split('\n')
      .map(line => line.split(''));
    this.parsedCode = this.parseCode(deafultCode);
    this.characters = this.parsedCode.map(line => line.text.split(''));
    this.state = {
      code: this.parsedCode.map(line => line.text).join('\n')
    };
    this.deltaDecorations = [];
    this.contentWidgets = [];
    window.learning = this;
  }

  componentDidMount() {
    const url = createUrl('/pyls');
    const webSocket = createWebSocket(url);
    // listen when the web socket is opened
    listen({
      webSocket,
      onConnection: connection => {
        // create and start the language client
        const languageClient = createLanguageClient(connection);
        const disposable = languageClient.start();
        connection.onClose(() => disposable.dispose());
      }
    });
  }

  parseCode = code => {
    return code.split('\n').map((line, index) => {
      const splits = line.split('#');
      const anno = splits[splits.length - 1].trim();
      if (splits.length > 1 && this.isValidJson(anno)) {
        const options = JSON.parse(anno);
        const text = splits.slice(0, splits.length - 1).join('#');
        if (options.ex) {
          const positions = [];
          const codeLength = text.length;
          for (let i = 1; i <= codeLength; i++) {
            if (this.defaultCharacters[index][i - 1] !== ' ') {
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
    MonacoServices.install(editor);
    this.showDecorations();
    this.showContentWidgets();
  };

  onChange = (newValue, e) => {
    const { lineNumber, column } = this.editor.getPosition();
    const index = lineNumber - 1;
    const parsedLine = this.parsedCode[index];

    if (newValue.split('\n').length < this.parsedCode.length) {
      const code = this.state.code;
      this.setState({
        code: code
      });
    } else if (parsedLine.options.readOnly) {
      // If line is readOnly
      const code = this.state.code;
      this.setState({
        code: code
      });
    } else if (parsedLine.options.ex) {
      // If line is grayout
      if (
        this.characters[index][column - 1] &&
        this.characters[index][column - 1] !== ' '
      ) {
        const insertPositions = parsedLine.options.insertPositions;
        insertPositions.push(
          [lineNumber, column, lineNumber, column + 1].join(',')
        );
        parsedLine.options.insertPositions = uniq(insertPositions);
      }
      this.setState({
        code: this.parsedCode.map(line => line.text).join('\n')
      });
    } else if (parsedLine.options.wl) {
      // If line is worm eaten line
      const currentLine = this.editor.getModel().getLineContent(lineNumber);
      parsedLine.text = currentLine;
      this.setState({
        code: this.parsedCode.map(line => line.text).join('\n')
      });
    }
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
    const widgets = this.getAllContentWidgets();
    this.contentWidgets.forEach(widget => {
      this.editor.removeContentWidget(widget);
    });
    widgets.forEach(widget => {
      this.editor.addContentWidget(widget);
    });
    this.contentWidgets = widgets;
  };

  getAllContentWidgets = () => {
    const lines = this.parsedCode;
    const widgets = [];
    lines.forEach((line, index) => {
      // CC line
      if (line.options.cc) {
        if (line.options.ex) {
          if (
            line.options.grayoutPositions.length ===
            line.options.insertPositions.length
          ) {
            const id = `line_${index}_cc_ex.content.widget`;
            widgets.push({
              domNode: null,
              getId: function() {
                return id;
              },
              getDomNode: function() {
                if (!this.domNode) {
                  this.domNode = document.createElement('div');
                  this.domNode.innerHTML = 'Correct';
                  this.domNode.className = 'correct-ex-content-widget';
                }
                return this.domNode;
              },
              getPosition: function() {
                return {
                  position: {
                    lineNumber: index + 1,
                    column: 1000
                  },
                  preference: [
                    window.monaco.editor.ContentWidgetPositionPreference.EXACT,
                    window.monaco.editor.ContentWidgetPositionPreference.EXACT
                  ]
                };
              }
            });
          }
        }
      }
      // Balloon line
      if (line.options.bl) {
        const id = `line_${index}_bl.content.widget`;
        let maxLineLength = -1;
        this.parsedCode
          .slice(index + 1, index + line.options.bl.lines)
          .forEach((code, codeIndex) => {
            if (code.text.length > maxLineLength) {
              maxLineLength = code.text.length;
            }
          });
        const left = max([maxLineLength * 8.5 + 20, 200]);
        widgets.push({
          domNode: null,
          getId: function() {
            return id;
          },
          getDomNode: function() {
            if (!this.domNode) {
              this.domNode = document.createElement('div');
              this.domNode.innerHTML = line.options.bl.text;
              this.domNode.className = 'comment-content-widget';
              this.domNode.style.height = `${19 * line.options.bl.lines}px`;
              this.domNode.style.lineHeight = `${19 * line.options.bl.lines}px`;
              this.domNode.style.marginLeft = `${parseInt(left)}px`;
            }
            return this.domNode;
          },
          getPosition: function() {
            return {
              position: {
                lineNumber: index + 1,
                column: 1000
              },
              preference: [
                window.monaco.editor.ContentWidgetPositionPreference.EXACT,
                window.monaco.editor.ContentWidgetPositionPreference.EXACT
              ]
            };
          }
        });
      }
    });
    return widgets;
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

  getAllWormLinePositions = () => {
    const lines = this.parsedCode;
    let positions = [];
    lines.forEach((line, index) => {
      if (!line.options.wl) {
        return;
      }
      positions.push([index + 1, 1, index + 1, 1000].join(','));
    });
    return positions;
  };

  getAllDeltaDecorations = () => {
    // Grayout Decorations
    const grayoutPositions = this.getAllGrayoutPositions();
    const grayoutDecorations = grayoutPositions.map(postion => {
      const pos = postion.split(',').map(i => parseInt(i));
      return {
        range: new this.monaco.Range(...pos),
        options: {
          inlineClassName: 'color-kov-gray'
        }
      };
    });
    // Worm line Decorations
    const wormLinePositions = this.getAllWormLinePositions();
    const wormLineDecorations = wormLinePositions.map(postion => {
      const pos = postion.split(',').map(i => parseInt(i));
      return {
        range: new this.monaco.Range(...pos),
        options: {
          isWholeLine: true,
          className: 'bg-kov-light-green'
        }
      };
    });
    return [...grayoutDecorations, ...wormLineDecorations];
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
        enabled: true
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

function createLanguageClient(connection) {
  return new MonacoLanguageClient({
    name: 'Sample Language Client',
    clientOptions: {
      // use a language id as a document selector
      documentSelector: ['python'],
      // disable the default error handler
      errorHandler: {
        error: () => ErrorAction.Continue,
        closed: () => CloseAction.DoNotRestart
      }
    },
    // create a language client connection from the JSON RPC connection on demand
    connectionProvider: {
      get: (errorHandler, closeHandler) => {
        return Promise.resolve(
          createConnection(connection, errorHandler, closeHandler)
        );
      }
    }
  });
}

function createUrl(path) {
  const host = 'localhost:8080';
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return normalizeUrl(`${protocol}://${host}/${path}`);
}

function createWebSocket(url) {
  const socketOptions = {
    maxReconnectionDelay: 10000,
    minReconnectionDelay: 1000,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 10000,
    maxRetries: Infinity,
    debug: false
  };
  return new ReconnectingWebSocket(url, undefined, socketOptions);
}
