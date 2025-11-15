import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

declare module 'drizzle-orm/better-sqlite3' {
  interface BetterSQLite3Database<T> {
    execute(sql: string, params?: any[]): any
  }
}