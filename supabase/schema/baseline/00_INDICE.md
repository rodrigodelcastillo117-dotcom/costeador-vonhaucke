# Baseline del esquema `public` — snapshot de SÓLO LECTURA

Snapshot de SÓLO LECTURA de **mtuvnbgljwbsaizjjgzs**, **2026-10-10**. Generado con SELECTs sobre `pg_catalog` / `information_schema` (ningún DDL, ningún DML, ningún `apply_migration`). **NO es una migración: no aplicar.** Regenerar al cierre de cada bloque.

- Servidor: PostgreSQL 17.6.
- Alcance: esquema `public` únicamente. El esquema `private_api` (36 funciones, 34 de ellas `SECURITY DEFINER`) **no** se volcó; sólo se referencia donde `public` depende de él (34 wrappers RPC, 2 triggers, y la mayoría de las políticas RLS llaman a `private_api.puede_editar_config()`, `private_api.es_direccion()`, `private_api.puede_ver_economia()` o `private_api.current_request_email()`).
- Última migración registrada en `supabase_migrations.schema_migrations`: `20261010083653 harden_invoker_trigger_paths_20261010` (220 filas; volcadas en `../MIGRACIONES_APLICADAS.md`).

## Conteos

| Objeto | Cantidad |
|---|---|
| Tablas (`relkind r/p`) | **34** |
| Tablas con RLS habilitado | 34 (100 %) · con `FORCE ROW LEVEL SECURITY`: 0 · sin RLS: 0 |
| Políticas RLS | **97** (95 PERMISSIVE, 2 RESTRICTIVE; 5 son deny-all explícito `USING (false)`) |
| Funciones en `public` | **65** (14 `SECURITY DEFINER`, 51 `SECURITY INVOKER`; 15 son funciones de trigger; 34 son wrappers finos hacia `private_api.*`) |
| Vistas | **3** (las 3 con `security_invoker=true`) · vistas materializadas: 0 |
| Triggers (no internos) | **17** (2 ejecutan funciones de `private_api`) |
| Índices | 82 en total (36 respaldan PK/UNIQUE/EXCLUDE; 46 independientes) |
| Foreign keys / CHECK | 30 / 26 |
| Extensiones instaladas | 6 |
| Tipos personalizados en `public` (enum/compuesto/dominio) | 0 |

## Archivos

### `01_tablas.sql` (34 tablas)
`CREATE TABLE` de cada tabla de `public`, reconstruido desde `pg_attribute` + `pg_attrdef` (tipo vía `format_type(atttypid, atttypmod)`, `NOT NULL`, `DEFAULT`, columnas `IDENTITY`), con PK/UNIQUE/CHECK/EXCLUDE inline (`pg_get_constraintdef`). Después, en secciones separadas: las 30 foreign keys como `ALTER TABLE ... ADD CONSTRAINT`, los 46 `CREATE INDEX` que no respaldan un constraint (`pg_indexes`), y los comentarios de tabla/columna (`obj_description` / `col_description`). Incluye las dos tablas de respaldo `*_backup_20261002`.

### `02_rls_policies.sql` (34 ENABLE, 97 políticas)
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` para cada tabla con `relrowsecurity` (ninguna tiene `relforcerowsecurity`, por lo que no hay `FORCE`), y cada fila de `pg_policies` renderizada como `CREATE POLICY nombre ON tabla AS PERMISSIVE|RESTRICTIVE FOR cmd TO roles USING (...) WITH CHECK (...)`. Al final, dos listas: tablas con RLS y cero políticas (ninguna) y tablas sin RLS (ninguna). Las políticas dependen de helpers en `private_api`, así que este archivo no es autocontenido.

### `03_funciones.sql` (65 funciones)
`pg_get_functiondef(oid)` de todas las funciones de `public`, ordenadas por nombre, cada una precedida por un encabezado con firma, `SECURITY DEFINER`/`INVOKER`, tipo (function/trigger) y comentario si existe. Las 14 `SECURITY DEFINER` son: `aprobar_mapeo_externo`, `aprobar_precio`, `bom_hash_de_revision`, `cerrar_vigencia_precio`, `certificar_version`, `normalize_economics_on_cotizacion_write`, `pin_product_versions_in_partidas`, `pin_product_versions_on_cotizacion_write`, `puede_certificar_costo`, `reglas_comerciales_vigentes`, `resolve_canonical_price`, `resolver_precio_especial_proyecto`, `strip_seller_economics_on_cotizacion_write`, `strip_seller_economics_on_revision_write`. Los cuerpos de `private_api.*` no están aquí.

### `04_vistas.sql` (3 vistas)
`catalogo_vigente`, `cotizaciones_integridad` y `proyectos_salud` vía `pg_get_viewdef`, con sus `reloptions` y si tienen `security_invoker` (las tres lo tienen). `catalogo_vigente` lleva un comentario que la marca como `LEGACY_COMPATIBILITY_VIEW` (no es autoridad de costo certificado; usar `resolve_canonical_price()`).

### `05_triggers.sql` (17 triggers)
`pg_get_triggerdef` de todos los triggers no internos sobre tablas de `public`, con su estado `tgenabled` (todos `O` = habilitados). Dos apuntan a funciones de `private_api`: `cotizaciones.trg_guard_cotizacion_estado_directo` → `private_api.guard_cotizacion_estado_directo()` y `producto_versiones.trg_producto_version_spatial_spec` → `private_api.canonicalizar_spatial_spec_producto_version()`.

### `06_grants.sql`
Privilegios de tabla/vista (`information_schema.role_table_grants`) y de función (`routine_privileges`) para `anon`, `authenticated`, `service_role` y `PUBLIC`, renderizados como `GRANT`. Más las 24 filas de `pg_default_acl` (todos los esquemas) como comentarios en notación `aclitem`. Para `public`, los default privileges del owner `postgres` ya **no** otorgan nada a `anon`/`authenticated` en tablas nuevas (sólo `m` = MAINTAIN) ni en funciones/secuencias nuevas; los defaults de `supabase_admin` siguen siendo amplios.

### `07_extensiones_y_tipos.sql`
Las 6 extensiones instaladas (`btree_gist 1.7`, `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, `uuid-ossp 1.1`) con su esquema y versión. No existen enums, tipos compuestos ni dominios definidos en `public`.

## Hallazgos de superficie de acceso

### Tablas con RLS habilitado y cero políticas (deny-all implícito)
**Ninguna.** Las 34 tablas tienen al menos una política.

Deny-all **explícito** (`USING (false) WITH CHECK (false)` para `anon, authenticated`; sólo `service_role` llega): `ai_eventos`, `auth_recovery_once`, `cotizaciones_backup_20261002`, `cotizaciones_revisiones_backup_20261002`, `render_eventos`. Esas 5 tablas además no tienen ningún `GRANT` a `authenticated` ni a `anon`.

### Funciones ejecutables por `anon`
- Con grant **directo** a `anon` (`routine_privileges.grantee = 'anon'`): **ninguna**.
- Con grant a `PUBLIC` (que `anon` hereda): 8 funciones, todas `RETURNS trigger` y por tanto **no invocables como RPC** (`calc_mapeo_source_hash`, `calc_source_hash`, `guard_delete_producto_version`, `guard_mapeo_externo`, `guard_precio_no_autofirma`, `guard_producto_version`, `insumo_precios_append_only`, `sync_precio_legacy`). Son el default de PostgreSQL para funciones nuevas; se podrían revocar por higiene.
- `authenticated` tiene `EXECUTE` sobre 45 de las 65 funciones; `service_role` sobre las 65.

### Otras observaciones (datos, no juicios)
- `anon` no tiene **ningún** privilegio sobre tablas ni vistas de `public`.
- `authenticated` **no** tiene `SELECT` sobre: `cotizaciones` (sólo INSERT/UPDATE/DELETE; la lectura va por RPC `cotizacion_segura`/`cotizaciones_mias`), la vista `catalogo_vigente` (tiene todo menos SELECT, resto de grants heredados sin efecto práctico) y las 5 tablas deny-all.
- Políticas RESTRICTIVE: `cotizaciones.qa_fixture_isolation_cotizaciones` y `proyectos.qa_fixture_isolation_projects` (aíslan fixtures de `qa-direccion@vonhaucke.mx`).
- Varias políticas de `aprendizajes`, `expedientes`, `reglas`, `expediente_revisiones` consultan `permitidos` directamente en lugar de los helpers de `private_api`.

## Cómo regenerar
Repetir los SELECTs sobre `pg_catalog` descritos en la cabecera de cada archivo (sólo lectura) y reemplazar los 8 archivos de esta carpeta; actualizar la fecha de la cabecera y añadir a `../MIGRACIONES_APLICADAS.md` las filas nuevas de `supabase_migrations.schema_migrations`.
