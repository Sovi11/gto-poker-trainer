import { useEffect, useState } from 'react';
import { loadJSON, saveJSON, purgeProfile, scopedKey, setActiveProfileKey } from './storage';

// Local profiles — not authentication.
//
// Everything in this app lives in the browser, so there is no server to log in
// to and nothing a password could actually protect: anyone with the machine can
// read localStorage directly. What people genuinely want here is separate
// progress per person and a way to switch, which is exactly what this gives.

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
}

export const AVATARS = ['♠', '♥', '♦', '♣', '🂡', '🎩', '🦈', '🪨', '🔥', '🐟', '🤖', '🚉'];

const PROFILES_KEY = 'profiles';
const ACTIVE_KEY = 'activeProfile';

export function listProfiles(): Profile[] {
  return loadJSON<Profile[]>(PROFILES_KEY, []);
}

export function getActiveProfileId(): string | null {
  return loadJSON<string | null>(ACTIVE_KEY, null);
}

function persist(list: Profile[]): void {
  saveJSON(PROFILES_KEY, list);
}

export function createProfile(name: string, avatar: string): Profile {
  const clean = name.trim().slice(0, 24) || 'Player';
  const profile: Profile = {
    id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: clean,
    avatar,
    createdAt: Date.now(),
  };
  persist([...listProfiles(), profile]);
  return profile;
}

export function renameProfile(id: string, name: string): void {
  persist(listProfiles().map((p) => (p.id === id ? { ...p, name: name.trim().slice(0, 24) || p.name } : p)));
}

export function deleteProfile(id: string): void {
  persist(listProfiles().filter((p) => p.id !== id));
  purgeProfile(id); // drop every stat and saved hand this profile owned
  if (getActiveProfileId() === id) saveJSON(ACTIVE_KEY, null);
}

export function activateProfile(id: string | null): void {
  saveJSON(ACTIVE_KEY, id);
  setActiveProfileKey(id);
}

/** Point storage at the stored active profile. Call once before first render. */
export function initProfileScope(): string | null {
  const id = getActiveProfileId();
  const stillExists = id !== null && listProfiles().some((p) => p.id === id);
  const resolved = stillExists ? id : null;
  setActiveProfileKey(resolved);
  return resolved;
}

// ---------------------------------------------------------------------------
// Profile-scoped persistent state
// ---------------------------------------------------------------------------

/** Like usePersistentState, but the key is namespaced to the active profile. */
export function useProfileState<T>(key: string, initial: T) {
  const full = scopedKey(key);
  const [value, setValue] = useState<T>(() => loadJSON(full, initial));

  useEffect(() => {
    saveJSON(full, value);
  }, [full, value]);

  return [value, setValue] as const;
}

/** One-shot read of profile-scoped data, for code outside React. */
export function readProfile<T>(key: string, fallback: T): T {
  return loadJSON(scopedKey(key), fallback);
}

export function writeProfile(key: string, value: unknown): void {
  saveJSON(scopedKey(key), value);
}
