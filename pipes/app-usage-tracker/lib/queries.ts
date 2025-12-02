import { getTimeCondition, extractDomain } from './utils';
import { categorizeContent, YOUTUBE_CATEGORIES } from './categorization';
import { categorizeWindowsWithAI } from './gemini';

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

export interface DomainBreakdown {
  domain: string;
  duration: number;
  percentage: number;
  windowCount: number;
  subcategories?: SubcategoryBreakdown[];
}

export interface SubcategoryBreakdown {
  name: string;
  duration: number;
  percentage: number;
  windowCount: number;
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

export async function getDomainBreakdown(appName: string, timeRange: string): Promise<DomainBreakdown[]> {
  const windows = await getWindowsForApp(appName, timeRange);

  // Group windows by domain and track window titles for subcategorization
  const domainMap = new Map<string, { duration: number; count: number; windows: WindowUsage[] }>();

  for (const window of windows) {
    const domain = extractDomain(window.title) || 'Other';
    const existing = domainMap.get(domain) || { duration: 0, count: 0, windows: [] };
    domainMap.set(domain, {
      duration: existing.duration + window.duration,
      count: existing.count + 1,
      windows: [...existing.windows, window]
    });
  }

  // Calculate total duration for percentages
  const total = Array.from(domainMap.values()).reduce((sum, item) => sum + item.duration, 0);

  // Convert to array and add subcategories
  const breakdown = await Promise.all(
    Array.from(domainMap.entries()).map(async ([domain, data]) => {
      const item: DomainBreakdown = {
        domain,
        duration: data.duration,
        percentage: total > 0 ? (data.duration / total) * 100 : 0,
        windowCount: data.count
      };

      // Add subcategories for YouTube
      if (domain === 'youtube.com') {
        item.subcategories = await categorizeWindowsByContent(data.windows);
      }
      // Add AI-powered subcategories for "Other"
      else if (domain === 'Other' && data.windows.length >= 5) {
        try {
          item.subcategories = await categorizeOtherWindowsWithAI(data.windows);
        } catch (error) {
          console.error('Error categorizing Other windows:', error);
        }
      }

      return item;
    })
  );

  return breakdown.sort((a, b) => b.duration - a.duration);
}

async function categorizeOtherWindowsWithAI(windows: WindowUsage[]): Promise<SubcategoryBreakdown[]> {
  const categoryMap = await categorizeWindowsWithAI(windows);
  const total = windows.reduce((sum, w) => sum + w.duration, 0);

  return Array.from(categoryMap.entries())
    .map(([name, categoryWindows]) => {
      const duration = categoryWindows.reduce((sum, w) => sum + w.duration, 0);
      return {
        name,
        duration,
        percentage: total > 0 ? (duration / total) * 100 : 0,
        windowCount: categoryWindows.length
      };
    })
    .sort((a, b) => b.duration - a.duration);
}

async function categorizeWindowsByContent(windows: WindowUsage[]): Promise<SubcategoryBreakdown[]> {
  const categoryMap = new Map<string, { duration: number; count: number; windows: WindowUsage[] }>();

  // First pass: use keyword-based categorization
  for (const window of windows) {
    const category = categorizeContent(window.title, '');
    const existing = categoryMap.get(category) || { duration: 0, count: 0, windows: [] };
    categoryMap.set(category, {
      duration: existing.duration + window.duration,
      count: existing.count + 1,
      windows: [...existing.windows, window]
    });
  }

  // Second pass: use AI to categorize "Other" YouTube videos
  const otherData = categoryMap.get('Other');
  if (otherData && otherData.windows.length >= 3) {
    try {
      const aiCategories = await categorizeOtherWindowsWithAI(otherData.windows);

      // Remove the generic "Other" category
      categoryMap.delete('Other');

      // Add AI-generated categories
      for (const aiCat of aiCategories) {
        categoryMap.set(aiCat.name, {
          duration: aiCat.duration,
          count: aiCat.windowCount,
          windows: [] // We don't need to track windows anymore
        });
      }
    } catch (error) {
      console.error('Error AI-categorizing YouTube Other videos:', error);
    }
  }

  const total = Array.from(categoryMap.values()).reduce((sum, item) => sum + item.duration, 0);

  return Array.from(categoryMap.entries())
    .map(([name, data]) => ({
      name,
      duration: data.duration,
      percentage: total > 0 ? (data.duration / total) * 100 : 0,
      windowCount: data.count
    }))
    .sort((a, b) => b.duration - a.duration);
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
