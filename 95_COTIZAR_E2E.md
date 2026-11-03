# 95_COTIZAR_E2E — ciclo de cotización EN VIVO (Ronda 3, 2026-11-03)

Cuentas reales: Dirección (`qa-direccion`) y vendedor (`ventasprueba`). Prueba por REST/RPC contra producción.
Toda la data QA se crea con `cliente="QA E2E Ronda3"` y se BORRA al terminar (prod queda limpio).

## Núcleo del ciclo — PASS (crear → reabrir → gate → limpiar)
| Paso | RPC | Resultado |
|---|---|---|
| 1 Crear | `crear_cotizacion_segura(p_payload)` | **id 4860, ok:true, total 18560** ✓ |
| 2 Reabrir | `cotizacion_segura(p_id)` | **cliente/total correctos** ✓ (persistencia fiel) |
| 3 Gate de emisión | `evaluar_emision_cotizacion(id, snapshot)` | **state=ALLOWED** (partida completa, precio 8000, margen 37.5% > mínimo) ✓ |
| 4 Limpieza | `DELETE cotizaciones` | **204** ✓ |

## Hallazgos de integridad descubiertos en el camino (positivos)
1. **INSERT crudo bloqueado incluso para Dirección:** `POST /rest/v1/cotizaciones` → **42501 permission denied**.
   Las cotizaciones SOLO se crean por `crear_cotizacion_segura` (valida, fija dueño, protege estado/folio,
   es idempotente por `_idempotency_key`). No se pueden inyectar filas.
2. **Dueño lo fija el servidor:** aunque el payload mande `usuario`, el RPC lo fija al autenticado. No se puede
   crear una cotización "a nombre de otro" desde el cliente.
3. **Validación de acomodo:** `acomodo:null` se rechaza ("acomodo invalido"); exige una estructura (aunque sea `{}`).

## Seller-safe sobre cotización (ligado a 95_SEGURIDAD_EMISION_QA.md)
- Lectura cruda de `cotizaciones` por el vendedor → **403** (no puede leer la tabla directo).
- Ruta sancionada `cotizaciones_mias` → aplica `partidas_vendedor` (quita costoUnitario/margen/costoDerivado/precioReal).
- Un vendedor cotizando por `costear-servidor` recibe **precioVenta**, nunca costo/margen.

## Alcance honesto / lo que falta para un COTIZAR "95 pleno"
- **Probado en vivo esta ronda:** creación controlada, persistencia, reapertura, gate de emisión (ALLOWED),
  borrado; integridad de creación (no raw-insert, dueño fijo); seller-safe sobre cotización.
- **No reejecutado por API esta ronda (y/o es de navegador):** modificar partida + control optimista 409 en
  vivo (ya cubierto por `cotizaciones.controlOptimista.test.js` y la prueba real de dos conexiones V2/V3),
  crear revisión + solicitar aprobación, y **emitir PDF** (es cliente/navegador). Un ciclo completo 1→50
  partidas con PDF requiere el flujo de navegador (Playwright) — queda como siguiente paso.
- Ciclos COTIZAR completos (create→save→reopen→PDF) ya fueron certificados en rondas previas (NOCHE P0-D,
  V2 D5, V3). Esta ronda refresca el núcleo server-side en producción con cuentas reales.
