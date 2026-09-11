// Vimbiso Counsellor Dashboard — Express + EJS
//
// This is a standalone app (own package.json, own port) scaffolded in Sprint 1
// so that Sprint 2's DASH-1..4 stories can start building real features on
// day one. Every route below is a genuine, non-erroring placeholder — none of
// it reads real data yet. Search this file for "TODO(DASH-" to find every
// spot the next stories need to fill in.

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

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
app.use((req, res, next) => {
  res.locals.counsellor = req.session.counsellor || null;
  next();
});

// --- Auth (stub) -----------------------------------------------------------

app.get('/login', (req, res) => {
  res.render('login', { title: 'Log in', error: null });
});

app.post('/login', (req, res) => {
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

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// --- Dashboard views (stubs) -------------------------------------------------

app.get('/dashboard', (req, res) => {
  // TODO(DASH-2): replace with the real Reports queue — HIGH pinned first
  // (newest-first within group, flagged red), then STANDARD, each row
  // showing id, timestamp, risk_level, YES-answer summary, region, connect
  // status. Never a real name (per SEC-2 / data model).
  res.render('dashboard', {
    title: 'Reports Queue',
    activeNav: 'reports',
    reports: [],
  });
});

app.get('/dashboard/pattern-watch', (req, res) => {
  // TODO(DASH-3): replace with the real Pattern Watch tab — reads
  // pattern_matches rows, shows linked report_ids, created_at, and a "Mark
  // reviewed" button. Visually distinct from the Reports queue: no red
  // flags, no urgent language (this is a non-urgent institutional signal).
  res.render('pattern-watch', {
    title: 'Pattern Watch',
    activeNav: 'pattern-watch',
    matches: [],
  });
});

app.get('/dashboard/reports/:id', (req, res) => {
  // TODO(DASH-4): replace with the real report detail view — all 8
  // triage_answers (question text + answer), risk_level, and any
  // sms_alerts timestamps for this report_id.
  res.render('report-detail', {
    title: 'Report Detail',
    activeNav: 'reports',
    reportId: req.params.id,
    report: null,
  });
});

app.get('/', (req, res) => res.redirect('/dashboard'));

app.listen(PORT, () => {
  console.log(`Vimbiso dashboard scaffold listening on http://localhost:${PORT}`);
});

module.exports = app;
