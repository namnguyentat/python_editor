import React from 'react';
import MonacoEditor from 'react-monaco-editor';
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
import * as thebelab from './thebelab';
import $ from 'jquery';
import TextFileUtil from './utils/text_file_utility';

const commentRegex = /(:)(\s*)(#[^*]*)/g;
const printVarListCode = `
%reload_ext autoreload
%autoreload 2
%reset -f
import json
from sys import getsizeof

from IPython import get_ipython
from IPython.core.magics.namespace import NamespaceMagics

_nms = NamespaceMagics()
_Jupyter = get_ipython()
_nms.shell = _Jupyter.kernel.shell

try:
    import numpy as np  # noqa: F401
except ImportError:
    pass


def _getsizeof(x):
    # return the size of variable x. Amended version of sys.getsizeof
    # which also supports ndarray, Series and DataFrame
    if type(x).__name__ in ['ndarray', 'Series']:
        return x.nbytes
    elif type(x).__name__ == 'DataFrame':
        return x.memory_usage().sum()
    else:
        return getsizeof(x)


def _getshapeof(x):
    # returns the shape of x if it has one
    # returns None otherwise - might want to return an empty string for an empty collum
    try:
        return x.shape
    except AttributeError:  # x does not have a shape
        return None


def var_dic_list():
    types_to_exclude = ['module', 'function', 'builtin_function_or_method',
                        'instance', '_Feature', 'type', 'ufunc']
    values = _nms.who_ls()
    vardic = [{'varName': v, 'varType': type(eval(v)).__name__, 'varSize': str(_getsizeof(eval(v))), 'varShape': str(_getshapeof(eval(v))) if _getshapeof(eval(v)) else '', 'varContent': str(eval(v))[:200]}  # noqa

    for v in values if (v not in ['_html', '_nms', 'NamespaceMagics', '_Jupyter']) & (type(eval(v)).__name__ not in types_to_exclude)]  # noqa
    return json.dumps(vardic)


# command to refresh the list of variables
print(var_dic_list())
`;

const defaultCode = `# Type your code here
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


def print_hello():
    if True:
        print('Hello')
        if True:
            print('World')


print('hello world')#{"ww": ["hello world"], "cc": true}
print('aaaa')
# show results
#{"wl": true,"bl": {"lines": 2, "text": "input code to show result"}}
#{"wl": true}
print_random()#{"ex": true, "cc": true}`;

class LearningCourseEditor extends React.Component {
  constructor(props) {
    super(props);
    this.defaultCode = defaultCode;
    this.defaultLineNumber = this.defaultCode.split('\n').length;
    this.parsedCode = this.parseCode(this.defaultCode);
    this.startRunLinByLine = false;
    this.isWaitingServer = false;
    this.executingLineNumber = null;
    this.deltaDecorations = [];
    this.contentWidgets = [];
    this.currentCode = this.parsedCode.map(line => line.text).join('\n');
    this.state = {
      stdOut: null,
      varList: null
    };
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
          options.grayoutText = text;
          let spaceCount = text.length - text.trimLeft().length;
          if (spaceCount === 0) {
            spaceCount = 1;
          }
          options.spaceCount = spaceCount;
          return {
            text: '',
            options: options
          };
        }
        if (options.ww) {
          options.grayoutText = text;
          let spaceCount = text.length - text.trimLeft().length;
          if (spaceCount === 0) {
            spaceCount = 1;
          }
          options.spaceCount = spaceCount;
          const greenPositions = [];
          options.ww.forEach(word => {
            const start = text.search(word);
            if (start) {
              greenPositions.push([start, word.length]);
            }
          });
          options.greenPositions = greenPositions;
          return {
            text: '',
            options: options
          };
        }
        return {
          text: text,
          options: options
        };
      } else {
        return {
          text: line,
          options: {}
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
    thebelab.bootstrap();
    setTimeout(() => {
      monaco.editor.remeasureFonts();
    }, 3000);
    setTimeout(() => {
      const kernel = window.thebeKernel;
      if (kernel && !kernel.isReady) {
        this.restartKernel();
        window.location.reload();
      }
    }, 5000);
  };

  onChange = (newValue, e) => {
    if (this.currentCode === newValue) {
      this.showDecorations();
      this.showContentWidgets();
      return;
    }
    const lines = newValue.split('\n');
    const diff = this.defaultLineNumber - lines.length;
    for (let i = 0; i < diff; i++) {
      lines.push('');
    }
    this.currentCode = lines.join('\n');
    if (diff > 0) {
      const range = new this.monaco.Range(1, 1, lines.length, 1000);
      const id = { major: 1, minor: 1 };
      const text = lines.join('\n');
      const op = {
        identifier: id,
        range: range,
        text: text,
        forceMoveMarkers: true
      };
      this.editor.executeEdits('my source code', [op]);
    }
    this.showDecorations();
    this.showContentWidgets();
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
    const editorLines = this.editor.getModel().getLinesContent();
    const widgets = [];
    lines.forEach((line, index) => {
      // CC line
      if (line.options.cc) {
        if (
          this.parsedCode[index].options.grayoutText.trimEnd() ===
          this.editor
            .getModel()
            .getLineContent(index + 1)
            .trimEnd()
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
      // Grayout line
      if (line.options.ex) {
        const id = `line_${index}_ex.content.widget`;
        widgets.push({
          domNode: null,
          getId: function() {
            return id;
          },
          getDomNode: function() {
            if (!this.domNode) {
              this.domNode = document.createElement('div');
              this.domNode.innerHTML = line.options.grayoutText.replace(
                /\s/g,
                '&nbsp;'
              );
              this.domNode.className = 'ex-content-widget';
              this.domNode.style.zIndex = -1;
            }
            return this.domNode;
          },
          getPosition: function() {
            return {
              position: {
                lineNumber: index + 1,
                column: 0
              },
              preference: [
                window.monaco.editor.ContentWidgetPositionPreference.EXACT,
                window.monaco.editor.ContentWidgetPositionPreference.EXACT
              ]
            };
          }
        });
      }
      // Grayout line
      if (line.options.ww) {
        const id = `line_${index}_ww.content.widget`;
        widgets.push({
          domNode: null,
          getId: function() {
            return id;
          },
          getDomNode: function() {
            if (!this.domNode) {
              this.domNode = document.createElement('div');
              let text = line.options.grayoutText;
              const spaceCount = text.length - text.trimLeft().length;
              text = text.trimLeft();
              line.options.ww.forEach(
                word =>
                  (text = text.replace(
                    word,
                    `<span class='bg-kov-light-green'>${word}</span>`
                  ))
              );
              this.domNode.innerHTML = '&nbsp;'.repeat(spaceCount) + text;
              this.domNode.className = 'ww-content-widget';
              this.domNode.style.zIndex = -1;
            }
            return this.domNode;
          },
          getPosition: function() {
            return {
              position: {
                lineNumber: index + 1,
                column: 0
              },
              preference: [
                window.monaco.editor.ContentWidgetPositionPreference.EXACT,
                window.monaco.editor.ContentWidgetPositionPreference.EXACT
              ]
            };
          }
        });
      }
      // Balloon line
      if (line.options.bl) {
        const id = `line_${index}_bl.content.widget`;
        let maxLineLength = -1;
        // grayout text
        this.parsedCode
          .slice(index, index + line.options.bl.lines)
          .forEach((code, codeIndex) => {
            if (
              code.options.grayoutText &&
              code.options.grayoutText.length > maxLineLength
            ) {
              maxLineLength = code.options.grayoutText.length;
            }
          });
        // current editor text
        editorLines
          .slice(index, index + line.options.bl.lines)
          .forEach((code, codeIndex) => {
            if (code.length > maxLineLength) {
              maxLineLength = code.length;
            }
          });
        const left = parseInt(max([maxLineLength * 9.5, 200]));
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
                column: 1
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
    const executingLines = [];
    if (this.startRunLinByLine && this.executingLineNumber) {
      executingLines.push({
        range: new this.monaco.Range(
          this.executingLineNumber,
          1,
          this.executingLineNumber,
          1
        ),
        options: {
          isWholeLine: true,
          className: 'bg-kov-orange'
        }
      });
    }
    return [...wormLineDecorations, ...executingLines];
  };

  hideLineDecoration = () => {
    this.executingLineNumber = null;
    this.showDecorations();
  };

  getCode = () => {
    const code = this.currentCode;
    const lines = code
      .split('\n')
      .map(line => line.trimEnd())
      .map(line => line.replace(commentRegex, ':'));
    let buffer = [];
    let codeBlocks = [];
    codeBlocks.push({
      lineNo: null,
      code: 'from IPython.core.debugger import set_trace'
    });
    lines.forEach((line, index) => {
      if (
        line.trim().length === 0 ||
        line.trim().startsWith('#') ||
        line.trim().startsWith('%')
      ) {
        return;
      }
      const lineNoInfo = `# lineNo:${index + 1}`;
      const setTrace = 'set_trace()';
      if (buffer.length === 0) {
        if (line.endsWith(':')) {
          buffer.push({
            lineNo: index + 1,
            code: line + lineNoInfo
          });
        } else {
          codeBlocks = codeBlocks.concat([
            {
              lineNo: null,
              code: setTrace + lineNoInfo
            },
            {
              lineNo: index + 1,
              code: line + lineNoInfo
            }
          ]);
        }
      } else {
        if (line.startsWith(' ')) {
          if (!line.endsWith(':')) {
            const spaceCount = line.search(/\S/);
            buffer.push({
              lineNo: null,
              code: `${' '.repeat(spaceCount)}set_trace()${lineNoInfo}`
            });
          }
          buffer.push({
            lineNo: index + 1,
            code: line + lineNoInfo
          });
        } else {
          codeBlocks.push({
            lineNo: buffer[0].lineNo,
            code: buffer.map(b => b.code).join('\n')
          });
          buffer = [];
          if (line.endsWith(':')) {
            buffer.push({
              lineNo: index + 1,
              code: line + lineNoInfo
            });
          } else {
            codeBlocks = codeBlocks.concat([
              {
                lineNo: null,
                code: setTrace + lineNoInfo
              },
              {
                lineNo: index + 1,
                code: line + lineNoInfo
              }
            ]);
          }
        }
      }
      if (index === lines.length - 1 && buffer.length > 0) {
        codeBlocks.push({
          lineNo: buffer[0].lineNo,
          code: buffer.map(b => b.code).join('\n')
        });
      }
    });
    return codeBlocks.map(b => b.code).join('\n');
  };

  runCode = () => {
    this.runCodeLineByLine(true);
    // this.restartEditor();
    // $('#output-area').show();
    // const kernel = window.thebeKernel;
    // const outputArea = window.outputArea;
    // const code = this.current_code;
    // outputArea.future = kernel.requestExecute({ code: code });
    // outputArea.future.done.then(() => {
    //   let future = kernel.requestExecute({ code: printVarListCode });
    //   future.onIOPub = msg => {
    //     if (
    //       msg.content &&
    //       msg.content.name &&
    //       msg.content.text &&
    //       msg.content.name === 'stdout' &&
    //       msg.content.text.startsWith('[{"varName":')
    //     ) {
    //       this.setState({ varList: JSON.parse(msg.content.text) });
    //     }
    //   };
    // });
  };

  finish = () => {
    const kernel = window.thebeKernel;
    kernel.sendInputReply({ status: 'ok', value: 'q' });
    this.restartEditor();
  };

  runCodeLineByLine = (autoRun = false) => {
    if (this.isWaitingServer) {
      return;
    }
    $('#output-area').show();
    const kernel = window.thebeKernel;
    const outputArea = window.outputArea;
    outputArea.model.clear();
    this.isWaitingServer = true;
    if (!this.startRunLinByLine) {
      this.restartEditor();
      this.startRunLinByLine = true;
      const code = this.getCode();
      const printVarFuture = kernel.requestExecute({ code: printVarListCode });
      printVarFuture.done.then(() => {
        const future = kernel.requestExecute({ code: code });
        future.onIOPub = msg => {
          // IDLE status
          if (
            msg.msg_type === 'status' &&
            msg.content.execution_state === 'idle'
          ) {
            this.startRunLinByLine = false;
            this.isWaitingServer = false;
            this.showDecorations();
            this.forceUpdate();
            return;
          }

          // Error
          if (
            msg.msg_type === 'error' &&
            msg.content.ename &&
            msg.content.evalue
          ) {
            this.startRunLinByLine = false;
            this.isWaitingServer = false;
            this.showDecorations();
            this.setState({
              stdOut: msg.content.evalue
            });
            outputArea.model.fromJSON([
              {
                name: 'stdout',
                output_type: 'stream',
                text: msg.content.traceback
              }
            ]);
          }

          // Execute Result
          if (msg.msg_type === 'execute_result') {
            this.isWaitingServer = false;
            if (msg.content.data && msg.content.data['text/plain']) {
              this.setState({
                stdOut: msg.content.data['text/plain']
              });
            }
            outputArea.model.fromJSON([
              {
                data: msg.content.data,
                metadata: msg.content.metadata,
                output_type: 'execute_result'
              }
            ]);
            return;
          }

          // Display Data
          if (msg.msg_type === 'display_data') {
            outputArea.model.fromJSON([
              {
                data: msg.content.data,
                metadata: msg.content.metadata,
                output_type: 'display_data'
              }
            ]);
            return;
          }

          // Stream
          if (
            msg.msg_type === 'stream' &&
            msg.content.name === 'stdout' &&
            msg.content.text
          ) {
            this.isWaitingServer = false;
            if (
              msg.content.text.startsWith('[{"varName":') ||
              msg.content.text.startsWith('[]')
            ) {
              this.setState({
                varList: JSON.parse(msg.content.text)
              });
              if (autoRun) {
                kernel.sendInputReply({
                  status: 'ok',
                  value: 'c'
                });
                this.isWaitingServer = true;
              }
            } else {
              // Get var list
              kernel.sendInputReply({
                status: 'ok',
                value: 'print(var_dic_list())'
              });
              outputArea.model.fromJSON([
                {
                  name: 'stdout',
                  output_type: 'stream',
                  text: msg.content.text
                }
              ]);
              this.getLineNoAndShowDecoration();
            }
          }
        };
      });
    } else {
      kernel.sendInputReply({ status: 'ok', value: 'c' });
    }
  };

  getLineNoAndShowDecoration = () => {
    const text = $('#output-area').text();
    if (!text.includes('> <ipython-input')) {
      this.setState({ stdOut: text });
      return;
    }
    const lines = text.split('\n');
    let lineNo = null;
    lines.forEach((line, index) => {
      if (line.startsWith('--->') || line.startsWith('---->')) {
        console.log('line', line);
        lineNo = line.split('# lineNo:')[1];
        lineNo = parseInt(lineNo);
        if (!Number.isInteger(lineNo)) {
          lineNo = null;
        }
        if (lineNo) {
          this.executingLineNumber = lineNo;
          this.showDecorations();
        }
      }
      if (line.startsWith('> <ipython-input')) {
        this.setState({ stdOut: lines.slice(0, index).join('\n') });
      }
    });
  };

  restartEditor = () => {
    this.startRunLinByLine = false;
    this.isWaitingServer = false;
    this.hideLineDecoration();
    this.setState({
      stdOut: null,
      varList: null
    });
    const outputArea = window.outputArea;
    outputArea.model.clear();
  };

  restartKernel = () => {
    const kernel = window.thebeKernel;
    this.restartEditor();
    kernel.restart().then(thebelab.bootstrap);
  };

  reloadCode = () => {
    this.parsedCode = this.parseCode(this.defaultCode);
    this.currentCode = this.parsedCode.map(line => line.text).join('\n');
    this.setState(
      {
        stdOut: null,
        varList: null
      },
      () => {
        this.restartEditor();
        this.showDecorations();
        this.showContentWidgets();
      }
    );
  };

  onImportFileChanged = e => {
    e.preventDefault();
    this.importCodeFile(document.getElementById('file_import').files[0]);
  };

  importCodeFile = f => {
    const import_promise = () => {
      return new Promise((resolve, reject) => {
        TextFileUtil.import(f, (e, d) => {
          if (e) {
            reject(e);
          }
          resolve(d);
        });
      });
    };

    import_promise()
      .then(text => {
        this.defaultCode = text;
        this.reloadCode();
      })
      .catch(e => {
        console.error('validation error ->', e);
      });
  };

  calculateHeight = () => {
    return this.defaultCode.split('\n').length * 19;
  };

  render() {
    const code = this.currentCode;
    const { stdOut, varList } = this.state;
    const options = {
      readOnly: this.startRunLinByLine,
      selectOnLineNumbers: true,
      minimap: {
        enabled: true
      },
      scrollBeyondLastLine: false,
      selectionHighlight: false,
      fontSize: 12,
      fontFamily: 'Source Han Mono'
    };
    return (
      <div>
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
        <div className="mb-3 mt-3">
          <button className="btn btn-primary" onClick={this.runCode}>
            Run
          </button>
          <button
            className="btn btn-success"
            onClick={() => this.runCodeLineByLine(false)}
          >
            Run line
          </button>
          <button className="btn btn-success" onClick={this.finish}>
            Finish
          </button>
          <button className="btn btn-success">
            <label>
              Import
              <input
                id="file_import"
                className="hidden"
                type="file"
                accept={'.txt,.py'}
                onChange={this.onImportFileChanged}
              />
            </label>
          </button>
          <button className="btn btn-success" onClick={this.reloadCode}>
            Reload
          </button>
          <button className="btn btn-danger" onClick={this.restartKernel}>
            Restart Kernel
          </button>
        </div>
        {stdOut && (
          <div>
            <h3>Output</h3>
            <pre>{stdOut}</pre>
          </div>
        )}
        {varList && (
          <div>
            <h3>Variable Inspector</h3>
            <table className="table table-sm table-striped">
              <tbody>
                {varList.map((variable, index) => {
                  return (
                    <tr key={index}>
                      <td>{variable.varName}</td>
                      <td>{variable.varType}</td>
                      <td>{variable.varContent}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div id="output-area" />
      </div>
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
