import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [fallback, bridge, embed] = await Promise.all([
  readFile(path.join(root, 'chatbot/apiFallback.js'), 'utf8'),
  readFile(path.join(root, 'chatbot/chatbot.js'), 'utf8'),
  readFile(path.join(root, 'chatbot/public/embed.js'), 'utf8'),
]);

if (!fallback.includes("../shared-data/supabase.js")) throw new Error('Support must use the shared Supabase client.');
if (bridge.includes("postMessage({ type: 'fieldflow-chat-close' }, '*')")) throw new Error('Support close messages must not use a wildcard origin.');
if (!bridge.includes('trustedOrigins') || !bridge.includes('event.source !== window.parent')) throw new Error('Support must validate the source and origin of session messages.');
if (!embed.includes('CHAT_ORIGIN') || !embed.includes('event.source === frame.contentWindow')) throw new Error('Support embed messages must use the configured origin and iframe source.');
console.log('Support bridge verified: one Supabase client and validated cross-window messages.');
