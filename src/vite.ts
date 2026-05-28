import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  FrontierDomCompiledView,
  FrontierDomManifestRoot,
  FrontierDomManifestSource
} from './index.js';
import {
  compileFrontierJsx,
  type FrontierJsxCompileDiagnostic,
  type FrontierJsxCompileOptions,
  type FrontierJsxCompileResult
} from './compiler.js';

export interface FrontierDomBuildEntry {
  input: string;
  name?: string;
  entry?: string;
  root?: FrontierDomManifestRoot;
  source?: FrontierDomManifestSource;
  outDir?: string;
  emit?: FrontierDomBuildEmitOptions;
  hydration?: FrontierDomHydrationModuleOptions;
}

export interface FrontierDomBuildEmitOptions {
  html?: boolean;
  manifest?: boolean;
  hydration?: boolean;
  diagnostics?: boolean;
}

export interface FrontierDomHydrationModuleOptions {
  target?: string;
  sourceImport?: string;
  sourceExport?: string;
  templatesImport?: string;
  templatesExport?: string;
  createAppExport?: string;
  mountExport?: string;
}

export interface FrontierDomBuildOptions {
  entries: FrontierDomBuildEntries;
  rootDir?: string;
  outDir?: string;
  emit?: FrontierDomBuildEmitOptions;
  failOnDiagnostic?: boolean;
}

export type FrontierDomBuildEntries =
  | Record<string, string | FrontierDomBuildEntry>
  | Array<FrontierDomBuildEntry & { name: string }>;

export interface FrontierDomBuildArtifact {
  kind: 'html' | 'manifest' | 'hydration' | 'diagnostics';
  fileName: string;
  source: string;
}

export interface FrontierDomBuildOutput {
  name: string;
  input: string;
  inputPath: string;
  result: FrontierJsxCompileResult;
  compiled: FrontierDomCompiledView;
  diagnostics: FrontierJsxCompileDiagnostic[];
  artifacts: FrontierDomBuildArtifact[];
}

export interface FrontierDomVitePluginOptions extends FrontierDomBuildOptions {
  jsxImportSource?: string | false;
}

export interface FrontierDomVitePlugin {
  name: string;
  enforce: 'pre';
  config?(): Record<string, unknown> | undefined;
  buildStart?(this: FrontierDomPluginContext): Promise<void>;
  resolveId?(id: string): string | null;
  load?(this: FrontierDomPluginContext, id: string): Promise<string | null>;
}

export interface FrontierDomPluginContext {
  emitFile?(artifact: { type: 'asset'; fileName: string; source: string }): string;
  warn?(message: string | { message: string }): void;
  error?(message: string | { message: string }): never;
}

const VIRTUAL_PREFIX = 'virtual:frontier-dom/';
const RESOLVED_VIRTUAL_PREFIX = '\0frontier-dom:';

export function frontierDomVite(options: FrontierDomVitePluginOptions): FrontierDomVitePlugin {
  const cache = new Map<string, FrontierDomBuildOutput>();
  return {
    name: 'frontier-dom',
    enforce: 'pre',
    config() {
      if (options.jsxImportSource === false) return undefined;
      return {
        esbuild: {
          jsx: 'automatic',
          jsxImportSource: options.jsxImportSource ?? '@shapeshift-labs/frontier-dom'
        }
      };
    },
    async buildStart() {
      const outputs = await compileFrontierDomBuildEntries(options);
      cache.clear();
      for (const output of outputs) {
        cache.set(output.name, output);
        reportDiagnostics(this, output, options.failOnDiagnostic !== false);
        for (const artifact of output.artifacts) {
          this.emitFile?.({
            type: 'asset',
            fileName: artifact.fileName,
            source: artifact.source
          });
        }
      }
    },
    resolveId(id) {
      return id.startsWith(VIRTUAL_PREFIX) ? RESOLVED_VIRTUAL_PREFIX + id.slice(VIRTUAL_PREFIX.length) : null;
    },
    async load(id) {
      if (!id.startsWith(RESOLVED_VIRTUAL_PREFIX)) return null;
      const name = id.slice(RESOLVED_VIRTUAL_PREFIX.length);
      const cached = cache.get(name);
      if (cached) return readHydrationArtifact(cached)?.source ?? renderFrontierDomHydrationModule(cached.compiled, resolveEntryHydration(options, name));
      const output = await compileOneFrontierDomEntry(options, name);
      reportDiagnostics(this, output, options.failOnDiagnostic !== false);
      cache.set(output.name, output);
      return readHydrationArtifact(output)?.source ?? renderFrontierDomHydrationModule(output.compiled, resolveEntryHydration(options, name));
    }
  };
}

export async function compileFrontierDomBuildEntries(options: FrontierDomBuildOptions): Promise<FrontierDomBuildOutput[]> {
  const entries = normalizeEntries(options.entries);
  const outputs: FrontierDomBuildOutput[] = [];
  for (const entry of entries) outputs[outputs.length] = await compileEntry(options, entry);
  return outputs;
}

export function renderFrontierDomHydrationModule(
  compiled: FrontierDomCompiledView,
  options: FrontierDomHydrationModuleOptions = {}
): string {
  const sourceImport = renderImport('frontierSource', options.sourceImport, options.sourceExport);
  const templatesImport = renderImport('frontierTemplates', options.templatesImport, options.templatesExport);
  const sourceExpression = options.sourceImport ? 'options.source ?? frontierSource' : 'options.source';
  const templatesExpression = options.templatesImport ? 'options.templates ?? frontierTemplates' : 'options.templates';
  const targetExpression = options.target !== undefined ? 'options.target ?? ' + JSON.stringify(options.target) : 'options.target';
  const createAppExport = options.createAppExport ?? 'createFrontierDomApp';
  const mountExport = options.mountExport ?? 'mountFrontierDom';
  return [
    "import { createApp } from '@shapeshift-labs/frontier-dom';",
    sourceImport,
    templatesImport,
    'export const html = ' + JSON.stringify(compiled.html) + ';',
    'export const manifest = ' + JSON.stringify(compiled.manifest) + ';',
    'export const compiled = { html, manifest };',
    'export function ' + createAppExport + '(options = {}) {',
    '  return createApp({',
    '    ...options.app,',
    '    source: ' + sourceExpression + ',',
    '    target: ' + targetExpression + ',',
    '    templates: ' + templatesExpression,
    '  });',
    '}',
    'export function ' + mountExport + '(options = {}) {',
    '  const app = ' + createAppExport + '(options);',
    '  app.mount(options.view ?? compiled, options.mount);',
    '  return app;',
    '}',
    'export default compiled;',
    ''
  ].filter((line) => line !== '').join('\n');
}

async function compileOneFrontierDomEntry(options: FrontierDomBuildOptions, name: string): Promise<FrontierDomBuildOutput> {
  const entry = normalizeEntries(options.entries).find((item) => item.name === name);
  if (!entry) throw new TypeError('frontier-dom/vite entry was not found: ' + name);
  return compileEntry(options, entry);
}

async function compileEntry(
  options: FrontierDomBuildOptions,
  entry: Required<Pick<FrontierDomBuildEntry, 'name' | 'input'>> & FrontierDomBuildEntry
): Promise<FrontierDomBuildOutput> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const inputPath = path.resolve(rootDir, entry.input);
  const sourceText = await readFile(inputPath, 'utf8');
  const compileOptions: FrontierJsxCompileOptions = {
    fileName: inputPath,
    entry: entry.entry,
    root: entry.root,
    source: entry.source
  };
  const result = await compileFrontierJsx(sourceText, compileOptions);
  const compiled = { html: result.html, manifest: result.manifest };
  return {
    name: entry.name,
    input: entry.input,
    inputPath,
    result,
    compiled,
    diagnostics: result.diagnostics,
    artifacts: createArtifacts(options, entry, compiled, result.diagnostics)
  };
}

function createArtifacts(
  options: FrontierDomBuildOptions,
  entry: Required<Pick<FrontierDomBuildEntry, 'name' | 'input'>> & FrontierDomBuildEntry,
  compiled: FrontierDomCompiledView,
  diagnostics: FrontierJsxCompileDiagnostic[]
): FrontierDomBuildArtifact[] {
  const emit = { html: true, manifest: true, hydration: true, diagnostics: true, ...(options.emit ?? {}), ...(entry.emit ?? {}) };
  const outDir = trimSlashes(entry.outDir ?? options.outDir ?? 'frontier-dom');
  const baseName = safeFileName(entry.name);
  const artifacts: FrontierDomBuildArtifact[] = [];
  if (emit.html) artifacts[artifacts.length] = { kind: 'html', fileName: joinOut(outDir, baseName + '.html'), source: compiled.html };
  if (emit.manifest) {
    artifacts[artifacts.length] = {
      kind: 'manifest',
      fileName: joinOut(outDir, baseName + '.manifest.json'),
      source: JSON.stringify(compiled.manifest, null, 2)
    };
  }
  if (emit.hydration) {
    artifacts[artifacts.length] = {
      kind: 'hydration',
      fileName: joinOut(outDir, baseName + '.hydration.js'),
      source: renderFrontierDomHydrationModule(compiled, entry.hydration)
    };
  }
  if (emit.diagnostics) {
    artifacts[artifacts.length] = {
      kind: 'diagnostics',
      fileName: joinOut(outDir, baseName + '.diagnostics.json'),
      source: JSON.stringify({ diagnostics }, null, 2)
    };
  }
  return artifacts;
}

function normalizeEntries(entries: FrontierDomBuildEntries): Array<Required<Pick<FrontierDomBuildEntry, 'name' | 'input'>> & FrontierDomBuildEntry> {
  if (Array.isArray(entries)) {
    return entries.map((entry) => ({ ...entry, name: entry.name, input: entry.input }));
  }
  return Object.keys(entries).map((name) => {
    const entry = entries[name];
    if (typeof entry === 'string') return { name, input: entry };
    return { ...entry, name: entry.name ?? name, input: entry.input };
  });
}

function readHydrationArtifact(output: FrontierDomBuildOutput): FrontierDomBuildArtifact | undefined {
  return output.artifacts.find((artifact) => artifact.kind === 'hydration');
}

function resolveEntryHydration(options: FrontierDomBuildOptions, name: string): FrontierDomHydrationModuleOptions | undefined {
  const entry = normalizeEntries(options.entries).find((item) => item.name === name);
  return entry?.hydration;
}

function reportDiagnostics(context: FrontierDomPluginContext, output: FrontierDomBuildOutput, failOnError: boolean): void {
  for (const diagnostic of output.diagnostics) {
    const message = formatDiagnostic(output, diagnostic);
    if (diagnostic.severity === 'error' && failOnError) context.error?.(message);
    else context.warn?.(message);
  }
}

function formatDiagnostic(output: FrontierDomBuildOutput, diagnostic: FrontierJsxCompileDiagnostic): string {
  const code = diagnostic.code ? ' [' + diagnostic.code + ']' : '';
  return 'frontier-dom ' + output.name + ': ' + diagnostic.severity + code + ': ' + diagnostic.message;
}

function renderImport(localName: string, specifier: string | undefined, exportName: string | undefined): string {
  if (!specifier) return '';
  if (!exportName || exportName === 'default') return 'import ' + localName + ' from ' + JSON.stringify(specifier) + ';';
  return 'import { ' + exportName + ' as ' + localName + ' } from ' + JSON.stringify(specifier) + ';';
}

function safeFileName(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'app';
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function joinOut(outDir: string, fileName: string): string {
  return outDir ? outDir + '/' + fileName : fileName;
}
