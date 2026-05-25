"""
Deterministic code post-processor for small-model outputs.

Fixes the most common failure modes of deepseek-coder:1.3b WITHOUT calling the LLM:
  1. Strip markdown fences and prose lines
  2. Strip rambling inline comments (the "# type hint, return as per requirement" kind)
  3. Fix the common "else :  <extra-spaces>" indentation bug
  4. Fix trailing-block dead-code (a line indented one level less than its block-mate)
  5. Try ast.parse() and auto-correct simple breakages

Operates on raw text -> cleaned text.
"""
from __future__ import annotations

import ast
import re
import textwrap
from dataclasses import dataclass
from typing import Optional


# ---------------- markdown / prose stripping -----------------

_FENCE_RE = re.compile(r"^\s*```.*$", re.MULTILINE)
_PROSE_PREFIX = re.compile(
    r"^\s*(here(?:'s| is)|sure[!.]?|below is|this (?:code|function|script|class)|"
    r"i'?(?:m|ll|ve)|let me|note:|explanation:|the following)",
    re.IGNORECASE,
)


def strip_markdown_and_prose(text: str) -> str:
    """Remove ```fences and leading/trailing prose lines."""
    # 1. Strip fence lines (keep their contents)
    text = _FENCE_RE.sub("", text)

    lines = text.splitlines()

    # 2. Drop leading non-code lines
    start = 0
    for i, line in enumerate(lines):
        s = line.strip()
        if not s:
            continue
        if _PROSE_PREFIX.match(s):
            continue
        # First "code-like" line wins
        if re.match(r"^(from|import|def|class|@|#|if\s+__name__|\w+\s*=)", s):
            start = i
            break
        # if it doesn't look like prose either, accept it
        start = i
        break

    # 3. Drop trailing prose
    end = len(lines)
    for i in range(len(lines) - 1, start - 1, -1):
        s = lines[i].strip()
        if not s:
            continue
        if _PROSE_PREFIX.match(s):
            end = i
            continue
        # Dangling sentence like "This code does X." (ends with period, no code chars)
        if s.endswith(".") and not re.search(r"[=():\[\]{}]", s) and " " in s:
            end = i
            continue
        end = i + 1
        break

    return "\n".join(lines[start:end])


# ---------------- comment stripping ----------------

# Rambling patterns specific to deepseek-coder:1.3b's typical output
RAMBLING_COMMENT_PATTERNS = [
    r"type[- ]?hint",
    r"as per (?:the )?(?:requirement|task|description)",
    r"name it whatever",
    r"if needed|if you want",
    r"for now|later",
    r"self[- ]?explanatory",
    r"this (?:is|will|can|should)",
    r"please (?:note|see)",
    r"required (?:in|for) (?:the )?(?:task|function)",
    r"return(?:s|ing) (?:the |a |an |what )",
    r"as we are",
    r"otherwise it'?s? optional",
    r"good practice",
    r"can be left out",
    r"if not (?:provided|specified)",
]

_RAMBLING_RE = re.compile("|".join(RAMBLING_COMMENT_PATTERNS), re.IGNORECASE)
_INLINE_COMMENT_RE = re.compile(r"^(.*?)(\s*#\s*(.*))$")


def strip_rambling_comments(code: str) -> str:
    """Remove inline rambling comments. Keep short genuine comments."""
    out_lines = []
    for line in code.splitlines():
        # Skip pure-comment lines that ramble
        stripped = line.lstrip()
        if stripped.startswith("#"):
            if _RAMBLING_RE.search(stripped):
                continue
            # Drop comments longer than 80 chars (likely rambling)
            if len(stripped) > 80:
                continue
            out_lines.append(line)
            continue

        # Inline comments: keep code, strip comment if rambling or > 40 chars
        # Need to be careful not to break strings - simple heuristic only
        m = _split_inline_comment(line)
        if m is None:
            out_lines.append(line)
            continue

        code_part, comment_text = m
        if _RAMBLING_RE.search(comment_text) or len(comment_text) > 40:
            # strip the comment, keep code part
            out_lines.append(code_part.rstrip())
        else:
            out_lines.append(line)
    return "\n".join(out_lines)


def _split_inline_comment(line: str) -> Optional[tuple[str, str]]:
    """Return (code_part_before_hash, comment_text) or None if no inline comment.

    Naive: ignores # inside strings. Sufficient for small-model outputs.
    """
    in_single = in_double = False
    i = 0
    while i < len(line):
        c = line[i]
        if c == "'" and not in_double and (i == 0 or line[i - 1] != "\\"):
            in_single = not in_single
        elif c == '"' and not in_single and (i == 0 or line[i - 1] != "\\"):
            in_double = not in_double
        elif c == "#" and not in_single and not in_double:
            return line[:i], line[i + 1:].strip()
        i += 1
    return None


# ---------------- indentation fixes ----------------

# Pattern: "else :     " or "elif :    " with extra leading whitespace beyond if-line
_BAD_ELSE_RE = re.compile(r"^(\s+)(else|elif|except|finally)(\s*:)(.*)$")


def fix_else_indentation(code: str) -> str:
    """Fix the common 'else with extra leading spaces' bug.

    deepseek-coder:1.3b often writes:
        if x:
            do_a()
             else :     # <-- one extra space breaks Python
                do_b()

    We re-align bad else/elif to the indentation of the nearest preceding
    if/for/while/try at the *same logical block level*.
    """
    lines = code.splitlines()
    # Stack of (indent_width, keyword) for blocks that can take else
    indent_stack: list[tuple[int, str]] = []

    out = []
    for idx, line in enumerate(lines):
        stripped = line.lstrip()
        indent = len(line) - len(stripped)

        # Pop stack entries with indent >= current line's indent
        while indent_stack and indent_stack[-1][0] >= indent:
            indent_stack.pop()

        # Detect if/for/while/try header
        m_open = re.match(r"^(if|for|while|try|elif)\b.*:\s*(#.*)?$", stripped)
        if m_open:
            indent_stack.append((indent, m_open.group(1)))
            out.append(line)
            continue

        # Detect else/elif/except/finally
        m_else = _BAD_ELSE_RE.match(line)
        if m_else:
            keyword = m_else.group(2)
            rest = m_else.group(4)
            # Find matching block start in stack
            if indent_stack:
                target_indent = indent_stack[-1][0]
                fixed_line = " " * target_indent + keyword + ":" + rest
                out.append(fixed_line)
                # Push the else/elif as a continuation
                indent_stack.append((target_indent, keyword))
                continue
        out.append(line)

    return "\n".join(out)


# ---------------- empty function body fix ----------------

_HEADER_RE = re.compile(r"^(\s*)(def|class)\s+\w+.*:\s*(#.*)?$")


def add_missing_pass(code: str) -> str:
    """If a def/class header is followed by a dedent or another header, insert 'pass'."""
    lines = code.splitlines()
    out: list[str] = []
    for i, line in enumerate(lines):
        out.append(line)
        m = _HEADER_RE.match(line)
        if not m:
            continue
        header_indent = len(m.group(1))
        # Look at the next non-blank, non-comment line
        body_found = False
        for j in range(i + 1, len(lines)):
            nxt = lines[j]
            nxt_stripped = nxt.strip()
            if not nxt_stripped:
                continue
            if nxt_stripped.startswith("#"):
                continue
            nxt_indent = len(nxt) - len(nxt.lstrip())
            if nxt_indent > header_indent:
                body_found = True
            break
        if not body_found:
            out.append(" " * (header_indent + 4) + "pass")
    return "\n".join(out)


# ---------------- normalize odd indents (1 or 3 spaces -> 4) ----------------

def normalize_indents(code: str) -> str:
    """Snap odd leading indents (1, 2, 3, 5, 6, 7 spaces) to nearest multiple of 4.

    Only acts when a line has indent that doesn't match the indent of any
    surrounding line. Helps with 'if' written with 1-space indent.
    """
    lines = code.splitlines()
    out = []
    for line in lines:
        stripped = line.lstrip()
        if not stripped:
            out.append(line)
            continue
        indent = len(line) - len(stripped)
        # Snap to multiple of 4
        if indent % 4 != 0:
            # If close to a multiple of 4, snap. e.g. 1->0, 3->4, 5->4, 6->8, 7->8
            snapped = round(indent / 4) * 4
            out.append(" " * snapped + stripped)
        else:
            out.append(line)
    return "\n".join(out)


# ---------------- dead-code / unreachable return after else ----------------

def remove_orphan_returns(code: str) -> str:
    """Detect 'return X' indented at the level of an outer block when it follows
    a closed if/else - this is the dead-code pattern from t5 calculator.

    Conservative: only remove if the previous non-empty line is in an if/else block
    that already has its own return, and the orphan return references a variable
    defined only in the else branch.

    For now, just delete the orphan return when ast.parse fails on it.
    """
    # Try to parse first; only intervene on syntax error
    try:
        ast.parse(code)
        return code
    except SyntaxError:
        pass

    # Find lines that look like dangling "return result" without proper context
    lines = code.splitlines()
    fixed = []
    for i, line in enumerate(lines):
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        if re.match(r"^return\s+\w+\s*$", stripped):
            # Check if there's a matching variable definition at this indent or deeper
            # If the previous lines (going back to the function def) don't have this
            # name assigned at this scope, it's an orphan.
            var_match = re.match(r"^return\s+(\w+)", stripped)
            if var_match:
                var = var_match.group(1)
                # Look back for `var = ...` at indent >= this line, before any dedent below
                defined = False
                for j in range(i - 1, -1, -1):
                    prev = lines[j].lstrip()
                    prev_indent = len(lines[j]) - len(prev)
                    if prev_indent < indent and re.match(r"^\s*def\s", lines[j]):
                        # hit function boundary
                        break
                    if re.match(rf"^{re.escape(var)}\s*=", prev) and prev_indent <= indent:
                        defined = True
                        break
                if not defined:
                    # Skip this orphan
                    continue
        fixed.append(line)
    return "\n".join(fixed)


# ---------------- main pipeline ----------------


@dataclass
class CleanupReport:
    code: str
    syntax_ok: bool
    syntax_error: Optional[str]
    steps_applied: list[str]


def clean_code(raw: str) -> CleanupReport:
    """Run the full cleanup pipeline. Returns final code + report."""
    steps = []
    code = raw

    # 1. Markdown / prose
    new = strip_markdown_and_prose(code)
    if new != code:
        steps.append("strip_markdown_and_prose")
        code = new

    # 2. Rambling comments
    new = strip_rambling_comments(code)
    if new != code:
        steps.append("strip_rambling_comments")
        code = new

    # 3. else indentation
    new = fix_else_indentation(code)
    if new != code:
        steps.append("fix_else_indentation")
        code = new

    # 4. normalize odd indents (1/3/5 spaces -> nearest mult of 4)
    new = normalize_indents(code)
    if new != code:
        steps.append("normalize_indents")
        code = new

    # 5. add 'pass' to empty function/class bodies
    new = add_missing_pass(code)
    if new != code:
        steps.append("add_missing_pass")
        code = new

    # 6. orphan returns (only if still broken)
    new = remove_orphan_returns(code)
    if new != code:
        steps.append("remove_orphan_returns")
        code = new

    # 5. Final syntax check
    syntax_err = None
    try:
        ast.parse(code)
        syntax_ok = True
    except SyntaxError as e:
        syntax_ok = False
        syntax_err = f"line {e.lineno}: {e.msg}"

    # Ensure trailing newline
    if not code.endswith("\n"):
        code += "\n"

    return CleanupReport(
        code=code,
        syntax_ok=syntax_ok,
        syntax_error=syntax_err,
        steps_applied=steps,
    )


# ---------------- CLI for quick testing ----------------

if __name__ == "__main__":
    import sys
    src = sys.stdin.read()
    rep = clean_code(src)
    print("=== STEPS:", rep.steps_applied)
    print("=== SYNTAX OK:", rep.syntax_ok, rep.syntax_error or "")
    print("=== CODE ===")
    print(rep.code)
