# ALLIN upload

## Uploaded October 19, 2026

The verified archive was uploaded as [ALLIN-Hybrid](https://chipzen.ai/bots/ff5f2c3e-7b0c-4ab8-96b1-9fe84ee38f9f).
Chipzen initially reported `REVIEWING`; creation and upload succeeded. This
is separate from the existing External API bot `ALLIN`. The uploaded bot
was not yet present in the Season 11 selector while its review was pending.
No season entry was submitted.

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
