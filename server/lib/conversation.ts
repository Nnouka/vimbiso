// server/lib/conversation.ts
//
// Backend-owned. Sprint 1 implemented INF-3 (state machine + language
// selector), INF-4 (main menu), INF-5 (device-safety guidance), TRI-1
// (8-question triage flow) and TRI-3 (wire scoring into the flow) — all of
// that is unchanged below. Sprint 2 EXTENDS this same state machine (per
// sprint-2-plan.md §6: "extends conversation.ts with new branches, it does
// not rewrite Sprint 1's flow") with: HR-1 (immediate safety-plan sequence
// on HIGH), HR-2 (counsellor-connect + SMS alert logging), HR-3 (trusted-
// contact registration, the main menu's 4th option), HR-4 (trusted-contact
// alert), DIR-2 (region picker), DIR-3 (rights content), and PW-1 (consent-
// gated perpetrator-naming prompt, calling into patternMatch.ts for PW-2).
// Sprint 1's stub branches (which used to dead-end HIGH-risk reports at the
// bridge message and stub out "Find help"/"Know your rights") are gone now
// that the real Sprint 2 stories exist — see the comments at each replaced
// call site for exactly what changed.
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
import { normalizeAndHash } from './hashing';
import { recordAndCheckPattern } from './patternMatch';
import { alertOnCallCounsellors } from './sms';

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

// Real bug found during live Twilio Sandbox testing (2026-09-15): a survivor
// tapping "English" in the language-selector LIST message got re-shown the
// same selector forever, exactly like the earlier stuck-at-language-select
// bug INF-3's status note already documents — but this time server/routes/
// webhook.ts's own diagnostic log (added for that earlier bug) proved it is
// NOT the same cause. It printed `ButtonPayload=undefined ... InteractiveData
// =undefined resolvedButtonId=null` — every interactive field genuinely
// empty — while `Body` was literally `"lang_en"`: the row's own internal id,
// not its display title ("English") and not anything a survivor would type.
// The only explanation consistent with that evidence: on the free Twilio
// WhatsApp Sandbox, this app's `twilio/list-picker` messages (sendList(), in
// whatsapp.ts — whose own header already flagged this content type as "NOT
// VERIFIED LIVE... the second-highest-risk area of this file") are not
// arriving at WhatsApp as genuinely interactive at all; whatever the
// survivor's client does when "selecting" a row, Twilio's webhook reports it
// as an ordinary text message whose body happens to be the row's id.
//
// Rather than guess further at Sandbox internals with no way to reach a live
// Twilio account from this build environment, this is handled where it's
// actually observable and testable: every literal id this file hands to
// sendButtons()/sendList() as a row/button `id` is collected here once, and
// handleIncomingMessage() below promotes an inbound plain-text Body that
// exactly matches one of them to a real buttonId, before any step handler
// ever sees it — so a genuine button/list tap and a degraded-to-text one are
// indistinguishable to every step handler in this file. Every id here is an
// internal, code-only snake_case token no survivor would plausibly type as
// real free text (their actual free-typed replies — a disclosure, a typed
// trusted-contact number, a Pattern Watch identifier — go through completely
// different code paths that never call this function), so this promotion
// carries effectively zero risk of misreading real survivor text as a tap.
// This list MUST be kept in sync by hand with every `{ id: '...', ... }`
// literal below — there is no single source of truth to derive it from
// automatically, so a new button/list id added anywhere in this file needs
// adding here too, or it will silently keep this exact bug alive for that
// one new screen.
const KNOWN_INTERACTIVE_IDS = new Set<string>([
  'lang_en',
  'lang_sw',
  'lang_fr',
  'menu_report',
  'menu_find_help',
  'menu_rights',
  'menu_trusted_contact',
  'triage_yes',
  'triage_no',
  'triage_skip',
  'connect_yes',
  'connect_no',
  'region_nairobi',
  'region_mombasa',
  'region_other',
  'pw_consent_yes',
  'pw_consent_no',
]);

// sendButtons id -> stored triage_answers.answer value.
const TRIAGE_ANSWER_BY_BUTTON_ID: Record<string, Answer> = {
  triage_yes: 'YES',
  triage_no: 'NO',
  triage_skip: 'SKIP',
};

const TRIAGE_STEP_PREFIX = 'TRIAGE_';

// Real feedback from Nnouka (2026-09-15): "not all users may understand
// that they need to click and select, they may actually just send the
// number representing the option... the app should understand the option
// selected too." This is a second, complementary robustness fix to
// KNOWN_INTERACTIVE_IDS's promotion above — related but distinct. That one
// promotes a plain-text Body that happens to equal an internal id (a
// Sandbox-degradation artifact); this one promotes a plain-text Body that is
// just the 1-indexed POSITION of an option in whatever numbered list this
// exact step last sent (a survivor typing "1" instead of tapping the first
// row/button) — a survivor typing a bare digit would never match an internal
// snake_case id, so KNOWN_INTERACTIVE_IDS's set can't cover this case, and a
// digit's meaning is inherently relative to the current step (it has to be
// looked up against the step's own list, never treated as a global id).
//
// AWAITING_TRUSTED_CONTACT_NUMBER and AWAITING_PW_IDENTIFIER are
// deliberately NOT listed below (and numberedOptionsForStep() returns null
// for both): both expect genuine free-typed text (a phone number, a
// perpetrator identifier) where a bare digit is very plausibly real survivor
// input, not a menu choice — silently reinterpreting it as one would corrupt
// or drop that input, which is far worse than leaving a rare miskeyed menu
// digit unrecognized.
const NUMBERED_OPTIONS_BY_STEP: Record<string, string[]> = {
  AWAITING_LANGUAGE: ['lang_en', 'lang_sw', 'lang_fr'],
  MAIN_MENU: ['menu_report', 'menu_find_help', 'menu_rights', 'menu_trusted_contact'],
  AWAITING_CONNECT_RESPONSE: ['connect_yes', 'connect_no'],
  AWAITING_REGION: ['region_nairobi', 'region_mombasa', 'region_other'],
  AWAITING_PW_CONSENT: ['pw_consent_yes', 'pw_consent_no'],
};

// Every TRIAGE_<question> step (see TRIAGE_STEP_PREFIX above) sends the same
// 3 buttons regardless of which of the 8 questions is being asked, so this
// is one shared list rather than duplicating it per question key.
const TRIAGE_NUMBERED_OPTIONS = ['triage_yes', 'triage_no', 'triage_skip'];

/**
 * Returns the ordered option-id list a survivor was just shown for
 * `currentStep`, or `null` if that step doesn't present a numbered list at
 * all — including AWAITING_TRUSTED_CONTACT_NUMBER and AWAITING_PW_IDENTIFIER,
 * deliberately excluded above, and any other/unknown step.
 */
function numberedOptionsForStep(currentStep: string | null): string[] | null {
  if (!currentStep) return null;
  if (currentStep.startsWith(TRIAGE_STEP_PREFIX)) return TRIAGE_NUMBERED_OPTIONS;
  return NUMBERED_OPTIONS_BY_STEP[currentStep] || null;
}
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // INF-3: 24h inactivity session reset

// Sprint 2 conversation_state.current_step values (INF-3's state machine
// pattern extended, not replaced — see file header). Kept as plain string
// literals, matching this file's existing style for 'MAIN_MENU' /
// 'AWAITING_LANGUAGE' above, rather than introducing named constants only
// for the new steps.
//   AWAITING_TRUSTED_CONTACT_NUMBER — HR-3, expects free-text phone number
//   AWAITING_CONNECT_RESPONSE       — HR-1/HR-2, expects connect_yes/connect_no
//   AWAITING_REGION                 — DIR-2, expects a region_* row tap
//   AWAITING_PW_CONSENT             — PW-1, expects pw_consent_yes/pw_consent_no
//   AWAITING_PW_IDENTIFIER          — PW-1, expects free-text identifier

// --- DEVIATION FLAGGED PER CONTRIBUTING.md ("flag it, don't silently
// absorb") -------------------------------------------------------------
// sprint-2-plan.md §4's content-key list gives body-text keys for the HR-1
// connect prompt and PW-1 consent prompt (`highrisk.connect_prompt` /
// `pw.consent_prompt`) but — unlike TRI-1's per-question buttons, which each
// have their own `triage.<q>.btn_yes/btn_no/btn_skip` keys — never lists a
// content key for either prompt's own Yes/No BUTTON LABELS (conversation-
// design.md §8.4/§12's tables show the literal button text "Yes"/"No" in a
// "Button label" column, same as §5's triage table does, but §14's actual
// content-key table only carries the prompt/ack keys, not button-label
// keys). Same gap exists for DIR-2's region-picker list-button text ("Choose
// an area") and its list section title — §10 shows the literal text but
// §14 has no key for either. Rather than hardcode these four short UI-chrome
// strings in this file (which would silently reopen LANG-1's "zero
// hardcoded user-facing strings" DoD gap) or invent an unlisted key without
// saying so, four small new keys are added here, seeded in content_en.ts,
// and flagged loudly in this comment and in the PR/report per this
// deviation-flagging rule: `common.btn_yes`, `common.btn_no`,
// `dir.region_button`, `dir.region_section_title`. If Designer would rather
// name these differently, that's a trivial content-only follow-up — nothing
// else depends on the key names themselves.
const BTN_YES = 'common.btn_yes';
const BTN_NO = 'common.btn_no';

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
  // Sprint 2 (sprint-2-plan.md §3.3): a 4th row is additive here — the
  // existing 3 options/keys/routing are unchanged. menu.body's STORED VALUE
  // gains a 4th line (seeded in content_en.ts) even though its key name
  // doesn't change; see conversation-design.md §13.
  const body = `${t('menu.body', language)}\n\n${t('menu.footer_hint', language)}`;
  const sections: ListSection[] = [
    {
      title: t('menu.section_title', language),
      rows: [
        { id: 'menu_report', title: t('menu.report_row', language) },
        { id: 'menu_find_help', title: t('menu.find_help_row', language) },
        { id: 'menu_rights', title: t('menu.rights_row', language) },
        { id: 'menu_trusted_contact', title: t('menu.trusted_contact_row', language) },
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
// DIR-1 support: resources lookups (DIR-1's own seed lives in
// server/seeds/resources_kenya.ts — this file only ever reads that table, per
// HR-1/DIR-2's technical notes: "hotline number queried from resources... at
// send time, never hardcoded").
// ---------------------------------------------------------------------------

/** The subset of `resources` columns HR-1/DIR-2 actually render. */
interface ResourceRow {
  name: string | null;
  phone: string | null;
  source_name: string | null;
  last_verified_date: Date | string | null;
}

async function fetchNationalHotlineResource(): Promise<ResourceRow | null> {
  const { rows } = await query<ResourceRow>(
    `SELECT name, phone, source_name, last_verified_date
     FROM resources
     WHERE country = 'KE' AND category = 'hotline'
     ORDER BY id
     LIMIT 1`
  );
  return rows[0] || null;
}

async function fetchRegionResource(region: string): Promise<ResourceRow | null> {
  const { rows } = await query<ResourceRow>(
    `SELECT name, phone, source_name, last_verified_date
     FROM resources
     WHERE country = 'KE' AND region = $1
     ORDER BY id
     LIMIT 1`,
    [region]
  );
  return rows[0] || null;
}

/**
 * Renders `last_verified_date` as `12 Sep 2026` (conversation-design.md
 * §10.1: "should render as... a human-readable form... not a raw ISO
 * timestamp"), not a new content key — a formatting detail, per that section.
 */
function formatVerifiedDate(value: Date | string | null): string {
  if (!value) return 'unknown date';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown date';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// HR-1: immediate safety-plan sequence (fires automatically on risk_level=HIGH,
// continuing the SAME handling cycle as the 8th triage answer — see
// finishTriage() below; per conversation-design.md §8, no pause is inserted
// between highrisk.bridge, already sent by finishTriage, and this sequence).
// ---------------------------------------------------------------------------

async function sendHighRiskSafetyPlan(to: string, language: string): Promise<void> {
  await sendText(to, t('highrisk.intro', language));

  // conversation-design.md §8.2: one message, all 4 items, fixed numbered
  // order — not 4 separate sends.
  const planLines = [1, 2, 3, 4].map((n) => `${n}. ${t(`highrisk.plan_${n}`, language)}`);
  await sendText(to, planLines.join('\n'));

  // §8.3: hotline number queried live, never hardcoded. If the resources
  // table has no hotline row yet (DIR-1 seed not run / DB issue), log loudly
  // and skip this one message rather than guess a number — DIR-1's sourcing
  // guarantee must hold even in this failure mode, per the design doc's
  // explicit instruction.
  const hotline = await fetchNationalHotlineResource();
  if (!hotline || !hotline.phone) {
    console.error(
      'conversation.ts: HR-1 found no resources row for category=hotline, country=KE — ' +
        'has server/seeds/resources_kenya.ts been run? Skipping the hotline message ' +
        '(never falling back to a guessed number, per DIR-1).'
    );
  } else {
    const prefixTemplate = t('highrisk.hotline_prefix', language);
    await sendText(to, prefixTemplate.replace('{{hotline_number}}', hotline.phone));
  }
}

async function sendConnectPrompt(to: string, language: string): Promise<void> {
  await sendButtons(to, t('highrisk.connect_prompt', language), [
    { id: 'connect_yes', title: t(BTN_YES, language) },
    { id: 'connect_no', title: t(BTN_NO, language) },
  ]);
}

/**
 * HR-4: sends the fixed, verbatim check-in message to a survivor's registered
 * trusted contact, if one exists — silently no-ops otherwise (backlog.md
 * HR-4 AC). Never throws out of the caller's flow: a failed contact alert
 * must not prevent the rest of HR-1's sequence (connect ack, PW-1 prompt)
 * from reaching the survivor.
 */
async function maybeAlertTrustedContact(survivorWhatsappNumber: string): Promise<void> {
  let contact: { id: number; contact_whatsapp_number: string } | undefined;
  try {
    const { rows } = await query<{ id: number; contact_whatsapp_number: string }>(
      'SELECT id, contact_whatsapp_number FROM trusted_contacts WHERE survivor_whatsapp_number = $1',
      [survivorWhatsappNumber]
    );
    contact = rows[0];
  } catch (err) {
    console.error('conversation.ts: HR-4 trusted_contacts lookup failed:', err);
    return;
  }

  if (!contact) {
    return; // HR-4 AC: no contact registered -> silent no-op, no message to anyone.
  }

  try {
    // trusted_contact.alert_message is intentionally NOT translated (fixed
    // verbatim per HR-4's AC and conversation-design.md §9.4/§15 — Designer
    // explicitly did not draft translated variants for Sprint 2), so this is
    // always looked up in English regardless of the survivor's own language.
    await sendText(contact.contact_whatsapp_number, t('trusted_contact.alert_message', 'en'));
    await query('UPDATE trusted_contacts SET alert_sent_at = now() WHERE id = $1', [contact.id]);
  } catch (err) {
    console.error(
      `conversation.ts: HR-4 failed to alert trusted contact for survivor ${survivorWhatsappNumber}:`,
      err
    );
  }
}

// ---------------------------------------------------------------------------
// DIR-2: "Find Help" region picker (reachable from the main menu directly, or
// automatically after a STANDARD-risk outcome — same picker, distinguished
// by whether temp_answers.report_id is set; see handleRegionSelection()).
// ---------------------------------------------------------------------------

async function sendRegionPicker(to: string, language: string): Promise<void> {
  const sections: ListSection[] = [
    {
      title: t('dir.region_section_title', language),
      rows: [
        { id: 'region_nairobi', title: t('dir.region_nairobi', language) },
        { id: 'region_mombasa', title: t('dir.region_mombasa', language) },
        { id: 'region_other', title: t('dir.region_other', language) },
      ],
    },
  ];
  await sendList(to, t('dir.region_prompt', language), sections, t('dir.region_button', language));
}

const REGION_NAME_BY_ROW_ID: Record<string, string> = {
  region_nairobi: 'Nairobi',
  region_mombasa: 'Mombasa',
  // 'region_other' has no specific region row in `resources` by design (DIR-2's
  // AC: "Other-National" always resolves to the national hotline fallback).
};

/**
 * Resolves a region row tap to a real `resources` entry and sends DIR-2's
 * exact 3-line result format. Falls back to the national hotline if there's
 * no region-specific match (DIR-2 AC) — including for `region_other`, which
 * has no region-specific row by design.
 */
async function sendRegionResult(to: string, language: string, regionRowId: string): Promise<void> {
  const regionName = REGION_NAME_BY_ROW_ID[regionRowId];
  let resource: ResourceRow | null = regionName ? await fetchRegionResource(regionName) : null;

  if (!resource) {
    resource = await fetchNationalHotlineResource();
  }

  if (!resource || !resource.name || !resource.phone) {
    // Should not happen once DIR-1's seed has run (it seeds >=1 Nairobi
    // resource and the national hotline) — logged loudly rather than
    // sending any hardcoded/guessed resource text, per DIR-1's sourcing
    // guarantee.
    console.error(
      `conversation.ts: DIR-2 found no usable resources row for region="${regionName || regionRowId}" ` +
        `or the national hotline fallback — has server/seeds/resources_kenya.ts been run?`
    );
    return;
  }

  const template = t('dir.result_format', language);
  const body = template
    .replace('{name}', resource.name)
    .replace('{phone}', resource.phone)
    .replace('{source_name}', resource.source_name || 'unknown source')
    .replace('{date}', formatVerifiedDate(resource.last_verified_date));
  await sendText(to, body);
}

// ---------------------------------------------------------------------------
// DIR-3: "Know your rights" example content
// ---------------------------------------------------------------------------

async function sendRightsContent(to: string, language: string): Promise<void> {
  // conversation-design.md §11: disclaimer first, then the points, ALL in one
  // message, so the disclaimer can never be scrolled past or truncated away
  // from the content it qualifies.
  const body = [
    t('rights.disclaimer', language),
    '',
    `1. ${t('rights.point_1', language)}`,
    `2. ${t('rights.point_2', language)}`,
    `3. ${t('rights.point_3', language)}`,
  ].join('\n');
  await sendText(to, body);
}

// ---------------------------------------------------------------------------
// PW-1: optional consent-gated perpetrator-naming prompt (fires once HR-1's
// sequence or DIR-2's picker completes for a scored report — see
// runHighRiskSequence()/handleRegionSelection() below).
// ---------------------------------------------------------------------------

async function sendPwConsentPrompt(to: string, language: string): Promise<void> {
  await sendButtons(to, t('pw.consent_prompt', language), [
    { id: 'pw_consent_yes', title: t(BTN_YES, language) },
    { id: 'pw_consent_no', title: t(BTN_NO, language) },
  ]);
}

async function advanceToPwConsent(
  to: string,
  language: string,
  reportId: number
): Promise<ConversationStatePatch> {
  await sendPwConsentPrompt(to, language);
  return { current_step: 'AWAITING_PW_CONSENT', temp_answers: { report_id: reportId } };
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

  // --- Sprint 2: HR-1 (HIGH) / DIR-2 (STANDARD) continue in the SAME
  // handling cycle as the 8th triage answer, per conversation-design.md §8
  // ("no pause, no 'are you ready?' gate between highrisk.bridge and this
  // sequence") and §10 (DIR-2 "automatically offered as the next step after
  // a STANDARD-risk outcome"). This replaces Sprint 1's stub, which
  // deliberately ended the visible conversation at the bridge message above
  // — that stub is gone now that HR-1/DIR-1/DIR-2 exist.
  if (riskLevel === 'HIGH') {
    return runHighRiskSequence(from, language, reportId);
  }
  return runStandardRiskSequence(from, language, reportId);
}

/**
 * HR-1's full safety-plan sequence, in order: danger-intro, 4-item plan,
 * hotline number, Yes/No connect prompt. Ends by awaiting the connect tap
 * (handleConnectResponse), which itself chains into HR-2/HR-4 and then PW-1.
 */
async function runHighRiskSequence(
  from: string,
  language: string,
  reportId: number
): Promise<ConversationStatePatch> {
  await sendHighRiskSafetyPlan(from, language);
  await sendConnectPrompt(from, language);
  return { current_step: 'AWAITING_CONNECT_RESPONSE', temp_answers: { report_id: reportId } };
}

/**
 * DIR-2's region picker, offered automatically as the STANDARD-risk report's
 * next step. temp_answers.report_id is kept through the region selection so
 * handleRegionSelection() knows to chain into PW-1 afterward (vs. a
 * menu-triggered DIR-2 lookup, which has no report to consent for).
 */
async function runStandardRiskSequence(
  from: string,
  language: string,
  reportId: number
): Promise<ConversationStatePatch> {
  await sendRegionPicker(from, language);
  return { current_step: 'AWAITING_REGION', temp_answers: { report_id: reportId } };
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
// HR-2: counsellor-connect response (Yes/No, after HR-1's connect prompt)
// ---------------------------------------------------------------------------

async function handleConnectResponse(
  from: string,
  state: ConversationStateRow,
  buttonId: string | null
): Promise<ConversationStatePatch> {
  const language = state.language || 'en';
  const reportId = state.temp_answers?.report_id;

  if (!reportId) {
    // Defensive: mirrors handleTriageAnswer's "lost report_id" recovery below.
    console.error(
      `conversation.ts: AWAITING_CONNECT_RESPONSE state for ${from} has no report_id in ` +
        `temp_answers; resetting to MAIN_MENU.`
    );
    await sendMainMenu(from, language);
    return { current_step: 'MAIN_MENU', temp_answers: {} };
  }

  if (buttonId !== 'connect_yes' && buttonId !== 'connect_no') {
    // Typed text or an unrecognized tap — re-ask, same pattern as
    // handleTriageAnswer's unrecognized-answer branch.
    await sendConnectPrompt(from, language);
    return {};
  }

  if (buttonId === 'connect_yes') {
    // HR-2 AC: wants_counsellor_connect=true, connect_requested_at set, a
    // sms_alerts row written per recipient, and a real Twilio SMS sent via
    // alertOnCallCounsellors() — never hand-formatted here (sprint-2-plan.md
    // §3.2: "it does not hand-format the SMS body itself").
    //
    // HR-5: this used to call the singular alertOnCallCounsellor() and write
    // exactly one sms_alerts row against a single hardcoded env-var number.
    // It now calls the plural alertOnCallCounsellors(), which alerts every
    // counsellor_users row with is_on_call=true (falling back to the env var
    // only if none are configured — see sms.ts), and writes one sms_alerts
    // row per recipient so the audit trail reflects who was actually
    // notified, not just a single assumed number.
    await query(
      `UPDATE reports SET wants_counsellor_connect = true, connect_requested_at = now() WHERE id = $1`,
      [reportId]
    );

    try {
      const results = await alertOnCallCounsellors(reportId, 'HIGH');
      for (const result of results) {
        await query(
          `INSERT INTO sms_alerts (report_id, sent_to, sent_at, twilio_sid, status)
           VALUES ($1, $2, now(), $3, $4)`,
          [reportId, result.phone, result.sid, result.status]
        );
      }
    } catch (err) {
      // alertOnCallCounsellors() itself only throws for setup-level failures
      // (e.g. no on-call counsellor AND no ONCALL_COUNSELLOR_PHONE fallback
      // configured) since per-recipient send failures are caught inside it.
      // A failure here must still be visible in sms_alerts (so a counsellor
      // auditing the queue can see the alert didn't go out) and must not
      // prevent the survivor from getting her ack message below.
      console.error(`conversation.ts: alertOnCallCounsellors failed for report ${reportId}:`, err);
      await query(
        `INSERT INTO sms_alerts (report_id, sent_to, sent_at, twilio_sid, status)
         VALUES ($1, NULL, now(), NULL, 'failed')`,
        [reportId]
      );
    }

    await sendText(from, t('highrisk.connect_yes_ack', language));
  } else {
    // HR-2 AC: "No" tapped -> no SMS fires, hotline stays visible above (it
    // was already sent as part of HR-1's sequence — nothing more to do here).
    await sendText(from, t('highrisk.connect_no_ack', language));
  }

  // HR-4: fires (or silently no-ops) regardless of the Yes/No answer above —
  // it's gated on trusted-contact registration, not on the connect decision.
  await maybeAlertTrustedContact(from);

  // PW-1: fires once HR-1's whole sequence (including the connect ack and any
  // trusted-contact alert) has completed, per conversation-design.md §12's
  // trigger condition.
  return advanceToPwConsent(from, language, reportId);
}

// ---------------------------------------------------------------------------
// DIR-2: region selection response
// ---------------------------------------------------------------------------

const VALID_REGION_ROW_IDS = new Set(['region_nairobi', 'region_mombasa', 'region_other']);

async function handleRegionSelection(
  from: string,
  state: ConversationStateRow,
  buttonId: string | null
): Promise<ConversationStatePatch> {
  const language = state.language || 'en';

  if (!buttonId || !VALID_REGION_ROW_IDS.has(buttonId)) {
    // Typed text or an unrecognized tap — re-ask, same pattern used throughout
    // this file.
    await sendRegionPicker(from, language);
    return {};
  }

  const reportId = state.temp_answers?.report_id;

  // Persist the chosen region on the report row when this picker was reached
  // via a scored report's own closing flow (not the standalone main-menu
  // "Find help near me" lookup, which has no report to attach a region to).
  // Not required by any single Sprint 2 AC in isolation, but `reports.region`
  // exists in the schema (backlog.md Section 2) specifically for this, and
  // DASH-2's queue view renders it per report.
  if (reportId) {
    const regionName = REGION_NAME_BY_ROW_ID[buttonId] || 'Other/National';
    await query('UPDATE reports SET region = $1 WHERE id = $2', [regionName, reportId]);
  }

  await sendRegionResult(from, language, buttonId);

  if (reportId) {
    // Reached via a scored STANDARD report's closing flow — chain into PW-1,
    // per conversation-design.md §12's trigger condition ("...or DIR-2's
    // picker completes").
    return advanceToPwConsent(from, language, reportId);
  }

  // Reached directly from the main menu ("Find help near me") — no report to
  // consent for, so PW-1 does not apply here.
  return { current_step: 'MAIN_MENU', temp_answers: {} };
}

// ---------------------------------------------------------------------------
// PW-1: consent response, then the free-text identifier
// ---------------------------------------------------------------------------

async function handlePwConsentResponse(
  from: string,
  state: ConversationStateRow,
  buttonId: string | null
): Promise<ConversationStatePatch> {
  const language = state.language || 'en';
  const reportId = state.temp_answers?.report_id;

  if (!reportId) {
    console.error(
      `conversation.ts: AWAITING_PW_CONSENT state for ${from} has no report_id in temp_answers; ` +
        `resetting to MAIN_MENU.`
    );
    return { current_step: 'MAIN_MENU', temp_answers: {} };
  }

  if (buttonId !== 'pw_consent_yes' && buttonId !== 'pw_consent_no') {
    await sendPwConsentPrompt(from, language);
    return {};
  }

  if (buttonId === 'pw_consent_no') {
    // PW-1 AC: "no"/skip ends the flow — no perpetrator_hashes row, and
    // (per SEC-2) perpetrator_consent_given is never touched on this path.
    await sendText(from, t('pw.consent_no_ack', language));
    return { current_step: 'MAIN_MENU', temp_answers: {} };
  }

  // 'pw_consent_yes': conversation-design.md §12.1 — the ack message itself
  // is what asks the survivor to type the identifying text (the PM-approved
  // fold of both into pw.consent_yes_ack; see the file header / task notes —
  // sprint-2-plan.md §4 lists no separate "ask for text" key).
  await sendText(from, t('pw.consent_yes_ack', language));
  return { current_step: 'AWAITING_PW_IDENTIFIER', temp_answers: { report_id: reportId } };
}

async function handlePwIdentifier(
  from: string,
  state: ConversationStateRow,
  body: string | null
): Promise<ConversationStatePatch> {
  const language = state.language || 'en';
  const reportId = state.temp_answers?.report_id;

  if (!reportId) {
    console.error(
      `conversation.ts: AWAITING_PW_IDENTIFIER state for ${from} has no report_id in temp_answers; ` +
        `resetting to MAIN_MENU.`
    );
    return { current_step: 'MAIN_MENU', temp_answers: {} };
  }

  if (typeof body !== 'string' || !body.trim()) {
    // A button tap or empty message where free text was expected — re-prompt
    // once rather than silently treating a non-answer as either a skip or a
    // (nonexistent) identifier. Not explicitly covered by conversation-design.md
    // (the doc assumes the next message IS the identifier), but consistent
    // with this file's "don't silently guess" posture elsewhere.
    await sendText(from, t('pw.consent_yes_ack', language));
    return {};
  }

  // --- SEC-2 / SEC-1, safety-critical: read before touching this block ---
  // perpetrator_consent_given is set true HERE and ONLY here, in this one
  // code path, strictly gated behind the survivor's explicit "Yes" tap
  // handled in handlePwConsentResponse above — never anywhere else in this
  // file. It is set BEFORE the hash is written (not after), so a crash
  // between these two statements fails toward "consent recorded, no hash
  // row" rather than the reverse, which SEC-2's AC treats as the safe
  // direction ("perpetrator_consent_given is false/null" is the condition
  // that must gate hash writes, so it must never be false while a hash row
  // for this report already exists).
  await query(`UPDATE reports SET perpetrator_consent_given = true WHERE id = $1`, [reportId]);

  try {
    // normalizeAndHash (SEC-1) — raw text is NEVER passed to `query()` or
    // persisted anywhere; only its HMAC-SHA256 digest is. It throws on
    // punctuation-only/empty-after-normalize input or a missing
    // PERPETRATOR_HASH_SECRET — caught below so a bad/edge-case identifier
    // ends the flow cleanly instead of crashing the conversation. Per SEC-2,
    // no perpetrator_hashes row is written in that case either way.
    const hashValue = normalizeAndHash(body);
    await query(
      `INSERT INTO perpetrator_hashes (report_id, hash_value, algorithm) VALUES ($1, $2, 'HMAC-SHA256')`,
      [reportId, hashValue]
    );
    // PW-2: non-urgent, consent-gated cross-report matching — never blocks or
    // alters anything about the survivor's own case either way.
    await recordAndCheckPattern(reportId, hashValue);
  } catch (err) {
    console.error(`conversation.ts: PW-1 hashing/pattern-check failed for report ${reportId}:`, err);
  }

  return { current_step: 'MAIN_MENU', temp_answers: {} };
}

// ---------------------------------------------------------------------------
// HR-3: trusted-contact registration
// ---------------------------------------------------------------------------

/**
 * Loose validation per HR-3's technical note ("validate loosely — e.g.
 * starts with + and is mostly digits"): not full E.164/libphonenumber
 * validation, just enough to catch an obviously-incomplete paste and match
 * conversation-design.md §9.1's own example shape (+2547XXXXXXXX).
 */
function isPlausibleWhatsappNumber(text: string): boolean {
  return /^\+[0-9]{7,15}$/.test(text.trim());
}

async function handleTrustedContactNumber(
  from: string,
  state: ConversationStateRow,
  body: string | null
): Promise<ConversationStatePatch> {
  const language = state.language || 'en';

  if (typeof body !== 'string' || !isPlausibleWhatsappNumber(body)) {
    await sendText(from, t('trusted_contact.invalid_number', language));
    return {}; // stay on this step for a retry
  }

  const contactNumber = body.trim();

  // HR-3 AC: keyed to survivor_whatsapp_number, not report_id, so it persists
  // across future reports. "You can change this contact anytime by coming
  // back to this menu" (conversation-design.md §9.1) means a second
  // registration REPLACES the first rather than accumulating rows — so this
  // upserts by survivor number rather than always inserting.
  const { rows } = await query<{ id: number }>(
    'SELECT id FROM trusted_contacts WHERE survivor_whatsapp_number = $1',
    [from]
  );

  if (rows.length > 0) {
    // Changing the contact resets alert_sent_at: an alert already sent to the
    // OLD contact number should not make the NEW contact look already-alerted.
    await query(
      `UPDATE trusted_contacts
       SET contact_whatsapp_number = $1, registered_at = now(), alert_sent_at = NULL
       WHERE id = $2`,
      [contactNumber, rows[0].id]
    );
  } else {
    await query(
      `INSERT INTO trusted_contacts (survivor_whatsapp_number, contact_whatsapp_number) VALUES ($1, $2)`,
      [from, contactNumber]
    );
  }

  await sendText(from, t('trusted_contact.confirm', language));
  return { current_step: 'MAIN_MENU', temp_answers: {} };
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

  if (buttonId === 'menu_find_help') {
    // DIR-2, menu-triggered entry point (the other entry point is automatic,
    // after a STANDARD-risk report — see runStandardRiskSequence()). No
    // report_id in temp_answers here, so handleRegionSelection() knows not to
    // chain into PW-1 afterward.
    await sendRegionPicker(from, language);
    return { current_step: 'AWAITING_REGION', temp_answers: {} };
  }

  if (buttonId === 'menu_rights') {
    // DIR-3 — Sprint 1's stub is gone now that this content exists.
    await sendRightsContent(from, language);
    return {};
  }

  if (buttonId === 'menu_trusted_contact') {
    // HR-3 registration entry point (sprint-2-plan.md §3.3's 4th main-menu
    // option) — not tied to any report, per HR-3's technical note.
    await sendText(from, t('trusted_contact.prompt', language));
    await sendText(from, t('trusted_contact.ask_number', language));
    return { current_step: 'AWAITING_TRUSTED_CONTACT_NUMBER' };
  }

  // Typed text or an unrecognized tap at the main menu — re-send it.
  await sendMainMenu(from, language);
  return {};
}

// ---------------------------------------------------------------------------
// Entry point — the only export, called by server/routes/webhook.ts
// ---------------------------------------------------------------------------

export async function handleIncomingMessage(msg: NormalizedMessage): Promise<void> {
  const { from } = msg;
  let { body, buttonId } = msg;

  // See KNOWN_INTERACTIVE_IDS's comment above: promote a plain-text Body
  // that exactly matches one of this app's own internal button/list ids to
  // a real buttonId, so a genuine tap and a Sandbox-degraded-to-text one are
  // handled identically by every step below. Only fires when webhook.ts
  // didn't already resolve a real buttonId, so it can never override or
  // conflict with an actual interactive tap.
  if (!buttonId && body && KNOWN_INTERACTIVE_IDS.has(body.trim())) {
    buttonId = body.trim();
    body = null;
  }

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

  // See NUMBERED_OPTIONS_BY_STEP's comment above: promote a bare digit
  // ("1", "2"...) typed instead of a real tap to the buttonId at that
  // 1-indexed position in whatever numbered list state.current_step last
  // sent. Scoped strictly to the CURRENT step (via numberedOptionsForStep(),
  // never a global lookup) and only fires when buttonId is still null and
  // body is purely digits, so it can never override a real tap, can never
  // fire on the two free-text steps numberedOptionsForStep() excludes, and
  // runs after KNOWN_INTERACTIVE_IDS's own promotion above without
  // conflicting with it (that one only ever matches non-numeric ids). An
  // out-of-range number (e.g. "9" at a 4-option menu) is left completely
  // untouched — body stays exactly as typed and falls through to whichever
  // step handler runs below, so it gets that step's own existing invalid-
  // input/re-prompt behavior, same as any other unrecognized text would.
  if (!buttonId && body && /^\d+$/.test(body.trim())) {
    const options = numberedOptionsForStep(state.current_step);
    if (options) {
      const index = Number(body.trim()) - 1;
      if (index >= 0 && index < options.length) {
        buttonId = options[index];
        body = null;
      }
    }
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
  } else if (state.current_step === 'AWAITING_TRUSTED_CONTACT_NUMBER') {
    // HR-3
    patch = await handleTrustedContactNumber(from, state, body);
  } else if (state.current_step === 'AWAITING_CONNECT_RESPONSE') {
    // HR-1/HR-2/HR-4
    patch = await handleConnectResponse(from, state, buttonId);
  } else if (state.current_step === 'AWAITING_REGION') {
    // DIR-2
    patch = await handleRegionSelection(from, state, buttonId);
  } else if (state.current_step === 'AWAITING_PW_CONSENT') {
    // PW-1 (consent tap)
    patch = await handlePwConsentResponse(from, state, buttonId);
  } else if (state.current_step === 'AWAITING_PW_IDENTIFIER') {
    // PW-1 (free-text identifier)
    patch = await handlePwIdentifier(from, state, body);
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
