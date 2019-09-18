import React from 'react';
import MonacoEditor from 'react-monaco-editor';
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

const printVarListCode = `import json
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


def print_hello():
    if True:
        print('Hello')
        if True:
            print('World')


print('hello world')
print('aaaa')
print_random()
`;

class NormalEditor extends React.Component {
  constructor(props) {
    super(props);
    this.code = deafultCode;
    this.codeBlocks = [];
    this.deltaDecorations = [];
    this.startRunLinByLine = false;
    this.isWaitingServer = false;
    this.state = {
      runMode: null,
      stdOut: null,
      varList: null
    };
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
    thebelab.bootstrap();
  };

  onChange = (newValue, e) => {
    this.code = newValue;
  };

  getCodeBlocks = () => {
    const code = this.code;
    const lines = code.split('\n');
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
    console.log(codeBlocks.map(b => b.code).join('\n'));
    return codeBlocks;
  };

  runCode = () => {
    this.runCodeLineByLine(true);
    // this.restartEditor();
    // $('#output-area').show();
    // const kernel = window.thebeKernel;
    // const outputArea = window.outputArea;
    // const code = this.code;
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
    if (!this.startRunLinByLine) {
      this.restartEditor();
      this.startRunLinByLine = true;
      this.isWaitingServer = true;
      this.codeBlocks = this.getCodeBlocks();
      const code = this.codeBlocks.map(b => b.code).join('\n');
      let printVarFuture = kernel.requestExecute({ code: printVarListCode });
      printVarFuture.done.then(() => {
        let future = kernel.requestExecute({ code: code });
        future.onIOPub = msg => {
          // IDLE status
          if (
            msg.msg_type === 'status' &&
            msg.content.execution_state === 'idle'
          ) {
            this.hideLineDecoration();
            this.startRunLinByLine = false;
            this.isWaitingServer = false;
            return;
          }

          // Execute Result
          if (msg.msg_type === 'execute_result') {
            this.isWaitingServer = false;
            if (msg.content.data && msg.content.data['text/plain']) {
              this.setState({ stdOut: msg.content.data['text/plain'] });
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
              this.setState({ varList: JSON.parse(msg.content.text) });
              if (autoRun) {
                kernel.sendInputReply({ status: 'ok', value: 'c' });
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
      this.isWaitingServer = true;
    }
  };

  getLineNoAndShowDecoration = () => {
    const text = $('#output-area').text();
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
          this.showLineDecoration(lineNo);
        }
      }
      if (line.startsWith('> <ipython-input')) {
        this.setState({ stdOut: lines.slice(0, index).join('\n') });
      }
    });
  };

  restartEditor = () => {
    this.codeBlocks = [];
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
    kernel.restart().then(thebelab.bootstrap);
  };

  showLineDecoration = lineno => {
    this.deltaDecorations = this.editor.deltaDecorations(
      this.deltaDecorations,
      [
        {
          range: new this.monaco.Range(lineno, 1, lineno, 1),
          options: {
            isWholeLine: true,
            className: 'bg-kov-orange'
          }
        }
      ]
    );
    // this.editor.revealLineInCenter(lineno);
  };

  hideLineDecoration = () => {
    this.deltaDecorations = this.editor.deltaDecorations(
      this.deltaDecorations,
      []
    );
  };

  render() {
    const code = this.code;
    const { stdOut, varList } = this.state;
    const options = {
      selectOnLineNumbers: true,
      readOnly: this.startRunLinByLine
    };
    return (
      <div>
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
        <div className="mb-3">
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

export default NormalEditor;

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
