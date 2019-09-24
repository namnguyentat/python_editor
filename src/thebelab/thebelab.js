import $ from 'jquery';
import CodeMirror from 'codemirror/lib/codemirror';
import 'codemirror/lib/codemirror.css';

import { Widget } from '@phosphor/widgets';
import { Session } from '@jupyterlab/services';
import { ServerConnection, ContentsManager } from '@jupyterlab/services';
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
      baseUrl: 'http://localhost:8888',
      wsUrl: 'ws://localhost:8888',
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

function renderCell(element, options) {
  // render a single cell
  // element should be a `<pre>` tag with some code in it
  const $cell = $('#output-area');
  const mergedOptions = mergeOptions({ options });
  const renderers = {
    initialFactories: getRenderers(mergedOptions)
  };
  if (mergedOptions.mathjaxUrl) {
    renderers.latexTypesetter = new MathJaxTypesetter({
      url: mergedOptions.mathjaxUrl,
      config: mergedOptions.mathjaxConfig
    });
  }
  const model = new OutputAreaModel({ trusted: true });
  const renderMime = new RenderMimeRegistry(renderers);
  const manager = options.manager;

  renderMime.addFactory(
    {
      safe: false,
      mimeTypes: [WIDGET_MIMETYPE],
      createRenderer: options => new WidgetRenderer(options, manager)
    },
    1
  );

  const outputArea = new OutputArea({
    model: model,
    rendermime: renderMime
  });

  const theDiv = document.createElement('div');
  $cell.append(theDiv);
  Widget.attach(outputArea, theDiv);

  window.outputArea = outputArea;

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
  let contents = new ContentsManager(kernelOptions);
  window.contents = contents;
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
  renderAllCells({
    selector: options.selector
  });
  const kernelPromise = requestKernel(options.kernelOptions);
  kernelPromise.then(session => {
    const kernel = session.kernel;
    window.thebeKernel = kernel;
  });
  return kernelPromise;
}
