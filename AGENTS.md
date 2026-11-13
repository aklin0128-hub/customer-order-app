<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Production deploy rules (read before any deploy)

These rules exist because production regressions kept happening when agents
deployed incomplete branches and wiped earlier fixes.

## Single source of truth

- **Production branch:** `cursor/deploy-product-sheet-0823`
- **Do not** deploy production from `main` or from a fresh feature branch based only on `main`.
- `main` is often behind production. Pulling `main` is not enough.

## Before any `vercel --prod`

1. `git fetch origin`
2. Start from `origin/cursor/deploy-product-sheet-0823` (checkout + pull that branch).
3. Merge or cherry-pick the finished feature into that deploy branch.
4. Confirm the deploy branch still contains known production fixes (examples):
  - Catalog Edit is a **pencil icon**, not the text “Edit”
  - Catalog Order defaults to **Show available items only**
  - `/new` hides list prices and has **no** footer Promotions button
  - `/comp` password login works
  - Shared cart is **per-device contributions summed** (A rice+noodle, B rice+wine → rice×2 noodle×1 wine×1); deletions use tombstones
5. Only then run `vercel deploy --prod` from the deploy branch.
6. Deploy **only** when the user explicitly says `deploy`.

## Preventing lost commits

- Every intentional UI/behavior change must be **committed and pushed** to git.
  Dirty Vercel uploads (`gitDirty`) are forbidden for production.
- Feature work: branch from the deploy branch (or merge into it before deploy).
- Never “restore an old commit” to production unless that commit is an ancestor of
  the current deploy branch or you have re-applied every later production fix.
- `git pull` syncs code; it does **not** deploy. Deploy is a separate, explicit step.
