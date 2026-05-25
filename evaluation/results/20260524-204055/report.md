# MiniAgent Small-Model Evaluation Report

- Model: `deepseek-coder:1.3b`
- Timestamp: 20260524-204055
- Total runs: 5

## Per-Task Score Comparison

| Task | Baseline | Overall | Functional | Cleanliness | Completeness | Safety | Gen Time |
|------|----------|---------|------------|-------------|--------------|--------|----------|
| t1_fizzbuzz | miniagent_full | 0.35 | 0.00 | 1.00 | 0.70 | 1.00 | 181.69s |
| t2_word_count | miniagent_full | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 160.16s |
| t3_json_flatten | miniagent_full | 0.31 | 0.00 | 0.91 | 0.50 | 1.00 | 126.3s |
| t4_cli_todo | miniagent_full | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 209.2s |
| t5_safe_div_class | miniagent_full | 0.62 | 0.38 | 1.00 | 1.00 | 1.00 | 232.04s |

## Aggregated Mean Scores

| Baseline | Mean Overall | Mean Functional | Mean Cleanliness | Mean Gen Time (s) |
|----------|--------------|------------------|-------------------|--------------------|
| miniagent_full | 0.418 | 0.075 | 0.981 | 181.9 |
