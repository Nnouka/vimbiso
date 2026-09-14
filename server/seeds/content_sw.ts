// server/seeds/content_sw.ts
//
// Backend-owned, Sprint 2 (LANG-3 draft groundwork — NOT LANG-3 itself).
// Seeds `content_strings` for language='sw' with the safety-critical subset
// docs/conversation-design.md §15.1 calls for: every `highrisk.*` key
// (including `highrisk.bridge`, carried over from Sprint 1) plus
// `pw.consent_prompt`. Text is copied VERBATIM from that section — Designer's
// own AI-drafted, UNREVIEWED translation — not re-translated or touched here.
//
// tier='PARTIAL', reviewed_by=NULL, reviewed_at=NULL — deliberately, per
// conversation-design.md §15's explicit instruction: "nothing in this section
// may be seeded as tier='FULL' or with any reviewed_by value until that
// review actually happens." LANG-3's own scope (full Swahili parity,
// tier='FULL', a named @KEN/@UGA reviewer) is NOT this file — do not upgrade
// these rows' tier without that real review landing first.
//
// This is intentionally a much smaller key set than content_en.ts: only the
// keys conversation-design.md §15.1 actually drafted. Every other key falls
// back to English automatically via content.ts's t() fallback — that's the
// correct behavior for an honestly-PARTIAL language, not a bug to "fix" by
// inventing translations for the rest.
//
// Run with: `npm run seed` (=> `tsx server/seeds/run_all.ts`), or standalone:
// `tsx server/seeds/content_sw.ts`.

import dotenv from 'dotenv';
import { getPool } from '../lib/db';
import { ContentString } from '../lib/content';

const LANGUAGE = 'sw';
const TIER: ContentString['tier'] = 'PARTIAL';

// Keys/text copied verbatim from docs/conversation-design.md §15.1.
export const CONTENT: Record<string, string> = {
  'highrisk.bridge':
    'Asante kwa kuniamini na hilo. Kutokana na uliyoshiriki, ninachoona ni kwamba unakabiliwa na hali mbaya, na nataka kuhakikisha hukabiliani nayo peke yako. Ngoja kidogo — ninakaribia kukutumia maelezo ya usalama na nambari halisi unayoweza kupiga sasa hivi.',
  'highrisk.intro':
    'Ulichoniambia kinaonyesha kuwa unaweza kuwa katika hatari kubwa sasa hivi. Haya ndiyo ya kufanya, kwa mpangilio:',
  'highrisk.plan_1':
    'Andaa mfuko mdogo sasa, kama unaweza kufanya hivyo bila kuonekana — kitambulisho, pesa kidogo, chaja ya simu, na nguo za kubadilisha.',
  'highrisk.plan_2':
    'Fikiria jirani mmoja au mtu wa karibu unayemwamini, na jinsi ungeweza kumfikia haraka ukihitaji.',
  'highrisk.plan_3':
    'Kariri nambari moja ya simu kwa akili — mtu unayemwamini au nambari ya dharura hapa chini — endapo huna simu yako karibu.',
  'highrisk.plan_4': 'Hakikisha simu yako ina chaji, na unajua chaja iko wapi.',
  'highrisk.hotline_prefix': 'Ikiwezekana, piga nambari hii sasa — ni bure na inapatikana:\n{{hotline_number}}',
  'highrisk.connect_prompt': 'Je, ungependa nikuunganishe na mshauri sasa hivi?',
  'highrisk.connect_yes_ack':
    'Sawa. Mshauri ameshaarifiwa na atajaribu kuwasiliana nawe. Hifadhi nambari ya dharura iliyo hapo juu endapo utaihitaji kabla ya hapo.',
  'highrisk.connect_no_ack':
    'Hakuna shida — nambari iliyo hapo juu bado ni yako kupiga wakati wowote, mchana au usiku. Unaweza pia kurudi kwenye menyu hii baadaye.',
  'pw.consent_prompt':
    'Je, ungependa kutaja aliyekufanyia hivi, ili tu kuangalia kama wengine wameripoti mtu huyo huyo? Hili halibadilishi kamwe kinachotokea kwa kesi yako.',
};

export async function seedContentSw(): Promise<void> {
  const pool = getPool();
  const entries = Object.entries(CONTENT);

  for (const [key, text] of entries) {
    // reviewed_by/reviewed_at explicitly NOT set (stay NULL, the column
    // defaults) — see file header. Do not add them to this INSERT.
    await pool.query(
      `INSERT INTO content_strings (key, language, text, tier)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key, language) DO UPDATE SET
         text = EXCLUDED.text,
         tier = EXCLUDED.tier`,
      [key, LANGUAGE, text, TIER]
    );
  }

  console.log(
    `[seed] content_sw: upserted ${entries.length} keys for language="${LANGUAGE}" ` +
      `(tier=PARTIAL, unreviewed — see file header).`
  );
}

if (require.main === module) {
  dotenv.config();
  seedContentSw()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] content_sw failed:', err);
      process.exit(1);
    });
}
