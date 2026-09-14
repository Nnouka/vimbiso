// server/seeds/content_en.ts
//
// Backend-owned (LANG-2). Seeds `content_strings` for language='en',
// tier='FULL', with every key from Designer's content-key table in
// docs/conversation-design.md Section 7 (Sprint 1) and Section 14 (Sprint 2
// additions) — copy is quoted VERBATIM from that doc, not paraphrased. Run
// with: `npm run seed` (=> now `tsx server/seeds/run_all.ts`; see that file's
// header for why the single-file `seed` script became a small runner in
// Sprint 2).
//
// Idempotent: upserts on the (key, language) primary key, so re-running this
// after an edit to conversation-design.md safely updates existing rows.
//
// Sprint 1 addition beyond Designer's original table: `stub.coming_soon`.
// This was a Backend-authored Sprint-1-ONLY placeholder for the "Find help
// near me" / "Know your rights" menu routes, back when DIR-2/DIR-3 didn't
// exist yet. Both routes now have real content (this file's Sprint 2
// section, below), so `stub.coming_soon` is no longer referenced anywhere in
// conversation.ts — left seeded (harmless, unused) rather than deleted, so a
// re-run of this file against an existing DB doesn't orphan/need a DELETE
// statement for one dead row.
//
// Sprint 2 additions beyond Designer's Section 14 table — flagged loudly per
// CONTRIBUTING.md, NOT Designer-authored copy: `common.btn_yes`,
// `common.btn_no`, `dir.region_button`, `dir.region_section_title`. See the
// matching comment in server/lib/conversation.ts (search "DEVIATION FLAGGED")
// for why: Designer's Sprint 2 tables show these four short UI-chrome
// strings ("Yes"/"No" button labels for the HR-1 connect prompt and PW-1
// consent prompt; the region-picker's list-button text and section title)
// as literal text in their flow tables, but never assigned them a
// `content_strings` key the way every other button/label in this schema has
// one — an apparent oversight parallel to the one PM already resolved for
// `pw.consent_yes_ack`. Left hardcoded, these would silently reopen LANG-1's
// "zero hardcoded user-facing strings" DoD; inventing content-bearing copy
// without saying so would be worse. These four are UI chrome, not survivor-
// facing sentences, so English text ("Yes" / "No" / "Choose an area") is
// used as a reasonable placeholder pending Designer's confirmation.

import dotenv from 'dotenv';
import { getPool } from '../lib/db';
import { ContentString } from '../lib/content';

const LANGUAGE = 'en';
const TIER: ContentString['tier'] = 'FULL';

// Keys/text copied verbatim from docs/conversation-design.md §7 (and §4 for
// the multi-paragraph guidance.device_safety text, which the table itself
// just points back to).
export const CONTENT: Record<string, string> = {
  'lang_select.body':
    'Welcome. This is Vimbiso, a private safety and support line. Please choose your language to continue.',
  'lang_select.button': 'Select Language',
  'lang_select.section_title': 'Choose a language',
  'lang_select.row_english': 'English',
  'lang_select.row_kiswahili': 'Kiswahili',
  'lang_select.row_francais': 'Français',

  disclosure_message:
    "This chat runs over WhatsApp. We don't store your name, but WhatsApp and your phone provider can see that this conversation exists. If it's safer for you, consider deleting this chat afterward.",

  // menu.body's value is defined once, below in the Sprint 2 section (§13 of
  // conversation-design.md), since it now includes the 4th "trusted contact"
  // option. A duplicate 3-option definition used to live here — TypeScript's
  // strict-mode object-literal-duplicate-key check (TS1117) is exactly what
  // catches this class of bug when a real `tsc` runs, per this repo's
  // TypeScript-conversion precedent (see docs/sprint-1-plan.md's note on the
  // conversation.ts/whatsapp.ts bugs TypeScript surfaced) — removed rather
  // than silently letting the later definition win.
  'menu.footer_hint': 'Tip: send 0 anytime for help keeping this private',
  'menu.button': 'Choose an option',
  'menu.section_title': 'Main menu',
  'menu.report': 'Report something that happened',
  'menu.report_row': 'Report what happened',
  'menu.find_help': 'Find help near me',
  'menu.find_help_row': 'Find help near me',
  'menu.rights': 'Know your rights',
  'menu.rights_row': 'Know your rights',

  'guidance.device_safety':
    "A few ways to keep this chat more private on this phone:\n\n" +
    "1. Save this contact under a name that won't stand out — a friend's name or a business, not \"Vimbiso\" or anything that names what this is.\n" +
    '2. When you\'re done, open this chat, tap the contact name at the top, and use WhatsApp\'s own "Clear Chat" (empties the messages) or "Archive" (hides the chat from your main list). Either is built into WhatsApp — you don\'t need to install anything.\n' +
    '3. Being honest with you: this is a real WhatsApp number, not a disguised app. "Clear Chat" and "Archive" reduce what\'s visible, but someone who unlocks your phone and looks in WhatsApp directly could still find this conversation.',

  'triage.intro':
    'I\'m going to ask you 8 short questions. Just tap Yes, No, or Prefer not to say for each one — you won\'t need to type anything. You can choose "Prefer not to say" for any question you\'d rather skip.',
  'triage.midpoint': "You're halfway there — 4 more questions.",

  'triage.strangle.question': 'Has he ever choked, strangled, or tried to suffocate you?',
  'triage.strangle.btn_yes': 'Yes',
  'triage.strangle.btn_no': 'No',
  'triage.strangle.btn_skip': 'Prefer not to say',

  'triage.weapon.question': 'Does he have a weapon, or has he threatened you with one?',
  'triage.weapon.btn_yes': 'Yes',
  'triage.weapon.btn_no': 'No',
  'triage.weapon.btn_skip': 'Prefer not to say',

  'triage.kill_threat.question': 'Has he said he would kill you, or someone close to you?',
  'triage.kill_threat.btn_yes': 'Yes',
  'triage.kill_threat.btn_no': 'No',
  'triage.kill_threat.btn_skip': 'Prefer not to say',

  'triage.escalation.question': 'Is the violence happening more often, or getting worse?',
  'triage.escalation.btn_yes': 'Yes',
  'triage.escalation.btn_no': 'No',
  'triage.escalation.btn_skip': 'Prefer not to say',

  'triage.separation.question':
    'Have you left, or tried to leave, recently — or talked about leaving?',
  'triage.separation.btn_yes': 'Yes',
  'triage.separation.btn_no': 'No',
  'triage.separation.btn_skip': 'Prefer not to say',

  'triage.sexual_coercion.question': "Has he forced you into sex you didn't want?",
  'triage.sexual_coercion.btn_yes': 'Yes',
  'triage.sexual_coercion.btn_no': 'No',
  'triage.sexual_coercion.btn_skip': 'Prefer not to say',

  'triage.control.question':
    'Is he watching, following, or controlling where you go and who you talk to?',
  'triage.control.btn_yes': 'Yes',
  'triage.control.btn_no': 'No',
  'triage.control.btn_skip': 'Prefer not to say',

  'triage.self_perceived_danger.question':
    'Do you feel that if nothing changes, you could be seriously hurt or killed?',
  'triage.self_perceived_danger.btn_yes': 'Yes',
  'triage.self_perceived_danger.btn_no': 'No',
  'triage.self_perceived_danger.btn_skip': 'Prefer not to say',

  'highrisk.bridge':
    "Thank you for trusting me with that. Based on what you've shared, what you're facing sounds serious, and I want to make sure you're not facing it alone. Stay with me for a moment — I'm about to share safety information and a real number you can call right now.",
  'standard.bridge':
    "Thank you for answering those. Based on what you've shared, let's get you connected with real support and resources near you.",

  // --- Backend Sprint-1-only stub (NOT Designer copy — see file header) ---
  // No longer referenced by conversation.ts as of Sprint 2 (DIR-2/DIR-3 have
  // real content now) — kept seeded, unused, rather than deleted.
  'stub.coming_soon':
    'This is coming very soon — for now, please see the national GBV hotline: HAK 1195 (toll-free).',

  // ===========================================================================
  // Sprint 2 additions — docs/conversation-design.md §14 (English, verbatim)
  // ===========================================================================

  // --- HR-1: immediate safety-plan sequence ---------------------------------
  'highrisk.intro':
    "What you've told me suggests you could be in serious danger right now. Here's what to do, in order:",
  'highrisk.plan_1':
    'Pack a small bag now, if you can do it without being noticed — ID, some cash, a phone charger, a change of clothes.',
  'highrisk.plan_2':
    "Think of one neighbor or nearby person you trust, and how you'd get to them quickly if you needed to.",
  'highrisk.plan_3':
    "Memorize one phone number by heart — a trusted contact or the hotline below — in case your phone isn't with you.",
  'highrisk.plan_4': 'Keep your phone charged, and know where the charger is.',
  'highrisk.hotline_prefix':
    "If you can, call this number now — it's free and available:\n{{hotline_number}}",
  'highrisk.connect_prompt': 'Would you like me to connect you to a counsellor right now?',
  'highrisk.connect_yes_ack':
    'Okay. A counsellor has been notified and will try to reach you. Keep the hotline number above in case you need it before then.',
  'highrisk.connect_no_ack':
    "That's okay — the number above is still yours to call anytime, day or night. You can also come back to this menu later.",

  // --- HR-3 / HR-4: trusted-contact registration and alert ------------------
  'trusted_contact.prompt':
    "You can set up one trusted contact. If a future report of yours is ever scored high risk, we'll send them one short message asking them to check in with you — nothing about what happened, just a nudge to reach out. You can change this contact anytime by coming back to this menu.",
  'trusted_contact.ask_number':
    "What's their WhatsApp number? Please include the country code — for example, +2547XXXXXXXX.",
  'trusted_contact.confirm':
    'Done — your trusted contact is registered. You can update this anytime by choosing this option again.',
  'trusted_contact.invalid_number':
    'That doesn\'t look like a complete WhatsApp number. Please include the country code, for example +2547XXXXXXXX, and send it again.',
  // Fixed verbatim per HR-4's AC (backlog.md) — never paraphrase, never
  // translate (conversation-design.md §9.4/§15 — Designer explicitly left
  // this English-only for Sprint 2).
  'trusted_contact.alert_message': 'Thinking of you — call me when you can.',

  // --- Main menu 4th option (additive; menu.report/find_help/rights and
  // their keys/routing are UNCHANGED from §7 above — only menu.body's VALUE
  // changes, to a 4-line body; see conversation-design.md §13) -------------
  'menu.body':
    'What would you like to do?\n\n1. Report something that happened\n2. Find help near me\n3. Know your rights\n4. Set up a trusted contact',
  'menu.trusted_contact': 'Set up a trusted contact',
  'menu.trusted_contact_row': 'Trusted contact',

  // --- DIR-2: "Find Help" region picker -------------------------------------
  'dir.region_prompt': "Which area are you in? I'll find you a real, verified contact nearby.",
  'dir.region_nairobi': 'Nairobi',
  'dir.region_mombasa': 'Mombasa',
  'dir.region_other': 'Other / National',
  'dir.result_format': '{name}\n{phone}\nSource: {source_name}, last verified {date}',

  // --- DIR-3: "Know your rights" example content ----------------------------
  // Verbatim per DIR-3's AC (backlog.md) — must appear before any rights
  // content in every language it ships in.
  'rights.disclaimer':
    'This is example information and has not yet been reviewed by a legal partner.',
  'rights.point_1':
    "You have the right to report violence to the police at any time, and to ask for a female officer at a Gender and Children's Desk if you'd prefer.",
  'rights.point_2':
    'You have the right to ask for a protection order against someone harming you, even if you are married to them.',
  'rights.point_3':
    'You have the right to medical treatment after an assault, and to ask a hospital or clinic to help you get a police report (a "P3 form") for it.',

  // --- PW-1: optional consent-gated perpetrator-naming prompt ---------------
  // Verbatim per PW-1's AC (backlog.md).
  'pw.consent_prompt':
    'Would you like to name who did this, only to check if others have reported the same person? This never changes what happens with your case.',
  'pw.consent_yes_ack':
    'Thank you. Type anything that identifies them — a name, nickname, or description. This is only ever turned into a secure code to check for a match with other reports; the text itself is never stored and never shown to anyone.',
  'pw.consent_no_ack': "No problem — that's entirely optional and doesn't affect your case in any way.",

  // --- Backend-authored UI-chrome additions, NOT Designer copy — see file
  // header's "Sprint 2 additions beyond Designer's Section 14 table" note. ---
  'common.btn_yes': 'Yes',
  'common.btn_no': 'No',
  'dir.region_button': 'Choose an area',
  'dir.region_section_title': 'Choose an area',
};

export async function seedContentEn(): Promise<void> {
  const pool = getPool();
  const entries = Object.entries(CONTENT);

  for (const [key, text] of entries) {
    await pool.query(
      `INSERT INTO content_strings (key, language, text, tier)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key, language) DO UPDATE SET
         text = EXCLUDED.text,
         tier = EXCLUDED.tier`,
      [key, LANGUAGE, text, TIER]
    );
  }

  console.log(`[seed] content_en: upserted ${entries.length} keys for language="${LANGUAGE}".`);
}

if (require.main === module) {
  dotenv.config();
  seedContentEn()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] content_en failed:', err);
      process.exit(1);
    });
}
