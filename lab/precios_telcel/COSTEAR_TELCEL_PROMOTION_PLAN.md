# COSTEAR_TELCEL_PROMOTION_PLAN

## Objetivo

Promover únicamente el trabajo de COSTEAR/datos reales validado en esta rama, sin arrastrar los cambios no relacionados acumulados en `claude/costing-app-architecture-psf02g`.

**NO ejecutar este plan automáticamente en producción.** Es una guía de aislamiento y certificación.

## Bloque A · errores reales vistos en la corrida TELCEL por texto

Orden histórico recomendado para conservar dependencias:

1. `e536d20` — kg de lámina no se interpreta como cantidad estructural.
   - `src/datos/mapIaComps.js`
   - regresión `mapIaComps.resiliencia.test.js`

2. `eab2add` — consumo físico no infla StructuralGraph + copy respeta fuente.
   - `AsistenteEspecial.jsx`
   - `structuralGraph.js`
   - regresiones.

3. `6920cfd` — PTR nunca se resuelve como Escuadra + niveladores idempotentes.
   - `materialMatch.js`
   - `autoInsumos.test.js`
   - `materialMatch.test.js`

4. `148cd73` — separa evidencia narrativa IA de consumo económico real.
   - `AsistenteEspecial.jsx`

5. `14f21d2` — regresión de copy/paridad UX para el cambio anterior.

### Gate A

Antes de promover:
- PTR solicitado + sólo Escuadra disponible → queda pendiente, nunca autocosteado.
- niveladores existentes + regla de casa → una sola línea.
- 45 kg de lámina → 1 estructura, no “estructura ×45”.
- fuente texto → no muestra “la imagen no trae escala”.
- narrativa de consumo ≠ autoridad económica.

## Bloque B · workbook real de proyecto → datos preliminares trazables

Conservar orden de dependencia:

1. `69db941` — lector de workbooks reales + `erpProyecto.js`.
2. `92b60c1` — CargaERP acepta `explo_x_id + cata_mp`.
3. `b3106a0` — prueba de integración de UI/import.
4. `4c4ab41` — muestra brechas de unidad/fecha/costo antes de cargar.
5. `d2d0bdd` — pruebas de brechas visibles.
6. `bd63f11` — workbook de proyecto nunca autocertifica.
7. `d5acfad` — marca revalidación obligatoria.
8. `c7f2b9d` — regresión “proyecto histórico no autocertifica”.
9. `c09abf5` — prueba revalidación obligatoria.
10. `728ac8a` — métricas de claves recuperadas/sinClave por registro único.
11. `9a98997` — reporte directo estándar de Intelisis NO queda bloqueado como workbook de proyecto.

### Gate B

- workbook TELCEL: `esWorkbookProyecto=true`.
- reporte estándar “Última Compra”: `esWorkbookProyecto=false`.
- ningún dato sin unidad/fecha/costo se inventa.
- Artículo+Opción exactos preservados.
- carga requiere acción explícita de Dirección.
- precio de workbook de proyecto → `requiere_validacion_compras=true`.
- no hay autocertificación por frescura.

## Bloque C · candado DB (sólo con autorización explícita)

Propuesta:
`supabase/migrations/PROPUESTA_20261026_workbook_proyecto_preliminar.sql`

No promover hasta:
- revisar SQL contra schema productivo actual;
- PGlite/DB tests verdes;
- Dirección autoriza migración;
- rollback preparado.

El candado debe garantizar que un precio histórico del proyecto puede existir como referencia, pero no convertirse en precio oficial sin revalidación de Compras.

## Bloque D · datos TELCEL

Ya preparados:
- `TELCEL_PARITY_GAP.md`
- `TELCEL_LOAD_PLAN.md`
- `TELCEL_LOAD_READY.sql`
- `TELCEL_LOAD_RUNBOOK.md`
- `TELCEL_DRIFT.md`
- `TELCEL_COMPRAS_REQUEST.md`
- `TELCEL_MO_GIF_GAP.md`
- `COSTEAR_REAL_DATA_STATUS.md`

### Estado

- golden motor materiales METAL: PASS 4/4.
- 49 identidades exactas técnicamente precargables como referencia preliminar.
- 9 requieren humano/Compras.
- carga productiva: NO aplicada.

## Bloque E · frescura visible

`9c2579d` agrega advertencia honesta de antigüedad de última compra al costeo.

Promover sólo si sus dependencias del servidor actual están presentes.

## Lo que NO pertenece a este paquete

No arrastrar por accidente:
- Acomodo;
- cambios de Cotizar;
- Cocrear no necesarios para COSTEAR;
- gates comerciales de reventa;
- backfills de catálogo no revisados;
- migraciones de seguridad no relacionadas;
- cambios de release/certificación generales.

## Estrategia recomendada

Crear rama limpia desde el SHA productivo vigente al momento de promoción y portar los bloques A/B/E de forma controlada, junto con sus tests. El Bloque C y la carga de datos requieren autorización independiente.

## Certificación mínima COSTEAR-only

1. unit dirigidos de A/B/E.
2. `telcelCCO320R.golden.test.js` → 5/5.
3. golden Intelisis → sin regresiones.
4. build.
5. E2E:
   - texto;
   - PDF;
   - manual;
   - guardar/reabrir;
   - convertir a partida;
   - workbook proyecto;
   - reporte ERP estándar.
6. ninguna mutación productiva durante la prueba.

## Release gate

`COSTEAR_TELCEL_PROMOTION_READY=true` sólo cuando:
- P0=0;
- P1 COSTEAR=0;
- golden TELCEL=PASS;
- golden Intelisis=PASS;
- workbook project fail-closed=PASS;
- PDF/text → BOM benchmark aceptable;
- SQL/data actions autorizadas por separado.
