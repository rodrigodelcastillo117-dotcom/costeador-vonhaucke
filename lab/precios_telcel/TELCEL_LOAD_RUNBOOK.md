# TELCEL_LOAD_RUNBOOK — carga de los 49 materiales TELCEL (C-CO-320R)

> **Paquete listo para que Dirección lo aplique a producción.** Preparado por la sesión,
> **sin tocar la DB** (autorización del usuario: "preparar paquete, no tocar prod").
> Los precios entran **PRELIMINARES**: no se certifican hasta que Compras los revalide.

## Qué es

49 materiales `AUTO_CARGABLE` del workbook real TELCEL **C-CO-320R** (`cata_mp`), con identidad
exacta Artículo+Opción, precio, unidad y fecha **del propio CSV** (nada inventado). Las **9**
identidades `NECESITA_HUMANO` quedaron fuera a propósito (no hay match exacto / sin precio-unidad
usable) — ver `TELCEL_LOAD_PLAN.md`.

## Archivos

- `TELCEL_LOAD_READY.sql` — el paquete: una llamada a `cargar_erp_ultima_compra(documento, catalogo, precios)`
  con los 49 registros, todos `estado=propuesto_validado` + `requiere_validacion_compras=true`.
- `gen_telcel_load.mjs` — el generador determinista (reproducible): cruza `TELCEL_LOAD_PLAN.md`
  (lista vetada) con `*_cata_mp.csv` (descripción real) y emite el SQL. 49/49 cruzaron exacto, 0 dudosos.
- `TELCEL_LOAD_PLAN.md` — la regla y la lista 49 AUTO_CARGABLE / 9 NECESITA_HUMANO.

## Cómo se garantiza la honestidad (invariantes del paquete)

- **Precio/unidad/fecha/clave** salen de `cata_mp` tal cual; el generador verifica que coincidan
  con la lista vetada (precio ±0.005 y fecha exacta) o descarta la fila (0 descartes).
- **Preliminar, no certificado:** `requiere_validacion_compras=true` fuerza `propuesto_validado`;
  la función del candado (migración `PROPUESTA_20261026_...`) **no** lo auto-aprueba y la firma
  masiva de Dirección **lo salta** hasta que Compras quite el flag por el flujo explícito.
- **Dedup:** la función omite un precio ya presente con el mismo (record_id + precio + fecha). Re-correr es idempotente.
- **Nunca $0:** `source_price` de cada registro es > 0 (verificado).
- **Frescura visible:** varios precios son viejos (2011–2024). Son evidencia histórica, no cotización
  de hoy. La certificación comercial es decisión de Compras/Dirección (ver P0-03b en `95_RELEASE_MASTER_PLAN.md`).

## Pasos para Dirección (en el SQL editor de Supabase, sesión de Dirección)

1. **Pre-requisito** — aplicar la migración del candado si aún no está en prod:
   `supabase/migrations/PROPUESTA_20261026_workbook_proyecto_preliminar.sql`.
2. **Carga** — correr `TELCEL_LOAD_READY.sql`. Debe devolver `precios_nuevos` ≈ 49, `aprobados` = 0.
3. **Verificar** (incluida en el SQL):
   ```sql
   select estado, requiere_validacion_compras, count(*)
     from insumo_precios
     where source_document = 'ERP Intelisis · C-CO-320R DATS TELCEL DIV-MATERIALES 20261002.xlsx'
     group by 1,2 order by 1;
   ```
   Esperado: todos `propuesto_validado` + `requiere_validacion_compras=true`, 0 certificados.
4. **Rollback** (si hiciera falta):
   ```sql
   delete from insumo_precios
     where source_document = 'ERP Intelisis · C-CO-320R DATS TELCEL DIV-MATERIALES 20261002.xlsx';
   ```

## Reproducir el SQL desde cero

```
node lab/precios_telcel/gen_telcel_load.mjs \
  lab/precios_telcel/TELCEL_LOAD_PLAN.md \
  lab/precios_telcel/3949cec4_C_CO_320R_DATS_TELCEL_DIV_MATER__cata_mp.csv \
  lab/precios_telcel/TELCEL_LOAD_READY.sql
```
