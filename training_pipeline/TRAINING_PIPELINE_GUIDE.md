# Training Pipeline Usage Guide

This guide shows how to use the hybrid audio-code linking pipeline to extract training data from screenpipe for fine-tuning a code generation model.

## Overview

The pipeline extracts training pairs by linking:
- **Audio transcriptions** from screenpipe (business context)
- **Code commits** from git (technical implementation)

Using a hybrid approach: Time filter → Keyword matching → Semantic similarity

## Quick Start

### Prerequisites

```bash
# Install required Python packages
pip install GitPython sentence-transformers numpy
```

### Step 1: Extract Training Data

```bash
cd ~/ai/screenpipe
python extract_training_hybrid.py
```

**What it does:**
1. Extracts audio discussions from `~/.screenpipe/db.sqlite`
2. Extracts code commits from git repository
3. Links audio to commits using hybrid algorithm
4. Saves training pairs to `training_data.jsonl`

**Expected output:**
```
[Stage 1] Extracting audio discussions from ~/.screenpipe/db.sqlite
  ✓ Found 234 relevant audio discussions

[Stage 1] Extracting code commits from ~/ai/screenpipe
  ✓ Found 487 relevant code commits

[Stage 3] Loading semantic embedding model...
  ✓ Model loaded (80MB)

[Hybrid Linking] Processing 487 commits...
  Processing commit 10/487...
  Processing commit 20/487...
  ...
  ✓ Created 156 training pairs
  ✓ Average confidence: 0.724

[Output] Saving training data to training_data.jsonl
  ✓ Saved 156 training pairs

[Statistics]
  Total training pairs: 156
  Estimated tokens: 87,432
  Average confidence: 0.724
  Confidence range: 0.602 - 0.891
```

**Time required:** 5-15 minutes (depending on data size)

### Step 2: Validate Training Data

```bash
python validate_training_data.py
```

**What it does:**
1. Validates JSONL format integrity
2. Analyzes confidence distribution
3. Detects potential sensitive data
4. Provides manual review interface (optional)
5. Generates quality report

**Expected output:**
```
Training Data Validation Report
================================================================================

OVERVIEW
--------------------------------------------------------------------------------
Total training pairs: 156
Valid pairs: 156 (100.0%)
Estimated total tokens: 87,432

CONFIDENCE METRICS
--------------------------------------------------------------------------------
Average confidence: 0.724
Min confidence: 0.602
Max confidence: 0.891

Confidence Distribution:
  0.6-0.7:  42 pairs ██████████████ (26.9%)
  0.7-0.8:  78 pairs ████████████████████████████ (50.0%)
  0.8-0.9:  36 pairs ████████████ (23.1%)

SECURITY ANALYSIS
--------------------------------------------------------------------------------
Pairs with potential sensitive data: 0

RECOMMENDATIONS
--------------------------------------------------------------------------------
✓ High confidence scores - good quality linkage
✓ Large dataset - good for training
```

**Manual review (optional):**
- Review 10 random samples interactively
- Mark each as good/bad/skip
- Helps validate linking quality

### Step 3: Train Model

```bash
# Install MLX (Apple Silicon only)
pip install mlx-lm

# Download DeepSeek-Coder-1.3B-Instruct
mlx_lm.convert --hf-path deepseek-ai/deepseek-coder-1.3b-instruct

# Fine-tune with LoRA
mlx_lm.lora \
  --model deepseek-coder-1.3b-instruct \
  --data training_data.jsonl \
  --train \
  --iters 1000 \
  --batch-size 4 \
  --learning-rate 1e-5 \
  --lora-layers 16
```

**Training time:** 6-8 hours on M1 Pro

## Configuration

Edit `CONFIG` in [extract_training_hybrid.py](extract_training_hybrid.py:17) to adjust:

### Paths
```python
"screenpipe_db": Path.home() / ".screenpipe" / "db.sqlite",
"git_repo": Path.home() / "ai" / "screenpipe",
"output_file": Path.home() / "ai" / "screenpipe" / "training_data.jsonl",
```

### Time Window
```python
"time_window_days": 7,      # Look back 7 days before commit
"commit_offset_hours": 1,   # Exclude audio from 1 hour before commit
```

### Filtering
```python
"min_audio_length": 100,    # Minimum transcription length (chars)
"min_code_lines": 5,        # Minimum code change lines
"max_commits": 500,         # Maximum commits to process
```

### Confidence Thresholds
```python
"min_confidence": 0.6,      # Minimum confidence for training pair
"keyword_weight": 0.3,      # Weight for keyword matching
"semantic_weight": 0.7,     # Weight for semantic similarity
```

**Tuning tips:**
- **Too few pairs?** Lower `min_confidence` to 0.5
- **Low quality pairs?** Increase `min_confidence` to 0.7
- **Slow processing?** Reduce `max_commits` to 200
- **More keyword-based?** Increase `keyword_weight` to 0.5

## Output Format

Training data is saved as JSONL (one JSON object per line):

```json
{
  "instruction": "Add pagination to search endpoint",
  "input": "Business Context from team discussions:\n\nWe need to add pagination because users complain search is slow with 1000 results...\n\nTask: Modify screenpipe-server/src/server.rs",
  "output": "    let limit = query.pagination.limit.unwrap_or(20);\n    let offset = query.pagination.offset.unwrap_or(0);\n    ...",
  "metadata": {
    "commit_sha": "abc1234",
    "commit_timestamp": "2025-11-20T14:30:00",
    "audio_timestamp": "2025-11-19T10:15:00",
    "confidence": 0.824,
    "keyword_score": 0.714,
    "semantic_score": 0.872
  }
}
```

## Troubleshooting

### No training pairs created

**Symptom:** `ERROR: No training pairs created (try lowering min_confidence)`

**Causes:**
1. Time window too narrow (audio and commits don't overlap)
2. Min confidence too high
3. No keyword overlap between audio and commits

**Solutions:**
```python
# Increase time window
"time_window_days": 14,  # Look back 2 weeks

# Lower confidence threshold
"min_confidence": 0.5,

# Adjust weights (more keyword-based)
"keyword_weight": 0.5,
"semantic_weight": 0.5,
```

### Low confidence scores

**Symptom:** Average confidence < 0.6

**Causes:**
1. Audio discussions don't relate to code changes
2. Keywords not matching well
3. Semantic embeddings not capturing relationship

**Solutions:**
1. Add more technical keywords to `TECH_KEYWORDS` in [extract_training_hybrid.py](extract_training_hybrid.py:61)
2. Filter audio to only include development-related discussions
3. Increase semantic weight:
```python
"keyword_weight": 0.2,
"semantic_weight": 0.8,
```

### Sensitive data detected

**Symptom:** `⚠ 5 pairs may contain sensitive data - manual review required`

**Action:**
1. Run manual review: `python validate_training_data.py`
2. Review flagged pairs
3. Remove sensitive pairs manually from `training_data.jsonl`
4. Re-validate

### Memory error during training

**Symptom:** `RuntimeError: out of memory`

**Solutions:**
```bash
# Reduce batch size
mlx_lm.lora --batch-size 2

# Use gradient checkpointing (if supported)
mlx_lm.lora --grad-checkpoint

# Close other applications
# Free up RAM before training
```

## Expected Results

### Data Scale (4 months of screenpipe data)
- Audio discussions: 200-500 relevant
- Git commits: 300-800 total
- Training pairs: 100-300 high-confidence
- Total tokens: 50,000-150,000

### Quality Metrics
- Average confidence: 0.65-0.75 (good)
- Confidence > 0.8: 20-30% of pairs (excellent)
- Confidence < 0.6: Should be manually reviewed

### Training Performance
- Training time: 6-8 hours (M1 Pro, 1000 iterations)
- Model size after LoRA: ~1.5 GB
- Inference speed: ~30 tokens/sec (M1 Pro)

## Next Steps

After training:

1. **Test the model:**
```python
from mlx_lm import load, generate

model, tokenizer = load("./lora_fused_model")

prompt = """Instruction: Add user authentication to the API
Input: Business Context: We need to protect our endpoints...
Task: Modify src/api/auth.rs
Output:"""

response = generate(model, tokenizer, prompt, max_tokens=500)
print(response)
```

2. **Evaluate on held-out Jira tickets:**
- Create test set of 10 recent Jira tickets
- Generate code for each
- Compare with actual implementation
- Calculate success rate

3. **Iterate and improve:**
- Add more training data (continue recording)
- Fine-tune confidence thresholds
- Expand keyword list
- Adjust time windows

## Files Created

- [extract_training_hybrid.py](extract_training_hybrid.py) - Main extraction pipeline
- [validate_training_data.py](validate_training_data.py) - Validation and quality checks
- `training_data.jsonl` - Output training data (generated)
- `validation_report.txt` - Quality report (generated)

## Additional Resources

- **Architecture docs:** [TRAINING_DATA_PIPELINE.md](TRAINING_DATA_PIPELINE.md)
- **DeepSeek-Coder:** https://github.com/deepseek-ai/DeepSeek-Coder
- **MLX:** https://github.com/ml-explore/mlx
- **Sentence Transformers:** https://www.sbert.net/

## Support

If you encounter issues:
1. Check configuration in `CONFIG` dict
2. Review troubleshooting section above
3. Run validation to identify specific issues
4. Adjust thresholds and re-run pipeline

---

**Time Investment:**
- Setup: 5 minutes
- Extraction: 10 minutes
- Validation: 5 minutes (+ optional manual review)
- Training: 6-8 hours (overnight)
- **Total active time: ~20 minutes**
