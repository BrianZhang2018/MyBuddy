export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function getTimeCondition(timeRange: string): string {
  switch (timeRange) {
    case 'today':
      return "datetime(f.timestamp, 'localtime') >= datetime('now', 'localtime', 'start of day')";
    case 'yesterday':
      return "datetime(f.timestamp, 'localtime') >= datetime('now', 'localtime', '-1 day', 'start of day') AND datetime(f.timestamp, 'localtime') < datetime('now', 'localtime', 'start of day')";
    case 'week':
      return "datetime(f.timestamp, 'localtime') >= datetime('now', 'localtime', '-7 days')";
    case 'month':
      return "datetime(f.timestamp, 'localtime') >= datetime('now', 'localtime', '-30 days')";
    default:
      return "datetime(f.timestamp, 'localtime') >= datetime('now', 'localtime', 'start of day')";
  }
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function extractDomain(windowName: string): string | null {
  if (!windowName) return null;

  // Try to extract domain from common browser window title patterns
  // Chrome/Firefox: "Page Title - Domain" or "Domain - Page Title"
  // Safari: "Page Title — Domain"

  // Look for URL patterns in window name
  const urlMatch = windowName.match(/https?:\/\/([^\/\s]+)/i);
  if (urlMatch) {
    return cleanDomain(urlMatch[1]);
  }

  // Look for domain patterns (word.word format)
  const domainMatch = windowName.match(/([a-z0-9-]+\.com|[a-z0-9-]+\.org|[a-z0-9-]+\.net|youtube\.com|github\.com|twitter\.com|facebook\.com|reddit\.com|stackoverflow\.com|slickdeals\.net)/i);
  if (domainMatch) {
    return cleanDomain(domainMatch[1]);
  }

  // Check if window name contains common site names
  const lowerName = windowName.toLowerCase();
  if (lowerName.includes('youtube')) return 'youtube.com';
  if (lowerName.includes('slickdeal')) return 'slickdeals.net';
  if (lowerName.includes('github')) return 'github.com';
  if (lowerName.includes('twitter') || lowerName.includes('x.com')) return 'twitter.com';
  if (lowerName.includes('reddit')) return 'reddit.com';
  if (lowerName.includes('facebook')) return 'facebook.com';
  if (lowerName.includes('stackoverflow')) return 'stackoverflow.com';

  return null;
}

function cleanDomain(domain: string): string {
  // Remove www. prefix
  domain = domain.replace(/^www\./, '');
  // Remove port numbers
  domain = domain.replace(/:\d+$/, '');
  return domain.toLowerCase();
}
