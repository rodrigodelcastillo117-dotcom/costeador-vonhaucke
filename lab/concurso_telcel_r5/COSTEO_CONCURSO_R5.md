# COSTEO CONCURSO TELCEL R5 (MODULOS DATS) — Von Haucke

_Generado 2026-11-10. **Markup aplicado: 25%** (= margen bruto 20%; editable). Flete/armado (pos 70) por cotizar aparte._

Precios de datos reales: explosion C-CO-320R (misma familia) + producto_maestro verificado. **No se inventaron precios unitarios.**

> **Markup vs margen:** `cotizacion = costo × (1 + markup)`. Markup 25% equivale a **margen bruto 20%** (margen = utilidad/precio). Si se requiere 25% de *margen bruto*, el factor sube a ×1.333 — decision de Direccion.

| Pos | Mueble | Cant | Costo u. | Cotiza u. (markup 25%) | Conf. | Ref.Telcel R7 | Importe costo | Importe cotiza |
|--:|--|--:|--:|--:|:-:|--:|--:|--:|
| 10 | Vitrina Torre | 153 | $15,019 | $18,774 | ALTA | $17,998 | $2,297,965 | $2,872,456 |
| 20 | Vitrina Horizontal | 197 | $15,250 | $19,063 | ALTA | $14,215 | $3,004,260 | $3,755,325 |
| 30 | Modulo Conector Cubo | 25 | $3,108 | $3,885 | PRELIMINAR | — | $77,702 | $97,127 |
| 40 | Modulo Almacenamiento | 38 | $7,974 | $9,968 | MEDIA | $12,000 | $303,026 | $378,782 |
| 50 | Vitrina Isla | 15 | $17,824 | $22,280 | ALTA | $19,200 | $267,361 | $334,202 |
| 60 | Caja de Cobro | 10 | $6,233 | $7,791 | PRELIMINAR | — | $62,331 | $77,913 |
| 70 | Servicio entrega/armado R5 | 1 | por cotizar | | — | $212,000 (R3 ref) | | |
| | **TOTAL (sin servicio)** | | | | | | **$6,012,645** | **$7,515,806** |

## Confianza
- **ALTA** (Torre, Horizontal, Isla): fabricacion ANCLADA a `cos_fab_real` verificado; terceros/comprados con precio real del workbook.
- **MEDIA** (Almacen): fab verificado + herrajes del workbook; faltaria MDF de superficie (reconciliar antes de firmar).
- **PRELIMINAR** (Cubo, Caja): BOM del spec R5 con precios reales; los renglones marcados `*supuesto*` son consumos de lamina/MDF estimados, a validar con Ingenieria.

## BOM Cubo Conector (preliminar)
| Renglon | $ |
|--|--:|
| Lamina c18 cuerpo+zoclo (~2.8 m2 -> 1.34 hoja 3x10) *area, falta despiece* | $766.00 |
| Cartabones c14 (~0.05 hoja) *area* | $40.82 |
| Pintura en polvo (~1.0 kg) | $171.01 |
| Madera huacal empaque | $300.00 |
| Cubierta MDF 12mm natural + PVC White (~0.36 m2, precio ERP MDF) | $500.00 |
| 4 niveladores ($40.70 c/u) | $162.80 |
| Stickers Telcel (2 lat + 1 frontal) | $75.00 |
| Placa identificacion aluminio | $45.00 |
| Consumibles empaque (polifoam/cinta/esquinero) | $100.00 |
| **Costo (fab×1.80 + cv×1.06)** | **$3,108** |

## BOM Caja de Cobro (preliminar)
| Renglon | $ |
|--|--:|
| Lamina c18 cuerpo+entrepanos+zoclo+copete+frente (~6.5 m2 -> 3.1 hoja) *area, falta despiece* | $1,772.00 |
| Cartabones c14 (~0.06 hoja) *area* | $48.99 |
| Pintura en polvo (~2.5 kg) | $427.53 |
| Madera huacal empaque | $350.00 |
| Superficie + cubierta copete MDF 12mm + PVC White (~0.9 m2, precio ERP MDF) | $1,100.00 |
| Multicontacto 6 salidas | $120.00 |
| 4 niveladores ($40.70 c/u) | $162.80 |
| Guia/pasacables | $60.00 |
| Stickers Telcel | $75.00 |
| Placa identificacion aluminio | $45.00 |
| Consumibles empaque | $150.00 |
| **Costo (fab×1.80 + cv×1.06)** | **$6,233** |