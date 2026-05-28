import type * as tsType from 'typescript';
import type {
  FrontierDomAttributeManifestBinding,
  FrontierDomClassManifestBinding,
  FrontierDomEachManifestBinding,
  FrontierDomEventManifestBinding,
  FrontierDomFormManifestBinding,
  FrontierDomManifestBinding,
  FrontierDomManifestSource,
  FrontierDomNodeTarget,
  FrontierDomPropertyManifestBinding,
  FrontierDomRenderManifestV1,
  FrontierDomStyleManifestBinding,
  FrontierDomTextManifestBinding,
  FrontierDomVirtualEachManifestBinding,
  FrontierDomVirtualLayoutManifest,
  FrontierDomWhenManifestBinding
} from './index.js';
import type { WatchPath } from '@shapeshift-labs/frontier-state';

type TypeScriptModule = typeof tsType;
type TsNode = tsType.Node;
type TsExpression = tsType.Expression;
type TsJsxAttribute = tsType.JsxAttribute;
type TsJsxRoot = tsType.JsxElement | tsType.JsxSelfClosingElement | tsType.JsxFragment;

export type FrontierJsxCompileDiagnosticSeverity = 'error' | 'warning';

export interface FrontierJsxCompileDiagnostic {
  severity: FrontierJsxCompileDiagnosticSeverity;
  message: string;
  code?: string;
  start?: number;
  length?: number;
}

export interface FrontierJsxCompileOptions {
  fileName?: string;
  entry?: string;
  root?: FrontierDomNodeTarget;
  source?: FrontierDomManifestSource;
}

export interface FrontierJsxCompileResult {
  html: string;
  manifest: FrontierDomRenderManifestV1;
  diagnostics: FrontierJsxCompileDiagnostic[];
}

interface StaticElementCompileResult {
  html: string;
  anchor?: string;
  hasFrontierBindings: boolean;
}

interface FrontierAttributeState {
  anchor?: string;
  staticAttributes: Array<[string, unknown]>;
  text?: WatchPath;
  attr?: Record<string, WatchPath>;
  prop?: Record<string, WatchPath>;
  classMap?: Record<string, WatchPath>;
  styleMap?: Record<string, WatchPath>;
  on?: Record<string, string>;
  form?: Partial<FrontierDomFormManifestBinding> & { path?: WatchPath };
  when?: Partial<FrontierDomWhenManifestBinding> & { path?: WatchPath; template?: string };
  each?: Partial<FrontierDomEachManifestBinding> & { path?: WatchPath; template?: string };
  virtualEach?: Partial<FrontierDomVirtualEachManifestBinding> & {
    path?: WatchPath;
    template?: string;
    layout?: FrontierDomVirtualLayoutManifest;
  };
}

interface FrontierComponentDefinition {
  name: string;
  node: TsJsxRoot;
  declaration: TsNode;
}

export async function compileFrontierJsx(
  sourceText: string,
  options: FrontierJsxCompileOptions = {}
): Promise<FrontierJsxCompileResult> {
  const ts = await loadTypeScript();
  const fileName = options.fileName ?? 'frontier-view.tsx';
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const compiler = new FrontierJsxCompiler(ts, sourceFile, options);
  return compiler.compile();
}

async function loadTypeScript(): Promise<TypeScriptModule> {
  try {
    return await import('typescript');
  } catch (error) {
    throw new TypeError(
      'frontier-dom/compiler requires the optional "typescript" peer dependency to compile TSX sources',
      { cause: error }
    );
  }
}

class FrontierJsxCompiler {
  private bindings: FrontierDomManifestBinding[] = [];
  private diagnostics: FrontierJsxCompileDiagnostic[] = [];
  private components = new Map<string, FrontierComponentDefinition>();
  private componentStack: string[] = [];
  private nextAutoId = 1;

  constructor(
    private readonly ts: TypeScriptModule,
    private readonly sourceFile: tsType.SourceFile,
    private readonly options: FrontierJsxCompileOptions
  ) {}

  compile(): FrontierJsxCompileResult {
    this.collectComponents();
    const root = this.findRootJsx();
    if (!root) {
      this.report('error', 'No JSX root expression was found', this.sourceFile, 'FRONTIER_JSX_NO_ROOT');
      return this.result('');
    }
    return this.result(this.compileNode(root));
  }

  private result(html: string): FrontierJsxCompileResult {
    return {
      html,
      manifest: {
        version: 1,
        root: this.options.root,
        source: this.options.source,
        bindings: this.bindings
      },
      diagnostics: this.diagnostics
    };
  }

  private collectComponents(): void {
    for (const statement of this.sourceFile.statements) {
      if (this.ts.isFunctionDeclaration(statement) && statement.name && isComponentName(statement.name.text)) {
        const node = statement.body ? this.findReturnJsx(statement.body) : null;
        if (node) this.components.set(statement.name.text, { name: statement.name.text, node, declaration: statement });
        continue;
      }
      if (!this.ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!this.ts.isIdentifier(declaration.name) || !isComponentName(declaration.name.text)) continue;
        const node = this.findInitializerComponentJsx(declaration.initializer);
        if (node) this.components.set(declaration.name.text, { name: declaration.name.text, node, declaration });
      }
    }
  }

  private findRootJsx(): TsNode | null {
    if (this.options.entry) {
      const entry = this.findNamedEntry(this.options.entry);
      if (entry) return entry;
      this.report('error', 'Frontier JSX entry was not found: ' + this.options.entry, this.sourceFile, 'FRONTIER_JSX_ENTRY_NOT_FOUND');
      return null;
    }

    for (const name of ['view', 'View', 'app', 'App']) {
      const entry = this.findNamedEntry(name);
      if (entry) return entry;
    }

    const defaultExport = this.findDefaultExportJsx();
    if (defaultExport) return defaultExport;

    const topLevel = this.findTopLevelJsx();
    if (topLevel) return topLevel;

    if (this.components.size === 1) return Array.from(this.components.values())[0].node;
    return null;
  }

  private findNamedEntry(name: string): TsNode | null {
    const component = this.components.get(name);
    if (component) return component.node;
    for (const statement of this.sourceFile.statements) {
      if (!this.ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!this.ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
        const entry = this.tryReadJsxFromExpression(declaration.initializer);
        if (entry) return entry;
      }
    }
    return null;
  }

  private findDefaultExportJsx(): TsNode | null {
    for (const statement of this.sourceFile.statements) {
      if (!this.ts.isExportAssignment(statement)) continue;
      const entry = this.tryReadJsxFromExpression(statement.expression);
      if (entry) return entry;
      if (this.ts.isIdentifier(statement.expression)) {
        const component = this.components.get(statement.expression.text);
        if (component) return component.node;
      }
    }
    return null;
  }

  private findTopLevelJsx(): TsNode | null {
    for (const statement of this.sourceFile.statements) {
      if (this.ts.isExpressionStatement(statement)) {
        const entry = this.tryReadJsxFromExpression(statement.expression);
        if (entry) return entry;
      } else if (this.ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (this.ts.isIdentifier(declaration.name) && isComponentName(declaration.name.text)) continue;
          const entry = this.tryReadJsxFromExpression(declaration.initializer);
          if (entry) return entry;
        }
      }
    }
    return null;
  }

  private findInitializerComponentJsx(initializer: TsExpression | undefined): TsJsxRoot | null {
    if (!initializer) return null;
    if (this.ts.isArrowFunction(initializer)) {
      if (this.ts.isBlock(initializer.body)) return this.findReturnJsx(initializer.body);
      return this.tryReadJsxFromExpression(initializer.body as TsExpression);
    }
    if (this.ts.isFunctionExpression(initializer)) {
      return initializer.body ? this.findReturnJsx(initializer.body) : null;
    }
    return null;
  }

  private findReturnJsx(body: tsType.Block): TsJsxRoot | null {
    for (const statement of body.statements) {
      if (!this.ts.isReturnStatement(statement)) continue;
      const entry = this.tryReadJsxFromExpression(statement.expression);
      if (entry) return entry;
    }
    return null;
  }

  private tryReadJsxFromExpression(expression: TsExpression | undefined): TsJsxRoot | null {
    let current = expression;
    while (current && this.ts.isParenthesizedExpression(current)) current = current.expression;
    if (!current) return null;
    if (this.ts.isJsxElement(current) || this.ts.isJsxSelfClosingElement(current) || this.ts.isJsxFragment(current)) return current;
    return null;
  }

  private compileNode(node: TsNode): string {
    if (this.ts.isJsxElement(node)) return this.compileJsxElement(node).html;
    if (this.ts.isJsxSelfClosingElement(node)) return this.compileJsxSelfClosingElement(node).html;
    if (this.ts.isJsxFragment(node)) return this.compileChildren(node.children);
    if (this.ts.isJsxText(node)) return normalizeJsxText(node.getText(this.sourceFile));
    if (this.ts.isJsxExpression(node)) return this.compileExpressionChild(node.expression);
    this.report('warning', 'Unsupported JSX node was skipped', node, 'FRONTIER_JSX_UNSUPPORTED_NODE');
    return '';
  }

  private compileJsxElement(node: tsType.JsxElement): StaticElementCompileResult {
    const opening = node.openingElement;
    const componentName = this.componentTagName(opening.tagName);
    if (componentName) return this.compileComponentElement(componentName, opening.attributes.properties, node.children, node);
    const tag = this.tagNameToString(opening.tagName);
    const attributes = this.readAttributes(opening.attributes.properties);
    const childHtml = this.compileChildren(node.children);
    return this.emitElement(tag, attributes, childHtml, node);
  }

  private compileJsxSelfClosingElement(node: tsType.JsxSelfClosingElement): StaticElementCompileResult {
    const componentName = this.componentTagName(node.tagName);
    if (componentName) return this.compileComponentElement(componentName, node.attributes.properties, undefined, node);
    const tag = this.tagNameToString(node.tagName);
    const attributes = this.readAttributes(node.attributes.properties);
    return this.emitElement(tag, attributes, '', node);
  }

  private compileComponentElement(
    name: string,
    attributes: tsType.NodeArray<tsType.JsxAttributeLike>,
    children: tsType.NodeArray<tsType.JsxChild> | undefined,
    node: TsNode
  ): StaticElementCompileResult {
    const component = this.components.get(name);
    if (!component) {
      this.report('warning', 'JSX component is not statically known and was skipped: ' + name, node, 'FRONTIER_JSX_UNKNOWN_COMPONENT');
      return { html: '', hasFrontierBindings: false };
    }
    if (this.componentStack.includes(name)) {
      this.report('error', 'Recursive JSX component cannot be statically compiled: ' + name, node, 'FRONTIER_JSX_RECURSIVE_COMPONENT');
      return { html: '', hasFrontierBindings: false };
    }
    if (attributes.length !== 0 || (children && children.length !== 0)) {
      this.report(
        'warning',
        'Static Frontier JSX component compilation currently ignores component props and children: ' + name,
        node,
        'FRONTIER_JSX_COMPONENT_PROPS'
      );
    }
    this.componentStack[this.componentStack.length] = name;
    const html = this.compileNode(component.node);
    this.componentStack.pop();
    return { html, hasFrontierBindings: true };
  }

  private emitElement(
    tag: string,
    attributes: FrontierAttributeState,
    childHtml: string,
    node: TsNode
  ): StaticElementCompileResult {
    const needsAnchor = this.hasFrontierBindings(attributes);
    const anchor = needsAnchor ? attributes.anchor ?? this.nextAnchor() : attributes.anchor;
    if (needsAnchor) this.addBindings(anchor, attributes, node);
    const staticAttributes = attributes.staticAttributes.slice();
    if (anchor) staticAttributes[staticAttributes.length] = ['data-frontier-id', anchor];
    const html = '<' + tag + serializeAttributes(staticAttributes) + '>' + childHtml + '</' + tag + '>';
    return { html, anchor, hasFrontierBindings: needsAnchor };
  }

  private compileChildren(children: tsType.NodeArray<tsType.JsxChild>): string {
    let html = '';
    for (const child of children) html += this.compileNode(child);
    return html;
  }

  private compileExpressionChild(expression: TsExpression | undefined): string {
    if (!expression) return '';
    const helper = this.tryCompileHelperExpression(expression);
    if (helper !== null) return helper;
    const value = this.evaluateStaticExpression(expression);
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return escapeHtml(String(value));
    }
    if (value === null || value === undefined) return '';
    this.report('warning', 'Only static JSX expression children and Frontier JSX helpers are compiled', expression, 'FRONTIER_JSX_DYNAMIC_CHILD');
    return '';
  }

  private tryCompileHelperExpression(expression: TsExpression): string | null {
    if (!this.ts.isCallExpression(expression)) return null;
    const helperName = expression.expression.getText(this.sourceFile);
    if (helperName === 'text') return this.compileTextHelper(expression);
    if (helperName === 'when') return this.compileWhenHelper(expression);
    if (helperName === 'each') return this.compileEachHelper(expression);
    if (helperName === 'virtualEach') return this.compileVirtualEachHelper(expression);
    return null;
  }

  private compileTextHelper(expression: tsType.CallExpression): string {
    const path = this.evaluateStaticExpression(expression.arguments[0]) as WatchPath | undefined;
    const options = this.evaluateStaticExpression(expression.arguments[1]) as Record<string, unknown> | undefined;
    if (!isWatchPath(path)) {
      this.report('error', 'text() requires a static path string or JsonPath array', expression, 'FRONTIER_JSX_TEXT_PATH');
      return '';
    }
    const tag = typeof options?.as === 'string' ? options.as : 'span';
    const anchor = typeof options?.frId === 'string' ? options.frId : this.nextAnchor();
    const binding: FrontierDomTextManifestBinding = {
      id: 'b:' + anchor + ':text',
      kind: 'text',
      path,
      target: { anchor }
    };
    this.bindings[this.bindings.length] = binding;
    return '<' + tag + ' data-frontier-id="' + escapeAttribute(anchor) + '"></' + tag + '>';
  }

  private compileWhenHelper(expression: tsType.CallExpression): string {
    const path = this.evaluateStaticExpression(expression.arguments[0]) as WatchPath | undefined;
    const options = this.evaluateStaticExpression(expression.arguments[1]) as Record<string, unknown> | undefined;
    if (!isWatchPath(path) || !options || typeof options !== 'object') {
      this.report('error', 'when() requires a static path and options object', expression, 'FRONTIER_JSX_WHEN_PATH');
      return '';
    }
    const tag = typeof options.as === 'string' ? options.as : 'span';
    const anchor = typeof options.frId === 'string' ? options.frId : this.nextAnchor();
    const binding = this.createWhenBinding(anchor, { ...options, path }, expression);
    if (binding) this.bindings[this.bindings.length] = binding;
    return '<' + tag + ' data-frontier-id="' + escapeAttribute(anchor) + '"></' + tag + '>';
  }

  private compileEachHelper(expression: tsType.CallExpression): string {
    const path = this.evaluateStaticExpression(expression.arguments[0]) as WatchPath | undefined;
    const options = this.evaluateStaticExpression(expression.arguments[1]) as Record<string, unknown> | undefined;
    if (!isWatchPath(path) || !options || typeof options !== 'object') {
      this.report('error', 'each() requires a static path and options object', expression, 'FRONTIER_JSX_EACH_PATH');
      return '';
    }
    const tag = typeof options.as === 'string' ? options.as : 'div';
    const anchor = typeof options.frId === 'string' ? options.frId : this.nextAnchor();
    const binding = this.createEachBinding(anchor, { ...options, path }, expression);
    if (binding) this.bindings[this.bindings.length] = binding;
    return '<' + tag + ' data-frontier-id="' + escapeAttribute(anchor) + '"></' + tag + '>';
  }

  private compileVirtualEachHelper(expression: tsType.CallExpression): string {
    const path = this.evaluateStaticExpression(expression.arguments[0]) as WatchPath | undefined;
    const options = this.evaluateStaticExpression(expression.arguments[1]) as Record<string, unknown> | undefined;
    if (!isWatchPath(path) || !options || typeof options !== 'object') {
      this.report('error', 'virtualEach() requires a static path and options object', expression, 'FRONTIER_JSX_VIRTUAL_PATH');
      return '';
    }
    const tag = typeof options.as === 'string' ? options.as : 'div';
    const anchor = typeof options.frId === 'string' ? options.frId : this.nextAnchor();
    const binding = this.createVirtualEachBinding(anchor, { ...options, path }, expression);
    if (binding) this.bindings[this.bindings.length] = binding;
    return '<' + tag + ' data-frontier-id="' + escapeAttribute(anchor) + '"></' + tag + '>';
  }

  private readAttributes(properties: tsType.NodeArray<tsType.JsxAttributeLike>): FrontierAttributeState {
    const attributes: FrontierAttributeState = { staticAttributes: [] };
    for (const property of properties) {
      if (this.ts.isJsxSpreadAttribute(property)) {
        this.report('warning', 'JSX spread attributes are not compiled into Frontier manifests', property, 'FRONTIER_JSX_SPREAD_ATTR');
        continue;
      }
      this.readAttribute(property, attributes);
    }
    return attributes;
  }

  private readAttribute(attribute: TsJsxAttribute, attributes: FrontierAttributeState): void {
    const name = this.ts.isIdentifier(attribute.name) ? attribute.name.text : attribute.name.getText(this.sourceFile);
    const value = this.readAttributeValue(attribute);
    switch (name) {
      case 'frId':
        if (value !== undefined && value !== null) attributes.anchor = String(value);
        return;
      case '$text':
        if (isWatchPath(value)) attributes.text = value;
        else this.report('error', '$text requires a static path string or JsonPath array', attribute, 'FRONTIER_JSX_TEXT_ATTR');
        return;
      case '$attr':
        attributes.attr = this.readWatchPathMap(value, attribute, '$attr');
        return;
      case '$prop':
        attributes.prop = this.readWatchPathMap(value, attribute, '$prop');
        return;
      case '$class':
        attributes.classMap = this.readWatchPathMap(value, attribute, '$class');
        return;
      case '$style':
        attributes.styleMap = this.readWatchPathMap(value, attribute, '$style');
        return;
      case '$on':
        attributes.on = this.readStringMap(value, attribute, '$on');
        return;
      case '$form':
        attributes.form = value && typeof value === 'object' ? value as FrontierAttributeState['form'] : undefined;
        if (!attributes.form) this.report('error', '$form requires a static options object', attribute, 'FRONTIER_JSX_FORM_ATTR');
        return;
      case '$when':
        attributes.when = value && typeof value === 'object' ? value as FrontierAttributeState['when'] : undefined;
        if (!attributes.when) this.report('error', '$when requires a static options object', attribute, 'FRONTIER_JSX_WHEN_ATTR');
        return;
      case '$each':
        attributes.each = value && typeof value === 'object' ? value as FrontierAttributeState['each'] : undefined;
        if (!attributes.each) this.report('error', '$each requires a static options object', attribute, 'FRONTIER_JSX_EACH_ATTR');
        return;
      case '$virtualEach':
        attributes.virtualEach = value && typeof value === 'object' ? value as FrontierAttributeState['virtualEach'] : undefined;
        if (!attributes.virtualEach) this.report('error', '$virtualEach requires a static options object', attribute, 'FRONTIER_JSX_VIRTUAL_ATTR');
        return;
      default:
        break;
    }
    if (name.length > 2 && name[0] === 'o' && name[1] === 'n') {
      this.report('warning', 'Function event handlers are runtime-only; use $on for serializable manifest actions', attribute, 'FRONTIER_JSX_RUNTIME_EVENT');
      return;
    }
    if (name === 'className') attributes.staticAttributes[attributes.staticAttributes.length] = ['class', value];
    else if (name === 'htmlFor') attributes.staticAttributes[attributes.staticAttributes.length] = ['for', value];
    else if (name === 'style' && value && typeof value === 'object') attributes.staticAttributes[attributes.staticAttributes.length] = ['style', serializeStyle(value as Record<string, unknown>)];
    else attributes.staticAttributes[attributes.staticAttributes.length] = [name, value];
  }

  private readAttributeValue(attribute: TsJsxAttribute): unknown {
    const initializer = attribute.initializer;
    if (!initializer) return true;
    if (this.ts.isStringLiteral(initializer)) return initializer.text;
    if (this.ts.isJsxExpression(initializer)) return initializer.expression ? this.evaluateStaticExpression(initializer.expression) : undefined;
    return undefined;
  }

  private readWatchPathMap(value: unknown, node: TsNode, name: string): Record<string, WatchPath> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      this.report('error', name + ' requires a static object of path values', node, 'FRONTIER_JSX_PATH_MAP');
      return undefined;
    }
    const map: Record<string, WatchPath> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const path = (value as Record<string, unknown>)[key];
      if (isWatchPath(path)) map[key] = path;
      else this.report('error', name + '.' + key + ' requires a static path', node, 'FRONTIER_JSX_PATH_MAP_VALUE');
    }
    return map;
  }

  private readStringMap(value: unknown, node: TsNode, name: string): Record<string, string> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      this.report('error', name + ' requires a static object of string values', node, 'FRONTIER_JSX_STRING_MAP');
      return undefined;
    }
    const map: Record<string, string> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const item = (value as Record<string, unknown>)[key];
      if (typeof item === 'string') map[key] = item;
      else this.report('error', name + '.' + key + ' requires a static action name', node, 'FRONTIER_JSX_STRING_MAP_VALUE');
    }
    return map;
  }

  private addBindings(anchor: string, attributes: FrontierAttributeState, node: TsNode): void {
    const target = { anchor };
    if (attributes.text !== undefined) {
      this.bindings[this.bindings.length] = {
        id: 'b:' + anchor + ':text',
        kind: 'text',
        path: attributes.text,
        target
      };
    }
    this.addPathMapBindings(anchor, target, 'attr', attributes.attr);
    this.addPathMapBindings(anchor, target, 'prop', attributes.prop);
    this.addPathMapBindings(anchor, target, 'class', attributes.classMap);
    this.addPathMapBindings(anchor, target, 'style', attributes.styleMap);
    if (attributes.on) {
      for (const event of Object.keys(attributes.on)) {
        const binding: FrontierDomEventManifestBinding = {
          id: 'b:' + anchor + ':event:' + event,
          kind: 'event',
          target,
          event,
          action: attributes.on[event]
        };
        this.bindings[this.bindings.length] = binding;
      }
    }
    if (attributes.form) {
      const binding = this.createFormBinding(anchor, attributes.form, node);
      if (binding) this.bindings[this.bindings.length] = binding;
    }
    if (attributes.when) {
      const binding = this.createWhenBinding(anchor, attributes.when, node);
      if (binding) this.bindings[this.bindings.length] = binding;
    }
    if (attributes.each) {
      const binding = this.createEachBinding(anchor, attributes.each, node);
      if (binding) this.bindings[this.bindings.length] = binding;
    }
    if (attributes.virtualEach) {
      const binding = this.createVirtualEachBinding(anchor, attributes.virtualEach, node);
      if (binding) this.bindings[this.bindings.length] = binding;
    }
  }

  private addPathMapBindings(
    anchor: string,
    target: FrontierDomNodeTarget,
    kind: 'attr' | 'prop' | 'class' | 'style',
    map: Record<string, WatchPath> | undefined
  ): void {
    if (!map) return;
    for (const name of Object.keys(map)) {
      if (kind === 'attr') {
        const binding: FrontierDomAttributeManifestBinding = { id: 'b:' + anchor + ':attr:' + name, kind, path: map[name], target, name };
        this.bindings[this.bindings.length] = binding;
      } else if (kind === 'prop') {
        const binding: FrontierDomPropertyManifestBinding = { id: 'b:' + anchor + ':prop:' + name, kind, path: map[name], target, name };
        this.bindings[this.bindings.length] = binding;
      } else if (kind === 'class') {
        const binding: FrontierDomClassManifestBinding = { id: 'b:' + anchor + ':class:' + name, kind, path: map[name], target, name };
        this.bindings[this.bindings.length] = binding;
      } else {
        const binding: FrontierDomStyleManifestBinding = { id: 'b:' + anchor + ':style:' + name, kind, path: map[name], target, name };
        this.bindings[this.bindings.length] = binding;
      }
    }
  }

  private createFormBinding(
    anchor: string,
    spec: Partial<FrontierDomFormManifestBinding> & { path?: WatchPath },
    node: TsNode
  ): FrontierDomFormManifestBinding | null {
    if (!isWatchPath(spec.path)) {
      this.report('error', '$form.path must be a static path', node, 'FRONTIER_JSX_FORM_PATH');
      return null;
    }
    return {
      id: 'b:' + anchor + ':form',
      kind: 'form',
      path: spec.path,
      target: { anchor },
      prop: typeof spec.prop === 'string' ? spec.prop : undefined,
      event: typeof spec.event === 'string' ? spec.event : undefined,
      format: typeof spec.format === 'string' ? spec.format : undefined
    };
  }

  private createWhenBinding(
    anchor: string,
    spec: Partial<FrontierDomWhenManifestBinding> & { path?: WatchPath; template?: string },
    node: TsNode
  ): FrontierDomWhenManifestBinding | null {
    if (!isWatchPath(spec.path)) {
      this.report('error', '$when.path must be a static path', node, 'FRONTIER_JSX_WHEN_PATH');
      return null;
    }
    if (typeof spec.template !== 'string') {
      this.report('error', '$when.template must be a static template name', node, 'FRONTIER_JSX_WHEN_TEMPLATE');
      return null;
    }
    return {
      id: 'b:' + anchor + ':when',
      kind: 'when',
      path: spec.path,
      target: { anchor },
      template: spec.template,
      fallbackTemplate: typeof spec.fallbackTemplate === 'string' ? spec.fallbackTemplate : undefined
    };
  }

  private createEachBinding(
    anchor: string,
    spec: Partial<FrontierDomEachManifestBinding> & { path?: WatchPath; template?: string },
    node: TsNode
  ): FrontierDomEachManifestBinding | null {
    if (!isWatchPath(spec.path)) {
      this.report('error', '$each.path must be a static path', node, 'FRONTIER_JSX_EACH_PATH');
      return null;
    }
    if (typeof spec.template !== 'string') {
      this.report('error', '$each.template must be a static template name', node, 'FRONTIER_JSX_EACH_TEMPLATE');
      return null;
    }
    return {
      id: 'b:' + anchor + ':each',
      kind: 'each',
      path: spec.path,
      container: { anchor },
      fields: Array.isArray(spec.fields) ? spec.fields : undefined,
      keyBy: typeof spec.keyBy === 'string' || typeof spec.keyBy === 'number' ? spec.keyBy : undefined,
      keyAttribute: typeof spec.keyAttribute === 'string' ? spec.keyAttribute : undefined,
      template: spec.template
    };
  }

  private createVirtualEachBinding(
    anchor: string,
    spec: Partial<FrontierDomVirtualEachManifestBinding> & {
      path?: WatchPath;
      template?: string;
      layout?: FrontierDomVirtualLayoutManifest;
    },
    node: TsNode
  ): FrontierDomVirtualEachManifestBinding | null {
    if (!isWatchPath(spec.path)) {
      this.report('error', '$virtualEach.path must be a static path', node, 'FRONTIER_JSX_VIRTUAL_PATH');
      return null;
    }
    if (typeof spec.template !== 'string') {
      this.report('error', '$virtualEach.template must be a static template name', node, 'FRONTIER_JSX_VIRTUAL_TEMPLATE');
      return null;
    }
    if (!isVirtualLayout(spec.layout)) {
      this.report('error', '$virtualEach.layout must be a static layout manifest', node, 'FRONTIER_JSX_VIRTUAL_LAYOUT');
      return null;
    }
    return {
      id: 'b:' + anchor + ':virtual-each',
      kind: 'virtualEach',
      path: spec.path,
      container: { anchor },
      fields: Array.isArray(spec.fields) ? spec.fields : undefined,
      keyBy: typeof spec.keyBy === 'string' || typeof spec.keyBy === 'number' ? spec.keyBy : undefined,
      keyAttribute: typeof spec.keyAttribute === 'string' ? spec.keyAttribute : undefined,
      template: spec.template,
      viewport: isPlainObject(spec.viewport) ? spec.viewport as FrontierDomVirtualEachManifestBinding['viewport'] : undefined,
      layout: spec.layout,
      overscan: typeof spec.overscan === 'number' ? spec.overscan : undefined,
      overscanPx: typeof spec.overscanPx === 'number' ? spec.overscanPx : undefined
    };
  }

  private hasFrontierBindings(attributes: FrontierAttributeState): boolean {
    return attributes.text !== undefined ||
      attributes.attr !== undefined ||
      attributes.prop !== undefined ||
      attributes.classMap !== undefined ||
      attributes.styleMap !== undefined ||
      attributes.on !== undefined ||
      attributes.form !== undefined ||
      attributes.when !== undefined ||
      attributes.each !== undefined ||
      attributes.virtualEach !== undefined;
  }

  private evaluateStaticExpression(expression: TsExpression | undefined): unknown {
    if (!expression) return undefined;
    if (this.ts.isStringLiteral(expression) || this.ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
    if (this.ts.isNumericLiteral(expression)) return Number(expression.text);
    if (expression.kind === this.ts.SyntaxKind.TrueKeyword) return true;
    if (expression.kind === this.ts.SyntaxKind.FalseKeyword) return false;
    if (expression.kind === this.ts.SyntaxKind.NullKeyword) return null;
    if (this.ts.isIdentifier(expression) && expression.text === 'undefined') return undefined;
    if (this.ts.isPrefixUnaryExpression(expression) && expression.operator === this.ts.SyntaxKind.MinusToken) {
      const value = this.evaluateStaticExpression(expression.operand);
      return typeof value === 'number' ? -value : undefined;
    }
    if (this.ts.isArrayLiteralExpression(expression)) {
      return expression.elements.map((element) => this.evaluateStaticExpression(element as TsExpression));
    }
    if (this.ts.isObjectLiteralExpression(expression)) return this.evaluateObjectLiteral(expression);
    if (this.ts.isCallExpression(expression) && expression.expression.getText(this.sourceFile) === 'textLayout') {
      const options = this.evaluateStaticExpression(expression.arguments[0]);
      if (options && typeof options === 'object') return { kind: 'text', ...(options as Record<string, unknown>) };
    }
    if (this.ts.isCallExpression(expression) && expression.expression.getText(this.sourceFile) === 'fixedLayout') {
      const itemSize = this.evaluateStaticExpression(expression.arguments[0]);
      if (typeof itemSize === 'number') return { kind: 'fixed', itemSize };
    }
    if (this.ts.isCallExpression(expression) && expression.expression.getText(this.sourceFile) === 'variableLayout') {
      const defaultSize = this.evaluateStaticExpression(expression.arguments[0]);
      if (typeof defaultSize === 'number') return { kind: 'variable', defaultSize };
    }
    return undefined;
  }

  private evaluateObjectLiteral(expression: tsType.ObjectLiteralExpression): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const property of expression.properties) {
      if (!this.ts.isPropertyAssignment(property)) {
        this.report('warning', 'Only static property assignments are compiled in Frontier JSX objects', property, 'FRONTIER_JSX_OBJECT_PROPERTY');
        continue;
      }
      const key = this.propertyNameToString(property.name);
      if (key === null) {
        this.report('warning', 'Computed object keys are not compiled in Frontier JSX objects', property, 'FRONTIER_JSX_COMPUTED_KEY');
        continue;
      }
      output[key] = this.evaluateStaticExpression(property.initializer as TsExpression);
    }
    return output;
  }

  private propertyNameToString(name: tsType.PropertyName): string | null {
    if (this.ts.isIdentifier(name) || this.ts.isStringLiteral(name) || this.ts.isNumericLiteral(name)) return name.text;
    return null;
  }

  private tagNameToString(name: tsType.JsxTagNameExpression): string {
    if (this.ts.isIdentifier(name)) return name.text;
    if (this.ts.isPropertyAccessExpression(name)) {
      this.report('warning', 'JSX component/member tags are emitted as their final property name in the static compiler', name, 'FRONTIER_JSX_MEMBER_TAG');
      return name.name.text;
    }
    return name.getText(this.sourceFile);
  }

  private componentTagName(name: tsType.JsxTagNameExpression): string | null {
    if (!this.ts.isIdentifier(name)) return null;
    return isComponentName(name.text) ? name.text : null;
  }

  private nextAnchor(): string {
    return 'fr-auto-' + this.nextAutoId++;
  }

  private report(
    severity: FrontierJsxCompileDiagnosticSeverity,
    message: string,
    node: TsNode,
    code?: string
  ): void {
    this.diagnostics[this.diagnostics.length] = {
      severity,
      message,
      code,
      start: node.getStart(this.sourceFile),
      length: node.getWidth(this.sourceFile)
    };
  }
}

function isWatchPath(value: unknown): value is WatchPath {
  return typeof value === 'string' ||
    (Array.isArray(value) && value.every((segment) => typeof segment === 'string' || typeof segment === 'number'));
}

function isComponentName(value: string): boolean {
  if (value.length === 0) return false;
  const code = value.charCodeAt(0);
  return code >= 65 && code <= 90;
}

function isVirtualLayout(value: unknown): value is FrontierDomVirtualLayoutManifest {
  if (typeof value === 'string') return value.length !== 0;
  return isPlainObject(value) && typeof (value as { kind?: unknown }).kind === 'string';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeJsxText(text: string): string {
  if (text.indexOf('\n') === -1 && text.indexOf('\r') === -1) return escapeHtml(text);
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const pieces: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) pieces[pieces.length] = trimmed;
  }
  return pieces.length === 0 ? '' : escapeHtml(pieces.join(' '));
}

function serializeAttributes(attributes: Array<[string, unknown]>): string {
  let html = '';
  for (const [name, value] of attributes) {
    if (value === false || value === null || value === undefined) continue;
    html += ' ' + name;
    if (value !== true) html += '="' + escapeAttribute(String(value)) + '"';
  }
  return html;
}

function serializeStyle(style: Record<string, unknown>): string {
  let text = '';
  for (const key of Object.keys(style)) {
    const value = style[key];
    if (value === false || value === null || value === undefined) continue;
    if (text) text += ';';
    text += toKebabCase(key) + ':' + String(value);
  }
  return text;
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (char) => '-' + char.toLowerCase());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
