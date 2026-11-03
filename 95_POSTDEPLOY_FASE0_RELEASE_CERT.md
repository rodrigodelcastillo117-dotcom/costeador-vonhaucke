# 95_POSTDEPLOY_FASE0 — certificación del release en producción (2026-11-03)

Objetivo (directiva POST-DEPLOY FASE 0, prioridad absoluta): comprobar que el deploy `f0056a56` quedó **READY** y
**sirviendo** en el dominio de producción, que CI pasó, que los edges no cambiaron, que los flujos responden, y que el
**rollback está disponible** — antes de avanzar. Evidencia, no "pasaron los tests".

## 1. Deploy READY ✓
- Deploy `dpl_25egK5vooXZtnAk6jvuvDxkVy5a5`, commit **f0056a56bff6ba136b90a10693e50dd823d5e584**, ref `c3.4-seller-safe`.
- Vercel: `state: READY`, `readyState: READY`, `ready: 1793683757747`, `aliasError: null`.
- Build log: `Build Completed in /vercel/output [8m]` → `Deployment completed`. El build de Vercel corre la suite
  vitest completa como parte del `build command`; el deploy sólo llega a READY si ese comando sale 0. **READY ⟹ CI verde**
  (un test rojo saldría ≠0 → estado ERROR, no READY). Los eventos de build mostraron los archivos de prueba pasando en
  secuencia (formulaAlba, planner.ceo, resolverArticulo, specTecnica, etc.).

## 2. Commit sirviendo = f0056a56 ✓ (verificado por hash de bundle, no por confianza)
Dominio de producción del proyecto (`get_project.domains`):
- **`costeador-vonhaucke.vercel.app`** → `assets/index-CeJ_GC74.js` = **idéntico** al bundle del deploy f0056a56
  (`costeador-vonhaucke-39nienibc-...` sirve el mismo `index-CeJ_GC74.js`). **Sirviendo el commit correcto.** ✓
- `costeador-vonhaucke-git-c34-seller-safe-rodrigos-eurotrip.vercel.app` (alias de rama) → f0056a56. ✓

Contraste (para probar que el hash discrimina): el deploy anterior 2b78f57 sirve `index-Bo6sn6D7.js` (distinto).

### Hallazgo (no bloqueante) — alias huérfano
`costeador-vonhaucke-rodrigos-eurotrip.vercel.app` **NO** está en `get_project.domains` y sirve `index-CTiY4v9t.js`
(un bundle **más viejo** que 2b78f57). Es un alias huérfano que no auto-actualiza. **No es el dominio de producción.**
Riesgo: si alguien lo tiene en marcadores, vería código viejo. Recomendación de limpieza: reasignar o borrar ese alias.
No bloquea el release porque el dominio canónico (`costeador-vonhaucke.vercel.app`) sirve f0056a56.

## 3. CI verde ✓
Implicado por READY (§1). El build de 8 min = suite completa + `vite build` (`✓ built in 13.01s`), exit 0.

## 4. Edges sin cambio ✓
`git diff --stat 2b78f57 f0056a5 -- supabase/functions/` = **vacío**. El release tocó 28 archivos: frontend JS
(`AsistenteEspecial.jsx`, `motor/calculo.js`, `datos/emparejarLinea.js`), pruebas y 21 `.md`. **0 edges.**
Edges de producción vigentes y `ACTIVE` (sin tocar por este deploy):
`analizar-mueble` v39 · `costear-servidor` v18 · `cotizar-servidor` v8 · `leer-plano-core` v9 · `voni-council` v14 ·
`acomodar-espacio-recovery` v20 · `generar-render` v32.

## 5. Smoke de producción ✓
Frontend (dominio canónico): `index.html` 200 · `assets/index-CeJ_GC74.js` 200 (1,386,687 B, `application/javascript`) ·
`assets/index-CYwWDsLx.css` 200 (558,934 B). El bundle nuevo carga.
Edges (POST sin auth → **401** = desplegado y protegido por JWT, no 404/500/crash):
costear-servidor 401 · cotizar-servidor 401 · analizar-mueble 401 · leer-plano-core 401 · voni-council 401 ·
acomodar-espacio-recovery 401 · generar-render 401. Los 7 vivos y protegidos. (Smoke de liveness: 0 datos, 0 auth, 0 mutación.)

## 6. Rollback disponible ✓
`dpl_DkQ3EH3wXX51SVyi5cp4jHdKxvcu` (commit **2b78f57ca69f...**, READY) → `isRollbackCandidate: true`.
Plan de rollback (NO ejecutado — requiere autorización expresa, directiva: "No hagas rollback automáticamente"):
`request_rollback` a ese deploy, o `git revert`/reset del merge en `c3.4-seller-safe`. El bundle de 2b78f57 sirve `index-Bo6sn6D7.js`.

## Veredicto FASE 0: RELEASE CERTIFICADO ✓
Los 6 puntos pasan con evidencia. Un hallazgo no bloqueante (alias huérfano, §2). No se tocó producción ni se hizo
rollback. Listo para avanzar a FASE 1 (auditoría herrajes, entregable aparte) y siguientes, con autorización.
