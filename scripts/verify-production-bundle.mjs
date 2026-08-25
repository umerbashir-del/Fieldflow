import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deployRoot = path.join(root, 'deploy');
const env = Object.fromEntries(
  (await readFile(path.join(root, '.env'), 'utf8')).split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
);

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(item) : [item];
  }));
  return files.flat();
}

const banned = [
  'john-demo-password',
  'sarah-demo-password',
  'ops-demo-password',
  'http://127.0.0.1:517',
  'http://localhost:517',
  env.SUPABASE_SECRET_KEY,
  env.SUPABASE_SERVICE_ROLE_KEY,
  env.JOHN_TEST_PASSWORD,
  env.SARAH_TEST_PASSWORD,
  env.OPERATIONS_TEST_PASSWORD,
].filter(Boolean);

const violations = [];
for (const file of await filesUnder(deployRoot)) {
  if (!/\.(?:html|js|css|json)$/i.test(file)) continue;
  const content = await readFile(file, 'utf8');
  for (const value of banned) {
    if (content.includes(value)) violations.push(path.relative(root, file));
  }
}

if (violations.length) throw new Error(`Production bundle contains a banned value in: ${[...new Set(violations)].join(', ')}`);
console.log('Production bundle verified: no private credentials, demo passwords, or FieldFlow localhost links.');
