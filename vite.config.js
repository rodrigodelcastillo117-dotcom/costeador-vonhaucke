import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Trazabilidad del build: cada deployment debe poder responder "¿qué commit veo?".
// El SHA sale de git; si no hay git (CI raro), queda 'desconocido' sin romper el build.
function gitSha() {
  const env = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA;
  if (env) return env.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'desconocido'; }
}
let appVersion = '0.0.0';
try { appVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version || '0.0.0'; } catch {}

// ============================================================================
//  BUILD DUAL (2026-10-05)
//  · `vite build`            → WEB: chunked, con vendors partidos y carga diferida
//                               de lo pesado (pdf, charts). Primera carga ligera.
//  · `vite build --mode portable` → PORTABLE: UN solo index.html con TODO inline,
//                               para enviarlo por donde sea y que funcione SIN
//                               internet (el caso del vendedor en campo). Es la
//                               propiedad que antes era el default; ahora es opt-in.
//  Las dos salen de la MISMA fuente; sólo cambia cómo se empaca.
// ============================================================================
export default defineConfig(({ mode }) => {
  const portable = mode === 'portable';
  return {
    plugins: [react(), ...(portable ? [viteSingleFile()] : [])],
    define: {
      __BUILD_SHA__: JSON.stringify(gitSha()),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
      __APP_VERSION__: JSON.stringify(appVersion),
      __PORTABLE__: JSON.stringify(portable),
    },
    build: {
      target: 'es2018',
      chunkSizeWarningLimit: 5000,
      // PORTABLE: todo inline (un archivo). WEB: deja que Vite parta y versione.
      ...(portable
        ? { cssCodeSplit: false, assetsInlineLimit: 100000000 }
        : {
            cssCodeSplit: true,
            rollupOptions: {
              output: {
                // Vendors pesados en su propio chunk: se cachean aparte y lo que
                // sólo usa una pantalla (charts, pdf) no infla la carga inicial.
                manualChunks: {
                  react: ['react', 'react-dom'],
                  charts: ['recharts'],
                  pdf: ['jspdf', 'pdfjs-dist'],
                  supabase: ['@supabase/supabase-js'],
                },
              },
            },
          }),
    },
  };
});
