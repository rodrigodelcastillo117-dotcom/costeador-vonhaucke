# PREFLIGHT — P0 `expediente_costeo` (release de seguridad, independiente del PR #90)

> **Para autorización de Dirección. NO se ejecuta la migración productiva sin aprobación explícita.**
> Release mínimo: sólo cierra el P0 de autorización. No incluye el módulo industrial (sigue en PR #90 DRAFT).

- **Fecha:** 2026-11-09
- **Proyecto prod:** `mtuvnbgljwbsaizjjgzs` (costeador-vonhaucke)
- **Migración:** `20261112_expediente_costeo_seguridad.sql`
- **Rollback:** `ROLLBACK_20261112_expediente_costeo_seguridad.sql`
- **Pruebas:** `supabase/tests/expedienteCosteoSeguridad.test.js` (PGlite, 12) · `supabase/tests/postgres_real/aislamiento_dos_usuarios.sh` (Postgres real, 14)

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
| PK | `PRIMARY KEY (creado_por, clave)` — identidad por dueño; la clave comercial ya no identifica sola → **sin colisión entre usuarios** |
| `creado_por` | backfill desde `actualizado_por` si null (la fila QA ya lo tiene) → `NOT NULL` (dueño inmutable) |
| Policies | se reemplazan por `expediente_costeo_owner` (ALL) por `creado_por` **inmutable** (no `actualizado_por` mutable) |
| RPC guardar/reabrir | **aisladas por dueño** (`where creado_por = v_email …`): imposible leer/sobrescribir/reclamar fila ajena; `creado_por` nunca se actualiza; `VERSION_CONFLICT` ya no filtra la versión; lock por dueño+clave |
| Historial | nueva tabla `expediente_costeo_historial` append-only (RLS por `creado_por`, sólo SELECT a authenticated) |
| Firma/return RPC | **sin cambios** → el cliente no requiere redeploy |

**Aditiva y compatible:** no toca precios, BOM, Producto Maestro ni permisos de otras tablas. La única fila QA sobrevive (su `creado_por` ya está poblado). La migración **aborta** (sin escribir) si encontrara un expediente sin dueño, en vez de inventar uno.

## 4. Rollback — análisis del riesgo que señaló la auditoría

**Pregunta:** ¿el rollback puede restaurar una PK global después de que existan claves repetidas por dueño?

**Respuesta: NO, y por diseño.** El rollback lleva un *guard* que lo **ABORTA** (`ROLLBACK_ABORTADO`, sin borrar datos) si detecta la misma `clave` en más de un dueño — porque colapsar a `PRIMARY KEY (clave)` ahí perdería aislamiento/datos. **Demostrado** en Postgres real (test #7): con 2 filas `TELSVH120` de dueños distintos, el rollback aborta y las filas quedan intactas.

**Guía operativa:**
- El rollback sólo es seguro en la **ventana inmediata** post-aplicación (si el fix falla o la RPC nueva tiene un bug), **antes** de que exista una 2ª fila con clave repetida. Hoy hay **1 sola fila** → ventana segura.
- Revertir restaura la RPC **vulnerable** (re-abre el P0), así que no es un "undo" neutro: pasada esa ventana, **corregir hacia adelante**, no revertir. La PK compuesta y el historial son inocuos de conservar.

## 5. Evidencia (ejecutada)

- **Postgres REAL (no prod), 14/14 PASS** — `aislamiento_dos_usuarios.sh`:
  1. `authenticated` sin acceso directo a la tabla (sólo vía RPC).
  2. RLS filtra por `creado_por`: B sólo ve su fila, no la de A; B no lee el secreto de A.
  3. RPC aisladas: B no lee/sobrescribe/reclama a A; coexisten 2 filas sin colisión.
  4. `SECURITY DEFINER` + `search_path` fijado.
  5. `creado_por` inmutable tras varios guardados.
  6. `VERSION_CONFLICT` ya no revela la versión.
  7. Rollback aborta ante colisión, sin perder datos.
- **PGlite 12/12** — reproduce el defecto (contrato viejo) y lo cierra (contrato nuevo).
- Migración verificada **contra el esquema productivo real** (sección 2 ↔ 3).

## 6. Plan de aplicación (sólo con tu autorización)

1. Aplicar `20261112_expediente_costeo_seguridad.sql` a `mtuvnbgljwbsaizjjgzs`.
2. Verificar en vivo: PK = `(creado_por, clave)`, historial existe, `guardar` aislado por dueño, fila QA intacta (`reabrir` de `qa-direccion` devuelve v3).
3. Smoke productivo (opcional): E2E de Ingeniería con la cuenta QA (guardar borrador → reabrir).
4. Rollback listo si algo falla en la ventana inmediata.

**No ejecuto nada de esto sin tu aprobación explícita.**
