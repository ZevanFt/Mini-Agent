/**
 * ModalOverlay —— 业务侧使用的半透明 modal 容器组件。
 *
 * 职责分工：
 * - ModalOverlay 只负责「定位 modal 内容」（用 absolute 定位让 children 渲染到 rect 指定位置）
 * - modalState 的设置由父组件（MiniAgentTUI）在渲染期间同步完成，不依赖 useEffect
 *   这样可以避免 useEffect 清理-重执行间隙 modalState 短暂为 null 的问题
 * - 真正的半透明合成逻辑在 src/tui/index.ts 的 stdout hook 中完成
 */

import React from 'react';
import { Box } from 'ink';
import type { ModalRect } from './ModalCompositor.js';

export interface ModalOverlayProps {
  /** 是否打开 modal */
  isOpen: boolean;
  /** modal 在屏幕上的位置和尺寸（0-based 行列） */
  rect: ModalRect;
  /** 降亮度比例，范围 [0, 1]，默认 0.5（暗化 50%） */
  dimRatio?: number;
  /** modal 内容（正常 Ink 组件树） */
  children: React.ReactNode;
}

/**
 * ModalOverlay —— 定位 modal 内容到 rect 指定位置。
 *
 * modalState 的注册/注销由父组件同步处理，本组件不再使用 useEffect 设置 modalState。
 * 这样可以避免 rect 变化时 useEffect 先清理（modalState.set(null)）再重设置之间的间隙，
 * 导致 stdout hook 误判 modal 关闭。
 */
export function ModalOverlay({ isOpen, rect, children }: ModalOverlayProps) {
  // 关闭时不渲染任何内容
  if (!isOpen) return null;

  // 用 absolute 定位让 modal 内容出现在 rect 指定的位置
  // marginTop / marginLeft 决定起始行列，width 限制宽度
  // （height 由 children 内容自然撑开，不强制设置避免内容被截断）
  return (
    <Box
      position="absolute"
      flexDirection="column"
      marginTop={rect.row}
      marginLeft={rect.col}
      width={rect.width}
    >
      {children}
    </Box>
  );
}
