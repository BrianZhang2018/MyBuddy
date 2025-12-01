import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeUsage } from '@/lib/queries';
import { categorizeYouTubeData } from '@/lib/categorization';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || 'today';
    const app = searchParams.get('app');

    if (app && app.toLowerCase().includes('chrome')) {
      // Get YouTube categorization
      const youtubeData = await getYouTubeUsage(timeRange);
      const categories = categorizeYouTubeData(youtubeData);

      return NextResponse.json({
        app,
        categories: categories.map(cat => ({
          name: cat.name,
          duration: cat.duration,
          videoCount: cat.videoCount,
          subcategories: []
        }))
      });
    }

    return NextResponse.json({ app, categories: [] });
  } catch (error) {
    console.error('Error in categories API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
