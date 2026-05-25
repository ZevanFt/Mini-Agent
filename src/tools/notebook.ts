/**
 * NotebookTool - Jupyter Notebook 编辑与执行工具
 *
 * 支持操作:
 * - read: 读取 .ipynb 文件，返回单元格数量、类型、内容预览
 * - execute_cell: 执行指定单元格（通过 jupyter nbconvert --execute）
 * - edit_cell: 编辑指定单元格内容
 * - add_cell: 在指定位置添加新单元格
 * - delete_cell: 删除指定单元格
 * - get_output: 获取单元格执行输出
 */

import type { Tool, ToolResult } from '../tools/types.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string;
  execution_count?: number | null;
  outputs?: Array<{
    output_type: string;
    text?: string;
    data?: Record<string, unknown>;
    name?: string;
    evalue?: string;
    ename?: string;
  }>;
}

export interface NotebookData {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

interface NotebookToolParams {
  operation: 'read' | 'execute_cell' | 'edit_cell' | 'add_cell' | 'delete_cell' | 'get_output';
  file_path: string;
  cell_index?: number;
  source?: string;
  cell_type?: 'code' | 'markdown' | 'raw';
  max_preview_chars?: number;
}

function readNotebook(filePath: string): NotebookData {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as NotebookData;
}

function writeNotebook(filePath: string, data: NotebookData): void {
  writeFileSync(filePath, JSON.stringify(data, null, 1), 'utf-8');
}

function resolvePath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
}

function formatCellPreview(cell: NotebookCell, maxChars: number): string {
  const src = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
  if (src.length <= maxChars) return src;
  return src.substring(0, maxChars) + '\n... (content truncated)';
}

function formatOutputs(cell: NotebookCell): string {
  if (!cell.outputs || cell.outputs.length === 0) return '(no output)';

  return cell.outputs
    .map((out, i) => {
      switch (out.output_type) {
        case 'stream':
          return `[stream:${out.name || 'stdout'}] ${Array.isArray(out.text) ? out.text.join('') : (out.text || '')}`;
        case 'execute_result':
        case 'display_data': {
          const data = out.data as Record<string, unknown> | undefined;
          if (data?.['text/plain']) {
            return `[result] ${Array.isArray(data['text/plain']) ? (data['text/plain'] as string[]).join('') : String(data['text/plain'])}`;
          }
          if (data?.['text/html']) {
            return `[html output]`;
          }
          if (data?.['image/png']) {
            return `[image/png output]`;
          }
          return `[result] (complex output)`;
        }
        case 'error':
          return `[error] ${out.ename}: ${out.evalue}`;
        default:
          return `[${out.output_type}] (unknown output type)`;
      }
    })
    .join('\n');
}

function runJupyterConvert(notebookPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('jupyter', args, {
      cwd: path.dirname(notebookPath),
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to start jupyter: ${err.message}. Is Jupyter installed? Run 'pip install jupyter' to install.`));
    });

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`jupyter exited with code ${code}.\nstderr: ${stderr}\nstdout: ${stdout}`));
      }
    });
  });
}

function truncate(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str;
  return str.substring(0, maxChars) + '...';
}

export const NotebookTool: Tool = {
  name: 'notebook',
  description: `Edit, execute, and manage Jupyter Notebook (.ipynb) files.

Supported operations:
- read: Read notebook structure, cell count, types, and preview contents
- execute_cell: Execute a specific code cell using jupyter nbconvert
- edit_cell: Edit the source code of a cell
- add_cell: Insert a new cell (code or markdown) at a position
- delete_cell: Remove a cell by index
- get_output: Get execution output from a cell

All cell_index values are 0-based.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description:
          'Operation to perform: read, execute_cell, edit_cell, add_cell, delete_cell, get_output',
        enum: ['read', 'execute_cell', 'edit_cell', 'add_cell', 'delete_cell', 'get_output'],
      },
      file_path: {
        type: 'string',
        description: 'Path to the .ipynb notebook file',
      },
      cell_index: {
        type: 'number',
        description: '0-based index of the target cell (required for cell-level operations)',
      },
      source: {
        type: 'string',
        description: 'New source content for edit_cell or add_cell',
      },
      cell_type: {
        type: 'string',
        description: 'Cell type for add_cell: code, markdown, or raw',
        enum: ['code', 'markdown', 'raw'],
      },
      max_preview_chars: {
        type: 'number',
        description: 'Maximum characters per cell preview in read mode (default: 500)',
      },
    },
    required: ['operation', 'file_path'],
  },

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const {
      operation,
      file_path: filePath,
      cell_index,
      source,
      cell_type = 'code',
      max_preview_chars = 500,
    } = params as unknown as NotebookToolParams;

    try {
      const resolvedPath = resolvePath(filePath);
      logger.info(`[NotebookTool] operation=${operation}, file=${resolvedPath}, cell_index=${cell_index ?? 'N/A'}`);

      switch (operation) {
        case 'read':
          return await handleRead(resolvedPath, max_preview_chars);

        case 'execute_cell':
          return await handleExecuteCell(resolvedPath, cell_index);

        case 'edit_cell':
          return await handleEditCell(resolvedPath, cell_index, source);

        case 'add_cell':
          return await handleAddCell(resolvedPath, cell_index, source, cell_type);

        case 'delete_cell':
          return await handleDeleteCell(resolvedPath, cell_index);

        case 'get_output':
          return await handleGetOutput(resolvedPath, cell_index);

        default:
          return errorResult(`Unknown operation: ${operation}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[NotebookTool] Error: ${message}`);
      return errorResult(message);
    }
  },
};

async function handleRead(filePath: string, maxPreviewChars: number): Promise<ToolResult> {
  if (!existsSync(filePath)) {
    return errorResult(`Notebook not found: ${filePath}`);
  }

  const nb = readNotebook(filePath);
  const cellSummaries = nb.cells.map((cell, i) => ({
    index: i,
    cell_type: cell.cell_type,
    source_preview: truncate(formatCellPreview(cell, maxPreviewChars), 200),
    execution_count: cell.execution_count ?? null,
    has_outputs: cell.outputs ? cell.outputs.length > 0 : false,
  }));

  const summary = nb.cells
    .map(
      (c, i) =>
        `Cell ${i} [${c.cell_type}]${c.execution_count ? ` (exec_count: ${c.execution_count})` : ''}:\n${formatCellPreview(c, maxPreviewChars)}`,
    )
    .join('\n---\n');

  return {
    success: true,
    content: `Notebook: ${path.basename(filePath)}\nCells: ${nb.cells.length}\nFormat: nbformat ${nb.nbformat}.${nb.nbformat_minor}\n\n${summary}`,
    metadata: {
      file_path: filePath,
      cell_count: nb.cells.length,
      cell_types: nb.cells.map((c) => c.cell_type),
      cells: cellSummaries,
      nbformat: nb.nbformat,
      nbformat_minor: nb.nbformat_minor,
    },
  };
}

async function handleExecuteCell(filePath: string, cellIndex: number | undefined): Promise<ToolResult> {
  if (cellIndex === undefined || cellIndex < 0) {
    return errorResult('cell_index is required and must be a non-negative integer for execute_cell');
  }

  if (!existsSync(filePath)) {
    return errorResult(`Notebook not found: ${filePath}`);
  }

  const nb = readNotebook(filePath);
  if (cellIndex >= nb.cells.length) {
    return errorResult(`cell_index ${cellIndex} out of range (notebook has ${nb.cells.length} cells)`);
  }

  const targetCell = nb.cells[cellIndex];
  if (targetCell.cell_type !== 'code') {
    return errorResult(`Cannot execute cell ${cellIndex}: cell type is '${targetCell.cell_type}', not 'code'`);
  }

  logger.info(`[NotebookTool] Executing cell ${cellIndex} in ${filePath}`);

  try {
    const tmpPath = filePath.replace(/\.ipynb$/i, '_exec_tmp.ipynb');
    const tmpNb: NotebookData = {
      cells: [
        {
          cell_type: 'code',
          source: targetCell.source,
        },
      ],
      metadata: nb.metadata || {},
      nbformat: nb.nbformat || 4,
      nbformat_minor: nb.nbformat_minor ?? 0,
    };
    writeNotebook(tmpPath, tmpNb);

    await runJupyterConvert(tmpPath, [
      'nbconvert',
      '--to',
      'notebook',
      '--execute',
      '--inplace',
      '--ExecutePreprocessor.timeout=60',
    ]);

    const executedNb = readNotebook(tmpPath);
    const execCell = executedNb.cells[0];

    const outputText = formatOutputs(execCell);

    try {
      const fsModule = await import('fs');
      fsModule.unlinkSync(tmpPath);
    } catch {
    }

    return {
      success: true,
      content: `Cell ${cellIndex} executed successfully.\nOutput:\n${outputText}`,
      metadata: {
        cell_index: cellIndex,
        execution_count: execCell.execution_count,
        outputs: execCell.outputs || [],
      },
    };
  } catch (execError: unknown) {
    const message = execError instanceof Error ? execError.message : String(execError);
    logger.error(`[NotebookTool] Cell execution error: ${message}`);
    return {
      success: false,
      content: `Cell execution failed: ${message}`,
      error: message,
    };
  }
}

async function handleEditCell(
  filePath: string,
  cellIndex: number | undefined,
  newSource: string | undefined,
): Promise<ToolResult> {
  if (cellIndex === undefined || cellIndex < 0) {
    return errorResult('cell_index is required and must be a non-negative integer for edit_cell');
  }
  if (newSource === undefined) {
    return errorResult('source is required for edit_cell');
  }

  if (!existsSync(filePath)) {
    return errorResult(`Notebook not found: ${filePath}`);
  }

  const nb = readNotebook(filePath);
  if (cellIndex >= nb.cells.length) {
    return errorResult(`cell_index ${cellIndex} out of range (notebook has ${nb.cells.length} cells)`);
  }

  const oldSource = Array.isArray(nb.cells[cellIndex].source)
    ? nb.cells[cellIndex].source.join('')
    : nb.cells[cellIndex].source;
  const oldLength = oldSource.split('\n').length;

  nb.cells[cellIndex].source = newSource;
  nb.cells[cellIndex].outputs = [];
  nb.cells[cellIndex].execution_count = null;

  writeNotebook(filePath, nb);
  logger.info(`[NotebookTool] Edited cell ${cellIndex} in ${filePath}`);

  const newLength = newSource.split('\n').length;
  return {
    success: true,
    content: `Cell ${cellIndex} edited: ${filePath} (${oldLength} → ${newLength} lines)`,
    metadata: {
      cell_index: cellIndex,
      old_lines: oldLength,
      new_lines: newLength,
    },
  };
}

async function handleAddCell(
  filePath: string,
  position: number | undefined,
  newSource: string | undefined,
  cellType: 'code' | 'markdown' | 'raw',
): Promise<ToolResult> {
  if (newSource === undefined) {
    return errorResult('source is required for add_cell');
  }

  if (!existsSync(filePath)) {
    return errorResult(`Notebook not found: ${filePath}`);
  }

  const nb = readNotebook(filePath);
  const insertIndex = position !== undefined ? Math.min(position, nb.cells.length) : nb.cells.length;

  const newCell: NotebookCell = {
    cell_type: cellType || 'code',
    source: newSource,
  };
  if (newCell.cell_type === 'code') {
    newCell.outputs = [];
    newCell.execution_count = null;
  }

  nb.cells.splice(insertIndex, 0, newCell);
  writeNotebook(filePath, nb);
  logger.info(`[NotebookTool] Added cell at index ${insertIndex} in ${filePath}`);

  return {
    success: true,
    content: `Added ${cellType} cell at index ${insertIndex}: ${filePath} (now ${nb.cells.length} cells)`,
    metadata: {
      inserted_at: insertIndex,
      cell_count: nb.cells.length,
      cell_type: cellType,
    },
  };
}

async function handleDeleteCell(filePath: string, cellIndex: number | undefined): Promise<ToolResult> {
  if (cellIndex === undefined || cellIndex < 0) {
    return errorResult('cell_index is required and must be a non-negative integer for delete_cell');
  }

  if (!existsSync(filePath)) {
    return errorResult(`Notebook not found: ${filePath}`);
  }

  const nb = readNotebook(filePath);
  if (cellIndex >= nb.cells.length) {
    return errorResult(`cell_index ${cellIndex} out of range (notebook has ${nb.cells.length} cells)`);
  }

  const deletedCell = nb.cells[cellIndex];
  nb.cells.splice(cellIndex, 1);
  writeNotebook(filePath, nb);
  logger.info(`[NotebookTool] Deleted cell ${cellIndex} from ${filePath}`);

  return {
    success: true,
    content: `Deleted cell ${cellIndex} [${deletedCell.cell_type}] from ${filePath} (now ${nb.cells.length} cells)`,
    metadata: {
      deleted_index: cellIndex,
      deleted_type: deletedCell.cell_type,
      cell_count: nb.cells.length,
    },
  };
}

async function handleGetOutput(filePath: string, cellIndex: number | undefined): Promise<ToolResult> {
  if (cellIndex === undefined || cellIndex < 0) {
    return errorResult('cell_index is required and must be a non-negative integer for get_output');
  }

  if (!existsSync(filePath)) {
    return errorResult(`Notebook not found: ${filePath}`);
  }

  const nb = readNotebook(filePath);
  if (cellIndex >= nb.cells.length) {
    return errorResult(`cell_index ${cellIndex} out of range (notebook has ${nb.cells.length} cells)`);
  }

  const cell = nb.cells[cellIndex];
  if (!cell.outputs || cell.outputs.length === 0) {
    return {
      success: true,
      content: `Cell ${cellIndex} has no outputs.`,
      metadata: { cell_index: cellIndex, outputs: [] },
    };
  }

  const outputText = formatOutputs(cell);
  return {
    success: true,
    content: `Cell ${cellIndex} outputs:\n${outputText}`,
    metadata: {
      cell_index: cellIndex,
      outputs: cell.outputs,
    },
  };
}

function errorResult(message: string): ToolResult {
  return {
    success: false,
    content: message,
    error: message,
  };
}
