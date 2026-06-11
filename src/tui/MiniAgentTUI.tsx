// React 基础 hooks
import React, { useState, useEffect, useCallback } from 'react';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
// Ink TUI 框架的组件和 hooks
import { Box, Text, useInput, useApp, useStdout } from 'ink';
// Agent 类型定义
import type { Agent } from '../core/agent.js';
// 斜杠命令工厂函数
import { createSlashCommands } from '../core/commands.js';
import { renderCommandRows } from './primitives/CommandRows.js';
import { CommandPaletteDialog } from './primitives/CommandPaletteDialog.js';
import { Composer } from './primitives/Composer.js';
import { DialogFrame, DialogHeader } from './primitives/DialogFrame.js';
import { Footer } from './primitives/Footer.js';
import { MessageList, messageLineCount } from './primitives/MessageList.js';
import { type NoticeState } from './primitives/Notice.js';
import { getScrollWindow, scrollHint } from './primitives/ScrollWindow.js';
import { Sidebar, buildSidebarRows, buildSidebarFooterRows } from './primitives/Sidebar.js';
import { TUI_THEME } from './primitives/theme.js';
import { TimelineDialog } from './primitives/TimelineDialog.js';
import { fillByWidth, getStringWidth, truncateByWidth } from './primitives/text.js';
import type { Message } from './types.js';
import { safeCopy } from './primitives/Clipboard.js';

// Agent 模式列表：Build（构建模式）和 Plan（规划模式）
const AGENT_MODES = ['Build', 'Plan'] as const;

// TUI 组件接收的 props 类型定义
interface TUIProps {
  agent: Agent;              // Agent 实例，用于处理对话
  model: string;             // 模型名称，如 "gpt-4"
  cwd: string;               // 当前工作目录路径
  version: string;           // 应用版本号
  onExit: () => void;        // 退出回调函数
}

// TUI 内部状态类型定义
interface TUIState {
  modeIndex: number;         // 当前选中的模式索引（0=Build, 1=Plan）
  agentName: string;         // Agent 名称，如 "coder"
  inputLines: string[];      // 输入框的多行文本数组
  cursorRow: number;         // 光标所在行索引
  cursorCol: number;         // 光标所在列索引
  showSlashMenu: boolean;    // 是否显示斜杠命令菜单
  slashMenuMode: 'modal' | 'inline'; // modal=Ctrl+P 全屏命令面板，inline=/ 输入框上方选择框
  slashFilter: string;       // 斜杠命令过滤关键词
  slashIndex: number;        // 命令面板当前选中项
  isProcessing: boolean;     // 是否正在处理请求
  currentResponse: string;   // 当前正在流式输出的响应文本
  showExitConfirm: boolean;  // 是否显示退出确认框
  showTimeline: boolean;     // 是否显示会话时间线
  timelineIndex: number;     // 当前选中的时间线消息索引
  timelineDetail: boolean;   // 是否显示选中消息详情
  timelineDetailOffset: number; // 时间线详情滚动位置
  historyIndex: number | null; // 当前浏览的历史输入索引
}

// 固定 Logo（ASCII 艺术字），使用 #0078d7 蓝色
const LOGO_LINES: string[] = [
  '███    ███  ██  ███    ██  ██          █████    ██████   ███████  ███    ██  ████████ ',
  '████  ████  ██  ████   ██  ██         ██   ██  ██        ██       ████   ██     ██    ',
  '██ ████ ██  ██  ██ ██  ██  ██  █████  ███████  ██   ███  █████    ██ ██  ██     ██    ',
  '██  ██  ██  ██  ██  ██ ██  ██         ██   ██  ██    ██  ██       ██  ██ ██     ██    ',
  '██      ██  ██  ██   ████  ██         ██   ██   ██████   ███████  ██   ████     ██    ',
];

const LOGO_SPLIT_INDEX = 41;

// TUI 主组件：渲染整个终端用户界面
export function MiniAgentTUI({ agent, model, cwd, version, onExit }: TUIProps) {
  // useApp: 获取 Ink 应用控制，exit() 用于退出应用
  const { exit } = useApp();
  // useStdout: 获取标准输出流引用
  useStdout();

  // 使用 useMemo 缓存斜杠命令列表，避免每次渲染都重新创建
  const slashCommands = React.useMemo(() => createSlashCommands(), []);
  // 对话消息列表
  const [messages, setMessages] = useState<Message[]>([]);
  // TUI 内部状态
  const [state, setState] = useState<TUIState>({
    modeIndex: 0,           // 默认选中 Build 模式
    agentName: 'coder',     // 默认 Agent 名称
    inputLines: [''],       // 输入框初始为空行
    cursorRow: 0,           // 光标初始在第 0 行
    cursorCol: 0,           // 光标初始在第 0 列
    showSlashMenu: false,   // 默认不显示斜杠菜单
    slashMenuMode: 'modal', // 默认 Ctrl+P 模态面板
    slashFilter: '',        // 默认无过滤关键词
    slashIndex: 0,          // 默认选中第一条命令
    isProcessing: false,    // 默认未在处理
    currentResponse: '',    // 默认无响应文本
    showExitConfirm: false, // 默认不显示退出确认框
    showTimeline: false,    // 默认不显示会话时间线
    timelineIndex: 0,       // 默认选中第一条时间线消息
    timelineDetail: false,  // 默认显示时间线列表
    timelineDetailOffset: 0,// 默认详情滚动到顶部
    historyIndex: null,     // 默认不浏览历史输入
  });
  // 已使用的 token 数量（初始值 55373）
  const [tokensUsed, setTokensUsed] = useState(55373);
  // token 使用百分比
  const [tokenPercent] = useState(6);
  // 总花费金额
  const [totalCost] = useState('$0.02');
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [promptStash, setPromptStash] = useState<string | null>(null);
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);
  const [lastCopyStatus, setLastCopyStatus] = useState<'idle' | 'copied' | 'fallback'>('idle');
  const [lastForkIndex, setLastForkIndex] = useState<number | null>(null);
  const [forkUndoMessages, setForkUndoMessages] = useState<Message[] | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const promptStoreDir = path.join(cwd, '.miniagent', 'history');
  const promptHistoryPath = path.join(promptStoreDir, 'tui-prompts.json');
  const promptStashPath = path.join(promptStoreDir, 'tui-draft.txt');
  // 终端宽度（字符数），默认 120
  const [termWidth, setTermWidth] = useState(120);
  // 终端高度（行数），默认 30
  const [termHeight, setTermHeight] = useState(30);
  // 监听终端窗口大小变化，实时更新 termWidth 和 termHeight
  useEffect(() => {
    const updateDimensions = () => {
      if (process.stdout.columns) {
        setTermWidth(process.stdout.columns);
      }
      if (process.stdout.rows) {
        setTermHeight(process.stdout.rows);
      }
    };
    updateDimensions(); // 初始化时立即执行一次
    process.stdout.on('resize', updateDimensions); // 绑定 resize 事件
    return () => {
      process.stdout.off('resize', updateDimensions); // 组件卸载时解绑
    };
  }, []); // 空依赖数组

  useEffect(() => {
    let cancelled = false;
    async function loadPromptState() {
      try {
        const rawHistory = await readFile(promptHistoryPath, 'utf8');
        const parsed = JSON.parse(rawHistory) as unknown;
        if (!cancelled && Array.isArray(parsed)) {
          setPromptHistory(parsed.filter((item): item is string => typeof item === 'string').slice(-100));
        }
      } catch {
        // Missing history is fine on first run.
      }

      try {
        const rawDraft = await readFile(promptStashPath, 'utf8');
        if (!cancelled && rawDraft.trim()) setPromptStash(rawDraft);
      } catch {
        // Missing draft is fine on first run.
      }
    }
    loadPromptState();
    return () => {
      cancelled = true;
    };
  }, [promptHistoryPath, promptStashPath]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  // 计算当前模式名称（从 AGENT_MODES 数组中取）
  const currentMode = AGENT_MODES[state.modeIndex];
  // 显示完整模型名，避免用户不清楚当前实际使用的 Ollama model/tag。
  const modelName = model;
  // 是否已经有过对话（消息数大于 0）
  const hasConversation = messages.length > 0;
  // 状态更新辅助函数：接收一个 updater 函数，基于旧状态计算新状态
  const updateState = useCallback((updater: (prev: TUIState) => TUIState) => {
    setState(prev => updater(prev));
  }, []);

  const handleExportConversation = useCallback(async () => {
    if (messages.length === 0) return;
    const exportDir = path.join(cwd, '.miniagent', 'sessions');
    await mkdir(exportDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(exportDir, `tui-${timestamp}.md`);
    const content = [
      '# MiniAgent TUI Conversation',
      '',
      `- Model: ${modelName}`,
      `- Mode: ${currentMode}`,
      `- Exported: ${new Date().toISOString()}`,
      '',
      ...messages.map(msg => [
        `## ${msg.role === 'user' ? 'User' : msg.type === 'error' ? 'MiniAgent Error' : 'MiniAgent'}`,
        '',
        msg.content,
        '',
      ].join('\n')),
    ].join('\n');
    await writeFile(filePath, content, 'utf8');
    setLastExportPath(filePath);
    setNotice({ message: `Exported ${path.basename(filePath)}`, level: 'success' });
  }, [cwd, currentMode, messages, modelName]);

  const persistPromptHistory = useCallback(async (history: string[]) => {
    await mkdir(promptStoreDir, { recursive: true });
    await writeFile(promptHistoryPath, JSON.stringify(history.slice(-100), null, 2), 'utf8');
  }, [promptHistoryPath, promptStoreDir]);

  const persistPromptStash = useCallback(async (draft: string | null) => {
    await mkdir(promptStoreDir, { recursive: true });
    await writeFile(promptStashPath, draft || '', 'utf8');
  }, [promptStashPath, promptStoreDir]);

  const copyToClipboard = useCallback((text: string) => safeCopy(text), []);

  // 处理用户输入的文本（发送给 Agent 并获取响应）
  const handleProcessInput = useCallback(async (text: string) => {
    if (!text.trim()) return; // 空输入直接返回

    // 创建用户消息对象
    const userMsg: Message = {
      role: 'user',
      content: text,
      type: 'text',
    };
    setMessages(prev => [...prev, userMsg]); // 添加到消息列表
    setTokensUsed(prev => prev + Math.floor(text.length / 4)); // 估算 token 消耗
    setPromptHistory(prev => {
      const next = prev.at(-1) === text ? prev : [...prev, text].slice(-100);
      persistPromptHistory(next).catch(() => {});
      return next;
    });

    // 更新状态：标记为处理中、清空响应文本、重置输入框和光标
    updateState(prev => ({
      ...prev,
      isProcessing: true,
      currentResponse: '',
      inputLines: [''],
      cursorRow: 0,
      cursorCol: 0,
      historyIndex: null,
    }));

    try {
      if (text.startsWith('/')) {
        // 处理斜杠命令
        const spaceIdx = text.indexOf(' '); // 查找第一个空格位置
        const cmdName = text.substring(1, spaceIdx > 0 ? spaceIdx : text.length); // 提取命令名（去掉前导 /）
        const args = spaceIdx > 0 ? text.substring(spaceIdx + 1) : ''; // 提取参数
        const cmd = slashCommands.find(c => c.name === cmdName); // 查找匹配的命令
        if (cmd && cmd.execute) {
          const result = await cmd.execute(args, { agent, tools: [], messageCount: 0 }); // 执行命令
          if (result) {
            const msg = (result as { content?: string }).content || JSON.stringify(result); // 获取结果文本
            setMessages(prev => [...prev, { role: 'assistant', content: msg, type: 'text' }]); // 添加响应消息
          }
        }
      } else {
        // TUI 普通聊天优先走纯 LLM 流，避免小模型把工具调用 JSON 当正文输出。
        const chatHistory = messages
          .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && msg.type === 'text'))
          .map(msg => ({ role: msg.role, content: msg.content }));

        const stream = agent.getLLM().chat({
          messages: [...chatHistory, { role: 'user', content: text }],
          systemPrompt: [
            'You are MiniAgent, a local AI Agent framework developed by Zevan.',
            `You are currently running through Ollama with model: ${model}.`,
            'MiniAgent is the application/framework name, not the model name.',
            `When asked about the current model, answer exactly that the current model is ${model}.`,
            'Do not claim to be developed by OpenAI, Anthropic, Google, or any other model provider.',
            'If asked who created you, say MiniAgent was developed by Zevan and is powered by the currently selected local model.',
            'Reply naturally in the user language. Do not emit tool-call JSON unless explicitly asked.',
          ].join('\n'),
        });
        let fullResponse = '';

        // 流式读取响应文本
        for await (const chunk of stream) {
          if (chunk.type === 'done') {
            break;
          }

          if (chunk.type === 'content' && chunk.content) {
            fullResponse += chunk.content;
            updateState(prev => ({ ...prev, currentResponse: fullResponse })); // 更新显示中的响应
          }

          if (chunk.type === 'error') {
            throw new Error(chunk.error || 'Agent response failed');
          }
        }

        if (fullResponse) {
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: fullResponse, type: 'text' }, // 添加完整响应到消息列表
          ]);
          setTokensUsed(prev => prev + Math.floor(fullResponse.length / 4)); // 估算 token 消耗
        }
      }
    } catch (err) {
      // 捕获异常并显示错误消息
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Error: ' + (err instanceof Error ? err.message : String(err)),
          type: 'error',
        },
      ]);
    } finally {
      // 处理完成：取消处理中标记、清空响应文本
      updateState(prev => ({
        ...prev,
        isProcessing: false,
        currentResponse: '',
      }));
    }
  }, [agent, messages, persistPromptHistory, slashCommands, updateState]); // 依赖：agent 实例、命令列表、状态更新函数

  // 注册键盘输入处理
  useInput((input, key) => {
    const navigationKey = key as typeof key & { home?: boolean; end?: boolean };
    const isEnterKey = key.return || input === '\r' || input === '\n';
    const isForwardDeleteKey = input === '\u001b[3~';
    const isBackspaceKey = key.backspace || input === '\u007f' || input === '\b' || input === '\x08' || (key.delete && !isForwardDeleteKey);
    const isHomeKey = navigationKey.home || input === '\u001b[H' || input === '\u001bOH' || input === '\u001b[1~';
    const isEndKey = navigationKey.end || input === '\u001b[F' || input === '\u001bOF' || input === '\u001b[4~';

    if (state.showExitConfirm) {
      if (isEnterKey || input.toLowerCase() === 'y') {
        exit();
        onExit();
        return;
      }
      if (key.escape || input === 'escape' || input === '\u001b' || input.toLowerCase() === 'n') {
        updateState(prev => ({ ...prev, showExitConfirm: false }));
        return;
      }
      return;
    }

    if (state.showTimeline) {
      if (isHomeKey) {
        updateState(prev => prev.timelineDetail
          ? { ...prev, timelineDetailOffset: 0 }
          : { ...prev, timelineIndex: 0, timelineDetailOffset: 0 }
        );
        return;
      }
      if (isEndKey) {
        updateState(prev => prev.timelineDetail
          ? { ...prev, timelineDetailOffset: Number.MAX_SAFE_INTEGER }
          : { ...prev, timelineIndex: Math.max(0, messages.length - 1), timelineDetailOffset: 0 }
        );
        return;
      }
      if (key.upArrow) {
        updateState(prev => prev.timelineDetail
          ? { ...prev, timelineDetailOffset: Math.max(0, prev.timelineDetailOffset - 1) }
          : { ...prev, timelineIndex: Math.max(0, prev.timelineIndex - 1), timelineDetailOffset: 0 }
        );
        return;
      }
      if (key.downArrow) {
        updateState(prev => prev.timelineDetail
          ? { ...prev, timelineDetailOffset: prev.timelineDetailOffset + 1 }
          : { ...prev, timelineIndex: Math.min(Math.max(messages.length - 1, 0), prev.timelineIndex + 1), timelineDetailOffset: 0 }
        );
        return;
      }
      if (isEnterKey && messages.length > 0) {
        updateState(prev => ({ ...prev, timelineDetail: !prev.timelineDetail, timelineDetailOffset: 0 }));
        return;
      }
      if (input.toLowerCase() === 'i' && messages[state.timelineIndex]) {
        const text = messages[state.timelineIndex].content;
        const lines = text.split('\n');
        updateState(prev => ({
          ...prev,
          showTimeline: false,
          timelineDetail: false,
          timelineDetailOffset: 0,
          inputLines: lines,
          cursorRow: lines.length - 1,
          cursorCol: lines.at(-1)?.length || 0,
          historyIndex: null,
        }));
        setNotice({ message: 'Inserted timeline message', level: 'success' });
        return;
      }
      if (input.toLowerCase() === 'c' && messages[state.timelineIndex]) {
        const text = messages[state.timelineIndex].content;
        copyToClipboard(text)
          .then((result) => {
            if (result.ok) {
              setLastCopyStatus('copied');
              setNotice({ message: 'Copied message', level: 'success' });
            } else {
              const lines = text.split('\n');
              updateState(prev => ({
                ...prev,
                showTimeline: false,
                timelineDetail: false,
                timelineDetailOffset: 0,
                inputLines: lines,
                cursorRow: lines.length - 1,
                cursorCol: lines.at(-1)?.length || 0,
                historyIndex: null,
              }));
              setLastCopyStatus('fallback');
              setNotice({ message: 'Clipboard unavailable; inserted message', level: 'warning' });
            }
          });
        return;
      }
      if (input.toLowerCase() === 'f' && messages[state.timelineIndex]) {
        const forkIndex = state.timelineIndex;
        setMessages(prev => {
          setForkUndoMessages(prev);
          return prev.slice(0, forkIndex + 1);
        });
        setLastForkIndex(forkIndex + 1);
        setNotice({ message: `Forked at #${forkIndex + 1}`, level: 'warning' });
        updateState(prev => ({
          ...prev,
          showTimeline: false,
          timelineDetail: false,
          timelineDetailOffset: 0,
          timelineIndex: Math.min(prev.timelineIndex, forkIndex),
          currentResponse: '',
          isProcessing: false,
        }));
        return;
      }
      if (input.toLowerCase() === 'u' && forkUndoMessages) {
        setMessages(forkUndoMessages);
        setForkUndoMessages(null);
        setLastForkIndex(null);
        setNotice({ message: 'Restored fork', level: 'success' });
        updateState(prev => ({
          ...prev,
          showTimeline: false,
          timelineDetail: false,
          timelineDetailOffset: 0,
          timelineIndex: Math.max(0, forkUndoMessages.length - 1),
        }));
        return;
      }
      if (input.toLowerCase() === 'r' && messages[state.timelineIndex]?.role === 'user' && !state.isProcessing) {
        const retryText = messages[state.timelineIndex].content;
        setMessages(prev => prev.slice(0, state.timelineIndex));
        updateState(prev => ({ ...prev, showTimeline: false, timelineDetail: false, timelineDetailOffset: 0 }));
        setNotice({ message: 'Retrying selected message', level: 'info' });
        handleProcessInput(retryText);
        return;
      }
      if (key.escape || input === 'escape' || input === '\u001b') {
        updateState(prev => prev.timelineDetail
          ? { ...prev, timelineDetail: false, timelineDetailOffset: 0 }
          : { ...prev, showTimeline: false }
        );
      }
      return;
    }

    // Ctrl+C 或 Ctrl+D：先显示退出确认框
    if (key.ctrl && (input === 'c' || input === 'd')) {
      updateState(prev => ({ ...prev, showExitConfirm: true, showSlashMenu: false }));
      return;
    }

    // Escape 键：关闭斜杠菜单
    if (key.escape || input === 'escape' || input === '\u001b') {
      if (state.showSlashMenu) {
        updateState(prev => ({ ...prev, showSlashMenu: false }));
      }
      return;
    }

    // Tab 键：切换 Agent 模式（Build <-> Plan）
    if (key.tab && !state.showSlashMenu) {
      updateState(prev => ({
        ...prev,
        modeIndex: (prev.modeIndex + 1) % AGENT_MODES.length, // 循环切换
      }));
      return;
    }

    // Ctrl+P：打开/关闭斜杠命令菜单
    if (key.ctrl && input === 'p') {
      updateState(prev => ({
        ...prev,
        showSlashMenu: !prev.showSlashMenu,
        slashMenuMode: 'modal',
        slashFilter: '', // 重置过滤关键词
        slashIndex: 0,
      }));
      return;
    }

    if (key.ctrl && input.toLowerCase() === 'l') {
      setMessages([]);
      updateState(prev => ({ ...prev, currentResponse: '', isProcessing: false, historyIndex: null }));
      setNotice({ message: 'Cleared chat', level: 'warning' });
      return;
    }

    if (key.ctrl && input.toLowerCase() === 't') {
      updateState(prev => ({
        ...prev,
        showTimeline: true,
        timelineDetail: false,
        timelineDetailOffset: 0,
        timelineIndex: Math.max(0, messages.length - 1),
        showSlashMenu: false,
      }));
      return;
    }

    if (key.ctrl && input.toLowerCase() === 'e') {
      handleExportConversation().catch(err => {
        setNotice({ message: 'Export failed', level: 'error' });
        setMessages(prev => [...prev, {
          role: 'assistant',
          type: 'error',
          content: 'Export failed: ' + (err instanceof Error ? err.message : String(err)),
        }]);
      });
      return;
    }

    if (key.ctrl && input.toLowerCase() === 'k') {
      updateState(prev => ({ ...prev, inputLines: [''], cursorRow: 0, cursorCol: 0, historyIndex: null, showSlashMenu: false }));
      setNotice({ message: 'Cleared input', level: 'warning' });
      return;
    }

    if (key.ctrl && input.toLowerCase() === 'r') {
      if (lastUserPrompt && !state.isProcessing) {
        setMessages(prev => {
          const lastUserIndex = prev.map(msg => msg.role).lastIndexOf('user');
          return lastUserIndex >= 0 ? prev.slice(0, lastUserIndex) : prev;
        });
        handleProcessInput(lastUserPrompt);
      }
      return;
    }

    if (key.ctrl && input.toLowerCase() === 'u') {
      const currentText = state.inputLines.join('\n');
      if (currentText.trim()) {
        setPromptStash(currentText);
        persistPromptStash(currentText).catch(() => {});
        setNotice({ message: 'Draft saved', level: 'success' });
      }
      updateState(prev => ({ ...prev, inputLines: [''], cursorRow: 0, cursorCol: 0, historyIndex: null, showSlashMenu: false }));
      return;
    }

    if (key.ctrl && input.toLowerCase() === 'y') {
      if (promptStash) {
        const lines = promptStash.split('\n');
        updateState(prev => ({
          ...prev,
          inputLines: lines,
          cursorRow: lines.length - 1,
          cursorCol: lines.at(-1)?.length || 0,
          historyIndex: null,
          showSlashMenu: false,
        }));
        setPromptStash(null);
        persistPromptStash(null).catch(() => {});
        setNotice({ message: 'Draft restored', level: 'success' });
      }
      return;
    }

    // 斜杠菜单打开时的输入处理
    if (state.showSlashMenu) {
      if (key.upArrow) {
        updateState(prev => ({
          ...prev,
          slashIndex: Math.max(0, prev.slashIndex - 1),
        }));
        return;
      }
      if (key.downArrow) {
        updateState(prev => ({
          ...prev,
          slashIndex: Math.min(Math.max(filteredSlashCommands.length - 1, 0), prev.slashIndex + 1),
        }));
        return;
      }
      if (isEnterKey || key.tab) {
        // Modal 中填充命令；inline 中补全为可继续输入参数的形式。
        const selected = filteredSlashCommands[activeSlashIndex] || filteredSlashCommands[0];
        if (selected) {
          const commandText = state.slashMenuMode === 'inline' ? `/${selected.name} ` : `/${selected.name}`;
          updateState(prev => ({
            ...prev,
            inputLines: [commandText],
            cursorRow: 0,
            cursorCol: commandText.length,
            showSlashMenu: false,
            slashFilter: '',
            slashIndex: 0,
          }));
          if (state.slashMenuMode === 'inline') setNotice({ message: `Selected /${selected.name}`, level: 'success' });
        }
        return;
      }
      if (isBackspaceKey) {
        // 退格键：删除过滤关键词最后一个字符
        updateState(prev => {
          if (prev.slashMenuMode !== 'inline') return { ...prev, slashFilter: prev.slashFilter.slice(0, -1) };
          if (prev.slashFilter.length === 0) {
            return {
              ...prev,
              showSlashMenu: false,
              slashFilter: '',
              slashIndex: 0,
              inputLines: [''],
              cursorRow: 0,
              cursorCol: 0,
            };
          }
          const nextFilter = prev.slashFilter.slice(0, -1);
          return {
            ...prev,
            slashFilter: nextFilter,
            slashIndex: 0,
            inputLines: [`/${nextFilter}`],
            cursorRow: 0,
            cursorCol: nextFilter.length + 1,
          };
        });
        return;
      }
      if (input.length === 1 && input >= ' ' && input !== '\u007f') {
        // 可打印字符：追加到过滤关键词
        updateState(prev => {
          if (prev.slashMenuMode === 'inline' && input === ' ' && prev.slashFilter.length > 0) {
            const text = `/${prev.slashFilter} `;
            return {
              ...prev,
              showSlashMenu: false,
              inputLines: [text],
              cursorRow: 0,
              cursorCol: text.length,
            };
          }
          const nextFilter = prev.slashFilter + input;
          if (prev.slashMenuMode !== 'inline') return { ...prev, slashFilter: nextFilter, slashIndex: 0 };
          return {
            ...prev,
            slashFilter: nextFilter,
            slashIndex: 0,
            inputLines: [`/${nextFilter}`],
            cursorRow: 0,
            cursorCol: nextFilter.length + 1,
          };
        });
      }
      return;
    }

    // 左箭头：光标左移
    if (key.leftArrow) {
      if (state.cursorCol > 0) {
        updateState(prev => ({ ...prev, cursorCol: prev.cursorCol - 1 }));
      } else if (state.cursorRow > 0) {
        updateState(prev => ({
          ...prev,
          cursorRow: prev.cursorRow - 1,
          cursorCol: prev.inputLines[prev.cursorRow - 1].length, // 移到上一行末尾
        }));
      }
      return;
    }

    // 右箭头：光标右移
    if (key.rightArrow) {
      const currentLine = state.inputLines[state.cursorRow];
      if (state.cursorCol < currentLine.length) {
        updateState(prev => ({ ...prev, cursorCol: prev.cursorCol + 1 }));
      } else if (state.cursorRow < state.inputLines.length - 1) {
        updateState(prev => ({ ...prev, cursorRow: prev.cursorRow + 1, cursorCol: 0 })); // 移到下一行开头
      }
      return;
    }

    // 上箭头：光标上移一行
    if (key.upArrow) {
      const inputEmpty = state.inputLines.length === 1 && state.inputLines[0] === '';
      if ((inputEmpty || state.historyIndex !== null) && promptHistory.length > 0) {
        updateState(prev => {
          const nextIndex = prev.historyIndex === null
            ? promptHistory.length - 1
            : Math.max(0, prev.historyIndex - 1);
          const text = promptHistory[nextIndex] || '';
          const lines = text.split('\n');
          return {
            ...prev,
            historyIndex: nextIndex,
            inputLines: lines,
            cursorRow: lines.length - 1,
            cursorCol: lines.at(-1)?.length || 0,
          };
        });
        return;
      }
      if (state.cursorRow > 0) {
        updateState(prev => ({
          ...prev,
          cursorRow: prev.cursorRow - 1,
          cursorCol: Math.min(prev.cursorCol, prev.inputLines[prev.cursorRow - 1].length), // 限制不超过上一行长度
        }));
      }
      return;
    }

    // 下箭头：光标下移一行
    if (key.downArrow) {
      if (state.historyIndex !== null) {
        updateState(prev => {
          const nextIndex = prev.historyIndex === null ? null : prev.historyIndex + 1;
          if (nextIndex === null || nextIndex >= promptHistory.length) {
            return { ...prev, historyIndex: null, inputLines: [''], cursorRow: 0, cursorCol: 0 };
          }
          const text = promptHistory[nextIndex] || '';
          const lines = text.split('\n');
          return {
            ...prev,
            historyIndex: nextIndex,
            inputLines: lines,
            cursorRow: lines.length - 1,
            cursorCol: lines.at(-1)?.length || 0,
          };
        });
        return;
      }
      if (state.cursorRow < state.inputLines.length - 1) {
        updateState(prev => ({
          ...prev,
          cursorRow: prev.cursorRow + 1,
          cursorCol: Math.min(prev.cursorCol, prev.inputLines[prev.cursorRow + 1].length), // 限制不超过下一行长度
        }));
      }
      return;
    }

    // Home 键：光标移到行首
    if (isHomeKey) {
      updateState(prev => ({ ...prev, cursorCol: 0 }));
      return;
    }
    // End 键：光标移到行尾
    if (isEndKey) {
      updateState(prev => ({ ...prev, cursorCol: prev.inputLines[prev.cursorRow].length }));
      return;
    }

    // Enter 键：提交输入或换行
    if (isEnterKey) {
      const fullText = state.inputLines.join('\n').trim();
      if (fullText) {
        handleProcessInput(fullText); // 有内容则提交
      } else {
        updateState(prev => {
          const newLines = [...prev.inputLines];
          const currentLine = newLines[prev.cursorRow];
          newLines[prev.cursorRow] = currentLine.slice(0, prev.cursorCol); // 光标前部分
          newLines.splice(prev.cursorRow + 1, 0, currentLine.slice(prev.cursorCol)); // 光标后部分插入新行
          return {
            ...prev,
            inputLines: newLines,
            cursorRow: prev.cursorRow + 1,
            cursorCol: 0,
            historyIndex: null,
          };
        });
      }
      return;
    }

    // 退格键：删除字符或合并行（Ink 使用 key.backspace）
    if (isBackspaceKey) {
      if (state.cursorCol > 0) {
        updateState(prev => {
          const newLines = [...prev.inputLines];
          const line = newLines[prev.cursorRow];
          newLines[prev.cursorRow] = line.slice(0, prev.cursorCol - 1) + line.slice(prev.cursorCol); // 删除光标前字符
            return { ...prev, inputLines: newLines, cursorCol: prev.cursorCol - 1, historyIndex: null };
        });
      } else if (state.cursorRow > 0) {
        updateState(prev => {
          const newLines = [...prev.inputLines];
          const merged = newLines[prev.cursorRow - 1] + newLines[prev.cursorRow]; // 合并上下两行
          newLines[prev.cursorRow - 1] = merged;
          newLines.splice(prev.cursorRow, 1); // 删除当前行
          return {
            ...prev,
            inputLines: newLines,
            cursorRow: prev.cursorRow - 1,
            cursorCol: newLines[prev.cursorRow - 1].length,
            historyIndex: null,
          };
        });
      }
      return;
    }

    if (isForwardDeleteKey) {
      const currentLine = state.inputLines[state.cursorRow];
      if (state.cursorCol < currentLine.length) {
        updateState(prev => {
          const newLines = [...prev.inputLines];
          const line = newLines[prev.cursorRow];
          newLines[prev.cursorRow] = line.slice(0, prev.cursorCol) + line.slice(prev.cursorCol + 1);
          return { ...prev, inputLines: newLines, historyIndex: null };
        });
      } else if (state.cursorRow < state.inputLines.length - 1) {
        updateState(prev => {
          const newLines = [...prev.inputLines];
          newLines[prev.cursorRow] += newLines[prev.cursorRow + 1];
          newLines.splice(prev.cursorRow + 1, 1);
          return { ...prev, inputLines: newLines, historyIndex: null };
        });
      }
      return;
    }

    // 普通字符输入：插入到光标位置（含自动换行逻辑）
    if (input.length >= 1 && input >= ' ' && input !== '\u007f') {
      updateState(prev => {
        const newLines = [...prev.inputLines];
        const currentLine = newLines[prev.cursorRow];
        const newText = currentLine.slice(0, prev.cursorCol) + input + currentLine.slice(prev.cursorCol);
        const opensInlineSlash = input === '/' && prev.inputLines.length === 1 && prev.cursorRow === 0 && prev.cursorCol === 0;
        
        // 检查当前行是否超过最大显示宽度
        if (getStringWidth(newText) > textWidth) {
          // 按显示宽度截断，超出部分移到下一行
          const { text: lineText, charCount: lineCharCount } = truncateByWidth(newText, textWidth);
          const overflowText = newText.slice(lineCharCount);
          
          newLines[prev.cursorRow] = lineText;
          
          // 递归处理溢出文本：可能需要多行换行
          let remainingOverflow = overflowText;
          let insertRow = prev.cursorRow + 1;
          
          while (getStringWidth(remainingOverflow) > 0) {
            if (insertRow < newLines.length) {
              // 已有该行，将溢出文本拼接到开头
              const combined = remainingOverflow + newLines[insertRow];
              if (getStringWidth(combined) <= textWidth) {
                // 合并后不超过宽度，直接放入
                newLines[insertRow] = combined;
                remainingOverflow = '';
              } else {
                // 合并后超过宽度，截断当前行
                const truncated = truncateByWidth(combined, textWidth);
                newLines[insertRow] = truncated.text;
                remainingOverflow = combined.slice(truncated.charCount);
                insertRow++;
              }
            } else {
              // 没有该行，创建新行
              if (getStringWidth(remainingOverflow) <= textWidth) {
                newLines.push(remainingOverflow);
                remainingOverflow = '';
              } else {
                const lineContent = truncateByWidth(remainingOverflow, textWidth);
                newLines.push(lineContent.text);
                remainingOverflow = remainingOverflow.slice(lineContent.charCount);
                insertRow++;
              }
            }
          }
          
          // 换行后光标移到下一行溢出文本末尾
          return {
            ...prev,
            inputLines: newLines,
            cursorRow: prev.cursorRow + 1,
            cursorCol: newLines[prev.cursorRow + 1] ? newLines[prev.cursorRow + 1].length : 0,
            historyIndex: null,
            showSlashMenu: opensInlineSlash ? true : prev.showSlashMenu,
            slashMenuMode: opensInlineSlash ? 'inline' : prev.slashMenuMode,
            slashFilter: opensInlineSlash ? '' : prev.slashFilter,
            slashIndex: opensInlineSlash ? 0 : prev.slashIndex,
          };
        } else {
          // 正常插入
          newLines[prev.cursorRow] = newText;
          return {
            ...prev,
            inputLines: newLines,
            cursorCol: prev.cursorCol + input.length, // 光标右移
            historyIndex: null,
            showSlashMenu: opensInlineSlash ? true : prev.showSlashMenu,
            slashMenuMode: opensInlineSlash ? 'inline' : prev.slashMenuMode,
            slashFilter: opensInlineSlash ? '' : prev.slashFilter,
            slashIndex: opensInlineSlash ? 0 : prev.slashIndex,
          };
        }
      });
    }
  });

  // ==================== 输入框宽度计算 ====================
  const sidebarWidth = termWidth >= 120 ? 42 : 32;
  const sidebarPaddingX = 2;
  const sidebarInnerWidth = Math.max(12, sidebarWidth - sidebarPaddingX * 2 - 1);
  const chatAreaWidth = Math.max(termWidth - sidebarWidth, 40);
  const chatComposerMarginX = 2;
  const chatInputBoxWidth = Math.max(24, chatAreaWidth - chatComposerMarginX * 2);
  const chatTextWidth = Math.max(chatInputBoxWidth - 3, 20);
  const composerContentWidth = chatInputBoxWidth - 1;
  const textWidth = Math.max(Math.floor(termWidth * 0.35) - 4, 20);
  const lastUserPrompt = [...messages].reverse().find(msg => msg.role === 'user')?.content;
  const sidebarRows = buildSidebarRows({
    messages: messages.length,
    modelName,
    currentMode,
    tokensUsed,
    tokenPercent,
    totalCost,
    promptStash,
    lastUserPrompt,
    lastExportPath,
    lastCopyStatus,
    lastForkIndex,
    forkUndoMessages,
    sidebarInnerWidth,
  });
  const sidebarFooterRows = buildSidebarFooterRows({ version, sidebarInnerWidth });
  const sidebarFillRows = Math.max(0, termHeight - 3 - sidebarRows.length - sidebarFooterRows.length);

  const startCommandMenuWidth = textWidth + 2;
  const maxComposerInputLines = 5;

  const commandCategory = (name: string) => {
    if (['help', 'compact', 'clear', 'new', 'save', 'resume', 'restart', 'quit'].includes(name)) return 'Session';
    if (['init', 'status', 'diff', 'undo', 'redo', 'add-dir', 'files', 'context'].includes(name)) return 'Project';
    if (['plan', 'approve', 'skip', 'review', 'commit', 'test', 'retry', 'explain', 'loop', 'batch'].includes(name)) return 'Workflow';
    if (['tools', 'config', 'permissions', 'model', 'mcp', 'version', 'reset'].includes(name)) return 'Tools';
    if (['skills', 'skill', 'hooks', 'plugins'].includes(name)) return 'Skills';
    if (['memory', 'history', 'checkpoints', 'rewind', 'branch'].includes(name)) return 'Memory';
    if (['security-review', 'simplify', 'debug', 'copy'].includes(name)) return 'Quality';
    if (['git', 'github', 'share', 'export'].includes(name)) return 'Git';
    if (['thinking', 'format', 'background', 'vim', 'insights'].includes(name)) return 'TUI';
    if (['doctor', 'bug', 'docs', 'connect'].includes(name)) return 'Diagnostics';
    if (['login', 'logout', 'privacy-settings'].includes(name)) return 'Auth';
    return 'Command';
  };
  const slashFilter = state.slashFilter.trim().toLowerCase();
  const filteredSlashCommands = slashCommands
    .map(cmd => {
      const name = cmd.name.toLowerCase();
      const description = (cmd.description || '').toLowerCase();
      const category = commandCategory(cmd.name).toLowerCase();
      const score = !slashFilter
        ? 0
        : name === slashFilter
          ? 0
          : name.startsWith(slashFilter)
            ? 1
            : category.startsWith(slashFilter)
              ? 2
              : name.includes(slashFilter)
                ? 3
                : category.includes(slashFilter)
                  ? 4
                  : description.includes(slashFilter)
                    ? 5
                    : Number.POSITIVE_INFINITY;
      return { cmd, score };
    })
    .filter(item => item.score !== Number.POSITIVE_INFINITY)
    .sort((a, b) => a.score - b.score || a.cmd.name.localeCompare(b.cmd.name))
    .map(item => item.cmd);
  const activeSlashIndex = Math.min(state.slashIndex, Math.max(0, filteredSlashCommands.length - 1));
  const slashWindowSize = 6;
  const slashWindow = getScrollWindow(filteredSlashCommands, activeSlashIndex, slashWindowSize);
  const slashWindowStart = slashWindow.start;
  const visibleSlashCommands = slashWindow.items;
  const visibleSlashRows = visibleSlashCommands.flatMap((cmd, i) => {
    const category = commandCategory(cmd.name);
    const previous = i > 0 ? commandCategory(visibleSlashCommands[i - 1].name) : undefined;
    const rows: Array<{ type: 'header'; category: string } | { type: 'command'; command: typeof cmd; index: number; category: string }> = [];
    if (category !== previous) rows.push({ type: 'header', category });
    rows.push({ type: 'command', command: cmd, index: slashWindowStart + i, category });
    return rows;
  });
  const inlineSlashRows = visibleSlashRows.filter((row, i, rows) => {
    if (row.type === 'command') return rows.slice(0, i + 1).filter(item => item.type === 'command').length <= 5;
    return rows.slice(i + 1).some(item => item.type === 'command');
  });
  const selectedSlashCommand = filteredSlashCommands[activeSlashIndex];
  const selectedSlashUsage = selectedSlashCommand?.usage ? `/${selectedSlashCommand.usage}` : selectedSlashCommand ? `/${selectedSlashCommand.name}` : '';
  const selectedSlashCategory = selectedSlashCommand ? commandCategory(selectedSlashCommand.name) : '';
  const slashScrollHint = scrollHint(slashWindow.hasMoreAbove, slashWindow.hasMoreBelow);
  const promptStateLabel = [
    state.historyIndex !== null ? 'history' : '',
    promptStash ? 'draft' : '',
  ].filter(Boolean).join(' ');
  const modalWidth = Math.min(termWidth - 8, 76);
  const modalContentWidth = Math.max(20, modalWidth - 6);
  const composerInputStart = Math.max(0, state.cursorRow - maxComposerInputLines + 1);
  const visibleInputLines = state.inputLines.slice(composerInputStart, composerInputStart + maxComposerInputLines);
  const inlineMenuRows = state.showSlashMenu && state.slashMenuMode === 'inline' ? Math.min(inlineSlashRows.length + 6, 13) : 0;
  const visibleInputLineCount = visibleInputLines.length;
  const messageLineBudget = Math.max(4, termHeight - visibleInputLineCount * 2 - inlineMenuRows - 10);
  const composerRows = visibleInputLineCount * 2 + 4 + inlineMenuRows;
  const messagePaneHeight = Math.max(3, termHeight - composerRows - 3);
  let usedMessageLines = 0;
  let visibleMessageStart = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    const nextLineCount = messageLineCount(messages[i], chatTextWidth);
    if (visibleMessageStart < messages.length && usedMessageLines + nextLineCount > messageLineBudget) break;
    usedMessageLines += nextLineCount;
    visibleMessageStart = i;
  }
  const hiddenMessageCount = visibleMessageStart;
  const visibleMessages = messages.slice(visibleMessageStart);

  return (
    // 最外层容器：纵向布局、宽度 100%、高度使用终端实际行数（明确数值）
    // Ink 不支持 height="100%"，需要用明确的数值
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      {/* 主内容区域：命令面板打开时切换为不透明的模态屏幕，避免底层文字干扰 */}
      {state.showExitConfirm ? (
        <DialogFrame termWidth={termWidth} termHeight={termHeight} width={54} borderColor={TUI_THEME.warning}>
            <DialogHeader title="Exit MiniAgent?" color={TUI_THEME.warning} />
            <Box marginTop={1}>
              <Text>Current TUI session will close.</Text>
            </Box>
            <Box marginTop={1} justifyContent="space-between">
              <Text dimColor>Enter / Y confirm</Text>
              <Text dimColor>Esc / N cancel</Text>
            </Box>
        </DialogFrame>
      ) : state.showTimeline ? (
        <TimelineDialog
          messages={messages}
          timelineIndex={state.timelineIndex}
          timelineDetail={state.timelineDetail}
          timelineDetailOffset={state.timelineDetailOffset}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : state.showSlashMenu && state.slashMenuMode === 'modal' ? (
        <CommandPaletteDialog
          width={modalWidth}
          contentWidth={modalContentWidth}
          termWidth={termWidth}
          termHeight={termHeight}
          filter={state.slashFilter}
          totalCount={filteredSlashCommands.length}
          scrollHint={slashScrollHint}
          activeIndex={activeSlashIndex}
          rows={visibleSlashRows}
          selectedName={selectedSlashCommand?.name ?? ''}
          selectedUsage={selectedSlashUsage}
          selectedCategory={selectedSlashCategory}
          selectedDescription={selectedSlashCommand?.description ?? ''}
        />
      ) : !hasConversation ? (
        // 起始页面：Logo + 输入框，垂直居中显示
        // flexGrow={1}：占满除状态栏外的所有剩余空间
        // justifyContent="center"：内部子元素垂直居中
        // alignItems="center"：内部子元素水平居中
        <Box
          flexDirection="column"
          alignItems="center"
          justifyContent={state.showSlashMenu && state.slashMenuMode === 'inline' ? 'flex-start' : 'center'}
          paddingTop={state.showSlashMenu && state.slashMenuMode === 'inline' ? 1 : 0}
          height={termHeight - 1}
        >
          {/* Logo 区域：显示 ASCII 艺术字，使用 #0078d7 蓝色 */}
          <Box flexDirection="column" alignItems="center" marginBottom={1}>
            {/* 遍历 Logo 每一行，使用固定颜色 #0078d7 */}
            {LOGO_LINES.map((line, i) => (
              <Box key={i}>
                <Text color={TUI_THEME.logo}>{line.slice(0, LOGO_SPLIT_INDEX)}</Text>
                <Text color={TUI_THEME.accent}>{line.slice(LOGO_SPLIT_INDEX)}</Text>
              </Box>
            ))}
          </Box>

          {/* 输入框容器：不设置宽度，由子元素自然撑开 */}
          {/* 
            flexDirection="column": 子元素垂直排列（从上到下）
            borderStyle="single": 使用单线边框样式（┌─┐│└─┘），可选值：
              - "single": 单线边框（默认）
              - "double": 双线边框（═║）
              - "round": 圆角边框（╭─╮│╰─╯）
              - "bold": 粗线边框（┏━┓┃┗━┛）
              - 不设此项：无边框
            borderColor="gray": 边框颜色，可选值：
              - "gray"/"grey": 灰色
              - "white"/"black"
              - "red"/"green"/"blue"/"yellow"/"cyan"/"magenta"
              - "dimGray"/"brightRed" 等更多颜色
          */}
          {state.showSlashMenu && state.slashMenuMode === 'inline' && (
            <Box width={startCommandMenuWidth} flexDirection="column" borderStyle="round" borderColor={TUI_THEME.accent} paddingX={1} marginBottom={1}>
              <Box justifyContent="space-between">
                <Text color={TUI_THEME.accent}>Commands</Text>
                <Text dimColor>{filteredSlashCommands.length > 0 ? `${slashScrollHint} ${activeSlashIndex + 1}/${filteredSlashCommands.length}` : '0'}</Text>
              </Box>
              {visibleSlashCommands.length === 0 && <Text dimColor>No commands found</Text>}
              {renderCommandRows({ rows: inlineSlashRows, width: Math.max(20, startCommandMenuWidth - 2), activeIndex: activeSlashIndex, keyPrefix: 'start-inline-command' })}
              {selectedSlashCommand && <Text dimColor>{truncateByWidth(`[${selectedSlashCategory}] ${selectedSlashUsage}`, Math.max(20, startCommandMenuWidth - 2)).text}</Text>}
              <Text dimColor>{fillByWidth(visibleSlashCommands.length === 0 ? 'Backspace edit   Esc close' : (startCommandMenuWidth < 42 ? 'Tab complete   Esc close' : '↑↓ move   Tab/Enter complete   Esc close'), Math.max(20, startCommandMenuWidth - 2))}</Text>
            </Box>
          )}
          <Composer
            inputLines={state.inputLines}
            cursorRow={state.cursorRow}
            cursorCol={state.cursorCol}
            currentMode={currentMode}
            modelName={modelName}
            agentName={state.agentName}
            promptStateLabel={promptStateLabel}
            width={textWidth + 2}
            contentWidth={textWidth + 2}
            textWidth={textWidth}
            maxVisibleLines={maxComposerInputLines}
            position="start"
          />
        </Box>
      ) : (
        // 对话页面：左侧消息/输入框 + 右侧上下贯穿 sidebar
        <Box flexDirection="row" height={termHeight - 1}>
          <Box flexDirection="column" width={chatAreaWidth}>
            <MessageList
              messages={visibleMessages}
              hiddenMessageCount={hiddenMessageCount}
              chatTextWidth={chatTextWidth}
              chatAreaWidth={chatAreaWidth}
              height={messagePaneHeight}
              isProcessing={state.isProcessing}
              currentResponse={state.currentResponse}
            />
            {state.showSlashMenu && state.slashMenuMode === 'inline' && (
              <Box width={chatInputBoxWidth} marginX={chatComposerMarginX} flexDirection="column" borderStyle="round" borderColor={TUI_THEME.accent} paddingX={1} marginBottom={1}>
                <Box justifyContent="space-between">
                  <Text color={TUI_THEME.accent}>Commands</Text>
                  <Text dimColor>{filteredSlashCommands.length > 0 ? `${slashScrollHint} ${activeSlashIndex + 1}/${filteredSlashCommands.length}` : '0'}</Text>
                </Box>
                {visibleSlashCommands.length === 0 && <Text dimColor>No commands found</Text>}
                {renderCommandRows({ rows: inlineSlashRows, width: Math.max(20, chatInputBoxWidth - 4), activeIndex: activeSlashIndex, keyPrefix: 'chat-inline-command' })}
                {selectedSlashCommand && <Text dimColor>{truncateByWidth(`[${selectedSlashCategory}] ${selectedSlashUsage}`, Math.max(20, chatInputBoxWidth - 4)).text}</Text>}
                <Text dimColor>{fillByWidth(visibleSlashCommands.length === 0 ? 'Backspace edit   Esc close' : (chatInputBoxWidth < 42 ? 'Tab complete   Esc close' : '↑↓ move   Tab/Enter complete   Esc close'), Math.max(20, chatInputBoxWidth - 4))}</Text>
              </Box>
            )}
            <Composer
              inputLines={state.inputLines}
              cursorRow={state.cursorRow}
              cursorCol={state.cursorCol}
              currentMode={currentMode}
              modelName={modelName}
              agentName={state.agentName}
              promptStateLabel={promptStateLabel}
              width={chatInputBoxWidth}
              contentWidth={composerContentWidth}
              textWidth={chatTextWidth}
              maxVisibleLines={maxComposerInputLines}
              position="chat"
            />
          {/* 右侧：侧边栏 */}
          <Sidebar
            rows={sidebarRows}
            footerRows={sidebarFooterRows}
            width={sidebarWidth}
            paddingX={sidebarPaddingX}
            fillHeight={sidebarFillRows}
          />
        </Box>
        </Box>
      )}

      <Footer
        cwd={cwd}
        version={version}
        termWidth={termWidth}
        notice={notice}
        isPaletteOpen={state.showSlashMenu && state.slashMenuMode === 'modal'}
        hasConversation={hasConversation}
      />
    </Box>
  );
}
