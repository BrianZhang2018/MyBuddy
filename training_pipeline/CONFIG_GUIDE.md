# Pipeline Configuration Guide

The training pipeline uses [pipeline_config.json](pipeline_config.json) for all settings.

## Quick Start

The pipeline works with **just audio** by default:

```json
{
  "document_sources": {
    "directories": []
  }
}
```

## Adding Documentation Sources

Edit [pipeline_config.json](pipeline_config.json) and add directories:

```json
{
  "document_sources": {
    "directories": [
      "~/ai/screenpipe/docs",
      "~/ai/screenpipe/wiki"
    ]
  }
}
```

**The pipeline automatically:**
- Finds all `.md`, `.txt`, `.rst` files
- Chunks long documents (2000 chars each)
- Matches relevant sections to commits
- No need to specify individual files

## Configuration Options

### Paths
```json
"paths": {
  "screenpipe_db": "~/.screenpipe/db.sqlite",
  "git_repo": "~/ai/screenpipe",
  "output_file": "~/ai/screenpipe/training_data.jsonl"
}
```

### Document Sources
```json
"document_sources": {
  "directories": [
    "~/ai/screenpipe/docs",        // Project documentation
    "~/company/wiki",               // Internal wiki
    "~/notes/architecture"          // Personal notes
  ],
  "extensions": [".md", ".txt", ".rst"]
}
```

**Tips:**
- Start with empty `[]` (audio only)
- Add directories incrementally
- Re-run pipeline as you add docs
- Supports `~` for home directory

### Filtering
```json
"filtering": {
  "min_knowledge_length": 100,    // Skip short audio/docs
  "min_code_lines": 5,            // Skip trivial commits
  "max_commits": 500,             // Limit commits processed
  "top_k_matches": 3              // Matches per commit
}
```

**Tuning:**
- **Too few pairs?** Lower `min_code_lines` to 3
- **Too many pairs?** Increase `top_k_matches` to 5
- **Slow?** Reduce `max_commits` to 200

### Confidence Threshold
```json
"confidence": {
  "min_confidence": 0.6
}
```

**Recommended values:**
- `0.5` - More pairs, some weak matches
- `0.6` - **Default** - Good balance
- `0.7` - Fewer pairs, high quality only

### Code Extensions
```json
"code_extensions": [".rs", ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".java"]
```

Add/remove based on your project languages.

## Example Configurations

### Minimal (Audio Only)
```json
{
  "paths": {
    "screenpipe_db": "~/.screenpipe/db.sqlite",
    "git_repo": "~/ai/screenpipe",
    "output_file": "~/ai/screenpipe/training_data.jsonl"
  },
  "document_sources": {
    "directories": [],
    "extensions": [".md", ".txt", ".rst"]
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

### With Documentation
```json
{
  "paths": {
    "screenpipe_db": "~/.screenpipe/db.sqlite",
    "git_repo": "~/ai/screenpipe",
    "output_file": "~/ai/screenpipe/training_data.jsonl"
  },
  "document_sources": {
    "directories": [
      "~/ai/screenpipe/docs",
      "~/ai/screenpipe/wiki"
    ],
    "extensions": [".md", ".txt", ".rst"]
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

### High Quality (Strict)
```json
{
  "paths": {
    "screenpipe_db": "~/.screenpipe/db.sqlite",
    "git_repo": "~/ai/screenpipe",
    "output_file": "~/ai/screenpipe/training_data.jsonl"
  },
  "document_sources": {
    "directories": ["~/ai/screenpipe/docs"],
    "extensions": [".md"]
  },
  "filtering": {
    "min_knowledge_length": 200,
    "min_code_lines": 10,
    "max_commits": 300,
    "top_k_matches": 1
  },
  "confidence": {
    "min_confidence": 0.7
  },
  "code_extensions": [".rs", ".py", ".ts"]
}
```

## Incremental Workflow

```bash
# Week 1: Start with audio only
{
  "document_sources": { "directories": [] }
}
python extract_training_hybrid.py
# Output: 150 pairs from audio

# Week 2: Add project docs
{
  "document_sources": {
    "directories": ["~/ai/screenpipe/docs"]
  }
}
python extract_training_hybrid.py
# Output: 200 pairs (150 audio + 50 docs)

# Week 3: Add wiki
{
  "document_sources": {
    "directories": [
      "~/ai/screenpipe/docs",
      "~/company/wiki"
    ]
  }
}
python extract_training_hybrid.py
# Output: 280 pairs (150 audio + 80 docs + 50 wiki)
```

Each run creates **fresh training data** with current config.

## Troubleshooting

### No training pairs created
```json
{
  "confidence": { "min_confidence": 0.5 },
  "filtering": { "min_code_lines": 3 }
}
```

### Too many low-quality pairs
```json
{
  "confidence": { "min_confidence": 0.7 },
  "filtering": { "top_k_matches": 1 }
}
```

### Slow processing
```json
{
  "filtering": { "max_commits": 200 }
}
```

## Files

- [pipeline_config.json](pipeline_config.json) - **Your active config** (edit this)
- [pipeline_config.example.json](pipeline_config.example.json) - Example with comments
- [CONFIG_GUIDE.md](CONFIG_GUIDE.md) - This guide

## Next Steps

1. Copy example: `cp pipeline_config.example.json pipeline_config.json`
2. Edit `pipeline_config.json` with your directories
3. Run: `python extract_training_hybrid.py`
4. Validate: `python validate_training_data.py`
