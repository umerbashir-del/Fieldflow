import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  (await readFile(path.join(root, '.env'), 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
);

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase server credentials are not configured in .env.');

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
for (const table of ['accounts', 'clients', 'jobs']) {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: ${count}`);
}
