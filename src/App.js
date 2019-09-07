import React from 'react';
import './App.css';
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

const deafultCode = `# Type your code here
import random


def print_random():
    print(random.randint(1, 10))


print('hello world')
print('aaaa')
print_random()`;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.code = deafultCode;
    this.codeBlocks = [];
    this.executedLine = null;
    this.showExecutedLine = false;
    this.deltaDecorations = [];
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
    const codeBlocks = [];
    lines.forEach((line, index) => {
      if (line.trim().length === 0 || line.startsWith('#')) {
        return;
      }
      if (buffer.length === 0) {
        if (index === lines.length - 1 || !line.endsWith(':')) {
          codeBlocks.push({ lineNo: index + 1, code: line });
        } else if (line.endsWith(':')) {
          buffer.push({ lineNo: index + 1, code: line });
        }
        return;
      } else {
        if (line.startsWith(' ')) {
          buffer.push({ lineNo: index + 1, code: line });
        } else {
          codeBlocks.push({
            lineNo: buffer[0].lineNo,
            code: buffer.map(b => b.code).join('\n')
          });
          buffer = [];
          codeBlocks.push({ lineNo: index + 1, code: line });
        }
      }
    });
    return codeBlocks;
  };

  runCode = () => {
    const kernel = window.thebeKernel;
    const outputArea = window.outputArea;
    this.codeBlocks = this.getCodeBlocks();
    const code = this.codeBlocks.map(b => b.code).join('\n');
    outputArea.future = kernel.requestExecute({ code: code });
  };

  runCodeLineByLine = () => {
    const kernel = window.thebeKernel;
    const outputArea = window.outputArea;
    this.codeBlocks = this.getCodeBlocks();
    if (this.executedLine === null) {
      this.showExecutedLine = true;
      this.executedLine = 0;
    } else if (this.executedLine >= this.codeBlocks.length - 1) {
      return;
    } else {
      this.executedLine += 1;
    }
    const block = this.codeBlocks[this.executedLine];
    this.showLineDecoration(block.lineNo);
    outputArea.future = kernel.requestExecute({ code: block.code });
    if (this.executedLine === this.codeBlocks.length - 1) {
      delay(this.restartEditor, 500);
    }
  };

  restartEditor = () => {
    this.codeBlocks = [];
    this.executedLine = null;
    this.showExecutedLine = false;
    this.hideLineDecoration();
  };

  restartKernel = () => {
    const kernel = window.thebeKernel;
    if (kernel) {
      kernel.restart();
    }
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
          <button className="btn btn-danger" onClick={this.restartEditor}>
            Restart Editor
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

export default App;

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
