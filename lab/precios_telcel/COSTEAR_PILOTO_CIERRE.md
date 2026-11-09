# COSTEAR · Cierre del piloto (6 productos con BOM)

Fuente única de verdad para llevar los 6 productos del piloto a **100% certificable**.
Regla de certificación del sistema (vista `catalogo_vigente`):
`estado='aprobado' AND NOT requiere_validacion_compras AND vigente_desde ≤ 24 meses`.
Nada aquí inventa precios ni relaja esa regla.

## Estado actual (medido en prod 2026-11-09)

| Producto | líneas | certificables | vencidas | sin mapear | % cert |
|---|---|---|---|---|---|
| COPETE-CAB-516R | 8 | 6 | 0 | 2 | 75% |
| ENTCBCALP | 29 | 19 | 0 | 10 | 66% |
| TELCEL-VH-HORIZONTAL | 9 | 7 | 2 | 0 | 78% |
| TELCEL-VH-ISLA | 11 | 7 | 2 | 2 | 64% |
| TELCEL-VH-TORRE | 8 | 5 | 2 | 1 | 63% |
| TELCEL-MOD-ALMACEN | 8 | 3 | 3 | 2 | 38% |

Mapeos de identidad aplicados hoy (exactos, unidad compatible, precio fresco):
COPETE → `erp-tc181`, `erp-tu14he`. ENTCBCALP → `erp-tu38he`, `erp-tama516`,
`erp-tu16`, `erp-mdf16`, `pulido-redondo-14`, `erp-pitr34`.

## Lo que falta, por quién lo provee (ningún software lo inventa)

### A) COMPRAS — precio actual con fecha (ERP Intelisis / cotización)
Afecta Horizontal, Isla, Torre, Almacén. Última compra 2017–2020 → reprueba 24 meses.
- `erp-pph-a10` (azul Telcel), `erp-pph-a529` (blanco Telcel)
- `erp-ln1848` (lámina 4×8 c18), `erp-me258ex` (madera embalaje)
- `tubular-redondo-34` (tubular redondo 3/4" c18) — ENTCBCALP, identidad OK pero precio viejo
Detalle y evidencia: `COMPRAS_FRESCURA_TELCEL.md`.

### B) ACABADO / COLOR — qué variante usa el mueble (ENTCBCALP)
El catálogo tiene decenas de variantes por color; hay que elegir la exacta:
- `MDF16M` (melamina 2 caras 16 mm) — ¿qué acabado?
- `MDF25M` (melamina 2 caras 25 mm) — ¿qué acabado?
- `LP122244` (laminado plástico 4×8) — ¿qué acabado?

### C) FERRETERÍA menor — SKU exacto ambiguo (pavonado vs galvanizado, medida)
No los mapeo porque hay varias variantes y el precio histórico no coincide exacto con una sola:
- ENTCBCALP: pija phillips 8×5/8, 8×1/2, 8×1½ tablaroca; pija fijadora 8×1/2 broca; tornillo botón allen 1/4×1/2 negro; empaque jgo unitario
- COPETE: tornillo perilla estrella 1/4×2½ negro; empaque jgo unitario

### D) INGENIERÍA — identidad pendiente (no está en el despiece)
- TELCEL-MOD-ALMACEN: 2 líneas "pendiente identidad (Ingeniería)" (cubierta MDF/PVC; lámina)
- TELCEL-VH-ISLA: `LN1838` / `LN2038` (lámina 3×8 c18/c20) — no existen en catálogo; confirmar si se compran o se cortan de 4×8 / 3×10
- TELCEL-VH-TORRE: pintura en polvo sin color en el despiece — falta el color

## Nota de arquitectura
El motor NO revisa frescura (sólo exige precio de catálogo > 0); la frescura de 24 meses
la impone la vista del servidor. Por eso un producto puede verse "certificable" en el motor
y PRELIMINAR en el servidor. Las dos cosas son correctas; el servidor es la verdad.
