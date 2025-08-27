import { AppState } from 'react-native';
import type { RecordingEntry } from '../fs/indexStore';

/**
 * Simple Phase C4 sync integration without complex dependencies
 * Avoids circular import issues and provides direct access to sync functions
 */

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let initialized = false;

/**
 * Initialize Phase C4 sync triggers
 */
export async function initializeAutoSync(): Promise<void> {
  if (initialized) {
    console.log('SIMPLE_SYNC: Already initialized, skipping...');
    return;
  }

  console.log('SIMPLE_SYNC: Initializing Phase C4 auto-sync triggers...');

  try {
    // Import SyncManager dynamically to avoid circular dependencies
    const { syncManager } = await import('./SyncManager');
    
    // Wire app state monitoring
    setupAppStateMonitoring(syncManager);
    
    // Trigger initial app start sync
    console.log('SIMPLE_SYNC: Triggering initial app start sync...');
    await syncManager.syncOnAppStart();
    
    initialized = true;
    console.log('SIMPLE_SYNC: Auto-sync triggers initialized successfully');
    
  } catch (error) {
    console.error('SIMPLE_SYNC: Failed to initialize sync:', error);
    // Don't throw - let app continue without sync
  }
}

/**
 * Set up app state monitoring for foreground sync trigger
 */
function setupAppStateMonitoring(syncManager: any): void {
  console.log('SIMPLE_SYNC: Setting up app state monitoring...');
  
  appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
    console.log('SIMPLE_SYNC: App state changed to:', nextAppState);
    
    if (nextAppState === 'active') {
      try {
        console.log('SIMPLE_SYNC: App became active, triggering foreground sync...');
        await syncManager.syncOnForeground();
        console.log('SIMPLE_SYNC: Foreground sync completed');
      } catch (error) {
        console.error('SIMPLE_SYNC: Foreground sync failed:', error);
      }
    }
  });
}

/**
 * Handle new recording saved (Phase C4 uses pull-based sync)
 */
export async function onRecordingSavedTrigger(recording: RecordingEntry): Promise<void> {
  try {
    console.log('SIMPLE_SYNC: New recording saved (triggering sync):', recording.id);
    
    // Import syncManager dynamically
    const { syncManager } = await import('./SyncManager');
    
    // In Phase C4, we pull changes rather than push
    // Trigger a sync to pick up any other changes that might exist
    await syncManager.syncNow();
    
    console.log('SIMPLE_SYNC: Sync triggered for new recording');
  } catch (error) {
    console.error('SIMPLE_SYNC: Failed to trigger sync for recording:', error);
    // Don't throw - sync failure shouldn't break recording save
  }
}

/**
 * Manual sync trigger
 */
export async function triggerManualSync(): Promise<void> {
  try {
    console.log('SIMPLE_SYNC: Manual sync triggered...');
    
    const { syncManager } = await import('./SyncManager');
    await syncManager.syncNow();
    
    console.log('SIMPLE_SYNC: Manual sync completed');
  } catch (error) {
    console.error('SIMPLE_SYNC: Manual sync failed:', error);
    throw error;
  }
}

/**
 * Get sync status
 */
export async function getSyncStatus() {
  try {
    const { syncManager } = await import('./SyncManager');
    return await syncManager.getStatus();
  } catch (error) {
    console.error('SIMPLE_SYNC: Failed to get sync status:', error);
    return {
      isEnabled: false,
      isRunning: false,
      lastSyncAt: null,
      lastError: 'Failed to load sync manager',
      totalItems: 0,
      totalPages: 0,
      durationMs: 0
    };
  }
}

/**
 * Cleanup on app shutdown
 */
export function cleanupAutoSync(): void {
  console.log('SIMPLE_SYNC: Cleaning up auto-sync...');
  
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  
  initialized = false;
  console.log('SIMPLE_SYNC: Cleanup completed');
}