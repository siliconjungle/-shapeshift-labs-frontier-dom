import type {
  FrontierDomManifestSource,
  FrontierDomRenderManifestV1,
  FrontierDomSerializationSource,
  FrontierDomSerializedState,
} from './manifest.js';
import type { JsonValue } from '@shapeshift-labs/frontier-state';
import { serializeDomState } from './manifest.js';

export interface FrontierDomHydrationScriptOptions {
  id?: string;
  nonce?: string;
  assignTo?: string;
}

export interface FrontierDomSsrChunk {
  kind: 'frontier.dom.ssr.chunk';
  html: string;
}

export function createHydrationBasisEnvelope(input: {
  manifest: FrontierDomRenderManifestV1;
  source?: FrontierDomSerializationSource;
  sourceMetadata?: FrontierDomManifestSource;
}): FrontierDomManifestSource | undefined {
  const source: FrontierDomManifestSource = {
    ...(input.manifest.source ?? {}),
    ...(input.sourceMetadata ?? {})
  };
  if (input.source?.getBasis) source.basis = input.source.getBasis();
  return Object.keys(source).length === 0 ? undefined : source;
}

export function renderDomHydrationScript(
  state: FrontierDomSerializedState,
  options: FrontierDomHydrationScriptOptions = {}
): string {
  const json = escapeScriptJson(JSON.stringify(state));
  const id = options.id ? ' id="' + escapeHtmlAttribute(options.id) + '"' : '';
  const nonce = options.nonce ? ' nonce="' + escapeHtmlAttribute(options.nonce) + '"' : '';
  if (options.assignTo) {
    return '<script type="application/json"' + id + nonce + ' data-frontier-dom-state="' + escapeHtmlAttribute(options.assignTo) + '">' + json + '</script>';
  }
  return '<script type="application/json"' + id + nonce + ' data-frontier-dom-state>' + json + '</script>';
}

export function renderDomStateScript(input: {
  manifest: FrontierDomRenderManifestV1;
  source?: FrontierDomSerializationSource;
  sourceMetadata?: FrontierDomManifestSource;
  snapshot?: JsonValue;
  includeSnapshot?: boolean;
}, options: FrontierDomHydrationScriptOptions = {}): string {
  return renderDomHydrationScript(serializeDomState(input), options);
}

export function* streamDomHydrationScript(
  state: FrontierDomSerializedState,
  options: FrontierDomHydrationScriptOptions = {}
): Iterable<FrontierDomSsrChunk> {
  yield { kind: 'frontier.dom.ssr.chunk', html: renderDomHydrationScript(state, options) };
}

export function parseDomHydrationScript(element: Element): FrontierDomSerializedState {
  if (element.textContent === null) throw new TypeError('frontier-dom hydration script is empty');
  return JSON.parse(element.textContent) as FrontierDomSerializedState;
}

function escapeScriptJson(value: string): string {
  return value
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
