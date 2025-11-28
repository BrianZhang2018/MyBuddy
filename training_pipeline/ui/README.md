# UI Testing Tools

Test your fine-tuned DeepSeek-Coder model with these tools.

## Quick Start

```bash
# Install dependencies
pip install gradio mlx-lm

# Run web UI
python ui_simple.py

# Open http://localhost:7860 in browser
```

## Files

- **ui_simple.py** - Main web UI (recommended)
- **ui_test.py** - Advanced UI with comparison mode (slower startup)
- **test_model.py** - CLI testing script
- **WORKFLOW.md** - Architecture and workflow diagrams

## Usage

### Web UI (ui_simple.py)

Interactive Gradio interface:
- Toggle base model vs fine-tuned adapters
- Adjust max tokens and temperature
- See results in real-time
- Copy generated code

### CLI Testing (test_model.py)

Automated testing with predefined prompts:
- Tests training examples
- Tests new scenarios
- Shows overfitting behavior
- Outputs to console

## Model Info

- **Base:** DeepSeek-Coder-1.3B-Instruct
- **Training:** 5 pairs (severe overfitting)
- **Adapters:** 2.5M params (0.186%)
- **Training Loss:** 1.380 → 0.016

⚠️ Current model only works for training examples!
