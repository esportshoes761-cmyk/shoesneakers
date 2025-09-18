import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";

// Use persistent SQLite database file
const databasePath = './database.sqlite';

// Create SQLite database connection with better-sqlite3
const sqlite = new Database(databasePath);

// Enable WAL mode for better performance and concurrency
sqlite.pragma('journal_mode = WAL');

// Create Drizzle instance with SQLite
export const db = drizzle(sqlite, { schema });
export { sqlite };