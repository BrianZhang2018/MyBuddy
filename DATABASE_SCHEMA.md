# Screenpipe SQLite Database Schema

## Overview

Screenpipe uses SQLite with FTS5 (Full-Text Search) and vector extensions for efficient search and storage of screen recordings, audio transcriptions, and UI monitoring data.

**Database Location:** `~/.screenpipe/db.sqlite`

---

## Core Tables

### 1. video_chunks
Stores video file metadata for screen recordings.

```sql
CREATE TABLE video_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    device_name TEXT NOT NULL DEFAULT ''
);
```

**Indexes:**
- Primary key on `id`

**Purpose:** Links video files to frames

---

### 2. frames
Stores metadata about individual screenshot frames.

```sql
CREATE TABLE frames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_chunk_id INTEGER NOT NULL,
    offset_index INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    name TEXT,
    browser_url TEXT DEFAULT NULL,
    app_name TEXT DEFAULT NULL,
    window_name TEXT DEFAULT NULL,
    focused BOOLEAN DEFAULT NULL,
    device_name TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (video_chunk_id) REFERENCES video_chunks(id)
);
```

**Columns:**
- `id`: Unique frame identifier
- `video_chunk_id`: Reference to video file
- `offset_index`: Position in video
- `timestamp`: When frame was captured
- `name`: Frame identifier/label
- `browser_url`: URL if browser window
- `app_name`: Application name (e.g., "Chrome", "VSCode")
- `window_name`: Window title
- `focused`: Whether window had focus
- `device_name`: Which monitor/device

**Indexes:**
- `idx_frames_video_chunk_id`
- `idx_frames_timestamp`
- `idx_frames_video_chunk_id_timestamp`
- `idx_frames_timestamp_offset_index`
- `idx_frames_app_name`
- `idx_frames_window_name`
- `idx_frames_app_window`
- `idx_frames_browser_url`
- `idx_frames_focused`

---

### 3. ocr_text
Stores extracted text from frames.

```sql
CREATE TABLE ocr_text (
    frame_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    text_json TEXT,
    app_name TEXT NOT NULL DEFAULT '',
    ocr_engine TEXT NOT NULL DEFAULT 'unknown',
    window_name TEXT,
    focused BOOLEAN DEFAULT FALSE,
    text_length INTEGER
);
```

**Columns:**
- `frame_id`: Reference to frames table
- `text`: Extracted plain text
- `text_json`: Structured text with positions/bounding boxes
- `app_name`: Application name
- `ocr_engine`: OCR engine used (e.g., "apple-native", "tesseract")
- `window_name`: Window title
- `focused`: Focus state
- `text_length`: Length of extracted text

**Indexes:**
- `idx_ocr_text_frame_id`
- `idx_ocr_text_frame_app_window`
- `idx_ocr_text_length`

---

### 4. audio_chunks
Stores audio file metadata.

```sql
CREATE TABLE audio_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    timestamp TIMESTAMP
);
```

**Indexes:**
- `idx_audio_chunks_timestamp`

---

### 5. audio_transcriptions
Stores transcribed audio with speaker information.

```sql
CREATE TABLE audio_transcriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audio_chunk_id INTEGER NOT NULL,
    offset_index INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    transcription TEXT NOT NULL,
    device TEXT NOT NULL DEFAULT '',
    is_input_device BOOLEAN NOT NULL DEFAULT TRUE,
    speaker_id INTEGER,
    transcription_engine TEXT NOT NULL DEFAULT 'Whisper',
    start_time REAL,
    end_time REAL,
    text_length INTEGER,
    FOREIGN KEY (audio_chunk_id) REFERENCES audio_chunks(id)
);
```

**Columns:**
- `id`: Unique transcription ID
- `audio_chunk_id`: Reference to audio file
- `offset_index`: Position in audio
- `timestamp`: When audio was captured
- `transcription`: Transcribed text
- `device`: Audio device name
- `is_input_device`: Microphone (true) or speaker output (false)
- `speaker_id`: Reference to speakers table
- `transcription_engine`: Engine used (e.g., "Whisper", "Deepgram")
- `start_time`: Segment start time
- `end_time`: Segment end time
- `text_length`: Length of transcription

**Indexes:**
- `idx_audio_transcriptions_audio_chunk_id`
- `idx_audio_transcriptions_audio_chunk_id_timestamp`
- `idx_audio_transcriptions_timestamp`
- `idx_audio_transcriptions_transcription`
- `idx_audio_transcriptions_length`

---

### 6. speakers
Stores speaker profiles for voice identification.

```sql
CREATE TABLE speakers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    metadata JSON,
    hallucination BOOLEAN DEFAULT FALSE
);
```

**Purpose:** Track different speakers in audio recordings

---

### 7. speaker_embeddings
Stores vector embeddings for speaker identification.

```sql
CREATE TABLE speaker_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    embedding FLOAT[512] NOT NULL
        check(
            typeof(embedding) == 'blob'
            and vec_length(embedding) == 512
        ),
    speaker_id INTEGER REFERENCES speakers(id)
);
```

**Purpose:** Uses sqlite-vec for speaker similarity matching

---

### 8. ui_monitoring
Stores macOS UI accessibility data.

```sql
CREATE TABLE ui_monitoring (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text_output TEXT NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    app TEXT NOT NULL,
    window TEXT NOT NULL,
    initial_traversal_at DATETIME,
    text_length INTEGER
);
```

**Purpose:** macOS UI element monitoring via accessibility APIs

**Indexes:**
- `idx_ui_monitoring_timestamp`
- `idx_ui_monitoring_app`
- `idx_ui_monitoring_window`
- `idx_ui_monitoring_text_output`
- `idx_ui_monitoring_app_window`
- `idx_ui_monitoring_timestamp_app`
- `idx_ui_monitoring_length`

---

## Full-Text Search (FTS5) Tables

### 1. ocr_text_fts
Full-text search index for OCR text.

```sql
CREATE VIRTUAL TABLE ocr_text_fts USING fts5(
    text,
    app_name,
    window_name,
    frame_id UNINDEXED,
    tokenize='unicode61'
);
```

**Triggers:**
- `ocr_text_ai`: Insert on new OCR text
- `ocr_text_update`: Update on text change
- `ocr_text_delete`: Delete on text removal

---

### 2. audio_transcriptions_fts
Full-text search index for audio transcriptions.

```sql
CREATE VIRTUAL TABLE audio_transcriptions_fts USING fts5(
    transcription,
    device,
    audio_chunk_id UNINDEXED,
    speaker_id,
    start_time UNINDEXED,
    end_time UNINDEXED,
    tokenize='unicode61'
);
```

**Triggers:**
- `audio_transcriptions_ai`: Insert on new transcription
- `audio_transcriptions_update`: Update on transcription change
- `audio_transcriptions_delete`: Delete on transcription removal

---

### 3. frames_fts
Full-text search index for frame metadata.

```sql
CREATE VIRTUAL TABLE frames_fts USING fts5(
    name,
    browser_url,
    app_name,
    window_name,
    focused,
    id UNINDEXED,
    tokenize='unicode61'
);
```

**Triggers:**
- `frames_ai`: Insert on new frame
- `frames_au`: Update on frame change
- `frames_ad`: Delete on frame removal

---

### 4. ui_monitoring_fts
Full-text search index for UI monitoring.

```sql
CREATE VIRTUAL TABLE ui_monitoring_fts USING fts5(
    text_output,
    app,
    window,
    ui_id UNINDEXED,
    tokenize='unicode61'
);
```

---

## Tagging System

### 1. tags
Stores tag definitions.

```sql
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 2. vision_tags
Links tags to video frames.

```sql
CREATE TABLE vision_tags (
    vision_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (vision_id, tag_id),
    FOREIGN KEY (vision_id) REFERENCES frames(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

**Indexes:**
- `idx_vision_tags_vision_id`
- `idx_vision_tags_tag_id`

---

### 3. audio_tags
Links tags to audio chunks.

```sql
CREATE TABLE audio_tags (
    audio_chunk_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (audio_chunk_id, tag_id),
    FOREIGN KEY (audio_chunk_id) REFERENCES audio_chunks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

**Indexes:**
- `idx_audio_tags_audio_chunk_id`
- `idx_audio_tags_tag_id`

---

### 4. ui_monitoring_tags
Links tags to UI monitoring entries.

```sql
CREATE TABLE ui_monitoring_tags (
    ui_monitoring_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (ui_monitoring_id, tag_id),
    FOREIGN KEY (ui_monitoring_id) REFERENCES ui_monitoring(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

---

## Embeddings & Vector Search

### ocr_text_embeddings
Stores vector embeddings for OCR text (experimental).

```sql
CREATE TABLE ocr_text_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frame_id INTEGER NOT NULL,
    embedding BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (frame_id) REFERENCES frames(id) ON DELETE CASCADE
);
```

**Purpose:** Enable semantic search over screen content

---

## Database Relationships

```
video_chunks (1) ──→ (∞) frames
                         │
                         ├─→ (∞) ocr_text
                         ├─→ (∞) vision_tags ──→ tags
                         └─→ (1) ocr_text_embeddings

audio_chunks (1) ──→ (∞) audio_transcriptions ──→ speakers
                         │                         │
                         │                         └─→ speaker_embeddings
                         └─→ (∞) audio_tags ──→ tags

ui_monitoring ──→ (∞) ui_monitoring_tags ──→ tags
```

---

## Query Examples

### 1. Find all Chrome windows with "password" in OCR text
```sql
SELECT
    f.timestamp,
    f.app_name,
    f.window_name,
    o.text
FROM frames f
JOIN ocr_text o ON f.id = o.frame_id
JOIN ocr_text_fts fts ON o.frame_id = fts.frame_id
WHERE fts MATCH 'password'
  AND f.app_name = 'Chrome'
ORDER BY f.timestamp DESC
LIMIT 10;
```

### 2. Search audio transcriptions by speaker
```sql
SELECT
    at.transcription,
    at.timestamp,
    s.name as speaker_name,
    at.device
FROM audio_transcriptions at
JOIN speakers s ON at.speaker_id = s.id
JOIN audio_transcriptions_fts fts ON at.audio_chunk_id = fts.audio_chunk_id
WHERE fts MATCH 'meeting'
  AND s.name = 'John Doe'
ORDER BY at.timestamp DESC;
```

### 3. Find focused browser windows
```sql
SELECT
    f.timestamp,
    f.app_name,
    f.window_name,
    f.browser_url
FROM frames f
JOIN frames_fts fts ON f.id = fts.id
WHERE fts MATCH 'focused:1'
  AND f.browser_url IS NOT NULL
ORDER BY f.timestamp DESC;
```

### 4. Get tagged content
```sql
SELECT
    f.timestamp,
    o.text,
    GROUP_CONCAT(t.name, ', ') as tags
FROM frames f
JOIN ocr_text o ON f.id = o.frame_id
LEFT JOIN vision_tags vt ON f.id = vt.vision_id
LEFT JOIN tags t ON vt.tag_id = t.id
GROUP BY f.id
HAVING tags IS NOT NULL
ORDER BY f.timestamp DESC;
```

---

## Performance Characteristics

- **WAL Mode**: Enabled for better concurrency
- **Connection Pool**: 3-50 connections based on workload
- **FTS5 Tokenizer**: Unicode61 for international text support
- **Vector Search**: sqlite-vec extension for embeddings
- **Automatic Triggers**: FTS tables auto-update via triggers

---

## Storage Estimates

Based on default settings (1 FPS, 30s audio chunks):

| Data Type | Size | Notes |
|-----------|------|-------|
| Video chunks | ~500MB/day | Compressed H.265 |
| Audio chunks | ~50MB/day | Compressed WAV |
| OCR text | ~10MB/day | Text + JSON |
| Transcriptions | ~5MB/day | Text only |
| Embeddings | ~100MB/day | Optional, 512-dim vectors |
| **Total** | **~15GB/month** | Configurable quality |

---

## Database Maintenance

### Vacuum
```sql
VACUUM;  -- Reclaim space
```

### Analyze
```sql
ANALYZE;  -- Update query planner statistics
```

### FTS5 Optimize
```sql
INSERT INTO ocr_text_fts(ocr_text_fts) VALUES('optimize');
INSERT INTO audio_transcriptions_fts(audio_transcriptions_fts) VALUES('optimize');
INSERT INTO frames_fts(frames_fts) VALUES('optimize');
```

---

## Migration System

Screenpipe uses SQLx migrations stored in `/screenpipe-db/src/migrations/`.

**Migration table:**
```sql
CREATE TABLE _sqlx_migrations (
    version BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL,
    checksum BLOB NOT NULL,
    execution_time BIGINT NOT NULL
);
```

**To check migration status:**
```bash
sqlite3 ~/.screenpipe/db.sqlite "SELECT * FROM _sqlx_migrations ORDER BY version;"
```

---

This schema enables efficient search, storage, and retrieval of all screen and audio data captured by screenpipe!
