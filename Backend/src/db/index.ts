import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

// Create database connection
const sqlite = new Database(process.env.DB_PATH || 'auto_ship.db')
export const db = drizzle(sqlite, { schema })

// Initialize database tables if they don't exist
export function initDatabase() {
  // This will create tables if they don't exist
  // Tables are created via schema.sql migration
  console.log('Database initialized')
}
