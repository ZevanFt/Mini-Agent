# MiniAgent Small-Model Evaluation Report

- Model: `deepseek-coder:1.3b`
- Timestamp: 20260524-200945
- Total runs: 15

## Per-Task Score Comparison

| Task | Baseline | Overall | Functional | Cleanliness | Completeness | Safety | Gen Time |
|------|----------|---------|------------|-------------|--------------|--------|----------|
| t1_fizzbuzz | bare_ollama | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 8.05s |
| t1_fizzbuzz | miniagent_plain | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 8.82s |
| t1_fizzbuzz | miniagent_enhanced | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 6.58s |
| t2_word_count | bare_ollama | 0.60 | 0.33 | 1.00 | 1.00 | 1.00 | 14.83s |
| t2_word_count | miniagent_plain | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 12.4s |
| t2_word_count | miniagent_enhanced | 0.95 | 1.00 | 1.00 | 0.70 | 1.00 | 11.33s |
| t3_json_flatten | bare_ollama | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 34.46s |
| t3_json_flatten | miniagent_plain | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 29.71s |
| t3_json_flatten | miniagent_enhanced | 0.46 | 0.17 | 1.00 | 0.70 | 1.00 | 79.99s |
| t4_cli_todo | bare_ollama | 0.33 | 0.00 | 1.00 | 0.50 | 1.00 | 37.17s |
| t4_cli_todo | miniagent_plain | 0.37 | 0.00 | 1.00 | 0.80 | 1.00 | 26.83s |
| t4_cli_todo | miniagent_enhanced | 0.28 | 0.00 | 1.00 | 0.20 | 1.00 | 75.3s |
| t5_safe_div_class | bare_ollama | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 22.47s |
| t5_safe_div_class | miniagent_plain | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 27.26s |
| t5_safe_div_class | miniagent_enhanced | 0.40 | 0.00 | 1.00 | 1.00 | 1.00 | 154.34s |

## Aggregated Mean Scores

| Baseline | Mean Overall | Mean Functional | Mean Cleanliness | Mean Gen Time (s) |
|----------|--------------|------------------|-------------------|--------------------|
| bare_ollama | 0.425 | 0.067 | 1.000 | 23.4 |
| miniagent_plain | 0.394 | 0.000 | 1.000 | 21.0 |
| miniagent_enhanced | 0.618 | 0.433 | 1.000 | 65.5 |
