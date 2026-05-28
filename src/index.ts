import {
  OP_ARRAY_OBJECT_FIELD_ASSIGN,
  OP_ARRAY_SPLICE,
  OP_REMOVE,
  OP_SET
} from '@shapeshift-labs/frontier/constants';
import { getCachedPointerPath, getPath } from '@shapeshift-labs/frontier/pointer';
import { createJsxManifest } from './jsx-runtime.js';
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
  getHeads?(): readonly string[] | undefined;
  getStateVector?(): Record<string, number> | undefined;
};

export interface FrontierDomSource {
  get(): JsonValue | undefined;
  watch(options: WatchOptions, callback: FrontierDomWatchCallback): PatchSubscription;
  commitPatch?(patch: FrontierDomStatePatchInput, options?: FrontierDomStatePatchCommitOptions): JsonValue | undefined;
  getBasis?(): number | string | undefined;
  getHeads?(): readonly string[] | undefined;
  getStateVector?(): Record<string, number> | undefined;
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
  getHeads?(): readonly string[] | undefined;
  getStateVector?(): Record<string, number> | undefined;
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

export type FrontierDomHydrationReconcilePolicy = 'ignore' | 'warn' | 'error' | 'reconcile';

export type FrontierDomHydrationBasisPolicy = FrontierDomHydrationReconcilePolicy;

export type FrontierDomHydrationAnchorPolicy = 'error' | 'warn' | 'rematerialize';

export interface FrontierDomHydrationBasisMismatch {
  expected: number | string | undefined;
  actual: number | string | undefined;
  manifest: FrontierDomRenderManifestV1;
}

export type FrontierDomHydrationIssueKind =
  | 'basis'
  | 'snapshot'
  | 'heads'
  | 'stateVector'
  | 'missing-anchor'
  | 'stale-anchor'
  | 'rematerialized-anchor'
  | 'rematerialized-root';

export interface FrontierDomHydrationIssue {
  kind: FrontierDomHydrationIssueKind;
  bindingId?: string;
  anchor?: string;
  selector?: string;
  expected?: unknown;
  actual?: unknown;
  message: string;
}

export interface FrontierDomHydrationReport {
  issues: FrontierDomHydrationIssue[];
  reusedAnchors: string[];
  missingAnchors: string[];
  staleAnchors: string[];
  rematerializedAnchors: string[];
  source?: {
    expected?: FrontierDomManifestSource;
    actual?: FrontierDomManifestSource;
  };
  snapshotMatched?: boolean;
}

export interface FrontierDomSerializedState {
  kind: 'frontier.dom.state';
  version: FrontierDomManifestVersion;
  manifest: FrontierDomRenderManifestV1;
  source?: FrontierDomManifestSource;
  html?: string;
  snapshot?: JsonValue;
  layout?: FrontierVirtualSerializedLayoutState[];
}

export interface FrontierDomCompiledView {
  html: string;
  manifest: FrontierDomRenderManifestV1;
}

export type FrontierDomAppView =
  | Node
  | FrontierDomRenderManifestV1
  | FrontierDomSerializedState
  | FrontierDomCompiledView;

export interface FrontierDomAppOptions extends Omit<FrontierDomRendererOptions, 'target'>, FrontierDomManifestRegistry {
  target?: ParentNode | string | null;
  replace?: boolean;
  hydrateExisting?: boolean;
  basisPolicy?: FrontierDomHydrationBasisPolicy;
  onBasisMismatch?: (mismatch: FrontierDomHydrationBasisMismatch) => void;
  manifestSource?: FrontierDomManifestSource;
  root?: FrontierDomManifestRoot;
}

export interface FrontierDomAppMountOptions extends FrontierDomManifestRegistry {
  replace?: boolean;
  hydrateExisting?: boolean;
  basisPolicy?: FrontierDomHydrationBasisPolicy;
  onBasisMismatch?: (mismatch: FrontierDomHydrationBasisMismatch) => void;
  manifestSource?: FrontierDomManifestSource;
  root?: FrontierDomManifestRoot;
}

export interface FrontierDomAppHydrateOptions extends FrontierDomAppMountOptions {
  html?: string;
  snapshot?: JsonValue;
  reconcile?: boolean;
  snapshotPolicy?: FrontierDomHydrationReconcilePolicy;
  metadataPolicy?: FrontierDomHydrationReconcilePolicy;
  anchorPolicy?: FrontierDomHydrationAnchorPolicy;
  onHydrationIssue?: (issue: FrontierDomHydrationIssue, report: FrontierDomHydrationReport) => void;
  onHydrationReport?: (report: FrontierDomHydrationReport) => void;
}

export interface FrontierDomApp {
  readonly source: FrontierDomSource;
  readonly target: ParentNode | null;
  readonly renderer: FrontierDomRenderer | null;
  readonly hydrationReport: FrontierDomHydrationReport | null;
  mount(view: FrontierDomAppView, options?: FrontierDomAppMountOptions): FrontierDomRenderer;
  hydrate(view: FrontierDomRenderManifestV1 | FrontierDomSerializedState | FrontierDomCompiledView, options?: FrontierDomAppHydrateOptions): FrontierDomRenderer;
  serialize(options?: Omit<Parameters<typeof serializeDomState>[0], 'manifest' | 'source'>): FrontierDomSerializedState;
  flush(): void;
  dispose(): void;
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

type HydrationView = {
  manifest: FrontierDomRenderManifestV1;
  html?: string;
  snapshot?: JsonValue;
  sourceMetadata?: FrontierDomManifestSource;
};

type HydrationMetadataOptions = {
  basisPolicy: FrontierDomHydrationBasisPolicy;
  metadataPolicy: FrontierDomHydrationReconcilePolicy;
  snapshotPolicy: FrontierDomHydrationReconcilePolicy;
  onBasisMismatch?: (mismatch: FrontierDomHydrationBasisMismatch) => void;
  onHydrationIssue?: (issue: FrontierDomHydrationIssue, report: FrontierDomHydrationReport) => void;
};

type HydrationDomOptions = {
  anchorPolicy: FrontierDomHydrationAnchorPolicy;
  onHydrationIssue?: (issue: FrontierDomHydrationIssue, report: FrontierDomHydrationReport) => void;
};

type HydrationTargetRef = {
  bindingId?: string;
  target: FrontierDomNodeTarget;
  root?: boolean;
};

type FrontierDomResolvedMountOptions = Required<Pick<FrontierDomAppMountOptions, 'replace' | 'hydrateExisting' | 'basisPolicy'>> &
  FrontierDomManifestRegistry &
  Pick<FrontierDomAppMountOptions, 'onBasisMismatch' | 'manifestSource' | 'root'>;

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
    getBasis: stateEngine.getBasis ? () => stateEngine.getBasis?.() : undefined,
    getHeads: stateEngine.getHeads ? () => stateEngine.getHeads?.() : undefined,
    getStateVector: stateEngine.getStateVector ? () => stateEngine.getStateVector?.() : undefined
  };
}

export function fromPatchSource(source: FrontierDomPatchSourceLike): FrontierDomSource {
  return {
    get: () => source.get(),
    watch: (options, callback) => source.watch(options, callback),
    commitPatch: source.commitPatch
      ? (patch, options) => source.commitPatch?.(patch, options)
      : undefined,
    getBasis: source.getBasis ? () => source.getBasis?.() : undefined,
    getHeads: source.getHeads ? () => source.getHeads?.() : undefined,
    getStateVector: source.getStateVector ? () => source.getStateVector?.() : undefined
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
  const targetCache = new Map<string, Node>();
  reconcileHydrationBasis(manifest, renderer.source, options.basisPolicy ?? 'ignore', options.onBasisMismatch);
  for (let i = 0; i < manifest.bindings.length; i++) {
    mountManifestBinding(renderer, root, manifest, manifest.bindings[i], registry, options.hydrateExisting !== false, targetCache);
  }
  return renderer;
}

export const hydrateDomRenderer = createDomRendererFromManifest;

export function createApp(options: FrontierDomAppOptions): FrontierDomApp {
  return new DomApp(options);
}

export const createFrontierApp = createApp;

export function serializeDomState(input: {
  manifest: FrontierDomRenderManifestV1;
  source?: FrontierDomSource;
  sourceMetadata?: FrontierDomManifestSource;
  html?: string;
  snapshot?: JsonValue;
  layout?: FrontierVirtualLayoutProvider[];
  includeSnapshot?: boolean;
}): FrontierDomSerializedState {
  const manifest = assertRenderManifestV1(input.manifest);
  const source: FrontierDomManifestSource = {
    ...(manifest.source ?? {}),
    ...(input.sourceMetadata ?? {}),
    ...readSourceMetadata(input.source)
  };
  const out: FrontierDomSerializedState = {
    kind: 'frontier.dom.state',
    version: 1,
    manifest,
    source: Object.keys(source).length === 0 ? undefined : source
  };
  if (input.html !== undefined) out.html = input.html;
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
  if ((value as FrontierDomSerializedState).html !== undefined && typeof (value as FrontierDomSerializedState).html !== 'string') {
    throw new TypeError('invalid frontier-dom serialized html');
  }
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

function normalizeHydrationView(
  view: FrontierDomRenderManifestV1 | FrontierDomSerializedState | FrontierDomCompiledView,
  options: FrontierDomAppHydrateOptions,
  mountOptions: FrontierDomResolvedMountOptions
): HydrationView {
  if (isSerializedDomState(view)) {
    const manifest = mergeManifestMetadata(view.manifest, view.source, mountOptions.manifestSource, mountOptions.root);
    return {
      manifest,
      html: options.html ?? view.html,
      snapshot: options.snapshot !== undefined ? options.snapshot : view.snapshot,
      sourceMetadata: manifest.source
    };
  }
  if (isCompiledView(view)) {
    const manifest = mergeManifestMetadata(view.manifest, mountOptions.manifestSource, undefined, mountOptions.root);
    return {
      manifest,
      html: options.html ?? view.html,
      snapshot: options.snapshot,
      sourceMetadata: manifest.source
    };
  }
  if (isRenderManifest(view)) {
    const manifest = mergeManifestMetadata(view, mountOptions.manifestSource, undefined, mountOptions.root);
    return {
      manifest,
      html: options.html,
      snapshot: options.snapshot,
      sourceMetadata: manifest.source
    };
  }
  throw new TypeError('frontier-dom app hydrate() requires a manifest, serialized state, or compiled view');
}

function createHydrationReport(
  manifest: FrontierDomRenderManifestV1,
  sourceMetadata: FrontierDomManifestSource | undefined,
  snapshot: JsonValue | undefined,
  source: FrontierDomSource
): FrontierDomHydrationReport {
  const expected = mergeSourceMetadata(manifest.source, sourceMetadata);
  const actualSource = readSourceMetadata(source);
  const actual = Object.keys(actualSource).length === 0 ? undefined : actualSource;
  const report: FrontierDomHydrationReport = {
    issues: [],
    reusedAnchors: [],
    missingAnchors: [],
    staleAnchors: [],
    rematerializedAnchors: []
  };
  if (expected || actual) report.source = { expected, actual };
  if (snapshot !== undefined) report.snapshotMatched = jsonValueEqual(snapshot, source.get());
  return report;
}

function reconcileHydrationMetadata(
  manifest: FrontierDomRenderManifestV1,
  report: FrontierDomHydrationReport,
  options: HydrationMetadataOptions
): void {
  const expected = report.source?.expected;
  const actual = report.source?.actual;
  if (expected?.basis !== undefined && expected.basis !== actual?.basis) {
    const mismatch: FrontierDomHydrationBasisMismatch = { expected: expected.basis, actual: actual?.basis, manifest };
    if (options.basisPolicy !== 'ignore') options.onBasisMismatch?.(mismatch);
    handleHydrationIssue(report, {
      kind: 'basis',
      expected: expected.basis,
      actual: actual?.basis,
      message: 'frontier-dom hydration basis mismatch'
    }, options.basisPolicy, options.onHydrationIssue);
  }
  if (expected?.heads !== undefined && !stringArrayEqual(normalizeHeads(expected.heads), normalizeHeads(actual?.heads))) {
    handleHydrationIssue(report, {
      kind: 'heads',
      expected: normalizeHeads(expected.heads),
      actual: normalizeHeads(actual?.heads),
      message: 'frontier-dom hydration CRDT heads mismatch'
    }, options.metadataPolicy, options.onHydrationIssue);
  }
  if (expected?.stateVector !== undefined && !stateVectorEqual(expected.stateVector, actual?.stateVector)) {
    handleHydrationIssue(report, {
      kind: 'stateVector',
      expected: cloneStateVector(expected.stateVector),
      actual: cloneStateVector(actual?.stateVector),
      message: 'frontier-dom hydration CRDT state vector mismatch'
    }, options.metadataPolicy, options.onHydrationIssue);
  }
  if (report.snapshotMatched === false) {
    handleHydrationIssue(report, {
      kind: 'snapshot',
      expected: true,
      actual: false,
      message: 'frontier-dom hydration snapshot differs from the current client state'
    }, options.snapshotPolicy, options.onHydrationIssue);
  }
}

function reconcileHydrationDom(
  target: ParentNode,
  manifest: FrontierDomRenderManifestV1,
  html: string | undefined,
  report: FrontierDomHydrationReport,
  options: HydrationDomOptions
): void {
  const skeleton = html ? parseHydrationSkeleton(target, html) : null;
  if (skeleton && target.childNodes.length === 0) {
    target.appendChild(skeleton.cloneNode(true));
    addHydrationIssue(report, {
      kind: 'rematerialized-root',
      anchor: manifest.root?.anchor,
      selector: manifest.root?.selector,
      message: 'frontier-dom hydration materialized server HTML into an empty target'
    }, options.onHydrationIssue);
  }

  if (manifest.root && skeleton) {
    const currentRoot = tryResolveNodeTarget(target, manifest.root);
    const serverRoot = tryResolveNodeTarget(skeleton, manifest.root);
    if (!currentRoot && serverRoot) {
      materializeHydrationNode(target, skeleton, serverRoot);
      addHydrationIssue(report, {
        kind: 'rematerialized-root',
        anchor: manifest.root.anchor,
        selector: manifest.root.selector,
        message: 'frontier-dom hydration rematerialized the manifest root'
      }, options.onHydrationIssue);
    } else if (currentRoot && serverRoot && isStaleHydrationNode(currentRoot, serverRoot) && currentRoot.parentNode) {
      currentRoot.parentNode.replaceChild(serverRoot.cloneNode(true), currentRoot);
      addHydrationIssue(report, {
        kind: 'rematerialized-root',
        anchor: manifest.root.anchor,
        selector: manifest.root.selector,
        message: 'frontier-dom hydration replaced a stale manifest root'
      }, options.onHydrationIssue);
    }
  }

  const root = tryResolveManifestRoot(manifest, target) ?? target;
  const skeletonRoot = skeleton ? tryResolveManifestRoot(manifest, skeleton) ?? skeleton : null;
  const refs = collectHydrationTargets(manifest);
  const seen = new Set<string>();
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    const cacheKey = targetCacheKey(ref.target);
    if (seen.has(cacheKey)) continue;
    seen.add(cacheKey);
    const current = tryResolveNodeTarget(root, ref.target);
    const server = skeletonRoot ? tryResolveNodeTarget(skeletonRoot, ref.target) : null;
    if (current) {
      if (ref.target.anchor) pushUnique(report.reusedAnchors, ref.target.anchor);
      if (server && isStaleHydrationNode(current, server)) {
        recordHydrationTargetState(report, 'staleAnchors', ref);
        addHydrationIssue(report, {
          kind: 'stale-anchor',
          bindingId: ref.bindingId,
          anchor: ref.target.anchor,
          selector: ref.target.selector,
          expected: describeHydrationNode(server),
          actual: describeHydrationNode(current),
          message: 'frontier-dom hydration found a stale DOM anchor'
        }, options.onHydrationIssue);
        if (current.parentNode) {
          current.parentNode.replaceChild(server.cloneNode(true), current);
          recordHydrationTargetState(report, 'rematerializedAnchors', ref);
          addHydrationIssue(report, {
            kind: 'rematerialized-anchor',
            bindingId: ref.bindingId,
            anchor: ref.target.anchor,
            selector: ref.target.selector,
            message: 'frontier-dom hydration replaced a stale DOM anchor'
          }, options.onHydrationIssue);
        }
      }
      continue;
    }

    recordHydrationTargetState(report, 'missingAnchors', ref);
    addHydrationIssue(report, {
      kind: 'missing-anchor',
      bindingId: ref.bindingId,
      anchor: ref.target.anchor,
      selector: ref.target.selector,
      message: 'frontier-dom hydration manifest target is missing from the DOM'
    }, options.onHydrationIssue);
    if (skeletonRoot && server && options.anchorPolicy === 'rematerialize') {
      const mounted = materializeHydrationNode(root, skeletonRoot, server);
      if (mounted) {
        recordHydrationTargetState(report, 'rematerializedAnchors', ref);
        addHydrationIssue(report, {
          kind: 'rematerialized-anchor',
          bindingId: ref.bindingId,
          anchor: ref.target.anchor,
          selector: ref.target.selector,
          message: 'frontier-dom hydration rematerialized a missing DOM anchor'
        }, options.onHydrationIssue);
        continue;
      }
    }
    if (options.anchorPolicy === 'error' || options.anchorPolicy === 'rematerialize') {
      throw new TypeError('frontier-dom hydration target was not found: ' + describeHydrationTarget(ref.target));
    }
    warnHydrationIssue({
      kind: 'missing-anchor',
      bindingId: ref.bindingId,
      anchor: ref.target.anchor,
      selector: ref.target.selector,
      message: 'frontier-dom hydration target was not found: ' + describeHydrationTarget(ref.target)
    });
  }
}

function mergeManifestMetadata(
  manifest: FrontierDomRenderManifestV1,
  first?: FrontierDomManifestSource,
  second?: FrontierDomManifestSource,
  root?: FrontierDomManifestRoot
): FrontierDomRenderManifestV1 {
  const source = mergeSourceMetadata(manifest.source, first, second);
  const next: FrontierDomRenderManifestV1 = { ...manifest };
  if (source) next.source = source;
  else delete next.source;
  if (root) next.root = root;
  return assertRenderManifestV1(next);
}

function mergeSourceMetadata(
  ...sources: Array<FrontierDomManifestSource | undefined>
): FrontierDomManifestSource | undefined {
  const out: FrontierDomManifestSource = {};
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (!source) continue;
    Object.assign(out, source);
    if (source.heads) out.heads = normalizeHeads(source.heads);
    if (source.stateVector) out.stateVector = cloneStateVector(source.stateVector);
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

function readSourceMetadata(source: FrontierDomSource | undefined): FrontierDomManifestSource {
  const metadata: FrontierDomManifestSource = {};
  const basis = source?.getBasis?.();
  if (basis !== undefined) metadata.basis = basis;
  const heads = source?.getHeads?.();
  if (heads !== undefined) metadata.heads = normalizeHeads(heads);
  const stateVector = source?.getStateVector?.();
  if (stateVector !== undefined) metadata.stateVector = cloneStateVector(stateVector);
  return metadata;
}

class DomApp implements FrontierDomApp {
  private rendererValue: FrontierDomRenderer | null = null;
  private manifestValue: FrontierDomRenderManifestV1 | null = null;
  private hydrationReportValue: FrontierDomHydrationReport | null = null;
  private targetValue: ParentNode | null;

  constructor(private readonly options: FrontierDomAppOptions) {
    this.targetValue = resolveAppTarget(options.target ?? null);
  }

  get source(): FrontierDomSource {
    return this.options.source;
  }

  get target(): ParentNode | null {
    return this.targetValue;
  }

  get renderer(): FrontierDomRenderer | null {
    return this.rendererValue;
  }

  get hydrationReport(): FrontierDomHydrationReport | null {
    return this.hydrationReportValue;
  }

  mount(view: FrontierDomAppView, options: FrontierDomAppMountOptions = {}): FrontierDomRenderer {
    this.rendererValue?.dispose();
    this.hydrationReportValue = null;
    const mountOptions = this.mergeMountOptions(options);
    let manifest: FrontierDomRenderManifestV1;
    let target = this.targetValue;

    if (isSerializedDomState(view)) {
      manifest = mergeManifestMetadata(view.manifest, view.source, mountOptions.manifestSource, mountOptions.root);
    } else if (isCompiledView(view)) {
      target = target ?? resolveAppTarget(this.options.target ?? null);
      if (!target) throw new TypeError('frontier-dom app compiled views require a target');
      writeCompiledHtml(target, view.html, mountOptions.replace);
      manifest = mergeManifestMetadata(view.manifest, mountOptions.manifestSource, undefined, mountOptions.root);
    } else if (isRenderManifest(view)) {
      manifest = mergeManifestMetadata(view, mountOptions.manifestSource, undefined, mountOptions.root);
    } else {
      if (!isParentNodeLike(view)) throw new TypeError('frontier-dom app mount() requires a JSX ParentNode, manifest, serialized state, or compiled view');
      manifest = createJsxManifest(view, {
        root: mountOptions.root,
        source: mountOptions.manifestSource
      });
      target = attachRuntimeView(target, view, mountOptions.replace);
    }

    this.targetValue = target;
    this.manifestValue = manifest;
    this.rendererValue = createDomRendererFromManifest({
      source: this.options.source,
      target,
      scheduler: this.options.scheduler,
      trace: this.options.trace,
      manifest,
      templates: mountOptions.templates,
      actions: mountOptions.actions,
      actionRegistry: mountOptions.actionRegistry,
      formatters: mountOptions.formatters,
      layouts: mountOptions.layouts,
      hydrateExisting: mountOptions.hydrateExisting,
      basisPolicy: mountOptions.basisPolicy,
      onBasisMismatch: mountOptions.onBasisMismatch
    });
    return this.rendererValue;
  }

  hydrate(
    view: FrontierDomRenderManifestV1 | FrontierDomSerializedState | FrontierDomCompiledView,
    options: FrontierDomAppHydrateOptions = {}
  ): FrontierDomRenderer {
    this.rendererValue?.dispose();
    const mountOptions = this.mergeMountOptions({
      ...options,
      basisPolicy: options.basisPolicy ?? this.options.basisPolicy ?? 'reconcile',
      replace: options.replace ?? false
    });
    const hydration = normalizeHydrationView(view, options, mountOptions);
    let target = this.targetValue ?? resolveAppTarget(this.options.target ?? null);
    if (!target) throw new TypeError('frontier-dom app hydrate() requires a target');
    const report = createHydrationReport(hydration.manifest, hydration.sourceMetadata, hydration.snapshot, this.options.source);
    reconcileHydrationMetadata(hydration.manifest, report, {
      basisPolicy: mountOptions.basisPolicy,
      metadataPolicy: options.metadataPolicy ?? 'reconcile',
      snapshotPolicy: options.snapshotPolicy ?? 'reconcile',
      onBasisMismatch: mountOptions.onBasisMismatch,
      onHydrationIssue: options.onHydrationIssue
    });
    if (options.reconcile !== false) {
      reconcileHydrationDom(target, hydration.manifest, hydration.html, report, {
        anchorPolicy: options.anchorPolicy ?? 'rematerialize',
        onHydrationIssue: options.onHydrationIssue
      });
    }
    this.targetValue = target;
    this.manifestValue = hydration.manifest;
    this.hydrationReportValue = report;
    this.rendererValue = createDomRendererFromManifest({
      source: this.options.source,
      target,
      scheduler: this.options.scheduler,
      trace: this.options.trace,
      manifest: hydration.manifest,
      templates: mountOptions.templates,
      actions: mountOptions.actions,
      actionRegistry: mountOptions.actionRegistry,
      formatters: mountOptions.formatters,
      layouts: mountOptions.layouts,
      hydrateExisting: mountOptions.hydrateExisting,
      basisPolicy: 'ignore'
    });
    options.onHydrationReport?.(report);
    return this.rendererValue;
  }

  serialize(options: Omit<Parameters<typeof serializeDomState>[0], 'manifest' | 'source'> = {}): FrontierDomSerializedState {
    if (!this.manifestValue) throw new TypeError('frontier-dom app has no mounted manifest to serialize');
    return serializeDomState({
      ...options,
      manifest: this.manifestValue,
      source: this.options.source
    });
  }

  flush(): void {
    this.rendererValue?.flush();
  }

  dispose(): void {
    this.rendererValue?.dispose();
    this.rendererValue = null;
    this.manifestValue = null;
    this.hydrationReportValue = null;
  }

  private mergeMountOptions(options: FrontierDomAppMountOptions): FrontierDomResolvedMountOptions {
    return {
      replace: options.replace ?? this.options.replace ?? true,
      hydrateExisting: options.hydrateExisting ?? this.options.hydrateExisting ?? true,
      basisPolicy: options.basisPolicy ?? this.options.basisPolicy ?? 'ignore',
      onBasisMismatch: options.onBasisMismatch ?? this.options.onBasisMismatch,
      manifestSource: options.manifestSource ?? this.options.manifestSource,
      root: options.root ?? this.options.root,
      templates: { ...(this.options.templates ?? {}), ...(options.templates ?? {}) },
      actions: { ...(this.options.actions ?? {}), ...(options.actions ?? {}) },
      actionRegistry: options.actionRegistry ?? this.options.actionRegistry,
      formatters: { ...(this.options.formatters ?? {}), ...(options.formatters ?? {}) },
      layouts: { ...(this.options.layouts ?? {}), ...(options.layouts ?? {}) }
    };
  }
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
  hydrateExisting: boolean,
  targetCache: Map<string, Node>
): void {
  switch (binding.kind) {
    case 'text':
      renderer.text(binding.path, resolveNodeTarget(root, binding.target, targetCache) as Text | Element, {
        watch: binding.watch,
        format: resolveFormatter(binding.format, registry)
      });
      break;
    case 'attr':
      renderer.attr(binding.path, resolveElementTarget(root, binding.target, targetCache), binding.name, {
        watch: binding.watch,
        format: resolveFormatter(binding.format, registry)
      });
      break;
    case 'prop':
      renderer.prop(binding.path, resolveElementTarget(root, binding.target, targetCache), binding.name, { watch: binding.watch });
      break;
    case 'class':
      renderer.className(binding.path, resolveElementTarget(root, binding.target, targetCache), binding.name, { watch: binding.watch });
      break;
    case 'style':
      renderer.style(binding.path, resolveElementTarget(root, binding.target, targetCache) as HTMLElement | SVGElement, binding.name, {
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
          resolveElementTarget(root, binding.target, targetCache),
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
          resolveNodeTarget(root, binding.target, targetCache),
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
      renderer.formValue(binding.path, resolveElementTarget(root, binding.target, targetCache), {
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
        container: resolveElementTarget(root, binding.target, targetCache),
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
        container: resolveElementTarget(root, binding.container, targetCache),
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
        container: resolveElementTarget(root, binding.container, targetCache),
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

function resolveElementTarget(root: ParentNode, target: FrontierDomNodeTarget, cache?: Map<string, Node>): Element {
  const node = resolveNodeTarget(root, target, cache);
  if (!isElementLike(node)) throw new TypeError('frontier-dom manifest target is not an element');
  return node;
}

function resolveNodeTarget(root: ParentNode, target: FrontierDomNodeTarget | undefined, cache?: Map<string, Node>): Node {
  if (!target || (!target.anchor && !target.selector)) throw new TypeError('frontier-dom manifest target is required');
  const cacheKey = cache && targetCacheKey(target);
  if (cache && cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }
  if (target.selector) {
    const selected = queryRoot(root, target.selector);
    if (selected) {
      if (cache && cacheKey) cache.set(cacheKey, selected);
      return selected;
    }
  }
  if (target.anchor) {
    const selected = queryRoot(root, '[data-frontier-id="' + escapeCssAttribute(target.anchor) + '"]');
    if (selected) {
      if (cache && cacheKey) cache.set(cacheKey, selected);
      return selected;
    }
  }
  throw new TypeError('frontier-dom manifest target was not found');
}

function targetCacheKey(target: FrontierDomNodeTarget): string {
  return (target.selector ? 's:' + target.selector : '') + '\n' + (target.anchor ? 'a:' + target.anchor : '');
}

function queryRoot(root: ParentNode, selector: string): Element | null {
  if (isElementLike(root) && typeof root.matches === 'function' && root.matches(selector)) return root;
  return typeof root.querySelector === 'function' ? root.querySelector(selector) : null;
}

function tryResolveManifestRoot(manifest: FrontierDomRenderManifestV1, target: ParentNode | null): ParentNode | null {
  const root = target ?? readGlobalDocument();
  if (!manifest.root) return root;
  const node = tryResolveNodeTarget(root, manifest.root);
  return isParentNodeLike(node) ? node : null;
}

function tryResolveNodeTarget(root: ParentNode, target: FrontierDomNodeTarget | undefined): Node | null {
  if (!target || (!target.anchor && !target.selector)) return null;
  if (target.selector) {
    const selected = queryRoot(root, target.selector);
    if (selected) return selected;
  }
  if (target.anchor) {
    const selected = queryRoot(root, '[data-frontier-id="' + escapeCssAttribute(target.anchor) + '"]');
    if (selected) return selected;
  }
  return null;
}

function parseHydrationSkeleton(target: ParentNode, html: string): DocumentFragment {
  const doc = (target as Node).ownerDocument ?? readGlobalDocument();
  const template = doc.createElement('template');
  template.innerHTML = html;
  return template.content;
}

function collectHydrationTargets(manifest: FrontierDomRenderManifestV1): HydrationTargetRef[] {
  const refs: HydrationTargetRef[] = [];
  if (manifest.root) refs[refs.length] = { target: manifest.root, root: true };
  for (let i = 0; i < manifest.bindings.length; i++) {
    const binding = manifest.bindings[i];
    if (binding.target) refs[refs.length] = { bindingId: binding.id, target: binding.target };
    if ((binding.kind === 'each' || binding.kind === 'virtualEach') && binding.container) {
      refs[refs.length] = { bindingId: binding.id, target: binding.container };
    }
  }
  return refs;
}

function isStaleHydrationNode(current: Node, expected: Node): boolean {
  if (current.nodeType !== expected.nodeType) return true;
  if (!isElementLike(current) || !isElementLike(expected)) return false;
  return current.localName !== expected.localName || current.namespaceURI !== expected.namespaceURI;
}

function materializeHydrationNode(root: ParentNode, skeletonRoot: ParentNode, serverNode: Node): boolean {
  const parent = resolveHydrationInsertParent(root, skeletonRoot, serverNode);
  if (!parent) return false;
  const clone = serverNode.cloneNode(true);
  const before = findHydrationNextSibling(parent, root, serverNode);
  if (before) parent.insertBefore(clone, before);
  else {
    const after = findHydrationPreviousSibling(parent, root, serverNode);
    if (after && after.parentNode === parent) parent.insertBefore(clone, after.nextSibling);
    else parent.appendChild(clone);
  }
  return true;
}

function resolveHydrationInsertParent(root: ParentNode, skeletonRoot: ParentNode, serverNode: Node): ParentNode | null {
  let parent = serverNode.parentNode;
  while (parent && parent !== skeletonRoot) {
    if (isElementLike(parent)) {
      const anchor = parent.getAttribute('data-frontier-id');
      if (anchor) {
        const current = queryRoot(root, '[data-frontier-id="' + escapeCssAttribute(anchor) + '"]');
        if (current) return current;
      }
    }
    parent = parent.parentNode;
  }
  return root;
}

function findHydrationNextSibling(parent: ParentNode, root: ParentNode, serverNode: Node): Node | null {
  let sibling = serverNode.nextSibling;
  while (sibling) {
    const current = findCurrentNodeForServerSibling(root, sibling);
    if (current && current.parentNode === parent) return current;
    sibling = sibling.nextSibling;
  }
  return null;
}

function findHydrationPreviousSibling(parent: ParentNode, root: ParentNode, serverNode: Node): Node | null {
  let sibling = serverNode.previousSibling;
  while (sibling) {
    const current = findCurrentNodeForServerSibling(root, sibling);
    if (current && current.parentNode === parent) return current;
    sibling = sibling.previousSibling;
  }
  return null;
}

function findCurrentNodeForServerSibling(root: ParentNode, sibling: Node): Node | null {
  if (!isElementLike(sibling)) return null;
  const anchor = sibling.getAttribute('data-frontier-id');
  if (!anchor) return null;
  return queryRoot(root, '[data-frontier-id="' + escapeCssAttribute(anchor) + '"]');
}

function recordHydrationTargetState(
  report: FrontierDomHydrationReport,
  field: 'missingAnchors' | 'staleAnchors' | 'rematerializedAnchors',
  ref: HydrationTargetRef
): void {
  if (ref.target.anchor) pushUnique(report[field], ref.target.anchor);
}

function addHydrationIssue(
  report: FrontierDomHydrationReport,
  issue: FrontierDomHydrationIssue,
  onHydrationIssue?: (issue: FrontierDomHydrationIssue, report: FrontierDomHydrationReport) => void
): void {
  report.issues[report.issues.length] = issue;
  onHydrationIssue?.(issue, report);
}

function handleHydrationIssue(
  report: FrontierDomHydrationReport,
  issue: FrontierDomHydrationIssue,
  policy: FrontierDomHydrationReconcilePolicy,
  onHydrationIssue?: (issue: FrontierDomHydrationIssue, report: FrontierDomHydrationReport) => void
): void {
  if (policy === 'ignore') return;
  addHydrationIssue(report, issue, onHydrationIssue);
  if (policy === 'error') throw new TypeError(issue.message);
  if (policy === 'warn') warnHydrationIssue(issue);
}

function warnHydrationIssue(issue: FrontierDomHydrationIssue): void {
  const consoleLike = (globalThis as { console?: Pick<Console, 'warn'> }).console;
  consoleLike?.warn?.(issue.message, issue);
}

function pushUnique(items: string[], value: string): void {
  if (!items.includes(value)) items[items.length] = value;
}

function normalizeHeads(heads: readonly string[] | undefined): string[] | undefined {
  if (heads === undefined) return undefined;
  return heads.slice().sort();
}

function cloneStateVector(stateVector: Record<string, number> | undefined): Record<string, number> | undefined {
  return stateVector ? { ...stateVector } : undefined;
}

function stringArrayEqual(left: readonly string[] | undefined, right: readonly string[] | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function stateVectorEqual(left: Record<string, number> | undefined, right: Record<string, number> | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (!stringArrayEqual(leftKeys, rightKeys)) return false;
  for (let i = 0; i < leftKeys.length; i++) {
    const key = leftKeys[i];
    if (left[key] !== right[key]) return false;
  }
  return true;
}

function jsonValueEqual(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null) return left === right;
  if (typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
      if (!jsonValueEqual(left[i] as JsonValue, right[i] as JsonValue)) return false;
    }
    return true;
  }
  const leftRecord = left as Record<string, JsonValue>;
  const rightRecord = right as Record<string, JsonValue>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  if (!stringArrayEqual(leftKeys, rightKeys)) return false;
  for (let i = 0; i < leftKeys.length; i++) {
    const key = leftKeys[i];
    if (!jsonValueEqual(leftRecord[key], rightRecord[key])) return false;
  }
  return true;
}

function describeHydrationNode(node: Node): string {
  if (isElementLike(node)) return '<' + node.localName + '>';
  return 'nodeType:' + node.nodeType;
}

function describeHydrationTarget(target: FrontierDomNodeTarget): string {
  if (target.anchor) return 'anchor:' + target.anchor;
  if (target.selector) return 'selector:' + target.selector;
  return 'unknown target';
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

function resolveAppTarget(target: ParentNode | string | null): ParentNode | null {
  if (typeof target !== 'string') return target;
  const selected = readGlobalDocument().querySelector(target);
  if (!selected) throw new TypeError('frontier-dom app target was not found: ' + target);
  return selected;
}

function attachRuntimeView(target: ParentNode | null, view: ParentNode, replace: boolean): ParentNode {
  if (!target) return view;
  if (target === view) return target;
  if (replace && typeof target.replaceChildren === 'function') {
    target.replaceChildren(view);
  } else if (view.parentNode !== target) {
    target.appendChild(view);
  }
  return target;
}

function writeCompiledHtml(target: ParentNode, html: string, replace: boolean): void {
  const doc = (target as Node).ownerDocument ?? readGlobalDocument();
  const template = doc.createElement('template');
  template.innerHTML = html;
  if (replace && typeof target.replaceChildren === 'function') target.replaceChildren(template.content);
  else target.appendChild(template.content);
}

function isCompiledView(value: unknown): value is FrontierDomCompiledView {
  return value !== null &&
    typeof value === 'object' &&
    (value as FrontierDomSerializedState).kind !== 'frontier.dom.state' &&
    typeof (value as FrontierDomCompiledView).html === 'string' &&
    isRenderManifest((value as FrontierDomCompiledView).manifest);
}

function isSerializedDomState(value: unknown): value is FrontierDomSerializedState {
  return value !== null &&
    typeof value === 'object' &&
    (value as FrontierDomSerializedState).kind === 'frontier.dom.state' &&
    isRenderManifest((value as FrontierDomSerializedState).manifest);
}

function isRenderManifest(value: unknown): value is FrontierDomRenderManifestV1 {
  return value !== null &&
    typeof value === 'object' &&
    (value as FrontierDomRenderManifestV1).version === 1 &&
    Array.isArray((value as FrontierDomRenderManifestV1).bindings);
}

function isParentNodeLike(value: unknown): value is ParentNode {
  return value !== null &&
    typeof value === 'object' &&
    typeof (value as ParentNode).querySelectorAll === 'function' &&
    typeof (value as Node).nodeType === 'number';
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
  if (entries.length !== 0 && container.firstChild === null) {
    const doc = entries[0].node.ownerDocument ?? readGlobalDocument();
    const fragment = doc.createDocumentFragment();
    for (let i = 0; i < entries.length; i++) fragment.appendChild(entries[i].node);
    container.appendChild(fragment);
    return;
  }
  const focused = captureFocusedElement(container);
  let anchor: Node | null = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const node = entries[i].node;
    if (node.parentNode !== container || node.nextSibling !== anchor) {
      container.insertBefore(node, anchor);
    }
    anchor = node;
  }
  restoreFocusedElement(focused);
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
  if (container.firstChild === null) {
    const doc = entries[0]?.node.ownerDocument ?? spacers.before?.ownerDocument ?? spacers.after?.ownerDocument ?? readGlobalDocument();
    const fragment = doc.createDocumentFragment();
    if (spacers.enabled && spacers.before && spacers.after) {
      setSpacerSize(spacers.before, offsetBefore);
      setSpacerSize(spacers.after, offsetAfter);
      fragment.appendChild(spacers.before);
    }
    for (let i = 0; i < entries.length; i++) fragment.appendChild(entries[i].node);
    if (spacers.enabled && spacers.after) fragment.appendChild(spacers.after);
    container.appendChild(fragment);
    return;
  }
  const focused = captureFocusedElement(container);
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
  restoreFocusedElement(focused);
}

function captureFocusedElement(container: ParentNode): HTMLElement | SVGElement | null {
  const doc = (container as Node).ownerDocument ?? readGlobalDocument();
  const active = doc.activeElement;
  if (!active || !rootContains(container, active) || typeof (active as HTMLElement).focus !== 'function') return null;
  return active as HTMLElement | SVGElement;
}

function restoreFocusedElement(element: HTMLElement | SVGElement | null): void {
  if (!element || element.ownerDocument?.activeElement === element || !element.isConnected) return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
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
