# Chipzen SDK source pin

`chipzen-ai-bot-0.3.1.tgz` is the official JavaScript SDK built, without source
changes, from https://github.com/chipzen-ai/chipzen-sdk at commit
`dae54ce7d44e468a2e14a2687912608da33493af` (package `packages/javascript`).

The npm registry returned 0.3.0 when this integration was built. That version
does not call `onReconnected`; the pinned upstream source does. Keeping the
small npm archive here makes `npm ci` reproducible without an adjacent checkout
or a GitHub authentication requirement. The npm lockfile verifies its integrity.
Apache-2.0 license and upstream NOTICE are included alongside the archive.

To reproduce from the pinned checkout, inside `packages/javascript`:

```sh
npm install --ignore-scripts
npm run build
npm pack --ignore-scripts
```

Build-tool versions also affect archive bytes; the checked-in archive and
package-lock integrity are the deployment pin. Update only after protocol,
reconnect, typecheck and local-game checks pass.
