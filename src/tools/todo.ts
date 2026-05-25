import type { Tool } from '../tools/types.js';

interface TodoItem {
  id: number;
  content: string;
  status: 'pending' | 'completed';
  createdAt: string;
}

const todos: TodoItem[] = [];
let nextId = 1;

interface TodoParams {
  todos: Array<{ content: string; status?: 'pending' | 'completed' }>;
}

export const TodoWriteTool: Tool = {
  name: 'todo_write',
  description: `Create and manage a todo list for tracking tasks.
Use this when you need to organize multiple tasks or steps.
Each call replaces the entire todo list.`,
  parameters: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'The complete list of todos',
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The todo content',
            },
            status: {
              type: 'string',
              enum: ['pending', 'completed'],
              description: 'The todo status (default: pending)',
            },
          },
          required: ['content'],
        },
      },
    },
    required: ['todos'],
  },

  async execute(params: Record<string, unknown>) {
    const { todos: newTodos } = params as unknown as TodoParams;

    todos.length = 0;
    nextId = 1;

    for (const todo of newTodos) {
      todos.push({
        id: nextId++,
        content: todo.content,
        status: todo.status || 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    const summary = todos.map(t => `- [${t.status === 'completed' ? 'x' : ' '}] ${t.content}`).join('\n');

    return {
      success: true,
      content: `Todo list updated (${todos.length} items):\n${summary}`,
      metadata: { count: todos.length, todos },
    };
  },
};
