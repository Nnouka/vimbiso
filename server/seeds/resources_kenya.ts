// server/seeds/resources_kenya.ts
//
// Backend-owned (DIR-1). Seeds `resources` with `country='KE'` rows per
// sprint-2-plan.md §3.5's required minimum: the national hotline (HAK/1195),
// >=1 Nairobi-region resource, the Kenya Police Gender & Children's Desk, and
// the State Department for Gender's reporting channel. HR-1 (hotline number)
// and DIR-2 (region picker) both read this table live at send time — neither
// ever hardcodes a phone number, per their technical notes.
//
// ===========================================================================
// HONESTY NOTE ON SOURCING — READ BEFORE PRESENTING ANY NUMBER BELOW PUBLICLY
// ===========================================================================
// This file was authored by an AI coding agent with no live internet access
// in this environment (the npm registry itself is blocked here — see
// docs/ai-tool-usage-log.md) and NO ability to call/verify any of these
// numbers right now. Per sprint-2-plan.md §3.5's explicit instruction, every
// field below is labeled with its actual confidence level rather than
// presented as uniformly "real." DIR-1's DoD ("every entry spot-checked
// against its source_url before Day 5") is a HUMAN task this seed file does
// NOT satisfy by itself — running this seed only gets the schema populated
// with best-effort/training-data-recalled entries, not verified ones.
//
// Do not present any number flagged "needs live verification before demo"
// to a real user, in the demo video, or in the pitch deck until a human has
// actually called it or confirmed it against a live, current source.
//
// last_verified_date below is the date this seed entry was AUTHORED
// (2026-09-12), not a date anyone actually re-confirmed the number — a human
// completing DIR-1's live spot-check should update it to the real
// verification date once that happens.

import dotenv from 'dotenv';
import { getPool } from '../lib/db';

const SEED_AUTHORED_DATE = '2026-09-12';

interface ResourceSeedRow {
  country: string;
  region: string | null;
  category: string;
  name: string;
  phone: string;
  address: string | null;
  hours: string | null;
  source_name: string;
  source_url: string;
  last_verified_date: string;
  language_support: string[];
}

export const RESOURCES: ResourceSeedRow[] = [
  {
    // CONFIDENCE: name/phone HIGH — "1195" is a long-publicized, well-known
    // Kenyan toll-free GBV/child-protection helpline number. source_name/
    // source_url LOWER confidence — the exact current operating
    // organization/branding behind 1195 is not something this agent can
    // confirm live (it has been associated with Healthcare Assistance Kenya
    // (HAK) historically; branding/operator could have changed since this
    // agent's training data). NEEDS LIVE VERIFICATION BEFORE DEMO: confirm
    // 1195 is still live and who currently answers it, and confirm/replace
    // source_url below.
    country: 'KE',
    region: null,
    category: 'hotline',
    name: 'National GBV & Child Protection Helpline (1195)',
    phone: '1195',
    address: null,
    hours: '24/7 (as historically publicized — confirm before demo)',
    source_name: 'Healthcare Assistance Kenya (HAK) — needs live verification before demo',
    source_url: 'https://www.hakenya.or.ke',
    last_verified_date: SEED_AUTHORED_DATE,
    language_support: ['en', 'sw'],
  },
  {
    // CONFIDENCE: name MODERATE-HIGH — the Gender Violence Recovery Centre
    // (GVRC) at Nairobi Women's Hospital is a well-known, long-running
    // Nairobi GBV medical/forensic response service. phone NUMBER LOW
    // CONFIDENCE — this agent recalls a number in this shape from training
    // data but cannot dial it to confirm; treat the exact digits as
    // unverified. NEEDS LIVE VERIFICATION BEFORE DEMO — do not present this
    // number publicly until confirmed.
    country: 'KE',
    region: 'Nairobi',
    category: 'medical_forensic_support',
    name: "Gender Violence Recovery Centre (GVRC), Nairobi Women's Hospital",
    phone: '+254709667000',
    address: 'Nairobi Women\'s Hospital, Hurlingham, Nairobi — needs live verification before demo',
    hours: '24/7 (as historically publicized — confirm before demo)',
    source_name: "Nairobi Women's Hospital — needs live verification before demo",
    source_url: 'https://nwch.co.ke',
    last_verified_date: SEED_AUTHORED_DATE,
    language_support: ['en', 'sw'],
  },
  {
    // CONFIDENCE: "999" as Kenya's standard national police emergency number
    // is HIGH confidence. Whether dialing 999 specifically reaches (or gets
    // routed to) a "Gender & Children's Desk" as opposed to general police
    // dispatch is LOW confidence — individual police stations run their own
    // Gender & Children's Desks and this agent has no confirmed single
    // national direct-dial number for that specific desk. NEEDS LIVE
    // VERIFICATION BEFORE DEMO — confirm the routing claim, or replace with a
    // confirmed direct desk line if the team obtains one.
    country: 'KE',
    region: null,
    category: 'police',
    name: "Kenya Police — Gender & Children's Desk (via national emergency line)",
    phone: '999',
    address: null,
    hours: '24/7',
    source_name: 'National Police Service, Kenya — routing to a Gender & Children\'s Desk needs live verification before demo',
    source_url: 'https://www.nationalpolice.go.ke',
    last_verified_date: SEED_AUTHORED_DATE,
    language_support: ['en', 'sw'],
  },
  {
    // CONFIDENCE: LOW on the phone number specifically. This agent has no
    // confidently-recalled DEDICATED GBV-reporting number for the State
    // Department for Gender. Rather than inventing digits with zero
    // grounding to "look complete," this uses Kenya's general cross-
    // government Huduma Centre contact-centre number (itself only
    // moderately-recalled, not independently confirmed here) as an explicit
    // stand-in, clearly labeled as such. A human MUST replace this with a
    // confirmed, dedicated State Department for Gender contact — or confirm
    // this Huduma line is in fact the right channel — before Day 5's
    // spot-check (DIR-1 DoD) and before any public/demo use.
    country: 'KE',
    region: null,
    category: 'government_reporting',
    name: 'State Department for Gender — GBV reporting channel',
    phone: '0800221349',
    address: null,
    hours: 'Business hours (as historically publicized for Huduma Centres — confirm before demo)',
    source_name:
      'STAND-IN: Huduma Kenya contact centre — NOT a confirmed dedicated State Department for Gender line. ' +
      'Needs live verification before demo; replace with the real reporting-channel contact if the team obtains one.',
    source_url: 'https://www.hudumakenya.go.ke',
    last_verified_date: SEED_AUTHORED_DATE,
    language_support: ['en', 'sw'],
  },
];

export async function seedResourcesKenya(): Promise<void> {
  const pool = getPool();

  for (const r of RESOURCES) {
    // No natural unique key on `resources` (per its migration) to upsert
    // against, so this is idempotent on (country, category, name) instead —
    // safe to re-run after editing an entry above without piling up
    // duplicate rows for the same named resource.
    const { rows: existing } = await pool.query<{ id: number }>(
      'SELECT id FROM resources WHERE country = $1 AND category = $2 AND name = $3',
      [r.country, r.category, r.name]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE resources SET
           region = $1, phone = $2, address = $3, hours = $4,
           source_name = $5, source_url = $6, last_verified_date = $7,
           language_support = $8
         WHERE id = $9`,
        [
          r.region,
          r.phone,
          r.address,
          r.hours,
          r.source_name,
          r.source_url,
          r.last_verified_date,
          r.language_support,
          existing[0].id,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO resources
           (country, region, category, name, phone, address, hours, source_name, source_url, last_verified_date, language_support)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          r.country,
          r.region,
          r.category,
          r.name,
          r.phone,
          r.address,
          r.hours,
          r.source_name,
          r.source_url,
          r.last_verified_date,
          r.language_support,
        ]
      );
    }
  }

  console.log(
    `[seed] resources_kenya: upserted ${RESOURCES.length} KE resources. ` +
      `REMINDER: these are best-effort/training-data entries — DIR-1's DoD ` +
      `("every entry spot-checked against its source_url before Day 5") is a ` +
      `human task this seed does not perform. See this file's header before ` +
      `presenting any number publicly.`
  );
}

if (require.main === module) {
  dotenv.config();
  seedResourcesKenya()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] resources_kenya failed:', err);
      process.exit(1);
    });
}
