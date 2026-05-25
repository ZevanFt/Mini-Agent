# MiniAgent 实测报告：本地小模型写代码，到底行不行？

> 两天时间，两个模型（1.3B vs 3B），5 个真实编码任务，25+ 轮测评
> 结论诚实：有些行，有些不行，不忽悠

---

## 一、为什么做这件事

本地小模型（≤7B）写代码，社区态度两极分化：

- 一边说"1.3B 也能写代码，真香"
- 另一边说"没有 70B 就是玩具"

我们想用**真实数据**说话。于是搭了一个 MiniAgent 框架，实测 `deepseek-coder:1.3b` 和 `qwen2.5-coder:3b` 在 5 个编码任务上的表现。

---

## 二、5 个测试任务

不是 HumanEval 那种选择题，而是**真正写文件跑测试**：

| # | 任务 | 难度 | 测什么 |
|---|------|------|--------|
| 1 | FizzBuzz | ⭐ | 基础语法 + 边界条件 |
| 2 | 词频统计 | ⭐ | 字符串处理 + dict |
| 3 | JSON 扁平化 | ⭐⭐ | 递归 + 类型判断 |
| 4 | CLI TODO 解析器 | ⭐⭐ | 文件IO + stdout/stderr + 退出码 |
| 5 | 带异常处理的 Calculator | ⭐⭐⭐ | 类设计 + 状态管理 + 异常语义 |

每个任务写一个 **pytest** 测试集，自动化评分。不靠人判断"看起来不错"。

---

## 三、ds-coder:1.3b 的血泪教训

先说坏的。

**裸模型 5 个任务全部失败（0/5）。** 不是"差一点"，是**根本上不了路**。

### 失败模式 1：碎碎念注释（每条输出都有）

```
def fizzbuzz(n: int) -> list[str]:  # type hint, return will be List['Str'] as we are returning string. 1 indexed array for n times input number 'i' is required in the function definition line above it and also below this point where you can define your code
```

prompt 明确写了"不要注释"，但 1.3B **根本无法抑制**写注释的冲动。

### 失败模式 2：逻辑反向

FizzBuzz 中返回「**是** 3 或 5 的倍数」的数字——精确搞反

```python
# 错了！应该是 FizzBuzz 条件时返回 "FizzBuzz"
[f"{x}" if x%3 == 0 or x%5== 0 else "FizzBuzz" ...]
```

### 失败模式 3：缩进错误（最致命）

```python
if b == 0:
    raise ValueError(...)
     else :     # ← 多了一个空格！Python 直接挂
```

### 失败模式 4：不可达代码

```python
def undo(self):
    if not self.history:
        print("No operations to undo")
    else:
        result = self.history.pop()
    return result    # ← 缩进错了，永远执行不到
```

### 失败模式 5：越修越烂

1.3B 的 repair loop 是**负收益**——第 2、3 次修复会引入更多错误。一个简单 FizzBuzz 能写成 50 行的 elif 灾难：

```python
elif (numeral % 3 == 0) and ((not numeral == fizz_buzz):
    result[i] = "Fizz"
elif (numeral % 5 == 0) and ((not numeral == fizz_buzz):
    result[i] = "Buzz"
elif (numeral % 3 == 0) and ((not numeral == fizz_buzz):
    result[i] = "Fizz"
# ... 重复 20 次
```

---

## 四、针对 1.3B 的工程补救

### 办法 1：确定性后处理器（零成本，不用 LLM）

写了一个 Python 脚本来自动修正 1.3B 的常见错误：
- 剥离碎碎念注释
- 修 `else :` 缩进
- 规范化 1/3/5 空格到 4
- 空函数体补 `pass`
- 删不可达 return

**效果：Calculator 从 0/8 → 5/8**

### 办法 2：多采样投票（self-consistency）

跑 3 次，选测试通过最多的那个。

**效果：Calculator 从 0/8 → 7/8**

### 最终 1.3B 成绩

| Baseline | 综合通过率 | Calculator 最难任务 |
|---|---|---|
| 裸模型 | 6.7% | 0% |
| + 好 prompt | 0% ❌ | 0% |
| + 后处理 + repair | **42.5%** | 62.5% |
| + 投票采样 | 40.8% | **87.5%** |

**从 0% 到 87.5%，提升 87.5 个百分点。** 后处理器 + 投票 = 1.3B 能用的关键。

---

## 五、qwen2.5-coder:3b 的降维打击

换模型后，结果完全变了。

**裸模型 5/5 全部通过，100%。**

```python
# Calculator 裸模型输出 - 干净、正确、有类型注解
class Calculator:
    def __init__(self):
        self.history: List[Tuple[str, int, int, int]] = []

    def add(self, a: int, b: int) -> int:
        result = a + b
        self.history.append(('add', a, b, result))
        return result

    def div(self, a: int, b: int) -> float:
        if b == 0:
            raise ValueError('division by zero')  # 精确匹配
        result = a / b
        self.history.append(('div', a, b, result))
        return result

    def undo(self) -> Tuple[str, int, int, int] | None:
        if not self.history:
            return None
        last_operation = self.history.pop()
        return last_operation

    def clear(self) -> None:
        self.history.clear()
```

注意：**没有碎碎念注释、没有语法错误、逻辑完全正确、类型注解到位、异常消息精确匹配。**

18.5 tok/s 的推理速度，平均每个任务 15 秒。

| 模型 | 速度 | 裸模型通过率 | 需要工程救 |
|---|---|---|---|
| ds-coder:1.3b | 47 tok/s | **6.7%** | ✅ 非常需要 |
| qwen2.5-coder:3b | 18.5 tok/s | **100%** | ❌ 完全不需要 |

**从 1.3B 到 3B，模型只大了 2.4 倍，但代码质量提升了 15 倍。**

更关键的是——我们的后处理 + repair 管线在 qwen 身上**反而没用**：

```
qwen bare:        100% ✅
qwen + 后处理:     66% ❌  (被加坏了)
```

---

## 六、结论：三个洞见

### 洞见 1：模型质量 > 工程技巧

> 我们花两天写的后处理器 + repair loop，效果不如从 1.3B 换到 3B。

1.3B 写代码像刚学编程的新手——需要人反复 check。3B 已经像写了 1 年的初级工程师——可以直接用。

对于本地小模型写代码这件事：
- **≤1.3B** → 不行，需要大量工程兜底
- **~3B** → 行，可直接用，性价比最优
- **≥7B** → 更好，但 16GB 内存可能扛不住

### 洞见 2：「更好的 prompt」对小模型是伪命题

我们测试了"更详细的 prompt" vs "极简 prompt"：

- 1.3B 上：更长的 prompt → 更差的代码（模型被 100+ 词搞晕）
- 3B 上：两者无区别（模型都能理解）

**小模型的 prompt 不是越细越好。** 对 ≤3B 模型，极简 prompt（"写代码。只输出代码。"）反而效果最好。

### 洞见 3：自修复存在能力下限

1.3B 的 repair loop 负收益。模型看不懂错误信息，只会随机修改已有代码。

3B 不需要 repair 因为很少出错。

**修复回路对 ≤3B 模型基本是浪费 tokens。** 更好的方案是"多采样投票"——让模型重新生成而不是修复。

---

## 七、所以 MiniAgent 到底有什么用？

**对于 qwen2.5-coder:3b 用户**：
MiniAgent = 轻量 wrapper，负责系统 prompt + 工具调用 + 文件操作 + 权限管理，代码生成本身交给模型，不画蛇添足。

**对于 ds-coder:1.3b / 更低配置用户**：
MiniAgent = 后处理器 + 投票机制 + 模板骨架，用工程手段把不到 30% 的可用率拉到 80%+。

**一句话**：
> 你机器能跑 3B，MiniAgent 就是个好用的壳；
> 你只能跑 1.3B，MiniAgent 能让你也写出能跑的代码。

---

## 八、硬件配置参考

本次测试机型：

- CPU: i5-11300H (4C8T, 3.1GHz)
- 内存: 16GB DDR4
- 显卡: Intel Iris Xe 集显（共享显存）
- 存储: NVMe SSD

**这就是一台普通轻薄本。没有独显。** 16GB 是现在笔记本的标配。

| 模型 | 内存占用 | 推理速度 | 推荐 |
|---|---|---|---|
| ds-coder:1.3b | ~1GB | 47 tok/s | 8GB 内存的老机器 |
| qwen2.5-coder:3b | ~2.5GB | 18.5 tok/s | **16GB 内存的标配本 ✅** |
| qwen2.5-coder:7b | ~5GB | 5-8 tok/s | 32GB 内存 + 独显 |

**3B 模型是 2025~2026 年普通笔记本跑本地代码模型的甜蜜点。**

---

## 九、数据下载

所有测评数据都在 `evaluation/results/` 目录：
- ds-coder 完整 15 runs：`20260524-210040/`
- qwen 对比 10 runs：`20260525-005015/`
- 后处理器代码：`evaluation/runners/code_postprocessor.py`
- 自动评分器：`evaluation/runners/scorer.py`

可复现。可验证。不画饼。

---

*写于 2026-05-25，MiniAgent 项目实战记录*
