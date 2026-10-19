# Frozen comparison policy

`baseline.mjs` is an intentional, non-minified bundle of the arena policy at
the start of the October 18 model-training session. It uses the existing
trainer's Chen ranking, approximate short-stack charts, original range update
rules and river CFR. It includes the legal-action and reconnect repairs made
before model training, so those fixes cannot create a misleading model gain.

Generated with the repository's existing esbuild:

```sh
esbuild src/arena/bot.ts --bundle --platform=node --format=esm --packages=external --outfile=artifacts/baseline-bot.mjs
```

The checkpoint is retained as source text to make head-to-head and elimination
benchmarks runnable from a clean clone. It imports the pinned official SDK but
contains no credentials, learned-model data, UI components or network runner.
Do not regenerate it from a newer candidate when measuring improvements.
