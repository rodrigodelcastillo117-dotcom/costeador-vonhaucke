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
| P0-A VH-035 integridad económica | en curso (agente: casos adversariales en PGlite, SQL vs mock) | `supabase/migrations/20261010170000_actualizar_cotizacion_preserva_economia.sql`, `supabase/tests/preservaEconomia.test.js` (PGlite; fixture `private_api_baseline_20261010.sql` — hay que compararla con los cuerpos de producción de HOY) |
| P0-B ERP → motor | **HECHO (RC)**: traza completa, paridad 15/15 a centavos, política con conteos, 2 PROPUESTAS sin aplicar; 4 defectos de cliente corregidos (VH-143/144/145/146) | `docs/auditoria/ERP_PRECIOS_ELEGIBILIDAD.md`, `lab/erp/`, `supabase/migrations/PROPUESTA_vh146_*`, `PROPUESTA_vh147_*` |
| P0-C COSTEAR real | pendiente | — |
| P0-D COTIZAR real | pendiente | Torre Norte = escenario; segundo proyecto desde cero |
| P1 concurrencia / tests falsos | pendiente | — |

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

PR borrador: https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/pull/37 (sólo para CI; no mergear).
