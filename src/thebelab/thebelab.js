import $ from 'jquery';
import CodeMirror from 'codemirror/lib/codemirror';
import 'codemirror/lib/codemirror.css';

import { Widget } from '@phosphor/widgets';
import { Session } from '@jupyterlab/services';
import { ServerConnection } from '@jupyterlab/services';
import { MathJaxTypesetter } from '@jupyterlab/mathjax2';
import { OutputArea, OutputAreaModel } from '@jupyterlab/outputarea';
import {
  RenderMimeRegistry,
  standardRendererFactories
} from '@jupyterlab/rendermime';
import {
  WIDGET_MIMETYPE,
  WidgetRenderer
} from '@jupyter-widgets/html-manager/lib/output_renderers';
import { ThebeManager } from './manager';
import { requireLoader } from '@jupyter-widgets/html-manager';

import '@jupyterlab/theme-light-extension/style/index.css';
import '@jupyter-widgets/controls/css/widgets-base.css';
import './index.css';

// Exposing @jupyter-widgets/base and @jupyter-widgets/controls as amd
// modules for custom widget bundles that depend on it.

import * as base from '@jupyter-widgets/base';
import * as controls from '@jupyter-widgets/controls';
import delay from 'lodash/delay';

if (typeof window !== 'undefined' && typeof window.define !== 'undefined') {
  window.define('@jupyter-widgets/base', base);
  window.define('@jupyter-widgets/controls', controls);
}

// make CodeMirror public for loading additional themes
if (typeof window !== 'undefined') {
  window.CodeMirror = CodeMirror;
  window.jQuery = $;
  window.$ = $;
}

// events
const events = $({});

// options
const _defaultOptions = {
  bootstrap: true,
  preRenderHook: false,
  stripPrompts: false,
  requestKernel: true,
  predefinedOutput: false,
  mathjaxUrl: 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/MathJax.js',
  mathjaxConfig: 'TeX-AMS_CHTML-full,Safe',
  selector: '[data-executable]',
  outputSelector: '[data-output]',
  binderOptions: {
    ref: 'master',
    binderUrl: 'https://mybinder.org'
  },
  kernelOptions: {
    name: 'python3',
    path: '/',
    serverSettings: {
      baseUrl: 'http://127.0.0.1:8888',
      wsUrl: 'ws://127.0.0.1:8888',
      token: 'test-secret'
    }
  }
};

function mergeOptions(options) {
  // merge options from various sources
  // call > page > defaults
  let merged = {};
  $.extend(true, merged, _defaultOptions);
  if (options) $.extend(true, merged, options);
  return merged;
}

let _renderers = undefined;
function getRenderers(options) {
  if (!_renderers) {
    _renderers = standardRendererFactories.filter(f => {
      // filter out latex renderer if mathjax is unavailable
      if (f.mimeTypes.indexOf('text/latex') >= 0) {
        if (options.mathjaxUrl) {
          return true;
        } else {
          console.log('MathJax unavailable');
          return false;
        }
      } else {
        return true;
      }
    });
  }
  return _renderers;
}
// rendering cells

function renderCell(element, options) {
  // render a single cell
  // element should be a `<pre>` tag with some code in it
  let mergedOptions = mergeOptions({ options });
  let $cell = $("<div class='thebelab-cell'/>");
  let $element = $(element);
  let renderers = {
    initialFactories: getRenderers(mergedOptions)
  };
  if (mergedOptions.mathjaxUrl) {
    renderers.latexTypesetter = new MathJaxTypesetter({
      url: mergedOptions.mathjaxUrl,
      config: mergedOptions.mathjaxConfig
    });
  }
  let renderMime = new RenderMimeRegistry(renderers);

  let manager = options.manager;

  renderMime.addFactory(
    {
      safe: false,
      mimeTypes: [WIDGET_MIMETYPE],
      createRenderer: options => new WidgetRenderer(options, manager)
    },
    1
  );

  let model = new OutputAreaModel({ trusted: true });

  let outputArea = new OutputArea({
    model: model,
    rendermime: renderMime
  });

  $element.replaceWith($cell);

  $cell.append(
    $("<button class='thebelab-button thebelab-run-button'>")
      .text('run')
      .attr('title', 'run this cell')
      .click(execute)
  );
  $cell.append(
    $("<button class='thebelab-button thebelab-run-line-button'>")
      .text('run line')
      .attr('title', 'run this cell line by line')
      .click(execute_line)
  );

  let kernelResolve, kernelReject;
  let kernelPromise = new Promise((resolve, reject) => {
    kernelResolve = resolve;
    kernelReject = reject;
  });
  kernelPromise.then(kernel => {
    $cell.data('kernel', kernel);
    manager.registerWithKernel(kernel);
    return kernel;
  });
  $cell.data('kernel-promise-resolve', kernelResolve);
  $cell.data('kernel-promise-reject', kernelReject);

  function execute() {
    let kernel = $cell.data('kernel');
    let code = window.python_code;
    if (!kernel) {
      console.debug('No kernel connected');
      outputArea.model.clear();
      outputArea.model.add({
        output_type: 'stream',
        name: 'stdout',
        text: 'Waiting for kernel...'
      });
      events.trigger('request-kernel');
    }
    kernelPromise.then(kernel => {
      outputArea.future = kernel.requestExecute({ code: code });
    });
    return false;
  }

  function execute_line() {
    let kernel = $cell.data('kernel');
    let code = window.python_code;
    if (!kernel) {
      console.debug('No kernel connected');
      outputArea.model.clear();
      outputArea.model.add({
        output_type: 'stream',
        name: 'stdout',
        text: 'Waiting for kernel...'
      });
      events.trigger('request-kernel');
    }
    const lines = code
      .split('\n')
      .filter(line => line.trim().length > 0 && !line.startsWith('#'));
    let buffer = [];
    const execute_code = [];
    lines.forEach((line, index) => {
      if (buffer.length === 0) {
        if (index === lines.length - 1) {
          execute_code.push(line);
        } else if (line.endsWith(':')) {
          buffer.push(line);
        } else {
          execute_code.push(line);
        }
        return;
      } else {
        if (line.startsWith(' ')) {
          buffer.push(line);
        } else {
          execute_code.push(buffer.join('\n'));
          buffer = [];
          execute_code.push(line);
        }
      }
    });
    let modelOutput = [];
    execute_code.forEach((line, index) => {
      const delayFunc = function(number) {
        kernelPromise.then(kernel => {
          if (number === 0) {
            outputArea.model.clear();
            modelOutput = [];
          } else {
            modelOutput = [...modelOutput, ...outputArea.model.toJSON()];
          }
          outputArea.future = kernel.requestExecute({ code: line });
          if (number === execute_code.length - 1) {
            delay(() => {
              modelOutput = [...modelOutput, ...outputArea.model.toJSON()];
              outputArea.model.fromJSON(modelOutput);
            }, 100);
          }
        });
      };
      delay(delayFunc.bind(this, index), index * 500);
    });
    return false;
  }

  const theDiv = document.createElement('div');
  $cell.append(theDiv);
  Widget.attach(outputArea, theDiv);

  return $cell;
}

function renderAllCells({ selector = _defaultOptions.selector } = {}) {
  // render all elements matching `selector` as cells.
  // by default, this is all cells with `data-executable`

  let manager = new ThebeManager({
    loader: requireLoader
  });

  return $(selector).map((i, cell) =>
    renderCell(cell, {
      manager: manager
    })
  );
}

function hookupKernel(kernel, cells) {
  cells.map((i, cell) => {
    $(cell).data('kernel-promise-resolve')(kernel);
    return true;
  });
}

// requesting Kernels
function requestKernel(kernelOptions) {
  // request a new Kernel
  kernelOptions = mergeOptions({ kernelOptions }).kernelOptions;
  if (kernelOptions.serverSettings) {
    kernelOptions.serverSettings = ServerConnection.makeSettings(
      kernelOptions.serverSettings
    );
  }
  events.trigger('status', {
    status: 'starting',
    message: 'Starting Kernel'
  });
  let p = Session.startNew(kernelOptions);
  p.then(session => {
    events.trigger('status', {
      status: 'ready',
      message: 'Kernel is ready'
    });
    let k = session.kernel;
    return k;
  });
  return p;
}

export function bootstrap(options) {
  options = mergeOptions(options);
  const cells = renderAllCells({
    selector: options.selector
  });
  const kernelPromise = requestKernel(options.kernelOptions);
  kernelPromise.then(session => {
    const kernel = session.kernel;
    // debug
    if (typeof window !== 'undefined') {
      window.thebeKernel = kernel;
    }
    hookupKernel(kernel, cells);
  });
  return kernelPromise;
}
