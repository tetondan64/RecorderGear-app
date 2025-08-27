import { CursorStore } from './cursorStore';

export interface SyncChangeItem {
  type: 'recording' | 'folder' | 'tag' | 'recording_tag' | 'recording_folder';
  op: 'upsert' | 'delete';
  id: string;
  userId: string;
  updatedAt: string;
  data?: any;
  recordingId?: string;
  tagId?: string;
  folderId?: string;
  parentId?: string;
}

export interface SyncChangesResponse {
  next: string;
  hasMore: boolean;
  items: SyncChangeItem[];
}

export interface SyncPullResult {
  totalItems: number;
  totalPages: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

/**
 * Sync puller for fetching changes from API
 * Handles pagination, cursor management, and budget limits
 */
export class SyncPuller {
  private readonly maxPages: number;
  private readonly maxDurationMs: number;
  private readonly pageLimit: number;
  
  constructor(options: {
    maxPages?: number;
    maxDurationMs?: number;
    pageLimit?: number;
  } = {}) {
    this.maxPages = options.maxPages || 3;
    this.maxDurationMs = options.maxDurationMs || 3000; // 3 seconds
    this.pageLimit = options.pageLimit || 500;
  }
  
  /**
   * Pull changes from API starting from stored cursor
   */
  async pullChanges(): Promise<SyncPullResult> {
    const startTime = Date.now();
    let totalItems = 0;
    let totalPages = 0;
    
    try {
      console.log('SYNC_PULL: Starting sync pull operation...');
      
      // Get current cursor from storage
      let currentCursor = await CursorStore.getCursor();
      console.log('SYNC_PULL: Starting from cursor:', currentCursor ? `${currentCursor.substring(0, 20)}...` : 'initial');
      
      let hasMore = true;
      const allChanges: SyncChangeItem[] = [];
      
      // Pull pages within budget constraints
      while (hasMore && totalPages < this.maxPages) {
        const pageStartTime = Date.now();
        
        // Check time budget
        if (pageStartTime - startTime > this.maxDurationMs) {
          console.log('SYNC_PULL: Time budget exceeded, stopping pull');
          break;
        }
        
        // Fetch next page
        const response = await this.fetchChangesPage(currentCursor);
        totalPages++;
        totalItems += response.items.length;
        
        console.log(`SYNC_PULL: Page ${totalPages} - ${response.items.length} items, hasMore: ${response.hasMore}`);
        
        // Collect all changes for batch processing
        allChanges.push(...response.items);
        
        // Update cursor and continue
        currentCursor = response.next;
        hasMore = response.hasMore;
        
        // Log page timing
        const pageTime = Date.now() - pageStartTime;
        console.log(`SYNC_PULL: Page ${totalPages} completed in ${pageTime}ms`);
      }
      
      // Apply all changes if we have any
      if (allChanges.length > 0) {
        console.log(`SYNC_PULL: Applying ${allChanges.length} changes...`);
        
        // Import merge module dynamically to avoid circular dependencies
        const { applyChanges } = await import('./merge');
        await applyChanges(allChanges);
        
        // Update cursor and sync time only after successful application
        await CursorStore.updateCursorState(currentCursor!, new Date());
        
        console.log('SYNC_PULL: Changes applied and cursor updated');
      } else {
        // Even if no changes, update last sync time
        await CursorStore.setLastSyncAt(new Date());
        console.log('SYNC_PULL: No changes to apply, updated last sync time');
      }
      
      const durationMs = Date.now() - startTime;
      console.log(`SYNC_PULL: Sync pull completed successfully - ${totalItems} items, ${totalPages} pages, ${durationMs}ms`);
      
      return {
        totalItems,
        totalPages,
        durationMs,
        success: true
      };
      
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error('SYNC_PULL: Sync pull failed:', error);
      
      return {
        totalItems,
        totalPages,
        durationMs,
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }
  
  /**
   * Fetch a single page of changes from the API
   */
  private async fetchChangesPage(cursor: string | null): Promise<SyncChangesResponse> {
    try {
      // Import API client dynamically to avoid circular dependencies
      const { createApiClient } = await import('../api/authClient');
      
      // Get API base URL from environment or config
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const apiClient = createApiClient(baseUrl);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (cursor) {
        params.set('since', cursor);
      }
      params.set('limit', this.pageLimit.toString());
      
      const endpoint = `/v1/sync/changes?${params.toString()}`;
      
      console.log(`SYNC_PULL: Fetching ${endpoint}`);
      const response = await apiClient.get<SyncChangesResponse>(endpoint);
      
      return response.data;
      
    } catch (error: any) {
      console.error('SYNC_PULL: Failed to fetch changes page:', error);
      
      // Enhance error message for common issues
      if (error.status === 401) {
        throw new Error('Authentication failed. Please sign in again.');
      } else if (error.status === 400) {
        throw new Error('Invalid sync cursor. Sync state may need to be reset.');
      } else if (error.status >= 500) {
        throw new Error('Server error. Please try again later.');
      } else {
        throw new Error(`Sync request failed: ${error.message}`);
      }
    }
  }
}

/**
 * Create a sync puller with default configuration
 */
export function createSyncPuller(options?: {
  maxPages?: number;
  maxDurationMs?: number;
  pageLimit?: number;
}): SyncPuller {
  return new SyncPuller(options);
}

/**
 * Quick sync helper for common use cases
 */
export async function quickSync(): Promise<SyncPullResult> {
  const puller = createSyncPuller();
  return await puller.pullChanges();
}