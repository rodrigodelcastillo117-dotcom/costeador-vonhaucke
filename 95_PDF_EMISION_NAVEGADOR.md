# 95_PDF_EMISION_NAVEGADOR — generación de propuesta PDF en vivo (2026-11-03)

E2E en navegador (Playwright + Chromium headless por el proxy). Contra prod `costeador-vonhaucke.vercel.app` (commit
`2b78f57`). **Lectura: se abrió una cotización EXISTENTE (borrador QA, id 4868, 12 partidas) y se generó su PDF; no se creó,
modificó ni emitió nada nuevo.** Cierra el SIN MEDIR histórico de PDF/EMISIÓN con evidencia renderizada.

## Flujo ejecutado (Dirección, qa-direccion, solo lectura de UI)
Login → Presupuestos anteriores → "Abrir" (primera propuesta) → se renderiza con costo/utilidad (Dirección SÍ ve costo,
contraparte del seller-safe) → botón **"Descargar PDF"** → descarga capturada.

## PDF producido
- Archivo: **`BORRADOR Propuesta Torre Sur (golden) 41559938071-1.pdf`** (7.3 MB).
- Productor: **jsPDF 4.2.1**, 7 páginas, A4 (595×842 pt), PDF 1.3, válido (pdfinfo OK).
- Portada: render de oficina + logo Von Haucke + "MÁS DE 68 AÑOS DE OFICIO" + "PROPUESTA DE MOBILIARIO · Preparada para
  Torre Sur (golden)" + fecha 3-nov-2026 · 12 líneas · 31 piezas · vigencia 15 días hábiles.

## Dos invariantes verificados en el entregable
1. **Seller-safe extendido al documento (el que sale al cliente):** escaneo de texto (`pdftotext`) de las 7 páginas →
   **0 coincidencias** de `margen/utilidad/ganancia/costo/proveedor/insumo/despiece/merma/mano de obra`. El PDF muestra
   **solo precios de venta** ($155,310.00, $81,470.00, subtotales por área, productos). Aun generado por Dirección, el
   documento al cliente **nunca lleva costo**.
2. **Integridad borrador ≠ emisión oficial:** la cotización es `estado=borrador` (sin folio_oficial) y el PDF lleva marca
   de agua **"BORRADOR · NO REGISTRADO"** repetida en diagonal, y el nombre del archivo abre con `BORRADOR`. Un borrador
   no puede hacerse pasar por emisión oficial. El flujo de emisión oficial es aparte ("Ver emisiones"), con el gate
   server-side `evaluar_emision_cotizacion` ya certificado (SEG-01, no confía en economía del cliente).

## Veredicto PDF/EMISIÓN
**Medido.** Generación de propuesta PDF funciona en prod; el entregable al cliente es seller-safe (0 costo, solo venta) y
marca el borrador como no oficial. Evidencia: PDF de 7 páginas + portada renderizada + scan de texto.

## Residual honesto
- Se probó la generación del **borrador**. La EMISIÓN OFICIAL (folio oficial, sello) no se ejecutó en vivo aquí porque
  requiere pasar el gate con una cotización completa y emitir —acción con efecto, fuera de "lectura"— y no se autorizó
  emitir en prod. El gate server-side que la gobierna ya está certificado por evidencia primaria (md5 vivo
  `8c23d98a…`, `95_HALLAZGOS_RONDA3.md`).
