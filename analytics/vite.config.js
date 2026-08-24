import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  envDir: path.resolve(__dirname, '..'),
  server: { fs: { allow: [path.resolve(__dirname, '..')] } },
});
