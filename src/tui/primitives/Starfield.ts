/**
 * Starfield background effect - renders subtle star particles
 * using ANSI escape codes, overlaid after Ink's render.
 */

interface Star {
  row: number;
  col: number;
  char: string;
  r: number;
  g: number;
  b: number;
}

const STAR_CHARS = ['·', '✦', '✧', '·', '·', '·', '·', '·'];
const STAR_COLORS = [
  [0x33, 0x33, 0x33],
  [0x44, 0x44, 0x44],
  [0x55, 0x55, 0x55],
  [0x66, 0x66, 0x66],
  [0x77, 0x77, 0x77],
  [0x88, 0x88, 0x88],
  [0x99, 0x99, 0x99],
  [0xaa, 0xaa, 0xaa],
];

export class Starfield {
  private stars: Star[] = [];
  private rows: number;
  private cols: number;
  private density: number;

  constructor(rows: number, cols: number, density: number = 0.003) {
    this.rows = rows;
    this.cols = cols;
    this.density = density;
    this.generate();
  }

  resize(rows: number, cols: number): void {
    if (rows === this.rows && cols === this.cols) return;
    this.rows = rows;
    this.cols = cols;
    this.generate();
  }

  private generate(): void {
    const count = Math.floor(this.rows * this.cols * this.density);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      const color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
      this.stars.push({
        row: Math.floor(Math.random() * this.rows) + 1,
        col: Math.floor(Math.random() * this.cols) + 1,
        char: STAR_CHARS[Math.floor(Math.random() * STAR_CHARS.length)],
        r: color[0],
        g: color[1],
        b: color[2],
      });
    }
  }

  /** Render all stars as ANSI escape codes */
  render(): string {
    const parts: string[] = [];
    for (const s of this.stars) {
      parts.push(`\x1b[${s.row};${s.col}H\x1b[38;2;${s.r};${s.g};${s.b}m${s.char}`);
    }
    parts.push('\x1b[0m');
    return parts.join('');
  }

  /** Twinkle: randomly dim/brighten a few stars */
  twinkle(): void {
    const count = Math.max(1, Math.floor(this.stars.length * 0.1));
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * this.stars.length);
      const star = this.stars[idx];
      const shift = Math.floor(Math.random() * 0x22) - 0x11;
      star.r = Math.max(0x22, Math.min(0xaa, star.r + shift));
      star.g = Math.max(0x22, Math.min(0xaa, star.g + shift));
      star.b = Math.max(0x22, Math.min(0xaa, star.b + shift));
    }
  }
}
