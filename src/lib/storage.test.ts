import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadJSON, saveJSON, removeKey } from './storage';

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
});

describe('storage round-trips', () => {
  it('saves and loads objects', () => {
    saveJSON('score', { correct: 3, total: 5 });
    expect(loadJSON('score', { correct: 0, total: 0 })).toEqual({ correct: 3, total: 5 });
  });

  it('saves and loads arrays (Set-at-the-boundary pattern)', () => {
    saveJSON('done', ['a', 'b']);
    expect(loadJSON<string[]>('done', [])).toEqual(['a', 'b']);
  });

  it('removeKey clears a value', () => {
    saveJSON('x', 1);
    removeKey('x');
    expect(loadJSON('x', 'gone')).toBe('gone');
  });
});

describe('failure modes degrade to the fallback', () => {
  it('missing key returns the fallback', () => {
    expect(loadJSON('never-set', 42)).toBe(42);
  });

  it('corrupt JSON returns the fallback instead of throwing', () => {
    localStorage.setItem('gto-trainer:v1:bad', '{not json!!');
    expect(loadJSON('bad', 'fallback')).toBe('fallback');
  });

  it('no localStorage at all (SSR) is safe', () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(loadJSON('anything', 'ok')).toBe('ok');
    expect(() => saveJSON('anything', 1)).not.toThrow();
  });

  it('keys are namespaced under the app prefix', () => {
    saveJSON('k', 1);
    expect(localStorage.getItem('gto-trainer:v1:k')).toBe('1');
  });
});
