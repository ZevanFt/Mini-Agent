/**
 * SettingsDialog —— 设置面板组件（参考 MiMo Ctrl+P 结构）。
 *
 * 样式规格：
 * - 位置：屏幕正中央（上下左右居中）
 * - 背景色：#1e1e1e（深灰色块，靠遮罩层暗化效果凸出）
 * - 无边框
 * - 内边距：上下左右各 1 格
 * - 标题栏：左上「设置」蓝色粗体，右上「esc」灰色
 * - 搜索框：灰色占位符「搜索」，输入时显示光标
 * - 分类标题：蓝色 #0078d7 粗体
 * - 命令名：白色/默认色
 * - 快捷键列：灰色 dimColor，右对齐
 * - 选中高亮：蓝色背景 #0078d7
 */

import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { fillByWidth, getStringWidth, truncateByWidth } from './text.js';

export interface SettingsItem {
  label: string;
  shortcut?: string;
  category: string;
}

export interface SettingsDialogProps {
  termWidth: number;
  termHeight: number;
  items: SettingsItem[];
  filter: string;
  selectedIndex: number;
  maxHeight?: number;
}

// 分类顺序（控制显示顺序，匹配 DEFAULT_KEYBINDINGS 的 category 字段）
const CATEGORY_ORDER = ['Commands', 'Session', 'Display', 'Input', 'Help'];

export function SettingsDialog({ termWidth, termHeight, items, filter, selectedIndex, maxHeight }: SettingsDialogProps) {
  // 计算 modal 尺寸
  const modalWidth = Math.min(termWidth - 8, 60);
  const effectiveMaxHeight = maxHeight ?? (termHeight - 4);
  const contentWidth = modalWidth - 4; // 减去左右各 2 格内边距

  // 过滤
  const lowerFilter = filter.toLowerCase();
  const filtered = items.filter(item =>
    !lowerFilter ||
    item.label.toLowerCase().includes(lowerFilter) ||
    (item.shortcut && item.shortcut.toLowerCase().includes(lowerFilter)) ||
    item.category.toLowerCase().includes(lowerFilter)
  );

  // 按分类分组
  const grouped = new Map<string, SettingsItem[]>();
  for (const item of filtered) {
    const list = grouped.get(item.category) || [];
    list.push(item);
    grouped.set(item.category, list);
  }

  // 按 CATEGORY_ORDER 排序分类
  const sortedCategories = CATEGORY_ORDER.filter(cat => grouped.has(cat));
  const otherCategories = [...grouped.keys()].filter(cat => !CATEGORY_ORDER.includes(cat));
  const allCategories = [...sortedCategories, ...otherCategories];

  // 计算总行数（标题 + 搜索 + 分类标题 + 命令）
  let totalLines = 1; // 标题栏
  if (filter) totalLines += 1; // 搜索框
  for (const cat of allCategories) {
    totalLines += 1; // 分类标题
    totalLines += grouped.get(cat)!.length;
  }

  // 限制高度
  const modalHeight = Math.min(totalLines + 2, effectiveMaxHeight); // 加上下各 1 格内边距

  // 收集所有行内容
  const rows: React.ReactNode[] = [];

  // 标题栏
  const titleLine = ` 设置`;
  const escLine = `esc`;
  rows.push(
    <Box key="title" width={modalWidth}>
      <Text backgroundColor={TUI_THEME.inputBg}>
        <Text color={TUI_THEME.accent} bold>{titleLine}</Text>
        {fillByWidth('', modalWidth - getStringWidth(titleLine) - getStringWidth(escLine))}
        <Text dimColor>{escLine}</Text>
      </Text>
    </Box>
  );

  // 搜索框
  if (filter) {
    rows.push(
      <Box key="search" width={modalWidth}>
        <Text backgroundColor={TUI_THEME.inputBg}>
          {'  '}
          <Text dimColor>搜索</Text>
          <Text>{filter}</Text>
          <Text color={TUI_THEME.accent}>█</Text>
          {fillByWidth('', modalWidth - 2 - 2 - getStringWidth(filter) - 1)}
        </Text>
      </Box>
    );
  }

  // 分类列表
  for (const cat of allCategories) {
    const catItems = grouped.get(cat)!;

    // 分类标题
    rows.push(
      <Box key={`cat-${cat}`} width={modalWidth}>
        <Text backgroundColor={TUI_THEME.inputBg}>
          {'  '}
          <Text color={TUI_THEME.accent} bold>{cat}</Text>
          {fillByWidth('', modalWidth - 2 - getStringWidth(cat))}
        </Text>
      </Box>
    );

    // 命令列表
    for (let idx = 0; idx < catItems.length; idx++) {
      const item = catItems[idx];

      // 计算全局索引
      let globalIdx = 0;
      for (const prevCat of allCategories) {
        if (prevCat === cat) break;
        globalIdx += grouped.get(prevCat)!.length;
      }
      const isSelected = globalIdx + idx === selectedIndex;

      const label = item.label;
      const shortcut = item.shortcut || '';
      const maxLabelWidth = contentWidth - getStringWidth(shortcut) - 2; // 2 = 中间间隔
      const labelTruncated = truncateByWidth(label, Math.max(4, maxLabelWidth)).text;
      const shortcutTruncated = truncateByWidth(shortcut, 18).text;

      const line = `  ${labelTruncated}`;
      const gapWidth = modalWidth - getStringWidth(line) - getStringWidth(shortcutTruncated) - 2;

      if (isSelected) {
        rows.push(
          <Box key={`item-${cat}-${idx}`} width={modalWidth}>
            <Text backgroundColor={TUI_THEME.accent}>
              {line}
              {fillByWidth('', gapWidth)}
              <Text color="#000000">{shortcutTruncated}</Text>
              {'  '}
            </Text>
          </Box>
        );
      } else {
        rows.push(
          <Box key={`item-${cat}-${idx}`} width={modalWidth}>
            <Text backgroundColor={TUI_THEME.inputBg}>
              {line}
              {fillByWidth('', gapWidth)}
              <Text dimColor>{shortcutTruncated}</Text>
              {'  '}
            </Text>
          </Box>
        );
      }
    }
  }

  // 自动滚动：确保 selectedIndex 对应的行在可见窗口内
  // 计算 selectedIndex 在 rows 中的位置（标题栏 + 搜索框 + 分类标题 + 命令）
  const selectedRowInList = (() => {
    let rowIdx = 0;
    // 标题栏
    rowIdx++;
    // 搜索框
    if (filter) rowIdx++;
    // 遍历分类找到 selectedIndex 对应的行
    let globalIdx = 0;
    for (const cat of allCategories) {
      // 分类标题
      rowIdx++;
      const catItems = grouped.get(cat)!;
      for (let idx = 0; idx < catItems.length; idx++) {
        if (globalIdx === selectedIndex) return rowIdx;
        rowIdx++;
        globalIdx++;
      }
    }
    return rowIdx - 1; // 兜底
  })();

  // 计算 scrollOffset：让 selectedRowInList 在可见窗口内
  const contentAreaHeight = modalHeight - 1; // 减去标题栏
  let scrollOffset = 0;
  if (selectedRowInList >= contentAreaHeight) {
    scrollOffset = selectedRowInList - contentAreaHeight + 1;
  }
  // 确保 scrollOffset 不超出范围
  const maxScroll = Math.max(0, rows.length - modalHeight);
  scrollOffset = Math.min(scrollOffset, maxScroll);

  // 截断到 modalHeight（内容超出时），支持滚动
  const visibleRows = rows.slice(scrollOffset, scrollOffset + modalHeight);

  // 用背景色填充剩余行（如果可见行数 < modalHeight）
  const emptyRows = modalHeight - visibleRows.length;
  for (let i = 0; i < emptyRows; i++) {
    visibleRows.push(
      <Box key={`empty-${i}`} width={modalWidth}>
        <Text backgroundColor={TUI_THEME.inputBg}>{fillByWidth('', modalWidth)}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {visibleRows}
    </Box>
  );
}

export interface SettingsState {
  isOpen: boolean;
  filter: string;
  selectedIndex: number;
}

export function createSettingsState(): SettingsState {
  return { isOpen: false, filter: '', selectedIndex: 0 };
}

export function openSettings(state: SettingsState): SettingsState {
  return { ...state, isOpen: true, filter: '', selectedIndex: 0 };
}

export function closeSettings(state: SettingsState): SettingsState {
  return { ...state, isOpen: false, filter: '' };
}
