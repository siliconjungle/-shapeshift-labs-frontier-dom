import assert from 'node:assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { OP_ARRAY_OBJECT_FIELD_ASSIGN } from '@shapeshift-labs/frontier/constants';
import { createStateEngine } from '@shapeshift-labs/frontier-state';
import { createLogger } from '@shapeshift-labs/frontier-logging';
import {
  createApp,
  createDomSchedulerFromRuntime,
  createDomRenderer,
  createDomRendererFromManifest,
  deserializeDomState,
  fromStateEngine,
  hydrateDomRenderer,
  readPatchAssignedValue,
  serializeDomState
} from '../dist/index.js';
import { createPatchRenderer, createPatchSchedulerFromRuntime, fromStateEngine as fromStateEngineForPatchRenderer } from '../dist/core.js';
import { compileFrontierJsx } from '../dist/compiler.js';
import { createDomDevtoolsSink, inspectDomRenderer } from '../dist/devtools.js';
import { createRenderLogSink } from '../dist/logging.js';
import { parseDomHydrationScript, renderDomHydrationScript, streamDomHydrationScript } from '../dist/ssr.js';
import { compileFrontierDomBuildEntries, frontierDomVite, renderFrontierDomHydrationModule } from '../dist/vite.js';
import {
  Fragment,
  createJsxManifest,
  each as jsxEach,
  fixedLayout as jsxFixedLayout,
  jsx,
  text as jsxText,
  textLayout as jsxTextLayout,
  virtualEach as jsxVirtualEach,
  when as jsxWhen
} from '../dist/jsx-runtime.js';
import {
  createFixedLayout,
  createVariableLayout,
  flattenVirtualTree,
  materializeWindowSource,
  virtualize,
  virtualizeFrustum,
  virtualizeGrid,
  virtualizeSpatial
} from '@shapeshift-labs/frontier-virtual';

const dom = new JSDOM('<!doctype html><div id="app"><ul id="todos"></ul><button id="save"></button></div>');
const { document, Event } = dom.window;
const app = document.getElementById('app');
const list = document.getElementById('todos');
const name = document.createTextNode('');
const status = document.createElement('span');
const input = document.createElement('input');
const panel = document.createElement('section');
const gate = document.createElement('div');
const save = document.getElementById('save');
app.prepend(gate);
app.prepend(panel);
app.prepend(input);
app.prepend(status);
app.prepend(name);

const state = createStateEngine(
  {
    user: { name: 'Frontier' },
    settings: { theme: 'light', enabled: true, accent: 'red' },
    todos: [
      { id: 'a', text: 'Alpha', done: false },
      { id: 'b', text: 'Beta', done: true }
    ]
  },
  { diff: { arrayKey: 'id' } }
);

let effectRuns = 0;
let effectCleanups = 0;
const renderer = createDomRenderer({ source: fromStateEngine(state), target: app, trace: true });

renderer.mount(({ text, attr, prop, className, style, event, effect, when, each }) => {
  text('/user/name', name);
  attr('/settings/theme', status, 'data-theme');
  prop('/settings/enabled', input, 'checked');
  className('/settings/enabled', panel, 'is-enabled');
  style('/settings/accent', panel, 'color');
  event(save, 'click', () => {
    state.commitPatch([[0, ['user', 'name'], 'Clicked']]);
  });
  effect(['/settings/theme', '/user/name'], ({ values, cleanup }) => {
    effectRuns++;
    document.documentElement.dataset.theme = String(values[0] ?? '');
    document.documentElement.dataset.user = String(values[1] ?? '');
    cleanup(() => {
      effectCleanups++;
      delete document.documentElement.dataset.theme;
      delete document.documentElement.dataset.user;
    });
  });
  when('/settings/enabled', {
    container: gate,
    create(value) {
      const item = document.createElement('strong');
      item.textContent = 'enabled:' + String(value);
      return item;
    },
    update(node, value) {
      node.textContent = 'enabled:' + String(value);
    },
    fallback: {
      create() {
        const item = document.createElement('em');
        item.textContent = 'disabled';
        return item;
      }
    }
  });
  each('/todos/*', {
    container: list,
    keyBy: 'id',
    fields: ['text', 'done'],
    create(row) {
      const item = document.createElement('li');
      item.dataset.id = row.id;
      item.textContent = formatTodo(row);
      return item;
    },
    update(node, row) {
      node.textContent = formatTodo(row);
    }
  });
});

assert.strictEqual(name.data, 'Frontier');
assert.strictEqual(status.getAttribute('data-theme'), 'light');
assert.strictEqual(input.checked, true);
assert.strictEqual(panel.classList.contains('is-enabled'), true);
assert.strictEqual(panel.style.color, 'red');
assert.strictEqual(gate.textContent, 'enabled:true');
assert.deepStrictEqual(readTodoList(), ['a:Alpha:open', 'b:Beta:done']);
assert.strictEqual(effectRuns, 1);
assert.strictEqual(document.documentElement.dataset.theme, 'light');

state.commitPatch([[0, ['user', 'name'], 'Ada']]);
renderer.flush();
assert.strictEqual(name.data, 'Ada');
assert.strictEqual(document.documentElement.dataset.user, 'Ada');
assert.strictEqual(effectRuns, 2);
assert.strictEqual(effectCleanups, 1);

state.commitPatch([[0, ['settings', 'enabled'], false]]);
renderer.flush();
assert.strictEqual(input.checked, false);
assert.strictEqual(panel.classList.contains('is-enabled'), false);
assert.strictEqual(gate.textContent, 'disabled');

state.commitPatch([[0, ['settings', 'theme'], null]]);
renderer.flush();
assert.strictEqual(status.hasAttribute('data-theme'), false);
assert.strictEqual(document.documentElement.dataset.theme, '');

state.commitPatch([[0, ['todos', 1, 'text'], 'Beta updated']]);
renderer.flush();
assert.deepStrictEqual(readTodoList(), ['a:Alpha:open', 'b:Beta updated:done']);

state.commit({
  user: { name: 'Ada' },
  settings: { theme: null, enabled: true, accent: 'red' },
  todos: [
    { id: 'b', text: 'Beta updated', done: true },
    { id: 'a', text: 'Alpha', done: false },
    { id: 'c', text: 'Gamma', done: false }
  ]
});
renderer.flush();
assert.strictEqual(gate.textContent, 'enabled:true');
assert.deepStrictEqual(readTodoList(), ['b:Beta updated:done', 'a:Alpha:open', 'c:Gamma:open']);

save.dispatchEvent(new Event('click'));
renderer.flush();
assert.strictEqual(name.data, 'Clicked');

const assigned = readPatchAssignedValue(
  [[OP_ARRAY_OBJECT_FIELD_ASSIGN, ['todos'], [1], [['text']], ['Patched']]],
  '/todos/1/text'
);
assert.strictEqual(assigned, 'Patched');

const trace = renderer.getTrace();
assert.ok(trace.some((event) => event.kind === 'binding-dirty'));
assert.ok(trace.some((event) => event.kind === 'dom-write' && event.bindingKind === 'each'));
assert.ok(renderer.size >= 9);

renderer.dispose();
state.commitPatch([[0, ['user', 'name'], 'Disposed']]);
renderer.flush();
assert.strictEqual(name.data, 'Clicked');
assert.strictEqual(effectCleanups, 4);

runManifestHydrationSmoke();
runHydrationReconciliationSmoke();
runJsxManifestSmoke();
await runCompilerSmoke();
await runVitePluginSmoke();
await runAppApiSmoke();
runVirtualDomSmoke();
await runVirtualPrimitivesSmoke();
runDelegatedFormSmoke();
runSsrAndDevtoolsSmoke();
runRenderLogSinkSmoke();
runPatchRendererSmoke();
runSchedulerAdaptersSmoke();

console.log('frontier dom smoke passed');

function formatTodo(row) {
  return row.id + ':' + row.text + ':' + (row.done ? 'done' : 'open');
}

function readTodoList() {
  return Array.from(list.children, (item) => item.textContent);
}

function runManifestHydrationSmoke() {
  const dom = new JSDOM(
    '<!doctype html><main id="app">' +
      '<span data-frontier-id="user-name">SSR</span>' +
      '<button data-frontier-id="rename"></button>' +
      '<button data-frontier-id="toggle" data-frontier-action-payload="{&quot;id&quot;:&quot;a&quot;}"></button>' +
      '<section data-frontier-id="feature-slot"></section>' +
      '<ul data-frontier-id="todos"><li data-frontier-key="a">SSR row</li></ul>' +
    '</main>'
  );
  const { document, Event } = dom.window;
  const app = document.getElementById('app');
  const existingRow = app.querySelector('[data-frontier-key="a"]');
  const hydrateState = createStateEngine(
    {
      user: { name: 'Hydrated' },
      feature: { visible: true },
      todos: [
        { id: 'a', text: 'Alpha', done: false },
        { id: 'b', text: 'Beta', done: true }
      ]
    },
    { diff: { arrayKey: 'id' } }
  );
  const hydrateBasis = typeof hydrateState.getBasis === 'function' ? hydrateState.getBasis() : undefined;
  const manifest = {
    version: 1,
    source: { kind: 'state', basis: hydrateBasis },
    bindings: [
      { id: 'b:user-name', kind: 'text', path: '/user/name', target: { anchor: 'user-name' } },
      { id: 'a:rename', kind: 'event', event: 'click', action: 'user.rename', target: { anchor: 'rename' } },
      { id: 'a:toggle', kind: 'event', event: 'click', action: 'todo.toggle', target: { anchor: 'toggle' } },
      {
        id: 'b:feature',
        kind: 'when',
        path: '/feature/visible',
        target: { anchor: 'feature-slot' },
        template: 'feature-on.v1',
        fallbackTemplate: 'feature-off.v1'
      },
      {
        id: 'b:todos',
        kind: 'each',
        path: '/todos/*',
        fields: ['text', 'done'],
        keyBy: 'id',
        container: { anchor: 'todos' },
        template: 'todo-row.v1'
      }
    ]
  };
  const hydrated = hydrateDomRenderer({
    source: fromStateEngine(hydrateState),
    target: app,
    manifest,
    templates: {
      'todo-row.v1': {
        create(row) {
          const item = document.createElement('li');
          item.textContent = formatTodo(row);
          return item;
        },
        update(node, row) {
          node.textContent = formatTodo(row);
        }
      },
      'feature-on.v1': {
        create() {
          const item = document.createElement('strong');
          item.textContent = 'on';
          return item;
        }
      },
      'feature-off.v1': {
        create() {
          const item = document.createElement('em');
          item.textContent = 'off';
          return item;
        }
      }
    },
    actions: {
      'user.rename': ({ source }) => {
        source.commitPatch?.([[0, ['user', 'name'], 'Manifest Action']]);
      }
    },
    actionRegistry: {
      dispatch(actionId, input, options) {
        assert.strictEqual(actionId, 'todo.toggle');
        assert.deepStrictEqual(input.payload, { id: 'a' });
        assert.strictEqual(options.causeId, 'frontier-dom:a:toggle:click');
        hydrateState.commitPatch([[0, ['todos', 0, 'done'], true]]);
      }
    }
  });
  assert.strictEqual(app.querySelector('[data-frontier-id="user-name"]').textContent, 'Hydrated');
  assert.strictEqual(app.querySelector('[data-frontier-id="feature-slot"]').textContent, 'on');
  assert.strictEqual(app.querySelector('[data-frontier-key="a"]'), existingRow);
  assert.deepStrictEqual(Array.from(app.querySelectorAll('li'), (item) => item.textContent), ['a:Alpha:open', 'b:Beta:done']);

  hydrateState.commitPatch([[0, ['todos', 1, 'text'], 'Beta hydrated']]);
  hydrated.flush();
  assert.deepStrictEqual(Array.from(app.querySelectorAll('li'), (item) => item.textContent), ['a:Alpha:open', 'b:Beta hydrated:done']);

  app.querySelector('[data-frontier-id="rename"]').dispatchEvent(new Event('click'));
  hydrated.flush();
  assert.strictEqual(app.querySelector('[data-frontier-id="user-name"]').textContent, 'Manifest Action');

  app.querySelector('[data-frontier-id="toggle"]').dispatchEvent(new Event('click'));
  hydrated.flush();
  assert.deepStrictEqual(Array.from(app.querySelectorAll('li'), (item) => item.textContent), ['a:Alpha:done', 'b:Beta hydrated:done']);

  hydrateState.commitPatch([[0, ['feature', 'visible'], false]]);
  hydrated.flush();
  assert.strictEqual(app.querySelector('[data-frontier-id="feature-slot"]').textContent, 'off');

  const serialized = serializeDomState({ manifest, source: fromStateEngine(hydrateState) });
  const serializedBasis = typeof hydrateState.getBasis === 'function' ? hydrateState.getBasis() : hydrateBasis;
  assert.strictEqual(serialized.kind, 'frontier.dom.state');
  assert.strictEqual(serialized.source.basis, serializedBasis);
  assert.deepStrictEqual(deserializeDomState(JSON.stringify(serialized)).manifest.bindings.map((binding) => binding.id), [
    'b:user-name',
    'a:rename',
    'a:toggle',
    'b:feature',
    'b:todos'
  ]);
  hydrated.dispose();
  dom.window.close();
}

function runHydrationReconciliationSmoke() {
  const serverHtml =
    '<main data-frontier-id="panel">' +
      '<span data-frontier-id="kept">server kept</span>' +
      '<span data-frontier-id="name">Server</span>' +
      '<ul data-frontier-id="todos"><li data-frontier-key="a">server:a</li></ul>' +
    '</main>';
  const dom = new JSDOM(
    '<!doctype html><div id="app">' +
      '<main data-frontier-id="panel">' +
        '<span data-frontier-id="kept">server kept</span>' +
        '<div data-frontier-id="todos"></div>' +
      '</main>' +
    '</div>'
  );
  const root = dom.window.document.getElementById('app');
  const kept = root.querySelector('[data-frontier-id="kept"]');
  const clientState = createStateEngine(
    {
      user: { name: 'Client' },
      todos: [
        { id: 'a', text: 'Client A', done: false },
        { id: 'b', text: 'Client B', done: true }
      ]
    },
    { diff: { arrayKey: 'id' } }
  );
  const baseSource = fromStateEngine(clientState);
  const source = {
    ...baseSource,
    getBasis: () => 'client-basis',
    getHeads: () => ['h2'],
    getStateVector: () => ({ actor: 2 })
  };
  const manifest = {
    version: 1,
    root: { anchor: 'panel' },
    source: { kind: 'crdt', basis: 'server-basis', heads: ['h1'], stateVector: { actor: 1 } },
    bindings: [
      { id: 'b:name', kind: 'text', path: '/user/name', target: { anchor: 'name' } },
      {
        id: 'b:todos',
        kind: 'each',
        path: '/todos/*',
        fields: ['text', 'done'],
        keyBy: 'id',
        container: { anchor: 'todos' },
        template: 'todo-row.v1'
      }
    ]
  };
  const serialized = serializeDomState({
    manifest,
    html: serverHtml,
    snapshot: { user: { name: 'Server' }, todos: [{ id: 'a', text: 'Server A', done: false }] }
  });
  assert.deepStrictEqual(serialized.source.heads, ['h1']);
  assert.deepStrictEqual(serialized.source.stateVector, { actor: 1 });
  let report;
  const issues = [];
  const app = createApp({
    source,
    target: root,
    templates: {
      'todo-row.v1': {
        create(row) {
          const item = dom.window.document.createElement('li');
          item.textContent = formatTodo(row);
          return item;
        },
        update(node, row) {
          node.textContent = formatTodo(row);
        }
      }
    }
  });
  app.hydrate(serialized, {
    onHydrationIssue(issue) {
      issues.push(issue.kind);
    },
    onHydrationReport(nextReport) {
      report = nextReport;
    }
  });
  assert.strictEqual(root.querySelector('[data-frontier-id="kept"]'), kept);
  assert.strictEqual(root.querySelector('[data-frontier-id="name"]').textContent, 'Client');
  assert.strictEqual(root.querySelector('[data-frontier-id="todos"]').localName, 'ul');
  assert.deepStrictEqual(
    Array.from(root.querySelectorAll('[data-frontier-id="todos"] li'), (item) => item.textContent),
    ['a:Client A:open', 'b:Client B:done']
  );
  for (const kind of ['basis', 'snapshot', 'heads', 'stateVector', 'missing-anchor', 'stale-anchor', 'rematerialized-anchor']) {
    assert.ok(issues.includes(kind), 'expected hydration issue: ' + kind);
  }
  assert.deepStrictEqual(report.missingAnchors, ['name']);
  assert.deepStrictEqual(report.staleAnchors, ['todos']);
  assert.ok(report.rematerializedAnchors.includes('name'));
  assert.ok(report.rematerializedAnchors.includes('todos'));
  assert.strictEqual(app.hydrationReport, report);
  clientState.commitPatch([[0, ['user', 'name'], 'Client Updated']]);
  app.flush();
  assert.strictEqual(root.querySelector('[data-frontier-id="name"]').textContent, 'Client Updated');
  app.dispose();
  dom.window.close();
}

function runJsxManifestSmoke() {
  const dom = new JSDOM('<!doctype html><section id="root"></section>');
  const previousDocument = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    const root = dom.window.document.getElementById('root');
    root.appendChild(
      jsx('div', {
        frId: 'panel',
        children: [
          jsx('span', { frId: 'label', $text: '/user/name' }),
          jsx('button', { frId: 'save-action', $on: { click: 'save.user' } }),
          jsx('ul', {
            frId: 'todo-list',
            $each: {
              path: '/todos/*',
              fields: ['text'],
              keyBy: 'id',
              template: 'todo-row.v1'
            }
          }),
          jsxText('/user/name', { frId: 'helper-label' }),
          jsxWhen('/feature/visible', {
            frId: 'feature-slot',
            template: 'feature-on.v1',
            fallbackTemplate: 'feature-off.v1'
          }),
          jsxVirtualEach('/todos/*', {
            frId: 'virtual-todos',
            fields: ['text'],
            keyBy: 'id',
            template: 'todo-row.v1',
            viewport: { offset: 0, size: 24 },
            layout: jsxTextLayout({ field: 'text', font: '12px Inter', lineHeight: 12, width: 120 }),
            overscan: 0
          }),
          jsx(Fragment, {
            children: jsxText('/user/name', { frId: 'fragment-label' })
          }),
          jsx('svg', {
            frId: 'icon',
            viewBox: '0 0 10 10',
            children: jsx('circle', {
              frId: 'dot',
              cx: 5,
              cy: 5,
              $attr: { r: '/radius' }
            })
          })
        ]
      })
    );
    const manifest = createJsxManifest(root, { root: { anchor: 'panel' }, source: { kind: 'state' } });
    assert.deepStrictEqual(manifest.bindings.map((binding) => binding.kind), ['text', 'event', 'each', 'text', 'when', 'virtualEach', 'text', 'attr']);
    const jsxState = createStateEngine({ user: { name: 'JSX' }, feature: { visible: true }, radius: 4, todos: [{ id: 'x', text: 'Row X' }] }, { diff: { arrayKey: 'id' } });
    const renderer = createDomRendererFromManifest({
      source: fromStateEngine(jsxState),
      target: root,
      manifest,
      templates: {
        'todo-row.v1': {
          create(row) {
            const item = dom.window.document.createElement('li');
            item.textContent = row.text;
            return item;
          }
        },
        'feature-on.v1': {
          create() {
            const item = dom.window.document.createElement('strong');
            item.textContent = 'feature on';
            return item;
          }
        },
        'feature-off.v1': {
          create() {
            const item = dom.window.document.createElement('em');
            item.textContent = 'feature off';
            return item;
          }
        }
      },
      actions: {
        'save.user': ({ source }) => source.commitPatch?.([[0, ['user', 'name'], 'Saved JSX']])
      }
    });
    assert.strictEqual(root.querySelector('[data-frontier-id="label"]').textContent, 'JSX');
    assert.strictEqual(root.querySelector('[data-frontier-id="fragment-label"]').textContent, 'JSX');
    assert.strictEqual(root.querySelector('[data-frontier-id="icon"]').namespaceURI, 'http://www.w3.org/2000/svg');
    assert.strictEqual(root.querySelector('[data-frontier-id="dot"]').getAttribute('r'), '4');
    assert.strictEqual(root.querySelector('[data-frontier-id="feature-slot"]').textContent, 'feature on');
    jsxState.commitPatch([[0, ['radius'], 6]]);
    renderer.flush();
    assert.strictEqual(root.querySelector('[data-frontier-id="dot"]').getAttribute('r'), '6');
    jsxState.commitPatch([[0, ['feature', 'visible'], false]]);
    renderer.flush();
    assert.strictEqual(root.querySelector('[data-frontier-id="feature-slot"]').textContent, 'feature off');
    root.querySelector('[data-frontier-id="save-action"]').dispatchEvent(new dom.window.Event('click'));
    renderer.flush();
    assert.strictEqual(root.querySelector('[data-frontier-id="label"]').textContent, 'Saved JSX');
    renderer.dispose();
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    dom.window.close();
  }
}

async function runCompilerSmoke() {
  const compiled = await compileFrontierJsx(`
    function UserName() {
      return <span frId="component-name" $text="/user/name" />;
    }

    function App() {
      return (
        <main frId="panel">
          <UserName />
          {each("/todos/*", { frId: "helper-todos", as: "ul", fields: ["text"], keyBy: "id", template: "todo-row.v1" })}
          {virtualEach("/todos/*", {
            frId: "fixed-virtual-todos",
            fields: ["text"],
            keyBy: "id",
            template: "todo-row.v1",
            viewport: { offset: 0, size: 48 },
            layout: fixedLayout(12),
            overscan: 1
          })}
        </main>
      );
    }

    const view = (
      <main frId="panel">
        <span frId="name" $text="/user/name" />
        <button frId="save" $on={{ click: "save.user" }} />
        <input frId="name-input" $form={{ path: "/user/name", prop: "value" }} />
        <ul frId="todos" $each={{ path: "/todos/*", fields: ["text"], keyBy: "id", template: "todo-row.v1" }} />
        {text("/user/name", { frId: "helper-name" })}
        {when("/feature/visible", {
          frId: "feature-slot",
          template: "feature-on.v1",
          fallbackTemplate: "feature-off.v1"
        })}
        {virtualEach("/todos/*", {
          frId: "virtual-todos",
          fields: ["text"],
          keyBy: "id",
          template: "todo-row.v1",
          viewport: { offset: 0, size: 48 },
          layout: textLayout({ field: "text", font: "12px Inter", lineHeight: 12, width: 120 }),
          overscan: 1
        })}
      </main>
    );
  `, { entry: 'view', source: { kind: 'state', basis: 1 } });
  assert.deepStrictEqual(compiled.diagnostics, []);
  assert.ok(compiled.html.includes('data-frontier-id="panel"'));
  assert.ok(compiled.html.includes('data-frontier-id="virtual-todos"'));
  assert.deepStrictEqual(
    compiled.manifest.bindings.map((binding) => binding.kind),
    ['text', 'event', 'form', 'each', 'text', 'when', 'virtualEach']
  );
  assert.strictEqual(compiled.manifest.source.basis, 1);
  assert.strictEqual(compiled.manifest.bindings.at(-1).layout.kind, 'text');

  const appCompiled = await compileFrontierJsx(`
    function Name() {
      return <span frId="name" $text="/user/name" />;
    }
    const RowList = () => (
      <ul
        frId="todos"
        $each={{ path: "/todos/*", fields: ["text"], keyBy: "id", template: "todo-row.v1" }}
      />
    );
    function App() {
      return (
        <section frId="app">
          <Name />
          <RowList />
          {virtualEach("/todos/*", {
            frId: "virtual",
            template: "todo-row.v1",
            keyBy: "id",
            viewport: { offset: 0, size: 24 },
            layout: fixedLayout(12)
          })}
        </section>
      );
    }
  `, { entry: 'App' });
  assert.deepStrictEqual(appCompiled.diagnostics, []);
  assert.ok(appCompiled.html.includes('data-frontier-id="name"'));
  assert.ok(appCompiled.html.includes('data-frontier-id="todos"'));
  assert.deepStrictEqual(appCompiled.manifest.bindings.map((binding) => binding.kind), ['text', 'each', 'virtualEach']);
  assert.strictEqual(appCompiled.manifest.bindings.at(-1).layout.kind, 'fixed');

  const propsCompiled = await compileFrontierJsx(`
    function Field(props) {
      return (
        <label frId={props.hostId} className={props.className}>
          <span>{props.label}</span>
          {text(props.path, { frId: props.valueId })}
          {props.children}
        </label>
      );
    }
    const Rows = ({ hostId, path, template }) => (
      <ul frId={hostId} $each={{ path, fields: ["text"], keyBy: "id", template }} />
    );
    function App() {
      return (
        <section frId="props-app">
          <Field hostId="name-field" valueId="name-value" className="field" label="Name" path="/user/name">
            <small>required</small>
          </Field>
          <Rows hostId="props-todos" path="/todos/*" template="todo-row.v1" />
        </section>
      );
    }
  `, { entry: 'App' });
  assert.deepStrictEqual(propsCompiled.diagnostics, []);
  assert.ok(propsCompiled.html.includes('data-frontier-id="name-field"'));
  assert.ok(propsCompiled.html.includes('<span>Name</span>'));
  assert.ok(propsCompiled.html.includes('<small>required</small>'));
  assert.ok(propsCompiled.html.includes('class="field"'));
  assert.deepStrictEqual(propsCompiled.manifest.bindings.map((binding) => binding.kind), ['text', 'each']);
  assert.strictEqual(propsCompiled.manifest.bindings[0].target.anchor, 'name-value');
  assert.strictEqual(propsCompiled.manifest.bindings[1].container.anchor, 'props-todos');

  const diagnosticCompiled = await compileFrontierJsx(`
    function Loop() {
      return <Loop />;
    }
    function App() {
      return <main><Unknown /><Loop /><section {...props} /></main>;
    }
  `, { entry: 'App' });
  assert.deepStrictEqual(
    diagnosticCompiled.diagnostics.map((diagnostic) => diagnostic.code).filter(Boolean).sort(),
    ['FRONTIER_JSX_RECURSIVE_COMPONENT', 'FRONTIER_JSX_SPREAD_ATTR', 'FRONTIER_JSX_UNKNOWN_COMPONENT']
  );
}

async function runVitePluginSmoke() {
  const dir = await mkdtemp(join(tmpdir(), 'frontier-dom-vite-'));
  try {
    await writeFile(join(dir, 'App.tsx'), `
      function Name({ id, path, children }) {
        return <h1 frId={id}>{text(path, { frId: "name" })}{children}</h1>;
      }
      function App() {
        return (
          <main frId="app">
            <Name id="heading" path="/user/name"><small>online</small></Name>
            {each("/todos/*", { frId: "todos", as: "ul", keyBy: "id", template: "todo-row.v1" })}
          </main>
        );
      }
    `);
    const options = {
      rootDir: dir,
      entries: {
        app: {
          input: 'App.tsx',
          entry: 'App',
          root: { selector: '#app' },
          source: { kind: 'state', basis: 1 },
          hydration: {
            target: '#app',
            sourceImport: './state.js',
            sourceExport: 'source',
            templatesImport: './templates.js',
            templatesExport: 'templates'
          }
        }
      }
    };
    const outputs = await compileFrontierDomBuildEntries(options);
    assert.strictEqual(outputs.length, 1);
    assert.strictEqual(outputs[0].diagnostics.length, 0);
    assert.ok(outputs[0].compiled.html.includes('data-frontier-id="heading"'));
    assert.ok(outputs[0].compiled.html.includes('<small>online</small>'));
    assert.deepStrictEqual(outputs[0].result.manifest.bindings.map((binding) => binding.kind), ['text', 'each']);
    assert.deepStrictEqual(outputs[0].artifacts.map((artifact) => artifact.fileName), [
      'frontier-dom/app.html',
      'frontier-dom/app.manifest.json',
      'frontier-dom/app.hydration.js',
      'frontier-dom/app.diagnostics.json'
    ]);

    const hydration = renderFrontierDomHydrationModule(outputs[0].compiled, options.entries.app.hydration);
    assert.ok(hydration.includes("import { source as frontierSource } from \"./state.js\";"));
    assert.ok(hydration.includes("import { templates as frontierTemplates } from \"./templates.js\";"));
    assert.ok(hydration.includes('export function mountFrontierDom'));

    const plugin = frontierDomVite(options);
    const emitted = [];
    const warnings = [];
    const context = {
      emitFile(file) {
        emitted.push(file);
        return 'asset-' + emitted.length;
      },
      warn(message) {
        warnings.push(String(message));
      },
      error(message) {
        throw new Error(String(message));
      }
    };
    assert.deepStrictEqual(plugin.config().esbuild, {
      jsx: 'automatic',
      jsxImportSource: '@shapeshift-labs/frontier-dom'
    });
    await plugin.buildStart.call(context);
    assert.strictEqual(warnings.length, 0);
    assert.deepStrictEqual(emitted.map((file) => file.fileName), [
      'frontier-dom/app.html',
      'frontier-dom/app.manifest.json',
      'frontier-dom/app.hydration.js',
      'frontier-dom/app.diagnostics.json'
    ]);
    const resolved = plugin.resolveId('virtual:frontier-dom/app');
    assert.strictEqual(resolved, '\0frontier-dom:app');
    const loaded = await plugin.load.call(context, resolved);
    assert.ok(loaded.includes('export const compiled'));
    assert.ok(loaded.includes('mountFrontierDom'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runAppApiSmoke() {
  const dom = new JSDOM('<!doctype html><div id="app"></div>');
  const previousDocument = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    const root = dom.window.document.getElementById('app');
    const state = createStateEngine(
      {
        title: 'Runtime JSX',
        user: { name: 'Compiled JSX' },
        todos: [
          { id: 'a', text: 'Alpha' },
          { id: 'b', text: 'Beta' }
        ]
      },
      { diff: { arrayKey: 'id' } }
    );
    const templates = {
      'todo-row.v1': {
        create(row) {
          const item = dom.window.document.createElement('li');
          item.textContent = row.text;
          return item;
        },
        update(node, row) {
          node.textContent = row.text;
        }
      }
    };

    function RuntimeView() {
      return jsx('main', {
        frId: 'runtime-view',
        children: [
          jsx('h1', { frId: 'runtime-title', $text: '/title' }),
          jsxEach('/todos/*', {
            frId: 'runtime-todos',
            as: 'ul',
            fields: ['text'],
            keyBy: 'id',
            template: 'todo-row.v1'
          }),
          jsxVirtualEach('/todos/*', {
            frId: 'runtime-virtual',
            keyBy: 'id',
            template: 'todo-row.v1',
            viewport: { offset: 0, size: 24 },
            layout: jsxFixedLayout(12)
          })
        ]
      });
    }

    const runtimeApp = createApp({ source: fromStateEngine(state), target: root, templates });
    const runtimeRenderer = runtimeApp.mount(jsx(RuntimeView, {}));
    assert.strictEqual(root.querySelector('[data-frontier-id="runtime-title"]').textContent, 'Runtime JSX');
    assert.deepStrictEqual(Array.from(root.querySelectorAll('[data-frontier-id="runtime-todos"] li'), (item) => item.textContent), ['Alpha', 'Beta']);
    state.commitPatch([[0, ['title'], 'Runtime Updated']]);
    runtimeApp.flush();
    assert.strictEqual(root.querySelector('[data-frontier-id="runtime-title"]').textContent, 'Runtime Updated');
    const runtimeSnapshot = runtimeApp.serialize();
    assert.strictEqual(runtimeSnapshot.kind, 'frontier.dom.state');
    assert.ok(runtimeSnapshot.manifest.bindings.some((binding) => binding.kind === 'virtualEach'));
    assert.strictEqual(runtimeApp.renderer, runtimeRenderer);
    runtimeApp.dispose();

    const compiled = await compileFrontierJsx(`
      function Name() {
        return <span frId="compiled-name" $text="/user/name" />;
      }
      function App() {
        return (
          <section frId="compiled-view">
            <Name />
            {each("/todos/*", {
              frId: "compiled-todos",
              as: "ul",
              fields: ["text"],
              keyBy: "id",
              template: "todo-row.v1"
            })}
          </section>
        );
      }
    `, { entry: 'App' });
    const compiledApp = createApp({ source: fromStateEngine(state), target: root, templates });
    compiledApp.mount(compiled);
    assert.strictEqual(root.querySelector('[data-frontier-id="compiled-name"]').textContent, 'Compiled JSX');
    state.commitPatch([[0, ['user', 'name'], 'Compiled Updated']]);
    compiledApp.flush();
    assert.strictEqual(root.querySelector('[data-frontier-id="compiled-name"]').textContent, 'Compiled Updated');
    compiledApp.dispose();
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    dom.window.close();
  }
}

function runVirtualDomSmoke() {
  const dom = new JSDOM('<!doctype html><main><ul id="rows"></ul></main>');
  const { document } = dom.window;
  const list = document.getElementById('rows');
  const state = createStateEngine(
    {
      viewport: { offset: 20, size: 20 },
      rows: Array.from({ length: 8 }, (_, index) => ({ id: 'row-' + index, text: 'Row ' + index }))
    },
    { diff: { arrayKey: 'id' } }
  );
  const renderer = createDomRenderer({ source: fromStateEngine(state), trace: true });
  renderer.virtualEach('/rows/*', {
    container: list,
    keyBy: 'id',
    fields: ['text'],
    viewport: (source) => source.get().viewport,
    viewportWatch: '/viewport',
    layout: createFixedLayout(10),
    overscan: 1,
    create(row, context) {
      const item = document.createElement('li');
      item.dataset.id = row.id;
      item.textContent = context.index + ':' + row.text;
      return item;
    },
    update(node, row, context) {
      node.textContent = context.index + ':' + row.text;
    }
  });
  assert.deepStrictEqual(readVirtualRowIds(list), ['row-1', 'row-2', 'row-3', 'row-4']);
  assert.strictEqual(list.querySelector('[data-frontier-virtual-spacer="before"]').dataset.frontierVirtualSize, '10');

  state.commitPatch([[0, ['viewport', 'offset'], 40]]);
  renderer.flush();
  assert.deepStrictEqual(readVirtualRowIds(list), ['row-3', 'row-4', 'row-5', 'row-6']);
  assert.ok(renderer.getTrace().some((event) => event.kind === 'virtual-range'));
  renderer.dispose();
  dom.window.close();
}

async function runVirtualPrimitivesSmoke() {
  const rows = Array.from({ length: 20 }, (_, index) => ({ id: 'r' + index, text: 'row ' + index }));
  const range = virtualize({
    items: rows,
    keyBy: 'id',
    viewport: { offset: 30, size: 30 },
    layout: createFixedLayout(10),
    overscan: 1
  });
  assert.deepStrictEqual(range.items.map((item) => item.key), ['r2', 'r3', 'r4', 'r5', 'r6']);

  const variable = createVariableLayout({ defaultSize: 10, sizes: { r0: 40 } });
  assert.strictEqual(variable.getSize({ key: 'r0', index: 0, value: rows[0], viewport: { offset: 0, size: 10 } }), 40);

  const grid = virtualizeGrid({
    rowCount: 100,
    columnCount: 50,
    rowLayout: createFixedLayout(20),
    columnLayout: createFixedLayout(80),
    viewport: { offset: 40, size: 40, crossOffset: 160, crossSize: 160 },
    overscanRows: 0,
    overscanColumns: 0
  });
  assert.deepStrictEqual(grid.cells[0], {
    rowIndex: 2,
    columnIndex: 2,
    rowOffset: 40,
    columnOffset: 160,
    rowSize: 20,
    columnSize: 80
  });

  assert.deepStrictEqual(
    virtualizeSpatial(
      [
        { key: 'inside', x: 5, y: 5, width: 5, height: 5 },
        { key: 'outside', x: 50, y: 50, width: 5, height: 5 }
      ],
      { x: 0, y: 0, width: 20, height: 20 }
    ).map((item) => item.key),
    ['inside']
  );

  assert.deepStrictEqual(
    virtualizeFrustum(
      [
        { key: 'near', minX: -1, minY: -1, minZ: -1, maxX: 1, maxY: 1, maxZ: 1 },
        { key: 'far', minX: 20, minY: 20, minZ: 20, maxX: 21, maxY: 21, maxZ: 21 }
      ],
      {
        planes: [
          { x: 1, y: 0, z: 0, w: 10 },
          { x: -1, y: 0, z: 0, w: 10 },
          { x: 0, y: 1, z: 0, w: 10 },
          { x: 0, y: -1, z: 0, w: 10 },
          { x: 0, y: 0, z: 1, w: 10 },
          { x: 0, y: 0, z: -1, w: 10 }
        ]
      }
    ).map((item) => item.key),
    ['near']
  );

  const treeRows = flattenVirtualTree(
    [{ key: 'root', value: 'root', children: [{ key: 'child', value: 'child' }] }],
    ['root']
  );
  assert.deepStrictEqual(treeRows.map((row) => [row.key, row.depth]), [['root', 0], ['child', 1]]);

  const windowed = await materializeWindowSource(range, {
    readWindow(start, end) {
      return rows.slice(start, end);
    },
    count() {
      return rows.length;
    }
  });
  assert.deepStrictEqual(windowed.items.map((row) => row.id), range.items.map((item) => item.key));
}

function runDelegatedFormSmoke() {
  const dom = new JSDOM('<!doctype html><main><button data-action="rename"></button><input /></main>');
  const { document, Event } = dom.window;
  const root = document.querySelector('main');
  const input = document.querySelector('input');
  const state = createStateEngine({ user: { name: 'Ada' } });
  const renderer = createDomRenderer({ source: fromStateEngine(state), target: root });
  renderer.delegate(root, 'click', '[data-action="rename"]', (_event, matched) => {
    state.commitPatch([[0, ['user', 'name'], matched.getAttribute('data-action')]]);
  });
  renderer.formValue('/user/name', input);
  assert.strictEqual(input.value, 'Ada');

  root.querySelector('button').dispatchEvent(new Event('click', { bubbles: true }));
  renderer.flush();
  assert.strictEqual(input.value, 'rename');

  input.dispatchEvent(new Event('compositionstart', { bubbles: true }));
  input.value = 'draft';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  assert.strictEqual(state.get().user.name, 'rename');
  input.dispatchEvent(new Event('compositionend', { bubbles: true }));
  assert.strictEqual(state.get().user.name, 'draft');
  renderer.dispose();
  dom.window.close();
}

function runSsrAndDevtoolsSmoke() {
  const manifest = {
    version: 1,
    source: { kind: 'state', basis: 1 },
    bindings: [{ id: 'b:user', kind: 'text', path: '/user/name', target: { anchor: 'user' } }]
  };
  const serialized = {
    kind: 'frontier.dom.state',
    version: 1,
    manifest,
    source: { kind: 'state', basis: 1 },
    snapshot: { user: { name: '<Ada>' } }
  };
  const script = renderDomHydrationScript(serialized, { id: 'frontier-state' });
  assert.ok(script.includes('\\u003cAda\\u003e'));
  const dom = new JSDOM('<!doctype html>' + script);
  const parsed = parseDomHydrationScript(dom.window.document.getElementById('frontier-state'));
  assert.strictEqual(parsed.snapshot.user.name, '<Ada>');
  assert.strictEqual(Array.from(streamDomHydrationScript(serialized))[0].kind, 'frontier.dom.ssr.chunk');

  const sink = createDomDevtoolsSink({ limit: 2 });
  sink({ kind: 'binding-create', bindingId: 1, bindingKind: 'text', paths: [['user', 'name']] });
  sink({ kind: 'binding-dirty', bindingId: 1, bindingKind: 'text', patchItems: 1 });
  sink({ kind: 'binding-dispose', bindingId: 1, bindingKind: 'text' });
  assert.strictEqual(sink.snapshot().trace.length, 2);
  const rendererLike = { size: 1, getTrace: () => sink.snapshot().trace };
  assert.strictEqual(inspectDomRenderer(rendererLike).size, 1);
  dom.window.close();
}

function runRenderLogSinkSmoke() {
  const dom = new JSDOM('<!doctype html><span></span>');
  const logger = createLogger({ level: 'debug' });
  const state = createStateEngine({ user: { name: 'Log' } });
  const renderer = createDomRenderer({
    source: fromStateEngine(state),
    trace: createRenderLogSink(logger, { level: 'debug' })
  });
  const node = dom.window.document.querySelector('span');
  renderer.text('/user/name', node);
  state.commitPatch([[0, ['user', 'name'], 'Logged']]);
  renderer.flush();
  assert.ok(logger.snapshot().some((record) => record.name === 'frontier.dom.dom-write'));
  renderer.dispose();
  dom.window.close();
}

function readVirtualRowIds(list) {
  return Array.from(list.querySelectorAll('[data-id]'), (item) => item.dataset.id);
}

function runPatchRendererSmoke() {
  const state = createStateEngine(
    {
      player: { x: 1, y: 2 },
      entities: [
        { id: 'e1', x: 10, y: 20, hp: 5 },
        { id: 'e2', x: 30, y: 40, hp: 7 }
      ]
    },
    { diff: { arrayKey: 'id' } }
  );
  const sprites = new Map();
  const patchRenderer = createPatchRenderer({ source: fromStateEngineForPatchRenderer(state), trace: true });
  let playerX = 0;
  patchRenderer.bind({
    name: 'player.x',
    path: '/player/x',
    apply({ value }) {
      playerX = value;
    }
  });
  patchRenderer.each({
    name: 'scene.entities',
    path: '/entities/*',
    fields: ['x', 'y', 'hp'],
    keyBy: 'id',
    create(row) {
      const sprite = { x: row.x, y: row.y, hp: row.hp };
      sprites.set(row.id, sprite);
      return sprite;
    },
    update(sprite, row) {
      sprite.x = row.x;
      sprite.y = row.y;
      sprite.hp = row.hp;
    },
    remove(_sprite, context) {
      sprites.delete(context.key);
    }
  });
  assert.strictEqual(playerX, 1);
  assert.deepStrictEqual(sprites.get('e2'), { x: 30, y: 40, hp: 7 });

  state.commitPatch([[0, ['player', 'x'], 8]]);
  state.commitPatch([[0, ['entities', 1, 'x'], 31]]);
  patchRenderer.flush();
  assert.strictEqual(playerX, 8);
  assert.strictEqual(sprites.get('e2').x, 31);
  assert.ok(patchRenderer.getTrace().some((event) => event.kind === 'host-write'));
  patchRenderer.dispose();
}

function runSchedulerAdaptersSmoke() {
  const dom = new JSDOM('<!doctype html><span></span>');
  const runtime = createFakeRuntimeScheduler();
  const state = createStateEngine({ user: { name: 'Ada' } });
  const node = dom.window.document.querySelector('span');
  const renderer = createDomRenderer({
    source: fromStateEngine(state),
    scheduler: createDomSchedulerFromRuntime(runtime, { id: 'dom-test', autoRun: false })
  });
  renderer.text('/user/name', node);
  state.commitPatch([[0, ['user', 'name'], 'Grace']]);
  assert.strictEqual(node.textContent, 'Ada');
  assert.strictEqual(runtime.tasks[0].type, 'frontier.dom.flush');
  runtime.run();
  assert.strictEqual(node.textContent, 'Grace');
  renderer.dispose();
  dom.window.close();

  const patchRuntime = createFakeRuntimeScheduler();
  const patchState = createStateEngine({ player: { x: 1 } });
  let x = 0;
  const patchRenderer = createPatchRenderer({
    source: fromStateEngineForPatchRenderer(patchState),
    scheduler: createPatchSchedulerFromRuntime(patchRuntime, { id: 'patch-test', autoRun: false })
  });
  patchRenderer.bind({
    path: '/player/x',
    apply({ value }) {
      x = value;
    }
  });
  patchState.commitPatch([[0, ['player', 'x'], 2]]);
  assert.strictEqual(x, 1);
  assert.strictEqual(patchRuntime.tasks[0].type, 'frontier.patch-render.flush');
  patchRuntime.run();
  assert.strictEqual(x, 2);
  patchRenderer.dispose();
}

function createFakeRuntimeScheduler() {
  return {
    tasks: [],
    schedule(task) {
      this.tasks.push(task);
      return task;
    },
    run() {
      while (this.tasks.length !== 0) this.tasks.shift().run();
    }
  };
}
