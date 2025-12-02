import { NextRequest, NextResponse } from 'next/server';
import { getDomainBreakdown } from '@/lib/queries';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const appName = searchParams.get('app');
  const timeRange = searchParams.get('timeRange') || 'today';

  if (!appName) {
    return NextResponse.json(
      { error: 'App name is required' },
      { status: 400 }
    );
  }

  try {
    const breakdown = await getDomainBreakdown(appName, timeRange);

    return NextResponse.json({ breakdown });
  } catch (error) {
    console.error('Error fetching breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to fetch breakdown' },
      { status: 500 }
    );
  }
}
