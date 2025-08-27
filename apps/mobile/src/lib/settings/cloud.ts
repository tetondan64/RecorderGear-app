/**
 * Cloud sync settings management
 * Provides get/set interface for cloud sync preferences
 */

import { SyncStore } from '../fs/syncStore';
import type { CloudSettings } from '../sync/types';

export class CloudSettingsManager {
  private static instance: CloudSettingsManager;
  private cache: CloudSettings | null = null;
  private listeners: ((settings: CloudSettings) => void)[] = [];

  private constructor() {}

  static getInstance(): CloudSettingsManager {
    if (!CloudSettingsManager.instance) {
      CloudSettingsManager.instance = new CloudSettingsManager();
    }
    return CloudSettingsManager.instance;
  }

  /**
   * Initialize settings (load from storage)
   */
  async initialize(): Promise<void> {
    try {
      this.cache = await SyncStore.readSettings();
      console.log('CloudSettings: Initialized with settings:', this.cache);
    } catch (error) {
      console.error('CloudSettings: Failed to initialize:', error);
      this.cache = SyncStore.getDefaultSettings();
    }
  }

  /**
   * Get current cloud settings
   */
  async getSettings(): Promise<CloudSettings> {
    if (!this.cache) {
      await this.initialize();
    }
    return { ...this.cache! };
  }

  /**
   * Update cloud settings and persist
   */
  async setSettings(settings: Partial<CloudSettings>): Promise<void> {
    if (!this.cache) {
      await this.initialize();
    }

    const newSettings: CloudSettings = {
      ...this.cache!,
      ...settings,
    };

    try {
      await SyncStore.writeSettings(newSettings);
      this.cache = newSettings;
      this.notifyListeners(newSettings);
      console.log('CloudSettings: Updated settings:', newSettings);
    } catch (error) {
      console.error('CloudSettings: Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Get individual setting values
   */
  async isAutoSyncEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.autoSyncEnabled;
  }

  async isWifiOnly(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.wifiOnly;
  }

  async isPaused(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.paused;
  }

  /**
   * Set individual settings
   */
  async setAutoSyncEnabled(enabled: boolean): Promise<void> {
    await this.setSettings({ autoSyncEnabled: enabled });
  }

  async setWifiOnly(enabled: boolean): Promise<void> {
    await this.setSettings({ wifiOnly: enabled });
  }

  async setPaused(paused: boolean): Promise<void> {
    await this.setSettings({ paused });
  }

  /**
   * Reset to default settings
   */
  async resetToDefaults(): Promise<void> {
    const defaults = SyncStore.getDefaultSettings();
    await this.setSettings(defaults);
  }

  /**
   * Add settings change listener
   */
  onSettingsChange(listener: (settings: CloudSettings) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Check if sync should be allowed based on current settings and conditions
   */
  async shouldAllowSync(networkType: 'WIFI' | 'CELLULAR' | 'NONE' | 'UNKNOWN'): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const settings = await this.getSettings();

    if (!settings.autoSyncEnabled) {
      return { allowed: false, reason: 'Auto-sync disabled' };
    }

    if (settings.paused) {
      return { allowed: false, reason: 'Sync paused' };
    }

    if (networkType === 'NONE') {
      return { allowed: false, reason: 'No network connection' };
    }

    if (settings.wifiOnly && networkType !== 'WIFI') {
      return { allowed: false, reason: 'WiFi-only mode enabled' };
    }

    return { allowed: true };
  }

  private notifyListeners(settings: CloudSettings): void {
    this.listeners.forEach(listener => {
      try {
        listener(settings);
      } catch (error) {
        console.error('CloudSettings: Error in settings listener:', error);
      }
    });
  }
}

// Export singleton instance
export const cloudSettings = CloudSettingsManager.getInstance();