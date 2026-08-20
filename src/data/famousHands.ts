// Study: famous hands, played as puzzles.
//
// Two kinds of entry live here, and the difference matters:
//
//   verified: true  — a real, televised hand involving real named players. The
//     cards, board and bet sizes are taken from public reporting, and `source`
//     links where they came from. Nothing here is invented.
//
//   verified: false — a constructed teaching spot. No real player is named,
//     because attributing made-up cards to a real professional would be putting
//     words in their mouth.
//
// The "actual" option marks what was really played. That is not the same as
// "provably optimal": these are human reads under pressure, and some of the most
// celebrated plays in poker history are only defensible with the read attached.

export type StudyTag = 'bluff' | 'fold' | 'call' | 'read' | 'value';

export interface StudyOption {
  label: string;
  /** 'actual' = what was really done (or the intended answer in a constructed spot). */
  verdict: 'actual' | 'reasonable' | 'bad';
  because: string;
}

export interface StudySpot {
  id: string;
  title: string;
  event: string;
  tag: StudyTag;
  verified: boolean;
  source?: string;
  /** Whose seat you sit in. */
  heroName: string;
  heroCards: [string, string];
  /** Opponents, with cards only where they were actually shown. */
  villains: { name: string; cards?: [string, string]; note?: string }[];
  street: string;
  board: string[];
  pot: number;
  toCall?: number;
  unit: string;
  history: string[];
  question: string;
  options: StudyOption[];
  whatHappened: string;
  lesson: string;
}

export const STUDY_SPOTS: StudySpot[] = [
  {
    id: 'moneymaker-bluff',
    title: 'The Bluff of the Century',
    event: '2003 WSOP Main Event · heads-up for the title',
    tag: 'bluff',
    verified: true,
    source: 'https://www.pokernews.com/strategy/analyzing-moneymaker-bluff-of-the-century-against-farha-35218.htm',
    heroName: 'Chris Moneymaker',
    heroCards: ['Ks', '7h'],
    villains: [{ name: 'Sam Farha', cards: ['Qs', '9h'], note: 'top pair' }],
    street: 'River',
    board: ['9s', '6s', '2d', '8s', '3h'],
    pot: 1_800_000,
    unit: 'chips',
    history: [
      'Flop 9♠ 6♠ 2♦ checks through — Farha has flopped top pair',
      'Turn 8♠ gives you an open-ender and the king-high flush draw',
      'Farha bets 300k, you check-raise to 800k as a semi-bluff, Farha calls',
      'River 3♥ — every draw misses. You have king-high. Farha checks.',
    ],
    question: 'You have king-high and cannot win at showdown. What do you do?',
    options: [
      {
        label: 'Move all-in',
        verdict: 'actual',
        because:
          'King-high never wins a showdown, so betting is the only way to win the pot. Your line — check-raising the turn on a three-spade board — tells a story where the flush got there, and Farha holds only one pair on a board screaming flush and straight.',
      },
      {
        label: 'Check it back and give up',
        verdict: 'bad',
        because:
          'Checking concedes a pot you cannot win any other way. With zero showdown value, giving up is strictly worse than a credible bluff.',
      },
      {
        label: 'Bet small to look like a value bet',
        verdict: 'bad',
        because:
          'A small bet gives Farha a cheap price to call with top pair. To fold out a made hand this good you need maximum pressure — his whole tournament has to be at risk.',
      },
    ],
    whatHappened:
      'Moneymaker shoved. Farha talked it out, said he could make a crazy call, and folded top pair. Moneymaker took a commanding lead and went on to win the Main Event and $2.5 million — the win widely credited with igniting the poker boom.',
    lesson:
      'A bluff is a story about your whole range, not your two cards. The turn check-raise is what made the river shove believable.',
  },
  {
    id: 'farha-fold',
    title: 'The Other Side of the Bluff',
    event: '2003 WSOP Main Event · the same hand, Farha’s seat',
    tag: 'fold',
    verified: true,
    source: 'https://www.pokernews.com/strategy/analyzing-moneymaker-bluff-of-the-century-against-farha-35218.htm',
    heroName: 'Sam Farha',
    heroCards: ['Qs', '9h'],
    villains: [{ name: 'Chris Moneymaker', note: 'check-raised the turn, now shoves the river' }],
    street: 'River',
    board: ['9s', '6s', '2d', '8s', '3h'],
    pot: 1_800_000,
    toCall: 1_800_000,
    unit: 'chips',
    history: [
      'You flop top pair on 9♠ 6♠ 2♦ and check it through',
      'Turn 8♠ puts three spades out. You bet 300k, he check-raises to 800k, you call',
      'River 3♥. You check and he moves all-in for your tournament life',
    ],
    question: 'You hold top pair, weak kicker, facing a shove for everything. Call or fold?',
    options: [
      {
        label: 'Fold',
        verdict: 'actual',
        because:
          'Top pair with a nine is close to the bottom of your range here. He check-raised a three-spade turn and then shoved a blank — a line that represents flushes and straights. And in a tournament, being wrong costs you the whole thing, not just the pot.',
      },
      {
        label: 'Call — he could easily be bluffing',
        verdict: 'reasonable',
        because:
          'It was in fact a bluff, and against an aggressive opponent this is a genuine bluff-catcher. But being right once does not make it the higher-EV play: the same call loses everything every time he actually has it.',
      },
      {
        label: 'Fold because you never call big river bets',
        verdict: 'bad',
        because:
          'Folding on principle rather than on the specific line makes you infinitely exploitable — anyone can then take every pot from you with a big enough bet.',
      },
    ],
    whatHappened:
      'Farha folded. He was beaten by king-high — the hand became known as the Bluff of the Century, and the fold is still argued about decades later.',
    lesson:
      'Judge the decision, not the reveal. Farha folded one pair to a line that told a consistent story; the fact that it was a bluff does not automatically make the fold wrong.',
  },
  {
    id: 'dwan-three-way',
    title: 'Bluffing Two Better Hands',
    event: 'High Stakes Poker, Season 5 · $237,000 pot',
    tag: 'read',
    verified: true,
    source: 'https://www.cardplayer.com/cardplayer-poker-magazines/66193-marvin-rettenmaier-9-3/articles/20523-hand-history-tom-dwan-barry-greenstein-and-peter-eastgate',
    heroName: 'Tom Dwan',
    heroCards: ['Qc', 'Tc'],
    villains: [
      { name: 'Barry Greenstein', cards: ['As', 'Ah'], note: 'pocket aces' },
      { name: 'Peter Eastgate', cards: ['4h', '2d'], note: 'trip deuces' },
    ],
    street: 'Turn',
    board: ['Td', '2c', '2s', '7d'],
    pot: 133_500,
    unit: '$',
    history: [
      'Greenstein raises to $2,500 preflop and several players call',
      'Flop 10♦ 2♣ 2♠ — Greenstein bets $10,000 with aces',
      'You raise to $37,300 with second pair; Eastgate cold-calls with trip deuces',
      'Turn 7♦ — both check to you. You are drawing nearly dead against both of them.',
    ],
    question: 'Two opponents, both almost certainly ahead of your second pair. What now?',
    options: [
      {
        label: 'Fire a big bet — about $104,000',
        verdict: 'actual',
        because:
          'The read: Greenstein’s flop bet-then-check looks like an overpair that hates the paired board, and Eastgate’s flat call looks exactly like a deuce slow-playing. Neither can call a huge bet without beating a full house — and your line credibly represents exactly that.',
      },
      {
        label: 'Check behind and take a free card',
        verdict: 'reasonable',
        because:
          'Perfectly safe, and what almost everyone does. But it concedes a large pot to hands that are themselves too weak to call more pressure.',
      },
      {
        label: 'Bet small to see where you are',
        verdict: 'bad',
        because:
          'A small bet folds out nothing here. Against trips and an overpair, only a bet that threatens their entire stack has any chance of working.',
      },
    ],
    whatHappened:
      'Dwan bet $104,200 into $133,500. Greenstein folded pocket aces and Eastgate folded trip deuces — Dwan won a $237,000 pot with the worst hand of the three. He later said he was about 90% sure Eastgate had him beaten.',
    lesson:
      'Bluffing works on ranges and board texture, not on your own hand strength. A paired board makes full houses possible for you and impossible to discount for them.',
  },

  // --- Constructed teaching spots (no real player is named) -----------------
  {
    id: 'classic-blocker-bluff',
    title: 'The Blocker Bluff',
    event: 'Constructed spot · cash game, 100bb deep',
    tag: 'bluff',
    verified: false,
    heroName: 'You',
    heroCards: ['Ah', '7c'],
    villains: [{ name: 'A solid regular', note: 'called flop and turn, checks river' }],
    street: 'River',
    board: ['Kh', '9h', '4c', '2h', '8s'],
    pot: 120,
    unit: '$',
    history: [
      'You barrel the flop and turn on a heart-heavy board',
      'River 8♠ bricks — you hold ace-high with the A♥',
      'Villain checks to you for the third time',
    ],
    question: 'Your hand cannot win at showdown, but you hold the ace of hearts. Bet or check?',
    options: [
      {
        label: 'Bet big',
        verdict: 'actual',
        because:
          'The A♥ is the nut-flush blocker: villain can never hold the nut flush, so your representation of it is credible and their calls get much harder. Best bluff in your range — it blocks their strongest continues while your own hand wins nothing at showdown.',
      },
      {
        label: 'Check and give up',
        verdict: 'bad',
        because: 'Ace-high never wins here, and you are holding the single best card for making this bluff work.',
      },
      {
        label: 'Bet a quarter of the pot',
        verdict: 'bad',
        because: 'You need to fold out made flushes and strong pairs. A tiny bet prices them in to call.',
      },
    ],
    lesson: 'Pick bluffs that block the hands villain needs in order to call. Blockers turn a hopeless hand into your best bluff.',
    whatHappened:
      'Constructed spot: this is the textbook pattern behind most river bluffs solvers choose — the hand with no showdown value that also blocks the nuts.',
  },
  {
    id: 'classic-hero-fold',
    title: 'When the Story Adds Up',
    event: 'Constructed spot · tournament, near the bubble',
    tag: 'fold',
    verified: false,
    heroName: 'You',
    heroCards: ['Ac', 'Kd'],
    villains: [{ name: 'A tight opponent', note: 'has not bluffed once all day' }],
    street: 'River',
    board: ['Ad', 'Kc', '7h', '3s', '3d'],
    pot: 90,
    toCall: 180,
    unit: 'BB',
    history: [
      'You flop top two pair and bet every street',
      'River 3♦ pairs the board; you bet again',
      'The nit check-raises all-in for two and a half times the pot',
    ],
    question: 'You have top two pair. A player who never bluffs just jammed. Call or fold?',
    options: [
      {
        label: 'Fold',
        verdict: 'actual',
        because:
          'A check-raise jam from a player with no bluffs in their range is value, always. The river paired: 33, 77, A3, K3 all beat you, and near the bubble being wrong ends your tournament. Your read on the player beats the strength of your hand.',
      },
      {
        label: 'Call — top two pair is too strong to fold',
        verdict: 'bad',
        because:
          'Hand strength is relative to villain’s range, not absolute. Against a range with zero bluffs, top two pair is just a losing bluff-catcher.',
      },
      {
        label: 'Call because you already put chips in',
        verdict: 'bad',
        because:
          'The chips in the pot are not yours any more. Only the price and villain’s range matter — sunk cost is the most expensive fallacy in poker.',
      },
    ],
    lesson: 'Against opponents who never bluff, fold far more than MDF says. MDF defends against a balanced villain — exploitation means deviating when they are not.',
    whatHappened:
      'Constructed spot: the standard exploit against an under-bluffing player, and the single most common way to save chips against tight opposition.',
  },
  {
    id: 'classic-hero-call',
    title: 'The Hero Call',
    event: 'Constructed spot · cash game vs an aggressive opponent',
    tag: 'call',
    verified: false,
    heroName: 'You',
    heroCards: ['9s', '9d'],
    villains: [{ name: 'A hyper-aggressive regular', note: 'triple barrels relentlessly' }],
    street: 'River',
    board: ['Qh', '8c', '5d', '2s', 'Jh'],
    pot: 200,
    toCall: 160,
    unit: '$',
    history: [
      'Villain bets flop, turn and river — three barrels on a board that missed almost everything',
      'You hold pocket nines: under the queen and jack, but ahead of every busted draw',
      'You need roughly 31% equity to call',
    ],
    question: 'Middle pair facing a third barrel from a habitual bluffer. Call or fold?',
    options: [
      {
        label: 'Call',
        verdict: 'actual',
        because:
          'Count their value hands: not many queens or jacks got here this way. Now count the busted hearts and straight draws they barrel with — far more. Against a player who over-bluffs, a bluff-catcher only needs to beat bluffs, and nines beat all of them.',
      },
      {
        label: 'Fold — you only have middle pair',
        verdict: 'bad',
        because:
          'Over-folding is exactly what makes a triple-barrel bluffer profitable. Somebody has to catch them, and your hand beats their entire bluffing range.',
      },
      {
        label: 'Raise to represent the straight',
        verdict: 'bad',
        because:
          'Raising turns a hand that beats every bluff into a bluff itself — you fold out worse and only get called by better.',
      },
    ],
    lesson: 'Bluff-catchers only need to beat bluffs. Against someone who bluffs too often, calling with a medium hand is not heroic — it is just arithmetic.',
    whatHappened:
      'Constructed spot: the mirror image of the hero fold. Same principle — deviate toward the opponent’s actual leak — pointed in the opposite direction.',
  },
];

export function spotsByTag(tag: StudyTag | 'all'): StudySpot[] {
  return tag === 'all' ? STUDY_SPOTS : STUDY_SPOTS.filter((s) => s.tag === tag);
}

export const TAG_LABELS: Record<StudyTag, string> = {
  bluff: 'Great bluff',
  fold: 'Great fold',
  call: 'Great call',
  read: 'Great read',
  value: 'Value line',
};
