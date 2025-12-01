import { getTimeCondition } from './utils';

const SCREENPIPE_API_URL = process.env.SCREENPIPE_API_URL || 'http://localhost:3030';

export interface AppUsage {
  name: string;
  duration: number;
  percentage: number;
  frameCount: number;
  windows?: WindowUsage[];
}

export interface WindowUsage {
  title: string;
  duration: number;
  category?: string;
}

export interface CategoryBreakdown {
  name: string;
  duration: number;
  subcategories: Array<{
    name: string;
    duration: number;
    keywords: string[];
    windows: string[];
  }>;
}

export async function getAppUsage(timeRange: string): Promise<AppUsage[]> {
  const timeCondition = getTimeCondition(timeRange);

  const query = `
    SELECT
      f.app_name,
      COUNT(*) as frame_count,
      COUNT(*) * 2.0 as duration_seconds
    FROM frames f
    WHERE ${timeCondition}
      AND f.app_name IS NOT NULL
      AND f.app_name != ''
    GROUP BY f.app_name
    ORDER BY duration_seconds DESC;
  `;

  try {
    const response = await fetch(`${SCREENPIPE_API_URL}/raw_sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Calculate total for percentages
    const total = data.reduce((sum: number, row: any) => sum + row.duration_seconds, 0);

    return data.map((row: any) => ({
      name: row.app_name,
      duration: row.duration_seconds,
      percentage: total > 0 ? (row.duration_seconds / total) * 100 : 0,
      frameCount: row.frame_count,
    }));
  } catch (error) {
    console.error('Error fetching app usage:', error);
    return [];
  }
}

export async function getWindowsForApp(appName: string, timeRange: string): Promise<WindowUsage[]> {
  const timeCondition = getTimeCondition(timeRange);

  const query = `
    SELECT
      f.window_name,
      COUNT(*) as frame_count,
      COUNT(*) * 2.0 as duration_seconds
    FROM frames f
    WHERE ${timeCondition}
      AND f.app_name = ?
      AND f.window_name IS NOT NULL
      AND f.window_name != ''
    GROUP BY f.window_name
    ORDER BY duration_seconds DESC
    LIMIT 50;
  `;

  try {
    const response = await fetch(`${SCREENPIPE_API_URL}/raw_sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.replace('?', `'${appName.replace(/'/g, "''")}'`)
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return data.map((row: any) => ({
      title: row.window_name,
      duration: row.duration_seconds,
    }));
  } catch (error) {
    console.error('Error fetching windows:', error);
    return [];
  }
}

export async function getYouTubeUsage(timeRange: string): Promise<any[]> {
  const timeCondition = getTimeCondition(timeRange);

  const query = `
    SELECT
      f.window_name,
      GROUP_CONCAT(DISTINCT o.text, ' ') as all_text,
      COUNT(*) as frame_count,
      COUNT(*) * 2.0 as duration_seconds
    FROM frames f
    JOIN ocr_text o ON f.id = o.frame_id
    WHERE ${timeCondition}
      AND f.app_name LIKE '%Chrome%'
      AND (f.window_name LIKE '%YouTube%' OR f.window_name LIKE '%youtube%')
    GROUP BY f.window_name
    HAVING frame_count > 5
    ORDER BY duration_seconds DESC
    LIMIT 100;
  `;

  try {
    const response = await fetch(`${SCREENPIPE_API_URL}/raw_sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching YouTube usage:', error);
    return [];
  }
}

export async function getCategories(timeRange: string): Promise<CategoryBreakdown[]> {
  // This will be enhanced with categorization logic
  return [];
}

export async function getTotalScreenTime(timeRange: string): Promise<number> {
  const timeCondition = getTimeCondition(timeRange);

  const query = `
    SELECT COUNT(*) * 2.0 as total_seconds
    FROM frames f
    WHERE ${timeCondition};
  `;

  try {
    const response = await fetch(`${SCREENPIPE_API_URL}/raw_sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data[0]?.total_seconds || 0;
  } catch (error) {
    console.error('Error fetching total screen time:', error);
    return 0;
  }
}
