# Screenpipe FTS5 Table Definitions

## Overview

Screenpipe uses SQLite FTS5 (Full-Text Search 5) virtual tables for lightning-fast text search. These are **virtual tables** - they don't store data the same way as regular tables, but instead create inverted indexes for efficient searching.

---

## 1. ocr_text_fts

**Purpose:** Full-text search for OCR (screen text) content

### Definition:

```sql
CREATE VIRTUAL TABLE ocr_text_fts USING fts5(
    text,              -- OCR extracted text (INDEXED)
    app_name,          -- Application name (INDEXED)
    window_name,       -- Window title (INDEXED)
    frame_id UNINDEXED,-- Frame ID (stored but not searchable)
    tokenize='unicode61'
);
```

### Column Details:

| Column | Type | Indexed | Purpose | Example |
|--------|------|---------|---------|---------|
| `text` | TEXT | ✅ Yes | OCR extracted text | "Meeting at 3pm tomorrow" |
| `app_name` | TEXT | ✅ Yes | Application name | "Chrome", "VSCode" |
| `window_name` | TEXT | ✅ Yes | Window title | "Gmail - Chrome" |
| `frame_id` | INTEGER | ❌ UNINDEXED | Link to frames table | 12345 |

### Trigger (Auto-Sync):

```sql
CREATE TRIGGER ocr_text_ai AFTER INSERT ON ocr_text
WHEN NEW.text IS NOT NULL AND NEW.text != '' AND NEW.frame_id IS NOT NULL
BEGIN
    INSERT OR IGNORE INTO ocr_text_fts(frame_id, text, app_name, window_name)
    VALUES (
        NEW.frame_id,
        NEW.text,
        COALESCE(NEW.app_name, ''),
        COALESCE(NEW.window_name, '')
    );
END;
```

### Query Examples:

```sql
-- Search for "meeting" in text
SELECT o.*
FROM ocr_text o
JOIN ocr_text_fts fts ON o.frame_id = fts.frame_id
WHERE fts MATCH 'meeting';

-- Search in Chrome only
WHERE fts MATCH 'app_name:chrome';

-- Search for "meeting" in Gmail windows
WHERE fts MATCH 'meeting AND window_name:gmail';

-- Complex search
WHERE fts MATCH '"important meeting" OR deadline AND app_name:chrome';
```

---

## 2. audio_transcriptions_fts

**Purpose:** Full-text search for audio transcriptions

### Definition:

```sql
CREATE VIRTUAL TABLE audio_transcriptions_fts USING fts5(
    transcription,        -- Transcribed text (INDEXED)
    device,              -- Audio device name (INDEXED)
    audio_chunk_id UNINDEXED,  -- Audio chunk ID (stored but not searchable)
    speaker_id,          -- Speaker ID (INDEXED)
    start_time UNINDEXED,-- Segment start time (stored but not searchable)
    end_time UNINDEXED,  -- Segment end time (stored but not searchable)
    tokenize='unicode61'
);
```

### Column Details:

| Column | Type | Indexed | Purpose | Example |
|--------|------|---------|---------|---------|
| `transcription` | TEXT | ✅ Yes | Transcribed audio text | "Let's schedule the meeting" |
| `device` | TEXT | ✅ Yes | Audio device | "MacBook Pro Microphone" |
| `audio_chunk_id` | INTEGER | ❌ UNINDEXED | Link to audio_chunks | 789 |
| `speaker_id` | INTEGER | ✅ Yes | Speaker identifier | 42 |
| `start_time` | REAL | ❌ UNINDEXED | Segment start (seconds) | 15.3 |
| `end_time` | REAL | ❌ UNINDEXED | Segment end (seconds) | 18.7 |

### Triggers (Auto-Sync):

**Insert Trigger:**
```sql
CREATE TRIGGER audio_transcriptions_ai AFTER INSERT ON audio_transcriptions
WHEN NEW.transcription IS NOT NULL AND NEW.transcription != ''
  AND NEW.audio_chunk_id IS NOT NULL
BEGIN
    INSERT OR IGNORE INTO audio_transcriptions_fts(
        transcription, device, audio_chunk_id, speaker_id, start_time, end_time
    )
    VALUES (
        NEW.transcription,
        COALESCE(NEW.device, ''),
        NEW.audio_chunk_id,
        NEW.speaker_id,
        NEW.start_time,
        NEW.end_time
    );
END;
```

**Update Trigger:**
```sql
CREATE TRIGGER audio_transcriptions_update AFTER UPDATE ON audio_transcriptions
WHEN NEW.transcription IS NOT NULL AND NEW.transcription != ''
  AND OLD.audio_chunk_id IS NOT NULL
BEGIN
    UPDATE audio_transcriptions_fts
    SET transcription = NEW.transcription,
        device = COALESCE(NEW.device, ''),
        start_time = NEW.start_time,
        end_time = NEW.end_time
    WHERE audio_chunk_id = OLD.audio_chunk_id;
END;
```

**Delete Trigger:**
```sql
CREATE TRIGGER audio_transcriptions_delete AFTER DELETE ON audio_transcriptions
BEGIN
    DELETE FROM audio_transcriptions_fts
    WHERE audio_chunk_id = OLD.audio_chunk_id;
END;
```

### Query Examples:

```sql
-- Search for "meeting" in audio
SELECT at.*
FROM audio_transcriptions at
JOIN audio_transcriptions_fts fts ON at.audio_chunk_id = fts.audio_chunk_id
WHERE fts MATCH 'meeting';

-- Search by speaker
WHERE fts MATCH 'speaker_id:42';

-- Search by device
WHERE fts MATCH 'device:microphone';

-- Complex search
WHERE fts MATCH '"project update" OR deadline AND device:microphone';
```

---

## 3. frames_fts

**Purpose:** Full-text search for frame metadata (app, window, URL, focus)

### Definition:

```sql
CREATE VIRTUAL TABLE frames_fts USING fts5(
    name,               -- Frame name/identifier (INDEXED)
    browser_url,        -- Browser URL (INDEXED)
    app_name,           -- Application name (INDEXED)
    window_name,        -- Window title (INDEXED)
    focused,            -- Focus state (INDEXED)
    id UNINDEXED,       -- Frame ID (stored but not searchable)
    tokenize='unicode61'
);
```

### Column Details:

| Column | Type | Indexed | Purpose | Example |
|--------|------|---------|---------|---------|
| `name` | TEXT | ✅ Yes | Frame identifier | "main_screen_1" |
| `browser_url` | TEXT | ✅ Yes | URL if browser window | "github.com/repo" |
| `app_name` | TEXT | ✅ Yes | Application name | "Chrome", "Slack" |
| `window_name` | TEXT | ✅ Yes | Window title | "Google Docs - Chrome" |
| `focused` | BOOLEAN | ✅ Yes | Window had focus | 1 (true) or 0 (false) |
| `id` | INTEGER | ❌ UNINDEXED | Link to frames table | 5678 |

### Triggers (Auto-Sync):

**Insert Trigger:**
```sql
CREATE TRIGGER frames_ai AFTER INSERT ON frames
BEGIN
    INSERT INTO frames_fts(id, name, browser_url, app_name, window_name, focused)
    VALUES (
        NEW.id,
        COALESCE(NEW.name, ''),
        COALESCE(NEW.browser_url, ''),
        COALESCE(NEW.app_name, ''),
        COALESCE(NEW.window_name, ''),
        COALESCE(NEW.focused, 0)
    );
END;
```

**Update Trigger:**
```sql
CREATE TRIGGER frames_au AFTER UPDATE ON frames
WHEN (NEW.name IS NOT NULL AND NEW.name != '')
   OR (NEW.browser_url IS NOT NULL AND NEW.browser_url != '')
   OR (NEW.app_name IS NOT NULL AND NEW.app_name != '')
   OR (NEW.window_name IS NOT NULL AND NEW.window_name != '')
   OR (NEW.focused IS NOT NULL)
BEGIN
    INSERT OR REPLACE INTO frames_fts(id, name, browser_url, app_name, window_name, focused)
    VALUES (
        NEW.id,
        COALESCE(NEW.name, ''),
        COALESCE(NEW.browser_url, ''),
        COALESCE(NEW.app_name, ''),
        COALESCE(NEW.window_name, ''),
        COALESCE(NEW.focused, 0)
    );
END;
```

**Delete Trigger:**
```sql
CREATE TRIGGER frames_ad AFTER DELETE ON frames
BEGIN
    DELETE FROM frames_fts
    WHERE id = OLD.id;
END;
```

### Query Examples:

```sql
-- Find Chrome windows
SELECT f.*
FROM frames f
JOIN frames_fts fts ON f.id = fts.id
WHERE fts MATCH 'app_name:chrome';

-- Find GitHub URLs
WHERE fts MATCH 'browser_url:github.com';

-- Find focused Gmail windows
WHERE fts MATCH 'window_name:gmail AND focused:1';

-- Complex search
WHERE fts MATCH 'app_name:chrome AND (browser_url:github OR browser_url:gitlab)';
```

---

## 4. ui_monitoring_fts

**Purpose:** Full-text search for macOS UI accessibility data

### Definition:

```sql
CREATE VIRTUAL TABLE ui_monitoring_fts USING fts5(
    text_output,        -- UI element text (INDEXED)
    app,               -- Application name (INDEXED)
    window,            -- Window name (INDEXED)
    ui_id UNINDEXED,   -- UI monitoring ID (stored but not searchable)
    tokenize='unicode61'
);
```

### Column Details:

| Column | Type | Indexed | Purpose | Example |
|--------|------|---------|---------|---------|
| `text_output` | TEXT | ✅ Yes | UI element text content | "Send Message Button" |
| `app` | TEXT | ✅ Yes | Application name | "Messages", "Mail" |
| `window` | TEXT | ✅ Yes | Window name | "Conversation with John" |
| `ui_id` | INTEGER | ❌ UNINDEXED | Link to ui_monitoring | 999 |

### Triggers (Auto-Sync):

**Insert Trigger:**
```sql
CREATE TRIGGER ui_monitoring_ai AFTER INSERT ON ui_monitoring
WHEN NEW.text_output IS NOT NULL AND NEW.text_output != '' AND NEW.id IS NOT NULL
BEGIN
    INSERT OR IGNORE INTO ui_monitoring_fts(ui_id, text_output, app, window)
    VALUES (
        NEW.id,
        NEW.text_output,
        COALESCE(NEW.app, ''),
        COALESCE(NEW.window, '')
    );
END;
```

**Update & Delete Triggers:** Similar pattern to other FTS tables

### Query Examples:

```sql
-- Search UI text
SELECT ui.*
FROM ui_monitoring ui
JOIN ui_monitoring_fts fts ON ui.id = fts.ui_id
WHERE fts MATCH 'button';

-- Search in specific app
WHERE fts MATCH 'app:messages';

-- Complex search
WHERE fts MATCH 'send AND app:messages AND window:john';
```

---

## Key Concepts

### 1. UNINDEXED Columns

Columns marked `UNINDEXED` are **stored** in the FTS table but **not searchable**:

```sql
frame_id UNINDEXED,  -- Can't search by frame_id in MATCH
```

**Why?**
- ID fields are for linking, not searching
- Saves index space
- Still accessible in results

**Usage:**
```sql
-- ❌ This won't work (frame_id is UNINDEXED)
WHERE fts MATCH 'frame_id:123';

-- ✅ Use this instead (join to core table)
FROM ocr_text o
JOIN ocr_text_fts fts ON o.frame_id = fts.frame_id
WHERE o.frame_id = 123;
```

### 2. tokenize='unicode61'

Uses Unicode 6.1 tokenizer for international text support:

```
Input:  "Hello, world! 你好世界"
Tokens: ["hello", "world", "你好世界"]
```

**Features:**
- Case-insensitive
- Removes punctuation
- Handles Unicode properly
- Supports many languages

### 3. FTS5 MATCH Syntax

```sql
-- Simple word
MATCH 'meeting'

-- Field-specific
MATCH 'app_name:chrome'

-- Multiple fields
MATCH 'text:meeting AND window_name:gmail'

-- Phrase search
MATCH '"important meeting"'

-- Boolean operators
MATCH 'meeting OR conference'
MATCH 'meeting NOT cancelled'

-- Prefix search
MATCH 'meet*'  -- matches "meeting", "meetings", "meet", etc.

-- Parentheses for grouping
MATCH '(meeting OR conference) AND app_name:chrome'
```

### 4. Performance Characteristics

| Operation | Regular Table (LIKE) | FTS5 Table (MATCH) |
|-----------|---------------------|-------------------|
| Search "meeting" | O(n) - scan all rows | O(log n) - index lookup |
| 1M rows | ~2-5 seconds | ~0.003 seconds |
| 10M rows | ~20-50 seconds | ~0.005 seconds |
| Storage | 100% | 100% + 30% for index |

---

## Complete Example Query

**Scenario:** Find all mentions of "meeting" in Chrome Gmail from today, where the window was focused

```sql
SELECT
    o.text,                  -- From ocr_text (core table)
    f.timestamp,             -- From frames (core table)
    f.app_name,              -- From frames (core table)
    f.window_name,           -- From frames (core table)
    f.browser_url            -- From frames (core table)
FROM frames f                -- Core table
JOIN ocr_text o              -- Core table
    ON f.id = o.frame_id
JOIN ocr_text_fts o_fts      -- FTS table for text search
    ON o.frame_id = o_fts.frame_id
JOIN frames_fts f_fts        -- FTS table for metadata search
    ON f.id = f_fts.id
WHERE o_fts MATCH 'meeting'                      -- Fast text search
  AND f_fts MATCH 'app_name:chrome'              -- Fast app filter
  AND f_fts MATCH 'window_name:gmail'            -- Fast window filter
  AND f_fts MATCH 'focused:1'                    -- Fast focus filter
  AND f.timestamp >= date('now', 'start of day') -- Date filter on core table
ORDER BY f.timestamp DESC
LIMIT 10;
```

**What makes this fast:**
1. ⚡ FTS finds "meeting" instantly (inverted index)
2. ⚡ FTS filters Chrome instantly (inverted index)
3. ⚡ FTS filters Gmail instantly (inverted index)
4. ⚡ FTS filters focused instantly (inverted index)
5. ⚡ Date filter uses B-tree index on timestamp
6. ✅ Returns full data from core tables

**Result:** Searches millions of rows in **~5 milliseconds**!

---

## Maintenance

### Optimize FTS Tables

Run periodically to rebuild indexes and reclaim space:

```sql
-- Optimize all FTS tables
INSERT INTO ocr_text_fts(ocr_text_fts) VALUES('optimize');
INSERT INTO audio_transcriptions_fts(audio_transcriptions_fts) VALUES('optimize');
INSERT INTO frames_fts(frames_fts) VALUES('optimize');
INSERT INTO ui_monitoring_fts(ui_monitoring_fts) VALUES('optimize');
```

### Check FTS Table Stats

```sql
-- Check number of indexed documents
SELECT COUNT(*) FROM ocr_text_fts;

-- Check FTS table integrity
INSERT INTO ocr_text_fts(ocr_text_fts) VALUES('integrity-check');
```

---

This is how screenpipe achieves lightning-fast search across years of screen recordings! 🚀
