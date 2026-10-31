# 95_ACOMODO_RENDER_QA — fidelidad de renders y estado de acomodo (Ronda 3, 2026-10-31)

## RENDERS — fidelidad (FASE 7) · método a costo cero
Autorizado "solo renders flash" + sin quemar API de pago. Método: inspeccionar renders YA generados en el
bucket `renders` contra su spec registrado en `public.renders` (tabla canónica: `registrar_render_canonico`),
juzgando la imagen directamente (revisión, no juez de IA de pago). La identidad de versión está blindada por
test (A8: `renderCanonico.test.js`).

### Caso revisado: render id=2 · `producto_version_id=1934` · "Escritorio 1.80 m · nogal"
Spec (de `public.renders.inputs`): executive desk, 1800×700×750, finish walnut wood #6B4423,
features ["wireless charging pad on the top surface", "drawers on the front"], líneas rectas, 1 módulo.
Imagen: `renders/cocrear/3/hee585604-1791149186366.png` (PNG 1184×864, con metadata **C2PA** = marca de
contenido generado por IA; procedencia honesta).

| Dimensión | Spec | En la imagen | Veredicto |
|---|---|---|---|
| Tipo de producto | executive desk | escritorio ejecutivo recto | ✅ PASS |
| Acabado/material | walnut wood #6B4423 | nogal cálido correcto | ✅ PASS (finish) |
| Feature cajones | drawers on front | pedestal 4 cajones + cajón central | ✅ PASS (feature) |
| Feature cargador | wireless pad on top | disco oscuro en la superficie (arriba-izq) | ✅ PASS (feature) |
| Geometría | líneas rectas, 1 módulo | recto, un módulo | ✅ PASS (geom. cualitativa) |
| **Cotas rotuladas** | 1800×700×**750** | ancho "1.80m" ✓; alto rotulado **"0.70m"** (debería 0.75); fondo rotulado **"75m"** y **"1.80m"** (inconsistente) | ⚠️ **REVIEW_REQUIRED** |

**Veredicto:** el render es **conceptualmente fiel** (tipo, material, features, módulo: todo correcto), pero las
**cotas sobrepuestas no son confiables** (alto mal, fondo inconsistente). Confirma la regla de Dirección: un
render conceptual **no debe presentarse como reproducción exacta/acotada**. En la DB está
`geometry/feature/finish_validation = NOT_VERIFIED` (los slots existen; nadie los ha certificado) → ésta es la
primera revisión documentada de fidelidad de ese render.

**No escribí** los veredictos de validación en la DB de producción (sería certificar economía/calidad con
cuenta no-humana y un write productivo no autorizado). Quedan como evidencia aquí.

### Caso revisado 2: render id=1 · `producto_version_id=1932` · "Recepción 2.40 m"
Spec: reception desk / front counter, 2400×?×1100, finish HPL laminate #CBB79B, líneas rectas, 1 módulo.
Imagen: `renders/cocrear/5/hff688d77-1791146919705.png`.
- Tipo (mostrador de recepción con escalón de counter): ✅ PASS · Acabado (laminado beige #CBB79B): ✅ PASS ·
  Geometría (recto, 1 módulo): ✅ PASS · Sin cotas sobrepuestas (modo render limpio) → sin el defecto de cotas del caso 1.
- **Patrón confirmado (2/2):** los renders cocrear son **conceptos fieles al texto** (tipo/material/forma correctos),
  no fotografías de un producto físico. Correcto para un diseño nuevo; pero para un producto de CATÁLOGO que ya existe,
  el render debería partir de la FOTO real del mueble (ver plan abajo).

## Cómo hacer que los renders usen los muebles reales de Von Haucke como referencia
**La capacidad YA existe en el edge `generar-render`** (corre en Gemini, GEMINI_API_KEY):
- Acepta hasta **6 imágenes de referencia** (`body.imagen` + `body.imagenes[]`, `index.ts:78-79`).
- El prompt ya instruye reproducir el producto real: *"use the EXACT furniture pieces shown in the reference images —
  these are the real Von Haucke products; match their design, wood tone, frames and proportions"* (`:280`),
  y en modo acomodo *"The REMAINING reference images are the ACTUAL Von Haucke products specified for this room.
  Reproduce THOSE pieces"* (`:236`). También modo `catalogo` reproduce "the EXACT object in the reference image" (`:129`).

**Lo que falta son DATOS + CABLEADO (no capacidad del modelo):**
1. **Biblioteca de referencia:** 1–N fotos reales por producto de catálogo (vista 3/4, frente, lateral, detalle),
   en un bucket (p. ej. `producto-referencia/<producto_id>/...`), ligadas a `producto_id`/`producto_version_id` o a la
   clave de catálogo. Hoy NO existe esa tabla/bucket (la tabla `renders` guarda renders generados, no fotos de referencia).
2. **Cableado del cliente:** al generar un render de un producto de catálogo, buscar sus fotos de referencia y pasarlas
   en `imagenes[]` a `generar-render`. El edge ya las consume; solo hay que alimentarlas.
3. **Regla honesta:** para un producto de CATÁLOGO que existe → render CON foto real (reproducción fiel). Para un mueble
   NUEVO de Cocrear (no existe aún) → render de texto = conceptual (como los 2 de arriba), y así debe etiquetarse.

**Esfuerzo:** migración chica (tabla `producto_referencias` + bucket) + un selector en el cliente para subir/elegir las
fotos + el lookup que las adjunta al render. Es trabajo de datos+UI, NO de IA. Lo puedo preparar en la rama cuando
autorices; requiere luego deploy de frontend. Dejo la foto real a cargo de quien tenga las fotos de los muebles.

### Estado de RENDERS tras esta revisión
De **SIN MEDIR** a **PARCIAL**: 1 render revisado (conceptual PASS, cotas REVIEW). Método repetible a costo
cero para los demás (`public.renders` tiene 7 filas; 2 con `storage_path`; más imágenes en `renders/generated/`).
La fidelidad fina (medidas exactas, conteo de puertas en muebles complejos) a escala sigue pidiendo más
revisión — pero NO requiere API de pago con este método (inspección directa de imágenes existentes).

## ACOMODO — estado (FASE 6) · NO RE-VERIFICADO en R3
No se corrió acomodo en vivo esta ronda. Evidencia previa vigente: guard de colisión
`src/datos/acomodoInvariantes.test.js:121` (OVERLAP FAIL) + `bench/acomodo-calidad/overlapYcapacidad.test.js`
(sillas encimadas → recovery OVERLAP). Para un 95 comprobable de R3 falta: validador geométrico independiente
corrido contra proyectos nuevos (oficinas irregulares, puertas, columnas, pasillos) con guardado/reapertura.
Queda en `95_BLOCKERS_ACTUALES.md` E4.
