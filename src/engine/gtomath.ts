// Closed-form GTO math. These are the formulas behind the theory — MDF, alpha,
// pot odds, balanced bluffing, SPR — as pure functions so both the concept
// calculators and the drill generators share one source of truth.
//
// Convention: `pot` is the pot size BEFORE the bet goes in; `bet` is the amount
// wagered. After the bet, the pot is `pot + bet` and calling costs `bet`.

// Equity you need to profitably call a bet: you risk `bet` to win `pot + bet`.
export function requiredEquity(pot: number, bet: number): number {
  return bet / (pot + 2 * bet);
}

// Minimum Defence Frequency: the fraction of your range you must continue with
// so a bet of any two cards can't auto-profit. MDF = pot / (pot + bet).
export function minDefenseFrequency(pot: number, bet: number): number {
  return pot / (pot + bet);
}

// Alpha: how often a bluff must succeed to break even (= the fraction of your
// range you're allowed to fold). alpha = bet / (pot + bet) = 1 - MDF.
export function alpha(pot: number, bet: number): number {
  return bet / (pot + bet);
}

// Balanced bluff fraction: the share of a polarized betting range that should be
// bluffs to make a bluff-catcher indifferent. = bet / (pot + 2*bet).
// (Numerically equal to requiredEquity — that symmetry is the point.)
export function balancedBluffFraction(pot: number, bet: number): number {
  return bet / (pot + 2 * bet);
}

// Value-to-bluff ratio implied by a bet size, e.g. a pot-sized bet -> 2:1.
export function valueToBluffRatio(pot: number, bet: number): number {
  const f = balancedBluffFraction(pot, bet);
  return (1 - f) / f; // = (pot + bet) / bet
}

// Stack-to-pot ratio.
export function spr(effectiveStack: number, pot: number): number {
  return effectiveStack / pot;
}

// Rule of 2 & 4: quick equity estimate from outs. On the flop (2 cards to come)
// multiply outs by 4; on the turn (1 to come) by 2. Capped — the linear rule
// overshoots for large out counts.
export function ruleOfNEquity(outs: number, streetsToCome: number): number {
  return Math.min(outs * 2 * streetsToCome, 95);
}
