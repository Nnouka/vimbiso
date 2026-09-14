// Vimbiso Counsellor Dashboard — Express + EJS
//
// Standalone app (own package.json, own port) scaffolded in Sprint 1 so that
// Sprint 2's DASH-1..4 stories could start building real features on day
// one. As of Sprint 2 every route below reads/writes real Postgres data via
// dashboard/lib/db.ts (this package's own connection pool — see that file's
// header comment for why it's a separate pool from server/lib/db.ts rather
// than a shared import).

import 'dotenv/config';

import bcrypt from 'bcrypt';
import express, { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import path from 'path';

import { query } from './lib/db';

// --- Types -------------------------------------------------------------

// Shape of the logged-in counsellor stashed on the session, set for real by
// POST /login (DASH-1) from a counsellor_users row.
interface CounsellorSession {
  id: number;
  name: string;
  role: string;
}

declare module 'express-session' {
  interface SessionData {
    counsellor?: CounsellorSession;
  }
}

interface CounsellorUserRow {
  id: number;
  name: string | null;
  username: string;
  password_hash: string;
  role: string | null;
}

// Raw shape of one row from the DASH-2 reports-queue query (snake_case,
// as Postgres returns it) before it's mapped into the view-facing `Report`
// shape below.
interface ReportQueueRow {
  id: number;
  created_at: Date;
  risk_level: 'HIGH' | 'STANDARD';
  region: string | null;
  wants_counsellor_connect: boolean;
  whatsapp_number: string;
  yes_count: string; // Postgres COUNT(...) comes back as a bigint string.
  yes_keys: string[];
}

// View-facing shape for one reports-queue row. Deliberately has no name/
// legal-name field at all (SEC-2) and never carries a raw whatsapp_number —
// only `maskedPhone` (see maskPhoneNumber() below for the masking rationale).
interface Report {
  id: number;
  createdAtDisplay: string;
  riskLevel: 'HIGH' | 'STANDARD';
  region: string;
  wantsCounsellorConnect: boolean;
  maskedPhone: string;
  yesCount: number;
  yesKeys: string[];
}

interface PatternMatchRow {
  id: number;
  hash_value: string;
  report_ids: number[];
  status: 'NEW' | 'REVIEWED';
  created_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
}

interface PatternMatch {
  id: number;
  reportIds: number[];
  status: 'NEW' | 'REVIEWED';
  createdAtDisplay: string;
  reviewedBy: string | null;
  reviewedAtDisplay: string | null;
}

interface TriageAnswerRow {
  question_key: string;
  answer: 'YES' | 'NO' | 'SKIP';
}

interface TriageAnswerView {
  key: string;
  questionText: string;
  answer: 'YES' | 'NO' | 'SKIP';
}

interface SmsAlertRow {
  sent_to: string | null;
  sent_at: Date | null;
  status: string | null;
}

interface SmsAlertView {
  sentAtDisplay: string;
  sentTo: string | null;
  status: string | null;
}

interface ReportRow {
  id: number;
  created_at: Date;
  risk_level: 'HIGH' | 'STANDARD' | null;
  region: string | null;
  whatsapp_number: string;
}

interface ReportDetail {
  id: number;
  createdAtDisplay: string;
  riskLevel: 'HIGH' | 'STANDARD' | null;
  region: string | null;
  maskedPhone: string;
  answers: TriageAnswerView[];
  smsAlerts: SmsAlertView[];
}

// --- Constants -----------------------------------------------------------

// Canonical English triage question text, per docs/backlog.md §3 (Triage
// Questions & Scoring Reference). Kept as a local, hardcoded map rather than
// querying content_strings: the dashboard doesn't own server/lib/content.ts
// or the language pipeline (see sprint-2-plan.md §2 ownership map — Frontend
// owns dashboard/**, not content), and DASH-4's AC only calls for English
// question text in the counsellor-facing detail view, not multilingual
// parity. If the dashboard ever needs translated question text, this map
// should be replaced with a `content_strings` lookup keyed
// `triage.<key.toLowerCase()>.question` (that's the exact key shape
// server/seeds/content_en.ts already uses).
const TRIAGE_QUESTION_TEXT: Record<string, string> = {
  STRANGLE: 'Has he ever choked, strangled, or tried to suffocate you?',
  WEAPON: 'Does he have a weapon, or has he threatened you with one?',
  KILL_THREAT: 'Has he said he would kill you, or someone close to you?',
  ESCALATION: 'Is the violence happening more often, or getting worse?',
  SEPARATION:
    'Have you left, or tried to leave, recently — or talked about leaving?',
  SEXUAL_COERCION: "Has he forced you into sex you didn't want?",
  CONTROL:
    'Is he watching, following, or controlling where you go and who you talk to?',
  SELF_PERCEIVED_DANGER:
    'Do you feel that if nothing changes, you could be seriously hurt or killed?',
};

// --- Helpers ---------------------------------------------------------------

// Masks a survivor's WhatsApp number down to its last 4 digits.
//
// Judgment call (see task notes for DASH-2): SEC-2 only explicitly bans a
// legal-name/id_number *column* on `reports` — there is no such column, and
// `whatsapp_number` isn't named in that ban. But a counsellor's dashboard
// screen is exactly the kind of shared/glanceable surface the rest of this
// project treats phone numbers as PII on (see HR-2's AC: the SMS alert body
// itself must never contain a survivor number). Showing the full number in
// a list a counsellor scrolls through has no documented AC need, so it's
// masked to the last 4 digits here — enough for a counsellor to
// cross-reference/confirm a number over the phone without the full number
// being visible at a glance on an unattended screen. The full number is
// never persisted or transmitted differently by this change; it's a
// display-only mask applied in the view layer.
function maskPhoneNumber(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length <= 4) {
    return '•'.repeat(digitsOnly.length);
  }
  return `•••• ${digitsOnly.slice(-4)}`;
}

function formatTimestamp(value: Date | null): string {
  if (!value) return '—';
  // ISO-ish, human-readable, and stable regardless of server locale —
  // matches the "\d{4}-\d{2}-\d{2}" shape report-detail.spec.ts checks for.
  return new Date(value).toISOString().replace('T', ' ').slice(0, 16);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.counsellor) {
    return res.redirect('/login');
  }
  next();
}

// --- App setup ---------------------------------------------------------

const app = express();
const PORT = process.env.PORT || 3001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// DASH-1's DoD only requires working login/logout plus a
// redirect-when-unauthenticated on /dashboard* — the in-memory
// express-session store (default, no external store configured) satisfies
// that fine at hackathon PoC scale: sessions just don't survive a process
// restart, which is a real limitation but not one DASH-1's AC/DoD tests for.
// Swap this for a real store (e.g. connect-pg-simple against Postgres)
// before this ever needs to survive redeploys or run with >1 dashboard
// process.
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'vimbiso-dashboard-dev-secret',
    resave: false,
    saveUninitialized: false,
  })
);

// Makes the logged-in state available to every view without passing it
// explicitly each time.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.locals.counsellor = req.session.counsellor || null;
  next();
});

// --- Auth (DASH-1) -------------------------------------------------------

app.get('/login', (req: Request, res: Response) => {
  res.render('login', { title: 'Log in', error: null });
});

app.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return res.render('login', {
      title: 'Log in',
      error: 'Enter a username and password.',
    });
  }

  try {
    const result = await query<CounsellorUserRow>(
      'SELECT id, name, username, password_hash, role FROM counsellor_users WHERE username = $1',
      [username]
    );
    const user = result.rows[0];

    // Always run bcrypt.compare against SOMETHING even when no user is
    // found, so a nonexistent-username response doesn't return measurably
    // faster than a wrong-password one (a cheap, standard timing-guard —
    // not a documented AC, just good practice while we're here).
    const passwordHash = user?.password_hash ?? '$2b$10$invalidsaltinvalidsaltinvalidsaltinvalidsal';
    const passwordMatches = await bcrypt.compare(password, passwordHash);

    if (!user || !passwordMatches) {
      return res.render('login', {
        title: 'Log in',
        error: 'Incorrect username or password.',
      });
    }

    req.session.counsellor = {
      id: user.id,
      name: user.name || user.username,
      role: user.role || 'counsellor',
    };
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[dashboard] login query failed:', err);
    res.render('login', {
      title: 'Log in',
      error: 'Something went wrong logging in. Please try again.',
    });
  }
});

app.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Any /dashboard* request without a session bounces to /login (DASH-1 DoD).
app.use('/dashboard', requireAuth);

// --- Reports queue (DASH-2) ----------------------------------------------

app.get('/dashboard', async (req: Request, res: Response) => {
  try {
    // Only reports that have actually been scored (risk_level set by TRI-3)
    // are meaningful in a triage queue — a report still IN_PROGRESS has no
    // risk_level yet and no complete triage_answers set, so it's excluded
    // rather than shown with a blank risk badge.
    //
    // Ordering: HIGH before STANDARD (any stray NULL last, defensively),
    // newest-first within each group — per DASH-2's AC exactly.
    const result = await query<ReportQueueRow>(
      `SELECT
         r.id,
         r.created_at,
         r.risk_level,
         r.region,
         r.wants_counsellor_connect,
         r.whatsapp_number,
         COUNT(ta.id) FILTER (WHERE ta.answer = 'YES') AS yes_count,
         COALESCE(
           array_agg(ta.question_key ORDER BY ta.id) FILTER (WHERE ta.answer = 'YES'),
           ARRAY[]::text[]
         ) AS yes_keys
       FROM reports r
       LEFT JOIN triage_answers ta ON ta.report_id = r.id
       WHERE r.risk_level IS NOT NULL
       GROUP BY r.id
       ORDER BY
         CASE r.risk_level WHEN 'HIGH' THEN 0 WHEN 'STANDARD' THEN 1 ELSE 2 END,
         r.created_at DESC`
    );

    const reports: Report[] = result.rows.map((row) => ({
      id: row.id,
      createdAtDisplay: formatTimestamp(row.created_at),
      riskLevel: row.risk_level,
      region: row.region || 'Unknown',
      wantsCounsellorConnect: row.wants_counsellor_connect,
      maskedPhone: maskPhoneNumber(row.whatsapp_number),
      yesCount: Number(row.yes_count),
      yesKeys: row.yes_keys,
    }));

    res.render('dashboard', {
      title: 'Reports Queue',
      activeNav: 'reports',
      reports,
    });
  } catch (err) {
    console.error('[dashboard] failed to load reports queue:', err);
    res.render('dashboard', {
      title: 'Reports Queue',
      activeNav: 'reports',
      reports: [],
    });
  }
});

// --- Pattern Watch tab (DASH-3) --------------------------------------------

app.get('/dashboard/pattern-watch', async (req: Request, res: Response) => {
  try {
    const result = await query<PatternMatchRow>(
      `SELECT id, hash_value, report_ids, status, created_at, reviewed_by, reviewed_at
       FROM pattern_matches
       ORDER BY status ASC, created_at DESC`
    );

    const matches: PatternMatch[] = result.rows.map((row) => ({
      id: row.id,
      reportIds: row.report_ids,
      status: row.status,
      createdAtDisplay: formatTimestamp(row.created_at),
      reviewedBy: row.reviewed_by,
      reviewedAtDisplay: row.reviewed_at ? formatTimestamp(row.reviewed_at) : null,
    }));

    res.render('pattern-watch', {
      title: 'Pattern Watch',
      activeNav: 'pattern-watch',
      matches,
    });
  } catch (err) {
    console.error('[dashboard] failed to load pattern matches:', err);
    res.render('pattern-watch', {
      title: 'Pattern Watch',
      activeNav: 'pattern-watch',
      matches: [],
    });
  }
});

// "Mark reviewed" action — a plain form POST (no client-side JS needed),
// per sprint-2-plan.md §3.4's mark-reviewed-btn convention.
app.post(
  '/dashboard/pattern-watch/:id/review',
  async (req: Request, res: Response) => {
    const counsellorName = req.session.counsellor?.name || 'Unknown counsellor';
    try {
      await query(
        `UPDATE pattern_matches
         SET status = 'REVIEWED', reviewed_by = $1, reviewed_at = now()
         WHERE id = $2`,
        [counsellorName, req.params.id]
      );
    } catch (err) {
      console.error('[dashboard] failed to mark pattern match reviewed:', err);
    }
    res.redirect('/dashboard/pattern-watch');
  }
);

// --- Report detail view (DASH-4) -------------------------------------------

app.get('/dashboard/reports/:id', async (req: Request, res: Response) => {
  const reportId = req.params.id;
  let report: ReportDetail | null = null;

  try {
    const reportResult = await query<ReportRow>(
      `SELECT id, created_at, risk_level, region, whatsapp_number
       FROM reports
       WHERE id = $1`,
      [reportId]
    );
    const reportRow = reportResult.rows[0];

    if (reportRow) {
      const [answersResult, smsResult] = await Promise.all([
        query<TriageAnswerRow>(
          `SELECT question_key, answer
           FROM triage_answers
           WHERE report_id = $1
           ORDER BY id ASC`,
          [reportId]
        ),
        query<SmsAlertRow>(
          `SELECT sent_to, sent_at, status
           FROM sms_alerts
           WHERE report_id = $1
           ORDER BY sent_at ASC`,
          [reportId]
        ),
      ]);

      report = {
        id: reportRow.id,
        createdAtDisplay: formatTimestamp(reportRow.created_at),
        riskLevel: reportRow.risk_level,
        region: reportRow.region,
        maskedPhone: maskPhoneNumber(reportRow.whatsapp_number),
        answers: answersResult.rows.map((row) => ({
          key: row.question_key,
          questionText: TRIAGE_QUESTION_TEXT[row.question_key] || row.question_key,
          answer: row.answer,
        })),
        smsAlerts: smsResult.rows.map((row) => ({
          sentAtDisplay: formatTimestamp(row.sent_at),
          sentTo: row.sent_to,
          status: row.status,
        })),
      };
    }
  } catch (err) {
    console.error('[dashboard] failed to load report detail:', err);
  }

  res.render('report-detail', {
    title: 'Report Detail',
    activeNav: 'reports',
    reportId,
    report,
  });
});

app.get('/', (req: Request, res: Response) => res.redirect('/dashboard'));

app.listen(PORT, () => {
  console.log(`Vimbiso dashboard listening on http://localhost:${PORT}`);
});

export default app;
