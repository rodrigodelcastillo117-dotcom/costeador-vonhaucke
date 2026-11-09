# COSTEAR — Estado actual

> Reporte vivo para auditoría. Se actualiza al cerrar cada bloque de trabajo.
> **No se hace merge ni deploy sin autorización de Dirección.**

- **Fecha:** 2026-11-09
- **Rama de desarrollo:** `claude/pm-concurrencia`
- **SHA auditado:** `36432bb905909df5d4dc7ccecee6e08165e5f39d` (este archivo y el fix se commitean encima)
- **Prod (`c3.4-seller-safe`):** `4f79c72193baceec0cf3f38dbcc4699f2ffe9eac`
- **PR draft (no fusionado):** https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/pull/90
- ⚠️ Nota de ramas: la rama designada original era `claude/costing-app-architecture-psf02g`, pero quedó obsoleta tras un reinicio; todo el trabajo real y el PR viven en `claude/pm-concurrencia`.

## 🔴 Último bloque — auditoría sobre `36432bb` (P0 de autorización + 3 bloqueos)

### P0 (PRIORIDAD ABSOLUTA) — autorización de `guardar_expediente_costeo` · FIX PROPUESTO, NO APLICADO

**Defecto (reproducido en entorno aislado, no sobre expedientes productivos):** la RPC `guardar_expediente_costeo` de `20261111` (ya en prod) localizaba la fila **sólo por `clave`**, sin verificar propietario, y reasignaba `actualizado_por`. Un usuario B podía **sobrescribir y RECLAMAR** el expediente de A (control transfer); tras el overwrite, A perdía el `reabrir`. Agravante: el mensaje `VERSION_CONFLICT` **filtraba la versión** de la fila ajena.

**Fix (reversible, para aprobación):**
- `supabase/migrations/20261112_expediente_costeo_seguridad.sql` — **PK compuesta `(creado_por, clave)`** (identidad por dueño; la clave comercial ya no identifica por sí sola → sin colisión entre usuarios); **dueño inmutable** (`creado_por` nunca se actualiza); RPC `guardar`/`reabrir` **aisladas por dueño** (`where creado_por = v_email`, imposible tocar fila ajena); concurrencia optimista preservada; **historial append-only** (`expediente_costeo_historial`); RLS por `creado_por` inmutable; `VERSION_CONFLICT` ya **no filtra** la versión. Compatible con la fila QA preexistente.
- `supabase/migrations/ROLLBACK_20261112_...sql` — rollback verificado (aplica limpio, PK vuelve a `(clave)`, fila QA conservada).
- **12 pruebas** `supabase/tests/expedienteCosteoSeguridad.test.js`: Parte A **reproduce** el defecto (overwrite + claim + fuga de versión) sobre el contrato viejo; Parte B **cierra** (aislamiento, dueño inmutable, concurrencia, historial, roles, RLS, compat QA, atacante no reclama la fila QA).
- ⚠️ **NO APLICADO a prod.** Requiere autorización explícita de Dirección. **Prod sigue corriendo la RPC vulnerable.**

### 2º bloqueo — CAD ficticio FUERA del flujo autenticado ✅
`IngenieriaExpediente.jsx` ya **no** ofrece la acción `ing-confirmar-cad-cue` con medidas inventadas. El contenedor sólo **muestra** el expediente y permite **Guardar borrador** (persiste tal cual, sin fabricar geometría). Test estático extendido lo garantiza (`pantallaIngenieriaSinAprobaciones.test.js`).

### 3er bloqueo — estándares de MO verificados server-side ✅
`cargarEstandar` ahora exige, como en precios (`insumo_precios.estado='aprobado'`), un **hecho de aprobación escrito por el servidor** (`estado='aprobado'`): un aprobador **nombrado** por el cliente **ya no basta**. Nuevo verificador server-logic `aprobacionEstandarMO` (espejo de `aprobacionPrecioExacto`): rol Dirección + no cuenta no-humana + **fail-closed sin la lista de cuentas no humanas**. RED→GREEN en `costoOperacion.test.js` y `autoridadCosteoServidor.test.js`.

### 4º — E2E real (ejecutado vs omitido)
- **EJECUTADO** (contrato SQL, entorno aislado): 12 pruebas con **dos usuarios A/B**, expedientes independientes, **acceso cruzado denegado**, concurrencia, reapertura — sin tocar expedientes productivos (como se pidió).
- **EJECUTADO** (navegador, 1 usuario sobre su propia fila): `e2e/pantallaIngenieriaProd.e2e.js` actualizado → login Dirección → **Guardar borrador** → `guardar_expediente_costeo` (RPC 200) → recargar → **reabrir** devuelve la fila (no null). Requiere env; sólo su propia fila.
- **OMITIDO**: E2E de navegador con **dos usuarios** y acceso cruzado — requeriría el fix aplicado en una BD no-productiva + una 2ª cuenta; **no se corre contra prod** para no explotar expedientes productivos. Cubierto a nivel de contrato por las 12 pruebas SQL.

---

## EN PRODUCCIÓN (desplegado y verificado)

| Qué | Estado | Evidencia |
|---|---|---|
| P0 integridad guardado Producto Maestro (cliente + servidor, gate Dirección) | ✅ en prod | RPC `guardar_producto_maestro` 14-arg; cliente Vercel READY `4f79c72` |
| P1 concurrencia (lost update) — advisory lock + FOR UPDATE + UPDATE condicional | ✅ en prod (autorizado 2026-11-09) | `supabase/migrations/DESPLIEGUE_P0_PRODUCTO_MAESTRO.md`; evidencia 2 conexiones: `supabase/tests/postgres_real/` |
| Tabla + RPC `expediente_costeo` (persistencia de Ingeniería) | 🔴 **en prod con P0 de autorización ABIERTO** | `20261111` aplicada; fix `20261112` **propuesto, NO aplicado**. Ver bloque P0 arriba. Mitigante: la pantalla de Ingeniería NO está en el cliente desplegado (`4f79c72`); la RPC es alcanzable por API directa de cualquier usuario autenticado; la tabla tiene 1 fila QA |

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

## Pruebas reales ejecutadas (este bloque)

- **P0 seguridad — 12 pruebas PGlite** `supabase/tests/expedienteCosteoSeguridad.test.js`: reproducen el defecto (Parte A) y lo cierran (Parte B). **12/12 verde.**
- **Rollback verificado:** el fix aplica y el rollback aplica limpio sobre él (PK vuelve a `(clave)`, fila QA conservada).
- **3er bloqueo — MO server-side:** RED→GREEN en `costoOperacion.test.js` (aprobador nombrado sin hecho de servidor → rechazado) y 5 pruebas de `aprobacionEstandarMO` en `autoridadCosteoServidor.test.js`.
- **Suite completa: 4372 tests verde** (la única falla fue un test estático auto-referencial mío, ya corregido). `vite build` de producción verde.
- **E2E productivo** `e2e/pantallaIngenieriaProd.e2e.js` actualizado a **Guardar borrador** (requiere env; ejecutado = 1 usuario sobre su fila; omitido = 2 usuarios en navegador, ver 4º arriba).

### Evidencia previa (bloques anteriores)
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

- 🔴 **P0 VIVO en prod:** `guardar_expediente_costeo` (contrato `20261111`) permite sobrescribir/reclamar expedientes ajenos. El fix (`20261112`) está **listo y probado pero NO aplicado** — espera autorización. Mientras tanto, la RPC vulnerable sigue expuesta a cualquier usuario autenticado por API directa (la pantalla no está en el cliente desplegado; 1 fila QA en la tabla).
- **Tests:** suite completa verde salvo verificación en curso de este bloque (ver "Pruebas reales"); la única falla transitoria fue un test estático auto-referencial, ya corregido.
- **Seguimiento (no en el alcance de este bloque):** la autoridad de **política de costo** (`autoridadPolitica` en `costoPropuestoProcesos.js`) sigue siendo un callback JS; debería verificarse server-side como MO/precios. Marcado, no cerrado.
- Pendientes que NO son errores: smoke de app del P0 de Producto Maestro (humano); datos de Ingeniería para el costo oficial de TELSVH120.

## Próximos pasos

- **Esperar autorización** para aplicar `20261112_expediente_costeo_seguridad.sql` a prod (reversible; rollback listo). Tras aplicar: verificar en vivo, re-correr E2E productivo, limpiar la fila QA.
- Verificar server-side la autoridad de política de costo (seguimiento del 3er bloqueo).
- Datos de Ingeniería para cerrar el costo oficial de TELSVH120: desarrollos de CAD (4 piezas 3D), 2 precios ERP, tiempos/tarifas por centro, terceros.

**Score honesto actual: ~58/100** (BAJA respecto a 66: el P0 de autorización vivo en prod es grave aunque el fix esté listo; sube de nuevo en cuanto se aplique y se verifique). El techo restante es aplicar el fix + dato de Ingeniería, no cálculo.
