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
  const base: Record<string, any> = {};
  if ('bindingId' in event) base.bindingId = event.bindingId;
  if ('bindingKind' in event) base.bindingKind = event.bindingKind;
  if (event.kind === 'binding-create') {
    base.pathCount = event.paths.length;
    base.paths = event.paths.map((path) => '/' + path.map(String).join('/'));
  } else if (event.kind === 'binding-dirty') {
    base.patchItems = event.patchItems;
    if (event.paths) base.paths = event.paths.map((path) => '/' + path.map(String).join('/'));
  } else if (event.kind === 'dom-write' || event.kind === 'effect-run') {
    base.path = '/' + event.path.map(String).join('/');
  } else if (event.kind === 'patch') {
    base.phase = event.phase;
    base.patchItems = event.patchItems;
    base.actionId = event.actionId;
    base.causeId = event.causeId;
    if (event.paths) base.paths = event.paths.map((path) => '/' + path.map(String).join('/'));
  } else if (event.kind === 'action-dispatch') {
    base.actionId = event.actionId;
    base.causeId = event.causeId;
    base.manifestBindingId = event.manifestBindingId;
    base.event = event.event;
    base.readCount = event.reads?.length ?? 0;
    base.writeCount = event.writes?.length ?? 0;
    base.affectedCount = event.affected?.length ?? 0;
  } else if (event.kind === 'virtual-range') {
    base.startIndex = event.startIndex;
    base.endIndex = event.endIndex;
    base.totalItems = event.totalItems;
    base.totalSize = event.totalSize;
  } else if (event.kind === 'hydration') {
    base.issueCount = event.report.issues.length;
    base.snapshotMatched = event.report.snapshotMatched;
  }
  return base;
}
