# 95_RELEASE_MASTER_PLAN.md — Operación GOD MODE 9.5

> Plan maestro de release a **piloto 9.5**. Un renglón por hallazgo; **no se borran, se cierran** (§91).
> BASE_SHA al abrir: `728ac8a2d910ee3a68e9527b6b0d858aad2b173b` · prod `862d327` (sin tocar).
> Estado del bloque: **§103 (rebaseline) en curso** → ver `CURRENT_BASELINE.md`.

## Formato
`ID · Área · Severidad · Reproducción · Causa raíz · Evidencia · Fix · Prueba(antes→después) · Commit · Estado`

---

## HALLAZGOS

### P0-CI-01 · CI / E2E Playwright — **REGRESIÓN real en carga del ERP**
- **Severidad:** P0 (bloquea merge y 9.5, §72). Además era un **bug de producción**, no sólo del test.
- **Reproducción:** CI run #979 sobre `728ac8a`, job *"E2E público + autenticado"* → failure. Hard-fail en `e2e/cargaErp.e2e.js:35` (`verify` verde). Reproducido en local con navegador real + con el parser real contra el fixture `erp_ultima_compra_mini.xlsx`.
- **Causa raíz:** el candado de workbooks de proyecto (TELCEL, serie `ERP:`) **se tragó el reporte directo de Intelisis**. `registrosErpDesdeWorkbookProyecto` elegía la MISMA hoja como explosión y como "catálogo MP" (porque el reporte trae Clave Comercial inline) → `hojaCatalogo` truthy → se clasificaba como `workbook_proyecto` → `forzarValidacionCompras: true` → **0 precios ≤24 m se certificaban**. En producción, Dirección sube el reporte mensual de Compras y la app se niega a certificar. No era un test viejo: bajarlo al label nuevo habría ocultado la regresión (§97).
- **Fix:**
  - `src/datos/erpProyecto.js`: si la "hoja catálogo" detectada es la MISMA que la explosión (`cat === exp`) → `cat = null` (un reporte directo no tiene catálogo auxiliar); nuevo flag explícito `esWorkbookProyecto` = explosión nombrada (`explo_x_id…`) **o** catálogo MP en hoja aparte.
  - `src/componentes/CargaERP.jsx`: `origen` se decide por `esWorkbookProyecto`, no por `hojaCatalogo`.
  - `src/datos/erpProyecto.test.js`: candado de regresión (reporte directo de una hoja con clave inline → `hojaCatalogo:null`, `esWorkbookProyecto:false`) + asserts `esWorkbookProyecto:true` en el workbook real TELCEL.
  - `e2e/cargaErp.e2e.js`: label correcto del reporte directo (`Compra ≤ 24 meses 2`, sin "(se certifican)") + asserts que fijan la clasificación (`Reporte Última Compra`, y NO "Precios de proyecto que requieren revalidación").
  - `e2e/cotizarProyectos.e2e.js`: espera flaky del botón "Descargar PDF" 15s→30s (alineada con el resto del flujo async; no debilita la aserción).
- **Prueba (antes→después):** vitest afectados 43/43 (incl. candado nuevo); `cargaErp.e2e.js` **4/4 con Chromium real** (antes 1 hard-fail); `npm run build` PASS. Workbook real TELCEL sigue forzando revalidación (unit).
- **Commit:** rama `claude/costing-app-architecture-psf02g` (este push).
- **Estado:** 🟢 **CERRADO en local**; pendiente confirmar **CI verde** tras push.

### P0-03 · Precios aprobados por cuenta no-humana
- **Severidad:** P0 (integridad de dato / autoridad).
- **Reproducción:** 12,971/12,973 precios `aprobado`+vigente, **0 propuestos**; `qa-direccion@vonhaucke.mx` es dirección en `permitidos` y está en `cuentas_no_humanas`.
- **Causa raíz:** PENDIENTE — medir cuántos aprobados provienen de cuentas no-humanas vs humanas reales (`aprobaciones_precio_historial`, 11,847).
- **Fix:** no convertir; reclasificar los que carezcan de aprobación humana real a estado preliminar/no-emitible (propuesta, requiere Dirección).
- **Estado:** 🔴 **ABIERTO**.

### P0-05 · Acomodo — GHOST_PLACEMENT por identidad/stale
- **Severidad:** P0 (Acomodo fantasma bloquea 9.5, §95).
- **Reproducción:** plan React V1 vs lista esperada V2 → 92/92 colocadas y simultáneamente "92 no están en la lista". Documentado con file:line en `lab/ACOMODO_LIST_MISMATCH.md` (verificado: `acomodoInvariantes.js` GHOST, `Acomodo.jsx` sanearAcomodoContraPartidas, `acomodoVeredicto.js`).
- **Causa raíz:** el cross-check de identidad emitía un `GHOST_PLACEMENT` por cada colocación cuando el plan guardado pertenece a OTRA versión del programa (todos los IDs ajenos). La geometría seguía válida; cambió la identidad. El resultado era una "tormenta" de N fantasmas contradictoria con "92 colocadas".
- **Fix (hecho, capa de datos, unit-testeado):**
  - `acomodoInvariantes.js`: cuando el plan es **íntegramente ajeno** (`colocadosValidos===0` con colocaciones y piezas>0) emite **una** falla `STALE_PROGRAM` en vez de N× `GHOST_PLACEMENT`. Sigue siendo `fail` (status FAIL, no publica → gating idéntico). Contaminación PARCIAL sigue marcando fantasma por pieza (sin cambio).
  - `acomodoVeredicto.js`: `STALE_PROGRAM` → texto único "el acomodo guardado es de otra lista: vuelve a acomodar con la cotización actual" (clase geometría). `estadoHumano.js` ya lo trataba como estado ámbar "recalcula".
  - `acomodoInvariantes.test.js`: +2 tests (íntegro→1 STALE_PROGRAM, FAIL, no publicable; parcial→GHOST por pieza).
- **Prueba:** vitest acomodo 256/256 (incl. 2 nuevos) + veredicto/estadoHumano/sinCódigos 66/66; build PASS.
- **Follow-up verificable (no en este commit):** auto-limpieza reactiva del `plan` stale en `AcomodoBase.jsx` (vaciar el lienzo al vuelo cuando cambia la identidad del programa con el componente montado). Requiere infra de test de componente (no hay `@testing-library/react`) o corrida E2E con secretos; se deja fuera para no empujar un cambio de estado React no verificable que pueda tornar CI rojo (§72). El saneo al montar (`sanearAcomodoContraPartidas`, ya testeado) cubre el caso de reabrir; el relabel cubre el caso montado.
- **Estado:** 🟢 **núcleo cerrado** (reconoce STALE, bloquea publicación, texto honesto; unit-testeado) · follow-up de UX reactiva pendiente/documentado.

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
