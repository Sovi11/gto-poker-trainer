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
