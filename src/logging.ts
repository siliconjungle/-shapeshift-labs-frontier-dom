import type { FrontierLogger, LogLevelInput } from '@shapeshift-labs/frontier-logging';
import type { FrontierDomTraceEvent, FrontierDomTraceSink } from './index.js';

export interface FrontierDomLogSinkOptions {
  level?: LogLevelInput;
  namePrefix?: string;
}

export function createRenderLogSink(
  logger: FrontierLogger,
  options: FrontierDomLogSinkOptions = {}
): FrontierDomTraceSink {
  const level = options.level ?? 'debug';
  const prefix = options.namePrefix ?? 'frontier.dom';
  return (event) => {
    if (!logger.isEnabled(level)) return;
    logger.record(level, prefix + '.' + event.kind, {
      attributes: traceEventAttributes(event)
    });
  };
}

function traceEventAttributes(event: FrontierDomTraceEvent): Record<string, any> {
  const base: Record<string, any> = {
    bindingId: event.bindingId,
    bindingKind: event.bindingKind
  };
  if (event.kind === 'binding-create') {
    base.pathCount = event.paths.length;
    base.paths = event.paths.map((path) => '/' + path.map(String).join('/'));
  } else if (event.kind === 'binding-dirty') {
    base.patchItems = event.patchItems;
  } else if (event.kind === 'dom-write' || event.kind === 'effect-run') {
    base.path = '/' + event.path.map(String).join('/');
  }
  return base;
}
