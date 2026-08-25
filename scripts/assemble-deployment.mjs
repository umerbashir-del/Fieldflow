import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'deploy');
const products = {
  scheduling: 'scheduling',
  analytics: 'analytics',
  support: 'chatbot',
  operations: 'ops-dashboard',
};

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const [route, workspace] of Object.entries(products)) {
  await cp(path.join(root, workspace, 'dist'), path.join(output, route), { recursive: true });
}

await writeFile(
  path.join(output, 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/scheduling/"><title>FieldFlow</title><a href="/scheduling/">Open FieldFlow</a>',
);
await cp(path.join(root, '404.html'), path.join(output, '404.html'));

console.log('Assembled deploy/ with all FieldFlow products on one origin.');
