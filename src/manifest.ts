import { serializeLayoutState } from '@shapeshift-labs/frontier-virtual';
import type { JsonValue, WatchOptions, WatchPath } from '@shapeshift-labs/frontier-state';
import type {
  FrontierTextLayoutOptions,
  FrontierVirtualLayoutProvider,
  FrontierVirtualSerializedLayoutState,
  FrontierVirtualViewport
} from '@shapeshift-labs/frontier-virtual';

export type FrontierDomManifestVersion = 1;

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

export interface FrontierDomSerializableEventOptions {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
}

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

export interface FrontierDomSerializationSource {
  get(): JsonValue | undefined;
  getBasis?(): number | string | undefined;
}

export interface FrontierDomSerializedState {
  kind: 'frontier.dom.state';
  version: FrontierDomManifestVersion;
  manifest: FrontierDomRenderManifestV1;
  source?: FrontierDomManifestSource;
  snapshot?: JsonValue;
  layout?: FrontierVirtualSerializedLayoutState[];
}

export function serializeDomState(input: {
  manifest: FrontierDomRenderManifestV1;
  source?: FrontierDomSerializationSource;
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
