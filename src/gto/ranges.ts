// Standard 6-max GTO-approximate preflop opening (RFI) ranges by position,
// plus common response ranges. These are widely-taught solver-derived ranges
// used as a study reference, not a live solver output.

export type Position = 'UTG' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB';

export interface PreflopChart {
  id: string;
  title: string;
  description: string;
  position?: Position;
  range: string; // notation parsed by parseRange
}

export const RFI_CHARTS: PreflopChart[] = [
  {
    id: 'rfi-utg',
    title: 'UTG Open (RFI)',
    position: 'UTG',
    description: 'Tightest opening range. ~15% of hands. Premium pairs, broadways, suited aces and connectors.',
    range: '22+, ATs+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo',
  },
  {
    id: 'rfi-mp',
    title: 'MP Open (RFI)',
    position: 'MP',
    description: 'Slightly wider than UTG. ~17%. Add weaker suited broadways and connectors.',
    range: '22+, A9s+, KTs+, QTs+, J9s+, T9s, 98s, 87s, ATo+, KJo+, QJo',
  },
  {
    id: 'rfi-co',
    title: 'CO Open (RFI)',
    position: 'CO',
    description: 'Wider stealing range. ~27%. Suited gappers, more offsuit broadways.',
    range: '22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, 65s, A9o+, KTo+, QTo+, JTo',
  },
  {
    id: 'rfi-btn',
    title: 'BTN Open (RFI)',
    position: 'BTN',
    description: 'Widest open. ~45%. The button steals relentlessly with position guaranteed.',
    range: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o',
  },
  {
    id: 'rfi-sb',
    title: 'SB Open / Limp-Raise',
    position: 'SB',
    description: 'Roughly button-wide when raising-first-in, but out of position so play tighter postflop. ~40%.',
    range: '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, 54s, A4o+, K9o+, Q9o+, J9o+, T9o',
  },
];

export const RESPONSE_CHARTS: PreflopChart[] = [
  {
    id: 'bb-vs-btn-call',
    title: 'BB Defend vs BTN Open (Call)',
    description: 'Big blind gets a great price closing the action. Call extremely wide; 3-bet the top and some bluffs.',
    range: '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o+, K7o+, Q8o+, J8o+, T8o+, 98o',
  },
  {
    id: 'bb-vs-utg-call',
    title: 'BB Defend vs UTG Open (Call)',
    description: 'Against a tight range, defend much narrower. Call broadways and pairs that flop well.',
    range: '22+, A8s+, KTs+, QTs+, JTs, T9s, 98s, 87s, AJo+, KQo',
  },
  {
    id: '3bet-vs-co',
    title: '3-Bet vs CO Open (BTN/Blinds)',
    description: 'Linear/merged 3-bet value with polarized bluffs (suited wheel aces, suited gappers).',
    range: 'QQ+, AKs, AKo, AQs, A5s, A4s, KJs, KQs, 76s, 65s',
  },
];

export const ALL_CHARTS = [...RFI_CHARTS, ...RESPONSE_CHARTS];

export function chartById(id: string): PreflopChart | undefined {
  return ALL_CHARTS.find((c) => c.id === id);
}
