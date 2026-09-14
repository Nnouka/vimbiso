// server/seeds/content_fr.ts
//
// Backend-owned, Sprint 2 (LANG-4 draft groundwork — NOT LANG-4 itself).
// Seeds `content_strings` for language='fr' with the safety-critical subset
// docs/conversation-design.md §15.2 calls for: every `highrisk.*` key
// (including `highrisk.bridge`) plus `pw.consent_prompt`. Text is copied
// VERBATIM from that section — Designer's own AI-drafted, UNREVIEWED
// translation, pending Nnouka's real review — not re-translated here.
//
// tier='PARTIAL', reviewed_by=NULL, reviewed_at=NULL — deliberately, per
// conversation-design.md §15.2's explicit instruction: "do not mark
// reviewed_by='Nnouka' in the seed until he has actually reviewed it."
// LANG-4's own scope (Nnouka's real review of this exact subset, promoting it
// to tier='FULL' with reviewed_by='Nnouka') is NOT this file's job — do not
// upgrade these rows without that real review landing first.
//
// `trusted_contact.alert_message` is intentionally NOT translated here —
// conversation-design.md §15.2 explicitly scopes it out (fixed verbatim per
// HR-4's AC, English-only for Sprint 2; a translated variant is a future
// PM/backlog decision, not something to infer from this subset).
//
// Run with: `npm run seed` (=> `tsx server/seeds/run_all.ts`), or standalone:
// `tsx server/seeds/content_fr.ts`.

import dotenv from 'dotenv';
import { getPool } from '../lib/db';
import { ContentString } from '../lib/content';

const LANGUAGE = 'fr';
const TIER: ContentString['tier'] = 'PARTIAL';

// Keys/text copied verbatim from docs/conversation-design.md §15.2.
export const CONTENT: Record<string, string> = {
  'highrisk.bridge':
    "Merci de m'avoir fait confiance avec cela. D'après ce que vous avez partagé, ce que vous vivez semble grave, et je veux m'assurer que vous n'y faites pas face seule. Restez avec moi un instant — je vais vous communiquer des informations de sécurité et un vrai numéro que vous pouvez appeler dès maintenant.",
  'highrisk.intro':
    'Ce que vous m\'avez dit suggère que vous pourriez être en danger grave en ce moment. Voici quoi faire, dans l\'ordre :',
  'highrisk.plan_1':
    "Préparez maintenant un petit sac, si vous pouvez le faire sans être remarquée — pièce d'identité, un peu d'argent, un chargeur de téléphone, des vêtements de rechange.",
  'highrisk.plan_2':
    'Pensez à un voisin ou une personne proche en qui vous avez confiance, et à la façon dont vous pourriez la rejoindre rapidement si besoin.',
  'highrisk.plan_3':
    "Mémorisez un numéro de téléphone par cœur — un contact de confiance ou le numéro d'urgence ci-dessous — au cas où vous n'auriez pas votre téléphone avec vous.",
  'highrisk.plan_4': 'Gardez votre téléphone chargé, et sachez où se trouve le chargeur.',
  'highrisk.hotline_prefix':
    "Si vous le pouvez, appelez ce numéro maintenant — c'est gratuit et disponible :\n{{hotline_number}}",
  'highrisk.connect_prompt': 'Souhaitez-vous que je vous mette en relation avec une conseillère dès maintenant ?',
  'highrisk.connect_yes_ack':
    "D'accord. Une conseillère a été prévenue et essaiera de vous joindre. Gardez le numéro d'urgence ci-dessus au cas où vous en auriez besoin avant cela.",
  'highrisk.connect_no_ack':
    'Pas de souci — le numéro ci-dessus reste disponible à tout moment, jour et nuit. Vous pouvez aussi revenir à ce menu plus tard.',
  'pw.consent_prompt':
    "Souhaitez-vous nommer qui vous a fait cela, uniquement pour vérifier si d'autres personnes ont signalé la même personne ? Cela ne change jamais ce qui se passe pour votre dossier.",
};

export async function seedContentFr(): Promise<void> {
  const pool = getPool();
  const entries = Object.entries(CONTENT);

  for (const [key, text] of entries) {
    // reviewed_by/reviewed_at explicitly NOT set (stay NULL) — see file
    // header. Nnouka's real review is what sets these, not this seed.
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
    `[seed] content_fr: upserted ${entries.length} keys for language="${LANGUAGE}" ` +
      `(tier=PARTIAL, unreviewed — pending Nnouka's review per LANG-4).`
  );
}

if (require.main === module) {
  dotenv.config();
  seedContentFr()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] content_fr failed:', err);
      process.exit(1);
    });
}
