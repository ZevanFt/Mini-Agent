/**
 * ModalState —— 全局 modal 状态单例。
 *
 * 作为 React 组件层（ModalOverlay）和 stdout hook 层（index.ts）之间的通信桥梁：
 * - React 侧：ModalOverlay 组件通过 useEffect 调用 modalState.set() 声明当前 modal 的位置和参数
 * - Hook 侧：stdout 拦截器在每次 Ink 输出时通过 modalState.get() 读取当前 modal 状态，
 *   决定是否触发半透明合成
 *
 * 设计为最简的「发布-订阅 + 当前状态」模式：
 * - get/set 同步访问当前状态
 * - subscribe 注册监听器，状态变更时回调（用于 React 侧响应式更新）
 */

import type { ModalRect } from './ModalCompositor.js';

/** 当前 modal 的完整状态快照 */
export interface ModalStateData {
  /** 是否打开（false 时其它字段无意义） */
  isOpen: boolean;
  /** modal 在屏幕上的位置和尺寸（行列坐标，0-based） */
  rect: ModalRect;
  /** 降亮度比例，范围 [0, 1]：0 = 不降亮度，1 = 全黑，0.5 = 暗化 50% */
  dimRatio: number;
  /**
   * modal 内容的 ANSI（保留字段）。
   * 实际合成逻辑中，modal 内容是 Ink 渲染树的一部分，会被 ScreenBuffer 解析，
   * 不需要外部传入。ModalOverlay 声明 modal 区域时该字段留空字符串。
   */
  modalAnsi: string;
}

/**
 * ModalStateManager —— 管理 modal 状态的单例管理器。
 * 不直接导出类，只导出单例实例 modalState，保证全局唯一。
 */
class ModalStateManager {
  private current: ModalStateData | null = null;
  private listeners: Set<() => void> = new Set();

  /** 获取当前 modal 状态（无 modal 时返回 null） */
  get(): ModalStateData | null {
    return this.current;
  }

  /** 设置当前 modal 状态（传 null 表示关闭 modal），并通知所有监听器 */
  set(state: ModalStateData | null): void {
    this.current = state;
    // 复制一份 listeners 数组再遍历，防止回调中 unsubscribe 导致迭代异常
    this.listeners.forEach(l => l());
  }

  /**
   * 订阅状态变更。
   * @returns 取消订阅函数，调用后移除该监听器
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/** 全局 modal 状态单例，React 侧和 hook 侧共享 */
export const modalState = new ModalStateManager();
