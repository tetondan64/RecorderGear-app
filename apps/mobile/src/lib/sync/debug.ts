import { syncManager } from './SyncManager';

/**
 * Debug utilities for sync troubleshooting
 * These functions can be called from the console during development
 */

declare global {
  interface Window {
    syncDebug: {
      emergencyStop: () => Promise<void>;
      removeRecording: (id: string) => Promise<void>;
      clearAll: () => Promise<void>;
      getStatus: () => any;
    };
  }
}

// Emergency stop function to halt infinite loops
export async function emergencyStop(): Promise<void> {
  console.log('🚨 EMERGENCY STOP: Clearing sync loop...');
  
  try {
    // Remove the specific stuck recording
    await syncManager.removeRecording('1756244937042');
    
    // Clear all sync state as backup
    await syncManager.emergencyCleanup();
    
    console.log('✅ Emergency stop completed - sync loop should be stopped');
  } catch (error) {
    console.error('❌ Emergency stop failed:', error);
  }
}

// Remove specific recording from sync system
export async function removeRecording(recordingId: string): Promise<void> {
  console.log(`🗑️ Removing recording from sync: ${recordingId}`);
  
  try {
    await syncManager.removeRecording(recordingId);
    console.log(`✅ Recording removed: ${recordingId}`);
  } catch (error) {
    console.error(`❌ Failed to remove recording: ${recordingId}`, error);
  }
}

// Clear all sync state
export async function clearAllSync(): Promise<void> {
  console.log('🧹 Clearing all sync state...');
  
  try {
    await syncManager.emergencyCleanup();
    console.log('✅ All sync state cleared');
  } catch (error) {
    console.error('❌ Failed to clear sync state:', error);
  }
}

// Get current sync status for debugging
export function getSyncStatus(): any {
  try {
    const status = syncManager.getOverallStatus();
    console.log('📊 Current sync status:', status);
    return status;
  } catch (error) {
    console.error('❌ Failed to get sync status:', error);
    return null;
  }
}

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  window.syncDebug = {
    emergencyStop,
    removeRecording,
    clearAll: clearAllSync,
    getStatus: getSyncStatus,
  };

  console.log(`
🔧 Sync Debug Utilities Available:
• window.syncDebug.emergencyStop() - Stop infinite loops
• window.syncDebug.removeRecording(id) - Remove specific recording
• window.syncDebug.clearAll() - Clear all sync state
• window.syncDebug.getStatus() - Get current status

To stop the current loop immediately:
> window.syncDebug.emergencyStop()
  `);
}