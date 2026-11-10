# COSTEAR — Estado actual

> Reporte vivo para auditoría. Se actualiza al cerrar cada bloque de trabajo.
> **No se hace merge ni deploy sin autorización de Dirección.**

- **Fecha:** 2026-11-10
- **Rama de desarrollo:** `claude/pm-concurrencia`
- **Prod (`c3.4-seller-safe`):** `4f79c72193baceec0cf3f38dbcc4699f2ffe9eac`
- **PR draft industrial (no fusionado):** https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/pull/90
- **Release de seguridad P0 (DB-only):** rama `claude/p0-expediente-seguridad` @ `cc7902e` (dueño por `auth.uid()` inmutable).
- ⚠️ Nota de ramas: la rama designada original era `claude/costing-app-architecture-psf02g`, pero quedó obsoleta tras un reinicio; todo el trabajo real y el PR viven en `claude/pm-concurrencia`.

## ✅ P0 `expediente_costeo` — CERRADO EN PRODUCCIÓN (autorizado por Dirección 2026-11-10)

La migración `20261112` (versión `auth.uid()`) se **aplicó a prod** (`apply_migration` success, atómica) y se **verificó en vivo: 14/14 PASS, 0 FAIL** (`VERIFICACION_POST_20261112.sql`):
PK `(propietario, clave)`, RPC `guardar`/`reabrir` y RLS **aisladas por `auth.uid()` inmutable**, sin el patrón vulnerable, historial append-only + RLS, SECURITY DEFINER + search_path, firmas intactas, y **fila QA preservada** (md5 `6fdd462c`, `propietario` = uid de qa-direccion). Ningún usuario puede leer/sobrescribir/reclamar expedientes ajenos. Evidencia previa: Postgres real 22/22, PGlite 13/13, CI run #1065 `verify` SUCCESS. Recuperación: corrección hacia adelante (el rollback re-abriría el P0).

---

## 🔴 Bloque actual — cierre de seguridad P0 (preflight para autorización)

### PRIORIDAD 1 — P0 `guardar_expediente_costeo` · FIX PROPUESTO, PREFLIGHT LISTO, NO APLICADO

**Defecto (vivo en prod, reproducido en entorno aislado — NO sobre expedientes productivos):** la RPC de `20261111` localiza la fila **sólo por `clave`**, sin verificar dueño, y reasigna `actualizado_por` → un usuario B **sobrescribe y RECLAMA** el expediente de A; `VERSION_CONFLICT` **filtra la versión** ajena.

**Preflight verificado contra el esquema productivo real** — `supabase/migrations/PREFLIGHT_P0_expediente_costeo.md`:
- Esquema prod actual (PK `(clave)`, `creado_por` nullable, policies por `actualizado_por`, funciones que filtran sólo por `clave`, 1 fila QA) ↔ lo que produce el fix. Aditivo y compatible.
- Fix `20261112`: PK `(creado_por, clave)`, dueño inmutable, RPC aisladas por dueño, historial append-only, RLS por `creado_por`, sin fuga de versión. Firma/return sin cambios → **sin redeploy de cliente**.
- **Rollback** (riesgo que marcó la auditoría): restaurar la PK global tras claves repetidas por dueño es **imposible sin perder datos**; el rollback lo **ABORTA por diseño** (guard de colisión), demostrado. Revertir re-abre el P0 → sólo ventana inmediata; después, corregir hacia adelante.

**Evidencia ejecutada (no prod):**
- **Postgres REAL (initdb efímero), 14/14 PASS** — `supabase/tests/postgres_real/aislamiento_dos_usuarios.sh`: acceso directo denegado a `authenticated`, **RLS por `creado_por`**, RPC aisladas por dueño, **SECURITY DEFINER + search_path**, identidad inmutable, sin fuga de versión, rollback aborta ante colisión.
- **PGlite 12/12** — `supabase/tests/expedienteCosteoSeguridad.test.js`: reproduce el defecto y lo cierra.

⚠️ **NO APLICADO a prod.** Preflight presentado; espera autorización explícita. **Prod sigue con la RPC vulnerable.** Entregado como **release mínimo independiente** (`claude/p0-expediente-seguridad`), sin el módulo industrial.

### PRIORIDAD 2 — aprobaciones económicas (CORRECCIÓN: estaba mal)

**Reconocido:** mi "fix server-side" de MO del bloque anterior exigía `estado='aprobado'`… en un **objeto JavaScript del cliente**. Eso **no prueba nada** (igual que `autorizado:true`). Sólo moví el hueco de campo.

Hecho en este bloque (verificable, sin tocar prod):
- `costoOperacion()`: un estándar **suministrado directamente** (objeto cliente) es **siempre REFERENCIA**, `oficial:false`, `origen:'suministrado'`, aunque traiga `autorizado:true` y `estado:'aprobado'`. RED→GREEN.
- `cargarEstandar()`: contrato corregido con honestidad — es función CLIENTE; `estado='aprobado'` ahí **no** es prueba server-side. La verificación real es `aprobacionEstandarMO` contra **registros del servidor**.

**Pendiente P2 (siguiente build, migración propia autorizada):** tabla `estandar_mo` + RPC `aprobar_estandar_mo` (rol Dirección) que capture identidad, permisos, fecha, versión y evidencia; y cablear la verificación server-side en el camino del costo oficial. **No se declara costo oficial de MO sin eso.**

### PRIORIDAD 3 — costeo industrial
TELSVH120 se mantiene **PARCIAL** (faltan componentes/desarrollos/tiempos/terceros). PR #90 **DRAFT**, módulo industrial **no desplegado**. Cambios de cliente (CAD ficticio removido, etc.) viven en `pm-concurrencia`/PR #90, fuera del release de seguridad.

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
