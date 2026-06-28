// Course content: a structured GTO curriculum. Each lesson is markdown-ish
// plain text rendered by the Learn view. Keep it practical and tied to the
// tools in this app (solver, charts, bots).

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  body: string;
  takeaways: string[];
}

export interface Module {
  id: string;
  title: string;
  summary: string;
  lessons: Lesson[];
}

export const CURRICULUM: Module[] = [
  {
    id: 'foundations',
    title: '1 · Foundations',
    summary: 'The vocabulary and math that everything else is built on.',
    lessons: [
      {
        id: 'what-is-gto',
        title: 'What GTO actually means',
        minutes: 6,
        body: `GTO — Game Theory Optimal — is a strategy that cannot be exploited, no matter what your opponent does. It is the Nash equilibrium of poker: if you play it, the best your opponent can do is break even against you (minus the rake).

A common misconception: GTO is NOT about always making the "best" play against a specific opponent. That's *exploitative* play. GTO is the unexploitable baseline. You study GTO so you have a default, then you deviate to exploit mistakes you actually observe.

Why learn it first? Because you can't recognize a mistake until you know what the unexploitable play looks like. A player who calls too much (a station) is only "too much" relative to the GTO calling frequency. Learn the baseline; print money by deviating.

In this app: the Solver tab shows you equilibrium-ish ranges and exact hand-vs-hand equities. The Play tab lets you practice deviating against bots whose leaks you can see.`,
        takeaways: [
          'GTO = unexploitable baseline (Nash equilibrium), not "best vs this villain".',
          'Exploitative play = deviating from GTO to punish a specific leak.',
          'Learn the baseline first so you can recognize and attack mistakes.',
        ],
      },
      {
        id: 'equity-and-odds',
        title: 'Equity, pot odds, and EV',
        minutes: 8,
        body: `Equity is your share of the pot if the hand went to showdown right now, expressed as a percentage. AKs vs QQ all-in preflop is about 46% / 54% — AK is a slight underdog.

Pot odds are the price you're being offered. If the pot is 100 and you must call 50, you're risking 50 to win 150, so you need to win 50/150 = 33% of the time to break even. If your equity beats your pot odds, calling is +EV.

EV (expected value) ties it together:
  EV(call) = (equity × pot_if_you_win) − (1 − equity) × call_amount

The single most common beginner leak is calling with worse equity than the pot odds require — "chasing" draws that don't pay. Use the Solver to internalize how much equity real hands and draws actually have. A flush draw on the flop is ~35% to get there by the river; a gutshot is ~16%.`,
        takeaways: [
          'Pot odds = call / (pot + call) → the equity you need to break even.',
          'Call when equity > required equity from pot odds.',
          'Flush draw ≈ 35% by river, open-ender ≈ 32%, gutshot ≈ 16%.',
        ],
      },
    ],
  },
  {
    id: 'preflop',
    title: '2 · Preflop',
    summary: 'Position, opening ranges, and the most profitable street to get right.',
    lessons: [
      {
        id: 'position',
        title: 'Why position is everything',
        minutes: 7,
        body: `Acting last is a structural, permanent edge. In position (IP) you see what your opponent does before you decide; out of position (OOP) you're guessing. This is why the Button is the most profitable seat and the blinds are the least.

The practical consequence: open wider in late position, tighter in early position. Under the gun (UTG) you might open 15% of hands; on the Button you can open 45%+. Not because the cards are different — because position lets you realize more equity with the same cards.

"Realizing equity" means actually getting to showdown and winning the share your cards deserve. OOP, you realize less than your raw equity because you face tough decisions; IP, you realize more. A hand like 76s is a fold UTG but a profitable open on the Button.

In this app: the Solver → Preflop Charts tab shows position-by-position opening ranges. Notice how the grid expands as position improves.`,
        takeaways: [
          'Position = information = the biggest structural edge in poker.',
          'Open tighter early (UTG ~15%), wider late (BTN ~45%).',
          'IP you over-realize equity; OOP you under-realize it.',
        ],
      },
      {
        id: 'rfi-ranges',
        title: 'Opening (RFI) ranges by seat',
        minutes: 9,
        body: `RFI = "raise first in" — the hands you open-raise when folded to you. These are the most-studied ranges in poker because preflop mistakes compound on every later street.

The shape of a good RFI range:
  • Pairs: open all of them from most seats (small pairs set-mine).
  • Suited aces: open wide; they make nut flushes and have blocker value.
  • Suited broadways/connectors: open for their playability and equity.
  • Offsuit hands: tighter — they flop worse and realize less equity.

Don't memorize 1,326 combos. Memorize the *edges* of each range — the weakest hand you'd open from each seat — and the shape fills in. Use the chart grids until the patterns are automatic, then drill them.

In this app: open the Solver → Preflop Charts, pick a position, and study the grid. The Play tab deals real hands so you can test whether you'd open them.`,
        takeaways: [
          'RFI = the hands you open when first to act.',
          'Memorize the edges of each range, not every combo.',
          'Suited hands outrank their offsuit twins for playability.',
        ],
      },
      {
        id: 'push-fold',
        title: 'Short-stack push/fold (Nash)',
        minutes: 8,
        body: `When you're short (roughly under 15-20 big blinds), postflop play matters less and a simple jam-or-fold strategy is near-optimal. At these depths the math is essentially solved: the Nash push/fold charts tell you exactly which hands to shove and which to call a shove with, by stack depth.

Why jam instead of min-raise? With a short stack, raising commits a large fraction of your chips anyway, and going all-in denies your opponent the chance to outplay you postflop while maximizing fold equity.

The shorter you get, the wider you jam — at 1-2 BB you're shoving almost any two cards in the small blind. As you climb toward 15-20 BB the range tightens toward genuinely strong hands.

In this app: Solver → Push/Fold lets you pick an effective stack in BB and see the exact SB shove and BB call ranges from the Nash tables. This is the highest-ROI thing to memorize for tournaments.`,
        takeaways: [
          'Under ~15-20 BB, jam-or-fold is near-optimal and essentially solved.',
          'Shorter stack → wider jams; deeper → tighter.',
          'Memorizing Nash push/fold is the best tournament study ROI.',
        ],
      },
    ],
  },
  {
    id: 'postflop',
    title: '3 · Postflop',
    summary: 'Continuation betting, board texture, and pot geometry.',
    lessons: [
      {
        id: 'cbet',
        title: 'Continuation betting and board texture',
        minutes: 9,
        body: `The c-bet (continuation bet) is the bet you make on the flop after raising preflop. Whether and how much to c-bet depends almost entirely on board texture and range advantage.

Range advantage: if the board favors your preflop range more than your opponent's, you can bet often and small. As the preflop raiser, a board like A-K-4 smashes your range (you have all the AK, AA, KK) and misses the caller's — bet small, bet often.

On dynamic, connected boards (like 9-8-7 two-tone) that favor the caller's range, slow down — check more, bet bigger when you do bet.

Sizing tells a story:
  • Small (25-33% pot): wide range, board favors you, deny equity cheaply.
  • Large (66-100%+): polarized — strong value + bluffs with good equity.

In this app: against the bots, watch how the Nit (Rocky) over-folds to c-bets — c-bet relentlessly. The Station (Callie) never folds — only bet for value, never bluff.`,
        takeaways: [
          'C-bet frequency/size is driven by range advantage and board texture.',
          'Dry, high boards → bet small and often; wet boards → check more, bet bigger.',
          'Adjust c-bets to the opponent: bluff nits, value-bet stations.',
        ],
      },
      {
        id: 'polarization',
        title: 'Polarized vs merged ranges',
        minutes: 8,
        body: `A polarized range is "nuts or nothing" — strong value hands plus bluffs, with little in between. A merged (or linear/condensed) range is made of solid-but-not-nutted value hands and few pure bluffs.

You bet polarized with big sizing: you want to charge draws and get max value from the nuts, and your bluffs need fold equity. You bet merged with small sizing: you're betting medium-strength hands for thin value and protection, and you don't want to get raised off them.

The key GTO insight is balance: for a given bet size, you need the right ratio of value to bluffs so a thinking opponent can't profitably call or fold. On the river, a pot-sized bet should be roughly 2:1 value:bluffs to make villain indifferent to calling.

In this app: GTO Greg and Sharon the Shark play balanced ranges — you can't just call down or fold to them. The looser bots are unbalanced; find the imbalance and attack it.`,
        takeaways: [
          'Polarized = nuts + bluffs → bet big. Merged = solid value → bet small.',
          'Balance value:bluff ratios so villain is indifferent.',
          'Pot-sized river bet ≈ 2:1 value:bluffs for an unexploitable bluff frequency.',
        ],
      },
    ],
  },
  {
    id: 'exploit',
    title: '4 · Exploitation',
    summary: 'Turning reads into money by deviating from the baseline.',
    lessons: [
      {
        id: 'player-types',
        title: 'Reading player types and adjusting',
        minutes: 9,
        body: `Every opponent leaks somewhere. Your job is to identify the leak and deviate from GTO to punish it. The four classic archetypes:

  • Nit (tight-passive/aggressive): folds too much. → Bluff relentlessly, bet them off pots, don't pay off their rare aggression.
  • Calling station (loose-passive): calls too much, folds too little. → Never bluff, value-bet thin and relentlessly, size up.
  • Maniac (loose-aggressive): bets/raises too much. → Tighten up, let them bluff into you, call down lighter, trap.
  • TAG/Reg (tight-aggressive): close to balanced. → Smallest edges; focus on position and small exploits, avoid big bluffs.

The meta-skill: GTO is your default, reads are your adjustments. Against unknowns, play the baseline. As reads form, deviate — and remember a good player will counter-adjust.

In this app: the Bots tab lists each opponent's archetype and the exploit. Play hundreds of hands against each in the Play tab and feel the adjustment in your bones.`,
        takeaways: [
          'Nit → bluff more. Station → value-bet, never bluff.',
          'Maniac → tighten, trap, call down lighter. Reg → small exploits only.',
          'Default to GTO vs unknowns; deviate as reads form.',
        ],
      },
      {
        id: 'bankroll-tilt',
        title: 'Bankroll and tilt: the grind',
        minutes: 7,
        body: `Skill decides your win rate; bankroll management decides whether variance bankrupts you before your edge plays out. A standard guideline: 20-30 buy-ins for cash games, 100+ for tournaments. Move down when you dip below the threshold; you're protecting your ability to keep playing.

Variance is brutal in the short run. You can play perfectly and lose for tens of thousands of hands. This is why you track decisions, not results: a good fold that "would have won" was still a good fold. Results-oriented thinking ("I should've called, I had it!") is the fastest path to tilt.

Tilt is emotionally-driven deviation from your best strategy — usually after a bad beat. The fix is mechanical: set a stop-loss, take breaks, and treat each hand as independent. The cards don't remember the last hand; neither should you.

Grinding is just this loop: study the baseline → play volume → review the spots you misplayed → adjust → repeat. There's no shortcut, but the loop compounds.`,
        takeaways: [
          'Bankroll: ~20-30 buy-ins cash, ~100+ tournaments. Move down to survive variance.',
          'Judge decisions, not results — results-oriented thinking breeds tilt.',
          'The grind = study baseline → play volume → review → adjust → repeat.',
        ],
      },
    ],
  },
];

export function allLessons(): Lesson[] {
  return CURRICULUM.flatMap((m) => m.lessons);
}
