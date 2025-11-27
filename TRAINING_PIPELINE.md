# Training Pipeline

Train a code generation model using screenpipe data (audio + documents) linked to git commits.

## Location

All pipeline files are in **[training_pipeline/](training_pipeline/)**

## Quick Start

```bash
cd training_pipeline

# Extract training data
python extract_training_hybrid.py

# Validate quality
python validate_training_data.py

# Train model
mlx_lm.lora --model deepseek-coder-1.3b-instruct --data training_data.jsonl --train
```

## Documentation

- **[training_pipeline/README.md](training_pipeline/README.md)** - Main guide (start here)
- **[training_pipeline/CONFIG_GUIDE.md](training_pipeline/CONFIG_GUIDE.md)** - Configuration reference
- **[training_pipeline/TRAINING_PIPELINE_GUIDE.md](training_pipeline/TRAINING_PIPELINE_GUIDE.md)** - Detailed usage
- **[training_pipeline/TRAINING_DATA_PIPELINE.md](training_pipeline/TRAINING_DATA_PIPELINE.md)** - Architecture docs

## Files Structure

```
training_pipeline/
├── README.md                       # Quick start guide
├── extract_training_hybrid.py      # Main extraction script
├── validate_training_data.py       # Validation script
├── pipeline_config.json            # Active configuration
├── pipeline_config.example.json    # Example config
├── CONFIG_GUIDE.md                 # Config reference
├── TRAINING_PIPELINE_GUIDE.md      # Usage guide
├── TRAINING_DATA_PIPELINE.md       # Architecture docs
├── .gitignore                      # Ignore output files
├── training_data.jsonl             # Generated output
└── validation_report.txt           # Generated report
```

## What It Does

1. **Extracts knowledge** from screenpipe (audio) and documents (optional)
2. **Links to commits** using semantic similarity (no time filtering)
3. **Creates training pairs** in JSONL format for fine-tuning
4. **Validates quality** with confidence scores and manual review

## Configuration

Edit **[training_pipeline/pipeline_config.json](training_pipeline/pipeline_config.json)**:

```json
{
  "document_sources": {
    "directories": [
      "~/ai/screenpipe/docs"
    ]
  }
}
```

## Output

Training pairs ready for fine-tuning DeepSeek-Coder:

```json
{
  "instruction": "Add pagination to search endpoint",
  "input": "Business Context: Users complain search returns 1000 results...",
  "output": "let limit = query.pagination.limit.unwrap_or(20);"
}
```

---

**See [training_pipeline/README.md](training_pipeline/README.md) for complete documentation.**
