# TELCEL · Vitrina Horizontal (C-CO-320R) — qué falta para costear POR MATERIAL

Fecha: 2026-11-07 · Autor: Claude Code (sesión de cierre) · Fuente: prod `mtuvnbgljwbsaizjjgzs` (solo lectura)

## En una línea
Los materiales **ya existen y tienen precio certificado** en el catálogo. Lo que impide un
**costo certificado por material** NO son los precios: son (1) **cantidades físicas** por línea
(las da Ingeniería) y (2) **identidad limpia** del catálogo (un artículo de pintura está partido
en ~90 variantes). Sin eso, la clave sólo se puede dar como **agregado orientativo** (lo que ya
hace hoy). No se inventan cantidades.

## Estado por línea (despiece reconstruido de explo_x_id, id_01)
`total_hist` = total monetario de esa línea en la hoja (NO es precio unitario).
`precio_cert_hoy` = precio aprobado vigente hoy en catálogo (varios son última-compra vieja firmada por Dirección).
`cantidad` = **FALTA** (Ingeniería). `qty_implícita` = total_hist ÷ precio_cert_hoy, **sólo como pista a verificar**, no es dato.

| # | material | artículo·opción | insumo catálogo | unidad | precio_cert_hoy | fecha precio | total_hist | qty_implícita (verificar) |
|---|----------|-----------------|-----------------|--------|-----------------|--------------|-----------|---------------------------|
| 1 | Lámina negra 3×10 cal.18 (LN18310) | MVLSLA05260402 | erp-ln18310 | hoja | $615.15 | 2026-10-20 | $1,737.48 | ~2.82 hoja |
| 2 | Lámina negra 4×10 cal.18 (LN18410) | MVLSLA05270402 | erp-ln18410 | hoja | $776.52 | 2026-09-09 | $661.00 | ~0.85 hoja |
| 3 | Lámina negra 4×10 cal.18 (LN18410) | MVLSLA05270402 | erp-ln18410 | hoja | $776.52 | 2026-09-09 | $398.10 | ~0.51 hoja |
| 4 | Lámina negra 4×10 cal.14 (LN14410) | MVLSLA05270202 | erp-ln14410 | hoja | $1,211.95 | 2026-09-09 | $47.62 | ~0.04 hoja |
| 5 | Pintura en polvo opción A529 | MVLQPP00000000·A529 | erp-pph-a529 | kg | $142.51 | 2020-07-08 | $360.83 | ~2.53 kg |
| 6 | Pintura en polvo opción A10 | MVLQPP00000000·A10 | erp-pph-a10 | kg | $207.98 | 2018-08-28 | $52.41 | ~0.25 kg |
| 7 | Tira madera pino 5cm (TMP534250) | MLEMTM01040000 | erp-tmp534250 | pza | $47.43 | 2026-09-01 | $303.55 | ~6.40 pza |
| 8 | Tira madera pino 10cm 1¼" (TMP1011425) | MLEMTM01050000 | erp-tmp1011425 | pza | $189.75 | 2026-02-11 | $144.21 | ~0.76 pza |
| 9 | Tira madera pino 10cm ¾" (TMP1034250) | MLEMTM01060000 | erp-tmp1034250 | pza | $94.87 | 2026-02-11 | $777.93 | ~8.20 pza |

`material_hist` (suma total_hist) = **$4,483.13**. A precio de hoy, con cantidades confirmadas, el
número será **distinto** (p. ej. la lámina cal.14 subió de ~$47 de aporte a $1,211/hoja; la pintura
sigue en precio viejo). Eso es correcto: costo a precios vigentes ≠ hoja histórica.

## Bloqueos para CERTIFICAR (no son de código)
1. **Ingeniería — cantidades físicas por línea.** El despiece reconstruido sólo trae dinero, no
   piezas/hojas/kg. Hace falta el consumo real por material por módulo (Horizontal, Torre, Isla,
   Almacén). Las `qty_implícita` de arriba son una pista a validar, no un dato.
2. **Compras — confirmar vigencia del precio.** Varios "certificados" son última-compra de 2018–2020
   firmados por Dirección (D3). Para un costo oficial conviene que Compras confirme el precio de hoy,
   sobre todo pintura (A529/A10) y láminas.
3. **Catálogo — identidad.** `MVLQPP00000000` (pintura) está dividido en ~90 insumos por opción; hay
   que fijar artículo+opción al despiece para no tomar la variante equivocada. (P0 "identidad rota",
   task #77.)

## Lo que NO se hizo (y por qué)
- **No se cargaron los 49 precios "última compra":** innecesario — los 48 artículos ya están en
  catálogo con precio certificado, varios más nuevos que la última-compra. Cargarlos metería ruido.
- **No se escribió despiece a `producto_maestro`:** sin cantidades sería inventar. La clave queda
  como agregado orientativo (honesto) hasta tener 1 y 2.

## Cuando lleguen 1 y 2
Con cantidad por línea + precio confirmado, el motor (`costearBOM`) ya sabe costear por material y
marcar la clave `BOM_DETALLADO_VERIFICADO` → **certificable**. El código ya existe; sólo faltan esos
datos. Es trabajo de ~1 familia; "costear muebles que no conoces" sigue siendo otra cosa (VONI
propone con incertidumbre 6–33%, nunca certifica solo).
