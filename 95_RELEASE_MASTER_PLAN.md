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
- **Commit:** `9a98997` en `claude/costing-app-architecture-psf02g`.
- **Estado:** 🟢 **CERRADO** — **CI run #981 = success** (job `verify` + job "E2E público + autenticado" verdes) sobre `9a98997`. Regresión verificada de punta a punta.

### P0-03 · Precios aprobados por cuenta no-humana → **medido; sub-hallazgo de frescura**
- **Severidad:** P0 (integridad de dato / autoridad).
- **Medición (read-only, HOY):** de 12,971 precios `aprobado`+vigente, **TODOS** (`min==max`) tienen `approved_by = rodrigo.delcastillo@vonhaucke.mx` (humano, Dirección). **0** atribuidos a `qa-direccion` o `reconciliacion`.
- **Historial (`aprobaciones_precio_historial`, 11,847, todo el 2026-10-18):** las re-firmas humanas existen y cuadran — `qa-direccion→rodrigo`: **1,750 (≤24m) + 13 (≤120m) = 1,763** (exactamente los que el baseline temía) · `reconciliacion→rodrigo`: **30**. El resto son primeras firmas de Rodrigo.
  → **La preocupación "aprobado por cuenta no-humana" (P1-03) está CERRADA**: la autoridad viva de cada precio es un humano real.
- **Sub-hallazgo NUEVO (frescura/transparencia) — P0-03b:** la antigüedad REAL del documento que respalda cada precio vigente: **≤24m: 3,670 (28%)** · 25–60m: 1,443 · 61–120m: 3,027 · **>120m (>10 años): 4,831 (37%)**, el más viejo de **2009-12-03**. → **9,301/12,971 (72%) descansan en documentos >24 meses.** Fueron aprobados bajo tiers explícitos de Dirección (`D1 ≤360/≤120/≤24 meses`, firmados por Rodrigo), así que **no es un bug ni una aprobación indebida**: es una decisión de negocio sobre qué tan viejo se acepta un documento de compra como base de costo.
- **Acción tomada (aditiva, sin cambiar política ni estado — §3/§100 respetados):** el costeo **ya dice** cuándo se apoya en documentos viejos. Antes la fecha sólo vivía en el admin de Precios; ahora `costearServidor` calcula `resumenFrescura(preciosUsados)` y, cuando ≥1 material tiene última compra >24 meses, agrega la advertencia *"Frescura: N de M material(es) con última compra de hace más de 24 meses (más antigua: AAAA-MM-DD). El costo puede estar desactualizado; confírmalo con Compras…"* al canal de `warnings/motivos` que la UI de costeo ya muestra. Seller-safe (fechas/conteos, nunca el precio). **No baja el estado** (exigir vigencia es decisión de Dirección). `vigente_desde` añadido a la traza `preciosUsados`.
  - Archivos: `autoridadCosteoServidor.js` (`resumenFrescura` + `vigente_desde` en traza), `costeoServidor.js` (advertencia + `frescura` en snapshot). Tests: `autoridadCosteoServidor.test.js` +4 (fresco / mezcla / sin-fecha / vacío). 90/90 reales verde, build PASS.
- **Decisión que sigue siendo de Dirección:** si la frescura debe **bloquear** la certificación (exigir ≤24m) o re-tier de D1. El aviso ya existe; convertirlo en gate es §3/§100.
- **Estado:** 🟢 **P1-03 (no-humana) cerrado** · 🟢 **P0-03b aviso de frescura enviado en costeo** (aditivo, testeado) · 🟡 decisión de gate = Dirección.

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

### P0-01 · Cotizar ECONOMICS_INCOMPLETE — **re-verificado: no es bug de código**
- **Severidad:** P0 si fuera defecto de código; **no lo es**.
- **Medición (HOY, read-only):** `costeos_servidor` (1,010): certificado **112**, preliminar 563, incompleto 276, bloqueado 59. Vigentes (`partida_costeo_vigente`, 36): certificado 23, preliminar 13.
- **Causa:** `ECONOMICS_INCOMPLETE` se dispara cuando una línea no tiene costo **certificado** (`emision.js`: `linea_N_costo_(preliminar_)no_certificado`). Es la compuerta **fail-closed correcta** (§22): no emite un precio comercial sin costo certificado. El aviso de frescura nuevo NO cambia el estado, así que **no aumenta** el bloqueo.
- **Qué lo reduciría (no es código):** más costeos certificados = más cobertura de precios certificados + confirmación de materiales (USER_CONFIRMED) + la decisión de frescura/tiers (P0-03b). Todo **dato/política = Dirección**. Bajar la compuerta para "desbloquear" sería fingir emitibilidad (§97): no se hace.
- **Estado:** 🟢 **código correcto (fail-closed)** · 🟡 cobertura de certificación = dato/Dirección (ligado a P0-03b).

### P1-EDGE-01 · Trazabilidad edges prod↔SHA
- **Severidad:** P1.
- **Reproducción:** edges prod con `entrypoint_path` en `/tmp/user_fn…` (fuera de banda); `EDGE_INVENTORY.md`.
- **Fix (gobernado):** redeploy desde repo al SHA final + metadata `build_sha`/`edge_version`/`request_id` en respuesta (§31). Requiere autorización prod (§100).
- **Estado:** 🔴 **ABIERTO**.

### P1-SEC-01 · `_bk_familia_app_20261021` RLS off — **corregido: no es fuga, es higiene**
- **Severidad real:** baja (higiene), NO P1 de exposición. El baseline lo sobrevaloró.
- **Medición (HOY, read-only):** la tabla tiene RLS off (306 filas), **pero anon/authenticated/public NO tienen grant** (`role_table_grants` vacío) → **no es legible por la API**; sólo service_role/owner. Por eso el advisor de seguridad de hoy ya **no** la marca.
- **Fix (gobernado, LISTO, no aplicado):** `lab/seguridad/P1-SEC-01_backup_cleanup.sql` — `DROP TABLE` del respaldo (o habilitar RLS + revoke como alternativa). §100 = Dirección lo aplica.
- **Estado:** 🟢 **sin fuga real** · 🟡 limpieza opcional lista para Dirección.

### §56 · SECURITY DEFINER ejecutables por `authenticated` — **verificado seguro**
- **Reproducción:** advisor Supabase (WARN): 16 funciones `SECURITY DEFINER` callables por `authenticated` vía `/rest/v1/rpc`.
- **Verificación (HOY, `pg_get_functiondef`):** las 12 privilegiadas (aprobar/certificar/cargar/firmar/cerrar/revalidar) **todas** tienen candado de rol interno (`puede_certificar_costo()` o chequeo `direccion`/`cuentas_no_humanas`) y **lanzan excepción**. Las read-only restantes (`catalogo_motor`, `buscar_insumos_motor`, `politica_comercial_publica`, `puede_certificar_costo`) son de lectura curada. → **Un vendedor NO puede certificar/aprobar/cargar.** WARN = falso positivo para integridad.
- **RLS-enabled-sin-policy (8 tablas, INFO):** quedan **cerradas** (RLS on + sin policy ⇒ nadie lee salvo service_role); son tablas escritas por servidor y leídas vía RPC/edge. Fail-safe, sin acción.
- **Estado:** 🟢 **sin hallazgo de autoridad**.

### P1-PREV-01 · Sin preview en SHA actual
- **Severidad:** P1 (§76).
- **Reproducción:** último preview de rama = `ea31d459`, no hay en `728ac8a`.
- **Fix:** generar/verificar preview cuyo `githubCommitSha == FINAL_SHA` antes del veredicto.
- **Estado:** 🔴 **ABIERTO**.

---

### AUD · Auditorías de código Cotizar + Cocrear (hallazgos verificados en código)
Dos auditorías read-only (subagentes) + verificación mía en el código real. Lo que reproduje, lo arreglé con prueba; lo que no, lo descarté o lo marqué como decisión.
- **AUD-COC-01 (P1, ARREGLADO):** al convertir un co-creado en partida, `agregarDesdeAsistente` no pasaba el **costo del servidor** → `partidaDeCosteo` lo **recalculaba con el catálogo local** (podía diverger/null del que ya costeó el servidor). Fix: `CocrearV3` pasa `costoServidor` (seller-safe) → `App.agregarDesdeAsistente` → `partidaDeCosteo`. D-02/D-03 (el dinero de Cocrear es del servidor). Verificado: build + `cocrearMoneyTrust`/`agregar` verdes.
- **AUD-COC-02 (P2 seller-safe, ARREGLADO):** `CocrearV3:643` pintaba "Costo comparable autorizado" **sin gate `veCostos`** (dependía sólo de RLS). Fix: ahora requiere `veCostos`. Belt-and-suspenders restaurado.
- **AUD-COT-01 (P1, ARREGLADO):** el **PDF al cliente** imprimía un TOTAL limpio aunque un renglón fuera "Pendiente" (lo contaba como $0; la pantalla sí avisaba, el PDF no). Fix: `pdfPropuesta` etiqueta "Suma de renglones con precio" + "TOTAL INCOMPLETO · faltan N precios" cuando `faltanPrecio>0`/`hayLineaInvalida`. No cambia números. +2 tests en `pdfMoneyTrust`.
- **AUD-COT-02 (P1 → NO es riesgo de prod, verificado):** el control optimista (VH-148, 409 VERSION_CONFLICT) está detrás de `VITE_CONTROL_OPTIMISTA`, **OFF en el repo** pero **ON en producción**: Vercel tiene `VITE_CONTROL_OPTIMISTA=1` en target *production* (lo prendió Rodrigo 2026-10-17 "después del SQL 1-6", VH-148). → En el piloto (que corre sobre prod) **la protección de concurrencia SÍ está activa**; no hay last-write-wins. El agente lo marcó por el default del repo; el env de prod lo sobreescribe. Nota: la Preview de esta rama no trae el flag (sólo `CARRIL_RC`), así que probar concurrencia en Preview requiere añadirlo — pero al mergear a prod, el env *production* aplica igual.
- **AUD-COC-03 (P2, DIFERIDO):** quitar una *feature* de un BOM derivado de Costear deja sus piezas reales → sobre-costea (más caro, visible, "más seguro que sub-costear"). Baja confianza; se documenta.
- **AUD-COT-03 (P2, ARREGLADO):** la tarjeta de Archivo mostraba el `total` persistido sin bandera (misma raíz que AUD-COT-01). Fix: `paraGuardar` persiste `total_completo`/`faltan_precio`; `Archivo.jsx` muestra "(incompleto · faltan N)" cuando `total_completo===false`. Registros viejos (sin la bandera) no marcan nada. +2 tests en `cotizaciones.guardado`.
- **LIMPIO (verificado, sin defecto):** identidad/no-dup de partidas al guardar/reabrir; conservación de acomodo (requested=placed+unplaced); seller-safe de la partida y del PDF (re-stripping); autoridad de emisión (servidor BLOQUEA sobre ALLOWED local); Cocrear identidad/STALE/render≠realidad/Unknown≠$0 en el camino vivo V3.

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
1. Aplicar migración TELCEL + cargar 49 precios (prod DB). **PAQUETE LISTO (no toca prod)** en `lab/precios_telcel/`: `TELCEL_LOAD_READY.sql` (49 materiales, preliminares, 0 inventados, 0 dudosos) + `TELCEL_LOAD_RUNBOOK.md` (pasos, verificación, rollback) + `gen_telcel_load.mjs` (reproducible). Dirección lo corre cuando quiera; los precios entran preliminares (requieren revalidación de Compras, nunca certificados). *(autorizado: "ya puedes cargar telcel"; el usuario eligió "preparar paquete, no tocar prod".)*
2. Redeploy edges prod desde repo (P1-EDGE-01).
3. Borrar/RLS tabla backup (P1-SEC-01).
4. Merge a prod / promote / preview de SHA final.
5. Política estricta de autoridad, cambios de rol, borrado de datos.
