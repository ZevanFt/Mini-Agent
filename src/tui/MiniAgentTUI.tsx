// React 基础 hooks
import React, { useState, useEffect, useCallback } from 'react';
// Ink TUI 框架的组件和 hooks
import { Box, Text, useInput, useApp, useStdout } from 'ink';
// Agent 类型定义
import type { Agent } from '../core/agent.js';
// 斜杠命令工厂函数
import { createSlashCommands } from '../core/commands.js';

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
  slashFilter: string;       // 斜杠命令过滤关键词
  isProcessing: boolean;     // 是否正在处理请求
  currentResponse: string;   // 当前正在流式输出的响应文本
}

// 对话消息类型定义
interface Message {
  role: 'user' | 'assistant';                    // 消息角色：用户或助手
  content: string;                               // 消息内容
  type?: 'thought' | 'tool' | 'code' | 'text';  // 消息类型：思考/工具/代码/文本
  toolName?: string;                             // 工具名称（仅 tool 类型使用）
  duration?: string;                             // 耗时（仅 thought/tool 类型使用）
}

// 固定 Logo（ASCII 艺术字），使用 #0078d7 蓝色
const LOGO_LINES: string[] = [
  '███    ███  ██  ███    ██  ██          █████    ██████   ███████  ███    ██  ████████ ',
  '████  ████  ██  ████   ██  ██         ██   ██  ██        ██       ████   ██     ██    ',
  '██ ████ ██  ██  ██ ██  ██  ██  █████  ███████  ██   ███  █████    ██ ██  ██     ██    ',
  '██  ██  ██  ██  ██  ██ ██  ██         ██   ██  ██    ██  ██       ██  ██ ██     ██    ',
  '██      ██  ██  ██   ████  ██         ██   ██   ██████   ███████  ██   ████     ██    ',
];

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
    slashFilter: '',        // 默认无过滤关键词
    isProcessing: false,    // 默认未在处理
    currentResponse: '',    // 默认无响应文本
  });
  // 已使用的 token 数量（初始值 55373）
  const [tokensUsed, setTokensUsed] = useState(55373);
  // token 使用百分比
  const [tokenPercent] = useState(6);
  // 总花费金额
  const [totalCost] = useState('$0.02');
  // 终端宽度（字符数），默认 120
  const [termWidth, setTermWidth] = useState(120);
  // 终端高度（行数），默认 30
  const [termHeight, setTermHeight] = useState(30);
  // 光标闪烁状态：true=显示，false=隐藏
  const [cursorVisible, setCursorVisible] = useState(true);

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

  // 光标闪烁定时器：每 530ms 切换一次显示/隐藏
  useEffect(() => {
    const timer = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 530);
    return () => clearInterval(timer); // 组件卸载时清除
  }, []); // 空依赖数组

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

    // 更新状态：标记为处理中、清空响应文本、重置输入框和光标
    updateState(prev => ({
      ...prev,
      isProcessing: true,
      currentResponse: '',
      inputLines: [''],
      cursorRow: 0,
      cursorCol: 0,
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
          type: 'text',
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
  }, [agent, messages, slashCommands, updateState]); // 依赖：agent 实例、命令列表、状态更新函数

  // 注册键盘输入处理
  useInput((input, key) => {
    const navigationKey = key as typeof key & { home?: boolean; end?: boolean };
    const isEnterKey = key.return || input === '\r' || input === '\n';
    const isForwardDeleteKey = input === '\u001b[3~';
    const isBackspaceKey = key.backspace || input === '\u007f' || input === '\b' || input === '\x08' || (key.delete && !isForwardDeleteKey);
    const isHomeKey = navigationKey.home || input === '\u001b[H' || input === '\u001bOH' || input === '\u001b[1~';
    const isEndKey = navigationKey.end || input === '\u001b[F' || input === '\u001bOF' || input === '\u001b[4~';

    // Ctrl+C 或 Ctrl+D：退出应用
    if (key.ctrl && (input === 'c' || input === 'd')) {
      exit();
      onExit();
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
        slashFilter: '', // 重置过滤关键词
      }));
      return;
    }

    // 斜杠菜单打开时的输入处理
    if (state.showSlashMenu) {
      if (isEnterKey) {
        // Enter 键：选中过滤后的第一个命令
        const cmds = slashCommands.filter(cmd =>
          cmd.name.includes(state.slashFilter) || cmd.description?.includes(state.slashFilter)
        );
        if (cmds.length === 1) {
          updateState(prev => ({
            ...prev,
            inputLines: ['/' + cmds[0].name], // 填充命令到输入框
            cursorRow: 0,
            cursorCol: cmds[0].name.length + 1, // 光标移到命令后面
            showSlashMenu: false,
          }));
        }
        return;
      }
      if (isBackspaceKey) {
        // 退格键：删除过滤关键词最后一个字符
        updateState(prev => ({ ...prev, slashFilter: prev.slashFilter.slice(0, -1) }));
        return;
      }
      if (input.length === 1 && input >= ' ' && input !== '\u007f') {
        // 可打印字符：追加到过滤关键词
        updateState(prev => ({ ...prev, slashFilter: prev.slashFilter + input }));
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
          return { ...prev, inputLines: newLines, cursorCol: prev.cursorCol - 1 };
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
          return { ...prev, inputLines: newLines };
        });
      } else if (state.cursorRow < state.inputLines.length - 1) {
        updateState(prev => {
          const newLines = [...prev.inputLines];
          newLines[prev.cursorRow] += newLines[prev.cursorRow + 1];
          newLines.splice(prev.cursorRow + 1, 1);
          return { ...prev, inputLines: newLines };
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
          };
        } else {
          // 正常插入
          newLines[prev.cursorRow] = newText;
          return {
            ...prev,
            inputLines: newLines,
            cursorCol: prev.cursorCol + input.length, // 光标右移
          };
        }
      });
    }
  });

  // ==================== 输入框宽度计算 ====================
  // inputBoxWidth: 输入框整体宽度，占终端宽度的 35%（可调整此比例改变输入框大小）
  const inputBoxWidth = Math.floor(termWidth * 0.35);
  const sidebarWidth = 30;
  const chatAreaWidth = Math.max(termWidth - sidebarWidth - 4, 40);
  const chatInputBoxWidth = Math.floor(chatAreaWidth * 0.95);
  // textWidth: 输入框内部可用文本宽度
  // 计算方式：inputBoxWidth - 4，因为：
  //   - Ink 的 borderStyle="single" 会在容器两侧各占 1 字符（│），共 2 字符
  //   - 文本行左右各留 1 个空格作为内边距（padding），共 2 字符
  //   - 合计减去 4 字符
  // Math.max(xxx, 20) 确保最小宽度为 20，防止终端过窄时崩溃
  const textWidth = Math.max(inputBoxWidth - 4, 20);
  const chatTextWidth = Math.max(chatInputBoxWidth - 4, 20);
  // dashWidth: 虚线分隔符的宽度，与起始页面子元素宽度一致
  const dashWidth = Math.max(inputBoxWidth - 4, 20) + 2;
  // dashLine: 生成虚线字符串，使用全角横线 '─'（U+2500）
  const dashLine = '─'.repeat(dashWidth);
  // 计算字符串的显示宽度（英文 1 字符，中文/emoji 2 字符）
  const getStringWidth = (str: string): number => {
    let width = 0;
    for (const char of str) {
      // 非 ASCII 字符（中文、emoji 等）占 2 格，ASCII 字符占 1 格
      width += char.charCodeAt(0) > 127 ? 2 : 1;
    }
    return width;
  };
  // 文本截断辅助函数：按显示宽度截断，返回 { text, charCount }
  // 注意：charCount 是字符数（用于 slice），width 是显示宽度（用于计算）
  const truncateByWidth = (text: string, maxWidth: number): { text: string; charCount: number } => {
    let currentWidth = 0;
    let result = '';
    for (const char of text) {
      const charWidth = char.charCodeAt(0) > 127 ? 2 : 1;
      if (currentWidth + charWidth > maxWidth) break;
      result += char;
      currentWidth += charWidth;
    }
    return { text: result, charCount: result.length };
  };
  const fillByWidth = (text: string, width: number): string => {
    const clipped = truncateByWidth(text, width).text;
    return clipped + ' '.repeat(Math.max(0, width - getStringWidth(clipped)));
  };
  const sidebarLine = (text = '') => fillByWidth(text, sidebarWidth - 4);
  const modalWidth = Math.min(termWidth - 8, 76);
  const modalRows = 13;
  const modalTopPad = Math.max(0, Math.floor((termHeight - modalRows - 1) / 2));
  const modalBottomPad = Math.max(0, termHeight - modalTopPad - modalRows - 1);
  const maskLine = '░'.repeat(termWidth);
  const modalSideMaskWidth = Math.max(0, Math.floor((termWidth - modalWidth) / 2));
  const modalSideMask = '░'.repeat(modalSideMaskWidth);

  return (
    // 最外层容器：纵向布局、宽度 100%、高度使用终端实际行数（明确数值）
    // Ink 不支持 height="100%"，需要用明确的数值
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      {/* 主内容区域：命令面板打开时切换为不透明的模态屏幕，避免底层文字干扰 */}
      {state.showSlashMenu ? (
        <Box flexDirection="column" width={termWidth} flexGrow={1}>
          {Array.from({ length: modalTopPad }).map((_, i) => (
            <Text key={`modal-mask-top-${i}`} color="gray" dimColor>{maskLine}</Text>
          ))}
          <Box width={termWidth} justifyContent="center">
            {modalSideMaskWidth > 0 && <Text color="gray" dimColor>{modalSideMask}</Text>}
            <Box
              flexDirection="column"
              width={modalWidth}
              borderStyle="round"
              borderColor="cyan"
              paddingX={2}
              paddingY={1}
            >
              <Box justifyContent="space-between">
                <Text color="cyan" bold>Command Palette</Text>
                <Text dimColor>Esc close</Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>Search </Text>
                <Text>{state.slashFilter || 'type command name...'}</Text>
              </Box>
              <Box marginTop={1} flexDirection="column">
                {slashCommands
                  .filter(cmd => cmd.name.includes(state.slashFilter) || cmd.description?.includes(state.slashFilter))
                  .slice(0, 8)
                  .map((cmd, i) => (
                    <Box key={i} justifyContent="space-between">
                      <Text color={i === 0 ? 'green' : 'cyan'}>{i === 0 ? '› ' : '  '}/{cmd.name}</Text>
                      <Text dimColor>{truncateByWidth(cmd.description || '', Math.max(20, termWidth - 38)).text}</Text>
                    </Box>
                  ))}
              </Box>
            </Box>
            {modalSideMaskWidth > 0 && <Text color="gray" dimColor>{modalSideMask}</Text>}
          </Box>
          {Array.from({ length: modalBottomPad }).map((_, i) => (
            <Text key={`modal-mask-bottom-${i}`} color="gray" dimColor>{maskLine}</Text>
          ))}
        </Box>
      ) : !hasConversation ? (
        // 起始页面：Logo + 输入框，垂直居中显示
        // flexGrow={1}：占满除状态栏外的所有剩余空间
        // justifyContent="center"：内部子元素垂直居中
        // alignItems="center"：内部子元素水平居中
        <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
          {/* Logo 区域：显示 ASCII 艺术字，使用 #0078d7 蓝色 */}
          <Box flexDirection="column" alignItems="center" marginBottom={1}>
            {/* 遍历 Logo 每一行，使用固定颜色 #0078d7 */}
            {LOGO_LINES.map((line, i) => (
              <Text key={i} color="#0078d7">{line}</Text>
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
          <Box width={textWidth + 2} flexDirection="column" borderStyle="single" borderColor="gray">
            <Box width={textWidth + 2}>
              <Text>{' '}</Text>
            </Box>
            {state.inputLines.flatMap((line, row) => [
              <Box key={`line-${row}`} width={textWidth + 2}>
                <Text>{truncateByWidth(
                  row === state.cursorRow
                    ? line.slice(0, state.cursorCol) + (cursorVisible ? '█' : ' ') + line.slice(state.cursorCol)
                    : line,
                  textWidth
                ).text}</Text>
                {row === 0 && row === state.cursorRow && state.cursorCol === 0 && line === '' && (
                  <Text dimColor>Ask anything...</Text>
                )}
              </Box>,
              <Box key={`gap-${row}`} width={textWidth + 2}>
                <Text>{' '}</Text>
              </Box>
            ])}
            <Box width={textWidth + 2}>
              <Text>{' '}</Text>
            </Box>
            <Box width={textWidth + 2}>
              <Text color="blue"> {currentMode} </Text>
              <Text dimColor>· {truncateByWidth(`${modelName} ${state.agentName}`, textWidth - currentMode.length - 2).text}</Text>
            </Box>
            <Box width={textWidth + 2}>
              <Text dimColor>{dashLine}</Text>
            </Box>
            <Box width={textWidth + 2} justifyContent="flex-end">
              <Text dimColor>tab agents  ctrl+p</Text>
            </Box>
          </Box>
        </Box>
      ) : (
        // 对话页面：左侧消息/输入框 + 右侧上下贯穿 sidebar
        <Box flexDirection="row" flexGrow={1}>
          <Box flexDirection="column" flexGrow={1}>
            {/* 左侧：对话消息列表，左右 padding 2 字符 */}
            <Box flexDirection="column" flexGrow={1} paddingX={2}>
              {/* 遍历消息列表 */}
              {messages.map((msg, i) => (
                // 每条消息容器：纵向排列、底部间距 1 行
                <Box key={i} flexDirection="column" marginBottom={1}>
                  {/* 用户消息：单线边框、蓝色、左右 padding 1 字符、白色文本 */}
                  {msg.role === 'user' && (
                    <Box paddingX={1}>
                      <Text color="white" backgroundColor="#141414"> {msg.content} </Text>
                    </Box>
                  )}
                  {/* 助手思考消息：黄色文本、显示耗时 */}
                  {msg.role === 'assistant' && msg.type === 'thought' && (
                    <Box><Text color="yellow">+ Thought: {msg.duration}</Text></Box>
                  )}
                  {/* 助手工具调用消息：绿色文本、显示工具名和内容 */}
                  {msg.role === 'assistant' && msg.type === 'tool' && (
                    <Box><Text color="green">→ {msg.toolName}: {msg.content}</Text></Box>
                  )}
                  {/* 助手普通文本消息：直接显示内容 */}
                  {msg.role === 'assistant' && msg.type === 'text' && (
                    <Box><Text>{msg.content}</Text></Box>
                  )}
                </Box>
              ))}
              {/* 流式响应中：显示正在输出的文本 */}
              {state.isProcessing && state.currentResponse && (
                <Box><Text>{state.currentResponse}</Text></Box>
              )}
              {state.isProcessing && !state.currentResponse && (
                <Box><Text color="cyan">MiniAgent is thinking...</Text></Box>
              )}
            </Box>
            {/* 底部输入框：仅占左侧聊天区 95%，水平居中 */}
          {/* 
            width="100%": 占满父容器宽度
            justifyContent="center": 水平居中子元素（输入框容器）
            alignItems="center": 垂直居中子元素（输入框容器）
          */}
            <Box width="100%" justifyContent="center" alignItems="center">
            {/* 输入框容器 */}
            {/* 
              flexDirection="column": 子元素垂直排列
              borderStyle="single": 单线边框样式（─│┌┐┘），可选值：
                - "single"(默认): 单线边框
                - "double": 双线边框（═║）
                - "round": 圆角边框（╭─╮）
                - "bold": 粗线边框（┏━）
              borderColor="gray": 边框颜色（gray/red/green/blue/yellow/cyan/magenta/white 等）
              width={chatTextWidth + 2}: 容器宽度 = 左侧聊天区的 95%，与右侧 sidebar 分离
            */}
              <Box width={chatTextWidth + 2} flexDirection="column">
              {/* 顶部留白：用空格占一行高度 */}
                <Box width={chatTextWidth + 2}>
                <Text backgroundColor="#141414">{' '.repeat(chatTextWidth + 2)}</Text>
              </Box>
              {/* 输入框文本行 */}
              {state.inputLines.flatMap((line, row) => [
                  <Box key={`line-${row}`} width={chatTextWidth + 2}>
                  <Text backgroundColor="#141414">{fillByWidth(truncateByWidth(
                    row === state.cursorRow
                      ? line.slice(0, state.cursorCol) + (cursorVisible ? '█' : ' ') + line.slice(state.cursorCol)
                      : line,
                    chatTextWidth
                  ).text, chatTextWidth + 2)}</Text>
                </Box>,
                  <Box key={`gap-${row}`} width={chatTextWidth + 2}>
                  <Text backgroundColor="#141414">{' '.repeat(chatTextWidth + 2)}</Text>
                </Box>
              ])}
              {/* 底部留白：与顶部留白对称 */}
                <Box width={chatTextWidth + 2}>
                <Text backgroundColor="#141414">{' '.repeat(chatTextWidth + 2)}</Text>
              </Box>
              {/* 模式信息行：显示当前模式和模型名称 */}
                <Box width={chatTextWidth + 2}>
                {/* color="blue": 模式文字使用蓝色 */}
                <Text color="blue" backgroundColor="#141414"> {currentMode} </Text>
                {/* 
                  truncateByWidth(...): 截断模型名称
                  textWidth - currentMode.length - 2: 
                    - currentMode.length: 模式名称长度
                    - 2: 模式两侧各 1 个空格
                */}
                <Text dimColor backgroundColor="#141414">{fillByWidth(truncateByWidth(`· ${modelName} ${state.agentName}`, chatTextWidth - currentMode.length - 2).text, chatTextWidth - currentMode.length)}</Text>
              </Box>
              {/* 虚线分隔符：视觉分隔线 */}
                <Box width={chatTextWidth + 2}>
                  <Text dimColor backgroundColor="#141414">{'─'.repeat(chatTextWidth + 2)}</Text>
              </Box>
              {/* 快捷键提示：显示可用快捷键 */}
              {/* justifyContent="flex-end": 内容右对齐 */}
                <Box width={chatTextWidth + 2} justifyContent="flex-end">
                  <Text dimColor backgroundColor="#141414">{fillByWidth(truncateByWidth('tab agents  ctrl+p', chatTextWidth).text, chatTextWidth + 2)}</Text>
              </Box>
            </Box>
          </Box>
          </Box>
          {/* 右侧：侧边栏，固定宽度 30 字符，使用 #141414 底色 */}
          <Box width={sidebarWidth} flexDirection="column" paddingX={2} borderLeft>
            <Text bold backgroundColor="#141414">{sidebarLine('Context')}</Text>
            <Text dimColor backgroundColor="#141414">{sidebarLine(`${tokensUsed.toLocaleString()} tokens`)}</Text>
            <Text dimColor backgroundColor="#141414">{sidebarLine(`${tokenPercent}% used`)}</Text>
            <Text dimColor backgroundColor="#141414">{sidebarLine(`${totalCost} spent`)}</Text>
            <Text backgroundColor="#141414">{sidebarLine()}</Text>
            {/* LSP 标题，顶部间距 2 行 */}
            <Text bold backgroundColor="#141414">{sidebarLine('LSP')}</Text>
            <Text dimColor backgroundColor="#141414">{sidebarLine('LSPs are disabled')}</Text>
            {Array.from({ length: Math.max(0, termHeight - 10) }).map((_, i) => (
              <Text key={`sidebar-fill-${i}`} backgroundColor="#141414">{sidebarLine()}</Text>
            ))}
          </Box>
        </Box>
      )}

      {/* 底部状态栏：横向排列，space-between 两端对齐 */}
      <Box justifyContent="space-between">
        {/* 左侧：当前工作目录 + git 分支 */}
        <Text dimColor>{state.showSlashMenu ? 'Palette' : truncateByWidth(`${cwd}:main`, Math.max(12, termWidth - 48)).text}</Text>
        {/* 无对话时：显示版本号 */}
        {!hasConversation && !state.showSlashMenu && <Text dimColor>{version}</Text>}
        {state.showSlashMenu && <Text dimColor>Enter select  Esc close</Text>}
      </Box>
    </Box>
  );
}
