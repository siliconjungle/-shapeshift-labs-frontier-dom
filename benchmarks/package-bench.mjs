import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createStateEngine } from '@shapeshift-labs/frontier-state';
import { createApp, createDomRenderer, createDomRendererFromManifest, fromStateEngine, syncDomScheduler } from '../dist/index.js';
import { createPatchRenderer, fromStateEngine as fromStateEngineForPatchRenderer, syncPatchScheduler } from '../dist/core.js';
import { each as jsxEach, fixedLayout as jsxFixedLayout, jsx, text as jsxText, virtualEach as jsxVirtualEach } from '../dist/jsx-runtime.js';
import { createFixedLayout, createTextLayout, virtualize, virtualizeFrustum } from '@shapeshift-labs/frontier-virtual';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageDir, '..', '..');
const args = parseArgs(process.argv.slice(2));
const rounds = readPositiveInt(args.rounds, 9);
const rows = readPositiveInt(args.rows, 5000);
const outPath = args.out ? path.resolve(repoRoot, args.out) : null;
let sink = 0;

const results = [
  measureCreateTextBindings(rows),
  measureTextPatchFlush(rows, false),
  measureTextPatchFlush(rows, true),
  measureKeyedEachFieldUpdate(Math.min(rows, 2000)),
  measureKeyedEachStructuralUpdate(Math.min(rows, 1000)),
  measureHydrateManifestAttach(Math.min(rows, 2000)),
  measureCorePatchValueFlush(rows),
  measureCorePatchEachFieldUpdate(Math.min(rows, 2000)),
  measureVirtualizeFixedRows(rows),
  measureVirtualizeTextRows(Math.min(rows, 2000)),
  measureDomVirtualEachScroll(Math.min(rows, 2000)),
  measureFrustumCull(rows),
  measureCreateAppRuntimeMount(Math.min(rows, 1000)),
  await measureCompileFrontierJsx(),
  await measureCreateAppCompiledMount(Math.min(rows, 1000))
];

const report = {
  package: '@shapeshift-labs/frontier-dom',
  version: readPackageVersion(),
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform + ' ' + process.arch,
  rows,
  rounds,
  rowsOut: results
};

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
}

console.log(report.package + ' package benchmark');
console.log('Node ' + report.node + ' on ' + report.platform + ', rows=' + rows + ', rounds=' + rounds);
console.log('These are Frontier-only package measurements, not competitor comparisons.');
console.log('');
console.log(padRight('Fixture', 42) + padLeft('Median', 12) + padLeft('p95', 12) + padLeft('DOM writes', 12));
for (const row of results) {
  console.log(
    padRight(row.fixture, 42) +
      padLeft(formatUs(row.medianUs), 12) +
      padLeft(formatUs(row.p95Us), 12) +
      padLeft(String(row.domWrites), 12)
  );
}
if (outPath) console.log('\nwrote ' + path.relative(repoRoot, outPath));
if (sink === 42) console.log('sink=' + sink);

function measureCreateTextBindings(rowCount) {
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const dom = new JSDOM('<!doctype html><div></div>');
    const fragment = dom.window.document.createDocumentFragment();
    const state = createStateEngine({ rows: makeRows(rowCount) });
    const renderer = createDomRenderer({ source: fromStateEngine(state) });
    const start = performance.now();
    for (let i = 0; i < rowCount; i++) {
      const node = dom.window.document.createTextNode('');
      renderer.text('/rows/' + i + '/text', node);
      fragment.appendChild(node);
    }
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += renderer.size;
    renderer.dispose();
  }
  return summarize('Create text bindings, ' + rowCount + ' rows', samples, rowCount);
}

function measureTextPatchFlush(rowCount, trace) {
  const fixture = createTextFixture(rowCount, trace);
  const target = Math.floor(rowCount / 2);
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const value = 'updated-' + round;
    const start = performance.now();
    fixture.state.commitPatch([[0, ['rows', target, 'text'], value]]);
    fixture.renderer.flush();
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += fixture.nodes[target].data.length;
  }
  const domWrites = trace ? fixture.renderer.getTrace().filter((event) => event.kind === 'dom-write').length : rounds + rowCount;
  fixture.renderer.dispose();
  return summarize(
    trace ? 'Text patch flush with trace, ' + rowCount + ' rows' : 'Text patch flush, ' + rowCount + ' rows',
    samples,
    domWrites
  );
}

function measureKeyedEachFieldUpdate(rowCount) {
  const fixture = createEachFixture(rowCount);
  const target = Math.floor(rowCount / 2);
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    fixture.state.commitPatch([[0, ['rows', target, 'text'], 'patched-' + round]]);
    const start = performance.now();
    fixture.renderer.flush();
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += fixture.list.children[target].textContent.length;
  }
  fixture.renderer.dispose();
  return summarize('Keyed each field flush, ' + rowCount + ' rows', samples, rowCount + rounds);
}

function measureKeyedEachStructuralUpdate(rowCount) {
  const fixture = createEachFixture(rowCount);
  const samples = [];
  let current = fixture.state.get();
  for (let round = 0; round < rounds; round++) {
    const next = clone(current);
    const [first] = next.rows.splice(0, 1);
    next.rows.splice(next.rows.length, 0, first);
    next.rows.push({ id: 'extra-' + round, text: 'Extra ' + round, done: false });
    const start = performance.now();
    fixture.state.commit(next);
    fixture.renderer.flush();
    samples[samples.length] = (performance.now() - start) * 1000;
    current = next;
    sink += fixture.list.children.length;
  }
  fixture.renderer.dispose();
  return summarize('Keyed each move+insert, ' + rowCount + ' rows', samples, rowCount * rounds);
}

function measureHydrateManifestAttach(rowCount) {
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const dom = new JSDOM('<!doctype html><main><span data-frontier-id="title"></span><ul data-frontier-id="rows">' + makeHydrateRows(rowCount) + '</ul></main>');
    const root = dom.window.document.querySelector('main');
    const state = createStateEngine({ title: 'Hydrate', rows: makeRows(rowCount) }, { diff: { arrayKey: 'id' } });
    const manifest = {
      version: 1,
      bindings: [
        { id: 'b:title', kind: 'text', path: '/title', target: { anchor: 'title' } },
        {
          id: 'b:rows',
          kind: 'each',
          path: '/rows/*',
          fields: ['text', 'done'],
          keyBy: 'id',
          container: { anchor: 'rows' },
          template: 'row'
        }
      ]
    };
    const start = performance.now();
    const renderer = createDomRendererFromManifest({
      source: fromStateEngine(state),
      target: root,
      manifest,
      templates: {
        row: {
          create(row) {
            const item = dom.window.document.createElement('li');
            item.textContent = formatRow(row);
            return item;
          },
          update(node, row) {
            node.textContent = formatRow(row);
          }
        }
      }
    });
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += root.querySelector('ul').children.length;
    renderer.dispose();
    dom.window.close();
  }
  return summarize('Hydrate manifest attach, ' + rowCount + ' rows', samples, rowCount);
}

function measureCorePatchValueFlush(rowCount) {
  const state = createStateEngine({ rows: makeRows(rowCount) });
  const renderer = createPatchRenderer({ source: fromStateEngineForPatchRenderer(state), scheduler: syncPatchScheduler });
  const target = Math.floor(rowCount / 2);
  const values = new Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    renderer.bind({
      path: '/rows/' + i + '/text',
      apply({ value }) {
        values[i] = value;
      }
    });
  }
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const value = 'core-' + round;
    const start = performance.now();
    state.commitPatch([[0, ['rows', target, 'text'], value]]);
    renderer.flush();
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += String(values[target]).length;
  }
  renderer.dispose();
  return summarize('Core patch value flush, ' + rowCount + ' rows', samples, rowCount + rounds);
}

function measureCorePatchEachFieldUpdate(rowCount) {
  const state = createStateEngine({ rows: makeRows(rowCount) }, { diff: { arrayKey: 'id' } });
  const renderer = createPatchRenderer({ source: fromStateEngineForPatchRenderer(state) });
  const sprites = new Map();
  renderer.each({
    path: '/rows/*',
    fields: ['text', 'done'],
    keyBy: 'id',
    create(row) {
      const sprite = { text: row.text, done: row.done };
      sprites.set(row.id, sprite);
      return sprite;
    },
    update(sprite, row) {
      sprite.text = row.text;
      sprite.done = row.done;
    }
  });
  const target = Math.floor(rowCount / 2);
  const targetId = 'row-' + target;
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const value = 'sprite-' + round;
    state.commitPatch([[0, ['rows', target, 'text'], value]]);
    const start = performance.now();
    renderer.flush();
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += sprites.get(targetId).text.length;
  }
  renderer.dispose();
  return summarize('Core keyed each field flush, ' + rowCount + ' rows', samples, rowCount + rounds);
}

function measureVirtualizeFixedRows(rowCount) {
  const rowsData = makeRows(rowCount);
  const layout = createFixedLayout(24);
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const offset = (round * 97) % Math.max(1, rowCount * 24 - 600);
    const start = performance.now();
    const range = virtualize({
      items: rowsData,
      keyBy: 'id',
      viewport: { offset, size: 600 },
      layout,
      overscan: 4
    });
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += range.items.length;
  }
  return summarize('Virtualize fixed rows, ' + rowCount + ' rows', samples, rounds);
}

function measureVirtualizeTextRows(rowCount) {
  const rowsData = makeRows(rowCount).map((row, index) => ({
    ...row,
    text: row.text + ' '.repeat(index % 20) + 'body copy for text layout'
  }));
  const layout = createTextLayout({ field: 'text', font: '14px Inter', lineHeight: 20, width: 320 });
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const offset = (round * 113) % Math.max(1, rowCount * 24 - 600);
    const start = performance.now();
    const range = virtualize({
      items: rowsData,
      keyBy: 'id',
      viewport: { offset, size: 600, crossSize: 320 },
      layout,
      overscan: 4
    });
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += range.totalSize;
  }
  return summarize('Virtualize text rows, ' + rowCount + ' rows', samples, rounds);
}

function measureDomVirtualEachScroll(rowCount) {
  const dom = new JSDOM('<!doctype html><ul></ul>');
  const list = dom.window.document.querySelector('ul');
  const state = createStateEngine({
    viewport: { offset: 0, size: 480 },
    rows: makeRows(rowCount)
  }, { diff: { arrayKey: 'id' } });
  const renderer = createDomRenderer({ source: fromStateEngine(state), scheduler: syncDomScheduler });
  renderer.virtualEach('/rows/*', {
    container: list,
    keyBy: 'id',
    fields: ['text', 'done'],
    viewport: (source) => source.get().viewport,
    viewportWatch: '/viewport',
    layout: createFixedLayout(24),
    overscan: 4,
    create(row) {
      const item = dom.window.document.createElement('li');
      item.textContent = formatRow(row);
      return item;
    },
    update(node, row) {
      node.textContent = formatRow(row);
    }
  });
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const offset = (round * 211) % Math.max(1, rowCount * 24 - 480);
    const start = performance.now();
    state.commitPatch([[0, ['viewport', 'offset'], offset]]);
    renderer.flush();
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += list.children.length;
  }
  renderer.dispose();
  dom.window.close();
  return summarize('DOM virtualEach scroll, ' + rowCount + ' rows', samples, rounds);
}

function measureFrustumCull(rowCount) {
  const boxes = new Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    const x = i % 100;
    const y = Math.floor(i / 100);
    boxes[i] = { key: 'box-' + i, minX: x, minY: y, minZ: 0, maxX: x + 0.5, maxY: y + 0.5, maxZ: 1 };
  }
  const frustum = {
    planes: [
      { x: 1, y: 0, z: 0, w: 10 },
      { x: -1, y: 0, z: 0, w: 60 },
      { x: 0, y: 1, z: 0, w: 10 },
      { x: 0, y: -1, z: 0, w: 60 },
      { x: 0, y: 0, z: 1, w: 10 },
      { x: 0, y: 0, z: -1, w: 10 }
    ]
  };
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const start = performance.now();
    const visible = virtualizeFrustum(boxes, frustum);
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += visible.length;
  }
  return summarize('Virtualize 3D frustum boxes, ' + rowCount + ' boxes', samples, rounds);
}

function measureCreateAppRuntimeMount(rowCount) {
  const samples = [];
  const previousDocument = globalThis.document;
  for (let round = 0; round < rounds; round++) {
    const dom = new JSDOM('<!doctype html><div id="app"></div>');
    globalThis.document = dom.window.document;
    const target = dom.window.document.getElementById('app');
    const state = createStateEngine({ title: 'Rows', rows: makeRows(rowCount) }, { diff: { arrayKey: 'id' } });
    const app = createApp({
      source: fromStateEngine(state),
      target,
      templates: createBenchTemplates(dom.window.document)
    });
    const view = jsx('main', {
      frId: 'app-view',
      children: [
        jsxText('/title', { frId: 'title' }),
        jsxEach('/rows/*', {
          frId: 'rows',
          as: 'ul',
          fields: ['text', 'done'],
          keyBy: 'id',
          template: 'row'
        }),
        jsxVirtualEach('/rows/*', {
          frId: 'virtual-rows',
          keyBy: 'id',
          template: 'row',
          viewport: { offset: 0, size: 480 },
          layout: jsxFixedLayout(24)
        })
      ]
    });
    const start = performance.now();
    app.mount(view);
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += target.querySelectorAll('li').length;
    app.dispose();
    dom.window.close();
  }
  restoreGlobalDocument(previousDocument);
  return summarize('createApp runtime JSX mount, ' + rowCount + ' rows', samples, rowCount);
}

async function measureCompileFrontierJsx() {
  const { compileFrontierJsx } = await import('../dist/compiler.js');
  const source = createCompiledBenchSource();
  await compileFrontierJsx(source, { entry: 'App' });
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const start = performance.now();
    const compiled = await compileFrontierJsx(source, { entry: 'App' });
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += compiled.manifest.bindings.length;
  }
  return summarize('Compile TSX manifest with components', samples, rounds);
}

async function measureCreateAppCompiledMount(rowCount) {
  const { compileFrontierJsx } = await import('../dist/compiler.js');
  const compiled = await compileFrontierJsx(createCompiledBenchSource(), { entry: 'App' });
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const dom = new JSDOM('<!doctype html><div id="app"></div>');
    const target = dom.window.document.getElementById('app');
    const state = createStateEngine({ title: 'Rows', rows: makeRows(rowCount) }, { diff: { arrayKey: 'id' } });
    const app = createApp({
      source: fromStateEngine(state),
      target,
      templates: createBenchTemplates(dom.window.document)
    });
    const start = performance.now();
    app.mount(compiled);
    samples[samples.length] = (performance.now() - start) * 1000;
    sink += target.querySelectorAll('li').length;
    app.dispose();
    dom.window.close();
  }
  return summarize('createApp compiled TSX hydrate, ' + rowCount + ' rows', samples, rowCount);
}

function createTextFixture(rowCount, trace) {
  const dom = new JSDOM('<!doctype html><div></div>');
  const fragment = dom.window.document.createDocumentFragment();
  const state = createStateEngine({ rows: makeRows(rowCount) });
  const renderer = createDomRenderer({ source: fromStateEngine(state), trace, scheduler: syncDomScheduler });
  const nodes = new Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    const node = dom.window.document.createTextNode('');
    nodes[i] = node;
    renderer.text('/rows/' + i + '/text', node);
    fragment.appendChild(node);
  }
  return { document: dom.window.document, fragment, nodes, renderer, state };
}

function createEachFixture(rowCount) {
  const dom = new JSDOM('<!doctype html><ul></ul>');
  const list = dom.window.document.querySelector('ul');
  const state = createStateEngine({ rows: makeRows(rowCount) }, { diff: { arrayKey: 'id' } });
  const renderer = createDomRenderer({ source: fromStateEngine(state) });
  renderer.each('/rows/*', {
    container: list,
    keyBy: 'id',
    fields: ['text', 'done'],
    create(row) {
      const item = dom.window.document.createElement('li');
      item.textContent = formatRow(row);
      return item;
    },
    update(node, row) {
      node.textContent = formatRow(row);
    }
  });
  return { document: dom.window.document, list, renderer, state };
}

function createBenchTemplates(document) {
  return {
    row: {
      create(row) {
        const item = document.createElement('li');
        item.textContent = formatRow(row);
        return item;
      },
      update(node, row) {
        node.textContent = formatRow(row);
      }
    }
  };
}

function createCompiledBenchSource() {
  return `
    function Title() {
      return <h1 frId="title" $text="/title" />;
    }
    function Rows() {
      return (
        <ul
          frId="rows"
          $each={{ path: "/rows/*", fields: ["text", "done"], keyBy: "id", template: "row" }}
        />
      );
    }
    function App() {
      return (
        <main frId="app-view">
          <Title />
          <Rows />
          {virtualEach("/rows/*", {
            frId: "virtual-rows",
            keyBy: "id",
            template: "row",
            viewport: { offset: 0, size: 480 },
            layout: fixedLayout(24)
          })}
        </main>
      );
    }
  `;
}

function restoreGlobalDocument(previousDocument) {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
}

function summarize(fixture, samples, domWrites) {
  samples.sort((left, right) => left - right);
  return {
    category: 'rendering',
    fixture,
    library: 'frontier.dom',
    status: 'ok',
    runs: samples.length,
    medianUs: round(percentile(samples, 0.5)),
    p95Us: round(percentile(samples, 0.95)),
    minUs: round(samples[0]),
    maxUs: round(samples[samples.length - 1]),
    domWrites,
    note: 'patch-native DOM binding prototype'
  };
}

function makeRows(count) {
  const rows = new Array(count);
  for (let i = 0; i < count; i++) {
    rows[i] = { id: 'row-' + i, text: 'Row ' + i, done: false };
  }
  return rows;
}

function makeHydrateRows(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += '<li data-frontier-key="row-' + i + '">SSR ' + i + '</li>';
  }
  return html;
}

function formatRow(row) {
  return row.id + ':' + row.text + ':' + (row.done ? 'done' : 'open');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function readPackageVersion() {
  return JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')).version;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--rounds') out.rounds = argv[++i];
    else if (arg === '--rows') out.rows = argv[++i];
    else if (arg === '--out') out.out = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npm run bench -- [--rows 5000] [--rounds 9] [--out benchmarks/results/frontier-dom-package-bench-latest.json]');
      process.exit(0);
    } else {
      throw new Error('unknown argument: ' + arg);
    }
  }
  return out;
}

function readPositiveInt(value, fallback) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error('expected positive integer, got ' + value);
  return number;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function formatUs(value) {
  return value >= 1000 ? (value / 1000).toFixed(2) + ' ms' : value.toFixed(2) + ' us';
}

function padRight(value, width) {
  return String(value).padEnd(width);
}

function padLeft(value, width) {
  return String(value).padStart(width);
}
