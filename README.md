# PitchPractice V1

A web application for practicing and improving pitch presentations. Record or upload audio pitches, get transcripts, and receive feedback based on customizable rubrics.

## Features

- **Record or Upload Audio**: Record directly in the browser or upload an audio file
- **Anonymous Sessions**: No authentication required - uses localStorage-based session IDs
- **Rubric-Based Analysis**: Select from available rubrics to evaluate your pitch
- **Supabase Storage**: Secure audio file storage with signed URLs for playback
- **Audio Transcription**: Automatic transcription using OpenAI Whisper API
- **Timing Analysis**: Calculate duration, word count, and words-per-minute (WPM)
- **AI-Powered Feedback**: Rubric-based analysis with quote-cited, actionable feedback
- **Detailed Scoring**: Overall scores, rubric-specific scores, and line-by-line commentary
- **Clean UI**: Minimal, modern interface built with Tailwind CSS

## Tech Stack

- **Next.js 14+** with App Router
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (Database + Storage)
- **OpenAI Whisper API** (Audio Transcription)

## Prerequisites

- Node.js 18+ installed
- A Supabase project (free tier works)
- npm or yarn package manager

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Run the migration files in order:
   - First: `supabase/migrations/001_initial_schema.sql`
     - Creates the `pitch_runs` and `rubrics` tables
     - Seeds a default rubric: "General Pitch (3–5 min)"
   - Second: `supabase/migrations/002_add_timing_fields.sql`
     - Adds `word_count` and `words_per_minute` fields to `pitch_runs`

### 3. Create Storage Bucket

**IMPORTANT**: The bucket must exist before uploading files.

**Option A: Via Dashboard (Recommended)**
1. In Supabase dashboard, go to **Storage**
2. Click **"New bucket"** or **"Create bucket"**
3. Configure:
   - **Name**: `pitchpractice-audio` (exact match, case-sensitive)
   - **Public**: `false` (must be Private)
   - **File size limit**: `52428800` (50 MB) - optional
4. Click **"Create bucket"**

**Option B: Via Script**
```bash
# Set environment variables first
export NEXT_PUBLIC_SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"

# Run the setup script
npx tsx scripts/create-bucket.ts
```

**Verification**: Go to Storage → You should see `pitchpractice-audio` listed as Private.

> **Note**: The app will attempt to auto-create the bucket if missing, but manual creation is more reliable.

### 4. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Fill in your credentials:
   - **Supabase**: Go to **Settings** → **API** in your Supabase dashboard
     - Copy your **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     - Copy your **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Copy your **service_role key** (keep this secret!) → `SUPABASE_SERVICE_ROLE_KEY`
   - **OpenAI**: Get your API key from [platform.openai.com](https://platform.openai.com/api-keys)
     - Copy your **API key** → `OPENAI_API_KEY` (server-only, never exposed to client)

   Your `.env.local` should look like:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   OPENAI_API_KEY=sk-your-openai-key-here
   ```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
PitchPractice/
├── app/
│   ├── api/
│   │   ├── runs/
│   │   │   ├── create/route.ts      # POST endpoint for creating runs
│   │   │   └── [id]/route.ts        # GET endpoint for fetching run details
│   │   └── rubrics/route.ts         # GET endpoint for fetching rubrics
│   ├── runs/
│   │   └── [id]/page.tsx            # Results page for a specific run
│   ├── globals.css                  # Global styles with Tailwind
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Home page (record/upload)
├── lib/
│   ├── session.ts                   # Session ID management (localStorage)
│   └── supabase/
│       ├── client.ts                # Client-side Supabase client
│       └── server.ts                # Server-side Supabase client (service role)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   # Database schema migration
└── README.md
```

## Database Schema

### `pitch_runs` Table
- `id` (uuid): Primary key
- `session_id` (text): Anonymous session identifier
- `created_at` (timestamptz): Creation timestamp
- `title` (text, nullable): Optional title for the pitch
- `audio_path` (text): Path to audio file in storage
- `audio_seconds` (numeric, nullable): Duration of audio in seconds
- `transcript` (text, nullable): Transcribed text from audio
- `word_count` (integer, nullable): Number of words in transcript
- `words_per_minute` (numeric, nullable): Calculated WPM (word_count / duration * 60)
- `analysis_json` (jsonb, nullable): Analysis results
- `status` (text): `uploaded` | `transcribed` | `analyzed` | `error` (workflow: uploaded → transcribed → analyzed)
- `error_message` (text, nullable): Error details if status is `error`
- `rubric_id` (uuid): Foreign key to `rubrics` table

### `rubrics` Table
- `id` (uuid): Primary key
- `name` (text): Rubric name
- `description` (text, nullable): Rubric description
- `criteria` (jsonb): Array of criteria objects
- `target_duration_seconds` (integer, nullable): Target duration
- `max_duration_seconds` (integer, nullable): Maximum duration
- `created_at` (timestamptz): Creation timestamp

## API Endpoints

### `POST /api/runs/create`
Creates a new pitch run and uploads audio to storage.

**Request:**
- `multipart/form-data` with:
  - `audio` (File): Audio file
  - `rubric_id` (string): Selected rubric ID
  - `session_id` (string): Session ID from localStorage
  - `title` (string, optional): Optional title

**Response:**
```json
{
  "id": "run-uuid"
}
```

### `GET /api/runs/[id]`
Fetches run details including signed audio URL.

**Response:**
```json
{
  "id": "uuid",
  "session_id": "string",
  "title": "string | null",
  "audio_path": "string",
  "audio_url": "string | null",
  "status": "string",
  "transcript": "string | null",
  "analysis_json": {} | null,
  "rubrics": { ... }
}
```

### `POST /api/runs/[id]/transcribe`
Transcribes audio using OpenAI Whisper and calculates timing metrics.

**Response:**
```json
{
  "success": true,
  "transcript": "Transcribed text...",
  "audio_seconds": 120.5,
  "word_count": 180,
  "wpm": 90
}
```

### `POST /api/runs/[id]/analyze`
Generates rubric-based AI feedback using OpenAI GPT-4. Requires transcript and rubric.

**Response:**
```json
{
  "success": true,
  "analysis": {
    "summary": {
      "overall_score": 8,
      "overall_notes": "...",
      "top_strengths": ["..."],
      "top_improvements": ["..."]
    },
    "rubric_scores": [
      {
        "criterion": "Hook/Opening",
        "score": 9,
        "notes": "..."
      }
    ],
    "line_by_line": [
      {
        "quote": "excerpt from transcript",
        "type": "praise|issue|suggestion",
        "comment": "...",
        "action": "...",
        "priority": "high|medium|low"
      }
    ],
    "pause_suggestions": [...],
    "cut_suggestions": [...]
  }
}
```

### `GET /api/rubrics`
Fetches all available rubrics.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "description": "string | null",
    "criteria": [...],
    "target_duration_seconds": 240,
    "max_duration_seconds": 360
  }
]
```

## Workflow

1. **Upload/Record** → Creates a run with status `uploaded`
2. **Transcribe** → Calls OpenAI Whisper API, updates status to `transcribed`, stores transcript and timing metrics
3. **Analyze** → Calls OpenAI GPT-4, updates status to `analyzed`, stores structured feedback in `analysis_json`

The UI auto-starts transcription when viewing an `uploaded` run, and auto-starts analysis when viewing a `transcribed` run (or you can click the buttons manually).

## Security Notes

- **Service Role Key**: The `SUPABASE_SERVICE_ROLE_KEY` is only used server-side and never exposed to the client
- **OpenAI API Key**: The `OPENAI_API_KEY` is only used server-side and never exposed to the client
- **Storage**: Audio files are stored in a private bucket and accessed via signed URLs
- **No Auth**: V1 uses anonymous session IDs stored in localStorage (no user accounts)

## Future Enhancements (Post-V1)

- Audio transcription integration
- AI-powered analysis and feedback
- Multiple rubric support
- User authentication
- Run history and analytics
- Export functionality

## Troubleshooting

### "Missing Supabase environment variables"
- Ensure `.env.local` exists and contains all three required variables
- Restart the dev server after adding environment variables

### "Failed to upload audio file"
- Verify the `pitchpractice-audio` bucket exists in Supabase Storage
- Check that the bucket is set to private
- Ensure service role key has proper permissions

### "Failed to create run record"
- Run the database migration SQL file in Supabase SQL Editor
- Verify tables `pitch_runs` and `rubrics` exist

## License

MIT

