import {
  formatDuration,
  formatDate,
  formatTime,
  formatTimestamp,
  formatFileSize,
  validateRecordingTitle,
} from '../../utils/format';

describe('format utilities', () => {
  describe('formatDuration', () => {
    it('should format seconds to MM:SS format', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(30)).toBe('00:30');
      expect(formatDuration(90)).toBe('01:30');
      expect(formatDuration(125)).toBe('02:05');
    });

    it('should format hours when duration exceeds 1 hour', () => {
      expect(formatDuration(3600)).toBe('1:00:00'); // 1 hour
      expect(formatDuration(3661)).toBe('1:01:01'); // 1 hour, 1 minute, 1 second
      expect(formatDuration(7325)).toBe('2:02:05'); // 2 hours, 2 minutes, 5 seconds
    });

    it('should handle edge cases', () => {
      expect(formatDuration(59)).toBe('00:59');
      expect(formatDuration(3599)).toBe('59:59');
      expect(formatDuration(36000)).toBe('10:00:00');
    });

    it('should handle fractional seconds by flooring', () => {
      expect(formatDuration(30.7)).toBe('00:30');
      expect(formatDuration(90.9)).toBe('01:30');
    });
  });

  describe('formatDate', () => {
    it('should format ISO date string to readable format', () => {
      const result = formatDate('2024-01-15T10:30:00.000Z');
      expect(result).toMatch(/Jan 15, 2024/);
    });

    it('should handle different date formats', () => {
      const result1 = formatDate('2024-12-25T00:00:00.000Z');
      const result2 = formatDate('2024-07-04T12:00:00.000Z');
      
      expect(result1).toMatch(/Dec 25, 2024/);
      expect(result2).toMatch(/Jul 4, 2024/);
    });
  });

  describe('formatTime', () => {
    it('should format ISO date string to time format', () => {
      const result = formatTime('2024-01-15T14:30:00.000Z');
      expect(result).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    });

    it('should handle different times', () => {
      const morning = formatTime('2024-01-15T09:15:00.000Z');
      const evening = formatTime('2024-01-15T18:45:00.000Z');
      
      expect(morning).toMatch(/(AM|PM)/);
      expect(evening).toMatch(/(AM|PM)/);
    });
  });

  describe('formatTimestamp', () => {
    beforeEach(() => {
      // Mock current date to 2024-01-15T12:00:00.000Z
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return time format for same day', () => {
      const sameDay = '2024-01-15T08:30:00.000Z';
      const result = formatTimestamp(sameDay);
      
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('should return "Yesterday" for previous day', () => {
      const yesterday = '2024-01-14T15:00:00.000Z';
      const result = formatTimestamp(yesterday);
      
      expect(result).toBe('Yesterday');
    });

    it('should return weekday for within a week', () => {
      const daysAgo = '2024-01-12T10:00:00.000Z'; // 3 days ago (Friday if Monday is current)
      const result = formatTimestamp(daysAgo);
      
      expect(result).toMatch(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/);
    });

    it('should return month/day for same year but older than a week', () => {
      const monthsAgo = '2024-01-01T10:00:00.000Z';
      const result = formatTimestamp(monthsAgo);
      
      expect(result).toMatch(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}/);
    });

    it('should return full date for different year', () => {
      const lastYear = '2023-12-25T10:00:00.000Z';
      const result = formatTimestamp(lastYear);
      
      expect(result).toMatch(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}/);
      expect(result).toContain('2023');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(512)).toBe('512 B');
      expect(formatFileSize(1000)).toBe('1000 B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
      expect(formatFileSize(1024 * 1024 * 10)).toBe('10 MB');
    });

    it('should format gigabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatFileSize(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
    });

    it('should handle decimal precision', () => {
      expect(formatFileSize(1500)).toBe('1.5 KB');
      expect(formatFileSize(1536000)).toBe('1.5 MB');
    });
  });

  describe('validateRecordingTitle', () => {
    it('should return null for valid titles', () => {
      expect(validateRecordingTitle('Valid Title')).toBeNull();
      expect(validateRecordingTitle('Recording 123')).toBeNull();
      expect(validateRecordingTitle('Meeting Notes')).toBeNull();
      expect(validateRecordingTitle('a')).toBeNull(); // Single character
    });

    it('should reject empty or whitespace-only titles', () => {
      expect(validateRecordingTitle('')).toBe('Title cannot be empty');
      expect(validateRecordingTitle('   ')).toBe('Title cannot be empty');
      expect(validateRecordingTitle('\t\n')).toBe('Title cannot be empty');
    });

    it('should reject titles that are too long', () => {
      const longTitle = 'a'.repeat(101);
      expect(validateRecordingTitle(longTitle)).toBe('Title must be less than 100 characters');
    });

    it('should accept titles at the 100 character limit', () => {
      const maxLengthTitle = 'a'.repeat(100);
      expect(validateRecordingTitle(maxLengthTitle)).toBeNull();
    });

    it('should reject titles with invalid filename characters', () => {
      expect(validateRecordingTitle('Title<invalid')).toBe('Title contains invalid characters');
      expect(validateRecordingTitle('Title>invalid')).toBe('Title contains invalid characters');
      expect(validateRecordingTitle('Title:invalid')).toBe('Title contains invalid characters');
      expect(validateRecordingTitle('Title"invalid')).toBe('Title contains invalid characters');
      expect(validateRecordingTitle('Title/invalid')).toBe('Title contains invalid characters');
      expect(validateRecordingTitle('Title\\invalid')).toBe('Title contains invalid characters');
      expect(validateRecordingTitle('Title|invalid')).toBe('Title contains invalid characters');
      expect(validateRecordingTitle('Title?invalid')).toBe('Title contains invalid characters');
      expect(validateRecordingTitle('Title*invalid')).toBe('Title contains invalid characters');
    });

    it('should allow special characters that are valid in filenames', () => {
      expect(validateRecordingTitle('Title - Meeting (2024)')).toBeNull();
      expect(validateRecordingTitle('Recording #1')).toBeNull();
      expect(validateRecordingTitle('Project & Notes')).toBeNull();
      expect(validateRecordingTitle('Title with spaces')).toBeNull();
    });
  });
});