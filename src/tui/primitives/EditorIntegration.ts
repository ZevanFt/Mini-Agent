import { spawn } from 'child_process';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';

export interface EditorResult {
  content: string;
  cancelled: boolean;
}

export async function openEditor(initialContent = '', filename = 'prompt'): Promise<EditorResult> {
  const editor = process.env.VISUAL || process.env.EDITOR || 'vim';
  const tmpDir = path.join(os.tmpdir(), 'miniagent-editor');
  await mkdir(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `${filename}-${Date.now()}.md`);

  try {
    await writeFile(tmpFile, initialContent, 'utf8');

    return new Promise((resolve) => {
      const child = spawn(editor, [tmpFile], {
        stdio: 'inherit',
        shell: true,
      });

      child.on('close', async (code) => {
        try {
          if (code === 0) {
            const content = await readFile(tmpFile, 'utf8');
            resolve({ content, cancelled: content === initialContent });
          } else {
            resolve({ content: initialContent, cancelled: true });
          }
        } catch {
          resolve({ content: initialContent, cancelled: true });
        } finally {
          try { await unlink(tmpFile); } catch { /* ignore */ }
        }
      });

      child.on('error', async () => {
        try { await unlink(tmpFile); } catch { /* ignore */ }
        resolve({ content: initialContent, cancelled: true });
      });
    });
  } catch {
    return { content: initialContent, cancelled: true };
  }
}
