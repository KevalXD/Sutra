import { createHash, randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { pool } from "./db.js";
import { config } from "./config.js";

const scrypt = promisify(nodeScrypt);
export type AuthUser = { id: string; fullName: string; email: string; createdAt: string };
export class AuthError extends Error { constructor(public code: string, message: string, public status = 401) { super(message); } }
function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
async function passwordHash(password: string, salt: string) { const derived = await scrypt(password, salt, 64) as Buffer; return derived.toString("hex"); }
function requirePostgres() { if (config.STORAGE_MODE !== "postgres") throw new AuthError("AUTH_NOT_CONFIGURED", "Authentication requires PostgreSQL storage to be configured.", 503); }
function rowUser(row: { id: string; full_name: string; email: string; created_at: Date | string }): AuthUser { return { id: row.id, fullName: row.full_name, email: row.email, createdAt: new Date(row.created_at).toISOString() }; }

export async function createAccount(fullName: string, email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  requirePostgres();
  const normalized = normalizeEmail(email); const salt = randomBytes(16).toString("hex"); const hash = await passwordHash(password, salt); const client = await pool.connect();
  try { await client.query("BEGIN"); const inserted = await client.query("INSERT INTO users(id, full_name, email, password_hash, password_salt) VALUES($1,$2,$3,$4,$5) RETURNING id,full_name,email,created_at", [randomUUID(), fullName.trim(), normalized, hash, salt]); const session = await issueSession(client, inserted.rows[0].id); await client.query("COMMIT"); return { user: rowUser(inserted.rows[0]), token: session }; }
  catch (error) { await client.query("ROLLBACK"); if ((error as { code?: string }).code === "23505") throw new AuthError("ACCOUNT_EXISTS", "An account with this email already exists.", 409); throw error; }
  finally { client.release(); }
}
export async function login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  requirePostgres(); const result = await pool.query("SELECT id,full_name,email,password_hash,password_salt,created_at FROM users WHERE email=$1", [normalizeEmail(email)]); const row = result.rows[0];
  if (!row) throw new AuthError("INVALID_CREDENTIALS", "Email or password is incorrect."); const expected = Buffer.from(row.password_hash, "hex"); const actual = Buffer.from(await passwordHash(password, row.password_salt), "hex"); if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new AuthError("INVALID_CREDENTIALS", "Email or password is incorrect."); return { user: rowUser(row), token: await issueSession(pool, row.id) };
}
async function issueSession(client: { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> }, userId: string) { const token = randomBytes(32).toString("base64url"); const expires = new Date(Date.now() + config.SESSION_TTL_HOURS * 3600_000); await client.query("INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)", [tokenHash(token), userId, expires]); return token; }
export async function sessionUser(token?: string): Promise<AuthUser | null> { requirePostgres(); if (!token) return null; const result = await pool.query("SELECT u.id,u.full_name,u.email,u.created_at FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()", [tokenHash(token)]); return result.rows[0] ? rowUser(result.rows[0]) : null; }
export async function logout(token?: string) { requirePostgres(); if (token) await pool.query("DELETE FROM auth_sessions WHERE token_hash=$1", [tokenHash(token)]); }
