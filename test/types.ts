import { createStateEngine, type JsonValue, type Patch } from '@shapeshift-labs/frontier-state';
import {
  createApp,
  createDomSchedulerFromRuntime,
  createDomRenderer,
  createDomRendererFromManifest,
  createHtmlTemplate,
  deserializeDomState,
  fromStateEngine,
  readPatchAssignedValue,
  serializeDomState,
  type FrontierDomApp,
  type FrontierDomBinding,
  type FrontierDomHydrationReport,
  type FrontierDomRenderManifestV1,
  type FrontierDomRenderer,
  type FrontierDomSource,
  type FrontierDomWorkSchedulerTask
} from '../dist/index.js';
import {
  createPatchRenderer,
  createPatchSchedulerFromRuntime,
  fromStateEngine as fromStateEngineForPatchRenderer,
  type FrontierPatchWorkSchedulerTask
} from '../dist/core.js';
import { compileFrontierJsx, type FrontierJsxCompileResult } from '../dist/compiler.js';
import {
  createDomDevtoolsInspector,
  createDomDevtoolsSink,
  inspectDomApp,
  inspectDomRenderer,
  type FrontierDomDevtoolsSnapshot
} from '../dist/devtools.js';
import { createRenderLogSink } from '../dist/logging.js';
import { createHydrationBasisEnvelope, renderDomStateScript, streamDomHydrationScript } from '../dist/ssr.js';
import { frontierDomVite, renderFrontierDomHydrationModule, type FrontierDomBuildOptions } from '../dist/vite.js';
import { createJsxManifest, each, fixedLayout as jsxFixedLayout, jsx, text, virtualEach, when } from '../dist/jsx-runtime.js';
import type { FrontierLogger } from '@shapeshift-labs/frontier-logging';
import {
  createFixedLayout,
  createTextLayout,
  createVariableLayout,
  flattenVirtualTree,
  materializeWindowSource,
  virtualize,
  virtualizeFrustum,
  virtualizeGrid,
  virtualizeSpatial,
  type FrontierVirtualLayoutProvider
} from '@shapeshift-labs/frontier-virtual';

const initial: JsonValue = {
  user: { name: 'Frontier' },
  todos: [{ id: 'a', text: 'Alpha', done: false }]
};

const state = createStateEngine(initial, { diff: { arrayKey: 'id' } });
const source: FrontierDomSource = fromStateEngine(state);
const crdtLikeSource: FrontierDomSource = {
  ...source,
  getHeads: () => ['h1'],
  getStateVector: () => ({ actor: 1 })
};
const renderer: FrontierDomRenderer = createDomRenderer({ source });
const domRuntimeScheduler = {
  schedule(task: FrontierDomWorkSchedulerTask): unknown {
    task.run();
    return task;
  }
};
const scheduledRenderer: FrontierDomRenderer = createDomRenderer({
  source,
  scheduler: createDomSchedulerFromRuntime(domRuntimeScheduler)
});
const target = document.createElement('div');
const textNode = document.createTextNode('');
const input = document.createElement('input');
const list = document.createElement('ul');
const slot = document.createElement('section');
const htmlTemplate = createHtmlTemplate(
  '<li><span data-part="text"></span><input data-part="done" type="checkbox"></li>',
  [
    { selector: '[data-part="text"]', text: 'text' },
    {
      selector: '[data-part="done"]',
      prop: { checked: 'done' },
      attr: { 'aria-checked': 'done' },
      class: { 'is-done': 'done' },
      style: { color: () => 'red' }
    }
  ],
  { document }
);

const textBinding: FrontierDomBinding = renderer.text('/user/name', textNode);
const attrBinding = renderer.attr(['user', 'name'], target, 'data-name');
const propBinding = renderer.prop('/todos/0/done', input, 'checked');
const classBinding = renderer.className('/todos/0/done', target, 'is-done');
const styleBinding = renderer.style('/user/name', target, 'color', { format: () => 'red' });
const eventBinding = renderer.event<MouseEvent>(target, 'click', (event) => {
  event.preventDefault();
});
const delegateBinding = renderer.delegate<MouseEvent>(target, 'click', '[data-action]', (event, matched) => {
  event.preventDefault();
  matched.setAttribute('data-seen', 'true');
});
const formBinding = renderer.formValue('/user/name', input, { preserveSelection: true });
const effectBinding = renderer.effect(['/user/name', '/todos/0/text'], ({ values, cleanup }) => {
  const first: JsonValue | undefined = values[0];
  cleanup(() => void first);
});
const whenBinding = renderer.when('/todos/0/done', {
  container: slot,
  create(value, context) {
    const item = document.createElement('strong');
    item.textContent = String(context.visible ? value : '');
    return item;
  },
  fallback: {
    create() {
      return document.createElement('em');
    }
  }
});
const eachBinding = renderer.each('/todos/*', {
  container: list,
  keyBy: 'id',
  fields: ['text', 'done'],
  create(row) {
    const item = document.createElement('li');
    item.textContent = String((row as { text?: string }).text ?? '');
    return item;
  },
  update(node, row) {
    node.textContent = String((row as { text?: string }).text ?? '');
  }
});
const fixedLayout: FrontierVirtualLayoutProvider = createFixedLayout(24);
const textRowLayout = createTextLayout({ field: 'text', font: '14px Inter', lineHeight: 20, width: 240 });
const virtualBinding = renderer.virtualEach('/todos/*', {
  container: list,
  keyBy: 'id',
  viewport: { offset: 0, size: 40 },
  layout: fixedLayout,
  create() {
    return document.createElement('li');
  }
});

const patch: Patch = [[0, ['user', 'name'], 'Ada']];
const assigned: JsonValue | undefined = readPatchAssignedValue(patch, '/user/name');
renderer.commitPatch(patch);
renderer.flush();

const manifest: FrontierDomRenderManifestV1 = {
  version: 1,
  bindings: [
    { id: 'b:user', kind: 'text', path: '/user/name', target: { selector: '[data-user]' } },
    { id: 'a:save', kind: 'event', event: 'click', action: 'save', target: { selector: 'button' }, payload: { id: '/todos/0/id' } },
    {
      id: 'b:when',
      kind: 'when',
      path: '/todos/0/done',
      target: { selector: 'section' },
      template: 'visible',
      fallbackTemplate: 'hidden'
    },
    {
      id: 'b:todos',
      kind: 'each',
      path: '/todos/*',
      fields: ['text'],
      keyBy: 'id',
      container: { selector: 'ul' },
      template: 'todo'
    },
    {
      id: 'b:virtual-todos',
      kind: 'virtualEach',
      path: '/todos/*',
      fields: ['text'],
      keyBy: 'id',
      container: { selector: 'ul' },
      template: 'todo',
      viewport: { offset: 0, size: 80 },
      layout: { kind: 'fixed', itemSize: 20 }
    },
    {
      id: 'b:input',
      kind: 'form',
      path: '/user/name',
      target: { selector: 'input' },
      prop: 'value'
    }
  ]
};

const manifestRenderer = createDomRendererFromManifest({
  source,
  target,
  manifest,
  templates: {
    todo: {
      create() {
        return document.createElement('li');
      }
    },
    htmlTodo: htmlTemplate,
    visible: {
      create() {
        return document.createElement('strong');
      }
    },
    hidden: {
      create() {
        return document.createElement('em');
      }
    }
  },
  actions: {
    save({ source, input, dispatchOptions }) {
      source.commitPatch?.([[0, ['user', 'name'], 'Saved']]);
      const payload: JsonValue = input;
      const cause: string | undefined = dispatchOptions.causeId;
      void payload;
      void cause;
    }
  },
  actionRegistry: {
    commitPatch(patch, options) {
      const actionId: string | undefined = options?.actionId;
      const reads = options?.reads;
      void actionId;
      void reads;
      return (state as { commitPatch(patch: Patch, options?: unknown): unknown }).commitPatch(patch, options?.commitOptions);
    },
    dispatch(actionId, input, options) {
      const id: string = actionId;
      const payload: JsonValue | undefined = input;
      void id;
      void payload;
      void options?.causeId;
      void options?.reads?.[0];
      void options?.writes?.[0];
      void options?.affected?.[0];
    }
  }
});
const serialized = serializeDomState({ manifest, source });
const serializedWithHtml = serializeDomState({ manifest, source: crdtLikeSource, html: '<main></main>' });
deserializeDomState(serialized);

const jsxNode = jsx('span', { frId: 'typed', $text: '/user/name' });
target.appendChild(jsxNode);
target.appendChild(jsx('div', {
  children: [
    jsx('button', { frId: 'typed-action', $action: 'todo.toggle', $payload: { id: '/todos/0/id' } }),
    text('/user/name', { frId: 'name-from-helper' }),
    each('/todos/*', {
      frId: 'todos-from-helper',
      as: 'ul',
      keyBy: 'id',
      template: 'todo',
      fields: ['text']
    }),
    when('/todos/0/done', {
      frId: 'when-from-helper',
      template: 'visible',
      fallbackTemplate: 'hidden'
    }),
    virtualEach('/todos/*', {
      frId: 'virtual-from-helper',
      keyBy: 'id',
      template: 'todo',
      layout: jsxFixedLayout(20),
      viewport: { offset: 0, size: 80 }
    })
  ]
}));
const jsxManifest = createJsxManifest(target);
const compiled: Promise<FrontierJsxCompileResult> = compileFrontierJsx(`
  function Name() { return <span frId="name" $text="/user/name" />; }
  function App() { return <main frId="app"><Name />{each("/todos/*", { frId: "rows", template: "todo" })}</main>; }
`, { source: { kind: 'state' } });

const appRoot = document.createElement('main');
const app: FrontierDomApp = createApp({ source, target: appRoot, templates: manifestRendererTemplates() });
const appRenderer = app.mount(jsx('section', {
  frId: 'typed-app',
  children: [
    text('/user/name', { frId: 'typed-app-name' }),
    each('/todos/*', { frId: 'typed-app-todos', as: 'ul', template: 'todo', keyBy: 'id' })
  ]
}));
const appSnapshot = app.serialize();
let hydrationReport: FrontierDomHydrationReport | null = null;
app.hydrate(serializedWithHtml, {
  metadataPolicy: 'reconcile',
  snapshotPolicy: 'warn',
  anchorPolicy: 'rematerialize',
  onHydrationIssue(issue, report) {
    const kind: string = issue.kind;
    hydrationReport = report;
    void kind;
  },
  onHydrationReport(report) {
    hydrationReport = report;
  }
});
const appBuildEntry = {
  input: 'src/App.tsx',
  entry: 'App',
  hydration: {
    target: '#app',
    sourceImport: './state',
    sourceExport: 'source',
    templatesImport: './templates',
    templatesExport: 'templates'
  }
};
const buildOptions: FrontierDomBuildOptions = {
  entries: { app: appBuildEntry }
};
const vitePlugin = frontierDomVite(buildOptions);
const hydrationCode: string = renderFrontierDomHydrationModule({ html: '<main></main>', manifest: manifest }, appBuildEntry.hydration);

const range = virtualize({
  items: (initial as { todos: JsonValue }).todos,
  keyBy: 'id',
  viewport: { offset: 0, size: 40 },
  layout: textRowLayout
});
const variableLayout = createVariableLayout({ defaultSize: 20, sizes: range.items.map((item) => [item.key, item.size] as [string, number]) });
const grid = virtualizeGrid({
  rowCount: 10,
  columnCount: 10,
  rowLayout: fixedLayout,
  columnLayout: variableLayout,
  viewport: { offset: 0, size: 80, crossOffset: 0, crossSize: 120 }
});
const spatial = virtualizeSpatial([{ key: 'a', x: 0, y: 0, width: 10, height: 10 }], { x: 0, y: 0, width: 20, height: 20 });
const frustum = virtualizeFrustum(
  [{ key: 'a', minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }],
  { planes: [{ x: 1, y: 0, z: 0, w: 10 }] }
);
const tree = flattenVirtualTree([{ key: 'root', value: initial, children: [] }], ['root']);
const windowed = materializeWindowSource(range, {
  readWindow(start, end) {
    return [(initial as { todos: JsonValue }).todos].slice(start, end);
  },
  count() {
    return 1;
  }
});

declare const logger: FrontierLogger;
const trace = createRenderLogSink(logger);
trace({ kind: 'binding-dispose', bindingId: 1, bindingKind: 'text' });
const devtoolsSink = createDomDevtoolsSink();
devtoolsSink({ kind: 'binding-dispose', bindingId: 1, bindingKind: 'text' });
devtoolsSink({ kind: 'patch', phase: 'commit', patchItems: 1, patch, actionId: 'save', causeId: 'test' });
devtoolsSink({
  kind: 'action-dispatch',
  actionId: 'save',
  causeId: 'click:save',
  manifestBindingId: 'a:save',
  event: 'click',
  input: { id: 'a' },
  reads: [['todos', 0, 'id']],
  affected: ['dom.binding:a:save']
});
const devtoolsInspector = createDomDevtoolsInspector({ renderer, actionRegistry: { history: () => [] } });
const inspectedDevtools: FrontierDomDevtoolsSnapshot = devtoolsInspector.inspect({ includeStateSnapshot: true });
const inspected = inspectDomRenderer(renderer);
const inspectedApp = inspectDomApp({ renderer, source, hydrationReport: null });
const basis = createHydrationBasisEnvelope({ manifest, source });
const script = renderDomStateScript({ manifest, source }, { id: 'frontier-state' });
const chunks = Array.from(streamDomHydrationScript(serialized));

const patchRenderer = createPatchRenderer({ source: fromStateEngineForPatchRenderer(state) });
const patchRuntimeScheduler = {
  schedule(task: FrontierPatchWorkSchedulerTask): unknown {
    task.run();
    return task;
  }
};
const scheduledPatchRenderer = createPatchRenderer({
  source: fromStateEngineForPatchRenderer(state),
  scheduler: createPatchSchedulerFromRuntime(patchRuntimeScheduler)
});
const patchBinding = patchRenderer.bind({
  path: '/user/name',
  apply({ value }) {
    const next: JsonValue | undefined = value;
    void next;
  }
});

void textBinding;
void attrBinding;
void propBinding;
void classBinding;
void styleBinding;
void eventBinding;
void delegateBinding;
void formBinding;
void effectBinding;
void whenBinding;
void eachBinding;
void virtualBinding;
void assigned;
void manifestRenderer;
void serialized;
void jsxManifest;
void compiled;
void appRenderer;
void appSnapshot;
void hydrationReport;
void vitePlugin;
void hydrationCode;
void patchBinding;
void scheduledRenderer;
void scheduledPatchRenderer;
void range;
void grid;
void spatial;
void frustum;
void tree;
void windowed;
void devtoolsSink;
void devtoolsInspector;
void inspectedDevtools;
void inspected;
void inspectedApp;
void basis;
void script;
void chunks;

function manifestRendererTemplates() {
  return {
    todo: {
      create() {
        return document.createElement('li');
      }
    },
    visible: {
      create() {
        return document.createElement('strong');
      }
    },
    hidden: {
      create() {
        return document.createElement('em');
      }
    }
  };
}
