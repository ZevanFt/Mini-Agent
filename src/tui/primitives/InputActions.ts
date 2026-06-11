export interface InputActionResult {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
}

export function moveWordLeft(lines: string[], cursorRow: number, cursorCol: number): InputActionResult {
  const line = lines[cursorRow];
  if (cursorCol > 0) {
    let col = cursorCol - 1;
    while (col > 0 && line[col - 1] === ' ') col--;
    while (col > 0 && line[col - 1] !== ' ') col--;
    return { lines, cursorRow, cursorCol: col };
  }
  if (cursorRow > 0) {
    const prevLine = lines[cursorRow - 1];
    return { lines, cursorRow: cursorRow - 1, cursorCol: prevLine.length };
  }
  return { lines, cursorRow, cursorCol };
}

export function moveWordRight(lines: string[], cursorRow: number, cursorCol: number): InputActionResult {
  const line = lines[cursorRow];
  if (cursorCol < line.length) {
    let col = cursorCol;
    while (col < line.length && line[col] === ' ') col++;
    while (col < line.length && line[col] !== ' ') col++;
    return { lines, cursorRow, cursorCol: col };
  }
  if (cursorRow < lines.length - 1) {
    return { lines, cursorRow: cursorRow + 1, cursorCol: 0 };
  }
  return { lines, cursorRow, cursorCol };
}

export function deleteLine(lines: string[], cursorRow: number, _cursorCol: number): InputActionResult {
  if (lines.length <= 1) {
    return { lines: [''], cursorRow: 0, cursorCol: 0 };
  }
  const newLines = [...lines];
  newLines.splice(cursorRow, 1);
  const newRow = Math.min(cursorRow, newLines.length - 1);
  return { lines: newLines, cursorRow: newRow, cursorCol: Math.min(_cursorCol, newLines[newRow].length) };
}

export function deleteToLineEnd(lines: string[], cursorRow: number, cursorCol: number): InputActionResult {
  const newLines = [...lines];
  newLines[cursorRow] = newLines[cursorRow].slice(0, cursorCol);
  return { lines: newLines, cursorRow, cursorCol };
}

export function deleteToLineStart(lines: string[], cursorRow: number, cursorCol: number): InputActionResult {
  const newLines = [...lines];
  newLines[cursorRow] = newLines[cursorRow].slice(cursorCol);
  return { lines: newLines, cursorRow, cursorCol: 0 };
}

export function deleteWordLeft(lines: string[], cursorRow: number, cursorCol: number): InputActionResult {
  if (cursorCol === 0) {
    if (cursorRow === 0) return { lines, cursorRow, cursorCol };
    const prevLine = lines[cursorRow - 1];
    const currentLine = lines[cursorRow];
    const newLines = [...lines];
    newLines[cursorRow - 1] = prevLine + currentLine;
    newLines.splice(cursorRow, 1);
    return { lines: newLines, cursorRow: cursorRow - 1, cursorCol: prevLine.length };
  }
  const line = lines[cursorRow];
  let col = cursorCol - 1;
  while (col > 0 && line[col - 1] === ' ') col--;
  while (col > 0 && line[col - 1] !== ' ') col--;
  const newLines = [...lines];
  newLines[cursorRow] = line.slice(0, col) + line.slice(cursorCol);
  return { lines: newLines, cursorRow, cursorCol: col };
}

export function deleteWordRight(lines: string[], cursorRow: number, cursorCol: number): InputActionResult {
  const line = lines[cursorRow];
  if (cursorCol >= line.length) {
    if (cursorRow >= lines.length - 1) return { lines, cursorRow, cursorCol };
    const newLines = [...lines];
    newLines[cursorRow] = line + newLines[cursorRow + 1];
    newLines.splice(cursorRow + 1, 1);
    return { lines: newLines, cursorRow, cursorCol: line.length };
  }
  let col = cursorCol;
  while (col < line.length && line[col] === ' ') col++;
  while (col < line.length && line[col] !== ' ') col++;
  const newLines = [...lines];
  newLines[cursorRow] = line.slice(0, cursorCol) + line.slice(col);
  return { lines: newLines, cursorRow, cursorCol };
}

export function selectAll(lines: string[]): InputActionResult {
  const lastLine = lines[lines.length - 1];
  return { lines, cursorRow: lines.length - 1, cursorCol: lastLine.length };
}
