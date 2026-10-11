import fs from "node:fs/promises";
import path from "node:path";
import { pool, closeDb } from "./db.js";
const directory = path.resolve("migrations");
const files = (await fs.readdir(directory)).filter(file => file.endsWith(".sql")).sort();
for (const file of files) await pool.query(await fs.readFile(path.join(directory, file), "utf8"));
await closeDb();
console.log("Sutra database migration complete");
