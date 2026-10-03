# Estado del programa de cierre — Von Haucke · 2026-10-04 (noche, pasada autónoma)

> Taxonomía estricta por pieza: BUILT · TESTED · SHADOW_VERIFIED · RC_DEPLOYED ·
> PROD_DB_APPLIED · PROD_FRONTEND_DEPLOYED · CUTOVER_COMPLETE · HUMAN_VERIFIED.
> **Nota de honestidad:** la BD Supabase es compartida con producción; toda migración
> aquí es **PROD_DB additive migration applied** (reversible). El **frontend de producción
> NO se tocó** (sólo la preview `vonhaucke-rc`). Ningún CUTOVER del dinero ejecutado.

## STATUS GLOBAL: avance real en 6 bloques; NO es cierre total (faltan #6, #8, #9–#11)

## Bloques trabajados esta pasada

### #1 Source parity — BUILT · TESTED
- 62 divergencias seed(tests)↔config(producción) rastreadas; fixture congelado + `sourceParity.test.js`.
- Mapa de fuentes documentado. NO se sincronizó ningún precio.

### Source reconciliation report — BUILT
- `SOURCE_RECONCILIATION_REPORT.md`: 30 SAME_PRICE_CERTIFIED · 42 PRICE_CONFLICT · **8 UNIT_MISMATCH** (m²↔hoja, costo en unidad equivocada) · 7 PRICE_PENDING (lámina: seed $2270/kg imposible → nube ~$33 parece correcto). Regla: sólo los 30 certificados migran; el resto → Compras.

### #2 Resolver único de costo — BUILT · TESTED(SQL) · PROD_DB_APPLIED · SHADOW_VERIFIED(estático)
- `resolver_costo_insumo()` (migración): estados CERTIFICADO/PRELIMINAR/PROPUESTO/CONFIG_LEGADO/DESCONOCIDO, seller-safe (guardia verificado), nunca inventa 0. Probado los 4 estados vía SQL.
- Shadow estático: los **30 certificados coinciden con el vivo** (0 diff); el resto se marca, no se cambia.
- NO `CUTOVER_COMPLETE` (espera certificación de Compras — BLOCKED_EXTERNALLY).

### #3+#4 DTO estricto + contrato de cálculo — BUILT · TESTED
- `validarIntentCosteo()`: rechaza todo campo económico del cliente (margen/precio/costo/proveedor/factores/parModelo/insumo inline/rol/descuento) → `FORBIDDEN_FINANCIAL_FIELD`; input inválido → `INVALID_INPUT`. Contrato `{ok,code,issues}`, nunca NaN/Infinity.
- +23 tests adversariales (incl. **seller margen=0 → FALLA**).
- Pendiente: espejar el validador DENTRO de la edge `costear-servidor` y desplegarla (shadow).

### #5 Render security — BUILT · TESTED · PROD_DB(edge) APPLIED · HUMAN_VERIFIED(401)
- `generar-render` v24: **verify_jwt=true** + requireUser (permitidos) + límites (máx 7 imágenes, ~28MB) → 401/403/413.
- Verificado en vivo: sin token → **HTTP 401**; bearer inválido → 401. El front manda el JWT del usuario → demo intacto. Reversible a v23.

### #7 Aprobaciones reales — BUILT · TESTED(SQL) · PROD_DB_APPLIED
- `solicitar_aprobacion` / `resolver_aprobacion` (sólo Dirección) / `verificar_aprobacion`, ligadas a `revision_hash`. Actor puesto por el servidor (auth.jwt), no por el browser.
- Verificado end-to-end (ROLLBACK): solicitar→pending→resolver(APROBADA)→verificar(true); **hash distinto → aprobada:false (stale)**.
- Pendiente: que la emisión las exija y que el front use estas RPC (hoy `crm.js` escribe la tabla directo).

### Dinero fail-closed (revisión previa, confirmado) — BUILT · TESTED · RC_DEPLOYED
- `precioDe`/`precioVenta`: margen imposible/costo roto → **NaN que bloquea** (no $0, no capado). `totalesCotizacion` marca `hayLineaInvalida`; Cotización muestra "Cálculo inválido". +guardas de emisión.

## MIGRACIONES PROD_DB aplicadas esta pasada (aditivas, reversibles)
- `resolver_costo_insumo_autoridad_unica`
- `aprobaciones_flujo_rpc`
- (previa) `config_leer_solo_vecostos_cerrar_leak_costo` — RLS config (cierra leak de costo a Ventas)

## EDGE FUNCTIONS
- `generar-render` v24: PROD edge desplegada (verify_jwt=true + auth + límites).

## PENDIENTE (no trabajado esta pasada / incrementos siguientes)
- #6 usuarios/passwords (invite/reset, quitar bootstrap, quitar password_temporal) — BUILT:0.
- #8 cotizar-servidor-autoritativo + emisión V2 + shadow-equivalence + REVOKE legacy — BUILT:0.
- #9/#10 Voni context + read-tools + blockers + compare + adversarial — BUILT:0.
- #11 UX/browser E2E (Playwright) — PARCIAL (flujos clave verificados a mano).
- Shared auth helper para las 8 edge functions — BUILT:0.

## BLOCKED_EXTERNALLY (frontera humana real)
- Auth E2E real (login/forgot/reset/Google): requiere tu buzón → `HUMAN_MAILBOX_SMOKE_PENDING`.
- Certificar 224 costos no-certificados + resolver 62 conflictos / 8 unit-mismatch → **Compras**.
- Cutover del dinero y promoción de frontend a producción → tu gate.

## TESTS
- 671/671 vitest (incluye golden engine 25 familias, adversarial motor, dinero fail-closed, DTO allowlist, source parity, exclusiones PDF).
- Resolver y aprobaciones: TESTED vía SQL (no vitest; son funciones de BD).

## DEPLOY
- Repo: `costeador-vonhaucke`, rama `c3.4-seller-safe`. Frontend prod intacto; RC = `vonhaucke-rc`.
- PROD_FRONTEND_DEPLOYED: no esta pasada (sin cambio de comportamiento de app). PROD_DB: migraciones + edge arriba.
- Rollback: cada migración es reversible (DROP FUNCTION / ALTER POLICY); `generar-render` reversible a v23.
