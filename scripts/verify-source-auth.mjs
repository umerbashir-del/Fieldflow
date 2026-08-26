import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const authFiles = [
  'scheduling/mockLogin.js',
  'ops-dashboard/mockLogin.js',
  'analytics/src/SignInPage.jsx',
];
const forbiddenPatterns = [
  /QUICK_SIGNIN_ACCOUNTS/,
  /quickSignIn(?:John|Sarah)/,
  /password\s*:\s*['"][^'"]+['"]/,
];
const violations = [];

for (const relativePath of authFiles) {
  const content = await readFile(path.join(root, relativePath), 'utf8');
  if (forbiddenPatterns.some((pattern) => pattern.test(content))) violations.push(relativePath);
}

if (violations.length) {
  throw new Error(`Production authentication source contains embedded credentials: ${violations.join(', ')}`);
}
console.log('Authentication source verified: no embedded production sign-in credentials.');
