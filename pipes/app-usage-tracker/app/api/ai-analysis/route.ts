import { NextRequest, NextResponse } from 'next/server';
import { analyzeBehavior } from '@/lib/gemini';
import { getAppUsage, getCategories } from '@/lib/queries';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { timeRange, goals } = body;

    if (!goals || goals.length === 0) {
      return NextResponse.json({
        error: "No goals set",
        message: "Please set your goals first to get AI analysis"
      }, { status: 400 });
    }

    // Fetch usage data
    const apps = await getAppUsage(timeRange);
    const categories = await getCategories(timeRange);
    const totalScreenTime = apps.reduce((sum, a) => sum + a.duration, 0);

    // Get AI analysis
    const analysis = await analyzeBehavior(
      { apps, categories, totalScreenTime },
      {
        goals,
        priorities: goals.filter((g: any) => g.priority === 'high').map((g: any) => g.description)
      },
      timeRange
    );

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze behavior', details: (error as Error).message },
      { status: 500 }
    );
  }
}
