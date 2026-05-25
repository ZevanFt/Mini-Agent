"""
Code quality scorer for MiniAgent evaluation.

Scores a generated code file across multiple dimensions:
  - functional correctness (pytest pass rate)   [weight 60%]
  - cleanliness (no rambling comments/explanations) [weight 15%]
  - structural completeness (has function/class, no TODO) [weight 15%]
  - safety (no eval/exec/hardcoded secrets)     [weight 10%]

Outputs a JSON result blob.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# -------- Cleanliness checks --------

RAMBLING_PATTERNS = [
    r"#\s*(if needed|whatever makes sense|for now|just|later|TODO|FIXME)",
    r"#\s*(Define your|Name it whatever|in case of)",
    r"#\s*\.\.\.",
    r"```",  # markdown fences inside code
    r"^Here'?s?\s+(is\s+)?(the|a|an|your)",  # explanation text
    r"^I('|\s*a)m\s+",
    r"^Sure[!.]",
    r"^Below\s+is",
    r"^This\s+(code|function|script)\s+",
    r"^Note:",
]

SUSPICIOUS_TOKENS = [
    r"\beval\s*\(",
    r"\bexec\s*\(",
    r"['\"]password['\"]\s*[:=]\s*['\"][^'\"]+['\"]",
    r"['\"]api[_-]?key['\"]\s*[:=]\s*['\"][^'\"]+['\"]",
    r"['\"]secret['\"]\s*[:=]\s*['\"][^'\"]+['\"]",
]


def score_cleanliness(code: str) -> tuple[float, list[str]]:
    """0~1, plus list of issues."""
    issues: list[str] = []
    lines = code.splitlines()
    total = max(1, len(lines))
    rambling_hits = 0
    for line in lines:
        for pat in RAMBLING_PATTERNS:
            if re.search(pat, line, re.IGNORECASE):
                rambling_hits += 1
                issues.append(f"rambling: {line.strip()[:80]}")
                break

    # Penalize markdown fences and explanation lines outside strings
    md_fences = code.count("```")
    if md_fences > 0:
        issues.append(f"contains {md_fences} markdown fence markers")

    # Score: start at 1, subtract per issue
    penalty = min(1.0, rambling_hits / total * 5 + md_fences * 0.3)
    return max(0.0, 1.0 - penalty), issues


def score_safety(code: str) -> tuple[float, list[str]]:
    issues: list[str] = []
    for pat in SUSPICIOUS_TOKENS:
        if re.search(pat, code, re.IGNORECASE):
            issues.append(f"suspicious: {pat}")
    return (1.0 if not issues else max(0.0, 1.0 - 0.3 * len(issues))), issues


def score_completeness(code: str, expects_class: bool = False) -> tuple[float, list[str]]:
    issues: list[str] = []
    has_def_or_class = bool(re.search(r"^\s*(def|class)\s+\w+", code, re.MULTILINE))
    if not has_def_or_class:
        issues.append("no def/class definition found")
    if re.search(r"\b(TODO|FIXME|XXX|pass\s*#.*placeholder)\b", code, re.IGNORECASE):
        issues.append("contains TODO/FIXME or placeholder pass")
    # Unbalanced brackets quick check
    for opener, closer in [("(", ")"), ("[", "]"), ("{", "}")]:
        if code.count(opener) != code.count(closer):
            issues.append(f"unbalanced {opener}{closer}")
    score = 1.0
    score -= 0.5 if not has_def_or_class else 0
    score -= 0.2 * sum(1 for i in issues if "TODO" in i or "FIXME" in i)
    score -= 0.3 * sum(1 for i in issues if "unbalanced" in i)
    return max(0.0, score), issues


# -------- Functional correctness via pytest --------

def run_pytest(workdir: Path, test_file: str) -> tuple[float, dict]:
    """Returns (score 0~1, detail dict)."""
    if not (workdir / test_file).exists():
        return 0.0, {"error": "test file not present"}

    cmd = [sys.executable, "-m", "pytest", "-q", "--tb=short", "-o",
           "junit_family=xunit2", "--junitxml=__pytest__.xml", test_file]
    try:
        r = subprocess.run(
            cmd, cwd=workdir, capture_output=True, text=True, timeout=60,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
        )
    except subprocess.TimeoutExpired:
        return 0.0, {"error": "pytest timeout (60s)"}

    # Parse junit xml for counts
    junit_path = workdir / "__pytest__.xml"
    total = passed = failed = errors = 0
    if junit_path.exists():
        try:
            import xml.etree.ElementTree as ET
            root = ET.parse(junit_path).getroot()
            # Either <testsuites> or single <testsuite>
            suites = root.findall("testsuite") if root.tag == "testsuites" else [root]
            for s in suites:
                total += int(s.attrib.get("tests", 0))
                failed += int(s.attrib.get("failures", 0))
                errors += int(s.attrib.get("errors", 0))
            passed = total - failed - errors
        except Exception as e:
            return 0.0, {"error": f"junit parse: {e}", "stdout": r.stdout[-2000:], "stderr": r.stderr[-2000:]}

    if total == 0:
        return 0.0, {"error": "no tests discovered", "stdout": r.stdout[-2000:], "stderr": r.stderr[-2000:]}

    score = passed / total
    return score, {
        "total": total,
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "stdout_tail": r.stdout[-500:],
    }


# -------- Main --------

def score_one(workdir: Path, target_file: str, test_file: str) -> dict:
    code_path = workdir / target_file
    if not code_path.exists():
        return {
            "overall": 0.0,
            "functional": 0.0,
            "cleanliness": 0.0,
            "completeness": 0.0,
            "safety": 0.0,
            "error": f"target file not generated: {target_file}",
            "issues": [],
        }
    code = code_path.read_text(encoding="utf-8", errors="replace")

    func_score, func_detail = run_pytest(workdir, test_file)
    clean_score, clean_issues = score_cleanliness(code)
    comp_score, comp_issues = score_completeness(code)
    safe_score, safe_issues = score_safety(code)

    overall = (
        func_score * 0.60
        + clean_score * 0.15
        + comp_score * 0.15
        + safe_score * 0.10
    )

    return {
        "overall": round(overall, 4),
        "functional": round(func_score, 4),
        "cleanliness": round(clean_score, 4),
        "completeness": round(comp_score, 4),
        "safety": round(safe_score, 4),
        "functional_detail": func_detail,
        "issues": {
            "cleanliness": clean_issues[:10],
            "completeness": comp_issues,
            "safety": safe_issues,
        },
        "code_length_lines": len(code.splitlines()),
    }


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--workdir", required=True)
    p.add_argument("--target", required=True, help="generated code file name")
    p.add_argument("--test", required=True, help="pytest test file name")
    p.add_argument("--out", default=None, help="output JSON path")
    args = p.parse_args()

    result = score_one(Path(args.workdir), args.target, args.test)
    js = json.dumps(result, indent=2, ensure_ascii=False)
    if args.out:
        Path(args.out).write_text(js, encoding="utf-8")
    print(js)
