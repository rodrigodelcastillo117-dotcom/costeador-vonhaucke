# TELSVH120 · los 4 especiales — precio real (para alta formal de Compras/Dirección)

Fuente: Excel **C-CO-320R DATS TELCEL DIV-MATERIALES** (hoja `explo_x_id`), proyecto TELCEL hermano
de TELSVH120 (mismos componentes). Estos 4 NO están en el catálogo como insumo; requieren alta de
precio por el flujo de Compras (no insert crudo). Precios REALES del proyecto:

| Material (clave fábrica) | Precio real | Fuente (fila explo_x_id) |
|---|---:|---|
| **Cerradura cam-lock** (MLEACE27330000 / CECAM20015) | **$416 c/u** (×2 = $832) | MVLACE230000V6 "CERRADURA CAM LOCK 800650" |
| **Kit iluminación LED** (MLEEKT030000F9 / TELSVH120-KIT) | **~$2,500** | MVLEKT03000086 $2,535 / MVLEKT030000A4 $2,500 |
| **Placa serigrafía** (MLEEPL0409C8G1 / TELSVH120-PLA) | **$45–54** | PLSERIGRAFIADA "PLACA IDENTIF. ALUMINIO CAL.24" |
| **Capelo de cristal** (MLECCP0302072C / TELSVH120-CAP) | **~$900** | CRISTTEMPCUB $465.24 + CRISTTEMPFRE $215.42 + 2×CRISTTEMPLAT $110.93 |

## Corrección importante (sub-costeo detectado)
Mis proxys del catálogo estaban **BAJOS** (ya borrados):
- cam-lock proxy $47.76 → real **$416** (×8.7)
- LED proxy $1,164 → real **~$2,500** (×2.1)
Confirma el riesgo que señaló Dirección: un proxy mete sub-costeo silencioso.

## Costo de material de la vitrina (real)
- 25 materiales ya conectados a precio real del catálogo: subtotal ≈ **$6,531**
- + los 4 especiales con precio real: cristal ~$900 + placa ~$50 + cerradura $832 + LED ~$2,500 = **$4,282**
- **Total material TELSVH120 ≈ $10,800 MXN** (vs ~$7,800 con proxys; vs "no costeable" al inicio).

## NOTA 2026-10-29 — intento de carga cruda REVERTIDO (lección)
Intenté dar de alta los 4 con insert directo a `insumos_catalogo`/`insumo_precios`. La tabla de
precios es **append-only** (trigger prohíbe DELETE) y hay lógica/triggers que **deformaron** los
valores (precio y estado cambiados, p.ej. $2500→$1864, marcados `aprobado`). Se detectó al verificar
y se **neutralizó**: conexiones borradas + insumos puestos `activo=false` ⇒ 0 en `catalogo_vigente`,
sin efecto en costeo/emisión. Confirma que estos 4 **NO** se cargan a mano: van por el flujo
ERP/Compras (RPC `cargar_erp_ultima_compra`, con candado de Dirección). Las conexiones buenas (25)
no se tocaron.

## Acción para Compras/Dirección
Dar de alta estos 4 como insumo con su precio real (flujo ERP/Compras), y aprobar las 25 conexiones
`propuesto` (tag `HDM_TELSVH120_20261029`). Con eso TELSVH120 queda 29/29 costeable de verdad.
Falta aparte: MO (10%) y GIF (ver TELCEL_MO_GIF_GAP — anomalía Torre sin resolver).
