import { Card } from '../engine/cards';
import { readProfile, writeProfile } from './profiles';

// Every hand played against the bots is recorded for the active profile, so
// stats and saved hands are just queries over this one log.

export interface HandRecord {
  id: string;
  ts: number;
  /** Hero's hole cards. */
  hole: [Card, Card];
  board: Card[];
  /** Bot ids seated for this hand. */
  bots: string[];
  /** Chips hero won (positive) or lost (negative) on this hand. */
  net: number;
  bigBlind: number;
  /** Hero's total contribution — how big the hand got for us. */
  invested: number;
  sawShowdown: boolean;
  won: boolean;
  /** The hand log, so a saved hand can be replayed action by action. */
  log: { text: string; kind: string }[];
  starred: boolean;
  note?: string;
}

const KEY = 'play.hands';
/** Cap the log so localStorage cannot grow without bound during a long grind. */
const MAX_HANDS = 500;

export function loadHands(): HandRecord[] {
  return readProfile<HandRecord[]>(KEY, []);
}

export function saveHands(hands: HandRecord[]): void {
  writeProfile(KEY, hands);
}

export function recordHand(rec: Omit<HandRecord, 'id' | 'starred'>): HandRecord {
  const hand: HandRecord = {
    ...rec,
    id: `${rec.ts.toString(36)}${Math.floor(Math.random() * 1e5).toString(36)}`,
    starred: false,
  };
  const all = loadHands();
  all.unshift(hand); // newest first
  // Trim unstarred history only — a saved hand should never disappear.
  if (all.length > MAX_HANDS) {
    const keep: HandRecord[] = [];
    let unstarred = 0;
    for (const h of all) {
      if (h.starred) {
        keep.push(h);
      } else if (unstarred < MAX_HANDS) {
        keep.push(h);
        unstarred++;
      }
    }
    saveHands(keep);
  } else {
    saveHands(all);
  }
  return hand;
}

export function setStarred(id: string, starred: boolean): void {
  saveHands(loadHands().map((h) => (h.id === id ? { ...h, starred } : h)));
}

export function setNote(id: string, note: string): void {
  saveHands(loadHands().map((h) => (h.id === id ? { ...h, note } : h)));
}

export function deleteHand(id: string): void {
  saveHands(loadHands().filter((h) => h.id !== id));
}

export function clearHands(): void {
  saveHands(loadHands().filter((h) => h.starred));
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface Stats {
  hands: number;
  net: number;
  /** Big blinds won per 100 hands — the standard win-rate unit. */
  bb100: number;
  won: number;
  showdowns: number;
  showdownWins: number;
  biggestPot: number;
  biggestLoss: number;
}

export function computeStats(hands: HandRecord[]): Stats {
  let net = 0;
  let won = 0;
  let showdowns = 0;
  let showdownWins = 0;
  let biggestPot = 0;
  let biggestLoss = 0;
  let bbSum = 0;

  for (const h of hands) {
    net += h.net;
    if (h.net > 0) won++;
    if (h.sawShowdown) {
      showdowns++;
      if (h.won) showdownWins++;
    }
    if (h.net > biggestPot) biggestPot = h.net;
    if (h.net < biggestLoss) biggestLoss = h.net;
    if (h.bigBlind > 0) bbSum += h.net / h.bigBlind;
  }

  return {
    hands: hands.length,
    net,
    bb100: hands.length > 0 ? (bbSum / hands.length) * 100 : 0,
    won,
    showdowns,
    showdownWins,
    biggestPot,
    biggestLoss,
  };
}

/**
 * Stats split by opponent. A multiway hand counts once for every bot at the
 * table, so these are "results at a table containing X" rather than a clean
 * heads-up win rate — pass headsUpOnly for that.
 */
export function statsByBot(hands: HandRecord[], headsUpOnly = false): Record<string, Stats> {
  const source = headsUpOnly ? hands.filter((h) => h.bots.length === 1) : hands;
  const buckets: Record<string, HandRecord[]> = {};
  for (const h of source) {
    for (const b of h.bots) {
      (buckets[b] ??= []).push(h);
    }
  }
  const out: Record<string, Stats> = {};
  for (const [bot, list] of Object.entries(buckets)) out[bot] = computeStats(list);
  return out;
}

/** Cumulative net chips over time, oldest first — for the results graph. */
export function equityCurve(hands: HandRecord[]): number[] {
  const chronological = [...hands].reverse();
  const curve: number[] = [];
  let running = 0;
  for (const h of chronological) {
    running += h.net;
    curve.push(running);
  }
  return curve;
}
