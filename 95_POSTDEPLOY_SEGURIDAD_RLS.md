# 95_POSTDEPLOY_SEGURIDAD — 2 tablas con RLS DESACTIVADO (hallazgo del advisor) · 2026-11-03

Durante la revisión POST-DEPLOY, el advisor de Supabase marcó **crítico**: 2 tablas tienen Row Level Security (RLS)
**desactivado**. Con RLS off y sin políticas, quedan **expuestas por completo a los roles `anon` y `authenticated`** —
es decir, **cualquiera con la anon key (que viaja en el bundle del frontend) puede LEER y MODIFICAR todas sus filas**.

| Tabla | Filas | Qué contiene | Riesgo real |
|---|---|---|---|
| `cotizaciones_archivadas_qa_20261028` | 4,681 | Cotizaciones QA archivadas (28-oct) — llevan **snapshot económico (costos)** | **Fuga de costos**: lectura pública de datos de costo; además escritura pública |
| `_bk_familia_app_20261021` | 306 | Respaldo de familia/app (21-oct) | Escritura pública → corruptible (dato de respaldo) |

## Verificación de impacto
- El código de la app **NO referencia ninguna de las dos** (`grep` en `src/` y `supabase/`: 0 coincidencias). Son una
  copia de respaldo y un archivo con fecha; la app no las lee ni las escribe.
- Por tanto, **activar RLS sin políticas las deja accesibles sólo a `service_role`** (que ignora RLS) y **no rompe nada**
  de la app. Es exactamente lo que se quiere para tablas de respaldo/archivo.

## Remediación propuesta (NO aplicada — cambio en prod, requiere tu autorización)
```sql
ALTER TABLE "public"."cotizaciones_archivadas_qa_20261028" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_bk_familia_app_20261021" ENABLE ROW LEVEL SECURITY;
```
Alternativa más limpia si confirmas que ya no las necesitas: **borrarlas** (`DROP TABLE`). El archivo QA de 4,681 filas
probablemente ya cumplió su función; el respaldo de familia es del 21-oct. Pero eso es destructivo → sólo con tu visto bueno.

Recomendación: **activar RLS ya** (reversible, no rompe la app, tapa la fuga de inmediato) y, si quieres, borrarlas después.
No lo apliqué por la regla: no toco la base de producción sin tu autorización expresa, y el propio advisor pide no
auto-aplicarlo. Dame luz verde y lo ejecuto (o lo haces tú en el SQL editor de Supabase).

## Nota
El advisor sólo marcó estas 2. El resto de tablas con datos sensibles (cotizaciones, costeos_servidor, insumo_precios,
etc.) **sí tienen RLS activado**. Esto es una fuga puntual por dos tablas de respaldo/archivo que quedaron sin candado,
no un problema sistémico del modelo de seguridad.
