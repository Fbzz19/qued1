// Full format: "1 year 2 months 14 days 6 hours 32 minutes"
export function formatWatchTime(mins: number): string {
  if (mins <= 0) return '0 minutes';
  const years   = Math.floor(mins / (60 * 24 * 365));
  const rem1    = mins % (60 * 24 * 365);
  const months  = Math.floor(rem1 / (60 * 24 * 30));
  const rem2    = rem1 % (60 * 24 * 30);
  const days    = Math.floor(rem2 / (60 * 24));
  const hours   = Math.floor((rem2 % (60 * 24)) / 60);
  const minutes = rem2 % 60;
  const parts: string[] = [];
  if (years   > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
  if (months  > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  if (days    > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours   > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  return parts.join(' ');
}

// Compact format for hero strip: "1y 2mo 14d 6h"
export function formatWatchTimeCompact(mins: number): string {
  if (mins <= 0) return '0m';
  const years   = Math.floor(mins / (60 * 24 * 365));
  const rem1    = mins % (60 * 24 * 365);
  const months  = Math.floor(rem1 / (60 * 24 * 30));
  const rem2    = rem1 % (60 * 24 * 30);
  const days    = Math.floor(rem2 / (60 * 24));
  const hours   = Math.floor((rem2 % (60 * 24)) / 60);
  const parts: string[] = [];
  if (years  > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (days   > 0) parts.push(`${days}d`);
  if (hours  > 0) parts.push(`${hours}h`);
  if (parts.length === 0) parts.push(`${mins % 60}m`);
  return parts.join(' ');
}
