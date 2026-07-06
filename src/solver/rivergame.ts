// A real GTO solver for the polarized river game — the atomic toy game of
// poker theory. Bettor holds the nuts (valueFrac) or air; defender holds a
// pure bluff-catcher. Bettor may bet B into pot P or check; facing a bet the
// defender calls or folds.
//
// Solved with vanilla CFR (regret matching, exact expectations — the game is
// small enough that no sampling is needed). The closed-form equilibrium is
// well known, which makes the CFR engine fully verifiable:
//   defender calls  c* = P / (P + B)                      (MDF)
//   bettor bluffs   x* = v·B / ((1−v)·(P + B))  of air    (makes calls indifferent)

export interface RiverParams {
  pot: number;
  bet: number;
  valueFrac: number; // P(bettor holds the nuts), typically 0.5
}

export interface RiverSolution {
  betNuts: number; // P(bet | nuts)
  bluffFreq: number; // P(bet | air)
  callFreq: number; // P(call | facing bet)
  bettorEV: number; // chips to bettor at equilibrium (share of pot P)
  defenderEV: number;
  exploitability: number; // total best-response gain, in pots (→ 0 at equilibrium)
  iterations: number;
}

// Bettor terminal utilities (defender's are pot-minus-these; zero-sum).
function u(pot: number, bet: number) {
  return {
    nutsBetCall: pot + bet,
    nutsBetFold: pot,
    nutsCheck: pot,
    airBetCall: -bet,
    airBetFold: pot,
    airCheck: 0,
  };
}

export function solveRiverGame(params: RiverParams, iterations = 20000): RiverSolution {
  const { pot, bet, valueFrac: v } = params;
  const a = 1 - v;
  const U = u(pot, bet);

  // Regrets and average-strategy accumulators per infoset.
  let rNutsBet = 0, rNutsCheck = 0;
  let rAirBet = 0, rAirCheck = 0;
  let rCall = 0, rFold = 0;
  let sNutsBet = 0, sNutsSum = 0;
  let sAirBet = 0, sAirSum = 0;
  let sCall = 0, sCallSum = 0;

  const match = (r1: number, r2: number): number => {
    const p1 = Math.max(r1, 0);
    const p2 = Math.max(r2, 0);
    return p1 + p2 > 0 ? p1 / (p1 + p2) : 0.5;
  };

  for (let it = 0; it < iterations; it++) {
    const bn = match(rNutsBet, rNutsCheck); // P(bet | nuts)
    const ba = match(rAirBet, rAirCheck); // P(bet | air)
    const c = match(rCall, rFold); // P(call | bet)

    // --- bettor regrets (chance-weighted by hand prior) ---
    const evNutsBet = c * U.nutsBetCall + (1 - c) * U.nutsBetFold;
    const evNutsCheck = U.nutsCheck;
    const evNuts = bn * evNutsBet + (1 - bn) * evNutsCheck;
    rNutsBet += v * (evNutsBet - evNuts);
    rNutsCheck += v * (evNutsCheck - evNuts);

    const evAirBet = c * U.airBetCall + (1 - c) * U.airBetFold;
    const evAirCheck = U.airCheck;
    const evAir = ba * evAirBet + (1 - ba) * evAirCheck;
    rAirBet += a * (evAirBet - evAir);
    rAirCheck += a * (evAirCheck - evAir);

    // --- defender regrets (weighted by probability a bet arrives) ---
    const reachBet = v * bn + a * ba;
    if (reachBet > 0) {
      const pNuts = (v * bn) / reachBet;
      const pAir = 1 - pNuts;
      // defender utilities: calling loses B vs nuts, wins P+B vs air; folding is 0
      const evCall = pNuts * -bet + pAir * (pot + bet);
      const evFold = 0;
      const evDef = c * evCall + (1 - c) * evFold;
      rCall += reachBet * (evCall - evDef);
      rFold += reachBet * (evFold - evDef);
    }

    // --- average strategy (linear weighting) ---
    sNutsBet += bn;
    sNutsSum += 1;
    sAirBet += ba;
    sAirSum += 1;
    sCall += c;
    sCallSum += 1;
  }

  const betNuts = sNutsBet / sNutsSum;
  const bluffFreq = sAirBet / sAirSum;
  const callFreq = sCall / sCallSum;

  const bettorEV = bettorEVFor(params, betNuts, bluffFreq, callFreq);
  const defenderEV = pot - bettorEV;

  // Exploitability: how much each side gains by best-responding to the average
  // strategy. Zero (within tolerance) means we found the equilibrium.
  const brBettor = bestBettorEV(params, callFreq) - bettorEV;
  const brDefender = bestDefenderEV(params, betNuts, bluffFreq) - defenderEV;
  const exploitability = (Math.max(brBettor, 0) + Math.max(brDefender, 0)) / pot;

  return { betNuts, bluffFreq, callFreq, bettorEV, defenderEV, exploitability, iterations };
}

// Expected chips to the bettor for arbitrary strategies (exact).
export function bettorEVFor(params: RiverParams, betNuts: number, bluffFreq: number, callFreq: number): number {
  const { pot, bet, valueFrac: v } = params;
  const a = 1 - v;
  const U = u(pot, bet);
  const evNuts =
    betNuts * (callFreq * U.nutsBetCall + (1 - callFreq) * U.nutsBetFold) + (1 - betNuts) * U.nutsCheck;
  const evAir =
    bluffFreq * (callFreq * U.airBetCall + (1 - callFreq) * U.airBetFold) + (1 - bluffFreq) * U.airCheck;
  return v * evNuts + a * evAir;
}

// Bettor's best response to a fixed call frequency.
export function bestBettorEV(params: RiverParams, callFreq: number): number {
  const { pot, bet, valueFrac: v } = params;
  const a = 1 - v;
  const U = u(pot, bet);
  const evNuts = Math.max(callFreq * U.nutsBetCall + (1 - callFreq) * U.nutsBetFold, U.nutsCheck);
  const evAir = Math.max(callFreq * U.airBetCall + (1 - callFreq) * U.airBetFold, U.airCheck);
  return v * evNuts + a * evAir;
}

// Defender's best response to a fixed bettor strategy.
export function bestDefenderEV(params: RiverParams, betNuts: number, bluffFreq: number): number {
  const { pot, valueFrac: v } = params;
  const a = 1 - v;
  const reachBet = v * betNuts + a * bluffFreq;
  // when checked to, the pot resolves by hand strength: defender's bluff-catcher beats air
  const checkedEV = v * (1 - betNuts) * 0 + a * (1 - bluffFreq) * pot;
  if (reachBet === 0) return checkedEV;
  const pNuts = (v * betNuts) / reachBet;
  const evCall = pNuts * -params.bet + (1 - pNuts) * (params.pot + params.bet);
  const facing = reachBet * Math.max(evCall, 0);
  return facing + checkedEV;
}

// Closed-form equilibrium, for display and for verifying the CFR output.
export function closedForm(params: RiverParams): { callFreq: number; bluffFreq: number } {
  const { pot, bet, valueFrac: v } = params;
  return {
    callFreq: pot / (pot + bet),
    bluffFreq: (v * bet) / ((1 - v) * (pot + bet)),
  };
}
