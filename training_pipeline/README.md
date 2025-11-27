# Training Data Pipeline

Extract training data from screenpipe (audio + documents) and link to git commits using semantic similarity for fine-tuning code generation models.

## Quick Start

```bash
cd training_pipeline

# 1. Configure (optional - defaults work)
cp pipeline_config.example.json pipeline_config.json
# Edit pipeline_config.json to add document directories

# 2. Extract training data
python extract_training_hybrid.py

# 3. Validate quality
python validate_training_data.py

# 4. Train model
mlx_lm.lora --model deepseek-coder-1.3b-instruct --data training_data.jsonl --train
```

## Files

### Scripts
- **[extract_training_hybrid.py](extract_training_hybrid.py)** - Main pipeline (extract + link data)
- **[validate_training_data.py](validate_training_data.py)** - Quality validation

### Configuration
- **[pipeline_config.json](pipeline_config.json)** - Active configuration (edit this)
- **[pipeline_config.example.json](pipeline_config.example.json)** - Example with comments

### Documentation
- **[README.md](README.md)** - This file (quick start)
- **[CONFIG_GUIDE.md](CONFIG_GUIDE.md)** - Configuration reference
- **[TRAINING_PIPELINE_GUIDE.md](TRAINING_PIPELINE_GUIDE.md)** - Usage guide
- **[TRAINING_DATA_PIPELINE.md](TRAINING_DATA_PIPELINE.md)** - Architecture docs

### Output (generated)
- `training_data.jsonl` - Training pairs (created by extract script)
- `validation_report.txt` - Quality report (created by validate script)

## Features

✅ **No time filtering** - Matches any knowledge to any code
✅ **Semantic similarity** - Pure embedding-based matching
✅ **Audio + Documents** - Supports both sources
✅ **Incremental** - Add docs over time
✅ **Configurable** - JSON config file

## Architecture

```
Audio (screenpipe DB)
    +
Documents (.md, .txt)
    ↓
Semantic Similarity
    ↓
Git Commits
    ↓
Training Pairs (JSONL)
```

## Example Output

```json
{
  "instruction": "Add pagination to search endpoint",
  "input": "Business Context from team discussions:\n\nWe need pagination because users complain search returns 1000 results...\n\nTask: Modify screenpipe-server/src/server.rs",
  "output": "let limit = query.pagination.limit.unwrap_or(20);\nlet offset = query.pagination.offset.unwrap_or(0);",
  "metadata": {
    "commit_sha": "abc1234",
    "confidence": 0.824,
    "knowledge_type": "audio"
  }
}
```

## Configuration

Edit **[pipeline_config.json](pipeline_config.json)**:

```json
{
  "paths": {
    "screenpipe_db": "~/.screenpipe/db.sqlite",
    "git_repo": "~/ai/screenpipe",
    "output_file": "~/ai/screenpipe/training_pipeline/training_data.jsonl"
  },
  "document_sources": {
    "directories": [
      "~/ai/screenpipe/docs"
    ]
  }
}
```

See **[CONFIG_GUIDE.md](CONFIG_GUIDE.md)** for all options.

## Workflow

### 1. Audio Only (Minimal)
```bash
# Default config (empty doc_dirs)
python extract_training_hybrid.py
# Output: 150 pairs from audio
```

### 2. Add Documentation
```bash
# Edit pipeline_config.json
{
  "document_sources": {
    "directories": ["~/ai/screenpipe/docs"]
  }
}

python extract_training_hybrid.py
# Output: 200 pairs (150 audio + 50 docs)
```

### 3. Validate
```bash
python validate_training_data.py
# Manual review of 10 samples
# Quality report generated
```

### 4. Train
```bash
mlx_lm.lora \
  --model deepseek-coder-1.3b-instruct \
  --data training_data.jsonl \
  --train
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No training pairs | Lower `min_confidence` to 0.5 in config |
| Low quality pairs | Increase `min_confidence` to 0.7 |
| Slow processing | Reduce `max_commits` to 200 |
| No documents found | Check `doc_dirs` paths in config |

## Requirements

```bash
pip install GitPython sentence-transformers numpy
```

Auto-installs on first run.

## Support

- **Configuration**: [CONFIG_GUIDE.md](CONFIG_GUIDE.md)
- **Usage**: [TRAINING_PIPELINE_GUIDE.md](TRAINING_PIPELINE_GUIDE.md)
- **Architecture**: [TRAINING_DATA_PIPELINE.md](TRAINING_DATA_PIPELINE.md)

---

**Time to run:** ~15 minutes active, 6-8 hours training (overnight)
