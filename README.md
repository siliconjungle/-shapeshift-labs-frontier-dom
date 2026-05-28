# @shapeshift-labs/frontier-dom

Patch-native DOM and host rendering primitives for Frontier state sources.

This package owns the host-neutral patch binding runtime, DOM binding table, manifest hydration, JSX manifest helpers, an optional TSX compiler, focused fuzzers, and package-local benchmarks for the rendering experiment. DOM-free virtualization lives in `@shapeshift-labs/frontier-virtual`. Competitor comparisons live in root benchmark artifacts, not this README.

- npm: [`@shapeshift-labs/frontier-dom`](https://www.npmjs.com/package/@shapeshift-labs/frontier-dom)
- source: [`siliconjungle/-shapeshift-labs-frontier-dom`](https://github.com/siliconjungle/-shapeshift-labs-frontier-dom)
- license: MIT

## Related Packages

The published Frontier package family is generated from one shared package catalog so READMEs stay in sync across packages:

- [`@shapeshift-labs/frontier`](https://www.npmjs.com/package/@shapeshift-labs/frontier): Core JSON diff/apply, compact patch tuples, JSON Pointer, equality, clone, validation, Unicode helpers.
- [`@shapeshift-labs/frontier-query`](https://www.npmjs.com/package/@shapeshift-labs/frontier-query): Shared query-key, selector path, condition, entity identity, and table-shape primitives.
- [`@shapeshift-labs/frontier-codec`](https://www.npmjs.com/package/@shapeshift-labs/frontier-codec): Patch serialization, binary frames, canonical JSON, and patch-history codecs.
- [`@shapeshift-labs/frontier-engine`](https://www.npmjs.com/package/@shapeshift-labs/frontier-engine): Stateful planned diff engine, adaptive profiles, schema plans, and engine-level history helpers.
- [`@shapeshift-labs/frontier-state`](https://www.npmjs.com/package/@shapeshift-labs/frontier-state): Patch-routed app-state subscriptions, owned commits, maintained views, and path mapping.
- [`@shapeshift-labs/frontier-state-cache`](https://www.npmjs.com/package/@shapeshift-labs/frontier-state-cache): Normalized query-result cache with entity/query watchers, persistence, change logs, optimistic layers, and mutation bridge.
- [`@shapeshift-labs/frontier-state-cache-idb`](https://www.npmjs.com/package/@shapeshift-labs/frontier-state-cache-idb): IndexedDB persistence adapter for Frontier state-cache snapshots.
- [`@shapeshift-labs/frontier-state-cache-file`](https://www.npmjs.com/package/@shapeshift-labs/frontier-state-cache-file): Structured file persistence adapter for Frontier state-cache snapshots and change logs.
- [`@shapeshift-labs/frontier-state-cache-sql`](https://www.npmjs.com/package/@shapeshift-labs/frontier-state-cache-sql): SQL persistence adapter for Frontier state-cache snapshots and change logs.
- [`@shapeshift-labs/frontier-schema`](https://www.npmjs.com/package/@shapeshift-labs/frontier-schema): JSON Schema validation, Frontier profile generation, CloudEvent envelopes, and query/table schema helpers.
- [`@shapeshift-labs/frontier-event-log`](https://www.npmjs.com/package/@shapeshift-labs/frontier-event-log): Bounded event logs, replay cursors, consumer acknowledgements, keyed compaction, checkpoints, and Frontier patch event records.
- [`@shapeshift-labs/frontier-scheduler`](https://www.npmjs.com/package/@shapeshift-labs/frontier-scheduler): Deterministic work scheduling, lanes, cancellation, backpressure, frame policies, replay snapshots, and work graphs.
- [`@shapeshift-labs/frontier-logging`](https://www.npmjs.com/package/@shapeshift-labs/frontier-logging): Opt-in structured logging, browser telemetry, file sinks, exporters, benchmark traces, and Frontier patch/update summaries.
- [`@shapeshift-labs/frontier-mutation`](https://www.npmjs.com/package/@shapeshift-labs/frontier-mutation): Explicit mutation and selector plans compiled to Frontier patches or CRDT operations.
- [`@shapeshift-labs/frontier-virtual`](https://www.npmjs.com/package/@shapeshift-labs/frontier-virtual): DOM-neutral virtualization, layout providers, range materialization, grids, spatial culling, frustum culling, and serializable layout state.
- [`@shapeshift-labs/frontier-crdt`](https://www.npmjs.com/package/@shapeshift-labs/frontier-crdt): Native CRDT documents, update tooling, awareness, branches, conflict introspection, version frames, and undo.
- [`@shapeshift-labs/frontier-crdt-sync`](https://www.npmjs.com/package/@shapeshift-labs/frontier-crdt-sync): CRDT sync endpoints, repo/storage/provider contracts, document URLs, local networks, model checking, forensics, and text binding contracts.
- [`@shapeshift-labs/frontier-crdt-websocket`](https://www.npmjs.com/package/@shapeshift-labs/frontier-crdt-websocket): WebSocket client/server transports for Frontier CRDT sync providers.
- [`@shapeshift-labs/frontier-react`](https://www.npmjs.com/package/@shapeshift-labs/frontier-react): React external-store hooks and adapters for Frontier state, cache, and CRDT surfaces.
- [`@shapeshift-labs/frontier-richtext`](https://www.npmjs.com/package/@shapeshift-labs/frontier-richtext): Rich text Delta normalization/application, marks, embeds, ranges, and cursor/selection transforms for local editor integrations.
- [`@shapeshift-labs/frontier-realtime`](https://www.npmjs.com/package/@shapeshift-labs/frontier-realtime): Shared realtime command, tick, snapshot, prediction, reconciliation, interpolation, rollback, message, and delta primitives.
- [`@shapeshift-labs/frontier-realtime-server`](https://www.npmjs.com/package/@shapeshift-labs/frontier-realtime-server): Authoritative realtime room, tick, command validation, rate-limit, session, and snapshot-history runtime.
- [`@shapeshift-labs/frontier-realtime-websocket`](https://www.npmjs.com/package/@shapeshift-labs/frontier-realtime-websocket): WebSocket client, wire, and Node room-server transport for Frontier realtime.
- [`@shapeshift-labs/frontier-game`](https://www.npmjs.com/package/@shapeshift-labs/frontier-game): Game-facing entity, component, player, room, ownership, spatial interest, rollback, physics, and replication helpers above realtime.

Package source repositories:

- [`siliconjungle/-shapeshift-labs-frontier`](https://github.com/siliconjungle/-shapeshift-labs-frontier)
- [`siliconjungle/-shapeshift-labs-frontier-query`](https://github.com/siliconjungle/-shapeshift-labs-frontier-query)
- [`siliconjungle/-shapeshift-labs-frontier-codec`](https://github.com/siliconjungle/-shapeshift-labs-frontier-codec)
- [`siliconjungle/-shapeshift-labs-frontier-engine`](https://github.com/siliconjungle/-shapeshift-labs-frontier-engine)
- [`siliconjungle/-shapeshift-labs-frontier-state`](https://github.com/siliconjungle/-shapeshift-labs-frontier-state)
- [`siliconjungle/-shapeshift-labs-frontier-state-cache`](https://github.com/siliconjungle/-shapeshift-labs-frontier-state-cache)
- [`siliconjungle/-shapeshift-labs-frontier-state-cache-idb`](https://github.com/siliconjungle/-shapeshift-labs-frontier-state-cache-idb)
- [`siliconjungle/-shapeshift-labs-frontier-state-cache-file`](https://github.com/siliconjungle/-shapeshift-labs-frontier-state-cache-file)
- [`siliconjungle/-shapeshift-labs-frontier-state-cache-sql`](https://github.com/siliconjungle/-shapeshift-labs-frontier-state-cache-sql)
- [`siliconjungle/-shapeshift-labs-frontier-schema`](https://github.com/siliconjungle/-shapeshift-labs-frontier-schema)
- [`siliconjungle/-shapeshift-labs-frontier-event-log`](https://github.com/siliconjungle/-shapeshift-labs-frontier-event-log)
- [`siliconjungle/-shapeshift-labs-frontier-scheduler`](https://github.com/siliconjungle/-shapeshift-labs-frontier-scheduler)
- [`siliconjungle/-shapeshift-labs-frontier-logging`](https://github.com/siliconjungle/-shapeshift-labs-frontier-logging)
- [`siliconjungle/-shapeshift-labs-frontier-mutation`](https://github.com/siliconjungle/-shapeshift-labs-frontier-mutation)
- [`siliconjungle/-shapeshift-labs-frontier-virtual`](https://github.com/siliconjungle/-shapeshift-labs-frontier-virtual)
- [`siliconjungle/-shapeshift-labs-frontier-dom`](https://github.com/siliconjungle/-shapeshift-labs-frontier-dom)
- [`siliconjungle/-shapeshift-labs-frontier-crdt`](https://github.com/siliconjungle/-shapeshift-labs-frontier-crdt)
- [`siliconjungle/-shapeshift-labs-frontier-crdt-sync`](https://github.com/siliconjungle/-shapeshift-labs-frontier-crdt-sync)
- [`siliconjungle/-shapeshift-labs-frontier-crdt-websocket`](https://github.com/siliconjungle/-shapeshift-labs-frontier-crdt-websocket)
- [`siliconjungle/-shapeshift-labs-frontier-react`](https://github.com/siliconjungle/-shapeshift-labs-frontier-react)
- [`siliconjungle/-shapeshift-labs-frontier-richtext`](https://github.com/siliconjungle/-shapeshift-labs-frontier-richtext)
- [`siliconjungle/-shapeshift-labs-frontier-realtime`](https://github.com/siliconjungle/-shapeshift-labs-frontier-realtime)
- [`siliconjungle/-shapeshift-labs-frontier-realtime-server`](https://github.com/siliconjungle/-shapeshift-labs-frontier-realtime-server)
- [`siliconjungle/-shapeshift-labs-frontier-realtime-websocket`](https://github.com/siliconjungle/-shapeshift-labs-frontier-realtime-websocket)
- [`siliconjungle/-shapeshift-labs-frontier-game`](https://github.com/siliconjungle/-shapeshift-labs-frontier-game)

## Install

```sh
npm install @shapeshift-labs/frontier-dom @shapeshift-labs/frontier-state
```

## Current Surface

The main product-facing API is JSX-first:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@shapeshift-labs/frontier-dom"
  }
}
```

```tsx
import { createApp, fromStateEngine } from '@shapeshift-labs/frontier-dom';
import { each, fixedLayout, text, virtualEach, when } from '@shapeshift-labs/frontier-dom/jsx-runtime';

const app = createApp({
  source: fromStateEngine(state),
  target: '#app',
  templates: {
    'todo-row.v1': {
      create(todo) {
        const item = document.createElement('li');
        item.textContent = String(todo?.text ?? '');
        return item;
      },
      update(item, todo) {
        item.textContent = String(todo?.text ?? '');
      }
    },
    'signed-in.v1': { create: renderSignedInPanel },
    'signed-out.v1': { create: renderSignedOutPanel },
    'message-row.v1': { create: renderMessage }
  }
});

app.mount(
  <main frId="app">
    {text('/user/name', { frId: 'user-name' })}
    {when('/session/userId', {
      frId: 'session-slot',
      template: 'signed-in.v1',
      fallbackTemplate: 'signed-out.v1'
    })}
    {each('/todos/*', {
      frId: 'todos',
      as: 'ul',
      keyBy: 'id',
      fields: ['text', 'done'],
      template: 'todo-row.v1'
    })}
    {virtualEach('/messages/*', {
      frId: 'messages',
      keyBy: 'id',
      template: 'message-row.v1',
      viewport: { offset: 0, size: 640 },
      layout: fixedLayout(28),
      overscan: 8
    })}
  </main>
);
```

Production builds should prefer the compiler path. The optional `./compiler` subpath lowers a static TSX entry to HTML plus a serializable manifest, and `createApp().mount(compiled)` hydrates it:

```ts
import { createApp, fromStateEngine } from '@shapeshift-labs/frontier-dom';
import { compileFrontierJsx } from '@shapeshift-labs/frontier-dom/compiler';

const compiled = await compileFrontierJsx(sourceText, { entry: 'App' });
const app = createApp({ source: fromStateEngine(state), target: '#app', templates });

app.mount(compiled);
```

The lower-level binding API remains available for explicit host control:

```ts
import { createDomRenderer, fromStateEngine } from '@shapeshift-labs/frontier-dom';

const renderer = createDomRenderer({ source: fromStateEngine(state) });

renderer.text('/user/name', nameNode);
renderer.prop('/todos/0/done', checkbox, 'checked');
renderer.each('/todos/*', {
  container: list,
  keyBy: 'id',
  fields: ['text', 'done'],
  create(row) {
    const item = document.createElement('li');
    item.textContent = String(row?.text ?? '');
    return item;
  },
  update(node, row) {
    node.textContent = String(row?.text ?? '');
  }
});

renderer.when('/session/userId', {
  container: sessionSlot,
  create() {
    return renderSignedInPanel();
  },
  fallback: {
    create() {
      return renderSignedOutPanel();
    }
  }
});
```

Durable DOM state should use a serializable manifest plus an app registry for local functions:

```ts
import { hydrateDomRenderer } from '@shapeshift-labs/frontier-dom';

hydrateDomRenderer({
  source: fromStateEngine(state),
  target: document.getElementById('app'),
  manifest: {
    version: 1,
    source: { kind: 'state', basis: state.getBasis() },
    bindings: [
      { id: 'b:user', kind: 'text', path: '/user/name', target: { anchor: 'user-name' } },
      {
        id: 'b:session',
        kind: 'when',
        path: '/session/userId',
        target: { anchor: 'session-slot' },
        template: 'signed-in.v1',
        fallbackTemplate: 'signed-out.v1'
      },
      {
        id: 'b:todos',
        kind: 'each',
        path: '/todos/*',
        fields: ['text', 'done'],
        keyBy: 'id',
        container: { anchor: 'todos' },
        template: 'todo-row.v1'
      },
      { id: 'a:add', kind: 'event', event: 'click', action: 'todo.add', target: { anchor: 'add-todo' } }
    ]
  },
  templates: {
    'todo-row.v1': {
      create(todo) {
        const item = document.createElement('li');
        item.textContent = String(todo?.text ?? '');
        return item;
      }
    }
  },
  actions: {
    'todo.add': ({ source }) => {
      const todos = (source.get() as any)?.todos ?? [];
      source.commitPatch?.([[6, ['todos'], todos.length, 0, [{ id: 'new', text: 'New todo', done: false }]]]);
    }
  },
  actionRegistry: actions
});
```

`actionRegistry` is structural, so it can be a `@shapeshift-labs/frontier-mutation` action registry or an app-owned adapter with the same `dispatch(actionId, input, options)` method. Manifest events use local `actions` first, then fall back to the registry:

```ts
import { createActionRegistry } from '@shapeshift-labs/frontier-mutation';

const actions = createActionRegistry({ state: fromStateEngine(state), actor: 'local-user' });

actions.register({
  id: 'todo.toggle',
  reads: ['/todos/*/done'],
  writes: ['/todos/*/done'],
  run(ctx, input) {
    const todo = ctx.query('/todos/*', { id: input.payload.id });
    if (todo) ctx.commit([[0, ['todos', todo.index, 'done'], !todo.value.done]]);
  }
});
```

The same patch graph can drive non-DOM hosts through `./core`:

```ts
import { createPatchRenderer, fromStateEngine, syncPatchScheduler } from '@shapeshift-labs/frontier-dom/core';

const bridge = createPatchRenderer({
  source: fromStateEngine(state),
  scheduler: syncPatchScheduler
});

bridge.bind({
  path: '/player/position',
  apply({ value }) {
    playerSprite.position.set(value.x, value.y);
  }
});
```

`createDomSchedulerFromRuntime()` and `createPatchSchedulerFromRuntime()` adapt any structural work scheduler into the renderer flush scheduler. That lets DOM and non-DOM host updates share action, cache, logging, and game-loop lanes without making `frontier-dom` import the scheduler package.

JSX helpers are available from `./jsx-runtime`; they create real DOM nodes with `data-frontier-*` metadata and `createJsxManifest()` turns that metadata into the same manifest shape. Build-time TSX compilation is available from `./compiler`:

```ts
import { compileFrontierJsx } from '@shapeshift-labs/frontier-dom/compiler';

const compiled = await compileFrontierJsx(`
  function App() {
    return (
      <main frId="app">
      <span frId="name" $text="/user/name" />
      {virtualEach("/messages/*", {
        frId: "messages",
        keyBy: "id",
        template: "message-row.v1",
        viewport: { offset: 0, size: 640 },
        layout: textLayout({ field: "body", font: "14px Inter", lineHeight: 20, width: 420 }),
        overscan: 8
      })}
      </main>
    );
  }
`, { entry: 'App' });

compiled.html;
compiled.manifest;
```

Render trace events can be sent to Frontier logging through `./logging`:

```ts
import { createRenderLogSink } from '@shapeshift-labs/frontier-dom/logging';

createDomRenderer({
  source: fromStateEngine(state),
  trace: createRenderLogSink(logger)
});
```

First-class range/materialization lives in `@shapeshift-labs/frontier-virtual`, a DOM-free package shared by DOM renderers, canvas/WebGL hosts, and game cameras:

```ts
import { createFixedLayout, virtualize, virtualizeFrustum } from '@shapeshift-labs/frontier-virtual';

const visibleRows = virtualize({
  items: state.get().messages,
  keyBy: 'id',
  viewport: { offset: scrollTop, size: viewportHeight },
  layout: createFixedLayout(28),
  overscan: 8
});

const visibleObjects = virtualizeFrustum(sceneObjects, cameraFrustum);
```

DOM materialization uses the same range engine:

```ts
renderer.virtualEach('/messages/*', {
  container: list,
  keyBy: 'id',
  viewport: (source) => source.get().viewport,
  viewportWatch: '/viewport',
  layout: createFixedLayout(28),
  overscan: 8,
  create(message) {
    return renderMessage(message);
  },
  update(node, message) {
    updateMessage(node, message);
  }
});
```

JSX helpers lower to the same manifest shape at runtime and in the compiler:

```tsx
import { each, fixedLayout, text, virtualEach, when } from '@shapeshift-labs/frontier-dom/jsx-runtime';

const view = (
  <main>
    {text('/user/name', { frId: 'user-name' })}
    {each('/todos/*', {
      frId: 'todos',
      as: 'ul',
      keyBy: 'id',
      template: 'todo-row.v1'
    })}
    {when('/session/userId', {
      frId: 'session-slot',
      template: 'signed-in.v1',
      fallbackTemplate: 'signed-out.v1'
    })}
    {virtualEach('/messages/*', {
      frId: 'messages',
      keyBy: 'id',
      template: 'message-row.v1',
      viewport: { offset: 0, size: 640 },
      layout: fixedLayout(28),
      overscan: 8
    })}
  </main>
);
```

The root DOM renderer also has opt-in event delegation and composition-aware form binding:

```ts
renderer.delegate(app, 'click', '[data-action]', (event, target) => {
  renderer.commitPatch([[0, ['lastAction'], target.getAttribute('data-action')]]);
});

renderer.formValue('/profile/name', input, { preserveSelection: true });
```

Optional SSR/devtools helpers stay behind subpaths:

```ts
import { createDomDevtoolsSink } from '@shapeshift-labs/frontier-dom/devtools';
import { renderDomStateScript } from '@shapeshift-labs/frontier-dom/ssr';
```

## Benchmarks

These are Frontier-only package measurements, not competitor comparisons.

Run package-local Frontier measurements:

```sh
npm run bench
```

Run the root competitor harness:

```sh
npm run bench:frontier-dom:competitors
```
