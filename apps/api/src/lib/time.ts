/**
 * Time utilities for consistent timestamp handling
 */

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

export function parseTimestamp(timestamp: string): Date {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp format: ${timestamp}`);
  }
  return date;
}

export function isValidTimestamp(timestamp: string): boolean {
  try {
    parseTimestamp(timestamp);
    return true;
  } catch {
    return false;
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function addSeconds(timestamp: string, seconds: number): string {
  const date = parseTimestamp(timestamp);
  date.setSeconds(date.getSeconds() + seconds);
  return date.toISOString();
}