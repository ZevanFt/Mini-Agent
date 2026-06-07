import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

interface DoctorCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  detail?: string;
}

const OLLAMA_MIN_VERSION = '0.5.0';

export async function runDoctor(): Promise<void> {
  console.log(chalk.cyan.bold('\n🔍 MiniAgent Doctor - Environment Check\n'));

  const checks: DoctorCheck[] = [];

  // 1. Check Ollama installed
  checks.push(checkOllamaInstalled());

  // 2. Check Ollama running
  if (checks[0].status === 'pass') {
    checks.push(checkOllamaRunning());
  } else {
    checks.push({
      name: 'Ollama Server',
      status: 'fail',
      message: 'Ollama is not installed',
    });
  }

  // 3. Check Ollama version
  if (checks[0].status === 'pass') {
    checks.push(checkOllamaVersion());
  }

  // 4. Check installed models
  checks.push(checkInstalledModels());

  // 5. Check .miniagent config
  checks.push(checkMiniAgentConfig());

  // 6. Check Node.js version
  checks.push(checkNodeVersion());

  // Print results
  for (const check of checks) {
    const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
    const color = check.status === 'pass' ? chalk.green : check.status === 'fail' ? chalk.red : chalk.yellow;
    console.log(`${color(icon)} ${check.name}: ${check.message}`);
    if (check.detail) {
      console.log(chalk.dim(`   ${check.detail}\n`));
    }
  }

  // Summary
  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;

  console.log(chalk.dim('\n' + '─'.repeat(50)));
  console.log(chalk.green(`${passCount} passed`) + chalk.dim(' | ') + chalk.yellow(`${warnCount} warnings`) + chalk.dim(' | ') + chalk.red(`${failCount} failed`));

  if (failCount === 0) {
    console.log(chalk.green('\n✅ Environment is ready!\n'));
  } else {
    console.log(chalk.yellow('\n💡 Suggestions:'));
    if (checks[0].status === 'fail') {
      console.log(chalk.dim('  • Run `miniagent install ollama` to install Ollama'));
    }
    if (checks[1]?.status === 'fail') {
      console.log(chalk.dim('  • Start Ollama service (e.g., `ollama serve`)'));
    }
    if (checks[3]?.status === 'warn') {
      console.log(chalk.dim('  • Run `miniagent install model <name>` to download a model'));
    }
    console.log();
  }
}

function checkOllamaInstalled(): DoctorCheck {
  try {
    execSync('ollama --version', { stdio: 'ignore' });
    return {
      name: 'Ollama CLI',
      status: 'pass',
      message: 'Ollama is installed',
    };
  } catch {
    return {
      name: 'Ollama CLI',
      status: 'fail',
      message: 'Ollama is not installed',
    };
  }
}

function checkOllamaRunning(): DoctorCheck {
  try {
    execSync('ollama list', { stdio: 'pipe', encoding: 'utf-8' });
    return {
      name: 'Ollama Server',
      status: 'pass',
      message: 'Ollama server is running',
    };
  } catch {
    return {
      name: 'Ollama Server',
      status: 'fail',
      message: 'Ollama server is not running',
    };
  }
}

function checkOllamaVersion(): DoctorCheck {
  try {
    const output = execSync('ollama --version', { encoding: 'utf-8' }).trim();
    const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
    if (!versionMatch) {
      return {
        name: 'Ollama Version',
        status: 'warn',
        message: `Cannot parse version: ${output}`,
      };
    }

    const version = versionMatch[1];
    const minVer = OLLAMA_MIN_VERSION;
    const isNewer = compareVersions(version, minVer) >= 0;

    return {
      name: 'Ollama Version',
      status: isNewer ? 'pass' : 'warn',
      message: version,
      detail: isNewer ? `Version >= ${minVer} (recommended)` : `Version < ${minVer}, consider upgrading`,
    };
  } catch (error) {
    return {
      name: 'Ollama Version',
      status: 'warn',
      message: `Cannot check version: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function checkInstalledModels(): DoctorCheck {
  try {
    const output = execSync('ollama list', { encoding: 'utf-8' });
    const lines = output.trim().split('\n').filter(line => line.trim() && !line.startsWith('NAME'));

    if (lines.length === 0) {
      return {
        name: 'Models',
        status: 'warn',
        message: 'No models installed',
        detail: 'Run `miniagent install model <name>` to download one (e.g., qwen2.5-coder:3b)',
      };
    }

    return {
      name: 'Models',
      status: 'pass',
      message: `${lines.length} model(s) installed`,
      detail: lines.slice(0, 3).map(l => l.split(/\s+/)[0]).join(', ') + (lines.length > 3 ? ` +${lines.length - 3} more` : ''),
    };
  } catch {
    return {
      name: 'Models',
      status: 'fail',
      message: 'Cannot list models',
    };
  }
}

function checkMiniAgentConfig(): DoctorCheck {
  const miniagentDir = path.join(process.cwd(), '.miniagent');
  const configFile = path.join(miniagentDir, 'agents.json');

  if (!fs.existsSync(miniagentDir)) {
    return {
      name: '.miniagent',
      status: 'warn',
      message: '.miniagent directory not found',
      detail: 'Run `miniagent init` to create default config',
    };
  }

  if (fs.existsSync(configFile)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      return {
        name: '.miniagent',
        status: 'pass',
        message: 'Configuration file found',
        detail: config.model ? `Model: ${config.model}` : 'No model specified',
      };
    } catch {
      return {
        name: '.miniagent',
        status: 'warn',
        message: 'Configuration file is invalid JSON',
      };
    }
  }

  return {
    name: '.miniagent',
    status: 'warn',
    message: 'agents.json not found',
    detail: 'Run `miniagent init` to create default config',
  };
}

function checkNodeVersion(): DoctorCheck {
  const version = process.version;
  const major = parseInt(version.slice(1), 10);

  if (major >= 18) {
    return {
      name: 'Node.js',
      status: 'pass',
      message: version,
    };
  }

  return {
    name: 'Node.js',
    status: 'warn',
    message: `${version} (Node.js 18+ recommended)`,
  };
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const valA = partsA[i] || 0;
    const valB = partsB[i] || 0;
    if (valA > valB) return 1;
    if (valA < valB) return -1;
  }

  return 0;
}
