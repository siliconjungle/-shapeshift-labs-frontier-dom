import {
  OP_ARRAY_OBJECT_FIELD_ASSIGN,
  OP_ARRAY_SPLICE,
  OP_REMOVE,
  OP_SET
} from '@shapeshift-labs/frontier/constants';
import { getCachedPointerPath, getPath } from '@shapeshift-labs/frontier/pointer';
import type {
  JsonPath,
  JsonValue,
  Patch,
  PatchSubscription,
  StateEngine,
  WatchOptions,
  WatchPath
} from '@shapeshift-labs/frontier-state';

export type FrontierPatchRenderCallback = (patch: Patch) => void;
export type FrontierPatchStatePatchInput = Patch;
export type FrontierPatchStatePatchCommitOptions = Record<string, unknown>;

type FrontierPatchStateEngineLike = StateEngine & {
  commitPatch(patch: FrontierPatchStatePatchInput, options?: FrontierPatchStatePatchCommitOptions): JsonValue | undefined;
  getBasis?(): number | string | undefined;
  getHeads?(): readonly string[] | undefined;
  getStateVector?(): Record<string, number> | undefined;
};

export interface FrontierPatchRenderSource {
  get(): JsonValue | undefined;
  watch(options: WatchOptions, callback: FrontierPatchRenderCallback): PatchSubscription;
  commitPatch?(patch: FrontierPatchStatePatchInput, options?: FrontierPatchStatePatchCommitOptions): JsonValue | undefined;
  getBasis?(): number | string | undefined;
  getHeads?(): readonly string[] | undefined;
  getStateVector?(): Record<string, number> | undefined;
}

export interface FrontierPatchRenderScheduler {
  sync?: boolean;
  queue(callback: () => void): void;
}

export interface FrontierPatchWorkSchedulerTask {
  id?: string;
  type?: string;
  lane?: string;
  area?: string;
  priority?: unknown;
  units?: number;
  key?: string;
  metadata?: Record<string, unknown>;
  run(context?: unknown): unknown;
}

export interface FrontierPatchWorkSchedulerLike {
  schedule(task: FrontierPatchWorkSchedulerTask): unknown;
  run?(options?: unknown): unknown;
  requestRun?(options?: unknown): unknown;
}

export interface FrontierPatchWorkSchedulerOptions {
  id?: string;
  lane?: string;
  area?: string;
  priority?: unknown;
  units?: number;
  key?: string;
  autoRun?: boolean;
  runOptions?: unknown;
}

export interface FrontierPatchRendererOptions {
  source: FrontierPatchRenderSource;
  scheduler?: FrontierPatchRenderScheduler;
  trace?: boolean | FrontierPatchRenderTraceSink;
}

export type FrontierPatchBindingKind = 'value' | 'each' | 'effect';

export type FrontierPatchRenderTraceSink = (event: FrontierPatchRenderTraceEvent) => void;

export type FrontierPatchRenderTraceEvent =
  | {
      kind: 'binding-create';
      bindingId: number;
      bindingName?: string;
      bindingKind: FrontierPatchBindingKind;
      paths: JsonPath[];
    }
  | {
      kind: 'binding-dirty';
      bindingId: number;
      bindingName?: string;
      bindingKind: FrontierPatchBindingKind;
      patchItems: number;
    }
  | {
      kind: 'host-write';
      bindingId: number;
      bindingName?: string;
      bindingKind: FrontierPatchBindingKind;
      path: JsonPath;
    }
  | {
      kind: 'binding-dispose';
      bindingId: number;
      bindingName?: string;
      bindingKind: FrontierPatchBindingKind;
    };

export interface FrontierPatchBinding {
  readonly id: number;
  readonly name: string | undefined;
  readonly kind: FrontierPatchBindingKind;
  readonly active: boolean;
  dispose(): void;
}

export type FrontierPatchEquals = (previous: JsonValue | undefined, next: JsonValue | undefined) => boolean;

export interface FrontierPatchValueContext {
  value: JsonValue | undefined;
  previous: JsonValue | undefined;
  path: JsonPath;
  patch: Patch;
  source: FrontierPatchRenderSource;
  renderer: FrontierPatchRenderer;
}

export interface FrontierPatchValueBindingOptions {
  name?: string;
  path: WatchPath;
  watch?: WatchOptions;
  equals?: FrontierPatchEquals;
  read?: (sourceValue: JsonValue | undefined, path: JsonPath, patch: Patch) => JsonValue | undefined;
  apply(context: FrontierPatchValueContext): void;
}

export type FrontierPatchKeyGetter = (
  value: JsonValue | undefined,
  index: number,
  key: string | number
) => string | number | null | undefined;

export interface FrontierPatchEachItemContext {
  key: string;
  index: number;
  patch: Patch;
  source: FrontierPatchRenderSource;
  renderer: FrontierPatchRenderer;
}

export interface FrontierPatchEachBindingOptions<TTarget = unknown> {
  name?: string;
  path: WatchPath;
  fields?: WatchPath[];
  keyBy?: string | number | FrontierPatchKeyGetter;
  create(value: JsonValue | undefined, context: FrontierPatchEachItemContext): TTarget;
  update?: (target: TTarget, value: JsonValue | undefined, context: FrontierPatchEachItemContext) => void;
  remove?: (target: TTarget, context: FrontierPatchEachItemContext) => void;
  reorder?: (entries: Array<{ key: string; index: number; target: TTarget }>, context: { patch: Patch; renderer: FrontierPatchRenderer; source: FrontierPatchRenderSource }) => void;
}

export interface FrontierPatchEffectContext {
  value: JsonValue | undefined;
  values: Array<JsonValue | undefined>;
  paths: JsonPath[];
  patch: Patch;
  source: FrontierPatchRenderSource;
  renderer: FrontierPatchRenderer;
  cleanup(callback: () => void): void;
}

export interface FrontierPatchRenderer {
  readonly source: FrontierPatchRenderSource;
  readonly size: number;
  bind(options: FrontierPatchValueBindingOptions): FrontierPatchBinding;
  each<TTarget = unknown>(options: FrontierPatchEachBindingOptions<TTarget>): FrontierPatchBinding;
  effect(paths: WatchPath | WatchPath[] | WatchOptions | WatchOptions[], callback: (context: FrontierPatchEffectContext) => void): FrontierPatchBinding;
  flush(): void;
  dispose(): void;
  commitPatch(patch: FrontierPatchStatePatchInput, options?: FrontierPatchStatePatchCommitOptions): JsonValue | undefined;
  getTrace(): FrontierPatchRenderTraceEvent[];
}

type BindingRecord = {
  id: number;
  name?: string;
  kind: FrontierPatchBindingKind;
  active: boolean;
  subscriptions: PatchSubscription[];
  pendingPatch: Patch;
  paths: JsonPath[];
  apply(patch: Patch): void;
  dispose?(): void;
};

type EachEntry<TTarget> = {
  key: string;
  index: number;
  target: TTarget;
};

const EMPTY_PATCH: Patch = [];
const DEFAULT_TRACE_LIMIT = 2048;
const PATCH_VALUE_NOT_FOUND = Symbol('frontierPatchValueNotFound');
let nextPatchSchedulerAdapterId = 1;

export function createPatchRenderer(options: FrontierPatchRendererOptions): FrontierPatchRenderer {
  return new PatchRenderer(options);
}

export const syncPatchScheduler: FrontierPatchRenderScheduler = {
  sync: true,
  queue(callback) {
    callback();
  }
};

export const manualPatchScheduler: FrontierPatchRenderScheduler = {
  queue() {}
};

export function fromStateEngine(engine: StateEngine): FrontierPatchRenderSource {
  const stateEngine = engine as FrontierPatchStateEngineLike;
  return {
    get: () => stateEngine.get(),
    watch: (options, callback) => stateEngine.watch(options, callback),
    commitPatch: (patch, options) => stateEngine.commitPatch(patch, options),
    getBasis: stateEngine.getBasis ? () => stateEngine.getBasis?.() : undefined,
    getHeads: stateEngine.getHeads ? () => stateEngine.getHeads?.() : undefined,
    getStateVector: stateEngine.getStateVector ? () => stateEngine.getStateVector?.() : undefined
  };
}

export function fromPatchSource(source: FrontierPatchRenderSource): FrontierPatchRenderSource {
  return source;
}

export function createPatchSchedulerFromRuntime(
  scheduler: FrontierPatchWorkSchedulerLike,
  options: FrontierPatchWorkSchedulerOptions = {}
): FrontierPatchRenderScheduler {
  if (scheduler === null || typeof scheduler !== 'object' || typeof scheduler.schedule !== 'function') {
    throw new TypeError('frontier-dom core runtime scheduler must expose schedule()');
  }
  const id = options.id ?? 'frontier-patch-render:' + nextPatchSchedulerAdapterId++;
  return {
    queue(callback) {
      scheduler.schedule({
        id: id + ':flush:' + nextPatchSchedulerAdapterId++,
        type: 'frontier.patch-render.flush',
        lane: options.lane ?? 'render',
        area: options.area ?? 'render',
        priority: options.priority ?? 'high',
        units: options.units ?? 1,
        key: options.key ?? id + ':flush',
        metadata: { renderer: id },
        run: callback
      });
      if (options.autoRun === true) {
        if (typeof scheduler.requestRun === 'function') scheduler.requestRun(options.runOptions);
        else if (typeof scheduler.run === 'function') scheduler.run(options.runOptions);
      }
    }
  };
}

class PatchRenderer implements FrontierPatchRenderer {
  readonly source: FrontierPatchRenderSource;
  private scheduler: FrontierPatchRenderScheduler;
  private records = new Map<number, BindingRecord>();
  private dirty = new Set<number>();
  private scheduled = false;
  private disposed = false;
  private nextId = 1;
  private traceEnabled: boolean;
  private traceSink: FrontierPatchRenderTraceSink | null;
  private traceEvents: FrontierPatchRenderTraceEvent[] = [];

  constructor(options: FrontierPatchRendererOptions) {
    this.source = options.source;
    this.scheduler = options.scheduler ?? MICRO_TASK_SCHEDULER;
    this.traceEnabled = options.trace !== undefined && options.trace !== false;
    this.traceSink = typeof options.trace === 'function' ? options.trace : null;
  }

  get size(): number {
    return this.records.size;
  }

  bind(options: FrontierPatchValueBindingOptions): FrontierPatchBinding {
    const path = normalizePath(options.path);
    const equals = options.equals ?? defaultValueEquals;
    let previous: JsonValue | undefined;
    const id = this.nextId++;
    const record: BindingRecord = {
      id,
      name: options.name,
      kind: 'value',
      active: true,
      subscriptions: [],
      pendingPatch: [],
      paths: [path],
      apply: (patch) => {
        const sourceValue = this.source.get();
        const direct = patch === EMPTY_PATCH ? PATCH_VALUE_NOT_FOUND : readPatchAssignedValueResult(patch, path);
        const value = options.read
          ? options.read(sourceValue, path, patch)
          : direct === PATCH_VALUE_NOT_FOUND
            ? readPath(sourceValue, path)
            : direct.value;
        if (patch !== EMPTY_PATCH && equals(previous, value)) return;
        const before = previous;
        previous = value;
        options.apply({ value, previous: before, path, patch, source: this.source, renderer: this });
        this.trace({ kind: 'host-write', bindingId: id, bindingName: options.name, bindingKind: 'value', path });
      }
    };
    this.records.set(id, record);
    record.subscriptions = [this.source.watch(options.watch ?? { path: options.path }, (patch) => this.markDirty(record, patch))];
    this.trace({ kind: 'binding-create', bindingId: id, bindingName: options.name, bindingKind: 'value', paths: [path] });
    record.apply(EMPTY_PATCH);
    return this.bindingHandle(record);
  }

  each<TTarget = unknown>(options: FrontierPatchEachBindingOptions<TTarget>): FrontierPatchBinding {
    const watchPath = normalizePath(options.path);
    const readPathValue = collectionReadPath(watchPath);
    const keyBy = options.keyBy ?? 'id';
    const entries = new Map<string, EachEntry<TTarget>>();
    const id = this.nextId++;
    const record: BindingRecord = {
      id,
      name: options.name,
      kind: 'each',
      active: true,
      subscriptions: [],
      pendingPatch: [],
      paths: [readPathValue],
      apply: (patch) => {
        if (patch !== EMPTY_PATCH && tryApplyEachPatch(patch, this.source.get(), readPathValue, keyBy, entries, options, this)) {
          this.trace({ kind: 'host-write', bindingId: id, bindingName: options.name, bindingKind: 'each', path: readPathValue });
          return;
        }
        reconcileEach(this.source.get(), readPathValue, keyBy, entries, options, patch, this);
        this.trace({ kind: 'host-write', bindingId: id, bindingName: options.name, bindingKind: 'each', path: readPathValue });
      },
      dispose: () => {
        for (const [key, entry] of entries) {
          options.remove?.(entry.target, { key, index: -1, patch: EMPTY_PATCH, source: this.source, renderer: this });
        }
        entries.clear();
      }
    };
    this.records.set(id, record);
    record.subscriptions = [this.source.watch(options.fields && options.fields.length !== 0 ? { path: options.path, fields: options.fields } : { path: options.path }, (patch) => this.markDirty(record, patch))];
    this.trace({ kind: 'binding-create', bindingId: id, bindingName: options.name, bindingKind: 'each', paths: [readPathValue] });
    record.apply(EMPTY_PATCH);
    return this.bindingHandle(record);
  }

  effect(paths: WatchPath | WatchPath[] | WatchOptions | WatchOptions[], callback: (context: FrontierPatchEffectContext) => void): FrontierPatchBinding {
    const watchInputs = normalizeWatchInputs(paths);
    const readPaths = watchInputs.map((input) => normalizePath(input.path ?? []));
    let cleanup: (() => void) | null = null;
    const id = this.nextId++;
    const record: BindingRecord = {
      id,
      kind: 'effect',
      active: true,
      subscriptions: [],
      pendingPatch: [],
      paths: readPaths,
      apply: (patch) => {
        if (cleanup !== null) {
          cleanup();
          cleanup = null;
        }
        const callbacks: Array<() => void> = [];
        const sourceValue = this.source.get();
        const values = readPaths.map((path) => readPath(sourceValue, path));
        callback({
          value: values[0],
          values,
          paths: readPaths,
          patch,
          source: this.source,
          renderer: this,
          cleanup(nextCleanup) {
            callbacks[callbacks.length] = nextCleanup;
          }
        });
        if (callbacks.length !== 0) {
          cleanup = () => {
            for (let i = callbacks.length - 1; i >= 0; i--) callbacks[i]();
          };
        }
        this.trace({ kind: 'host-write', bindingId: id, bindingKind: 'effect', path: readPaths[0] ?? [] });
      },
      dispose: () => {
        if (cleanup !== null) cleanup();
        cleanup = null;
      }
    };
    this.records.set(id, record);
    record.subscriptions = watchInputs.map((watch) => this.source.watch(watch, (patch) => this.markDirty(record, patch)));
    this.trace({ kind: 'binding-create', bindingId: id, bindingKind: 'effect', paths: readPaths });
    record.apply(EMPTY_PATCH);
    return this.bindingHandle(record);
  }

  flush(): void {
    this.scheduled = false;
    if (this.disposed || this.dirty.size === 0) return;
    const dirtyIds = Array.from(this.dirty);
    this.dirty.clear();
    for (let i = 0; i < dirtyIds.length; i++) {
      const record = this.records.get(dirtyIds[i]);
      if (!record || !record.active) continue;
      const patch = record.pendingPatch;
      record.pendingPatch = [];
      record.apply(patch.length === 0 ? EMPTY_PATCH : patch);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dirty.clear();
    for (const record of Array.from(this.records.values())) this.disposeRecord(record);
    this.records.clear();
  }

  commitPatch(patch: FrontierPatchStatePatchInput, options?: FrontierPatchStatePatchCommitOptions): JsonValue | undefined {
    if (!this.source.commitPatch) throw new TypeError('frontier patch renderer source does not support commitPatch');
    return this.source.commitPatch(patch, options);
  }

  getTrace(): FrontierPatchRenderTraceEvent[] {
    return this.traceEvents.slice();
  }

  private markDirty(record: BindingRecord, patch: Patch): void {
    if (!record.active || this.disposed) return;
    this.trace({
      kind: 'binding-dirty',
      bindingId: record.id,
      bindingName: record.name,
      bindingKind: record.kind,
      patchItems: patch.length
    });
    if (this.scheduler.sync) {
      record.apply(patch.length === 0 ? EMPTY_PATCH : patch);
      return;
    }
    appendPatch(record.pendingPatch, patch);
    this.dirty.add(record.id);
    if (this.scheduled) return;
    this.scheduled = true;
    this.scheduler.queue(() => this.flush());
  }

  private bindingHandle(record: BindingRecord): FrontierPatchBinding {
    const renderer = this;
    return {
      get id() {
        return record.id;
      },
      get name() {
        return record.name;
      },
      get kind() {
        return record.kind;
      },
      get active() {
        return record.active;
      },
      dispose() {
        renderer.disposeRecord(record);
      }
    };
  }

  private disposeRecord(record: BindingRecord): void {
    if (!record.active) return;
    record.active = false;
    this.dirty.delete(record.id);
    for (const subscription of record.subscriptions) subscription.unsubscribe();
    record.subscriptions.length = 0;
    record.dispose?.();
    this.records.delete(record.id);
    this.trace({ kind: 'binding-dispose', bindingId: record.id, bindingName: record.name, bindingKind: record.kind });
  }

  private trace(event: FrontierPatchRenderTraceEvent): void {
    if (!this.traceEnabled) return;
    this.traceSink?.(event);
    this.traceEvents[this.traceEvents.length] = event;
    if (this.traceEvents.length > DEFAULT_TRACE_LIMIT) {
      this.traceEvents.splice(0, this.traceEvents.length - DEFAULT_TRACE_LIMIT);
    }
  }
}

function reconcileEach<TTarget>(
  sourceValue: JsonValue | undefined,
  readPathValue: JsonPath,
  keyBy: string | number | FrontierPatchKeyGetter,
  entries: Map<string, EachEntry<TTarget>>,
  options: FrontierPatchEachBindingOptions<TTarget>,
  patch: Patch,
  renderer: FrontierPatchRenderer
): void {
  const collection = readPath(sourceValue, readPathValue);
  const nextItems = enumerateCollection(collection, keyBy);
  const nextKeys = new Set<string>();
  for (let i = 0; i < nextItems.length; i++) nextKeys.add(nextItems[i].key);
  for (const [key, entry] of entries) {
    if (nextKeys.has(key)) continue;
    options.remove?.(entry.target, { key, index: -1, patch, source: renderer.source, renderer });
    entries.delete(key);
  }
  const ordered: Array<{ key: string; index: number; target: TTarget }> = new Array(nextItems.length);
  for (let i = 0; i < nextItems.length; i++) {
    const item = nextItems[i];
    const context = { key: item.key, index: i, patch, source: renderer.source, renderer };
    let entry = entries.get(item.key);
    if (!entry) {
      entry = { key: item.key, index: i, target: options.create(item.value, context) };
      entries.set(item.key, entry);
    } else {
      entry.index = i;
      options.update?.(entry.target, item.value, context);
    }
    ordered[i] = { key: item.key, index: i, target: entry.target };
  }
  options.reorder?.(ordered, { patch, renderer, source: renderer.source });
}

function tryApplyEachPatch<TTarget>(
  patch: Patch,
  sourceValue: JsonValue | undefined,
  readPathValue: JsonPath,
  keyBy: string | number | FrontierPatchKeyGetter,
  entries: Map<string, EachEntry<TTarget>>,
  options: FrontierPatchEachBindingOptions<TTarget>,
  renderer: FrontierPatchRenderer
): boolean {
  const collection = readPath(sourceValue, readPathValue);
  let touched: number[] | null = null;
  for (let i = 0; i < patch.length; i++) {
    const next = collectEachTouchedIndexes(patch[i], readPathValue);
    if (next === null) return false;
    if (next.length === 0) continue;
    if (touched === null) touched = next;
    else for (let j = 0; j < next.length; j++) touched[touched.length] = next[j];
  }
  if (touched === null) return true;
  dedupeNumberArrayInPlace(touched);
  for (let i = 0; i < touched.length; i++) {
    const index = touched[i];
    const value = Array.isArray(collection) ? collection[index] : undefined;
    const key = readItemKey(value, index, index, keyBy);
    const entry = entries.get(key);
    if (!entry) return false;
    entry.index = index;
    options.update?.(entry.target, value, { key, index, patch, source: renderer.source, renderer });
  }
  return true;
}

function collectEachTouchedIndexes(op: Patch[number], readPathValue: JsonPath): number[] | null {
  if (op[0] === OP_ARRAY_OBJECT_FIELD_ASSIGN) {
    if (samePath(op[1], readPathValue)) return op[2].slice();
    return null;
  }
  if (op[0] === OP_SET || op[0] === OP_REMOVE) {
    const path = op[1];
    if (!samePathPrefix(path, readPathValue)) return null;
    const relative = path.slice(readPathValue.length);
    if (relative.length < 2 || typeof relative[0] !== 'number') return null;
    return [relative[0]];
  }
  return null;
}

const MICRO_TASK_SCHEDULER: FrontierPatchRenderScheduler = {
  queue(callback) {
    queueMicrotask(callback);
  }
};

function normalizeWatchInputs(input: WatchPath | WatchPath[] | WatchOptions | WatchOptions[]): WatchOptions[] {
  if (Array.isArray(input)) {
    if (input.length === 0) return [{ path: [] }];
    if (isPathArray(input)) return [{ path: input as JsonPath }];
    return (input as Array<WatchPath | WatchOptions>).map((item) => normalizeWatchInput(item));
  }
  return [normalizeWatchInput(input)];
}

function normalizeWatchInput(input: WatchPath | WatchOptions): WatchOptions {
  if (typeof input === 'string' || Array.isArray(input)) return { path: input };
  return input;
}

function normalizePath(path: WatchPath): JsonPath {
  if (Array.isArray(path)) return path.slice();
  return getCachedPointerPath(path).slice();
}

function collectionReadPath(path: JsonPath): JsonPath {
  if (path.length !== 0 && path[path.length - 1] === '*') return path.slice(0, -1);
  return path.slice();
}

function readPath(source: JsonValue | undefined, path: JsonPath): JsonValue | undefined {
  if (source === undefined) return undefined;
  return getPath(source, path);
}

function appendPatch(target: Patch, patch: Patch): void {
  for (let i = 0; i < patch.length; i++) target[target.length] = patch[i];
}

function defaultValueEquals(previous: JsonValue | undefined, next: JsonValue | undefined): boolean {
  if (previous !== null && typeof previous === 'object') return false;
  if (next !== null && typeof next === 'object') return false;
  return Object.is(previous, next);
}

function enumerateCollection(
  collection: JsonValue | undefined,
  keyBy: string | number | FrontierPatchKeyGetter
): Array<{ key: string; value: JsonValue | undefined }> {
  if (Array.isArray(collection)) {
    const items = new Array(collection.length);
    for (let index = 0; index < collection.length; index++) {
      const value = collection[index];
      items[index] = { key: readItemKey(value, index, index, keyBy), value };
    }
    return items;
  }
  if (collection !== null && typeof collection === 'object') {
    const keys = Object.keys(collection);
    const items = new Array(keys.length);
    for (let index = 0; index < keys.length; index++) {
      const objectKey = keys[index];
      const value = (collection as Record<string, JsonValue>)[objectKey];
      items[index] = { key: readItemKey(value, index, objectKey, keyBy), value };
    }
    return items;
  }
  return [];
}

function readItemKey(
  value: JsonValue | undefined,
  index: number,
  collectionKey: string | number,
  keyBy: string | number | FrontierPatchKeyGetter
): string {
  let key: string | number | null | undefined;
  if (typeof keyBy === 'function') {
    key = keyBy(value, index, collectionKey);
  } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    key = (value as Record<string | number, JsonValue>)[keyBy] as string | number | null | undefined;
  }
  if (key === null || key === undefined) key = collectionKey;
  return String(key);
}

function readPatchAssignedValueResult(
  patch: Patch,
  targetPath: JsonPath
): { value: JsonValue | undefined } | typeof PATCH_VALUE_NOT_FOUND {
  for (let i = patch.length - 1; i >= 0; i--) {
    const op = patch[i];
    if (op[0] === OP_SET && samePath(op[1], targetPath)) return { value: op[2] };
    if (op[0] === OP_REMOVE && samePath(op[1], targetPath)) return { value: undefined };
    if (op[0] === OP_ARRAY_OBJECT_FIELD_ASSIGN) {
      const basePath = op[1];
      const relative = targetPath.slice(basePath.length);
      if (relative.length < 2 || !samePathPrefix(targetPath, basePath)) continue;
      const rowIndex = relative[0];
      const fieldPath = relative.slice(1);
      const indexes = op[2];
      const fields = op[3];
      const values = op[4];
      for (let row = indexes.length - 1; row >= 0; row--) {
        if (indexes[row] !== rowIndex) continue;
        for (let field = fields.length - 1; field >= 0; field--) {
          if (samePath(fields[field], fieldPath)) return { value: values[row * fields.length + field] as JsonValue };
        }
      }
    }
    if (op[0] === OP_ARRAY_SPLICE && samePath(op[1], targetPath)) return { value: undefined };
  }
  return PATCH_VALUE_NOT_FOUND;
}

function dedupeNumberArrayInPlace(values: number[]): void {
  values.sort((left, right) => left - right);
  let write = 0;
  for (let read = 0; read < values.length; read++) {
    if (read !== 0 && values[read] === values[read - 1]) continue;
    values[write++] = values[read];
  }
  values.length = write;
}

function isPathArray(input: unknown[]): boolean {
  if (input.length === 0) return true;
  const first = input[0];
  if (typeof first === 'number') return true;
  if (typeof first !== 'string') return false;
  if (first.charCodeAt(0) === 47) return false;
  return input.every((segment) => typeof segment === 'string' || typeof segment === 'number');
}

function samePath(left: JsonPath, right: JsonPath): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function samePathPrefix(path: JsonPath, prefix: JsonPath): boolean {
  if (prefix.length > path.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (path[i] !== prefix[i]) return false;
  }
  return true;
}
