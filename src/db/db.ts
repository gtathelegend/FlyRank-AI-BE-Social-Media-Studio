import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

const { Pool } = pg;

export let pool: pg.Pool | null = null;
export let isDbConnected = false;

export async function initDatabase(): Promise<boolean> {
  const connectionString =
    env.DATABASE_URL ||
    `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`;

  try {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000
    });

    // Test connection
    const client = await pool.connect();
    client.release();
    isDbConnected = true;
    console.log(`[Database] Connected to PostgreSQL at ${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`);

    // Apply schema migrations in order
    const migrationsDir = path.resolve(process.cwd(), 'src/db/migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');
        await pool.query(sql);
        console.log(`[Database] Schema migration ${file} applied successfully.`);
      }
    }

    return true;
  } catch (err: any) {
    console.warn(`[Database] PostgreSQL connection unavailable (${err.message}). Falling back to repository layer.`);
    isDbConnected = false;
    return false;
  }
}

export async function query(text: string, params?: any[]): Promise<pg.QueryResult | null> {
  if (!pool || !isDbConnected) {
    return null;
  }
  try {
    return await pool.query(text, params);
  } catch (err: any) {
    console.error(`[Database Query Error]: ${err.message}`);
    throw err;
  }
}
