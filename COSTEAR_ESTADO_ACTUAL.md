# COSTEAR — Estado actual

> Reporte vivo para auditoría. Se actualiza al cerrar cada bloque de trabajo.
> **No se hace merge ni deploy sin autorización de Dirección.**

- **Fecha:** 2026-11-09
- **Rama de desarrollo:** `claude/pm-concurrencia`
- **SHA del estado descrito:** `489ec531f6c8df9203559f5ba6f706b1dfef8cdf` (este archivo se commitea encima)
- **Prod (`c3.4-seller-safe`):** `4f79c72193baceec0cf3f38dbcc4699f2ffe9eac`
- **PR draft (no fusionado):** https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/pull/90
- ⚠️ Nota de ramas: la rama designada original era `claude/costing-app-architecture-psf02g`, pero quedó obsoleta tras un reinicio; todo el trabajo real y el PR viven en `claude/pm-concurrencia`.

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

- Condición de carrera (lost update) en la RPC → advisory lock + UPDATE condicional (en prod).
- Falso positivo de routing: "cantos pulidos" del cristal disparaba canteado de carpintería → corregido (`ba828df`).
- Selección de calibre no-exacto elegía el más grueso → ahora el más cercano (cal24→cal22).
- `areaHoja` NaN para láminas 4×8 sin `largoMM` → fallback al formato por defecto.

## Pruebas reales ejecutadas

- **Suite completa: 4325 tests verde** (exit 0).
- **Postgres real, 2 conexiones concurrentes:** versión previa reproduce LOST UPDATE; parche lo cierra (VERSION_CONFLICT). → `supabase/tests/postgres_real/`
- **E2E TELSVH120** (plano nuevo fuera de muestra, leído en vivo): `tools/e2e_plano_nuevo.mjs` → `expedientes/EXPEDIENTE_TELSVH120.json`

## Resultados — TELSVH120 (costo defendible hoy)

| Concepto | Valor |
|---|---|
| Material total (físico real) | $5,072.86 (lámina fabricada $378.96 + comprado $4,693.90) |
| MO (POLÍTICA_VH autorizada) | $122.73 |
| GIF (POLÍTICA_VH) | $462.07 |
| **Costo fabricación VH (parcial)** | **$5,657.65** |

Evidencia: `expedientes/EXPEDIENTE_TELSVH120.json`, `expedientes/VISTA_INGENIERIA_TELSVH120.json`, `expedientes/HOLDOUT_PLANOS.md`, `expedientes/HOLDOUT_INDUSTRIAL.md`.

## Bloqueos pendientes (datos de Ingeniería, no código)

1. **4 piezas 3D** (CUE cuerpo, BX2 exhibidor, SOC base, SOM sombra) → desarrollo plano de CAD. Su lámina aún NO está en el total.
2. **2 compradas sin precio** (kit LED `TELSVH120-KIT`, corredera `COEME20ND`) → alta/precio ERP.
3. **MO por tiempos reales** → tiempos estándar (min/pieza) + tarifa ($/min) por centro, autorizados. Contrato listo: `cargarEstandar()`.
4. **Terceros** (cristal templado, termoformado) → costo externo a confirmar.

## Errores todavía abiertos

- **Ninguno en tests** (4325 verde).
- Pendientes que NO son errores: smoke de app del P0 (humano); cobertura del holdout limitada por parseo de capa de texto (no por el motor); 1/12 E2E completos.

## Próximos pasos (esperando decisión de Dirección)

- (a) Leer el cuerpo CUE en vivo (multimodal) para intentar su desarrollo plano, o
- (b) Cargar tiempos de referencia industrial como estándares PROPUESTOS (marcados no-autorizados) para ver el costo con MO por routing, o
- (c) Parar para que Ingeniería entregue desarrollos de CAD + tiempos/tarifas reales.

**Score honesto actual: ~59/100.** El techo restante es dato de Ingeniería, no código.
