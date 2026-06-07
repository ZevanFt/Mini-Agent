import { execSync, spawn } from 'child_process';
import chalk from 'chalk';

const RECOMMENDED_MODELS = {
  small: 'qwen2.5-coder:3b',
  medium: 'qwen2.5-coder:7b',
  large: 'qwen2.5-coder:14b',
  coding: 'deepseek-coder-v2',
};

function checkOllamaReady(): boolean {
  try {
    execSync('ollama --version', { stdio: 'ignore' });
  } catch {
    console.log(chalk.red('❌ Ollama is not installed!'));
    console.log(chalk.yellow('💡 Run `miniagent install ollama` first'));
    console.log();
    return false;
  }

  try {
    execSync('ollama list', { stdio: 'pipe' });
  } catch {
    console.log(chalk.red('❌ Ollama server is not running!'));
    console.log(chalk.yellow('💡 Start Ollama first (e.g., run `ollama serve`)'));
    console.log();
    return false;
  }

  return true;
}

export async function pullModel(modelName: string): Promise<void> {
  console.log(chalk.cyan.bold(`\n📥 Installing Model: ${modelName}\n`));

  if (!checkOllamaReady()) {
    return;
  }

  console.log(chalk.dim('Pulling model from Ollama registry...'));
  console.log(chalk.dim('(This may take a while depending on model size and network speed)\n'));

  try {
    const child = spawn('ollama', ['pull', modelName], {
      stdio: 'inherit',
      shell: false,
    });

    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green(`\n✅ Model ${modelName} installed successfully!`));
          console.log(chalk.dim(`  Start chatting: miniagent chat --model ${modelName}\n`));
          resolve();
        } else {
          reject(new Error(`Model pull failed with exit code ${code}`));
        }
      });
      child.on('error', reject);
    });
  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to install model ${modelName}!`));
    console.log(chalk.yellow('\n💡 Suggestions:'));
    console.log(chalk.dim('  • Check your network connection'));
    console.log(chalk.dim('  • Verify the model name: ollama.com/search'));
    console.log(chalk.dim(`  • Try a smaller model: ${RECOMMENDED_MODELS.small}`));
    console.log();
    throw error;
  }
}

export function listModels(): void {
  console.log(chalk.cyan.bold('\n📚 Installed Models\n'));

  if (!checkOllamaReady()) {
    return;
  }

  try {
    const output = execSync('ollama list', { encoding: 'utf-8' });
    const lines = output.trim().split('\n').filter(line => line.trim() && !line.startsWith('NAME'));

    if (lines.length === 0) {
      console.log(chalk.yellow('  No models installed'));
      console.log(chalk.dim(`\n  Recommended: miniagent models pull ${RECOMMENDED_MODELS.small}\n`));
      return;
    }

    console.log(chalk.dim(`  ${lines.length} model(s) installed:\n`));

    for (const line of lines) {
      const parts = line.split(/\s+/);
      const name = parts[0] || '';
      const size = parts[1] || '';
      const modified = parts.slice(2).join(' ');

      console.log(chalk.green(`  ${name}`));
      console.log(chalk.dim(`    Size: ${size} | Modified: ${modified}\n`));
    }

    console.log(chalk.yellow('💡 Install a new model:'));
    console.log(chalk.green(`  miniagent models pull ${RECOMMENDED_MODELS.small}\n`));
  } catch (error) {
    console.log(chalk.red('❌ Failed to list models!'));
    console.log(chalk.dim(`  Error: ${error instanceof Error ? error.message : String(error)}\n`));
  }
}

export function removeModel(modelName: string): void {
  console.log(chalk.cyan.bold(`\n🗑️  Removing Model: ${modelName}\n`));

  if (!checkOllamaReady()) {
    return;
  }

  try {
    execSync(`ollama rm ${modelName}`, { stdio: 'inherit' });
    console.log(chalk.green(`\n✅ Model ${modelName} removed successfully!\n`));
  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to remove model ${modelName}!`));
    console.log(chalk.dim(`  Error: ${error instanceof Error ? error.message : String(error)}\n`));
  }
}

export function showRecommendedModels(): void {
  console.log(chalk.cyan.bold('\n🎯 Recommended Models\n'));

  console.log(chalk.yellow('For coding tasks:'));
  console.log(chalk.green(`  • ${RECOMMENDED_MODELS.small} (3B, fast, low memory)`));
  console.log(chalk.green(`  • ${RECOMMENDED_MODELS.medium} (7B, balanced)`));
  console.log(chalk.green(`  • ${RECOMMENDED_MODELS.large} (14B, powerful, needs 16GB+ RAM)`));
  console.log(chalk.green(`  • ${RECOMMENDED_MODELS.coding} (specialized for code)`));

  console.log();
  console.log(chalk.yellow('Install a model:'));
  console.log(chalk.green(`  miniagent models pull ${RECOMMENDED_MODELS.small}\n`));

  console.log(chalk.yellow('Search for more models:'));
  console.log(chalk.green('  Visit: https://ollama.com/search\n'));
}
