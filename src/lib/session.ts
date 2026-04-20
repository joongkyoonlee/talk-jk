const SESSION_KEY = "edu_realtime_session_v1";

export type Role = "instructor" | "student";

export interface RoomSession {
  roomId: string;
  passcode: string;
  nickname?: string;
  role: Role;
  clientId: string;
}

export function loadSession(): RoomSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as RoomSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: RoomSession | null) {
  if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(SESSION_KEY);
}

export function newClientId() {
  return Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

export function newPasscode() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export function formatKoDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", { hour12: false });
  } catch {
    return iso;
  }
}
