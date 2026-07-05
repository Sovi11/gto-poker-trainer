// Course content: a structured GTO curriculum. Each lesson is markdown-ish
// plain text rendered by the Learn view. Keep it practical and tied to the
// tools in this app (solver, charts, bots).

// One option at the decision point of an illustrated hand.
export interface SpotOption {
  label: string;
  verdict: 'best' | 'ok' | 'bad';
  because: string; // feedback shown after the learner picks this option
}

// An "illustrated hand" — a scripted spot the learner plays at the end of a
// lesson to apply the concept. One key decision, graded, with an explanation.
export interface Spot {
  scenario: string; // one-line framing above the table
  heroPos: string; // e.g. "BTN"
  heroCards: [string, string]; // e.g. ["Ah", "Th"]
  villainPos?: string;
  villainNote?: string; // e.g. "Calling station"
  board?: string[]; // e.g. ["Kh", "7h", "2c"]
  pot: number;
  toCall?: number;
  history?: string[]; // prior action lines
  question: string;
  options: SpotOption[]; // exactly one should be verdict: 'best'
  moral: string; // ties the decision back to the lesson
}

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  body: string;
  takeaways: string[];
  spot?: Spot;
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
        spot: {
          scenario: 'Flop · you flopped the nut flush draw and face a half-pot bet.',
          heroPos: 'BB',
          heroCards: ['Ah', 'Th'],
          villainPos: 'BTN',
          board: ['Kh', '7h', '2c'],
          pot: 100,
          toCall: 50,
          history: ['You call the BTN open from the BB', 'Flop: K♥ 7♥ 2♣', 'BTN bets 50 into 100'],
          question: 'You have 9 outs to the nut flush. Call, fold, or raise?',
          options: [
            {
              label: 'Call 50',
              verdict: 'best',
              because: 'You need 50 / (100 + 50) = 33% to call. A flush draw is ~36% by the river (9 outs × 4). 36% > 33%, so calling is +EV.',
            },
            {
              label: 'Fold',
              verdict: 'bad',
              because: 'You’re folding a hand with more equity (36%) than the price you’re getting (33%) — that leaves money on the table.',
            },
            {
              label: 'Raise to 150',
              verdict: 'ok',
              because: 'A semi-bluff raise is defensible with the nut draw, but the pure call is simpler and lower-variance here.',
            },
          ],
          moral: 'Compare your equity to the pot-odds price: 36% beats the 33% you need → continue.',
        },
      },
      {
        id: 'outs-and-draws',
        title: 'Outs, draws & the rule of 2 & 4',
        minutes: 7,
        body: `An "out" is a card that improves you to what will likely be the best hand. Counting outs and converting them to equity is the fastest math at the table.

The rule of 2 & 4: on the flop (two cards to come) multiply your outs by 4; on the turn (one to come) multiply by 2. It’s an approximation — it slightly overshoots for large out counts — but it’s close enough to make decisions.

Know the common draws cold: a flush draw is 9 outs (~36% on the flop, ~18% on the turn), an open-ended straight draw is 8 (~32% / ~16%), a gutshot is 4 (~16% / ~8%), and two overcards are ~6. Combo draws (flush + straight) can be 12–15 outs and are often favourites.

Discount dirty outs. A card that completes your straight but also puts a flush on board, or pairs the board to give someone a boat, isn’t a full out. Count clean outs — the ones that actually win.`,
        takeaways: [
          'Rule of 4 on the flop, rule of 2 on the turn (outs → equity %).',
          'Flush draw 9 outs, OESD 8, gutshot 4, two overcards ~6.',
          'Discount outs that also improve villain (dirty outs).',
        ],
        spot: {
          scenario: 'Turn · you hold the nut flush draw with one card to come.',
          heroPos: 'BB',
          heroCards: ['Ah', 'Th'],
          villainPos: 'BTN',
          board: ['Kh', '7h', '2c', '3s'],
          pot: 100,
          toCall: 25,
          history: ['Flop checks through', 'Turn: 3♠', 'BTN bets 25 into 100'],
          question: 'One card to come with 9 outs. What’s the play?',
          options: [
            {
              label: 'Call 25',
              verdict: 'best',
              because: 'On the turn use ×2: 9 outs ≈ 18%. You need 25 / (100 + 50) ≈ 17%. 18% > 17% → a thin but profitable call, before any implied odds.',
            },
            {
              label: 'Fold',
              verdict: 'bad',
              because: 'You have slightly more equity (18%) than the price (17%), plus big implied odds when the flush hits — folding is a leak.',
            },
            {
              label: 'Raise to 90',
              verdict: 'ok',
              because: 'A semi-bluff with the nut draw is fine, but with such a small bet and great price the pure call is lower-variance.',
            },
          ],
          moral: 'On the turn use ×2, on the flop ×4 — then compare to the pot-odds price.',
        },
      },
      {
        id: 'combinatorics',
        title: 'Combinatorics: counting combos',
        minutes: 8,
        body: `There are 1,326 possible starting hands (that’s C(52,2)). Every hand class has a fixed number of combinations: an unpaired hand has 16 (4 suited + 12 offsuit), a suited hand alone has 4, an offsuit hand 12, and a pocket pair has 6.

Counting combos is how you read ranges precisely instead of vaguely. To know how often villain holds a specific hand, count its combos and weigh them against the rest of their range.

Card removal changes the count. Every visible card — on the board or in your hand — removes combos from villain’s range. If you hold an ace, villain can have only 3 combos of AA (C(3,2)) instead of 6. If an ace and a king are on the board, there are only 3 × 3 = 9 combos of AK left, not 16.

This is the engine behind balance and blockers: to know whether villain has enough bluffs, or whether you block their value, you count.`,
        takeaways: [
          'Unpaired hand = 16 combos (4 suited + 12 offsuit); pocket pair = 6.',
          'Visible cards remove combos: hold an ace → only 3 AA combos remain.',
          'Two ranks on the board → 3 × 3 = 9 combos of that AK-type hand.',
        ],
        spot: {
          scenario: 'River · you’re counting villain’s value combos to size your call.',
          heroPos: 'BB',
          heroCards: ['Qc', 'Qd'],
          villainPos: 'BTN',
          board: ['As', 'Kd', '4h', '7c', '2d'],
          pot: 120,
          history: ['BTN bets all three streets', 'You put villain’s value on AK (top two pair)'],
          question: 'How many combos of AK can villain actually have on this board?',
          options: [
            {
              label: '9 combos',
              verdict: 'best',
              because: 'A♠ and K♦ are on the board, so only 3 aces and 3 kings remain: 3 × 3 = 9 combos of AK.',
            },
            {
              label: '16 combos',
              verdict: 'bad',
              because: 'That’s the count with no cards removed. Two of the relevant ranks are already on the board — subtract them.',
            },
            {
              label: '6 combos',
              verdict: 'bad',
              because: '6 is the combo count for a pocket pair, not an unpaired two-card hand like AK.',
            },
          ],
          moral: 'Always count combos from the cards that are left — removal is what makes range-reading exact.',
        },
      },
      {
        id: 'blockers',
        title: 'Blockers & card removal',
        minutes: 8,
        body: `A blocker is a card in your hand that removes combos from the range you care about. Blockers turn combinatorics into decisions — especially bluffs.

The classic use: bluff with the cards that block villain’s continues. On a flush-completing river, holding the ace of the flush suit (the "nut blocker") means villain is far less likely to hold the nut flush — so you can credibly represent it, and they can’t comfortably call. The best bluffs block value and unblock folds.

The mirror image matters too: when you value bet, you’d rather *not* block the hands that pay you. When you’re bluff-catching, holding a blocker to villain’s value shifts the math in your favour.

Blockers are a tie-breaker, not a licence to bluff anything: you still need a believable story and the right frequency. But given two candidate bluffs, pick the one that blocks the nuts.`,
        takeaways: [
          'A blocker removes combos from a range you care about.',
          'Bluff with cards that block villain’s value (e.g. the nut-flush blocker).',
          'Best bluffs block value and unblock folds; blockers break ties.',
        ],
        spot: {
          scenario: 'River · four hearts on board and you’re deciding whether to bluff.',
          heroPos: 'BTN',
          heroCards: ['Ah', '7c'],
          villainPos: 'BB',
          board: ['Kh', '9h', '5h', '2h', '8c'],
          pot: 100,
          history: ['You barrel the flop, check the turn', 'River: 8♣', 'BB checks to you'],
          question: 'You have the A♥ but otherwise nothing. Bluff or give up?',
          options: [
            {
              label: 'Bet big (bluff)',
              verdict: 'best',
              because: 'You hold the A♥ — the nut-flush blocker. Villain almost never has the nut flush, so you credibly rep it and fold out their weaker flushes and pairs. Prime bluff.',
            },
            {
              label: 'Check (give up)',
              verdict: 'bad',
              because: 'This is the single best hand in your range to bluff — checking wastes the perfect blocker.',
            },
            {
              label: 'Bet small',
              verdict: 'ok',
              because: 'A bluff wants to fold out flushes and strong pairs; a small size doesn’t apply enough pressure to do that.',
            },
          ],
          moral: 'When you bluff, hold the cards that block villain’s strongest continues.',
        },
      },
      {
        id: 'thinking-in-ranges',
        title: 'Thinking in ranges, not hands',
        minutes: 7,
        body: `Beginners play "my hand." Winners play their whole range against an estimate of villain’s range. A decision is correct if it’s the best action for your range in that spot — not because of the one holding you’re scared of.

At every point you can assign villain a range: the set of hands they’d take their line with. That range narrows street by street as they call, bet, or check. Your job is to act well against the whole distribution.

It also means your own strategy is defined per-hand across your range: on a given board you might bet your strong hands and best draws and check the rest — a *strategy*, not a single move. Solvers output exactly this: a frequency for every hand.

Practically: before you act, ask "what does villain’s range look like here, and what’s the best response with my whole range?" The specific two cards you hold just tell you where in your own strategy you sit.`,
        takeaways: [
          'Play your range vs villain’s range, not your two cards in isolation.',
          'Villain’s range narrows with every action they take.',
          'Your strategy is a per-hand frequency across your whole range.',
        ],
        spot: {
          scenario: 'Preflop · a tight reg opens under the gun and you’re in the big blind.',
          heroPos: 'BB',
          heroCards: ['8s', '8d'],
          villainPos: 'UTG',
          villainNote: 'tight reg',
          board: [],
          pot: 35,
          toCall: 15,
          history: ['UTG (tight) opens to 25', 'Folds to you in the BB'],
          question: 'Facing a tight UTG range with 8♠8♦, what’s the best play?',
          options: [
            {
              label: 'Call',
              verdict: 'best',
              because: 'Against a strong, tight range 88 realises well: you get a great price closing the action and can stack them when you flop a set. Calling keeps their range wide.',
            },
            {
              label: '3-bet',
              verdict: 'ok',
              because: 'Playable as a small-pair 3-bet bluff, but vs a tight range you mostly fold out worse and get called or 4-bet by better — it under-realises 88’s set value.',
            },
            {
              label: 'Fold',
              verdict: 'bad',
              because: '88 has far too much equity and set potential to fold when you’re closing the action this cheaply.',
            },
          ],
          moral: 'Pick the play that’s best against villain’s entire range, not against the hand you fear.',
        },
      },
      {
        id: 'variance-vs-results',
        title: 'Variance & why decisions ≠ results',
        minutes: 6,
        body: `EV is a long-run average. Any single hand is mostly noise: you can play perfectly and lose, or punt and win. The discipline that separates winners is judging decisions, not results.

A good fold that "would have won" was still a good fold if the call was -EV against villain’s range. Seeing one bluff doesn’t retroactively make a losing call correct — you’d have to be good often enough to beat the price, and one revealed card isn’t a frequency.

This is also why downswings are normal: a winning strategy still loses over meaningful stretches. Results-oriented thinking — "I should’ve called, I had it!" — is the fastest route to tilt and to abandoning +EV plays.

Track the quality of your decisions, not the graph. Over enough hands the EV shows up; in the short run, protect your process from the noise.`,
        takeaways: [
          'One hand is noise; EV is a long-run average.',
          'Judge the decision against villain’s range and the price, not the outcome.',
          'A +EV play that loses is still correct — results-oriented thinking breeds tilt.',
        ],
        spot: {
          scenario: 'River · you hold a bluff-catcher facing a pot-sized bet.',
          heroPos: 'BB',
          heroCards: ['Ac', 'Jd'],
          villainPos: 'BTN',
          board: ['Ah', '8c', '5d', '4s', 'Kc'],
          pot: 100,
          toCall: 100,
          history: ['You call down with top pair', 'River: K♣', 'BTN bets 100 (pot)'],
          question: 'You need 33% to call; you estimate villain bluffs ~25% here. Call or fold?',
          options: [
            {
              label: 'Fold',
              verdict: 'best',
              because: 'You need 100 / (100 + 200) = 33% to be good. If villain bluffs ~25% of the time, your bluff-catcher wins only 25% < 33% → folding is +EV, even though you’ll sometimes be shown a bluff.',
            },
            {
              label: 'Call',
              verdict: 'bad',
              because: 'Calling because you might be right is results-oriented: 25% < 33% is a losing call over the long run, whatever happens this once.',
            },
            {
              label: 'Call, then tilt-shove next hand',
              verdict: 'bad',
              because: 'Chasing "getting even" is exactly the noise-driven deviation that turns one bad spot into a session-wrecker.',
            },
          ],
          moral: 'Decide on the frequency and the price, not the fear of being bluffed once.',
        },
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
        id: 'three-betting',
        title: '3-betting: value & bluffs',
        minutes: 9,
        body: `A 3-bet is a reraise of an open. A good 3-betting range has two parts: value (the hands you’re happy to get all-in or barrel) and bluffs (hands that fold out better and flop well when called).

Two shapes. A polarized 3-bet — premiums plus non-obvious bluffs like A5s and suited gappers — is used against tight openers you can’t profitably flat. A linear (merged) 3-bet — all your strong hands, no thin bluffs — is used against loose or late-position openers who fold too much.

Pick bluffs with blockers. A5s is the archetype: it blocks AA and AK, makes the wheel and the nut flush, and unblocks the hands villain folds. That’s why solvers 3-bet A5s far more than A9o.

Size ~3× the open in position, ~4× out of position (you want a bigger pot when you can’t see their action postflop).`,
        takeaways: [
          '3-bet polarized vs tight openers, linear (merged) vs loose/late ones.',
          'Bluff 3-bets want blockers that flop well — A5s over A9o.',
          'Size bigger out of position (~4×) than in position (~3×).',
        ],
        spot: {
          scenario: 'Preflop · the cutoff opens and you’re on the button.',
          heroPos: 'BTN',
          heroCards: ['As', '5s'],
          villainPos: 'CO',
          board: [],
          pot: 40,
          toCall: 25,
          history: ['CO opens to 25', 'Folds to you on the button'],
          question: 'You hold A5s in position. Flat or 3-bet?',
          options: [
            {
              label: '3-bet',
              verdict: 'best',
              because: 'A5s is the model 3-bet bluff: it blocks AA/AK, makes the wheel and the nut flush, and unblocks folds. You apply pressure with position and a great blocker.',
            },
            {
              label: 'Flat call',
              verdict: 'ok',
              because: 'Flatting is playable, but it under-realises A5s’s pressure and lets the blinds in cheaply — 3-betting is the higher-EV line here.',
            },
            {
              label: 'Fold',
              verdict: 'bad',
              because: 'Folding a suited ace with blockers and position to a single CO open is far too tight.',
            },
          ],
          moral: 'Your best 3-bet bluffs block villain’s value and unblock their folds.',
        },
      },
      {
        id: 'facing-three-bets',
        title: 'Facing 3-bets: 4-bet, call, or fold',
        minutes: 9,
        body: `When your open gets 3-bet, you have three options: 4-bet, call, or fold. Which one depends on your hand’s equity, your position, and the 3-bettor’s range.

4-bet a polar range: your premiums for value, plus a few bluffs that block their value (A5s, Axs) and can fold out their bluff 3-bets. Call the hands that flop well and have position — pairs, suited broadways, suited connectors — that don’t want to get all-in but are too good to fold. Fold the rest.

Position tilts the decision toward calling: in position you can profitably flat a wider range and realise equity. Out of position you 4-bet-or-fold more, because flatting and playing a bloated pot without position is expensive.

The one rule that never changes: premiums like AK and QQ+ are never a fold to a 3-bet — you 4-bet or call, never surrender them.`,
        takeaways: [
          '4-bet polar (premiums + A-blocker bluffs), call hands that flop well, fold the rest.',
          'In position flat wider; out of position 4-bet-or-fold more.',
          'AK and QQ+ are never a fold to a 3-bet.',
        ],
        spot: {
          scenario: 'Preflop · you open the button and the big blind 3-bets.',
          heroPos: 'BTN',
          heroCards: ['Ah', 'Ks'],
          villainPos: 'BB',
          board: [],
          pot: 115,
          toCall: 65,
          history: ['You open BTN to 25', 'BB 3-bets to 90'],
          question: 'You have AKo in position facing a 3-bet. What’s best?',
          options: [
            {
              label: '4-bet',
              verdict: 'best',
              because: 'AK has huge equity and blocks AA/KK/AK. 4-betting gets value, denies equity, and lets you play a big pot with the initiative and position.',
            },
            {
              label: 'Call',
              verdict: 'ok',
              because: 'Flatting in position is fine — it keeps villain’s bluffs in and avoids getting blown off equity — but it realises less than the aggressive line here.',
            },
            {
              label: 'Fold',
              verdict: 'bad',
              because: 'Folding AK to a 3-bet is one of the biggest preflop leaks there is — it’s far too strong to give up.',
            },
          ],
          moral: 'Premiums are never a fold to a 3-bet: 4-bet or call, chosen by position and villain’s range.',
        },
      },
      {
        id: 'blind-defense',
        title: 'Defending the big blind',
        minutes: 8,
        body: `The big blind is a losing seat — but it’s losing *less* when you defend correctly. Two structural facts make you defend wide: you’ve already posted one blind (a discount on the call), and you close the action (no one can raise behind you).

Against a 2.5× steal you’re getting roughly 2-to-1, so you need only about 30% equity to continue — and almost any two semi-connected or suited cards clear that bar against a wide stealing range. That’s why the BB defends far wider than any other seat.

The catch is you’ll be out of position postflop, so you don’t defend pure trash, and you tilt your range toward hands that make top pair, good draws, or have blocker/nut potential. Split your continues into a wide flatting range and a polar 3-bet range.

Defend widest against the button and small blind (widest steal ranges), tighter against early-position opens (stronger ranges).`,
        takeaways: [
          'The BB gets a price discount and closes the action → defend wide.',
          '~2-to-1 vs a 2.5× steal means you need only ~30% equity to call.',
          'Defend widest vs BTN/SB steals, tighter vs early-position opens.',
        ],
        spot: {
          scenario: 'Preflop · the button opens and you’re in the big blind.',
          heroPos: 'BB',
          heroCards: ['Kc', '9d'],
          villainPos: 'BTN',
          board: [],
          pot: 35,
          toCall: 15,
          history: ['BTN opens to 25', 'SB folds, action on you'],
          question: 'You hold K9o closing the action for 15 more into 35. Defend?',
          options: [
            {
              label: 'Call',
              verdict: 'best',
              because: 'You’re getting better than 2-to-1 and closing the action against a wide button range. K9o makes plenty of top pairs and clears the ~30% equity bar easily — a clear defend.',
            },
            {
              label: 'Fold',
              verdict: 'bad',
              because: 'Folding K9o to a single button steal over-folds the big blind and lets the button print with a wide range.',
            },
            {
              label: '3-bet',
              verdict: 'ok',
              because: 'K9o can appear as an occasional 3-bet bluff, but flatting is the standard, higher-EV defense with this holding.',
            },
          ],
          moral: 'The big blind gets a discount and closes the action — defend wide against late-position steals.',
        },
      },
      {
        id: 'squeeze-and-iso',
        title: 'Squeezing & isolating',
        minutes: 8,
        body: `When there’s already a raise and a caller, a 3-bet is called a squeeze — and it’s often more profitable than a normal 3-bet. The caller’s range is *capped* (they’d usually 3-bet their best hands themselves), so they rarely have the goods, and there’s extra dead money in the pot from their call.

Size squeezes bigger than a heads-up 3-bet — you’re charging two players and want to deny the caller their price. Lean on hands that block the opener’s value (Ax, Kx) and still play well when called.

Isolation is the limped-pot cousin: when a weak player limps, raise to play a heads-up pot in position against their capped, face-up range. Limping behind lets everyone in; raising takes the initiative and the dead money.

Both plays punish passive lines — capped ranges and limps are invitations to attack.`,
        takeaways: [
          'Squeeze = 3-bet vs a raise + caller; the caller is capped and there’s dead money.',
          'Size squeezes bigger than a heads-up 3-bet, and use A/K blockers.',
          'Isolate limpers to play heads-up in position vs a capped range.',
        ],
        spot: {
          scenario: 'Preflop · the cutoff opens, the button calls, and you’re in the big blind.',
          heroPos: 'BB',
          heroCards: ['Ah', 'Qs'],
          villainPos: 'CO + BTN',
          board: [],
          pot: 65,
          toCall: 15,
          history: ['CO opens to 25', 'BTN calls 25', 'Action on you in the BB with AQo'],
          question: 'Two players in, AQo in the big blind. What’s the best play?',
          options: [
            {
              label: 'Squeeze (3-bet)',
              verdict: 'best',
              because: 'The button’s flat caps their range and adds dead money. AQo blocks AK/AQ/AA and plays well — squeezing bigger applies max pressure to two capped ranges.',
            },
            {
              label: 'Call',
              verdict: 'ok',
              because: 'Flatting builds a multiway pot out of position with a dominated-prone offsuit hand — playable, but it forfeits the squeeze’s fold equity and dead money.',
            },
            {
              label: 'Fold',
              verdict: 'bad',
              because: 'AQo is far too strong to fold here, especially with dead money and a capped caller to attack.',
            },
          ],
          moral: 'Squeeze the capped caller with hands that block the opener’s value.',
        },
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
      {
        id: 'preflop-sizing',
        title: 'Preflop sizing & rake',
        minutes: 7,
        body: `How much you open matters less than *consistency*. Use one size for your entire opening range from a given seat so you never give away your hand strength — online that’s roughly 2.2–2.5×, live (deeper, looser, more callers) closer to 3×.

Bigger isn’t better. Oversized opens bloat the pot when you get called and pressure you to over-commit out of position; they also punish your own wide steals. A small, uniform raise keeps your whole range cheap and balanced.

Limping is worse still from a first-in spot: it surrenders the initiative and lets the blinds realise their equity for free. Raise or fold — save limping for the rare deep multiway trap.

Rake taxes small and multiway pots hardest, and the blinds are raked most. In raked games this rewards tight-aggressive play: take the initiative, avoid marginal limped pots, and don’t splash into spots where the house eats your edge.`,
        takeaways: [
          'One consistent open size per seat (~2.2–2.5× online, ~3× live).',
          'Don’t oversize or limp first-in — raise or fold, keep the range cheap.',
          'Rake hits small/multiway pots and the blinds hardest → play TAG.',
        ],
        spot: {
          scenario: 'Preflop · folded to you on the button with a suited connector.',
          heroPos: 'BTN',
          heroCards: ['7s', '6s'],
          villainPos: 'Blinds',
          board: [],
          pot: 15,
          history: ['Folds around to you on the button'],
          question: 'How do you enter the pot with 7♠6♠?',
          options: [
            {
              label: 'Raise ~2.3×',
              verdict: 'best',
              because: 'A small, consistent steal opens your whole button range cheaply, takes the initiative, and stays balanced — 7♠6♠ plays great in position after a raise.',
            },
            {
              label: 'Limp',
              verdict: 'bad',
              because: 'Limping the button surrenders the initiative and lets both blinds see a cheap flop — you give up the exact edge position hands you.',
            },
            {
              label: 'Raise 4×',
              verdict: 'ok',
              because: 'Not a disaster, but oversizing bleeds chips when called, bloats the pot with a speculative hand, and telegraphs a stronger-looking range.',
            },
          ],
          moral: 'One small, consistent open size across your whole range — raise or fold, don’t limp.',
        },
      },
    ],
  },
  {
    id: 'postflop',
    title: '3 · Postflop Fundamentals',
    summary: 'C-betting, defending, barreling, and playing the turn and river.',
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
        spot: {
          scenario: 'Flop · you raised the button, the big blind called. A-K-4 rainbow.',
          heroPos: 'BTN',
          heroCards: ['Jc', 'Tc'],
          villainPos: 'BB',
          board: ['As', 'Kd', '4c'],
          pot: 55,
          history: ['You open the BTN, BB calls', 'Flop: A♠ K♦ 4♣', 'BB checks to you'],
          question: 'You have a gutshot to Broadway and backdoors. What’s the best c-bet?',
          options: [
            {
              label: 'Bet small (~⅓ pot)',
              verdict: 'best',
              because: 'A-K-4 smashes your BTN range (all the AK, AA, KK) and misses the BB’s calling range. Bet small with your whole range — including this gutshot — to deny equity cheaply.',
            },
            {
              label: 'Bet big (pot)',
              verdict: 'ok',
              because: 'Not wrong, but oversizing is unnecessary when a cheap small bet already realizes your range edge. Save big sizes for polarized spots.',
            },
            {
              label: 'Check',
              verdict: 'bad',
              because: 'Checking surrenders one of the best c-bet spots in poker — you give up your range and board advantage for free.',
            },
          ],
          moral: 'C-bet size and frequency follow range advantage and board texture, not just your own hand.',
        },
      },
      {
        id: 'defending-as-caller',
        title: 'Defending as the preflop caller',
        minutes: 8,
        body: `When you call a raise you take a capped, out-of-position range to the flop — but that doesn’t mean you fold to every c-bet. You defend enough of your range (its minimum defence frequency) that villain can’t profitably c-bet any two cards.

Continue with made hands, pairs, and everything with equity: draws, gutshots, even backdoor flush + straight combos. Most of your folding happens on later streets, not the flop — over-folding the flop is one of the most common and most punished leaks.

You have two continuing actions: check-call the hands that want to realise equity cheaply, and check-raise a polar range (your strongest hands plus draws) to fight back. In position you can also float — call with backdoors and overcards to take the pot away later.`,
        takeaways: [
          'Defend enough of your range (MDF) that a c-bet can’t auto-profit.',
          'Continue with equity: pairs, draws, gutshots, backdoors — don’t over-fold the flop.',
          'Check-call to realise equity, check-raise a polar range, float in position.',
        ],
        spot: {
          scenario: 'Flop · you called in the big blind and the button continuation-bets.',
          heroPos: 'BB',
          heroCards: ['Th', '9h'],
          villainPos: 'BTN',
          board: ['Qs', '8d', '3c'],
          pot: 60,
          toCall: 20,
          history: ['You call the BTN open from the BB', 'Flop: Q♠ 8♦ 3♣', 'BTN c-bets 20 into 60'],
          question: 'You have T9 (a gutshot + backdoor flush + backdoor straight). What’s best?',
          options: [
            {
              label: 'Call',
              verdict: 'best',
              because: 'A gutshot to the J plus backdoor flush and straight equity is plenty to defend a small c-bet. Folding here lets the button print with any two cards.',
            },
            {
              label: 'Fold',
              verdict: 'bad',
              because: 'Over-folding the flop is the biggest caller leak — you’re surrendering a hand with real equity to a cheap bet.',
            },
            {
              label: 'Check-raise',
              verdict: 'ok',
              because: 'A check-raise semi-bluff is a fine occasional line with this equity, but the pure call is the standard, lower-variance defend.',
            },
          ],
          moral: 'Defend enough (MDF) to deny the c-bet auto-profit — and hold onto equity rather than over-folding.',
        },
      },
      {
        id: 'turn-barreling',
        title: 'Turn barreling & giving up',
        minutes: 8,
        body: `The turn is where pots get big and ranges get decided. Fire a second barrel on cards that keep or extend your advantage; give up on cards that smash the caller’s range.

Barrel with a plan: value hands that want to build the pot, plus bluffs that carry equity (draws) and useful blockers. Cards that favour you — overcards to the flop, cards that complete your range’s draws — are green lights. Cards that improve the caller (middling connectors on a board they defended) are stop signs.

Not every flop c-bet gets a turn barrel. Check back your marginal made hands to control the pot and protect your checking range, and pick your best equity hands to keep firing as bluffs.`,
        takeaways: [
          'Barrel turns that keep your range advantage; give up on cards that help the caller.',
          'Use hands with equity + blockers as your turn bluffs.',
          'Check back marginal made hands to control the pot and protect your range.',
        ],
        spot: {
          scenario: 'Turn · you c-bet A-K-4 and were called; the turn bricks.',
          heroPos: 'BTN',
          heroCards: ['Qc', 'Jc'],
          villainPos: 'BB',
          board: ['As', 'Kd', '4c', '9h'],
          pot: 90,
          history: ['You c-bet the flop, BB calls', 'Turn: 9♥ (a blank for the BB)', 'BB checks to you'],
          question: 'You hold QJ (a gutshot to Broadway). Barrel or check back?',
          options: [
            {
              label: 'Barrel again',
              verdict: 'best',
              because: 'The 9 doesn’t help the BB’s range, you keep the nut and range advantage on an ace-high board, and QJ has a gutshot plus the ability to credibly rep AK/AQ.',
            },
            {
              label: 'Check back',
              verdict: 'ok',
              because: 'Pot control is defensible, but you surrender fold equity on one of the best barrel cards in the deck with a hand that wants folds now.',
            },
            {
              label: 'Give up (check, fold turn/river)',
              verdict: 'bad',
              because: 'Abandoning your range and board advantage on a blank turn lets the caller realise equity for free.',
            },
          ],
          moral: 'Barrel turns that preserve your range advantage, using hands with equity as your bluffs.',
        },
      },
      {
        id: 'river-value-betting',
        title: 'River value betting',
        minutes: 8,
        body: `On the river there are no more cards — you bet for value when worse hands call often enough. The bar is lower than beginners think: you don’t need villain to have a strong hand, just to call with something you beat at a reasonable frequency.

Size to the hands you’re targeting. Thin value (top pair on a dry board) wants a smaller size that a weak pair can call; polar value (the nuts) wants a big size. Betting too big folds out the exact worse hands you were trying to get paid by.

And don’t check hands that beat villain’s calling range — checking back a hand that would’ve been called by worse is a missed bet, one of the quietest but most expensive river leaks.`,
        takeaways: [
          'Value bet when worse hands call often enough — the bar is low.',
          'Size to the hands you beat: thinner value → smaller bet.',
          'Don’t check back a hand worse hands would call — that’s a missed bet.',
        ],
        spot: {
          scenario: 'River · you have top pair and villain checks to you.',
          heroPos: 'BTN',
          heroCards: ['Ad', 'Jd'],
          villainPos: 'BB',
          board: ['Js', '7c', '3d', '2s', '5h'],
          pot: 80,
          history: ['You bet the flop, checked the turn', 'River: 5♥', 'BB checks'],
          question: 'You hold top pair, top kicker. What’s the best river action?',
          options: [
            {
              label: 'Bet ~½ pot (≈40)',
              verdict: 'best',
              because: 'Worse pairs (weaker Jx, 7x, pocket pairs) and even ace-highs will call a moderate size. That’s clean thin value — you beat their calling range.',
            },
            {
              label: 'Check back',
              verdict: 'bad',
              because: 'Top pair top kicker beats most of villain’s bluff-catchers; checking forfeits a bet worse hands would have paid.',
            },
            {
              label: 'Overbet the pot',
              verdict: 'bad',
              because: 'Too big folds out the weak pairs you’re targeting — you only get called by hands that beat you.',
            },
          ],
          moral: 'Value bet when worse hands call, and size to the hands you actually beat.',
        },
      },
      {
        id: 'river-bluffing',
        title: 'River bluffing: turning hands into bluffs',
        minutes: 8,
        body: `On the river your hand is one of two things: it either has showdown value or it doesn’t. The hands with none — busted draws, missed overcards — are your bluff candidates, because betting is the *only* way they win. Checking them just concedes the pot.

Pick the busted hands that block villain’s calls and unblock their folds, and size big enough to fold out their bluff-catchers. Then balance: for a given size you want the right ratio of value to bluffs so a thinking villain can’t simply call or fold every time.

The mirror-image mistake is bluffing hands that had showdown value (turning a hand that could’ve won into a bluff) or checking your no-value hands and giving up. Bet the trash, check (or value-bet) the made hands.`,
        takeaways: [
          'Bluff the hands with no showdown value — betting is their only way to win.',
          'Choose bluffs that block value and unblock folds; size to fold out bluff-catchers.',
          'Don’t bluff hands that had showdown value, and don’t check back pure air.',
        ],
        spot: {
          scenario: 'River · your straight draw bricked and villain checks to you.',
          heroPos: 'BTN',
          heroCards: ['Qc', '9c'],
          villainPos: 'BB',
          board: ['Js', 'Td', '6c', '2h', '8h'],
          pot: 70,
          history: ['You barreled the flop and turn with a straight draw', 'River: 8♥ — your draw misses', 'BB checks'],
          question: 'You have Q-high, no showdown value. Bet or check?',
          options: [
            {
              label: 'Bet (bluff)',
              verdict: 'best',
              because: 'Q-high never wins at showdown, so betting is your only path to the pot. You credibly rep the missed and made straights (7-9, QK) and fold out villain’s weak pairs.',
            },
            {
              label: 'Check',
              verdict: 'bad',
              because: 'Checking a hand with zero showdown value simply concedes — you give up a pot you could have won by betting.',
            },
            {
              label: 'Bet tiny (¼ pot)',
              verdict: 'ok',
              because: 'A bluff should fold out bluff-catchers; a tiny size gets called by too many weak pairs to work.',
            },
          ],
          moral: 'Turn your no-showdown-value hands into bluffs — checking them just gives up the pot.',
        },
      },
      {
        id: 'check-raising',
        title: 'Check-raising out of position',
        minutes: 8,
        body: `Out of position, checking doesn’t have to mean weakness. A check-raise builds a range that fights back when you’re not the preflop aggressor, and it punishes opponents who c-bet too wide expecting to steal.

Build it polarized: value hands strong enough to play a big pot (sets, two pair, strong top pairs) plus bluffs that carry equity and blockers (flush draws, open-enders, combo draws). The draws give you two ways to win — fold equity now, and outs when called.

Balance matters — if you only check-raise the nuts, villain folds everything but their best; if you only bluff, they never fold. The mix is what makes your check taken seriously and stops villain from betting into you for free.`,
        takeaways: [
          'Check-raising builds an OOP range that punishes wide c-betting.',
          'Go polar: strong value + draws with equity and blockers.',
          'Balance value and bluffs so villain can’t auto-continue against your check.',
        ],
        spot: {
          scenario: 'Flop · you check the big blind and the button c-bets into a two-tone board.',
          heroPos: 'BB',
          heroCards: ['Ah', 'Kh'],
          villainPos: 'BTN',
          board: ['9h', '6h', '2s'],
          pot: 40,
          toCall: 25,
          history: ['You defend the BB, flop 9♥ 6♥ 2♠', 'You check, BTN c-bets 25 into 40'],
          question: 'You have the nut-flush draw with two overcards. Best line?',
          options: [
            {
              label: 'Check-raise',
              verdict: 'best',
              because: 'The nut-flush draw plus two overs is a premium semi-bluff: huge equity when called and strong fold equity now. It anchors the bluff half of your check-raising range.',
            },
            {
              label: 'Call',
              verdict: 'ok',
              because: 'Calling keeps villain’s bluffs in and is fine, but it realises less than check-raising and lets them see turns cheaply with the worst of it.',
            },
            {
              label: 'Fold',
              verdict: 'bad',
              because: 'Folding the nut-flush draw with two overcards to a single c-bet is far too weak — you have enormous equity.',
            },
          ],
          moral: 'Check-raise a polarized range out of position: nutted value plus draws with real equity.',
        },
      },
      {
        id: 'playing-draws',
        title: 'Playing draws: semi-bluff vs pot control',
        minutes: 7,
        body: `A draw wins in two ways: by betting and getting folds now (fold equity), or by checking and hitting later (raw equity). Good draw play is choosing which of those you’re going for.

Semi-bluff your strong draws — you’d like folds, but you’re happy to get called because you have outs. Betting also lets you build the pot for when you hit and denies villain his equity. Take free cards with your weaker draws, or when villain never folds (a station), where the fold-equity half of the semi-bluff just isn’t there.

The read flips the decision: fold equity exists against thinking players and disappears against calling stations. Against a station, check and realise your equity cheaply; against a fold-prone opponent, fire.`,
        takeaways: [
          'Semi-bluff = win now via fold equity, or later via your outs.',
          'Bet strong draws with fold equity; take free cards with weak ones.',
          'No fold equity vs a station → check and realise equity cheaply.',
        ],
        spot: {
          scenario: 'Flop · single-raised pot, you’re first to act with the nut-flush draw.',
          heroPos: 'BB',
          heroCards: ['Ad', '5d'],
          villainPos: 'BTN',
          board: ['Qd', '7d', '3s'],
          pot: 45,
          history: ['You defend the BB, flop Q♦ 7♦ 3♠', 'Action is on you, first to act'],
          question: 'You flopped the nut-flush draw against a normal opponent. What’s best?',
          options: [
            {
              label: 'Bet (semi-bluff)',
              verdict: 'best',
              because: 'You win two ways: fold equity now, and the nut flush when it comes. Betting also builds the pot for when you hit and denies villain a free look.',
            },
            {
              label: 'Check-call',
              verdict: 'ok',
              because: 'Pot control realises your equity, but it forfeits the fold-equity half of a strong draw against an opponent who can fold.',
            },
            {
              label: 'Check-fold',
              verdict: 'bad',
              because: 'Giving up the nut-flush draw wastes ~9 outs plus overcard and fold equity — a big leak.',
            },
          ],
          moral: 'Semi-bluff strong draws for fold equity + outs; take free cards when folds are unlikely.',
        },
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
        spot: {
          scenario: 'River · your flush got there and villain has checked to you.',
          heroPos: 'BTN',
          heroCards: ['Ah', 'Qh'],
          villainPos: 'BB',
          board: ['Kh', '9h', '4c', '2s', '7h'],
          pot: 120,
          history: ['Turn checks through', 'River: 7♥ — the flush completes', 'BB checks'],
          question: 'You hold the nut flush in a polarized spot. How do you size?',
          options: [
            {
              label: 'Bet big (pot+)',
              verdict: 'best',
              because: 'With a polarized range (the nuts plus your missed draws as bluffs) you want a big size: it charges bluff-catchers the most and lets your bluffs apply real pressure at the same size.',
            },
            {
              label: 'Bet small (¼ pot)',
              verdict: 'bad',
              because: 'A tiny bet with the nuts leaves huge value behind and can’t be balanced with bluffs — that’s a merged size in a polar spot.',
            },
            {
              label: 'Check back',
              verdict: 'bad',
              because: 'Checking the nuts on the river forfeits value you can never get back.',
            },
          ],
          moral: 'Polarized ranges (nuts + bluffs) bet big; merged ranges (thin value) bet small.',
        },
      },
    ],
  },
  {
    id: 'sizing-texture',
    title: '4 · Bet Sizing & Texture',
    summary: 'Reading and choosing sizes, overbets, board texture, and multiway pots.',
    lessons: [
      {
        id: 'bet-sizing-tells',
        title: 'What your sizing says',
        minutes: 8,
        body: `Bet sizing is a language. A small bet (25–33% pot) says "wide and merged" — I’m betting a lot of hands on a board that favours me, denying equity cheaply. A big bet (66–100%+) says "polarized" — I have strong value and bluffs, little in between.

Because size encodes range, you must keep your sizing consistent at each decision point, or observant opponents read you like a book. Solvers pick their sizes from the board and the range advantage, not from the strength of one hand.

The flip side is reading villain’s size. A pot-sized or larger bet is polar — the nuts or a bluff, rarely a thin value hand — so you respond by bluff-catching to your frequency, not by folding everything or raising a medium hand into a polar range.`,
        takeaways: [
          'Small bet = wide/merged; big bet = polarized (nuts + bluffs).',
          'Keep sizing consistent per node so you’re not readable.',
          'A big bet is polar — bluff-catch to MDF, don’t fold every medium hand.',
        ],
        spot: {
          scenario: 'River · a solid reg fires a pot-sized bet and you hold top pair.',
          heroPos: 'BB',
          heroCards: ['Kh', 'Qd'],
          villainPos: 'BTN',
          board: ['Qs', 'Jd', '8c', '4s', '2h'],
          pot: 100,
          toCall: 100,
          history: ['You check-call two streets with top pair', 'River: 2♥', 'BTN bets 100 (pot)'],
          question: 'A pot-sized (polar) bet with your top-pair bluff-catcher — best read and play?',
          options: [
            {
              label: 'Treat it as polar, bluff-catch to MDF',
              verdict: 'best',
              because: 'A pot-sized bet is nuts-or-bluffs. Your KQ beats exactly the bluffs, so it’s a bluff-catcher — continue at the frequency MDF/your read demands rather than over-folding.',
            },
            {
              label: 'Raise for value',
              verdict: 'bad',
              because: 'Raising a bluff-catcher into a polar range only gets called by better and folds out the bluffs — you turn a hand that beats bluffs into a bluff.',
            },
            {
              label: 'Fold — a big bet means the nuts',
              verdict: 'bad',
              because: 'Polar means nuts OR bluffs. Folding every bluff-catcher to a big bet lets villain print by bluffing — that’s exactly what MDF prevents.',
            },
          ],
          moral: 'Big bets are polar (nuts or bluffs), not thin value — respond by bluff-catching, not folding everything.',
        },
      },
      {
        id: 'overbets',
        title: 'Overbets & the polar big bet',
        minutes: 8,
        body: `An overbet — betting more than the pot — is the most polar size there is: only the nuts and pure bluffs belong in it. It’s a scalpel, not a hammer.

Use it when two things are true: your range has a nut advantage (you hold the top hands far more often than villain) and villain’s range is capped (they’ve denied themselves the strongest hands by their earlier line). Then the overbet extracts maximum value from the nuts and gives your bluffs maximum fold equity at the same size.

The requirement is that you actually have the nutted hands in your range on this runout — you can’t overbet a range that can’t hold the nuts, or a thinking opponent just calls you down.`,
        takeaways: [
          'Overbet = the most polar size: nuts and pure bluffs only.',
          'Use it with a nut advantage vs a capped range.',
          'You must credibly hold the nuts on this runout to overbet it.',
        ],
        spot: {
          scenario: 'River · a flush completes and you hold the nut flush against a capped range.',
          heroPos: 'BTN',
          heroCards: ['Ad', '4d'],
          villainPos: 'BB',
          board: ['As', 'Kd', '5d', '7d', '2d'],
          pot: 100,
          history: ['You raise pre and bet flop/turn, BB calls', 'River: 2♦ — four diamonds, you hold the nut flush', 'BB checks'],
          question: 'You have the nut flush; villain is capped (would’ve raised big flushes earlier). Size?',
          options: [
            {
              label: 'Overbet',
              verdict: 'best',
              because: 'You hold the nut flush and a clear nut advantage against a capped range. Overbetting extracts maximum value from their ace-x and sets, and the same size powers your bluffs.',
            },
            {
              label: 'Bet ⅓ pot',
              verdict: 'bad',
              because: 'A tiny size massively under-realises the nuts on a runout where you can bet huge and still get called by second-best hands.',
            },
            {
              label: 'Check back',
              verdict: 'bad',
              because: 'Checking the nuts on the river forfeits the biggest value bet available to you.',
            },
          ],
          moral: 'Overbet with a nut advantage against a capped range — maximum value and maximum bluff pressure.',
        },
      },
      {
        id: 'board-texture',
        title: 'Board texture taxonomy',
        minutes: 8,
        body: `Boards come in types, and the type dictates your strategy. Dry, static boards (A-K-4 rainbow) have few draws and stable equities — the preflop raiser can bet small and often because nothing changes and the board favours their range.

Wet, dynamic boards (9-8-7 two-tone) are the opposite: draws everywhere, equities run close, and the turn changes everything. Here you check more and bet bigger and more polar when you do, because a small bet invites raises and fails to charge the many draws.

Paired and monotone boards have their own logic (fewer combos of strong hands, flush/boat dynamics). The habit to build: before choosing a size, name the texture and ask whether the turn is likely to shift equities.`,
        takeaways: [
          'Dry/static boards → bet small and often; equities are stable.',
          'Wet/dynamic boards → check more, bet bigger and polar.',
          'Name the texture before you size; ask if the turn will swing equities.',
        ],
        spot: {
          scenario: 'Flop · you’re the preflop raiser on a very wet, connected board.',
          heroPos: 'BTN',
          heroCards: ['As', 'Ac'],
          villainPos: 'BB',
          board: ['9h', '8h', '7c'],
          pot: 55,
          history: ['You open, BB calls', 'Flop: 9♥ 8♥ 7♣ — about as wet as it gets'],
          question: 'You have an overpair on 9-8-7 two-tone. What’s the right c-bet approach?',
          options: [
            {
              label: 'Bet bigger / more polar, c-bet less often',
              verdict: 'best',
              because: 'This dynamic board hammers the BB’s range and swings on many turns. Size up to charge the draws and protect your overpair, and check a chunk of your range to stay balanced.',
            },
            {
              label: 'Bet small with your whole range',
              verdict: 'bad',
              because: 'Small-and-often is the *dry*-board play. Here it invites raises and fails to charge the flush and straight draws that have big equity against you.',
            },
            {
              label: 'Always check',
              verdict: 'ok',
              because: 'Checking some hands is right, but never betting under-realises your overpair and lets villain’s draws see free cards.',
            },
          ],
          moral: 'Match sizing and frequency to texture: dry favours small-and-often, wet favours big-and-selective.',
        },
      },
      {
        id: 'range-vs-range',
        title: 'Range vs range: who does the board favour?',
        minutes: 8,
        body: `Every postflop decision is your whole range against villain’s whole range on this specific board. The first question is always: whose preflop range connects harder here?

The player with the range (and nut) advantage should bet more often; the other should check and defend. On A-K-4 the preflop raiser is favoured — their range is full of big cards. On 6-5-4 the wide caller is favoured — they defend far more small and connected hands that make straights, two pair, and sets, while the raiser’s range is mostly overcards that missed.

Training your eye to read this at a glance is one of the highest-leverage postflop skills: it tells you whether to be the aggressor or the defender before you ever think about your own two cards.`,
        takeaways: [
          'Ask who the board favours before deciding to bet or check.',
          'High/disconnected boards favour the raiser; low/connected boards favour the caller.',
          'The player with range advantage bets more; the other defends.',
        ],
        spot: {
          scenario: 'Flop · you raised preflop and the big blind called; a low connected flop.',
          heroPos: 'BTN',
          heroCards: ['Ac', 'Kc'],
          villainPos: 'BB',
          board: ['6h', '5d', '4c'],
          pot: 55,
          history: ['You open, BB calls', 'Flop: 6♥ 5♦ 4♣'],
          question: 'On 6-5-4, who has the range advantage — and what does it imply?',
          options: [
            {
              label: 'The BB caller — so check a lot',
              verdict: 'best',
              because: 'The BB defends tons of 87, 76, 53, 33, 44 — straights, two pair, sets — while your raising range is mostly overcards that whiffed. They have the range and nut advantage, so you check much more here.',
            },
            {
              label: 'The preflop raiser — bet small and often',
              verdict: 'bad',
              because: 'That’s the dry-high-board play. On 6-5-4 your range is largely overcards; blasting away runs into a range that hits this board far harder.',
            },
            {
              label: 'Neither — sizing doesn’t matter',
              verdict: 'bad',
              because: 'Range advantage almost always tilts one way; ignoring it is how you c-bet into the exact ranges that crush you.',
            },
          ],
          moral: 'Read who the board favours first — low connected boards belong to the caller, not the raiser.',
        },
      },
      {
        id: 'multiway-pots',
        title: 'Multiway pots',
        minutes: 7,
        body: `Everything you know about heads-up pots loosens when a third player is in. With more ranges to get through, someone usually connects — so bluffs go down in value and you need stronger hands to bet and to continue.

Practically: c-bet much less often, size down, and tighten up. Bluffing into two players is asking to get called; thin value bets get raised more; and marginal made hands that were value heads-up become bluff-catchers multiway. Nut hands, meanwhile, go *up* in value — there’s more money and more second-best hands to pay them off.

The mental adjustment is discipline: respect that in a family pot, someone probably has it, and save your chips for the spots where you have a genuinely strong hand.`,
        takeaways: [
          'Multiway → bluff far less; someone usually connects.',
          'Marginal made hands become bluff-catchers; c-bet less and smaller.',
          'Nut hands rise in value — more players to pay them off.',
        ],
        spot: {
          scenario: 'Flop · a three-way pot on a draw-heavy board with top pair.',
          heroPos: 'CO',
          heroCards: ['Ac', 'Jd'],
          villainPos: 'BTN + BB',
          board: ['Jh', 'Th', '5c'],
          pot: 70,
          history: ['You open CO, BTN and BB call', 'Flop: J♥ T♥ 5♣ — you have top pair top kicker'],
          question: 'Three-way on J-T-5 two-tone with AJ. What’s best?',
          options: [
            {
              label: 'Check (pot control)',
              verdict: 'best',
              because: 'Three-way on a draw-heavy board, top pair plays more like a bluff-catcher. Betting into two ranges full of pairs, draws, and two-pair combos bloats the pot with a vulnerable hand.',
            },
            {
              label: 'Bet big for value',
              verdict: 'bad',
              because: 'AJ isn’t strong enough to build a big pot into two players on a board this wet — you get called or raised by better far too often.',
            },
            {
              label: 'Bluff-raise if bet into',
              verdict: 'bad',
              because: 'Bluffing multiway is spew — with two ranges to fold out, your fold equity collapses.',
            },
          ],
          moral: 'Multiway pots demand caution: fewer bluffs, tighter value, respect that someone has it.',
        },
      },
      {
        id: 'delayed-probe-bets',
        title: 'Delayed c-bets & probe bets',
        minutes: 7,
        body: `When a street checks through, information is created: someone gave up the initiative, and their range is now capped at medium-strength. Two bets attack that weakness.

A delayed c-bet is when the preflop raiser checks the flop, then bets the turn — often to take a stab after showing weakness, or having picked up equity. A probe bet is the caller leading into the raiser on a later street after the raiser checked back the flop, attacking the cap that check-back revealed.

Both plays hunt the same signal: a checked-through street usually means neither side has a big hand, and whoever fires next often takes it down — especially with a hand that has some equity to fall back on.`,
        takeaways: [
          'A checked-through street caps ranges at medium strength.',
          'Delayed c-bet: the raiser stabs the turn after checking the flop.',
          'Probe bet: the caller leads into the raiser who checked back — attack the cap.',
        ],
        spot: {
          scenario: 'Turn · the flop checked through and a good card comes for your range.',
          heroPos: 'BB',
          heroCards: ['Kc', 'Jc'],
          villainPos: 'BTN',
          board: ['8s', '5d', '2c', 'Qh'],
          pot: 45,
          history: ['You call in the BB', 'Flop 8♠ 5♦ 2♣ checks through', 'Turn: Q♥'],
          question: 'The button checked back the flop (capping their range). You have KJ with a gutshot. Best play?',
          options: [
            {
              label: 'Probe (bet the turn)',
              verdict: 'best',
              because: 'The flop check-back caps the button at weak/medium hands. The Q favours your range, and KJ has two overs plus a gutshot to barrel — leading takes it away or sets up a bluff.',
            },
            {
              label: 'Check again',
              verdict: 'ok',
              because: 'Checking isn’t terrible, but you pass up an attackable weakness with a hand that has equity and good barrel cards ahead.',
            },
            {
              label: 'Check-fold',
              verdict: 'bad',
              because: 'Giving up when villain just told you they have nothing wastes a clear +EV attacking spot.',
            },
          ],
          moral: 'A checked-through street reveals weakness — attack it with a probe or a delayed c-bet.',
        },
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
