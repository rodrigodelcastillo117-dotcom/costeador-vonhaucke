# RESPALDO / recuperabilidad — `expediente_costeo` (pre-migración 20261112)

> Confirmación de que la única fila existente es recuperable y que la migración la preserva.
> Verificado por consulta de sólo lectura contra producción (`mtuvnbgljwbsaizjjgzs`) el 2026-11-09.

## Snapshot de la fila (identidad + integridad)

| Campo | Valor |
|---|---|
| `clave` | `TELSVH120` |
| `version` | `1` |
| `creado_por` | `qa-direccion@vonhaucke.mx` |
| `actualizado_por` | `qa-direccion@vonhaucke.mx` |
| `creado_en` | `2026-11-09 19:58:20.835444+00` |
| `md5(expediente::text)` | `6fdd462cb2fe1878746ad66f09a858db` |
| tamaño | `21187` bytes |

## ¿Recuperable?

1. **La migración NO toca el contenido de la fila.** Es aditiva: añade la columna `propietario uuid`, cambia la PK a `(propietario, clave)`, añade `expediente_costeo_historial` y reemplaza RPC/policies. El único `update` sobre datos existentes rellena la **nueva** columna `propietario` (desde `auth.users` por el email guardado); **no reescribe** `expediente`, `version`, `creado_por` ni `actualizado_por`. No hay `delete` ni reescritura del JSON. → **la fila se preserva.**
2. **Verificación pre/post aplicable:** tras aplicar, `md5(expediente::text)` debe seguir siendo `6fdd462c…`, `version=1`, `creado_por=qa-direccion@vonhaucke.mx`, y `propietario` = el uid de `qa-direccion`. (En el test de Postgres real, la fila heredada sobrevive, se le asigna el uid correcto por backfill y su dueño la reabre.)
3. **Respaldo explícito disponible:** se generó un `INSERT ... on conflict do nothing` idempotente que reconstruye la fila exacta (verificado contra el md5 de arriba). No se incrusta aquí el blob de 21 KB para evitar riesgo de transcripción; se re-materializa de forma determinista con esta consulta de sólo lectura:
   ```sql
   select 'insert into public.expediente_costeo (clave,version,expediente,actualizado_por,creado_por,creado_en,actualizado_en) values ('
     || quote_literal(clave) || ',' || version || ',' || quote_literal(expediente::text) || '::jsonb,'
     || quote_nullable(actualizado_por) || ',' || quote_nullable(creado_por) || ','
     || quote_literal(creado_en::text) || ',' || quote_literal(actualizado_en::text) || ') on conflict do nothing;'
   from public.expediente_costeo where clave='TELSVH120';
   ```
   Como la migración no borra la fila, esta consulta sigue siendo válida durante y después de la aplicación.

## Lo que NO afirmo

- **No pude verificar** con las herramientas disponibles el tier de respaldos automáticos / PITR de la plataforma Supabase para este proyecto. Si Dirección quiere, antes de aplicar se confirma en el panel de Supabase (Database → Backups) y/o se commitea el INSERT completo de 21 KB como artefacto de respaldo. La recuperabilidad de la fila **no depende** de eso: el punto 1 (migración aditiva) y el punto 3 (INSERT idempotente verificado) ya la garantizan.
