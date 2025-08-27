/**
 * Sync module exports for Phase C4 Multi-Device Sync
 * 
 * Core Components:
 * - SyncManager: Central orchestrator with lifecycle triggers
 * - SyncPuller: Pull changes with budget limits 
 * - Merge Algorithm: CRDT-inspired conflict resolution
 * - Cursor Store: Persistent sync state management
 */

// Core sync orchestrator
export { SyncManager, syncManager, syncHelpers } from './syncManager';
export type { SyncStatus, SyncConfiguration } from './syncManager';

// Pull mechanism
export { SyncPuller, createSyncPuller, quickSync } from './pull';
export type { SyncChangeItem, SyncChangesResponse, SyncPullResult } from './pull';

// Merge algorithm
export { applyChanges } from './merge';

// Cursor management
export { CursorStore } from './cursorStore';

// Types
export type { SyncChangeItem as SyncItem } from './pull';