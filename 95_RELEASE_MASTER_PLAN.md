# 95_RELEASE_MASTER_PLAN.md — Operación GOD MODE 9.5

> Plan maestro de release a **piloto 9.5**. Un renglón por hallazgo; **no se borran, se cierran** (§91).
> BASE_SHA al abrir: `728ac8a2d910ee3a68e9527b6b0d858aad2b173b` · prod `862d327` (sin tocar).
> Estado del bloque: **§103 (rebaseline) en curso** → ver `CURRENT_BASELINE.md`.

## Formato
`ID · Área · Severidad · Reproducción · Causa raíz · Evidencia · Fix · Prueba(antes→después) · Commit · Estado`

---

## HALLAZGOS

### P0-CI-01 · CI / E2E Playwright
- **Severidad:** P0 (bloquea merge y 9.5, §72).
- **Reproducción:** CI run #979 sobre `728ac8a`, job *"E2E público + autenticado"*, paso *"E2E público + auth condicional"* → failure (13 min). Job `verify` (unit/build/audit) verde.
- **Causa raíz:** PENDIENTE (no reproduce en corrida local, que no corre Playwright). Diagnóstico en bloque §104.
- **Evidencia:** actions/runs/40431490402.
- **Fix / prueba / commit:** PENDIENTE.
- **Estado:** 🔴 **ABIERTO**.

### P0-03 · Precios aprobados por cuenta no-humana
- **Severidad:** P0 (integridad de dato / autoridad).
- **Reproducción:** 12,971/12,973 precios `aprobado`+vigente, **0 propuestos**; `qa-direccion@vonhaucke.mx` es dirección en `permitidos` y está en `cuentas_no_humanas`.
- **Causa raíz:** PENDIENTE — medir cuántos aprobados provienen de cuentas no-humanas vs humanas reales (`aprobaciones_precio_historial`, 11,847).
- **Fix:** no convertir; reclasificar los que carezcan de aprobación humana real a estado preliminar/no-emitible (propuesta, requiere Dirección).
- **Estado:** 🔴 **ABIERTO**.

### P0-05 · Acomodo — GHOST_PLACEMENT por identidad/stale
- **Severidad:** P0 (Acomodo fantasma bloquea 9.5, §95).
- **Reproducción:** plan React V1 vs lista esperada V2 → 92/92 colocadas y simultáneamente "92 no están en la lista". Documentado con file:line en `lab/ACOMODO_LIST_MISMATCH.md` (verificado: `acomodoInvariantes.js` GHOST, `Acomodo.jsx` sanearAcomodoContraPartidas, `acomodoVeredicto.js`).
- **Causa raíz:** `acomodoLocal`/`plan` en `useState` conservan plan viejo cuando cambian las partidas; comparación por string exacto marca todo GHOST.
- **Fix (propuesto):** invalidar/re-derivar el plan (STALE_PROGRAM) antes de comparar; test V1(92/92 PASS) → cambio de identidad con 92 piezas → STALE, no GHOST.
- **Estado:** 🔴 **ABIERTO** (diagnóstico listo).

### P0-01 · Cotizar ECONOMICS_INCOMPLETE
- **Severidad:** P0 si reproduce.
- **Reproducción:** histórico (partidas sin costo oficial). **Re-verificar en HEAD** con catálogo actual (12,971 precios).
- **Estado:** 🟡 **A RE-VERIFICAR**.

### P1-EDGE-01 · Trazabilidad edges prod↔SHA
- **Severidad:** P1.
- **Reproducción:** edges prod con `entrypoint_path` en `/tmp/user_fn…` (fuera de banda); `EDGE_INVENTORY.md`.
- **Fix (gobernado):** redeploy desde repo al SHA final + metadata `build_sha`/`edge_version`/`request_id` en respuesta (§31). Requiere autorización prod (§100).
- **Estado:** 🔴 **ABIERTO**.

### P1-SEC-01 · `_bk_familia_app_20261021` RLS off
- **Severidad:** P1.
- **Reproducción:** advisor Supabase *critical*: RLS disabled, 306 filas, expuesta a anon/authenticated.
- **Fix (propuesto, gobernado):** `DROP TABLE` (es backup) o `ENABLE RLS` + revoke grants. Requiere autorización prod (§100).
- **Estado:** 🔴 **ABIERTO**.

### P1-PREV-01 · Sin preview en SHA actual
- **Severidad:** P1 (§76).
- **Reproducción:** último preview de rama = `ea31d459`, no hay en `728ac8a`.
- **Fix:** generar/verificar preview cuyo `githubCommitSha == FINAL_SHA` antes del veredicto.
- **Estado:** 🔴 **ABIERTO**.

---

## BLOQUES (§103–§111) — estado
| # | Bloque | Estado |
|---|---|---|
| 1 | §103 Rebaseline (CURRENT_BASELINE/plan/edges) | 🟡 en curso (docs creados; falta cerrar política autoridad + flags) |
| 2 | §104 P0/P1 en HEAD | ⬜ siguiente |
| 3 | §105 Canonical core (ADR + adapters) | ⬜ |
| 4 | §106 Costear 9.5 | ⬜ |
| 5 | §107 Cotizar 9.5 | ⬜ |
| 6 | §108 Cocrear 9.5 | ⬜ |
| 7 | §109 Cross-system (identity/stale/concurrency) | ⬜ |
| 8 | §110 Hardening (security/UX/responsive/perf/obs) | ⬜ |
| 9 | §111 Certificación (unit/integration/E2E/live/preview/smoke) | ⬜ |

## Acciones que requieren autorización de Rodrigo (§100) — represadas, documentadas
1. Aplicar migración TELCEL + cargar 49 precios (prod DB). *(autorizado: "ya puedes cargar telcel" — ejecutar con cuidado: staging/branch primero, precios preliminares.)*
2. Redeploy edges prod desde repo (P1-EDGE-01).
3. Borrar/RLS tabla backup (P1-SEC-01).
4. Merge a prod / promote / preview de SHA final.
5. Política estricta de autoridad, cambios de rol, borrado de datos.
