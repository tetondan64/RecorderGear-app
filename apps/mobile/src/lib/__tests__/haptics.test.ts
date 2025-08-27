import * as Haptics from 'expo-haptics';
import { HapticsManager } from '../haptics';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

const mockHaptics = Haptics as jest.Mocked<typeof Haptics>;

describe('HapticsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recordStart', () => {
    it('should trigger medium impact haptic', async () => {
      mockHaptics.impactAsync.mockResolvedValue();

      await HapticsManager.recordStart();

      expect(mockHaptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium
      );
    });

    it('should handle haptics errors gracefully', async () => {
      mockHaptics.impactAsync.mockRejectedValue(new Error('Haptics not available'));

      await expect(HapticsManager.recordStart()).resolves.not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        'Haptics not available for record start:',
        expect.any(Error)
      );
    });
  });

  describe('recordStop', () => {
    it('should trigger success notification haptic', async () => {
      mockHaptics.notificationAsync.mockResolvedValue();

      await HapticsManager.recordStop();

      expect(mockHaptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });

    it('should handle haptics errors gracefully', async () => {
      mockHaptics.notificationAsync.mockRejectedValue(new Error('Haptics not available'));

      await expect(HapticsManager.recordStop()).resolves.not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        'Haptics not available for record stop:',
        expect.any(Error)
      );
    });
  });

  describe('playToggle', () => {
    it('should trigger light impact haptic', async () => {
      mockHaptics.impactAsync.mockResolvedValue();

      await HapticsManager.playToggle();

      expect(mockHaptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    it('should handle haptics errors gracefully', async () => {
      mockHaptics.impactAsync.mockRejectedValue(new Error('Haptics not available'));

      await expect(HapticsManager.playToggle()).resolves.not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        'Haptics not available for play toggle:',
        expect.any(Error)
      );
    });
  });

  describe('delete', () => {
    it('should trigger warning notification haptic', async () => {
      mockHaptics.notificationAsync.mockResolvedValue();

      await HapticsManager.delete();

      expect(mockHaptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Warning
      );
    });

    it('should handle haptics errors gracefully', async () => {
      mockHaptics.notificationAsync.mockRejectedValue(new Error('Haptics not available'));

      await expect(HapticsManager.delete()).resolves.not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        'Haptics not available for delete:',
        expect.any(Error)
      );
    });
  });

  describe('success', () => {
    it('should trigger success notification haptic', async () => {
      mockHaptics.notificationAsync.mockResolvedValue();

      await HapticsManager.success();

      expect(mockHaptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });

    it('should handle haptics errors gracefully', async () => {
      mockHaptics.notificationAsync.mockRejectedValue(new Error('Haptics not available'));

      await expect(HapticsManager.success()).resolves.not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        'Haptics not available for success:',
        expect.any(Error)
      );
    });
  });
});