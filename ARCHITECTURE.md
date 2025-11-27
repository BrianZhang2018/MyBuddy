# Screenpipe Architecture

## Overview

Screenpipe is a 24/7 local screen and audio recording system designed to capture desktop activity for AI-powered applications. Built with a **local-first philosophy**, it ensures complete data privacy while providing powerful search and analysis capabilities.

**Design Philosophy:**
- **Local-First**: All processing happens on-device by default
- **Modular**: Clean separation of concerns across specialized crates
- **Extensible**: Plugin system (pipes) for custom functionality
- **Cross-Platform**: Supports macOS, Windows, and Linux

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Activity (Screen + Audio)                │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼─────┐                   ┌────▼─────┐
    │  Vision  │                   │  Audio   │
    │ Capture  │                   │ Capture  │
    └────┬─────┘                   └────┬─────┘
         │                               │
    [OCR Engine]                    [VAD + STT]
         │                               │
         └───────────────┬───────────────┘
                         │
                  ┌──────▼──────┐
                  │ screenpipe  │
                  │   -server   │
                  │  (Axum API) │
                  └──────┬──────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼─────┐   ┌────▼─────┐   ┌────▼─────┐
    │ SQLite + │   │   HTTP   │   │WebSocket │
    │  Vector  │   │    API   │   │  Events  │
    │  Search  │   │          │   │          │
    └──────────┘   └────┬─────┘   └────┬─────┘
                        │              │
         ┌──────────────┴──────┬───────┘
         │                     │
    ┌────▼─────┐         ┌────▼─────┐
    │  Tauri   │         │  Pipes   │
    │ Desktop  │         │ (Plugins)│
    │   App    │         │          │
    └──────────┘         └──────────┘
```

**Architecture Pattern**: Event-driven, modular monorepo with async-first design using a client-server model.

## Core Components

Screenpipe is organized as a Rust workspace with 8 core crates:

### 1. **screenpipe-vision** ([screenpipe-vision/src/core.rs](screenpipe-vision/src/core.rs))
Handles continuous screen capture and OCR processing.

- **Capture**: Multi-monitor screenshots via `xcap` library (configurable FPS, default 1.0)
- **OCR Engines**: Platform-specific text extraction
  - macOS: Apple Vision Framework
  - Windows: Windows.Media.Ocr
  - Linux/Fallback: Tesseract
  - Cloud: Unstructured API
- **Features**: Window tracking, browser URL extraction, UI element monitoring (macOS), image deduplication

### 2. **screenpipe-audio** ([screenpipe-audio/src/audio_manager](screenpipe-audio/src/audio_manager))
Manages audio capture and transcription.

- **Capture**: Multi-device audio I/O via `cpal`
- **Processing Pipeline**:
  - VAD (Voice Activity Detection): Filters silence
  - STT (Speech-to-Text): Whisper (local) or Deepgram (cloud)
  - Speaker Identification: Embedding-based voice profiles
- **Features**: Realtime transcription, speaker segmentation, device hot-swap support

### 3. **screenpipe-server** ([screenpipe-server/src/bin/screenpipe-server.rs](screenpipe-server/src/bin/screenpipe-server.rs))
HTTP/WebSocket API server and recording orchestration.

- **Framework**: Axum web server with Tokio async runtime
- **Key Endpoints**: `/search`, `/audio/list`, `/vision/list`, `/pipes/*`, `/raw/*`
- **Features**: WebSocket events, CORS support, resource monitoring, graceful shutdown

### 4. **screenpipe-db** ([screenpipe-db/src/db.rs](screenpipe-db/src/db.rs))
SQLite database with full-text and vector search.

- **Storage**: SQLite with WAL mode for concurrency
- **Search**: FTS5 (full-text) + sqlite-vec (vector similarity)
- **Schema**: video_chunks → frames → ocr_text; audio_chunks → audio_transcriptions; speakers → speaker_embeddings

### 5. **screenpipe-core**
Shared utilities and cross-cutting concerns.

- FFmpeg integration for video processing
- Language configs and PII removal
- LLM support (optional) and embeddings
- Common types and error handling

### 6. **screenpipe-events**
Event bus for inter-component communication.

- Publish-subscribe pattern via Tokio broadcast channels
- Event types: vision frames, audio transcriptions, UI updates

### 7. **screenpipe-app-tauri** ([screenpipe-app-tauri/src-tauri/src/main.rs](screenpipe-app-tauri/src-tauri/src/main.rs))
Desktop application with Next.js frontend.

- **Tech Stack**: Tauri 2 + Next.js 15 + React + TypeScript
- **Features**: Settings UI, search interface, pipe management, system tray, auto-updates

### 8. **screenpipe-integrations**
External service integrations.

- MCP (Model Context Protocol) server for AI assistants
- Cloud OCR services (Unstructured API)

## Data Flow

### Vision Pipeline
```
Screen Capture (xcap)
        ↓
   Multi-monitor
    Screenshots
        ↓
   OCR Processing ──→ [Apple Vision / Windows OCR / Tesseract]
        ↓
   Text Extraction
   (with bounding boxes)
        ↓
   Deduplication ──→ Compare with previous frame
        ↓
   SQLite Storage
   video_chunks → frames → ocr_text
        ↓
   FTS5 Indexing
```

### Audio Pipeline
```
Audio Capture (cpal)
        ↓
   Multi-device
   Audio Streams
        ↓
   VAD (Voice Activity Detection)
        ↓
   Audio Chunks (30s default)
        ↓
   Speaker Segmentation
        ↓
   STT Processing ──→ [Whisper / Deepgram]
        ↓
   Speaker Identification ──→ Embedding similarity
        ↓
   SQLite Storage
   audio_chunks → audio_transcriptions
        ↓
   FTS5 Indexing
```

### API Request Flow
```
Client Request
    ↓
Axum Router
    ↓
Auth/CORS Middleware
    ↓
Query Parser (search params)
    ↓
DatabaseManager
    ↓
SQLite Query
  ├─ Full-Text Search (FTS5)
  └─ Vector Search (sqlite-vec)
    ↓
Result Serialization (JSON)
    ↓
HTTP Response
```

## Technology Stack

### Languages
- **Rust**: Core system (vision, audio, server, database)
- **TypeScript/JavaScript**: Frontend and plugins
- **Swift**: macOS UI monitoring
- **SQL**: Database schemas and queries

### Key Frameworks & Libraries

**Backend:**
- **Axum**: HTTP/WebSocket server
- **Tokio**: Async runtime
- **SQLx**: Type-safe SQL queries
- **xcap**: Screen capture
- **cpal**: Audio I/O
- **FFmpeg**: Video encoding

**AI/ML:**
- **Whisper**: Local speech recognition
- **Candle**: ML framework (Hugging Face)
- **ONNX Runtime**: Speaker embeddings
- **sqlite-vec**: Vector search extension

**Frontend:**
- **Tauri 2**: Desktop app framework
- **Next.js 15**: React framework
- **Radix UI**: Component library

## Storage Architecture

### File System Structure
```
~/.screenpipe/
├── data/
│   ├── *.mp4          # Video chunks
│   ├── *.wav          # Audio chunks
│   └── *.db           # Embeddings cache
├── db.sqlite          # Main database
├── logs/              # Application logs
└── pipes/             # Plugin installations
```

### Database Schema (Simplified)

**Vision Tables:**
```sql
video_chunks (id, file_path, device_name, timestamp)
    ↓
frames (id, video_chunk_id, offset_index, timestamp, app_name)
    ↓
ocr_text (frame_id, text, text_json, window_name, browser_url)
```

**Audio Tables:**
```sql
audio_chunks (id, file_path, timestamp)
    ↓
audio_transcriptions (id, audio_chunk_id, transcription,
                      speaker_id, device, start_time, end_time)
    ↓
speakers (id, name, metadata)
    ↓
speaker_embeddings (id, speaker_id, embedding [vec_f32])
```

**Search Features:**
- **FTS5**: Full-text search on `ocr_text.text` and `audio_transcriptions.transcription`
- **Vector Search**: Cosine similarity on `speaker_embeddings.embedding`
- **Connection Pooling**: 3-50 connections based on workload

### Performance Characteristics
- **CPU Usage**: ~10% average
- **RAM Usage**: ~4 GB
- **Storage**: ~15 GB/month (adjustable quality settings)

## API & Integration

### REST Endpoints

**Search & Data Access:**
- `GET /search` - Full-text and vector search with filters (time range, content type, app name)
- `GET /raw/frames` - Time-series frame data
- `GET /raw/audio` - Time-series audio data

**Device Management:**
- `GET /audio/list` - List audio devices
- `GET /vision/list` - List monitors

**Plugin Management:**
- `GET /pipes/list` - List installed pipes
- `POST /pipes/enable` - Enable a pipe
- `POST /pipes/download` - Install pipe from store

**Metadata:**
- `GET /tags` - Content tags
- `GET /speakers` - Speaker profiles

### WebSocket Events
Real-time subscriptions for:
- New vision frames
- Audio transcriptions
- UI monitoring updates

### Authentication
Optional authentication via API keys (configurable in settings).

## Plugin System (Pipes)

Pipes are Next.js applications that extend screenpipe functionality.

**Architecture:**
```
Pipe (Next.js App)
        ↓
   Isolated Process
        ↓
   HTTP API Calls ──→ screenpipe-server
        ↓
   Custom Logic
   (meeting notes, automation, etc.)
```

**Key Features:**
- **Sandboxed Execution**: Each pipe runs in its own process
- **API-Based**: Communicate via screenpipe HTTP API
- **Lifecycle Management**: Enable/disable/configure via UI
- **Monetization**: Stripe integration for paid pipes
- **SDK**: TypeScript SDK for pipe development

**Example Pipes:**
- Meeting transcription and notes
- Browser automation
- Notion/Obsidian sync
- Custom AI workflows

## Getting Started

### Entry Points

**CLI Binary:**
[screenpipe-server/src/bin/screenpipe-server.rs](screenpipe-server/src/bin/screenpipe-server.rs)

```bash
screenpipe-server [OPTIONS]
```

**Desktop App:**
[screenpipe-app-tauri/src-tauri/src/main.rs](screenpipe-app-tauri/src-tauri/src/main.rs)

Starts the Tauri app which launches `screenpipe-server` as a sidecar process.

### Build Configuration

**Platform Support:**
- macOS (Apple Silicon + Intel)
- Windows (x64)
- Linux (x64, ARM64)

**Feature Flags:**
```toml
metal = []        # macOS GPU acceleration
cuda = []         # NVIDIA GPU support
mkl = []          # Intel MKL optimization
llm = []          # Local LLM support (experimental)
```

**Workspace:** [Cargo.toml](Cargo.toml)

All crates are organized in a unified Rust workspace for shared dependencies and consistent builds.

### Key Development Files

- [Cargo.toml](Cargo.toml) - Workspace definition
- [screenpipe-server/src/bin/screenpipe-server.rs](screenpipe-server/src/bin/screenpipe-server.rs) - Main entry point
- [screenpipe-vision/src/core.rs](screenpipe-vision/src/core.rs) - Vision capture loop
- [screenpipe-audio/src/audio_manager](screenpipe-audio/src/audio_manager) - Audio processing
- [screenpipe-db/src/db.rs](screenpipe-db/src/db.rs) - Database layer

## Security & Privacy

**Local-First Design:**
- All screen and audio processing happens on your device
- Data stored locally in `~/.screenpipe/`
- No telemetry or data sharing by default

**Optional Cloud Services:**
- Deepgram: Cloud speech-to-text (explicit opt-in)
- Unstructured: Cloud OCR (explicit opt-in)
- Sentry: Error tracking (optional)
- PostHog: Analytics (optional)

**Privacy Features:**
- PII (Personally Identifiable Information) removal
- User owns all data
- macOS/Windows permissions required for screen/mic access
- Sandboxed pipe execution

**Data Control:**
- Configurable retention policies
- Delete functionality
- Export capabilities

## Contributing

For development setup and contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

**Architecture Principles:**
1. **Separation of Concerns**: Each crate has a single, well-defined responsibility
2. **Async-First**: Leverage Tokio for concurrent operations
3. **Type Safety**: Use Rust's type system to prevent bugs
4. **Modularity**: Components communicate via well-defined interfaces (events, APIs)
5. **Performance**: Optimize for continuous background operation with minimal resource usage

---

**Additional Resources:**
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide
- [content/diagram2.png](content/diagram2.png) - Visual architecture diagram
