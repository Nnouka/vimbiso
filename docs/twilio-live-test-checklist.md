# Live Twilio Sandbox Test Checklist

Owner: whoever's driving the Sandbox (Nnouka, right now). Purpose: turn your live
testing session into exactly the evidence still missing from `docs/backlog.md` —
everything Sprint 3 could prove with a real database but couldn't prove with a real
network. Follow in order; each step says what to do, what "correct" looks like
(pulled from the real seeded copy, so you can compare verbatim), and what to
report back so I can update the backlog and unblock SUB-1's video honestly.

Prerequisite: your `.env` has real `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/
`TWILIO_WHATSAPP_FROM`/`TWILIO_SMS_FROM`/`ONCALL_COUNSELLOR_PHONE`/`DATABASE_URL`,
migrations + seeds have been run locally (`npm run migrate && npm run seed`), and
`npm run dev` + `ngrok http 3000` are up with the ngrok URL pasted into the Twilio
Sandbox webhook config (`docs/twilio-setup.md` has the exact steps if you need them).

---

## 1. INF-1 — the basic round-trip (closes INF-1's DoD)

Join the Sandbox from your own WhatsApp with its join code, send any message.

**Report back:** did `POST /webhook/whatsapp` receive it and reply within 5 seconds? Any error in the `npm run dev` terminal?

## 2. Language selection + INF-3's 24h reset (closes INF-3 fully — the one half Sprint 3 couldn't test)

Pick English. Send a few more messages to reach the main menu. Then — this is the part that needed real elapsed time — either wait out a real 24h gap, or temporarily backdate `conversation_state.updated_at` for your number directly in Postgres to simulate it, then send a message.

**Report back:** did it correctly re-prompt language selection after the stale gap? Which method did you use (real wait vs. backdated row)?

## 3. HIGH-risk journey, English (re-confirms HR-1 live, closes HR-2/HR-4 live — the two biggest open items)

Tap "Report something that happened." Answer **Yes** to the first question (strangulation), **No** to the rest. Compare what arrives, in order, against this verbatim text:

> "What you've told me suggests you could be in serious danger right now. Here's what to do, in order:"
> 1. Pack a small bag now...
> 2. Think of one neighbor...
> 3. Memorize one phone number...
> 4. Keep your phone charged...
>
> "If you can, call this number now — it's free and available: [a real number]"
> "Would you like me to connect you to a counsellor right now?"

Tap **Yes**.

**Report back — this is the important one:**
- Did all 4 parts arrive within 5 seconds, in order?
- Did the on-call counsellor phone (`ONCALL_COUNSELLOR_PHONE`) actually receive a real SMS? What did the body say, word for word? (It should contain only a report ID, risk level, and timestamp — flag me immediately if it contains anything else, that would be a real privacy bug.)
- How long did the SMS take to arrive?

This single step, if it works, closes HR-2 for real — the one story whose DoD explicitly required a live send.

## 4. Trusted contact, before and after (closes HR-3/HR-4 live)

On a fresh number (or after resetting your test number's state), tap "Set up a trusted contact" first, submit a second real WhatsApp number you control. Then run step 3's HIGH-risk journey again from that same survivor number.

**Report back:** did the trusted contact's phone receive, verbatim and untranslated, exactly: *"Thinking of you — call me when you can."*? Anything else in that message?

## 5. Standard-risk + directory (re-confirms DIR-2 live; feeds DIR-1's spot-check)

All 8 answers **No**. Confirm the region picker appears automatically, pick Nairobi. Note the exact resource name/phone/source shown.

**Report back:** does the phone number shown actually work if you call it? (This is DIR-1's still-open spot-check — see §6.)

## 6. DIR-1 spot-check (closes DIR-1's one remaining item — needs your real internet/phone access, which I don't have)

For each of the 4 seeded resources (`server/seeds/resources_kenya.ts`), actually visit the `source_url` and, if safe/appropriate, call the number.

**Report back, per entry:** is the number correct and reachable? Is the `source_url` still live and does it corroborate the name/phone shown? Flag any that are wrong so I can fix or pull the entry before the demo.

## 7. Swahili pass (re-confirms what Sprint 3 already proved, now live)

Repeat step 3 but pick Kiswahili at language selection.

**Report back:** did the safety-plan sequence (`highrisk.*` keys) come through in real Swahili? Does it read naturally to a Swahili speaker, or does anything sound off? (This isn't the formal reviewer sign-off LANG-3 still needs — that's a fluent-speaker judgment call for whoever reviews it — but a live sanity check is still useful data.)

## 8. French pass (closes the one gap `docs/qa-script.md` explicitly flagged as untested)

Repeat step 3, picking Français. This is the journey Sprint 3 couldn't run at all (no French driven this sprint, by name, in the QA report).

**Report back:** same questions as step 7, plus: does it work end-to-end at all, or does anything error?

---

## What I'll do with your reports

Each "report back" above maps to one or more backlog stories currently held open specifically because they needed a live send: HR-2, HR-4, INF-1, INF-3, DIR-1's spot-check, and QA-2's French gap. Send me results for whichever steps you get through — I'll update `docs/backlog.md`'s checkboxes and Status notes against your real evidence (same discipline as Sprint 3: I'll flip a box only for what you actually confirm, not what "should" work), and step 3 succeeding is what unblocks SUB-1's actual video recording per its DoD.
