export const FIRST_VISIT_KEY = "jtalk_first_visit_date";
export const DISMISSED_UNTIL_KEY = "jtalk_promo_dismissed_until";
export const HIDE_DAYS = 7;

/** Local date as YYYY-MM-DD */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Paths where the promo must never appear (live classroom, admin). */
export function isExcludedPath(pathname: string): boolean {
  return /^\/(room|admin)(\/|$)/.test(pathname);
}

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/**
 * Records first visit if missing and returns whether the promo should show.
 * Returning visitor = first visit date differs from today (local).
 */
export function evaluatePromo(storage: Storage, now: Date = new Date()): boolean {
  const today = localDateString(now);
  const first = safeGet(storage, FIRST_VISIT_KEY);
  if (!first) {
    safeSet(storage, FIRST_VISIT_KEY, today);
    return false;
  }
  if (first >= today) return false;
  const until = Number(safeGet(storage, DISMISSED_UNTIL_KEY) || 0);
  if (until && now.getTime() < until) return false;
  return true;
}

export function dismissPromo(storage: Storage, now: Date = new Date()) {
  safeSet(storage, DISMISSED_UNTIL_KEY, String(now.getTime() + HIDE_DAYS * 24 * 60 * 60 * 1000));
}
