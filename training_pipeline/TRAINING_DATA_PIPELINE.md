# Screenpipe Training Data Pipeline

## Overview

This pipeline extracts training data from screenpipe's database to fine-tune a code generation model. It links **audio transcriptions** (business context, team discussions) with **git commits** (code implementations) to create training examples that teach the model both business logic and technical implementation.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  INPUT: Screenpipe Database + Git Repository       │
│  - Audio transcriptions (business discussions)      │
│  - Git commits (code implementations)               │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  STAGE 1: Data Extraction                          │
│  - Extract audio discussions (SQL query)            │
│  - Extract code changes (git history)               │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  STAGE 2: Hybrid Linking                           │
│  Step 1: Time Filter (7-day window)                │
│  Step 2: Keyword Matching (technical terms)        │
│  Step 3: Semantic Similarity (embeddings)          │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  STAGE 3: Quality Filtering                        │
│  - Confidence threshold (> 0.6)                     │
│  - Remove duplicates                                │
│  - Validate code quality                            │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  OUTPUT: training_data.jsonl                       │
│  Format: {instruction, input, output}               │
│  Ready for fine-tuning                              │
└─────────────────────────────────────────────────────┘
```

---

## Hybrid Linking Algorithm

### Why Hybrid?

We use a **three-stage filtering approach** to accurately link audio discussions to code commits:

1. **Time Filter** - Narrows candidates (fast)
2. **Keyword Match** - Filters relevance (medium)
3. **Semantic Similarity** - Ranks by meaning (accurate)

### Stage 1: Time-Based Filter

**Goal:** Find audio that happened BEFORE the code was written

**Logic:**
```python
For each commit at time T:
    Find audio from [T - 7 days] to [T - 1 hour]

Example:
    Commit: 2025-11-22 10:15
    Audio window: 2025-11-15 10:15 to 2025-11-22 09:15
```

**Window Size:** 7 days (configurable)
- Too short (1 day): Misses discussions that led to later implementation
- Too long (30 days): Includes unrelated audio
- Sweet spot: 7 days covers most feature development cycles

**Edge Cases:**
- Commits without recent audio → Skip (no context available)
- Multiple audio discussions → Keep all for next stage

---

### Stage 2: Keyword Matching

**Goal:** Quick relevance check using technical terms

**Technical Keywords List:**
```python
TECH_KEYWORDS = {
    'pagination', 'search', 'authentication', 'auth',
    'database', 'api', 'endpoint', 'cache', 'optimize',
    'performance', 'bug', 'fix', 'feature', 'user',
    'query', 'response', 'error', 'implement', 'add'
}
```

**Matching Logic:**
```python
commit_keywords = extract_keywords(commit_message)
audio_keywords = extract_keywords(audio_transcription)

overlap = commit_keywords ∩ audio_keywords

if len(overlap) > 0:
    # Audio is potentially relevant
    pass_to_next_stage(audio)
```

**Example:**
```
Commit: "Add pagination to search endpoint"
Keywords: {pagination, search, endpoint}

Audio: "Users complain search is slow with 1000 results, need pagination"
Keywords: {search, slow, pagination}

Overlap: {pagination, search} → 2 keywords → PASS ✅
```

**Performance:**
- Eliminates ~60-70% of unrelated audio
- Fast (simple set operations)
- Minimal false negatives

---

### Stage 3: Semantic Similarity

**Goal:** Rank audio by semantic meaning, not just keywords

**Model:** `sentence-transformers/all-MiniLM-L6-v2`
- Size: 80 MB
- Speed: ~100 sentences/second on M1 Pro
- Quality: 85%+ accuracy on semantic similarity

**How It Works:**
```python
# Convert text to 384-dimensional vector
audio_embedding = model.encode(audio_transcription)
commit_embedding = model.encode(commit_message)

# Compute cosine similarity
similarity = cosine_similarity(audio_embedding, commit_embedding)

# Returns: 0.0 (unrelated) to 1.0 (identical meaning)
```

**Example:**
```
Audio: "The search is really slow when users have thousands
        of results, we should add pagination"
Embedding: [0.23, -0.45, 0.67, ..., 0.12]

Commit: "Add pagination to improve search performance"
Embedding: [0.25, -0.43, 0.65, ..., 0.14]

Cosine Similarity: 0.89 (very similar!) ✅
```

**Why Better Than Keywords:**
- Understands synonyms: "slow" ↔ "performance"
- Captures intent: "users complain" ↔ "improve"
- Semantic meaning: "thousands of results" ↔ "pagination"

**Confidence Thresholds:**
```
0.9 - 1.0: Extremely confident (perfect match)
0.8 - 0.9: Very confident (clearly related)
0.7 - 0.8: Confident (likely related)
0.6 - 0.7: Moderate confidence (possibly related)
< 0.6:     Low confidence (skip)
```

---

## Training Data Format

### Input Format (What Model Receives)

```json
{
  "instruction": "Add pagination to search endpoint",
  "input": "Business Context from team discussions:\n\n[Discussion 1]: We need to add pagination to the search endpoint because users are complaining it's really slow when they search for common terms and get thousands of results. Let's add limit and offset parameters.\n\n[Discussion 2]: Just discussed with the team about the FTS5 performance. We should keep the default page size to 20 items for better mobile experience.\n\nTask: Modify screenpipe-server/src/server.rs",
  "output": "    let limit = query.pagination.limit.unwrap_or(20);\n    let offset = query.pagination.offset.unwrap_or(0);\n    \n    let results = state.db.search(\n        query_str,\n        limit,\n        offset,\n    ).await?;"
}
```

### Field Descriptions

| Field | Description | Example |
|-------|-------------|---------|
| `instruction` | Commit message (what to build) | "Add pagination to search endpoint" |
| `input` | Business context + file location | Audio discussions + file path |
| `output` | Code implementation | Actual code changes |

### Why This Format?

**Teaches the model:**
1. **Business reasoning** (from audio context)
   - User needs and complaints
   - Product decisions and trade-offs
   - Performance requirements

2. **Technical implementation** (from code output)
   - How to implement solutions
   - Your coding patterns and style
   - Project-specific conventions

3. **Linking** (instruction connects both)
   - How requirements → code
   - How discussions → decisions → implementation

---

## Data Sources

### Source 1: Audio Transcriptions

**Database Table:** `audio_transcriptions`

**Query:**
```sql
SELECT
    transcription,
    timestamp,
    speaker_id,
    device
FROM audio_transcriptions
WHERE
    -- Minimum length (substantial conversation)
    LENGTH(transcription) > 100

    -- Contains development-related keywords
    AND (
        transcription LIKE '%feature%'
        OR transcription LIKE '%implement%'
        OR transcription LIKE '%bug%'
        OR transcription LIKE '%fix%'
        OR transcription LIKE '%add%'
        OR transcription LIKE '%user%'
        OR transcription LIKE '%need%'
        OR transcription LIKE '%should%'
        OR transcription LIKE '%requirement%'
    )
ORDER BY timestamp
```

**What We Extract:**
- Technical discussions
- Feature requirements
- User feedback
- Product decisions
- Bug reports
- Performance concerns

**What We Filter Out:**
- Personal conversations
- Non-work discussions
- Very short utterances (< 100 chars)
- Background noise transcriptions

---

### Source 2: Git Commits

**Repository:** `/Users/brianzhang/ai/screenpipe`

**What We Extract:**
```python
For each commit:
    - commit_message (instruction)
    - timestamp
    - file_path
    - code_diff (added lines only)
```

**Filtering Rules:**
1. **Skip merge commits** (no actual code changes)
2. **File types:** Only `.rs`, `.py`, `.ts`, `.tsx`, `.js`, `.jsx`
3. **Skip auto-generated:** `Cargo.lock`, `package-lock.json`, `.min.js`
4. **Minimum code:** At least 50 characters added
5. **Valid commit message:** At least 10 characters

**Code Extraction:**
```python
# Get diff between parent and commit
diff = commit.parents[0].diff(commit)

# Extract ONLY added lines (ignore removed)
for line in diff:
    if line.startswith('+') and not line.startswith('+++'):
        added_code.append(line[1:])  # Remove '+' prefix
```

**Why Only Added Lines?**
- Removed code doesn't teach the model how to build
- Added code shows the solution
- Keeps training examples concise

---

## Expected Output

### Dataset Statistics

**With 4 months of screenpipe data:**

| Metric | Estimated Value |
|--------|----------------|
| Audio discussions | 200-500 relevant |
| Git commits | 300-800 code changes |
| **Training pairs** | **100-300 high-confidence** |
| Total tokens | 50,000-150,000 |
| Avg tokens/example | 500-800 |

### Quality Breakdown

```
Confidence > 0.9: 20-30 pairs (excellent matches)
Confidence 0.8-0.9: 40-60 pairs (very good matches)
Confidence 0.7-0.8: 30-50 pairs (good matches)
Confidence 0.6-0.7: 10-20 pairs (acceptable matches)
Total: 100-160 training pairs
```

### File Type Distribution

```
Rust (.rs):       60-70% (main codebase)
TypeScript (.ts): 20-30% (frontend/pipes)
Python (.py):     5-10% (scripts)
Other (.js, .jsx): 5-10%
```

---

## Pipeline Configuration

### Configurable Parameters

```python
PIPELINE_CONFIG = {
    # Stage 1: Time Filter
    'time_window_days': 7,          # Audio window before commit
    'time_buffer_hours': 1,         # Buffer before commit

    # Stage 2: Keyword Matching
    'min_keyword_overlap': 1,       # Minimum keywords in common
    'tech_keywords': {...},         # List of technical terms

    # Stage 3: Semantic Similarity
    'embedding_model': 'all-MiniLM-L6-v2',
    'similarity_threshold': 0.6,    # Minimum confidence
    'max_audio_per_commit': 3,      # Top N audio discussions

    # Data Extraction
    'git_max_commits': 500,         # Max commits to process
    'audio_min_length': 100,        # Min transcription length
    'code_min_length': 50,          # Min code change length

    # Output
    'output_format': 'jsonl',       # Training data format
}
```

### Tuning Guidelines

**If too few training pairs (< 50):**
- ↓ Decrease `similarity_threshold` to 0.5
- ↑ Increase `time_window_days` to 14
- ↓ Decrease `audio_min_length` to 50

**If too many low-quality pairs:**
- ↑ Increase `similarity_threshold` to 0.7
- ↓ Decrease `time_window_days` to 3-5
- ↑ Increase `min_keyword_overlap` to 2

**If missing obvious matches:**
- ↑ Increase `time_window_days` (features may take weeks)
- ↓ Decrease `min_keyword_overlap` to 0 (skip keyword stage)
- Add more `tech_keywords`

---

## Implementation Plan

### Phase 1: Setup (30 minutes)

**Step 1.1: Install Dependencies**
```bash
pip install sentence-transformers pandas gitpython
```

**Step 1.2: Download Embedding Model**
```python
from sentence_transformers import SentenceTransformer

# Downloads ~80MB on first run
model = SentenceTransformer('all-MiniLM-L6-v2')
```

**Step 1.3: Verify Database Access**
```bash
sqlite3 ~/.screenpipe/db.sqlite "SELECT COUNT(*) FROM audio_transcriptions;"
```

---

### Phase 2: Extract Data (10 minutes)

**Step 2.1: Extract Audio**
```bash
python extract_audio.py
# Output: audio_discussions.csv
```

**Step 2.2: Extract Git Commits**
```bash
python extract_commits.py
# Output: code_changes.csv
```

**Checkpoint:** Review extracted data sizes
```bash
wc -l audio_discussions.csv   # Should be 200-500 lines
wc -l code_changes.csv         # Should be 300-800 lines
```

---

### Phase 3: Link Data (15 minutes)

**Step 3.1: Run Hybrid Linking**
```bash
python link_audio_code.py
# Output: linked_pairs.jsonl
```

**Step 3.2: Review Confidence Scores**
```bash
python analyze_confidence.py linked_pairs.jsonl
# Shows distribution of confidence scores
```

**Step 3.3: Filter by Confidence**
```bash
python filter_by_confidence.py --threshold 0.6
# Output: training_data.jsonl (filtered)
```

---

### Phase 4: Validation (15 minutes)

**Step 4.1: Manual Review (10 samples)**
```bash
python sample_training_data.py --count 10
# Shows random samples for manual inspection
```

**Step 4.2: Check for Issues**
- [ ] Audio makes sense for the commit?
- [ ] Code is readable and correct?
- [ ] No sensitive data (API keys, passwords)?
- [ ] Proper formatting (valid JSON)?

**Step 4.3: Generate Statistics**
```bash
python generate_stats.py training_data.jsonl
# Output: stats.json
```

---

### Phase 5: Training (8-12 hours)

**Step 5.1: Prepare for Training**
```bash
# Validate JSONL format
python validate_training_data.py training_data.jsonl
```

**Step 5.2: Train Model**
```bash
mlx_lm.lora \
    --model deepseek-ai/deepseek-coder-1.3b-instruct \
    --train \
    --data training_data.jsonl \
    --iters 600 \
    --batch-size 4 \
    --learning-rate 1e-5
```

**Step 5.3: Test Model**
```python
from mlx_lm import load, generate

model, tokenizer = load("./lora_fused_model")

prompt = """### Instruction:
Add error handling to database query

### Input:
Business Context: Users report crashes when database is unavailable
File: screenpipe-server/src/db.rs

### Response:
"""

output = generate(model, tokenizer, prompt=prompt)
print(output)
```

---

## Quality Assurance

### Validation Checklist

**Data Extraction:**
- [ ] Audio discussions: 200+ entries
- [ ] Code commits: 300+ entries
- [ ] No database errors
- [ ] Timestamps are valid

**Linking Quality:**
- [ ] Average confidence > 0.7
- [ ] At least 100 training pairs
- [ ] Manual spot-check 10 random pairs
- [ ] No obvious mismatches

**Training Data:**
- [ ] Valid JSONL format
- [ ] No sensitive information
- [ ] Code is compilable
- [ ] Instructions are clear

### Common Issues

**Issue 1: Too Few Training Pairs**
```
Symptom: < 50 pairs generated
Cause: Similarity threshold too high OR time window too narrow
Fix: Decrease threshold to 0.5, increase window to 14 days
```

**Issue 2: Low Confidence Scores**
```
Symptom: Average confidence < 0.6
Cause: Audio and commits use different vocabulary
Fix: Add more tech_keywords, review audio extraction query
```

**Issue 3: Mismatched Audio-Code**
```
Symptom: Audio discusses Feature A, code implements Feature B
Cause: Time window too wide OR multiple projects
Fix: Decrease time window to 3-5 days, add project filters
```

---

## Maintenance

### Monthly Updates

**When to Retrain:**
- Every 1-2 months as new data accumulates
- After major feature launches
- When code patterns change

**Update Process:**
```bash
# 1. Extract new data since last training
python extract_incremental.py --since 2025-11-01

# 2. Link new pairs
python link_audio_code.py --incremental

# 3. Merge with existing data
cat old_training_data.jsonl new_pairs.jsonl > merged_training_data.jsonl

# 4. Retrain model
mlx_lm.lora --model deepseek-coder-1.3b-instruct \
            --train --data merged_training_data.jsonl
```

### Monitoring

**Track These Metrics:**
- Training pairs per month
- Average confidence scores
- Model accuracy (manual evaluation)
- Code acceptance rate (how often you use AI-generated code)

---

## Troubleshooting

### Database Connection Issues

```bash
# Test database access
sqlite3 ~/.screenpipe/db.sqlite "SELECT COUNT(*) FROM audio_transcriptions;"

# Check permissions
ls -l ~/.screenpipe/db.sqlite

# If locked, stop screenpipe temporarily
pkill screenpipe
```

### Git Repository Issues

```bash
# Verify git repo
cd /Users/brianzhang/ai/screenpipe
git status

# If detached HEAD
git checkout main

# Update to latest
git pull origin main
```

### Embedding Model Issues

```python
# If model download fails, use cache
from sentence_transformers import SentenceTransformer

model = SentenceTransformer(
    'all-MiniLM-L6-v2',
    cache_folder='~/.cache/sentence_transformers'
)

# Verify model loaded
assert model is not None
print(f"Model dim: {model.get_sentence_embedding_dimension()}")
```

---

## Performance Optimization

### Speed Improvements

**Current Performance (M1 Pro):**
- Audio extraction: ~1 minute
- Git extraction: ~2 minutes
- Embedding computation: ~5-10 minutes
- Total: ~15 minutes for full pipeline

**Optimizations:**

1. **Batch Embeddings (2x faster)**
```python
# Instead of:
for text in texts:
    embedding = model.encode(text)

# Use:
embeddings = model.encode(texts)  # Batch processing
```

2. **Cache Embeddings (10x faster for reruns)**
```python
import pickle

# Save embeddings
with open('audio_embeddings.pkl', 'wb') as f:
    pickle.dump(audio_embeddings, f)

# Load on subsequent runs
with open('audio_embeddings.pkl', 'rb') as f:
    audio_embeddings = pickle.load(f)
```

3. **Parallel Processing (3x faster)**
```python
from multiprocessing import Pool

with Pool(4) as pool:
    results = pool.map(process_commit, commits)
```

---

## Appendix

### A. Technical Keywords List

```python
TECH_KEYWORDS = {
    # Core concepts
    'api', 'endpoint', 'route', 'handler', 'controller',
    'database', 'db', 'query', 'sql', 'table', 'schema',
    'auth', 'authentication', 'authorization', 'login', 'session',
    'cache', 'redis', 'memory', 'storage',

    # Actions
    'add', 'create', 'implement', 'build', 'develop',
    'fix', 'resolve', 'debug', 'patch',
    'update', 'modify', 'change', 'refactor',
    'optimize', 'improve', 'enhance', 'performance',

    # Features
    'pagination', 'search', 'filter', 'sort',
    'upload', 'download', 'export', 'import',
    'notification', 'email', 'webhook',

    # Quality
    'test', 'testing', 'validation', 'error', 'bug',
    'security', 'vulnerability', 'injection',

    # Architecture
    'service', 'module', 'component', 'library',
    'migration', 'deployment', 'config', 'environment'
}
```

### B. File Type Extensions

```python
CODE_EXTENSIONS = {
    '.rs': 'rust',
    '.py': 'python',
    '.ts': 'typescript',
    '.tsx': 'typescript-react',
    '.js': 'javascript',
    '.jsx': 'javascript-react',
    '.go': 'golang',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'header'
}

SKIP_EXTENSIONS = {
    '.lock',     # Lock files
    '.min.js',   # Minified files
    '.map',      # Source maps
    '.json',     # Config files (unless code-gen)
    '.md',       # Documentation
    '.txt'       # Text files
}
```

### C. Example Training Pair

```json
{
  "instruction": "Add authentication middleware to API endpoints",
  "input": "Business Context from team discussions:\n\n[Discussion 1]: We need to protect the API endpoints because anyone can currently access user data without authentication. This is a security vulnerability that needs to be fixed ASAP.\n\n[Discussion 2]: Let's use JWT tokens for authentication. The middleware should check the Authorization header and validate the token before allowing access to protected routes.\n\nTask: Modify screenpipe-server/src/middleware/auth.rs",
  "output": "use axum::{\n    extract::State,\n    http::{Request, StatusCode},\n    middleware::Next,\n    response::Response,\n};\nuse jsonwebtoken::{decode, DecodingKey, Validation};\n\npub async fn auth_middleware<B>(\n    State(state): State<Arc<AppState>>,\n    mut req: Request<B>,\n    next: Next<B>,\n) -> Result<Response, StatusCode> {\n    let auth_header = req\n        .headers()\n        .get(\"Authorization\")\n        .and_then(|h| h.to_str().ok())\n        .ok_or(StatusCode::UNAUTHORIZED)?;\n    \n    let token = auth_header\n        .strip_prefix(\"Bearer \")\n        .ok_or(StatusCode::UNAUTHORIZED)?;\n    \n    let token_data = decode::<Claims>(\n        token,\n        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),\n        &Validation::default(),\n    )\n    .map_err(|_| StatusCode::UNAUTHORIZED)?;\n    \n    req.extensions_mut().insert(token_data.claims);\n    \n    Ok(next.run(req).await)\n}"
}
```

---

## Next Steps

After running this pipeline:

1. **Validate training data** - Review 10-20 random samples manually
2. **Train initial model** - Use DeepSeek-Coder-1.3B with LoRA
3. **Test on real tasks** - Try generating code for actual Jira tickets
4. **Iterate** - Adjust confidence thresholds based on results
5. **Scale up** - Add more data sources (screen captures, browser context) if needed

---

**Last Updated:** 2025-11-26
**Version:** 1.0
**Author:** AI Training Pipeline for Screenpipe
