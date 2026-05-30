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
  const { stdout } = useStdout();

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

  // 计算当前模式名称（从 AGENT_MODES 数组中取）
  const currentMode = AGENT_MODES[state.modeIndex];
  // 提取模型简称（冒号前的部分，如 "gpt-4:turbo" -> "gpt-4"）
  const modelName = model.split(':')[0];
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
          const result = cmd.execute(args, { agent, tools: [], messageCount: 0 }); // 执行命令
          if (result) {
            const msg = (result as any).content || JSON.stringify(result); // 获取结果文本
            setMessages(prev => [...prev, { role: 'assistant', content: msg, type: 'text' }]); // 添加响应消息
          }
        }
      } else {
        // 处理普通对话

        // 模拟 Thought 阶段（显示思考时间）
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: '530ms', type: 'thought', duration: '530ms' },
        ]);

        // 模拟工具调用（显示读取文件）
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'Read: some file',
            type: 'tool',
            toolName: 'Read',
            duration: '339ms',
          },
        ]);

        // 实际调用 Agent 对话接口
        const stream = agent.chat(text);
        let fullResponse = '';
        // 流式读取响应文本
        for await (const chunk of stream) {
          fullResponse += chunk;
          updateState(prev => ({ ...prev, currentResponse: fullResponse })); // 更新显示中的响应
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
  }, [agent, slashCommands, updateState]); // 依赖：agent 实例、命令列表、状态更新函数

  // 注册键盘输入处理
  useInput((input, key) => {
    // Ctrl+C 或 Ctrl+D：退出应用
    if (key.ctrl && (input === 'c' || input === 'd')) {
      exit();
      onExit();
      return;
    }

    // Escape 键：关闭斜杠菜单
    if (input === 'escape') {
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
      if (input === '\r' || input === '\n') {
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
      if (input === '\u007f' || input === '\b') {
        // 退格键：删除过滤关键词最后一个字符
        updateState(prev => ({ ...prev, slashFilter: prev.slashFilter.slice(0, -1) }));
        return;
      }
      if (input.length === 1 && input >= ' ') {
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
    if (key.home) {
      updateState(prev => ({ ...prev, cursorCol: 0 }));
      return;
    }
    // End 键：光标移到行尾
    if (key.end) {
      updateState(prev => ({ ...prev, cursorCol: prev.inputLines[prev.cursorRow].length }));
      return;
    }

    // Enter 键：提交输入或换行
    if (input === '\r' || input === '\n') {
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

    // 退格键：删除字符或合并行
    if (input === '\u007f' || input === '\b') {
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

    // 普通字符输入：插入到光标位置
    if (input.length >= 1) {
      updateState(prev => {
        const newLines = [...prev.inputLines];
        const line = newLines[prev.cursorRow];
        newLines[prev.cursorRow] = line.slice(0, prev.cursorCol) + input + line.slice(prev.cursorCol); // 插入字符
        return {
          ...prev,
          inputLines: newLines,
          cursorCol: prev.cursorCol + input.length, // 光标右移
        };
      });
    }
  });

  // 计算输入框宽度：终端宽度的 35%
  const inputBoxWidth = Math.floor(termWidth * 0.35);
  // 计算输入框内部可用宽度（减去边框和 padding 约 4 个字符）
  const innerWidth = Math.max(inputBoxWidth - 4, 20); // 最小 20 字符

  return (
    // 最外层容器：纵向布局、宽度 100%、高度使用终端实际行数（明确数值）
    // Ink 不支持 height="100%"，需要用明确的数值
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      {/* 主内容区域：根据是否有对话显示不同布局 */}
      {!hasConversation ? (
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

          {/* 输入框容器：固定宽度、纵向布局、单线边框、灰色 */}
          <Box width={inputBoxWidth} flexDirection="column" borderStyle="single" borderColor="gray">
            {/* 输入框文本行 */}
            {state.inputLines.map((line, row) => (
              // 每行容器：固定宽度
              <Box key={row} width={inputBoxWidth}>
                {/* 左侧边框：蓝色竖线 */}
                <Text color="blue">│</Text>
                {/* 文本内容：空格 + 行文本（含光标块） */}
                <Text>{' '}{row === state.cursorRow ? line.slice(0, state.cursorCol) + '█' + line.slice(state.cursorCol) : line}
                  {/* 占位提示符：当第 0 行第 0 列且为空时显示 */}
                  {row === 0 && row === state.cursorRow && state.cursorCol === 0 && line === '' && (
                    <Text dimColor>Ask anything...</Text>
                  )}
                </Text>
              </Box>
            ))}
            {/* 模式信息行：显示当前模式和模型名称 */}
            <Box width={inputBoxWidth}>
              <Text color="blue"> {currentMode} </Text>
              <Text dimColor>· {modelName} {state.agentName}</Text>
            </Box>
            {/* 虚线分隔符：填充内部宽度 */}
            <Box width={inputBoxWidth}>
              <Text dimColor>{'─'.repeat(innerWidth)}</Text>
            </Box>
            {/* 快捷键提示：靠右对齐 */}
            <Box width={inputBoxWidth} justifyContent="flex-end">
              <Text dimColor>tab agents  ctrl+p</Text>
            </Box>
          </Box>
        </Box>
      ) : (
        // 对话页面：消息列表 + 侧边栏 + 底部输入框
        <Box flexDirection="column" flexGrow={1}>
          {/* 主区域：消息 + 侧边栏横向排列，占满剩余空间 */}
          <Box flexDirection="row" flexGrow={1}>
            {/* 左侧：对话消息列表，左右 padding 2 字符 */}
            <Box flexDirection="column" flexGrow={1} paddingX={2}>
              {/* 遍历消息列表 */}
              {messages.map((msg, i) => (
                // 每条消息容器：纵向排列、底部间距 1 行
                <Box key={i} flexDirection="column" marginBottom={1}>
                  {/* 用户消息：单线边框、蓝色、左右 padding 1 字符、白色文本 */}
                  {msg.role === 'user' && (
                    <Box borderStyle="single" borderColor="blue" paddingX={1}>
                      <Text color="white">{msg.content}</Text>
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
            </Box>
            {/* 右侧：侧边栏，固定宽度 30 字符、左右 padding 1 字符、左边框 */}
            <Box width={30} flexDirection="column" paddingX={1} borderLeft>
              <Text bold>Context</Text>
              <Text dimColor>{tokensUsed.toLocaleString()} tokens</Text>
              <Text dimColor>{tokenPercent}% used</Text>
              <Text dimColor>{totalCost} spent</Text>
              {/* LSP 标题，顶部间距 2 行 */}
              <Box marginTop={2}><Text bold>LSP</Text></Box>
              <Text dimColor>LSPs are disabled</Text>
            </Box>
          </Box>
          {/* 底部输入框：宽度 100%、水平垂直居中 */}
          <Box width="100%" justifyContent="center" alignItems="center">
            {/* 输入框容器：固定宽度、纵向布局、单线边框、灰色 */}
            <Box width={inputBoxWidth} flexDirection="column" borderStyle="single" borderColor="gray">
              {/* 输入框文本行 */}
              {state.inputLines.map((line, row) => (
                <Box key={row} width={inputBoxWidth}>
                  <Text color="blue">│</Text>
                  <Text>{' '}{row === state.cursorRow ? line.slice(0, state.cursorCol) + '█' + line.slice(state.cursorCol) : line}</Text>
                </Box>
              ))}
              {/* 模式信息行 */}
              <Box width={inputBoxWidth}>
                <Text color="blue"> {currentMode} </Text>
                <Text dimColor>· {modelName} {state.agentName}</Text>
              </Box>
              {/* 虚线分隔符 */}
              <Box width={inputBoxWidth}>
                <Text dimColor>{'─'.repeat(innerWidth)}</Text>
              </Box>
              {/* 快捷键提示 */}
              <Box width={inputBoxWidth} justifyContent="flex-end">
                <Text dimColor>tab agents  ctrl+p</Text>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* 斜杠命令菜单：横向 margin 2 字符 */}
      {state.showSlashMenu && (
        <Box flexDirection="column" marginX={2}>
          {/* 过滤命令列表，最多显示 6 个 */}
          {slashCommands
            .filter(cmd => cmd.name.includes(state.slashFilter) || cmd.description?.includes(state.slashFilter))
            .slice(0, 6)
            .map((cmd, i) => (
              <Box key={i}>
                <Text color="cyan">/{cmd.name}</Text>
                <Text dimColor>  {cmd.description || ''}</Text>
              </Box>
            ))}
        </Box>
      )}

      {/* 底部状态栏：横向排列，space-between 两端对齐 */}
      <Box justifyContent="space-between">
        {/* 左侧：当前工作目录 + git 分支 */}
        <Text dimColor>{cwd}:main</Text>
        {/* 有对话时：显示 token 统计和快捷键提示 */}
        {hasConversation && (
          <Text dimColor>{tokensUsed.toLocaleString()} ({tokenPercent}%) · {totalCost} tab agents ctrl+p commands</Text>
        )}
        {/* 无对话时：显示版本号 */}
        {!hasConversation && <Text dimColor>{version}</Text>}
      </Box>
    </Box>
  );
}
