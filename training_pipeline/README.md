# Screenpipe Training Pipeline Guide

> **Last Updated:** 2025-11-28
> **Current Version:** 2.0 - Semantic-only matching with multi-file support

---

## Overview

This pipeline extracts training data from screenpipe to fine-tune a code generation model (DeepSeek-Coder). It links **screen captures + audio + documents** with **git commits** to create training pairs that teach the model both business context and technical implementation.

### Key Features

- **Multi-source knowledge:** OCR text, audio transcriptions, documentation
- **Semantic matching:** Uses sentence-transformers for accurate linking
- **Multi-file commits:** Creates separate training pairs for each file modified
- **Quality validation:** Built-in validation and sensitive data detection
- **MLX training:** Optimized for Apple Silicon with LoRA

---

## Quick Start

### Prerequisites

```bash
# Install Python dependencies
pip install GitPython sentence-transformers numpy mlx-lm gradio

# Verify screenpipe database exists
ls -lh ~/.screenpipe/db.sqlite
```

### Step 1: Extract Training Data

```bash
cd ~/ai/screenpipe/training_pipeline
python extract_training_hybrid.py
```

**What it does:**
1. Extracts OCR text, audio, and documents
2. Extracts code commits from git
3. Semantically matches knowledge to commits
4. Creates training pairs (one per file modified)
5. Saves to `output/training_data.jsonl`

**Expected output:**
```
[Stage 1] Extracting OCR knowledge from ~/.screenpipe/db.sqlite
  ✓ Found 10000 OCR text entries

[Stage 1] Extracting code commits from ~/ai/screenpipe
  ✓ Found 166 relevant code commits

[Semantic Linking] Matching 166 commits with 10000 knowledge sources...
  Processing commit 10/166...
  Processing commit 50/166...
  Processing commit 100/166...

  ✓ Created 5 training pairs
  ✓ Average confidence: 0.630

[Output] Saving training data to output/training_data.jsonl
  ✓ Saved 12 training entries from 5 training pairs
  ✓ Average 2.4 entries per pair (multi-file commits)
```

**Time:** ~5-10 minutes (depending on data size)

### Step 2: Validate Data Quality

```bash
python validate_training_data.py
```

**What it validates:**
- JSONL format integrity
- Confidence score distribution
- Sensitive data detection (API keys, passwords)
- Field completeness
- Optional manual review

**Output:** `output/validation_report.txt`

### Step 3: Train Model

```bash
python train_model.py
```

**What it does:**
1. Checks data quality (warns if <50 pairs)
2. Converts data to MLX format (prompt/completion)
3. Fine-tunes DeepSeek-Coder-1.3B with LoRA
4. Saves adapters to `output/adapters/`

**Training time:** ~5-10 minutes for 100 iterations

### Step 4: Test Model

```bash
cd ui/
python ui_simple.py
# Open http://localhost:7860
```

**Features:**
- Toggle base vs fine-tuned model
- Adjust temperature and max tokens
- Compare outputs
- Copy generated code

---

## Architecture

### Data Flow

```
┌────────────────────────────────────────────────────────┐
│ INPUT SOURCES                                          │
├────────────────────────────────────────────────────────┤
│  • Screenpipe Database (~/.screenpipe/db.sqlite)       │
│    - OCR text (screen captures)                        │
│    - Audio transcriptions                              │
│  • Git Repository (~/ai/screenpipe)                    │
│    - Code commits and diffs                            │
│  • Documentation (.md, .yml files)                     │
└──────────────────┬─────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│ STAGE 1: Knowledge Extraction                          │
├────────────────────────────────────────────────────────┤
│  extract_ocr_knowledge()                               │
│  ├─ Query: JOIN ocr_text + frames                      │
│  ├─ Filter: LENGTH(text) > 100                         │
│  └─ Extract: text, timestamp, app_name, window_name    │
│                                                         │
│  extract_audio_knowledge()                             │
│  ├─ Query: audio_transcriptions table                  │
│  ├─ Filter: LENGTH(transcription) > 100                │
│  └─ Extract: transcription, timestamp                  │
│                                                         │
│  extract_document_knowledge()                          │
│  ├─ Scan: .github/workflows/, docs/                    │
│  ├─ Filter: .md, .yml, .txt files                      │
│  └─ Extract: content, file_path                        │
│                                                         │
│  extract_code_commits()                                │
│  ├─ Query: git log with diffs                          │
│  ├─ Filter: Non-merge commits, code files only         │
│  └─ Extract: message, timestamp, files_changed, diffs  │
└──────────────────┬─────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│ STAGE 2: Semantic Matching                             │
├────────────────────────────────────────────────────────┤
│  SemanticMatcher (sentence-transformers)               │
│  ├─ Model: all-MiniLM-L6-v2 (80MB)                     │
│  ├─ Encode: commits → 384-dim vectors                  │
│  ├─ Encode: knowledge → 384-dim vectors                │
│  ├─ Match: cosine_similarity(commit, knowledge)        │
│  ├─ Top-K: Keep best 3 matches per commit              │
│  └─ Filter: confidence >= min_confidence (0.6)         │
└──────────────────┬─────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│ STAGE 3: Training Pair Generation                      │
├────────────────────────────────────────────────────────┤
│  to_jsonl_entries() - ONE PAIR PER FILE                │
│  ├─ For each file in commit.files_changed:             │
│  │   ├─ instruction: commit message                    │
│  │   ├─ input: knowledge context + "Modify {file}"     │
│  │   ├─ output: code added to THIS file only           │
│  │   └─ metadata: confidence, timestamps, file_path    │
│  └─ Result: N files → N training pairs                 │
└──────────────────┬─────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│ OUTPUT: training_data.jsonl                            │
├────────────────────────────────────────────────────────┤
│  Format: {"instruction", "input", "output", "metadata"}│
│  Location: output/training_data.jsonl                  │
│  MLX Format: output/data/train.jsonl, valid.jsonl      │
└────────────────────────────────────────────────────────┘
```

### Algorithm Changes (v1 → v2)

**V1 (Hybrid - DEPRECATED):**
```
Time Filter (7 days) → Keyword Match → Semantic Similarity
```
- ❌ Time filter too restrictive for documents
- ❌ Keyword matching adds complexity
- ❌ Multiple stages slow down processing

**V2 (Semantic-Only - CURRENT):**
```
Semantic Matching ONLY (sentence-transformers)
```
- ✅ No time restrictions (works with historical docs)
- ✅ Simple, accurate matching
- ✅ Faster processing
- ✅ Better for domain knowledge extraction

---

## Configuration

### pipeline_config.json

```json
{
  "paths": {
    "screenpipe_db": "~/.screenpipe/db.sqlite",
    "git_repo": "~/ai/screenpipe",
    "output_file": "~/ai/screenpipe/training_pipeline/output/training_data.jsonl"
  },

  "document_sources": {
    "directories": [
      "~/ai/screenpipe/.github/workflows",
      "~/ai/screenpipe/docs"
    ],
    "extensions": [".md", ".txt", ".rst", ".yml", ".yaml"]
  },

  "filtering": {
    "min_knowledge_length": 100,
    "min_code_lines": 5,
    "max_commits": 500,
    "top_k_matches": 3
  },

  "confidence": {
    "min_confidence": 0.6
  },

  "code_extensions": [".rs", ".py", ".ts", ".tsx", ".js", ".jsx"]
}
```

### Tuning Guidelines

**Too few training pairs (<50)?**
- Lower `min_confidence` to 0.4-0.5
- Add more `document_sources` directories
- Increase `max_commits` to 1000
- Wait for more screenpipe data

**Low quality pairs?**
- Increase `min_confidence` to 0.7
- Increase `min_knowledge_length` to 200
- Review and filter sources manually

**Slow processing?**
- Reduce `max_commits` to 200
- Reduce OCR entries in extraction query
- Use smaller embedding model

---

## Training Data Format

### Structure

```json
{
  "instruction": "release-app make onboarding stream properly screenshots",
  "input": "Screen Context from screenpipe - screenpipe:\n\nscreenpipescreenpipeWatch video on YouTubeError 153Video player configuration error\n\nTask: Modify screenpipe-app-tauri/components/onboarding/introduction.tsx",
  "output": "      <iframe\n        width=\"600\"\n        height=\"338\"\n        className=\"mt-2 rounded-md\"\n        src=\"https://www.youtube.com/embed/2963sr3IPHY\"\n        title=\"screenpipe introduction\"\n        frameBorder=\"0\"\n        allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\"\n        allowFullScreen\n      ></iframe>",
  "metadata": {
    "commit_sha": "8b8c4b3",
    "commit_timestamp": "2025-03-04T11:16:22",
    "knowledge_type": "ocr",
    "confidence": 0.646,
    "file_path": "screenpipe-app-tauri/components/onboarding/introduction.tsx",
    "ocr_timestamp": "2025-11-25T18:46:33.179060+00:00",
    "app_name": "screenpipe",
    "window_name": "screenpipe"
  }
}
```

### Field Descriptions

| Field | Description | Example |
|-------|-------------|---------|
| `instruction` | Commit message (what to build) | "Add pagination to search" |
| `input` | Context + file to modify | Screen/audio context + file path |
| `output` | Code added to specific file | TypeScript/Rust code |
| `metadata.file_path` | **NEW** Specific file being modified | `src/api/search.ts` |
| `metadata.confidence` | Semantic similarity score (0-1) | 0.646 |
| `metadata.knowledge_type` | Source type | "ocr", "audio", "document" |

### Multi-File Support (v2.0)

If a commit modifies 3 files, we create **3 separate training pairs**:

```
Commit: "Add authentication middleware"
Files: middleware.ts, types.ts, utils.ts

→ Pair 1: instruction + "Modify middleware.ts" → [middleware.ts code]
→ Pair 2: instruction + "Modify types.ts" → [types.ts code]
→ Pair 3: instruction + "Modify utils.ts" → [utils.ts code]
```

This ensures:
- ✅ Clean, focused training examples
- ✅ Model learns file-specific patterns
- ✅ 2-3x more training data from same commits

---

## Model Training

### Training Script (train_model.py)

```bash
python train_model.py
```

**Configuration:**
```python
CONFIG = {
    "model": "deepseek-ai/deepseek-coder-1.3b-instruct",
    "data": "~/ai/screenpipe/training_pipeline/output/data",
    "adapter_path": "~/ai/screenpipe/training_pipeline/output/adapters",
    "iters": 100,
    "batch_size": 1,
    "learning_rate": 1e-5,
    "num_layers": 8  # LoRA layers to fine-tune
}
```

**MLX Command:**
```bash
mlx_lm.lora \
  --model deepseek-ai/deepseek-coder-1.3b-instruct \
  --data output/data \
  --adapter-path output/adapters \
  --train \
  --iters 100 \
  --batch-size 1 \
  --learning-rate 1e-05 \
  --num-layers 8
```

**Training Metrics:**
```
Trainable parameters: 0.186% (2.5M / 1346M)
Peak memory: 6.8 GB
Training speed: ~635 tokens/sec
Time: ~6 minutes for 100 iterations
```

### Training Performance

| Dataset Size | Iterations | Training Time | Expected Quality |
|--------------|------------|---------------|------------------|
| 5 pairs | 100 | ~5 min | ❌ Severe overfitting |
| 50 pairs | 500 | ~30 min | ⚠️ Moderate overfitting |
| 100 pairs | 1000 | ~1 hour | ✅ Good generalization |
| 200+ pairs | 1000 | ~2 hours | ✅ Excellent |

---

## Testing & UI

### Web UI (ui_simple.py)

```bash
cd ui/
python ui_simple.py
# Open http://localhost:7860
```

**Features:**
- Single generation mode
- Toggle adapters on/off
- Adjust temperature (0.0-1.5)
- Adjust max tokens (50-1000)
- Example prompts from training data
- Copy generated code

**Performance:**
- Cold start: ~10s (model loading)
- Subsequent: ~10s (cached)
- Generation rate: ~30-45 tokens/sec

### CLI Testing (test_model.py)

```bash
cd ui/
python test_model.py
```

Automatically tests:
- Training examples (should work well)
- New scenarios (shows overfitting)
- Side-by-side comparison

---

## Troubleshooting

### No Training Pairs Created

**Symptom:** `✓ Created 0 training pairs`

**Causes:**
1. Confidence threshold too high
2. No OCR/audio data in database
3. No matching commits

**Solutions:**
```json
{
  "confidence": {
    "min_confidence": 0.4  // Lower from 0.6
  }
}
```

### Low Quality Pairs

**Symptom:** Average confidence < 0.6

**Causes:**
- OCR noise / random screen captures
- Commits don't relate to screen content
- Too much time between capture and commit

**Solutions:**
1. Filter OCR by app_name (only code editors)
2. Add document sources for stable knowledge
3. Manual review and filtering

### Model Not Learning

**Symptom:** Generated code is random/nonsensical

**Causes:**
- Too few training pairs (<50)
- Severe overfitting (loss < 0.05)
- Mixed/corrupted training data

**Solutions:**
1. Generate 100+ training pairs
2. Reduce iterations (prevent overfitting)
3. Validate data quality
4. Re-run extraction with better config

### MLX Training Fails

**Error:** `ValueError: Training set not found or empty`

**Cause:** MLX expects directory with `train.jsonl` and `valid.jsonl`

**Fix:**
```bash
mkdir -p output/data
cp output/training_data.jsonl output/data/train.jsonl
cp output/training_data.jsonl output/data/valid.jsonl
```

---

## Expected Results

### Data Scale (with 4 months of screenpipe)

| Metric | Typical Range |
|--------|---------------|
| OCR entries | 10,000-100,000 |
| Audio transcriptions | 0-1,000 |
| Code commits | 100-500 |
| Training pairs | 5-50 |
| Training entries (multi-file) | 10-150 |
| Total tokens | 10,000-100,000 |

### Quality Metrics

```
Confidence Distribution:
  0.9-1.0: Excellent (rare, <5%)
  0.8-0.9: Very good (10-20%)
  0.7-0.8: Good (30-40%)
  0.6-0.7: Acceptable (40-50%)
  <0.6:    Skip (filtered out)

Average: 0.65-0.75 (good quality)
```

---

## File Structure

```
training_pipeline/
├── extract_training_hybrid.py     # Main extraction script
├── train_model.py                 # MLX training wrapper
├── validate_training_data.py      # Data validation
├── pipeline_config.json           # Configuration
├── PIPELINE_GUIDE.md             # This file
├── output/                        # Generated files
│   ├── training_data.jsonl       # Original format
│   ├── validation_report.txt     # Quality report
│   ├── data/                     # MLX format
│   │   ├── train.jsonl
│   │   └── valid.jsonl
│   └── adapters/                 # LoRA weights
│       ├── adapters.safetensors
│       └── adapter_config.json
└── ui/                            # Testing tools
    ├── ui_simple.py              # Main web UI
    ├── ui_test.py                # Advanced UI (slower)
    ├── test_model.py             # CLI testing
    ├── WORKFLOW.md               # UI workflow diagrams
    └── README.md                 # UI documentation
```

---

## Next Steps

1. **Collect more data** - Keep screenpipe running to gather more OCR/audio
2. **Add document sources** - Include .github/workflows, docs, README files
3. **Lower confidence threshold** - Try 0.4-0.5 for more pairs
4. **Enable audio recording** - Capture team discussions for business context
5. **Iterate** - Re-run extraction monthly as data accumulates

---

## Resources

- **DeepSeek-Coder:** https://github.com/deepseek-ai/DeepSeek-Coder
- **MLX:** https://github.com/ml-explore/mlx
- **Sentence Transformers:** https://www.sbert.net/
- **Gradio:** https://www.gradio.app/

---

**Version History:**
- v2.0 (2025-11-28): Semantic-only matching, multi-file support, UI tools
- v1.0 (2025-11-26): Initial hybrid pipeline with time/keyword filtering
