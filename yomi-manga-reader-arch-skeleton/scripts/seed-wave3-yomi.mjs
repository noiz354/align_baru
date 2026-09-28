#!/usr/bin/env node
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { loadEnv } from '../src/shared/validation/env.js';
import { createDb, closeDb } from '../src/server/db/client.js';
import * as schema from '../src/server/db/schema.js';
import { eq } from 'drizzle-orm';

const SEED_UUID_PREFIX = '594f4d49';
function deterministicUuid(kind, key) {
  const hash = createHash('sha256').update(`${kind}:${key}`).digest('hex');
  const raw = SEED_UUID_PREFIX + hash.slice(8, 32);
  const chars = raw.split('');
  chars[12] = '7';
  const v = parseInt(chars[19], 16);
  chars[19] = ((v & 0x3) | 0x8).toString(16);
  return `${chars.slice(0,8).join('')}-${chars.slice(8,12).join('')}-${chars.slice(12,16).join('')}-${chars.slice(16,20).join('')}-${chars.slice(20,32).join('')}`;
}

async function main() {
  const env = loadEnv();
  const db = await createDb(env);
  const users = [
    { email: 'reader.a@example.test', name: 'Reader A', password: 'PasswordA123!' },
    { email: 'reader.b@example.test', name: 'Reader B', password: 'PasswordB123!' },
  ];
  for (const u of users) {
    const id = deterministicUuid('user', u.email);
    const existing = await db.query.users.findFirst({ where: (f,{eq})=>eq(f.email, u.email) });
    if (existing) {
      console.log(`[seed-wave3] user exists ${u.email} ${existing.id}`);
      continue;
    }
    const hash = await argon2.hash(u.password, { type: argon2.argon2id });
    await db.insert(schema.users).values({
      id,
      email: u.email,
      displayName: u.name,
      passwordHash: hash,
      role: 'reader',
      status: 'active',
    }).onConflictDoNothing();
    console.log(`[seed-wave3] user created ${u.email} ${id} password=${u.password}`);
  }
  await closeDb(db);
  console.log('[seed-wave3] done');
}
main().catch(e=>{console.error(e);process.exit(1);});
