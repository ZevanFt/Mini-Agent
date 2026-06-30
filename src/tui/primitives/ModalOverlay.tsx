/**
 * ModalOverlay —— 业务侧使用的半透明 modal 容器组件。
 *
 * 职责分工：
 * - ModalOverlay 只负责「声明 modal 区域」（通过 modalState.set 注册当前 modal 的位置和参数）
 * - 真正的半透明合成逻辑在 src/tui/index.ts 的 stdout hook 中完成
 *
 * 合成流程（在 index.ts 中）：
 *   1. Ink 把整个 React 树（含背景 + modal 内容）渲染到 stdout
 *   2. stdout hook 拦截输出，用 ScreenBuffer 解析成二维字符网格
 *   3. 检查 modalState：如果 modal 打开，从 screenBuffer 提取 modalRect 区域作为 modalBuffer
 *   4. 调 ModalCompositor.composite() 合成（modal 区域原样 + 区域外降亮度）
 *   5. 输出合成结果到真实 stdout
 *
 * 因此 ModalOverlay 本身只需要：
 *   - 用 useEffect 把 modal 状态注册到 modalState
 *   - 用 Box 的 absolute 定位让 children 渲染到 rect 指定位置
 *     （这样 Ink 输出的字符会落在 screenBuffer 的 modalRect 区域内，hook 提取时能拿到正确内容）
 */

import React, { useEffect } from 'react';
import { Box } from 'ink';
import { modalState, type ModalStateData } from './ModalState.js';
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
 * ModalOverlay —— 声明一个半透明 modal 区域。
 *
 * - isOpen 为 true 时，向 modalState 注册当前 rect / dimRatio，触发 stdout hook 合成
 * - isOpen 为 false 或组件卸载时，向 modalState 注销（设为 null），停止合成
 *
 * 渲染层面：用 absolute 定位 + marginTop / marginLeft / width 让 children 出现在 rect 指定位置，
 * 这样 Ink 输出的 modal 字符会落在 screenBuffer 的 modalRect 区域内。
 */
export function ModalOverlay({ isOpen, rect, dimRatio = 0.5, children }: ModalOverlayProps) {
  useEffect(() => {
    if (isOpen) {
      // 注册 modal 状态到全局单例，stdout hook 会读取并触发合成
      // modalAnsi 字段留空字符串：实际合成时 hook 直接从 screenBuffer 提取 modalRect 区域，
      // 不需要外部传入 ANSI
      const state: ModalStateData = { isOpen: true, rect, dimRatio, modalAnsi: '' };
      modalState.set(state);
    } else {
      // 关闭 modal：清空全局状态
      modalState.set(null);
    }
    return () => {
      // 组件卸载或依赖变化时清理：如果之前是打开状态，注销 modal
      if (isOpen) modalState.set(null);
    };
    // rect 是对象引用，依赖列表展开成基本类型字段，避免对象引用变化导致不必要的重订阅
  }, [isOpen, rect.row, rect.col, rect.width, rect.height, dimRatio]);

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
