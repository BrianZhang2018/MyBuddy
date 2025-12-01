interface CategoryRule {
  name: string;
  keywords: string[];
  windowPatterns: RegExp[];
}

export const YOUTUBE_CATEGORIES: CategoryRule[] = [
  {
    name: "Soccer videos",
    keywords: ["soccer", "football", "premier league", "goals", "highlights", "match", "fifa", "champions league"],
    windowPatterns: [/premier league/i, /soccer/i, /football/i, /fifa/i, /champions/i]
  },
  {
    name: "Travel videos",
    keywords: ["travel", "vlog", "tour", "visit", "trip", "vacation", "destination", "adventure"],
    windowPatterns: [/travel/i, /vlog/i, /tour/i, /visit/i]
  },
  {
    name: "Tech reviews",
    keywords: ["review", "unboxing", "tech", "gadget", "iphone", "laptop", "android", "technology"],
    windowPatterns: [/review/i, /unboxing/i, /tech/i]
  },
  {
    name: "Gaming",
    keywords: ["gaming", "gameplay", "playthrough", "walkthrough", "lets play", "game"],
    windowPatterns: [/gaming/i, /gameplay/i, /playthrough/i]
  },
  {
    name: "Music",
    keywords: ["music", "song", "official video", "mv", "lyrics", "audio"],
    windowPatterns: [/music/i, /official video/i, /lyrics/i]
  }
];

export function categorizeContent(
  windowName: string,
  ocrText: string,
  categories: CategoryRule[] = YOUTUBE_CATEGORIES
): string | null {
  const windowLower = windowName.toLowerCase();
  const textLower = ocrText?.toLowerCase() || '';

  for (const category of categories) {
    // Check window title patterns
    if (category.windowPatterns.some(pattern => pattern.test(windowName))) {
      return category.name;
    }

    // Check OCR text for keywords (require at least 2 matches)
    const matchCount = category.keywords.filter(kw =>
      textLower.includes(kw) || windowLower.includes(kw)
    ).length;

    if (matchCount >= 2) {
      return category.name;
    }
  }

  return "Other";
}

export function categorizeYouTubeData(videos: any[]): any {
  const categories: { [key: string]: any[] } = {};

  videos.forEach(video => {
    const category = categorizeContent(
      video.window_name,
      video.all_text || ''
    );

    if (!categories[category]) {
      categories[category] = [];
    }

    categories[category].push(video);
  });

  return Object.entries(categories).map(([name, videos]) => ({
    name,
    duration: videos.reduce((sum, v) => sum + v.duration_seconds, 0),
    videoCount: videos.length,
    videos: videos.slice(0, 10) // Top 10 videos per category
  }));
}
