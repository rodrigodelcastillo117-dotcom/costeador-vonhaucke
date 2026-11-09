# COSTEAR — Estado actual

> Reporte vivo para auditoría. Se actualiza al cerrar cada bloque de trabajo.
> **No se hace merge ni deploy sin autorización de Dirección.**

- **Fecha:** 2026-11-09
- **Rama de desarrollo:** `claude/pm-concurrencia`
- **SHA del estado descrito:** `cefd2ed32a14645f1bb6c167c860bb634cb2823a` (este archivo se commitea encima)
- **Prod (`c3.4-seller-safe`):** `4f79c72193baceec0cf3f38dbcc4699f2ffe9eac`
- **PR draft (no fusionado):** https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/pull/90
- ⚠️ Nota de ramas: la rama designada original era `claude/costing-app-architecture-psf02g`, pero quedó obsoleta tras un reinicio; todo el trabajo real y el PR viven en `claude/pm-concurrencia`.

## Último bloque — correcciones de auditoría (P1/P2/P3)

Auditoría de Dirección sobre SHA `f8bd9bc` → 6 defectos del cálculo físico corregidos **RED→GREEN**.

- **P1 integridad del material** (`costoPiezaFabricada.js`, 10 pruebas adversariales):
  1. Fuente **autoritativa**: lámina del `catalogo_vigente` con precio exacto + `precio_id` + unidad + evidencia + `certificable` (fixture `src/datos/fixtures/catalogo_lamina_vigente.json`). Ya **no** usa el seed.
  2. Calibre propuesto ya no se confirma solo → estado `PRELIMINAR`; soporta `calibreConfirmado`.
  3. Desarrollo `VERIFICADO` (L×W) vs `INFERIDO_L2D` separados.
  4. Pieza que no cabe → `BLOQUEADO` + busca formato compatible; nunca una hoja en silencio.
  5. Cantidad inválida/faltante → `BLOQUEADO` (se eliminó `Number(x)||1`).
  6. Nesteo/kerf/formato/merma vía el motor; selección por menor costo por pieza; sin doble conteo.
- **P2 total seguro** (`costoPropuestoProcesos.js`): material incluido vs pendiente, fabricado verificable vs preliminar, MO política_vh vs routing-sin-estándares, GIF, terceros, **total PARCIAL vs OFICIAL**; `emitible_comercial=false` mientras sea parcial.
- **P3 confirmaciones que recalculan** (`pantallaIngenieria.js`): `recostearExpediente()` conecta confirmaciones (calibre/desarrollo/precio/estándares) y **recalcula con el motor existente**, conserva evidencia y versiona. El expediente lleva `inputs`.

---

## EN PRODUCCIÓN (desplegado y verificado)

| Qué | Estado | Evidencia |
|---|---|---|
| P0 integridad guardado Producto Maestro (cliente + servidor, gate Dirección) | ✅ en prod | RPC `guardar_producto_maestro` 14-arg; cliente Vercel READY `4f79c72` |
| P1 concurrencia (lost update) — advisory lock + FOR UPDATE + UPDATE condicional | ✅ en prod (autorizado 2026-11-09) | `supabase/migrations/DESPLIEGUE_P0_PRODUCTO_MAESTRO.md`; evidencia 2 conexiones: `supabase/tests/postgres_real/` |

**Smoke de app del P0 (humano): PENDIENTE** — Dirección debe hacer borrador→verificado→reabrir→sustituir + 2 guardados concurrentes desde su sesión (la RPC exige JWT de Dirección; no se puede suplantar).

## SÓLO EN LA RAMA (NO en prod, NO desplegado)

Todo el **costeo industrial** y la pantalla son código nuevo en `claude/pm-concurrencia`, sin merge:

| Módulo | Qué hace | Tests |
|---|---|---|
| `src/datos/costoPiezaFabricada.js` | Pieza fabricada desde MP: desarrollo plano → lámina comercial ERP → aprovechamiento/merma (reusa el motor) | 7 ✅ |
| `src/datos/costoOperacion.js` | MO = preparación/lote + tiempo×tarifa + adicionales; registro de estándares vacío + contrato de importación | 5 ✅ |
| `src/datos/costoPropuestoProcesos.js` | Orquestador (reescrito): MP física + MO/GIF POLÍTICA_VH + routing pendiente + preguntas por decisión | 3 ✅ |
| `src/datos/pantallaIngenieria.js` | View-model 5 secciones + mejoras + aplicarConfirmacion | 3 ✅ |
| Pantalla (artefacto) | https://claude.ai/artifact/SVfD179sNmHzyJt62vDTjf | — |

## Qué implementé (este bloque)

- Corrección de enfoque: una pieza fabricada se costea desde su materia prima + operaciones, **no como SKU** (reusa `src/motor/calculo.js`, sin segundo sistema).
- Costeo de piezas fabricadas (desarrollo plano, lámina real, nesteo/merma, anti doble-conteo).
- Modelo de MO con tiempo+tarifa y contrato para importar estándares autorizados.
- Pantalla de Ingeniería (5 secciones) sobre el expediente.
- Holdout de materiales en 5 planos + holdout industrial.

## Problemas corregidos

- **Auditoría (este bloque):** 6 defectos del cálculo físico de material (ver P1 arriba): seed→catálogo autoritativo; calibre propuesto≠confirmado; desarrollo verificado vs inferido; no-cabe ya no asigna hoja en silencio; `Number(x)||1` eliminado; selección de formato por menor costo/pieza.
- Condición de carrera (lost update) en la RPC → advisory lock + UPDATE condicional (en prod).
- Falso positivo de routing: "cantos pulidos" del cristal disparaba canteado de carpintería (`ba828df`).

## Pruebas reales ejecutadas

- **Suite completa: 4331 tests verde** (exit 0) en SHA `cefd2ed`.
- **10 pruebas adversariales** (una por defecto de la auditoría) en `costoPiezaFabricada.test.js`.
- **Postgres real, 2 conexiones concurrentes:** versión previa reproduce LOST UPDATE; parche lo cierra. → `supabase/tests/postgres_real/`
- **E2E TELSVH120** (plano nuevo fuera de muestra, leído en vivo): `tools/e2e_plano_nuevo.mjs`.

## Resultados — TELSVH120 (con lámina autoritativa, total seguro)

| Concepto | Valor |
|---|---|
| Material **incluido** (físico real) | $4,987.96 (fabricado $294.06 + comprado $4,693.90) — lámina `erp-ln22310` `precio_id 8748` |
| ↳ fabricado verificable / preliminar | $0.13 / $293.93 |
| MO (POLÍTICA_VH autorizada) | $105.75 |
| GIF (POLÍTICA_VH) | $411.13 |
| MO por tiempos (routing) | PENDIENTE (sin estándares) |
| **Total PARCIAL** | **$5,504.84** |
| **Total OFICIAL** | — (no procede) · `emitible_comercial=false` |
| Material pendiente (NO en el total) | CUE, BX2, SOC, SOM (CAD) + KIT, COEME20ND (precio) |

Evidencia: `expedientes/EXPEDIENTE_TELSVH120.json`, `expedientes/VISTA_INGENIERIA_TELSVH120.json`; pantalla https://claude.ai/artifact/SVfD179sNmHzyJt62vDTjf

## Bloqueos pendientes (datos de Ingeniería, no código)

1. **4 piezas 3D** (CUE cuerpo, BX2 exhibidor, SOC base, SOM sombra) → desarrollo plano de CAD. Su lámina aún NO está en el total.
2. **2 compradas sin precio** (kit LED `TELSVH120-KIT`, corredera `COEME20ND`) → alta/precio ERP.
3. **MO por tiempos reales** → tiempos estándar (min/pieza) + tarifa ($/min) por centro, autorizados. Contrato listo: `cargarEstandar()`.
4. **Terceros** (cristal templado, termoformado) → costo externo a confirmar.

## Errores todavía abiertos

- **Ninguno en tests** (4331 verde, exit 0).
- Pendientes que NO son errores: **P4 — E2E completo dentro de la app** (usuario autorizado, navegador real, RLS) NO hecho; smoke de app del P0 (humano); 1/12 E2E completos; cobertura del holdout limitada por parseo de capa de texto (no por el motor).

## Próximos pasos

- **P4 (siguiente):** integrar el flujo dentro de COSTEAR (no sólo view-model/artefacto): PLANO→ENTENDÍ→DESPIECE→MATERIALES→ROUTING→CONFIRMACIONES→RECÁLCULO→GUARDAR→REABRIR, probado con usuario autorizado, navegador real y RLS, en 5 planos. Distinguir simulación / corpus congelado / navegador real / multimodal en vivo.
- (a) Cuerpo CUE: su desarrollo plano **no está en el plano de taller** (caja 3D); no se inventa. El recálculo (P3) lo incorpora en cuanto Ingeniería dé el despliegue de CAD.
- (b) MO por tiempos: el contrato recibe estándares **autorizados** (demostrado). No se cargan tiempos de referencia inventados como estándares (regla de integridad).

**Score honesto actual: ~63/100** (sube de 59 por integridad del material, total seguro y recálculo). El techo restante es dato de Ingeniería + integración de app (P4), no cálculo.
