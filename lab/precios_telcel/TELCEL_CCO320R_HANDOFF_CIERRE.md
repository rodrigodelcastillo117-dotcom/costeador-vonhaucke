# TELCEL C-CO-320R — handoff de cierre (4 módulos): qué falta para costear POR MATERIAL

Fecha: 2026-11-07 · Autor: Claude Code · Fuente: prod `mtuvnbgljwbsaizjjgzs` (solo lectura).
Supersede a `TELCEL_HORIZONTAL_HANDOFF_CIERRE.md` (este cubre los 4 módulos).

## Resumen ejecutivo (sin adornos)
- Los materiales TELCEL **ya están en catálogo con precio certificado** (Dirección firmó última-compra).
- **Bloqueo universal**: el despiece reconstruido (explo_x_id) es **sólo dinero por línea**, NO trae
  cantidad física (hojas/kg/piezas). Sin cantidad no se puede recostear a precio de hoy **sin inventar**.
- **Bloqueos de identidad** (por módulo, abajo): insumos sin precio, precios muy viejos, pintura sin
  opción, claves en el campo artículo, y 2 líneas sin identidad en Almacén.
- Por eso la clave sólo se puede dar como **agregado orientativo** (lo que ya hace hoy). NO certificable
  por material hasta cerrar cantidades (Ingeniería) + confirmar precio (Compras) + resolver identidad.

`total_hist` = total monetario de la línea en la hoja (NO unitario). `precio_cert` = aprobado vigente hoy.
`cantidad` = **FALTA (Ingeniería)** en TODAS las líneas.

## Vitrina Horizontal — material_real $4,483.13 (9 líneas, identidad 100%)
| material | artículo·opción | insumo | precio_cert | fecha | total_hist |
|---|---|---|---|---|---|
| Lámina negra 3×10 c18 | MVLSLA05260402 | erp-ln18310 | $615.15/hoja | 2026-10 | $1,737.48 |
| Lámina negra 4×10 c18 | MVLSLA05270402 | erp-ln18410 | $776.52/hoja | 2026-09 | $661.00 |
| Lámina negra 4×10 c18 | MVLSLA05270402 | erp-ln18410 | $776.52/hoja | 2026-09 | $398.10 |
| Lámina negra 4×10 c14 | MVLSLA05270202 | erp-ln14410 | $1,211.95/hoja | 2026-09 | $47.62 |
| Pintura polvo A529 | MVLQPP00000000·A529 | erp-pph-a529 | $142.51/kg | 2020-07 ⚠ viejo | $360.83 |
| Pintura polvo A10 | MVLQPP00000000·A10 | erp-pph-a10 | $207.98/kg | 2018-08 ⚠ viejo | $52.41 |
| Tira pino 5cm | MLEMTM01040000 | erp-tmp534250 | $47.43/pza | 2026-09 | $303.55 |
| Tira pino 10cm 1¼" | MLEMTM01050000 | erp-tmp1011425 | $189.75/pza | 2026-02 | $144.21 |
| Tira pino 10cm ¾" | MLEMTM01060000 | erp-tmp1034250 | $94.87/pza | 2026-02 | $777.93 |

## Vitrina Torre — material_real $2,966.15 (8 líneas)
| material | artículo·opción | insumo | precio_cert | total_hist | nota |
|---|---|---|---|---|---|
| Lámina 3×10 c20 (inox?) | MVLSLA05260502 | lamina-3x10-20 | **SIN PRECIO** | $462.94 | ⛔ insumo sin precio |
| Lámina negra 3×10 c18 | MVLSLA05260402 | erp-ln18310 | $615.15/hoja | $1,465.43 | ok |
| Lámina 3×10 c14 | MVLSLA05260202 | lamina-3x10-14 | **SIN PRECIO** | $46.54 | ⛔ insumo sin precio |
| Tubular 1" c20 | MVLSTU01080501 | erp-tc201 | $131.64/pza | $16.05 | ok |
| Lámina negra 4×10 c20 | MVLSLA05270502 | erp-ln20410 | $583.12/hoja | $94.87 | ok |
| Madera embalaje | MVLMMR050000E7 | erp-me258ex | $26.50/pza (2018 ⚠) | $212.00 | precio viejo |
| Pintura polvo A10 | MVLQPP00000000·A10 | erp-pph-a10 | $207.98/kg | $162.23 | ok |
| Pintura polvo (SIN OPCIÓN) | MVLQPP00000000·— | **AMBIGUO (90 opciones)** | — | $506.09 | ⛔ falta la opción exacta |

## Vitrina Isla — material_real $3,297.84 (11 líneas)
| material | artículo·opción | insumo | precio_cert | total_hist | nota |
|---|---|---|---|---|---|
| Lámina negra 4×8 c18 | MVLSLA05280402 | erp-ln1848 | $585.51/hoja (2017 ⚠⚠) | $351.31 | precio muy viejo |
| Lámina negra 3×10 c18 | MVLSLA05260402 | erp-ln18310 | $615.15/hoja | $74.30 | ok |
| Tubular 1" c18 | MVLSTU01080401 | erp-tc181 | $132.50/pza | $364.38 | ok |
| (artículo MPMTLA01030601) | MPMTLA01030601 | erp-ln4814ace | $900.38/hoja | $18.01 | ⚠ identidad dudosa (unidad vacía en hoja) |
| LN1838 (clave, no artículo) | LN1838 | **no resuelto** | — | $361.23 | ⛔ clave en campo artículo |
| Lámina negra 4×10 c18 | MVLSLA05270402 | erp-ln18410 | $776.52/hoja | $67.60 | ok |
| LN2038 (clave, no artículo) | LN2038 | **no resuelto** | — | $135.47 | ⛔ clave en campo artículo |
| Pintura polvo A529 | MVLQPP00000000·A529 | erp-pph-a529 | $142.51/kg | $201.79 | ok |
| Tira pino 5cm | MLEMTM01040000 | erp-tmp534250 | $47.43/pza | $426.87 | ok |
| Tira pino 10cm 1¼" | MLEMTM01050000 | erp-tmp1011425 | $189.75/pza | $203.03 | ok |
| Tira pino 10cm ¾" | MLEMTM01060000 | erp-tmp1034250 | $94.87/pza | $1,093.85 | ok |

## Módulo Almacén — material_real $3,596.14 (8 líneas, identidad 67.4%)
| material | artículo·opción | insumo | precio_cert | total_hist | nota |
|---|---|---|---|---|---|
| (sin artículo) | — | — | — | $722.46 | ⛔ NECESITA_HUMANO |
| Lámina negra 3×10 c18 | MVLSLA05260402 | erp-ln18310 | $615.15/hoja | $925.89 | ok |
| Lámina negra 4×8 c18 | MVLSLA05280402 | erp-ln1848 | $585.51/hoja (2017 ⚠⚠) | $286.90 | precio viejo |
| Lámina negra 4×10 c18 | MVLSLA05270402 | erp-ln18410 | $776.52/hoja | $751.14 | ok |
| Pintura polvo A529 | MVLQPP00000000·A529 | erp-pph-a529 | $142.51/kg | $367.67 | ok |
| Pintura polvo A10 | MVLQPP00000000·A10 | erp-pph-a10 | $207.98/kg | $37.44 | ok |
| Bisagra bidimensional | MVLABI19000000 | erp-bibi | $13.66/pza | $54.64 | ok |
| (sin artículo) | — | — | — | $450.00 | ⛔ NECESITA_HUMANO |

## Qué falta para CERTIFICAR (no es código — son datos de personas)
1. **Ingeniería — cantidades físicas por línea, los 4 módulos.** Es el bloqueo universal. El despiece
   sólo trae dinero. Sin consumo (hojas/kg/piezas) no hay costo por material honesto.
2. **Compras — confirmar precio vigente**, en especial los marcados ⚠/⚠⚠ (pintura 2018–2020, LN1848 2017,
   madera embalaje 2018) y los ⛔ **SIN PRECIO** (`lamina-3x10-14`, `lamina-3x10-20`).
3. **Identidad a resolver** (Dirección/Ingeniería):
   - Pintura **sin opción** en Torre ($506.09): decir qué opción (color) es.
   - Claves `LN1838` / `LN2038` (Isla) están en el campo artículo: dar el artículo ERP real.
   - `MPMTLA01030601`→`erp-ln4814ace`: confirmar que es el material correcto (unidad venía vacía).
   - Almacén: 2 líneas sin artículo ($722.46 + $450.00 = $1,172.46): identificarlas.

## Cuando lleguen esos datos
El motor (`costearBOM`) ya sabe costear por material y marcar `BOM_DETALLADO_VERIFICADO` → certificable.
El código existe; sólo faltan cantidad + precio confirmado + identidad. Es trabajo por familia, con
personas en el ciclo. "Costear muebles que no conoces" sigue siendo otra cosa: VONI **propone** un
despiece con incertidumbre (6–33% fuera de muestra), nunca certifica solo.

## Lo que NO se hizo (y por qué)
- No se cargaron los 49 precios "última compra": innecesario (ya en catálogo, varios más nuevos).
- No se escribió despiece a `producto_maestro`: sin cantidades sería inventar.
- No se "limpió" el catálogo: no hay duplicados reales de identidad (0 SKUs partidos; la pintura en ~90
  variantes son opciones legítimas; varios precios vigentes por insumo es por diseño).
