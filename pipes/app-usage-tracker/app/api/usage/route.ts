import { NextRequest, NextResponse } from 'next/server';
import { getAppUsage, getTotalScreenTime, getWindowsForApp } from '@/lib/queries';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || 'today';
    const appName = searchParams.get('app');

    if (appName) {
      // Get windows for specific app
      const windows = await getWindowsForApp(appName, timeRange);
      return NextResponse.json({ windows });
    }

    // Get overall app usage
    const apps = await getAppUsage(timeRange);
    const totalScreenTime = await getTotalScreenTime(timeRange);

    const mostUsedApp = apps.length > 0 ? apps[0] : null;

    return NextResponse.json({
      summary: {
        totalScreenTime,
        mostUsedApp: mostUsedApp ? {
          name: mostUsedApp.name,
          duration: mostUsedApp.duration
        } : null,
        activeApps: apps.length,
        focusTime: 0 // TODO: Calculate focus time
      },
      apps
    });
  } catch (error) {
    console.error('Error in usage API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
