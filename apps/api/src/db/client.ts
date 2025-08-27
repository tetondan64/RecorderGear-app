import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Environment validation
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

/**
 * PostgreSQL connection pool
 * Configured for development and production use
 */
const pool = new Pool({
  connectionString,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
});

/**
 * Drizzle ORM instance with schema
 * This is the main database interface used throughout the application
 */
export const db = drizzle(pool, { schema });

/**
 * Health check function for database connectivity
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1 as health');
    return result.rows.length === 1 && result.rows[0].health === 1;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Gracefully close database connections
 * Should be called during application shutdown
 */
export async function closeDatabaseConnections(): Promise<void> {
  try {
    await pool.end();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
}

/**
 * Raw pool access for direct queries if needed
 * Use sparingly - prefer Drizzle ORM methods
 */
export { pool };

// Export schema for use in other modules
export * from './schema';
export { devices, refreshTokens, emailOtps } from './schema';