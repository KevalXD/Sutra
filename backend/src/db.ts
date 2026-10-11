import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : false, max: 10 });
export async function dbHealth() { await pool.query("SELECT 1"); return true; }
export async function closeDb() { await pool.end(); }
