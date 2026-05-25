export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskResult {
  summary: string;
  output?: string;
  filesModified?: string[];
  tokensUsed?: number;
  duration?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
  createdBy: 'user' | 'agent';
  parentId?: string;
  children: string[];
  assignedAgent?: string;
  result?: TaskResult;
  tags?: string[];
  dueDate?: string;
}

export interface CreateTaskParams {
  title: string;
  description?: string;
  priority?: TaskPriority;
  parentId?: string;
  tags?: string[];
}

export interface UpdateTaskParams {
  status?: TaskStatus;
  result?: Partial<TaskResult>;
  description?: string;
  priority?: TaskPriority;
}

export interface ListTasksFilter {
  status?: TaskStatus | 'all';
  priority?: TaskPriority;
  assignedToMe?: boolean;
  limit?: number;
  includeChildren?: boolean;
}
