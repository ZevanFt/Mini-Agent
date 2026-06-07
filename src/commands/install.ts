import { execSync, spawn } from 'child_process';
import chalk from 'chalk';
import os from 'os';

interface PlatformInfo {
  os: 'windows' | 'macos' | 'linux';
  arch: string;
}

function detectPlatform(): PlatformInfo {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'win32') {
    return { os: 'windows', arch };
  }
  if (platform === 'darwin') {
    return { os: 'macos', arch };
  }
  return { os: 'linux', arch };
}

export async function installOllama(): Promise<void> {
  const platform = detectPlatform();

  console.log(chalk.cyan.bold('\n📦 Installing Ollama\n'));
  console.log(chalk.dim(`  Platform: ${platform.os} (${platform.arch})`));

  if (platform.os === 'windows') {
    await installOllamaWindows();
  } else if (platform.os === 'macos') {
    await installOllamaMacOS();
  } else {
    await installOllamaLinux();
  }
}

async function installOllamaWindows(): Promise<void> {
  console.log(chalk.yellow('\n🪟 Windows Installation\n'));

  try {
    execSync('ollama --version', { stdio: 'ignore' });
    console.log(chalk.green('✅ Ollama is already installed!'));
    console.log(chalk.dim('  To install a model: miniagent install model <name>\n'));
    return;
  } catch {
    // Not installed
  }

  console.log(chalk.cyan('Downloading Ollama for Windows...'));
  console.log(chalk.dim('  Official URL: https://ollama.com/download/OllamaSetup.exe'));
  console.log();

  console.log(chalk.yellow('💡 Instructions:'));
  console.log(chalk.dim('  1. Visit: https://ollama.com/download'));
  console.log(chalk.dim('  2. Download OllamaSetup.exe'));
  console.log(chalk.dim('  3. Run the installer'));
  console.log(chalk.dim('  4. After installation: miniagent install model qwen2.5-coder:3b'));
  console.log();

  console.log(chalk.dim('Or use PowerShell:'));
  console.log(chalk.green('  Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile "OllamaSetup.exe"'));
  console.log(chalk.green('  Start-Process -FilePath ".\\OllamaSetup.exe" -Wait'));
  console.log();
}

async function installOllamaMacOS(): Promise<void> {
  console.log(chalk.yellow('\n🍎 macOS Installation\n'));

  try {
    execSync('ollama --version', { stdio: 'ignore' });
    console.log(chalk.green('✅ Ollama is already installed!'));
    console.log(chalk.dim('  To install a model: miniagent install model <name>\n'));
    return;
  } catch {
    // Not installed
  }

  console.log(chalk.cyan('Installing Ollama via official installer...'));
  console.log();

  try {
    console.log(chalk.dim('Running: curl -fsSL https://ollama.com/install.sh | sh'));
    const child = spawn('sh', ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'], {
      stdio: 'inherit',
      shell: true,
    });

    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('\n✅ Ollama installed successfully!'));
          resolve();
        } else {
          reject(new Error(`Installation failed with exit code ${code}`));
        }
      });
      child.on('error', reject);
    });
  } catch (error) {
    console.log(chalk.red('\n❌ Installation failed!'));
    console.log(chalk.yellow('\n💡 Manual installation:'));
    console.log(chalk.dim('  1. Visit: https://ollama.com/download'));
    console.log(chalk.dim('  2. Download the macOS installer'));
    console.log(chalk.dim('  3. Run the .dmg file'));
    console.log();
    throw error;
  }
}

async function installOllamaLinux(): Promise<void> {
  console.log(chalk.yellow('\n🐧 Linux Installation\n'));

  try {
    execSync('ollama --version', { stdio: 'ignore' });
    console.log(chalk.green('✅ Ollama is already installed!'));
    console.log(chalk.dim('  To install a model: miniagent install model <name>\n'));
    return;
  } catch {
    // Not installed
  }

  console.log(chalk.cyan('Installing Ollama via official script...'));
  console.log();

  try {
    console.log(chalk.dim('Running: curl -fsSL https://ollama.com/install.sh | sh'));
    const child = spawn('sh', ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'], {
      stdio: 'inherit',
      shell: true,
    });

    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('\n✅ Ollama installed successfully!'));
          resolve();
        } else {
          reject(new Error(`Installation failed with exit code ${code}`));
        }
      });
      child.on('error', reject);
    });
  } catch (error) {
    console.log(chalk.red('\n❌ Installation failed!'));
    console.log(chalk.yellow('\n💡 Manual installation:'));
    console.log(chalk.dim('  1. Run: curl -fsSL https://ollama.com/install.sh | sh'));
    console.log(chalk.dim('  2. Or visit: https://ollama.com/download/linux'));
    console.log();
    throw error;
  }
}
