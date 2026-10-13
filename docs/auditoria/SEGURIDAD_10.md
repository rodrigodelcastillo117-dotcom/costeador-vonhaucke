# SEGURIDAD_10 · Auditoría de seguridad (área H) · 2026-10-13

**Alcance:** permisos por rol (vendedor / diseño / dirección), RLS de `public`, funciones SECURITY DEFINER, RPC de guardado, emisión y aprobación, Edge Functions, aislamiento entre usuarios, carreras, storage y comportamiento fail-closed.
**Proyecto:** `mtuvnbgljwbsaizjjgzs` (PRODUCCIÓN). Rama `claude/costing-app-architecture-psf02g`.
**Método:** sólo SELECT de catálogo y metadatos en producción, más conteos agregados y nombres de claves JSON (nunca valores de costo, secretos ni datos personales). También lectura de código del repo y de las Edge Functions desplegadas (`get_edge_function`, sólo lectura), y una prueba PGlite con los cuerpos SQL **exactos** de producción (md5 verificado).
**No se hizo:** ningún INSERT/UPDATE/DELETE/DDL, despliegue ni migración. No se usó la cuenta QA.
**Ya conocido (sólo se referencia):** VH-035 (el vendedor borra el costo de Dirección al guardar), VH-148 (autosave sin control optimista) y las 103 aprobaciones ERP hechas con `qa-direccion@vonhaucke.mx`.

---

## 1. Resumen ejecutivo

| ID | Sev. | Componente | Hallazgo | Estado | Prueba |
|---|---|---|---|---|---|
| SEG-01 | **P1** | `private_api.evaluar_emision_cotizacion` / `emitir_revision_v2` | El gate sólo ata el snapshot del cliente a lo costeado por `id` de renglón. Descripción, medidas, material y cantidad son libres, y el margen se calcula contra el costo de **otro** producto. Un vendedor emite y obtiene folio oficial sin pasar por Dirección. | Confirmado | Sí |
| SEG-02 | P2 | RLS `reglas`, `lista_precio_items` | El vendedor lee por REST `reglas.margen_min` (igual a la política vigente) y `lista_precio_items.piso_minimo` (1639 filas). Contradice `politica_comercial_publica`, `config_sanitizada` y `cotizar-servidor`, que ocultan ambos datos. | Confirmado | No |
| SEG-03 | P2 | RLS `cotizaciones_revisiones` / `cotizaciones`, `revisiones_seguras` | Diseño ve `margen`, `precioReal` y `costoUnitario` en snapshots emitidos (21 renglones) y `totales.margen`. El diseño dice "Dirección ve todo; el resto sin economía interna". | Confirmado | No |
| SEG-04 | P2 | Edge Functions `costear-vision`, `generar-video`, `leer-plano-core(-rc)`, `voni-council` | Cualquier sesión válida invoca LLM o video sin control de rol y/o sin límite de uso (costo sin tope). `leer-plano-core` permite saltarse el rate-limit del wrapper. | Confirmado (código) | No |
| SEG-05 | P2 | RLS `aprobaciones.aprob_upd` | Dirección puede hacer UPDATE directo de cualquier columna de `aprobaciones`, sin pasar por `resolver_aprobacion`: re-aprobar una RECHAZADA, mover `revision_hash` o poner otro correo en `resuelto_por`. La bitácora de aprobaciones no es confiable. | Confirmado (política) | No |
| SEG-06 | P3 | `asignar_folio_oficial` + `trg_strip_seller_economics` | Cuando el vendedor asigna el folio, se borra el costo de Dirección del renglón. Es una vía **nueva** de la familia VH-035, no la del guardado. | Confirmado | Sí |
| SEG-07 | P3 | `private_api.catalogo_motor` | No valida rol y tiene EXECUTE para `anon` y `authenticated`. Hoy no es alcanzable (no hay `pg_graphql` y el cliente no usa `private_api`). Es defensa en profundidad. | Parcial | No |
| SEG-08 | P3 | Políticas `true` | `clientes`, `contactos` y `escenarios` (lectura y escritura entre vendedores), más `confirmaciones` (con `confirmado_por` libre), `shadow_costeo`, `aprendizajes` y `reglas`. | Confirmado (política) | No |
| SEG-09 | P3 | Storage | El bucket `app` es público y anon puede listarlo. El bucket `renders` es público, sus rutas llevan el correo del usuario y cualquier usuario autenticado puede hacer INSERT en cualquier ruta. | Confirmado | No |
| SEG-10 | P3 | Edge Functions fuera del repo | 10 funciones desplegadas no tienen código en el repo. Se revisaron 6. | Confirmado | No |
| SEG-11 | P3 | `permitidos` / Edge `usuarios` | Los candados "no cambiarte el rol" y "último Dirección" sólo existen en la Edge Function, y `permitidos.rol` no tiene CHECK. 7 de 11 cuentas son Dirección, incluida la de QA. | Confirmado | No |
| SEG-12 | P3 | `cotizar-servidor` | Llama `resolver_precio_especial_proyecto` con el JWT del usuario, pero `authenticated` no tiene EXECUTE. La ruta de especiales falla siempre (de forma segura). Es un defecto funcional, no de seguridad. | Confirmado | No |

**No hay P0.** No encontré ninguna forma de que un vendedor **lea** costos de insumo, el catálogo con precios o la economía de producto; esas barreras están bien hechas (ver §3).

---

## 2. Hallazgos confirmados con evidencia

### SEG-01 · P1 · El gate de emisión no ata el snapshot al renglón costeado

**Evidencia (producción, cuerpos leídos con `pg_get_functiondef`; md5 `9c660b09…` evaluar, `fb26c9d5…` emitir):**
- `private_api.evaluar_emision_cotizacion`: compara `jsonb_array_length(snapshot.partidas)` contra lo persistido y, por renglón, sólo `coalesce(id, piezaId, producto_id, productoId, nombre)`:
  ```sql
  if v_snap_identity is null or v_db_identity is null or v_snap_identity<>v_db_identity then
  ```
  Para renglones legacy (sin `producto_id`), el costo sale **del renglón persistido** (`v_dbpt->>'costoUnitario'`) y el precio **del snapshot**. Nada compara `nombre`, `medidas`, `material` ni `cantidad`.
- `private_api.emitir_revision_v2`: si el gate dice `ALLOWED`, guarda `p_snapshot` tal cual como revisión `tipo='generado_v2'`. Después `asignar_folio_oficial` sólo exige que exista esa revisión.
- En renglones canónicos (`producto_id`), la identidad también se toma de `id` antes que de `producto_id`. Por eso el snapshot puede cambiar `producto_id`/`producto_version_id` de un renglón sin que el gate lo note, aunque el precio sí se valida contra la lista del producto declarado.

**Explotación concreta (reproducida en `supabase/tests/seguridadGateEmisionSnapshot.test.js`):**
1. Dirección costea y guarda, a nombre del vendedor, un renglón legacy `{id:'p1', nombre:'Escritorio operativo melamina', medidas:'120x60x75', material:'Melamina 16 mm', costoUnitario:6000}`.
2. El vendedor dueño llama `rpc/emitir_revision_v2` (sólo necesita su sesión y la consola del navegador) con `{id:'p1', nombre:'Escritorio ejecutivo NOGAL MACIZO con cajonera', medidas:'300x120x75', material:'Nogal macizo 38 mm', cantidad:20, precioUnitario:9000}`.
3. Margen calculado = (9000−6000)/9000 = 33 % ≥ 30 % ⇒ `ALLOWED`, `approval_required=false`. Se crea la revisión `generado_v2` con el nogal y `asignar_folio_oficial` devuelve `VH-AAAA-NNNNN`.
4. Resultado: un documento oficial promete nogal 300×120 a un precio calculado con el costo de la melamina 120×60. Dirección nunca ve esa versión.

**Precondición:** el renglón tiene que tener costo persistido, es decir, el último en guardar fue Dirección o Diseño. Si el vendedor guardó al final, VH-035 borró el costo y el gate falla cerrado (`ECONOMICS_INCOMPLETE`; la prueba lo cubre como control).
**Exposición actual:** las 1588 cotizaciones están en `borrador`, ninguna tiene `folio_oficial` y sólo hay 1 aprobación de cotización. No hay evidencia de que se haya explotado. Lo clasifico como P1 y no como P0 por eso y porque requiere un empleado con sesión que manipule la RPC.
**Corrección propuesta:**
- (a) Que el servidor arme el snapshot a partir de la fila persistida, y que el cliente sólo mande lo comercial: precio, descuento y servicios.
- (b) Mínimo: en `evaluar_emision_cotizacion`, exigir por renglón que `jsonb_sin_economia(snapshot_line) - {precioUnitario, descuento, descuento_solicitado, importe}` sea igual a lo mismo del renglón persistido. También exigir que `producto_id`/`producto_version_id` del snapshot coincidan con los persistidos. Si difieren: `linea_N_no_corresponde_a_lo_costeado` y BLOCKED.

  Cuando se corrija, el caso "DEFECTO VIGENTE" de la prueba debe invertirse para esperar `BLOCKED`.

### SEG-02 · P2 · El vendedor lee el margen mínimo y los pisos internos por REST

**Evidencia:**
- `pg_policies`: `reglas.reglas_leer` → `SELECT … qual true`; `lista_precio_items.pm_lpi_sel` → `SELECT … qual true`.
- Datos (sólo conteos): `reglas` activa `precio:margen_min` con valor; `(reglas.valor::text = reglas_comerciales_vigentes()->>'margen_minimo_pct') = true`; `lista_precio_items.piso_minimo` con valor en 1639 de 1931 filas.
- La intención del sistema es ocultarlos. `politica_comercial_publica()` expone sólo `descuento_max_sin_aprobacion`. `config_sanitizada` quita `margenMinimo`. `cotizar-servidor` sólo devuelve `margen_minimo_pct` a Dirección y nunca devuelve el piso. `reglas_comerciales` exige `puede_ver_economia()`. En el SQL, el piso de especiales se llama `piso_minimo_interno`.

**Explotación:** `GET /rest/v1/reglas?clave=eq.margen_min&select=valor` y `GET /rest/v1/lista_precio_items?select=producto_id,precio_lista,piso_minimo` con la sesión de vendedor. El vendedor conoce el umbral exacto de aprobación de cada producto y el margen mínimo de la empresa, y puede negociar justo en el límite. Con `piso = costo/(1−margen_min)`, la fórmula de especiales, también podría despejar el costo. Esto último **no lo verifiqué** para lista: no hay filas que crucen `lista_precio_items` con `producto_version_economia`, y la razón piso/lista tiene 208 valores distintos.
**Corrección:** que `reglas_leer` excluya las claves económicas (o un `USING` por `ambito`) o mover `margen_min` a `reglas_comerciales`. Revocar SELECT de la columna `piso_minimo` para `authenticated` (dejarla sólo a SECURITY DEFINER y service role) o filtrar por `puede_ver_economia()`.

### SEG-03 · P2 · Diseño ve margen y precio real en revisiones emitidas

**Evidencia:**
- `revisiones_lee` = `puede_editar_config()` (dirección o diseño). `column_privileges` da SELECT de `snapshot` a `authenticated`.
- `private_api.revisiones_seguras`: `case when public.puede_editar_config() then r.snapshot else jsonb_sin_economia(r.snapshot)`. Usa `puede_editar_config`, no `puede_ver_economia`. En cambio `cotizacion_revisiones_seguras` y `cotizacion_segura` usan `puede_ver_economia()`: hay una inconsistencia entre RPC hermanas.
- Datos: 21 renglones de `cotizaciones_revisiones.snapshot.partidas` tienen `margen`, `precioReal`, `costoDerivado` y `costoUnitario`. 1 fila de `cotizaciones.totales` tiene `margen`. `cotizaciones_lee` permite a diseño SELECT de `totales` y `acomodo` (se excluyó `partidas`, pero no `totales`).

**Explotación:** un usuario de Diseño (hay 3) consulta `GET /rest/v1/cotizaciones_revisiones?select=snapshot` o `rpc/revisiones_seguras` y obtiene márgenes y precio real. `costear-servidor` documenta que Diseño debe ver "costo técnico, SIN información financiera (sin precioVenta, sin margen)".
**Corrección:** `revisiones_seguras` debe usar `puede_ver_economia()`. `revisiones_lee` debe ser `puede_ver_economia()` o la columna `snapshot` debe revocarse a `authenticated`, dejando la lectura por RPC. Revocar SELECT de `cotizaciones.totales` y `acomodo` a `authenticated` (la lectura ya va por `cotizacion_segura`).
*Nota:* si Dirección decide que Diseño sí puede ver márgenes, esto baja a P3 de consistencia.

### SEG-04 · P2 · Edge Functions de IA y video sin control de rol o de cuota

**Evidencia (código desplegado o del repo):**
- `costear-vision` (desplegada v4, **no está en el repo**): no hay `getUser` ni consulta a `permitidos`, tampoco rate-limit ni límite de tamaño de `image`. Llama `claude-opus-5` con `effort:"high"` y `max_tokens:6000`. Sólo la protege `verify_jwt:true`.
- `generar-video` (`supabase/functions/generar-video/index.ts:20-97`): no hay `getUser`, `permitidos` ni rate-limit. Lanza Veo (`predictLongRunning`) con el prompt del cliente. `accion:'estado'` concatena `operacion` del body en la URL de Gemini con la llave del servidor (`:55`).
- `leer-plano-core` y `leer-plano-core-rc` (`index.ts:95-110`): no autentican. El comentario dice "El wrapper `leer-plano` autentica, rate-limita". Pero están desplegadas con `verify_jwt:true` y son invocables directamente desde `/functions/v1/leer-plano-core`, así que cualquier sesión se salta el límite de 30 por hora del wrapper.
- `voni-council` (`index.ts:23-41`): valida `permitidos`, pero no tiene rate-limit. Hace hasta 3 llamadas (Anthropic, Gemini y OpenAI) por request con 120 KB de contexto. `analizar-negocio` sí limita a 30 por hora y usuario.
- Llave anon: el cliente usa `sb_publishable_…`, que no es JWT. No encontré un JWT anon heredado en el repo, su historial ni `app/index.html` público (búsqueda de patrón, sin imprimir llaves). Por eso hace falta una **sesión real**.

**Explotación:** cualquier usuario con sesión (o una cuenta nueva si el registro estuviera abierto, ver §4) lanza en bucle `costear-vision`, `generar-video` o `leer-plano-core`. Resultado: costo sin tope en Anthropic y Google (denial-of-wallet). No hay fuga de datos.
**Corrección:** copiar el envoltorio de `leer-plano-strict` y `analizar-negocio` (getUser + `permitidos` + `ai_eventos` 30/h usuario y 200/h global + tope de bytes). Que `leer-plano-core` exija un secreto interno (cabecera compartida) o `service_role`. Retirar `costear-vision` y `generar-video` si ya no se usan; el cliente no las referencia (`grep` sin resultados en `src/`).

### SEG-05 · P2 · La bitácora de aprobaciones es editable por Dirección

**Evidencia:** `aprobaciones.aprob_upd` → `UPDATE USING private_api.es_direccion() WITH CHECK private_api.es_direccion()`. `column_privileges` da UPDATE de todas las columnas a `authenticated` (`estado`, `revision_hash`, `resuelto_por`, `resuelto_en`, `reglas_version`…). `resolver_aprobacion` sí es correcta: atómica con `WHERE estado='PENDIENTE'`, fija `resuelto_por = jwt.email` y sólo Dirección la ejecuta. El problema es que existe el camino directo.
**Explotación:**
- `PATCH /rest/v1/aprobaciones?id=eq.N {estado:'APROBADA', resuelto_por:'otro.director@…'}`: re-aprueba una RECHAZADA o atribuye la firma a otra persona.
- `PATCH {revision_hash:'<hash de otra versión>'}`: aprueba una versión que nadie revisó.

Con 7 cuentas de Dirección (incluida QA), la evidencia de "quién aprobó" no es confiable. Está relacionado con el caso conocido de las aprobaciones de QA.
**Corrección:** eliminar `aprob_upd` (las resoluciones van sólo por `resolver_aprobacion`). Revocar UPDATE de `aprobaciones` a `authenticated`. Opcional: trigger append-only.

### SEG-06 · P3 · `asignar_folio_oficial` despoja la economía (familia VH-035, nueva vía)

**Evidencia:** `asignar_folio_oficial` (SECURITY DEFINER) hace `update public.cotizaciones set folio_oficial = …`. El trigger `trg_strip_seller_economics` lee `auth.jwt()` (el del vendedor) y ejecuta `jsonb_sin_economia(partidas)`. La prueba lo demuestra: después del folio, `partidas[0].costoUnitario` es `undefined`.
**Impacto:** si después se reabre o re-evalúa la cotización, cae en `ECONOMICS_INCOMPLETE`. Falla cerrada, pero se pierde el costo de Dirección. **No** es la vía de guardado de VH-035 y PROPUESTA_vh035c no la cubre explícitamente. Hay que verificar si la preservación de economía de vh035c también aplica a este UPDATE.

### SEG-07 · P3 · `private_api.catalogo_motor` sin chequeo de rol

**Evidencia:**
- `has_function_privilege('anon'|'authenticated', 'private_api.catalogo_motor', 'EXECUTE') = true`.
- `has_schema_privilege('authenticated','private_api','USAGE') = true`: se necesita, porque los wrappers INVOKER y las políticas la usan.
- El cuerpo devuelve `precio`/`precioBase` de todos los insumos sin validar rol.
- El wrapper `public.catalogo_motor` sí valida (`service_role` o `puede_editar_config()`).
- `pg_graphql` no está instalado y el cliente nunca llama `.schema('private_api')`.

**Riesgo:** si alguien agrega `private_api` a los esquemas expuestos de PostgREST, cualquier vendedor leería todos los costos. **No pude verificar** la lista de esquemas expuestos (no está en `pg_db_role_setting`).
**Corrección:** `revoke execute on function private_api.catalogo_motor(boolean,text[]) from anon, authenticated;`. Sus llamadores son SECURITY DEFINER propiedad de `postgres` y no necesitan el grant. Revisar igual `private_api.insumo_motor` y `current_request_email` (anon = true).

### SEG-08 · P3 · Políticas permisivas (`true`) entre usuarios

**Evidencia (`pg_policies`):**
- `clientes` y `contactos`: SELECT, INSERT y UPDATE `true`.
- `escenarios`: SELECT, INSERT y UPDATE `true` (en cambio `proyectos` sí aísla por `vendedor_responsable`).
- `confirmaciones`: INSERT `true`, sin fijar `confirmado_por`.
- `shadow_costeo`: INSERT `true`.
- `aprendizajes` y `reglas`: SELECT `true`.

**Datos:** `clientes` 0, `contactos` 0, `escenarios` 0 y `confirmaciones` 91 filas.
**Impacto:** hoy es bajo (tablas vacías). Cuando el CRM se use, un vendedor podrá leer y modificar los clientes, contactos y escenarios de otro. En `confirmaciones` se puede falsificar la atribución, pero es sólo una bitácora y ningún gate la consume (`grep`). En `shadow_costeo` se pueden contaminar los datos de comparación.
**Corrección:** `escenarios` debe heredar la visibilidad del proyecto (`EXISTS proyectos …`). En `confirmaciones`, `with check (confirmado_por = jwt.email)` o un trigger de autor como `revisiones_autor`. Decidir si el CRM es compartido o por vendedor.

### SEG-09 · P3 · Storage

**Evidencia:**
- `storage.buckets`: `app` (public, 242 objetos, sin límite de tamaño ni MIME), `catalogo` (public, 0) y `renders` (public, 20 MB, png/jpeg/webp, 55 objetos).
- Políticas: `app_public_read` y `catalogo_public_read` son `SELECT` para el rol `public`, así que anon puede **listar**. `renders_insert` es `INSERT authenticated with check bucket_id='renders'`, sin restricción de ruta.
- Contenido de `app`: `render-ia/<línea>/<pieza>.jpg`, `catalogo/`, `silleria/`, `marca/` e `index.html` (2026-08-12). No vi datos de clientes en los nombres.
- `renders`: rutas `generated/<correo_usuario>/<fecha>/<uuid>.jpg`.

**Impacto:**
- Anon puede enumerar `app`; hoy sólo hay material de catálogo y marca.
- Un render compartido con un cliente expone el correo del empleado en la URL.
- Cualquier usuario autenticado puede subir imágenes a cualquier ruta de `renders`. No puede sobrescribir (no hay UPDATE ni DELETE), pero sí hospedar contenido público.
- La función `app` (`verify_jwt:false`) sirve un `index.html` de agosto. Las barreras de servidor siguen aplicando, pero es código viejo publicado.

**Corrección:** quitar la política SELECT de `app` y `catalogo` (los objetos públicos se sirven sin política; la política sólo habilita listar). En `renders_insert`, restringir el prefijo `(storage.foldername(name))[2] = replace(jwt.email,'@','_')`. Usar UUID en lugar del correo en la ruta. Retirar la función `app` si ya no se usa.

### SEG-10 · P3 · Funciones desplegadas sin código en el repo

**Evidencia (`list_edge_functions`):** `app`, `costear-vision`, `bootstrap-temp-claude`, `analizar-mueble-strict`, `leer-plano-strict`, `acomodar-espacio-strict`, `generar-render-strict`, `voni-council-health`, `analizar-mueble-preview` y `costear-compras-rc`.

**Revisadas:**
- `bootstrap-temp-claude`: neutralizada (responde 410).
- `app`: proxy de HTML.
- `costear-vision`: ver SEG-04.
- `costear-compras-rc`: mismo patrón seguro que `costear-servidor`.
- `voni-council-health`: getUser + `permitidos` (usa `ilike` sobre el correo, trivial).
- `generar-render-strict` y `leer-plano-strict`: getUser + `permitidos` + rol (+ rate-limit en `leer-plano`).
- `analizar-mueble-preview`: tiene getUser, `permitidos` y límites (por conteo de marcadores, sin lectura completa).

**No revisadas:** `analizar-mueble-strict` y `acomodar-espacio-strict`.
**Corrección:** volcar el código de todas al repo (como se hizo con `voni-council` y `cotizar-servidor`) y borrar las que no se usan.

### SEG-11 · P3 · Gestión de usuarios y roles

**Evidencia:**
- `permitidos`: la única constraint es `PRIMARY KEY (email)`; no hay CHECK de `rol`.
- `permitidos_modificar_{insert,update,delete}` permiten a `es_direccion()` todo por REST. Los candados de `supabase/functions/usuarios/index.ts:76-79, 105, 109-111, 120-125` (rol en lista blanca, no cambiarte tu rol, no quitar al último Dirección) sólo existen en la Edge Function.
- Conteo de roles: dirección 7, diseño 3, vendedor 1. Las 11 cuentas de `auth.users` están en `permitidos`.

**Impacto:** un Dirección puede degradar o eliminar a todos los demás Dirección, o escribir un rol arbitrario. Un rol fuera de lista no recibe economía ni pasa las RPC, así que falla cerrado. Que 64 % de las cuentas sean Dirección amplía mucho la superficie (SEG-05).
**Corrección:** `CHECK (rol in ('direccion','diseno','vendedor'))`. Un trigger que impida quedar con 0 Dirección y que alguien cambie su propio rol. Revisar si la cuenta QA debe tener rol Dirección en producción.

### SEG-12 · P3 (funcional) · La ruta de especiales de `cotizar-servidor` siempre falla

**Evidencia:** `has_function_privilege('authenticated','public.resolver_precio_especial_proyecto(...)','EXECUTE') = false`, y `cotizar-servidor/index.ts:173` la llama con `userClient` (el JWT del usuario). Las líneas especiales terminan como `sin_precio_autorizado`.
Desde el punto de vista de seguridad está **bien** que `authenticated` no tenga EXECUTE, porque la función devuelve `costo_interno` y `piso_minimo_interno`. La corrección va en la Edge: llamarla con `svc` y validar el rol en la Edge, nunca dar EXECUTE a `authenticated`.

---

## 3. Lo que está bien (verificado)

- **RLS habilitado en las 34 tablas de `public`.** Las 3 vistas (`catalogo_vigente`, `cotizaciones_integridad`, `proyectos_salud`) son `security_invoker=true`. `anon` no tiene ningún privilegio de tabla en `public`.
- **Costos de insumo y catálogo:** `insumo_precios`, `insumos_catalogo`, `insumo_mapeos_externos` y `config` sólo los lee `puede_editar_config()`. `producto_version_economia` y `reglas_comerciales` sólo `puede_ver_economia()`. `direccion`, `shadow_costeo` (SELECT) y `permitidos` (ajeno) sólo Dirección. `public.catalogo_motor`, `buscar_insumos_motor` y `resolver_costo_insumo` validan rol dentro.
- **Cotizaciones:**
  - El vendedor no puede leer la tabla directamente (`cotizaciones_lee` = `puede_editar_config`, y la columna `partidas` no tiene grant SELECT).
  - Por RPC (`cotizacion_segura`, `cotizaciones_seguras`, `cotizaciones_mias`) sólo ve lo suyo y sin economía.
  - El UPDATE directo con filtro no alcanza filas que el vendedor no puede ver, y `safeupdate` está precargado en `authenticator`, lo que bloquea un PATCH sin filtro.
  - `trg_guard_cotizacion_estado_directo` impide forjar `estado` o `folio_oficial` por REST.
  - `crear_/actualizar_cotizacion_segura` validan rol, dueño, estado, folio y propietario.
  - Nota: **no existe ninguna función `guardar_cotizacion*`** en producción; el guardado son estas dos.
- **Economía del vendedor fail-closed:** `trg_strip_seller_economics` aplica `jsonb_sin_economia` (regex amplia `costo*|margen*|utilidad*|proveedor*…`) en INSERT y UPDATE de vendedores, también en revisiones. El gate trata la falta de costo como `ECONOMICS_INCOMPLETE` y la falta de política como `BLOCKED`.
- **Aprobaciones por RPC:** `resolver_aprobacion` es exclusiva de Dirección, atómica y no permite doble resolución. `verificar_aprobacion` exige `hash` y `reglas_version` exactos. El vendedor no puede insertar aprobaciones directamente: la subconsulta de `aprob_ins` sobre `cotizaciones` respeta su RLS y devuelve vacío.
- **Carreras:**
  - Doble emisión: `pg_advisory_xact_lock(cotizacion_id)` + `UNIQUE (cotizacion_id, revision)` + deduplicación por hash.
  - Doble folio: `FOR UPDATE` + índice único parcial `folio_oficial`.
  - Doble aprobación: `UPDATE … WHERE estado='PENDIENTE'`.
  - Solicitudes de aprobación concurrentes podrían duplicar un PENDIENTE (no hay índice único); hoy hay 0 duplicadas y es inocuo.
  - Autosave concurrente: ver VH-148 (sin cambios).
- **SECURITY DEFINER:** todas las de `public` y `private_api` tienen `search_path` fijado. `anon` no tiene EXECUTE en ninguna de `public`. Las 10 que señala el advisor de Supabase (`aprobar_precio*`, `cargar_erp_ultima_compra`, `certificar_version`, `cerrar_vigencia_precio`, etc.) validan `puede_certificar_costo()` (sólo Dirección) dentro. Algunas usan `search_path=public` sin `pg_temp` explícito; no es explotable sin acceso SQL directo.
- **Precios ERP:** `insumo_precios` es append-only (`trg_insumo_precios_append_only`), tiene `trg_precio_no_autofirma` y la aprobación es sólo de Dirección.
- **Edge Functions núcleo** (`costear-servidor`, `cotizar-servidor`, `analizar-negocio`, `leer-plano`, `generar-render`, `usuarios`):
  - Identidad desde el JWT (`auth.getUser`) y rol desde `permitidos` con service role; nunca del body.
  - `costear-servidor` rechaza dinero en el DTO (`validarIntentCosteo`) y rechaza `material_confirmado` de quien no tiene capacidad (403). La salida depende del rol.
  - `voni-council` y `analizar-negocio` usan prompts del sistema, salidas con esquema JSON y modo PROPOSAL_ONLY. No ejecutan herramientas, así que la inyección de prompt no alcanza acciones.
  - CORS es `*`, aceptable porque la autenticación es por Bearer y no por cookie.
- **Cliente (`src/nube.js`):** el rol sólo se usa en la UI (`permitidos` de su propia fila). Toda decisión de economía o emisión se toma en el servidor (`config_para_rol`, `cotizacion_segura`, `evaluar_emision_cotizacion`).

---

## 4. Sospechas no verificadas y límites

1. **Registro de usuarios abierto (GoTrue `disable_signup`).** No es consultable por SQL. Hoy las 11 cuentas están en `permitidos` y no hay hooks ni triggers en `auth`. Si el registro estuviera abierto, cualquiera crearía una sesión y, con las políticas `true` (SEG-08), leería `lista_precio_items` (pisos), `reglas` (margen mínimo), `producto_versiones` y `aprendizajes`, además de invocar las Edge de SEG-04. **Verificar en Auth > Providers que "Allow new users to sign up" esté apagado.** Si está abierto, SEG-02 y SEG-04 suben a P1.
2. **Esquemas expuestos de PostgREST** (afecta SEG-07): no pude leerlos. El cliente no usa `private_api`.
3. **`generar-video`, `accion:'estado'`:** `operacion` es una ruta libre sobre `generativelanguage.googleapis.com` con la llave del servidor anexada. El host es fijo, así que no hay SSRF a terceros. Exfiltrar la llave requeriría que Google devolviera una `uri` controlada por el atacante. No lo verifiqué.
4. **`generar-render-strict`** marca `geometry_validation='PASS'` aunque no se haya pedido validación crítica (requisitos elegidos por el cliente). Es integridad de metadatos de renders, no de dinero. Sin profundizar.
5. **No revisé línea por línea** `analizar-mueble(-rc/-strict)`, `acomodar-espacio(-strict)`, `cotizar-texto(-rc)` ni `generar-render`. Por conteo sí tienen getUser, `permitidos` y límites.
6. No ejecuté nada contra producción con credenciales de usuario. Las explotaciones de SEG-02, SEG-03 y SEG-05 se deducen de `pg_policies` + `column_privileges` + conteos, no de una llamada REST real.

---

## 5. Archivos de esta auditoría

- `docs/auditoria/SEGURIDAD_10.md` (este informe).
- `supabase/tests/seguridadGateEmisionSnapshot.test.js`: prueba PGlite con 5 casos que pasan con el SQL actual de producción.
  - md5 de las 6 funciones de `private_api` igual a producción.
  - Control: margen bajo ⇒ `APPROVAL_REQUIRED`.
  - Control fail-closed: costo despojado ⇒ `ECONOMICS_INCOMPLETE`.
  - **Defecto SEG-01:** snapshot con otro producto ⇒ `ALLOWED` + revisión `generado_v2` + folio oficial.
  - **SEG-06:** el folio borra el costo de Dirección.
- `supabase/tests/fixtures/private_api_emision_prod_20261013.sql`: cuerpos exactos de producción de `evaluar_emision_cotizacion`, `emitir_revision_v2`, `hash_revision`, `verificar_aprobacion`, `requiere_aprobacion_snapshot` y `asignar_folio_oficial` (md5 en la cabecera).

Ejecutar: `npx vitest run supabase/tests/seguridadGateEmisionSnapshot.test.js`.

No escribí migraciones `PROPUESTA_seg_*`: las correcciones de SEG-01 dependen de definir qué campos del snapshot son libres (decisión de producto), y las demás son REVOKE o ajustes de política descritos arriba.
