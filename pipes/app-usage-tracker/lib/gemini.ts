import { GoogleGenerativeAI } from "@google/generative-ai";
import { AppUsage, CategoryBreakdown } from './queries';
import { UserGoal } from './storage';
import { formatDuration } from './utils';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface BehavioralInsight {
  alignmentScore: number;
  summary: string;
  patterns: {
    positive: string[];
    negative: string[];
  };
  goalProgress: Array<{
    goal: string;
    status: 'on_track' | 'needs_improvement' | 'off_track';
    actual: number;
    target: number;
    gap: number;
    analysis: string;
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    reason: string;
    impact: string;
  }>;
  insights: string[];
  weeklyTrend: 'improving' | 'stable' | 'declining';
}

interface UsageData {
  apps: AppUsage[];
  categories: CategoryBreakdown[];
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
${goals.goals.map(g => `- ${g.description} (${g.type}, ${g.period}, priority: ${g.priority})`).join('\n')}

## Actual Usage Data (${timeRange}):
Total Screen Time: ${formatDuration(usageData.totalScreenTime)}

Top Applications:
${usageData.apps.slice(0, 10).map(app =>
  `- ${app.name}: ${formatDuration(app.duration)} (${app.percentage.toFixed(1)}%)`
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
5. **Progress**: Note improvements or areas needing work

Provide analysis in JSON format ONLY (no markdown, no code blocks):
{
  "alignmentScore": number,
  "summary": "brief overview in one sentence",
  "patterns": {
    "positive": ["pattern1", "pattern2", "pattern3"],
    "negative": ["pattern1", "pattern2", "pattern3"]
  },
  "goalProgress": [
    {
      "goal": "goal description",
      "status": "on_track" | "needs_improvement" | "off_track",
      "actual": number (in hours),
      "target": number (in hours),
      "gap": number (difference in hours),
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
  "insights": ["insight1", "insight2", "insight3"],
  "weeklyTrend": "improving" | "stable" | "declining"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response (handle markdown code blocks if present)
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to parse AI response:', text);
      throw new Error("Failed to parse AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as BehavioralInsight;
  } catch (error) {
    console.error('Error analyzing behavior:', error);

    // Return fallback response
    return {
      alignmentScore: 50,
      summary: "Unable to generate AI analysis at this time.",
      patterns: {
        positive: ["Data being collected"],
        negative: ["AI analysis temporarily unavailable"]
      },
      goalProgress: goals.goals.map(g => ({
        goal: g.description,
        status: 'needs_improvement' as const,
        actual: 0,
        target: g.target,
        gap: g.target,
        analysis: "Data being analyzed"
      })),
      recommendations: [{
        priority: 'medium' as const,
        action: "Check back later for AI insights",
        reason: "AI service is initializing",
        impact: "Full behavioral analysis will be available soon"
      }],
      insights: ["Your usage data is being tracked"],
      weeklyTrend: 'stable' as const
    };
  }
}
