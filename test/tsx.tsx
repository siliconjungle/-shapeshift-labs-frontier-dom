import { createStateEngine } from '@shapeshift-labs/frontier-state';
import { createApp, fromStateEngine, type FrontierDomApp } from '../dist/index.js';
import { each, fixedLayout, text, virtualEach, when } from '../dist/jsx-runtime.js';

const state = createStateEngine(
  {
    title: 'Typed TSX',
    session: { userId: 'u1' },
    todos: [{ id: 'a', text: 'Alpha' }],
    messages: [{ id: 'm1', body: 'Hello' }]
  },
  { diff: { arrayKey: 'id' } }
);

const root = document.createElement('div');
const app: FrontierDomApp = createApp({
  source: fromStateEngine(state),
  target: root,
  templates: {
    row: {
      create() {
        return document.createElement('li');
      }
    },
    session: {
      create() {
        return document.createElement('section');
      }
    },
    empty: {
      create() {
        return document.createElement('section');
      }
    }
  }
});

function App(): Node {
  return (
    <main frId="typed-tsx">
      <h1>{text('/title', { frId: 'title' })}</h1>
      {when('/session/userId', {
        frId: 'session',
        template: 'session',
        fallbackTemplate: 'empty'
      })}
      {each('/todos/*', {
        frId: 'todos',
        as: 'ul',
        keyBy: 'id',
        fields: ['text'],
        template: 'row'
      })}
      {virtualEach('/messages/*', {
        frId: 'messages',
        keyBy: 'id',
        template: 'row',
        viewport: { offset: 0, size: 120 },
        layout: fixedLayout(24),
        overscan: 2
      })}
      <ul frId="raw-todos" $each={{ path: '/todos/*', fields: ['text'], keyBy: 'id', template: 'row' }} />
    </main>
  );
}

const view: Node = <App />;
const renderer = app.mount(view);

void renderer;
