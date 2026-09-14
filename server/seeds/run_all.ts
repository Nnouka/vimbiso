// server/seeds/run_all.ts
//
// Backend-owned. Sprint 1's `npm run seed` script pointed directly at
// `tsx server/seeds/content_en.ts`, since content_en.ts was the only seed
// file that existed. Sprint 2 adds several more (content_sw.ts, content_fr.ts,
// resources_kenya.ts, pattern_watch_demo.ts) — this file is the small runner
// that replaces the single hardcoded path in package.json's `seed` script so
// `npm run seed` keeps working as one command instead of everyone needing to
// remember five separate `tsx` invocations. Root package.json's `seed` script
// is updated to `tsx server/seeds/run_all.ts` accordingly (flagged in the PR
// description per CONTRIBUTING.md, since it's a change to a shared script
// other roles rely on, not just a Backend-internal file).
//
// Each seed module still works standalone too (every file under
// server/seeds/ keeps its own `if (require.main === module)` block), so
// `tsx server/seeds/resources_kenya.ts` alone still works if only one needs
// re-running.
//
// Order matters a little: content before data (so a fresh dashboard/bot run
// immediately after seeding has real copy to render), and resources before
// pattern_watch_demo (which doesn't depend on it, but keeping DIR-1-shaped
// data before PW-3-shaped data reads better in the console log). Nothing
// here is transactional across files — a failure partway through stops the
// remaining seeds (mirrors server/migrations/run.ts's fail-stop behavior)
// and logs which one failed.
//
// NOT included here: dashboard/seed.ts's demo counsellor_users fixture — that
// is Frontend-owned (dashboard/** per CONTRIBUTING.md's file-ownership map)
// and already exists as its own `npm run seed --prefix dashboard` command;
// see this task's final report for why Backend did not duplicate it as a
// second `server/seeds/counsellor_demo.ts`.

import dotenv from 'dotenv';
import { getPool } from '../lib/db';
import { seedContentEn } from './content_en';
import { seedContentSw } from './content_sw';
import { seedContentFr } from './content_fr';
import { seedResourcesKenya } from './resources_kenya';
import { seedPatternWatchDemo } from './pattern_watch_demo';

interface NamedSeed {
  name: string;
  run: () => Promise<void>;
}

const SEEDS: NamedSeed[] = [
  { name: 'content_en', run: seedContentEn },
  { name: 'content_sw', run: seedContentSw },
  { name: 'content_fr', run: seedContentFr },
  { name: 'resources_kenya', run: seedResourcesKenya },
  { name: 'pattern_watch_demo', run: seedPatternWatchDemo },
];

export async function runAllSeeds(): Promise<void> {
  for (const seed of SEEDS) {
    console.log(`[seed] running ${seed.name}...`);
    try {
      await seed.run();
    } catch (err) {
      console.error(`[seed] ${seed.name} failed — stopping (later seeds not attempted):`, err);
      throw err;
    }
  }
  console.log('[seed] all Sprint 1 + Sprint 2 seeds complete.');
}

if (require.main === module) {
  dotenv.config();
  runAllSeeds()
    .then(async () => {
      await getPool().end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[seed] run_all failed:', err);
      await getPool().end();
      process.exit(1);
    });
}
