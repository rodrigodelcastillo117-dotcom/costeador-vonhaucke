# COSTEO CONCURSO TELCEL R5 (MÓDULOS DATS) — Von Haucke

Fuente de precios: workbook real C-CO-320R (misma familia) + producto_maestro verificado. Markup POLÍTICA_VH (fab ×(1+MO+GIF) reales por mueble; terceros/comprados ×1.06). **No se inventaron precios.** El costo NO incluye margen de utilidad ni flete/armado.

| Pos | Mueble | Cant | Costo unit. | Confianza | Ref. Telcel/u | Importe (costo×cant) |
|---|---|---:|---:|:--:|---:|---:|
| 10 | Vitrina Torre | 153 | $15,019 | ALTA | $17,998 | $2,297,964 |
| 20 | Vitrina Horizontal | 197 | $15,250 | ALTA | $14,215 | $3,004,261 |
| 30 | Modulo Conector Cubo | 25 | $4,200 | PRELIMINAR | — | $105,000 |
| 40 | Modulo Almacenamiento | 38 | $10,109 | MEDIA | $12,000 | $384,142 |
| 50 | Vitrina Isla | 15 | $13,045 | ALTA | $19,200 | $195,671 |
| 60 | Caja de Cobro | 10 | $9,500 | PRELIMINAR | — | $95,000 |
| 70 | Servicio entrega/armado R5 | 1 | — | — | — | (por cotizar) |
| | **TOTAL muebles (sin servicio)** | | | | | **$6,082,039** |

## Notas de confianza
- **ALTA** (Torre, Horizontal, Isla): capa de fabricación ANCLADA al `cos_fab_real` verificado en `producto_maestro`; terceros (cristal templado, termoformado) y comprados con precio real del workbook C-CO-320R.
- **MEDIA** (Almacén): el ancla fab del workbook ($2,601) quedó por debajo del `material_real` verificado ($3,596); costo preliminar, reconciliar BOM antes de cotizar en firme.
- **PRELIMINAR** (Cubo Conector, Caja de Cobro): muebles NUEVOS sin histórico; estimado por analogía. **Requieren costeo detallado del spec** (lámina + MDF/PVC + herrajes, sin cristal).

## Desglose por capas (muebles ALTA/MEDIA)
| Mueble | Material fab | Material terceros/comprados | cos_fab (MO/GIF) | cos compra-venta | COSTO |
|---|---:|---:|---:|---:|---:|
| Vitrina Torre | $2,966 | $11,077 | $3,278 | $11,742 | $15,019 |
| Vitrina Horizontal | $4,483 | $8,677 | $6,052 | $9,198 | $15,250 |
| Modulo Almacenamiento | $2,601 | $6,224 | $3,512 | $6,597 | $10,109 |
| Vitrina Isla | $3,298 | $8,106 | $4,452 | $8,593 | $13,045 |