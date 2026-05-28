import type {
  FrontierDomEachManifestBinding,
  FrontierDomFormManifestBinding,
  FrontierDomManifestBinding,
  FrontierDomManifestSource,
  FrontierDomRenderManifestV1,
  FrontierDomVirtualEachManifestBinding,
  FrontierDomVirtualLayoutManifest,
  FrontierDomWhenManifestBinding
} from './index.js';
import type { WatchPath } from '@shapeshift-labs/frontier-state';

export const Fragment = Symbol.for('frontier.dom.fragment');
const FRONTIER_JSX_MARKER = Symbol.for('frontier.dom.jsx.marker');
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg',
  'circle',
  'clipPath',
  'defs',
  'ellipse',
  'g',
  'image',
  'line',
  'linearGradient',
  'mask',
  'path',
  'pattern',
  'polygon',
  'polyline',
  'radialGradient',
  'rect',
  'stop',
  'symbol',
  'text',
  'tspan',
  'use'
]);

export interface FrontierJsxManifestOptions {
  source?: FrontierDomManifestSource;
  root?: { anchor?: string; selector?: string };
}

export type FrontierJsxProps = Record<string, unknown> & {
  children?: unknown;
  frId?: string;
  $text?: WatchPath;
  $attr?: Record<string, WatchPath>;
  $prop?: Record<string, WatchPath>;
  $class?: Record<string, WatchPath>;
  $style?: Record<string, WatchPath>;
  $on?: Record<string, string>;
  $form?: Omit<FrontierDomFormManifestBinding, 'id' | 'kind' | 'target'>;
  $when?: Omit<FrontierDomWhenManifestBinding, 'id' | 'kind' | 'target'>;
  $each?: Omit<FrontierDomEachManifestBinding, 'id' | 'kind' | 'container'>;
  $virtualEach?: Omit<FrontierDomVirtualEachManifestBinding, 'id' | 'kind' | 'container'>;
};

export interface FrontierJsxTextBinding {
  readonly [FRONTIER_JSX_MARKER]: 'text';
  path: WatchPath;
  as?: string;
  frId?: string;
}

export interface FrontierJsxEachBinding {
  readonly [FRONTIER_JSX_MARKER]: 'each';
  path: WatchPath;
  keyBy?: string | number;
  fields?: WatchPath[];
  template: string;
  keyAttribute?: string;
  as?: string;
  frId?: string;
}

export interface FrontierJsxVirtualEachBinding {
  readonly [FRONTIER_JSX_MARKER]: 'virtualEach';
  path: WatchPath;
  keyBy?: string | number;
  fields?: WatchPath[];
  template: string;
  layout: FrontierDomVirtualLayoutManifest;
  viewport?: FrontierDomVirtualEachManifestBinding['viewport'];
  overscan?: number;
  overscanPx?: number;
  as?: string;
  frId?: string;
}

export interface FrontierJsxWhenBinding {
  readonly [FRONTIER_JSX_MARKER]: 'when';
  path: WatchPath;
  template: string;
  fallbackTemplate?: string;
  as?: string;
  frId?: string;
}

export function text(path: WatchPath, options: { as?: string; frId?: string } = {}): FrontierJsxTextBinding {
  return {
    [FRONTIER_JSX_MARKER]: 'text',
    path,
    as: options.as,
    frId: options.frId
  };
}

export function when(
  path: WatchPath,
  options: Omit<FrontierJsxWhenBinding, typeof FRONTIER_JSX_MARKER | 'path'>
): FrontierJsxWhenBinding {
  return {
    [FRONTIER_JSX_MARKER]: 'when',
    path,
    ...options
  };
}

export function each(
  path: WatchPath,
  options: Omit<FrontierJsxEachBinding, typeof FRONTIER_JSX_MARKER | 'path'>
): FrontierJsxEachBinding {
  return {
    [FRONTIER_JSX_MARKER]: 'each',
    path,
    ...options
  };
}

export function virtualEach(
  path: WatchPath,
  options: Omit<FrontierJsxVirtualEachBinding, typeof FRONTIER_JSX_MARKER | 'path'>
): FrontierJsxVirtualEachBinding {
  return {
    [FRONTIER_JSX_MARKER]: 'virtualEach',
    path,
    ...options
  };
}

export function textLayout(options: Omit<Extract<FrontierDomVirtualLayoutManifest, { kind: 'text' }>, 'kind'>): FrontierDomVirtualLayoutManifest {
  return { kind: 'text', ...options };
}

export function fixedLayout(itemSize: number): FrontierDomVirtualLayoutManifest {
  return { kind: 'fixed', itemSize };
}

export function variableLayout(defaultSize: number): FrontierDomVirtualLayoutManifest {
  return { kind: 'variable', defaultSize };
}

export function jsx(type: string | typeof Fragment | ((props: FrontierJsxProps) => Node), props: FrontierJsxProps = {}): Node {
  return createJsxNode(type, props);
}

export const jsxs = jsx;
export const jsxDEV = jsx;

export function createJsxManifest(root: ParentNode, options: FrontierJsxManifestOptions = {}): FrontierDomRenderManifestV1 {
  const bindings: FrontierDomManifestBinding[] = [];
  let nextId = 1;
  visitElements(root, (element) => {
    const anchor = ensureAnchor(element, nextId);
    if (anchor.indexOf('fr-auto-') === 0) nextId++;
    const target = { anchor };
    const text = element.getAttribute('data-frontier-text');
    if (text !== null) {
      bindings[bindings.length] = {
        id: 'b:' + anchor + ':text',
        kind: 'text',
        path: text,
        target
      };
    }
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.indexOf('data-frontier-attr-') === 0) {
        const name = attr.name.slice('data-frontier-attr-'.length);
        bindings[bindings.length] = {
          id: 'b:' + anchor + ':attr:' + name,
          kind: 'attr',
          path: attr.value,
          target,
          name
        };
      } else if (attr.name.indexOf('data-frontier-prop-') === 0) {
        const name = attr.name.slice('data-frontier-prop-'.length);
        bindings[bindings.length] = {
          id: 'b:' + anchor + ':prop:' + name,
          kind: 'prop',
          path: attr.value,
          target,
          name
        };
      } else if (attr.name.indexOf('data-frontier-class-') === 0) {
        const name = attr.name.slice('data-frontier-class-'.length);
        bindings[bindings.length] = {
          id: 'b:' + anchor + ':class:' + name,
          kind: 'class',
          path: attr.value,
          target,
          name
        };
      } else if (attr.name.indexOf('data-frontier-style-') === 0) {
        const name = attr.name.slice('data-frontier-style-'.length);
        bindings[bindings.length] = {
          id: 'b:' + anchor + ':style:' + name,
          kind: 'style',
          path: attr.value,
          target,
          name
        };
      } else if (attr.name.indexOf('data-frontier-on-') === 0) {
        const event = attr.name.slice('data-frontier-on-'.length);
        bindings[bindings.length] = {
          id: 'b:' + anchor + ':event:' + event,
          kind: 'event',
          target,
          event,
          action: attr.value
        };
      }
    }
    const each = element.getAttribute('data-frontier-each');
    if (each !== null) {
      const spec = JSON.parse(each) as Omit<FrontierDomEachManifestBinding, 'id' | 'kind' | 'container'>;
      bindings[bindings.length] = {
        id: 'b:' + anchor + ':each',
        kind: 'each',
        path: spec.path,
        container: target,
        fields: spec.fields,
        keyBy: spec.keyBy,
        keyAttribute: spec.keyAttribute,
        template: spec.template
      };
    }
    const virtualEach = element.getAttribute('data-frontier-virtual-each');
    if (virtualEach !== null) {
      const spec = JSON.parse(virtualEach) as Omit<FrontierDomVirtualEachManifestBinding, 'id' | 'kind' | 'container'>;
      bindings[bindings.length] = {
        id: 'b:' + anchor + ':virtual-each',
        kind: 'virtualEach',
        path: spec.path,
        container: target,
        fields: spec.fields,
        keyBy: spec.keyBy,
        keyAttribute: spec.keyAttribute,
        template: spec.template,
        viewport: spec.viewport,
        layout: spec.layout,
        overscan: spec.overscan,
        overscanPx: spec.overscanPx
      };
    }
    const form = element.getAttribute('data-frontier-form');
    if (form !== null) {
      const spec = JSON.parse(form) as Omit<FrontierDomFormManifestBinding, 'id' | 'kind' | 'target'>;
      bindings[bindings.length] = {
        id: 'b:' + anchor + ':form',
        kind: 'form',
        path: spec.path,
        target,
        prop: spec.prop,
        event: spec.event,
        format: spec.format
      };
    }
    const when = element.getAttribute('data-frontier-when');
    if (when !== null) {
      const spec = JSON.parse(when) as Omit<FrontierDomWhenManifestBinding, 'id' | 'kind' | 'target'>;
      bindings[bindings.length] = {
        id: 'b:' + anchor + ':when',
        kind: 'when',
        path: spec.path,
        target,
        template: spec.template,
        fallbackTemplate: spec.fallbackTemplate
      };
    }
  });
  return {
    version: 1,
    root: options.root,
    source: options.source,
    bindings
  };
}

export const manifestFromDom = createJsxManifest;

function createJsxNode(type: string | typeof Fragment | ((props: FrontierJsxProps) => Node), props: FrontierJsxProps): Node {
  if (typeof type === 'function') return type(props);
  const doc = readDocument();
  const node = type === Fragment
    ? doc.createDocumentFragment()
    : SVG_TAGS.has(type)
      ? doc.createElementNS(SVG_NAMESPACE, type)
      : doc.createElement(type);
  applyProps(node, props);
  appendChildren(node, props.children);
  return node;
}

function applyProps(node: Node, props: FrontierJsxProps): void {
  if (!isElement(node)) return;
  for (const key of Object.keys(props)) {
    const value = props[key];
    if (key === 'children' || key === 'key' || key === 'ref') continue;
    if (key === 'frId') {
      if (value !== undefined && value !== null) node.setAttribute('data-frontier-id', String(value));
      continue;
    }
    if (key === '$text') {
      node.setAttribute('data-frontier-text', String(value));
      continue;
    }
    if (key === '$attr' || key === '$prop' || key === '$class' || key === '$style' || key === '$on') {
      writeFrontierMapProps(node, key, value);
      continue;
    }
    if (key === '$each') {
      node.setAttribute('data-frontier-each', JSON.stringify(value));
      continue;
    }
    if (key === '$virtualEach') {
      node.setAttribute('data-frontier-virtual-each', JSON.stringify(value));
      continue;
    }
    if (key === '$form') {
      node.setAttribute('data-frontier-form', JSON.stringify(value));
      continue;
    }
    if (key === '$when') {
      node.setAttribute('data-frontier-when', JSON.stringify(value));
      continue;
    }
    if (key === 'className') {
      if (value !== undefined && value !== null) node.setAttribute('class', String(value));
      continue;
    }
    if (key === 'style' && value !== null && typeof value === 'object') {
      for (const styleName of Object.keys(value as Record<string, unknown>)) {
        const styleValue = (value as Record<string, unknown>)[styleName];
        if (styleValue !== undefined && styleValue !== null) (node as HTMLElement).style.setProperty(styleName, String(styleValue));
      }
      continue;
    }
    if (key.length > 2 && key[0] === 'o' && key[1] === 'n' && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      continue;
    }
    if (value === false || value === null || value === undefined) continue;
    if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
}

function writeFrontierMapProps(element: Element, key: string, value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  const prefix =
    key === '$attr' ? 'data-frontier-attr-' :
    key === '$prop' ? 'data-frontier-prop-' :
    key === '$class' ? 'data-frontier-class-' :
    key === '$style' ? 'data-frontier-style-' :
    'data-frontier-on-';
  for (const name of Object.keys(value as Record<string, unknown>)) {
    const path = (value as Record<string, unknown>)[name];
    if (path !== undefined && path !== null) element.setAttribute(prefix + name, String(path));
  }
}

function appendChildren(parent: Node, children: unknown): void {
  if (children === undefined || children === null || children === false) return;
  if (Array.isArray(children)) {
    for (let i = 0; i < children.length; i++) appendChildren(parent, children[i]);
    return;
  }
  if (isFrontierJsxTextBinding(children)) {
    parent.appendChild(jsx(children.as ?? 'span', { frId: children.frId, $text: children.path }));
    return;
  }
  if (isFrontierJsxEachBinding(children)) {
    parent.appendChild(jsx(children.as ?? 'div', {
      frId: children.frId,
      $each: {
        path: children.path,
        fields: children.fields,
        keyBy: children.keyBy,
        keyAttribute: children.keyAttribute,
        template: children.template
      }
    }));
    return;
  }
  if (isFrontierJsxVirtualEachBinding(children)) {
    parent.appendChild(jsx(children.as ?? 'div', {
      frId: children.frId,
      $virtualEach: {
        path: children.path,
        fields: children.fields,
        keyBy: children.keyBy,
        template: children.template,
        viewport: children.viewport,
        layout: children.layout,
        overscan: children.overscan,
        overscanPx: children.overscanPx
      }
    }));
    return;
  }
  if (isFrontierJsxWhenBinding(children)) {
    parent.appendChild(jsx(children.as ?? 'span', {
      frId: children.frId,
      $when: {
        path: children.path,
        template: children.template,
        fallbackTemplate: children.fallbackTemplate
      }
    }));
    return;
  }
  if (isNode(children)) {
    parent.appendChild(children);
    return;
  }
  parent.appendChild(readDocument().createTextNode(String(children)));
}

function isFrontierJsxTextBinding(value: unknown): value is FrontierJsxTextBinding {
  return value !== null && typeof value === 'object' && (value as FrontierJsxTextBinding)[FRONTIER_JSX_MARKER] === 'text';
}

function isFrontierJsxEachBinding(value: unknown): value is FrontierJsxEachBinding {
  return value !== null && typeof value === 'object' && (value as FrontierJsxEachBinding)[FRONTIER_JSX_MARKER] === 'each';
}

function isFrontierJsxVirtualEachBinding(value: unknown): value is FrontierJsxVirtualEachBinding {
  return value !== null && typeof value === 'object' && (value as FrontierJsxVirtualEachBinding)[FRONTIER_JSX_MARKER] === 'virtualEach';
}

function isFrontierJsxWhenBinding(value: unknown): value is FrontierJsxWhenBinding {
  return value !== null && typeof value === 'object' && (value as FrontierJsxWhenBinding)[FRONTIER_JSX_MARKER] === 'when';
}

function visitElements(root: ParentNode, callback: (element: Element) => void): void {
  if (isElement(root)) callback(root);
  const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];
  for (let i = 0; i < elements.length; i++) callback(elements[i]);
}

function ensureAnchor(element: Element, nextId: number): string {
  const existing = element.getAttribute('data-frontier-id');
  if (existing) return existing;
  const generated = 'fr-auto-' + nextId;
  element.setAttribute('data-frontier-id', generated);
  return generated;
}

function readDocument(): Document {
  const doc = (globalThis as any).document;
  if (!doc) throw new TypeError('frontier-dom JSX runtime requires global document');
  return doc;
}

function isElement(value: unknown): value is Element {
  return value !== null && typeof value === 'object' && (value as Node).nodeType === 1;
}

function isNode(value: unknown): value is Node {
  return value !== null && typeof value === 'object' && typeof (value as Node).nodeType === 'number';
}

export namespace JSX {
  export type Element = Node;
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicElements {
    [element: string]: FrontierJsxProps;
  }
}
