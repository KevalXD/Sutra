// Time arithmetic on timezone-less local ISO strings ("2026-11-10T09:00:00").
// Parsed as UTC purely for arithmetic so results never depend on the machine's timezone.

const RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Minutes since epoch. Throws on malformed or impossible timestamps. */
export function toMinutes(iso: string): number {
  const m = RE.exec(iso);
  if (!m) throw new Error(`Invalid timestamp: ${iso}`);
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi, 0);
  const back = new Date(ms);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59) {
    throw new Error(`Invalid timestamp: ${iso}`);
  }
  return ms / 60000;
}

export function fromMinutes(minutes: number): string {
  return new Date(minutes * 60000).toISOString().slice(0, 19);
}

export const addMinutes = (iso: string, n: number): string => fromMinutes(toMinutes(iso) + n);
export const diffMinutes = (later: string, earlier: string): number => toMinutes(later) - toMinutes(earlier);

/** "17:45" */
export const clock = (iso: string): string => iso.slice(11, 16);

const DAY = 1440;
const NIGHT_START = 23 * 60; // 23:00
const NIGHT_END = 5 * 60; //    05:00 (next day)

/** Does [start, end] touch the 23:00-05:00 overnight window of any day? Prototype rule from the UI spec. */
export function intersectsOvernight(startAt: string, endAt: string): boolean {
  const s = toMinutes(startAt);
  const e = toMinutes(endAt);
  const firstDay = Math.floor(s / DAY) - 1;
  const lastDay = Math.floor(e / DAY);
  for (let day = firstDay; day <= lastDay; day++) {
    const winStart = day * DAY + NIGHT_START;
    const winEnd = (day + 1) * DAY + NIGHT_END;
    if (s < winEnd && e > winStart) return true;
  }
  return false;
}
