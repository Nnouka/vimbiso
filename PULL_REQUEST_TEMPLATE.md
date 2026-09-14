## Story ID(s)

<!-- e.g. TRI-2, or "docs" / "chore" if this isn't tied to a backlog story -->

## Summary

<!-- What does this PR do, in a sentence or two? -->

## How this was tested

<!-- npm run typecheck / npm test output, manual steps taken, what you couldn't
     verify in this environment (e.g. no live Twilio account, no Postgres) and
     why. Be specific — "tested locally" isn't enough. -->

## Interface / contract changes

<!-- Did you change a function signature, env var name, or data shape another
     role's code depends on? Say so explicitly here, even if it's additive/
     non-breaking — this is exactly the kind of thing Sprint 1 caught (the
     sendList 4th param, the TWILIO_WHATSAPP_FROM naming) by flagging it loudly
     instead of letting a reviewer discover it by accident. Write "None" if
     there aren't any. -->

## Checklist

- [ ] `npm run typecheck` passes (and in `dashboard/` too, if dashboard files changed)
- [ ] `npm test` passes
- [ ] Matches the acceptance criteria for the story ID(s) above, per `docs/backlog.md`
- [ ] No raw perpetrator text, legal name, or other content this project promises never to store has been introduced (relevant to almost every PR touching `server/lib/` or migrations — see SEC-1/SEC-2 in the backlog)
- [ ] Any interface/contract change is called out above, not left for the reviewer to discover
