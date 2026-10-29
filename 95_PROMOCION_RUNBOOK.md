# 95_PROMOCION_RUNBOOK — promover el motor `-rc` a producción (NO ejecutado)

**Fecha:** 2026-10-29. Estado: **PREPARADO, no ejecutado.** La ejecución toca producción (§100) y espera
el "ejecuta la ventana" de Rodrigo **sobre este plan concreto** + el candado de certificación de abajo.

## Candado previo (NO promover sin esto)
La promoción está **BLOQUEADA** hasta que los flujos profundos del `-rc` estén certificados contra el motor:
- [ ] COSTEAR profundo (texto/imagen → BOM → costo) E2E verde contra `-rc` (con fixture real, no 'texto').
- [ ] COCREAR (expediente → render → reabrir) E2E verde contra `-rc` (con semilla QA).
- [ ] RENDERS (golden757 → renderEscenas) E2E verde en la secuencia orquestada.
Hoy los 3 están **SIN MEDIR limpio** (ver `95_SCORECARD.md`). Promover sin esto sería shipear motor sin certificar.

## Idea clave (por qué es de bajo riesgo si se hace bien)
El frontend de producción llama a los slots PROD (`costear-servidor`, `analizar-mueble`, …) con `CARRIL_RC`
apagado. **Promover = desplegar el CÓDIGO de cada `*-rc` dentro de su slot PROD.** El frontend NO cambia.
Es redeploy de Edge Functions, reversible redeployeando la versión previa.

## Paso 0 — Respaldos (antes de tocar nada)
Versiones/hashes PROD actuales a preservar para rollback (de `95_RELEASE_MANIFEST.md`):
| Slot PROD | ver actual | ezbr_sha256 (12) a conservar |
|---|---:|---|
| costear-servidor | 17 | `28a09647c47e` |
| analizar-mueble | 38 | `a682b1c0fcd2` |
| cotizar-texto | 18 | `344a93487590` |
| generar-render | 31 | `ed78f9a85913` |
| acomodar-espacio-recovery | 19 | `65740137f0fb` |
| leer-plano-core | 8 | `64715a20c7e2` |
- [ ] Snapshot/respaldo DB (migración `respaldo_ventana_*` o export) — la DB ya está al día; no cambia en esta promoción.
- [ ] Deployment Vercel prod actual para rollback: `dpl_DuxmoFiMxZscSY1kf4Wv7SiuyMTn` (fece6c3).

## Paso 1 — Desplegar código `-rc` → slot PROD (uno por uno, con smoke entre cada uno)
Por cada par, desplegar el source de la `-rc` en el slot PROD (Supabase `deploy_edge_function`):
1. `costear-servidor` ← código de `costear-servidor-rc` v30 (`a56ab299e734`)
2. `analizar-mueble` ← `analizar-mueble-rc`
3. `cotizar-texto` ← `cotizar-texto-rc`
4. `generar-render` ← `generar-render-rc`
5. `acomodar-espacio-recovery` ← `acomodar-espacio-recovery-rc`
6. `leer-plano-core` ← `leer-plano-core-rc`
(El frontend ya apunta a estos slots; no se toca Vercel salvo que haya cambios de cliente pendientes.)

## Paso 2 — Smoke en producción (cuenta real humana, no qa)
- [ ] COSTEAR un mueble con precio conocido → número correcto.
- [ ] COTIZAR texto → propuesta.
- [ ] Emisión: material sin precio → "TOTAL INCOMPLETO" (no total falso).
- [ ] Seller-safe: el vendedor no ve costos.
- [ ] Verificar versiones/hashes nuevos y re-emitir `95_RELEASE_MANIFEST.md`.

## Paso 3 — Rollback (si algo falla)
Redeployar cada slot PROD a su versión/hash previo (tabla del Paso 0). El frontend no cambió, así que el
rollback de edges es suficiente. Tiempo estimado: minutos por slot.

## Quién ejecuta
Lo ejecuto yo cuando Rodrigo diga "ejecuta la ventana" **y** el candado de certificación esté en verde.
Ventana estimada: ~2–3 h con smoke. Riesgo: bajo-medio (redeploy reversible), condicionado a la certificación.
