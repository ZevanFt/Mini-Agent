import { spawn } from 'child_process';

export interface ClipboardBackend {
  write(text: string): Promise<void>;
  read(): Promise<string>;
}

function detectBackend(): { writeBin: string; writeArgs: string[]; readBin: string; readArgs: string[] } {
  switch (process.platform) {
    case 'win32':
      return {
        writeBin: 'powershell.exe',
        writeArgs: ['-NoProfile', '-Command', 'Set-Clipboard'],
        readBin: 'powershell.exe',
        readArgs: ['-NoProfile', '-Command', 'Get-Clipboard'],
      };
    case 'darwin':
      return {
        writeBin: 'pbcopy',
        writeArgs: [],
        readBin: 'pbpaste',
        readArgs: [],
      };
    default:
      return {
        writeBin: 'xclip',
        writeArgs: ['-selection', 'clipboard'],
        readBin: 'xclip',
        readArgs: ['-selection', 'clipboard', '-o'],
      };
  }
}

function runCommand(bin: string, args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `clipboard command exited with ${code}`));
    });
    if (stdin !== undefined) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

export function createClipboard(): ClipboardBackend {
  const backend = detectBackend();
  return {
    write: async (text: string) => { await runCommand(backend.writeBin, backend.writeArgs, text); },
    read: () => runCommand(backend.readBin, backend.readArgs),
  };
}

let globalClipboard: ClipboardBackend | null = null;

export function getClipboard(): ClipboardBackend {
  if (!globalClipboard) globalClipboard = createClipboard();
  return globalClipboard;
}

export async function copyToClipboard(text: string): Promise<void> {
  return getClipboard().write(text);
}

export async function readClipboard(): Promise<string> {
  return getClipboard().read();
}

export async function safeCopy(text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await copyToClipboard(text);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function safeRead(): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const text = await readClipboard();
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
