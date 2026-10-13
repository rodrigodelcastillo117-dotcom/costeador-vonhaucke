# Decisiones que necesita Costear · 2026-10-13

Datos de solo lectura (producción) y de los REPORTES DEL COTIZADOR Intelisis del 12/08/2026 (`lab/applt/componentes`).
Nada de esto está aplicado: cada punto dice quién firma.

## D1 · Vigencia ERP de 24 meses (firma: Dirección + Compras)

| | Artículos ERP |
|---|---|
| Total en el catálogo | 10,964 |
| Última compra en los últimos 24 meses | **1,660** |
| Última compra hace más de 24 meses | 9,304 |
| Marcados "aprobado" hoy | 1,660 (los mismos 1,660), **aprobados por la cuenta qa-direccion** |

Hay que distinguir dos aprobaciones:
- **Aprobación de vigencia:** que el precio sea la última compra real y tenga ≤ 24 meses. Es una regla, y la política
  V1 ya está escrita (`PROPUESTA_vh147_elegibilidad_erp.sql`, `ERP_ULTIMA_COMPRA_V1`, 24 meses, versionada y append-only).
- **Aprobación del importe:** que Dirección acepte ese importe como costo oficial.

**Propuesta:** Dirección firma UNA vez la política V1 ("la última compra Intelisis ≤ 24 meses, con documento fuente, es
precio validado") en lugar de aprobar 1,660 precios uno por uno. Requiere aplicar vh147 en producción (autorización aparte)
y que el servidor acepte "aprobado por política firmada" como aprobación humana. Hoy, sin esa firma, la app los muestra
como PRELIMINAR (correcto: los aprobó la cuenta de prueba).
Los 103 precios **curados** aprobados por la cuenta QA no son ERP: requieren aprobación individual o sustituirse por su
gemelo ERP.

## D2 · Tubular por fracción de tramo o por tramo entero (firma: Producción + Dirección)

Hoy el motor cobra el **tramo entero de 6 m** por mueble. El cotizador Intelisis cobra la **fracción** (p. ej. ATPU2M
0.361 de pieza de 6 m). Producción (Rogelio) dijo "tramos de 6 m", que es la unidad de **compra**; no dijo cómo cobrar.

| Pata (Intelisis) | Lote | Consumo | Fracción | Tramo entero | Diferencia |
|---|---|---|---|---|---|
| ATPU2M | 1 | 2.17 m | $138.36 | $383.28 | +177 % |
| ATPU2M | 10 | 21.66 m | $1,383.64 | $1,533.12 | +11 % |
| ATPU75M | 1 | 2.36 m | $150.63 | $383.28 | +154 % |
| ATPU75M | 10 | 23.58 m | $1,506.29 | $1,533.12 | +2 % |
| ATPU3M | 1 | 2.50 m | $159.83 | $383.28 | +140 % |
| ATPU3M | 10 | 25.02 m | $1,598.28 | $1,916.40 | +20 % |

**Práctica de fábrica con evidencia:** el cotizador oficial cobra la fracción. **Propuesta:** fracción + merma de corte
documentada para costo unitario; tramo entero sólo cuando el lote es la compra completa (pedido especial). Mientras no se
firme, los muebles con tubular quedan PRELIMINAR con la nota "regla de tramo pendiente".

## D3 · Tornillería por BOM o por juego fijo (firma: Producción)

Hoy la app agrega "Tornillería" como juego aprobado de **$45** a cualquier mueble. Los 15 reportes Intelisis traen la
tornillería **por artículo y cantidad**:

| Componente | Piezas de tornillería | Importe |
|---|---|---|
| Cubiertas sencillas (ATCUBS44/45/46ABS) | 10 (4 rondanas, 4 pijas, 2 tornillos) | $3.50 |
| Cubiertas dobles (ATCUBD44/45/46ABS) | 20 | $7.00 |
| Omegas (ATOM3/4) | 8 pijas | $4.24 |
| Patas U (ATPU2M / 75M / 3M) | 18 / 26 / 26 | $6.46 / $9.30 / $9.30 |
| Acometida ATACM | 4 | $7.48 |
| Faldones (ATFAL12/150ABS) | 17 (incluye 2 tornillos perilla de $55.80) | $121.70 |
| Biombo ATBIOCRT5 | 4 pijas | $0.84 |

**Propuesta de regla (sin cantidades inventadas):**
1. Producto con BOM Intelisis → su tornillería tal cual (artículo y cantidad).
2. Mueble especial → tornillería por **tipo de unión** contada en el despiece (p. ej. pijas por bisagra, por corredera,
   por placa de fijación), con una tabla que Producción debe dar y firmar. Hasta entonces el renglón "Tornillería"
   queda **SUPUESTO** (preliminar) y nunca cuenta para costo validado.
3. El juego fijo de $45 se retira como default; queda sólo si Producción lo ratifica para alguna familia.

## Lo que no depende de estas decisiones
Tableros por hoja con rejilla/regla de Producción, cantos, cristal por m², lámina por fracción de hoja y pintura por
área ya se costean con reglas que tienen evidencia; sus precios siguen la decisión D1.
