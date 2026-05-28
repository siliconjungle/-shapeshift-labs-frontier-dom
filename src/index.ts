import {
  OP_ARRAY_OBJECT_FIELD_ASSIGN,
  OP_ARRAY_SPLICE,
  OP_REMOVE,
  OP_SET
} from '@shapeshift-labs/frontier/constants';
import { getCachedPointerPath, getPath } from '@shapeshift-labs/frontier/pointer';
import {
  createFixedLayout,
  createTextLayout,
  createVariableLayout,
  serializeLayoutState,
  virtualize
} from '@shapeshift-labs/frontier-virtual';
import type {
  JsonPath,
  JsonValue,
  Patch,
  PatchSubscription,
  StateEngine,
  WatchOptions,
  WatchPath
} from '@shapeshift-labs/frontier-state';
import type {
  FrontierTextLayoutOptions,
  FrontierVirtualLayoutProvider,
  FrontierVirtualSerializedLayoutState,
  FrontierVirtualViewport
} from '@shapeshift-labs/frontier-virtual';

export type FrontierDomWatchCallback = (patch: Patch) => void;
export type FrontierDomStatePatchInput = Patch;
export type FrontierDomStatePatchCommitOptions = Record<string, unknown>;

type FrontierDomStateEngineLike = StateEngine & {
  commitPatch(patch: FrontierDomStatePatchInput, options?: FrontierDomStatePatchCommitOptions): JsonValue | undefined;
  getBasis?(): number | string | undefined;
};

export interface FrontierDomSource {
  get(): JsonValue | undefined;
  watch(options: WatchOptions, callback: FrontierDomWatchCallback): PatchSubscription;
  commitPatch?(patch: FrontierDomStatePatchInput, options?: FrontierDomStatePatchCommitOptions): JsonValue | undefined;
  getBasis?(): number | string | undefined;
}

export interface FrontierDomScheduler {
  sync?: boolean;
  queue(callback: () => void): void;
}

export interface FrontierDomWorkSchedulerTask {
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

export interface FrontierDomWorkSchedulerLike {
  schedule(task: FrontierDomWorkSchedulerTask): unknown;
  run?(options?: unknown): unknown;
  requestRun?(options?: unknown): unknown;
}

export interface FrontierDomWorkSchedulerOptions {
  id?: string;
  lane?: string;
  area?: string;
  priority?: unknown;
  units?: number;
  key?: string;
  autoRun?: boolean;
  runOptions?: unknown;
}

export interface FrontierDomRendererOptions {
  source: FrontierDomSource;
  target?: ParentNode | null;
  scheduler?: FrontierDomScheduler;
  trace?: boolean | FrontierDomTraceSink;
}

export interface FrontierDomPatchSourceLike {
  get(): JsonValue | undefined;
  watch(options: WatchOptions, callback: FrontierDomWatchCallback): PatchSubscription;
  commitPatch?(patch: FrontierDomStatePatchInput, options?: FrontierDomStatePatchCommitOptions): JsonValue | undefined;
  getBasis?(): number | string | undefined;
}

export interface FrontierDomQuerySourceLike {
  getQueryData(key: unknown): JsonValue | undefined;
  getQueryCatchUpClock?(key: unknown): number;
  watchQuery(key: unknown, callback: FrontierDomWatchCallback): PatchSubscription;
}

export interface FrontierDomEntitySourceLike {
  getEntity(entity: unknown): JsonValue | undefined;
  watchEntity(entity: unknown, callback: FrontierDomWatchCallback): PatchSubscription;
}

export type FrontierDomTraceSink = (event: FrontierDomTraceEvent) => void;

export type FrontierDomTraceEvent =
  | {
      kind: 'binding-create';
      bindingId: number;
      bindingKind: FrontierDomBindingKind;
      paths: JsonPath[];
    }
  | {
      kind: 'binding-dirty';
      bindingId: number;
      bindingKind: FrontierDomBindingKind;
      patchItems: number;
    }
  | {
      kind: 'dom-write';
      bindingId: number;
      bindingKind: FrontierDomBindingKind;
      path: JsonPath;
    }
  | {
      kind: 'effect-run';
      bindingId: number;
      bindingKind: FrontierDomBindingKind;
      path: JsonPath;
    }
  | {
      kind: 'virtual-range';
      bindingId: number;
      bindingKind: 'virtualEach';
      startIndex: number;
      endIndex: number;
      totalItems: number;
      totalSize: number;
    }
  | {
      kind: 'binding-dispose';
      bindingId: number;
      bindingKind: FrontierDomBindingKind;
    };

export type FrontierDomBindingKind =
  | 'text'
  | 'attr'
  | 'prop'
  | 'class'
  | 'style'
  | 'event'
  | 'form'
  | 'effect'
  | 'when'
  | 'each'
  | 'virtualEach';

export interface FrontierDomBinding {
  readonly id: number;
  readonly kind: FrontierDomBindingKind;
  readonly active: boolean;
  dispose(): void;
}

export type FrontierDomValueFormatter = (value: JsonValue | undefined) => string;
export type FrontierDomEquals = (previous: JsonValue | undefined, next: JsonValue | undefined) => boolean;

export interface FrontierDomValueOptions {
  watch?: WatchOptions;
  format?: FrontierDomValueFormatter;
  equals?: FrontierDomEquals;
}

export interface FrontierDomAttributeOptions extends FrontierDomValueOptions {
  removeWhen?: (value: JsonValue | undefined) => boolean;
}

export interface FrontierDomClassOptions extends FrontierDomValueOptions {
  truthy?: (value: JsonValue | undefined) => boolean;
}

export interface FrontierDomStyleOptions extends FrontierDomValueOptions {
  priority?: string;
}

export interface FrontierDomEventOptions extends AddEventListenerOptions {
  signal?: AbortSignal;
}

export interface FrontierDomDelegatedEventOptions extends AddEventListenerOptions {
  signal?: AbortSignal;
}

export interface FrontierDomSerializableEventOptions {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
}

export interface FrontierDomFormValueOptions extends FrontierDomValueOptions {
  prop?: string;
  event?: string;
  parse?: (value: unknown, element: Element) => JsonValue | undefined;
  format?: FrontierDomValueFormatter;
  commit?: (value: JsonValue | undefined, renderer: FrontierDomRenderer) => void;
  deferDuringComposition?: boolean;
  preserveSelection?: boolean;
}

export interface FrontierDomEffectContext {
  value: JsonValue | undefined;
  values: Array<JsonValue | undefined>;
  source: FrontierDomSource;
  patch: Patch;
  renderer: FrontierDomRenderer;
  cleanup(callback: () => void): void;
}

export type FrontierDomEffectCallback = (context: FrontierDomEffectContext) => void;

export interface FrontierDomWhenContext {
  value: JsonValue | undefined;
  visible: boolean;
  branch: 'then' | 'fallback';
  patch: Patch;
  renderer: FrontierDomRenderer;
  source: FrontierDomSource;
}

export interface FrontierDomWhenBranch<TNode extends Node = Node> {
  create(value: JsonValue | undefined, context: FrontierDomWhenContext): TNode;
  update?: (node: TNode, value: JsonValue | undefined, context: FrontierDomWhenContext) => void;
  dispose?: (node: TNode, context: FrontierDomWhenContext) => void;
}

export interface FrontierDomWhenOptions<TNode extends Node = Node> extends FrontierDomWhenBranch<TNode> {
  container?: ParentNode;
  anchor?: ParentNode;
  before?: Node | null;
  watch?: WatchOptions;
  truthy?: (value: JsonValue | undefined) => boolean;
  fallback?: FrontierDomWhenBranch<TNode>;
}

export interface FrontierDomEachOptions<TNode extends Node = Node> {
  container?: ParentNode;
  anchor?: ParentNode;
  fields?: WatchPath[];
  keyBy?: string | number | FrontierDomKeyGetter;
  hydrateExisting?: boolean;
  keyAttribute?: string;
  create(value: JsonValue | undefined, context: FrontierDomEachItemContext): TNode;
  update?: (node: TNode, value: JsonValue | undefined, context: FrontierDomEachItemContext) => void;
  dispose?: (node: TNode, context: FrontierDomEachItemContext) => void;
}

export interface FrontierDomVirtualEachOptions<TNode extends Node = Node> extends FrontierDomEachOptions<TNode> {
  viewport: FrontierVirtualViewport | ((source: FrontierDomSource) => FrontierVirtualViewport);
  viewportWatch?: WatchPath | WatchOptions;
  layout: FrontierVirtualLayoutProvider;
  overscan?: number;
  overscanPx?: number;
  spacer?: boolean | FrontierDomVirtualSpacerOptions;
}

export interface FrontierDomVirtualSpacerOptions {
  before?: HTMLElement;
  after?: HTMLElement;
}

export interface FrontierDomEachItemContext {
  key: string;
  index: number;
  patch: Patch;
  renderer: FrontierDomRenderer;
  source: FrontierDomSource;
  when?: {
    value: JsonValue | undefined;
    visible: boolean;
    branch: 'then' | 'fallback';
  };
  virtual?: {
    offset: number;
    size: number;
    localIndex: number;
    totalItems: number;
    totalSize: number;
  };
}

export type FrontierDomKeyGetter = (
  value: JsonValue | undefined,
  index: number,
  key: string | number
) => string | number | null | undefined;

export interface FrontierDomMountContext {
  text(path: WatchPath, target: Text | Element, options?: FrontierDomValueOptions): FrontierDomBinding;
  attr(path: WatchPath, element: Element, name: string, options?: FrontierDomAttributeOptions): FrontierDomBinding;
  prop(path: WatchPath, element: Element, name: string, options?: FrontierDomValueOptions): FrontierDomBinding;
  className(path: WatchPath, element: Element, name: string, options?: FrontierDomClassOptions): FrontierDomBinding;
  style(path: WatchPath, element: HTMLElement | SVGElement, name: string, options?: FrontierDomStyleOptions): FrontierDomBinding;
  event<TEvent extends Event = Event>(
    target: EventTarget,
    type: string,
    handler: (event: TEvent, renderer: FrontierDomRenderer) => void,
    options?: FrontierDomEventOptions
  ): FrontierDomBinding;
  delegate<TEvent extends Event = Event>(
    root: ParentNode,
    type: string,
    selector: string,
    handler: (event: TEvent, matched: Element, renderer: FrontierDomRenderer) => void,
    options?: FrontierDomDelegatedEventOptions
  ): FrontierDomBinding;
  formValue(path: WatchPath, element: Element, options?: FrontierDomFormValueOptions): FrontierDomBinding;
  effect(paths: WatchPath | WatchPath[] | WatchOptions | WatchOptions[], callback: FrontierDomEffectCallback): FrontierDomBinding;
  when<TNode extends Node = Node>(
    path: WatchPath,
    options: FrontierDomWhenOptions<TNode>
  ): FrontierDomBinding;
  each<TNode extends Node = Node>(
    path: WatchPath,
    options: FrontierDomEachOptions<TNode>
  ): FrontierDomBinding;
  virtualEach<TNode extends Node = Node>(
    path: WatchPath,
    options: FrontierDomVirtualEachOptions<TNode>
  ): FrontierDomBinding;
}

export interface FrontierDomRenderer extends FrontierDomMountContext {
  readonly source: FrontierDomSource;
  readonly target: ParentNode | null;
  readonly size: number;
  mount(callback: (context: FrontierDomMountContext) => void): FrontierDomRenderer;
  flush(): void;
  dispose(): void;
  commitPatch(patch: FrontierDomStatePatchInput, options?: FrontierDomStatePatchCommitOptions): JsonValue | undefined;
  getTrace(): FrontierDomTraceEvent[];
}

export type FrontierDomManifestVersion = 1;

export interface FrontierDomNodeTarget {
  anchor?: string;
  selector?: string;
}

export interface FrontierDomManifestRoot extends FrontierDomNodeTarget {}

export type FrontierDomSourceKind = 'state' | 'state-cache-query' | 'state-cache-entity' | 'crdt' | 'custom';

export interface FrontierDomManifestSource {
  kind?: FrontierDomSourceKind | string;
  basis?: number | string;
  snapshotRef?: string;
  catchUpClock?: number;
  heads?: string[];
  stateVector?: Record<string, number>;
  registry?: string;
}

export interface FrontierDomManifestBaseBinding {
  id: string;
  kind: FrontierDomBindingKind;
  path?: WatchPath;
  watch?: WatchOptions;
  target?: FrontierDomNodeTarget;
}

export interface FrontierDomTextManifestBinding extends FrontierDomManifestBaseBinding {
  kind: 'text';
  path: WatchPath;
  target: FrontierDomNodeTarget;
  format?: string;
}

export interface FrontierDomAttributeManifestBinding extends FrontierDomManifestBaseBinding {
  kind: 'attr';
  path: WatchPath;
  target: FrontierDomNodeTarget;
  name: string;
  format?: string;
}

export interface FrontierDomPropertyManifestBinding extends FrontierDomManifestBaseBinding {
  kind: 'prop';
  path: WatchPath;
  target: FrontierDomNodeTarget;
  name: string;
}

export interface FrontierDomClassManifestBinding extends FrontierDomManifestBaseBinding {
  kind: 'class';
  path: WatchPath;
  target: FrontierDomNodeTarget;
  name: string;
}

export interface FrontierDomStyleManifestBinding extends FrontierDomManifestBaseBinding {
  kind: 'style';
  path: WatchPath;
  target: FrontierDomNodeTarget;
  name: string;
  format?: string;
  priority?: string;
}

export interface FrontierDomEventManifestBinding extends FrontierDomManifestBaseBinding {
  kind: 'event';
  target: FrontierDomNodeTarget;
  event: string;
  action: string;
  delegate?: string;
  options?: FrontierDomSerializableEventOptions;
}

export interface FrontierDomFormManifestBinding extends FrontierDomManifestBaseBinding {
  kind: 'form';
  path: WatchPath;
  target: FrontierDomNodeTarget;
  prop?: string;
  event?: string;
  format?: string;
}

export interface FrontierDomWhenManifestBinding extends FrontierDomManifestBaseBinding {
  kind: 'when';
  path: WatchPath;
  target: FrontierDomNodeTarget;
  template: string;
  fallbackTemplate?: string;
}

export interface FrontierDomEachManifestBinding extends FrontierDomManifestBaseBinding {
  kind: 'each';
  path: WatchPath;
  container: FrontierDomNodeTarget;
  fields?: WatchPath[];
  keyBy?: string | number;
  keyAttribute?: string;
  template: string;
}

export type FrontierDomVirtualLayoutManifest =
  | string
  | { kind: 'fixed'; itemSize: number }
  | { kind: 'variable'; defaultSize: number; state?: FrontierVirtualSerializedLayoutState }
  | ({ kind: 'text' } & FrontierTextLayoutOptions);

export interface FrontierDomVirtualEachManifestBinding extends FrontierDomManifestBaseBinding {
  kind: 'virtualEach';
  path: WatchPath;
  container: FrontierDomNodeTarget;
  fields?: WatchPath[];
  keyBy?: string | number;
  keyAttribute?: string;
  template: string;
  viewport?: FrontierVirtualViewport;
  layout: FrontierDomVirtualLayoutManifest;
  overscan?: number;
  overscanPx?: number;
}

export type FrontierDomManifestBinding =
  | FrontierDomTextManifestBinding
  | FrontierDomAttributeManifestBinding
  | FrontierDomPropertyManifestBinding
  | FrontierDomClassManifestBinding
  | FrontierDomStyleManifestBinding
  | FrontierDomEventManifestBinding
  | FrontierDomFormManifestBinding
  | FrontierDomWhenManifestBinding
  | FrontierDomEachManifestBinding
  | FrontierDomVirtualEachManifestBinding;

export interface FrontierDomRenderManifestV1 {
  version: FrontierDomManifestVersion;
  root?: FrontierDomManifestRoot;
  source?: FrontierDomManifestSource;
  bindings: FrontierDomManifestBinding[];
}

export type FrontierDomRenderManifest = FrontierDomRenderManifestV1;

export interface FrontierDomTemplateDefinition<TNode extends Node = Node> {
  create(value: JsonValue | undefined, context: FrontierDomEachItemContext): TNode;
  update?: (node: TNode, value: JsonValue | undefined, context: FrontierDomEachItemContext) => void;
  dispose?: (node: TNode, context: FrontierDomEachItemContext) => void;
}

export type FrontierDomActionHandler<TEvent extends Event = Event> = (context: {
  event: TEvent;
  renderer: FrontierDomRenderer;
  source: FrontierDomSource;
  binding: FrontierDomEventManifestBinding;
  manifest: FrontierDomRenderManifestV1;
}) => void;

export interface FrontierDomActionDispatchOptions {
  causeId?: string;
  actor?: string;
  metadata?: Record<string, JsonValue>;
  affected?: string[];
}

export interface FrontierDomActionRegistryLike {
  dispatch(actionId: string, input?: JsonValue, options?: FrontierDomActionDispatchOptions): unknown;
}

export interface FrontierDomManifestRegistry {
  templates?: Record<string, FrontierDomTemplateDefinition>;
  actions?: Record<string, FrontierDomActionHandler>;
  actionRegistry?: FrontierDomActionRegistryLike;
  formatters?: Record<string, FrontierDomValueFormatter>;
  layouts?: Record<string, FrontierVirtualLayoutProvider>;
}

export interface FrontierDomManifestRendererOptions extends FrontierDomRendererOptions, FrontierDomManifestRegistry {
  manifest: FrontierDomRenderManifestV1;
  hydrateExisting?: boolean;
  basisPolicy?: FrontierDomHydrationBasisPolicy;
  onBasisMismatch?: (mismatch: FrontierDomHydrationBasisMismatch) => void;
}

export type FrontierDomHydrationBasisPolicy = 'ignore' | 'warn' | 'error';

export interface FrontierDomHydrationBasisMismatch {
  expected: number | string | undefined;
  actual: number | string | undefined;
  manifest: FrontierDomRenderManifestV1;
}

export interface FrontierDomSerializedState {
  kind: 'frontier.dom.state';
  version: FrontierDomManifestVersion;
  manifest: FrontierDomRenderManifestV1;
  source?: FrontierDomManifestSource;
  snapshot?: JsonValue;
  layout?: FrontierVirtualSerializedLayoutState[];
}

type BindingRecord = {
  id: number;
  kind: FrontierDomBindingKind;
  active: boolean;
  subscriptions: PatchSubscription[];
  pendingPatch: Patch;
  previous: JsonValue | undefined;
  paths: JsonPath[];
  apply(patch: Patch): void;
  dispose?(): void;
};

type EachEntry<TNode extends Node = Node> = {
  key: string;
  index: number;
  node: TNode;
};

const EMPTY_PATCH: Patch = [];
const DEFAULT_TRACE_LIMIT = 2048;
const PATCH_VALUE_NOT_FOUND = Symbol('frontierDomPatchValueNotFound');
const VIRTUAL_OFFSET_STATE: unique symbol = Symbol('frontier.dom.virtualOffset');
const VIRTUAL_SIZE_STATE: unique symbol = Symbol('frontier.dom.virtualSize');
let nextDomSchedulerAdapterId = 1;

type FrontierVirtualElement = Element & {
  [VIRTUAL_OFFSET_STATE]?: string;
  [VIRTUAL_SIZE_STATE]?: string;
};

export function fromStateEngine(engine: StateEngine): FrontierDomSource {
  const stateEngine = engine as FrontierDomStateEngineLike;
  return {
    get: () => stateEngine.get(),
    watch: (options, callback) => stateEngine.watch(options, callback),
    commitPatch: (patch, options) => stateEngine.commitPatch(patch, options),
    getBasis: stateEngine.getBasis ? () => stateEngine.getBasis?.() : undefined
  };
}

export function fromPatchSource(source: FrontierDomPatchSourceLike): FrontierDomSource {
  return {
    get: () => source.get(),
    watch: (options, callback) => source.watch(options, callback),
    commitPatch: source.commitPatch
      ? (patch, options) => source.commitPatch?.(patch, options)
      : undefined,
    getBasis: source.getBasis ? () => source.getBasis?.() : undefined
  };
}

export function fromCrdtStateEngine(engine: FrontierDomPatchSourceLike): FrontierDomSource {
  return fromPatchSource(engine);
}

export function fromQueryCacheQuery(cache: FrontierDomQuerySourceLike, key: unknown): FrontierDomSource {
  return {
    get: () => cache.getQueryData(key),
    watch: (_options, callback) => cache.watchQuery(key, callback),
    getBasis: cache.getQueryCatchUpClock ? () => cache.getQueryCatchUpClock?.(key) : undefined
  };
}

export function fromQueryCacheEntity(cache: FrontierDomEntitySourceLike, entity: unknown): FrontierDomSource {
  return {
    get: () => cache.getEntity(entity),
    watch: (_options, callback) => cache.watchEntity(entity, callback)
  };
}

export function createDomSchedulerFromRuntime(
  scheduler: FrontierDomWorkSchedulerLike,
  options: FrontierDomWorkSchedulerOptions = {}
): FrontierDomScheduler {
  if (scheduler === null || typeof scheduler !== 'object' || typeof scheduler.schedule !== 'function') {
    throw new TypeError('frontier-dom runtime scheduler must expose schedule()');
  }
  const id = options.id ?? 'frontier-dom:' + nextDomSchedulerAdapterId++;
  return {
    queue(callback) {
      scheduler.schedule({
        id: id + ':flush:' + nextDomSchedulerAdapterId++,
        type: 'frontier.dom.flush',
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

export function createDomRenderer(options: FrontierDomRendererOptions): FrontierDomRenderer {
  return new DomRenderer(options);
}

export const syncDomScheduler: FrontierDomScheduler = {
  sync: true,
  queue(callback) {
    callback();
  }
};

export const manualDomScheduler: FrontierDomScheduler = {
  queue() {}
};

export function createDomRendererFromManifest(options: FrontierDomManifestRendererOptions): FrontierDomRenderer {
  const manifest = assertRenderManifestV1(options.manifest);
  const renderer = createDomRenderer(options);
  const root = resolveManifestRoot(manifest, options.target ?? renderer.target);
  const registry: FrontierDomManifestRegistry = {
    templates: options.templates ?? {},
    actions: options.actions ?? {},
    actionRegistry: options.actionRegistry,
    formatters: options.formatters ?? {},
    layouts: options.layouts ?? {}
  };
  reconcileHydrationBasis(manifest, renderer.source, options.basisPolicy ?? 'ignore', options.onBasisMismatch);
  for (let i = 0; i < manifest.bindings.length; i++) {
    mountManifestBinding(renderer, root, manifest, manifest.bindings[i], registry, options.hydrateExisting !== false);
  }
  return renderer;
}

export const hydrateDomRenderer = createDomRendererFromManifest;

export function serializeDomState(input: {
  manifest: FrontierDomRenderManifestV1;
  source?: FrontierDomSource;
  sourceMetadata?: FrontierDomManifestSource;
  snapshot?: JsonValue;
  layout?: FrontierVirtualLayoutProvider[];
  includeSnapshot?: boolean;
}): FrontierDomSerializedState {
  const manifest = assertRenderManifestV1(input.manifest);
  const source: FrontierDomManifestSource = {
    ...(manifest.source ?? {}),
    ...(input.sourceMetadata ?? {})
  };
  if (input.source?.getBasis) source.basis = input.source.getBasis();
  const out: FrontierDomSerializedState = {
    kind: 'frontier.dom.state',
    version: 1,
    manifest,
    source: Object.keys(source).length === 0 ? undefined : source
  };
  if (input.includeSnapshot !== false) {
    out.snapshot = input.snapshot !== undefined ? input.snapshot : input.source?.get();
  }
  if (input.layout && input.layout.length !== 0) {
    out.layout = input.layout.map((layout) => serializeLayoutState(layout));
  }
  return out;
}

export function deserializeDomState(input: string | FrontierDomSerializedState): FrontierDomSerializedState {
  const value = typeof input === 'string' ? JSON.parse(input) : input;
  if (value === null || typeof value !== 'object') throw new TypeError('invalid frontier-dom serialized state');
  if ((value as FrontierDomSerializedState).kind !== 'frontier.dom.state') {
    throw new TypeError('invalid frontier-dom serialized state kind');
  }
  if ((value as FrontierDomSerializedState).version !== 1) {
    throw new TypeError('unsupported frontier-dom serialized state version');
  }
  assertRenderManifestV1((value as FrontierDomSerializedState).manifest);
  if ((value as FrontierDomSerializedState).layout) {
    for (const layout of (value as FrontierDomSerializedState).layout ?? []) {
      if (layout.kind !== 'frontier.virtual.layout' || layout.version !== 1) {
        throw new TypeError('invalid frontier-dom serialized layout state');
      }
    }
  }
  return value as FrontierDomSerializedState;
}

export function assertRenderManifestV1(manifest: FrontierDomRenderManifestV1): FrontierDomRenderManifestV1 {
  if (manifest === null || typeof manifest !== 'object') throw new TypeError('invalid frontier-dom manifest');
  if (manifest.version !== 1) throw new TypeError('unsupported frontier-dom manifest version');
  if (!Array.isArray(manifest.bindings)) throw new TypeError('frontier-dom manifest bindings must be an array');
  for (let i = 0; i < manifest.bindings.length; i++) {
    const binding = manifest.bindings[i];
    if (binding === null || typeof binding !== 'object') throw new TypeError('invalid frontier-dom manifest binding');
    if (typeof binding.id !== 'string' || binding.id.length === 0) throw new TypeError('frontier-dom binding id is required');
    if (typeof binding.kind !== 'string') throw new TypeError('frontier-dom binding kind is required');
  }
  return manifest;
}

class DomRenderer implements FrontierDomRenderer {
  readonly source: FrontierDomSource;
  readonly target: ParentNode | null;
  private scheduler: FrontierDomScheduler;
  private records = new Map<number, BindingRecord>();
  private dirty = new Set<number>();
  private scheduled = false;
  private disposed = false;
  private nextId = 1;
  private traceEnabled: boolean;
  private traceSink: FrontierDomTraceSink | null;
  private traceEvents: FrontierDomTraceEvent[] = [];

  constructor(options: FrontierDomRendererOptions) {
    this.source = options.source;
    this.target = options.target ?? null;
    this.scheduler = options.scheduler ?? MICRO_TASK_SCHEDULER;
    this.traceEnabled = options.trace !== undefined && options.trace !== false;
    this.traceSink = typeof options.trace === 'function' ? options.trace : null;
  }

  get size(): number {
    return this.records.size;
  }

  mount(callback: (context: FrontierDomMountContext) => void): FrontierDomRenderer {
    assertActiveRenderer(this);
    callback({
      text: this.text.bind(this),
      attr: this.attr.bind(this),
      prop: this.prop.bind(this),
      className: this.className.bind(this),
      style: this.style.bind(this),
      event: this.event.bind(this),
      delegate: this.delegate.bind(this),
      formValue: this.formValue.bind(this),
      effect: this.effect.bind(this),
      when: this.when.bind(this),
      each: this.each.bind(this),
      virtualEach: this.virtualEach.bind(this)
    });
    return this;
  }

  text(path: WatchPath, target: Text | Element, options: FrontierDomValueOptions = {}): FrontierDomBinding {
    const bindingPath = normalizePath(path);
    const formatter = options.format ?? formatTextValue;
    return this.addValueBinding('text', path, bindingPath, options, (record, value) => {
      const next = formatter(value);
      if (isTextNode(target)) {
        if (target.data !== next) {
          target.data = next;
          this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: bindingPath });
        }
      } else if (target.textContent !== next) {
        target.textContent = next;
        this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: bindingPath });
      }
    });
  }

  attr(path: WatchPath, element: Element, name: string, options: FrontierDomAttributeOptions = {}): FrontierDomBinding {
    const bindingPath = normalizePath(path);
    const formatter = options.format ?? formatAttributeValue;
    const shouldRemove = options.removeWhen ?? shouldRemoveAttribute;
    return this.addValueBinding('attr', path, bindingPath, options, (record, value) => {
      if (shouldRemove(value)) {
        if (element.hasAttribute(name)) {
          element.removeAttribute(name);
          this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: bindingPath });
        }
        return;
      }
      const next = formatter(value);
      if (element.getAttribute(name) !== next) {
        element.setAttribute(name, next);
        this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: bindingPath });
      }
    });
  }

  prop(path: WatchPath, element: Element, name: string, options: FrontierDomValueOptions = {}): FrontierDomBinding {
    const bindingPath = normalizePath(path);
    return this.addValueBinding('prop', path, bindingPath, options, (record, value) => {
      if ((element as any)[name] !== value) {
        (element as any)[name] = value;
        this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: bindingPath });
      }
    });
  }

  className(path: WatchPath, element: Element, name: string, options: FrontierDomClassOptions = {}): FrontierDomBinding {
    const bindingPath = normalizePath(path);
    const truthy = options.truthy ?? Boolean;
    return this.addValueBinding('class', path, bindingPath, options, (record, value) => {
      const next = truthy(value);
      if (element.classList.contains(name) !== next) {
        element.classList.toggle(name, next);
        this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: bindingPath });
      }
    });
  }

  style(path: WatchPath, element: HTMLElement | SVGElement, name: string, options: FrontierDomStyleOptions = {}): FrontierDomBinding {
    const bindingPath = normalizePath(path);
    const formatter = options.format ?? formatTextValue;
    return this.addValueBinding('style', path, bindingPath, options, (record, value) => {
      const style = (element as HTMLElement).style;
      const next = value === null || value === undefined || value === false ? '' : formatter(value);
      if (style.getPropertyValue(name) !== next) {
        if (next === '') style.removeProperty(name);
        else style.setProperty(name, next, options.priority ?? '');
        this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: bindingPath });
      }
    });
  }

  event<TEvent extends Event = Event>(
    target: EventTarget,
    type: string,
    handler: (event: TEvent, renderer: FrontierDomRenderer) => void,
    options: FrontierDomEventOptions = {}
  ): FrontierDomBinding {
    const id = this.nextId++;
    let active = true;
    const listener = (event: Event) => {
      if (active) handler(event as TEvent, this);
    };
    target.addEventListener(type, listener, options);
    const record: BindingRecord = {
      id,
      kind: 'event',
      active: true,
      subscriptions: [],
      pendingPatch: [],
      previous: undefined,
      paths: [],
      apply: () => {},
      dispose: () => {
        active = false;
        target.removeEventListener(type, listener, options);
      }
    };
    this.records.set(id, record);
    this.trace({ kind: 'binding-create', bindingId: id, bindingKind: 'event', paths: [] });
    return this.bindingHandle(record);
  }

  delegate<TEvent extends Event = Event>(
    root: ParentNode,
    type: string,
    selector: string,
    handler: (event: TEvent, matched: Element, renderer: FrontierDomRenderer) => void,
    options: FrontierDomDelegatedEventOptions = {}
  ): FrontierDomBinding {
    const id = this.nextId++;
    let active = true;
    const listener = (event: Event) => {
      if (!active) return;
      const target = event.target;
      if (!isElementLike(target)) return;
      const matched = target.closest(selector);
      if (!matched || !rootContains(root, matched)) return;
      handler(event as TEvent, matched, this);
    };
    (root as unknown as EventTarget).addEventListener(type, listener, options);
    const record: BindingRecord = {
      id,
      kind: 'event',
      active: true,
      subscriptions: [],
      pendingPatch: [],
      previous: undefined,
      paths: [],
      apply: () => {},
      dispose: () => {
        active = false;
        (root as unknown as EventTarget).removeEventListener(type, listener, options);
      }
    };
    this.records.set(id, record);
    this.trace({ kind: 'binding-create', bindingId: id, bindingKind: 'event', paths: [] });
    return this.bindingHandle(record);
  }

  formValue(path: WatchPath, element: Element, options: FrontierDomFormValueOptions = {}): FrontierDomBinding {
    const bindingPath = normalizePath(path);
    const prop = options.prop ?? inferFormProperty(element);
    const eventName = options.event ?? (prop === 'checked' ? 'change' : 'input');
    const formatter = options.format ?? ((value) => value === null || value === undefined ? '' : String(value));
    const parse = options.parse ?? defaultFormValueParser(prop);
    const equals = options.equals ?? defaultValueEquals;
    const deferDuringComposition = options.deferDuringComposition !== false;
    const preserveSelection = options.preserveSelection !== false;
    let composing = false;
    const id = this.nextId++;
    const record: BindingRecord = {
      id,
      kind: 'form',
      active: true,
      subscriptions: [],
      pendingPatch: [],
      previous: undefined,
      paths: [bindingPath],
      apply: (patch) => {
        if (deferDuringComposition && composing) return;
        const patchValue = patch === EMPTY_PATCH ? PATCH_VALUE_NOT_FOUND : readPatchAssignedValueResult(patch, bindingPath);
        const value = patchValue === PATCH_VALUE_NOT_FOUND ? readPath(this.source.get(), bindingPath) : patchValue.value;
        if (patch !== EMPTY_PATCH && equals(record.previous, value)) return;
        record.previous = value;
        writeFormProperty(element, prop, formatter(value), preserveSelection);
        this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: bindingPath });
      },
      dispose: () => {
        element.removeEventListener(eventName, onInput);
        element.removeEventListener('compositionstart', onCompositionStart);
        element.removeEventListener('compositionend', onCompositionEnd);
      }
    };
    const onInput = () => {
      if (deferDuringComposition && composing) return;
      const value = parse(readFormProperty(element, prop), element);
      record.previous = value;
      if (options.commit) options.commit(value, this);
      else this.commitPatch([[OP_SET, bindingPath, value]]);
    };
    const onCompositionStart = () => {
      composing = true;
    };
    const onCompositionEnd = () => {
      composing = false;
      onInput();
    };
    element.addEventListener(eventName, onInput);
    element.addEventListener('compositionstart', onCompositionStart);
    element.addEventListener('compositionend', onCompositionEnd);
    this.records.set(id, record);
    record.subscriptions = [this.source.watch(options.watch ?? { path }, (patch) => this.markDirty(record, patch))];
    this.trace({ kind: 'binding-create', bindingId: id, bindingKind: 'form', paths: [bindingPath] });
    record.apply(EMPTY_PATCH);
    return this.bindingHandle(record);
  }

  effect(
    paths: WatchPath | WatchPath[] | WatchOptions | WatchOptions[],
    callback: FrontierDomEffectCallback
  ): FrontierDomBinding {
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
      previous: undefined,
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
          source: this.source,
          patch,
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
        this.trace({ kind: 'effect-run', bindingId: record.id, bindingKind: record.kind, path: readPaths[0] ?? [] });
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

  when<TNode extends Node = Node>(path: WatchPath, options: FrontierDomWhenOptions<TNode>): FrontierDomBinding {
    const container = options.container ?? options.anchor;
    if (!container) throw new TypeError('frontier-dom when() requires a container or anchor');
    const bindingPath = normalizePath(path);
    const truthy = options.truthy ?? defaultTruthy;
    let currentNode: TNode | null = null;
    let currentBranch: 'then' | 'fallback' | null = null;
    const id = this.nextId++;
    const record: BindingRecord = {
      id,
      kind: 'when',
      active: true,
      subscriptions: [],
      pendingPatch: [],
      previous: undefined,
      paths: [bindingPath],
      apply: (patch) => {
        const patchValue = patch === EMPTY_PATCH ? PATCH_VALUE_NOT_FOUND : readPatchAssignedValueResult(patch, bindingPath);
        const value = patchValue === PATCH_VALUE_NOT_FOUND ? readPath(this.source.get(), bindingPath) : patchValue.value;
        const visible = truthy(value);
        const nextBranch: 'then' | 'fallback' | null = visible ? 'then' : options.fallback ? 'fallback' : null;
        if (patch !== EMPTY_PATCH && defaultValueEquals(record.previous, value) && nextBranch === currentBranch) return;
        record.previous = value;
        if (nextBranch === null) {
          removeWhenNode(container, currentNode, currentBranch, value, false, patch, options, this);
          currentNode = null;
          currentBranch = null;
          this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: bindingPath });
          return;
        }
        const branch = nextBranch === 'then' ? options : options.fallback;
        if (!branch) return;
        const context = createWhenContext(value, visible, nextBranch, patch, this);
        if (currentNode === null || currentBranch !== nextBranch) {
          removeWhenNode(container, currentNode, currentBranch, value, currentBranch === 'then', patch, options, this);
          currentNode = branch.create(value, context);
          currentBranch = nextBranch;
          container.insertBefore(currentNode, options.before ?? null);
        } else {
          branch.update?.(currentNode, value, context);
          const before = options.before ?? null;
          if (currentNode.parentNode !== container || currentNode.nextSibling !== before) container.insertBefore(currentNode, before);
        }
        this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: bindingPath });
      },
      dispose: () => {
        removeWhenNode(container, currentNode, currentBranch, record.previous, currentBranch === 'then', EMPTY_PATCH, options, this);
        currentNode = null;
        currentBranch = null;
      }
    };
    this.records.set(id, record);
    record.subscriptions = [this.source.watch(options.watch ?? { path }, (patch) => this.markDirty(record, patch))];
    this.trace({ kind: 'binding-create', bindingId: id, bindingKind: 'when', paths: [bindingPath] });
    record.apply(EMPTY_PATCH);
    return this.bindingHandle(record);
  }

  each<TNode extends Node = Node>(path: WatchPath, options: FrontierDomEachOptions<TNode>): FrontierDomBinding {
    const container = options.container ?? options.anchor;
    if (!container) throw new TypeError('frontier-dom each() requires a container or anchor');
    const watchPath = normalizePath(path);
    const readPathValue = collectionReadPath(watchPath);
    const keyBy = options.keyBy ?? 'id';
    const keyAttribute = options.keyAttribute ?? 'data-frontier-key';
    const entries = new Map<string, EachEntry<TNode>>();

    const id = this.nextId++;
    const record: BindingRecord = {
      id,
      kind: 'each',
      active: true,
      subscriptions: [],
      pendingPatch: [],
      previous: undefined,
      paths: [readPathValue],
      apply: (patch) => {
        if (patch !== EMPTY_PATCH && tryApplyEachPatch(patch, this.source.get(), readPathValue, keyBy, entries, options, id, this)) {
          this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: readPathValue });
          return;
        }
        const collection = readPath(this.source.get(), readPathValue);
        const nextItems = enumerateCollection(collection, keyBy);
        const nextKeys = new Set<string>();
        for (let i = 0; i < nextItems.length; i++) nextKeys.add(nextItems[i].key);

        for (const [key, entry] of entries) {
          if (nextKeys.has(key)) continue;
          options.dispose?.(entry.node, {
            key,
            index: -1,
            patch,
            renderer: this,
            source: this.source
          });
          if (entry.node.parentNode === container) container.removeChild(entry.node);
          entries.delete(key);
        }

        const orderedEntries = new Array<EachEntry<TNode>>(nextItems.length);
        for (let i = 0; i < nextItems.length; i++) {
          const item = nextItems[i];
          const context: FrontierDomEachItemContext = {
            key: item.key,
            index: i,
            patch,
            renderer: this,
            source: this.source
          };
          let entry = entries.get(item.key);
          if (!entry) {
            entry = { key: item.key, index: i, node: options.create(item.value, context) };
            setNodeKeyAttribute(entry.node, keyAttribute, item.key);
            entries.set(item.key, entry);
          } else {
            entry.index = i;
            options.update?.(entry.node, item.value, context);
          }
          orderedEntries[i] = entry;
        }
        placeEachNodes(container, orderedEntries);
        this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: readPathValue });
      },
      dispose: () => {
        for (const [key, entry] of entries) {
          options.dispose?.(entry.node, {
            key,
            index: -1,
            patch: EMPTY_PATCH,
            renderer: this,
            source: this.source
          });
          if (entry.node.parentNode === container) container.removeChild(entry.node);
        }
        entries.clear();
      }
    };
    this.records.set(id, record);
    if (options.hydrateExisting) {
      hydrateEachEntries(container, entries, keyAttribute);
    }
    const watchOptions: WatchOptions = options.fields && options.fields.length !== 0
      ? { path, fields: options.fields }
      : { path };
    record.subscriptions = [this.source.watch(watchOptions, (patch) => this.markDirty(record, patch))];
    this.trace({ kind: 'binding-create', bindingId: id, bindingKind: 'each', paths: [readPathValue] });
    record.apply(EMPTY_PATCH);
    return this.bindingHandle(record);
  }

  virtualEach<TNode extends Node = Node>(path: WatchPath, options: FrontierDomVirtualEachOptions<TNode>): FrontierDomBinding {
    const container = options.container ?? options.anchor;
    if (!container) throw new TypeError('frontier-dom virtualEach() requires a container or anchor');
    const watchPath = normalizePath(path);
    const readPathValue = collectionReadPath(watchPath);
    const keyBy = options.keyBy ?? 'id';
    const keyAttribute = options.keyAttribute ?? 'data-frontier-key';
    const entries = new Map<string, EachEntry<TNode>>();
    const spacers = createVirtualSpacers(container, options.spacer);

    const id = this.nextId++;
    const record: BindingRecord = {
      id,
      kind: 'virtualEach',
      active: true,
      subscriptions: [],
      pendingPatch: [],
      previous: undefined,
      paths: [readPathValue],
      apply: (patch) => {
        const sourceValue = this.source.get();
        const collection = readPath(sourceValue, readPathValue);
        const viewport = typeof options.viewport === 'function' ? options.viewport(this.source) : options.viewport;
        const range = virtualize({
          items: collection,
          keyBy,
          viewport,
          layout: options.layout,
          overscan: options.overscan,
          overscanPx: options.overscanPx
        });
        const nextKeys = new Set<string>();
        for (let i = 0; i < range.items.length; i++) nextKeys.add(range.items[i].key);

        for (const [key, entry] of entries) {
          if (nextKeys.has(key)) continue;
          options.dispose?.(entry.node, {
            key,
            index: -1,
            patch,
            renderer: this,
            source: this.source
          });
          if (entry.node.parentNode === container) container.removeChild(entry.node);
          entries.delete(key);
        }

        const orderedEntries = new Array<EachEntry<TNode>>(range.items.length);
        for (let localIndex = 0; localIndex < range.items.length; localIndex++) {
          const item = range.items[localIndex];
          const context: FrontierDomEachItemContext = {
            key: item.key,
            index: item.index,
            patch,
            renderer: this,
            source: this.source,
            virtual: {
              offset: item.offset,
              size: item.size,
              localIndex,
              totalItems: range.totalItems,
              totalSize: range.totalSize
            }
          };
          let entry = entries.get(item.key);
          if (!entry) {
            entry = { key: item.key, index: item.index, node: options.create(item.value, context) };
            setNodeKeyAttribute(entry.node, keyAttribute, item.key);
            entries.set(item.key, entry);
          } else {
            entry.index = item.index;
            options.update?.(entry.node, item.value, context);
          }
          setVirtualNodeGeometry(entry.node, item.offset, item.size);
          orderedEntries[localIndex] = entry;
        }
        placeVirtualNodes(container, spacers, orderedEntries, range.offsetBefore, range.offsetAfter);
        this.trace({
          kind: 'virtual-range',
          bindingId: record.id,
          bindingKind: 'virtualEach',
          startIndex: range.startIndex,
          endIndex: range.endIndex,
          totalItems: range.totalItems,
          totalSize: range.totalSize
        });
        this.trace({ kind: 'dom-write', bindingId: record.id, bindingKind: record.kind, path: readPathValue });
      },
      dispose: () => {
        for (const [key, entry] of entries) {
          options.dispose?.(entry.node, {
            key,
            index: -1,
            patch: EMPTY_PATCH,
            renderer: this,
            source: this.source
          });
          if (entry.node.parentNode === container) container.removeChild(entry.node);
        }
        entries.clear();
        removeVirtualSpacers(container, spacers);
      }
    };
    this.records.set(id, record);
    if (options.hydrateExisting) {
      hydrateEachEntries(container, entries, keyAttribute);
    }
    const watchOptions: WatchOptions = options.fields && options.fields.length !== 0
      ? { path, fields: options.fields }
      : { path };
    record.subscriptions = [this.source.watch(watchOptions, (patch) => this.markDirty(record, patch))];
    if (options.viewportWatch) {
      record.subscriptions[record.subscriptions.length] = this.source.watch(
        normalizeWatchInput(options.viewportWatch),
        (patch) => this.markDirty(record, patch)
      );
    }
    this.trace({ kind: 'binding-create', bindingId: id, bindingKind: 'virtualEach', paths: [readPathValue] });
    record.apply(EMPTY_PATCH);
    return this.bindingHandle(record);
  }

  flush(): void {
    this.scheduled = false;
    if (this.disposed || this.dirty.size === 0) return;
    const dirtyIds = Array.from(this.dirty);
    this.dirty.clear();
    for (const id of dirtyIds) {
      const record = this.records.get(id);
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
    for (const record of Array.from(this.records.values())) {
      this.disposeRecord(record);
    }
    this.records.clear();
  }

  commitPatch(patch: FrontierDomStatePatchInput, options?: FrontierDomStatePatchCommitOptions): JsonValue | undefined {
    if (!this.source.commitPatch) throw new TypeError('frontier-dom source does not support commitPatch');
    return this.source.commitPatch(patch, options);
  }

  getTrace(): FrontierDomTraceEvent[] {
    return this.traceEvents.slice();
  }

  private addValueBinding(
    kind: FrontierDomBindingKind,
    path: WatchPath,
    bindingPath: JsonPath,
    options: FrontierDomValueOptions,
    write: (record: BindingRecord, value: JsonValue | undefined, patch: Patch) => void
  ): FrontierDomBinding {
    const equals = options.equals ?? defaultValueEquals;
    const id = this.nextId++;
    const record: BindingRecord = {
      id,
      kind,
      active: true,
      subscriptions: [],
      pendingPatch: [],
      previous: undefined,
      paths: [bindingPath],
      apply: (patch) => {
        const patchValue = patch === EMPTY_PATCH ? PATCH_VALUE_NOT_FOUND : readPatchAssignedValueResult(patch, bindingPath);
        const value = patchValue === PATCH_VALUE_NOT_FOUND ? readPath(this.source.get(), bindingPath) : patchValue.value;
        if (patch !== EMPTY_PATCH && equals(record.previous, value)) return;
        record.previous = value;
        write(record, value, patch);
      }
    };
    this.records.set(id, record);
    record.subscriptions = [this.source.watch(options.watch ?? { path }, (patch) => this.markDirty(record, patch))];
    this.trace({ kind: 'binding-create', bindingId: id, bindingKind: kind, paths: [bindingPath] });
    record.apply(EMPTY_PATCH);
    return this.bindingHandle(record);
  }

  private markDirty(record: BindingRecord, patch: Patch): void {
    if (!record.active || this.disposed) return;
    this.trace({ kind: 'binding-dirty', bindingId: record.id, bindingKind: record.kind, patchItems: patch.length });
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

  private bindingHandle(record: BindingRecord): FrontierDomBinding {
    const renderer = this;
    return {
      get id() {
        return record.id;
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
    this.trace({ kind: 'binding-dispose', bindingId: record.id, bindingKind: record.kind });
  }

  private trace(event: FrontierDomTraceEvent): void {
    if (!this.traceEnabled) return;
    this.traceSink?.(event);
    this.traceEvents[this.traceEvents.length] = event;
    if (this.traceEvents.length > DEFAULT_TRACE_LIMIT) {
      this.traceEvents.splice(0, this.traceEvents.length - DEFAULT_TRACE_LIMIT);
    }
  }
}

const MICRO_TASK_SCHEDULER: FrontierDomScheduler = {
  queue(callback) {
    queueMicrotask(callback);
  }
};

function assertActiveRenderer(renderer: DomRenderer): void {
  if ((renderer as any).disposed) throw new TypeError('frontier-dom renderer has been disposed');
}

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

function defaultTruthy(value: JsonValue | undefined): boolean {
  return Boolean(value);
}

function formatTextValue(value: JsonValue | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function formatAttributeValue(value: JsonValue | undefined): string {
  if (value === true) return '';
  return value === null || value === undefined ? '' : String(value);
}

function shouldRemoveAttribute(value: JsonValue | undefined): boolean {
  return value === null || value === undefined || value === false;
}

function isTextNode(target: Text | Element): target is Text {
  return target.nodeType === 3;
}

function isPathArray(input: unknown[]): boolean {
  if (input.length === 0) return true;
  const first = input[0];
  if (typeof first === 'number') return true;
  if (typeof first !== 'string') return false;
  if (first.charCodeAt(0) === 47) return false;
  return input.every((segment) => typeof segment === 'string' || typeof segment === 'number');
}

function enumerateCollection(
  collection: JsonValue | undefined,
  keyBy: string | number | FrontierDomKeyGetter
): Array<{ key: string; value: JsonValue | undefined }> {
  if (Array.isArray(collection)) {
    const items = new Array(collection.length);
    for (let index = 0; index < collection.length; index++) {
      const value = collection[index];
      const key = readItemKey(value, index, index, keyBy);
      items[index] = { key, value };
    }
    return items;
  }
  if (collection !== null && typeof collection === 'object') {
    const keys = Object.keys(collection);
    const items = new Array(keys.length);
    for (let index = 0; index < keys.length; index++) {
      const objectKey = keys[index];
      const value = (collection as Record<string, JsonValue>)[objectKey];
      const key = readItemKey(value, index, objectKey, keyBy);
      items[index] = { key, value };
    }
    return items;
  }
  return [];
}

function readItemKey(
  value: JsonValue | undefined,
  index: number,
  collectionKey: string | number,
  keyBy: string | number | FrontierDomKeyGetter
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

function createWhenContext(
  value: JsonValue | undefined,
  visible: boolean,
  branch: 'then' | 'fallback',
  patch: Patch,
  renderer: FrontierDomRenderer
): FrontierDomWhenContext {
  return {
    value,
    visible,
    branch,
    patch,
    renderer,
    source: renderer.source
  };
}

function removeWhenNode<TNode extends Node>(
  container: ParentNode,
  node: TNode | null,
  branch: 'then' | 'fallback' | null,
  value: JsonValue | undefined,
  visible: boolean,
  patch: Patch,
  options: FrontierDomWhenOptions<TNode>,
  renderer: FrontierDomRenderer
): void {
  if (node === null || branch === null) return;
  const context = createWhenContext(value, visible, branch, patch, renderer);
  const handler = branch === 'then' ? options : options.fallback;
  handler?.dispose?.(node, context);
  if (node.parentNode === container) container.removeChild(node);
}

function toTemplateWhenContext(context: FrontierDomWhenContext): FrontierDomEachItemContext {
  return {
    key: context.branch,
    index: context.branch === 'then' ? 0 : -1,
    patch: context.patch,
    renderer: context.renderer,
    source: context.source,
    when: {
      value: context.value,
      visible: context.visible,
      branch: context.branch
    }
  };
}

function mountManifestBinding(
  renderer: FrontierDomRenderer,
  root: ParentNode,
  manifest: FrontierDomRenderManifestV1,
  binding: FrontierDomManifestBinding,
  registry: FrontierDomManifestRegistry,
  hydrateExisting: boolean
): void {
  switch (binding.kind) {
    case 'text':
      renderer.text(binding.path, resolveNodeTarget(root, binding.target) as Text | Element, {
        watch: binding.watch,
        format: resolveFormatter(binding.format, registry)
      });
      break;
    case 'attr':
      renderer.attr(binding.path, resolveElementTarget(root, binding.target), binding.name, {
        watch: binding.watch,
        format: resolveFormatter(binding.format, registry)
      });
      break;
    case 'prop':
      renderer.prop(binding.path, resolveElementTarget(root, binding.target), binding.name, { watch: binding.watch });
      break;
    case 'class':
      renderer.className(binding.path, resolveElementTarget(root, binding.target), binding.name, { watch: binding.watch });
      break;
    case 'style':
      renderer.style(binding.path, resolveElementTarget(root, binding.target) as HTMLElement | SVGElement, binding.name, {
        watch: binding.watch,
        priority: binding.priority,
        format: resolveFormatter(binding.format, registry)
      });
      break;
    case 'event': {
      const action = registry.actions?.[binding.action];
      const actionRegistry = registry.actionRegistry;
      if (!action && !actionRegistry) throw new TypeError('frontier-dom action is not registered: ' + binding.action);
      if (binding.delegate) {
        renderer.delegate(
          resolveElementTarget(root, binding.target),
          binding.event,
          binding.delegate,
          (event, matched) => {
            if (action) action({ event, renderer, source: renderer.source, binding, manifest });
            else actionRegistry?.dispatch(
              binding.action,
              readDomActionInput(event, matched),
              readDomActionDispatchOptions(binding, event)
            );
          },
          toEventOptions(binding.options)
        );
      } else {
        renderer.event(
          resolveNodeTarget(root, binding.target),
          binding.event,
          (event) => {
            if (action) action({ event, renderer, source: renderer.source, binding, manifest });
            else actionRegistry?.dispatch(
              binding.action,
              readDomActionInput(event),
              readDomActionDispatchOptions(binding, event)
            );
          },
          toEventOptions(binding.options)
        );
      }
      break;
    }
    case 'form':
      renderer.formValue(binding.path, resolveElementTarget(root, binding.target), {
        watch: binding.watch,
        prop: binding.prop,
        event: binding.event,
        format: resolveFormatter(binding.format, registry)
      });
      break;
    case 'when': {
      const template = registry.templates?.[binding.template];
      if (!template) throw new TypeError('frontier-dom template is not registered: ' + binding.template);
      const fallbackTemplate = binding.fallbackTemplate ? registry.templates?.[binding.fallbackTemplate] : undefined;
      if (binding.fallbackTemplate && !fallbackTemplate) {
        throw new TypeError('frontier-dom fallback template is not registered: ' + binding.fallbackTemplate);
      }
      renderer.when(binding.path, {
        container: resolveElementTarget(root, binding.target),
        watch: binding.watch,
        create(value, context) {
          return template.create(value, toTemplateWhenContext(context));
        },
        update(node, value, context) {
          template.update?.(node, value, toTemplateWhenContext(context));
        },
        dispose(node, context) {
          template.dispose?.(node, toTemplateWhenContext(context));
        },
        fallback: fallbackTemplate
          ? {
              create(value, context) {
                return fallbackTemplate.create(value, toTemplateWhenContext(context));
              },
              update(node, value, context) {
                fallbackTemplate.update?.(node, value, toTemplateWhenContext(context));
              },
              dispose(node, context) {
                fallbackTemplate.dispose?.(node, toTemplateWhenContext(context));
              }
            }
          : undefined
      });
      break;
    }
    case 'each': {
      const template = registry.templates?.[binding.template];
      if (!template) throw new TypeError('frontier-dom template is not registered: ' + binding.template);
      renderer.each(binding.path, {
        container: resolveElementTarget(root, binding.container),
        keyBy: binding.keyBy ?? 'id',
        keyAttribute: binding.keyAttribute,
        fields: binding.fields,
        hydrateExisting,
        create(value, context) {
          const node = template.create(value, context);
          setNodeKeyAttribute(node, binding.keyAttribute ?? 'data-frontier-key', context.key);
          return node;
        },
        update: template.update,
        dispose: template.dispose
      });
      break;
    }
    case 'virtualEach': {
      const template = registry.templates?.[binding.template];
      if (!template) throw new TypeError('frontier-dom template is not registered: ' + binding.template);
      renderer.virtualEach(binding.path, {
        container: resolveElementTarget(root, binding.container),
        keyBy: binding.keyBy ?? 'id',
        keyAttribute: binding.keyAttribute,
        fields: binding.fields,
        hydrateExisting,
        viewport: binding.viewport ?? { offset: 0, size: Number.MAX_SAFE_INTEGER },
        layout: resolveVirtualLayout(binding.layout, registry),
        overscan: binding.overscan,
        overscanPx: binding.overscanPx,
        create(value, context) {
          const node = template.create(value, context);
          setNodeKeyAttribute(node, binding.keyAttribute ?? 'data-frontier-key', context.key);
          return node;
        },
        update: template.update,
        dispose: template.dispose
      });
      break;
    }
    default:
      throw new TypeError('unsupported frontier-dom binding kind: ' + (binding as FrontierDomManifestBinding).kind);
  }
}

function resolveManifestRoot(manifest: FrontierDomRenderManifestV1, target: ParentNode | null): ParentNode {
  const root = target ?? readGlobalDocument();
  if (!manifest.root) return root;
  return resolveNodeTarget(root, manifest.root) as ParentNode;
}

function resolveElementTarget(root: ParentNode, target: FrontierDomNodeTarget): Element {
  const node = resolveNodeTarget(root, target);
  if (!isElementLike(node)) throw new TypeError('frontier-dom manifest target is not an element');
  return node;
}

function resolveNodeTarget(root: ParentNode, target: FrontierDomNodeTarget | undefined): Node {
  if (!target || (!target.anchor && !target.selector)) throw new TypeError('frontier-dom manifest target is required');
  if (target.selector) {
    const selected = queryRoot(root, target.selector);
    if (selected) return selected;
  }
  if (target.anchor) {
    const selected = queryRoot(root, '[data-frontier-id="' + escapeCssAttribute(target.anchor) + '"]');
    if (selected) return selected;
  }
  throw new TypeError('frontier-dom manifest target was not found');
}

function queryRoot(root: ParentNode, selector: string): Element | null {
  if (isElementLike(root) && typeof root.matches === 'function' && root.matches(selector)) return root;
  return typeof root.querySelector === 'function' ? root.querySelector(selector) : null;
}

function resolveFormatter(name: string | undefined, registry: FrontierDomManifestRegistry): FrontierDomValueFormatter | undefined {
  if (name === undefined || name === '' || name === 'text') return undefined;
  if (name === 'json') return (value) => value === undefined ? '' : JSON.stringify(value);
  const formatter = registry.formatters?.[name];
  if (!formatter) throw new TypeError('frontier-dom formatter is not registered: ' + name);
  return formatter;
}

function resolveVirtualLayout(
  layout: FrontierDomVirtualLayoutManifest,
  registry: FrontierDomManifestRegistry
): FrontierVirtualLayoutProvider {
  if (typeof layout === 'string') {
    const provider = registry.layouts?.[layout];
    if (!provider) throw new TypeError('frontier-dom layout is not registered: ' + layout);
    return provider;
  }
  if (layout.kind === 'fixed') return createFixedLayout(layout.itemSize);
  if (layout.kind === 'variable') {
    return createVariableLayout({ defaultSize: layout.defaultSize, sizes: layout.state });
  }
  if (layout.kind === 'text') return createTextLayout(layout);
  throw new TypeError('unsupported frontier-dom virtual layout kind: ' + (layout as { kind?: string }).kind);
}

function reconcileHydrationBasis(
  manifest: FrontierDomRenderManifestV1,
  source: FrontierDomSource,
  policy: FrontierDomHydrationBasisPolicy,
  onMismatch: ((mismatch: FrontierDomHydrationBasisMismatch) => void) | undefined
): void {
  if (policy === 'ignore') return;
  const expected = manifest.source?.basis;
  const actual = source.getBasis?.();
  if (expected === undefined || actual === undefined || expected === actual) return;
  const mismatch: FrontierDomHydrationBasisMismatch = { expected, actual, manifest };
  onMismatch?.(mismatch);
  if (policy === 'error') {
    throw new TypeError('frontier-dom hydration basis mismatch: expected ' + expected + ', got ' + actual);
  }
  if (policy === 'warn') {
    const consoleLike = (globalThis as { console?: Pick<Console, 'warn'> }).console;
    consoleLike?.warn?.('frontier-dom hydration basis mismatch', mismatch);
  }
}

function toEventOptions(options: FrontierDomSerializableEventOptions | undefined): FrontierDomEventOptions {
  if (!options) return {};
  return {
    capture: options.capture,
    once: options.once,
    passive: options.passive
  };
}

function readDomActionDispatchOptions(
  binding: FrontierDomEventManifestBinding,
  event: Event
): FrontierDomActionDispatchOptions {
  return {
    causeId: 'frontier-dom:' + binding.id + ':' + event.type,
    metadata: {
      bindingId: binding.id,
      action: binding.action,
      event: event.type
    }
  };
}

function readDomActionInput(event: Event, matched?: Element): JsonValue {
  const target = matched ?? (isElementLike(event.target) ? event.target : undefined);
  const input: Record<string, JsonValue> = { event: event.type };
  if (!target) return input;
  const payload = target.getAttribute('data-frontier-action-payload') ?? target.getAttribute('data-action-payload');
  if (payload) {
    try {
      input.payload = JSON.parse(payload) as JsonValue;
    } catch {
      input.payload = payload;
    }
  }
  const id = target.getAttribute('id');
  if (id) input.id = id;
  const name = target.getAttribute('name');
  if (name) input.name = name;
  const action = target.getAttribute('data-action');
  if (action) input.action = action;
  const dataset = readElementDataset(target);
  if (Object.keys(dataset).length !== 0) input.dataset = dataset;
  const value = readJsonDomProperty(target, 'value');
  if (value !== undefined) input.value = value;
  const checked = readJsonDomProperty(target, 'checked');
  if (checked !== undefined) input.checked = checked;
  return input;
}

function readElementDataset(element: Element): JsonValue {
  const dataset = (element as HTMLElement).dataset;
  const out: Record<string, JsonValue> = {};
  if (!dataset) return out;
  for (const key of Object.keys(dataset)) {
    const value = dataset[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function readJsonDomProperty(element: Element, key: string): JsonValue | undefined {
  const value = (element as unknown as Record<string, unknown>)[key];
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value as JsonValue;
  }
  return undefined;
}

function readGlobalDocument(): Document {
  const doc = (globalThis as any).document;
  if (!doc) throw new TypeError('frontier-dom manifest target requires a target root or global document');
  return doc;
}

function isElementLike(value: unknown): value is Element {
  return value !== null && typeof value === 'object' && (value as Node).nodeType === 1;
}

function escapeCssAttribute(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function hydrateEachEntries<TNode extends Node>(
  container: ParentNode,
  entries: Map<string, EachEntry<TNode>>,
  keyAttribute: string
): void {
  for (let index = 0; index < container.childNodes.length; index++) {
    const node = container.childNodes[index] as unknown as TNode;
    const key = readNodeKeyAttribute(node, keyAttribute);
    if (key === null || entries.has(key)) continue;
    entries.set(key, { key, index, node });
  }
}

function placeEachNodes<TNode extends Node>(container: ParentNode, entries: Array<EachEntry<TNode>>): void {
  let anchor: Node | null = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const node = entries[i].node;
    if (node.parentNode !== container || node.nextSibling !== anchor) {
      container.insertBefore(node, anchor);
    }
    anchor = node;
  }
}

function setNodeKeyAttribute(node: Node, keyAttribute: string, key: string): void {
  if (isElementLike(node)) node.setAttribute(keyAttribute, key);
}

function readNodeKeyAttribute(node: Node, keyAttribute: string): string | null {
  return isElementLike(node) ? node.getAttribute(keyAttribute) : null;
}

function createVirtualSpacers(container: ParentNode, options: FrontierDomVirtualEachOptions['spacer']): {
  enabled: boolean;
  before: HTMLElement | null;
  after: HTMLElement | null;
} {
  if (options === false) return { enabled: false, before: null, after: null };
  const doc = container.ownerDocument ?? readGlobalDocument();
  const provided = options && typeof options === 'object' ? options : {};
  const tagName = isElementLike(container) && /^(UL|OL)$/i.test(container.tagName) ? 'li' : 'div';
  const before = provided.before ?? doc.createElement(tagName);
  const after = provided.after ?? doc.createElement(tagName);
  before.setAttribute('data-frontier-virtual-spacer', 'before');
  after.setAttribute('data-frontier-virtual-spacer', 'after');
  return { enabled: true, before, after };
}

function placeVirtualNodes<TNode extends Node>(
  container: ParentNode,
  spacers: { enabled: boolean; before: HTMLElement | null; after: HTMLElement | null },
  entries: Array<EachEntry<TNode>>,
  offsetBefore: number,
  offsetAfter: number
): void {
  if (spacers.enabled && spacers.before && spacers.after) {
    setSpacerSize(spacers.before, offsetBefore);
    setSpacerSize(spacers.after, offsetAfter);
    if (spacers.before.parentNode !== container) container.insertBefore(spacers.before, container.firstChild);
    if (spacers.after.parentNode !== container) container.appendChild(spacers.after);
  }
  let anchor: Node | null = spacers.enabled ? spacers.after : null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const node = entries[i].node;
    if (node.parentNode !== container || node.nextSibling !== anchor) {
      container.insertBefore(node, anchor);
    }
    anchor = node;
  }
  if (spacers.enabled && spacers.before && spacers.before.nextSibling !== anchor) {
    container.insertBefore(spacers.before, anchor);
  }
}

function removeVirtualSpacers(
  container: ParentNode,
  spacers: { enabled: boolean; before: HTMLElement | null; after: HTMLElement | null }
): void {
  if (!spacers.enabled) return;
  if (spacers.before?.parentNode === container) container.removeChild(spacers.before);
  if (spacers.after?.parentNode === container) container.removeChild(spacers.after);
}

function setSpacerSize(spacer: HTMLElement, size: number): void {
  const next = String(Math.max(0, size));
  const virtualSpacer = spacer as HTMLElement & { [VIRTUAL_SIZE_STATE]?: string };
  if (virtualSpacer[VIRTUAL_SIZE_STATE] === next) return;
  spacer.style.height = next + 'px';
  spacer.setAttribute('data-frontier-virtual-size', next);
  virtualSpacer[VIRTUAL_SIZE_STATE] = next;
}

function setVirtualNodeGeometry(node: Node, offset: number, size: number): void {
  if (!isElementLike(node)) return;
  const element = node as FrontierVirtualElement;
  const nextOffset = String(offset);
  if (element[VIRTUAL_OFFSET_STATE] !== nextOffset) {
    node.setAttribute('data-frontier-virtual-offset', nextOffset);
    element[VIRTUAL_OFFSET_STATE] = nextOffset;
  }
  const nextSize = String(size);
  if (element[VIRTUAL_SIZE_STATE] !== nextSize) {
    node.setAttribute('data-frontier-virtual-size', nextSize);
    element[VIRTUAL_SIZE_STATE] = nextSize;
  }
}

function rootContains(root: ParentNode, node: Node): boolean {
  return root === node || (typeof root.contains === 'function' && root.contains(node));
}

function inferFormProperty(element: Element): string {
  const type = isElementLike(element) ? element.getAttribute('type') : null;
  if (type === 'checkbox' || type === 'radio') return 'checked';
  return 'value';
}

function defaultFormValueParser(prop: string): (value: unknown) => JsonValue | undefined {
  if (prop === 'checked') return (value) => Boolean(value);
  return (value) => value === undefined || value === null ? '' : String(value);
}

function readFormProperty(element: Element, prop: string): unknown {
  return (element as unknown as Record<string, unknown>)[prop];
}

function writeFormProperty(element: Element, prop: string, value: string, preserveSelection: boolean): void {
  const target = element as unknown as HTMLInputElement & HTMLTextAreaElement & Record<string, unknown>;
  if (prop === 'checked') {
    target.checked = value === 'true' || value === '';
    return;
  }
  if (target[prop] === value) return;
  let selection: { start: number | null; end: number | null; direction: SelectionDirection | null } | null = null;
  const doc = element.ownerDocument;
  if (preserveSelection && doc?.activeElement === element && typeof target.selectionStart === 'number') {
    selection = {
      start: target.selectionStart,
      end: target.selectionEnd,
      direction: target.selectionDirection
    };
  }
  target[prop] = value;
  if (selection && typeof target.setSelectionRange === 'function') {
    try {
      target.setSelectionRange(selection.start, selection.end, selection.direction ?? undefined);
    } catch {
      // Some input types do not allow selection APIs.
    }
  }
}

function tryApplyEachPatch<TNode extends Node>(
  patch: Patch,
  sourceValue: JsonValue | undefined,
  readPathValue: JsonPath,
  keyBy: string | number | FrontierDomKeyGetter,
  entries: Map<string, EachEntry<TNode>>,
  options: FrontierDomEachOptions<TNode>,
  bindingId: number,
  renderer: FrontierDomRenderer
): boolean {
  const collection = readPath(sourceValue, readPathValue);
  let touched: number[] | null = null;
  for (let i = 0; i < patch.length; i++) {
    const next = collectEachTouchedIndexes(patch[i], readPathValue);
    if (next === null) return false;
    if (next.length === 0) continue;
    if (touched === null) touched = next;
    else {
      for (let j = 0; j < next.length; j++) touched[touched.length] = next[j];
    }
  }
  if (touched === null) return true;
  dedupeNumberArrayInPlace(touched);
  for (let i = 0; i < touched.length; i++) {
    const index = touched[i];
    const value = readCollectionIndex(collection, index);
    const key = readItemKey(value, index, index, keyBy);
    const entry = entries.get(key);
    if (!entry) return false;
    entry.index = index;
    options.update?.(entry.node, value, {
      key,
      index,
      patch,
      renderer,
      source: renderer.source
    });
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

function readCollectionIndex(collection: JsonValue | undefined, index: number): JsonValue | undefined {
  return Array.isArray(collection) ? collection[index] : undefined;
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

export function readPatchAssignedValue(patch: Patch, path: WatchPath): JsonValue | undefined {
  const result = readPatchAssignedValueResult(patch, normalizePath(path));
  return result === PATCH_VALUE_NOT_FOUND ? undefined : result.value;
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
