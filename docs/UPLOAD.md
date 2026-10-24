# ALLIN upload

## Uploaded October 19, 2026

The verified archive was uploaded as [ALLIN-Hybrid](https://chipzen.ai/bots/ff5f2c3e-7b0c-4ab8-96b1-9fe84ee38f9f).
Chipzen completed review and reports **ACTIVE**. This is separate from the
existing External API bot `ALLIN`. The user completed the final Season 11
entry action; the season page now confirms **ALLIN-Hybrid is entered**.
Fixtures are published when registration closes on October 19 at 23:59 UTC
(October 20 at 05:29 IST).

An unrated heads-up challenge from ALLIN-Hybrid to BonnieBlue was sent on
October 19. The challenges page initially reports `pending`, awaiting the
opponent's acceptance. This is separate from the season fixtures.

Six additional unrated house-bot matches were dispatched on October 19,
all confirmed `running` on the challenges page:

| Opponent | Match |
|---|---|
| PluriBot | `002176f2-e4c3-488f-aa29-3baaf371ba04` |
| pebble | `40970d1d-7630-4c77-a359-8807bbd3f26e` |
| fledge | `e3c62f39-a08a-4077-8da0-63b3ff3e119e` |
| 5ur9e | `08581c5b-359f-46be-9995-c8a728acc61d` |
| mochi | `52d56292-82d1-4b83-8117-57b9a0db6108` |
| patches | `0a2ac020-4e8b-429d-9d40-4709b137fa30` |

Archive SHA256: `3963b2b3b5eef9c5b463b1cfdb8d56e2f5dfd8c86e4dc416aac8f04c9e0ef984`.
Image source: `f323cb62597d1b879ac97c4f4c86fbf9f58a9fe1`.

## Build and upload procedure

The upload artifact is **allin-chipzen-linux-amd64.tar.gz**, a gzipped Docker
save archive, not a source ZIP. The GitHub `ALLIN upload image` workflow builds
it from the `chipzen-arena` branch and includes `SHA256SUMS.txt`, image metadata,
and the exact source commit. Download the `allin-chipzen-upload` artifact from
the successful workflow run and extract the outer GitHub ZIP first.

On Chipzen, create an **uploaded/container bot**, select this `.tar.gz`, and
wait for platform validation. The existing ALLIN External API bot remains a
separate bot. Its external token is not needed for the upload. The platform
injects match credentials when launching the container.

Local Docker build and verification on Linux:

```sh
npm ci
docker build --platform linux/amd64 -f Dockerfile.arena -t allin:upload .
node scripts/arena-image-smoke.mjs allin:upload
docker save allin:upload | gzip -9 > allin-chipzen-linux-amd64.tar.gz
sha256sum allin-chipzen-linux-amd64.tar.gz
```

The image compiles the runner, strategy, model tables and SDK into a Bun Linux
executable. Only that executable, runtime libraries and license notices enter
the runtime image. No `.env`, external bot token, source tree, web app or
training datasets are shipped. Compilation reduces casual source inspection;
it does not make reverse engineering impossible.

The workflow rejects an image above 200,000,000 bytes or an archive above
250,000,000 bytes. Its smoke test exercises both token and ticket authentication,
heartbeat, start/resume seat recovery, legal decisions on all four streets
within the 2-second budget, and clean match exit
under the published resource limits. Platform validation remains the final
check of compatibility with its actual executor and seccomp profile.

Strategy evidence and limits: [CHIPZEN-VALIDATION.md](CHIPZEN-VALIDATION.md).

## Second hosted bot uploaded October 24, 2026

[ALLIN-v2](https://chipzen.ai/bots/c8a537d2-2746-44e1-ad8b-49bfed7b1aec)
was uploaded separately from ALLIN-Hybrid. Chipzen completed automatic review and reports **ACTIVE**, with rating 1500 and zero matches.
This is the tested river-safety revision, not a newly trained replacement model.

- Source: `7e8582d1e382cdda222a8b9d469533505cb53f5d`
- Successful image workflow: https://github.com/Sovi11/gto-poker-trainer/actions/runs/40029391478
- Archive SHA256: `a6e36e773fcc480c13889bed44232f5d002dafaa8e0fe81f9775ef5850fb76d6`
- Local archive: ignored `artifacts/release-v2/allin-chipzen-linux-amd64.tar.gz`

The open-tournament list contained three events when checked on October 24:

| Event | Entry status / compatibility |
|---|---|
| [Daily Upload bracket II](https://chipzen.ai/tournament/75bf4f69-078c-4369-a574-1ea2e7d5a0e4) | ALLIN-Hybrid already entered. Starts 21:30 IST. One bot per developer; existing entry preserved. |
| [Daily Remote bracket II](https://chipzen.ai/tournament/192adc71-1850-4e8e-9054-fb865eb466af) | Remote-only; the uploaded v2 bot is ineligible. Existing ALLIN needs an external runner kept online. No entry submitted. |
| [Daily 6-Max Sit & Go II](https://chipzen.ai/tournament/9ee3f0d9-cef1-4bde-8d9b-8c3c62ae87ed) | Multiplayer, with a $10 winner prize. Current strategy supports heads-up only. No entry submitted. |

The Scheduled filter showed no scheduled tournaments. No additional compatible
open event was available, and no recurring registration was configured.

