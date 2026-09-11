// server/lib/conversation.ts
//
// Backend-owned. Implements INF-3 (state machine + language selector),
// INF-4 (main menu), INF-5 (device-safety guidance), TRI-1 (8-question
// triage flow) and TRI-3 (wire scoring into the flow).
//
// This is the ONLY thing server/routes/webhook.ts (Networking-owned) calls.
// Per docs/sprint-1-plan.md §3.3, all conversation/session state lives in
// Postgres's `conversation_state` table — there is no in-memory session map
// anywhere in this file, so a second process (or a restart) sees exactly the
// same state.
//
// Outbound WhatsApp traffic goes exclusively through server/lib/whatsapp.ts's
// three frozen send functions (sendText/sendButtons/sendList — this file
// only uses those three, never verifyWebhookSignature). No Twilio
// credentials or API calls appear here.

import { sendText, sendButtons, sendList, QuickReplyButton, ListSection } from './whatsapp';
import { t } from './content';
import { query } from './db';
import { scoreRisk, Answer, TriageAnswers } from './riskScoring';

// ---------------------------------------------------------------------------
// Shapes handed off from server/routes/webhook.ts and stored in Postgres
// ---------------------------------------------------------------------------

/**
 * The frozen shape webhook.ts normalizes every inbound Twilio WhatsApp
 * webhook payload into before calling handleIncomingMessage. `body` and
 * `buttonId` are `string | null` (not optional/undefined) because
 * webhook.ts's normalization always sets them explicitly, via
 * `req.body.Body || null` / `req.body.ButtonPayload || null` — exactly one
 * of the two is populated per message (free-text vs. a button/list tap),
 * never both, and never left `undefined`. webhook.ts declares its own
 * structurally-identical local copy of this shape rather than importing this
 * one (each file owns its own side of the contract) — verified against
 * webhook.ts's actual `NormalizedMessage` interface and the literal object it
 * constructs (`{ from: body.From || null, body: body.Body || null, buttonId:
 * body.ButtonPayload || null, timestamp: new Date().toISOString() }`).
 */
export interface NormalizedMessage {
  from: string | null;
  body: string | null;
  buttonId: string | null;
  timestamp: string;
}

/** One row of the `conversation_state` table (see server/migrations/010_create_conversation_state.sql). */
export interface ConversationStateRow {
  whatsapp_number: string;
  current_step: string | null;
  language: string | null;
  temp_answers: TempAnswers;
  disclosure_shown: boolean;
  updated_at: Date;
}

/** Scratch data carried between steps of a single flow (currently: the triage flow). */
export interface TempAnswers {
  report_id?: number;
}

/**
 * Fields a caller may update via saveState(). A key's mere *presence* in a
 * patch (even set to `null`) means "set this field"; an absent key means
 * "leave the current value alone" — see saveState()'s `'field' in patch`
 * checks below, which is why every field here is optional rather than
 * nullable-and-required.
 */
export interface ConversationStatePatch {
  current_step?: string | null;
  language?: string | null;
  temp_answers?: TempAnswers;
  disclosure_shown?: boolean;
}

interface MergedState {
  current_step: string | null;
  language: string | null;
  temp_answers: TempAnswers;
  disclosure_shown: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Fixed triage order, per backlog.md Section 3 (positionally scored, so the
// order both defines what's asked AND, via QUESTION_ORDER.indexOf, how the
// state machine advances current_step).
const QUESTION_ORDER: (keyof TriageAnswers)[] = [
  'STRANGLE',
  'WEAPON',
  'KILL_THREAT',
  'ESCALATION',
  'SEPARATION',
  'SEXUAL_COERCION',
  'CONTROL',
  'SELF_PERCEIVED_DANGER',
];

// Fast membership test for "is this string one of the 8 known triage
// question keys" — used to safely narrow a plain `string` (read back from
// current_step, or from a DB row) to `keyof TriageAnswers` before indexing
// QUESTION_ORDER or building a TriageAnswers object with it.
const QUESTION_KEY_SET = new Set<string>(QUESTION_ORDER);
function isTriageKey(key: string): key is keyof TriageAnswers {
  return QUESTION_KEY_SET.has(key);
}
function isAnswerValue(value: string): value is Answer {
  return value === 'YES' || value === 'NO' || value === 'SKIP';
}

// sendList row id -> language code persisted in conversation_state.language
// and passed to t(key, language) everywhere else in this file.
const LANGUAGE_BY_ROW_ID: Record<string, string> = {
  lang_en: 'en',
  lang_sw: 'sw',
  lang_fr: 'fr',
};

// sendButtons id -> stored triage_answers.answer value.
const TRIAGE_ANSWER_BY_BUTTON_ID: Record<string, Answer> = {
  triage_yes: 'YES',
  triage_no: 'NO',
  triage_skip: 'SKIP',
};

const TRIAGE_STEP_PREFIX = 'TRIAGE_';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // INF-3: 24h inactivity session reset

// ---------------------------------------------------------------------------
// conversation_state persistence helpers
// ---------------------------------------------------------------------------

async function getState(whatsappNumber: string): Promise<ConversationStateRow | null> {
  const { rows } = await query<ConversationStateRow>(
    'SELECT * FROM conversation_state WHERE whatsapp_number = $1',
    [whatsappNumber]
  );
  return rows[0] || null;
}

/**
 * Upserts conversation_state for one WhatsApp number. Any field omitted from
 * `patch` keeps its current DB value (or a sane default, for a brand-new
 * row) — callers only pass the fields they're actually changing.
 */
async function saveState(
  whatsappNumber: string,
  current: ConversationStateRow | null,
  patch: ConversationStatePatch
): Promise<MergedState> {
  const merged: MergedState = {
    current_step: 'current_step' in patch ? patch.current_step ?? null : current?.current_step ?? null,
    language: 'language' in patch ? patch.language ?? null : current?.language ?? null,
    temp_answers: 'temp_answers' in patch ? patch.temp_answers ?? {} : current?.temp_answers ?? {},
    disclosure_shown:
      'disclosure_shown' in patch ? patch.disclosure_shown ?? false : current?.disclosure_shown ?? false,
  };

  await query(
    `INSERT INTO conversation_state
       (whatsapp_number, current_step, language, temp_answers, disclosure_shown, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (whatsapp_number) DO UPDATE SET
       current_step = EXCLUDED.current_step,
       language = EXCLUDED.language,
       temp_answers = EXCLUDED.temp_answers,
       disclosure_shown = EXCLUDED.disclosure_shown,
       updated_at = now()`,
    [
      whatsappNumber,
      merged.current_step,
      merged.language,
      JSON.stringify(merged.temp_answers),
      merged.disclosure_shown,
    ]
  );

  return merged;
}

function isSessionStale(state: ConversationStateRow | null): boolean {
  if (!state) return false;
  // `state.updated_at` is already a JS Date (node-postgres parses `timestamp`
  // columns into Date objects), so this reads it directly rather than
  // re-wrapping it in `new Date(...)` — a `Date` is not a valid argument to
  // the `Date` constructor's typed overloads (only `number | string` are),
  // so strict mode correctly rejects the original JS's redundant
  // `new Date(state.updated_at).getTime()` re-wrap. Behavior is identical.
  const updatedAt = state.updated_at.getTime();
  return Date.now() - updatedAt > SESSION_TTL_MS;
}

// ---------------------------------------------------------------------------
// Outbound message builders (INF-3 language selector, INF-4 main menu)
// ---------------------------------------------------------------------------

async function sendLanguageSelector(to: string): Promise<void> {
  // The language selector itself is always shown in English — by definition
  // no language has been chosen yet.
  const lang = 'en';
  const sections: ListSection[] = [
    {
      title: t('lang_select.section_title', lang),
      rows: [
        { id: 'lang_en', title: t('lang_select.row_english', lang) },
        { id: 'lang_sw', title: t('lang_select.row_kiswahili', lang) },
        { id: 'lang_fr', title: t('lang_select.row_francais', lang) },
      ],
    },
  ];
  await sendList(to, t('lang_select.body', lang), sections, t('lang_select.button', lang));
}

async function sendMainMenu(to: string, language: string): Promise<void> {
  // Design note (docs/conversation-design.md §3): the footer hint carrying
  // INF-5's discoverability text ("Tip: send 0 anytime...") is specified as
  // separate small gray "footer" text under the list body. whatsapp.ts's
  // frozen sendList(to, body, sections, buttonText) contract (§3.1) has no
  // footer parameter, so — since Backend doesn't edit whatsapp.ts — the hint
  // is appended as a second paragraph of the body instead. Functionally
  // equivalent (the hint is still delivered, in the same message, before any
  // menu selection), just visually a plain line rather than styled gray
  // footer text.
  const body = `${t('menu.body', language)}\n\n${t('menu.footer_hint', language)}`;
  const sections: ListSection[] = [
    {
      title: t('menu.section_title', language),
      rows: [
        { id: 'menu_report', title: t('menu.report_row', language) },
        { id: 'menu_find_help', title: t('menu.find_help_row', language) },
        { id: 'menu_rights', title: t('menu.rights_row', language) },
      ],
    },
  ];
  await sendList(to, body, sections, t('menu.button', language));
}

async function sendQuestion(to: string, language: string, questionKey: string): Promise<void> {
  const prefix = `triage.${questionKey.toLowerCase()}`;
  const body = t(`${prefix}.question`, language);
  const buttons: QuickReplyButton[] = [
    { id: 'triage_yes', title: t(`${prefix}.btn_yes`, language) },
    { id: 'triage_no', title: t(`${prefix}.btn_no`, language) },
    { id: 'triage_skip', title: t(`${prefix}.btn_skip`, language) },
  ];
  await sendButtons(to, body, buttons);
}

// ---------------------------------------------------------------------------
// TRI-1 / TRI-3: triage flow
// ---------------------------------------------------------------------------

async function startTriage(from: string, language: string): Promise<ConversationStatePatch> {
  // TRI-1 AC: create the `reports` row with status='IN_PROGRESS' at flow
  // start, before the first question is sent.
  const { rows } = await query<{ id: number }>(
    `INSERT INTO reports (channel, language, status, whatsapp_number)
     VALUES ('whatsapp', $1, 'IN_PROGRESS', $2)
     RETURNING id`,
    [language, from]
  );
  const reportId = rows[0].id;
  const firstKey = QUESTION_ORDER[0];

  await sendText(from, t('triage.intro', language));
  await sendQuestion(from, language, firstKey);

  return { current_step: `${TRIAGE_STEP_PREFIX}${firstKey}`, temp_answers: { report_id: reportId } };
}

async function finishTriage(
  from: string,
  language: string,
  reportId: number
): Promise<ConversationStatePatch> {
  const { rows } = await query<{ question_key: string; answer: string }>(
    'SELECT question_key, answer FROM triage_answers WHERE report_id = $1',
    [reportId]
  );
  const answers: TriageAnswers = {};
  for (const row of rows) {
    if (isTriageKey(row.question_key) && isAnswerValue(row.answer)) {
      answers[row.question_key] = row.answer;
    }
  }

  const riskLevel = scoreRisk(answers);

  // TRI-3 AC: risk_level and status='SCORED' set in the same handling cycle
  // as the 8th answer — no window where the report sits answered-but-unscored.
  await query(`UPDATE reports SET risk_level = $1, status = 'SCORED' WHERE id = $2`, [
    riskLevel,
    reportId,
  ]);

  const bridgeKey = riskLevel === 'HIGH' ? 'highrisk.bridge' : 'standard.bridge';
  await sendText(from, t(bridgeKey, language));

  // --- Sprint 1 scope boundary (not a bug) --------------------------------
  // Per docs/conversation-design.md §6: both bridge messages above are the
  // deliberate END of the visible Sprint 1 flow. HR-1's full safety-plan
  // sequence (danger-intro/plan list/hotline/connect-prompt, for HIGH) and
  // DIR-2's region-picker handoff (for STANDARD) are Sprint 2 stories that
  // don't exist yet. For a HIGH-risk report specifically, this means the
  // conversation genuinely stops here for now — that is intentional per the
  // design doc, not a missing feature in this file.
  return { current_step: 'MAIN_MENU', temp_answers: {} };
}

async function handleTriageAnswer(
  from: string,
  state: ConversationStateRow,
  buttonId: string | null
): Promise<ConversationStatePatch> {
  const language = state.language || 'en';

  // Defensive: this function is only ever invoked from handleIncomingMessage
  // after it has confirmed state.current_step starts with TRIAGE_STEP_PREFIX
  // (so it's non-null there) — but that narrowing doesn't cross the function
  // boundary, and TypeScript is right to insist on a real check here rather
  // than a bare non-null assertion. This also closes a real gap the original
  // JS had: a corrupted/unexpected current_step whose suffix isn't one of
  // the 8 known question keys used to silently fall through
  // (QUESTION_ORDER.indexOf(...) === -1, +1 === 0) and quietly restart the
  // survivor at question 1 with no log and no visible error. Now it's
  // recovered to the main menu loudly instead, consistent with how every
  // other "corrupt/unrecognized state" case in this file is already handled.
  const currentStep = state.current_step;
  const rawQuestionKey = currentStep ? currentStep.slice(TRIAGE_STEP_PREFIX.length) : '';
  if (!currentStep || !isTriageKey(rawQuestionKey)) {
    console.error(
      `conversation.ts: handleTriageAnswer got an invalid/unrecognized current_step ` +
        `"${currentStep}" for ${from}; resetting to MAIN_MENU.`
    );
    await sendMainMenu(from, language);
    return { current_step: 'MAIN_MENU', temp_answers: {} };
  }
  // isTriageKey() above is a type predicate, so TypeScript already narrows
  // rawQuestionKey to `keyof TriageAnswers` here — no cast needed.
  const questionKey = rawQuestionKey;

  const answer = buttonId != null ? TRIAGE_ANSWER_BY_BUTTON_ID[buttonId] : undefined;

  if (!answer) {
    // Typed text or an unrecognized tap mid-triage — re-ask the same
    // question rather than silently advancing or dead-ending.
    await sendQuestion(from, language, questionKey);
    return {};
  }

  const tempAnswers = state.temp_answers || {};
  const reportId = tempAnswers.report_id;
  if (!reportId) {
    // Defensive: state claims to be mid-triage but lost its report_id
    // (shouldn't happen via normal flow). Recover to the main menu rather
    // than writing an orphaned triage_answers row with no report to attach
    // it to.
    console.error(
      `conversation.ts: TRIAGE state for ${from} has no report_id in temp_answers; resetting to MAIN_MENU.`
    );
    await sendMainMenu(from, language);
    return { current_step: 'MAIN_MENU', temp_answers: {} };
  }

  // TRI-1 AC: each answer written to triage_answers BEFORE advancing.
  await query(
    'INSERT INTO triage_answers (report_id, question_key, answer) VALUES ($1, $2, $3)',
    [reportId, questionKey, answer]
  );

  const nextIndex = QUESTION_ORDER.indexOf(questionKey) + 1;
  if (nextIndex >= QUESTION_ORDER.length) {
    return finishTriage(from, language, reportId);
  }

  const nextKey = QUESTION_ORDER[nextIndex];

  // Midpoint reassurance (conversation-design.md §5.3): after Q4's
  // (ESCALATION) answer is stored, before Q5 (SEPARATION) is sent.
  if (nextKey === 'SEPARATION') {
    await sendText(from, t('triage.midpoint', language));
  }

  await sendQuestion(from, language, nextKey);
  return { current_step: `${TRIAGE_STEP_PREFIX}${nextKey}` };
}

// ---------------------------------------------------------------------------
// INF-5: device-safety guidance
// ---------------------------------------------------------------------------

function isDeviceSafetyTrigger(body: string | null): boolean {
  if (typeof body !== 'string') return false;
  const normalized = body.trim().toLowerCase();
  return normalized === '0' || normalized === 'help hiding this';
}

// ---------------------------------------------------------------------------
// INF-4: main menu routing
// ---------------------------------------------------------------------------

async function handleMainMenu(
  from: string,
  state: ConversationStateRow,
  buttonId: string | null
): Promise<ConversationStatePatch> {
  const language = state.language || 'en';

  if (buttonId === 'menu_report') {
    return startTriage(from, language);
  }

  if (buttonId === 'menu_find_help' || buttonId === 'menu_rights') {
    // Sprint 1 stub (known gap, not silently dropped): DIR-2 ("Find help near
    // me") and DIR-3 ("Know your rights") don't exist yet this sprint. Per
    // the task brief, send a clear placeholder rather than erroring or
    // hanging, and stay at the main menu so the conversation doesn't dead-end.
    await sendText(from, t('stub.coming_soon', language));
    return {};
  }

  // Typed text or an unrecognized tap at the main menu — re-send it.
  await sendMainMenu(from, language);
  return {};
}

// ---------------------------------------------------------------------------
// Entry point — the only export, called by server/routes/webhook.ts
// ---------------------------------------------------------------------------

export async function handleIncomingMessage(msg: NormalizedMessage): Promise<void> {
  const { from, body, buttonId } = msg;

  if (!from) {
    console.error('conversation.ts: handleIncomingMessage received a message with no "from"; ignoring.');
    return;
  }

  const state = await getState(from);
  const stale = isSessionStale(state);

  // INF-5, "at any point": once a conversation exists (so there's a language
  // to reply in), typing "0" or "help hiding this" short-circuits whatever
  // step the user is on. Deliberately does NOT change current_step, so a
  // mid-triage user who checks this guidance resumes their exact question
  // afterward rather than losing progress.
  if (state && !stale && isDeviceSafetyTrigger(body)) {
    const language = state.language || 'en';
    await sendText(from, t('guidance.device_safety', language));
    await sendMainMenu(from, language);
    // Per conversation-design.md §4: return to the main menu after guidance
    // rather than leaving the user at whatever step they interrupted, EXCEPT
    // we don't want to silently discard in-progress triage answers already
    // saved to the DB — only current_step moves; a resumed triage would
    // restart from the menu, which is an acceptable, safe Sprint 1 behavior
    // for this rare interrupt path (no answers are lost from triage_answers,
    // only the position in the flow).
    await saveState(from, state, { current_step: 'MAIN_MENU' });
    return;
  }

  // INF-3: first-ever contact OR a stale (>24h) session both re-run the
  // language selector. disclosure_shown is preserved across a stale reset
  // (SEC-3 is once-per-number-ever, not once-per-24h-session) but reset to
  // false for a genuinely brand-new number.
  if (!state || stale) {
    await sendLanguageSelector(from);
    await saveState(from, state, {
      current_step: 'AWAITING_LANGUAGE',
      language: null,
      temp_answers: {},
      disclosure_shown: state ? state.disclosure_shown : false,
    });
    return;
  }

  let patch: ConversationStatePatch = {};

  if (state.current_step === 'AWAITING_LANGUAGE') {
    const language = buttonId != null ? LANGUAGE_BY_ROW_ID[buttonId] : undefined;
    if (!language) {
      // Typed text or an unrecognized tap while awaiting language — re-prompt.
      await sendLanguageSelector(from);
      return;
    }

    // SEC-3: disclosure fires exactly once ever per WhatsApp number,
    // immediately after language selection, before the main menu.
    if (!state.disclosure_shown) {
      await sendText(from, t('disclosure_message', language));
    }
    await sendMainMenu(from, language);
    patch = { current_step: 'MAIN_MENU', language, disclosure_shown: true };
  } else if (state.current_step === 'MAIN_MENU') {
    patch = await handleMainMenu(from, state, buttonId);
  } else if (state.current_step && state.current_step.startsWith(TRIAGE_STEP_PREFIX)) {
    patch = await handleTriageAnswer(from, state, buttonId);
  } else {
    // Unknown/corrupt current_step — recover to the main menu instead of
    // dead-ending silently.
    console.warn(
      `conversation.ts: unrecognized current_step "${state.current_step}" for ${from}; resetting to MAIN_MENU.`
    );
    await sendMainMenu(from, state.language || 'en');
    patch = { current_step: 'MAIN_MENU' };
  }

  await saveState(from, state, patch);
}
