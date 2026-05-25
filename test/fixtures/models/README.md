# 模型测试产物

## 用途

每个子目录存放一个模型在某任务上的生成结果，用于：

1. 跨模型对比相同 prompt 下的输出差异
2. 后处理器效果对比（before/after）
3. 未来升级模型后的回归测试
4. 展示给用户看"不同模型写同一段代码长什么样"

## 目录结构

```
models/
└── <model-name>/
    ├── t1_fizzbuzz/
    │   ├── output.py         # 模型原始输出
    │   ├── cleaned.py        # 经后处理器清理后的版本
    │   └── test_output.txt   # pytest 结果
    ├── t2_word_count/
    └── ...
```

## 生成方式

运行 `local_llm/scripts/smoke-test.ps1 -Model <模型名>` 自动生成。

## 已有模型存档

| 模型 | 存放路径 | 生成日期 |
|------|----------|----------|
| deepseek-coder:1.3b | ds-coder-1.3b/ | 2026-05-24 |
| qwen2.5-coder:3b | qwen2.5-coder-3b/ | 2026-05-25 |
