import { sql } from 'drizzle-orm';
import { db } from './client';

export interface SyncCursor {
  timestamp: number; // Unix timestamp in milliseconds
  sequence: number;  // Tie-breaker for same timestamp
}

export interface SyncChangeItem {
  type: 'recording' | 'folder' | 'tag' | 'recording_tag' | 'recording_folder';
  op: 'upsert' | 'delete';
  id: string;
  userId: string;
  updatedAt: string;
  data?: any;
  recordingId?: string; // For relationship changes
  tagId?: string;
  folderId?: string;
  parentId?: string;
}

export interface SyncChangesResponse {
  next: string;
  hasMore: boolean;
  items: SyncChangeItem[];
}

/**
 * Encode cursor to opaque base64 string
 */
export function encodeCursor(cursor: SyncCursor): string {
  const encoded = Buffer.from(JSON.stringify(cursor)).toString('base64');
  return encoded;
}

/**
 * Decode cursor from base64 string
 */
export function decodeCursor(cursorString: string): SyncCursor {
  try {
    const decoded = Buffer.from(cursorString, 'base64').toString('utf-8');
    const cursor = JSON.parse(decoded) as SyncCursor;
    
    if (typeof cursor.timestamp !== 'number' || typeof cursor.sequence !== 'number') {
      throw new Error('Invalid cursor format');
    }
    
    return cursor;
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

/**
 * Create initial cursor for first sync
 */
export function createInitialCursor(): SyncCursor {
  return {
    timestamp: 0,
    sequence: 0
  };
}

/**
 * Create next cursor from current timestamp and sequence
 */
export function createNextCursor(timestamp: number, sequence: number): SyncCursor {
  return {
    timestamp,
    sequence: sequence + 1
  };
}

/**
 * Query changes since cursor for a specific user
 * Returns changes in deterministic order: timestamp ASC, then by table priority, then by ID
 */
export async function getChangesSinceCursor(
  userId: string,
  cursor: SyncCursor,
  limit: number = 500
): Promise<SyncChangesResponse> {
  const maxTimestamp = Date.now();
  
  // Build the main query that unions all change sources
  // Order by: updated_at ASC, type priority, id ASC for deterministic results
  const query = sql`
    WITH change_sources AS (
      -- Recordings (priority 1)
      SELECT 
        'recording' as type,
        CASE WHEN deleted_at IS NOT NULL THEN 'delete' ELSE 'upsert' END as op,
        id,
        user_id,
        EXTRACT(EPOCH FROM updated_at) * 1000 as updated_at_ms,
        updated_at::text as updated_at,
        jsonb_build_object(
          'title', title,
          'durationSec', duration_sec,
          's3Key', s3_key,
          'createdAt', created_at::text,
          'folderId', (SELECT folder_id FROM recording_folders WHERE recording_id = recordings.id)
        ) as data,
        null::text as recording_id,
        null::uuid as tag_id,
        null::uuid as folder_id,
        null::uuid as parent_id,
        1 as type_priority
      FROM recordings
      WHERE user_id = ${userId}
        AND (
          EXTRACT(EPOCH FROM updated_at) * 1000 > ${cursor.timestamp}
          OR (
            EXTRACT(EPOCH FROM updated_at) * 1000 = ${cursor.timestamp}
            AND id > ${cursor.sequence.toString()}
          )
        )
        AND EXTRACT(EPOCH FROM updated_at) * 1000 <= ${maxTimestamp}
      
      UNION ALL
      
      -- Folders (priority 2) 
      SELECT 
        'folder' as type,
        CASE WHEN deleted_at IS NOT NULL THEN 'delete' ELSE 'upsert' END as op,
        id::text,
        user_id,
        EXTRACT(EPOCH FROM updated_at) * 1000 as updated_at_ms,
        updated_at::text as updated_at,
        jsonb_build_object(
          'name', name,
          'parentId', parent_id::text,
          'createdAt', created_at::text
        ) as data,
        null::text as recording_id,
        null::uuid as tag_id,
        null::uuid as folder_id,
        parent_id as parent_id,
        2 as type_priority
      FROM folders
      WHERE user_id = ${userId}
        AND (
          EXTRACT(EPOCH FROM updated_at) * 1000 > ${cursor.timestamp}
          OR (
            EXTRACT(EPOCH FROM updated_at) * 1000 = ${cursor.timestamp}
            AND id::text > ${cursor.sequence.toString()}
          )
        )
        AND EXTRACT(EPOCH FROM updated_at) * 1000 <= ${maxTimestamp}
      
      UNION ALL
      
      -- Tags (priority 3)
      SELECT 
        'tag' as type,
        CASE WHEN deleted_at IS NOT NULL THEN 'delete' ELSE 'upsert' END as op,
        id::text,
        user_id,
        EXTRACT(EPOCH FROM updated_at) * 1000 as updated_at_ms,
        updated_at::text as updated_at,
        jsonb_build_object(
          'name', name,
          'createdAt', created_at::text
        ) as data,
        null::text as recording_id,
        null::uuid as tag_id,
        null::uuid as folder_id,
        null::uuid as parent_id,
        3 as type_priority
      FROM tags
      WHERE user_id = ${userId}
        AND (
          EXTRACT(EPOCH FROM updated_at) * 1000 > ${cursor.timestamp}
          OR (
            EXTRACT(EPOCH FROM updated_at) * 1000 = ${cursor.timestamp}
            AND id::text > ${cursor.sequence.toString()}
          )
        )
        AND EXTRACT(EPOCH FROM updated_at) * 1000 <= ${maxTimestamp}
      
      UNION ALL
      
      -- Recording-Tag relationships (priority 4)
      SELECT 
        'recording_tag' as type,
        CASE WHEN deleted_at IS NOT NULL THEN 'delete' ELSE 'upsert' END as op,
        (recording_id || '/' || tag_id::text) as id,
        r.user_id,
        EXTRACT(EPOCH FROM rt.updated_at) * 1000 as updated_at_ms,
        rt.updated_at::text as updated_at,
        null as data,
        recording_id,
        tag_id,
        null::uuid as folder_id,
        null::uuid as parent_id,
        4 as type_priority
      FROM recording_tags rt
      JOIN recordings r ON rt.recording_id = r.id
      WHERE r.user_id = ${userId}
        AND (
          EXTRACT(EPOCH FROM rt.updated_at) * 1000 > ${cursor.timestamp}
          OR (
            EXTRACT(EPOCH FROM rt.updated_at) * 1000 = ${cursor.timestamp}
            AND (recording_id || '/' || tag_id::text) > ${cursor.sequence.toString()}
          )
        )
        AND EXTRACT(EPOCH FROM rt.updated_at) * 1000 <= ${maxTimestamp}
      
      UNION ALL
      
      -- Recording-Folder relationships (priority 5)
      SELECT 
        'recording_folder' as type,
        'upsert' as op, -- folder assignments are always upserts (null folderId = unassign)
        recording_id as id,
        r.user_id,
        EXTRACT(EPOCH FROM rf.created_at) * 1000 as updated_at_ms,
        rf.created_at::text as updated_at,
        jsonb_build_object('folderId', folder_id::text) as data,
        recording_id,
        null::uuid as tag_id,
        folder_id,
        null::uuid as parent_id,
        5 as type_priority
      FROM recording_folders rf
      JOIN recordings r ON rf.recording_id = r.id
      WHERE r.user_id = ${userId}
        AND (
          EXTRACT(EPOCH FROM rf.created_at) * 1000 > ${cursor.timestamp}
          OR (
            EXTRACT(EPOCH FROM rf.created_at) * 1000 = ${cursor.timestamp}
            AND recording_id > ${cursor.sequence.toString()}
          )
        )
        AND EXTRACT(EPOCH FROM rf.created_at) * 1000 <= ${maxTimestamp}
    )
    SELECT *
    FROM change_sources
    ORDER BY updated_at_ms ASC, type_priority ASC, id ASC
    LIMIT ${limit + 1}
  `;

  const results = await db.execute(query);
  const rows = results as any[];
  
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, -1) : rows).map((row: any) => {
    const item: SyncChangeItem = {
      type: row.type,
      op: row.op,
      id: row.id,
      userId: row.user_id,
      updatedAt: row.updated_at,
      ...(row.data && { data: row.data }),
      ...(row.recording_id && { recordingId: row.recording_id }),
      ...(row.tag_id && { tagId: row.tag_id }),
      ...(row.folder_id && { folderId: row.folder_id }),
      ...(row.parent_id && { parentId: row.parent_id })
    };
    return item;
  });

  // Calculate next cursor based on last item
  let nextCursor: SyncCursor;
  if (items.length === 0) {
    // No changes, return cursor for current time
    nextCursor = { timestamp: maxTimestamp, sequence: 0 };
  } else {
    const lastItem = items[items.length - 1];
    const lastTimestamp = Math.floor(new Date(lastItem.updatedAt).getTime());
    nextCursor = createNextCursor(lastTimestamp, 0);
  }

  return {
    next: encodeCursor(nextCursor),
    hasMore,
    items
  };
}

/**
 * Validate cursor and return parsed version or throw error
 */
export function validateCursor(cursorString?: string): SyncCursor {
  if (!cursorString || cursorString === 'null' || cursorString === 'undefined') {
    return createInitialCursor();
  }
  
  try {
    return decodeCursor(cursorString);
  } catch (error) {
    throw new Error(`Invalid cursor format: ${error.message}`);
  }
}