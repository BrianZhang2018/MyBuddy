# App Usage Tracker Pipe - Design Plan

## Overview

Convert the test-pipe into a comprehensive app usage tracking pipe that provides detailed analytics about how you spend time on your computer, with deep insights into content consumption patterns.

---

## Features

### 1. **App-Level Usage Tracking**
Track total time spent in each application:
- Chrome: 10 hours
- VS Code: 8 hours
- Zoom: 2 hours
- etc.

### 2. **Content-Level Insights** (YouTube Example)
Drill down into specific content categories:
- **YouTube Total**: 10 hours
  - Soccer videos: 5 hours
  - Travel videos: 4 hours
  - Tech reviews: 1 hour

### 3. **Window-Level Tracking**
Track different windows/tabs within apps:
- Chrome tabs by domain
- Multiple VS Code projects
- Different Slack workspaces

### 4. **Time Range Analysis**
- Today
- This week
- This month
- Custom date range

### 5. **Visualizations**
- Pie charts for app distribution
- Bar charts for time trends
- Timeline view of daily activity
- Category breakdowns

---

## Data Sources

### From Screenpipe Database

The pipe will query screenpipe's OCR data:

```sql
-- Get app usage duration
SELECT
  f.app_name,
  COUNT(*) as frame_count,
  COUNT(*) * (1.0 / fps) as duration_seconds,
  MIN(f.timestamp) as first_seen,
  MAX(f.timestamp) as last_seen
FROM frames f
WHERE datetime(f.timestamp) >= datetime('now', '-24 hours')
GROUP BY f.app_name
ORDER BY duration_seconds DESC;
```

```sql
-- Get YouTube video categories (from OCR text + window names)
SELECT
  f.window_name,
  o.text,
  f.timestamp,
  COUNT(*) as frame_count
FROM frames f
JOIN ocr_text o ON f.frame_id = o.id
WHERE f.app_name = 'Google Chrome'
  AND (f.window_name LIKE '%YouTube%' OR o.text LIKE '%YouTube%')
  AND datetime(f.timestamp) >= datetime('now', '-24 hours')
GROUP BY f.window_name
ORDER BY frame_count DESC;
```

---

## UI Design

### Dashboard Layout

```
┌────────────────────────────────────────────────────────────────┐
│                    APP USAGE TRACKER                           │
│                                                                 │
│  Time Range: [Today ▼]  [Refresh]                             │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  SUMMARY                                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  Total Screen Time: 12h 34m                                    │
│  Most Used App: Google Chrome (6h 12m)                         │
│  Active Apps: 8                                                │
│  Focus Time: 4h 23m (no app switching)                         │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  TOP APPLICATIONS                                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  1. Google Chrome        ████████████████████ 6h 12m  (49%)   │
│  2. VS Code             ████████████████     4h 20m  (34%)   │
│  3. Zoom                ████                 1h 05m  (8%)    │
│  4. Slack               ███                  45m     (6%)    │
│  5. Terminal            ██                   20m     (3%)    │
│                                                                 │
│  [View All Apps →]                                             │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  CONTENT BREAKDOWN: GOOGLE CHROME                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  📺 YouTube (3h 45m)                                           │
│     ⚽ Soccer videos      ████████████ 2h 10m  (58%)          │
│     ✈️  Travel videos      ███████       1h 20m  (36%)          │
│     🎮 Gaming             █            15m     (6%)           │
│                                                                 │
│  💼 Work/Productivity (2h 27m)                                 │
│     📧 Gmail              ██████       1h 30m  (61%)          │
│     📝 Google Docs        ████         45m     (31%)          │
│     📊 Sheets             █            12m     (8%)           │
│                                                                 │
│  [View Details →]                                              │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  TIMELINE                                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  9am   Chrome ████████ VS Code ████                           │
│  10am  VS Code ████████████████                               │
│  11am  VS Code ████████ Chrome ████████                       │
│  12pm  Chrome ████████████ (YouTube - Soccer)                 │
│  1pm   Slack ████ Zoom ████████████                          │
│  2pm   Zoom ████████████████                                  │
│  ...                                                           │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  INSIGHTS & RECOMMENDATIONS                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  💡 You spent 3h 45m on YouTube today (+45m vs yesterday)      │
│  💡 Peak productivity: 10-11am (no app switching)              │
│  💡 Most common distraction: YouTube soccer videos             │
│  ⚠️  Notification: Screen time exceeds 10h goal               │
└────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Directory Structure

```
app-usage-tracker/
├── app/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Main dashboard
│   ├── api/
│   │   ├── usage/
│   │   │   └── route.ts     # API endpoint for usage data
│   │   ├── categories/
│   │   │   └── route.ts     # API for content categorization
│   │   └── settings/
│   │       └── route.ts     # Settings API
│   └── globals.css
├── components/
│   ├── UsageSummary.tsx     # Summary cards
│   ├── AppList.tsx          # Top applications list
│   ├── ContentBreakdown.tsx # Detailed content analysis
│   ├── Timeline.tsx         # Timeline visualization
│   ├── Charts.tsx           # Chart components
│   └── Insights.tsx         # AI-powered insights
├── lib/
│   ├── queries.ts           # SQL queries
│   ├── categorization.ts    # Content categorization logic
│   └── utils.ts             # Utility functions
├── package.json
├── pipe.json                # Pipe configuration
├── next.config.mjs
└── tsconfig.json
```

### API Endpoints

#### 1. `/api/usage` - Get usage statistics

**Request:**
```typescript
GET /api/usage?timeRange=today
```

**Response:**
```typescript
{
  "summary": {
    "totalScreenTime": 45240,  // seconds
    "mostUsedApp": {
      "name": "Google Chrome",
      "duration": 22320
    },
    "activeApps": 8,
    "focusTime": 15780
  },
  "apps": [
    {
      "name": "Google Chrome",
      "duration": 22320,
      "percentage": 49.3,
      "frameCount": 11160,
      "windows": [
        {
          "title": "YouTube - Soccer Highlights",
          "duration": 7800,
          "category": "entertainment"
        }
      ]
    }
  ]
}
```

#### 2. `/api/categories` - Get content categorization

**Request:**
```typescript
GET /api/categories?app=Google Chrome&timeRange=today
```

**Response:**
```typescript
{
  "app": "Google Chrome",
  "categories": [
    {
      "name": "YouTube",
      "duration": 13500,
      "subcategories": [
        {
          "name": "Soccer videos",
          "duration": 7800,
          "keywords": ["premier league", "goals", "highlights"],
          "windows": ["YouTube - Premier League Highlights", ...]
        },
        {
          "name": "Travel videos",
          "duration": 4800,
          "keywords": ["travel", "vlog", "japan"],
          "windows": ["YouTube - Tokyo Travel Guide", ...]
        }
      ]
    },
    {
      "name": "Work/Productivity",
      "duration": 8820,
      "subcategories": [...]
    }
  ]
}
```

---

## Implementation Details

### 1. Data Collection Query

```typescript
// lib/queries.ts

export async function getAppUsage(timeRange: string) {
  const timeCondition = getTimeCondition(timeRange);

  const query = `
    SELECT
      f.app_name,
      f.window_name,
      COUNT(*) as frame_count,
      COUNT(*) * 2.0 as duration_seconds,  -- 0.5 FPS = 2 seconds per frame
      MIN(f.timestamp) as first_seen,
      MAX(f.timestamp) as last_seen,
      f.focused
    FROM frames f
    WHERE ${timeCondition}
    GROUP BY f.app_name, f.window_name
    ORDER BY frame_count DESC;
  `;

  const response = await fetch('http://localhost:3030/raw_sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  return response.json();
}
```

### 2. Content Categorization

```typescript
// lib/categorization.ts

interface CategoryRule {
  name: string;
  keywords: string[];
  windowPatterns: RegExp[];
}

const YOUTUBE_CATEGORIES: CategoryRule[] = [
  {
    name: "Soccer videos",
    keywords: ["soccer", "football", "premier league", "goals", "highlights", "match"],
    windowPatterns: [/premier league/i, /soccer/i, /football/i]
  },
  {
    name: "Travel videos",
    keywords: ["travel", "vlog", "tour", "visit", "trip", "vacation"],
    windowPatterns: [/travel/i, /vlog/i, /tour/i]
  },
  {
    name: "Tech reviews",
    keywords: ["review", "unboxing", "tech", "gadget", "iphone", "laptop"],
    windowPatterns: [/review/i, /unboxing/i, /tech/i]
  }
];

export function categorizeContent(
  windowName: string,
  ocrText: string,
  categories: CategoryRule[]
): string | null {
  for (const category of categories) {
    // Check window title
    if (category.windowPatterns.some(pattern => pattern.test(windowName))) {
      return category.name;
    }

    // Check OCR text for keywords
    const textLower = ocrText.toLowerCase();
    const matchCount = category.keywords.filter(kw => textLower.includes(kw)).length;

    if (matchCount >= 2) {  // Require at least 2 keyword matches
      return category.name;
    }
  }

  return null;
}
```

### 3. YouTube-Specific Analysis

```typescript
// lib/queries.ts

export async function getYouTubeUsage(timeRange: string) {
  const timeCondition = getTimeCondition(timeRange);

  const query = `
    SELECT
      f.window_name,
      GROUP_CONCAT(DISTINCT o.text, ' ') as all_text,
      COUNT(*) as frame_count,
      COUNT(*) * 2.0 as duration_seconds,
      MIN(f.timestamp) as start_time,
      MAX(f.timestamp) as end_time
    FROM frames f
    JOIN ocr_text o ON f.id = o.frame_id
    WHERE f.app_name = 'Google Chrome'
      AND (f.window_name LIKE '%YouTube%' OR f.window_name LIKE '%youtube%')
      AND ${timeCondition}
    GROUP BY f.window_name
    HAVING frame_count > 5  -- Filter out brief visits
    ORDER BY duration_seconds DESC;
  `;

  const response = await fetch('http://localhost:3030/raw_sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  const data = await response.json();

  // Categorize each video
  return data.map((row: any) => ({
    ...row,
    category: categorizeContent(row.window_name, row.all_text, YOUTUBE_CATEGORIES)
  }));
}
```

### 4. React Components

```typescript
// components/AppList.tsx

interface AppUsage {
  name: string;
  duration: number;
  percentage: number;
  icon?: string;
}

export function AppList({ apps }: { apps: AppUsage[] }) {
  return (
    <div className="space-y-2">
      {apps.map((app, index) => (
        <div key={app.name} className="flex items-center gap-3">
          <span className="text-gray-500 w-6">{index + 1}.</span>
          <span className="flex-1">{app.name}</span>
          <div className="flex-1 bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-500 h-4 rounded-full"
              style={{ width: `${app.percentage}%` }}
            />
          </div>
          <span className="w-20 text-right">
            {formatDuration(app.duration)}
          </span>
          <span className="w-16 text-right text-gray-500">
            ({app.percentage.toFixed(1)}%)
          </span>
        </div>
      ))}
    </div>
  );
}
```

---

## Configuration

### pipe.json

```json
{
  "enabled": true,
  "port": 21563,
  "crons": [
    {
      "path": "/api/refresh",
      "schedule": "0 */5 * * * *"  // Every 5 minutes
    }
  ]
}
```

### package.json

```json
{
  "name": "app-usage-tracker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p ${PORT:-21563}",
    "build": "next build",
    "start": "next start -p ${PORT:-21563}"
  },
  "dependencies": {
    "next": "^15.1.7",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^2.10.0",  // For charts
    "date-fns": "^3.0.0"    // For date handling
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## AI-Powered Behavioral Analysis (Gemini Integration)

### Overview

Integrate Google's Gemini free tier to provide intelligent behavioral insights and goal alignment analysis.

### Features

#### 1. **Automated Behavioral Analysis**

The AI analyzes your usage patterns and provides:
- **Pattern Recognition**: Identifies habits and routines
- **Productivity Assessment**: Evaluates focus vs distraction time
- **Behavioral Trends**: Detects changes over time
- **Context-Aware Insights**: Understands work vs leisure patterns

#### 2. **Goal Setting & Tracking**

Users can define personal goals and track alignment:

```typescript
interface UserGoal {
  id: string;
  type: 'screen_time' | 'app_limit' | 'focus_time' | 'content_limit' | 'custom';
  description: string;
  target: number;  // hours, minutes, or custom metric
  period: 'daily' | 'weekly' | 'monthly';
  apps?: string[];  // specific apps to track
  categories?: string[];  // content categories
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
}
```

**Example Goals:**
- "Limit YouTube entertainment to 2 hours per day"
- "Spend 4+ hours in VS Code daily"
- "No social media before 10am"
- "Focus sessions of at least 90 minutes"
- "Reduce app switching to increase deep work"

#### 3. **Goal Alignment Analysis**

AI compares actual behavior against stated goals and provides:
- **Alignment Score**: 0-100% match with goals
- **Gap Analysis**: Where you're falling short
- **Recommendations**: Actionable suggestions
- **Progress Trends**: Improvement over time

### Technical Implementation

#### Gemini API Integration

```typescript
// lib/gemini.ts

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface UsageData {
  apps: AppUsage[];
  categories: CategoryBreakdown[];
  timeline: TimelineEntry[];
  totalScreenTime: number;
}

interface UserGoals {
  goals: UserGoal[];
  priorities: string[];
}

export async function analyzeBehavior(
  usageData: UsageData,
  goals: UserGoals,
  timeRange: string
): Promise<BehavioralInsight> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
You are a behavioral analyst helping someone understand their computer usage patterns and achieve their goals.

## User's Goals:
${goals.goals.map(g => `- ${g.description} (${g.type}, ${g.period})`).join('\n')}

## Actual Usage Data (${timeRange}):
Total Screen Time: ${formatDuration(usageData.totalScreenTime)}

Top Applications:
${usageData.apps.map(app =>
  `- ${app.name}: ${formatDuration(app.duration)} (${app.percentage}%)`
).join('\n')}

Content Breakdown:
${usageData.categories.map(cat =>
  `- ${cat.name}: ${formatDuration(cat.duration)}`
).join('\n')}

## Analysis Tasks:

1. **Goal Alignment Score (0-100)**: Calculate how well actual usage aligns with stated goals
2. **Pattern Analysis**: Identify behavioral patterns (good and bad)
3. **Recommendations**: Provide 3-5 specific, actionable recommendations
4. **Insights**: Share surprising or notable patterns
5. **Progress**: If historical data available, note improvements or regressions

Provide analysis in JSON format:
{
  "alignmentScore": number,
  "summary": "brief overview",
  "patterns": {
    "positive": ["pattern1", "pattern2"],
    "negative": ["pattern1", "pattern2"]
  },
  "goalProgress": [
    {
      "goal": "goal description",
      "status": "on_track" | "needs_improvement" | "off_track",
      "actual": number,
      "target": number,
      "gap": number,
      "analysis": "specific feedback"
    }
  ],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "action": "specific action to take",
      "reason": "why this helps",
      "impact": "expected outcome"
    }
  ],
  "insights": ["insight1", "insight2"],
  "weeklyTrend": "improving" | "stable" | "declining"
}
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response");
  }

  return JSON.parse(jsonMatch[0]);
}
```

#### API Endpoint for AI Analysis

```typescript
// app/api/ai-analysis/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { analyzeBehavior } from '@/lib/gemini';
import { getAppUsage, getCategories } from '@/lib/queries';
import { getUserGoals } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const { timeRange } = await request.json();

    // Fetch usage data
    const apps = await getAppUsage(timeRange);
    const categories = await getCategories(timeRange);

    // Get user goals from local storage
    const goals = await getUserGoals();

    if (goals.length === 0) {
      return NextResponse.json({
        error: "No goals set",
        message: "Please set your goals first to get AI analysis"
      }, { status: 400 });
    }

    // Get AI analysis
    const analysis = await analyzeBehavior(
      { apps, categories, totalScreenTime: apps.reduce((sum, a) => sum + a.duration, 0) },
      { goals, priorities: goals.filter(g => g.priority === 'high').map(g => g.description) },
      timeRange
    );

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze behavior' }, { status: 500 });
  }
}
```

### Goal Management UI

#### Goals Dashboard Section

```typescript
// components/GoalsManager.tsx

'use client';

import { useState, useEffect } from 'react';

interface Goal {
  id: string;
  description: string;
  type: string;
  target: number;
  period: string;
  apps?: string[];
}

export function GoalsManager() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">My Goals</h2>
        <button
          onClick={() => setShowAddGoal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          + Add Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No goals set yet. Add your first goal to get started!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}

      {showAddGoal && (
        <AddGoalModal
          onClose={() => setShowAddGoal(false)}
          onSave={(goal) => {
            setGoals([...goals, goal]);
            setShowAddGoal(false);
          }}
        />
      )}
    </div>
  );
}
```

#### Goal Progress Card

```typescript
// components/GoalProgressCard.tsx

interface GoalProgressProps {
  goal: Goal;
  actual: number;
  target: number;
  status: 'on_track' | 'needs_improvement' | 'off_track';
  analysis?: string;
}

export function GoalProgressCard({ goal, actual, target, status, analysis }: GoalProgressProps) {
  const percentage = Math.min((actual / target) * 100, 100);

  const statusColors = {
    on_track: 'bg-green-500',
    needs_improvement: 'bg-yellow-500',
    off_track: 'bg-red-500'
  };

  const statusIcons = {
    on_track: '✅',
    needs_improvement: '⚠️',
    off_track: '❌'
  };

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{statusIcons[status]}</span>
            <h3 className="font-semibold">{goal.description}</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Target: {formatDuration(target * 3600)} per {goal.period}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
        <div
          className={`h-3 rounded-full ${statusColors[status]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-sm mb-2">
        <span>Actual: {formatDuration(actual * 3600)}</span>
        <span>{percentage.toFixed(1)}% of goal</span>
      </div>

      {analysis && (
        <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
          <p className="text-gray-700">{analysis}</p>
        </div>
      )}
    </div>
  );
}
```

### AI Insights Display

```typescript
// components/AIInsights.tsx

'use client';

import { useState, useEffect } from 'react';

interface Insight {
  alignmentScore: number;
  summary: string;
  patterns: {
    positive: string[];
    negative: string[];
  };
  recommendations: Array<{
    priority: string;
    action: string;
    reason: string;
    impact: string;
  }>;
  insights: string[];
  weeklyTrend: string;
}

export function AIInsights({ timeRange }: { timeRange: string }) {
  const [insights, setInsights] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, [timeRange]);

  const fetchInsights = async () => {
    setLoading(true);
    const response = await fetch('/api/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeRange })
    });

    const data = await response.json();
    setInsights(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="animate-pulse">🤖 AI analyzing your behavior...</div>;
  }

  if (!insights) {
    return <div>Unable to generate insights. Please set your goals first.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Alignment Score */}
      <div className="p-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Goal Alignment Score</h3>
        <div className="text-5xl font-bold">{insights.alignmentScore}%</div>
        <p className="mt-2">{insights.summary}</p>
        <div className="mt-2 text-sm">
          Trend: {insights.weeklyTrend === 'improving' ? '📈' :
                  insights.weeklyTrend === 'declining' ? '📉' : '➡️'} {insights.weeklyTrend}
        </div>
      </div>

      {/* Patterns */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-semibold text-green-800 mb-2">✅ Positive Patterns</h4>
          <ul className="space-y-1">
            {insights.patterns.positive.map((pattern, i) => (
              <li key={i} className="text-sm text-green-700">• {pattern}</li>
            ))}
          </ul>
        </div>

        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-semibold text-red-800 mb-2">⚠️ Areas for Improvement</h4>
          <ul className="space-y-1">
            {insights.patterns.negative.map((pattern, i) => (
              <li key={i} className="text-sm text-red-700">• {pattern}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recommendations */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">🎯 AI Recommendations</h3>
        <div className="space-y-4">
          {insights.recommendations.map((rec, i) => (
            <div key={i} className={`p-4 rounded-lg border-l-4 ${
              rec.priority === 'high' ? 'border-red-500 bg-red-50' :
              rec.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
              'border-blue-500 bg-blue-50'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">
                  {rec.priority === 'high' ? '🔥' :
                   rec.priority === 'medium' ? '⚡' : '💡'}
                </span>
                <div className="flex-1">
                  <h4 className="font-semibold">{rec.action}</h4>
                  <p className="text-sm text-gray-600 mt-1">{rec.reason}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    <strong>Expected impact:</strong> {rec.impact}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="p-6 bg-purple-50 rounded-lg">
        <h3 className="text-xl font-bold mb-3">💡 Key Insights</h3>
        <ul className="space-y-2">
          {insights.insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2">
              <span>•</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

### Updated Dashboard Layout (with AI & Goals)

```
┌────────────────────────────────────────────────────────────────┐
│                    APP USAGE TRACKER                           │
│  Time Range: [Today ▼]  [Refresh]  [⚙️ Settings]              │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  🤖 AI BEHAVIORAL ANALYSIS                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  Goal Alignment Score: 73% 📈 Improving                        │
│  "You're making good progress on focus time, but YouTube       │
│   entertainment is 2.5 hours over your daily goal."            │
│                                                                 │
│  ✅ Positive Patterns          ⚠️ Areas for Improvement        │
│  • Consistent morning focus    • YouTube after 8pm             │
│  • Deep work sessions          • Frequent app switching        │
│  • Meeting productivity        • Social media creep            │
│                                                                 │
│  [View Detailed Analysis →]                                    │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  🎯 GOAL PROGRESS                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  ✅ Focus Time (Daily)                      [████████░░] 86%  │
│     Target: 4h | Actual: 3h 26m                               │
│     On track! Keep it up.                                     │
│                                                                 │
│  ⚠️ YouTube Entertainment (Daily)           [████████████] 175%│
│     Target: 2h | Actual: 3h 30m                               │
│     Over by 1h 30m. Consider setting boundaries.             │
│                                                                 │
│  ✅ No Social Media Before 10am            SUCCESS             │
│     First social media use: 10:23am                           │
│                                                                 │
│  [+ Add New Goal]  [Manage Goals]                             │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  💡 AI RECOMMENDATIONS                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  🔥 HIGH PRIORITY                                              │
│  Block YouTube access after 8pm                                │
│  Reason: 75% of excess YouTube time happens after 8pm         │
│  Impact: Could save 1h 10m daily toward your goal             │
│                                                                 │
│  ⚡ MEDIUM PRIORITY                                            │
│  Reduce app switching during 2-4pm focus block                │
│  Reason: You switch apps 23 times/hour during this period     │
│  Impact: Could improve deep work quality by 40%               │
│                                                                 │
│  💡 SUGGESTION                                                 │
│  Schedule YouTube time as intentional breaks                   │
│  Reason: Unstructured usage leads to longer sessions          │
│  Impact: Better awareness and control                         │
└────────────────────────────────────────────────────────────────┘

[Rest of dashboard: Usage Summary, App List, Timeline, etc.]
```

### Environment Configuration

```bash
# .env.local

GEMINI_API_KEY=your_gemini_api_key_here

# Get free API key from: https://ai.google.dev/
```

### Cost & Rate Limits (Gemini Free Tier)

**Gemini 1.5 Flash (Free Tier):**
- 15 requests per minute
- 1 million tokens per minute
- 1,500 requests per day
- **Perfect for this use case!**

Each analysis uses ~1,000 tokens, so you can run:
- 1,500 analyses per day
- Real-time updates every 5 minutes
- Multiple users on same instance

### Advanced Features (Future Enhancements)

### 1. **Habit Formation Tracking**
- Track streaks (e.g., "7 days under YouTube goal")
- Celebrate milestones
- Provide motivation

### 2. **Predictive Insights**
- "Based on current trends, you'll exceed your weekly goal"
- "Friday afternoons are your least productive time"

### 3. **Comparative Analysis**
- Compare to past weeks/months
- Seasonal patterns
- Productivity vs. time of day

### 4. **Export Reports**
- Weekly/monthly summaries
- PDF reports with AI analysis
- Share progress with accountability partners

### 5. **Privacy Controls**
- Blacklist certain apps/websites
- Exclude sensitive windows
- Local-only processing

---

## Example Queries

### Get Top 5 YouTube Video Topics (Last 7 Days)

```sql
WITH youtube_sessions AS (
  SELECT
    f.window_name,
    GROUP_CONCAT(DISTINCT o.text, ' ') as combined_text,
    COUNT(*) * 2.0 as duration_seconds
  FROM frames f
  JOIN ocr_text o ON f.id = o.frame_id
  WHERE f.app_name = 'Google Chrome'
    AND f.window_name LIKE '%YouTube%'
    AND datetime(f.timestamp) >= datetime('now', '-7 days')
  GROUP BY f.window_name
  HAVING duration_seconds > 60  -- At least 1 minute
),
categorized AS (
  SELECT
    window_name,
    duration_seconds,
    CASE
      WHEN LOWER(combined_text) LIKE '%soccer%' OR LOWER(combined_text) LIKE '%football%'
        THEN 'Soccer videos'
      WHEN LOWER(combined_text) LIKE '%travel%' OR LOWER(combined_text) LIKE '%vlog%'
        THEN 'Travel videos'
      WHEN LOWER(combined_text) LIKE '%tech%' OR LOWER(combined_text) LIKE '%review%'
        THEN 'Tech reviews'
      WHEN LOWER(combined_text) LIKE '%gaming%' OR LOWER(combined_text) LIKE '%gameplay%'
        THEN 'Gaming'
      ELSE 'Other'
    END as category
  FROM youtube_sessions
)
SELECT
  category,
  COUNT(*) as video_count,
  SUM(duration_seconds) as total_duration,
  SUM(duration_seconds) / 3600.0 as hours,
  ROUND(SUM(duration_seconds) * 100.0 / (SELECT SUM(duration_seconds) FROM categorized), 1) as percentage
FROM categorized
GROUP BY category
ORDER BY total_duration DESC
LIMIT 5;
```

---

## Installation & Usage

### Install the Pipe

```bash
cd ~/.screenpipe/pipes/app-usage-tracker
bun install
bun dev  # For local testing
```

### Access the Dashboard

Open browser to: `http://localhost:21563`

### Install in Screenpipe

```bash
screenpipe pipe install ~/.screenpipe/pipes/app-usage-tracker
```

---

## Benefits

1. **Self-Awareness**: Understand exactly how you spend your time
2. **Productivity Insights**: Identify patterns and optimize work habits
3. **Content Awareness**: Know what content you consume most
4. **Goal Tracking**: Set and track screen time goals
5. **Privacy**: All data stays local on your machine
6. **Detailed Analysis**: Drill down from apps to specific content
7. **Historical Trends**: Track changes over time

---

## Next Steps

1. Review this plan and provide feedback
2. Implement the basic structure
3. Add core features (app tracking, basic UI)
4. Implement content categorization
5. Add visualizations
6. Test with real data
7. Add advanced features (insights, goals)

---

**Questions to Consider:**

1. What time ranges are most important to you? (daily, weekly, monthly?)
2. Which apps do you want to track most closely?
3. Besides YouTube, what other content categories interest you?
4. Do you want notifications/alerts for screen time limits?
5. Should we add productivity scoring?

Let me know if you'd like to modify this plan or proceed with implementation!
