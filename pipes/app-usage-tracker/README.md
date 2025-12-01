# App Usage Tracker

AI-powered app usage tracking with behavioral insights and goal management.

## Features

- 📊 **Detailed Usage Tracking**: Track time spent in each application
- 🎯 **Goal Management**: Set and track personal goals
- 🤖 **AI Behavioral Analysis**: Get insights powered by Google Gemini
- 📈 **Progress Tracking**: Monitor alignment with your goals
- 💡 **Smart Recommendations**: Receive actionable suggestions
- 🎨 **Content Categorization**: Deep dive into YouTube viewing patterns

## Setup

### 1. Install Dependencies

```bash
cd /Users/brianzhang/.screenpipe/pipes/app-usage-tracker
bun install
# or: npm install
```

### 2. Configure Environment

Create `.env.local` file:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

Get a free Gemini API key from: https://ai.google.dev/

### 3. Run Development Server

```bash
bun dev
# or: npm run dev
```

Open http://localhost:21563

## Usage

### Setting Goals

1. Click "+ Add Goal" button
2. Enter goal description (e.g., "Limit YouTube to 2 hours per day")
3. Select goal type, target hours, and period
4. Set priority level

### Viewing Analytics

- **Summary**: Total screen time, most used app, active apps
- **Top Applications**: Ranked list with usage percentages
- **AI Analysis**: Goal alignment score and behavioral patterns
- **Recommendations**: Prioritized actions to improve habits

### AI Insights

The AI analyzes your usage patterns and provides:
- Goal alignment score (0-100%)
- Positive and negative patterns
- Specific recommendations
- Weekly trend analysis

## How It Works

### Data Collection

The pipe queries screenpipe's SQLite database:
- Reads from `frames` table for app usage
- Joins with `ocr_text` for content analysis
- Calculates duration based on frame counts (0.5 FPS = 2 sec/frame)

### Content Categorization

YouTube videos are automatically categorized:
- Soccer videos
- Travel videos
- Tech reviews
- Gaming
- Music

Categories are detected using:
- Window title analysis
- OCR text keyword matching
- Pattern recognition

### AI Analysis

Gemini AI processes your usage data and goals to provide:
- Behavioral pattern recognition
- Goal progress assessment
- Personalized recommendations
- Trend analysis

## API Endpoints

- `GET /api/usage?timeRange=today` - Get app usage statistics
- `GET /api/categories?app=Chrome&timeRange=today` - Get content categories
- `POST /api/ai-analysis` - Get AI behavioral analysis
- `GET /api/goals` - Get user goals
- `POST /api/goals` - Create new goal
- `DELETE /api/goals?id=xxx` - Delete goal

## Configuration

### Time Ranges

- `today`: Current day
- `yesterday`: Previous day
- `week`: Last 7 days
- `month`: Last 30 days

### Goal Types

- `screen_time`: Total screen time limits
- `app_limit`: Specific app usage limits
- `focus_time`: Minimum focus time goals
- `content_limit`: Content category limits (e.g., YouTube)
- `custom`: Custom goals

## Development

### File Structure

```
app-usage-tracker/
├── app/
│   ├── api/          # API routes
│   ├── layout.tsx    # Root layout
│   ├── page.tsx      # Main dashboard
│   └── globals.css   # Global styles
├── lib/
│   ├── queries.ts    # Database queries
│   ├── gemini.ts     # AI integration
│   ├── categorization.ts  # Content categorization
│   ├── storage.ts    # Goal storage
│   └── utils.ts      # Utilities
├── package.json
├── pipe.json
└── tsconfig.json
```

### Adding New Categories

Edit `lib/categorization.ts`:

```typescript
export const YOUTUBE_CATEGORIES: CategoryRule[] = [
  {
    name: "Your Category",
    keywords: ["keyword1", "keyword2"],
    windowPatterns: [/pattern1/i, /pattern2/i]
  },
  // ... more categories
];
```

## Troubleshooting

### No data showing

- Ensure screenpipe is running: `ps aux | grep screenpipe`
- Check database has data: `sqlite3 ~/.screenpipe/db.sqlite "SELECT COUNT(*) FROM frames;"`
- Verify FPS is configured (default 0.5 FPS on macOS)

### AI analysis not working

- Check GEMINI_API_KEY is set in `.env.local`
- Verify API key is valid: https://ai.google.dev/
- Check console for error messages
- Ensure goals are set before requesting analysis

### Port already in use

Change port in `pipe.json`:
```json
{
  "port": 21564
}
```

## Credits

Built with:
- Next.js 15
- Google Gemini AI
- Tailwind CSS
- Screenpipe

## License

MIT
