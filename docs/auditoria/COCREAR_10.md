# COCREAR 10 · de concepto a producto con costo y precio del servidor

- Fecha: 2026-10-13 · Rama de trabajo: `worktree-agent-ae74345fd741ce8bb` (worktree de `claude/costing-app-architecture-psf02g`, base `9f66da6`).
- Punto de partida: `docs/auditoria/COCREAR_VONI_10.md` (D-01, D-02, D-03 y D-06 vigentes) y `MATRIZ_10.md` (Cocrear = 3/10, N-04).
- Pedido de Dirección: "co-creación puede ser un mueble nuevo o cambiar medidas de uno de línea; ahí sí sería costear y nosotros poner un precio, usando TODA la info que tenemos", con el flujo completo de principio a fin.
- No se hizo merge ni push, no se desplegó nada (Vercel ni Edge), no se ejecutó SQL contra Supabase, no se tocaron precios del catálogo ni `formulaAlba.js`.

## 1. Qué quedó resuelto

| ID | Estado | Qué cambió | Dónde | Pruebas |
|---|---|---|---|---|
| D-01 | **Resuelto** | Cocrear baja a BOM por dos caminos. **A · cambio de medidas de un mueble de línea**: se toma el despiece REAL que la app ya genera para ese producto (`LINEAS_REG` → `generar`, el mismo de CosteadorLinea) en la medida de catálogo más cercana y se escalan las piezas con la geometría (abarca / holgura / proporción / fija, piezas verticales, canto por perímetro). El tablero lo cobra el motor por **acomodo en hoja** (rejilla + regla ½/1 hoja), no por regla de tres. Al cambiar medidas, el BOM se re-escala desde el padre; en la medida exacta de catálogo no se co-crea (se manda a su línea). **B · mueble nuevo**: "Pasar a Costear" lleva nombre, medidas, materiales, funciones, descripción e imagen de referencia al asistente de Costear (análisis IA → BOM, la misma vía de siempre) y "Regresar a Cocrear con este despiece" lo trae como revisión nueva. Costo: Alba V1 × dificultad (selector en Cocrear; normal por omisión). Una función del concepto sin despiece (electrificación, iluminación, curva…) entra como pieza PENDIENTE: costo incompleto y precio "Por confirmar", nunca $0. | `src/datos/cocrearPuente.js`, `src/datos/cocrear.js` (linaje → `DERIVED_SPECIAL`, `dificultad` en el spec y en `costearSpec`), `src/componentes/CocrearV3.jsx`, `src/componentes/AsistenteEspecial.jsx`, `src/App.jsx` | `src/datos/cocrearPuente.test.js` (17), `cocrearVoni10.test.js` D-01 → `it`, `e2e/cocrear10.e2e.js` |
| Precio | **Resuelto** | `precioSugeridoCocreado`: precio = costo ÷ (1 − margen de política) y nunca por debajo del piso `margenMinimo` (25 %). Costo incompleto → `null` = "Por confirmar". El precio de catálogo del mueble de línea no se toca; se muestra como referencia y, si el especial queda por debajo, se avisa (no se ajusta solo). | `src/datos/precio.js`, `CocrearV3.jsx` | `src/datos/precioCocreado.test.js` (5) |
| D-02 | **Resuelto en código, pendiente de despliegue** | El payload del navegador ya no lleva importes (`costSnapshot = {status, fuente:'navegador_no_autoritativo'}`). El costo lo calcula `costear-servidor` en **modo cocrear**: el navegador sólo manda `{accion:'cocrear', expediente_id, validar_ingenieria?, visual_hash?}`; el servidor lee el BOM del expediente guardado, reconstruye el spec (y rechaza un payload cuyo `specHash` no es el de su contenido), pasa por el MISMO DTO (`validarIntentCosteo`) y el MISMO motor, y guarda una fila en `cocrear_costeo_servidor` ligada al `analysis_hash` de esa revisión. `registrar_producto_desde_expediente` toma el importe de esa fila, nunca del payload. "Convertir en partida" usa el precio del servidor. | `src/datos/cocrearServidor.js`, `supabase/functions/costear-servidor-rc/index.ts`, `supabase/migrations/PROPUESTA_cocrear_costo_servidor.sql`, `src/nube.js` (`costearCocreacionServidor`) | `src/datos/cocrearServidor.test.js` (9), `supabase/tests/cocrearCostoServidor.test.js` (15, PostgreSQL real con la migración) |
| D-03 | **Resuelto en código, pendiente de despliegue** | "Validar ingeniería" guarda la revisión y le pide al servidor que la valide: sólo Diseño/Dirección, costo emitible, sin bloqueos de `revisarEstructura` y con el `visual_hash` de la revisión guardada. La fila validada eleva la versión a `aprobado` (o `certificado`) aunque registre un vendedor. La UI dice VALIDADA sólo si la respuesta del servidor corresponde al spec actual; cualquier cambio la deja vencida. | mismos archivos que D-02 | ídem; `cocrearEngineeringValidation.test.js` actualizado |
| D-05 | **Resuelto** (defensa en profundidad) | `validacionAutorizada`: el núcleo no acepta una validación firmada por un rol sin autoridad. La autoridad real es la fila del servidor. | `src/datos/cocrear.js` | `cocrearVoni10.test.js` D-05 → `it` |
| D-06 | **Resuelto** | Antes de guardar, el render (y la referencia) se suben a Storage con el mismo flujo VH-045 (`imagenAStorage`); el payload guarda la URL pública junto con su firma y al reabrir se recupera. El render se firma contra el spec BASE (el que reconstruye el servidor): validar la ingeniería ya no lo vence. Nunca viaja base64. | `cocrear.js` (`renderPersistible`), `CocrearV3.jsx`, `nube.js` (`imagenCocrearAStorage`) | `src/datos/cocrearRender10.test.js` (6), e2e (reabrir: render vigente) |
| N-04 | **Resuelto** | "Subir imagen de referencia" en el inicio y en el estudio, con el MISMO flujo de carga que Costear (`reducirImagen`/`validarArchivoImagen` movidos a `src/datos/cargaImagen.js`, que ahora usan los dos). Viaja a Costear (botón "Analizar la imagen de referencia") y se guarda con la co-creación. | `src/datos/cargaImagen.js`, `AsistenteEspecial.jsx`, `CocrearV3.jsx` | `cocrearRender10.test.js`, e2e |
| Seller-safe | Se mantiene | El vendedor no ve costo local, costo del servidor, explicación de costeo ni estimado; el servidor le responde precio y estado, sin llaves económicas; `cocrear_seguro` le quita costo y margen. | `CocrearV3.jsx`, `cocrearServidor.js`, migración | e2e vendedor, `cocrearServidor.test.js`, PGlite |

### Pruebas y verificación

- `npx vitest run`: **315 archivos, 2,809 pruebas, todas pasan** (antes: 2,757).
- `npx vite build`: compila.
- `e2e/cocrear10.e2e.js` (nube falsa + modo cocrear y RPC con la semántica de la propuesta, corriendo los mismos módulos que la Edge; `PW_EXECUTABLE=/opt/pw-browsers/chromium`, dev server propio en el puerto 5174): **3/3 pasan**.
  1. Diseño: imagen de referencia → concepto → BOM de APP LT mesa de juntas escalado a 1,350 mm → render → "Validar ingeniería" (VALIDADA por el servidor) → partida con el precio del servidor (costo local = costo servidor = $2,785.38; precio $5,570.76) → reabrir (render vigente, referencia y validación de regreso) → cambiar el ancho re-escala el BOM y vence la validación.
  2. Vendedor: baja a BOM, costea en el servidor, ve precio y nunca costo; no puede validar ni pasar a Costear.
  3. Mueble nuevo: Pasar a Costear (descripción con medidas) → análisis IA (falso) → regresa con el BOM → la pieza sin material deja el costo `incompleto` y el precio "Por confirmar".
- No se llamó ninguna IA real ni se corrió ningún laboratorio en vivo.

### Pruebas existentes que cambiaron (y por qué)

- `src/datos/cocrearVoni10.test.js`: D-01 y D-05 pasan de `it.fails` a `it` (la convención del archivo). D-01 se reescribió para ejercer el puente (antes afirmaba un BOM que la UI no podía escribir). D-07: ahora SÍ viaja la URL pública del render (D-06); la aserción protege que no viaje base64.
- `src/componentes/cocrearEngineeringValidation.test.js`: la validación la decide el servidor. El despiece 3D completo (largo × ancho × espesor en TODAS las piezas) queda como diagnóstico visible y no como compuerta: un BOM real lleva PTR por metro y herrajes por pieza, y esa compuerta dejaba "Validar ingeniería" inalcanzable. La compuerta autoritativa (rol, costo emitible, validador estructural, misma revisión) está en el servidor.
- `supabase/tests/cocrearServidor.test.js`: sólo un comentario. D-02 y D-03 siguen como `it.fails` porque describen la base de PRODUCCIÓN, que no cambia hasta aplicar la migración.

## 2. Qué NO quedó y por qué

- **Nada de lo de servidor está activo**: por regla no se desplegó ni se aplicó SQL. Hasta desplegar, "Costear en el servidor" responde con un aviso explícito ("el servidor de costeo aún no tiene el modo cocrear…") y "Convertir en partida" de Cocrear no se puede usar. Ojo: con el SQL de producción actual, una co-creación ya no puede registrarse con el costo del navegador (falla cerrado con `costo_estado_con_valor_invalido`, mensaje explicado en la UI). Antes era inalcanzable por D-01.
- **Escalado de línea, alcance**: sólo productos que declaran su medida base y son un cuerpo: App LT y App (escritorio, mesa de juntas, mesa circular) y 7 de Eclipse. Bancas por usuario (crecen por módulos), escritorio en L y productos por `select` (sin medida base en la app) se van por "Pasar a Costear".
- **Piezas sin geometría en el padre** (en App LT: pata U, omega, riel, placa, acometida, que vienen como metros de PTR) conservan la cantidad del padre y se avisan como ESTIMADO. Los padres no declaran su alto: ese eje no se escala (aviso visible).
- **Biblioteca de Costear como padre**: no se escala un expediente de la biblioteca; para eso está "Afinar en Costear" o Costear directo.
- **D-15** (el vendedor no ve sus co-creaciones guardadas por RLS de `expedientes`) no se tocó.
- La Edge no se ejecutó en Deno (no hay Deno en este entorno): su lógica vive en `cocrearServidor.js` (probada con vitest y PGlite) y el archivo pasa el parseo TypeScript.

## 3. Qué hay que desplegar (cuando Dirección autorice)

1. **SQL**: `supabase/migrations/PROPUESTA_cocrear_costo_servidor.sql` (tabla `cocrear_costeo_servidor` con RLS sin políticas, `registrar_producto_desde_expediente` y `cocrear_seguro`). Trae su bloque de rollback.
2. **Edge**: `costear-servidor-rc` (núcleo compartido `costearConMotor` sin cambio en el costeo normal + modo cocrear). Al promover, copiar a `costear-servidor` (es la que usa producción). La Edge importa `src/datos/cocrearServidor.js` y `src/datos/revisionEstructural.js`.
3. Orden: primero la migración y después la Edge. Con la Edge nueva y sin la tabla, el modo cocrear responde 503 `REGISTRO_NO_DISPONIBLE` y no presume nada.

## 4. Riesgos

- **Precio del especial contra la lista de su padre**: con Alba V1 (normal), el costo del despiece de App LT queda muy por debajo del modelo por horas Intelisis de la línea (mesa de juntas 1500: Alba $2,792.93 vs Intelisis $4,902.56). Una mesa de 1,350 mm co-creada sugiere $5,570.76, mientras la lista modelo de la 1,200 es $8,725.70. La UI lo avisa ("queda por DEBAJO") y no lo corrige sola. Dirección debe decidir si para derivados de línea Intelisis se usa dificultad mayor, un piso igual a la lista del padre o el modelo por horas.
- **Escalado heurístico**: la asignación de ejes es determinista y queda trazada pieza por pieza, pero con el alto del padre sin declarar algunas medidas son ambiguas (por ejemplo, el frente de un cajón). Por eso el especial nunca sale sin validación de ingeniería y la confianza se marca "baja" cuando hay piezas conservadas o un cambio de más del 40 %.
- **Validar es un costeo**: cada validación guarda una revisión nueva si cambió el payload (por ejemplo, por subir el render) y deja una fila en el servidor. Una revisión nueva deja sin vigencia la validación anterior (es intencional: nada se hereda).
- **Paridad cliente/servidor**: el servidor costea con `catalogo_motor`; el navegador, con los insumos que tiene. La vista previa local de Diseño puede diferir del servidor; el número oficial es el del servidor (y la UI lo rotula así).
- `src/nube.js` ahora importa `cocrearServidor.js` (y con él `cocrear.js`) en el bundle principal: unos KB más.
- El laboratorio en vivo `e2e/labCocrear.e2e.js` ahora encuentra un `<input type=file>` en Cocrear y subirá la imagen del laboratorio.

## 5. Commits

1. `739df1b` Cocrear 10 (D-01 núcleo): puente Cocrear→Costeo, precio sugerido con piso 25 %, render y referencia persistibles.
2. `50283d5` Cocrear 10 (D-02/D-03 servidor): modo cocrear en costear-servidor-rc + PROPUESTA SQL (no aplicada).
3. `49505c7` Cocrear 10 (UI): flujo completo concepto → BOM → servidor → precio → partida, render y referencia que sobreviven.
4. Este reporte y la referencia al precio de lista del padre (ver `git log`).
