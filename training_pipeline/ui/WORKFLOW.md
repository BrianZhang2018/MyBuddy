# UI Testing Workflow

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TRAINING PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐            │
│  │  Screenpipe  │    │   Git Repo   │    │  Documents   │            │
│  │  Database    │───▶│   Commits    │◀───│  .md, .yml   │            │
│  │  (OCR/Audio) │    │   (Code)     │    │              │            │
│  └──────────────┘    └──────────────┘    └──────────────┘            │
│         │                    │                    │                    │
│         └────────────────────┴────────────────────┘                    │
│                              │                                         │
│                              ▼                                         │
│                  ┌───────────────────────┐                            │
│                  │ extract_training_     │                            │
│                  │    hybrid.py          │                            │
│                  │ (Semantic Matching)   │                            │
│                  └───────────────────────┘                            │
│                              │                                         │
│                              ▼                                         │
│                  ┌───────────────────────┐                            │
│                  │  training_data.jsonl  │                            │
│                  │  (5 pairs, prompt/    │                            │
│                  │   completion format)  │                            │
│                  └───────────────────────┘                            │
│                              │                                         │
│                              ▼                                         │
│                  ┌───────────────────────┐                            │
│                  │   train_model.py      │                            │
│                  │   (MLX + LoRA)        │                            │
│                  └───────────────────────┘                            │
│                              │                                         │
│                              ▼                                         │
│                  ┌───────────────────────┐                            │
│                  │  adapters/            │                            │
│                  │  adapters.safetensors │                            │
│                  │  (2.5M params)        │                            │
│                  └───────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         UI TESTING LAYER                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    GRADIO WEB UI (ui_simple.py)                 │  │
│  │                   http://localhost:7860                         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                               │                                        │
│       ┌───────────────────────┼───────────────────────┐               │
│       │                       │                       │               │
│       ▼                       ▼                       ▼               │
│  ┌─────────┐           ┌─────────┐           ┌─────────┐            │
│  │ User    │           │ Input   │           │ Config  │            │
│  │ Prompt  │           │ Textbox │           │ Sliders │            │
│  │         │           │ (10     │           │ • Use   │            │
│  │         │           │  lines) │           │   Adapter│           │
│  └─────────┘           └─────────┘           │ • Temp  │            │
│       │                       │               │ • Tokens│            │
│       └───────────────────────┼───────────────┴─────────┘            │
│                               │                                        │
│                               ▼                                        │
│                   ┌────────────────────────┐                          │
│                   │  Click "Generate"      │                          │
│                   └────────────────────────┘                          │
│                               │                                        │
│                               ▼                                        │
│                   ┌────────────────────────┐                          │
│                   │  subprocess.run()      │                          │
│                   │  mlx_lm.generate       │                          │
│                   └────────────────────────┘                          │
│                               │                                        │
│           ┌───────────────────┴───────────────────┐                   │
│           │                                       │                   │
│           ▼                                       ▼                   │
│  ┌─────────────────┐                   ┌─────────────────┐           │
│  │  Base Model     │                   │  Fine-Tuned     │           │
│  │  DeepSeek-1.3B  │                   │  + Adapters     │           │
│  │  (Original)     │                   │  (Trained)      │           │
│  └─────────────────┘                   └─────────────────┘           │
│           │                                       │                   │
│           └───────────────────┬───────────────────┘                   │
│                               │                                        │
│                               ▼                                        │
│                   ┌────────────────────────┐                          │
│                   │  Generated Code        │                          │
│                   │  (Displayed in UI)     │                          │
│                   └────────────────────────┘                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Workflow Steps

### 1. **Start UI**
```bash
cd ui/
python ui_simple.py
```
Opens browser at http://localhost:7860

### 2. **User Interaction**
```
User writes prompt → Adjusts settings → Clicks "Generate"
        │                   │                    │
        │                   ▼                    │
        │            ┌─────────────┐            │
        │            │ max_tokens  │            │
        │            │ temperature │            │
        │            │ use_adapters│            │
        │            └─────────────┘            │
        └──────────────────┬────────────────────┘
                           │
                           ▼
```

### 3. **Model Invocation**
```
subprocess.run([
    "mlx_lm.generate",
    "--model", "deepseek-ai/deepseek-coder-1.3b-instruct",
    "--adapter-path", "../output/adapters",  # if enabled
    "--prompt", user_prompt,
    "--max-tokens", max_tokens,
    "--temp", temperature
])
```

### 4. **Model Processing**
```
Step 1: Load Model (2.6GB)        [~5s]
Step 2: Apply Adapters (50MB)    [~1s]  (if enabled)
Step 3: Tokenize Prompt           [<1s]
Step 4: Generate Tokens           [~10s for 300 tokens]
Step 5: Decode to Text            [<1s]
        │
        └──▶ Return generated code
```

### 5. **Display Results**
```
┌─────────────────────────────────────────┐
│  Generated Output                       │
├─────────────────────────────────────────┤
│                                         │
│  <iframe                                │
│    width="600"                          │
│    height="338"                         │
│    src="https://youtube.com/..."        │
│  />                                     │
│                                         │
│  [Copy Button]                          │
└─────────────────────────────────────────┘
```

## File Organization

```
training_pipeline/
├── extract_training_hybrid.py      # Data extraction
├── train_model.py                  # Model training
├── validate_training_data.py       # Data validation
├── pipeline_config.json            # Configuration
├── output/
│   ├── data/
│   │   ├── train.jsonl            # Training data
│   │   └── valid.jsonl            # Validation data
│   ├── adapters/
│   │   └── adapters.safetensors   # LoRA weights
│   └── training_data.jsonl        # Original format
└── ui/                             # ← UI Testing (NEW)
    ├── ui_simple.py               # Main Gradio UI
    ├── ui_test.py                 # Advanced UI (slower)
    ├── test_model.py              # CLI testing script
    └── WORKFLOW.md                # This file
```

## Testing Workflow

### Option 1: Web UI (Recommended)
```bash
cd ui/
python ui_simple.py
# Open http://localhost:7860
```

**Pros:**
- Interactive web interface
- Toggle adapters on/off
- Adjust parameters in real-time
- Copy generated code easily

### Option 2: CLI Testing
```bash
cd ui/
python test_model.py
```

**Pros:**
- Fast, no browser needed
- Tests multiple prompts automatically
- Side-by-side comparison output

## Performance Metrics

```
┌─────────────────────────────────────────────────────┐
│                  GENERATION SPEED                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  First Generation (cold start):                    │
│  ┌────────────────────────────────┐                │
│  │ Load Model:      ~5s           │                │
│  │ Apply Adapters:  ~1s           │                │
│  │ Generate:        ~10s (300tok) │                │
│  │ Total:           ~16s          │                │
│  └────────────────────────────────┘                │
│                                                     │
│  Subsequent Generations:                           │
│  ┌────────────────────────────────┐                │
│  │ Model cached:    0s            │                │
│  │ Generate:        ~10s (300tok) │                │
│  │ Total:           ~10s          │                │
│  └────────────────────────────────┘                │
│                                                     │
│  Generation Rate: ~30-45 tokens/sec                │
│  Peak Memory:     ~3-7 GB                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Comparison: Base vs Fine-Tuned

```
┌──────────────────┬──────────────────┬──────────────────┐
│   Prompt Type    │   Base Model     │  Fine-Tuned     │
├──────────────────┼──────────────────┼──────────────────┤
│ Training Example │   Generic code   │  Exact match ✓  │
│ (Video fix)      │   Hallucinations │  Memorized      │
├──────────────────┼──────────────────┼──────────────────┤
│ New Scenario     │   Generic code   │  Fails/Random   │
│ (Dark mode)      │   Plausible      │  Overfitted ✗   │
├──────────────────┼──────────────────┼──────────────────┤
│ Overall Quality  │   Consistent     │  Inconsistent   │
└──────────────────┴──────────────────┴──────────────────┘

Conclusion: 5 training pairs → severe overfitting
Need: 50-200+ diverse pairs for real utility
```

## Next Steps

1. **Generate more training data:**
   ```bash
   cd ..
   # Edit pipeline_config_more_data.json
   # Lower confidence: 0.4
   # Add docs directories
   python extract_training_hybrid.py
   ```

2. **Re-train with larger dataset:**
   ```bash
   python train_model.py
   ```

3. **Test improved model:**
   ```bash
   cd ui/
   python ui_simple.py
   ```
