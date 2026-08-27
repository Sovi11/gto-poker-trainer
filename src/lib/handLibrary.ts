import { Hand } from './handReplay';

// The recorded-hand library is a ~1.3MB JSON chunk. Load it on demand so it
// never slows the first paint; both Study and the Daily share this cache.
let cached: Hand[] | null = null;

export async function loadLibrary(): Promise<Hand[]> {
  if (!cached) {
    const mod = await import('../data/handLibrary.json');
    cached = (mod.default ?? mod) as unknown as Hand[];
  }
  return cached;
}

export function cachedLibrary(): Hand[] | null {
  return cached;
}
