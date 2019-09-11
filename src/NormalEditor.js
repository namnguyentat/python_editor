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
import delay from 'lodash/delay';
import * as thebelab from './thebelab';
import $ from 'jquery';

const deafultCode = `# Type your code here
import random


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
    this.executedLine = null;
    this.showExecutedLine = false;
    this.deltaDecorations = [];
    this.startRunLinByLine = false;
    this.isWaitingServer = false;
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
    console.log(codeBlocks);
    console.log(codeBlocks.map(b => b.code).join('\n'));
    return codeBlocks;
  };

  runCode = () => {
    const kernel = window.thebeKernel;
    const outputArea = window.outputArea;
    const code = this.code;
    outputArea.future = kernel.requestExecute({ code: code });
  };

  runCodeLineByLine = () => {
    if (this.isWaitingServer) {
      return;
    }
    const kernel = window.thebeKernel;
    const outputArea = window.outputArea;
    outputArea.model.clear();
    if (!this.startRunLinByLine) {
      this.startRunLinByLine = true;
      this.codeBlocks = this.getCodeBlocks();
      const code = this.codeBlocks.map(b => b.code).join('\n');
      outputArea.future = kernel.requestExecute({ code: code });
    } else {
      kernel.sendInputReply({ status: 'ok', value: 'c' });
    }
    this.isWaitingServer = true;
    delay(this.getLineNoAndShowDecoration, 100);
  };

  getLineNoAndShowDecoration = () => {
    const kernel = window.thebeKernel;
    const output = $('#output-area')
      .text()
      .split('\n');
    let lineNo = null;
    output.forEach((line, index) => {
      if (line.startsWith('--->') || line.startsWith('---->')) {
        console.log('line', line);
        lineNo = line.split('# lineNo:')[1];
        lineNo = parseInt(lineNo);
        if (!Number.isInteger(lineNo)) {
          lineNo = null;
        }
      }
    });
    if (lineNo) {
      this.showLineDecoration(lineNo);
    } else {
      this.restartEditor();
      kernel.sendInputReply({ status: 'ok', value: 'q' });
    }
    this.isWaitingServer = false;
  };

  restartEditor = () => {
    this.codeBlocks = [];
    this.executedLine = null;
    this.showExecutedLine = false;
    this.startRunLinByLine = false;
    this.isWaitingServer = false;
    this.hideLineDecoration();
  };

  restartKernel = () => {
    const kernel = window.thebeKernel;
    if (kernel) {
      kernel.restart().catch(e => console.error(e));
    }
    this.restartEditor();
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
    this.editor.revealLineInCenter(lineno);
  };

  hideLineDecoration = () => {
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
          <button className="btn btn-success" onClick={this.runCodeLineByLine}>
            Run line
          </button>
          <button className="btn btn-danger" onClick={this.restartKernel}>
            Restart Kernel
          </button>
        </div>
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
