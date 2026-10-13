# APP LT — extracción de los dos libros de Dirección (2026-10-13)

Fuentes (Google Drive, solo lectura):

| Libro | fileId | Modificado |
|---|---|---|
| `Coste APP LT 20261002.xlsx` | 16dlIf3OnYo-14ivaC_demHa0_onoQdwN | 2026-10-13 12:47 UTC |
| `Ejemplo 01 - Modulo en Pedido 38247 - TATO63612AB001 REV20261007.xlsx` | 1AquvyHzOZwqdURHNyzaZL2zADso3aRXM | 2026-10-13 12:47 UTC |

Los dos .xlsx se bajaron completos y se leyeron con openpyxl: los valores cacheados y las fórmulas, de todas las hojas (también las ocultas). El extractor no escribió nada en Drive.

Archivos de esta carpeta:
- `ejemplo01_TATO63612AB001.json`: el pedido 38247 completo (todas las hojas y bloques; cada renglón trae `_fila` = fila de Excel y `_formulas` cuando la celda es fórmula).
- `coste_applt_20261002.json`: el libro de coste completo, salvo que de la hoja oculta Compras solo van las 827 filas de los materiales del módulo más el último costo por artículo+opción de los 932 artículos (1,097 combinaciones). Las 4,378 filas no se copiaron.
- Los campos que calculamos nosotros están marcados como `*_derivado*` o con `derivado: true`. Todo lo demás se transcribe tal cual del libro.

---

## A. Estructura de cada libro

### A1. Ejemplo 01: Pedido 38247 (cliente CL07950 ENVIA FONDOS, proyecto A-2512029-001, presupuesto 226010001, plano 2512029)

| Hoja | Qué contiene | Unidades / dinero |
|---|---|---|
| **Pedido** | Reporte "PEDIDO SISTEMA" (formato ESP-DCC-IDP-007, impreso 2026-10-05). Cabecera: cliente, dirección, agente EDGAR SERNA PAGES, una fecha (2026-01-09), proyecto, presupuesto y plano. Partidas: Artículo · Es componente de · Tipo (Modulo/Componente/Normal) · Opción · Línea · Área · Descripción (+ renglón de acabado) · Cantidad requerida · Cantidad pendiente · Importe. Totales: subtotal 52,980.00, IVA 8,476.80, total 61,456.80. **COSTO TOTAL REAL** K28 = 38,195.77 (fórmula a PPyPTiempo), Dif. 14,784.23 (28%). | El importe está en pesos. La unidad no se imprime (son piezas). El módulo **no trae importe propio**: vale la suma de sus componentes. |
| **MaterialSolicitado** | 4 bloques. (1) SOLICITADO f1-28: requisición de MP (Material, Descripción, Opción, Cantidad, Unidad, División, Almacén, Situación, Costo Unitario, Costo MP). (2) PLANEADO f32-60: explosión del ERP (Cantidad × ArtCostoPromedio, Tiempo Entrega, ArtPesoKg). (3) CONSUMIDO f65-107: consumos reales por **sub-artículo destino** (ATPU4M-ES, ATCUBD44ABS-CCU…), con Costo e Importe. (4) Tabla dinámica f114-133. | Hoja, m, pieza, Kg. MP: solicitada 19,902.30 · planeada 20,028.57 · consumida 7,679.35 (biombo) + 10,442.63 (módulos) = 18,121.98. |
| **EntradaProd.para obtener tiempo** | Entradas de Producción del ERP: artículo, ruta, centro, almacén, cantidad, Costo Unitario/Total (MN) y fechas. **Incluye artículos de otras órdenes del presupuesto** (ATPU2M-ES, sillas GAMMA-E, PME*/PMV*). | $ MN |
| **Fabricado Tiempo** | 3 bloques. (1) f1-35, tabla "Tabla14": órdenes con ruta, hasta 5 avances (centro + horas/pieza) y horas por área (MO Procesos Metal, Pintura, Acabados, Carpintería, Tapicería, Acrílicos, Sillería, ENTRE). (2) f39-76: Entradas de Producción con Costo, **Mano Obra** e **Indirectos** en $ (tarifa estándar del ERP) y "Tiempo". (3) f81-117: horas estándar prorrateadas reportadas por área, con **tarifa $/h MO e IND "real"**. | Bloques 1 y 3 en horas. Bloques 2 y 3 en $. |
| **PPyPTiempo** | Cruce por sub-artículo: cantidades (solicitado / fabricado / reportado), horas por área (PM, PINTURA, ACABADOS, CARPINTERÍA) y Costo Total MO, IND y total. X37 = 9,060.37 y Y37 = 29,135.40 alimentan Pedido!K28. | horas y $ |
| **VH Detalle Costo Real Materia P** (oculta) | Reporte ERP "Detalle del Costo Real de Materia Prima" (2026-10-05) por familia: acero (cantidad sin costo), cristales, herraje, maderas, pinturas, sillería y sistema de unión. Total 55,395.34. **Incluye 18 sillas (39,921.82) que no son APP LT.** | $ MN |

Tarifas $/h del pedido:

| Área | ERP estándar (dentro de Costo de Entrada) MO / IND | "Real" reportada (bloque 3, PPyPTiempo) MO / IND |
|---|---|---|
| Carpintería (Madera) | 54.55 / 190.82 | **82.61 / 252.06** |
| Acabados | 56.34 / 193.59 | **74.99 / 228.82** |
| Pintura | 394.35 / 1,796.61 | **371.30 / 3,930.56** |
| Procesos metal ("Otros" en el cotizador) | 61.98 / 234.39 | **92.38 / 281.87** |
| Entregas (ENTRE) | 0 (las rutas REN no generan MO) | no reportada |

Las tarifas estándar no vienen escritas en el libro: salen de dividir Mano Obra/Indirectos entre "Tiempo" en el bloque 2 de Fabricado Tiempo. Son iguales a `APPLT_RATES` del repo.

**Comprobado al centavo:** el Costo Total de cada Entrada de Producción = MP consumida + MO std + IND std + costo de los sub-ensambles consumidos. Por ejemplo, ATPU75M-ES: 1,324.23 + 558.27 + 2,111.20 = 3,993.70. Las cadenas ES→ESPI→ESPA→PT de patas, omega, riel, acometida y placa cuadran (ver `verificacion_rollup_costo_erp`). Lo que no se puede cerrar: ATCUBD44ABS-CCU deja 651.46 sin explicar, y faltan las entradas y el consumo de lámina de los sub-ensambles de Procesos Metal (ATRICDB4-ES, ATOM3-CUPM, ATACM-CU/PUPM, PMT*/PME*). Coincide con la nota del libro "Costo reducido por utilización de material sobrante en área Procesos Metal".

### A2. Coste APP LT 20261002

| Hoja | Qué contiene | Unidades |
|---|---|---|
| **ComponentesModulo** | TATO63612AB001 (= TATO63612ABS001) con su BOM **por módulo**: ATPU4M ×2, ATPU75M ×2, ATACM ×1, ATCUBD44ABS ×3, ATOM3 ×6, ATRICDB4 ×3, CIEPLA01300778 ×4 (21 pzas). | pieza |
| **Materiales** | Explosión de MP **de 1 módulo** (20 renglones). Columnas: Material, Descripción, Unidad, **Sub Cuenta (= opción de acabado del costo)**, Almacén, Cantidad, Proveedor, Último Costo, Fecha, **Moneda**, Entrada Compra, Unidad Compra, Validación. Las cantidades × 3 dan exactamente lo "planeado" del Ejemplo 01. **No calcula total.** | Hoja, m, pieza, Kg. Pesos, salvo la pintura (Dólares). |
| **Fabricar componentes** | Para cada artículo y sub-artículo (32 renglones): cantidad por módulo, ruta, avances (centro + horas/pieza) y horas por área por módulo. Totales/módulo: **Procesos Metal 12.776 h, Pintura 0.1331, Acabados 2.002, Carpintería 4.2204, Entregas 1.15**. No trae $/h. | horas |
| **Compras** (oculta) | Todas las Entradas de Compra del ERP del 2026-01-06 al 2026-10-02 (4,378 filas, 932 artículos, todas las líneas). Columnas: movimiento, fecha, artículo, opción/desc opción, cantidad, unidades, costo unitario, totales neto/MN, proveedor. Descuentos siempre 0. | MN y USD (en USD, Costo Total Neto ≠ Costo Total Neto (MN), TC implícito por fila). |

El libro de coste **no trae** precios de venta, márgenes, gastos de operación, tarifas de MO/IND ni costo total del módulo.

---

## B. Números clave (aritmética sobre los datos; no son datos nuevos)

- **Precio por módulo sin biombo = 12,380** = 2×770 (ATPU4M) + 2×890 (ATPU75M) + 6×200 (ATOM3) + 3×1,890 (ATCUBD44ABS) + 3×640 (ATRICDB4) + 1×270 (ATACM) + 4×0 (CIEPLA01300778). Por 3 módulos = 37,140. Biombo ATBIOCRS4: 1,760 c/u × 9 = 15,840. **Con biombos: 17,660 por módulo.**
- **Costo ERP (Entrada de PT) por módulo = 9,664.92**: 2×1,005.4857 + 2×785.2012 + 6×71.1677 + 3×1,277.444 + 3×459.3264 + 319.3834 + 4×31.7102. Por 3 módulos = 28,994.75. Biombos: 9×915.7441 = 8,241.70. Total del pedido 37,236.44.
- El "COSTO TOTAL REAL" del libro (38,195.77) es **solo MO + IND a tarifa real**. **No suma MP.** Si se le suma la MP consumida (18,121.98), el total sería 56,317.75, mayor que la venta (52,980). No sabemos si la omisión es intencional (por ejemplo, que la MP ya vaya en otro lado). **Hay que preguntarlo.**
- MP por módulo a último costo del libro de coste (solo renglones en pesos, acabado B744/C744): 3,679.15 más 1.135 kg de pintura a 6.23 USD/kg (el libro no da tipo de cambio).

---

## C. Ambigüedades / advertencias

1. **El libro de coste está costeado en otro acabado.** Las Sub Cuentas son B744/C744 (FROSTY WHITE) y A112 (BLACK TX), no el A118/B770/C770 del pedido. La melamina 28 mm cuesta 842 (B744) contra 1,075 (B770), y la pintura 6.23 USD (A112) contra 9.90 USD (A118). Compras trae el costo por opción, así que se puede re-costear por acabado.
2. Pedido D4: el rótulo dice "TIPO / FECHA EMISIÓN / FECHA REGISTRO", pero hay un solo valor (2026-01-09 09:00).
3. PPyPTiempo O17/O21 (horas fabricado PINTURA de ATPU4M-ES/ATPU75M-ES) repiten el valor de PM. Parece un error de VLOOKUP en el libro.
4. EntradaProd, Fabricado Tiempo (bloque 2) y la hoja VH incluyen artículos de otros pedidos del mismo presupuesto (ATPU2M-ES, sillas, PME*).
5. La relación de los sub-artículos P* (PITPLA/PMTPLA = placas tope, PITTAP/PMTTAP = tapas registrables → ATCUBD44ABS; PIEPLA/PMEPLA → CIEPLA01300778) se dedujo de su descripción y de "Fabricar componentes". No viene explícita.
6. Las horas ENTRE (1.15 h/módulo) no tienen tarifa ni costo en ningún lado.
7. El biombo va en partida separada (tipo Normal, área BIOMBOS) aunque el módulo dice "SIN BIOMBO". Es ATBIOCRS4 (cristal **satinado**), no ATBIOCRT4.

---

## D. Comparación con el repo

| Tema | Repo hoy | Estos archivos |
|---|---|---|
| Clave del módulo TATO63612AB001 | **No existe.** Hay hermanos en `banco.js`/`preciosVenta.js` (TATO63612ABCRT01, lista 17,600; TATO84812ABCT01). | 12,380 sin biombo / 17,660 con 3 biombos ATBIOCRS4. |
| Precios lista de componentes (`preciosLinea.js`, campo `l`) | ATPU4M 770, ATPU75M 890, ATOM3 200, ATCUBD44ABS 1,890, ATRICDB4 640, ATACM 270 | **Iguales** a los del pedido. **ATBIOCRS4: 1,640 en el repo contra 1,760 en el pedido.** CIEPLA01300778 / QCIPLAUES no está en `preciosLinea` (va a $0 en el pedido). |
| Reglas de armado banca doble 1200, 6u (`applt.js`) | 3 cubiertas ATCUBD44ABS ✓ · patas ATPU4M ×4 ✗ · omega ATOMCU3 ×3 ✗ · riel ATRICDB4 ×3 ✓ · sin ATACM · sin placas unión | Patas 2×ATPU4M + 2×ATPU75M · omega **ATOM3 ×6** · **ATACM ×1** dentro del módulo · **CIEPLA01300778 ×4** |
| Horas por centro (`HORAS_CLAVE`) | ATCUBD44ABS, ATPU75M, ATOM3 y ATACM son **idénticas**. ATPU4M y ATRICDB4 se estiman con fórmula. Generador: metal 10.04 h, acab 1.374, pint 0.087, carp 4.2204 | ATPU4M y ATRICDB4 reales. Módulo: metal 12.776, acab 2.002, pint 0.1331, carp 4.2204 ✓, ENTRE 1.15 |
| Tarifas MO/IND | `APPLT_RATES` = tarifa estándar ERP (54.55/190.82…) | Lo mismo, más una tarifa "real" distinta (82.61/252.06, 74.99/228.82, 371.30/3,930.56, 92.38/281.87) que el repo **no tiene** |
| Despiece de MP | Fixture `intelisis_alba_2026-08-12.json` trae BOM del cotizador ERP de ATPU75M, ATOM3, ATCUBD44ABS y ATACM. El generador usa proxies (`ptr` 1×2 cal 16 por metro, canto "aluminio", melamina por área). | BOM por módulo exacto (láminas cal 10/12/14/18/20, tubular 1½×3 y 1×2 cal 18, PEABS32, CH32PVC, tornillería). Consumos reales de ATPU4M/ATPU75M. No hay BOM por componente de ATPU4M, ATRICDB4 ni CIEPLA. |
| Costos de MP | `mp_erp_ultima_compra.csv` y fixture (hasta agosto 2026, sin opción de acabado) | Compras al 2026-10-02 **por opción de acabado** (22 colores de melamina, 11 de pintura, 16 de canto ABS…) |
| Costo real del pedido / venta | No existe un golden de pedido real APP LT | Pedido 38247: venta, costo ERP por componente, MP consumida y MO/IND reales |

---

## E. Lo que falta para…

**(1) Costear un módulo desde cero y cuadrar al centavo con el ERP**
- Con estos archivos se puede cuadrar el **costo de entrada ERP** de patas, omega, riel, acometida y placa (MP consumida + MO/IND std + hijos).
- Falta:
  - Las Entradas de Producción y consumos de lámina de los sub-ensambles de Procesos Metal (ATRICDB4-ES, ATOM3-CUPM, ATACM-CU/PUPM, PMTPLA*, PMTTAP*, PMEPLA*).
  - La explicación de los 651.46 en ATCUBD44ABS-CCU.
  - El tipo de cambio que usa el ERP para la pintura.
  - Una definición de qué costo es "el real": ERP std, MO+IND real (sin MP) o MO+IND real + MP.
  - Las reglas de costeo de MP (costo promedio contra último costo contra consumo real con sobrantes).

**(2) Cotizar un pedido como el Ejemplo 01**
- Casi listo: el pedido se cotiza a Precio Lista `l` de `preciosLinea` por componente.
- Falta:
  - Actualizar ATBIOCRS4 (1,760 contra 1,640) y confirmar qué lista está vigente.
  - Dar de alta CIEPLA01300778 a $0.
  - Agregar la partida TATO63612AB001 como suma de componentes y el biombo como partida separada.
  - Reglas de descuento: este pedido no tiene.

**(3) Cocrear variantes (8 usuarios, otra medida, otro acabado) con BOM real**
- Falta:
  - La regla de patas extremos/intermedias (¿ATPU4M en extremos y ATPU75M en intermedias?).
  - Cuántas ATOM3 van por cubierta (aquí 2).
  - Cuántas placas unión por módulo (aquí 4) y cómo escalan con n.
  - ¿El ATACM es 1 por módulo?
  - BOM y horas de ATCUBD45/46, ATRICDB5/6, ATOM4…, ATPU5M/6M (solo hay datos para la medida 1200).
  - La matriz clave↔acabado (opción A/B/C) para cotizar otros colores.
- Un solo ejemplo (6u, 1200) **no basta** para inferir las reglas de 8u u otras medidas. Hace falta la guía ESP-DCC-IDP-003 o más pedidos reales (por ejemplo, un TATO84812…).
