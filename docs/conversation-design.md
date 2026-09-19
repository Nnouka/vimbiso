# Vimbiso — Conversation Design Spec (Sprint 1, English)

Author: Designer · Status: LOCKED for Sprint 1 build · Last updated: 2026-09-11

This is the master copy + flow spec for everything a user experiences from first
contact through triage scoring, in English. English is the base language other
translations (LANG-3 Kiswahili, LANG-4 French, ...) key off later — do not
paraphrase or restructure this content when translating; translate it.

Canonical sources this doc implements against: `docs/backlog.md` Section 3
(triage questions & scoring — used verbatim) and Section 5 stories TRI-1, INF-3,
INF-4, SEC-3, INF-5. Where this doc and `backlog.md` ever disagree, `backlog.md`
wins.

This is content/flow design only. No code, no schema decisions beyond citing the
existing ones in `docs/data-model.md`.

---

## 0. Message-type legend and WhatsApp limits (read this first, Backend)

Three WhatsApp interactive message types are used in Sprint 1, per
`server/lib/whatsapp.js`'s contract:

| Type | Function | Hard limits |
|---|---|---|
| List Message | `sendList(to, body, sections)` | Section title ≤ 24 chars · Row title ≤ 24 chars · Row description ≤ 72 chars · List button text ≤ 20 chars |
| Quick Reply Buttons | `sendButtons(to, body, buttons)` | Up to 3 buttons · Button title ≤ 20 chars |
| Plain text | `sendText(to, body)` | No hard length limit (WhatsApp will not paginate a list/button label, but plain text wraps freely) |

Every character count below is called out explicitly next to the string it
constrains, so nobody has to recount by hand at implementation time.

---

## 1. First contact / language selector (INF-3)

**Trigger:** any inbound message from a WhatsApp number with no existing
`conversation_state` row, OR an existing row whose `updated_at` is more than 24h
old (session reset — re-run this exact step; see §1.1).

**Message type:** List Message (`sendList`). A List Message, not Quick Reply
buttons, because it's the only type that gives us a "Select Language" affordance
plus three rows without hunting for 20-character button labels for language
names — and it sets the pattern for the main menu below.

**Body text** (no length limit, keep it short and non-alarming — this may be
read by someone other than the survivor before she opens WhatsApp again):

> Welcome. This is Vimbiso, a private safety and support line. Please choose
> your language to continue.

**Footer** (optional small gray text under the body, ≤ 60 chars) — omit for
Sprint 1; not needed.

**List button text** ("Select Language" — 15 chars, ✅ under 20):

> Select Language

**Section title** ("Choose a language" — 18 chars, ✅ under 24):

> Choose a language

**Row titles** (language endonyms are not translated — they're proper nouns for
the language itself):

| Row title | Chars | Row id |
|---|---|---|
| `English` | 7 ✅ | `lang_en` |
| `Kiswahili` | 9 ✅ | `lang_sw` |
| `Français` | 8 ✅ | `lang_fr` |

No row descriptions needed — the title alone is unambiguous.

### 1.1 Session-reset behavior (important for Backend)

`conversation_state` is keyed one row per `whatsapp_number` (per
`docs/data-model.md`). On a 24h-inactivity reset, this exact List Message fires
again and `current_step`/`temp_answers` reset — but **`disclosure_shown` is not
reset**. The transit-privacy disclosure (§2) is a once-ever-per-number message,
not a once-per-24h-session message: re-prompting language on return contact
should not re-show the disclosure. This resolves the apparent tension between
SEC-3's "fires exactly once per conversation" and INF-3's 24h reset — treat
"conversation" as "this WhatsApp number," permanently, for this flag only.

---

## 2. Transit-privacy disclosure (SEC-3)

**Trigger:** immediately after a language selection is received, if and only if
`conversation_state.disclosure_shown` is not already `true` for this number.
Fires once, then set the flag `true` and never show it again to this number.

**Message type:** plain text (`sendText`). No buttons — this is read-only
information, and adding a "Continue" button here just delays the person one
more tap under stress.

**Exact copy** (content key `disclosure_message`):

> This chat runs over WhatsApp. We don't store your name, but WhatsApp and your
> phone provider can see that this conversation exists. If it's safer for you,
> consider deleting this chat afterward.

This is deliberately short — three sentences, plain language, no jargon, no
scare-capitals. It states all three required facts (runs over WhatsApp / no
name stored / provider can see it exists) and gives the one actionable
suggestion (delete afterward) without turning it into a lecture someone reads
once, under pressure, possibly with limited time on a shared or borrowed phone.

Immediately following this message, send the main menu (§3) — no pause, no
"tap to continue" gate.

---

## 3. Main menu (INF-4)

**Message type: List Message — recommended over Quick Reply buttons.**
Rationale (Backend, please build against this): the first menu option's exact
required text, *"Report something that happened,"* is 30 characters — it does
not fit inside WhatsApp's 20-character Quick Reply button title limit. A List
Message separates the full option text (unlimited, shown in the body) from a
short tappable row title (≤ 24 chars), so the exact backlog copy can still be
read in full while the tap target stays valid. This also leaves room to grow
the list in Sprint 2 without hitting the Quick-Reply 3-button hard ceiling.

**On INF-5's would-be 4th option:** do **not** add "Device safety help" as a
fourth visible row. INF-4 requires *exactly three* options, and a fourth,
clearly-labeled row sitting next to it undercuts the discretion INF-5 exists
to provide — a menu item that visibly says "help hiding this" is itself a
disclosure risk if anyone else is looking. Instead, surface INF-5 as a footer
hint on this same message (small gray text, not a tappable row) and keep it
trigger-activated by typed keyword, per backlog. See §4 for the exact hint
text and full guidance copy.

**Body text** (states all three options in full, exact backlog wording, plus a
one-line frame — no length limit here):

> What would you like to do?
>
> 1. Report something that happened
> 2. Find help near me
> 3. Know your rights

**Footer** (≤ 60 chars — carries the INF-5 hint, 44 chars, ✅):

> Tip: send 0 anytime for help keeping this private

**List button text** ("Choose an option" — 17 chars, ✅ under 20):

> Choose an option

**Section title** ("Main menu" — 9 chars, ✅ under 24):

> Main menu

**Row titles** (short tap targets; the full option text lives in the body
above and is what's stored under the `menu.*` content keys per INF-4's DoD):

| Row title | Chars | Row id | Routes to |
|---|---|---|---|
| `Report what happened` | 20 ✅ | `menu_report` | TRI-1 triage entry (§5) |
| `Find help near me` | 17 ✅ | `menu_find_help` | DIR-2 (Sprint 2 — Sprint 1 may stub, must not dead-end) |
| `Know your rights` | 16 ✅ | `menu_rights` | DIR-3 (Sprint 2 — Sprint 1 may stub, must not dead-end) |

The **exact full-sentence text** that fulfils INF-4's literal copy requirement
— *"Report something that happened" / "Find help near me" / "Know your
rights"* — is the body text above (menu.report / menu.find_help / menu.rights
keys), not the row titles. Row titles are a UI necessity, not new content.

---

## 4. Device-safety guidance (INF-5, Should — cut first if Day 3 is tight)

**Trigger:** the user sends the free-text message `0` or `help hiding this`
(case-insensitive) from the main menu, per backlog. This is a typed keyword
match on `body`, not a button tap — Networking's normalized inbound shape
(`{ from, body, buttonId, timestamp }`) already gives Backend `body` for this
exact purpose.

**Message type:** plain text (`sendText`).

**Exact copy** (content key `guidance.device_safety`):

> A few ways to keep this chat more private on this phone:
>
> 1. Save this contact under a name that won't stand out — a friend's name or
>    a business, not "Vimbiso" or anything that names what this is.
> 2. When you're done, open this chat, tap the contact name at the top, and
>    use WhatsApp's own "Clear Chat" (empties the messages) or "Archive"
>    (hides the chat from your main list). Either is built into WhatsApp —
>    you don't need to install anything.
> 3. Being honest with you: this is a real WhatsApp number, not a disguised
>    app. "Clear Chat" and "Archive" reduce what's visible, but someone who
>    unlocks your phone and looks in WhatsApp directly could still find this
>    conversation.

Copy uses "Clear Chat" and "Archive" as they currently appear in WhatsApp's own
UI (menu accessed via the contact/chat name at the top of a conversation) —
Backend/QA should re-check this against the live WhatsApp app version used for
the demo before recording, per INF-5's DoD, since WhatsApp does periodically
rename menu items.

After sending this, return the user to the main menu (§3) rather than leaving
them at a dead end.

---

## 5. The 8-question triage flow (TRI-1)

**Trigger:** the `menu_report` row is tapped. At this point Backend creates the
`reports` row with `status='IN_PROGRESS'` (per TRI-1 AC) before sending the
intro line below.

**Message type for every question:** Quick Reply buttons (`sendButtons`), 3
buttons, fixed labels reused for all 8 questions:

| Button label | Chars | Button id | Stored `triage_answers.answer` |
|---|---|---|---|
| `Yes` | 3 ✅ | `triage_yes` | `YES` |
| `No` | 2 ✅ | `triage_no` | `NO` |
| `Prefer not to say` | 17 ✅ | `triage_skip` | `SKIP` |

Reusing three generic button ids across all 8 questions (rather than
per-question ids) is the simpler wire-up: `conversation_state.current_step`
already tells Backend which `question_key` the tapped id applies to. Content
keys are still per-question (see §7 table) so each language can phrase its Yes
/ No / Skip identically or adjust for grammar without touching the state
machine.

### 5.1 Intro line (send once, before Question 1)

Yes — a one-line intro belongs here. Someone tapping "Report what happened"
has no idea yet that what follows is 8 yes/no taps, not an open text box where
they have to describe what happened. Telling them that up front, and that
skipping is fine, measurably lowers the chance someone abandons the flow
worried about what they're about to be asked to type out.

**Message type:** plain text, sent immediately before Question 1's button
message (not combined into one message — keep the reassurance readable before
the first question and buttons land).

**Exact copy** (content key `triage.intro`):

> I'm going to ask you 8 short questions. Just tap Yes, No, or Prefer not to
> say for each one — you won't need to type anything. You can choose "Prefer
> not to say" for any question you'd rather skip.

### 5.2 The 8 questions, in fixed order

Question text below is the exact backlog Section 3 wording — do not paraphrase.
Fixed order is scored positionally; it is also the order that must be asked.

**Question 1 — STRANGLE** (override key)
Content key `triage.strangle.question`:
> Has he ever choked, strangled, or tried to suffocate you?

**Question 2 — WEAPON** (override key)
Content key `triage.weapon.question`:
> Does he have a weapon, or has he threatened you with one?

**Question 3 — KILL_THREAT** (override key)
Content key `triage.kill_threat.question`:
> Has he said he would kill you, or someone close to you?

*(No transitional copy between Q1–Q3 — these three questions are the highest
signal and the fastest to answer; adding filler here only slows down someone
who may already know these answers instantly.)*

**Question 4 — ESCALATION** (threshold-counted)
Content key `triage.escalation.question`:
> Is the violence happening more often, or getting worse?

### 5.3 Midpoint reassurance (after Question 4's answer, before Question 5)

One short line, no button, purely to reduce anxiety about how much further
there is to go — this is the only other injected copy in the whole flow, kept
to a single sentence on purpose.

**Message type:** plain text, sent immediately before Question 5.

**Exact copy** (content key `triage.midpoint`):

> You're halfway there — 4 more questions.

**Question 5 — SEPARATION** (threshold-counted)
Content key `triage.separation.question`:
> Have you left, or tried to leave, recently — or talked about leaving?

**Question 6 — SEXUAL_COERCION** (threshold-counted)
Content key `triage.sexual_coercion.question`:
> Has he forced you into sex you didn't want?

**Question 7 — CONTROL** (threshold-counted)
Content key `triage.control.question`:
> Is he watching, following, or controlling where you go and who you talk to?

**Question 8 — SELF_PERCEIVED_DANGER** (threshold-counted)
Content key `triage.self_perceived_danger.question`:
> Do you feel that if nothing changes, you could be seriously hurt or killed?

No transitional copy after Question 8 — the answer to Question 8 immediately
triggers scoring (TRI-3) and one of the two outcome messages in §6. There is no
gap in which the user is left waiting.

---

## 6. Outcome messages

Scoring (`scoreRisk`, TRI-2) runs the instant Question 8's answer is stored.
Exactly one of the two messages below fires immediately after — same handling
cycle, no delay, no intermediate "calculating..." message.

**Sprint boundary, read carefully:** everything in this section is Sprint 1
scope. Both messages below are *bridge* copy only — they close out the triage
conversation and hand off to work that is explicitly out of Sprint 1's scope
(HR-1's full safety-plan sequence, DIR-2's region picker). Do not write HR-1's
danger-intro / safety-plan list / hotline number / counsellor-connect prompt
into this doc — that content belongs to HR-1 in Sprint 2 and depends on DIR-1
resource data that doesn't exist yet. Sprint 1's job is only to land the
report correctly scored in the DB (TRI-3's DoD) and say something true and
calm immediately after.

### 6.1 HIGH risk (content key `highrisk.bridge`)

**Message type:** plain text, sent immediately (this is the message TRI-3's
"YES to Q1 only auto-triggers the HIGH branch with no further input" DoD is
checking for — in Sprint 1, this text *is* the HIGH branch).

**Exact copy:**

> Thank you for trusting me with that. Based on what you've shared, what
> you're facing sounds serious, and I want to make sure you're not facing it
> alone. Stay with me for a moment — I'm about to share safety information
> and a real number you can call right now.

Tone check: this names the seriousness plainly ("sounds serious") without
escalating language ("emergency," "danger," repeated urgency), states an
immediate next action is coming so there's no dead air, and does not ask the
user to do anything yet — HR-1 (Sprint 2) is what actually asks her to tap
"connect me to a counsellor now." Sprint 1's demo can end the visible
conversation here, provided `reports.risk_level='HIGH'` and `status='SCORED'`
are correctly set underneath it.

### 6.2 STANDARD risk (content key `standard.bridge`)

**Message type:** plain text, sent immediately, followed by handoff into
DIR-2 (may be a stub route in Sprint 1 per INF-4's AC, as long as it doesn't
dead-end).

**Exact copy:**

> Thank you for answering those. Based on what you've shared, let's get you
> connected with real support and resources near you.

This deliberately mirrors the HIGH message's opening ("Thank you for
answering/trusting...") so the two branches don't read as though one survivor
got a warm response and the other got a form-letter brushoff — both open with
acknowledgment before the paths diverge.

---

## 7. Content-key naming table

Every string in this document, with its `content_strings.key` (English row,
`language='en'`). Keys already named in `backlog.md`/`sprint-1-plan.md` are
carried over unchanged; new keys follow that same dotted, lowercase,
`area.item.field` convention so Backend can seed this directly for LANG-2
without re-deriving names.

| Key | Text (English) |
|---|---|
| `lang_select.body` | "Welcome. This is Vimbiso, a private safety and support line. Please choose your language to continue." |
| `lang_select.button` | "Select Language" |
| `lang_select.section_title` | "Choose a language" |
| `lang_select.row_english` | "English" |
| `lang_select.row_kiswahili` | "Kiswahili" |
| `lang_select.row_francais` | "Français" |
| `disclosure_message` | "This chat runs over WhatsApp. We don't store your name, but WhatsApp and your phone provider can see that this conversation exists. If it's safer for you, consider deleting this chat afterward." |
| `menu.body` | "What would you like to do?\n\n1. Report something that happened\n2. Find help near me\n3. Know your rights" |
| `menu.footer_hint` | "Tip: send 0 anytime for help keeping this private" |
| `menu.button` | "Choose an option" |
| `menu.section_title` | "Main menu" |
| `menu.report` | "Report something that happened" |
| `menu.report_row` | "Report what happened" |
| `menu.find_help` | "Find help near me" |
| `menu.find_help_row` | "Find help near me" |
| `menu.rights` | "Know your rights" |
| `menu.rights_row` | "Know your rights" |
| `guidance.device_safety` | (full 3-point text in §4) |
| `triage.intro` | "I'm going to ask you 8 short questions. Just tap Yes, No, or Prefer not to say for each one — you won't need to type anything. You can choose \"Prefer not to say\" for any question you'd rather skip." |
| `triage.midpoint` | "You're halfway there — 4 more questions." |
| `triage.strangle.question` | "Has he ever choked, strangled, or tried to suffocate you?" |
| `triage.strangle.btn_yes` | "Yes" |
| `triage.strangle.btn_no` | "No" |
| `triage.strangle.btn_skip` | "Prefer not to say" |
| `triage.weapon.question` | "Does he have a weapon, or has he threatened you with one?" |
| `triage.weapon.btn_yes` | "Yes" |
| `triage.weapon.btn_no` | "No" |
| `triage.weapon.btn_skip` | "Prefer not to say" |
| `triage.kill_threat.question` | "Has he said he would kill you, or someone close to you?" |
| `triage.kill_threat.btn_yes` | "Yes" |
| `triage.kill_threat.btn_no` | "No" |
| `triage.kill_threat.btn_skip` | "Prefer not to say" |
| `triage.escalation.question` | "Is the violence happening more often, or getting worse?" |
| `triage.escalation.btn_yes` | "Yes" |
| `triage.escalation.btn_no` | "No" |
| `triage.escalation.btn_skip` | "Prefer not to say" |
| `triage.separation.question` | "Have you left, or tried to leave, recently — or talked about leaving?" |
| `triage.separation.btn_yes` | "Yes" |
| `triage.separation.btn_no` | "No" |
| `triage.separation.btn_skip` | "Prefer not to say" |
| `triage.sexual_coercion.question` | "Has he forced you into sex you didn't want?" |
| `triage.sexual_coercion.btn_yes` | "Yes" |
| `triage.sexual_coercion.btn_no` | "No" |
| `triage.sexual_coercion.btn_skip` | "Prefer not to say" |
| `triage.control.question` | "Is he watching, following, or controlling where you go and who you talk to?" |
| `triage.control.btn_yes` | "Yes" |
| `triage.control.btn_no` | "No" |
| `triage.control.btn_skip` | "Prefer not to say" |
| `triage.self_perceived_danger.question` | "Do you feel that if nothing changes, you could be seriously hurt or killed?" |
| `triage.self_perceived_danger.btn_yes` | "Yes" |
| `triage.self_perceived_danger.btn_no` | "No" |
| `triage.self_perceived_danger.btn_skip` | "Prefer not to say" |
| `highrisk.bridge` | "Thank you for trusting me with that. Based on what you've shared, what you're facing sounds serious, and I want to make sure you're not facing it alone. Stay with me for a moment — I'm about to share safety information and a real number you can call right now." |
| `standard.bridge` | "Thank you for answering those. Based on what you've shared, let's get you connected with real support and resources near you." |

Note on the three `btn_*` keys repeated 8 times: text is identical in English
by design (consistency reduces cognitive load across 8 rapid taps), but each
question gets its own key rather than one shared `triage.btn_yes` because some
target languages may need grammatical agreement with the question (gendered or
tense variation) that a single shared key can't express. Translators are free
to leave all 8 identical per language if the grammar allows it — the schema
just doesn't force that constraint.

---

## Sprint 2+ dashboard tone note

When Frontend builds the counsellor dashboard (Sprint 2), the same
terminology discipline used in this document should carry over: a report
flagged `risk_level = HIGH` should render to counsellors in the same plain,
direct, non-alarmist register the survivor herself read in §6.1 — "flagged as
high risk" or similar plain phrasing, not clinical or bureaucratic labels
like "critical/severe case" or diagnostic-sounding terms. The survivor and the
counsellor are effectively reading two views of the same event; if the
dashboard's language is more clinical or more dramatic than what she was told,
that's a trust gap the whole design has otherwise worked to avoid. Visual
urgency (DASH-2's "pinned, flagged red") is fine and expected — it's the
*words*, not the layout, that should stay consistent with the tone set here.

---

# Sprint 2 Extension — English copy, region picker, rights content,
# consent prompt, 4th menu option, and draft Swahili/French

Author: Designer · Status: LOCKED for Sprint 2 build · Last updated: 2026-09-12

Everything below is additive to the Sprint 1 spec above — nothing above this
line changes. Canonical sources: `docs/backlog.md` Section 5 stories HR-1,
HR-3, HR-4, DIR-2, DIR-3, PW-1 (AC/technical notes used verbatim where the
backlog marks them verbatim) and `docs/sprint-2-plan.md` Section 4 (exact
content-key names) and Section 3.3 (4th main-menu option). Where this doc and
`backlog.md` disagree, `backlog.md` wins, per the same rule as Sprint 1.

---

## 8. HR-1 — Immediate safety-plan sequence (fires automatically on `risk_level=HIGH`)

**Trigger:** immediately after §6.1's `highrisk.bridge` message (Sprint 1,
already shipped and unchanged) — no user action between them. Where Sprint 1
"ended the visible conversation" at `highrisk.bridge`, Sprint 2 continues the
same conversation with the four parts HR-1's AC requires, in order: (1)
danger-intro line, (2) the 4-item safety plan, (3) the real hotline number
pulled from `resources`, (4) the Yes/No connect prompt. All four must land
within 5 seconds of the 8th triage answer per HR-1's DoD — do not insert any
new pause or "are you ready?" gate between `highrisk.bridge` and this
sequence.

### 8.1 Danger-intro line

**Message type:** plain text (`sendText`).

**Exact copy** (content key `highrisk.intro`):

> What you've told me suggests you could be in serious danger right now.
> Here's what to do, in order:

Tone check: same register as `highrisk.bridge` — plain, direct, states the
seriousness once, does not repeat "danger" or "emergency" language beyond
this single line. It functions as a header for the plan that follows, not a
second warning.

### 8.2 The 4-item safety plan

**Message type:** plain text (`sendText`), one message containing all 4
items as a numbered list (not 4 separate messages — a survivor reading this
under stress should see the whole plan at once, not have to wait through 4
message pops).

**Exact copy** (content keys `highrisk.plan_1` … `highrisk.plan_4`; sent as
one message body, numbered 1–4 in this fixed order per HR-1's AC: pack a bag,
identify a safe neighbor, memorize one number, keep phone charged):

> 1. Pack a small bag now, if you can do it without being noticed — ID, some
>    cash, a phone charger, a change of clothes.
> 2. Think of one neighbor or nearby person you trust, and how you'd get to
>    them quickly if you needed to.
> 3. Memorize one phone number by heart — a trusted contact or the hotline
>    below — in case your phone isn't with you.
> 4. Keep your phone charged, and know where the charger is.

Each item is stored under its own content key (`highrisk.plan_1` through
`highrisk.plan_4`) even though sent as one message, so a language whose
numbered-list punctuation or item order needs adjusting can do so per item
without re-authoring the whole block.

### 8.3 Real hotline number (never hardcoded)

**Message type:** plain text (`sendText`), sent as its own message
immediately after the plan.

**Exact copy** (content key `highrisk.hotline_prefix` — the prefix text
only; the number itself is **not** a content key and must never be
hardcoded anywhere, per HR-1's technical note — Backend queries `resources`
WHERE `category='hotline' AND country='KE'` at send time and appends the
result's `phone` value on the line below this prefix):

> If you can, call this number now — it's free and available:
> {{hotline_number}}

`{{hotline_number}}` is a runtime placeholder, not literal text to send —
Backend interpolates the live `resources.phone` value there. If the query
ever returns no row (seed not yet run, DB issue), do not fall back to a
guessed or example number — that would violate DIR-1's sourcing guarantee at
the exact moment it matters most; log an error and still send the rest of
the sequence.

### 8.4 Counsellor-connect prompt

**Message type:** Quick Reply buttons (`sendButtons`) — 2 buttons, well
under the 3-button limit.

| Button label | Chars | Button id | Effect |
|---|---|---|---|
| `Yes` | 3 ✅ | `connect_yes` | HR-2: `wants_counsellor_connect=true`, SMS fires |
| `No` | 2 ✅ | `connect_no` | HR-2: no SMS, hotline stays visible above |

**Exact copy** (content key `highrisk.connect_prompt`):

> Would you like me to connect you to a counsellor right now?

### 8.5 Connect acknowledgements

Two short, mutually-exclusive plain-text replies, one per button tap — both
close the loop so the user isn't left wondering whether the tap registered.

**"Yes" tap** (content key `highrisk.connect_yes_ack`):

> Okay. A counsellor has been notified and will try to reach you. Keep the
> hotline number above in case you need it before then.

**"No" tap** (content key `highrisk.connect_no_ack`):

> That's okay — the number above is still yours to call anytime, day or
> night. You can also come back to this menu later.

Neither acknowledgement pressures a reversal or repeats the question — "No"
is treated as a complete, respected answer, not a soft objection to overcome.

---

## 9. HR-3 / HR-4 — Trusted-contact registration and alert

### 9.1 Registration prompt (offered from the 4th main-menu option, §13)

**Trigger:** `menu_trusted_contact` row tapped from the main menu, at any
time — not tied to a report or a risk outcome, since `trusted_contacts` is
keyed to `survivor_whatsapp_number` and must persist across future reports
(per HR-3's technical note).

**Message type:** plain text (`sendText`), explaining what this does before
asking for anything, since a stranger's phone number is a meaningfully more
sensitive ask than a Yes/No tap.

**Exact copy** (content key `trusted_contact.prompt`):

> You can set up one trusted contact. If a future report of yours is ever
> scored high risk, we'll send them one short message asking them to check
> in with you — nothing about what happened, just a nudge to reach out. You
> can change this contact anytime by coming back to this menu.

**Message type:** plain text (`sendText`), asking for the number.

**Exact copy** (content key `trusted_contact.ask_number`):

> What's their WhatsApp number? Please include the country code — for
> example, +2547XXXXXXXX.

### 9.2 Confirmation

**Message type:** plain text (`sendText`), sent once the `trusted_contacts`
row is written.

**Exact copy** (content key `trusted_contact.confirm`):

> Done — your trusted contact is registered. You can update this anytime by
> choosing this option again.

### 9.3 Invalid-looking number — friendly retry

**Message type:** plain text (`sendText`), sent instead of §9.2 when the
submitted text fails basic phone-number validation (Backend's concern, not
this doc's — this is the copy for when it fails).

**Exact copy** (content key `trusted_contact.invalid_number`):

> That doesn't look like a complete WhatsApp number. Please include the
> country code, for example +2547XXXXXXXX, and send it again.

This stays matter-of-fact and gives a concrete example rather than a generic
"invalid input" error — someone re-typing a number under stress benefits
from seeing the expected shape, not just being told they got it wrong.

### 9.4 HR-4 — Automatic trusted-contact alert (fixed, verbatim)

**Trigger:** a registered trusted contact exists for this
`survivor_whatsapp_number` and HR-1 has just fired (i.e., `risk_level=HIGH`).
Silently no-ops if no contact is registered — no message to the survivor
about this either way, per HR-4's AC.

**Message type:** plain text (`sendText`) to the **contact's** number, not
the survivor's.

**Exact copy — specified verbatim in `backlog.md`'s HR-4 AC, do not
paraphrase** (content key `trusted_contact.alert_message`):

> Thinking of you — call me when you can.

Documented here for completeness only; this string is locked by the backlog
and is not open to Designer wordsmithing. `trusted_contacts.alert_sent_at`
updates when this sends.

---

## 10. DIR-2 — "Find Help" region picker

**Trigger:** `menu_find_help` row from the main menu, or automatically
offered as the next step after a STANDARD-risk outcome (§6.2's
`standard.bridge` bridge message, Sprint 1) — same picker serves both
entry points.

**Message type:** List Message (`sendList`), consistent with §1 and §3's
rationale — three named regions plus a fallback read better as list rows
than forced into a button label.

**Body text** (content key `dir.region_prompt`):

> Which area are you in? I'll find you a real, verified contact nearby.

**List button text** ("Choose an area" — 15 chars ✅):

> Choose an area

**Row titles:**

| Row title | Chars | Row id | Content key |
|---|---|---|---|
| `Nairobi` | 7 ✅ | `region_nairobi` | `dir.region_nairobi` |
| `Mombasa` | 7 ✅ | `region_mombasa` | `dir.region_mombasa` |
| `Other / National` | 17 ✅ | `region_other` | `dir.region_other` |

Backlog's DIR-2 AC names the three options as "Nairobi / Mombasa /
Other-National"; the row title above renders it "Other / National" for
on-screen readability (a bare hyphen reads ambiguously as a single compound
word on a small screen) — same meaning, not a reworded option. **Open
question for Backend/PM:** confirm this rendering choice doesn't need to
match the hyphenated form exactly for any downstream matching logic; if
`Other-National` is expected as a literal string anywhere, flag it back to
me.

### 10.1 Result format (exact, per DIR-2's AC)

**Message type:** plain text (`sendText`), sent immediately after a region
selection resolves to a `resources` row (or the national hotline, if no
region-specific match exists — DIR-2's fallback rule).

**Exact template** (content key `dir.result_format` — `{name}`, `{phone}`,
`{source_name}`, `{date}` are runtime placeholders filled from the matched
`resources` row, never static text):

> {name}
> {phone}
> Source: {source_name}, last verified {date}

This is the literal three-line format named in DIR-2's AC ("name, phone, and
'Source: {source_name}, last verified {date}'") — do not add framing
sentences before or after it; the format's plainness is itself part of the
trust signal DIR-1 exists to provide. `{date}` should render as
`last_verified_date` in a human-readable form (e.g. `12 Sep 2026`), not a raw
ISO timestamp — a formatting detail for Backend, not a new content key.

---

## 11. DIR-3 — "Know your rights" example content

**Trigger:** `menu_rights` row from the main menu.

**Message type:** plain text (`sendText`), one message: disclaimer first,
then the 2–3 points, so the disclaimer can never be scrolled past or
truncated separately from the content it qualifies.

**Exact disclaimer — mandatory per backlog.md's DIR-3 AC, verbatim, must
appear before any rights content in every language it ships in** (content
key `rights.disclaimer`):

> This is example information and has not yet been reviewed by a legal
> partner.

**Rights points** (content keys `rights.point_1` … `rights.point_3`; DIR-3
is a **Could**-priority story and its DoD explicitly allows cutting the
first item if Sprint 2 runs long — cut `rights.point_1` first if needed,
keep `rights.point_2`/`rights.point_3`):

> 1. You have the right to report violence to the police at any time, and
>    to ask for a female officer at a Gender and Children's Desk if you'd
>    prefer.
> 2. You have the right to ask for a protection order against someone
>    harming you, even if you are married to them.
> 3. You have the right to medical treatment after an assault, and to ask a
>    hospital or clinic to help you get a police report (a "P3 form") for
>    it.

**Judgment call flagged for review:** these three points are my own
plausible-for-Kenya drafting (general reporting rights, protection orders,
the P3 medical-legal form used in Kenyan assault cases) — not sourced from
a legal reference, which is exactly what `rights.disclaimer` exists to be
honest about. Treat the disclaimer as load-bearing, not decorative: this
content must never ship without it, and should be replaced wholesale, not
edited, once a real legal partner reviews it.

---

## 12. PW-1 — Optional perpetrator-naming consent prompt

**Trigger:** the closing step of a scored report (either risk level), after
the outcome-specific flow (HR-1's sequence or DIR-2's picker) completes —
per PW-1's AC, this fires once the report is otherwise done, framed as
fully separate from and not gating anything about the survivor's own case.

**Message type:** Quick Reply buttons (`sendButtons`) — 2 buttons (a third,
"Prefer not to say," is unnecessary here since "No" and skip are already the
same non-action per PW-1's AC).

| Button label | Chars | Button id | Effect |
|---|---|---|---|
| `Yes` | 3 ✅ | `pw_consent_yes` | proceeds to §12.1 |
| `No` | 2 ✅ | `pw_consent_no` | ends the flow, no consent recorded |

**Exact copy — specified verbatim in `backlog.md`'s PW-1 AC, do not
paraphrase** (content key `pw.consent_prompt`):

> Would you like to name who did this, only to check if others have
> reported the same person? This never changes what happens with your
> case.

### 12.1 "Yes" tap

**Message type:** plain text (`sendText`).

**Exact copy** (content key `pw.consent_yes_ack`):

> Thank you. Type anything that identifies them — a name, nickname, or
> description. This is only ever turned into a secure code to check for a
> match with other reports; the text itself is never stored and never
> shown to anyone.

**Judgment call flagged for review:** `sprint-2-plan.md` §4 lists only three
PW-1 keys (`pw.consent_prompt`, `pw.consent_yes_ack`, `pw.consent_no_ack`) —
no separate key for the follow-up message that actually asks the survivor to
type the identifying text, even though PW-1's AC implies one exists ("a
'yes' sets `perpetrator_consent_given=true` and passes text to SEC-1's
hasher," which requires the survivor to type something after tapping Yes).
I've folded that ask into `pw.consent_yes_ack` itself (acknowledgement +
request in one message) rather than inventing an unlisted key. If Backend's
flow needs these as two separate sends (e.g. to gate on a free-text webhook
event distinctly from the button tap), split this copy into
`pw.consent_yes_ack` (just "Thank you.") and a new key — flag back to me and
I'll draft it; I did not add a key sprint-2-plan.md didn't list.

### 12.2 "No" tap (or skip)

**Message type:** plain text (`sendText`).

**Exact copy** (content key `pw.consent_no_ack`):

> No problem — that's entirely optional and doesn't affect your case in any
> way.

---

## 13. Main menu — 4th option (additive to §3, Sprint 1 unchanged)

Per `sprint-2-plan.md` §3.3: this adds a 4th row to the List Message defined
in §3. The existing three options (`menu.report` / `menu.find_help` /
`menu.rights`) and their content keys, row ids, and routing are **unchanged
— this is additive, not a renumbering.** Do not edit §3 above; this section
documents the delta only.

**Updated body text** (§3's `menu.body` key gains a 4th line — Backend:
this means `menu.body`'s stored value changes, even though its key name
doesn't; other three lines are byte-for-byte identical to §3):

> What would you like to do?
>
> 1. Report something that happened
> 2. Find help near me
> 3. Know your rights
> 4. Set up a trusted contact

**New row** (added after §3's three existing rows, same List Message,
same section):

| Row title | Chars | Row id | Routes to | Content key |
|---|---|---|---|---|
| `Trusted contact` | 16 ✅ | `menu_trusted_contact` | HR-3 registration (§9.1) | `menu.trusted_contact_row` |

**New full-sentence key** (the 4th line of the body text above, per
INF-4/DIR-2's established pattern of body-text-carries-the-literal-copy,
row-title-is-just-a-tap-target):

`menu.trusted_contact` = "Set up a trusted contact" — this is the exact
phrase named in `sprint-2-plan.md` §3.3; do not paraphrase it either, since
it's given as an exact string there even though the backlog itself doesn't
independently specify this one (it originates in the sprint-2 plan, not
`backlog.md`).

No footer or list-button-text change needed — §3's existing footer hint and
"Choose an option" button text still apply unchanged to the 4-row version.

---

## 14. Content-key naming table — Sprint 2 additions

Same format as §7's table (English row, `language='en'`). §7's Sprint 1 keys
are unchanged and not repeated here.

| Key | Text (English) |
|---|---|
| `highrisk.intro` | "What you've told me suggests you could be in serious danger right now. Here's what to do, in order:" |
| `highrisk.plan_1` | "Pack a small bag now, if you can do it without being noticed — ID, some cash, a phone charger, a change of clothes." |
| `highrisk.plan_2` | "Think of one neighbor or nearby person you trust, and how you'd get to them quickly if you needed to." |
| `highrisk.plan_3` | "Memorize one phone number by heart — a trusted contact or the hotline below — in case your phone isn't with you." |
| `highrisk.plan_4` | "Keep your phone charged, and know where the charger is." |
| `highrisk.hotline_prefix` | "If you can, call this number now — it's free and available:\n{{hotline_number}}" |
| `highrisk.connect_prompt` | "Would you like me to connect you to a counsellor right now?" |
| `highrisk.connect_yes_ack` | "Okay. A counsellor has been notified and will try to reach you. Keep the hotline number above in case you need it before then." |
| `highrisk.connect_no_ack` | "That's okay — the number above is still yours to call anytime, day or night. You can also come back to this menu later." |
| `trusted_contact.prompt` | "You can set up one trusted contact. If a future report of yours is ever scored high risk, we'll send them one short message asking them to check in with you — nothing about what happened, just a nudge to reach out. You can change this contact anytime by coming back to this menu." |
| `trusted_contact.ask_number` | "What's their WhatsApp number? Please include the country code — for example, +2547XXXXXXXX." |
| `trusted_contact.confirm` | "Done — your trusted contact is registered. You can update this anytime by choosing this option again." |
| `trusted_contact.invalid_number` | "That doesn't look like a complete WhatsApp number. Please include the country code, for example +2547XXXXXXXX, and send it again." |
| `trusted_contact.alert_message` | "Thinking of you — call me when you can." (verbatim, HR-4 AC — locked) |
| `menu.trusted_contact` | "Set up a trusted contact" |
| `menu.trusted_contact_row` | "Trusted contact" |
| `dir.region_prompt` | "Which area are you in? I'll find you a real, verified contact nearby." |
| `dir.region_nairobi` | "Nairobi" |
| `dir.region_mombasa` | "Mombasa" |
| `dir.region_other` | "Other / National" |
| `dir.result_format` | "{name}\n{phone}\nSource: {source_name}, last verified {date}" |
| `rights.disclaimer` | "This is example information and has not yet been reviewed by a legal partner." (verbatim, DIR-3 AC — locked) |
| `rights.point_1` | "You have the right to report violence to the police at any time, and to ask for a female officer at a Gender and Children's Desk if you'd prefer." |
| `rights.point_2` | "You have the right to ask for a protection order against someone harming you, even if you are married to them." |
| `rights.point_3` | "You have the right to medical treatment after an assault, and to ask a hospital or clinic to help you get a police report (a \"P3 form\") for it." |
| `pw.consent_prompt` | "Would you like to name who did this, only to check if others have reported the same person? This never changes what happens with your case." (verbatim, PW-1 AC — locked) |
| `pw.consent_yes_ack` | "Thank you. Type anything that identifies them — a name, nickname, or description. This is only ever turned into a secure code to check for a match with other reports; the text itself is never stored and never shown to anyone." |
| `pw.consent_no_ack` | "No problem — that's entirely optional and doesn't affect your case in any way." |

`menu.body` (existing key from §7) also changes value in Sprint 2 — see §13
for its updated 4-line text; its key name is unchanged so it is not
re-listed as a "new" key above.

---

## 15. Draft Swahili and French translations — safety-critical subset

**AI-drafted, UNREVIEWED — tier PARTIAL, not FULL, for both languages
below.** Per `mvp-spec.md` §6, tier is earned by a named human reviewer
signing off, not by translation existing — nothing in this section may be
seeded as `tier='FULL'` or with any `reviewed_by` value until that review
actually happens. This covers exactly the subset `sprint-2-plan.md` §4
calls for: every `highrisk.*` key (including `highrisk.bridge`, carried
over from Sprint 1's §7 table since it matches the `highrisk.*` wildcard)
plus `pw.consent_prompt`. Nothing else is translated here — full parity for
Swahili/French is LANG-3/LANG-4's separate scope, not this doc's.

**Honesty note on translation quality:** I am not a certified Swahili or
French translator, and neither draft below has been checked by a fluent
speaker. I've aimed for plain, natural phrasing rather than a literal
word-for-word rendering, but there may be register, idiom, or grammar
issues I'm not positioned to catch myself. Treat both columns as a
starting draft for a real reviewer to correct, not as ship-ready copy —
this is exactly why `tier='PARTIAL'` and an unset `reviewed_by` are the
correct DB state for every row below, and why neither language is shown
live in the demo (per `mvp-spec.md` §6's "Demo discipline") until reviewed.

### 15.1 Swahili (sw) — AI-drafted, UNREVIEWED

| Key | Swahili (draft) |
|---|---|
| `highrisk.bridge` | "Asante kwa kuniamini na hilo. Kutokana na uliyoshiriki, ninachoona ni kwamba unakabiliwa na hali mbaya, na nataka kuhakikisha hukabiliani nayo peke yako. Ngoja kidogo — ninakaribia kukutumia maelezo ya usalama na nambari halisi unayoweza kupiga sasa hivi." |
| `highrisk.intro` | "Ulichoniambia kinaonyesha kuwa unaweza kuwa katika hatari kubwa sasa hivi. Haya ndiyo ya kufanya, kwa mpangilio:" |
| `highrisk.plan_1` | "Andaa mfuko mdogo sasa, kama unaweza kufanya hivyo bila kuonekana — kitambulisho, pesa kidogo, chaja ya simu, na nguo za kubadilisha." |
| `highrisk.plan_2` | "Fikiria jirani mmoja au mtu wa karibu unayemwamini, na jinsi ungeweza kumfikia haraka ukihitaji." |
| `highrisk.plan_3` | "Kariri nambari moja ya simu kwa akili — mtu unayemwamini au nambari ya dharura hapa chini — endapo huna simu yako karibu." |
| `highrisk.plan_4` | "Hakikisha simu yako ina chaji, na unajua chaja iko wapi." |
| `highrisk.hotline_prefix` | "Ikiwezekana, piga nambari hii sasa — ni bure na inapatikana:\n{{hotline_number}}" |
| `highrisk.connect_prompt` | "Je, ungependa nikuunganishe na mshauri sasa hivi?" |
| `highrisk.connect_yes_ack` | "Sawa. Mshauri ameshaarifiwa na atajaribu kuwasiliana nawe. Hifadhi nambari ya dharura iliyo hapo juu endapo utaihitaji kabla ya hapo." |
| `highrisk.connect_no_ack` | "Hakuna shida — nambari iliyo hapo juu bado ni yako kupiga wakati wowote, mchana au usiku. Unaweza pia kurudi kwenye menyu hii baadaye." |
| `pw.consent_prompt` | "Je, ungependa kutaja aliyekufanyia hivi, ili tu kuangalia kama wengine wameripoti mtu huyo huyo? Hili halibadilishi kamwe kinachotokea kwa kesi yako." |

No Swahili reviewer name is attached to any row above, and none should be
invented — LANG-3 names the real reviewer, sourced via @KEN/@UGA, once one
responds.

### 15.2 French (fr) — AI-drafted, UNREVIEWED

**Pending Nnouka's real review before this can be promoted to tier FULL —
do not mark `reviewed_by='Nnouka'` in the seed until he has actually
reviewed it.** LANG-4 names Nnouka as the confirmed reviewer for exactly
this subset; the rows below are the Day-3-style AI-assisted first draft his
review is supposed to correct, not a substitute for it.

| Key | French (draft) |
|---|---|
| `highrisk.bridge` | "Merci de m'avoir fait confiance avec cela. D'après ce que vous avez partagé, ce que vous vivez semble grave, et je veux m'assurer que vous n'y faites pas face seule. Restez avec moi un instant — je vais vous communiquer des informations de sécurité et un vrai numéro que vous pouvez appeler dès maintenant." |
| `highrisk.intro` | "Ce que vous m'avez dit suggère que vous pourriez être en danger grave en ce moment. Voici quoi faire, dans l'ordre :" |
| `highrisk.plan_1` | "Préparez maintenant un petit sac, si vous pouvez le faire sans être remarquée — pièce d'identité, un peu d'argent, un chargeur de téléphone, des vêtements de rechange." |
| `highrisk.plan_2` | "Pensez à un voisin ou une personne proche en qui vous avez confiance, et à la façon dont vous pourriez la rejoindre rapidement si besoin." |
| `highrisk.plan_3` | "Mémorisez un numéro de téléphone par cœur — un contact de confiance ou le numéro d'urgence ci-dessous — au cas où vous n'auriez pas votre téléphone avec vous." |
| `highrisk.plan_4` | "Gardez votre téléphone chargé, et sachez où se trouve le chargeur." |
| `highrisk.hotline_prefix` | "Si vous le pouvez, appelez ce numéro maintenant — c'est gratuit et disponible :\n{{hotline_number}}" |
| `highrisk.connect_prompt` | "Souhaitez-vous que je vous mette en relation avec une conseillère dès maintenant ?" |
| `highrisk.connect_yes_ack` | "D'accord. Une conseillère a été prévenue et essaiera de vous joindre. Gardez le numéro d'urgence ci-dessus au cas où vous en auriez besoin avant cela." |
| `highrisk.connect_no_ack` | "Pas de souci — le numéro ci-dessus reste disponible à tout moment, jour et nuit. Vous pouvez aussi revenir à ce menu plus tard." |
| `pw.consent_prompt` | "Souhaitez-vous nommer qui vous a fait cela, uniquement pour vérifier si d'autres personnes ont signalé la même personne ? Cela ne change jamais ce qui se passe pour votre dossier." |

`trusted_contact.alert_message` is intentionally **not** translated here:
its English string is fixed verbatim by HR-4's AC and the backlog does not
call for translated variants in Sprint 2 scope — if a translated version is
ever wanted, that's a new decision for PM/backlog to make explicitly, not
something to infer from this subset.

---

## 16. Main menu — 5th option: Change language (Sprint 3 addition, INF-6)

Real gap found reviewing the shipped flow: language is picked exactly once,
at first contact (§1), and nothing anywhere afterward lets a survivor change
it — not the main menu (§3/§13), not a keyword, nothing. A survivor who taps
the wrong language under stress, or whose situation changes, is stuck; their
only "fix" is messaging from a new WhatsApp number, which also loses their
conversation state. This section documents the fix, additive to §13 (do not
edit §3/§13 above).

**Updated body text** (`menu.body` gains a 5th line):

> What would you like to do?
>
> 1. Report something that happened
> 2. Find help near me
> 3. Know your rights
> 4. Set up a trusted contact
> 5. Change language

**New row** (added after §13's `menu_trusted_contact` row, same List
Message, same section):

| Row title | Chars | Row id | Routes to | Content key |
|---|---|---|---|---|
| `🌐 Change language` | 18 ✅ | `menu_change_language` | Re-shows the §1 language selector | `menu.change_language_row` |

**Flow:** tapping this row re-sends the exact same language-selector List
Message §1 defines (`sendLanguageSelector()` — no separate copy, no drift
risk). Once a language row is tapped, `conversation_state.language` updates,
a short confirmation is sent **in the newly chosen language**, then the main
menu re-sends in that language.

**New key:**

`menu.change_language_row` = "🌐 Change language"
`menu.language_changed_ack` = "Language updated. ✅"

**Safety-critical constraint (do not weaken this in a future edit):** this
flow must NEVER re-trigger SEC-3's disclosure message (§2), which is
once-ever per WhatsApp number, not once-per-language-pick. Implementation
uses a dedicated `AWAITING_LANGUAGE_CHANGE` state distinct from
`AWAITING_LANGUAGE` specifically so the disclosure's `disclosure_shown` gate
in §1/§2 is structurally unreachable from this flow, not just skipped by a
runtime check that a later edit could accidentally remove.
