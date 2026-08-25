import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/analytics/' : '/',
  define: { __FIELDFLOW_DEMO__: command !== 'build', __FIELDFLOW_PRODUCTION__: command === 'build' },
  envDir: path.resolve(__dirname, '..'),
  server: { fs: { allow: [path.resolve(__dirname, '..')] } },
}));
