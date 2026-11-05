# MANIFIESTO — Segunda pasada (todo lo listado como NO procesado en §1C)

**Fecha:** 2026-11-05. Extracción determinista; sólo valores literales; nada inventado. Mecánica: Google Sheets exportados a xlsx (openpyxl, todas las hojas); PDFs y Docs extraídos con `read_file_content` (texto); inline pequeños reconstruidos desde el resultado.

**Resultado: TODO lo de §1C quedó procesado. Nada imposible.** (Sillas y "Resumen de Importación", que la tool devolvía inline y no se pudieron reconstruir byte-exactos como xlsx, se recuperaron como texto vía `read_file_content`.)

## Hallazgo más relevante (para el Costeador)
**`reglas_merma_aprovechamiento_tiempos.md`** — de "comentarios Rogelio y Alba.docx": reglas REALES de merma/aprovechamiento y tiempos de VonHaucke (literal):
- Tiempos: no hay medición exacta; único dato **30 s por operación**; antes "unidades equivalentes" (1 mampara = 1 u.e.).
- Tableros: pieza >1.50×0.60 m = **0.5 hoja**; pieza que exceda 0.60×1.50 m = **1 hoja**.
- Pintura: **8 m²/kg** en piezas planas (tubulares, menor rendimiento).
- Perfil de canto: excedente por lado (recorte de cierre). Perfil tubular: **6 m**. Láminas: anchos **0.91 m y 1.22 m** (3 y 4 pies).

## Cobertura por fuente

### A. Costeos legacy RC-COSP (Google Sheets 2023) — 20 procesados (todas sus hojas → CSV en `costeos_RC-COSP/<id>/`)
Cada uno: `FORMATO DE SOLICITUD P` (+ a veces copia), `INSTRUCTIVO RS`, `Historial de Revisión`. Son formatos de solicitud de costeo de producto (STEREN, ELEKTRA, KIOSCOS, MESAS, RACK, etc.). Precios 2023, superados por OC 2025-26.
01 STEREN `1hMMh…` · 02 `1GeNS…` · 03 `1_bBy…` · 04 `1Ruf1…` · 05 `1W0Cd…` · 06 `1t_Vn…` · 07 cancelado `15t4x…` · 08 `1fy7K…` · 09 `1OKbX…` · 10 `1Vlcn…` · 12 `12P-V…` · 13 `1DknR…` · 14 `1C_G5…` · 15 `1u1gH…` · 16 `1wJFj…` · 17 5a-rodaja `1-edo…` · 17 plafon `16W2-…` · 18 ELEKTRA `1IzTD…` · 19 `1MUg6…` · 20 RACK `1c9Qe…`

### B. Compras / varios (`compras/`)
| Archivo | id | Volcado | Nota |
|---|---|---|---|
| Sillas Pendientes 2023 | `1tzaI8q5…` | `Sillas_pendientes_2023.csv` + `.md` (38 renglones) | Tracker compras sillería feb-mar 2023 (O.C./requisición, proveedor, clave, cant, importe pendiente). Recuperado vía read_file_content (xlsx inline no persistible byte-exacto). |
| carta porte fasterrama | `1kghnvm…` | `carta_porte_fasterrama/Hoja1..7.csv` | Logística carta porte (incluye catálogos SAT grandes). Sin costeo. |
| Resumen de Importación | `10UP1Gx5…` | `Resumen_Importacion.md` | Datos aduanales (clave SAT, cant, embalaje). Sin costos. |

### C. Presupuestos de VENTA (PDF→texto, `pdf_texto/presupuestos_venta/`) — 8
**Los PDF "2260…/2220…/pto" NO son órdenes de compra: son COTIZACIONES/PRESUPUESTOS de venta a cliente (precio de venta de módulo/producto, no costo de MP).** Por eso **NO se integran a `precios_vigentes_master.csv`** (que es costo real de MP). Sus precios de venta se consolidaron en `cotizaciones_venta_areas.csv` (48 áreas) y las claves de producto terminado con P.U. de venta en `claves_producto_precio_venta.csv` (26 claves).
226080044 (13/08/2026, Propuesta LV, Total $3,219,915) · 226060008 (02/06/2026, Financiera Sustentable, $23,913,210) · 226080135 (17/09/2026, Estuco, $586,914) · 226080183 (02/10/2026, Hugo Boss, $2,021,232) · 222120039 (14/12/2022) · 222040060 (19/04/2022 Paper) · 222030097 (24/03/2022) · pto=224060010 (05/06/2024, Avantek; incluye explosión módulo→componentes).

### D. Hojas de Manufactura (PDF→texto, `pdf_texto/HDM/`) — 6, con despiece (claves + dims + cant)
TELSVH120 (20 partes) · TEVTSU (27) · TEVHSU (25) · TELSMG (13) · TVCAC (plano vista, sin despiece) · HAMAPA23 (coffee table Harman, notas de ensamble).

### E. Catálogos comerciales NOM (PDF→texto, `pdf_texto/catalogos_NOM/`) — marketing, SIN precios/costos
Con claves de producto: **Mox** (MOXGAR…), **Puertos Eléctricos** (LUM-…/MDMECO…). Sólo prosa: Rio, App, EclipseDrift, Alba, Ergonova4, Tetris, Anteo, Feather, Arlequin, Luna, AppLT, Eclipse, via. Existen 2 juegos (Set A "Copia de…" y Set B "…2026_3010", michelle.ruiz); contenido equivalente, procesado una vez por línea.

### F. Google Docs / minutas (`docs_texto/`) — 24, notas de reunión (sin costeo estructurado salvo lo indicado)
21 "Sesión Planta/Dirección — Notas de Gemini" (full vía jq o resumen conciso), "Protocolo claves sillería" (full, 55 KB), 3 minutas REG-DEX de Exportación 2023, "comentarios Rogelio y Alba" (**reglas de merma — alto valor**), "Carta Rodrigo del Castillo" (personal/bancaria, no costeo). 2 docs duplicados (222030097, Puertos Eléctricos) listados en `_DUPLICADOS.md`.

## Qué NO se integró a los maestros y por qué
- Precios de presupuestos y catálogos = **precios de VENTA** de producto terminado → a `cotizaciones_venta_areas.csv`/`claves_producto_precio_venta.csv`, **no** a `precios_vigentes_master.csv` (costo de MP). Regla dura: no mezclar venta con costo.
- Reglas de merma/tiempos quedaron como referencia (`reglas_merma_aprovechamiento_tiempos.md`), no aplicadas a ningún cálculo.
