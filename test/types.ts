import { createStateEngine, type JsonValue, type Patch } from '@shapeshift-labs/frontier-state';
import {
  createDomSchedulerFromRuntime,
  createDomRenderer,
  createDomRendererFromManifest,
  deserializeDomState,
  fromStateEngine,
  readPatchAssignedValue,
  serializeDomState,
  type FrontierDomBinding,
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
import { createDomDevtoolsSink, inspectDomRenderer } from '../dist/devtools.js';
import { createRenderLogSink } from '../dist/logging.js';
import { createHydrationBasisEnvelope, renderDomStateScript, streamDomHydrationScript } from '../dist/ssr.js';
import { createJsxManifest, jsx, text, textLayout, virtualEach, when } from '../dist/jsx-runtime.js';
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
    { id: 'a:save', kind: 'event', event: 'click', action: 'save', target: { selector: 'button' } },
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
    save({ source }) {
      source.commitPatch?.([[0, ['user', 'name'], 'Saved']]);
    }
  },
  actionRegistry: {
    dispatch(actionId, input, options) {
      const id: string = actionId;
      const payload: JsonValue | undefined = input;
      void id;
      void payload;
      void options?.causeId;
    }
  }
});
const serialized = serializeDomState({ manifest, source });
deserializeDomState(serialized);

const jsxNode = jsx('span', { frId: 'typed', $text: '/user/name' });
target.appendChild(jsxNode);
target.appendChild(jsx('div', {
  children: [
    text('/user/name', { frId: 'name-from-helper' }),
    when('/todos/0/done', {
      frId: 'when-from-helper',
      template: 'visible',
      fallbackTemplate: 'hidden'
    }),
    virtualEach('/todos/*', {
      frId: 'virtual-from-helper',
      keyBy: 'id',
      template: 'todo',
      layout: textLayout({ field: 'text', font: '14px Inter', lineHeight: 20, width: 240 }),
      viewport: { offset: 0, size: 80 }
    })
  ]
}));
const jsxManifest = createJsxManifest(target);
const compiled: Promise<FrontierJsxCompileResult> = compileFrontierJsx(`
  const view = <main frId="app"><span $text="/user/name" /></main>;
`, { source: { kind: 'state' } });

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
const inspected = inspectDomRenderer(renderer);
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
void inspected;
void basis;
void script;
void chunks;
