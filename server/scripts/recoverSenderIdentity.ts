// server/scripts/recoverSenderIdentity.ts
//
// LOG-3 (docs/backlog.md): the ONLY place in this codebase that can turn a
// `message_log.sender_pseudonym` back into a real phone number. Deliberately
// a standalone CLI script, never imported by server/index.ts or any other
// normally-running application code — there is no decrypt-on-demand API and
// there must never be one. Re-identifying a survivor is a rare, deliberate,
// out-of-band act (a court order, a government request, or a survivor's own
// request for their own data), not a feature the running product exposes.
//
// --- Key custody is the actual privacy control here -------------------
//
// SENDER_IDENTITY_RECOVERY_KEY must NOT be added to this project's `.env`
// file or to the hosting platform's normal runtime environment-variable
// config — see .env.example's comment on this var. If it lived alongside
// DATABASE_URL/TWILIO_* the way every other secret in this app does, ANY
// process compromise (or any developer with normal deploy access) could
// decrypt `sender_identity_map` silently. Instead, whoever holds this key
// (per this project's own data-handling policy — outside this codebase's
// scope to define) supplies it only at the moment this script is actually,
// deliberately run:
//
//   SENDER_IDENTITY_RECOVERY_KEY=<key> npm run recover-identity -- \
//     --pseudonym=<the sender_pseudonym from message_log> \
//     --recovered-by="Jane Doe, Legal" \
//     --legal-basis="Court order, Case No. 2026-XXXX" \
//     [--case-reference="2026-XXXX"]
//
// This deliberately duplicates a small amount of AES-256-GCM decryption
// logic that could technically be shared with server/lib/messageLog.ts —
// see messageLog.ts's encryptSenderIdentity() comment for why that's
// intentional: messageLog.ts exports no matching decrypt function, so
// nothing in the normally-running app can ever call one. Every actual
// recovery is written to `identity_recovery_log` BEFORE the decrypted
// number is revealed — a recovery attempt is logged even if the operator
// never does anything with the output, and the log itself never stores the
// recovered number, only who/when/why it was recovered.

import * as crypto from 'crypto';
import dotenv from 'dotenv';

import { query, getPool } from '../lib/db';

interface Args {
  pseudonym: string;
  recoveredBy: string;
  legalBasis: string;
  caseReference: string | null;
}

function parseArgs(argv: string[]): Args {
  const flags: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (match) {
      flags[match[1]] = match[2];
    }
  }

  const pseudonym = flags['pseudonym'];
  const recoveredBy = flags['recovered-by'];
  const legalBasis = flags['legal-basis'];
  const caseReference = flags['case-reference'] ?? null;

  if (!pseudonym || !recoveredBy || !legalBasis) {
    console.error(
      'Usage: recoverSenderIdentity.ts --pseudonym=<hex> --recovered-by="Name, Role" ' +
        '--legal-basis="why this is lawful" [--case-reference="..."]\n\n' +
        'Every flag except --case-reference is required — see this file\'s header ' +
        'comment for why (identity_recovery_log must never have a blank reason).'
    );
    process.exit(1);
  }

  return { pseudonym, recoveredBy, legalBasis, caseReference };
}

function loadRecoveryKey(): Buffer {
  const raw = process.env.SENDER_IDENTITY_RECOVERY_KEY;
  if (!raw) {
    throw new Error(
      'SENDER_IDENTITY_RECOVERY_KEY is not set. This is deliberate — see this ' +
        "file's header comment: the key must be supplied at invocation time, " +
        'not stored in .env, e.g.:\n' +
        '  SENDER_IDENTITY_RECOVERY_KEY=<key> npm run recover-identity -- --pseudonym=... ' +
        '--recovered-by=... --legal-basis=...'
    );
  }
  const hexKey = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : null;
  const key = hexKey ?? Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `SENDER_IDENTITY_RECOVERY_KEY must decode to exactly 32 bytes (got ${key.length}).`
    );
  }
  return key;
}

function aesDecrypt(ciphertext: Buffer, iv: Buffer, authTag: Buffer, key: Buffer): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

interface SenderIdentityRow {
  encrypted_real_number: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
}

async function main(): Promise<void> {
  // DATABASE_URL only — SENDER_IDENTITY_RECOVERY_KEY is intentionally NOT
  // expected to come from this .env load; see loadRecoveryKey() above.
  dotenv.config();

  const args = parseArgs(process.argv.slice(2));
  const key = loadRecoveryKey();

  const { rows } = await query<SenderIdentityRow>(
    `SELECT encrypted_real_number, iv, auth_tag FROM sender_identity_map
     WHERE sender_pseudonym = $1`,
    [args.pseudonym]
  );

  if (rows.length === 0) {
    console.error(
      `No sender_identity_map row for pseudonym "${args.pseudonym}". ` +
        'Nothing to recover — no identity_recovery_log entry written.'
    );
    process.exit(1);
  }

  const row = rows[0];
  const realNumber = aesDecrypt(row.encrypted_real_number, row.iv, row.auth_tag, key);

  // Logged BEFORE the number is printed — an attempted recovery is recorded
  // even if something goes wrong displaying the result, and the log row
  // itself never contains the recovered number (LOG-3's AC: "re-identifying
  // a survivor must never be silent").
  await query(
    `INSERT INTO identity_recovery_log (sender_pseudonym, recovered_by, legal_basis, case_reference)
     VALUES ($1, $2, $3, $4)`,
    [args.pseudonym, args.recoveredBy, args.legalBasis, args.caseReference]
  );

  console.log('--- LOG-3 sender re-identification ---');
  console.log(`Pseudonym:      ${args.pseudonym}`);
  console.log(`Recovered by:   ${args.recoveredBy}`);
  console.log(`Legal basis:    ${args.legalBasis}`);
  console.log(`Case reference: ${args.caseReference ?? '(none given)'}`);
  console.log(`Real number:    ${realNumber}`);
  console.log('---------------------------------------');
  console.log('This recovery has been recorded in identity_recovery_log.');
}

if (require.main === module) {
  main()
    .then(() => getPool().end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('recoverSenderIdentity.ts failed:', err);
      process.exit(1);
    });
}
