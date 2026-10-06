// The session token lets a refreshed tab reclaim its seat. sessionStorage is per-tab, so two tabs in the
// same browser are two different players (handy for local testing) while a refresh keeps the same player.
const TOKEN_KEY = 'pixelpawns.session';
const LOBBY_KEY = 'pixelpawns.lobby';
const NAME_KEY = 'pixelpawns.name';

function safeGet(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string | null) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) – reconnect just won't survive a refresh */
  }
}

let memoryToken: string | null = null;

export function getSessionToken(): string {
  const existing = safeGet(sessionStorage, TOKEN_KEY) ?? memoryToken;
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  memoryToken = token;
  safeSet(sessionStorage, TOKEN_KEY, token);
  return token;
}

export const getSavedLobby = () => safeGet(sessionStorage, LOBBY_KEY);
export const saveLobby = (code: string | null) => safeSet(sessionStorage, LOBBY_KEY, code);

export const getSavedName = () => safeGet(localStorage, NAME_KEY) ?? '';
export const saveName = (name: string) => safeSet(localStorage, NAME_KEY, name);
