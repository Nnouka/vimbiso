// server/seeds/content_en.js
//
// Backend-owned (LANG-2). Seeds `content_strings` for language='en',
// tier='FULL', with every key from Designer's content-key table in
// docs/conversation-design.md Section 7 — copy is quoted VERBATIM from that
// doc, not paraphrased. Run with: `node server/seeds/content_en.js`.
//
// Idempotent: upserts on the (key, language) primary key, so re-running this
// after an edit to conversation-design.md safely updates existing rows.
//
// One addition beyond Designer's table: `stub.coming_soon`. This is a
// Backend-authored Sprint-1-only placeholder for the "Find help near me" /
// "Know your rights" menu routes (DIR-2/DIR-3 don't exist yet this sprint) —
// it is NOT part of conversation-design.md, since that doc explicitly scopes
// out writing DIR-2/DIR-3 content this sprint. Flagged here, and again in the
// implementation summary, so nobody mistakes it for Designer-authored copy.

require('dotenv').config();
const { getPool } = require('../lib/db');

const LANGUAGE = 'en';
const TIER = 'FULL';

// Keys/text copied verbatim from docs/conversation-design.md §7 (and §4 for
// the multi-paragraph guidance.device_safety text, which the table itself
// just points back to).
const CONTENT = {
  'lang_select.body':
    'Welcome. This is Vimbiso, a private safety and support line. Please choose your language to continue.',
  'lang_select.button': 'Select Language',
  'lang_select.section_title': 'Choose a language',
  'lang_select.row_english': 'English',
  'lang_select.row_kiswahili': 'Kiswahili',
  'lang_select.row_francais': 'Français',

  disclosure_message:
    "This chat runs over WhatsApp. We don't store your name, but WhatsApp and your phone provider can see that this conversation exists. If it's safer for you, consider deleting this chat afterward.",

  'menu.body':
    'What would you like to do?\n\n1. Report something that happened\n2. Find help near me\n3. Know your rights',
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
  'stub.coming_soon':
    'This is coming very soon — for now, please see the national GBV hotline: HAK 1195 (toll-free).',
};

async function seedContentEn() {
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
  seedContentEn()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] content_en failed:', err);
      process.exit(1);
    });
}

module.exports = { seedContentEn, CONTENT };
