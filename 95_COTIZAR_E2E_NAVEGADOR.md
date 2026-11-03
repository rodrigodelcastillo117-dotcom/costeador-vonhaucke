# 95_COTIZAR_E2E_NAVEGADOR — ciclo Cotizar de línea completo en vivo (2026-11-03)

E2E en navegador (Playwright + Chromium por el proxy) contra prod `costeador-vonhaucke.vercel.app` (commit `2b78f57`),
con la **cuenta de vendedor real** `ventasprueba` (rol vendedor). Flujo determinista "Cotizar de línea" (catálogo conocido,
**sin IA de pago**). **Autorizado por Dirección:** crear una cotización de prueba en prod y borrarla al final. Limpieza
verificada. Cierra COTIZAR como "Medido (E2E completo)".

## Ciclo ejecutado (5 etapas)
1. **Crear.** Login vendedor → Cotizar de línea → buscar "Eclipse" (24 productos) → "Agregar" en un ítem concreto del ERP:
   `BASE PARA CREDENZA 1120×500×196 mm ECLIPSE DRIFT — EDBAS1120M`, precio de venta $1,650. Aparece "Mi cotización 1".
2. **Persistir (autosave, sin botón guardar).** En DB: cotización **id 4869**, estado `borrador`, `usuario=ventasprueba`,
   1 partida, `total = 2,162.82`.
3. **Reabrir.** Presupuestos anteriores → Abrir → se renderiza "Mis cotizaciones" con CLIENTE/FOLIO (read-back OK).
4. **PDF (del propio vendedor).** "Descargar PDF" → `BORRADOR Propuesta.pdf` (jsPDF, 3 pág, A4).
5. **Borrar (limpieza).** Se eliminaron la fila 4869 y su `cotizacion_idempotencia`; `ventasprueba` vuelve a 0
   cotizaciones (verificado: queda_cotizacion=0, queda_idem=0, total=0).

## Dos invariantes verificados
### Cuadre de dinero (al centavo), lado venta
PDF: EDBAS1120M $1,650.00 · subtotal $1,650.00 · (+$49.50 +$165.00 maniobras/instalación) · **IVA 16% $298.32** ·
**TOTAL $2,162.82** · Anticipo 50% $1,081.41 / Saldo $1,081.41. El TOTAL del PDF = `total` en DB (2,162.82) **exacto**.
Nota impresa: "El total YA incluye IVA del 16%", "maniobras e instalación incluidas".

### Seller-safe en toda la cadena (partida guardada + PDF)
- **Partida en DB:** claves NO incluyen `costo`, `margen` ni `costeo` (los tres = false). Sí trae bandera explícita
  `sellerSafe`, y economía solo de venta (`precioUnitario`, `precio_lista_snapshot`, `lista_precio_item_id`).
- **PDF del vendedor:** escaneo de texto (`pdftotext`, 3 pág) → **0 coincidencias** de
  `margen/utilidad/ganancia/costo/proveedor/insumo/despiece/merma/mano de obra`. Solo precios de venta.
- Marca de agua **BORRADOR** (estado borrador, sin folio oficial): un borrador no se hace pasar por emisión.

## Veredicto COTIZAR
**Medido (E2E completo en vivo):** crear → persistir → reabrir → PDF → borrar, con cuadre de dinero al centavo y seller-safe
en la partida guardada y en el documento al cliente. Más fuerte que el `95_COTIZAR_E2E.md` previo (que era núcleo por RPC):
aquí es la UI real del vendedor de punta a punta.

## Residual honesto
- Un ítem directo de catálogo (ruta determinista). No se ejercitó el **Configurador** (variantes/acabados) ni "Cotizar varios
  con IA" (esa rama usa IA de pago, diferida). El acomodo/espacio tampoco entró (esta fue cotización de línea, no por plano).
- Se probó un producto; no los 24 proyectos. La pasada de 24 sigue pendiente (y para foto/plano necesita opus-5).
