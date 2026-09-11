// Vimbiso Counsellor Dashboard — Express + EJS
//
// This is a standalone app (own package.json, own port) scaffolded in Sprint 1
// so that Sprint 2's DASH-1..4 stories can start building real features on
// day one. Every route below is a genuine, non-erroring placeholder — none of
// it reads real data yet. Search this file for "TODO(DASH-" to find every
// spot the next stories need to fill in.

import 'dotenv/config';

import express, { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import path from 'path';

// Shape of the (currently placeholder) logged-in counsellor stashed on the
// session. TODO(DASH-1) will populate `id` from counsellor_users on real
// login; today only { name, role } is ever set.
interface CounsellorSession {
  id?: string;
  name: string;
  role: string;
}

declare module 'express-session' {
  interface SessionData {
    counsellor?: CounsellorSession;
  }
}

// Placeholder row/detail shapes for the views below — every route here only
// ever passes an empty array / null today, so these just describe the future
// shape the DASH-2..4 TODOs will fill in without pretending to know more
// than that yet.
type Report = Record<string, unknown>;
type PatternMatch = Record<string, unknown>;
type ReportDetail = Record<string, unknown>;

const app = express();
const PORT = process.env.PORT || 3001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// TODO(DASH-1): swap the default in-memory session store for a real store
// (e.g. connect-pg-simple against Postgres) before this ever holds real
// counsellor sessions. In-memory is fine for a scaffold that restarts often.
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'vimbiso-dashboard-dev-secret',
    resave: false,
    saveUninitialized: false,
  })
);

// Makes the logged-in state available to every view without passing it
// explicitly each time. Currently always undefined — DASH-1 sets
// req.session.counsellor on successful login.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.locals.counsellor = req.session.counsellor || null;
  next();
});

// --- Auth (stub) -----------------------------------------------------------

app.get('/login', (req: Request, res: Response) => {
  res.render('login', { title: 'Log in', error: null });
});

app.post('/login', (req: Request, res: Response) => {
  // TODO(DASH-1): wire real auth against counsellor_users
  // - look up counsellor_users by username
  // - bcrypt.compare(password, password_hash)
  // - on success: req.session.counsellor = { id, name, role }, redirect to /dashboard
  // - on failure: re-render login with an error, no session created
  //
  // For now this scaffold has no real credential store, so it just starts a
  // placeholder session and moves on — nothing is actually authenticated.
  req.session.counsellor = { name: 'Demo Counsellor', role: 'counsellor' };
  res.redirect('/dashboard');
});

app.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => res.redirect('/login'));
});

// --- Dashboard views (stubs) -------------------------------------------------

app.get('/dashboard', (req: Request, res: Response) => {
  // TODO(DASH-2): replace with the real Reports queue — HIGH pinned first
  // (newest-first within group, flagged red), then STANDARD, each row
  // showing id, timestamp, risk_level, YES-answer summary, region, connect
  // status. Never a real name (per SEC-2 / data model).
  const reports: Report[] = [];
  res.render('dashboard', {
    title: 'Reports Queue',
    activeNav: 'reports',
    reports,
  });
});

app.get('/dashboard/pattern-watch', (req: Request, res: Response) => {
  // TODO(DASH-3): replace with the real Pattern Watch tab — reads
  // pattern_matches rows, shows linked report_ids, created_at, and a "Mark
  // reviewed" button. Visually distinct from the Reports queue: no red
  // flags, no urgent language (this is a non-urgent institutional signal).
  const matches: PatternMatch[] = [];
  res.render('pattern-watch', {
    title: 'Pattern Watch',
    activeNav: 'pattern-watch',
    matches,
  });
});

app.get('/dashboard/reports/:id', (req: Request, res: Response) => {
  // TODO(DASH-4): replace with the real report detail view — all 8
  // triage_answers (question text + answer), risk_level, and any
  // sms_alerts timestamps for this report_id.
  const report: ReportDetail | null = null;
  res.render('report-detail', {
    title: 'Report Detail',
    activeNav: 'reports',
    reportId: req.params.id,
    report,
  });
});

app.get('/', (req: Request, res: Response) => res.redirect('/dashboard'));

app.listen(PORT, () => {
  console.log(`Vimbiso dashboard scaffold listening on http://localhost:${PORT}`);
});

export default app;
