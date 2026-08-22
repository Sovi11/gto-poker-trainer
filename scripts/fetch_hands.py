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

import math

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
MAX_HANDS = 900
MAX_PLURIBUS = 120
MAX_ONLINE = 760
# How many .phhs archives to sample per site/stake folder. Each holds ~1000
# hands, and there are 21,782 of them — sampling keeps the build tractable.
FILES_PER_FOLDER = 8

def money(x: float) -> float:
    """Money is rounded once, to cents, everywhere it is written out."""
    return round(x + 0.0, 2)


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
    """A single-hand .phh file -> a replay-ready hand."""
    return convert_table(tomllib.loads(raw), path)


def convert_table(data: dict, path: str) -> dict | None:
    """One parsed PHH table -> a replay-ready hand, or None if unusable."""
    if data.get("variant") != "NT":  # no-limit hold'em only
        return None

    stacks = [float(s) for s in (data.get("starting_stacks") or [])]
    # Some archived hands record an unknown stack as infinity. Without a real
    # stack there is no all-in to cap against, so the hand is not replayable.
    if not all(math.isfinite(x) and x > 0 for x in stacks):
        return None
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
                              "amount": money(owed), "to": money(committed[i]), "street": street})
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
                          "amount": money(added), "to": money(committed[i]), "street": street})
        elif verb == "sm":
            cards = CARD_RE.findall(parts[2]) if len(parts) > 2 else []
            if len(cards) == 2:
                hole[i] = cards
            steps.append({"t": "show", "p": i, "cards": cards})

    # Recompute from the emitted steps so the stored pot matches what the app
    # will derive when it replays them. Rounding must not drift between the two.
    sim_bets = [money(b) for b in blinds[:n]]
    sim_contrib = [money(sim_bets[i] + antes[i]) for i in range(n)]
    sim_stacks = [money(stacks[i] - sim_contrib[i]) for i in range(n)]
    for st in steps:
        if st["t"] == "board":
            sim_bets = [0.0] * n
        elif st["t"] == "act" and st["a"] in ("call", "bet", "raise"):
            i = st["p"]
            added = min(st["to"] - sim_bets[i], sim_stacks[i])
            sim_bets[i] = money(sim_bets[i] + added)
            sim_contrib[i] = money(sim_contrib[i] + added)
            sim_stacks[i] = money(sim_stacks[i] - added)
    contributed = sim_contrib
    ranked = sorted(contributed, reverse=True)
    uncalled = max(0.0, ranked[0] - ranked[1]) if len(ranked) > 1 else 0.0
    pot = money(sum(contributed) - uncalled)
    pot_bb = pot / big_blind
    saw_flop = len(board) >= 3
    known = [i for i in range(n) if hole[i]]

    # A hand is worth studying if there was a real decision in it: either it
    # went postflop, or somebody three-bet / shipped it preflop.
    if len(known) < 2:
        return None  # you need your own cards and someone to reveal against
    if not saw_flop and aggressive < 2 and not all_in:
        return None
    if pot_bb < 15:
        return None
    # Somebody has to have had a real decision, not just a min-raise walk.
    if saw_flop and postflop_actions < 2:
        return None

    # Rank by how much there is to think about.
    score = pot_bb + postflop_actions * 6 + len(board) * 4 + (25 if all_in else 0)

    return {
        "id": path.replace(".phh", "").replace("/", "-"),
        "event": data.get("event") or "",
        "year": data.get("year"),
        "currency": data.get("currency") or "",
        "symbol": data.get("currency_symbol") or ("$" if data.get("currency") == "USD" else ""),
        "players": players,
        "stacks": [money(s) for s in stacks],
        "blinds": [money(b) for b in blinds[:n]],
        "antes": [money(a) for a in antes[:n]],
        "bb": money(big_blind),
        "hole": hole,
        "board": board,
        "steps": steps,
        "pot": money(pot),
        "potBB": round(pot_bb, 1),
        "score": round(score, 1),
        "source": f"https://github.com/{REPO}/blob/main/{path}",
    }


VENUES = {
    "ABS": "Absolute Poker",
    "FTP": "Full Tilt Poker",
    "IPN": "iPoker Network",
    "ONG": "Ongame Network",
    "PS": "PokerStars",
    "PTY": "PartyPoker",
}


def describe_folder(folder: str) -> tuple[str, str]:
    """'PS-2009-07-01_2009-07-23_1000NLH_OBFU' -> ('PokerStars', '$1000 NL')."""
    site = VENUES.get(folder.split("-")[0], folder.split("-")[0])
    stake = ""
    for part in folder.split("_"):
        if part.endswith("NLH"):
            stake = f"${part[:-3]} NL"
    return site, stake


def convert_online(raw: str, path: str) -> list[dict]:
    """A .phhs archive holds ~1000 hands as TOML tables. Convert them all."""
    folder = path.split("/")[2] if path.count("/") > 2 else ""
    site, stake = describe_folder(folder)
    out: list[dict] = []
    for key, body in tomllib.loads(raw).items():
        if not isinstance(body, dict):
            continue
        hand = convert_table(body, f"{path}#{key}")
        if not hand:
            continue
        # Player names in this archive are irreversible hashes, so there is no
        # identity to show. Say so rather than printing a meaningless string.
        hand["players"] = [f"Seat {chr(65 + i)}" for i in range(len(hand["players"]))]
        hand["anon"] = True
        hand["event"] = f"{site} · {stake}".strip(" ·")
        hand["venue"] = site
        winnings = body.get("winnings") or []
        hand["winners"] = [i for i, w in enumerate(winnings) if isinstance(w, (int, float)) and w > 0]
        out.append(hand)
    return out


def extracted_root() -> Path:
    """Unpack the dataset once; every later run reads from disk."""
    root = CACHE.parent / "phh-dataset-main"
    if not root.exists():
        with tarfile.open(fileobj=io.BytesIO(download()), mode="r:gz") as tar:
            tar.extractall(CACHE.parent)
    return root


def main() -> None:
    root = extracted_root()
    data = root / "data"
    famous: list[dict] = []
    wsop: list[dict] = []
    pluribus: list[dict] = []
    online: list[dict] = []

    def read(path: Path) -> str:
        return path.read_text(encoding="utf-8", errors="replace")

    def rel(path: Path) -> str:
        return path.relative_to(root).as_posix()

    # Single-hand files: the famous televised pots, the WSOP event, Pluribus.
    for f in sorted(data.rglob("*.phh")):
        if "alice-carol" in f.name:
            continue
        try:
            hand = convert(read(f), rel(f))
        except Exception as exc:
            print(f"  skip {f.name}: {exc}", file=sys.stderr)
            continue
        if not hand:
            continue
        path = rel(f)
        if "pluribus" in path:
            hand["group"] = "pluribus"
            pluribus.append(hand)
        elif "wsop" in path:
            hand["group"] = "wsop"
            wsop.append(hand)
        else:
            hand["group"] = "famous"
            famous.append(hand)

    # Multi-hand archives: real money games played by real people. Sample a few
    # files from every site/stake folder so the mix stays varied.
    handhq = data / "handhq"
    folders = sorted([d for d in handhq.iterdir() if d.is_dir()]) if handhq.exists() else []
    for folder in folders:
        files = sorted(folder.rglob("*.phhs"))[:FILES_PER_FOLDER]
        for f in files:
            try:
                hands = convert_online(read(f), rel(f))
            except Exception as exc:
                print(f"  skip {f.name}: {exc}", file=sys.stderr)
                continue
            for hand in hands:
                # Only keep hands where enough cards came face up to make a
                # reveal worth watching.
                if sum(1 for h in hand["hole"] if h) < 2:
                    continue
                hand["group"] = "online"
                online.append(hand)
        print(f"  {folder.name}: {len(online)} kept so far", file=sys.stderr)

    for bucket in (famous, wsop, pluribus, online):
        bucket.sort(key=lambda h: -h["score"])

    hands = famous + wsop + online[:MAX_ONLINE] + pluribus[:MAX_PLURIBUS]
    hands = hands[:MAX_HANDS]
    for h in hands:
        h.pop("score", None)

    OUT.write_text(json.dumps(hands, separators=(",", ":")), encoding="utf-8")
    print(
        f"famous={len(famous)} wsop={len(wsop)} online={len(online)} "
        f"pluribus={len(pluribus)} -> shipped {len(hands)} hands, "
        f"{OUT.stat().st_size / 1024:.0f}KB",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
