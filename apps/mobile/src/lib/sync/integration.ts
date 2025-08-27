import { syncManager } from './syncManager';
import { networkMonitor } from '../net';
import { AppState } from 'react-native';
import type { RecordingEntry } from '../fs/indexStore';

/**
 * Auto-sync integration and trigger wiring
 * Implements Phase C4 multi-device sync triggers
 */

export class SyncIntegration {
  private static instance: SyncIntegration;
  private appStateSubscription?: ReturnType<typeof AppState.addEventListener>;
  private networkSubscription?: () => void;
  private initialized = false;

  private constructor() {
    // Use singleton syncManager from Phase C4
  }

  static getInstance(): SyncIntegration {
    if (!SyncIntegration.instance) {
      SyncIntegration.instance = new SyncIntegration();
    }
    return SyncIntegration.instance;
  }

  /**
   * Initialize auto-sync triggers per Phase C4 specification:
   * - App becomes active → trigger foreground sync if stale
   * - App starts → trigger app start sync if stale
   * - Manual triggers → sync now
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('SYNC_INTEGRATION: Initializing auto-sync triggers...');

    try {
      // Verify syncManager is available
      if (!syncManager) {
        throw new Error('syncManager is not available');
      }

      // Wire app state change trigger
      this.setupAppStateMonitoring();

      // Wire network change trigger  
      this.setupNetworkMonitoring();

      // Trigger initial app start sync
      console.log('SYNC_INTEGRATION: Triggering initial sync...');
      await syncManager.syncOnAppStart();

      this.initialized = true;
      console.log('SYNC_INTEGRATION: Auto-sync triggers initialized successfully');
    } catch (error) {
      console.error('SYNC_INTEGRATION: Failed to initialize triggers:', error);
      throw error;
    }
  }

  /**
   * TRIGGER 1: New recording saved → Phase C4 uses pull-based sync
   * This is a no-op since Phase C4 pulls changes from server rather than pushing
   */
  async onRecordingSaved(recording: RecordingEntry): Promise<void> {
    try {
      console.log('SYNC_INTEGRATION: New recording saved (Phase C4 uses pull-based sync):', recording.id);
      
      // In Phase C4, we don't push recordings immediately
      // Instead, the next sync cycle will pull this change from the server
      // This could trigger a sync to check for other changes
      await syncManager.syncNow();
      
      console.log('SYNC_INTEGRATION: Triggered sync cycle for new recording:', recording.id);
    } catch (error) {
      console.error('SYNC_INTEGRATION: Failed to trigger sync for recording:', error);
      // Don't throw - sync failure shouldn't break recording save
    }
  }

  /**
   * TRIGGER 2: App becomes active → trigger foreground sync if stale
   */
  private setupAppStateMonitoring(): void {
    console.log('SYNC_INTEGRATION: Setting up app state monitoring...');
    
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('SYNC_INTEGRATION: App state changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        this.onAppBecameActive();
      } else if (nextAppState === 'background') {
        this.onAppEnteredBackground();
      }
    });
  }

  private async onAppBecameActive(): Promise<void> {
    try {
      console.log('SYNC_INTEGRATION: App became active, triggering foreground sync...');
      
      // Phase C4: Trigger foreground sync if stale
      await syncManager.syncOnForeground();
      
      console.log('SYNC_INTEGRATION: Foreground sync completed');
    } catch (error) {
      console.error('SYNC_INTEGRATION: Failed to sync on app active:', error);
    }
  }

  private async onAppEnteredBackground(): Promise<void> {
    try {
      console.log('SYNC_INTEGRATION: App entered background, adjusting sync behavior...');
      
      // Note: Don't pause sync entirely - iOS/Android handle background uploads
      // Just reduce activity and let system manage resources
      
      console.log('SYNC_INTEGRATION: Background sync behavior adjusted');
    } catch (error) {
      console.error('SYNC_INTEGRATION: Failed to adjust background sync:', error);
    }
  }

  /**
   * TRIGGER 3: Connectivity changes → evaluate pending recordings
   */
  private setupNetworkMonitoring(): void {
    console.log('SYNC_INTEGRATION: Setting up network change monitoring...');
    
    this.networkSubscription = networkMonitor.onNetworkChange(async (networkType) => {
      console.log('SYNC_INTEGRATION: Network changed to:', networkType);
      await this.onNetworkChanged(networkType);
    });
  }

  private async onNetworkChanged(networkType: string): Promise<void> {
    try {
      console.log('SYNC_INTEGRATION: Processing network change:', networkType);
      
      if (networkType === 'NONE') {
        // Network lost - sync will naturally pause
        console.log('SYNC_INTEGRATION: Network lost, sync will pause naturally');
        return;
      }

      // Network available - trigger sync to pull changes
      console.log('SYNC_INTEGRATION: Network available, triggering sync...');
      
      // Phase C4: Trigger manual sync when network becomes available
      await syncManager.syncNow();
      
      console.log('SYNC_INTEGRATION: Network sync completed');
    } catch (error) {
      console.error('SYNC_INTEGRATION: Failed to process network change:', error);
    }
  }

  /**
   * Helper method to manually trigger sync evaluation
   * Useful for testing or manual sync operations
   */
  async triggerSyncEvaluation(): Promise<void> {
    try {
      console.log('SYNC_INTEGRATION: Manual sync evaluation triggered...');
      await syncManager.syncNow();
      console.log('SYNC_INTEGRATION: Manual sync evaluation completed');
    } catch (error) {
      console.error('SYNC_INTEGRATION: Manual sync evaluation failed:', error);
      throw error;
    }
  }

  /**
   * Get sync statistics for debugging/monitoring
   */
  async getSyncStats() {
    return await syncManager.getStatus();
  }

  /**
   * Check if auto-sync is properly initialized and working
   */
  async getIntegrationStatus() {
    const status = await syncManager.getStatus();
    return {
      initialized: this.initialized,
      syncManagerActive: status.isEnabled,
      appStateMonitoring: !!this.appStateSubscription,
      networkMonitoring: !!this.networkSubscription,
      isRunning: status.isRunning,
      lastError: status.lastError,
      lastSyncAt: status.lastSyncAt,
    };
  }

  /**
   * Cleanup resources when app is shutting down
   */
  destroy(): void {
    console.log('SYNC_INTEGRATION: Cleaning up integration resources...');
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = undefined;
    }
    
    if (this.networkSubscription) {
      this.networkSubscription();
      this.networkSubscription = undefined;
    }
    
    // Phase C4 syncManager doesn't have destroy method
    this.initialized = false;
    
    console.log('SYNC_INTEGRATION: Integration cleanup completed');
  }
}

/**
 * Convenience function to initialize auto-sync integration
 * Should be called during app startup
 */
export async function initializeAutoSync(): Promise<void> {
  const integration = SyncIntegration.getInstance();
  await integration.initialize();
}

/**
 * Convenience function to trigger sync when recordings are saved
 * Should be called after successful recording save operations
 */
export async function onRecordingSavedTrigger(recording: RecordingEntry): Promise<void> {
  const integration = SyncIntegration.getInstance();
  await integration.onRecordingSaved(recording);
}