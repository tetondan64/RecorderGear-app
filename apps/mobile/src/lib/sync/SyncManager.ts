import { createSyncPuller } from './pull';
import { CursorStore } from './cursorStore';

export interface SyncStatus {
  isEnabled: boolean;
  isRunning: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
  totalItems: number;
  totalPages: number;
  durationMs: number;
}

export interface SyncConfiguration {
  enabled: boolean;
  maxPages: number;
  maxDurationMs: number;
  pageLimit: number;
  staleness: number;
}

/**
 * Central sync orchestrator for mobile app
 * Manages sync triggers, state, and configuration for Phase C4 Multi-Device Sync
 */
export class SyncManager {
  private static instance: SyncManager | null = null;
  private isRunning: boolean = false;
  private lastError: string | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  
  private config: SyncConfiguration = {
    enabled: true,
    maxPages: 3,
    maxDurationMs: 3000,
    pageLimit: 500,
    staleness: 5 // minutes
  };
  
  private constructor() {
    console.log('SYNC_MANAGER: Initialized');
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }
  
  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    const lastSyncAt = await CursorStore.getLastSyncAt();
    
    return {
      isEnabled: this.config.enabled,
      isRunning: this.isRunning,
      lastSyncAt,
      lastError: this.lastError,
      totalItems: 0,
      totalPages: 0,
      durationMs: 0
    };
  }
  
  /**
   * Update sync configuration
   */
  updateConfiguration(updates: Partial<SyncConfiguration>): void {
    this.config = { ...this.config, ...updates };
    console.log('SYNC_MANAGER: Configuration updated', this.config);
    this.notifyListeners();
  }
  
  /**
   * Get current configuration
   */
  getConfiguration(): SyncConfiguration {
    return { ...this.config };
  }
  
  /**
   * Subscribe to sync status changes
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Notify all listeners of status changes
   */
  private async notifyListeners(): Promise<void> {
    const status = await this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('SYNC_MANAGER: Listener error:', error);
      }
    }
  }
  
  /**
   * Manual sync trigger
   */
  async syncNow(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('Sync is disabled');
    }
    
    if (this.isRunning) {
      console.warn('SYNC_MANAGER: Sync already in progress, skipping');
      return;
    }
    
    console.log('SYNC_MANAGER: Starting manual sync...');
    await this.performSync('manual');
  }
  
  /**
   * App start sync trigger
   */
  async syncOnAppStart(): Promise<void> {
    if (!this.config.enabled) {
      console.log('SYNC_MANAGER: Sync disabled, skipping app start sync');
      return;
    }
    
    if (this.isRunning) {
      console.log('SYNC_MANAGER: Sync already running, skipping app start sync');
      return;
    }
    
    // Check if sync is stale
    const isStale = await CursorStore.isSyncStale(this.config.staleness);
    if (isStale) {
      console.log('SYNC_MANAGER: Sync is stale, triggering app start sync...');
      await this.performSync('app_start');
    } else {
      console.log('SYNC_MANAGER: Sync is fresh, skipping app start sync');
    }
  }
  
  /**
   * App foreground sync trigger
   */
  async syncOnForeground(): Promise<void> {
    if (!this.config.enabled) {
      console.log('SYNC_MANAGER: Sync disabled, skipping foreground sync');
      return;
    }
    
    if (this.isRunning) {
      console.log('SYNC_MANAGER: Sync already running, skipping foreground sync');
      return;
    }
    
    // Check if sync is stale
    const isStale = await CursorStore.isSyncStale(this.config.staleness);
    if (isStale) {
      console.log('SYNC_MANAGER: Sync is stale, triggering foreground sync...');
      await this.performSync('foreground');
    } else {
      console.log('SYNC_MANAGER: Sync is fresh, skipping foreground sync');
    }
  }
  
  /**
   * Perform sync operation with error handling
   */
  private async performSync(trigger: 'manual' | 'app_start' | 'foreground'): Promise<void> {
    if (this.isRunning) {
      console.warn('SYNC_MANAGER: Sync already in progress');
      return;
    }
    
    this.isRunning = true;
    this.lastError = null;
    
    try {
      await this.notifyListeners();
      
      console.log(`SYNC_MANAGER: Starting sync (trigger: ${trigger})`);
      
      // Create sync puller with current configuration
      const puller = createSyncPuller({
        maxPages: this.config.maxPages,
        maxDurationMs: this.config.maxDurationMs,
        pageLimit: this.config.pageLimit
      });
      
      // Execute sync
      const result = await puller.pullChanges();
      
      if (result.success) {
        console.log(`SYNC_MANAGER: Sync completed successfully`, {
          trigger,
          totalItems: result.totalItems,
          totalPages: result.totalPages,
          durationMs: result.durationMs
        });
        this.lastError = null;
      } else {
        const error = `Sync failed: ${result.error}`;
        console.error('SYNC_MANAGER:', error);
        this.lastError = error;
      }
      
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown sync error';
      console.error('SYNC_MANAGER: Sync failed with exception:', error);
      this.lastError = errorMessage;
    } finally {
      this.isRunning = false;
      await this.notifyListeners();
    }
  }
  
  /**
   * Reset sync state (clears cursor and history)
   */
  async resetSyncState(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Cannot reset sync state while sync is in progress');
    }
    
    console.log('SYNC_MANAGER: Resetting sync state...');
    
    await CursorStore.clear();
    this.lastError = null;
    
    console.log('SYNC_MANAGER: Sync state reset complete');
    await this.notifyListeners();
  }
  
  /**
   * Enable sync
   */
  async enableSync(): Promise<void> {
    this.config.enabled = true;
    console.log('SYNC_MANAGER: Sync enabled');
    await this.notifyListeners();
  }
  
  /**
   * Disable sync
   */
  async disableSync(): Promise<void> {
    if (this.isRunning) {
      console.warn('SYNC_MANAGER: Cannot disable sync while in progress');
      return;
    }
    
    this.config.enabled = false;
    console.log('SYNC_MANAGER: Sync disabled');
    await this.notifyListeners();
  }
  
  /**
   * Check if sync should run based on configuration and state
   */
  async shouldSync(): Promise<{ should: boolean; reason: string }> {
    if (!this.config.enabled) {
      return { should: false, reason: 'Sync disabled in configuration' };
    }
    
    if (this.isRunning) {
      return { should: false, reason: 'Sync already in progress' };
    }
    
    const isStale = await CursorStore.isSyncStale(this.config.staleness);
    if (!isStale) {
      return { should: false, reason: 'Sync is fresh (within staleness threshold)' };
    }
    
    return { should: true, reason: 'Sync is stale and conditions are met' };
  }
}

/**
 * Get global sync manager instance
 */
export const syncManager = SyncManager.getInstance();

/**
 * Helper functions for common sync operations
 */
export const syncHelpers = {
  /**
   * Quick manual sync
   */
  syncNow: () => syncManager.syncNow(),
  
  /**
   * Subscribe to sync status
   */
  subscribe: (listener: (status: SyncStatus) => void) => syncManager.subscribe(listener),
  
  /**
   * Get current sync status
   */
  getStatus: () => syncManager.getStatus(),
  
  /**
   * Reset sync state
   */
  resetState: () => syncManager.resetSyncState(),
  
  /**
   * Enable/disable sync
   */
  enable: () => syncManager.enableSync(),
  disable: () => syncManager.disableSync(),
  
  /**
   * Update configuration
   */
  configure: (config: Partial<SyncConfiguration>) => syncManager.updateConfiguration(config),
};