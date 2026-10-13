# Paquete de auditoría externa · Costeador Von Haucke · 2026-10-13

Este paquete es para un auditor externo (otra IA o una persona). Lo armó la sesión que hizo el trabajo, así que **no es
independiente**: el objetivo es que tú encuentres lo que se nos pasó. No des nada por bueno porque esté documentado aquí.

## Qué es la app

Costeador/cotizador de mobiliario de oficina para Von Haucke (fabricante mexicano). Hay tres flujos:

- **Costear:** foto, texto o plano → despiece leído por la IA → materiales del catálogo ERP Intelisis → costo con la
  fórmula Alba V1 → precio.
- **Cotizar:** plano o espacio → muebles → acomodo geométrico → propuesta, PDF y emisión con folio.
- **Cocrear:** idea → concepto → render → registrar y costear.

**Stack:** React/Vite (Vercel), Supabase (Postgres con RLS, RPC `security definer`, Edge Functions en Deno) y la API de
Claude para leer imágenes y planos.

**Roles:** `direccion`, `diseno` y `vendedor`. El vendedor **no debe ver ni escribir** costos ni márgenes ("economía").

## Estado exacto en este momento

| Pieza | Estado |
|---|---|
| Cliente en producción | rama `c3.4-seller-safe` @ `c8dd2b3` (Vercel `dpl_Bm7FFwdPLFZJEg9cnHsEGeua7bF3`). **Ninguno de los cambios de cliente de este paquete está publicado todavía.** |
| Rama auditada | `claude/costing-app-architecture-psf02g` @ `961c42e`, PR #37. 166 commits por delante de producción. |
| SQL aplicado HOY en producción | 1) `respaldo_20261013`, un esquema con la copia de las 32 tablas y de las 108 definiciones de funciones. 2) **VH-035c**, verificado con la huella de 23/23 funciones (ver `03_sql/`). |
| SQL pendiente (no aplicado) | vh148, seg01, vh146, vh147, vh147c, vh099, vh100 y cocrear_costo_servidor (`03_sql/PENDIENTE_*`). |
| Edge Functions | Los cambios viven en las versiones `*-rc`. Producción sigue con las versiones anteriores. |
| Pruebas unitarias | `06_pruebas/`: 322 archivos y 2,867 pruebas pasan, con 0 omitidas en vitest. |
| E2E (CI del PR #37) | 92 pasan y 1 falla: `persistencia.e2e.js`, el rojo esperado mientras VH-035c no estuviera en producción. |

**Combinación a revisar:** ahora mismo producción corre VH-035c (SQL nuevo) con el cliente viejo `c8dd2b3`. La firma de
los RPC no cambió, pero conviene confirmar que el cliente viejo no rompe con el nuevo comportamiento STALE.

## Archivos

| Archivo | Contenido |
|---|---|
| `01_commits_lista.txt` / `01_commits_detalle.txt` | Los 166 commits, del más viejo al más nuevo, con mensaje y archivos. |
| `02a_codigo_app_sql_edge_pruebas.patch` | **Lo principal:** diff completo contra producción de `src/`, `supabase/` (migraciones, funciones y pruebas), `e2e/`, `bench/` y `.github/`. Unas 29,000 líneas. |
| `02b_archivos_tocados_todos.txt` | Los 1,415 archivos tocados. Unos 1,150 son salidas de laboratorio (JSON y capturas) que **no** se incluyen. |
| `02c_docs_y_lab_ligero.patch` | Documentos y laboratorios pequeños. |
| `03_sql/` | SQL aplicado en producción (texto exacto), su verificación por huella y las migraciones pendientes completas. |
| `04_docs/` | Auditorías internas, `BUG_LEDGER.md`, el plan de la ventana y `CLAVES_POR_DESCRIPCION.md` (claves ERP duplicadas o faltantes). |
| `05_evidencia_lab/` | Resúmenes de los laboratorios: A/B de modelos de lectura, dificultad, estimaciones y propuesta de carga de costos. |
| `06_pruebas/` | Salida completa de vitest sobre `961c42e`. |

## Cambios principales que hay que auditar

1. **VH-035c, integridad económica al guardar** (`supabase/migrations/PROPUESTA_vh035c_*`, ya en producción).
   - El vendedor guarda partidas sin economía y el servidor vuelve a pegar la economía de Dirección.
   - Si cambió el producto, el material, el lote (cuando la economía depende del lote) o la definición del renglón, el
     costo viejo **no se hereda**: queda `cost_stale` y la emisión se bloquea hasta recostear.
   - Lista blanca de lo que el vendedor puede cambiar: precio, descuento e importe.
2. **VH-148, control optimista:** guardado con versión esperada y manejo de conflicto entre dos sesiones.
3. **SEG-01:** la emisión exige que el snapshot enviado sea idéntico a la fila guardada.
4. **VH-146/147/147c, catálogo ERP:**
   - formato de hoja 4×8 y 5×8;
   - política de vigencia de precios a 24 meses (Decisión 1 de Dirección);
   - vista de auditoría.
5. **VH-100:** `cargar_costos_oficiales`, la carga del costo industrial oficial por producto con documento y hash. Rechaza
   códigos duplicados si no viene `producto_id`.
6. **Motor de costeo:**
   - `src/motor/dificultad.js` (nuevo) escala la mano de obra de Alba por dificultad (0.5 / 0.75 / 1 / 1.3 / 1.6) y la
     cuadra contra el costo por horas;
   - VH-177 en `formulaAlba.js` (núcleo protegido, cambio aprobado por Dirección): "laminado plástico/HPL" ya no se lee
     como lámina de acero;
   - `mapIaComps.js`: el cristal por m² se costea por área.
7. **Lectura con IA:**
   - `analizar-mueble-rc` pasa a `claude-opus-5-5` (A/B: 52/55 renglones correctos contra 39/55);
   - VH-178 (`src/datos/lecturaIncompleta.js`) detecta una lectura incompleta o degenerada, reintenta una vez y, si
     sigue mal, bloquea la emisión hasta que una persona revise.
8. **Cocrear con costo del servidor** y precio sugerido. Regla de Dirección: puede quedar abajo de la lista del mueble
   padre, pero nunca abajo del 25 % de margen.
9. **Acomodo (VH-A10-01 a 07):**
   - holgura de sillas de 600 mm;
   - juntas por lados largos;
   - `SEAT_NO_ACCESS`;
   - topología de bancas APP LT.

## Puntos débiles que ya conocemos (atácalos primero)

- **Los parámetros de dificultad son una calibración nuestra,** con 15 piezas del cotizador ERP. Dirección no los
  definió número por número. Lo mismo pasa con la tarifa de indirecto de planta de $82.37/h: verifica su fuente en
  `lab/applt` y en el diff.
- **El A/B de modelos de lectura usa una muestra chica** (55 renglones, pocas imágenes) y lo corrimos nosotros.
- **Ningún vendedor real ha completado una cotización de punta a punta.** Dirección dice que la app no lo permitía.
  Toda la evidencia de flujo completo sale de la cuenta QA y de laboratorios propios.
- **Hay 1,931 partidas de lista sin costo oficial,** así que la emisión se bloquea con `ECONOMICS_INCOMPLETE`. Es
  intencional: no se inventa costo. El efecto práctico es que Cotizar no puede emitir esas líneas hasta cargar los
  costos oficiales con VH-100.
- **Catálogo:**
  - 28 códigos ERP están duplicados en `productos`;
  - 116 productos activos no tienen código;
  - la clave del módulo de 12 usuarios es una **propuesta** (`TATO127212ABCT01`), no un dato.
- **Precios de lista ATPU:**
  - hay dos reglas de precio en el mismo Excel;
  - ATPU4M a lista ($770) queda 23 % abajo de su costo ERP real ($1,005.49).
- **VH-035c es plpgsql recursivo:**
  - la fusión por arreglos es O(n²) por partida, y no medimos el rendimiento con cotizaciones grandes (más de 200
    partidas con insumos anidados);
  - la clasificación de qué es economía depende de `public.jsonb_sin_economia`, que no cambió en este paquete.
- **5 E2E nuevos se omiten solos si faltan las variables de laboratorio** (`TEST_EMAIL`, `LAB_*`). No corren en CI sin
  credenciales.

## Lo que pedimos al auditor

1. **Seguridad de economía.** ¿Hay algún camino por el que un `vendedor` lea o escriba costos o márgenes? Revisa RPC,
   triggers, RLS, Edge Functions y el payload del cliente. Busca también formas de saltarse `cost_stale` y emitir con un
   costo viejo.
2. **Corrección de VH-035c y VH-148 juntos:** sobrecargas, `set_config('vh.economia_preservada')` a nivel transacción y
   condiciones de carrera.
3. **Motor:** ¿la dificultad y el costo por horas están bien cuadrados? ¿Hay doble conteo de indirectos? ¿Hay unidades
   mal convertidas (m², hoja, pieza)?
4. **Pruebas débiles:** busca pruebas que pasen sin probar nada (mocks que fijan la respuesta, aserciones triviales,
   fixtures que no corresponden al esquema real).
5. **Despliegue:** ¿el orden de la ventana (`04_docs/VENTANA_ETAPA3_20261013.md`) tiene dependencias rotas? ¿El rollback
   de cada paso es real?
6. **Califica del 1 al 10 cada área** (seguridad, costeo, lectura IA, cotizar/acomodo, cocrear, pruebas, despliegue) y
   da los 10 defectos más graves, con archivo y línea.
