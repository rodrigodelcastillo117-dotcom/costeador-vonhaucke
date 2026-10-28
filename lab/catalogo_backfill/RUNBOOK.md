# Backfill de atributos del catálogo (espesor_mm, familia) — paquete revisable

**Estado:** PREPARADO y probado en CI. **NO aplicado a producción.** Escribir datos en el
catálogo de prod es un cambio §100 → requiere OK explícito de Dirección + respaldo.

## El problema (medido en prod, 2026-10-28)
De 11,294 insumos en `insumos_catalogo`:
- `espesor_mm` poblado: **0** · `calibre`: **0** · `material`: **0**
- `familia` poblada: 6,234 (55%) y **contaminada** (p.ej. `familia='cristal'` tiene 1,629 filas,
  muchas son herrajes "BISAGRA PARA CRISTAL…").
- El espesor sólo vive en el **nombre** (4,906 nombres lo traen).

Impacto estimado del backfill (read-only):
- **3,983** filas podrían recibir `espesor_mm` desde el nombre.
- **≥270** filas con familia vacía pero material reconocible → se llenaría.
- **≥61** filas `cristal` que son herrajes → se reclasificarían (des-contaminación).

## Qué hace el generador (`gen_backfill.mjs`)
Reusa la MISMA taxonomía del motor (`familiaDeMaterial`, `espesoresDe`) → cero drift. Emite
UPDATEs SÓLO con confianza. **No inventa.** Candados:
- `espesor_mm` sólo para familias de MATERIAL con espesor propio (tablero, cristal, acrílico,
  metal…), nunca herrajes/acabados.
- Si el nombre dice **"PARA CRISTAL/VIDRIO"**, el mm es del vidrio que sujeta → NO se escribe.
- Un **rango** ("6 a 10 mm") o **varios** espesores ≤60 mm → ambiguo → NO se escribe.
- `familia`: se LLENA si está vacía; sólo se RECLASIFICA cuando la correcta es herraje/acabado
  y la guardada era de material (arregla contaminación). No voltea entre materiales.

Prueba en CI con muestra real de prod: `src/datos/catalogoBackfill.test.js`
(incluye la trampa de la bisagra "PARA CRISTAL DE 6 mm" → NO recibe espesor).

## Cómo generar el .sql (cuando Dirección lo autorice)
1. Exportar el catálogo (read-only), una fila por insumo con `{id, nombre, espesor_mm, familia}`:
   ```sql
   SELECT id, nombre, espesor_mm, familia FROM insumos_catalogo;
   ```
   Guardar el resultado como `catalogo.json` (arreglo de objetos) en esta carpeta.
2. Generar el SQL:
   ```sh
   node lab/catalogo_backfill/gen_backfill.mjs catalogo.json > backfill.sql
   ```
   (a stderr imprime el resumen: cuántos UPDATEs, cuántos por familia y por espesor.)
3. **Revisar** `backfill.sql` a ojo (muestras por familia) antes de nada.

## Cómo aplicar (SÓLO con OK de Dirección — §100)
1. **Respaldo** de las columnas que se tocan:
   ```sql
   CREATE TABLE insumos_catalogo_bk_attrs_YYYYMMDD AS
   SELECT id, espesor_mm, familia FROM insumos_catalogo;
   ```
2. Aplicar `backfill.sql` dentro de una transacción; verificar los conteos esperados.
3. **Postcheck:** correr la suite (`npm run verify`) y un costeo real de una vitrina con cristal
   para confirmar que el proponedor y el motor mejoran, sin regresiones.

## Rollback
```sql
UPDATE insumos_catalogo c SET espesor_mm = b.espesor_mm, familia = b.familia
FROM insumos_catalogo_bk_attrs_YYYYMMDD b WHERE b.id = c.id;
```

## Nota
El proponedor de alternativas (`src/datos/alternativasCatalogo.js`) YA funciona sin este
backfill (lee el espesor del nombre en tiempo real). Este paquete mejora la CONFIABILIDAD y
otros caminos del motor que leen `familia`/`espesor_mm`, y deja el dato honesto.
`calibre` (acero/PTR) queda como siguiente paso (misma técnica).
