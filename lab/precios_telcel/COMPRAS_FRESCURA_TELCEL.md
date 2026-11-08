# Precios a refrescar para certificar TELCEL (Torre / Isla) y cerrar Horizontal

**Problema:** estos SKUs no certifican porque su **última compra** es de 2017–2020
(regla del sistema: `certificable` sólo si la última compra es ≤ 24 meses, aprobada y
validada por Compras). El despiece Telcel `...DIV-MATERIALES 20261002.xlsx` (generado el
2-oct-2026) **confirma** esas fechas viejas en su columna `fecha_última_compra`.

**Lo que necesito de Compras (de Intelisis en vivo):** para cada SKU, el **precio y la
fecha de la última compra ACTUAL** (o una cotización vigente con fecha). Con eso los cargo
igual que las láminas que ya certifican, y Torre / Isla / Horizontal quedan certificados.

| SKU (clave ERP) | Artículo Intelisis | Descripción | Última compra en el despiece | Precio en el despiece | Qué necesito |
|---|---|---|---|---|---|
| `A529` | MVLQPP00000000 opción A529 | Pintura en polvo BLANCO 9016 (Telcel) | 2020-07-08 | $171.01 /kg | precio + fecha actual |
| `A10` | MVLQPP00000000 opción A10 | Pintura en polvo AZUL RAL 5002 (Telcel) | 2018-08-28 | $249.58 /kg | precio + fecha actual |
| `ME258EX` | MVLMMR050000E7 | Madera embalaje 1/2" 80mm x 2.5m | 2018-10-01 | $26.50 /pza | precio + fecha actual |
| `LN1848` | MVLSLA05280402 | Lámina negra 4'×8' cal.18 | 2017-05-12 | $585.51 /hoja | precio + fecha actual |
| `LN1838` | LN1838 | Lámina negra 3'×8' cal.18 | **(sin fecha)** | $722.46 /hoja | precio + fecha actual **O** confirmar que se corta de 4×8 / 3×10 |
| `LN2038` | LN2038 | Lámina negra 3'×8' cal.20 | **(sin fecha)** | $541.86 /hoja | precio + fecha actual **O** confirmar que se corta de 4×8 / 3×10 |
| pintura Torre sin color | MVLQPP00000000 opción (vacía) | Pintura en polvo — **color no especificado** | **(sin fecha)** | $449.06 /kg | **el COLOR** + precio/fecha actual |

## Notas honestas
- `LN1838` / `LN2038` (3×8 c18/c20): no existen en el catálogo de VH ni en Intelisis con
  precio fresco; además su costo viejo ($722 la 3×8 c18) es **más alto** que la 4×8 c18
  ($585) siendo hoja más chica → confirmar que de verdad se compran, o remapear a 4×8/3×10.
- La pintura de $449.06 de la Torre no trae color en **ninguna** pestaña del despiece; sin
  el color no se puede mapear a un insumo certificable.
- `A529` y `A10` también afectan al **Horizontal** (hoy el motor lo marca "certificable"
  pero el servidor lo marca PRELIMINAR por estas dos pinturas viejas). Refrescarlas cierra
  los tres muebles de una vez.
