# NIGHT_SHIFT_STATE · Von Haucke · turno nocturno 2026-10-13

Orden: `CLAUDE_ORDEN_MAESTRA_NOCTURNA_VON_HAUCKE_2026-10-12.md` (Dirección). **Sin merge, sin deploy (Vercel/edges),
sin migraciones aplicadas, sin RLS/permisos, sin altas/bajas comerciales, sin tocar precios/márgenes/fórmulas oficiales.**
Checkpoints por commit pequeño; este archivo se actualiza al cerrar cada bloque.

## 0. Estado real al inicio (2026-10-13 05:18 UTC)

| qué | valor |
|---|---|
| rama de trabajo | `claude/costing-app-architecture-psf02g` · HEAD `56cc700` = origin (árbol limpio, sin stash, sin untracked) |
| producción (rama) | `c3.4-seller-safe` @ `c8dd2b3` (PR #36) · 18 commits por detrás de la rama de trabajo |
| Vercel producción | `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3` = `c8dd2b3` READY · rollback: `dpl_9ehp8cSU7bvH3hptvETpU1tHPPHv` (ccf76f8), `dpl_3R2vP55WCYyB58U1eB9pAbdcq34v` (273cf3a) |
| edges producción | analizar-mueble v35 · cotizar-texto v13 · leer-plano v12 · leer-plano-core v5 · generar-render v31 · costear-servidor v9 · cotizar-servidor v8 · acomodar-espacio-recovery v10 · voni-council v12 |
| edges RC (sólo medición, el cliente no las usa sin `VITE_*_FN`) | analizar-mueble-rc v1 · cotizar-texto-rc v1 · generar-render-rc v3 · leer-plano-core-rc v4 · leer-plano-rc v3 · costear-compras-rc v3 |
| CI | `ci.yml` corre por `pull_request` en ramas de trabajo: la rama **no tiene PR** → sin CI desde `d3fa1ce` (verde). Acción: abrir PR **borrador** (autorizado) para que CI corra; nunca mergear |
| PRs abiertos ajenos | #24, #23, #22, #21, #20, #18 (ramas chatgpt/recovery/hotfix; no se tocan) |
| otras ramas Claude | `claude/ux-pasos-cotizar-psf02g` (UX por pasos, autorización aparte), `claude/perfection-final-20261006` |
| procesos | dev server local :5173 con `VITE_GENERAR_RENDER_FN=generar-render-rc` (para medir RC); lab `e2e/labRender.e2e.js` RC v2 en curso |

## 1. Trabajo existente que se conserva (no se cancela ni se duplica)

- **Q5 · cinco prompts** (`docs/auditoria/Q5_RC_CINCO_PUNTOS.md`): 1 analizar-mueble PASS · 2 cotizar-texto PASS ·
  3 renders RC v1 3/5 (prod 1/5), RC v2 (contador vacío → auditor) **midiéndose** · 4 reglas de casa PASS · 5 G12 PASS.
  RC v2 renders **4/5** (prod 1/5). Playwright local 50 ✓ / 8 omitidos (labs con llave) / 1 ✗ `golden757Edicion` por login lento bajo carga (59 specs + lab concurrente); **solo pasa en 14 s**. GO/NO-GO en el informe.
- **L1 lectura** (`docs/auditoria/LECTURA_PLANOS_L1.md`): RC columnas 14/14, dos niveles, barra gráfica; promoción pendiente de autorización.
- **P1 programa / lab Torre Norte** (`docs/auditoria/LAB_TORRE_NORTE.md` § 8): 39/39 PASS, VH-142 (tope 120 s).
- **Autopilot no aditivo** (VH-135), VH-136/138/139 (en producción c8dd2b3).
- Pruebas: `vitest` 277/2 293 verde (05:07 UTC) · `vite build` OK · Playwright local pendiente de correr sin override RC.

## 2. Bloques nocturnos

| bloque | estado | evidencia |
|---|---|---|
| Fase 0 preservar | **HECHO** (este archivo) | — |
| P0-A VH-035 integridad económica | **HECHO (RC)**: 24 casos PGlite con SQL real (23 ✓ + 1 rojo a propósito: la migración pendiente RECICLA costo viejo al cambiar de producto); PROPUESTA vh035b sin reciclar 7/7; mock = producción → `persistencia.e2e.js` rojo por la causa real; migración NO aplicada | `supabase/migrations/20261010170000_actualizar_cotizacion_preserva_economia.sql`, `supabase/tests/preservaEconomia.test.js` (PGlite; fixture `private_api_baseline_20261010.sql` — hay que compararla con los cuerpos de producción de HOY) |
| P0-B ERP → motor | **HECHO (RC)**: traza completa, paridad 15/15 a centavos, política con conteos, 2 PROPUESTAS sin aplicar; 4 defectos de cliente corregidos (VH-143/144/145/146) | `docs/auditoria/ERP_PRECIOS_ELEGIBILIDAD.md`, `lab/erp/`, `supabase/migrations/PROPUESTA_vh146_*`, `PROPUESTA_vh147_*` |
| P0-C COSTEAR real | **PARTIAL**: ciclo mecánico cerrado ×3 (exp. 16/17/18), VH-149/150 + mensaje corregidos; costo no certificado: chapa emitida como hoja entera (no cabe en formato), cantidades de la IA varían (VH-151), paridad servidor sólo sobre BOM incompleto | `lab/noche/costear/`, `e2e/labCostear.e2e.js` |
| P0-D COTIZAR real | **HECHO**: Torre Norte reg. 1336 (39/39 PASS, PDF $405,915.44, reabierto) y C1 desde cero reg. 1372 (7/7 áreas, puerta confirmada, 7 partidas, acomodo 25 NEEDS_REVIEW, PDF borrador $266,315.24, reabierto 0 errores). Renders aparte: prod 1/5 y 0/4; RC v2 4/5 | `scratchpad` → `docs/auditoria/NOCHE_2026-10-13_INFORME.md` |
| P1 concurrencia / tests falsos | **HECHO (parcial por diseño)**: VH-148 reproducido en UI (último escribe gana) + PROPUESTA; Cocrear/render E2E fallan cuando deben; retención QA medida, nada borrado | `lab/noche/concurrencia/resumen.json` |

## 3. Bloqueados que necesitan a Dirección

- Promoción de edges RC a producción (L1 lector, Q5 cuatro funciones): requiere autorización.
- Despliegue del cliente de la rama (18 commits) a `c3.4-seller-safe`: requiere autorización.
- Aplicar migración VH-035: requiere autorización (se entrega revisada + rollback).
- Escrituras en BD con la cuenta QA: la orden prohíbe "altas/bajas de cotizaciones" y pide a la vez "guardar en BD → reabrir".
  Interpretación aplicada: **sólo registros de laboratorio con la cuenta QA, nombrados "(lab …)", sin emitir**, como en los
  laboratorios previos que Dirección ya conoce (1295–1336). Si Dirección no lo acepta, esas corridas se descartan y quedan BLOCKED.

## 4. Archivos tocados esta noche

| commit | qué |
|---|---|
| `c2d99e1` | NIGHT_SHIFT_STATE inicial |
| `9e697a7` | Q5 § 3 RC v2 renders |
| `0849600` VH-143 | `senales.js` (+`fuenteDeInsumo`), `Costeador.jsx` ConfianzaCosteo, test |
| `702ebb7` VH-144 | `Costeador.jsx` pistas como arreglo |
| `95c0207` VH-145 | `datos/aplicarCompartido.js` (+test), `App.jsx` import |
| `c24a771` VH-146 | `erpCarga.js` patrón 4' X 8' y 5×8, test |
| `8871b54` | `supabase/tests/fixtures/private_api_prod_20261013.sql` |
| `0e76cb6` | `docs/auditoria/ERP_PRECIOS_ELEGIBILIDAD.md`, `lab/erp/verificar_rpc.mjs`, 2 PROPUESTAS |

| `0e76cb6`… | P0-B informe, lab/erp, PROPUESTAS vh146/vh147 |
| `44c5b87` | P1 Cocrear/render E2E honestos |
| `1ac732b` | PROPUESTA vh148 control optimista |
| `2d20985` | mensaje contradictorio en Costear |
| `b09e443` VH-149 | `amarreERP.js` fusionarAmarreEnBom + test |
| `6b2d3ac`, `61e71ef` | VH-035 24 casos PGlite, PROPUESTA vh035b, doc SQL vs mock; nubeFalsa = producción |
| `8f6b36f` VH-150 | `datos/conservarConfirmados.js` + test; AsistenteEspecial |
| `669c901` | STALE como it.fails |
| labs | `e2e/labCostear.e2e.js`, `e2e/labConcurrencia.e2e.js`, `e2e/labRender.e2e.js`; evidencia en `lab/noche/` |

PR borrador: https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/pull/37 (sólo para CI; no mergear). Informe final: `docs/auditoria/NOCHE_2026-10-13_INFORME.md`.

---

# SEGUNDA VUELTA · decisiones de Dirección (2026-10-13, tras revisar `d2bbb9c`)

Veredicto de Dirección: NO-GO a producción; continuar en RC sin perder nada. Prohibido: merge, deploy, migraciones en
producción, modificar precios, eliminar funcionalidades, limpiar pruebas para aparentar éxito.

| decisión | qué pide | dónde se trabaja | estado |
|---|---|---|---|
| 1 ERP | validez histórica ≠ actualidad (24 m salvo validación comercial documentada más reciente); precio antiguo usable en PRELIMINAR con fecha visible y advertencia; nunca certificado como reposición sin evidencia; `vh147` como implementación real probada en base aislada | SQL PROPUESTA + PGlite + cliente (fecha/advertencia) | en curso |
| 2 VH-035b | NO aplicar aún; corregir economía anidada, STALE por producto/versión/BOM/material, costos por lote al cambiar cantidad, repin sin validación del servidor, preservar aprobaciones/estados; histórico para auditoría; antes/después PGlite + roles + E2E real; sin relajar tests | PROPUESTA vh035c + tests | en curso (agente) |
| 3 formatos ERP | completar `vh146` en aislado; auditar formatos, `fraccion`/`mermaCorte=6` vs fórmula industrial; consumos y costos antes/después 4×8 y 5×8; sin merma sin respaldo | PGlite + tests del motor | en curso (agente) |
| 4 VH-148 | control optimista completo en RC: RPC, cliente (conflicto detectado, trabajo local conservado, recuperación explícita), pruebas, reversión; sin desplegar | PROPUESTA vh148 completa + cliente tras bandera | en curso (agente) |
| 5 COSTEAR | prioridad funcional: corrida 8 no cerrada; investigar por qué VONI usa curados habiendo ERP exacto; VH-151 (hoja ≠ pieza, chapa por caras reales, cantidades estables con evidencia, ambigüedad se pregunta, selecciones manuales sobreviven, paridad al centavo sobre el MISMO BOM); ciclo desde cero con transferencia a Cotizar; Pendiente ≠ PASS | cliente + analizar-mueble-rc + labs | en curso (yo) |
| 6 COTIZAR/renders | topología App LT 12u y sillas con 200 mm; no VALIDADO con conflictos; renders: generada / validada / persistida / reabierta / en PDF, por separado | catálogo topología + lab render por etapas | pendiente |
| control final | revisión de integración del PR #37 (126 archivos, 43 commits) en bloques verificables: SQL, cliente, pruebas, prompts, docs; CI verify PASS / E2E FAIL por VH-035 se mantiene visible | doc de integración | pendiente |

## Estado al cierre de la segunda vuelta (código en `b4b6ca2`; informe `docs/auditoria/NOCHE_2026-10-13_INFORME_V2.md`)

| decisión | estado | evidencia |
|---|---|---|
| 1 ERP | PROPUESTA vh147 en SQL real, 17 pruebas PGlite; no aplicada | `supabase/tests/erpPolitica.test.js`, `docs/auditoria/ERP_POLITICA_PRUEBAS.md` |
| 2 VH-035b → vh035c | PROPUESTA integral, 32 pruebas PGlite; no aplicada; riesgo de orden con vh148 | `supabase/tests/preservaEconomiaIntegral.test.js`, `docs/auditoria/VH035C_INTEGRAL.md` |
| 3 formatos | PROPUESTA vh146, 28 + 8 pruebas; hallazgos de motor (merma inerte, 5×8 sobrecostea) | `supabase/tests/formatoHojasErp.test.js`, `src/motor/formatoHojaErp.test.js` |
| 4 VH-148 | cliente tras bandera + PROPUESTA; 13 + 25 + 4 pruebas; no desplegado | `docs/auditoria/VH148_CONTROL_OPTIMISTA.md` |
| 5 COSTEAR | paridad al centavo con diferencias aceptadas (corrida 12); bloqueo honesto en 2 decisiones de diseño (corrida 14) | `lab/noche/costear/corrida11…14` |
| 6 COTIZAR/renders | acomodo C1 VALIDADO; propuesta bloqueada por P0-01; renders 5 etapas 4/4 | `lab/noche/cotizar_c1/corrida3`, `lab/noche/render_v2` |
| control final | revisión de integración + CI `verify` reparado; overrides de Edge sólo en desarrollo | `docs/auditoria/INTEGRACION_PR37.md` |

## Estado V3 · criterio 9.5 verificable (matriz `docs/auditoria/MATRIZ_V3.md`)

| frente | estado | evidencia |
|---|---|---|
| VH-035c + VH-148 | composición en cualquier orden probada en PGlite (21); E2E con simulador 3/3 + 7/7; dos sesiones reales BLOCKED (SQL no aplicado) | `supabase/tests/composicionVh035cVh148.test.js` |
| Costear (3 familias) | hoja de control PASS en credenza 12/12, mesa de centro 3/3, mesa de trabajo 6/6; paridad al centavo; guardar/reabrir idéntico; ninguna llega a costo firme (precios sin certificar / decisiones de diseño) | `lab/noche/costear_v4/` |
| defectos nuevos | VH-164, VH-164b, VH-165, VH-163b, VH-166 corregidos con prueba | `BUG_LEDGER.md` (entrada V3) |
| Cotizar | C1 VALIDADO; C5 FAIL (fuera de cuarto); C2 parcial; identidad idéntica al reabrir en los tres; propuesta BORRADOR por P0-01 | `lab/noche/cotizar_v3/` |
| Renders | v6: 3 de 4 áreas por las 5 etapas; contador sin anclaje = conteo manual; 1 rechazo honesto (10 de 12) | `lab/noche/render_v6/` |
| Edge RC desplegadas hoy | `costear-servidor-rc` (corrida 17), `generar-render-rc` VH-161b (corrida 18) | Actions "Deploy edge functions" |

## Estado OPERACIÓN 10/10 (matriz `docs/auditoria/MATRIZ_10.md`)
- 24 proyectos E2E contra la nube real (QA): 9 PASS REPRODUCIDO, 5 RIESGO, 8 FAIL CONFIRMADO, 2 BLOCKED. Evidencia en `lab/noche/p10x/`, `lab/noche/p10/` y `lab/noche/cocrear10/`.
- NO-GO para promover la rama. GO técnico para el hotfix de VH-173 (P0 en producción), pendiente de autorización.
- Nada aplicado en producción: ni SQL, ni cliente, ni Edge productiva. Edge `-rc` redesplegadas (corrida 20).
