"""Build the Study hand library from the public PHH hand-history dataset.

Source: https://github.com/uoftcprg/phh-dataset (MIT) — real, recorded hands.
Nothing here is written by hand or paraphrased from an article.

    python scripts/fetch_hands.py        # -> src/data/handLibrary.json

What goes in:
  * the famous televised high-stakes pots at the dataset root (Dwan vs Ivey,
    Antonius vs Blom, ...), with the real players named;
  * the no-limit hold'em hands from the 2023 WSOP $50k Poker Players
    Championship (it is a mixed-game event, so most of it is other variants);
  * the Pluribus experiment — 10,000 six-max no-limit hands the superhuman bot
    played against elite professionals. Seats there are pseudonymous in the
    source data, and every hole card is known, which makes them ideal puzzles.

The PHH action grammar we use:
    d dh p<N> <cards>   deal hole cards ('????' when never revealed)
    d db <cards>        deal board cards
    p<N> cbr <amount>   bet/raise TO <amount> for this street
    p<N> cc             check or call
    p<N> f              fold
    p<N> sm <cards>     show at showdown
"""

from __future__ import annotations

import io
import json
import re
import sys
import tarfile
import tomllib
import urllib.request
from pathlib import Path

REPO = "uoftcprg/phh-dataset"
TARBALL = f"https://github.com/{REPO}/archive/refs/heads/main.tar.gz"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data" / "handLibrary.json"
CACHE = ROOT / ".hand-src" / "repo.tar.gz"

# How many hands to ship. The whole Pluribus set is 10k; the app only needs a
# strong, varied selection, and every hand is precached for offline use.
MAX_HANDS = 240
MAX_PLURIBUS = 200

CARD_RE = re.compile(r"[2-9TJQKA][cdhs]")
STREETS = {3: "flop", 4: "turn", 5: "river"}


def download() -> bytes:
    if CACHE.exists():
        return CACHE.read_bytes()
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    print("downloading dataset…", file=sys.stderr)
    with urllib.request.urlopen(TARBALL) as r:
        blob = r.read()
    CACHE.write_bytes(blob)
    return blob


def convert(raw: str, path: str) -> dict | None:
    """PHH text -> a replay-ready hand, or None if unusable."""
    data = tomllib.loads(raw)
    if data.get("variant") != "NT":  # no-limit hold'em only
        return None

    stacks = [float(s) for s in (data.get("starting_stacks") or [])]
    n = len(stacks)
    players = data.get("players") or []
    if n < 2 or len(players) != n:
        return None

    blinds = [float(b) for b in (data.get("blinds_or_straddles") or [])]
    blinds += [0.0] * (n - len(blinds))
    antes = [float(a) for a in (data.get("antes") or [])]
    antes += [0.0] * (n - len(antes))
    big_blind = max(blinds[:n]) if n else 0
    if big_blind <= 0:
        return None

    hole: list[list[str] | None] = [None] * n
    steps: list[dict] = []
    committed = blinds[:n].copy()
    contributed = [committed[i] + antes[i] for i in range(n)]
    current_bet = max(committed) if committed else 0.0
    folded = [False] * n
    board: list[str] = []
    street = "preflop"
    postflop_actions = 0
    aggressive = 0
    all_in = False

    for action in data.get("actions", []):
        parts = action.split()
        if not parts:
            continue

        if parts[0] == "d":
            if parts[1] == "dh":
                i = int(parts[2][1:]) - 1
                cards = CARD_RE.findall(parts[3]) if len(parts) > 3 else []
                if len(cards) == 2 and 0 <= i < n:
                    hole[i] = cards
            elif parts[1] == "db":
                cards = CARD_RE.findall(parts[2])
                board.extend(cards)
                street = STREETS.get(len(board), street)
                steps.append({"t": "board", "street": street, "cards": cards})
                committed = [0.0] * n
                current_bet = 0.0
            continue

        i = int(parts[0][1:]) - 1
        if not (0 <= i < n):
            continue
        verb = parts[1]
        if street != "preflop":
            postflop_actions += 1

        if verb == "f":
            folded[i] = True
            steps.append({"t": "act", "p": i, "a": "fold", "street": street})
        elif verb == "cc":
            owed = current_bet - committed[i]
            if owed <= 0:
                steps.append({"t": "act", "p": i, "a": "check", "street": street})
            else:
                owed = min(owed, stacks[i] - contributed[i])  # all-in for less
                committed[i] += owed
                contributed[i] += owed
                steps.append({"t": "act", "p": i, "a": "call",
                              "amount": round(owed), "to": round(committed[i]), "street": street})
        elif verb == "cbr":
            target = float(parts[2])
            # Nobody can wager more than they brought to the table.
            added = min(target - committed[i], stacks[i] - contributed[i])
            kind = "bet" if current_bet <= 0 else "raise"
            committed[i] += added
            contributed[i] += added
            current_bet = max(current_bet, committed[i])
            aggressive += 1
            if contributed[i] >= stacks[i] - 1e-9:
                all_in = True
            steps.append({"t": "act", "p": i, "a": kind,
                          "amount": round(added), "to": round(committed[i]), "street": street})
        elif verb == "sm":
            cards = CARD_RE.findall(parts[2]) if len(parts) > 2 else []
            if len(cards) == 2:
                hole[i] = cards
            steps.append({"t": "show", "p": i, "cards": cards})

    # An uncalled bet goes back to whoever made it, so it was never really in.
    ranked = sorted(contributed, reverse=True)
    uncalled = max(0.0, ranked[0] - ranked[1]) if len(ranked) > 1 else 0.0
    pot = sum(contributed) - uncalled
    pot_bb = pot / big_blind
    saw_flop = len(board) >= 3
    known = [i for i in range(n) if hole[i]]

    # A hand is worth studying if there was a real decision in it: either it
    # went postflop, or somebody three-bet / shipped it preflop.
    if not known:
        return None
    if not saw_flop and aggressive < 2 and not all_in:
        return None
    if pot_bb < 12:
        return None

    # Rank by how much there is to think about.
    score = pot_bb + postflop_actions * 6 + len(board) * 4 + (25 if all_in else 0)

    return {
        "id": path.replace(".phh", "").replace("/", "-"),
        "event": data.get("event") or "",
        "year": data.get("year"),
        "currency": data.get("currency") or "",
        "players": players,
        "stacks": [round(s) for s in stacks],
        "blinds": [round(b) for b in blinds[:n]],
        "antes": [round(a) for a in antes[:n]],
        "bb": round(big_blind),
        "hole": hole,
        "board": board,
        "steps": steps,
        "pot": round(pot),
        "potBB": round(pot_bb, 1),
        "score": round(score, 1),
        "source": f"https://github.com/{REPO}/blob/main/{path}",
    }


def main() -> None:
    blob = download()
    famous: list[dict] = []
    wsop: list[dict] = []
    pluribus: list[dict] = []

    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as tar:
        for member in tar:
            if not member.name.endswith(".phh"):
                continue
            rel = member.name.split("/", 1)[1] if "/" in member.name else member.name
            if "alice-carol" in rel:  # a format example, not a real hand
                continue
            f = tar.extractfile(member)
            if f is None:
                continue
            try:
                hand = convert(f.read().decode("utf-8"), rel)
            except Exception as exc:
                print(f"  skip {rel}: {exc}", file=sys.stderr)
                continue
            if not hand:
                continue
            if "pluribus" in rel:
                hand["group"] = "pluribus"
                pluribus.append(hand)
            elif "wsop" in rel:
                hand["group"] = "wsop"
                wsop.append(hand)
            else:
                hand["group"] = "famous"
                famous.append(hand)

    pluribus.sort(key=lambda h: -h["score"])
    wsop.sort(key=lambda h: -h["score"])
    famous.sort(key=lambda h: -h["score"])

    hands = famous + wsop + pluribus[:MAX_PLURIBUS]
    hands = hands[:MAX_HANDS]
    for h in hands:
        h.pop("score", None)

    OUT.write_text(json.dumps(hands, separators=(",", ":")), encoding="utf-8")
    size_kb = OUT.stat().st_size / 1024
    print(
        f"famous={len(famous)} wsop={len(wsop)} pluribus={len(pluribus)} "
        f"-> shipped {len(hands)} hands, {size_kb:.0f}KB",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
