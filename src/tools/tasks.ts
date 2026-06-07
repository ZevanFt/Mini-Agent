import type { Tool } from '../tools/types.js';
import { TaskManager } from '../tasks/index.js';
import type { CreateTaskParams } from '../tasks/types.js';

export function createTaskTools(taskManager: TaskManager): Tool[] {
  return [
    {
      name: 'task_create',
      description: `Create a new task to track work items.
Use this when you need to break down a complex request into multiple steps.
Each task has a title, description, priority, and status.`,
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The task title',
          },
          description: {
            type: 'string',
            description: 'Detailed task description',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Task priority (default: medium)',
          },
          parent_id: {
            type: 'string',
            description: 'Parent task ID for subtasks',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Task tags',
          },
        },
        required: ['title'],
      },

      async execute(params: Record<string, unknown>) {
        const { title, description, priority, parent_id: parentId, tags } = params as unknown as CreateTaskParams & { parent_id?: string };

        const task = await taskManager.create({
          title,
          description,
          priority: priority as any,
          parentId,
          tags,
        });

        return {
          success: true,
          content: `Task created: ${task.id}\nTitle: ${task.title}\nPriority: ${task.priority}\nStatus: ${task.status}`,
          metadata: { task },
        };
      },
    },

    {
      name: 'task_list',
      description: `List all tasks with optional filtering.
Use this to see what tasks are pending, in progress, or completed.`,
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled', 'all'],
            description: 'Filter by status (default: all)',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Filter by priority',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of tasks to return (default: 50)',
          },
        },
      },

      async execute(params: Record<string, unknown>) {
        const { status = 'all', priority, limit = 50 } = params as { status?: string; priority?: string; limit?: number };

        const tasks = taskManager.list({
          status: status as any,
          priority: priority as any,
          limit,
        });

        if (tasks.length === 0) {
          return {
            success: true,
            content: 'No tasks found',
            metadata: { count: 0 },
          };
        }

        const summary = tasks.map(t => {
          const statusIcon = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : t.status === 'failed' ? '❌' : '⏳';
          const priorityIcon = t.priority === 'urgent' ? '🔴' : t.priority === 'high' ? '🟠' : t.priority === 'medium' ? '🟡' : '🟢';
          return `${statusIcon} ${priorityIcon} [${t.id}] ${t.title} (${t.priority})`;
        }).join('\n');

        return {
          success: true,
          content: `${tasks.length} tasks:\n${summary}`,
          metadata: { count: tasks.length, tasks },
        };
      },
    },

    {
      name: 'task_update',
      description: `Update a task's status, description, or result.
Use this when completing a task, marking it as failed, or adding notes.`,
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'The task ID to update',
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
            description: 'New task status',
          },
          description: {
            type: 'string',
            description: 'Updated task description',
          },
          result_summary: {
            type: 'string',
            description: 'Summary of the task result',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Updated priority',
          },
        },
        required: ['task_id'],
      },

      async execute(params: Record<string, unknown>) {
        const { task_id: taskId, status, description, result_summary: resultSummary, priority } = params as { task_id: string; status?: string; description?: string; result_summary?: string; priority?: string };

        const task = taskManager.get(taskId);
        if (!task) {
          return {
            success: false,
            content: `Task not found: ${taskId}`,
            error: 'TASK_NOT_FOUND',
          };
        }

        const updateParams: any = {};
        if (status) updateParams.status = status;
        if (description) updateParams.description = description;
        if (priority) updateParams.priority = priority;
        if (resultSummary) updateParams.result = { summary: resultSummary };

        const updated = await taskManager.update(taskId, updateParams);

        if (!updated) {
          return {
            success: false,
            content: 'Failed to update task',
            error: 'UPDATE_FAILED',
          };
        }

        return {
          success: true,
          content: `Task ${taskId} updated:\nTitle: ${updated.title}\nStatus: ${updated.status}`,
          metadata: { task: updated },
        };
      },
    },

    {
      name: 'task_get',
      description: `Get details of a specific task.
Use this when you need to see the full information about a task.`,
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'The task ID to get',
          },
        },
        required: ['task_id'],
      },

      async execute(params: Record<string, unknown>) {
        const { task_id: taskId } = params as { task_id: string };

        const task = taskManager.get(taskId);
        if (!task) {
          return {
            success: false,
            content: `Task not found: ${taskId}`,
            error: 'TASK_NOT_FOUND',
          };
        }

        const details = [
          `ID: ${task.id}`,
          `Title: ${task.title}`,
          `Description: ${task.description}`,
          `Status: ${task.status}`,
          `Priority: ${task.priority}`,
          `Created: ${task.createdAt}`,
          `Updated: ${task.updatedAt}`,
          ...(task.tags && task.tags.length > 0 ? [`Tags: ${task.tags.join(', ')}`] : []),
          ...(task.children.length > 0 ? [`Children: ${task.children.join(', ')}`] : []),
          ...(task.result ? [`Result: ${task.result.summary}`] : []),
        ].join('\n');

        return {
          success: true,
          content: details,
          metadata: { task },
        };
      },
    },
  ];
}
