# Despliegue P0 · Integridad de Producto Maestro — orden reversible

**NO APLICADO. Requiere autorización explícita de Dirección.** Rama: `claude/loop-producto-maestro`.
Prod: `c3.4-seller-safe`. Son un PAR cliente+servidor: se despliegan juntos y en este orden.

## Qué entra
1. `supabase/migrations/20261109_guardar_producto_maestro_integridad.sql` — RPC nueva (14 params) +
   columnas aditivas (`version`, `cos_fab_calculado`, `actualizado_por`, `huella`, `estado_bom`) +
   `producto_maestro_historial` (append-only).
2. Cliente (Vercel) de la rama: `GuardarProductoMaestro.jsx` + `productoMaestroDesdeDespiece.js`.
3. `supabase/migrations/20261109_certificable_exige_documento.sql` — aprieta la vista `catalogo_vigente`
   (certificable exige `source_document`). **Independiente** de 1–2; se puede aplicar aparte.

## Orden
0. **Respaldo**: `producto_maestro`, `producto_maestro_historial` (si existe) e `insumo_precios` (para el apriete).
1. **Aplicar migración (1)**. Es aditiva: agrega columnas y reemplaza la RPC. La nueva RPC tiene defaults,
   así que el cliente viejo (10 args nombrados) sigue pudiendo **crear** claves.
   - ⚠️ **Ventana**: entre el paso 1 y el 2, el cliente viejo **no podrá SOBRESCRIBIR** una clave existente
     (la RPC nueva exige `p_sustituir`, que el cliente viejo no manda → error "ya existe"). Sólo hay 6
     Productos Maestros y sustituirlos es raro; aun así, hacer 1 y 2 **seguidos** minimiza la ventana.
   - Un `BOM_DETALLADO_VERIFICADO` del cliente viejo sigue pasando (su despiece viejo no trae pendientes),
     pero ahora la RPC **rechaza** un VERIFICADO con pendientes (es el apriete deseado).
2. **Desplegar cliente (Vercel)** desde la rama, inmediatamente después del paso 1.
3. **Verificar** (smoke, sin escribir datos oficiales): guardar un BORRADOR con una pendiente, guardar un
   VERIFICADO completo, intentar sobrescribir sin versión (debe fallar) y con versión (debe subir a v2).
   Es la lógica de `supabase/tests/contratoProductoMaestroE2E.test.js`, ya verde en PGlite.
4. **Aplicar migración (3)** (apriete del catálogo) cuando Dirección lo autorice. Efecto: 140 precios sin
   documento pasan de CERTIFICADO → PRELIMINAR (siguen costeando; no certifican). HORIZONTAL y TORRE no
   se afectan (sus insumos frescos sí traen documento). No cambia ningún precio ni la selección.

## Rollback
- **RPC (1)**: `drop function public.guardar_producto_maestro(text,text,jsonb,numeric,numeric,numeric,numeric,numeric,integer[],text,text,integer,boolean,boolean);`
  y recrear la de `20261108_guardar_producto_maestro.sql` (10 args). Las columnas y el historial son
  aditivos: se conservan (no estorban al contrato viejo).
- **Cliente (2)**: redeploy del SHA productivo anterior en Vercel.
- **Vista (3)**: recrear `catalogo_vigente` SIN la condición de `source_document` (definición del baseline,
  idéntica salvo esa línea). No toca datos.

## Nota de datos (pendiente humano, no se aplica aquí)
- Los 6 Productos Maestros actuales están etiquetados `BOM_DETALLADO_VERIFICADO` con el flujo viejo, aunque
  varios tienen líneas sin SKU. El motor igual los bloquea por frescura/orientativo (no hay certificación
  falsa), pero la etiqueta no refleja el contrato nuevo. Reclasificarlos a BORRADOR es decisión de Dirección.
