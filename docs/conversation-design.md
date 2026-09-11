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
