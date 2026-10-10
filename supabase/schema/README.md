# Esquema de Supabase · snapshot versionado (Bloque 0)

**Hallazgo (2026-10-10):** el proyecto `mtuvnbgljwbsaizjjgzs` tiene **220 migraciones
aplicadas** en producción y el repo tenía **cero**. Todo el esquema (tablas, RLS, RPCs
como `emitir_revision_v2`, `cotizacion_segura`, `config_para_rol`, `safe_quote_write`,
compuertas de emisión, sanitizadores de economía) vivía sólo en la nube: nadie podía
revisarlo en un PR, reproducirlo en local ni saber qué cambió entre dos fechas.

## Qué hay aquí

- `MIGRACIONES_APLICADAS.md` — las 220 versiones aplicadas, en orden, tal como las lista
  `supabase_migrations.schema_migrations` el 2026-10-10. Es el punto de partida.
- `baseline/` — volcado **leído** de la base en producción (sólo lectura, sin tocar nada):
  tablas y columnas, políticas RLS, funciones/RPCs con su cuerpo, vistas, triggers,
  grants. Es una FOTO, no una migración: sirve para leer y diffear, no para aplicar.

## Hueco conocido del baseline

Existe un esquema `private_api` con 36 funciones (34 SECURITY DEFINER) del que dependen 34
wrappers de `public` y varias políticas RLS. El volcado de hoy cubre sólo `public`; el
baseline **no es autocontenido** hasta que se vuelque `private_api` también. Es el primer
pendiente al regenerar.

## Regla desde hoy

1. **Ningún cambio al esquema se aplica a mano desde el dashboard o el conector sin
   dejar su `.sql` en `supabase/migrations/`** (con `supabase migration new <nombre>` o
   copiando exactamente el SQL que se aplicó vía `apply_migration`).
2. Al cerrar cada bloque se regenera `baseline/` y el diff se revisa en el PR.
3. Lo que está en `supabase/PENDIENTE_corte_rls_config.sql` es un cambio pendiente y se
   trata como migración futura, no como nota.

## Por qué importa

Los informes del 2026-10-10 encontraron que el cliente llama RPCs legacy
(`emitir_revision` sin anti-tamper) cuando en la base ya existe `emitir_revision_v2`,
y que `asignar_folio_oficial`, `resolver_precio_autorizado` y `cotizar-servidor` existen
pero nunca se invocan. Esa deriva cliente↔base sólo se ve cuando el esquema está en el
repo, al lado del código que lo consume.
