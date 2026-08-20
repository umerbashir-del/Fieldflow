import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Chat Box reads shared-data/*.json and docs/*.md straight from the repo
// (see data.js), so the dev server needs permission to serve files outside
// this workspace folder.
export default defineConfig({
  server: {
    port: 5175,
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
});
