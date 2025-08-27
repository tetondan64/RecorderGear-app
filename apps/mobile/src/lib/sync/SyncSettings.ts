import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SyncSettingsData {
  autoSyncEnabled: boolean;
  wifiOnlySync: boolean;
  syncPaused: boolean;
  lastSyncCheck?: string;
}

/**
 * Persistent sync settings management
 */
export class SyncSettings {
  private static readonly STORAGE_KEY = 'sync_settings';
  private settings: SyncSettingsData = {
    autoSyncEnabled: true,
    wifiOnlySync: true,
    syncPaused: false
  };

  /**
   * Load settings from storage
   */
  async load(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(SyncSettings.STORAGE_KEY);
      if (data) {
        const stored = JSON.parse(data) as SyncSettingsData;
        this.settings = { ...this.settings, ...stored };
        console.log('SyncSettings: Loaded settings:', this.settings);
      }
    } catch (error) {
      console.error('SyncSettings: Failed to load settings:', error);
    }
  }

  /**
   * Save settings to storage
   */
  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(SyncSettings.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('SyncSettings: Failed to save settings:', error);
    }
  }

  /**
   * Get current settings
   */
  async getSettings(): Promise<SyncSettingsData> {
    return { ...this.settings };
  }

  /**
   * Update auto-sync enabled setting
   */
  async setAutoSyncEnabled(enabled: boolean): Promise<void> {
    this.settings.autoSyncEnabled = enabled;
    await this.save();
    console.log(`SyncSettings: Auto-sync enabled = ${enabled}`);
  }

  /**
   * Update WiFi-only sync setting
   */
  async setWifiOnlySync(enabled: boolean): Promise<void> {
    this.settings.wifiOnlySync = enabled;
    await this.save();
    console.log(`SyncSettings: WiFi-only sync = ${enabled}`);
  }

  /**
   * Update sync paused setting
   */
  async setSyncPaused(paused: boolean): Promise<void> {
    this.settings.syncPaused = paused;
    await this.save();
    console.log(`SyncSettings: Sync paused = ${paused}`);
  }

  /**
   * Update last sync check timestamp
   */
  async setLastSyncCheck(timestamp: string): Promise<void> {
    this.settings.lastSyncCheck = timestamp;
    await this.save();
  }

  /**
   * Get individual setting values
   */
  isAutoSyncEnabled(): boolean {
    return this.settings.autoSyncEnabled;
  }

  isWifiOnlySync(): boolean {
    return this.settings.wifiOnlySync;
  }

  isSyncPaused(): boolean {
    return this.settings.syncPaused;
  }

  getLastSyncCheck(): string | undefined {
    return this.settings.lastSyncCheck;
  }

  /**
   * Reset all settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.settings = {
      autoSyncEnabled: true,
      wifiOnlySync: true,
      syncPaused: false
    };
    await this.save();
    console.log('SyncSettings: Reset to defaults');
  }
}

// Export singleton instance
export const syncSettings = new SyncSettings();