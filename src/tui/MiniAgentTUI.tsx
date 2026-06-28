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
import { copyTranscript } from './primitives/Transcript.js';
import {
  createSessionToggles, toggleTimestamps, toggleThinking,
  toggleToolDetails, toggleScrollbar, toggleSidebar, toggleConcealCode,
  type SessionToggles,
} from './primitives/SessionToggles.js';
import {
  createUndoRedoState, pushSnapshot, undo, redo,
  type UndoRedoState,
} from './primitives/UndoRedo.js';
import {
  PermissionPrompt, createPermissionState, resolvePermission,
  type PermissionAction, type PermissionState,
} from './primitives/PermissionPrompt.js';
import {
  QuestionPrompt, createQuestionState, resolveQuestion,
  type QuestionState,
} from './primitives/QuestionPrompt.js';
import {
  createSessionManager, createSession, switchSession, getCurrentSession,
  updateSessionMessages, renameSession, deleteSession, pinSession,
  saveSession, loadSessions, deleteSessionFile,
  type SessionManagerState,
} from './primitives/SessionManager.js';
import {
  ModelSelector, createModelSelectorState, openModelSelector, closeModelSelector,
  modelSelectorUp, modelSelectorDown, modelSelectorType, modelSelectorBackspace,
  type ModelSelectorState, type ModelInfo,
} from './primitives/ModelSelector.js';
import {
  AgentSelector, createAgentSelectorState, openAgentSelector, closeAgentSelector,
  agentSelectorUp, agentSelectorDown,
  type AgentSelectorState,
} from './primitives/AgentSelector.js';
import {
  WhichKey, createWhichKeyState, openWhichKey, closeWhichKey,
  DEFAULT_KEYBINDINGS,
  type WhichKeyState,
} from './primitives/WhichKey.js';
import {
  createThemeState, nextTheme,
  type ThemeState,
} from './primitives/theme.js';
import {
  moveWordLeft, moveWordRight, deleteLine, deleteToLineEnd,
  deleteWordLeft, deleteWordRight,
} from './primitives/InputActions.js';
import {
  SessionListDialog, createSessionListState, openSessionList, closeSessionList,
  sessionListUp, sessionListDown, sessionListType, sessionListBackspace,
  type SessionListState,
} from './primitives/SessionListDialog.js';
import {
  SessionRenameDialog, createSessionRenameState, openSessionRename, closeSessionRename,
  sessionRenameType, sessionRenameBackspace,
  type SessionRenameState,
} from './primitives/SessionRenameDialog.js';
import {
  StashListDialog, createStashListState, openStashList, closeStashList,
  stashListUp, stashListDown,
  type StashListState,
} from './primitives/StashListDialog.js';
import {
  ExportOptionsDialog, createExportOptionsState, openExportOptions, closeExportOptions,
  exportOptionsUp, exportOptionsDown, exportOptionsToggle,
  type ExportOptionsState,
} from './primitives/ExportOptionsDialog.js';
import { ErrorBoundary } from './primitives/ErrorBoundary.js';
import { Logo, getLogoHeight, type LogoVariant } from './primitives/Logo.js';
import { CompactionMarker as _CompactionMarker } from './primitives/CompactionMarker.js';
import { detectPaste as _detectPaste } from './primitives/PasteSummary.js';
import { getDialogWidth as _getDialogWidth, getContentWidth as _getContentWidth, type DialogSize } from './primitives/DialogSize.js';
import { createModeStack, pushMode as _pushMode, popMode as _popMode, currentMode as _currentModeStack, type ModeStack } from './primitives/ModeStack.js';
import { findAtTrigger, filterFiles, listFiles, AutocompletePopup, type FileEntry } from './primitives/FileAutocomplete.js';
import { createFrecencyState, recordUse as _recordUse, rankByFrecency as _rankByFrecency, type FrecencyState } from './primitives/FrecencyHistory.js';
import { createQuickSwitchState, getSlotSessionId, type QuickSwitchState } from './primitives/QuickSwitch.js';
import { openEditor } from './primitives/EditorIntegration.js';
import { RetryAction, createRetryActionState, closeRetryAction, type RetryActionState } from './primitives/RetryActionDialog.js';
import { whichKeyNextCategory, whichKeyPrevCategory, whichKeyToggleLayout } from './primitives/WhichKey.js';
import { SessionDestinationPicker, createSessionDestinationState, closeSessionDestination, type SessionDestinationState } from './primitives/SessionDestination.js';
import { ConsolePanel, createConsoleState, toggleConsole, type ConsoleState } from './primitives/ConsolePanel.js';
import { UpdateNotification, createUpdateState, closeUpdate, type UpdateState } from './primitives/UpdateNotification.js';
import { VariantDialog, createVariantState, closeVariant, type VariantState } from './primitives/VariantDialog.js';
import { McpDialog, createMcpState, closeMcp, type McpState } from './primitives/McpDialog.js';
import { StatusDialog, createStatusState, openStatus, closeStatus, type StatusState } from './primitives/StatusDialog.js';
import { HelpDialog, createHelpState, closeHelp, type HelpState } from './primitives/HelpDialog.js';
import { SkillDialog, createSkillState, closeSkill, type SkillState } from './primitives/SkillDialog.js';
import { MessageDialog, createMessageDialogState, closeMessageDialog, type MessageDialogState } from './primitives/MessageDialog.js';
import { TagDialog, createTagState, closeTag, type TagState } from './primitives/TagDialog.js';
import { ForkDialog, createForkState, closeFork, type ForkState } from './primitives/ForkDialog.js';
import { SubagentDialog, createSubagentDialogState, closeSubagentDialog, type SubagentDialogState } from './primitives/SubagentDialog.js';
import { ThemeListDialog, createThemeListState, openThemeList, closeThemeList, type ThemeListState } from './primitives/ThemeListDialog.js';
import { QueuedPromptsDialog, createQueuedPromptsState, closeQueuedPrompts, type QueuedPromptsState } from './primitives/QueuedPromptsDialog.js';

// Agent 模式列表：Build（构建模式）和 Plan（规划模式）
const AGENT_MODES = ['Build', 'Plan'] as const;

// TUI 组件接收的 props 类型定义
interface TUIProps {
  agent: Agent;              // Agent 实例，用于处理对话
  model: string;             // 模型名称，如 "gpt-4"
  cwd: string;               // 当前工作目录路径
  version: string;           // 应用版本号
  onExit: () => void;        // 退出回调函数
  onCursorMove?: (row: number, col: number) => void;  // 光标定位回调（IME支持）
  onCursorHide?: () => void;                          // 隐藏光标回调
  onExclusionZonesChange?: (zones: { x: number; y: number; width: number; height: number }[]) => void;
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

// TUI 主组件：渲染整个终端用户界面
export function MiniAgentTUI({ agent, model, cwd, version, onExit, onCursorMove, onCursorHide, onExclusionZonesChange }: TUIProps) {
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
  const [scrollOffset, setScrollOffset] = useState(0);
  const [sessionToggles, setSessionToggles] = useState<SessionToggles>(() => createSessionToggles());
  const [undoRedoState, setUndoRedoState] = useState<UndoRedoState>(() => createUndoRedoState());
  const [permState, setPermState] = useState<PermissionState>(() => createPermissionState());
  const [questionState, setQuestionState] = useState<QuestionState>(() => createQuestionState());
  const [activePermIndex, setActivePermIndex] = useState(0);
  const [sessionManager, setSessionManager] = useState<SessionManagerState>(() => createSessionManager(cwd));
  const [modelSelector, setModelSelector] = useState<ModelSelectorState>(() => createModelSelectorState());
  const [agentSelector, setAgentSelector] = useState<AgentSelectorState>(() => createAgentSelectorState());
  const [whichKey, setWhichKey] = useState<WhichKeyState>(() => createWhichKeyState());
  const [_themeState, setThemeState] = useState<ThemeState>(() => createThemeState());
  const [sessionList, setSessionList] = useState<SessionListState>(() => createSessionListState());
  const [sessionRename, setSessionRename] = useState<SessionRenameState>(() => createSessionRenameState());
  const [stashList, setStashList] = useState<StashListState>(() => createStashListState());
  const [exportOptions, setExportOptions] = useState<ExportOptionsState>(() => createExportOptionsState());
  const [_modeStack, _setModeStack] = useState<ModeStack>(() => createModeStack());
  const [autocompleteFiles, setAutocompleteFiles] = useState<FileEntry[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [_frecency] = useState<FrecencyState>(() => createFrecencyState());
  const [_dialogSize, setDialogSize] = useState<DialogSize>('medium');
  const [_terminalTitle, setTerminalTitle] = useState('MiniAgent');
  const [quickSwitch, _setQuickSwitch] = useState<QuickSwitchState>(() => createQuickSwitchState());
  const [retryAction, setRetryAction] = useState<RetryActionState>(() => createRetryActionState());
  const [sessionDestination, setSessionDestination] = useState<SessionDestinationState>(() => createSessionDestinationState());
  const [consolePanel, setConsolePanel] = useState<ConsoleState>(() => createConsoleState());
  const [updateNotif, setUpdateNotif] = useState<UpdateState>(() => createUpdateState());
  const [variantState, setVariantState] = useState<VariantState>(() => createVariantState());
  const [mcpState, setMcpState] = useState<McpState>(() => createMcpState());
  const [statusState, setStatusState] = useState<StatusState>(() => createStatusState());
  const [helpState, setHelpState] = useState<HelpState>(() => createHelpState());
  const [skillState, setSkillState] = useState<SkillState>(() => createSkillState());
  const [messageDialog, setMessageDialog] = useState<MessageDialogState>(() => createMessageDialogState());
  const [tagState, setTagState] = useState<TagState>(() => createTagState());
  const [forkState, setForkState] = useState<ForkState>(() => createForkState());
  const [subagentDialog, setSubagentDialog] = useState<SubagentDialogState>(() => createSubagentDialogState());
  const [themeList, setThemeList] = useState<ThemeListState>(() => createThemeListState());
  const [queuedPrompts, setQueuedPrompts] = useState<QueuedPromptsState>(() => createQueuedPromptsState());
  const [leaderActive, setLeaderActive] = useState(false);
  const [leaderTimeout, setLeaderTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [logoVariant, setLogoVariant] = useState<LogoVariant>('bold');
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

  // Auto-scroll to bottom when new messages arrive (if not manually scrolled up)
  useEffect(() => {
    if (scrollOffset === 0) return; // already at bottom
    setScrollOffset(0);
  }, [messages.length]);

  // Load sessions on mount
  useEffect(() => {
    loadSessions(path.join(cwd, '.miniagent', 'sessions')).then(sessions => {
      setSessionManager(prev => ({ ...prev, sessions }));
    }).catch(() => {});
  }, [cwd]);

  // Position terminal cursor at input area for IME support
  // After Ink renders, we show the cursor and move it to the input position
  // so IME candidate boxes appear at the right place
  useEffect(() => {
    // Hide cursor when dialogs are open
    if (state.showSlashMenu || permState.pending.length > 0
        || questionState.pending.length > 0 || helpState.isOpen || statusState.isOpen
        || stashList.isOpen || exportOptions.isOpen || sessionList.isOpen
        || sessionRename.isOpen || themeList.isOpen || mcpState.isOpen
        || skillState.isOpen || tagState.isOpen || forkState.isOpen
        || subagentDialog.isOpen || messageDialog.isOpen || queuedPrompts.isOpen
        || variantState.isOpen || consolePanel.isOpen) {
      onCursorHide?.();
      return;
    }

    const composerInputStartCalc = Math.max(0, state.cursorRow - maxComposerInputLines + 1);
    // Start page Composer: 3 rows (input + status + hints), cursor always on row 0
    const cursorRowInComposer = !hasConversation ? 0 : (state.cursorRow - composerInputStartCalc) * 2;

    // Calculate display width of text before cursor (handles double-width CJK chars)
    const currentLine = state.inputLines[state.cursorRow] ?? '';
    const displayWidthBeforeCursor = getStringWidth(currentLine.slice(0, state.cursorCol));

    let cursorRow: number;
    let cursorCol: number;

    if (!hasConversation) {
      // === START PAGE ===
      const logoHeight = getLogoHeight(logoVariant);
      const fixedTopOffset = Math.max(0, Math.floor((termHeight - 1 - logoHeight - 3 - 10) / 2));
      const spacerHeight = 3;

      cursorRow = fixedTopOffset + logoHeight + spacerHeight + state.cursorRow;
      const composerWidth = textWidth + 2;
      const centerX = Math.max(0, Math.floor((termWidth - composerWidth) / 2));
      cursorCol = centerX + displayWidthBeforeCursor;
    } else {
      // === CHAT PAGE ===
      // Composer (position="chat") structure:
      //   1: top padding, inputLineCount × 2, 1: bottom padding, 1: mode, 1: divider, 1: hint, 1: marginBottom
      const composerTotalHeight = /* visibleInputLineCount × 2 + 6 */ 0;
      void composerTotalHeight;

      cursorRow = messagePaneHeight + inlineMenuRows + consolePanelHeight + cursorRowInComposer;
      // marginX=2 + border ┃ = 3 columns offset
      cursorCol = 3 + displayWidthBeforeCursor;
    }

    // Only position if cursor is within visible area
    if (cursorRow > 0 && cursorRow < termHeight && cursorCol >= 0 && cursorCol < termWidth) {
      onCursorMove?.(cursorRow, cursorCol);
    }
  });

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
      createdAt: Date.now(),
    };
    // Push snapshot for undo/redo
    setUndoRedoState(prev => pushSnapshot(prev, messages));
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

    // ==================== PermissionPrompt: arrow keys + Enter ====================
    if (permState.pending.length > 0) {
      const currentPerm = permState.pending[0];
      if (key.ctrl && input.toLowerCase() === 'f') {
        setNotice({ message: 'Permission fullscreen toggled', level: 'info' });
        return;
      }
      if (key.leftArrow) {
        setActivePermIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (key.rightArrow) {
        setActivePermIndex(prev => Math.min(2, prev + 1));
        return;
      }
      if (isEnterKey) {
        const actions: PermissionAction[] = ['allow_once', 'allow_always', 'reject'];
        const action = actions[activePermIndex];
        setPermState(prev => resolvePermission(prev, currentPerm.id, action));
        if (action === 'reject') {
          setNotice({ message: 'Permission rejected', level: 'warning' });
        } else {
          setNotice({ message: `Permission ${action}`, level: 'success' });
        }
        return;
      }
      if (key.escape || input.toLowerCase() === 'n') {
        setPermState(prev => resolvePermission(prev, currentPerm.id, 'reject'));
        setNotice({ message: 'Permission rejected', level: 'warning' });
        return;
      }
      return;
    }

    // ==================== QuestionPrompt: arrow keys + Enter ====================
    if (questionState.pending.length > 0) {
      const currentQuestion = questionState.pending[0];
      if (key.upArrow) {
        setActivePermIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setActivePermIndex(prev => Math.min(currentQuestion.options.length - 1, prev + 1));
        return;
      }
      if (isEnterKey) {
        const selectedOption = currentQuestion.options[activePermIndex];
        if (selectedOption) {
          setQuestionState(prev => resolveQuestion(prev, currentQuestion.id));
          setNotice({ message: `Answered: ${selectedOption.label}`, level: 'success' });
        }
        return;
      }
      if (key.escape) {
        setQuestionState(prev => resolveQuestion(prev, currentQuestion.id));
        setNotice({ message: 'Question dismissed', level: 'warning' });
        return;
      }
      return;
    }

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

    // ==================== ScrollCommands: PageUp/PageDn ====================
    if (key.pageUp) {
      setScrollOffset(prev => Math.min(prev + Math.floor(messagePaneHeight / 2), Math.max(0, messages.length - messagePaneHeight)));
      return;
    }
    if (key.pageDown) {
      setScrollOffset(prev => Math.max(prev - Math.floor(messagePaneHeight / 2), 0));
      return;
    }
    // Ctrl+Up: half page up
    if (key.ctrl && key.upArrow) {
      setScrollOffset(prev => Math.min(prev + Math.floor(messagePaneHeight / 2), Math.max(0, messages.length - messagePaneHeight)));
      return;
    }
    // Ctrl+Down: half page down
    if (key.ctrl && key.downArrow) {
      setScrollOffset(prev => Math.max(prev - Math.floor(messagePaneHeight / 2), 0));
      return;
    }
    // Ctrl+Home: scroll to top
    if (key.ctrl && isHomeKey) {
      setScrollOffset(Math.max(0, messages.length - messagePaneHeight));
      return;
    }
    // Ctrl+End: scroll to bottom
    if (key.ctrl && isEndKey) {
      setScrollOffset(0);
      return;
    }

    // ==================== Diff Navigation: [ ] n p b s d v ? ====================
    if (input === '[') {
      setNotice({ message: 'Previous diff hunk', level: 'info' });
      return;
    }
    if (input === ']') {
      setNotice({ message: 'Next diff hunk', level: 'info' });
      return;
    }
    if (input === 'n' && !state.showSlashMenu && !sessionList.isOpen) {
      // Only if diff viewer is open
      return;
    }
    if (input === 'p' && !state.showSlashMenu && !sessionList.isOpen) {
      return;
    }
    if (input === 'b') {
      setNotice({ message: 'Toggle file tree', level: 'info' });
      return;
    }
    if (input === 's') {
      setNotice({ message: 'Single patch view', level: 'info' });
      return;
    }
    if (input === 'd') {
      setNotice({ message: 'Switch diff source', level: 'info' });
      return;
    }
    if (input === 'v') {
      setNotice({ message: 'Toggle split/unified', level: 'info' });
      return;
    }
    if (input === '?') {
      setWhichKey(prev => openWhichKey(prev));
      return;
    }

    // ==================== SessionToggles: Ctrl+Shift+T prefix ====================
    // Ctrl+Shift+T then key for toggle (T=timestamps, H=thinking, D=tool details, S=scrollbar, B=sidebar, C=code conceal)
    // Using direct combos instead for simplicity:
    if (key.ctrl && key.shift && input.toLowerCase() === 't') {
      setSessionToggles(prev => { const next = toggleTimestamps(prev); setNotice({ message: `Timestamps: ${next.timestamps ? 'on' : 'off'}`, level: 'info' }); return next; });
      return;
    }
    if (key.ctrl && key.shift && input.toLowerCase() === 'h') {
      setSessionToggles(prev => { const next = toggleThinking(prev); setNotice({ message: `Thinking: ${next.showThinking ? 'on' : 'off'}`, level: 'info' }); return next; });
      return;
    }
    if (key.ctrl && key.shift && input.toLowerCase() === 'd') {
      setSessionToggles(prev => { const next = toggleToolDetails(prev); setNotice({ message: `Tool details: ${next.showToolDetails ? 'on' : 'off'}`, level: 'info' }); return next; });
      return;
    }
    if (key.ctrl && key.shift && input.toLowerCase() === 's') {
      setSessionToggles(prev => { const next = toggleScrollbar(prev); setNotice({ message: `Scrollbar: ${next.showScrollbar ? 'on' : 'off'}`, level: 'info' }); return next; });
      return;
    }
    if (key.ctrl && key.shift && input.toLowerCase() === 'b') {
      setSessionToggles(prev => { const next = toggleSidebar(prev); setNotice({ message: `Sidebar: ${next.sidebarVisible ? 'on' : 'off'}`, level: 'info' }); return next; });
      return;
    }
    if (key.ctrl && key.shift && input.toLowerCase() === 'g') {
      setSessionToggles(prev => { const next = toggleConcealCode(prev); setNotice({ message: `Code conceal: ${next.concealCode ? 'on' : 'off'}`, level: 'info' }); return next; });
      return;
    }

    // ==================== UndoRedo: Ctrl+Z / Ctrl+Shift+Z ====================
    if (key.ctrl && !key.shift && input.toLowerCase() === 'z') {
      const result = undo(undoRedoState);
      if (result.messages) {
        setUndoRedoState(result.state);
        setMessages(result.messages);
        setNotice({ message: 'Undo', level: 'info' });
      } else {
        setNotice({ message: 'Nothing to undo', level: 'warning' });
      }
      return;
    }
    if (key.ctrl && key.shift && input.toLowerCase() === 'z') {
      const result = redo(undoRedoState);
      if (result.messages) {
        setUndoRedoState(result.state);
        setMessages(result.messages);
        setNotice({ message: 'Redo', level: 'info' });
      } else {
        setNotice({ message: 'Nothing to redo', level: 'warning' });
      }
      return;
    }

    // ==================== Transcript: Ctrl+Shift+C ====================
    if (key.ctrl && key.shift && input.toLowerCase() === 'c') {
      if (messages.length > 0) {
        copyTranscript(messages, { modelName })
          .then(result => {
            if (result.ok) {
              setNotice({ message: 'Copied transcript', level: 'success' });
            } else {
              setNotice({ message: `Copy failed: ${result.error}`, level: 'error' });
            }
          });
      } else {
        setNotice({ message: 'No messages to copy', level: 'warning' });
      }
      return;
    }

    // ==================== Session Manager: Ctrl+O (list), Ctrl+N (new), Ctrl+S (save) ====================
    if (key.ctrl && input.toLowerCase() === 'o') {
      updateState(prev => ({ ...prev, showSlashMenu: false, slashMenuMode: 'modal' }));
      // Toggle session list view
      setNotice({ message: `Sessions: ${sessionManager.sessions.length} total`, level: 'info' });
      return;
    }
    if (key.ctrl && input.toLowerCase() === 'n') {
      setSessionManager(prev => {
        const next = createSession(prev, undefined, model, currentMode);
        saveSession(next.session, prev.sessionDir).catch(() => {});
        return next.state;
      });
      setMessages([]);
      updateState(prev => ({ ...prev, currentResponse: '', isProcessing: false, historyIndex: null }));
      setNotice({ message: 'New session created', level: 'success' });
      return;
    }
    if (key.ctrl && input.toLowerCase() === 's') {
      const current = getCurrentSession(sessionManager);
      if (current) {
        const updated = updateSessionMessages(sessionManager, current.id, messages);
        setSessionManager(updated);
        const session = getCurrentSession(updated);
        if (session) {
          saveSession(session, sessionManager.sessionDir).catch(() => {});
        }
        setNotice({ message: 'Session saved', level: 'success' });
      }
      return;
    }

    // ==================== Model Selector: Ctrl+M ====================
    if (key.ctrl && input.toLowerCase() === 'm') {
      const models: ModelInfo[] = [
        { id: model, name: model, provider: 'Ollama', favorite: true },
        { id: 'llama3.2', name: 'llama3.2', provider: 'Ollama' },
        { id: 'codellama', name: 'codellama', provider: 'Ollama' },
        { id: 'deepseek-coder', name: 'deepseek-coder', provider: 'Ollama' },
        { id: 'mistral', name: 'mistral', provider: 'Ollama' },
        { id: 'qwen2.5-coder', name: 'qwen2.5-coder', provider: 'Ollama' },
      ];
      setModelSelector(prev => prev.isOpen ? closeModelSelector(prev) : openModelSelector(prev, models));
      return;
    }

    // ==================== Agent Selector: Ctrl+Shift+A ====================
    if (key.ctrl && key.shift && input.toLowerCase() === 'a') {
      setAgentSelector(prev => prev.isOpen ? closeAgentSelector(prev) : openAgentSelector(prev));
      return;
    }

    // ==================== Which-Key: F1 ====================
    if (input === '\u001bOP' || input === '\u001b[11~') {
      setWhichKey(prev => prev.isOpen ? closeWhichKey(prev) : openWhichKey(prev));
      return;
    }

    // ==================== Theme: Ctrl+Shift+X ====================
    if (key.ctrl && key.shift && input.toLowerCase() === 'x') {
      setThemeState(prev => {
        const next = nextTheme(prev);
        setNotice({ message: `Theme: ${next.current}`, level: 'info' });
        return next;
      });
      return;
    }

    // ==================== Logo Variant: Ctrl+Shift+L ====================
    if (key.ctrl && key.shift && input.toLowerCase() === 'l') {
      setLogoVariant(prev => {
        const next = prev === 'bold' ? 'compact' : 'bold';
        setNotice({ message: `Logo: ${next}`, level: 'info' });
        return next;
      });
      return;
    }

    // ==================== Model Selector keyboard ====================
    if (modelSelector.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setModelSelector(prev => modelSelectorUp(prev));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setModelSelector(prev => modelSelectorDown(prev, prev.models.length));
        return;
      }
      if (isEnterKey) {
        const selected = modelSelector.models[modelSelector.selectedIndex];
        if (selected) {
          setNotice({ message: `Selected model: ${selected.name}`, level: 'success' });
        }
        setModelSelector(prev => closeModelSelector(prev));
        return;
      }
      if (isBackspaceKey) {
        setModelSelector(prev => modelSelectorBackspace(prev));
        return;
      }
      if (key.escape) {
        setModelSelector(prev => closeModelSelector(prev));
        return;
      }
      if (input.length === 1 && input >= ' ') {
        setModelSelector(prev => modelSelectorType(prev, input));
        return;
      }
      return;
    }

    // ==================== Agent Selector keyboard ====================
    if (agentSelector.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setAgentSelector(prev => agentSelectorUp(prev));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setAgentSelector(prev => agentSelectorDown(prev));
        return;
      }
      if (isEnterKey) {
        const selected = agentSelector.agents[agentSelector.selectedIndex];
        if (selected) {
          updateState(prev => ({ ...prev, agentName: selected.name.toLowerCase() }));
          setNotice({ message: `Selected agent: ${selected.name}`, level: 'success' });
        }
        setAgentSelector(prev => closeAgentSelector(prev));
        return;
      }
      if (key.escape) {
        setAgentSelector(prev => closeAgentSelector(prev));
        return;
      }
      return;
    }

    // ==================== Which-Key keyboard ====================
    if (whichKey.isOpen) {
      if (key.escape || (key.ctrl && input === 'p')) {
        setWhichKey(prev => closeWhichKey(prev));
        return;
      }
      return;
    }

    // ==================== Session List: Ctrl+O ====================
    if (key.ctrl && input.toLowerCase() === 'o') {
      setSessionList(prev => prev.isOpen ? closeSessionList(prev) : openSessionList(prev));
      return;
    }

    // ==================== Session Rename: Ctrl+Shift+R ====================
    if (key.ctrl && key.shift && input.toLowerCase() === 'r') {
      const current = getCurrentSession(sessionManager);
      if (current) {
        setSessionRename(prev => prev.isOpen ? closeSessionRename(prev) : openSessionRename(prev, current.title));
      }
      return;
    }

    // ==================== Stash List: Ctrl+Shift+U ====================
    if (key.ctrl && key.shift && input.toLowerCase() === 'u') {
      setStashList(prev => prev.isOpen ? closeStashList(prev) : openStashList(prev));
      return;
    }

    // ==================== Export Options: Ctrl+Shift+E ====================
    if (key.ctrl && key.shift && input.toLowerCase() === 'e') {
      const current = getCurrentSession(sessionManager);
      setExportOptions(prev => prev.isOpen ? closeExportOptions(prev) : openExportOptions(prev, current?.title || 'session'));
      return;
    }

    // ==================== Session List keyboard ====================
    if (sessionList.isOpen) {
      const filteredSessions = sessionManager.sessions;
      if (key.upArrow || input.toLowerCase() === 'k') {
        setSessionList(prev => sessionListUp(prev));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setSessionList(prev => sessionListDown(prev, filteredSessions.length));
        return;
      }
      if (isEnterKey) {
        const selected = filteredSessions[sessionList.selectedIndex];
        if (selected) {
          setSessionManager(prev => switchSession(prev, selected.id));
          setMessages(selected.messages);
          setNotice({ message: `Loaded: ${selected.title}`, level: 'success' });
        }
        setSessionList(prev => closeSessionList(prev));
        return;
      }
      if (input.toLowerCase() === 'p') {
        const selected = filteredSessions[sessionList.selectedIndex];
        if (selected) {
          setSessionManager(prev => pinSession(prev, selected.id));
          setNotice({ message: `Toggled pin: ${selected.title}`, level: 'info' });
        }
        return;
      }
      if (input.toLowerCase() === 'd') {
        const selected = filteredSessions[sessionList.selectedIndex];
        if (selected) {
          setSessionManager(prev => {
            const next = deleteSession(prev, selected.id);
            deleteSessionFile(selected.id, next.sessionDir).catch(() => {});
            return next;
          });
          setNotice({ message: `Deleted: ${selected.title}`, level: 'warning' });
        }
        return;
      }
      if (isBackspaceKey) {
        setSessionList(prev => sessionListBackspace(prev));
        return;
      }
      if (key.escape) {
        setSessionList(prev => closeSessionList(prev));
        return;
      }
      if (input.length === 1 && input >= ' ') {
        setSessionList(prev => sessionListType(prev, input));
        return;
      }
      return;
    }

    // ==================== Session Rename keyboard ====================
    if (sessionRename.isOpen) {
      if (isEnterKey && sessionRename.value.trim()) {
        const current = getCurrentSession(sessionManager);
        if (current) {
          setSessionManager(prev => renameSession(prev, current.id, sessionRename.value.trim()));
          setNotice({ message: `Renamed to: ${sessionRename.value.trim()}`, level: 'success' });
        }
        setSessionRename(prev => closeSessionRename(prev));
        return;
      }
      if (isBackspaceKey) {
        setSessionRename(prev => sessionRenameBackspace(prev));
        return;
      }
      if (key.escape) {
        setSessionRename(prev => closeSessionRename(prev));
        return;
      }
      if (input.length === 1 && input >= ' ') {
        setSessionRename(prev => sessionRenameType(prev, input));
        return;
      }
      return;
    }

    // ==================== Stash List keyboard ====================
    if (stashList.isOpen) {
      const stashEntries = promptStash ? [{ id: 'stash-0', text: promptStash, timestamp: Date.now(), lineCount: promptStash.split('\n').length }] : [];
      if (key.upArrow || input.toLowerCase() === 'k') {
        setStashList(prev => stashListUp(prev));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setStashList(prev => stashListDown(prev, stashEntries.length));
        return;
      }
      if (isEnterKey && stashEntries.length > 0) {
        const entry = stashEntries[stashList.selectedIndex];
        if (entry) {
          const lines = entry.text.split('\n');
          updateState(prev => ({ ...prev, inputLines: lines, cursorRow: lines.length - 1, cursorCol: lines.at(-1)?.length || 0, historyIndex: null, showSlashMenu: false }));
          setPromptStash(null);
          persistPromptStash(null).catch(() => {});
          setNotice({ message: 'Restored stashed prompt', level: 'success' });
        }
        setStashList(prev => closeStashList(prev));
        return;
      }
      if (input.toLowerCase() === 'd' && stashEntries.length > 0) {
        setPromptStash(null);
        persistPromptStash(null).catch(() => {});
        setNotice({ message: 'Stash deleted', level: 'warning' });
        setStashList(prev => closeStashList(prev));
        return;
      }
      if (key.escape) {
        setStashList(prev => closeStashList(prev));
        return;
      }
      return;
    }

    // ==================== Export Options keyboard ====================
    if (exportOptions.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setExportOptions(prev => exportOptionsUp(prev));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setExportOptions(prev => exportOptionsDown(prev));
        return;
      }
      if (input === ' ') {
        setExportOptions(prev => exportOptionsToggle(prev));
        return;
      }
      if (isEnterKey) {
        handleExportConversation().catch(() => {});
        setExportOptions(prev => closeExportOptions(prev));
        return;
      }
      if (key.escape) {
        setExportOptions(prev => closeExportOptions(prev));
        return;
      }
      return;
    }

    // ==================== Enhanced Input Actions ====================
    // Ctrl+Left: word left
    if (key.ctrl && key.leftArrow) {
      const result = moveWordLeft(state.inputLines, state.cursorRow, state.cursorCol);
      updateState(prev => ({ ...prev, inputLines: result.lines, cursorRow: result.cursorRow, cursorCol: result.cursorCol }));
      return;
    }
    // Ctrl+Right: word right
    if (key.ctrl && key.rightArrow) {
      const result = moveWordRight(state.inputLines, state.cursorRow, state.cursorCol);
      updateState(prev => ({ ...prev, inputLines: result.lines, cursorRow: result.cursorRow, cursorCol: result.cursorCol }));
      return;
    }
    // Ctrl+Shift+D: delete line
    if (key.ctrl && key.shift && input.toLowerCase() === 'd') {
      const result = deleteLine(state.inputLines, state.cursorRow, state.cursorCol);
      updateState(prev => ({ ...prev, inputLines: result.lines, cursorRow: result.cursorRow, cursorCol: result.cursorCol }));
      return;
    }
    // Ctrl+K: delete to line end
    if (key.ctrl && input.toLowerCase() === 'k') {
      const result = deleteToLineEnd(state.inputLines, state.cursorRow, state.cursorCol);
      updateState(prev => ({ ...prev, inputLines: result.lines, cursorRow: result.cursorRow, cursorCol: result.cursorCol }));
      return;
    }
    // Ctrl+Backspace: delete word left
    if (key.ctrl && isBackspaceKey) {
      const result = deleteWordLeft(state.inputLines, state.cursorRow, state.cursorCol);
      updateState(prev => ({ ...prev, inputLines: result.lines, cursorRow: result.cursorRow, cursorCol: result.cursorCol, historyIndex: null }));
      return;
    }
    // Ctrl+Delete: delete word right
    if (key.ctrl && isForwardDeleteKey) {
      const result = deleteWordRight(state.inputLines, state.cursorRow, state.cursorCol);
      updateState(prev => ({ ...prev, inputLines: result.lines, cursorRow: result.cursorRow, cursorCol: result.cursorCol, historyIndex: null }));
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

    // ==================== File Autocomplete (@ trigger) ====================
    if (showAutocomplete) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setAutocompleteIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setAutocompleteIndex(prev => Math.min(autocompleteFiles.length - 1, prev + 1));
        return;
      }
      if (key.tab || isEnterKey) {
        const selected = autocompleteFiles[autocompleteIndex];
        if (selected) {
          // Replace @query with the selected file path
          const currentLine = state.inputLines[state.cursorRow];
          const trigger = findAtTrigger(currentLine, state.cursorCol);
          if (trigger) {
            const before = currentLine.slice(0, trigger.start);
            const after = currentLine.slice(state.cursorCol);
            const newText = before + '@' + selected.relativePath + ' ' + after;
            updateState(prev => ({
              ...prev,
              inputLines: prev.inputLines.map((l, i) => i === prev.cursorRow ? newText : l),
              cursorCol: before.length + selected.relativePath.length + 2,
            }));
          }
        }
        setShowAutocomplete(false);
        return;
      }
      if (key.escape) {
        setShowAutocomplete(false);
        return;
      }
      if (isBackspaceKey) {
        setAutocompleteQuery(prev => {
          const next = prev.slice(0, -1);
          if (next.length === 0) {
            setShowAutocomplete(false);
            return '';
          }
          // Re-filter files
          listFiles(cwd, cwd).then(files => {
            setAutocompleteFiles(filterFiles(files, next));
          }).catch(() => {});
          return next;
        });
        return;
      }
      if (input.length === 1 && input >= ' ') {
        setAutocompleteQuery(prev => {
          const next = prev + input;
          listFiles(cwd, cwd).then(files => {
            setAutocompleteFiles(filterFiles(files, next));
          }).catch(() => {});
          return next;
        });
        return;
      }
      return;
    }

    // ==================== Dynamic Terminal Title ====================
    if (key.ctrl && key.shift && input.toLowerCase() === 'w') {
      setTerminalTitle(prev => {
        const next = prev === 'MiniAgent' ? `${modelName} | MiniAgent` : 'MiniAgent';
        process.title = next;
        setNotice({ message: `Title: ${next}`, level: 'info' });
        return next;
      });
      return;
    }

    // ==================== Dialog Size Toggle: Ctrl+Shift+Z ====================
    if (key.ctrl && key.shift && input.toLowerCase() === 'z') {
      setDialogSize(prev => {
        const sizes: DialogSize[] = ['medium', 'large', 'xlarge'];
        const idx = sizes.indexOf(prev);
        const next = sizes[(idx + 1) % sizes.length];
        setNotice({ message: `Dialog size: ${next}`, level: 'info' });
        return next;
      });
      return;
    }

    // ==================== Quick Switch: Ctrl+1-9 ====================
    if (key.ctrl && input >= '1' && input <= '9') {
      const slot = parseInt(input) - 1;
      const sessionId = getSlotSessionId(quickSwitch, slot);
      if (sessionId) {
        const session = sessionManager.sessions.find(s => s.id === sessionId);
        if (session) {
          setSessionManager(prev => ({
            ...prev,
            currentSessionId: session.id,
          }));
          setMessages(session.messages);
          setNotice({ message: `Switched to: ${session.title}`, level: 'success' });
        }
      } else {
        setNotice({ message: `Slot ${slot + 1} is empty`, level: 'warning' });
      }
      return;
    }

    // ==================== Editor Integration: Ctrl+E (long press) or Ctrl+Shift+E ====================
    // Already using Ctrl+E for export. Use a different combo or integrate differently.
    // For now, Ctrl+Shift+E opens editor (export options already uses this, so use Ctrl+Shift+J)
    if (key.ctrl && key.shift && input.toLowerCase() === 'j') {
      openEditor(state.inputLines.join('\n'), 'prompt').then(result => {
        if (!result.cancelled && result.content.trim()) {
          const lines = result.content.split('\n');
          updateState(prev => ({
            ...prev,
            inputLines: lines,
            cursorRow: lines.length - 1,
            cursorCol: lines.at(-1)?.length || 0,
            historyIndex: null,
          }));
          setNotice({ message: 'Loaded from editor', level: 'success' });
        }
      });
      return;
    }

    // ==================== Console Toggle: Ctrl+` ====================
    if (key.ctrl && input === '`') {
      setConsolePanel(prev => toggleConsole(prev));
      return;
    }

    // ==================== Console keyboard ====================
    if (consolePanel.isOpen) {
      if (key.escape) {
        setConsolePanel(prev => toggleConsole(prev));
        return;
      }
      return;
    }

    // ==================== Which-Key enhanced keyboard ====================
    if (whichKey.isOpen) {
      const categories = [...new Set(DEFAULT_KEYBINDINGS.map(b => b.category))];
      if (key.leftArrow || input.toLowerCase() === 'h') {
        setWhichKey(prev => whichKeyPrevCategory(prev, categories.length));
        return;
      }
      if (key.rightArrow || input.toLowerCase() === 'l') {
        setWhichKey(prev => whichKeyNextCategory(prev, categories.length));
        return;
      }
      if (input === 'd') {
        setWhichKey(prev => whichKeyToggleLayout(prev));
        return;
      }
      // ctrl+alt+arrows for scroll (check via escape sequence)
      if (key.ctrl && key.upArrow) {
        setWhichKey(prev => ({ ...prev, scrollOffset: Math.max(0, prev.scrollOffset - 1) }));
        return;
      }
      if (key.ctrl && key.downArrow) {
        setWhichKey(prev => ({ ...prev, scrollOffset: prev.scrollOffset + 1 }));
        return;
      }
      if (key.pageUp) {
        setWhichKey(prev => ({ ...prev, scrollOffset: Math.max(0, prev.scrollOffset - 10) }));
        return;
      }
      if (key.pageDown) {
        setWhichKey(prev => ({ ...prev, scrollOffset: prev.scrollOffset + 10 }));
        return;
      }
      if (key.escape || (key.ctrl && input === 'p')) {
        setWhichKey(prev => closeWhichKey(prev));
        return;
      }
      return;
    }

    // ==================== Retry Action keyboard ====================
    if (retryAction.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setRetryAction(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setRetryAction(prev => ({ ...prev, selectedIndex: Math.min(1, prev.selectedIndex + 1) }));
        return;
      }
      if (isEnterKey) {
        if (retryAction.selectedIndex === 0) {
          setNotice({ message: 'Retrying...', level: 'info' });
        } else {
          setNotice({ message: 'Update suppressed', level: 'warning' });
        }
        setRetryAction(prev => closeRetryAction(prev));
        return;
      }
      if (key.escape) {
        setRetryAction(prev => closeRetryAction(prev));
        return;
      }
      return;
    }

    // ==================== Session Destination keyboard ====================
    if (sessionDestination.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setSessionDestination(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setSessionDestination(prev => ({ ...prev, selectedIndex: Math.min(prev.destinations.length - 1, prev.selectedIndex + 1) }));
        return;
      }
      if (isEnterKey) {
        const dest = sessionDestination.destinations[sessionDestination.selectedIndex];
        if (dest) {
          setNotice({ message: `Destination: ${dest.name}`, level: 'success' });
        }
        setSessionDestination(prev => closeSessionDestination(prev));
        return;
      }
      if (key.escape) {
        setSessionDestination(prev => closeSessionDestination(prev));
        return;
      }
      return;
    }

    // ==================== Update Notification keyboard ====================
    if (updateNotif.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setUpdateNotif(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setUpdateNotif(prev => ({ ...prev, selectedIndex: Math.min(2, prev.selectedIndex + 1) }));
        return;
      }
      if (isEnterKey) {
        if (updateNotif.selectedIndex === 0) {
          setNotice({ message: 'Updating...', level: 'info' });
        } else if (updateNotif.selectedIndex === 1) {
          setNotice({ message: 'Version skipped', level: 'warning' });
        }
        setUpdateNotif(prev => closeUpdate(prev));
        return;
      }
      if (key.escape) {
        setUpdateNotif(prev => closeUpdate(prev));
        return;
      }
      return;
    }

    // ==================== Variant Dialog keyboard ====================
    if (variantState.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setVariantState(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setVariantState(prev => ({ ...prev, selectedIndex: Math.min(prev.variants.length - 1, prev.selectedIndex + 1) }));
        return;
      }
      if (isEnterKey) {
        const selected = variantState.variants[variantState.selectedIndex];
        if (selected) {
          setNotice({ message: `Variant: ${selected.name}`, level: 'success' });
        }
        setVariantState(prev => closeVariant(prev));
        return;
      }
      if (key.escape) {
        setVariantState(prev => closeVariant(prev));
        return;
      }
      return;
    }

    // ==================== MCP Dialog keyboard ====================
    if (mcpState.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setMcpState(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setMcpState(prev => ({ ...prev, selectedIndex: Math.min(prev.servers.length - 1, prev.selectedIndex + 1) }));
        return;
      }
      if (input === ' ') {
        const server = mcpState.servers[mcpState.selectedIndex];
        if (server) {
          setNotice({ message: `${server.status === 'connected' ? 'Disconnected' : 'Connected'}: ${server.name}`, level: 'info' });
        }
        return;
      }
      if (key.escape) {
        setMcpState(prev => closeMcp(prev));
        return;
      }
      return;
    }

    // ==================== Status Dialog keyboard ====================
    if (statusState.isOpen) {
      if (key.escape) {
        setStatusState(prev => closeStatus(prev));
        return;
      }
      return;
    }

    // ==================== Help Dialog keyboard ====================
    if (helpState.isOpen) {
      if (key.escape || (key.ctrl && input === 'p')) {
        setHelpState(prev => closeHelp(prev));
        return;
      }
      return;
    }

    // ==================== Skill Dialog keyboard ====================
    if (skillState.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setSkillState(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setSkillState(prev => ({ ...prev, selectedIndex: Math.min(prev.skills.length - 1, prev.selectedIndex + 1) }));
        return;
      }
      if (input === ' ') {
        setSkillState(prev => {
          const skills = [...prev.skills];
          const idx = prev.selectedIndex;
          if (skills[idx]) {
            skills[idx] = { ...skills[idx], enabled: !skills[idx].enabled };
          }
          return { ...prev, skills };
        });
        return;
      }
      if (key.escape) {
        setSkillState(prev => closeSkill(prev));
        return;
      }
      return;
    }

    // ==================== Message Dialog keyboard ====================
    if (messageDialog.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setMessageDialog(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setMessageDialog(prev => ({ ...prev, selectedIndex: Math.min(2, prev.selectedIndex + 1) }));
        return;
      }
      if (isEnterKey) {
        const actions = ['copy', 'revert', 'fork'];
        const action = actions[messageDialog.selectedIndex];
        if (action === 'copy') {
          setNotice({ message: 'Message copied', level: 'success' });
        } else if (action === 'revert') {
          setNotice({ message: 'Revert to message', level: 'info' });
        } else if (action === 'fork') {
          setNotice({ message: 'Fork session', level: 'info' });
        }
        setMessageDialog(prev => closeMessageDialog(prev));
        return;
      }
      if (key.escape) {
        setMessageDialog(prev => closeMessageDialog(prev));
        return;
      }
      return;
    }

    // ==================== Tag Dialog keyboard ====================
    if (tagState.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setTagState(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setTagState(prev => ({ ...prev, selectedIndex: Math.min(prev.tags.length - 1, prev.selectedIndex + 1) }));
        return;
      }
      if (isEnterKey) {
        const tag = tagState.tags[tagState.selectedIndex];
        if (tag) {
          setNotice({ message: `Selected: ${tag.name}`, level: 'success' });
        }
        setTagState(prev => closeTag(prev));
        return;
      }
      if (key.escape) {
        setTagState(prev => closeTag(prev));
        return;
      }
      return;
    }

    // ==================== Fork Dialog keyboard ====================
    if (forkState.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setForkState(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setForkState(prev => ({ ...prev, selectedIndex: Math.min(messages.filter(m => m.role === 'user').length - 1, prev.selectedIndex + 1) }));
        return;
      }
      if (isEnterKey) {
        setNotice({ message: 'Session forked', level: 'success' });
        setForkState(prev => closeFork(prev));
        return;
      }
      if (key.escape) {
        setForkState(prev => closeFork(prev));
        return;
      }
      return;
    }

    // ==================== Subagent Dialog keyboard ====================
    if (subagentDialog.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setSubagentDialog(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setSubagentDialog(prev => ({ ...prev, selectedIndex: Math.min(prev.subagents.length - 1, prev.selectedIndex + 1) }));
        return;
      }
      if (isEnterKey) {
        const sa = subagentDialog.subagents[subagentDialog.selectedIndex];
        if (sa) {
          setNotice({ message: `Opening: ${sa.label}`, level: 'info' });
        }
        setSubagentDialog(prev => closeSubagentDialog(prev));
        return;
      }
      if (key.escape) {
        setSubagentDialog(prev => closeSubagentDialog(prev));
        return;
      }
      return;
    }

    // ==================== Theme List Dialog keyboard ====================
    if (themeList.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setThemeList(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setThemeList(prev => ({ ...prev, selectedIndex: Math.min(prev.themes.length - 1, prev.selectedIndex + 1) }));
        return;
      }
      if (isEnterKey) {
        const theme = themeList.themes[themeList.selectedIndex];
        if (theme) {
          setNotice({ message: `Theme: ${theme.name}`, level: 'success' });
        }
        setThemeList(prev => closeThemeList(prev));
        return;
      }
      if (key.escape) {
        setThemeList(prev => closeThemeList(prev));
        return;
      }
      return;
    }

    // ==================== Queued Prompts Dialog keyboard ====================
    if (queuedPrompts.isOpen) {
      if (key.upArrow || input.toLowerCase() === 'k') {
        setQueuedPrompts(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        return;
      }
      if (key.downArrow || input.toLowerCase() === 'j') {
        setQueuedPrompts(prev => ({ ...prev, selectedIndex: Math.min(10, prev.selectedIndex + 1) }));
        return;
      }
      if (isEnterKey) {
        setNotice({ message: 'Prompt sent', level: 'success' });
        setQueuedPrompts(prev => closeQueuedPrompts(prev));
        return;
      }
      if (key.escape) {
        setQueuedPrompts(prev => closeQueuedPrompts(prev));
        return;
      }
      return;
    }

    // ==================== Leader Key System ====================
    if (leaderActive) {
      setLeaderActive(false);
      if (leaderTimeout) clearTimeout(leaderTimeout);
      // Handle leader key combinations
      if (input === 'n') { updateState(prev => ({ ...prev, showExitConfirm: false })); return; }
      if (input === 'l') { setSessionList(prev => ({ ...prev, isOpen: true, filter: '', selectedIndex: 0 })); return; }
      if (input === 'g') { updateState(prev => ({ ...prev, showTimeline: true })); return; }
      if (input === 'c') { setNotice({ message: 'Session compacted', level: 'success' }); return; }
      if (input === 'x') { updateState(prev => ({ ...prev, showExitConfirm: true })); return; }
      if (input === 'm') { setModelSelector(prev => openModelSelector(prev, [])); return; }
      if (input === 'a') { setAgentSelector(prev => openAgentSelector(prev, [])); return; }
      if (input === 't') { setThemeList(prev => openThemeList(prev, [])); return; }
      if (input === 'b') { setSessionList(prev => ({ ...prev, isOpen: true })); return; }
      if (input === 's') { setStatusState(prev => openStatus(prev, [])); return; }
      if (input === 'e') { /* export session */ return; }
      if (input === 'y') { setNotice({ message: 'Message copied', level: 'success' }); return; }
      if (input === 'h') { setNotice({ message: 'Tips toggled', level: 'info' }); return; }
      if (input === 'u') { setNotice({ message: 'Undo', level: 'info' }); return; }
      if (input === 'r') { setNotice({ message: 'Redo', level: 'info' }); return; }
      if (input === 'q') { updateState(prev => ({ ...prev, showExitConfirm: true })); return; }
      if (input >= '1' && input <= '9') {
        const slot = parseInt(input) - 1;
        const sessionId = getSlotSessionId(quickSwitch, slot);
        if (sessionId) {
          const session = sessionManager.sessions.find(s => s.id === sessionId);
          if (session) {
            setSessionManager(prev => ({ ...prev, currentSessionId: session.id }));
            setMessages(session.messages);
            setNotice({ message: `Switched to: ${session.title}`, level: 'success' });
          }
        } else {
          setNotice({ message: `Slot ${slot + 1} is empty`, level: 'warning' });
        }
        return;
      }
      return;
    }

    // ==================== Ctrl+X Leader Key ====================
    if (key.ctrl && input.toLowerCase() === 'x') {
      setLeaderActive(true);
      const timeout = setTimeout(() => setLeaderActive(false), 2000);
      setLeaderTimeout(timeout);
      setNotice({ message: 'Leader key active...', level: 'info' });
      return;
    }

    // ==================== F2 Model cycling ====================
    if (input === '\u001b[15~') { // F2
      setNotice({ message: 'Next recent model', level: 'info' });
      return;
    }
    if (input === '\u001b[15;2~') { // Shift+F2
      setNotice({ message: 'Previous recent model', level: 'info' });
      return;
    }

    // ==================== Ctrl+T Variant cycling ====================
    if (key.ctrl && input.toLowerCase() === 't') {
      setNotice({ message: 'Cycle model variants', level: 'info' });
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

    // Enter 键：提交输入
    if (isEnterKey) {
      const fullText = state.inputLines.join('\n').trim();
      if (fullText) {
        handleProcessInput(fullText);
      }
      return;
    }

    // Ctrl+Enter：换行（插入新行）
    if (key.ctrl && key.return) {
      updateState(prev => {
        const newLines = [...prev.inputLines];
        const currentLine = newLines[prev.cursorRow];
        newLines[prev.cursorRow] = currentLine.slice(0, prev.cursorCol);
        newLines.splice(prev.cursorRow + 1, 0, currentLine.slice(prev.cursorCol));
        return {
          ...prev,
          inputLines: newLines,
          cursorRow: prev.cursorRow + 1,
          cursorCol: 0,
          historyIndex: null,
        };
      });
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

        // Check for @ trigger (file autocomplete)
        const newCursorCol = prev.cursorCol + input.length;
        const trigger = findAtTrigger(newText, newCursorCol);
        if (trigger) {
          listFiles(cwd, cwd).then(files => {
            const filtered = filterFiles(files, trigger.query);
            setAutocompleteFiles(filtered);
            setAutocompleteIndex(0);
            setAutocompleteQuery(trigger.query);
            setShowAutocomplete(true);
          }).catch(() => {});
        } else if (showAutocomplete) {
          setShowAutocomplete(false);
        }
        
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
  const isWideMode = termWidth >= 120;
  const sidebarWidth = isWideMode ? 42 : 32;
  const sidebarPaddingX = 2;
  const sidebarInnerWidth = Math.max(12, sidebarWidth - sidebarPaddingX * 2 - 1);
  const chatAreaWidth = isWideMode ? Math.max(termWidth - sidebarWidth, 40) : termWidth;
  const chatComposerMarginX = 2;
  const chatInputBoxWidth = Math.max(24, chatAreaWidth - chatComposerMarginX * 2);
  const chatTextWidth = Math.max(chatInputBoxWidth - 3, 20);
  const composerContentWidth = chatInputBoxWidth - 1;
  const textWidth = Math.max(Math.floor(termWidth * 0.35) - 4, 20);

  // Report exclusion zones for skin background
  useEffect(() => {
    if (!onExclusionZonesChange) return;
    const zones: { x: number; y: number; width: number; height: number }[] = [];
    const inputBoxWidth = textWidth + 2;
    const inputBoxX = Math.max(0, Math.floor((termWidth - inputBoxWidth) / 2));
    const logoH = getLogoHeight(logoVariant);
    const inputBoxY = Math.floor((termHeight - 1 - logoH - 3 - 10) / 2) + logoH + 3;
    const inputBoxHeight = 1 + Math.max(1, Math.min(state.inputLines.length, 5)) + 1 + 1 + 1 + 1;
    zones.push({ x: inputBoxX, y: inputBoxY, width: inputBoxWidth, height: inputBoxHeight });
    onExclusionZonesChange(zones);
  }, [textWidth, termWidth, termHeight, logoVariant, state.inputLines.length, onExclusionZonesChange]);

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
    sessionTitle: getCurrentSession(sessionManager)?.title || 'MiniAgent Chat',
    timestamps: sessionToggles.timestamps,
    showThinking: sessionToggles.showThinking,
    showToolDetails: sessionToggles.showToolDetails,
  });
  const sidebarFooterRows = buildSidebarFooterRows({ version, sidebarInnerWidth, cwd });
  const sidebarFillRows = Math.max(0, termHeight - 2 - sidebarRows.length - sidebarFooterRows.length);

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
  const consolePanelHeight = consolePanel.isOpen ? Math.min(8, termHeight - 2) : 0;
  const messagePaneHeight = Math.max(3, termHeight - composerRows - 2 - consolePanelHeight);
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

  // Scroll offset: 0 = auto-bottom, >0 = scrolled up by N messages
  const maxScrollOffset = Math.max(0, messages.length - messagePaneHeight);
  const effectiveScrollOffset = Math.min(scrollOffset, maxScrollOffset);
  // When scroll offset is 0, use auto-bottom (existing behavior). When >0, offset from bottom.
  const scrollAdjustedStart = effectiveScrollOffset > 0
    ? Math.max(0, messages.length - messagePaneHeight - effectiveScrollOffset)
    : visibleMessageStart;
  const scrollAdjustedVisible = messages.slice(scrollAdjustedStart);
  const scrollAdjustedHidden = scrollAdjustedStart;

  return (
    <ErrorBoundary onError={(err) => {
      setNotice({ message: `Error: ${err.message}`, level: 'error' });
    }}>
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      {termHeight < 10 || termWidth < 40 ? (
        <Box justifyContent="center" alignItems="center" width={termWidth} height={termHeight}>
          <Text color={TUI_THEME.warning}>Terminal too small ({termWidth}x{termHeight}). Minimum: 40x10</Text>
        </Box>
      ) : (<>
      {permState.pending.length > 0 ? (
        <PermissionPrompt
          request={permState.pending[0]}
          onDecide={(action) => {
            setPermState(prev => resolvePermission(prev, permState.pending[0].id, action));
          }}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : questionState.pending.length > 0 ? (
        <QuestionPrompt
          request={questionState.pending[0]}
          onAnswer={(answer) => {
            setQuestionState(prev => resolveQuestion(prev, questionState.pending[0].id));
            setNotice({ message: `Answered: ${answer}`, level: 'success' });
          }}
          onReject={() => {
            setQuestionState(prev => resolveQuestion(prev, questionState.pending[0].id));
            setNotice({ message: 'Question dismissed', level: 'warning' });
          }}
          termWidth={termWidth}
        />
      ) : modelSelector.isOpen ? (
        <ModelSelector
          models={modelSelector.models}
          selectedIndex={modelSelector.selectedIndex}
          filter={modelSelector.filter}
          termWidth={termWidth}
          termHeight={termHeight}
          onSelect={(model) => {
            setNotice({ message: `Selected model: ${model.name}`, level: 'success' });
            setModelSelector(prev => closeModelSelector(prev));
          }}
          onClose={() => setModelSelector(prev => closeModelSelector(prev))}
        />
      ) : agentSelector.isOpen ? (
        <AgentSelector
          agents={agentSelector.agents}
          selectedIndex={agentSelector.selectedIndex}
          currentAgent={state.agentName}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : whichKey.isOpen ? (
        <WhichKey
          bindings={DEFAULT_KEYBINDINGS}
          termWidth={termWidth}
          termHeight={termHeight}
          activeCategory={whichKey.activeCategory}
          layoutMode={whichKey.layoutMode}
        />
      ) : sessionList.isOpen ? (
        <SessionListDialog
          sessions={sessionManager.sessions}
          currentSessionId={sessionManager.currentSessionId}
          selectedIndex={sessionList.selectedIndex}
          filter={sessionList.filter}
          termWidth={termWidth}
          termHeight={termHeight}
          showPreview={termWidth >= 100}
        />
      ) : sessionRename.isOpen ? (
        <SessionRenameDialog
          currentTitle={sessionRename.value}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : stashList.isOpen ? (
        <StashListDialog
          entries={promptStash ? [{ id: 'stash-0', text: promptStash, timestamp: Date.now(), lineCount: promptStash.split('\n').length }] : []}
          selectedIndex={stashList.selectedIndex}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : exportOptions.isOpen ? (
        <ExportOptionsDialog
          options={exportOptions.options}
          selectedIndex={exportOptions.selectedIndex}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : retryAction.isOpen ? (
        <RetryAction
          title={retryAction.title}
          message={retryAction.message}
          actionLabel={retryAction.actionLabel}
          showDontShowAgain={retryAction.showDontShowAgain}
          termWidth={termWidth}
        />
      ) : sessionDestination.isOpen ? (
        <SessionDestinationPicker
          destinations={sessionDestination.destinations}
          selectedIndex={sessionDestination.selectedIndex}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : updateNotif.isOpen && updateNotif.info ? (
        <UpdateNotification
          info={updateNotif.info}
          termWidth={termWidth}
        />
      ) : variantState.isOpen ? (
        <VariantDialog
          variants={variantState.variants}
          selectedIndex={variantState.selectedIndex}
          filter={variantState.filter}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : mcpState.isOpen ? (
        <McpDialog
          servers={mcpState.servers}
          selectedIndex={mcpState.selectedIndex}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : statusState.isOpen ? (
        <StatusDialog
          items={statusState.items}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : helpState.isOpen ? (
        <HelpDialog
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : skillState.isOpen ? (
        <SkillDialog
          skills={skillState.skills}
          selectedIndex={skillState.selectedIndex}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : messageDialog.isOpen ? (
        <MessageDialog
          messageIndex={messageDialog.messageIndex}
          messagePreview={messageDialog.messagePreview}
          selectedIndex={messageDialog.selectedIndex}
          termWidth={termWidth}
        />
      ) : tagState.isOpen ? (
        <TagDialog
          tags={tagState.tags}
          selectedIndex={tagState.selectedIndex}
          filter={tagState.filter}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : forkState.isOpen ? (
        <ForkDialog
          messages={messages}
          selectedIndex={forkState.selectedIndex}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : subagentDialog.isOpen ? (
        <SubagentDialog
          subagents={subagentDialog.subagents}
          selectedIndex={subagentDialog.selectedIndex}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : themeList.isOpen ? (
        <ThemeListDialog
          themes={themeList.themes}
          selectedIndex={themeList.selectedIndex}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : queuedPrompts.isOpen ? (
        <QueuedPromptsDialog
          prompts={[]}
          selectedIndex={queuedPrompts.selectedIndex}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      ) : state.showExitConfirm ? (
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
        // 起始页面：Logo 固定位置 + 输入框在下方
        (() => {
          const logoH = getLogoHeight(logoVariant);
          const fixedTopOffset = Math.max(0, Math.floor((termHeight - 1 - logoH - 3 - 10) / 2));
          return (
            <Box
              flexDirection="column"
              alignItems="center"
              height={termHeight - 1}
            >
              <Box height={fixedTopOffset} />
              <Logo variant={logoVariant} subtitle="by Zevan" />
              <Box height={3} />
              {showAutocomplete && autocompleteFiles.length > 0 && (
                <Box marginBottom={1}>
                  <AutocompletePopup
                    files={autocompleteFiles}
                    selectedIndex={autocompleteIndex}
                    width={textWidth + 2}
                    query={autocompleteQuery}
                  />
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
          );
        })()
      ) : (
        // 对话页面：左侧消息/输入框 + 右侧上下贯穿 sidebar
        <Box flexDirection="row" height={termHeight}>
          <Box flexDirection="column" width={chatAreaWidth}>
            <MessageList
              messages={effectiveScrollOffset > 0 ? scrollAdjustedVisible : visibleMessages}
              hiddenMessageCount={effectiveScrollOffset > 0 ? scrollAdjustedHidden : hiddenMessageCount}
              chatTextWidth={chatTextWidth}
              chatAreaWidth={chatAreaWidth}
              height={messagePaneHeight}
              isProcessing={state.isProcessing}
              currentResponse={state.currentResponse}
              sessionToggles={sessionToggles}
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
            {consolePanel.isOpen && (
              <ConsolePanel
                entries={consolePanel.entries}
                termWidth={termWidth}
                termHeight={consolePanelHeight}
              />
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
              isProcessing={state.isProcessing}
            />
          </Box>
          {/* 右侧：侧边栏 */}
          {(isWideMode || sessionToggles.sidebarVisible) && (
            <Sidebar
              rows={sidebarRows}
              footerRows={sidebarFooterRows}
              width={sidebarWidth}
              paddingX={sidebarPaddingX}
              fillHeight={sidebarFillRows}
            />
          )}
        </Box>
      )}

      {!hasConversation && (
      <Footer
        cwd={cwd}
        version={version}
        termWidth={termWidth}
        notice={notice}
        isPaletteOpen={state.showSlashMenu && state.slashMenuMode === 'modal'}
        hasConversation={hasConversation}
      />
      )}
      </>)}
    </Box>
    </ErrorBoundary>
  );
}
