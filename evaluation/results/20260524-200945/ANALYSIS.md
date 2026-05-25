# Small Model Evaluation - First Run Analysis

**Date:** 2026-05-24
**Model:** `deepseek-coder:1.3b` (776 MB, Q4 quantized)
**Hardware:** CPU inference, ~50 tok/s on this machine
**Total runs:** 15 (5 tasks × 3 baselines × 1 run)

---

## Headline Numbers

| Baseline | Mean Overall | **Functional Pass Rate** | Mean Gen Time |
|---|---|---|---|
| A. Bare Ollama | 0.425 | **6.7%** (1 of 15 tests on avg) | 23.4 s |
| B. MiniAgent plain (better prompt only) | 0.394 | **0.0%** | 21.0 s |
| C. MiniAgent enhanced (prompt + repair loop + cleanup) | **0.618** | **43.3%** | 65.5 s |

| Baseline | Tasks fully passed (5/5 tests pass) |
|---|---|
| A. Bare | **0 / 5** |
| B. Plain | **0 / 5** |
| C. Enhanced | **2 / 5** + 1 partial |

> Enhanced gives **6.5× higher functional correctness** than bare model, at the cost of **2.8× more time** (due to up to 3 retry rounds).

---

## Per-task results

| Task | Bare | Plain | Enhanced |
|---|---|---|---|
| t1 FizzBuzz (easy) | 0/5 | 0/5 | **5/5** ✅ |
| t2 word_count (easy) | 1.7/5 | 0/5 | **6/6** ✅ |
| t3 flatten (medium) | 0/6 | 0/6 | 1/6 partial |
| t4 todo_cli (medium) | 0/5 | 0/5 | 0/5 |
| t5 calculator (medium-hard) | 0/8 | 0/8 | 0/8 |

---

## What deepseek-coder:1.3b actually fails at

Reviewing every generated file reveals a clear pattern of **5 dominant small-model failure modes**:

### 1. Cannot suppress chatty inline comments (every single output)
The prompt explicitly forbids rambling comments. The 1.3B model **never** obeys this. Example from `t1_fizzbuzz` bare run:
```python
def fizzbuzz(n: int) -> list[str]:  # type hint, return will be List['Str'] as we are returning string.  1 indexed array for n times...
    result = [...] *n # list comprehension to generate the required string for each index i
    return result   # type hint, as we are returning a List['Str']...
```

### 2. Inverted boolean logic
The same FizzBuzz, bare:
```python
[f"{x}" if x%3 == 0 or x%5== 0 else "FizzBuzz" if (x %15 ==0) else ("Fizz")...]
```
It picks `str(x)` when divisible — the **exact opposite** of FizzBuzz.

### 3. Unbalanced parentheses / wrong operator precedence
Plain baseline FizzBuzz:
```python
[f"{i}" if ((not(i % 3 or i%5)) else "FizzBuzz") for i in range(1, n+1)]
#                                ^^^^ syntactically invalid (3 ( vs 2 ))
```

### 4. Inconsistent indentation when mixing `if`/`else` blocks
t5 calculator enhanced output:
```python
def div(self, a, b):
    if b == 0:
        raise ValueError(...)
         else :     # NOTE: extra space → IndentationError
              self.history.append(...)
        return a / b
```
This is the **#1 reason 1.3B fails on class-style tasks**.

### 5. Unreachable code / dead branches
Same calculator:
```python
def undo(self):
    if not self.history:
        print("No operations to undo")    # should return None
    else:
        result = self.history.pop()
     return result                          # wrong indent — never reached in else branch
```

---

## What the MiniAgent enhancements actually helped with

| Enhancement | Tasks helped | Why it worked |
|---|---|---|
| Strict system prompt with 5-item mental checklist | t1, t2 | The "match exact output format" line stops the worst hallucinations |
| Post-cleanup (strip markdown fences, prose lines) | All | Even when model wraps code in ```python, we recover it |
| Quick syntax check before commit | t2 | Catches obvious breakage before pytest |
| Repair loop with test-failure feedback (max 2 rounds) | t2, t3 | t2 went from 0/5 to 6/6 by feeding pytest output back in |

## What did NOT help

1. **Repair loop on t5 (Calculator)** — Tried 3 times, each attempt got *worse* indentation errors. The 1.3B model **cannot self-correct** beyond surface-level fixes.
2. **Plain baseline (B)** — Adding a more careful system prompt without any other mechanism actually *hurt* slightly (0.0% vs 6.7% functional). The 1.3B model gets *more* confused with longer instructions; it does best with very terse prompts. **Important finding**.
3. **Cleanliness score (1.0 everywhere)** — My current regex patterns don't catch deepseek's specific rambling style. **TODO**: extend RAMBLING_PATTERNS to penalize `# type hint, ...` , `# Type Hinting`, etc.

---

## Concrete next steps to lift functional pass rate above 50%

Priority ordered:

1. **Snippet-first prompting** (Phase 8 has SnippetLibrary but it's not wired into bare HTTP calls)
   → Inject a known-good Python class skeleton when task mentions "class", inject a CLI skeleton when task mentions "argv". For t5 specifically this could turn 0/8 into 6/8.

2. **AST-level auto-fix** before sending to repair loop
   → Detect `else :     <indent off>` and auto-correct indentation locally instead of asking the LLM to retry. The model wastes 3× tokens trying.

3. **Comment stripper as post-processing**
   → Strip any `# comment` longer than 40 chars or matching "type hint", "as per requirement", "Self-explanatory" etc. Don't rely on the model obeying the prompt — *enforce* it after the fact.

4. **Few-shot examples in the system prompt**
   → A single example showing "task description → clean Python code" works far better on 1.3B than abstract rules. Add 1-2 worked examples to ENHANCED_SYSTEM_PROMPT.

5. **Multi-sample with majority vote on functional tests**
   → Generate N=3 outputs, pick the one that passes the most tests. Costs 3× time but small-models benefit hugely from sampling diversity at temp=0.3.

6. **Stop using "improve via instruction" — try "improve via deletion"**
   → For 1.3B specifically: generate verbose output, then run a deterministic post-processor that throws away every line that doesn't look like Python.

---

## Bottom line

Real measurement on a real 1.3B model confirms the project's core thesis:

> **A small model alone is unusable for code generation (0/5 tasks fully passed).
> With prompt engineering + repair loop, it becomes useful for easy tasks (2/5 fully passed).
> Hard tasks (class with error handling) still need more work — specifically: snippet-anchored generation and AST-level auto-fix.**

This is exactly the gap MiniAgent's Phase 8 modules (`SnippetLibrary`, `CompletenessChecker`,
`FailurePatternLearner`) were designed to fill — but the evaluation shows they are **not yet wired**
into a path the bare HTTP call could exercise. The next iteration should bridge the gap.
