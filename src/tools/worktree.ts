import type { Tool } from '../tools/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { existsSync } from 'fs';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

interface WorktreeToolParams {
  operation: 'list' | 'add' | 'remove' | 'prune' | 'move' | 'lock' | 'unlock';
  path?: string;
  branch?: string;
  new_path?: string;
  force?: boolean;
  detach?: boolean;
}

interface WorktreeEntry {
  path: string;
  branch: string;
  commit: string;
  isBare: boolean;
  isLocked: boolean;
  isDetached: boolean;
}

function validateWorktreePath(projectRoot: string, worktreePath: string): void {
  const absolutePath = path.isAbsolute(worktreePath) ? worktreePath : path.join(projectRoot, worktreePath);
  const normalizedPath = path.resolve(absolutePath);
  const normalizedRoot = path.resolve(projectRoot);

  if (!normalizedPath.startsWith(normalizedRoot)) {
    throw new Error(`Worktree path must be within the project directory: ${worktreePath}`);
  }

  if (normalizedPath === normalizedRoot) {
    throw new Error('Worktree path cannot be the project root directory');
  }
}

function parseWorktreeList(output: string): WorktreeEntry[] {
  const lines = output.trim().split('\n').filter(line => line.trim());
  const worktrees: WorktreeEntry[] = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;

    const wtPath = parts[0];
    const commit = parts[1];
    const branchInfo = parts.slice(2).join(' ');

    const isBare = branchInfo.includes('[bare]');
    const isDetached = branchInfo.includes('detached');
    const isLocked = branchInfo.includes('locked');

    const branch = branchInfo
      .replace(/\[bare\]/g, '')
      .replace(/\[detached\]/g, '')
      .replace(/\[locked\]/g, '')
      .trim();

    worktrees.push({
      path: wtPath,
      branch: branch || 'HEAD',
      commit,
      isBare,
      isLocked,
      isDetached,
    });
  }

  return worktrees;
}

export const WorktreeTool: Tool = {
  name: 'worktree',
  description: `Manage Git worktrees to work on multiple branches simultaneously without stashing or switching.
Use worktrees when you need to:
- Work on multiple branches at the same time
- Test changes while keeping your main working directory clean
- Run builds/tests on different branches concurrently
- Review code in one branch while developing in another

Supported operations:
- list: Show all active worktrees with their branches and commit hashes
- add: Create a new worktree for a branch (creates branch if it doesn't exist with --branch flag)
- remove: Delete a worktree (must be clean, no uncommitted changes)
- prune: Remove stale worktree entries for deleted or moved worktrees
- move: Relocate a worktree to a new path
- lock: Prevent a worktree from being automatically pruned
- unlock: Remove the lock from a worktree`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['list', 'add', 'remove', 'prune', 'move', 'lock', 'unlock'],
        description: 'The worktree operation to perform',
      },
      path: {
        type: 'string',
        description: 'Worktree path (required for add, remove, move, lock, unlock)',
      },
      branch: {
        type: 'string',
        description: 'Branch name for the new worktree (required for add)',
      },
      new_path: {
        type: 'string',
        description: 'New path for the worktree (required for move operation)',
      },
      force: {
        type: 'boolean',
        description: 'Force operation (e.g., create branch even if it exists elsewhere, or remove worktree with uncommitted changes)',
        default: false,
      },
      detach: {
        type: 'boolean',
        description: 'Create worktree with detached HEAD state instead of a branch',
        default: false,
      },
    },
    required: ['operation'],
  },

  async execute(params: Record<string, unknown>) {
    const {
      operation,
      path: worktreePath,
      branch,
      new_path: newPath,
      force = false,
      detach = false,
    } = params as unknown as WorktreeToolParams;

    const projectRoot = process.cwd();
    logger.info(`[WorktreeTool] Executing operation: ${operation}`, { path: worktreePath, branch, force, detach });

    try {
      switch (operation) {
        case 'list':
          return await handleList(projectRoot);

        case 'add':
          return await handleAdd(projectRoot, worktreePath, branch, force, detach);

        case 'remove':
          return await handleRemove(projectRoot, worktreePath, force);

        case 'prune':
          return await handlePrune(projectRoot);

        case 'move':
          return await handleMove(projectRoot, worktreePath, newPath);

        case 'lock':
          return await handleLock(projectRoot, worktreePath);

        case 'unlock':
          return await handleUnlock(projectRoot, worktreePath);

        default:
          return {
            success: false,
            content: `Unknown operation: ${operation}`,
            error: 'INVALID_OPERATION',
          };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[WorktreeTool] Operation failed: ${operation}`, { error: message });
      return {
        success: false,
        content: `Worktree operation failed: ${message}`,
        error: message,
      };
    }
  },
};

async function handleList(projectRoot: string) {
  logger.info('[WorktreeTool] Listing worktrees');

  try {
    const { stdout } = await execAsync('git worktree list', {
      cwd: projectRoot,
      maxBuffer: 1024 * 1024 * 5,
    });

    logger.info('[WorktreeTool] List command output received', { outputLength: stdout.length });

    const worktrees = parseWorktreeList(stdout);
    logger.info('[WorktreeTool] Parsed worktrees', { count: worktrees.length });

    return {
      success: true,
      content: stdout.trim(),
      metadata: { worktrees },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[WorktreeTool] List failed', { error: message });
    throw error;
  }
}

async function handleAdd(
  projectRoot: string,
  worktreePath?: string,
  branch?: string,
  force?: boolean,
  detach?: boolean,
) {
  if (!worktreePath) {
    return { success: false, content: 'Path is required for add operation', error: 'MISSING_PATH' };
  }

  if (!branch && !detach) {
    return { success: false, content: 'Branch name is required for add operation (or use detach: true)', error: 'MISSING_BRANCH' };
  }

  validateWorktreePath(projectRoot, worktreePath);

  logger.info('[WorktreeTool] Adding worktree', { path: worktreePath, branch, force, detach });

  const args = ['git', 'worktree', 'add'];
  if (force) args.push('--force');
  args.push(worktreePath);

  if (detach) {
    args.push('--detach');
    args.push(branch || 'HEAD');
  } else {
    args.push(branch!);
  }

  const command = args.join(' ');
  logger.info('[WorktreeTool] Executing command', { command });

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectRoot,
      maxBuffer: 1024 * 1024 * 5,
    });

    logger.info('[WorktreeTool] Add command completed', { stdout, stderr });

    return {
      success: true,
      content: `Worktree created at ${worktreePath}\n${stdout}${stderr ? `\n${stderr}` : ''}`.trim(),
      metadata: { path: worktreePath, branch: branch || 'HEAD', detached: detach },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[WorktreeTool] Add failed', { error: message });

    if (message.includes('already checked out')) {
      return {
        success: false,
        content: `Branch "${branch}" is already checked out in another worktree. Use a different branch or force option.`,
        error: 'BRANCH_ALREADY_CHECKED_OUT',
      };
    }

    if (message.includes('already exists')) {
      return {
        success: false,
        content: `Path "${worktreePath}" already exists. Choose a different location.`,
        error: 'PATH_ALREADY_EXISTS',
      };
    }

    throw error;
  }
}

async function handleRemove(projectRoot: string, worktreePath?: string, force?: boolean) {
  if (!worktreePath) {
    return { success: false, content: 'Path is required for remove operation', error: 'MISSING_PATH' };
  }

  logger.info('[WorktreeTool] Removing worktree', { path: worktreePath, force });

  const command = `git worktree remove${force ? ' --force' : ''} ${worktreePath}`;
  logger.info('[WorktreeTool] Executing command', { command });

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectRoot,
      maxBuffer: 1024 * 1024 * 5,
    });

    logger.info('[WorktreeTool] Remove command completed', { stdout, stderr });

    return {
      success: true,
      content: `Worktree removed: ${worktreePath}\n${stdout}${stderr ? `\n${stderr}` : ''}`.trim(),
      metadata: { path: worktreePath },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[WorktreeTool] Remove failed', { error: message });

    if (message.includes('not a valid working tree') || message.includes('not found')) {
      return {
        success: false,
        content: `Worktree not found at path: ${worktreePath}`,
        error: 'WORKTREE_NOT_FOUND',
      };
    }

    if (message.includes('dirty') || message.includes('uncommitted')) {
      return {
        success: false,
        content: `Worktree has uncommitted changes. Commit or stash changes first, or use force: true.`,
        error: 'WORKTREE_DIRTY',
      };
    }

    throw error;
  }
}

async function handlePrune(projectRoot: string) {
  logger.info('[WorktreeTool] Pruning stale worktrees');

  try {
    const { stdout, stderr } = await execAsync('git worktree prune', {
      cwd: projectRoot,
      maxBuffer: 1024 * 1024 * 5,
    });

    logger.info('[WorktreeTool] Prune command completed', { stdout, stderr });

    return {
      success: true,
      content: `Stale worktrees pruned.\n${stdout}${stderr ? `\n${stderr}` : ''}`.trim(),
      metadata: { operation: 'prune' },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[WorktreeTool] Prune failed', { error: message });
    throw error;
  }
}

async function handleMove(projectRoot: string, worktreePath?: string, newPath?: string) {
  if (!worktreePath) {
    return { success: false, content: 'Path (old location) is required for move operation', error: 'MISSING_PATH' };
  }

  if (!newPath) {
    return { success: false, content: 'New path is required for move operation', error: 'MISSING_NEW_PATH' };
  }

  validateWorktreePath(projectRoot, newPath);

  logger.info('[WorktreeTool] Moving worktree', { oldPath: worktreePath, newPath });

  const command = `git worktree move ${worktreePath} ${newPath}`;
  logger.info('[WorktreeTool] Executing command', { command });

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectRoot,
      maxBuffer: 1024 * 1024 * 5,
    });

    logger.info('[WorktreeTool] Move command completed', { stdout, stderr });

    return {
      success: true,
      content: `Worktree moved from ${worktreePath} to ${newPath}\n${stdout}${stderr ? `\n${stderr}` : ''}`.trim(),
      metadata: { oldPath: worktreePath, newPath },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[WorktreeTool] Move failed', { error: message });

    if (message.includes('not a valid working tree') || message.includes('not found')) {
      return {
        success: false,
        content: `Worktree not found at path: ${worktreePath}`,
        error: 'WORKTREE_NOT_FOUND',
      };
    }

    throw error;
  }
}

async function handleLock(projectRoot: string, worktreePath?: string) {
  if (!worktreePath) {
    return { success: false, content: 'Path is required for lock operation', error: 'MISSING_PATH' };
  }

  logger.info('[WorktreeTool] Locking worktree', { path: worktreePath });

  const command = `git worktree lock ${worktreePath}`;
  logger.info('[WorktreeTool] Executing command', { command });

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectRoot,
      maxBuffer: 1024 * 1024 * 5,
    });

    logger.info('[WorktreeTool] Lock command completed', { stdout, stderr });

    return {
      success: true,
      content: `Worktree locked: ${worktreePath}\n${stdout}${stderr ? `\n${stderr}` : ''}`.trim(),
      metadata: { path: worktreePath, isLocked: true },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[WorktreeTool] Lock failed', { error: message });

    if (message.includes('not a valid working tree') || message.includes('not found')) {
      return {
        success: false,
        content: `Worktree not found at path: ${worktreePath}`,
        error: 'WORKTREE_NOT_FOUND',
      };
    }

    if (message.includes('already locked')) {
      return {
        success: false,
        content: `Worktree is already locked: ${worktreePath}`,
        error: 'ALREADY_LOCKED',
      };
    }

    throw error;
  }
}

async function handleUnlock(projectRoot: string, worktreePath?: string) {
  if (!worktreePath) {
    return { success: false, content: 'Path is required for unlock operation', error: 'MISSING_PATH' };
  }

  logger.info('[WorktreeTool] Unlocking worktree', { path: worktreePath });

  const command = `git worktree unlock ${worktreePath}`;
  logger.info('[WorktreeTool] Executing command', { command });

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectRoot,
      maxBuffer: 1024 * 1024 * 5,
    });

    logger.info('[WorktreeTool] Unlock command completed', { stdout, stderr });

    return {
      success: true,
      content: `Worktree unlocked: ${worktreePath}\n${stdout}${stderr ? `\n${stderr}` : ''}`.trim(),
      metadata: { path: worktreePath, isLocked: false },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[WorktreeTool] Unlock failed', { error: message });

    if (message.includes('not a valid working tree') || message.includes('not found')) {
      return {
        success: false,
        content: `Worktree not found at path: ${worktreePath}`,
        error: 'WORKTREE_NOT_FOUND',
      };
    }

    if (message.includes('not locked')) {
      return {
        success: false,
        content: `Worktree is not locked: ${worktreePath}`,
        error: 'NOT_LOCKED',
      };
    }

    throw error;
  }
}
