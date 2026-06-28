// Bot personalities. Each is a named opponent with a parameter profile that
// drives the decision engine. Parameters are 0..1 unless noted.

export interface BotProfile {
  id: string;
  name: string;
  archetype: string;
  blurb: string;
  avatar: string; // emoji
  // Tightness: fraction of hands folded preflop in marginal spots (higher = tighter).
  tightness: number;
  // Aggression: how often it bets/raises vs checks/calls with a given hand strength.
  aggression: number;
  // Bluff frequency: chance to bluff with weak hands when checked to / on later streets.
  bluffFreq: number;
  // Call station: extra willingness to call down (reduces folds to bets).
  station: number;
  // Tilt: variance added to decisions (randomness).
  tilt: number;
  // Bet sizing tendency as fraction of pot.
  betSizing: number;
}

export const BOTS: BotProfile[] = [
  {
    id: 'rocky',
    name: 'Rocky the Nit',
    archetype: 'TAG / Nit',
    blurb: "Plays like a vault door. Folds everything but premiums, but when he bets, believe him.",
    avatar: '🪨',
    tightness: 0.85,
    aggression: 0.45,
    bluffFreq: 0.05,
    station: 0.1,
    tilt: 0.05,
    betSizing: 0.66,
  },
  {
    id: 'maniac',
    name: 'Mad Max',
    archetype: 'LAG / Maniac',
    blurb: 'Raises with air, three-barrels with nothing. Punishes the timid, but bleeds chips to callers.',
    avatar: '🔥',
    tightness: 0.2,
    aggression: 0.9,
    bluffFreq: 0.55,
    station: 0.2,
    tilt: 0.35,
    betSizing: 0.85,
  },
  {
    id: 'station',
    name: 'Callie Station',
    archetype: 'Calling Station',
    blurb: 'Never met a draw she didn\'t chase. Will not fold a pair. Value-bet her relentlessly.',
    avatar: '🚉',
    tightness: 0.35,
    aggression: 0.25,
    bluffFreq: 0.1,
    station: 0.9,
    tilt: 0.1,
    betSizing: 0.5,
  },
  {
    id: 'gto',
    name: 'GTO Greg',
    archetype: 'Balanced / Solver-ish',
    blurb: 'Plays a balanced, hard-to-exploit game. Mixes bluffs and value at sane frequencies.',
    avatar: '🤖',
    tightness: 0.55,
    aggression: 0.6,
    bluffFreq: 0.3,
    station: 0.4,
    tilt: 0.02,
    betSizing: 0.66,
  },
  {
    id: 'shark',
    name: 'Sharon the Shark',
    archetype: 'Thinking Reg',
    blurb: 'Tight-aggressive with sharp aggression and well-timed bluffs. The toughest seat at the table.',
    avatar: '🦈',
    tightness: 0.65,
    aggression: 0.7,
    bluffFreq: 0.32,
    station: 0.3,
    tilt: 0.03,
    betSizing: 0.75,
  },
  {
    id: 'fish',
    name: 'Finn the Fish',
    archetype: 'Loose Passive',
    blurb: 'Limps everything, calls too much, rarely raises. The dream opponent — print money patiently.',
    avatar: '🐟',
    tightness: 0.3,
    aggression: 0.2,
    bluffFreq: 0.08,
    station: 0.75,
    tilt: 0.15,
    betSizing: 0.45,
  },
];

export function botById(id: string): BotProfile {
  return BOTS.find((b) => b.id === id) ?? BOTS[3];
}
