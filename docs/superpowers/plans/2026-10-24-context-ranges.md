# Contextual Range Candidate Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evaluate preflop position/raise-count range conditioning independently of the equity network, preserving the uploaded hybrid policy.

**Architecture:** Add an opt-in `contextualRanges` bot option. Pass it through every range reset. Compare the same hybrid policy with the option on/off using duplicate deals and independent seeds. No contextual-range promotion or platform deployment in this experiment; the separately proven river safety correction below is enabled only in new builds.

**Tech Stack:** TypeScript, Vitest, existing SDK/local harness.

**Spec:** `docs/POSTMORTEM-2026-10-20.md`, priority 1.

## Constraints and review focus

- No dependency or model-training changes; preserve default hybrid and experimental-network behavior.
- Context must survive deep/short-stack resets, implicit hand reset, and reconnect.
- Baseline must remain the uploaded hybrid, not the older original strategy.
- Keep credentials, hidden opponent cards, and generated bulk artifacts out of tracked files.
- Report negative and inconclusive results; fixed training seeds do not establish strength against the live field.

## Tasks

- [x] Add failing range-context and bot-reset tests; run and observe failures.
- [x] Add independent context flag in `src/arena/ranges.ts` and propagate in `src/arena/bot.ts`; pass focused tests.
- [x] Add explicit candidate/baseline options and provenance to paired comparison/field harnesses; run identical-policy control.
- [x] Run development comparison, independent confirmation and opponent-field checks; record outcomes and keep context disabled.
- [x] Run full tests, TypeScript, SDK conformance and build; request focused review; commit and push.

## Evidence-driven scope addition

While adding river boundary checks, both an exclusive royal-flush hand and
a guaranteed board-only chop folded with RNG draw zero, because finite-CFR
average strategies retain initial exploration mass. Add a separate opt-in
`riverSafety` guard which enumerates every legal opposing holding and only
overrides a fold if none can beat us. Test strong-but-beatable hands too.
Keep it independent from the range-context experiment. Include call price and
model call EV in decision diagnostics. After its targeted regressions and
1,800-hand non-regression comparison pass, enable only this mathematical
dominance guard in new builds. Comparison baselines must explicitly set
`riverSafety: false` to retain the uploaded-v1 reference. The context flag
remains experimental/off. The live uploaded binary is not updated.
