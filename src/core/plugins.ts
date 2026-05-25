import fs from 'fs';
import path from 'path';
import type { Tool } from '../tools/types.js';
import type { HookDefinition } from './hooks.js';
import type { SlashCommand } from './commands.js';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  main: string;
  tools?: string[];
  hooks?: string[];
  commands?: string[];
  mcpServers?: Record<string, { command: string; args: string[] }>;
}

export interface Plugin {
  manifest: PluginManifest;
  path: string;
  enabled: boolean;
  tools: Tool[];
  hooks: HookDefinition[];
  commands: SlashCommand[];
}

export interface PluginOptions {
  pluginDirs?: string[];
}

export class PluginManager {
  private plugins: Plugin[] = [];
  private pluginDirs: string[];

  constructor(options?: PluginOptions) {
    this.pluginDirs = options?.pluginDirs || [
      path.join(process.cwd(), '.miniagent', 'plugins'),
      path.join(process.env.HOME || '.', '.config', 'miniagent', 'plugins'),
    ];
  }

  async discover(): Promise<void> {
    for (const dir of this.pluginDirs) {
      if (!fs.existsSync(dir)) continue;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const pluginPath = path.join(dir, entry.name);
        const manifestPath = path.join(pluginPath, 'plugin.json');

        if (fs.existsSync(manifestPath)) {
          try {
            const plugin = await this.load(pluginPath);
            const existing = this.plugins.findIndex(p => p.manifest.name === plugin.manifest.name);
            if (existing !== -1) {
              this.plugins[existing] = plugin;
            } else {
              this.plugins.push(plugin);
            }
          } catch (error) {
            console.error(`Failed to load plugin at ${pluginPath}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }
  }

  async load(pluginPath: string): Promise<Plugin> {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest: PluginManifest = JSON.parse(manifestRaw);

    const mainFile = path.join(pluginPath, manifest.main || 'index.js');
    let pluginModule: any = {};

    if (fs.existsSync(mainFile)) {
      const resolvedPath = path.resolve(mainFile);
      pluginModule = await import(`file://${resolvedPath}`);
    }

    const tools: Tool[] = [];
    if (manifest.tools) {
      for (const toolFile of manifest.tools) {
        const toolPath = path.join(pluginPath, toolFile);
        if (fs.existsSync(toolPath)) {
          const resolvedPath = path.resolve(toolPath);
          const mod = await import(`file://${resolvedPath}`);
          if (mod && typeof mod === 'object') {
            const toolList = Array.isArray(mod.default) ? mod.default : [mod.default];
            tools.push(...toolList);
          }
        }
      }
    }

    const hooks: HookDefinition[] = [];
    if (manifest.hooks) {
      for (const hookFile of manifest.hooks) {
        const hookPath = path.join(pluginPath, hookFile);
        if (fs.existsSync(hookPath)) {
          const resolvedPath = path.resolve(hookPath);
          const mod = await import(`file://${resolvedPath}`);
          if (mod && typeof mod === 'object') {
            const hookList = Array.isArray(mod.default) ? mod.default : [mod.default];
            hooks.push(...hookList);
          }
        }
      }
    }

    const commands: SlashCommand[] = [];
    if (manifest.commands) {
      for (const cmdFile of manifest.commands) {
        const cmdPath = path.join(pluginPath, cmdFile);
        if (fs.existsSync(cmdPath)) {
          const resolvedPath = path.resolve(cmdPath);
          const mod = await import(`file://${resolvedPath}`);
          if (mod && typeof mod === 'object') {
            const cmdList = Array.isArray(mod.default) ? mod.default : [mod.default];
            commands.push(...cmdList);
          }
        }
      }
    }

    return {
      manifest,
      path: pluginPath,
      enabled: true,
      tools,
      hooks,
      commands,
    };
  }

  async install(packageName: string): Promise<void> {
    const targetDir = this.pluginDirs[0];

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await execAsync(`npm install --prefix "${targetDir}" "${packageName}"`);

    const pluginName = packageName.startsWith('@')
      ? packageName.slice(1).split('/')[0]
      : packageName.split('/')[0] || packageName;

    const pluginPath = path.join(targetDir, 'node_modules', packageName);
    const manifestPath = path.join(pluginPath, 'plugin.json');

    if (fs.existsSync(manifestPath)) {
      const plugin = await this.load(pluginPath);
      const existing = this.plugins.findIndex(p => p.manifest.name === plugin.manifest.name);
      if (existing !== -1) {
        this.plugins[existing] = plugin;
      } else {
        this.plugins.push(plugin);
      }
    }
  }

  list(): Plugin[] {
    return [...this.plugins];
  }

  listActive(): Plugin[] {
    return this.plugins.filter(p => p.enabled);
  }

  enable(name: string): void {
    const plugin = this.plugins.find(p => p.manifest.name === name);
    if (plugin) {
      plugin.enabled = true;
    }
  }

  disable(name: string): void {
    const plugin = this.plugins.find(p => p.manifest.name === name);
    if (plugin) {
      plugin.enabled = false;
    }
  }

  async uninstall(name: string): Promise<boolean> {
    const index = this.plugins.findIndex(p => p.manifest.name === name);
    if (index === -1) return false;

    const plugin = this.plugins[index];
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      await execAsync(`npm uninstall --prefix "${path.dirname(plugin.path)}" "${plugin.manifest.name}"`);
    } catch {
      if (fs.existsSync(plugin.path)) {
        fs.rmSync(plugin.path, { recursive: true, force: true });
      }
    }

    this.plugins.splice(index, 1);
    return true;
  }

  getTools(): Tool[] {
    return this.plugins
      .filter(p => p.enabled)
      .flatMap(p => p.tools);
  }

  getHooks(): HookDefinition[] {
    return this.plugins
      .filter(p => p.enabled)
      .flatMap(p => p.hooks);
  }

  getCommands(): SlashCommand[] {
    return this.plugins
      .filter(p => p.enabled)
      .flatMap(p => p.commands);
  }

  getMcpServers(): Record<string, { command: string; args: string[] }> {
    const servers: Record<string, { command: string; args: string[] }> = {};
    for (const plugin of this.plugins) {
      if (!plugin.enabled || !plugin.manifest.mcpServers) continue;
      Object.assign(servers, plugin.manifest.mcpServers);
    }
    return servers;
  }
}
