import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadLocalEnv() {
  try {
    const contents = await readFile(path.join(projectRoot, '.env'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(projectRoot, relativePath), 'utf8'));
}

async function upsertInBatches(client, table, rows) {
  for (let start = 0; start < rows.length; start += 100) {
    const { error } = await client.from(table).upsert(rows.slice(start, start + 100), { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

await loadLocalEnv();
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY in .env before seeding.');
}

const [accounts, clients, jobs] = await Promise.all([
  readJson('shared-data/accounts.json'),
  readJson('shared-data/clients.json'),
  readJson('shared-data/jobs.json'),
]);
const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

await upsertInBatches(supabase, 'accounts', accounts);
await upsertInBatches(supabase, 'clients', clients);
await upsertInBatches(supabase, 'jobs', jobs);
console.log(`Seeded ${accounts.length} accounts, ${clients.length} clients, and ${jobs.length} jobs.`);
