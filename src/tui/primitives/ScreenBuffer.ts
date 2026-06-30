/**
 * ScreenBuffer —— 把 Ink TUI 框架输出的 ANSI 转义序列流解析成二维字符网格。
 * 是「半透明 Modal 合成器」项目的基础组件。
 *
 * 解析能力（按规格）：
 * - SGR：reset / bold / dim / italic / 22 / 23 / 39 / 49 / 24-bit 真彩色 / 256 色
 * - 光标绝对定位 CUP（H / f，ANSI 1-based）
 * - 换行 \n（下移一行）、回车 \r（回到行首）
 * - 普通可打印字符（含 CJK 双宽，第二格用空字符占位）
 *
 * 其它 CSI（光标相对移动、擦除、私有模式等）与 OSC 按规格忽略 / 跳过，
 * 配合每帧 clear() 使用不会产生残留。
 */

import { getStringWidth } from './text.js';

export interface Cell {
  char: string; // 字符（可能是 CJK 双宽字符）；空字符串 '' 表示双宽字符的占位格
  width: 1 | 2; // 显示宽度
  fg: string | null; // 前景色，格式 '#rrggbb'，null 表示默认色
  bg: string | null; // 背景色，格式 '#rrggbb'，null 表示默认色
  bold: boolean;
  dim: boolean;
  italic: boolean;
}

// ===== 256 色映射（标准 ANSI 规范，允许硬编码）=====

// 0-15：标准 16 色（xterm / GNOME 终端默认调色板）
const BASE16_COLORS: readonly string[] = [
  '#000000', '#cc0000', '#4e9a06', '#c4a000',
  '#3465a4', '#75507b', '#06989a', '#d3d7cf',
  '#555753', '#ef2929', '#8ae234', '#fce94f',
  '#729fcf', '#ad7fa8', '#34e2e2', '#eeeeec',
];

// 16-231：6x6x6 色立方体的亮度阶梯
const CUBE_LEVELS: readonly number[] = [0, 95, 135, 175, 215, 255];

// 把 0-255 的分量转成两位十六进制
function toHex2(n: number): string {
  const clamped = Math.max(0, Math.min(255, n | 0));
  return clamped.toString(16).padStart(2, '0');
}

// 把 RGB 分量打包成 '#rrggbb'
function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

// 把 256 色索引转换成 '#rrggbb'
function color256ToHex(n: number): string {
  const idx = Math.max(0, Math.min(255, n | 0));
  if (idx < 16) {
    return BASE16_COLORS[idx];
  }
  if (idx < 232) {
    const i = idx - 16;
    const r = CUBE_LEVELS[Math.floor(i / 36)];
    const g = CUBE_LEVELS[Math.floor(i / 6) % 6];
    const b = CUBE_LEVELS[i % 6];
    return rgbToHex(r, g, b);
  }
  // 232-255：灰阶
  const v = 8 + (idx - 232) * 10;
  return rgbToHex(v, v, v);
}

// 把 '#rrggbb' 解析回 RGB 分量（encode 时输出 24-bit SGR 用）
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// 创建一个空白默认格
function blankCell(): Cell {
  return { char: ' ', width: 1, fg: null, bg: null, bold: false, dim: false, italic: false };
}

// 创建全空网格
function createGrid(rows: number, cols: number): Cell[][] {
  const grid: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < cols; c++) row.push(blankCell());
    grid.push(row);
  }
  return grid;
}

export class ScreenBuffer {
  private _rows: number;
  private _cols: number;
  private grid: Cell[][];

  // 当前光标位置
  private cursorRow: number;
  private cursorCol: number;

  // 当前 SGR 状态（写入字符时复制到对应 Cell）
  private curBold: boolean;
  private curDim: boolean;
  private curItalic: boolean;
  private curFg: string | null;
  private curBg: string | null;

  constructor(rows: number, cols: number) {
    this._rows = rows;
    this._cols = cols;
    this.grid = createGrid(rows, cols);
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.curBold = false;
    this.curDim = false;
    this.curItalic = false;
    this.curFg = null;
    this.curBg = null;
  }

  get rows(): number {
    return this._rows;
  }

  get cols(): number {
    return this._cols;
  }

  /** 解析 ANSI 流，更新内部网格 */
  write(ansi: string): void {
    const len = ansi.length;
    let i = 0;
    while (i < len) {
      const ch = ansi[i];
      if (ch === '\x1b') {
        const next = i + 1 < len ? ansi[i + 1] : '';
        if (next === '[') {
          // CSI：ESC [ params intermediates final
          let j = i + 2;
          let paramStr = '';
          // 参数字节 0x30-0x3f（数字、;、:、<、=、>、?）
          while (j < len) {
            const code = ansi.charCodeAt(j);
            if (code >= 0x30 && code <= 0x3f) {
              paramStr += ansi[j];
              j++;
            } else {
              break;
            }
          }
          // 中间字节 0x20-0x2f（消费但不存储）
          while (j < len) {
            const code = ansi.charCodeAt(j);
            if (code >= 0x20 && code <= 0x2f) {
              j++;
            } else {
              break;
            }
          }
          // 终止字节 0x40-0x7e
          const finalByte = j < len ? ansi[j] : '';
          if (j < len) j++;
          if (finalByte === 'm') {
            this.applySGR(paramStr);
          } else if (finalByte === 'H' || finalByte === 'f') {
            this.applyCUP(paramStr);
          } else if (finalByte === 'J') {
            // ED（Erase Display）：处理清屏序列
            // Ink 每帧渲染会输出 \x1b[2J 清屏，必须清空网格否则会产生残留
            this.applyED(paramStr);
          }
          // 其它 CSI（光标相对移动、私有模式等）按规格忽略
          i = j;
        } else if (next === ']') {
          // OSC：ESC ] ... BEL(\x07) 或 ST(ESC \)，整体跳过
          let j = i + 2;
          while (j < len) {
            if (ansi[j] === '\x07') {
              j++;
              break;
            }
            if (ansi[j] === '\x1b' && j + 1 < len && ansi[j + 1] === '\\') {
              j += 2;
              break;
            }
            j++;
          }
          i = j;
        } else if (next !== '') {
          // 其它 escape（ESC 7 / ESC 8 / ESC = / ESC M 等）：跳过 ESC + 下一字节
          i += 2;
        } else {
          // 末尾孤立的 ESC
          i++;
        }
      } else if (ch === '\n') {
        // 换行：移到下一行（列不变）
        this.cursorRow++;
        i++;
      } else if (ch === '\r') {
        // 回车：回到行首
        this.cursorCol = 0;
        i++;
      } else if (ch < '\x20') {
        // 其它控制字符：忽略
        i++;
      } else {
        // 可打印字符（处理代理对，取完整 code point）
        const code = ansi.codePointAt(i)!;
        const char = String.fromCodePoint(code);
        i += char.length;
        this.writeChar(char);
      }
    }
  }

  // 写入一个字符到当前光标位置
  private writeChar(char: string): void {
    const w = getStringWidth(char);
    if (w === 0) {
      // 零宽字符（组合附标等）：忽略
      return;
    }
    const r = this.cursorRow;
    const c = this.cursorCol;
    if (r < 0 || r >= this._rows || c < 0 || c >= this._cols) {
      // 越界：不写入，但仍推进光标以维持 Ink 的写入语义
      this.cursorCol += w;
      return;
    }
    if (w === 2) {
      // 双宽字符：需要 2 格
      if (c + 1 >= this._cols) {
        // 跨右边界：截断（不写入），光标右移一格
        this.cursorCol++;
        return;
      }
      this.grid[r][c] = {
        char,
        width: 2,
        fg: this.curFg,
        bg: this.curBg,
        bold: this.curBold,
        dim: this.curDim,
        italic: this.curItalic,
      };
      // 第二格用空字符占位（样式与主格保持一致）
      this.grid[r][c + 1] = {
        char: '',
        width: 1,
        fg: this.curFg,
        bg: this.curBg,
        bold: this.curBold,
        dim: this.curDim,
        italic: this.curItalic,
      };
      this.cursorCol += 2;
    } else {
      // 普通字符
      this.grid[r][c] = {
        char,
        width: 1,
        fg: this.curFg,
        bg: this.curBg,
        bold: this.curBold,
        dim: this.curDim,
        italic: this.curItalic,
      };
      this.cursorCol += 1;
    }
  }

  // 应用 SGR 参数串
  private applySGR(paramStr: string): void {
    if (paramStr === '') {
      this.resetStyle();
      return;
    }
    const params = paramStr.split(';').map(p => (p === '' ? 0 : parseInt(p, 10)));
    let i = 0;
    while (i < params.length) {
      const p = params[i];
      if (p === 0) {
        this.resetStyle();
      } else if (p === 1) {
        this.curBold = true;
      } else if (p === 2) {
        this.curDim = true;
      } else if (p === 3) {
        this.curItalic = true;
      } else if (p === 22) {
        this.curBold = false;
        this.curDim = false;
      } else if (p === 23) {
        this.curItalic = false;
      } else if (p === 39) {
        this.curFg = null;
      } else if (p === 49) {
        this.curBg = null;
      } else if (p === 38) {
        const sub = params[i + 1];
        if (sub === 2) {
          const r = params[i + 2] ?? 0;
          const g = params[i + 3] ?? 0;
          const b = params[i + 4] ?? 0;
          this.curFg = rgbToHex(r, g, b);
          i += 4;
        } else if (sub === 5) {
          const n = params[i + 2] ?? 0;
          this.curFg = color256ToHex(n);
          i += 2;
        } else {
          // 未知子参数：停止解析本序列
          return;
        }
      } else if (p === 48) {
        const sub = params[i + 1];
        if (sub === 2) {
          const r = params[i + 2] ?? 0;
          const g = params[i + 3] ?? 0;
          const b = params[i + 4] ?? 0;
          this.curBg = rgbToHex(r, g, b);
          i += 4;
        } else if (sub === 5) {
          const n = params[i + 2] ?? 0;
          this.curBg = color256ToHex(n);
          i += 2;
        } else {
          return;
        }
      }
      // 其它 SGR 码（如下划线 4、标准 8/16 色等）按规格忽略
      i++;
    }
  }

  private resetStyle(): void {
    this.curBold = false;
    this.curDim = false;
    this.curItalic = false;
    this.curFg = null;
    this.curBg = null;
  }

  // 应用光标绝对定位（CUP）：ANSI 1-based
  private applyCUP(paramStr: string): void {
    if (paramStr === '') {
      this.cursorRow = 0;
      this.cursorCol = 0;
      return;
    }
    const parts = paramStr.split(';');
    const r = parts[0] === '' ? 1 : parseInt(parts[0], 10);
    const c = parts[1] === undefined || parts[1] === '' ? 1 : parseInt(parts[1], 10);
    this.cursorRow = isNaN(r) ? 0 : r - 1;
    this.cursorCol = isNaN(c) ? 0 : c - 1;
  }

  // 应用 ED（Erase Display）：处理清屏序列
  // 仅处理 \x1b[2J（整个屏幕清除）→ 调用 clear()
  // 其它模式（0/1/3）按规格忽略（半透明 modal 场景下不影响合成结果）
  private applyED(paramStr: string): void {
    // 空参数等价于 \x1b[0J：从光标到屏幕末尾清除，规格忽略
    if (paramStr === '') {
      return;
    }
    const n = parseInt(paramStr, 10);
    // 只有 \x1b[2J（整个屏幕清除）需要清空网格
    if (n === 2) {
      this.clear();
    }
    // 0：光标到末尾；1：开头到光标；3：滚动缓冲区 —— 按规格忽略
  }

  /** 取某个格子的内容（越界返回 null） */
  get(row: number, col: number): Cell | null {
    if (row < 0 || row >= this._rows || col < 0 || col >= this._cols) {
      return null;
    }
    return this.grid[row][col];
  }

  /** 设置某个格子（用于合成器） */
  set(row: number, col: number, cell: Cell): void {
    if (row < 0 || row >= this._rows || col < 0 || col >= this._cols) {
      return;
    }
    // 复制一份，避免外部引用造成的别名问题
    this.grid[row][col] = { ...cell };
  }

  /** 重新编码成 ANSI 输出（从 (0,0) 开始重新绘制整个网格） */
  encode(): string {
    let out = '';
    // 上一次输出的样式（用字符串 key 比较）；空串为哨兵，保证首次必定变化
    let lastStyleKey = '';
    // 上一次写入后光标所在位置（用于判断是否需要重新定位，优化性能）
    let lastRow = -1;
    let expectedCol = -1;

    for (let r = 0; r < this._rows; r++) {
      for (let c = 0; c < this._cols; c++) {
        const cell = this.grid[r][c];
        // 占位格（双宽字符第二格）：跳过
        if (cell.char === '') {
          continue;
        }
        // 决定是否需要写出：
        // - 非空格字符：写出
        // - 空格但有背景色：写出（显示背景）
        // - 空格且无背景色：跳过（无可见效果，省 SGR / 定位开销）
        if (cell.char === ' ' && cell.bg === null) {
          continue;
        }

        // 光标定位：仅在非连续时输出，优化性能
        const contiguous = r === lastRow && c === expectedCol;
        if (!contiguous) {
          out += `\x1b[${r + 1};${c + 1}H`;
        }

        // SGR：仅在样式变化时输出，优化性能
        const styleKey =
          (cell.bold ? 'B' : '-') +
          (cell.dim ? 'D' : '-') +
          (cell.italic ? 'I' : '-') +
          '|' +
          (cell.fg ?? '') +
          '|' +
          (cell.bg ?? '');
        if (styleKey !== lastStyleKey) {
          const sgrParams: string[] = ['0'];
          if (cell.bold) sgrParams.push('1');
          if (cell.dim) sgrParams.push('2');
          if (cell.italic) sgrParams.push('3');
          if (cell.fg) {
            const { r: rr, g: gg, b: bb } = hexToRgb(cell.fg);
            sgrParams.push(`38;2;${rr};${gg};${bb}`);
          }
          if (cell.bg) {
            const { r: rr, g: gg, b: bb } = hexToRgb(cell.bg);
            sgrParams.push(`48;2;${rr};${gg};${bb}`);
          }
          out += `\x1b[${sgrParams.join(';')}m`;
          lastStyleKey = styleKey;
        }

        out += cell.char;
        lastRow = r;
        expectedCol = c + cell.width;
      }
    }

    // 结尾 reset
    out += '\x1b[0m';
    return out;
  }

  /** 清空网格 */
  clear(): void {
    this.grid = createGrid(this._rows, this._cols);
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.resetStyle();
  }

  /** 调整尺寸（保留原有内容） */
  resize(rows: number, cols: number): void {
    if (rows === this._rows && cols === this._cols) {
      return;
    }
    const newGrid = createGrid(rows, cols);
    const copyRows = Math.min(rows, this._rows);
    const copyCols = Math.min(cols, this._cols);
    for (let r = 0; r < copyRows; r++) {
      for (let c = 0; c < copyCols; c++) {
        newGrid[r][c] = this.grid[r][c];
      }
    }
    this.grid = newGrid;
    this._rows = rows;
    this._cols = cols;
    // 钳制光标到新范围
    if (this.cursorRow >= rows) this.cursorRow = rows - 1;
    if (this.cursorCol >= cols) this.cursorCol = cols - 1;
    if (this.cursorRow < 0) this.cursorRow = 0;
    if (this.cursorCol < 0) this.cursorCol = 0;
  }
}