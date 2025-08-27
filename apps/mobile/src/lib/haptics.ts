import * as Haptics from 'expo-haptics';

export class HapticsManager {
  static async recordStart(): Promise<void> {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      // Haptics may not be available on all devices
      console.warn('Haptics not available for record start:', error);
    }
  }

  static async recordStop(): Promise<void> {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('Haptics not available for record stop:', error);
    }
  }

  static async playToggle(): Promise<void> {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.warn('Haptics not available for play toggle:', error);
    }
  }

  static async delete(): Promise<void> {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.warn('Haptics not available for delete:', error);
    }
  }

  static async success(): Promise<void> {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('Haptics not available for success:', error);
    }
  }
}