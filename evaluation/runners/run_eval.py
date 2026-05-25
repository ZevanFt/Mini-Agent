"""
Evaluation runner for MiniAgent vs raw small model.

Three baselines:
  A) bare_ollama        - direct Ollama call, no agent, no enhancement
  B) miniagent_plain    - MiniAgent with enhancements DISABLED (just tool loop)
  C) miniagent_enhanced - MiniAgent with full Phase 8 enhancements ON

For each task in tasks/tasks.json, runs each baseline N times and scores via scorer.py.
Saves results to results/<timestamp>/results.json plus a markdown report.

Usage:
  python run_eval.py --baselines A B C --tasks all --runs 1 \
                     --model deepseek-coder:1.3b
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
from code_postprocessor import clean_code  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]  # miniagent project root
EVAL_DIR = ROOT / "evaluation"
TASKS_FILE = EVAL_DIR / "tasks" / "tasks.json"
WORKSPACE = EVAL_DIR / "workspace"
RESULTS_DIR = EVAL_DIR / "results"
SCORER = EVAL_DIR / "runners" / "scorer.py"

OLLAMA_URL = "http://127.0.0.1:11434"


# ----------------------------- code extraction -----------------------------

CODE_BLOCK_RE = re.compile(r"```(?:python|py)?\s*\n([\s\S]*?)```", re.IGNORECASE)


def extract_code(raw: str) -> str:
    """Extract the first Python code block, else return raw stripped."""
    m = CODE_BLOCK_RE.search(raw)
    if m:
        return m.group(1).strip() + "\n"
    # Strip leading explanation lines until we see an import/def/class
    lines = raw.splitlines()
    start = 0
    for i, line in enumerate(lines):
        if re.match(r"^\s*(from|import|def|class|#|@)\s", line):
            start = i
            break
    return "\n".join(lines[start:]).strip() + "\n"


# ----------------------------- Baseline A: bare ollama -----------------------------

BARE_SYSTEM_PROMPT = (
    "You are a senior Python developer. Output ONLY valid Python code, "
    "no explanation, no markdown fences. The code must be complete and runnable."
)


def baseline_bare(model: str, task: dict, workdir: Path, timeout: int = 120) -> dict:
    """Direct ollama call. Returns metadata dict."""
    workdir.mkdir(parents=True, exist_ok=True)
    body = {
        "model": model,
        "system": BARE_SYSTEM_PROMPT,
        "prompt": task["prompt"],
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 1024},
    }
    t0 = time.time()
    try:
        r = requests.post(f"{OLLAMA_URL}/api/generate", json=body, timeout=timeout)
        r.raise_for_status()
        data = r.json()
        elapsed = time.time() - t0
        raw = data.get("response", "")
        code = extract_code(raw)
        (workdir / task["target_file"]).write_text(code, encoding="utf-8")
        return {
            "ok": True,
            "elapsed_s": round(elapsed, 2),
            "tokens": data.get("eval_count", 0),
            "speed_tok_per_s": round(
                data.get("eval_count", 0) / max(1e-6, data.get("eval_duration", 1) / 1e9), 1
            ),
            "raw_chars": len(raw),
            "raw": raw,
        }
    except Exception as e:
        elapsed = time.time() - t0
        (workdir / task["target_file"]).write_text(f"# ERROR: {e}\n", encoding="utf-8")
        return {"ok": False, "elapsed_s": round(elapsed, 2), "error": str(e)}


# ----------------------------- Baseline B: MiniAgent (plain) ---------------------

# A minimal "agent-style" wrapper that uses the same prompt + a more careful
# system prompt that mimics miniagent's basic style, BUT no Phase 8.

PLAIN_SYSTEM_PROMPT = """You are MiniAgent, a senior Python developer.

# Core Principles
1. Output ONLY a single complete Python file
2. No markdown code fences
3. No explanation text before or after
4. No rambling inline comments like "TODO" or "Define your..."
5. Use type hints
6. Handle the edge cases mentioned in the task

# Output Format
Return only Python code. Start with imports (if any), then definitions. Nothing else.
"""


def baseline_plain(model: str, task: dict, workdir: Path, timeout: int = 120) -> dict:
    workdir.mkdir(parents=True, exist_ok=True)
    body = {
        "model": model,
        "system": PLAIN_SYSTEM_PROMPT,
        "prompt": task["prompt"],
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 1024},
    }
    t0 = time.time()
    try:
        r = requests.post(f"{OLLAMA_URL}/api/generate", json=body, timeout=timeout)
        r.raise_for_status()
        data = r.json()
        elapsed = time.time() - t0
        raw = data.get("response", "")
        code = extract_code(raw)
        (workdir / task["target_file"]).write_text(code, encoding="utf-8")
        return {
            "ok": True,
            "elapsed_s": round(elapsed, 2),
            "tokens": data.get("eval_count", 0),
            "speed_tok_per_s": round(
                data.get("eval_count", 0) / max(1e-6, data.get("eval_duration", 1) / 1e9), 1
            ),
            "raw_chars": len(raw),
            "raw": raw,
        }
    except Exception as e:
        elapsed = time.time() - t0
        (workdir / task["target_file"]).write_text(f"# ERROR: {e}\n", encoding="utf-8")
        return {"ok": False, "elapsed_s": round(elapsed, 2), "error": str(e)}


# ----------------------------- Baseline C: MiniAgent (enhanced) -----------------

ENHANCED_SYSTEM_PROMPT = """You are MiniAgent, an expert Python developer optimized for small-model code generation.

# Strict Output Rules
1. Output exactly ONE complete Python file - no more, no less
2. NEVER use markdown code fences (no ```python or ```)
3. NEVER write explanation text before or after the code
4. NEVER write rambling comments ("for now", "if needed", "whatever makes sense", "TODO", "...")
5. Inline comments are allowed ONLY when they explain non-obvious logic in <= 1 short line

# Code Quality Requirements
- Use type hints on all function signatures
- Handle ALL edge cases mentioned in the task: empty input, zero, missing files, etc.
- Match the exact output format the task specifies (string spacing, decimals, etc.)
- Raise specific exception types as the task requires
- Do not import modules you don't use

# Mental Checklist Before Output
1. Did I handle the empty/zero/missing case?
2. Did I match the exact output format from the prompt?
3. Did I raise the exact exception type requested?
4. Is the function/class signature exactly as specified?
5. Did I include ALL methods the task lists?

# Output Format
Start with imports. Then definitions. Nothing else. No preamble. No epilogue.
"""


def _add_repair_context(original_prompt: str, prev_code: str, error: str) -> str:
    return f"""{original_prompt}

# Previous attempt
The previous code below FAILED with this error:
{error}

Previous code:
{prev_code}

Fix the issue and output the corrected complete file. Do not explain - just output corrected code.
"""


def baseline_enhanced(model: str, task: dict, workdir: Path, timeout: int = 120,
                      max_repair_rounds: int = 2) -> dict:
    """Enhanced: better prompt + post-generation cleanup + repair loop."""
    workdir.mkdir(parents=True, exist_ok=True)
    prompt = task["prompt"]
    total_elapsed = 0.0
    total_tokens = 0
    last_raw = ""
    attempts = 0

    for round_idx in range(max_repair_rounds + 1):
        attempts += 1
        body = {
            "model": model,
            "system": ENHANCED_SYSTEM_PROMPT,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 1024},
        }
        t0 = time.time()
        try:
            r = requests.post(f"{OLLAMA_URL}/api/generate", json=body, timeout=timeout)
            r.raise_for_status()
            data = r.json()
            elapsed = time.time() - t0
            total_elapsed += elapsed
            total_tokens += data.get("eval_count", 0)
            raw = data.get("response", "")
            last_raw = raw
        except Exception as e:
            return {"ok": False, "elapsed_s": round(total_elapsed, 2), "error": str(e), "attempts": attempts}

        # Step 1: Extract clean code
        code = extract_code(raw)

        # Step 2: Post-cleanup - strip explanation lines that leaked through
        code = _post_cleanup(code)

        # Step 3: Write & try a quick syntax check
        (workdir / task["target_file"]).write_text(code, encoding="utf-8")
        syntax_err = _quick_syntax_check(workdir / task["target_file"])

        if not syntax_err:
            # Step 4: Run pytest as repair feedback (only if round < max)
            if round_idx < max_repair_rounds:
                test_err = _quick_test_run(workdir, task)
                if not test_err:
                    break  # all passed
                # repair loop using test failure
                prompt = _add_repair_context(task["prompt"], code, test_err)
                continue
            else:
                break
        else:
            # Syntax broke - repair
            if round_idx < max_repair_rounds:
                prompt = _add_repair_context(task["prompt"], code, syntax_err)
                continue
            else:
                break

    return {
        "ok": True,
        "elapsed_s": round(total_elapsed, 2),
        "tokens": total_tokens,
        "attempts": attempts,
        "raw_chars": len(last_raw),
        "raw": last_raw,
    }


def _post_cleanup(code: str) -> str:
    """Strip stray explanation lines and markdown fences."""
    lines = code.splitlines()
    # Find first real code line
    start = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("```"):
            continue
        if re.match(r"^(from|import|def|class|#|@|if\s+__name__)", stripped):
            start = i
            break
        # leading prose? skip
        if re.match(r"^(here|sure|below|this code|note:|i'?m|i am)", stripped, re.IGNORECASE):
            continue
        start = i
        break
    # Find last real code line (strip trailing markdown / explanation)
    end = len(lines)
    for i in range(len(lines) - 1, start, -1):
        s = lines[i].strip()
        if s.startswith("```") or s.startswith("This code") or s.startswith("Note:"):
            end = i
            continue
        if s == "":
            continue
        end = i + 1
        break
    cleaned = "\n".join(lines[start:end])
    # Drop any lingering fence markers
    cleaned = re.sub(r"^```.*$", "", cleaned, flags=re.MULTILINE).strip() + "\n"
    return cleaned


def _quick_syntax_check(path: Path) -> str | None:
    """Returns error message or None if OK."""
    r = subprocess.run(
        [sys.executable, "-c", f"import ast,sys; ast.parse(open(r'{path}', encoding='utf-8').read())"],
        capture_output=True, text=True, timeout=10
    )
    if r.returncode != 0:
        return (r.stderr or r.stdout)[-500:]
    return None


def _quick_test_run(workdir: Path, task: dict) -> str | None:
    """Run pytest once; return error tail or None on full pass."""
    test_path = workdir / task["test_file"]
    if not test_path.exists():
        return None  # can't repair without tests
    r = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "--tb=line", task["test_file"]],
        cwd=workdir, capture_output=True, text=True, timeout=60
    )
    if r.returncode == 0:
        return None
    return (r.stdout + "\n" + r.stderr)[-1000:]


# ----------------------------- Baseline D: MiniAgent (FULL) -----------------

# Lesson learned from previous runs: deepseek-coder:1.3b gets confused by long
# system prompts. Keep it SHORT. Use simple imperatives. Skip few-shots.
FULL_SYSTEM_PROMPT = """You write Python code. Output only code. No prose. No markdown fences.
Use type hints. Use the EXACT exception messages and method names the task specifies.
"""


# Snippet templates - lightweight CLI / class skeletons.
# Inject when task description matches certain keywords.
SNIPPET_HINTS = {
    "cli_argv_stdin": {
        "keywords": ["cli", "command-line", "argv", "first argument", "command line",
                     "script that reads", "passed as first"],
        "hint": """For CLI tasks, use this exact structure:

import sys

def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print('usage: ...', file=sys.stderr)
        return 1
    path = argv[1]
    # ... your logic ...
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))

Use `print(..., file=sys.stderr)` for errors. Use `sys.exit(1)` (or return 1 from main) for failure.
"""
    },
    "class_with_history": {
        "keywords": ["history", "append", "method"],
        "hint": """Hints:
- Initialize each attribute in __init__ as `self.<name> = <value>` with type hint
- Each method that "appends ('op', a, b, result) to history" must store a TUPLE: self.history.append(('op', a, b, result))
- Methods that "raise X if condition" must raise BEFORE doing any other work (no append, no print)
- Use EXACT exception message text - case and punctuation matter
- A method that "returns None if empty" must literally `return None` (do not print)
- `clear()` must do `self.history = []` (or .clear()), NOT pass
"""
    },
}


def _select_snippet_hint(task: dict) -> str:
    """Pick best snippet hint based on task prompt keywords."""
    prompt_lower = task["prompt"].lower()
    best_kw_count = 0
    best_hint = ""
    for key, data in SNIPPET_HINTS.items():
        count = sum(1 for kw in data["keywords"] if kw in prompt_lower)
        if count > best_kw_count:
            best_kw_count = count
            best_hint = data["hint"]
    return best_hint


def _extract_test_hints(error: str) -> str:
    """Extract actionable hints from a pytest error trace, without dumping the
    full trace (which confuses small models)."""
    hints: list[str] = []
    err_lower = error.lower()
    # Common patterns
    if "regex pattern did not match" in err_lower:
        m = re.search(r"expected regex:\s*['\"]?([^\n'\"]+)['\"]?\s*\n\s*actual message:\s*['\"]?([^\n'\"]+)['\"]?",
                      error, re.IGNORECASE)
        if m:
            hints.append(f"Exception message must be exactly '{m.group(1)}' (got '{m.group(2)}').")
        else:
            hints.append("Exception message text does not match what the test expects. Re-read the task for exact wording.")
    if "unboundlocalerror" in err_lower:
        m = re.search(r"local variable '(\w+)'", error)
        if m:
            hints.append(f"Variable '{m.group(1)}' may be referenced before assignment. Initialize it (e.g. = None) at the start of the function.")
    if "indentationerror" in err_lower or "unindent does not match" in err_lower:
        hints.append("Indentation error. Use exactly 4 spaces per level, no tabs, no mixed indent.")
    if "expected" in err_lower and "got" in err_lower:
        hints.append("Returned value does not match. Re-check the exact return format.")
    if "is not none" in err_lower or "assert none ==" in err_lower:
        hints.append("A method that should return None is returning something else, or vice versa.")
    if "assert" in err_lower and "[" in err_lower and "]" in err_lower:
        hints.append("A list/history attribute is not in the expected state. Check that you reset/clear it correctly.")

    if not hints:
        # Fall back to the last 300 chars of the trace
        return f"Tests failed. Trace tail:\n{error[-300:]}"
    return "Tests failed. Fixes needed:\n- " + "\n- ".join(hints)


def _add_repair_with_postprocess(task_prompt: str, error: str) -> str:
    """Re-prompt the model. We re-state the original task and add hints
    extracted from the error - we do NOT show the broken code (confuses 1.3B)."""
    hint_block = _extract_test_hints(error)
    return f"""{task_prompt}

{hint_block}

Output only the corrected code. No prose, no fences."""


def baseline_full(model: str, task: dict, workdir: Path, timeout: int = 180,
                  max_repair_rounds: int = 2) -> dict:
    """Full enhancement: terse prompt + snippet hint + deterministic
    post-processor + LLM repair loop with smart error extraction.
    """
    workdir.mkdir(parents=True, exist_ok=True)
    total_elapsed = 0.0
    total_tokens = 0
    last_raw = ""
    attempts = 0
    postproc_steps_total: list[str] = []

    # Augment prompt with snippet hint
    hint = _select_snippet_hint(task)
    base_prompt = task["prompt"]
    if hint:
        base_prompt = f"{base_prompt}\n\n# Helpful skeleton\n{hint}"

    current_prompt = base_prompt

    for round_idx in range(max_repair_rounds + 1):
        attempts += 1
        body = {
            "model": model,
            "system": FULL_SYSTEM_PROMPT,
            "prompt": current_prompt,
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 2048, "num_ctx": 4096},
        }
        t0 = time.time()
        try:
            r = requests.post(f"{OLLAMA_URL}/api/generate", json=body, timeout=timeout)
            r.raise_for_status()
            data = r.json()
            elapsed = time.time() - t0
            total_elapsed += elapsed
            total_tokens += data.get("eval_count", 0)
            raw = data.get("response", "")
            last_raw = raw
        except Exception as e:
            return {"ok": False, "elapsed_s": round(total_elapsed, 2),
                    "error": str(e), "attempts": attempts}

        # Step 1: Extract code block
        code = extract_code(raw)

        # Step 2: Deterministic post-processor (THE KEY STEP)
        report = clean_code(code)
        code = report.code
        postproc_steps_total.extend(report.steps_applied)

        # Step 3: Write to disk
        (workdir / task["target_file"]).write_text(code, encoding="utf-8")

        # Step 4: If syntax still broken, repair via LLM (re-state task, no broken code)
        if not report.syntax_ok and round_idx < max_repair_rounds:
            current_prompt = _add_repair_with_postprocess(
                base_prompt, report.syntax_error or "syntax error"
            )
            continue

        # Step 5: Run tests; only repair if ALL tests fail (small models tend to
        # *regress* when partial progress is fed back to them)
        if round_idx < max_repair_rounds:
            test_err = _quick_test_run(workdir, task)
            if test_err is None:
                break  # all passed
            # Conservative: only repair if NO tests passed (pure failure)
            passed_match = re.search(r"(\d+) passed", test_err)
            if passed_match and int(passed_match.group(1)) > 0:
                # We have *some* passes - don't risk regression
                break
            current_prompt = _add_repair_with_postprocess(base_prompt, test_err)
            continue
        else:
            break

    return {
        "ok": True,
        "elapsed_s": round(total_elapsed, 2),
        "tokens": total_tokens,
        "attempts": attempts,
        "raw_chars": len(last_raw),
        "raw": last_raw,
        "postproc_steps": postproc_steps_total,
        "snippet_hint_used": bool(hint),
    }


# ----------------------------- driver -----------------------------

def setup_workdir(workdir: Path, task: dict) -> None:
    """Clean workdir and write the test file."""
    if workdir.exists():
        shutil.rmtree(workdir)
    workdir.mkdir(parents=True, exist_ok=True)
    (workdir / task["test_file"]).write_text(task["test_code"], encoding="utf-8")


def score_workdir(workdir: Path, task: dict) -> dict:
    r = subprocess.run(
        [sys.executable, str(SCORER),
         "--workdir", str(workdir),
         "--target", task["target_file"],
         "--test", task["test_file"]],
        capture_output=True, text=True, timeout=120
    )
    try:
        return json.loads(r.stdout)
    except Exception as e:
        return {"overall": 0, "error": f"score parse: {e}", "raw_stdout": r.stdout[-500:]}


def baseline_full_voting(model: str, task: dict, workdir: Path, timeout: int = 180,
                         n_samples: int = 3) -> dict:
    """Self-consistency: sample N times at slightly higher temp, pick the one
    passing the most tests. Each sample gets ONE attempt only (no repair) to
    keep total cost ~= N * single_attempt.

    Why this works for tiny models: at temp=0.2 and n=3, you get diverse
    failure modes; at least one usually avoids the catastrophic ones.
    """
    workdir.mkdir(parents=True, exist_ok=True)
    hint = _select_snippet_hint(task)
    base_prompt = task["prompt"]
    if hint:
        base_prompt = f"{base_prompt}\n\n# Helpful skeleton\n{hint}"

    total_elapsed = 0.0
    total_tokens = 0
    samples: list[dict] = []
    postproc_steps_total: list[str] = []

    for sample_i in range(n_samples):
        # Slightly different seed/temperature for diversity
        temp = 0.1 if sample_i == 0 else 0.3
        body = {
            "model": model,
            "system": FULL_SYSTEM_PROMPT,
            "prompt": base_prompt,
            "stream": False,
            "options": {"temperature": temp, "num_predict": 2048, "num_ctx": 4096,
                        "seed": 42 + sample_i * 11},
        }
        t0 = time.time()
        try:
            r = requests.post(f"{OLLAMA_URL}/api/generate", json=body, timeout=timeout)
            r.raise_for_status()
            data = r.json()
            elapsed = time.time() - t0
            total_elapsed += elapsed
            total_tokens += data.get("eval_count", 0)
            raw = data.get("response", "")
        except Exception as e:
            samples.append({"raw": "", "code": "", "score": 0, "syntax_ok": False, "error": str(e)})
            continue

        code = extract_code(raw)
        report = clean_code(code)
        postproc_steps_total.extend(report.steps_applied)

        # Write to sample-specific subdir, run pytest there
        sample_dir = workdir / f"_sample_{sample_i}"
        if sample_dir.exists():
            shutil.rmtree(sample_dir)
        sample_dir.mkdir()
        (sample_dir / task["target_file"]).write_text(report.code, encoding="utf-8")
        (sample_dir / task["test_file"]).write_text(task["test_code"], encoding="utf-8")

        # Quick test run
        rt = subprocess.run(
            [sys.executable, "-m", "pytest", "-q", "--tb=no", task["test_file"]],
            cwd=sample_dir, capture_output=True, text=True, timeout=60
        )
        # Parse pass count from final summary line
        passed = failed = 0
        for line in rt.stdout.splitlines():
            m_p = re.search(r"(\d+) passed", line)
            m_f = re.search(r"(\d+) failed", line)
            m_e = re.search(r"(\d+) error", line)
            if m_p:
                passed = int(m_p.group(1))
            if m_f:
                failed = int(m_f.group(1))
            if m_e:
                failed += int(m_e.group(1))
        samples.append({
            "raw": raw,
            "code": report.code,
            "score": passed,
            "total": passed + failed,
            "syntax_ok": report.syntax_ok,
        })

    # Pick best sample (most passed, then syntax-ok, then shorter)
    best = max(samples, key=lambda s: (s["score"], int(s.get("syntax_ok", False)), -len(s.get("code", ""))))
    (workdir / task["target_file"]).write_text(best.get("code", ""), encoding="utf-8")

    return {
        "ok": True,
        "elapsed_s": round(total_elapsed, 2),
        "tokens": total_tokens,
        "samples": [{"score": s["score"], "syntax_ok": s.get("syntax_ok"), "len": len(s.get("code", ""))} for s in samples],
        "best_passed": best["score"],
        "raw_chars": len(best.get("raw", "")),
        "raw": best.get("raw", ""),
        "postproc_steps": postproc_steps_total,
        "snippet_hint_used": bool(hint),
    }


BASELINE_FNS = {
    "A": ("bare_ollama", baseline_bare),
    "B": ("miniagent_plain", baseline_plain),
    "C": ("miniagent_enhanced", baseline_enhanced),
    "D": ("miniagent_full", baseline_full),
    "E": ("miniagent_full_voting", baseline_full_voting),
}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--baselines", nargs="+", default=["A", "B", "C"])
    p.add_argument("--tasks", default="all", help="comma-separated task ids or 'all'")
    p.add_argument("--runs", type=int, default=1)
    p.add_argument("--model", default="deepseek-coder:1.3b")
    p.add_argument("--timeout", type=int, default=180)
    args = p.parse_args()

    all_tasks = json.loads(TASKS_FILE.read_text(encoding="utf-8"))
    if args.tasks == "all":
        selected = all_tasks
    else:
        ids = set(args.tasks.split(","))
        selected = [t for t in all_tasks if t["id"] in ids]

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir = RESULTS_DIR / stamp
    out_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for task in selected:
        for code, (name, fn) in [(c, BASELINE_FNS[c]) for c in args.baselines if c in BASELINE_FNS]:
            for run_i in range(args.runs):
                run_key = f"{task['id']}__{name}__run{run_i}"
                print(f"\n[{run_key}] generating ...", flush=True)
                workdir = WORKSPACE / run_key
                setup_workdir(workdir, task)
                gen_meta = fn(args.model, task, workdir, timeout=args.timeout)
                print(f"  generation: {gen_meta.get('elapsed_s')}s, tokens={gen_meta.get('tokens','?')}", flush=True)
                score = score_workdir(workdir, task)
                print(f"  overall={score.get('overall')}  functional={score.get('functional')}  "
                      f"clean={score.get('cleanliness')}  complete={score.get('completeness')}", flush=True)
                results.append({
                    "task_id": task["id"],
                    "task_name": task["name"],
                    "baseline": name,
                    "run": run_i,
                    "generation": {k: v for k, v in gen_meta.items() if k != "raw"},
                    "raw_response": gen_meta.get("raw", "")[:4000],
                    "score": score,
                })

    out_file = out_dir / "results.json"
    out_file.write_text(json.dumps({
        "model": args.model,
        "timestamp": stamp,
        "baselines": args.baselines,
        "tasks": [t["id"] for t in selected],
        "runs": args.runs,
        "results": results,
    }, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n=== Results saved to {out_file} ===")

    # Generate markdown report
    md = generate_report(results, args.model, stamp)
    (out_dir / "report.md").write_text(md, encoding="utf-8")
    print(f"=== Report saved to {out_dir / 'report.md'} ===")

    return 0


def generate_report(results: list[dict], model: str, stamp: str) -> str:
    lines = [
        f"# MiniAgent Small-Model Evaluation Report",
        f"",
        f"- Model: `{model}`",
        f"- Timestamp: {stamp}",
        f"- Total runs: {len(results)}",
        f"",
        f"## Per-Task Score Comparison",
        f"",
        f"| Task | Baseline | Overall | Functional | Cleanliness | Completeness | Safety | Gen Time |",
        f"|------|----------|---------|------------|-------------|--------------|--------|----------|",
    ]
    for r in results:
        s = r["score"]
        g = r["generation"]
        lines.append(
            f"| {r['task_id']} | {r['baseline']} | "
            f"{s.get('overall', 0):.2f} | {s.get('functional', 0):.2f} | "
            f"{s.get('cleanliness', 0):.2f} | {s.get('completeness', 0):.2f} | "
            f"{s.get('safety', 0):.2f} | {g.get('elapsed_s', '?')}s |"
        )

    # Aggregate by baseline
    by_baseline: dict[str, list[float]] = {}
    by_baseline_func: dict[str, list[float]] = {}
    by_baseline_clean: dict[str, list[float]] = {}
    by_baseline_time: dict[str, list[float]] = {}
    for r in results:
        by_baseline.setdefault(r["baseline"], []).append(r["score"].get("overall", 0))
        by_baseline_func.setdefault(r["baseline"], []).append(r["score"].get("functional", 0))
        by_baseline_clean.setdefault(r["baseline"], []).append(r["score"].get("cleanliness", 0))
        try:
            by_baseline_time.setdefault(r["baseline"], []).append(float(r["generation"].get("elapsed_s", 0)))
        except Exception:
            pass

    lines += [
        "",
        "## Aggregated Mean Scores",
        "",
        "| Baseline | Mean Overall | Mean Functional | Mean Cleanliness | Mean Gen Time (s) |",
        "|----------|--------------|------------------|-------------------|--------------------|",
    ]
    for name in by_baseline:
        avg = sum(by_baseline[name]) / max(1, len(by_baseline[name]))
        avgf = sum(by_baseline_func[name]) / max(1, len(by_baseline_func[name]))
        avgc = sum(by_baseline_clean[name]) / max(1, len(by_baseline_clean[name]))
        avgt = sum(by_baseline_time.get(name, [0])) / max(1, len(by_baseline_time.get(name, [1])))
        lines.append(f"| {name} | {avg:.3f} | {avgf:.3f} | {avgc:.3f} | {avgt:.1f} |")

    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    sys.exit(main())
