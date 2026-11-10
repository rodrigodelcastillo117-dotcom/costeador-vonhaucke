# PREFLIGHT — P0 `expediente_costeo` (release de seguridad, independiente del PR #90)

> **Para autorización de Dirección. NO se ejecuta la migración productiva sin aprobación explícita.**
> Release mínimo: sólo cierra el P0 de autorización. No incluye el módulo industrial (sigue en PR #90 DRAFT).

- **Fecha:** 2026-11-10
- **Proyecto prod:** `mtuvnbgljwbsaizjjgzs` (costeador-vonhaucke)
- **Migración:** `20261112_expediente_costeo_seguridad.sql`
- **Rollback:** `ROLLBACK_20261112_expediente_costeo_seguridad.sql`
- **Verificación posterior:** `VERIFICACION_POST_20261112.sql` (14 chequeos)
- **Pruebas:** `supabase/tests/expedienteCosteoSeguridad.test.js` (PGlite, 13) · `supabase/tests/postgres_real/aislamiento_dos_usuarios.sh` (Postgres real, 22)
- **Identidad de dueño: `auth.uid()` (UUID inmutable), no el email** (ver §3-bis).

## 1. Defecto (vivo en prod)

`guardar_expediente_costeo` (contrato `20261111`) localiza la fila **sólo por `clave`**, sin verificar dueño, y reasigna `actualizado_por`. Un usuario B puede **sobrescribir y reclamar** el expediente de A; `VERSION_CONFLICT` **filtra la versión** de la fila ajena. Verificado en vivo contra el esquema productivo (la función viva conserva `where clave = btrim(p_clave)` sin filtro de dueño).

## 2. Estado productivo ACTUAL (verificado por consulta de sólo lectura)

| Objeto | Estado actual (vulnerable) |
|---|---|
| PK | `PRIMARY KEY (clave)` |
| `creado_por` | `text`, **nullable** |
| Policies | `expediente_costeo_all` (ALL) + `expediente_costeo_sel` (SELECT), ambas por `coalesce(actualizado_por, creado_por)` |
| RLS | habilitada |
| Grants tabla | sólo `postgres`, `service_role` (authenticated NO tiene acceso directo → sólo vía RPC) |
| Execute RPC | `authenticated` tiene execute en guardar/reabrir |
| Funciones | `SECURITY DEFINER`, `search_path=public,pg_temp`; **filtran sólo por `clave`** |
| Filas | **1** (`TELSVH120`, dueño `qa-direccion`, `creado_por` poblado) |

## 3. Qué hace la migración (diff)

| Objeto | Después del fix |
|---|---|
| `propietario` | **nueva columna `uuid` = `auth.uid()`** (dueño inmutable). Backfill desde `auth.users` por el email guardado (`creado_por`) → `NOT NULL`. `creado_por`/`actualizado_por` (email) quedan como **auditoría**. |
| PK | `PRIMARY KEY (propietario, clave)` — identidad por dueño; la clave comercial ya no identifica sola → **sin colisión entre usuarios** |
| Policies | se reemplazan por `expediente_costeo_owner` (ALL) por `auth.uid() = propietario` (no email mutable) |
| RPC guardar/reabrir | **aisladas por `auth.uid()`** (`where propietario = v_uid …`): imposible leer/sobrescribir/reclamar fila ajena; `propietario` nunca se actualiza; `VERSION_CONFLICT` ya no filtra la versión; lock por uid+clave |
| Historial | nueva tabla `expediente_costeo_historial` (col. `propietario uuid`) append-only (RLS por `auth.uid()`, sólo SELECT a authenticated) |
| Firma/return RPC | **sin cambios** → el cliente no requiere redeploy |

**Aditiva y compatible:** no toca precios, BOM, Producto Maestro ni permisos de otras tablas. La única fila QA sobrevive; su `propietario` se rellena con el uid de `qa-direccion` (mapeado desde `auth.users`, verificado read-only: existe y 0 filas sin match). La migración **aborta** (sin escribir) si un email dueño no mapea a un `auth.users.id`, en vez de inventar un dueño.

## 3-bis. Por qué `auth.uid()` y no el email (corrección de la auditoría)

El email en Supabase **es mutable y reasignable**. Identificar al dueño por email dejaba dos huecos que el uid cierra:
- **Reasignación (seguridad):** si un correo se libera y se asigna a otra persona, su JWT traería ese email y podría reabrir/sobrescribir los expedientes del usuario original — el mismo "claim" que cerramos, resurgiendo.
- **Cambio de correo (disponibilidad):** al cambiar su email, un usuario quedaría fuera de sus propios expedientes (`creado_por` viejo).

`auth.uid()` (el `sub` del JWT) nunca cambia ni se reasigna. Probado: *"reasignar el email de A a B NO transfiere el expediente"* (PGlite + Postgres real). Costo hoy: backfill de **1 fila**.

## 4. Rollback — análisis del riesgo que señaló la auditoría

**Pregunta:** ¿el rollback puede restaurar una PK global después de que existan claves repetidas por dueño?

**Respuesta: NO, y por diseño.** El rollback lleva un *guard* que lo **ABORTA** (`ROLLBACK_ABORTADO`, sin borrar datos) si detecta la misma `clave` en más de un propietario — colapsar a `PRIMARY KEY (clave)` ahí perdería aislamiento/datos. **Demostrado** en Postgres real (test #7): con 2 filas `TELSVH120` de dueños distintos, el rollback aborta y las filas quedan intactas.

**Guía operativa:**
- El rollback sólo es seguro en la **ventana inmediata** post-aplicación (si el fix falla), **antes** de que exista una 2ª fila con clave repetida. Hoy hay **1 sola fila** → ventana segura.
- Revertir restaura la RPC **vulnerable** y la identidad por email: no es un "undo" neutro. Pasada esa ventana, **corregir hacia adelante**, no revertir. La columna `propietario`, la PK compuesta y el historial son inocuos de conservar.

## 4-bis. Alternativa SEGURA: corrección hacia adelante (recomendada sobre el rollback)

El rollback re-abre el P0 y falla tras colisiones; por eso, si el fix necesitara un ajuste, la vía recomendada es **corregir hacia adelante** (una nueva migración que **conserva** la PK compuesta, el dueño inmutable, el historial y el aislamiento, y sólo cambia lo que haga falta):

- **Si la RPC nueva tuviera un bug** (p.ej. en el lock o el chequeo de versión): un `create or replace function public.guardar_expediente_costeo(...)` corregido, **manteniendo** `where creado_por = v_email and clave = v_clave` y sin tocar `creado_por`. No requiere cambiar la tabla ni perder datos.
- **Si hiciera falta endurecer la policy/permiso:** un `drop policy ... / create policy ...` sobre `creado_por`, o ajustar grants, sin tocar la PK ni las filas.
- **Si se quisiera una identidad aún más desacoplada:** la columna `propietario uuid` ya cumple ese rol; cualquier cambio se **añade** de forma aditiva.
- **Invariante en toda corrección hacia adelante:** nunca localizar la fila sólo por `clave`; nunca actualizar `propietario`; nunca degradar la RLS a email (`actualizado_por`/`creado_por`). Estas son las que causaron el P0.

En resumen: el **rollback** es el botón de pánico de la ventana inmediata (hoy segura, 1 fila); la **corrección hacia adelante** es la vía por defecto una vez que el fix está en uso.

## 5. Evidencia (ejecutada)

- **Prod RE-VERIFICADO en vivo (read-only):** sigue vulnerable y sin cambios — PK `(clave)`, sin `expediente_costeo_historial`, `guardar` filtra sólo por `clave`, 1 fila, md5 `6fdd462c`. Las tablas de precio (`insumo_precios`, `catalogo_vigente`, `producto_maestro`) existen y la migración **no las referencia** → **sin cambio de precios ni de frontend** (firma/return de las RPC idénticas). `auth.users`: `qa-direccion` existe, **0 filas sin match** para el backfill.
- **Respaldo recuperable:** `supabase/backups/RESPALDO_expediente_costeo_20261109.md` — snapshot md5 `6fdd462c…`, migración aditiva que preserva la fila, INSERT idempotente verificado.
- **Postgres REAL (no prod), 22/22 PASS** — `aislamiento_dos_usuarios.sh`:
  0. Backfill email→uid asigna el uid correcto a la fila heredada.
  1. `authenticated` sin acceso directo a la tabla (sólo vía RPC).
  2. RLS por `propietario = auth.uid()`: B sólo ve su fila; no lee el secreto de A.
  3. RPC aisladas por uid: B no lee/sobrescribe/reclama a A; 2 filas sin colisión.
  4. `SECURITY DEFINER` + `search_path` fijado.
  5. `propietario` inmutable; **reasignar el email de A a B NO transfiere** el expediente.
  6. `VERSION_CONFLICT` ya no revela la versión.
  7. Rollback aborta ante colisión, sin perder datos.
  8. **Ejecución transaccional (atómica):** tx que falla revierte **todo** (ni PK, ni historial, ni columna `propietario`); el commit deja el fix **completo** (PK `propietario,clave`) y preserva la fila.
- **PGlite 13/13** — reproduce el defecto (contrato viejo por email) y lo cierra (contrato nuevo por uid), incl. inmutabilidad ante reasignación de email y backfill fail-closed.
- **Verificación posterior** `VERIFICACION_POST_20261112.sql` validada en Postgres real: **13/13 estructurales PASS** (el #14 de md5 sólo aplica en prod).
- Migración verificada **contra el esquema productivo real** (sección 2 ↔ 3).
- **CI del release:** `verify` (npm ci, `npm audit` 0 vulns, `vitest`, build) + `E2E público+auth` — SUCCESS en el commit previo; se re-dispara en el SHA final.

## 6. Ejecución transaccional

La migración se aplica **dentro de una sola transacción** (`begin; … commit;`), de modo que es **atómica**: si cualquier paso falla (incluido el `do $$ … raise $$` que aborta ante un expediente sin dueño), **nada** queda a medias. Postgres ejecuta el DDL de forma transaccional; probado en `aislamiento_dos_usuarios.sh` #8 (falla → rollback total; commit → fix completo). El comando de aplicación va envuelto en `begin/commit`.

## 7. Verificación POSTERIOR (sólo lectura)

`supabase/migrations/VERIFICACION_POST_20261112.sql` — 14 chequeos con PASS/FAIL (objetivo: 0 FAIL): PK `(propietario,clave)`, `propietario NOT NULL`, ambas RPC aisladas por `auth.uid()`, ausencia del patrón vulnerable, historial + RLS, policy por `propietario`/`auth.uid()`, execute a `authenticated`, `anon` sin execute, sin acceso directo a la tabla, `SECURITY DEFINER`+`search_path`, firmas intactas, y fila QA preservada por md5 con su `propietario` mapeando al uid de `qa-direccion`. Validado en Postgres real (13/13 estructurales PASS; el #14 de md5 sólo aplica en prod).

## 8. Plan de aplicación (sólo con tu autorización)

```sql
-- 1) Aplicar (transaccional):
begin;
\i supabase/migrations/20261112_expediente_costeo_seguridad.sql
commit;
-- 2) Verificar (0 FAIL esperado):
\i supabase/migrations/VERIFICACION_POST_20261112.sql
```
Chequeo de contenido: `select md5(expediente::text) from public.expediente_costeo where clave='TELSVH120';` → debe seguir siendo `6fdd462cb2fe1878746ad66f09a858db`.
3. Smoke productivo (opcional): E2E de Ingeniería con la cuenta QA (guardar borrador → reabrir).
4. **Recuperación:** prioriza **corrección hacia adelante** (§4-bis). El rollback a `20261111` re-abre el P0 y la identidad por email; sólo admisible en la ventana inmediata, antes de que exista una 2ª fila con clave repetida.

**No ejecuto nada de esto sin tu aprobación explícita.**
