/**
 * ModalCompositor —— 半透明 Modal 合成器。
 *
 * 终端 ANSI 协议没有 alpha 通道，无法真正"半透明"。这里用"颜色降亮度混合"模拟：
 * - modal 区域内：显示 modal 自己渲染的内容
 * - modal 区域外：把背景层颜色乘以 (1 - dimRatio)，越接近 1 越暗
 *
 * 依赖 ScreenBuffer 提供的二维字符网格（含 CJK 双宽占位格语义）。
 */

import { Cell, ScreenBuffer } from './ScreenBuffer.js';

/** modal 在屏幕上的位置和尺寸 */
export interface ModalRect {
  row: number;
  col: number;
  width: number;
  height: number;
}

/**
 * hex 颜色乘以系数，返回新的 hex 颜色。
 * @param hex 格式 '#rrggbb'，null 表示默认色（不处理）
 * @param factor 保留系数，范围 [0, 1]：1 = 原色，0 = 全黑
 * @returns 新的 '#rrggbb'，或 null（输入为 null 时）
 */
export function dimColor(hex: string | null, factor: number): string | null {
  if (!hex) return null;
  // hex 格式 '#rrggbb'
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.floor(r * factor);
  const ng = Math.floor(g * factor);
  const nb = Math.floor(b * factor);
  return '#' + nr.toString(16).padStart(2, '0') + ng.toString(16).padStart(2, '0') + nb.toString(16).padStart(2, '0');
}

/**
 * 对单个 Cell 降亮度（前景 + 背景同时降）。
 * @param cell 原始 Cell
 * @param dimRatio 降亮度比例，范围 [0, 1]：0 = 不降，1 = 全黑，0.5 = 暗化 50%
 * @returns 新的 Cell（不修改原 Cell）
 */
export function dimCell(cell: Cell, dimRatio: number): Cell {
  const factor = 1 - dimRatio;
  return {
    ...cell,
    fg: dimColor(cell.fg, factor),
    bg: dimColor(cell.bg, factor),
  };
}

export class ModalCompositor {
  constructor(private bgBuffer: ScreenBuffer) {}

  /**
   * 合成：modal 区域用 modal 内容，modal 区域外降亮度。
   * @param modalBuffer modal 自己渲染的 ScreenBuffer（尺寸 = modalRect）
   * @param modalRect modal 在屏幕上的位置
   * @param dimRatio 降亮度比例（0 = 不降亮度，1 = 全黑，0.5 = 暗化 50%）
   * @returns 合成后的新 ScreenBuffer（与 bgBuffer 同尺寸）
   */
  composite(modalBuffer: ScreenBuffer, modalRect: ModalRect, dimRatio: number): ScreenBuffer {
    const rows = this.bgBuffer.rows;
    const cols = this.bgBuffer.cols;
    const result = new ScreenBuffer(rows, cols);

    // modal 矩形的边界（含负数 / 越界钳制由 get/set 内部处理）
    const modalRowEnd = modalRect.row + modalRect.height;
    const modalColEnd = modalRect.col + modalRect.width;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const inModalRow = r >= modalRect.row && r < modalRowEnd;
        const inModalCol = c >= modalRect.col && c < modalColEnd;
        const inModal = inModalRow && inModalCol;

        if (inModal) {
          // modal 区域内：优先用 modalBuffer 的内容
          const modalCell = modalBuffer.get(r - modalRect.row, c - modalRect.col);
          if (modalCell) {
            // modal 有内容：直接用（modalBuffer 越界时 get 返回 null，进 else 分支）
            result.set(r, c, modalCell);
          } else {
            // modalBuffer 越界（modalRect 比 modalBuffer 大）：用背景格子（原样，不降亮度）
            const bgCell = this.bgBuffer.get(r, c);
            if (bgCell) {
              result.set(r, c, bgCell);
            }
          }
        } else {
          // modal 区域外：取背景格子降亮度
          const bgCell = this.bgBuffer.get(r, c);
          if (!bgCell) {
            // 背景越界（理论上不会发生，因为 r/c 在 buffer 范围内）：跳过
            continue;
          }
          // 双宽字符的占位格（第二格，char 为空）：跳过降亮度，保持原样
          // 原因：占位格在 encode 时被跳过，不参与显示；降亮度无意义，且避免和主格颜色不一致
          if (bgCell.char === '') {
            result.set(r, c, bgCell);
            continue;
          }
          // 普通格：降亮度
          result.set(r, c, dimCell(bgCell, dimRatio));
        }
      }
    }

    return result;
  }

  /**
   * 对整个 buffer 降亮度（不合成 modal）。
   * @param buffer 要降亮度的 ScreenBuffer
   * @param dimRatio 降亮度比例（0 = 不降，1 = 全黑，0.5 = 暗化 50%）
   * @returns 降亮度后的新 ScreenBuffer
   */
  dimAll(buffer: ScreenBuffer, dimRatio: number): ScreenBuffer {
    const rows = buffer.rows;
    const cols = buffer.cols;
    const result = new ScreenBuffer(rows, cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = buffer.get(r, c);
        if (!cell) continue;
        if (cell.char === '') {
          result.set(r, c, cell);
          continue;
        }
        result.set(r, c, dimCell(cell, dimRatio));
      }
    }
    return result;
  }
}
