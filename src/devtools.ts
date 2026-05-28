export interface FrontierDomDevtoolsTraceEvent {
  kind: string;
  bindingId?: number;
  bindingKind?: string;
  paths?: readonly (readonly (string | number)[])[];
  path?: readonly (string | number)[];
  patchItems?: number;
  report?: FrontierDomDevtoolsHydrationReport;
  source?: { expected?: unknown; actual?: unknown };
  [key: string]: unknown;
}

export interface FrontierDomDevtoolsManifestSource {
  kind?: string;
  basis?: number | string;
  heads?: readonly string[];
  stateVector?: Record<string, number>;
  [key: string]: unknown;
}

export interface FrontierDomDevtoolsHydrationReport {
  issues: readonly unknown[];
  reusedAnchors?: readonly string[];
  missingAnchors?: readonly string[];
  staleAnchors?: readonly string[];
  rematerializedAnchors?: readonly string[];
  source?: {
    expected?: unknown;
    actual?: unknown;
  };
  snapshotMatched?: boolean;
}

export interface FrontierDomDevtoolsSourceLike {
  get?(): unknown;
  getBasis?(): number | string | undefined;
  getHeads?(): readonly string[] | undefined;
  getStateVector?(): Record<string, number> | undefined;
}

export interface FrontierDomDevtoolsRendererLike {
  readonly size?: number;
  readonly source?: FrontierDomDevtoolsSourceLike;
  getTrace(): readonly FrontierDomDevtoolsTraceEvent[];
}

export interface FrontierDomDevtoolsAppLike {
  readonly renderer: FrontierDomDevtoolsRendererLike | null;
  readonly hydrationReport: FrontierDomDevtoolsHydrationReport | null;
  readonly source?: FrontierDomDevtoolsSourceLike;
}

export interface FrontierDomDevtoolsSummary {
  traceCount: number;
  patchCount: number;
  dirtyBindingCount: number;
  domWriteCount: number;
  virtualRangeCount: number;
  actionCount: number;
  hydrationIssueCount: number;
}

export interface FrontierDomDevtoolsBindingState {
  bindingId: number;
  bindingKind: string;
  active: boolean;
  paths: string[];
  dirtyCount: number;
  lastPatchItems?: number;
}

export interface FrontierDomDevtoolsIndexedEvent {
  index: number;
  event: FrontierDomDevtoolsTraceEvent;
}

export interface FrontierDomDevtoolsActionRecord {
  source: 'trace' | 'registry';
  index: number;
  id?: string;
  actionId?: string;
  causeId?: string;
  event?: string;
  manifestBindingId?: string;
  input?: unknown;
  reads?: unknown;
  writes?: unknown;
  patch?: unknown;
  affected?: unknown;
  metadata?: unknown;
  status?: unknown;
  durationMs?: unknown;
  record?: unknown;
}

export interface FrontierDomDevtoolsSourceState {
  basis?: number | string;
  heads?: readonly string[];
  stateVector?: Record<string, number>;
  snapshot?: unknown;
}

export interface FrontierDomDevtoolsSnapshot {
  kind: 'frontier.dom.devtools';
  version: 1;
  generatedAt?: number;
  size?: number;
  trace: FrontierDomDevtoolsTraceEvent[];
  patchStream: FrontierDomDevtoolsIndexedEvent[];
  dirtyBindings: FrontierDomDevtoolsBindingState[];
  domWrites: FrontierDomDevtoolsIndexedEvent[];
  virtualRanges: FrontierDomDevtoolsIndexedEvent[];
  actionProvenance: FrontierDomDevtoolsActionRecord[];
  hydration?: FrontierDomDevtoolsHydrationReport;
  hydrationSource?: { expected?: unknown; actual?: unknown };
  source?: FrontierDomDevtoolsSourceState;
  summary: FrontierDomDevtoolsSummary;
}

export interface FrontierDomActionRegistryDevtoolsLike {
  history?(): readonly unknown[];
}

export interface FrontierDomDevtoolsInspectOptions {
  trace?: readonly FrontierDomDevtoolsTraceEvent[];
  source?: FrontierDomDevtoolsSourceLike;
  hydrationReport?: FrontierDomDevtoolsHydrationReport | null;
  actionRegistry?: FrontierDomActionRegistryDevtoolsLike;
  includeStateSnapshot?: boolean;
  now?: () => number;
}

export interface FrontierDomDevtoolsOptions extends FrontierDomDevtoolsInspectOptions {
  limit?: number;
  renderer?: FrontierDomDevtoolsRendererLike | null;
  app?: FrontierDomDevtoolsAppLike | null;
}

export interface FrontierDomDevtoolsSink {
  (event: FrontierDomDevtoolsTraceEvent): void;
  snapshot(options?: FrontierDomDevtoolsInspectOptions): FrontierDomDevtoolsSnapshot;
  inspect(options?: FrontierDomDevtoolsInspectOptions): FrontierDomDevtoolsSnapshot;
  clear(): void;
  attachRenderer(renderer: FrontierDomDevtoolsRendererLike | null): void;
  attachApp(app: FrontierDomDevtoolsAppLike | null): void;
}

export type FrontierDomDevtoolsInspector = FrontierDomDevtoolsSink;

export function inspectDomRenderer(
  renderer: FrontierDomDevtoolsRendererLike,
  options: FrontierDomDevtoolsInspectOptions = {}
): FrontierDomDevtoolsSnapshot {
  return createSnapshot({
    ...options,
    renderer,
    source: options.source ?? renderer.source,
    trace: options.trace ?? renderer.getTrace()
  });
}

export function inspectDomApp(
  app: FrontierDomDevtoolsAppLike,
  options: FrontierDomDevtoolsInspectOptions = {}
): FrontierDomDevtoolsSnapshot {
  return createSnapshot({
    ...options,
    app,
    renderer: app.renderer,
    source: options.source ?? app.renderer?.source ?? app.source,
    hydrationReport: options.hydrationReport ?? app.hydrationReport,
    trace: options.trace ?? app.renderer?.getTrace() ?? []
  });
}

export function createDomDevtoolsInspector(options: FrontierDomDevtoolsOptions = {}): FrontierDomDevtoolsInspector {
  const limit = Math.max(1, options.limit ?? 2048);
  const trace: FrontierDomDevtoolsTraceEvent[] = [];
  let renderer = options.renderer ?? options.app?.renderer ?? null;
  let app = options.app ?? null;
  const sink = ((event: FrontierDomDevtoolsTraceEvent) => {
    trace[trace.length] = event;
    if (trace.length > limit) trace.splice(0, trace.length - limit);
  }) as FrontierDomDevtoolsInspector;
  sink.snapshot = (snapshotOptions = {}) => createSnapshot({
    ...options,
    ...snapshotOptions,
    app,
    renderer,
    source: snapshotOptions.source ?? options.source ?? renderer?.source ?? app?.source,
    hydrationReport: snapshotOptions.hydrationReport ?? options.hydrationReport ?? app?.hydrationReport ?? null,
    trace: mergeTrace(trace, snapshotOptions.trace ?? renderer?.getTrace())
  });
  sink.inspect = sink.snapshot;
  sink.clear = () => {
    trace.length = 0;
  };
  sink.attachRenderer = (next) => {
    renderer = next;
  };
  sink.attachApp = (next) => {
    app = next;
    renderer = next?.renderer ?? renderer;
  };
  return sink;
}

export const createDomDevtoolsSink = createDomDevtoolsInspector;

export function installDomDevtoolsGlobal(
  name: string,
  value: FrontierDomDevtoolsSink | FrontierDomDevtoolsSnapshot | FrontierDomDevtoolsRendererLike | FrontierDomDevtoolsAppLike
): void {
  const root = globalThis as unknown as Record<string, unknown>;
  if (typeof (value as FrontierDomDevtoolsSink).snapshot === 'function') root[name] = value;
  else if (typeof (value as FrontierDomDevtoolsAppLike).renderer !== 'undefined') {
    root[name] = inspectDomApp(value as FrontierDomDevtoolsAppLike);
  } else if (typeof (value as FrontierDomDevtoolsRendererLike).getTrace === 'function') {
    root[name] = inspectDomRenderer(value as FrontierDomDevtoolsRendererLike);
  } else {
    root[name] = value;
  }
}

function createSnapshot(options: FrontierDomDevtoolsOptions): FrontierDomDevtoolsSnapshot {
  const trace = (options.trace ?? options.renderer?.getTrace() ?? []).slice();
  const hydrationFromTrace = readHydrationFromTrace(trace);
  const hydration = options.hydrationReport ?? options.app?.hydrationReport ?? hydrationFromTrace?.report;
  const source = readSourceState(options.source ?? options.renderer?.source ?? options.app?.source, options.includeStateSnapshot === true);
  const actionProvenance = collectActionProvenance(trace, options.actionRegistry);
  const dirtyBindings = collectBindings(trace);
  const patchStream = collectTraceKind(trace, 'patch');
  const domWrites = collectTraceKind(trace, 'dom-write');
  const virtualRanges = collectTraceKind(trace, 'virtual-range');
  return {
    kind: 'frontier.dom.devtools',
    version: 1,
    generatedAt: options.now?.(),
    size: options.renderer?.size ?? options.app?.renderer?.size,
    trace,
    patchStream,
    dirtyBindings,
    domWrites,
    virtualRanges,
    actionProvenance,
    hydration: hydration ?? undefined,
    hydrationSource: hydration?.source ?? hydrationFromTrace?.source,
    source,
    summary: {
      traceCount: trace.length,
      patchCount: patchStream.length,
      dirtyBindingCount: dirtyBindings.filter((binding) => binding.dirtyCount > 0).length,
      domWriteCount: domWrites.length,
      virtualRangeCount: virtualRanges.length,
      actionCount: actionProvenance.length,
      hydrationIssueCount: hydration?.issues.length ?? 0
    }
  };
}

function collectBindings(trace: readonly FrontierDomDevtoolsTraceEvent[]): FrontierDomDevtoolsBindingState[] {
  const bindings = new Map<number, FrontierDomDevtoolsBindingState>();
  for (let index = 0; index < trace.length; index++) {
    const event = trace[index];
    if (typeof event.bindingId !== 'number') continue;
    let binding = bindings.get(event.bindingId);
    if (!binding) {
      binding = {
        bindingId: event.bindingId,
        bindingKind: String(event.bindingKind ?? 'unknown'),
        active: true,
        paths: [],
        dirtyCount: 0
      };
      bindings.set(event.bindingId, binding);
    }
    binding.bindingKind = String(event.bindingKind ?? binding.bindingKind);
    if (event.kind === 'binding-create') {
      binding.active = true;
      binding.paths = readPathList(event.paths);
    } else if (event.kind === 'binding-dirty') {
      binding.dirtyCount++;
      if (typeof event.patchItems === 'number') binding.lastPatchItems = event.patchItems;
      binding.paths = readPathList(event.paths, binding.paths);
    } else if (event.kind === 'patch') {
      binding.paths = readPathList(event.paths, binding.paths);
    } else if (event.kind === 'binding-dispose') {
      binding.active = false;
    }
  }
  return Array.from(bindings.values()).sort((left, right) => left.bindingId - right.bindingId);
}

function collectActionProvenance(
  trace: readonly FrontierDomDevtoolsTraceEvent[],
  actionRegistry: FrontierDomActionRegistryDevtoolsLike | undefined
): FrontierDomDevtoolsActionRecord[] {
  const out: FrontierDomDevtoolsActionRecord[] = [];
  for (let index = 0; index < trace.length; index++) {
    const event = trace[index];
    if (event.kind !== 'action-dispatch') continue;
    out[out.length] = {
      source: 'trace',
      index,
      actionId: readString(event.actionId),
      causeId: readString(event.causeId),
      event: readString(event.event),
      manifestBindingId: readString(event.manifestBindingId),
      input: event.input,
      reads: event.reads,
      writes: event.writes,
      affected: event.affected,
      metadata: event.metadata
    };
  }
  const history = actionRegistry?.history?.() ?? [];
  for (let index = 0; index < history.length; index++) out[out.length] = actionRecordFromHistory(history[index], index);
  return out;
}

function actionRecordFromHistory(record: unknown, index: number): FrontierDomDevtoolsActionRecord {
  if (record === null || typeof record !== 'object') return { source: 'registry', index, record };
  const value = record as Record<string, unknown>;
  return {
    source: 'registry',
    index,
    id: readString(value.id),
    actionId: readString(value.actionId),
    causeId: readString(value.causeId),
    input: value.input,
    reads: value.reads,
    writes: value.writes,
    patch: value.patch,
    affected: value.affected,
    metadata: value.metadata,
    status: value.status,
    durationMs: value.durationMs,
    record
  };
}

function readHydrationFromTrace(trace: readonly FrontierDomDevtoolsTraceEvent[]): FrontierDomDevtoolsTraceEvent | undefined {
  for (let i = trace.length - 1; i >= 0; i--) {
    const event = trace[i];
    if (event.kind === 'hydration') return event;
  }
  return undefined;
}

function readSourceState(source: FrontierDomDevtoolsSourceLike | undefined, includeSnapshot: boolean): FrontierDomDevtoolsSourceState | undefined {
  if (!source) return undefined;
  const state: FrontierDomDevtoolsSourceState = {};
  const basis = source.getBasis?.();
  if (basis !== undefined) state.basis = basis;
  const heads = source.getHeads?.();
  if (heads !== undefined) state.heads = heads.slice();
  const stateVector = source.getStateVector?.();
  if (stateVector !== undefined) state.stateVector = { ...stateVector };
  if (includeSnapshot) state.snapshot = source.get?.();
  return Object.keys(state).length === 0 ? undefined : state;
}

function mergeTrace(
  first: readonly FrontierDomDevtoolsTraceEvent[],
  second: readonly FrontierDomDevtoolsTraceEvent[] | undefined
): FrontierDomDevtoolsTraceEvent[] {
  if (!second || second.length === 0) return first.slice();
  if (first.length === 0) return second.slice();
  const seen = new Set<FrontierDomDevtoolsTraceEvent>(first);
  const out = first.slice();
  for (let i = 0; i < second.length; i++) {
    const event = second[i];
    if (seen.has(event)) continue;
    seen.add(event);
    out[out.length] = event;
  }
  return out;
}

function collectTraceKind(trace: readonly FrontierDomDevtoolsTraceEvent[], kind: string): FrontierDomDevtoolsIndexedEvent[] {
  const out: FrontierDomDevtoolsIndexedEvent[] = [];
  for (let index = 0; index < trace.length; index++) {
    const event = trace[index];
    if (event.kind === kind) out[out.length] = { index, event };
  }
  return out;
}

function readPathList(paths: readonly (readonly (string | number)[])[] | undefined, fallback: string[] = []): string[] {
  if (!paths) return fallback;
  const out = new Array<string>(paths.length);
  for (let i = 0; i < paths.length; i++) out[i] = pathToPointer(paths[i]);
  return out;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function pathToPointer(path: readonly (string | number)[]): string {
  if (path.length === 0) return '';
  let out = '';
  for (let i = 0; i < path.length; i++) out += '/' + String(path[i]).replace(/~/g, '~0').replace(/\//g, '~1');
  return out;
}
