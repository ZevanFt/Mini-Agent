# MiniAgent Small-Model Evaluation Report

- Model: `qwen2.5-coder:3b`
- Timestamp: 20260525-005015
- Total runs: 10

## Per-Task Score Comparison

| Task | Baseline | Overall | Functional | Cleanliness | Completeness | Safety | Gen Time |
|------|----------|---------|------------|-------------|--------------|--------|----------|
| t1_fizzbuzz | bare_ollama | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 7.7s |
| t1_fizzbuzz | miniagent_full | 0.52 | 0.20 | 1.00 | 1.00 | 1.00 | 8.01s |
| t2_word_count | bare_ollama | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 15.21s |
| t2_word_count | miniagent_full | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 39.09s |
| t3_json_flatten | bare_ollama | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 15.06s |
| t3_json_flatten | miniagent_full | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 72.4s |
| t4_cli_todo | bare_ollama | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 17.83s |
| t4_cli_todo | miniagent_full | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 60.47s |
| t5_safe_div_class | bare_ollama | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 21.43s |
| t5_safe_div_class | miniagent_full | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 22.54s |

## Aggregated Mean Scores

| Baseline | Mean Overall | Mean Functional | Mean Cleanliness | Mean Gen Time (s) |
|----------|--------------|------------------|-------------------|--------------------|
| bare_ollama | 1.000 | 1.000 | 1.000 | 15.4 |
| miniagent_full | 0.664 | 0.440 | 1.000 | 40.5 |
