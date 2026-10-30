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
4. `generar-render` ← SOURCE de esta rama (trae **FLASH por defecto + `pro` opcional** + fallback pro↔flash).
   El cliente llama `generar-render` incluso en preview, así que el cambio de velocidad SÓLO vive al desplegar este slot.
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

---

## EJECUTADO — 2026-10-30 (autorizado por Rodrigo: "promuevelo")
Promoción del motor avanzado a los slots PROD vía `deploy-edge.yml` (ref = rama `claude/costing-app-architecture-psf02g`, SHA `0722205`). El frontend de Vercel NO se tocó.

| Slot PROD | Antes (rollback) | Después | Run |
|---|---|---|---|
| costear-servidor | v17 `28a09647c47e` | **v18** `107bd1fa1ec5` | #59 success |
| analizar-mueble | v38 `a682b1c0fcd2` | **v39** `6fc1ffcca9a4` | #59 success |
| cotizar-texto | v18 `344a93487590` | **v19** (promovida) | #60 success |
| acomodar-espacio-recovery | v19 `65740137f0fb` | **v20** (promovida) | #60 success |
| leer-plano-core | v8 `64715a20c7e2` | **v9** (promovida) | #60 success |
| generar-render | (ya en v32, flash+pro) | v32 `73fd1119` | #58 previo |

**Compatibilidad verificada:** `fece6c3` (frontend PROD actual) es ancestro de la rama, y el diff del contrato de costeo cliente↔edge (`src/nube.js`, `validarIntentCosteo.js`, `costeoServidor.js`, DTO test) entre PROD y la rama es **vacío** → el frontend viejo habla el mismo contrato que los edges nuevos. Los cambios del motor son internos (cálculo), no de wire. DB sin cambios (catálogo/config ya al día).

**Rollback** (si algo falla): re-desplegar cada slot desde el commit viejo. P.ej. `deploy-edge.yml` con ref=`fece6c3` y `funciones="costear-servidor analizar-mueble cotizar-texto acomodar-espacio-recovery leer-plano-core"` restaura el código previo. Reversible en minutos; el frontend no cambió.

**Pendiente de smoke humano:** un costeo real en la app de producción con cuenta humana (no lo puedo hacer desde la sesión; sin login). Hasta ese smoke, la promoción está *desplegada y verificada por contrato/código*, no *certificada en vivo por UI*.

**Deuda a cerrar (no bloqueante para costear):** los slots PROD corren código de la RAMA, no del default `c3.4-seller-safe`. Para quitar el drift, mergear la rama a default cuando se autorice el go-live (B7) y redeplegar desde ahí.
