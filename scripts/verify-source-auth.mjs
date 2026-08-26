import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const authFiles = [
  'scheduling/mockLogin.js',
  'ops-dashboard/mockLogin.js',
  'analytics/src/SignInPage.jsx',
];
// The quickSignIn*/QUICK_SIGNIN_ACCOUNTS name patterns used to be banned
// outright here, rejecting the peer-testing quick-sign-in buttons
// (mockLogin.js) regardless of how their passwords were sourced. Product
// decision: keep that feature, but require its real passwords to come from
// an env var (see mockLogin.js's QUICK_SIGN_IN_ACCOUNTS + .env's
// VITE_JOHN_TEST_PASSWORD/VITE_SARAH_TEST_PASSWORD) rather than a literal
// in source - which the remaining pattern below still enforces.
const forbiddenPatterns = [
  /password\s*:\s*['"][^'"]+['"]/,
];

const violations = [];
for (const relativePath of authFiles) {
  const content = await readFile(path.join(root, relativePath), 'utf8');
  if (forbiddenPatterns.some((pattern) => pattern.test(content))) violations.push(relativePath);
}

if (violations.length) throw new Error(`Production authentication source contains embedded credentials: ${violations.join(', ')}`);
console.log('Authentication source verified: no embedded production sign-in credentials.');
