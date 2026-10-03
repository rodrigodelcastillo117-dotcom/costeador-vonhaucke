import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Trazabilidad del build: cada deployment debe poder responder "¿qué commit veo?".
// El SHA sale de git; si no hay git (CI raro), queda 'desconocido' sin romper el build.
function gitSha() {
  // Vercel expone el SHA del commit en env; si no, se pregunta a git local.
  const env = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA;
  if (env) return env.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'desconocido'; }
}
let appVersion = '0.0.0';
try { appVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version || '0.0.0'; } catch {}

// Empaqueta TODO (JS, CSS) en un solo index.html, sin CDN ni dependencias
// externas, para poder enviarlo por donde sea y que funcione sin internet.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: {
    __BUILD_SHA__: JSON.stringify(gitSha()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    target: 'es2018',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 5000,
  },
});
