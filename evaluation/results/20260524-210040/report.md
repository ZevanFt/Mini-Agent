# MiniAgent Small-Model Evaluation Report

- Model: `deepseek-coder:1.3b`
- Timestamp: 20260524-210040
- Total runs: 25

## Per-Task Score Comparison

| Task | Baseline | Overall | Functional | Cleanliness | Completeness | Safety | Gen Time |
|------|----------|---------|------------|-------------|--------------|--------|----------|
| t1_fizzbuzz | bare_ollama | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 9.57s |
| t1_fizzbuzz | miniagent_plain | 0.64 | 0.40 | 1.00 | 1.00 | 1.00 | 10.22s |
| t1_fizzbuzz | miniagent_enhanced | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 171.02s |
| t1_fizzbuzz | miniagent_full | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 6.76s |
| t1_fizzbuzz | miniagent_full_voting | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 23.35s |
| t2_word_count | bare_ollama | 0.70 | 0.50 | 1.00 | 1.00 | 1.00 | 10.1s |
| t2_word_count | miniagent_plain | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 9.12s |
| t2_word_count | miniagent_enhanced | 0.60 | 0.33 | 1.00 | 1.00 | 1.00 | 49.14s |
| t2_word_count | miniagent_full | 0.60 | 0.33 | 1.00 | 1.00 | 1.00 | 28.33s |
| t2_word_count | miniagent_full_voting | 0.50 | 0.17 | 1.00 | 1.00 | 1.00 | 45.98s |
| t3_json_flatten | bare_ollama | 0.35 | 0.00 | 1.00 | 0.70 | 1.00 | 13.0s |
| t3_json_flatten | miniagent_plain | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 25.17s |
| t3_json_flatten | miniagent_enhanced | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 126.19s |
| t3_json_flatten | miniagent_full | 0.50 | 0.17 | 1.00 | 1.00 | 1.00 | 20.82s |
| t3_json_flatten | miniagent_full_voting | 0.35 | 0.00 | 1.00 | 0.70 | 1.00 | 81.77s |
| t4_cli_todo | bare_ollama | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 41.61s |
| t4_cli_todo | miniagent_plain | 0.37 | 0.00 | 1.00 | 0.80 | 1.00 | 41.01s |
| t4_cli_todo | miniagent_enhanced | 0.35 | 0.00 | 1.00 | 0.70 | 1.00 | 142.91s |
| t4_cli_todo | miniagent_full | 0.35 | 0.00 | 1.00 | 0.70 | 1.00 | 164.79s |
| t4_cli_todo | miniagent_full_voting | 0.31 | 0.00 | 1.00 | 0.40 | 1.00 | 129.77s |
| t5_safe_div_class | bare_ollama | 0.35 | 0.00 | 1.00 | 0.70 | 1.00 | 45.58s |
| t5_safe_div_class | miniagent_plain | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 48.39s |
| t5_safe_div_class | miniagent_enhanced | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 199.45s |
| t5_safe_div_class | miniagent_full | 0.78 | 0.62 | 1.00 | 1.00 | 1.00 | 142.79s |
| t5_safe_div_class | miniagent_full_voting | 0.93 | 0.88 | 1.00 | 1.00 | 1.00 | 150.49s |

## Aggregated Mean Scores

| Baseline | Mean Overall | Mean Functional | Mean Cleanliness | Mean Gen Time (s) |
|----------|--------------|------------------|-------------------|--------------------|
| bare_ollama | 0.562 | 0.300 | 1.000 | 24.0 |
| miniagent_plain | 0.562 | 0.280 | 1.000 | 26.8 |
| miniagent_enhanced | 0.431 | 0.067 | 1.000 | 137.7 |
| miniagent_full | 0.646 | 0.425 | 1.000 | 72.7 |
| miniagent_full_voting | 0.618 | 0.408 | 1.000 | 86.3 |
