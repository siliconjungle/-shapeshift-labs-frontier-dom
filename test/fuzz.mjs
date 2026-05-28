import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { createStateEngine } from '@shapeshift-labs/frontier-state';
import { createDomRenderer, fromStateEngine } from '../dist/index.js';

const args = parseArgs(process.argv.slice(2));
const cases = readPositiveInt(args.cases, 200);
const steps = readPositiveInt(args.steps, 32);
const seed = readPositiveInt(args.seed, 0xd04);
const rng = mulberry32(seed);

for (let caseId = 0; caseId < cases; caseId++) {
  const localRng = mulberry32((rng() * 0xffffffff) >>> 0);
  runCase(caseId, localRng);
}

console.log('frontier dom fuzz passed cases=' + cases + ' steps=' + steps + ' seed=' + seed);

function runCase(caseId, rng) {
  const dom = new JSDOM('<!doctype html><div><span id="tick"></span><div id="gate"></div><ul id="rows"></ul></div>');
  const { document } = dom.window;
  const tick = document.getElementById('tick');
  const gate = document.getElementById('gate');
  const rows = document.getElementById('rows');
  let expected = makeDocument(caseId, rng);
  const state = createStateEngine(clone(expected), { diff: { arrayKey: 'id' } });
  const renderer = createDomRenderer({ source: fromStateEngine(state) });

  renderer.text('/meta/tick', tick);
  renderer.when('/meta/open', {
    container: gate,
    create(value) {
      const item = document.createElement('strong');
      item.textContent = 'open:' + String(value);
      return item;
    },
    update(node, value) {
      node.textContent = 'open:' + String(value);
    },
    fallback: {
      create() {
        const item = document.createElement('em');
        item.textContent = 'closed';
        return item;
      }
    }
  });
  renderer.each('/rows/*', {
    container: rows,
    keyBy: 'id',
    fields: ['text', 'done', 'score'],
    create(row) {
      const item = document.createElement('li');
      item.dataset.id = row.id;
      item.textContent = formatRow(row);
      return item;
    },
    update(node, row) {
      node.textContent = formatRow(row);
    }
  });

  assertDom(expected, tick, gate, rows);

  for (let step = 0; step < steps; step++) {
    const choice = randomInt(rng, 7);
    if (choice === 0 && expected.rows.length > 0) {
      const index = randomInt(rng, expected.rows.length);
      const nextScore = expected.rows[index].score + 1 + randomInt(rng, 7);
      expected.rows[index].score = nextScore;
      state.commitPatch([[0, ['rows', index, 'score'], nextScore]]);
    } else if (choice === 1 && expected.rows.length > 0) {
      const index = randomInt(rng, expected.rows.length);
      expected.rows[index].done = !expected.rows[index].done;
      state.commitPatch([[0, ['rows', index, 'done'], expected.rows[index].done]]);
    } else {
      const next = clone(expected);
      mutateDocument(next, rng, choice);
      state.commit(next);
      expected = next;
    }
    renderer.flush();
    assert.deepStrictEqual(state.get(), expected, 'state mismatch after step ' + step);
    assertDom(expected, tick, gate, rows);
  }

  renderer.dispose();
}

function mutateDocument(doc, rng, choice) {
  doc.meta.tick++;
  if (choice === 2 && doc.rows.length > 0) {
    const index = randomInt(rng, doc.rows.length);
    doc.rows[index].text += '-x';
    return;
  }
  if (choice === 3 || doc.rows.length === 0) {
    const id = 'row-' + doc.nextId++;
    doc.rows.splice(randomInt(rng, doc.rows.length + 1), 0, {
      id,
      text: 'Row ' + id,
      done: false,
      score: randomInt(rng, 1000)
    });
    return;
  }
  if (choice === 4 && doc.rows.length > 1) {
    doc.rows.splice(randomInt(rng, doc.rows.length), 1);
    return;
  }
  if (choice === 5 && doc.rows.length > 1) {
    const from = randomInt(rng, doc.rows.length);
    const [row] = doc.rows.splice(from, 1);
    doc.rows.splice(randomInt(rng, doc.rows.length + 1), 0, row);
    return;
  }
  if (choice === 6) doc.meta.open = !doc.meta.open;
  else doc.meta.label = 'case-' + randomInt(rng, 1000);
}

function assertDom(expected, tick, gate, rows) {
  assert.strictEqual(tick.textContent, String(expected.meta.tick));
  assert.strictEqual(gate.textContent, expected.meta.open ? 'open:true' : 'closed');
  assert.deepStrictEqual(
    Array.from(rows.children, (item) => [item.dataset.id, item.textContent]),
    expected.rows.map((row) => [row.id, formatRow(row)])
  );
}

function makeDocument(caseId, rng) {
  const rowCount = 3 + randomInt(rng, 6);
  const rows = new Array(rowCount);
  for (let index = 0; index < rowCount; index++) {
    rows[index] = {
      id: 'case-' + caseId + '-' + index,
      text: 'Row ' + index,
      done: randomInt(rng, 2) === 0,
      score: randomInt(rng, 100)
    };
  }
  return {
    rows,
    nextId: rowCount,
    meta: { tick: 0, open: randomInt(rng, 2) === 0, label: 'case-' + caseId }
  };
}

function formatRow(row) {
  return row.id + ':' + row.text + ':' + row.score + ':' + (row.done ? 'done' : 'open');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function randomInt(rng, max) {
  return Math.floor(rng() * max);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--cases') out.cases = argv[++i];
    else if (arg === '--steps') out.steps = argv[++i];
    else if (arg === '--seed') out.seed = argv[++i];
    else throw new Error('unknown argument: ' + arg);
  }
  return out;
}

function readPositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return function next() {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
