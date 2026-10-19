# ALLIN upload

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
heartbeat, start/resume seat recovery, a legal action, and clean match exit
under the published resource limits. Platform validation remains the final
check of compatibility with its actual executor and seccomp profile.

Strategy evidence and limits: [CHIPZEN-VALIDATION.md](CHIPZEN-VALIDATION.md).
