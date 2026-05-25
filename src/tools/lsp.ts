import type { Tool, ToolResult } from './types.js';
import { spawn, ChildProcess } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

// ======================== LSP Response Types ========================

interface LSPDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
  relatedInformation?: Array<{
    location: { uri: string; range: unknown };
    message: string;
  }>;
}

interface LSPMarkupContent {
  kind: 'plaintext' | 'markdown';
  value: string;
}

interface LSPHover {
  contents: LSPMarkupContent | { language: string; value: string } | Array<unknown>;
  range?: { start: { line: number; character: number }; end: { line: number; character: number } };
}

interface LSPCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string | LSPMarkupContent;
  sortText?: string;
  filterText?: string;
  insertText?: string;
  insertTextFormat?: number;
  textEdit?: unknown;
}

interface LSPCompletionList {
  isIncomplete: boolean;
  items: LSPCompletionItem[];
}

interface LSPDefinitionLocation {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface LSPLocationLink {
  targetUri: string;
  targetRange: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  targetSelectionRange?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface LSPReferenceInfo {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface LSPParameterInformation {
  label: string | [number, number];
  documentation?: string | LSPMarkupContent;
}

interface LSPSignatureInformation {
  label: string;
  documentation?: string | LSPMarkupContent;
  parameters?: LSPParameterInformation[];
  activeParameter?: number;
}

interface LSPSignatureHelp {
  signatures: LSPSignatureInformation[];
  activeSignature?: number;
  activeParameter?: number;
}

interface LSPWorkspaceEdit {
  changes?: Record<string, Array<{ range: unknown; newText: string }>>;
  documentChanges?: unknown[];
}

interface LSPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface LSPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface LSPNotification {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
}

// ======================== Config ========================

interface LSPServerConfig {
  command: string[];
  extensions: string[];
  rootPath: string;
}

interface LSPClientOptions {
  timeout: number;
}

const DEFAULT_TIMEOUT_MS = 10000;

const LSP_SERVERS: Record<string, LSPServerConfig> = {
  typescript: {
    command: ['typescript-language-server', '--stdio'],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    rootPath: '',
  },
  python: {
    command: ['pyright-langserver', '--stdio'],
    extensions: ['.py', '.pyi'],
    rootPath: '',
  },
  go: {
    command: ['gopls'],
    extensions: ['.go'],
    rootPath: '',
  },
  rust: {
    command: ['rust-analyzer'],
    extensions: ['.rs'],
    rootPath: '',
  },
  java: {
    command: ['jdtls'],
    extensions: ['.java'],
    rootPath: '',
  },
  cpp: {
    command: ['clangd'],
    extensions: ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp'],
    rootPath: '',
  },
  ruby: {
    command: ['solargraph', 'stdio'],
    extensions: ['.rb'],
    rootPath: '',
  },
  php: {
    command: ['intelephense', '--stdio'],
    extensions: ['.php'],
    rootPath: '',
  },
  lua: {
    command: ['lua-language-server'],
    extensions: ['.lua'],
    rootPath: '',
  },
};

const LANGUAGE_ID_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyi': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.rb': 'ruby',
  '.php': 'php',
  '.lua': 'lua',
};

// ======================== Helpers ========================

function findProjectRoot(dir: string): string {
  let current = dir;
  while (current !== path.parse(current).root) {
    if (existsSync(path.join(current, 'package.json')) ||
        existsSync(path.join(current, 'tsconfig.json')) ||
        existsSync(path.join(current, 'Cargo.toml')) ||
        existsSync(path.join(current, 'go.mod')) ||
        existsSync(path.join(current, 'requirements.txt')) ||
        existsSync(path.join(current, 'pyproject.toml')) ||
        existsSync(path.join(current, 'pom.xml')) ||
        existsSync(path.join(current, 'build.gradle')) ||
        existsSync(path.join(current, 'Gemfile')) ||
        existsSync(path.join(current, 'composer.json'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return dir;
}

function detectLSPServer(filePath: string): LSPServerConfig | null {
  const ext = path.extname(filePath).toLowerCase();
  for (const [name, config] of Object.entries(LSP_SERVERS)) {
    if (config.extensions.includes(ext)) {
      return { ...config, rootPath: findProjectRoot(path.dirname(filePath)) };
    }
  }
  return null;
}

function fileToUri(filePath: string): string {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const normalizedPath = absolutePath.replace(/\\/g, '/');
  return `file:///${normalizedPath}`;
}

function extToLanguageId(ext: string): string {
  return LANGUAGE_ID_MAP[ext.toLowerCase()] || ext.slice(1);
}

// ======================== LSPClient ========================

interface OpenDocument {
  uri: string;
  version: number;
  content: string;
}

type NotificationHandler = (params: Record<string, unknown>) => void;
type ResponseResolver = {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

class LSPClient {
  private process: ChildProcess | null = null;
  private requestId: number = 0;
  private buffer = '';
  private contentLength = 0;
  private resolveQueue: Map<number, ResponseResolver> = new Map();
  private notificationHandlers: Map<string, NotificationHandler> = new Map();
  private openDocuments: Map<string, OpenDocument> = new Map();
  private diagnosticsMap: Map<string, LSPDiagnostic[]> = new Map();
  private diagnosticsResolvers: Map<string, {
    resolve: (diagnostics: LSPDiagnostic[]) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private started = false;
  private initializing = false;
  private timeout: number;

  constructor(options: LSPClientOptions = { timeout: DEFAULT_TIMEOUT_MS }) {
    this.timeout = options.timeout;
    this.registerDefaultNotificationHandlers();
  }

  private registerDefaultNotificationHandlers(): void {
    this.notificationHandlers.set('textDocument/publishDiagnostics', (params) => {
      const uri = params.uri as string;
      const diagnostics = (params.diagnostics ?? []) as LSPDiagnostic[];
      this.diagnosticsMap.set(uri, diagnostics);
      logger.debug(`[LSP] Received diagnostics for ${uri}: ${diagnostics.length} issues`);

      const resolver = this.diagnosticsResolvers.get(uri);
      if (resolver) {
        clearTimeout(resolver.timeout);
        this.diagnosticsResolvers.delete(uri);
        resolver.resolve(diagnostics);
      }
    });
  }

  async start(config: LSPServerConfig): Promise<void> {
    if (this.started) {
      logger.debug('[LSP] Client already started, skipping');
      return;
    }
    if (this.initializing) {
      logger.debug('[LSP] Client is initializing, waiting...');
      return;
    }

    this.initializing = true;
    logger.info(`[LSP] Starting server: ${config.command.join(' ')} in ${config.rootPath}`);

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(config.command[0], config.command.slice(1), {
          cwd: config.rootPath,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.process.on('error', (err) => {
          logger.error(`[LSP] Process error: ${err.message}`);
          this.initializing = false;
          reject(new Error(`Failed to start LSP server: ${err.message}`));
        });

        this.process.stdout!.on('data', (data: Buffer) => {
          this.buffer += data.toString();
          this.processBuffer();
        });

        this.process.stderr!.on('data', (data: Buffer) => {
          const msg = data.toString().trim();
          if (msg) {
            logger.debug(`[LSP] stderr: ${msg}`);
          }
        });

        this.process.on('exit', (code, signal) => {
          logger.info(`[LSP] Server exited with code ${code}, signal ${signal}`);
          this.started = false;
          this.initializing = false;
        });

        this.sendRequest('initialize', {
          processId: process.pid,
          clientInfo: { name: 'MiniAgent', version: '1.0.0' },
          rootUri: `file://${config.rootPath}`,
          capabilities: {
            textDocument: {
              synchronization: {
                didSave: true,
                willSave: true,
                willSaveWaitUntil: false,
              },
              hover: {
                contentFormat: ['markdown', 'plaintext'],
              },
              completion: {
                completionItem: {
                  snippetSupport: false,
                  commitCharactersSupport: true,
                  documentationFormat: ['markdown', 'plaintext'],
                  deprecatedSupport: false,
                  preselectSupport: false,
                  tagSupport: { valueSet: [] },
                  insertReplaceSupport: false,
                  resolveSupport: { properties: [] },
                  insertTextModeSupport: { valueSet: [1, 2] },
                  labelDetailsSupport: false,
                },
                completionItemKind: {
                  valueSet: Array.from({ length: 25 }, (_, i) => i + 1),
                },
                contextSupport: true,
              },
              definition: {
                linkSupport: true,
              },
              references: {},
              signatureHelp: {
                signatureInformation: {
                  documentationFormat: ['markdown', 'plaintext'],
                  parameterInformation: { labelOffsetSupport: true },
                  activeParameterSupport: true,
                },
                contextSupport: true,
              },
              rename: {
                prepareSupport: true,
                prepareSupportDefaultBehavior: 1,
                honorsChangeAnnotations: false,
              },
              publishDiagnostics: {
                relatedInformation: true,
                versionSupport: true,
                codeDescriptionSupport: true,
                dataSupport: true,
              },
            },
            workspace: {
              workspaceFolders: true,
              didChangeConfiguration: { dynamicRegistration: false },
            },
          },
        }).then(() => {
          this.sendNotification('initialized', {});
          this.started = true;
          this.initializing = false;
          logger.info('[LSP] Server initialized successfully');
          resolve();
        }).catch((err) => {
          this.initializing = false;
          logger.error(`[LSP] Initialize failed: ${err instanceof Error ? err.message : String(err)}`);
          reject(err);
        });
      } catch (err) {
        this.initializing = false;
        logger.error(`[LSP] Start failed: ${err instanceof Error ? err.message : String(err)}`);
        reject(err);
      }
    });
  }

  private processBuffer(): void {
    while (this.buffer.length > 0) {
      if (this.contentLength === 0) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;

        const header = this.buffer.substring(0, headerEnd);
        const contentLengthMatch = header.match(/Content-Length: (\d+)/);
        if (!contentLengthMatch) {
          this.buffer = this.buffer.substring(headerEnd + 4);
          continue;
        }

        this.contentLength = parseInt(contentLengthMatch[1], 10);
        this.buffer = this.buffer.substring(headerEnd + 4);
      }

      if (this.buffer.length < this.contentLength) return;

      const content = this.buffer.substring(0, this.contentLength);
      this.buffer = this.buffer.substring(this.contentLength);
      this.contentLength = 0;

      try {
        const data = JSON.parse(content) as LSPResponse | LSPNotification;

        if ('id' in data && data.id !== null && data.id !== undefined) {
          const response = data as LSPResponse;
          const resolver = this.resolveQueue.get(response.id);
          if (resolver) {
            clearTimeout(resolver.timeout);
            this.resolveQueue.delete(response.id);
            if (response.error) {
              logger.warn(`[LSP] Response error for id ${response.id}: ${response.error.message}`);
              resolver.reject(new Error(response.error.message));
            } else {
              logger.debug(`[LSP] Response received for id ${response.id}`);
              resolver.resolve(response.result);
            }
          } else {
            logger.debug(`[LSP] No resolver found for response id ${response.id}`);
          }
        } else {
          const notification = data as LSPNotification;
          const handler = this.notificationHandlers.get(notification.method);
          if (handler) {
            logger.debug(`[LSP] Handling notification: ${notification.method}`);
            handler(notification.params);
          } else {
            logger.debug(`[LSP] Unhandled notification: ${notification.method}`);
          }
        }
      } catch (err) {
        logger.warn(`[LSP] Failed to parse message: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  private sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request: LSPRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      logger.debug(`[LSP] Sending request [${id}]: ${method}`);

      const timeoutHandle = setTimeout(() => {
        this.resolveQueue.delete(id);
        logger.warn(`[LSP] Request [${id}] ${method} timed out after ${this.timeout}ms`);
        reject(new Error(`Request ${method} timed out after ${this.timeout}ms`));
      }, this.timeout);

      this.resolveQueue.set(id, { resolve, reject, timeout: timeoutHandle });

      try {
        this.sendJSONRPC(request as unknown as Record<string, unknown>);
      } catch (err) {
        clearTimeout(timeoutHandle);
        this.resolveQueue.delete(id);
        reject(err);
      }
    });
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };
    logger.debug(`[LSP] Sending notification: ${method}`);
    this.sendJSONRPC(notification);
  }

  private sendJSONRPC(data: Record<string, unknown>): void {
    if (!this.process?.stdin?.writable) {
      throw new Error('[LSP] Process stdin not available');
    }
    const content = JSON.stringify(data);
    const header = `Content-Length: ${content.length}\r\n\r\n`;
    this.process.stdin.write(header + content);
  }

  // ======================== Document Lifecycle ========================

  async ensureDocumentOpened(filePath: string): Promise<void> {
    const uri = fileToUri(filePath);

    if (this.openDocuments.has(uri)) {
      logger.debug(`[LSP] Document already open: ${uri}`);
      return;
    }

    const content = readFileSync(filePath, 'utf-8');
    const languageId = extToLanguageId(path.extname(filePath));

    this.openDocuments.set(uri, { uri, version: 1, content });

    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId,
        version: 1,
        text: content,
      },
    });

    logger.debug(`[LSP] Document opened: ${uri} (${languageId})`);
  }

  async documentDidChange(filePath: string): Promise<void> {
    const uri = fileToUri(filePath);
    const doc = this.openDocuments.get(uri);

    if (!doc) {
      await this.ensureDocumentOpened(filePath);
      return;
    }

    const content = readFileSync(filePath, 'utf-8');
    doc.version += 1;
    doc.content = content;

    this.sendNotification('textDocument/didChange', {
      textDocument: { uri, version: doc.version },
      contentChanges: [{ text: content }],
    });

    logger.debug(`[LSP] Document changed: ${uri} (version ${doc.version})`);
  }

  async documentDidClose(filePath: string): Promise<void> {
    const uri = fileToUri(filePath);
    this.openDocuments.delete(uri);
    this.diagnosticsMap.delete(uri);

    this.sendNotification('textDocument/didClose', {
      textDocument: { uri },
    });

    logger.debug(`[LSP] Document closed: ${uri}`);
  }

  // ======================== LSP Operations ========================

  async getDiagnostics(filePath: string): Promise<LSPDiagnostic[]> {
    const uri = fileToUri(filePath);
    logger.info(`[LSP] Getting diagnostics for ${filePath}`);

    await this.ensureDocumentOpened(filePath);

    if (this.diagnosticsMap.has(uri)) {
      const cached = this.diagnosticsMap.get(uri)!;
      logger.debug(`[LSP] Returning cached diagnostics for ${uri}: ${cached.length} issues`);
      return cached;
    }

    return new Promise<LSPDiagnostic[]>((resolve) => {
      const timeout = setTimeout(() => {
        this.diagnosticsResolvers.delete(uri);
        logger.warn(`[LSP] Diagnostics timeout for ${uri}`);
        resolve([]);
      }, this.timeout);

      this.diagnosticsResolvers.set(uri, { resolve, timeout });

      setTimeout(async () => {
        await this.documentDidChange(filePath);
      }, 500);
    });
  }

  async goToDefinition(filePath: string, line: number, character: number): Promise<LSPDefinitionLocation[] | LSPLocationLink[]> {
    const uri = fileToUri(filePath);
    logger.info(`[LSP] GoToDefinition for ${filePath}:${line}:${character}`);

    await this.ensureDocumentOpened(filePath);

    const result = await this.sendRequest('textDocument/definition', {
      textDocument: { uri },
      position: { line: line - 1, character },
    });

    return result as LSPDefinitionLocation[] | LSPLocationLink[];
  }

  async findReferences(filePath: string, line: number, character: number): Promise<LSPReferenceInfo[]> {
    const uri = fileToUri(filePath);
    logger.info(`[LSP] FindReferences for ${filePath}:${line}:${character}`);

    await this.ensureDocumentOpened(filePath);

    const result = await this.sendRequest('textDocument/references', {
      textDocument: { uri },
      position: { line: line - 1, character },
      context: { includeDeclaration: true },
    });

    return (result ?? []) as LSPReferenceInfo[];
  }

  async hover(filePath: string, line: number, character: number): Promise<LSPHover | null> {
    const uri = fileToUri(filePath);
    logger.info(`[LSP] Hover for ${filePath}:${line}:${character}`);

    await this.ensureDocumentOpened(filePath);

    const result = await this.sendRequest('textDocument/hover', {
      textDocument: { uri },
      position: { line: line - 1, character },
    });

    return result as LSPHover | null;
  }

  async completion(
    filePath: string,
    line: number,
    character: number,
    triggerKind?: number,
    triggerCharacter?: string,
  ): Promise<LSPCompletionList> {
    const uri = fileToUri(filePath);
    logger.info(`[LSP] Completion for ${filePath}:${line}:${character}`);

    await this.ensureDocumentOpened(filePath);

    const params: Record<string, unknown> = {
      textDocument: { uri },
      position: { line: line - 1, character },
    };

    if (triggerKind !== undefined || triggerCharacter !== undefined) {
      params.context = {
        triggerKind: triggerKind ?? 1,
        triggerCharacter,
      };
    }

    const result = await this.sendRequest('textDocument/completion', params);

    if (Array.isArray(result)) {
      return {
        isIncomplete: false,
        items: result as LSPCompletionItem[],
      };
    }

    return (result ?? { isIncomplete: false, items: [] }) as LSPCompletionList;
  }

  async signatureHelp(
    filePath: string,
    line: number,
    character: number,
    triggerKind?: number,
    triggerCharacter?: string,
  ): Promise<LSPSignatureHelp> {
    const uri = fileToUri(filePath);
    logger.info(`[LSP] SignatureHelp for ${filePath}:${line}:${character}`);

    await this.ensureDocumentOpened(filePath);

    const params: Record<string, unknown> = {
      textDocument: { uri },
      position: { line: line - 1, character },
    };

    if (triggerKind !== undefined || triggerCharacter !== undefined) {
      params.context = {
        triggerKind: triggerKind ?? 1,
        triggerCharacter,
        isRetrigger: false,
        activeSignatureHelp: undefined,
      };
    }

    const result = await this.sendRequest('textDocument/signatureHelp', params);

    return (result ?? { signatures: [] }) as LSPSignatureHelp;
  }

  async rename(filePath: string, line: number, character: number, newName: string): Promise<LSPWorkspaceEdit | null> {
    const uri = fileToUri(filePath);
    logger.info(`[LSP] Rename at ${filePath}:${line}:${character} to "${newName}"`);

    await this.ensureDocumentOpened(filePath);

    const result = await this.sendRequest('textDocument/rename', {
      textDocument: { uri },
      position: { line: line - 1, character },
      newName,
    });

    return result as LSPWorkspaceEdit | null;
  }

  stop(): void {
    if (this.process) {
      logger.info('[LSP] Stopping server');

      for (const uri of this.openDocuments.keys()) {
        this.sendNotification('textDocument/didClose', {
          textDocument: { uri },
        });
      }
      this.openDocuments.clear();

      for (const [, resolver] of this.resolveQueue) {
        clearTimeout(resolver.timeout);
      }
      this.resolveQueue.clear();

      for (const [, resolver] of this.diagnosticsResolvers) {
        clearTimeout(resolver.timeout);
      }
      this.diagnosticsResolvers.clear();

      this.sendNotification('shutdown', {});
      this.sendNotification('exit', {});
      this.process.kill();
      this.process = null;
      this.started = false;

      logger.info('[LSP] Server stopped');
    }
  }

  isStarted(): boolean {
    return this.started;
  }
}

// ======================== Client Management ========================

const activeClients: Map<string, LSPClient> = new Map();
const clientStarting: Map<string, Promise<void>> = new Map();

async function getOrCreateClient(
  filePath: string,
  options?: LSPClientOptions,
): Promise<{ client: LSPClient | null; server: LSPServerConfig | null }> {
  const server = detectLSPServer(filePath);
  if (!server) {
    return { client: null, server: null };
  }

  const key = server.command[0];

  if (activeClients.has(key)) {
    const existing = activeClients.get(key)!;
    if (existing.isStarted()) {
      return { client: existing, server };
    }
  }

  if (clientStarting.has(key)) {
    logger.debug(`[LSP] Client for ${key} is already starting, waiting...`);
    await clientStarting.get(key);
    return { client: activeClients.get(key) ?? null, server };
  }

  const startPromise = (async () => {
    const client = new LSPClient(options ?? { timeout: DEFAULT_TIMEOUT_MS });
    activeClients.set(key, client);
    await client.start(server);
    clientStarting.delete(key);
  })();

  clientStarting.set(key, startPromise);
  await startPromise;

  return { client: activeClients.get(key) ?? null, server };
}

// ======================== Tool ========================

interface LSPToolParams {
  operation: 'diagnostics' | 'definition' | 'references' | 'hover' | 'completion' | 'signatureHelp' | 'rename';
  file_path: string;
  line?: number;
  character?: number;
  new_name?: string;
  trigger_kind?: number;
  trigger_character?: string;
  timeout?: number;
}

export const LSPTool: Tool = {
  name: 'lsp',
  description: `Interact with Language Server Protocol (LSP) servers to get code intelligence.
Supported operations:
- diagnostics: Get code diagnostics (errors/warnings) for a file
- definition: Find where a symbol is defined
- references: Find all references to a symbol
- hover: Get type information and documentation for a symbol at a position
- completion: Get code completion suggestions at a position
- signatureHelp: Get function signature help at a position
- rename: Rename a symbol and get workspace edit`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'The LSP operation to perform',
        enum: ['diagnostics', 'definition', 'references', 'hover', 'completion', 'signatureHelp', 'rename'],
      },
      file_path: {
        type: 'string',
        description: 'Path to the source file',
      },
      line: {
        type: 'number',
        description: 'Line number (1-based, required for definition/references/hover/completion/signatureHelp/rename)',
      },
      character: {
        type: 'number',
        description: 'Character position (0-based, required for definition/references/hover/completion/signatureHelp/rename)',
      },
      new_name: {
        type: 'string',
        description: 'New name for the symbol (required for rename operation)',
      },
      trigger_kind: {
        type: 'number',
        description: 'Completion/signatureHelp trigger kind (1=Invoked, 2=TriggerCharacter, 3=TriggerForIncompleteCompletions)',
      },
      trigger_character: {
        type: 'string',
        description: 'The character that triggered completion/signatureHelp',
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds (default: 10000)',
      },
    },
    required: ['operation', 'file_path'],
  },

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const {
      operation,
      file_path,
      line = 1,
      character = 0,
      new_name,
      trigger_kind,
      trigger_character,
      timeout = DEFAULT_TIMEOUT_MS,
    } = params as unknown as LSPToolParams;

    const absolutePath = path.isAbsolute(file_path) ? file_path : path.resolve(process.cwd(), file_path);

    if (!existsSync(absolutePath)) {
      return {
        success: false,
        content: `File not found: ${file_path}`,
        error: 'File not found',
      };
    }

    const { client, server } = await getOrCreateClient(absolutePath, { timeout });
    if (!client || !server) {
      return {
        success: false,
        content: `No LSP server configured for file type: ${path.extname(file_path)}\nSupported: TypeScript, Python, Go, Rust, Java, C/C++, Ruby, PHP, Lua`,
        error: 'No LSP server available',
      };
    }

    try {
      let result: unknown;
      switch (operation) {
        case 'diagnostics': {
          const diagnostics = await client.getDiagnostics(absolutePath);
          return {
            success: true,
            content: formatDiagnostics(diagnostics, file_path),
            metadata: { operation, file_path, diagnostics },
          };
        }

        case 'definition': {
          const locations = await client.goToDefinition(absolutePath, line!, character!);
          return {
            success: true,
            content: `Definition found at ${file_path}:${line}:${character}\n${JSON.stringify(locations, null, 2)}`,
            metadata: { operation, file_path, line, character, result: locations },
          };
        }

        case 'references': {
          const references = await client.findReferences(absolutePath, line!, character!);
          return {
            success: true,
            content: `${references.length} references found at ${file_path}:${line}:${character}\n${JSON.stringify(references, null, 2)}`,
            metadata: { operation, file_path, line, character, result: references },
          };
        }

        case 'hover': {
          const hover = await client.hover(absolutePath, line!, character!);
          return {
            success: true,
            content: `Hover info at ${file_path}:${line}:${character}\n${JSON.stringify(hover, null, 2)}`,
            metadata: { operation, file_path, line, character, result: hover },
          };
        }

        case 'completion': {
          const completions = await client.completion(
            absolutePath,
            line!,
            character!,
            trigger_kind,
            trigger_character,
          );
          return {
            success: true,
            content: `${completions.items.length} completion items (isIncomplete: ${completions.isIncomplete})\n${JSON.stringify(completions, null, 2)}`,
            metadata: { operation, file_path, line, character, result: completions },
          };
        }

        case 'signatureHelp': {
          const sigHelp = await client.signatureHelp(
            absolutePath,
            line!,
            character!,
            trigger_kind,
            trigger_character,
          );
          return {
            success: true,
            content: `${sigHelp.signatures.length} signatures found\n${JSON.stringify(sigHelp, null, 2)}`,
            metadata: { operation, file_path, line, character, result: sigHelp },
          };
        }

        case 'rename': {
          if (!new_name) {
            return {
              success: false,
              content: 'Rename operation requires new_name parameter',
              error: 'Missing new_name parameter',
            };
          }
          const workspaceEdit = await client.rename(absolutePath, line!, character!, new_name);
          return {
            success: true,
            content: `Rename proposed for ${file_path}:${line}:${character} → "${new_name}"\n${JSON.stringify(workspaceEdit, null, 2)}`,
            metadata: { operation, file_path, line, character, new_name, result: workspaceEdit },
          };
        }

        default:
          return {
            success: false,
            content: `Unknown LSP operation: ${operation}`,
            error: 'Unknown operation',
          };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[LSP] Operation ${operation} failed on ${file_path}: ${message}`);
      return {
        success: false,
        content: `LSP operation failed: ${message}`,
        error: message,
      };
    }
  },
};

// ======================== Formatting ========================

function formatDiagnostics(diagnostics: LSPDiagnostic[], filePath: string): string {
  if (diagnostics.length === 0) {
    return `No diagnostics found for ${filePath}`;
  }

  const severityLabels: Record<number, string> = {
    1: 'Error',
    2: 'Warning',
    3: 'Information',
    4: 'Hint',
  };

  const lines = [`Found ${diagnostics.length} diagnostics for ${filePath}:`];
  for (const diag of diagnostics) {
    const severity = severityLabels[diag.severity ?? 0] ?? 'Unknown';
    const startLine = diag.range.start.line + 1;
    const startChar = diag.range.start.character + 1;
    const source = diag.source ? `[${diag.source}]` : '';
    const code = diag.code !== undefined ? `(${diag.code})` : '';
    lines.push(`  ${severity} ${source} ${code} ${startLine}:${startChar}: ${diag.message}`);
  }

  return lines.join('\n');
}

// ======================== Cleanup ========================

export function shutdownAllLSPServers(): void {
  logger.info('[LSP] Shutting down all LSP servers');
  for (const [, client] of activeClients) {
    client.stop();
  }
  activeClients.clear();
  clientStarting.clear();
  logger.info('[LSP] All LSP servers shut down');
}
