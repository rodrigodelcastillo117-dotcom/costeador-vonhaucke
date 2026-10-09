# VONHAUCKE — TEST EVIDENCE (corrida FINAL)

> Evidencia concreta de la corrida de ESTE cierre, no histórica. 2026-10-09.

## Entorno
- commit probado (RC hardened): código `ec0a7740591a28a3635fa8115dfc114fcd70d1d9` · HEAD(tip) `bb23454cac9a13a914f6be7742fdc1458bb1bbf8` (branch `audit/final-product-completion`)
- corrida previa de Claude: `f263ba9` (antes del fix DOMPurify de ChatGPT).
- Node: `v26.5.0` · npm: `11.17.0`
- Evidencia LOCAL de Claude + ChatGPT + 2 Previews de Vercel. GitHub CI: 0 workflow runs.

## Comandos y resultados
### `npx vitest run` (suite completa)
- Fecha: 2026-10-09 ~13:30
- **Test Files: 259 passed (259)**
- **Tests: 2182 / 2182 passed** · 0 failed · 0 skipped
- Duration ~8.5s
- Cubre: goldens motor, goldens familias, adversariales, money (NaN/Infinity reject), R15 (sin regresión), R10 (test files de la época: observedPipelineIntegracion 54, observed-core 24, mobiliarioOntologia 9, observedProgram 8, planoGoldenObserved132 20 = 115 verdes), observed_program, acomodo, seller-safe, persistencia (save/reopen confirmado_modelo).

### `npx vite build`
- **✅ built** (Recharts v3 + Home premium). Bundles: `index` ~1.19MB (gzip 299KB), `charts` ~532KB, `pdf` ~410KB. Sin errores.
- Confirmado en dist: Home premium presente ("Cocreando tu espacio", "inicio-premium-hero", "EST. 1958"); Home viejo ("¿Qué vas a hacer?") AUSENTE.

### `deno check` (edges)
- Corrido en cierres previos sobre `leer-plano`, `observed-core`, `leer-plano-core`: ✅. **Este cierre NO modificó edges**, así que no se re-corrió (sin cambios).

### Preview Vercel (smoke)
- deployment `dpl_4kEu62x2ck9cobnUPfz4hxzpZ2ig` @ `f263ba9` → **READY**.
- URL: `https://costeador-vonhaucke-p8gqeurml-rodrigos-eurotrip.vercel.app`
- Carga OK, **0 errores de consola**. Home premium (hero "Cocreando tu espacio" con render real Vonhaucke + login premium) **confirmado por screenshot**. — **PREVIEW_PASS** (carga + home; NO es E2E autenticado completo).

## WARNINGS (no escondidos)
- `npm install`: `fsevents@2.3.3` tiene install script no cubierto por allowScripts. **Aceptado**: es un watcher opcional de macOS para dev (no build/runtime); no se aprueba su script.
- `npm audit` (árbol completo): 11 avisos (1 low, 3 moderate, 5 high, 2 critical). **Separado runtime vs tooling (ChatGPT):** `npm audit --omit=dev` = **0 vulnerabilidades runtime** tras bump DOMPurify 3.4.13→3.4.16 (`ec0a774`). Los 10 avisos restantes son dev/test (Vitest/tinypool/Vite/vite-plugin-singlefile y transitivas); las 2 critical son de Vitest/tinypool, NO del bundle de empleados. No se hizo `audit fix --force` (implicaría majors de Vite/Vitest). Confirmado: `npm audit --omit=dev → found 0 vulnerabilities`.
- Vite dev (local) sirvió Home viejo por caché de pre-bundle tras cambiar deps; irrelevante para el build desplegado (dist correcto).

## ETIQUETAS DE EVIDENCIA
- UNIT_PASS / INTEGRATION_PASS: suite 2182 verde.
- PREVIEW_PASS: preview READY + home premium + 0 consola.
- RECORDED_CONTRACT / MOCK_ONLY: golden observed (no PDF vivo).
- NOT_VERIFIED: E2E autenticado de los 3 flujos, reset de contraseña live, lectura de plano con PDF real, R10-14 PAGINA_FUERA_DE_RANGO live.
- BLOCKED_EXTERNAL: production promote (harness), deploy de edges, CI independiente.
- DATA_TRUTH_REQUIRED: cutover de precios/materiales reales.
