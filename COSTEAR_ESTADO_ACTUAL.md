# COSTEAR — Estado actual

> Reporte vivo para auditoría. Se actualiza al cerrar cada bloque de trabajo.
> **No se hace merge ni deploy sin autorización de Dirección.**

- **Fecha:** 2026-11-09
- **Rama de desarrollo:** `claude/pm-concurrencia`
- **SHA del estado descrito:** `7c27f46ff13bf370f247c227d2aa01f66de00bde` (este archivo se commitea encima)
- **Prod (`c3.4-seller-safe`):** `4f79c72193baceec0cf3f38dbcc4699f2ffe9eac`
- **PR draft (no fusionado):** https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/pull/90
- ⚠️ Nota de ramas: la rama designada original era `claude/costing-app-architecture-psf02g`, pero quedó obsoleta tras un reinicio; todo el trabajo real y el PR viven en `claude/pm-concurrencia`.

## Último bloque — auditoría sobre `20ac9b7` (5 bloqueos de seguridad económica)

Todos con prueba adversarial RED→GREEN.

1. **Aprobaciones ficticias FUERA del componente:** `PantallaIngenieria.jsx` ya **no** fabrica `autorizado:true`, tiempos ni desarrollos; las acciones llegan por prop. Datos de demo aislados en `pantallaIngenieria.demo.js` (solo demo/E2E). Test estático lo garantiza.
2. **`laminasParaCalibre`:** si se pide un acero sin candidatos → **BLOQUEA**; nunca cae a otra familia de acero en silencio.
3. **Autorización de MO:** un `autorizado:true` del cliente **no prueba nada**. `cargarEstandar` exige **aprobador real** (`aprobado_por` con rol Dirección vía `autoridadDesdeListas`, no cuenta no-humana) + versión + vigencia + unidades. `recostearExpediente` pasa la autoridad; sin ella, los estándares se **rechazan**.
4. **Modelo oficial:** dos cálculos **separados** (`factores_vh` vs `routing_tiempos`), sin doble conteo. `oficial_mxn` usa el modelo de la **política aprobada** (`autoridadPolitica`); sin política aprobada **no hay oficial**. `certificable == emitible_comercial == (oficial_mxn != null)` **unificados**.
5. **App verdadera + persistencia — COMPLETO (autorizado por Dirección):**
   - (a) **Migración aplicada a prod** ✅ `supabase/migrations/20261111_expediente_costeo.sql`: tabla `expediente_costeo` + RLS por usuario + RPC `guardar/reabrir_expediente_costeo` (concurrencia optimista). Verificado en prod (tabla, rls=true, 2 RPCs, 2 policies, execute a authenticated). Additiva: no toca precios/BOM/PM/permisos.
   - (b) **Integrada en la nav autenticada** ✅ `src/componentes/IngenieriaExpediente.jsx` (carga/guarda vía Supabase, sin localStorage) + pestaña Dirección en `App.jsx`. Build de producción verde; smoke E2E verde.
   - (c) **E2E PRODUCTIVO (auth + Supabase) PASA** ✅ `e2e/pantallaIngenieriaProd.e2e.js`: login Dirección → Ingeniería → confirmar desarrollo CAD → `guardar_expediente_costeo` (RPC 200) → recargar → **reabrir desde Supabase** → la decisión persiste. Credenciales sólo por env (no en repo).
   - Nota: la primera corrida dejó UNA fila QA (`TELSVH120` de `qa-direccion`) en `expediente_costeo` (borrador, aislado por RLS, sin impacto económico). Limpieza pendiente (no bloquea).

---

## EN PRODUCCIÓN (desplegado y verificado)

| Qué | Estado | Evidencia |
|---|---|---|
| P0 integridad guardado Producto Maestro (cliente + servidor, gate Dirección) | ✅ en prod | RPC `guardar_producto_maestro` 14-arg; cliente Vercel READY `4f79c72` |
| P1 concurrencia (lost update) — advisory lock + FOR UPDATE + UPDATE condicional | ✅ en prod (autorizado 2026-11-09) | `supabase/migrations/DESPLIEGUE_P0_PRODUCTO_MAESTRO.md`; evidencia 2 conexiones: `supabase/tests/postgres_real/` |
| Tabla + RPC `expediente_costeo` (persistencia de Ingeniería, RLS por usuario) | ✅ en prod (autorizado 2026-11-09) | `supabase/migrations/20261111_expediente_costeo.sql`; E2E productivo `e2e/pantallaIngenieriaProd.e2e.js`. Additiva, no toca precios/BOM/PM |

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
- **E2E navegador real (Chromium)** `e2e/pantallaIngenieria.e2e.js`: confirmar→recalcular→persistir→reabrir **PASA**.
- **Lámina viva de Supabase** validada por el loader (2 filas `pza` rechazadas); `vite build` producción verde.

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

- **Ninguno en tests** (suite verde, exit 0) ni en el E2E de navegador.
- Pendientes que NO son errores: pantalla de Ingeniería dentro de la **navegación autenticada** del flujo de costeo (hoy: componente real + ruta de demo probada en navegador, falta insertarla en el menú tras login) y persistencia respaldada en **Supabase** (hoy localStorage); smoke de app del P0 (humano); cobertura del holdout limitada por parseo de capa de texto.

## Próximos pasos

- Insertar `PantallaIngenieria` en la navegación autenticada (pestaña) del flujo PLANO→ENTENDÍ→…→REABRIR y persistir el expediente en Supabase (requiere auth/schema → autorización).
- Datos de Ingeniería para cerrar el costo oficial de TELSVH120: desarrollos de CAD (4 piezas 3D), 2 precios ERP, tiempos/tarifas por centro, terceros.

**Score honesto actual: ~66/100** (sube por el P1 económico fail-closed, catálogo vivo validado, desarrollo CAD explícito, estándares con vigencia, nesteo conjunto y la pantalla probada en navegador real). El techo restante es dato de Ingeniería + la inserción en la nav autenticada, no cálculo.
