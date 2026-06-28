# ♠ GTO Poker Trainer

Learn the math. Grind the bots. Print.

A single-page web app for learning **Game-Theory-Optimal (GTO) poker** and putting it
into practice against AI opponents — each with a distinct, exploitable personality.
Everything runs in the browser; no backend, no sign-up, no network calls.

## Features

### 📚 Learn — a structured GTO course
Four modules, ten lessons, with key-takeaway summaries and progress tracking:
- **Foundations** — what GTO actually means, equity / pot odds / EV.
- **Preflop** — position, opening (RFI) ranges by seat, short-stack Nash push/fold.
- **Postflop** — continuation betting & board texture, polarized vs merged ranges.
- **Exploitation** — reading player types, bankroll & tilt (the grind).

### 🧮 Solver
- **Hand vs Hand equity** — enter any two hands (A vs B) and an optional board. Exact
  enumeration when the runout is small, a 30k-hand Monte Carlo otherwise. Shows win / tie /
  equity and the made hand on the board.
- **Preflop range charts** — 6-max opening and response ranges on the classic 13×13 grid.
- **Push / Fold** — heads-up Nash jam/call ranges by effective stack depth.

### 🤖 Bots
Six opponents, each with a personality profile (tightness, aggression, bluffing, call-happiness,
tilt) and a documented leak to attack:

| Bot | Archetype | How to beat them |
|-----|-----------|------------------|
| 🪨 Rocky the Nit | TAG / Nit | Over-folds — bluff relentlessly. |
| 🔥 Mad Max | LAG / Maniac | Over-bluffs — tighten up, trap, call lighter. |
| 🚉 Callie Station | Calling Station | Never folds — value-bet thin, never bluff. |
| 🤖 GTO Greg | Balanced | Hard to exploit — small edges only. |
| 🦈 Sharon the Shark | Thinking Reg | Tight-aggressive — the toughest seat. |
| 🐟 Finn the Fish | Loose Passive | Calls too much — print money patiently. |

### 🃏 Play
Sit at a Texas Hold'em table against 1–5 bots of your choice. Full betting (blinds, raises,
all-ins, side pots, showdown), bet-sizing presets, a live hand log, and auto-rebuy so you can
grind uninterrupted.

## Getting started

```bash
npm install
npm run dev      # → http://localhost:5173
```

Build for production:

```bash
npm run build    # outputs to dist/
npm run preview  # serve the production build locally
```

## Tech

Vite · React 18 · TypeScript (strict). Hand-rolled CSS, no UI framework. The poker engine
(card encoding, 7-card evaluator, equity, range parsing, betting state machine, bot AI) is
pure TypeScript under `src/engine`, `src/gto`, `src/bots`, and `src/game` — UI-agnostic and
independently testable.

See [CLAUDE.md](CLAUDE.md) for architecture details and contribution conventions.

## Disclaimer

This is a **study tool**. The GTO ranges are solver-derived reference charts, not the output
of a live solver, and the bots approximate archetypes rather than true equilibrium play. Use it
to build intuition, then verify against a dedicated solver for serious work. Play responsibly.
