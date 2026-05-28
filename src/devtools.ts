import type { FrontierDomRenderer, FrontierDomTraceEvent } from './index.js';

export interface FrontierDomDevtoolsSnapshot {
  kind: 'frontier.dom.devtools';
  version: 1;
  size?: number;
  trace: FrontierDomTraceEvent[];
}

export interface FrontierDomDevtoolsSink {
  (event: FrontierDomTraceEvent): void;
  snapshot(): FrontierDomDevtoolsSnapshot;
  clear(): void;
}

export interface FrontierDomDevtoolsOptions {
  limit?: number;
}

export function inspectDomRenderer(
  renderer: Pick<FrontierDomRenderer, 'size' | 'getTrace'>
): FrontierDomDevtoolsSnapshot {
  return {
    kind: 'frontier.dom.devtools',
    version: 1,
    size: renderer.size,
    trace: renderer.getTrace()
  };
}

export function createDomDevtoolsSink(options: FrontierDomDevtoolsOptions = {}): FrontierDomDevtoolsSink {
  const limit = Math.max(1, options.limit ?? 2048);
  const trace: FrontierDomTraceEvent[] = [];
  const sink = ((event: FrontierDomTraceEvent) => {
    trace[trace.length] = event;
    if (trace.length > limit) trace.splice(0, trace.length - limit);
  }) as FrontierDomDevtoolsSink;
  sink.snapshot = () => ({
    kind: 'frontier.dom.devtools',
    version: 1,
    trace: trace.slice()
  });
  sink.clear = () => {
    trace.length = 0;
  };
  return sink;
}

export function installDomDevtoolsGlobal(
  name: string,
  value: FrontierDomDevtoolsSink | FrontierDomDevtoolsSnapshot | Pick<FrontierDomRenderer, 'size' | 'getTrace'>
): void {
  const root = globalThis as unknown as Record<string, unknown>;
  if (typeof (value as FrontierDomDevtoolsSink).snapshot === 'function') root[name] = value;
  else if (typeof (value as Pick<FrontierDomRenderer, 'getTrace'>).getTrace === 'function') {
    root[name] = inspectDomRenderer(value as Pick<FrontierDomRenderer, 'size' | 'getTrace'>);
  } else {
    root[name] = value;
  }
}
