import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildEnvelope, mergeStates, type Envelope } from './sync';
import { saveJSON, setWriteListener } from './storage';

// Minimal in-memory Storage for the node test environment.
class FakeStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new FakeStorage();
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
  setWriteListener(null);
});

describe('mergeStates', () => {
  it('keeps local values that are newer', () => {
    const local: Envelope = { 'stats': { v: { wins: 5 }, t: 200 } };
    const remote: Envelope = { 'stats': { v: { wins: 3 }, t: 100 } };
    const r = mergeStates(local, remote);
    expect(r.merged['stats'].v).toEqual({ wins: 5 });
    expect(r.remoteWon).toEqual([]);
    expect(r.pushNeeded).toBe(true);
  });

  it('takes remote values that are newer', () => {
    const local: Envelope = { 'stats': { v: 1, t: 100 } };
    const remote: Envelope = { 'stats': { v: 2, t: 200 } };
    const r = mergeStates(local, remote);
    expect(r.merged['stats'].v).toBe(2);
    expect(r.remoteWon).toEqual(['stats']);
  });

  it('lands remote-only keys locally and keeps local-only keys for push', () => {
    const local: Envelope = { 'a': { v: 1, t: 50 } };
    const remote: Envelope = { 'b': { v: 2, t: 60 } };
    const r = mergeStates(local, remote);
    expect(Object.keys(r.merged).sort()).toEqual(['a', 'b']);
    expect(r.remoteWon).toEqual(['b']);
    expect(r.pushNeeded).toBe(true); // 'a' is missing remotely
  });

  it('ties go to local without forcing a push', () => {
    const local: Envelope = { 'x': { v: 'local', t: 100 } };
    const remote: Envelope = { 'x': { v: 'remote', t: 100 } };
    const r = mergeStates(local, remote);
    expect(r.merged['x'].v).toBe('local');
    expect(r.pushNeeded).toBe(false);
    expect(r.remoteWon).toEqual([]);
  });

  it('never syncs the timestamp bookkeeping key', () => {
    const local: Envelope = { '__sync_ts': { v: { a: 1 }, t: 999 } };
    const remote: Envelope = { '__sync_ts': { v: { b: 2 }, t: 1000 } };
    const r = mergeStates(local, remote);
    expect(r.merged['__sync_ts']).toBeUndefined();
    expect(r.remoteWon).toEqual([]);
  });

  it('is a clean no-op on two empty states', () => {
    const r = mergeStates({}, {});
    expect(r.merged).toEqual({});
    expect(r.pushNeeded).toBe(false);
  });
});

describe('buildEnvelope', () => {
  it('snapshots only the given profile, without bookkeeping', () => {
    saveJSON('p/abc/stats', { hands: 12 });
    saveJSON('p/abc/study.played', ['h1']);
    saveJSON('p/abc/__sync_ts', { stats: 500 });
    saveJSON('p/other/stats', { hands: 99 });
    saveJSON('theme', 'dark'); // bare key, must not appear

    const env = buildEnvelope('abc');
    expect(Object.keys(env).sort()).toEqual(['stats', 'study.played']);
    expect(env['stats'].v).toEqual({ hands: 12 });
    expect(env['stats'].t).toBe(500); // stamped from the ts map
    expect(env['study.played'].t).toBe(0); // never stamped -> epoch
  });

  it('round-trips through a merge onto a fresh device', () => {
    saveJSON('p/abc/stats', { hands: 12 });
    saveJSON('p/abc/__sync_ts', { stats: 500 });
    const uploaded = buildEnvelope('abc');

    // Fresh device: nothing local. Remote must win everything.
    (globalThis as { localStorage?: unknown }).localStorage = new FakeStorage();
    const r = mergeStates(buildEnvelope('abc'), uploaded);
    expect(r.remoteWon).toEqual(['stats']);
    expect(r.merged['stats'].v).toEqual({ hands: 12 });
  });
});
