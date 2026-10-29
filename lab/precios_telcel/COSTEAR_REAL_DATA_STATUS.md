# COSTEAR_REAL_DATA_STATUS — verdad industrial / TELCEL

Actualizado por auditoría independiente sobre la rama `claude/costing-app-architecture-psf02g`.

## Resumen ejecutivo

COSTEAR ya demostró una cosa muy importante: **el motor matemático reproduce el costo de materiales de cuatro módulos TELCEL reales cuando recibe el BOM, consumo y precios históricos correctos**.

Evidencia ejecutada en CI:
- workflow run: `40757080279`
- job `verify`: PASS
- `src/motor/telcelCCO320R.golden.test.js`: **5/5 PASS**
- Vitrina Horizontal METAL: **$4,483.13**
- Vitrina Torre METAL: **$2,966.15**
- Vitrina Isla METAL: **$3,297.84**
- Módulo de Almacenamiento METAL: **$3,596.14**
- tolerancia: `<= $0.05`, igual al golden Intelisis.

Esto certifica **aritmética de materiales con entrada correcta**. NO certifica todavía:
- que VONI/PDF/texto produzca siempre el BOM correcto;
- MO/GIF TELCEL;
- que todos los precios históricos sean vigentes hoy;
- que el catálogo productivo tenga todos los SKUs/opciones/unidades.

## Pipeline objetivo

`PDF / foto / texto / manual`
→ interpretación con procedencia
→ intención estructurada
→ BOM canónico
→ consumos deterministas
→ identidad exacta Artículo + Opción + unidad
→ precio real con fuente/fecha
→ motor
→ servidor
→ estado CERTIFICADO / PRELIMINAR / BLOQUEADO.

La IA interpreta; **no es autoridad económica**.

## TELCEL · datos reales disponibles

Fuentes congeladas:
- `lab/precios_telcel/*_explo_x_id.csv`: BOM/consumos del proyecto.
- `lab/precios_telcel/*_cata_mp.csv`: catálogo histórico MP con precio/unidad/fecha.
- `lab/precios_telcel/*_tabla_de_comparación_.csv`: targets reales de fábrica.
- TELSVH120: hoja de manufactura real extraída en la misma carpeta.

### Cobertura

`TELCEL_LOAD_PLAN.md`:
- 58 brechas estructuradas revisadas.
- **49 AUTO_CARGABLE** por coincidencia exacta Artículo+Opción, precio positivo y unidad usable.
- **9 NECESITA_HUMANO**.
- AUTO_CARGABLE significa utilizable como referencia histórica, **NO certificado**.

`TELCEL_DRIFT.md`:
- cuatro METAL históricos: **$14,343.26**
- cobertura con identidad/precio actual exactos: **84.71%**
- tramo comparable: histórico $12,150.00 → conocido $12,018.00 (**-1.09%**)
- faltante para comparación completa: **15.29%**.

## 9 datos que requieren Compras

Ver `TELCEL_COMPRAS_REQUEST.md`.

1. `MVLQPP00000000` sin opción — confirmar opción correcta.
2. `MPMTLA01030601` — SKU/unidad.
3. `LN1838` — SKU/unidad.
4. `LN2038` — SKU/unidad.
5. `MVLEPL0408C8A6` — identidad/unidad existen; falta precio usable.
6. `BUJES` — SKU/unidad.
7. `CILINCHAPITAS` — SKU/unidad.
8. `CERRPALETA` — SKU/unidad.
9. `JALEMBUTIR` — SKU/unidad.

Además hay una línea METAL de almacenamiento sin Artículo cuya descripción dice LN1838 y una cubierta MDF/PVC sin Artículo. No se vinculan por parecido sin confirmación.

## Cómo entran precios reales sin contaminar producción

El flujo implementado para workbook de proyecto:
- lee `explo_x_id` + `cata_mp`;
- cruza identidad exacta;
- conserva Artículo, Opción, clave, unidad, precio, fecha y documento;
- deduplica;
- muestra sin clave/unidad/fecha/costo antes de cargar;
- fuerza `requiere_validacion_compras=true`;
- el precio histórico queda `propuesto_validado`;
- **nunca se autocertifica** por venir de un proyecto;
- Compras/Dirección debe revalidar explícitamente.

Paquete preparado, NO aplicado a producción:
- `TELCEL_LOAD_READY.sql`
- `TELCEL_LOAD_RUNBOOK.md`
- migración propuesta `PROPUESTA_20261026_workbook_proyecto_preliminar.sql`.

## Bugs TELCEL de la corrida por texto

Ya existen regresiones/fixes en la rama para:
- PTR no puede convertirse en Escuadra.
- niveladores de regla de casa son idempotentes.
- kg/consumo físico no se convierte en “cantidad de estructuras”.
- copy distingue fuente texto/imagen.
- evidencia narrativa IA se separa del consumo económico.

## P1 que quedan

### P1-A · Input → BOM real
El golden empieza DESPUÉS de tener el BOM correcto. Falta medir PDF/foto/texto contra muebles reales:
- componentes críticos;
- cantidades;
- medidas;
- materiales;
- procesos;
- inclusiones/exclusiones.

Objetivos:
- false certified = 0;
- wrong-family certified = 0;
- critical component recall >=95% en familias conocidas;
- incertidumbre → pregunta/bloqueo.

### P1-B · MO/GIF TELCEL
Materiales 4/4 cerrados. MO/GIF sólo se validan si encontramos horas/centros/tarifas estructuradas. No derivar porcentajes por conveniencia.

### P1-C · Compras / frescura
49 entradas pueden precargarse como referencia. Los precios antiguos requieren revalidación antes de ser oficiales.

### P1-D · Release
La rama contiene cambios de más módulos además de COSTEAR. No promoverla completa sin aislar/certificar el conjunto exacto.

## Veredicto

- `TELCEL_MATERIAL_ENGINE_PARITY = PASS (4/4)`
- `TELCEL_WORKBOOK_IMPORT = IMPLEMENTED`
- `TELCEL_PRELIM_AUTOLOAD = 49`
- `TELCEL_HUMAN_DATA_GAPS = 9`
- `TELCEL_PROD_LOAD = NOT_APPLIED`
- `TELCEL_MO_GIF_PARITY = OPEN`
- `INPUT_TO_BOM_CERTIFICATION = OPEN`
- `PROD_RELEASE = NO_GO`

La siguiente mejora de mayor valor es endurecer **PDF/texto → BOM canónico** usando TELSVH120 y nuevos muebles reales como goldens de estructura.
