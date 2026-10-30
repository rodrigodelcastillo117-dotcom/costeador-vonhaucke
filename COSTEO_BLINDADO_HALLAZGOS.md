# COSTEO BLINDADO — ledger de hallazgos (auditoría correctiva del costeador)

**Inicio:** 2026-10-30 · Rama `claude/costing-app-architecture-psf02g`. Evidencia primero; corrección localizada; RED→FIX→GREEN. Sin deploy/merge/migración/precio/permiso productivo sin autorización de Dirección.

## Clasificación
BUG CONFIRMADO · RIESGO REPRODUCIDO · RIESGO NO CONFIRMADO · DECISIÓN HUMANA PENDIENTE · NO VERIFICABLE.

---

## FASE 0 — inventario (hecho esta sesión)
- Prod corre el motor avanzado (promovido hoy): `costear-servidor` v18, `analizar-mueble` v39, `cotizar-texto` v19, `acomodar-espacio-recovery` v20, `leer-plano-core` v9, `generar-render` v32. Frontend prod (`fece6c3`) = rama salvo `AcomodoBase.jsx`; contrato de costeo cliente↔edge idéntico (diff vacío).
- Motor: `src/motor/calculo.js` (`calcular`), `src/datos/costeoServidor.js` (`costearConMotor`/`atenderCosteo`), `politicaVH.js`, `formulaAlba.js`, `appltCosto.js`. Dos modelos: clasico (GIF=34% MP-directa o Alba 3×MO) e intelisis (App LT, `parModelo`).
- Compuerta de emisión leída completa: `private_api.evaluar_emision_cotizacion(bigint,jsonb)` — recalcula server-side, NO confía en costo del cliente para partidas con product_version (lee `producto_version_economia`); para partidas sin product_version confía en `costoUnitario`+`costoEstado` del snapshot, que el servidor fija con el gate fuerte.

---

## HALLAZGOS

### BLN-01 — `costoOficial`/`estadoCosto` del motor NO honran todos los bloqueos → **BUG CONFIRMADO (P2) · CORREGIDO**
- **Área:** 1 (aritmética/completitud) + 3 (verdad económica).
- **Evidencia:** `src/motor/calculo.js` (antes) `estadoCosto = componentesIgnorados.length ? 'incompleto':'completo'`; `costoOficial = componentesIgnorados.length ? null : costoUnitario`. Sólo miraban `componentesIgnorados`, no `tarifasFaltantes`/`materialesPorConfirmar`/formato `noCabe`/costo no finito — que sí bloquean en `costeoEmitible` (línea 927).
- **Reproducción:** pieza intelisis con `GIF:carpinteria` faltante → `tarifasFaltantes=['MO:carpinteria','GIF:carpinteria']`, `costeoEmitible=false`, pero `estadoCosto='completo'` y `costoOficial=251.48`. Un consumidor del cliente (p.ej. `src/componentes/Tablero.jsx:59`, que gráfica usando `estadoCosto`) trataría un costo NO emitible como oficial.
- **Resultado anterior:** `estadoCosto='completo'`, `costoOficial=251.48` (no emitible).
- **Resultado corregido:** `estadoCosto='incompleto'`, `costoOficial=null` (alineado con `costeoEmitible`).
- **Fix:** `calcular()` computa `_emitible = costeoEmitible({...}).emitible` y lo usa para `estadoCosto`/`costoOficial`. Localizado, sin tocar fórmulas ni el gate del servidor.
- **Prueba añadida:** `src/motor/failClosed.test.js` → "tarifa faltante ⇒ estadoCosto incompleto y costoOficial null". RED verificado (falló antes), GREEN después.
- **Regresión:** 355/355 verdes (motor + costeoServidor + alba + applt + lineas + estadoCosto + borradorCosteo). El servidor ya usaba el gate fuerte, así que la emisión nunca dependió de este hueco; esto cierra la ruta de los consumidores del cliente.

### BLN-02 — Tarifas MO/GIF en centros activos → **fail-closed CONFIRMADO (no bug)**
- Horas>0 con tarifa 0/ausente en un centro activo (intelisis) ⇒ `tarifasFaltantes` ⇒ no emitible. Reproducido con MO y GIF faltantes; centros inactivos con tarifa 0 no bloquean (correcto). `costoHoraGIF` en ceros del config es inerte (clasico no lo lee; intelisis trae `parModelo`). Ver `95_AUDIT_MO_GIF.md`.

### BLN-03 (MG-1) — App LT cobra metal a tarifa `otros` ($296/h) y no `pm` ($374/h) → **DECISIÓN HUMANA PENDIENTE (P2)**
- ~$995 menos por banca 6U en MO+GIF del metal. No es $0 ni inventado; es tarifa más barata. Qué tarifa lleva el metal lo decide Dirección/Alba (blocker B8). No se corrige sin esa decisión. Ver `95_AUDIT_MO_GIF.md` / `95_BLOCKERS.md`.

### BLN-04 — Matriz adversarial de cantidades/fracciones → **fail-closed CONFIRMADO (no bug de pérdida)**
- cantidad 0/null/omitida/negativa/"abc"/NaN/Infinity y hojas 0/-0.25 ⇒ todos PENDIENTE, `costoOficial=null`, no emitible. Nunca $0 silencioso, nunca NaN/Infinity emitible.
- Observaciones de dirección SEGURA (sobre-costo, no pérdida): `cantidad:1e9` cuesta finito grande (orden real, no bug); `cantidad:0`+geometría cuesta 1 panel (sobre-costo de input raro) → **RIESGO NO CONFIRMADO / P3**, no se corrige (es dirección segura y desestabilizaría el camino geométrico).

---

## LÍMITE HONESTO DE ESTA SESIÓN
- **Ataques de emisión EN VIVO (Fase 4) y seller-safe/RLS por REST (Fase 5):** requieren un JWT de cuenta de prueba que **no tengo en esta sesión**. Hice revisión ESTÁTICA del gate (`evaluar_emision_cotizacion` completo: recomputa server-side, identidad por línea, campos que no corresponden, especial/reventa, margen mínimo, aprobación por hash) y la separación seller-safe en `costeoServidor.js`. La reproducción VIVA de los 20 ataques y de IDOR por REST queda **NO VERIFICABLE desde aquí** hasta tener credenciales de QA o que Dirección las corra. La prueba viva de seller-safe por JWT simulado (SQL, ROLLBACK) sí se hizo antes (ver `95_SCORECARD.md`).
