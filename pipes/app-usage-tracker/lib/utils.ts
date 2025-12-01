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
      return "datetime(f.timestamp) >= datetime('now', 'start of day')";
    case 'yesterday':
      return "datetime(f.timestamp) >= datetime('now', '-1 day', 'start of day') AND datetime(f.timestamp) < datetime('now', 'start of day')";
    case 'week':
      return "datetime(f.timestamp) >= datetime('now', '-7 days')";
    case 'month':
      return "datetime(f.timestamp) >= datetime('now', '-30 days')";
    default:
      return "datetime(f.timestamp) >= datetime('now', 'start of day')";
  }
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
