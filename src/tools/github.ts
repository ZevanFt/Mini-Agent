import type { Tool } from '../tools/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface GithubToolParams {
  action: 'create-issue' | 'create-pr' | 'list-issues' | 'list-prs';
  title?: string;
  body?: string;
  base?: string;
  head?: string;
  labels?: string;
  assignee?: string;
  milestone?: string;
}

async function runGhCommand(cmd: string): Promise<{ success: boolean; content: string; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      maxBuffer: 1024 * 1024 * 5,
    });
    return {
      success: true,
      content: stdout.trim() || stderr.trim() || 'Command executed successfully with no output',
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        success: false,
        content: `Error: ${error.message}`,
        error: error.message,
      };
    }
    return {
      success: false,
      content: 'Unknown error occurred',
      error: 'Unknown error',
    };
  }
}

export const GithubTool: Tool = {
  name: 'github',
  description: `Interact with GitHub repositories using gh CLI.
Actions:
- create-issue: Create a new GitHub issue
- create-pr: Create a new pull request
- list-issues: List issues in the repository
- list-prs: List pull requests in the repository

Requires gh CLI to be installed and authenticated.`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: ['create-issue', 'create-pr', 'list-issues', 'list-prs'],
      },
      title: {
        type: 'string',
        description: 'Title for issue or PR (required for create-issue, create-pr)',
      },
      body: {
        type: 'string',
        description: 'Body/description for issue or PR (optional)',
      },
      base: {
        type: 'string',
        description: 'Base branch for PR (required for create-pr, default: main)',
        default: 'main',
      },
      head: {
        type: 'string',
        description: 'Head branch for PR (required for create-pr)',
      },
      labels: {
        type: 'string',
        description: 'Comma-separated list of labels (optional)',
      },
      assignee: {
        type: 'string',
        description: 'Assignee username (optional)',
      },
      milestone: {
        type: 'string',
        description: 'Milestone name (optional)',
      },
    },
    required: ['action'],
  },

  async execute(params: Record<string, unknown>) {
    const { action, title, body, base, head, labels, assignee, milestone } = params as unknown as GithubToolParams;

    switch (action) {
      case 'create-issue': {
        if (!title) {
          return { success: false, content: 'Error: title is required for create-issue', error: 'Missing title' };
        }
        let cmd = `gh issue create --title "${title.replace(/"/g, '\\"')}"`;
        if (body) cmd += ` --body "${body.replace(/"/g, '\\"')}"`;
        if (labels) cmd += ` --label "${labels.replace(/"/g, '\\"')}"`;
        if (assignee) cmd += ` --assignee "${assignee}"`;
        if (milestone) cmd += ` --milestone "${milestone}"`;
        return await runGhCommand(cmd);
      }

      case 'create-pr': {
        if (!title || !head) {
          return { success: false, content: 'Error: title and head are required for create-pr', error: 'Missing required parameters' };
        }
        const baseBranch = base || 'main';
        let cmd = `gh pr create --title "${title.replace(/"/g, '\\"')}" --base "${baseBranch}" --head "${head}"`;
        if (body) cmd += ` --body "${body.replace(/"/g, '\\"')}"`;
        if (labels) cmd += ` --label "${labels.replace(/"/g, '\\"')}"`;
        if (assignee) cmd += ` --assignee "${assignee}"`;
        if (milestone) cmd += ` --milestone "${milestone}"`;
        return await runGhCommand(cmd);
      }

      case 'list-issues': {
        return await runGhCommand('gh issue list');
      }

      case 'list-prs': {
        return await runGhCommand('gh pr list');
      }

      default: {
        return { success: false, content: `Error: Unknown action "${action}"`, error: 'Unknown action' };
      }
    }
  },
};
