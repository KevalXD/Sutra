import fs from "node:fs/promises";
import path from "node:path";
import { pool, closeDb } from "./db.js";
const sql = await fs.readFile(path.resolve("migrations/001_init.sql"), "utf8");
await pool.query(sql);
await closeDb();
console.log("Sutra database migration complete");
