# Screenpipe Data Architecture

Complete guide to understanding screenpipe's data sources, storage mechanisms, and data relationships.

---

## Table of Contents

1. [Overview](#overview)
2. [Data Sources](#data-sources)
3. [Storage Architecture](#storage-architecture)
4. [Data Flow](#data-flow)
5. [Database Schema & Relationships](#database-schema--relationships)
6. [OCR vs UI Monitoring](#ocr-vs-ui-monitoring)
7. [Audio Capture](#audio-capture)
8. [Storage Considerations](#storage-considerations)

---

## Overview

Screenpipe captures and stores three primary types of data:

```
┌─────────────────────────────────────────────────────────┐
│                    SCREENPIPE CAPTURE                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   VISION     │  │  UI MONITOR  │  │    AUDIO     │  │
│  │   (OCR)      │  │ (macOS only) │  │              │  │
│  │              │  │              │  │              │  │
│  │  ✓ Enabled   │  │  ✗ Disabled  │  │  ✓ Enabled   │  │
│  │  (default)   │  │   (opt-in)   │  │  (default)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Data Sources

### 1. Vision / OCR (Optical Character Recognition)

**What it captures:**
- Screenshots of your monitor(s) at configured FPS
- Individual window screenshots
- Text extracted from visual content via OCR

**How it works:**
```
Monitor → Screenshot → OCR Processing → Text Extraction
         (xcap)      (Vision Framework)   (Database)
```

**Capture rate:**
- Default: 0.5 FPS on macOS (1 screenshot every 2 seconds)
- Default: 1.0 FPS on other platforms
- Configurable via `--fps` flag
- Max: 30 FPS

**OCR Engines:**
- **macOS**: Apple Vision Framework (default)
- **Windows**: Windows Native OCR (default)
- **Linux**: Tesseract (default)
- **Cloud**: Unstructured API (optional)

**What gets captured:**
- ✓ Visible text on screen
- ✓ App names and window titles
- ✓ Browser URLs (detected)
- ✓ Text bounding boxes (position, size)
- ✓ Confidence scores
- ✓ Which window is focused
- ✗ Hidden UI elements
- ✗ Non-visual text

---

### 2. UI Monitoring (macOS Accessibility API)

**Status:** ⚠️ **Disabled by default** - requires `--enable-ui-monitoring`

**What it captures:**
- UI element tree via macOS Accessibility APIs
- Programmatic access to UI components
- No screenshots required

**How it works:**
```
App UI → Accessibility API → UI Tree Traversal → Text Extraction
        (native macOS)       (ui_monitor binary)   (Database)
```

**What gets captured:**
- ✓ All UI element text (buttons, labels, fields)
- ✓ Hidden/collapsed UI elements
- ✓ Form field values
- ✓ Menu structures (without clicking)
- ✓ Tooltips and accessibility hints
- ✓ Element states (enabled/disabled)
- ✗ Visual content (images, graphics)
- ✗ Text rendered as images

**Privacy note:** Can access sensitive data like password fields - use with caution.

---

### 3. Audio Capture

**What it captures:**
- System audio output (speakers/headphones)
- Microphone input
- Speech transcription

**How it works:**
```
Audio Device → Voice Activity Detection → Transcription → Database
   (cpal)            (VAD: Silero/WebRTC)   (Whisper/Deepgram)
```

**Audio sources:**
- **Input devices**: Microphone (conversations you speak)
- **Output devices**: System audio (YouTube, Zoom, music, etc.)

**Transcription engines:**
- **Whisper Tiny** (local, fast, default)
- **Whisper Large** (local, high quality)
- **Deepgram** (cloud, highest quality)

**Important:** Audio is only transcribed when **speech is detected**:
- VAD (Voice Activity Detection) identifies speech
- Minimum speech ratio: 5% (configurable via `--vad-sensitivity`)
- Pure music/silence is not transcribed
- No audio = no transcriptions in database

**Disable audio:** Use `--disable-audio` flag

---

## Storage Architecture

### Dual Storage System

Screenpipe uses **two complementary storage mechanisms**:

```
┌─────────────────────────────────────────────────────────┐
│                      STORAGE LAYER                       │
├──────────────────────────┬──────────────────────────────┤
│   VIDEO FILES (.mp4)     │      DATABASE (SQLite)       │
├──────────────────────────┼──────────────────────────────┤
│ Location:                │ Location:                     │
│ ~/.screenpipe/data/      │ ~/.screenpipe/db.sqlite      │
│                          │                               │
│ Contains:                │ Contains:                     │
│ • Visual pixel data      │ • OCR extracted text          │
│ • Encoded as H.265       │ • Video file references       │
│ • Complete screenshots   │ • Frame metadata              │
│ • Replayable videos      │ • Audio transcriptions        │
│                          │ • UI monitoring data          │
│                          │ • Searchable indexes          │
│                          │                               │
│ Purpose:                 │ Purpose:                      │
│ • Visual review          │ • Fast text search            │
│ • Export recordings      │ • Metadata queries            │
│ • Frame retrieval        │ • Temporal lookups            │
│                          │ • Cross-referencing           │
└──────────────────────────┴──────────────────────────────┘
```

### NOT Duplicated Data

**Common misconception:** "Are video files and OCR data duplicated?"

**Answer:** No! They serve different purposes:

| Aspect | Video Files | OCR Database |
|--------|-------------|--------------|
| **Content** | Visual pixels (images) | Extracted text |
| **Searchable** | No | Yes (FTS5 indexed) |
| **Size** | Larger (~17GB for 393k frames) | Smaller (~3.4GB) |
| **Use case** | Visual replay, verification | Text search, analysis |
| **Format** | H.265 compressed video | Structured text + metadata |

**Analogy:** Video files are like a **recording**, OCR data is like a **transcript**.

---

## Data Flow

### Complete Capture Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAPTURE PHASE                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  MONITOR LOOP   │
                    │  (Every 1/fps)  │
                    └─────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Screenshot   │  │ Window       │  │ Audio        │
    │ Full Monitor │  │ Screenshots  │  │ Chunks       │
    └──────────────┘  └──────────────┘  └──────────────┘
            │                 │                  │
            └─────────────────┼─────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PROCESSING PHASE                            │
└─────────────────────────────────────────────────────────────────┘
            │                 │                  │
            ▼                 ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ FFmpeg       │  │ OCR          │  │ VAD +        │
    │ Encoding     │  │ Processing   │  │ Transcribe   │
    │ (H.265)      │  │ (Vision)     │  │ (Whisper)    │
    └──────────────┘  └──────────────┘  └──────────────┘
            │                 │                  │
            └─────────────────┼─────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       STORAGE PHASE                              │
└─────────────────────────────────────────────────────────────────┘
            │                 │                  │
            ▼                 ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Video File   │  │ OCR Text     │  │ Audio        │
    │ (data/*.mp4) │  │ (database)   │  │ Transcript   │
    │              │  │              │  │ (database)   │
    └──────────────┘  └──────────────┘  └──────────────┘
            │                 │                  │
            └─────────────────┴─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  FTS5 Indexing  │
                    │  (Full-text     │
                    │   search ready) │
                    └─────────────────┘
```

---

## Database Schema & Relationships

### Core Tables Relationship

```
┌─────────────────┐
│  video_chunks   │  ← Video file references
│─────────────────│
│ id (PK)         │
│ file_path       │──┐  "monitor_1_2025-11-29_00-31-06.mp4"
│ device_name     │  │
└─────────────────┘  │
                     │
                     │  FK: video_chunk_id
                     │
                ┌────▼──────────┐
                │    frames     │  ← Frame metadata
                │───────────────│
                │ id (PK)       │
                │ video_chunk_id│
                │ offset_index  │
                │ timestamp     │
                │ app_name      │──┐  "Google Chrome"
                │ window_name   │  │
                │ focused       │  │
                └───────────────┘  │
                                   │
                                   │  FK: frame_id
                                   │
                              ┌────▼──────────┐
                              │   ocr_text    │  ← OCR extracted text
                              │───────────────│
                              │ frame_id      │
                              │ text          │  "Hello World Price: $99.99"
                              │ text_json     │  [{bbox, confidence, ...}]
                              │ app_name      │
                              │ window_name   │
                              │ focused       │
                              │ text_length   │
                              │ ocr_engine    │  "AppleNative"
                              └───────────────┘
```

### Audio Tables

```
┌─────────────────┐
│  audio_chunks   │  ← Audio file references (30s segments)
│─────────────────│
│ id (PK)         │
│ file_path       │
│ device_name     │
└─────────────────┘
         │
         │  FK: audio_chunk_id
         │
    ┌────▼──────────────────┐
    │ audio_transcriptions  │  ← Transcribed speech
    │───────────────────────│
    │ id (PK)               │
    │ audio_chunk_id        │
    │ transcription         │  "Let's meet at 3pm tomorrow"
    │ timestamp             │
    │ device                │  "MacBook Pro Microphone"
    │ is_input_device       │  true/false
    │ speaker_id            │  (optional)
    │ transcription_engine  │  "Whisper"
    │ start_time            │
    │ end_time              │
    │ text_length           │
    └───────────────────────┘
```

### UI Monitoring Table

```
┌─────────────────┐
│  ui_monitoring  │  ← macOS Accessibility API data
│─────────────────│
│ id (PK)         │
│ text_output     │  All UI text from app
│ timestamp       │
│ app             │  "Safari"
│ window          │  "Google - Search"
│ initial_traversal_at │
│ text_length     │
└─────────────────┘
```

### Full-Text Search (FTS5) Tables

For fast text search across all content:

- `ocr_text_fts` - Indexes OCR text
- `audio_transcriptions_fts` - Indexes audio transcriptions
- `ui_monitoring_fts` - Indexes UI monitoring text

---

## OCR vs UI Monitoring

### Side-by-Side Comparison

| Aspect | OCR (Vision) | UI Monitoring (Accessibility) |
|--------|--------------|-------------------------------|
| **Technology** | Computer Vision + ML | Accessibility APIs |
| **Input** | Screenshot images | UI element tree |
| **Platform** | All (macOS, Windows, Linux) | macOS only |
| **Default status** | ✓ Enabled | ✗ Disabled (`--enable-ui-monitoring`) |
| **Permissions** | Screen recording | Accessibility |
| **Performance** | Heavier (image processing) | Lighter (API calls) |
| **Accuracy** | ~95-99% (depends on image quality) | 100% (programmatic) |
| **Captures visible text** | ✓ Yes | ✓ Yes |
| **Captures hidden UI** | ✗ No | ✓ Yes |
| **Captures images** | ✓ Yes (as visual context) | ✗ No |
| **Text in images** | ✓ Can extract | ✗ Cannot extract |
| **Form field values** | ✓ If visible | ✓ Even if obscured |
| **Dropdown menus** | Only if expanded | ✓ All options |
| **Password fields** | ✗ Usually hidden | ⚠️ Can access (privacy risk) |
| **Bounding boxes** | ✓ Yes | ✗ No |
| **Element structure** | ✗ No | ✓ Yes (hierarchy) |

### Example Scenario: Browser Form

**Screen displays:**
```
┌────────────────────────────────┐
│  Registration Form             │
│                                │
│  Name: [John Doe        ]     │
│  Email: [john@example.com]    │
│  Country: [United States ▼]   │
│  [Submit]                      │
└────────────────────────────────┘
```

**OCR captures:**
```json
{
  "text": "Registration Form Name: John Doe Email: john@example.com Country: United States Submit",
  "bounding_boxes": [
    {"text": "Name:", "x": 10, "y": 50, "confidence": 0.98},
    {"text": "John Doe", "x": 100, "y": 50, "confidence": 0.99}
  ]
}
```

**UI Monitoring captures:**
```json
{
  "text_output": "StaticText: 'Registration Form' | TextField: 'Name' value='John Doe' | TextField: 'Email' value='john@example.com' | PopUpButton: 'Country' selectedItem='United States' items=[Afghanistan, Albania, ..., Zimbabwe (195 total)] | Button: 'Submit' enabled=true"
}
```

### When to Use Each

**Use OCR when:**
- ✓ You need visual context (images, graphics, layouts)
- ✓ You want to see exactly what was on screen
- ✓ Cross-platform compatibility needed
- ✓ Capturing non-UI text (PDFs, images, videos)

**Use UI Monitoring when:**
- ✓ You need complete UI element coverage
- ✓ Maximum accuracy is required
- ✓ You want hidden/collapsed UI data
- ✓ You need structured UI hierarchy
- ✓ macOS only is acceptable

**Use Both when:**
- ✓ Maximum data coverage needed
- ✓ Visual + programmatic context desired
- ✓ High-accuracy search is critical

---

## Audio Capture

### How Audio Recording Works

```
┌─────────────────────────────────────────────────────────┐
│                    AUDIO PIPELINE                        │
└─────────────────────────────────────────────────────────┘

Step 1: Audio Device Selection
┌─────────────────────────────────────┐
│ Input Devices (Microphone)          │  ← Your voice
│ - MacBook Pro Microphone            │
│ - External USB mic                  │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ Output Devices (System Audio)       │  ← Everything you hear
│ - Display 1 (speakers)              │  • YouTube videos
│ - Headphones                        │  • Zoom/Teams meetings
│ - AirPods                           │  • Music/podcasts
└─────────────────────────────────────┘

                ↓

Step 2: Voice Activity Detection (VAD)
┌─────────────────────────────────────┐
│ Analyze audio for speech            │
│ - Silero VAD (default)              │
│ - WebRTC VAD (alternative)          │
│                                     │
│ Threshold: 5% speech ratio          │
│ (configurable via --vad-sensitivity)│
└─────────────────────────────────────┘

    ↓ Speech detected?

    NO → Discard audio chunk (no transcription)
    YES ↓

Step 3: Transcription
┌─────────────────────────────────────┐
│ Convert speech to text              │
│ - Whisper (local, default)          │
│ - Deepgram (cloud, high quality)    │
└─────────────────────────────────────┘

                ↓

Step 4: Database Storage
┌─────────────────────────────────────┐
│ audio_transcriptions table          │
│ - Transcribed text                  │
│ - Device name                       │
│ - Timestamp                         │
│ - Speaker ID (optional)             │
└─────────────────────────────────────┘
```

### Why You Might Have 0 Audio Transcriptions

Common reasons:

1. **No speech detected** - Only music, silence, or background noise
2. **VAD threshold not met** - Speech < 5% of audio chunk
3. **No audio playing** - Computer was silent during recording
4. **Audio disabled** - `--disable-audio` flag used

### What Audio Captures

**✓ Records from:**
- YouTube videos with dialogue
- Zoom/Teams/Google Meet calls
- Podcasts and audiobooks
- System notifications with speech
- Music with lyrics (if VAD detects it as speech)
- Your microphone input

**✗ Does NOT record (or doesn't transcribe):**
- Pure instrumental music
- Silence
- Background noise without speech
- Audio below VAD threshold

### Audio Device Configuration

**Default behavior:**
- Records from ALL available audio devices (input + output)

**Specify devices:**
```bash
# Record from specific devices
screenpipe --audio-device "MacBook Pro Microphone (input)" \
           --audio-device "Display 1 (output)"

# Disable audio completely
screenpipe --disable-audio
```

**List available devices:**
```bash
screenpipe # Check logs for available devices
```

---

## Storage Considerations

### Typical Storage Usage

Based on default settings (0.5 FPS on macOS, 30s audio chunks):

**Example from actual usage (393,643 frames):**

| Component | Size | Details |
|-----------|------|---------|
| Video files (data/) | ~17 GB | H.265 compressed MP4s |
| Database (db.sqlite) | ~3.4 GB | OCR text, metadata, indexes |
| **Total** | **~20 GB** | For ~4 months of usage |

### Storage Estimation

**Video storage:**
```
1 FPS = ~30 GB/month (more screen changes)
0.5 FPS = ~15 GB/month (default macOS)
0.2 FPS = ~6 GB/month (minimal usage)
```

**Database storage:**
```
~20% of video size for OCR + metadata
More text = larger database
```

### Storage Location

```
~/.screenpipe/
├── data/                          # Video files
│   ├── monitor_1_2025-11-29_*.mp4
│   └── monitor_3_2025-11-29_*.mp4
├── db.sqlite                      # Main database (3.4 GB)
├── db.sqlite-shm                  # Shared memory
├── db.sqlite-wal                  # Write-ahead log
└── pipes/                         # IPC named pipes
```

### Retention and Cleanup

**Manual cleanup:**
```bash
# Delete old video files
find ~/.screenpipe/data -name "*.mp4" -mtime +30 -delete

# Database cleanup (requires custom queries)
sqlite3 ~/.screenpipe/db.sqlite "DELETE FROM frames WHERE timestamp < datetime('now', '-30 days');"
```

**Note:** Deleting video files will break frame references in database. Consider implementing a proper retention policy.

---

## Summary

### Quick Reference

**Data Sources:**
1. **OCR (Vision)** - ✓ Enabled - Screenshots + text extraction
2. **UI Monitoring** - ✗ Disabled - macOS Accessibility API (opt-in)
3. **Audio** - ✓ Enabled - System audio + mic + transcription

**Storage:**
- Video files in `~/.screenpipe/data/` (visual content)
- SQLite database in `~/.screenpipe/db.sqlite` (searchable text)
- NOT duplicated - complementary storage

**Key Relationships:**
```
video_chunks → frames → ocr_text
audio_chunks → audio_transcriptions
ui_monitoring (standalone)
```

**Search capabilities:**
- Full-text search via FTS5 indexes
- Temporal queries (find text at specific time)
- App/window filtering
- Cross-reference visual + audio data

---

## Configuration Examples

### Minimal Storage Mode
```bash
screenpipe --fps 0.2 \
           --disable-audio \
           --disable-ui-monitoring
```

### Maximum Coverage Mode
```bash
screenpipe --fps 1.0 \
           --enable-ui-monitoring \
           --audio-transcription-engine deepgram \
           --capture-unfocused-windows
```

### Privacy-Focused Mode
```bash
screenpipe --fps 0.5 \
           --disable-audio \
           --use-pii-removal \
           --ignored-windows "Password" "Bank" "Private"
```

---

## Additional Resources

- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Detailed table schemas
- [screenpipe-vision/](./screenpipe-vision/) - OCR implementation
- [screenpipe-audio/](./screenpipe-audio/) - Audio capture implementation
- [screenpipe-db/](./screenpipe-db/) - Database layer

---

**Last Updated:** 2025-11-29
**Version:** Based on screenpipe main branch
