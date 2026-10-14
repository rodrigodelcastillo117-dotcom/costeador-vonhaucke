# Decisiones que necesita Costear · 2026-10-13

Datos de solo lectura (producción) y de los REPORTES DEL COTIZADOR Intelisis del 12/08/2026 (`lab/applt/componentes`).
Cada punto dice quién firma.

## Registro de firmas (agregado 2026-10-14 tras la auditoría externa, hallazgo P1-04)

El documento original decía "pendiente" y no se actualizó cuando Dirección firmó: el código y el commit be8e419 decían
"firmado" y este archivo no. Estado real:

| Decisión | Dirección | Producción / Compras | Implementado (sólo RC) |
|---|---|---|---|
| D1 · vigencia ERP 24 m | **Pendiente** | Compras: pendiente | No (`vh147` sin aplicar) |
| D2 · tubular por fracción + merma de corte | **Firmada** 2026-10-13 por Rodrigo del Castillo (Dirección): *"firmo D2 fracción y D3 tornillería por BOM"*. **Merma y ratificación** 2026-10-14, también por Rodrigo: *"SI AUTORIZO, TRATA TU DE CALCULAR LO MAS EXACTO QUE PUEDAS"* y *"mi autorizacion de la merma sustituye la ratificacion de produccion"* | **Cerrada por Dirección** (sustituye a Producción): merma 6.94 % (ver abajo) | Sí, motor `2026-10-14b` (`MERMA_TUBULAR_D2`, `D2_RATIFICADA_POR_PRODUCCION = true`) |
| D3 · tornillería por BOM; juego genérico nunca valida | **Firmada** 2026-10-13 (misma frase) | Producción: **pendiente** la tabla de tornillería por unión | Sí (`TORNILLERIA_GENERICA` → PRELIMINAR) |

Consecuencia: con sólo la firma de Dirección, D2 y D3 pueden usarse para calcular, pero mientras Producción no ratifique
la merma de corte y la tabla por unión, ningún costo con tubular o tornillería genérica debe presentarse como VALIDADO.
La firma de Dirección quedó en el chat de la sesión, no en un documento firmado; si se requiere evidencia formal, falta
que Dirección la deje por escrito (correo o este archivo con su visto bueno).

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

### D2 · Merma de corte del tubular: 6.94 % (14-oct-2026)

| Pata (Intelisis) | Fracción de la pieza de 6 m | Consumo | Neto (2×720 + ancho) | Merma |
|---|---|---|---|---|
| ATPU2M | 0.361 | 2,166 mm | 2,040 mm | 6.2 % |
| ATPU75M | 0.393 | 2,358 mm | 2,190 mm | 7.7 % |
| ATPU3M | 0.417 | 2,502 mm | 2,340 mm | 6.9 % |
| **Ponderada** | | 7,026 mm | 6,570 mm | **6.94 %** |

- **Supuesto:** pata U = dos patas de 720 mm + travesaño del ancho. Si el despiece real de Producción es otro, la merma cambia.
- **Regla del motor:** se aplica a todo tubular de **acero** por fracción, incluidos los curados, cuya ficha decía 5 % o 6 % sin documento. Impacto en la matriz golden: de +0.03 % a +0.98 % del costo.
- **No aplica** a conduit, cobre, poliflex, PVC ni aluminio.
- **Tope D2 desactivado:** los costos con tubular ya pueden salir certificados. El mecanismo sigue probado con `d2Ratificada: false`.

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
