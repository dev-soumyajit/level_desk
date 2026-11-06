# Vercel deployment

The project uses npm, `package-lock.json`, and Node.js 22.x. Commit the repaired lockfile and the deletion of the stale `bun.lock` together.

`vercel.json` sets:

- Framework: Next.js
- Install: `node scripts/check-lockfile.mjs && npm ci`
- Build: `npm run build`

The lockfile check runs before installation and before a production build. It rejects missing package versions, package URLs, integrity hashes, unresolved dependency entries, or a manifest/lock mismatch.

## Deploy the fix

1. Commit and push `package.json`, `package-lock.json`, `vercel.json`, `scripts/check-lockfile.mjs`, this guide and the README. Include the deletion of `bun.lock`.
2. Deploy the new commit from the project root. The failed commit `53d1eeb` still contains the old dependency data; redeploying that same commit will not pick up local changes.
3. In Vercel, redeploy without the existing build cache. Use the repository's install/build commands and Node 22.x runtime. No API keys are needed for this app.

## What was fixed

The old npm lock contained 61 native optional-dependency placeholder records without a `version`. The existing local Windows installation allowed a local build, while a fresh deployment had incomplete native dependency metadata. The corrected lock now records the complete cross-platform dependency graph, including Linux bindings for Next/SWC, Tailwind/Oxide, Lightning CSS, Sharp and Canvas, along with resolved URLs and package integrity hashes.

The stale Bun lock predated the shadcn dependencies. It was removed so there is one authoritative package-manager lock.

The npm `Unknown env config "cache-dir"` line in the supplied log is a warning. It is separate from the fatal dependency-install error.

## Verification

- The old malformed lock fails the new validation; the repaired lock passes for all 145 package records.
- npm normalizes the repaired lock in an isolated directory without introducing versionless entries.
- An isolated `npm ci --dry-run --os=linux --cpu=x64 --libc=glibc --offline --ignore-scripts` resolves the intended Linux native packages successfully.
- The production build is checked on the existing Windows installation.
- Full registry downloads and a hosted Vercel build still require the new commit to be pushed and deployed. The Linux check above is dependency planning, not execution in a Linux container.

From a fresh checkout with Node 22:

```powershell
npm.cmd ci
npm.cmd run check:lock
npm.cmd run build
```

References: [Vercel package-manager selection](https://vercel.com/docs/package-managers), [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).
