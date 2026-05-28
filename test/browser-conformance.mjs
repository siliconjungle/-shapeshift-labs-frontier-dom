import assert from 'node:assert';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { dirname, basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFrontierJsx } from '../dist/compiler.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(testDir);
const workspaceRoot = basename(packageDir) === 'frontier-dom' && basename(dirname(packageDir)) === 'packages'
  ? resolve(packageDir, '..', '..')
  : packageDir;
const args = parseArgs(process.argv.slice(2));
const chromePath = args.chrome || findChrome();

await runCompilerSnapshotConformance();

if (!chromePath) {
  if (args.skipBrowserIfMissing) {
    console.log('frontier dom browser conformance skipped: Chrome executable was not found');
    process.exit(0);
  }
  throw new Error('Chrome executable was not found; pass --chrome /path/to/chrome');
}

const server = await startServer();
const chrome = await launchChrome(chromePath);
try {
  const result = await runBrowserConformance(server.url, chrome, args.timeoutMs ?? 30000);
  if (result.status !== 'ok') throw new Error(result.fatal || JSON.stringify(result));
  console.log('frontier dom browser conformance passed cases=' + result.cases.length + ' browser=' + result.userAgent);
} finally {
  server.close();
  chrome.close();
}

async function runCompilerSnapshotConformance() {
  const compiled = await compileFrontierJsx(`
    function App() {
      return (
        <>
          <main frId="app">
            <span frId="name" $text="/user/name" />
            {each("/groups/*", {
              frId: "groups",
              as: "section",
              keyBy: "id",
              fields: ["title"],
              template: "group.v1"
            })}
            <svg frId="icon" viewBox="0 0 10 10">
              <circle frId="dot" $attr={{ r: "/radius" }} />
            </svg>
            <math frId="formula">
              <mi frId="symbol" $text="/symbol" />
            </math>
          </main>
        </>
      );
    }
  `, { entry: 'App', root: { selector: '#app' }, source: { kind: 'state', basis: 7 } });

  assert.deepStrictEqual(compiled.diagnostics, []);
  assert.strictEqual(
    compiled.html,
    '<main data-frontier-id="app"><span data-frontier-id="name"></span><section data-frontier-id="groups"></section><svg viewBox="0 0 10 10" data-frontier-id="icon"><circle data-frontier-id="dot"></circle></svg><math data-frontier-id="formula"><mi data-frontier-id="symbol"></mi></math></main>'
  );
  assert.deepStrictEqual(compiled.manifest, {
    version: 1,
    root: { selector: '#app' },
    source: { kind: 'state', basis: 7 },
    bindings: [
      { id: 'b:name:text', kind: 'text', path: '/user/name', target: { anchor: 'name' } },
      {
        id: 'b:groups:each',
        kind: 'each',
        path: '/groups/*',
        container: { anchor: 'groups' },
        fields: ['title'],
        keyBy: 'id',
        keyAttribute: undefined,
        template: 'group.v1'
      },
      { id: 'b:dot:attr:r', kind: 'attr', path: '/radius', target: { anchor: 'dot' }, name: 'r' },
      { id: 'b:symbol:text', kind: 'text', path: '/symbol', target: { anchor: 'symbol' } }
    ]
  });

  const diagnostics = await compileFrontierJsx(`
    function App() {
      return <main><Unknown /><section {...props} /></main>;
    }
  `, { entry: 'App' });
  assert.deepStrictEqual(
    diagnostics.diagnostics.map((diagnostic) => diagnostic.code).filter(Boolean).sort(),
    ['FRONTIER_JSX_SPREAD_ATTR', 'FRONTIER_JSX_UNKNOWN_COMPONENT']
  );
}

async function runBrowserConformance(serverUrl, chrome, timeout) {
  const cdp = await connectCdp(chrome.webSocketUrl);
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.navigate', { url: serverUrl + '/conformance.html' });
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      const result = await cdp.send('Runtime.evaluate', {
        expression: 'window.__frontierDomBrowserConformanceResult || null',
        returnByValue: true,
        awaitPromise: false
      });
      const value = result.result?.value;
      if (value) return value;
      await sleep(50);
    }
    const errors = cdp.errors();
    throw new Error('browser conformance timed out' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    cdp.close();
  }
}

async function startServer() {
  const assets = new Map();
  const html = renderConformanceHtml(assets);
  const server = http.createServer((request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.pathname === '/conformance.html') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(html);
        return;
      }
      const filePath = resolveAssetPath(assets, url.pathname);
      if (!filePath) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('not found');
        return;
      }
      response.writeHead(200, { 'content-type': contentType(filePath), 'cache-control': 'no-store' });
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error && error.stack ? error.stack : String(error));
    }
  });
  await new Promise((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveReady);
  });
  const address = server.address();
  return {
    url: 'http://127.0.0.1:' + address.port,
    close() {
      server.close();
    }
  };
}

function renderConformanceHtml(assets) {
  const importMap = {
    imports: {
      '@shapeshift-labs/frontier': packageAssetUrl(assets, 'frontier', 'index.js'),
      '@shapeshift-labs/frontier/apply': packageAssetUrl(assets, 'frontier', 'apply.js'),
      '@shapeshift-labs/frontier/clone': packageAssetUrl(assets, 'frontier', 'clone.js'),
      '@shapeshift-labs/frontier/constants': packageAssetUrl(assets, 'frontier', 'constants.js'),
      '@shapeshift-labs/frontier/diff': packageAssetUrl(assets, 'frontier', 'diff.js'),
      '@shapeshift-labs/frontier/equal': packageAssetUrl(assets, 'frontier', 'equal.js'),
      '@shapeshift-labs/frontier/patch': packageAssetUrl(assets, 'frontier', 'patch.js'),
      '@shapeshift-labs/frontier/pointer': packageAssetUrl(assets, 'frontier', 'pointer.js'),
      '@shapeshift-labs/frontier/unicode': packageAssetUrl(assets, 'frontier', 'unicode.js'),
      '@shapeshift-labs/frontier/validate': packageAssetUrl(assets, 'frontier', 'validate.js'),
      '@shapeshift-labs/frontier-codec/history': packageAssetUrl(assets, 'frontier-codec', 'history.js'),
      '@shapeshift-labs/frontier-engine/engine': packageAssetUrl(assets, 'frontier-engine', 'engine.js'),
      '@shapeshift-labs/frontier-engine/profile': packageAssetUrl(assets, 'frontier-engine', 'profile.js'),
      '@shapeshift-labs/frontier-state': packageAssetUrl(assets, 'frontier-state', 'index.js'),
      '@shapeshift-labs/frontier-virtual': packageAssetUrl(assets, 'frontier-virtual', 'index.js'),
      '@shapeshift-labs/frontier-dom': packageAssetUrl(assets, 'frontier-dom', 'index.js'),
      '@shapeshift-labs/frontier-dom/jsx-runtime': packageAssetUrl(assets, 'frontier-dom', 'jsx-runtime.js')
    }
  };

  return `<!doctype html>
<meta charset="utf-8">
<title>frontier-dom browser conformance</title>
<script type="importmap">${escapeScriptJson(importMap)}</script>
<div id="root"></div>
<script type="module">
import { createDomRenderer, createDomRendererFromManifest, fromStateEngine, hydrateDomRenderer } from '@shapeshift-labs/frontier-dom';
import { createStateEngine } from '@shapeshift-labs/frontier-state';
import { Fragment, createJsxManifest, each, jsx, text } from '@shapeshift-labs/frontier-dom/jsx-runtime';

const cases = [];
assert.strictEqual = function strictEqual(actual, expected, message) {
  if (!Object.is(actual, expected)) {
    throw new Error(message || 'expected ' + JSON.stringify(actual) + ' to equal ' + JSON.stringify(expected));
  }
};
assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(message || 'expected ' + actualJson + ' to deeply equal ' + expectedJson);
  }
};

try {
  await runCase('keyed hydration', testKeyedHydration);
  await runCase('nested lists', testNestedLists);
  await runCase('fragments', testFragments);
  await runCase('svg mathml', testSvgMathml);
  await runCase('delegated events', testDelegatedEvents);
  await runCase('forms selection ime', testFormsSelectionIme);
  await runCase('focus preservation', testFocusPreservation);
  window.__frontierDomBrowserConformanceResult = {
    status: 'ok',
    userAgent: navigator.userAgent,
    cases
  };
} catch (error) {
  window.__frontierDomBrowserConformanceResult = {
    status: 'error',
    userAgent: navigator.userAgent,
    cases,
    fatal: error && error.stack ? error.stack : String(error)
  };
}

async function runCase(name, callback) {
  await callback();
  cases.push(name);
}

function testKeyedHydration() {
  const root = resetRoot('<main id="app"><ul data-frontier-id="todos"><li data-frontier-key="a">server:a</li><li data-frontier-key="b">server:b</li></ul></main>');
  const app = root.querySelector('#app');
  const list = root.querySelector('[data-frontier-id="todos"]');
  const nodeA = list.children[0];
  const nodeB = list.children[1];
  const state = createStateEngine({
    todos: [
      { id: 'a', text: 'Alpha', done: false },
      { id: 'b', text: 'Beta', done: true }
    ]
  }, { diff: { arrayKey: 'id' } });
  const renderer = hydrateDomRenderer({
    source: fromStateEngine(state),
    target: app,
    manifest: {
      version: 1,
      bindings: [
        { id: 'b:todos', kind: 'each', path: '/todos/*', fields: ['text', 'done'], keyBy: 'id', container: { anchor: 'todos' }, template: 'todo-row' }
      ]
    },
    templates: { 'todo-row': rowTemplate('li', formatTodo) }
  });
  assert(list.children[0] === nodeA, 'hydration should reuse keyed node a');
  assert(list.children[1] === nodeB, 'hydration should reuse keyed node b');
  assertTexts(list.children, ['a:Alpha:open', 'b:Beta:done']);
  state.commit({
    todos: [
      { id: 'b', text: 'Beta moved', done: true },
      { id: 'c', text: 'Gamma', done: false },
      { id: 'a', text: 'Alpha moved', done: false }
    ]
  });
  renderer.flush();
  assert(list.children[0] === nodeB, 'keyed reorder should preserve node b');
  assert(list.children[2] === nodeA, 'keyed reorder should preserve node a');
  assertTexts(list.children, ['b:Beta moved:done', 'c:Gamma:open', 'a:Alpha moved:open']);
  renderer.dispose();
}

function testNestedLists() {
  const root = resetRoot('<main><section data-frontier-id="groups"></section></main>');
  const state = createStateEngine({
    groups: [
      { id: 'g1', title: 'First', items: [{ id: 'a', text: 'One' }, { id: 'b', text: 'Two' }] },
      { id: 'g2', title: 'Second', items: [{ id: 'c', text: 'Three' }] }
    ]
  }, { diff: { arrayKey: 'id' } });
  const renderer = createDomRendererFromManifest({
    source: fromStateEngine(state),
    target: root,
    manifest: {
      version: 1,
      bindings: [
        { id: 'b:groups', kind: 'each', path: '/groups/*', fields: ['title', 'items'], keyBy: 'id', container: { anchor: 'groups' }, template: 'group-row' }
      ]
    },
    templates: {
      'group-row': {
        create(group) {
          const node = document.createElement('article');
          node.innerHTML = '<h2></h2><ol></ol>';
          updateGroupNode(node, group);
          return node;
        },
        update: updateGroupNode
      }
    }
  });
  const firstGroup = root.querySelector('[data-frontier-key="g1"]');
  assertNestedGroups(root, ['First:One,Two', 'Second:Three']);
  state.commitPatch([[0, ['groups', 0, 'items', 1, 'text'], 'Two updated']]);
  renderer.flush();
  assert(root.querySelector('[data-frontier-key="g1"]') === firstGroup, 'nested list parent should be reused');
  assertNestedGroups(root, ['First:One,Two updated', 'Second:Three']);
  renderer.dispose();
}

function testFragments() {
  const root = resetRoot('<main></main>');
  const state = createStateEngine({ user: { first: 'Ada', last: 'Lovelace' } });
  root.querySelector('main').appendChild(jsx(Fragment, {
    children: [
      text('/user/first', { frId: 'first' }),
      jsx('span', { frId: 'middle', children: ' ' }),
      text('/user/last', { frId: 'last' })
    ]
  }));
  const manifest = createJsxManifest(root);
  const renderer = createDomRendererFromManifest({ source: fromStateEngine(state), target: root, manifest });
  assert.strictEqual(root.querySelector('main').children.length, 3, 'fragment should not add a wrapper');
  assert.strictEqual(root.querySelector('[data-frontier-id="first"]').textContent, 'Ada');
  state.commitPatch([[0, ['user', 'last'], 'Byron']]);
  renderer.flush();
  assert.strictEqual(root.querySelector('[data-frontier-id="last"]').textContent, 'Byron');
  renderer.dispose();
}

function testSvgMathml() {
  const root = resetRoot('<main></main>');
  const state = createStateEngine({ radius: 4, symbol: 'x' });
  root.querySelector('main').appendChild(jsx('svg', {
    frId: 'icon',
    viewBox: '0 0 10 10',
    children: jsx('circle', { frId: 'dot', cx: 5, cy: 5, $attr: { r: '/radius' } })
  }));
  root.querySelector('main').appendChild(jsx('math', {
    frId: 'formula',
    children: jsx('mi', { frId: 'symbol', $text: '/symbol' })
  }));
  const manifest = createJsxManifest(root);
  const renderer = createDomRendererFromManifest({ source: fromStateEngine(state), target: root, manifest });
  assert.strictEqual(root.querySelector('[data-frontier-id="icon"]').namespaceURI, 'http://www.w3.org/2000/svg');
  assert.strictEqual(root.querySelector('[data-frontier-id="dot"]').namespaceURI, 'http://www.w3.org/2000/svg');
  assert.strictEqual(root.querySelector('[data-frontier-id="formula"]').namespaceURI, 'http://www.w3.org/1998/Math/MathML');
  assert.strictEqual(root.querySelector('[data-frontier-id="symbol"]').namespaceURI, 'http://www.w3.org/1998/Math/MathML');
  assert.strictEqual(root.querySelector('[data-frontier-id="dot"]').getAttribute('r'), '4');
  assert.strictEqual(root.querySelector('[data-frontier-id="symbol"]').textContent, 'x');
  state.commitPatch([[0, ['radius'], 8], [0, ['symbol'], 'y']]);
  renderer.flush();
  assert.strictEqual(root.querySelector('[data-frontier-id="dot"]').getAttribute('r'), '8');
  assert.strictEqual(root.querySelector('[data-frontier-id="symbol"]').textContent, 'y');
  renderer.dispose();
}

function testDelegatedEvents() {
  const root = resetRoot('<main data-frontier-id="app"><section data-frontier-id="delegate-root"><button id="save" data-action="todo.toggle" data-frontier-action-payload="{&quot;id&quot;:&quot;a&quot;}"><span id="inner">save</span></button></section></main>');
  const state = createStateEngine({ toggled: false });
  let calls = 0;
  const renderer = createDomRendererFromManifest({
    source: fromStateEngine(state),
    target: root.querySelector('[data-frontier-id="app"]'),
    manifest: {
      version: 1,
      bindings: [
        { id: 'a:toggle', kind: 'event', event: 'click', action: 'todo.toggle', delegate: '[data-action="todo.toggle"]', target: { anchor: 'delegate-root' } }
      ]
    },
    actionRegistry: {
      dispatch(actionId, input, options) {
        calls++;
        assert.strictEqual(actionId, 'todo.toggle');
        assert.deepStrictEqual(input.payload, { id: 'a' });
        assert.strictEqual(input.id, 'save');
        assert.strictEqual(input.action, 'todo.toggle');
        assert.strictEqual(options.causeId, 'frontier-dom:a:toggle:click');
        state.commitPatch([[0, ['toggled'], true]]);
      }
    }
  });
  root.querySelector('#inner').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  renderer.flush();
  assert.strictEqual(calls, 1);
  assert.strictEqual(state.get().toggled, true);
  renderer.dispose();
}

function testFormsSelectionIme() {
  const root = resetRoot('<main><input id="name" /></main>');
  const input = root.querySelector('#name');
  const state = createStateEngine({ user: { name: 'abcdef' } });
  const renderer = createDomRenderer({ source: fromStateEngine(state), target: root });
  renderer.formValue('/user/name', input, { preserveSelection: true });
  assert.strictEqual(input.value, 'abcdef');
  input.focus();
  input.setSelectionRange(2, 4, 'forward');
  state.commitPatch([[0, ['user', 'name'], 'uvwxyz']]);
  renderer.flush();
  assert.strictEqual(document.activeElement, input);
  assert.strictEqual(input.selectionStart, 2);
  assert.strictEqual(input.selectionEnd, 4);
  input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  input.value = 'ime draft';
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'x' }));
  assert.strictEqual(state.get().user.name, 'uvwxyz');
  input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'ime draft' }));
  assert.strictEqual(state.get().user.name, 'ime draft');
  renderer.dispose();
}

function testFocusPreservation() {
  const root = resetRoot('<main><ol data-frontier-id="rows"></ol></main>');
  const state = createStateEngine({
    rows: [
      { id: 'a', text: 'Alpha' },
      { id: 'b', text: 'Beta' },
      { id: 'c', text: 'Gamma' }
    ]
  }, { diff: { arrayKey: 'id' } });
  const renderer = createDomRendererFromManifest({
    source: fromStateEngine(state),
    target: root,
    manifest: {
      version: 1,
      bindings: [
        { id: 'b:rows', kind: 'each', path: '/rows/*', fields: ['text'], keyBy: 'id', container: { anchor: 'rows' }, template: 'focus-row' }
      ]
    },
    templates: {
      'focus-row': {
        create(row) {
          const item = document.createElement('li');
          item.innerHTML = '<input />';
          updateFocusRow(item, row);
          return item;
        },
        update: updateFocusRow
      }
    }
  });
  const focusedInput = root.querySelector('[data-frontier-key="b"] input');
  focusedInput.focus();
  state.commit({
    rows: [
      { id: 'c', text: 'Gamma moved' },
      { id: 'b', text: 'Beta moved' },
      { id: 'a', text: 'Alpha moved' }
    ]
  });
  renderer.flush();
  assert.strictEqual(root.querySelector('[data-frontier-key="b"] input'), focusedInput, 'focused keyed input should be reused');
  assert.strictEqual(document.activeElement, focusedInput, 'focused keyed input should remain active after reorder');
  assert.strictEqual(focusedInput.value, 'Beta moved');
  renderer.dispose();
}

function rowTemplate(tag, formatter) {
  return {
    create(row) {
      const node = document.createElement(tag);
      node.textContent = formatter(row);
      return node;
    },
    update(node, row) {
      node.textContent = formatter(row);
    }
  };
}

function formatTodo(row) {
  return row.id + ':' + row.text + ':' + (row.done ? 'done' : 'open');
}

function updateGroupNode(node, group) {
  node.querySelector('h2').textContent = group.title;
  const list = node.querySelector('ol');
  list.textContent = '';
  for (const item of group.items) {
    const child = document.createElement('li');
    child.dataset.id = item.id;
    child.textContent = item.text;
    list.appendChild(child);
  }
}

function updateFocusRow(node, row) {
  node.querySelector('input').value = row.text;
}

function assertNestedGroups(root, expected) {
  const actual = Array.from(root.querySelectorAll('article'), (group) => {
    const title = group.querySelector('h2').textContent;
    const items = Array.from(group.querySelectorAll('li'), (item) => item.textContent).join(',');
    return title + ':' + items;
  });
  assert.deepStrictEqual(actual, expected);
}

function assertTexts(nodes, expected) {
  assert.deepStrictEqual(Array.from(nodes, (node) => node.textContent), expected);
}

function resetRoot(html) {
  const root = document.getElementById('root');
  root.innerHTML = html;
  return root;
}

function assert(value, message) {
  if (!value) throw new Error(message || 'assertion failed');
}

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (!Object.is(actual, expected)) {
    throw new Error(message || 'expected ' + JSON.stringify(actual) + ' to equal ' + JSON.stringify(expected));
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(message || 'expected ' + actualJson + ' to deeply equal ' + expectedJson);
  }
};
</script>`;
}

function resolveDistFile(shortName, fileName) {
  const candidates = [];
  if (shortName === 'frontier-dom') candidates.push(join(packageDir, 'dist', fileName));
  candidates.push(join(workspaceRoot, 'packages', shortName, 'dist', fileName));
  candidates.push(join(packageDir, 'node_modules', '@shapeshift-labs', shortName, 'dist', fileName));
  candidates.push(join(workspaceRoot, 'node_modules', '@shapeshift-labs', shortName, 'dist', fileName));
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Unable to resolve dist file for @shapeshift-labs/' + shortName + '/' + fileName);
}

function packageAssetUrl(assets, shortName, fileName) {
  const filePath = resolveDistFile(shortName, fileName);
  const prefix = '/assets/' + shortName + '/';
  assets.set(prefix, dirname(filePath));
  return prefix + fileName;
}

function resolveAssetPath(assets, pathname) {
  for (const [prefix, dir] of assets) {
    if (!pathname.startsWith(prefix)) continue;
    const relative = pathname.slice(prefix.length);
    if (!relative || relative.includes('..')) return null;
    const filePath = resolve(dir, relative);
    if (!filePath.startsWith(dir + path.sep) && filePath !== dir) return null;
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : null;
  }
  return null;
}

function contentType(filePath) {
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

async function launchChrome(executablePath) {
  const profileDir = fs.mkdtempSync(join(os.tmpdir(), 'frontier-dom-conformance-'));
  const child = spawn(executablePath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profileDir,
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });
  const activePort = await waitForDevToolsActivePort(profileDir, child, () => stderr);
  const webSocketUrl = await readPageWebSocketUrl(activePort.port);
  return {
    webSocketUrl,
    close() {
      child.kill('SIGTERM');
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
  };
}

async function waitForDevToolsActivePort(profileDir, child, readStderr) {
  const activePortPath = join(profileDir, 'DevToolsActivePort');
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    if (child.exitCode !== null) throw new Error('Chrome exited early: ' + readStderr());
    if (fs.existsSync(activePortPath)) {
      const [port, socketPath] = fs.readFileSync(activePortPath, 'utf8').trim().split('\n');
      return { port, path: socketPath };
    }
    await sleep(50);
  }
  throw new Error('Timed out waiting for Chrome DevToolsActivePort');
}

async function readPageWebSocketUrl(port) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    const targets = await fetch('http://127.0.0.1:' + port + '/json/list').then((response) => response.json());
    const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
    if (page) return page.webSocketDebuggerUrl;
    await sleep(50);
  }
  throw new Error('Timed out waiting for a Chrome page target');
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const errors = [];
  let nextId = 1;
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message || JSON.stringify(message.error)));
      else entry.resolve(message.result || {});
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params?.exceptionDetails;
      errors.push(details?.text || details?.exception?.description || 'browser exception');
    } else if (message.method === 'Log.entryAdded') {
      const entry = message.params?.entry;
      if (entry?.level === 'error') errors.push(entry.text);
    }
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolveSend, reject) => {
        pending.set(id, { resolve: resolveSend, reject });
      });
    },
    errors() {
      return errors.slice();
    },
    close() {
      socket.close();
    }
  };
}

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--chrome') out.chrome = argv[++i];
    else if (arg === '--timeout-ms') out.timeoutMs = readPositiveInt(argv[++i], 30000);
    else if (arg === '--skip-browser-if-missing') out.skipBrowserIfMissing = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node test/browser-conformance.mjs [--chrome /path/to/chrome] [--timeout-ms 30000] [--skip-browser-if-missing]');
      process.exit(0);
    } else {
      throw new Error('unknown argument: ' + arg);
    }
  }
  return out;
}

function readPositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
