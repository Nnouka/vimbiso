# Contributing to Vimbiso — branching, PRs, and review

This is a small team on a 10-day clock, so the workflow below is deliberately light — but `main` is never pushed to directly, and no code merges without someone other than its author looking at it first. Given the subject matter (a safety-critical tool handling sensitive reports), that rule is not optional, even under deadline pressure.

## Branches

- `main` is protected: always deployable, always passing typecheck + tests. Nobody pushes to it directly — everything arrives via a reviewed PR.
- Feature branches are cut from `main`, named `area/STORY-ID-short-description`, e.g. `backend/TRI-2-risk-scoring`, `networking/INF-1-whatsapp-webhook`, `frontend/DASH-1-dashboard-auth`, `qa/riskscoring-tests`, `docs/sprint-2-plan`. The story ID ties every branch back to `docs/backlog.md` — if a change doesn't map to a story ID, give it a short descriptive slug instead (`chore/...`, `fix/...`) rather than inventing one.
- Keep branches small and short-lived. One story (or one clearly-scoped slice of a larger story) per branch/PR — a PR that bundles three unrelated stories is much harder to review properly, and review quality is the whole point of this process.

## Commits

- Reference the story ID in the commit subject where relevant: `TRI-2: implement scoreRisk override + threshold rules`.
- Keep commits reasonably atomic. Squash-merge is fine at PR-merge time if the branch's history is messy — the PR description is what matters for the record, not a pristine commit log.

## Opening a pull request

Every PR must:

1. Target `main`.
2. Use the PR template (`.github/PULL_REQUEST_TEMPLATE.md`) — it asks for the story ID(s), a summary, how it was tested, and an explicit checklist.
3. Pass CI before review starts in earnest: `npm run typecheck` and `npm test` (root), plus the same two in `dashboard/` if dashboard files changed. A PR that doesn't typecheck or doesn't pass tests is not ready for review — fix that first, don't ask a reviewer to review broken code.
4. Stay within its owner's usual file areas where possible (see `docs/sprint-1-plan.md` §4's file-ownership map, which still holds as the default area split for Sprint 2+). Touching a file outside your usual area isn't forbidden — sometimes it's necessary — but call it out explicitly in the PR description so the reviewer knows to look closer there.
5. If the PR fully satisfies a user story's Definition of Done in `docs/backlog.md` (Section 5) — including any live/manual verification that story's DoD calls for, not just "the code exists" — flip that story's box from `- [ ]` to `- [x]` and update its one-line `Status:` note in the same PR. If the PR only makes partial progress (code done, live verification still pending; one AC out of several met; etc.), leave the box unchecked but rewrite the `Status:` note to say exactly what's true now. Never tick a story from a docs-only commit that isn't the PR that actually finished it — the reviewer checks this against the story's real AC/DoD, the same way they check everything else.

## Who reviews what

Every PR needs **at least one approval from someone who did not write it**, and that someone should generally be a different reviewer than the PR's author's own area — the point is a second, independently-thinking set of eyes, not a rubber stamp from whoever wrote adjacent code:

| Area | Author (usual) | Primary reviewer | Why this pairing |
|---|---|---|---|
| Backend (`server/lib/*`, `server/index.ts`, `server/migrations/*`, `server/seeds/*`) | Backend dev | **Networking** | Networking already owns and deeply understands the interface contract (`whatsapp.ts`/`sms.ts`) Backend's code calls into — best placed to catch integration mismatches. |
| Networking (`server/lib/whatsapp.ts`, `server/lib/sms.ts`, `server/routes/webhook.ts`) | Networking | **Backend** | Symmetric to the above — Backend is the primary consumer of this interface and will notice a breaking change fastest. |
| Frontend / dashboard (`dashboard/**`) | Frontend dev | **QA** for functional correctness; **Designer** for copy/UX/tone consistency with `docs/conversation-design.md` | Splits "does it work" from "does it read right" rather than asking one person to judge both. |
| Tests (`server/__tests__/**`, `playwright.config.ts`) | QA | **Whoever owns the code under test** (Backend or Networking) | The code owner is best placed to confirm a test reflects real intended behavior, not just QA's own assumption about it — this is exactly the check that caught the Sprint 1 `sendList` and env-var discrepancies. |
| Docs / process (`docs/**`, `CONTRIBUTING.md`, backlog updates) | PM (or whoever's writing) | **Any one other role** | Lighter weight since it's not runtime code, but still needs a second reader before it's treated as team-agreed. |

If the "usual" reviewer is also the PR's co-author on a cross-area change, route it to the next-closest role rather than skipping review.

`.github/CODEOWNERS` encodes this same mapping so GitHub can request the right reviewer automatically — **replace the placeholder handles in that file with real GitHub usernames** once the team's actual accounts are known; it does nothing useful with placeholders left in place.

## What a reviewer actually checks

Not a style nitpick pass — specifically:

- Does the code match its story's acceptance criteria in `docs/backlog.md`, not just "does it run"?
- If the PR claims to close out a story (flips its `[ ]` to `[x]`), is that actually true against the full DoD — including any live/manual verification the story calls for — not just against what the diff happens to touch? An unearned `[x]` is worse than leaving it `[ ]`, since the whole point of the checkbox is that the team can trust it at a glance.
- For anything touching `SEC-*` or the risk-triage/scoring logic: is a genuine safety/privacy property preserved (no raw perpetrator text persisted, no name field reintroduced, scoring rules match Section 3 exactly)? This category gets the most scrutiny, deliberately.
- Are interface contracts honored (function signatures other roles depend on), and if one had to change, is it flagged loudly in the PR description the way Sprint 1's `sendList` and env-var deviations were — not silently absorbed?
- Do tests exist and actually assert the behavior claimed, not just "a test file was touched"?

## Merging

- Squash-merge once approved and CI is green. Delete the branch after merge.
- The author merges their own PR after approval (no separate "merge team") — the approval is the gate, not a second manual step.
- If a review raises a real concern, resolve it with a follow-up commit and re-request review — don't merge over an unresolved comment.
