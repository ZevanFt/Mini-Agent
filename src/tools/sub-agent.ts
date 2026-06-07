import type { Tool } from '../tools/types.js';
import type { LLMAdapter, Message } from '../llm/base.js';

interface SubAgentOptions {
  llm: LLMAdapter;
  name: string;
  task: string;
  systemPrompt?: string;
  tools?: Tool[];
  maxIterations?: number;
  cwd?: string;
}

interface SubAgentResult {
  success: boolean;
  agentName: string;
  summary: string;
  iterations: number;
  output: string;
}

interface AgentToolParams {
  task: string;
  agent_name: string;
  system_prompt?: string;
  tools?: string[];
  max_iterations?: number;
}

export class SubAgent {
  private llm: LLMAdapter;
  private name: string;
  private systemPrompt: string;
  private maxIterations: number;
  private messages: Message[] = [];
  private output: string = '';

  constructor(options: SubAgentOptions) {
    this.llm = options.llm;
    this.name = options.name;
    this.systemPrompt = options.systemPrompt || `You are a sub-agent named "${options.name}".
Your task is: ${options.task}
Complete the task fully and report back with a summary.`;
    this.maxIterations = options.maxIterations || 15;
    this.messages = [{ role: 'user', content: options.task }];
  }

  getName(): string {
    return this.name;
  }

  getOutput(): string {
    return this.output;
  }

  async run(): Promise<SubAgentResult> {
    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;

      let hasToolCalls = false;
      let assistantContent = '';

      for await (const chunk of this.llm.chat({
        messages: this.messages,
        systemPrompt: this.systemPrompt,
      })) {
        if (chunk.type === 'content' && chunk.content) {
          assistantContent += chunk.content;
          this.output += chunk.content;
        }

        if (chunk.type === 'tool_call') {
          hasToolCalls = true;
        }

        if (chunk.type === 'done') {
          if (assistantContent) {
            this.messages.push({ role: 'assistant', content: assistantContent });
          }
          if (!hasToolCalls) {
            return {
              success: true,
              agentName: this.name,
              summary: assistantContent,
              iterations: iteration,
              output: this.output,
            };
          }
        }
      }

      if (!hasToolCalls) {
        break;
      }
    }

    return {
      success: true,
      agentName: this.name,
      summary: this.output,
      iterations: iteration,
      output: this.output,
    };
  }
}

export function createAgentTool(
  createSubAgent: (options: SubAgentOptions) => Promise<SubAgentResult>,
): Tool {
  return {
    name: 'agent',
    description: `Spawn a sub-agent to handle a specific task.
Use this when:
- The task is complex and can be delegated
- You need specialized knowledge in a specific domain
- You want to parallelize work
- The task is independent and can be completed autonomously

The sub-agent will have its own context and can use tools.
It will run to completion and return a summary.`,
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The task description for the sub-agent',
        },
        agent_name: {
          type: 'string',
          description: 'Identifier for this agent (e.g., "researcher", "coder")',
        },
        system_prompt: {
          type: 'string',
          description: 'Additional system prompt for this agent',
        },
        max_iterations: {
          type: 'number',
          description: 'Maximum number of iterations (default: 15)',
        },
      },
      required: ['task', 'agent_name'],
    },

    async execute(params: Record<string, unknown>) {
      const { task, agent_name: agentName, system_prompt: systemPrompt, max_iterations: maxIterations } = params as unknown as AgentToolParams;

      try {
        const result = await createSubAgent({
          llm: {} as any,
          name: agentName,
          task,
          systemPrompt,
          maxIterations,
        });

        return {
          success: true,
          content: `Sub-agent "${agentName}" completed:\n${result.summary}`,
          metadata: {
            agentName: result.agentName,
            iterations: result.iterations,
            summary: result.summary,
          },
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          content: `Sub-agent "${agentName}" failed: ${message}`,
          error: message,
        };
      }
    },
  };
}
