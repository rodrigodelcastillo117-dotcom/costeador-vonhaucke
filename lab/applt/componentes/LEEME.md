# APP LT: explosión de MP y horas por COMPONENTE (cotizador Intelisis) · 2026-10-13

Fuente: los **15 "REPORTE DEL COTIZADOR DE PRECIOS"** (Intelisis, cotizados el 12/08/2026 entre 04:22 y 05:03 p. m.) de la carpeta de Drive *presupuestos cotizador vonhaucke* (`140tw99N0F8pfW6sCnMxx4TE66iTmsdLL`). Se leyeron con `read_file_content`, solo lectura; en Drive no se escribió nada y Supabase no se tocó. El script de extracción quedó fuera del repo, en el scratchpad de la sesión.

Cada `<CLAVE>.json` trae:
- `materiales`: un renglón por cada renglón del reporte, **por 1 pieza**. Si el reporte repite el artículo (la pintura y la lámina de las cubiertas vienen en 2 o 3 renglones, uno por sub-ensamble), se dejan separados. Cada renglón lleva `costo_reporte`, `fecha_costo`, `categoria_reporte` e `importe_derivado` (= cantidad × costo, lo calculamos nosotros).
- `opcionLetra`: A = pintura MVLQPP; B = melamina AME2848/AME1648; C = CH32PVC/PEABS32/PEABS22. Es la misma regla que la "Sub Cuenta" del libro Coste APP LT. Para AME1648 y PEABS22 se asignó por analogía. Lo demás va en `null`.
- `horas`: pm = centro **"Otros"** del cotizador, carpintería = "Madera". **El cotizador no reporta Entregas**, así que `entregas` = `null`. Una celda vacía en el reporte es `null`; en las piezas de metal equivale a 0.
- `costos_reporte`: MP por categoría, MO, GIF, `total` (= Total Costo de Fabricación) y el resto de la cascada del cotizador (GO 30 %, utilidad 20 %, incremento 200 %, precio lista), con las tarifas estándar del ERP (MO 61.98/394.35/56.34/54.55; GIF 234.39/1,796.61/193.59/190.82).
- `subarticulos` y `horas_otra_fuente`: **solo para los 4 componentes del 6U** (ATCUBD44ABS, ATPU75M, ATOM3, ATACM). Salen del libro *Coste APP LT 20261002* ("Fabricar componentes"), porque el cotizador no desglosa sub-ensambles.
- `verificacion_aritmetica`, `cruce_horas_clave_applt_js` y `cruce_fixture_intelisis_alba`.

## 1. Componentes encontrados (15)

| Clave | Descripción | fileId | Renglones MP | MP reporte | Horas pm / pint / acab / carp | Costo fabricación | Precio lista cotizador |
|---|---|---|---|---|---|---|---|
| ATACM | CONDUCTO ACOMETIDA DE 220 X 649 X 75 MM MODELO APPS LT CON | 1PcNaAwOPv2OvRMav_0yIDOtKxIgDf9-k | 7 | 83.73 | 0.5152 / 0.0099 / 0.108 / — | 285.11 | 1,335.00 |
| ATBIOCRT5 | BIOMBO DIVISOR DE 1400 X 400 X 32 mm MODELO APPS LT CON SO | 1SxlWw0LItf_MZV62RsnaFzu4bKL4u_LD | 3 | 801.15 | — / 0 / 0.3402 / — | 886.18 | 4,148.00 |
| ATCUBD44ABS | CUBIERTA CUADRADA DE 1200 X 1200 mm MODELO APPS LT PARA BA | 1hgnJzmFtQaQCkawd3BHhFnzRLC0ydPHi | 12 | 640.24 | 0.508 / 0.011 / 0.088 / 1.4068 | 1,182.08 | 5,533.00 |
| ATCUBD45ABS | CUBIERTA RECTANGULAR DE 1500 X 1200 mm MODELO APPS LT PARA | 1tqroLYTJyLKp4nXgRBLbR7h077c3IFSv | 12 | 1,163.28 | 0.508 / 0.011 / 0.088 / 1.4852 | 1,724.36 | 8,074.00 |
| ATCUBD46ABS | CUBIERTA RECTANGULAR DE 1800 X 1200 X 28MM MODELO APPS LT | 1VNZM6m8e9byU-olBdbQy0UDJeP0IGIkz | 12 | 1,172.88 | 0.508 / 0.011 / 0.088 / 1.2458 | 1,675.21 | 7,844.00 |
| ATCUBS44ABS | CUBIERTA RECTANGULAR DE 1200 X 600 X 28 mm MODELO APPS LT | 1LCHTzDbfsillcdlDWLQaVvXd8U1Iv0OB | 12 | 342.38 | 0.254 / 0.0055 / 0.044 / 0.8324 | 644.95 | 3,019.00 |
| ATCUBS45ABS | CUBIERTA RECTANGULAR DE 1500 X 600 X 28 MM MODELO APPS LT | 1t0jZ4ym4isoBD898hwTdV9278zwHyV-5 | 12 | 608.70 | 0.254 / 0.0055 / 0.044 / 0.9358 | 936.64 | 4,384.00 |
| ATCUBS46ABS | CUBIERTA RECTANGULAR DE 1800 X 600 mm MODELO APPS LT PARA | 1rzt3QX1-o75Y_d_HhG_s5rtdh33CyWRP | 12 | 618.29 | 0.254 / 0.0055 / 0.044 / — | 716.62 | 3,358.00 |
| ATFAL12ABS | CONDUCTO FALDON PARA ESCRITORIO DE 800 X 379 X 177 mm MODE | 1IRmxaHsfq36zAB2GQpS0ryFk4K3Vehej | 9 | 284.28 | 0.1198 / 0.0033 / 0.064 / 0.295 | 415.39 | 1,945.00 |
| ATFAL150ABS | CONDUCTO FALDON PARA ESCRITORIO DE 900 X 379 X 177 mm MODE | 1i6Xk2JW3_i0IBRVngR84opsWKHOwL9z9 | 9 | 322.92 | 0.1198 / 0.0033 / 0.036 / 0.4779 | 491.92 | 2,303.00 |
| ATOM3 | OMEGA PARA CUBIERTA DE 850 X 100 X 17 mm MODELO APPS LT CO | 1LokRjURdZe7UABVA5c07qcPgh4k-TVzi | 3 | 42.97 | 0.1116 / 0.0033 / 0.072 / — | 101.27 | 478.00 |
| ATOM4 | OMEGA PARA CUBIERTA DE 1150 X 100 X 17 mm MODELO APPS LT C | 1_5PUrPab9oVSnK_0mmrB_w3GDgJmHBRM | 3 | 68.35 | 0.1242 / 0.0033 / 0.096 / — | 136.38 | 639.00 |
| ATPU2M | PATA TIPO "U" DE 600 X 720 mm MODELO APPS LT; METALICA | 1g6i4e7Og5BYFR3WhZupdOoR-d4vVT8AG | 8 | 275.83 | 1.4078 / 0.0066 / 0.1434 / — | 743.36 | 3,483.00 |
| ATPU3M | PATA TIPO "U" DE 900 X 720 mm MODELO APPS LT; METALICA | 1mxuaicJy7mc5Vs6liwlDR8lSTWuoJ7Bf | 8 | 292.42 | 1.6628 / 0.0132 / 0.1668 / — | 855.83 | 4,006.00 |
| ATPU75M | PATA TIPO "U" DE 750 X 720 mm MODELO APPS LT; METALICA | 1swMEW1U-a3TGzdtVXTR3MMaX0IjHXWDJ | 8 | 282.54 | 1.5012 / 0.0099 / 0.1498 / — | 786.58 | 3,682.00 |

Uso: **banca doble** ATCUBD44/45/46ABS, ATPU75M, ATOM3/ATOM4, ATACM y ATBIOCRT5. **Banca sencilla** ATCUBS44/45/46ABS y ATPU2M. **Fuera de banca** (según la guía) ATPU3M (pata 900) y ATFAL12/150ABS (faldón de escritorio). Las de fuera de banca se extrajeron porque estaban en la misma carpeta.

## 2. Faltantes (no hay reporte de cotizador en Drive)

Se buscó por título y por texto completo (`ATPU4M`, `ATRICDB`, `ATRICDS`, `ATOM5`, `ATBIOABS`, `ATBIOCRS`, `CIEPLA01300778`, `QCIPLAUES`, "REPORTE DEL COTIZADOR", "COTIZADOR DE PRECIOS"). Solo aparecieron la guía GE_AppLT, los dos libros de Dirección y catálogos.

| Falta | Para qué | Qué hay hoy |
|---|---|---|
| **ATPU4M** (pata 1200) | doble, extremos (2 por módulo) | Horas reales en HORAS_CLAVE (PPyPTiempo) y consumo real del pedido 38247. **Sin BOM estándar.** |
| **ATRICDB4 / 5 / 6** (riel) | doble (c) | ATRICDB4: horas reales y consumo real parcial. 5 y 6: nada. |
| **CIEPLA01300778 / QCIPLAUES** (placa unión) | doble, 2(c−1) | Horas reales y consumo de pintura y tornillería. Sin lámina. |
| **ATOM5** (omega 1400) | 1800 doble y sencilla | nada |
| **ATBIOCRS4** (biombo satinado, el del pedido), **ATBIOCRT4 / 6**, **ATBIOABS4 / 5 / 6** | biombos | Solo ATBIOCRT5. ATBIOCRS4 tiene consumo real en el pedido (cristal, 2 soportes SOVROAD, 4 pijas PITR1 por pieza). |
| **ATRICDS4 / 5 / 6** (riel sencilla) | sencilla | nada |

## 3. Validaciones

- **Aritmética de cada reporte: 15/15 cuadran.** Se comprobaron:
  - MP por categoría = Σ cantidad × costo, con diferencias de ±0.02 porque el reporte imprime el costo redondeado (p. ej. pija PITR1 0.21 contra 0.2059 real).
  - MO y GIF = Σ horas × tarifa.
  - Fabricación = MP + MO + GIF.
- **Contra el fixture** `src/motor/fixtures/intelisis_alba_2026-08-12.json` (transcripción previa de los mismos PDF): 15/15 iguales en artículos, cantidades, costos, MP total y precio lista.
- **Contra `HORAS_CLAVE`** (`src/datos/applt.js`):
  - ATCUBD44ABS, ATPU75M, ATOM3 y ATACM **coinciden exacto**. ATCUBD45/46ABS, ATCUBS44/45ABS, ATPU2M/3M, ATOM4, ATFAL* y ATBIOCRT5 también.
  - **Única diferencia: ATCUBS46ABS.** El reporte trae **vacías las horas de Madera**: MO = 20.39 y GIF = 77.93 no incluyen carpintería. HORAS_CLAVE usa 1.039 "modelada", que no es dato del ERP.
- **Contra "Fabricar componentes"** (libro Coste APP LT): para los 4 componentes del 6U, la ruta propia más la suma de los sub-artículos da **exacto** las horas del cotizador en pm, pintura, acabados y carpintería.
  - Ese libro sí trae Entregas por pieza: ATPU75M 0.05, ATOM3 0.05, ATACM 0.075, ATCUBD44ABS 0.
  - Va en `horas_otra_fuente.entregas`.

## 4. Verificación: MP de los componentes contra la explosión del módulo 6U 1200 (TATO63612AB001)

BOM: 2 ATPU4M + 2 ATPU75M + 6 ATOM3 + 3 ATCUBD44ABS + 3 ATRICDB4 + 1 ATACM + 4 CIEPLA01300778. Módulo = `coste_applt_20261002.json › materiales_por_modulo`; los dos renglones de rondana 1/4" (72 + 24) se sumaron.

Como **ATPU4M, ATRICDB4 y CIEPLA no tienen reporte**, la verificación es: Σ(componentes con reporte × cantidad) contra el módulo. El **residuo** es lo que deben aportar 2 ATPU4M + 3 ATRICDB4 + 4 CIEPLA. Ese residuo se contrasta con el consumo real por sub-artículo del pedido 38247 (`ejemplo01…json › material.consumido`, 3 módulos).

| Artículo | Descripción | Unidad | Módulo | Componentes con reporte (× cantidad en el BOM) | Residuo | Atribución del residuo / evidencia |
|---|---|---|---|---|---|---|
| MIMCCPPL020001 | CINTURON DE PLASTICO DE 4.6 X 280 mm CODIGO 3 | pieza | 12 | — | 12 | ATRICDB4 4/pza ×3 = 12 ✓ (consumo real: 36 en 9 rieles) |
| MLESLA05261100 | LAMINA NEGRA HOJA 3 X 10 CALIBRE 10 -- LN10310 | Hoja | 0.154 | ATPU75M 0.062 | 0.092 | ATPU4M (única con cal 10 entre los faltantes, por analogía con ATPU2M/3M/75M) → 0.046/pza. Sin evidencia directa |
| MLEUTO12170002 | TORNILLO CABEZA BOTON ALLEN Ø 3/8" X 1" GALVA | pieza | 2 | ATACM 2 | ✓ exacto | — |
| MVLMAG01280800 | AGLOMERADO MELAMINA DOS CARAS HOJA 4 X 8 ESPES | Hoja | 1.5 | ATCUBD44ABS 1.5 | ✓ exacto | — |
| MVLMCC06060000 | CHAPACINTA PVC ANCHO 32 mm - "CH32PVC" | m | 7.116 | ATCUBD44ABS 7.116 | ✓ exacto | — |
| MVLPPC00501505 | PERFIL DE CANTO ANCHO 32 mm ESPESOR 2 mm EN A | m | 15.552 | ATCUBD44ABS 15.552 | ✓ exacto | — |
| MVLQPP00000000 | PINTURA EN POLVO - "PPH" | Kg | 1.135 | ATPU75M 0.168 + ATOM3 0.156 + ATCUBD44ABS 0.084 + ATACM 0.082 | 0.645 | 2×0.107 (ATPU4M-ESPI) + 3×0.137 (ATRICDB4-ESPI) + 4×0.005 (PIEPLA) = 0.645 ✓ exacto (consumo real ÷ piezas) |
| MVLSLA05260202 | LAMINA NEGRA HOJA 3 X 10 CALIBRE 14 ACERO 1008 | Hoja | 0.316 | ATPU75M 0.006 + ATOM3 0.252 + ATACM 0.006 | 0.052 | 0.052 entre ATPU4M (las patas traen 0.003), ATRICDB4 y/o placa unión. Sin evidencia |
| MVLSLA05260402 | LAMINA NEGRA HOJA 3 X 10 CALIBRE 18 ACERO 1008 | Hoja | 0.012 | ATCUBD44ABS 0.012 | ✓ exacto | — |
| MVLSLA05260502 | LAMINA NEGRA HOJA 3 X 10 CALIBRE 20 ACERO 1008 | Hoja | 0.93 | ATCUBD44ABS 0.126 + ATACM 0.132 | 0.672 | 0.672 cal 20: casi seguro ATRICDB4 (conducto de lámina) ≈ 0.224/pza. Sin evidencia directa |
| MVLSLA05261002 | LAMINA NEGRA HOJA 3' X 10' CALIBRE 12 ACERO 10 | Hoja | 0.012 | — | 0.012 | 0.012 cal 12: sin evidencia (¿placa unión 2 mm? ¿riel?) |
| MVLSTU03230401 | TUBULAR INDUSTRIAL RECTANGULAR 1" X 2" CALIBRE | pieza | 0.429 | — | 0.429 | 0.429 tubular 1×2: ATRICDB4 ("EN LAMINA Y TUBULAR") ≈ 0.143/pza. Sin evidencia directa |
| MVLSTU03310401 | TUBULAR INDUSTRIAL RECTANGULAR 1 1/2" X 3" C | pieza | 1.786 | ATPU75M 0.786 | 1 | ATPU4M 0.5/pza ×2 = 1.0 (consumo real 3 barras/6 = 0.5, pero en ATPU75M el consumo real también es 0.5 y el estándar 0.393: no prueba nada) |
| MVLUPI06650053 | PIJA CABEZA HEXAGONAL DE 3/8 " CON ARANDELA I | pieza | 144 | ATPU75M 24 + ATOM3 48 | 72 | ATRICDB4 8×3 = 24 + CIEPLA 4×4 = 16 (consumo real) → ATPU4M 32/2 = **16/pza** (el consumo real da 110/6 = 18.33: no cuadra) |
| MVLUPI10350002 | PIJA CABEZA FIJADORA PHILLIPS 10 X 15 mm GALV | pieza | 24 | ATCUBD44ABS 24 | ✓ exacto | — |
| MVLURO26522902 | RONDANA PLANA Ø 1/4" Ø 3/4" EXTERIOR GALVANIZA | pieza | 96 | ATPU75M 24 + ATCUBD44ABS 24 | 48 | CIEPLA 4×4 = 16 (consumo real) → ATPU4M 32/2 = **16/pza** (consumo real 110/6 = 18.33: no cuadra) |
| MVLURO26543002 | RONDANA PLANA Ø 3/8" Ø 1" EXTERIOR CALIBRE 12 | pieza | 2 | ATACM 2 | ✓ exacto | — |
| MVLUTO15188109 | TORNILLO NIVELADOR Ø 3/8" X 1 1/2" PLATAFORMA | pieza | 8 | ATPU75M 4 | 4 | ATPU4M 2/pza ×2 = 4 ✓ (consumo real ATPU4M-ESPA 12/6 = 2) |
| MVLUTO35644402 | TORNILLO CABEZA FILLSTER PHILLIPS Ø10 X 3/4" A | pieza | 12 | ATCUBD44ABS 12 | ✓ exacto | — |
| MVLUTU22540002 | TUERCA HEXAGONAL Ø 3/8" GALVANIZADO - "TU38 | pieza | 8 | ATPU75M 4 | 4 | ATPU4M 2/pza ×2 = 4 ✓ (consumo real ATPU4M-ES 12/6 = 2) |

**Resultado:**
- **Cuadran exacto los 8 artículos que solo vienen de componentes con reporte:** melamina, CH32PVC, PEABS32, lámina cal 18, pija fijadora, tornillo fillster, rondana 3/8" y tornillo Allen.
- **Ningún residuo es negativo:** ningún componente con reporte pide más de lo que trae el módulo.
- Los 12 residuos se atribuyen así:
  - **Con evidencia del consumo real del pedido** (cuadra exacto): cinturón CTPL280, pintura (0.645 kg), nivelador y tuerca 3/8".
  - **Consistentes, pero el consumo real no cuadra:** pija hexagonal y rondana 1/4" de ATPU4M. El estándar da 16 por pieza; el consumo real, 110/6 = 18.33. En ATPU75M el consumo sí es igual al estándar (12).
  - **Sin evidencia concluyente:** lámina cal 10, 12, 14 y 20, tubular 1×2 y tubular 1½×3. Los sub-ensambles de Procesos Metal de ATRICDB4, la placa unión y ATPU4M-ES no tienen consumo estándar en ningún libro.
- **Conclusión:**
  - Con los 15 reportes **no se puede armar la MP del 6U sumando componentes**: falta 100 % de la MP de ATPU4M, ATRICDB4 y CIEPLA, incluidos 0.672 hojas de cal 20 y 1.0 tubular 1½×3.
  - Sí se puede **por diferencia**: módulo − (los 4 con reporte) = 2 ATPU4M + 3 ATRICDB4 + 4 CIEPLA. Para separar esas tres claves y para las medidas 1500 y 1800 (ATRICDB5/6) hacen falta sus reportes de cotizador.

## 5. Ambigüedades y avisos

1. **Costos del cotizador ≠ costo oficial.**
   - El cotizador usa el último costo al 12/08/2026, **sin opción de acabado**: melamina 1,026.90, pintura 170.47 MN/kg.
   - Usa la tarifa estándar ERP de MO e IND.
   - La regla oficial (`src/datos/appltCosto.js`) es compra por opción + horas estándar × tarifa real. De estos JSON se deben tomar **cantidades y horas**; los costos solo sirven de referencia.
2. **El precio lista del cotizador** (factor 200 %: ATCUBD44ABS 5,533; ATPU75M 3,682; ATOM3 478; ATACM 1,335) **no es** el precio de lista del pedido ni el de `preciosLinea` (1,890 / 890 / 200 / 270). No usarlo como precio.
3. **ATCUBD46ABS** (1800×1200) tiene menos carpintería (1.2458 h) que ATCUBD45ABS (1.4852 h) y la misma hoja de melamina (1). Así viene en el ERP. Conviene confirmarlo con Ingeniería.
4. **Cubiertas sencillas.** ATCUBS44ABS usa 0.25 hoja; ATCUBS45/46ABS, 0.5. La descripción de ATCUBS45ABS dice "CON PUERTA METALICA"; la de 44 y 46, "TAPA REGISTRABLE".
5. **Asignación de renglones repetidos.** No se sabe con certeza qué sub-ensamble consume cada renglón repetido de pintura o lámina en cubiertas y ATACM. En ATCUBD44ABS se dedujo por las horas (placas tope y tapas), pero el reporte no lo dice.
6. **Opción C de la chapacinta CH32PVC.** En el pedido se consumió C770, es decir, va con la letra C aunque sea PVC. Se respetó.
7. **ATBIOCRT5:** el último costo del cristal es del 05/11/2025, muy viejo.
8. **Entregas** no está en el cotizador. Solo hay horas ENTRE para las claves del 6U (libro Coste APP LT) y sin tarifa.
