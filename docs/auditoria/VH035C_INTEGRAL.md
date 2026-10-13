# VH-035c · Preservación INTEGRAL de la economía (2026-10-13)

Rama `claude/costing-app-architecture-psf02g`. **Producción no cambió**: nada se aplicó, no se corrió `supabase`
CLI ni `apply_migration`. Todo es base aislada (PGlite = PostgreSQL real en WASM) con los cuerpos SQL leídos de
producción el 2026-10-13 (`supabase/tests/fixtures/private_api_prod_20261013.sql`), los triggers reales de
`public.cotizaciones` y, novedad de este corte, la **compuerta de emisión real** (`private_api.evaluar_emision_cotizacion`,
`cotizacion_emitible`, `emitir_revision_v2`, `hash_revision`, `requiere_aprobacion_snapshot`, `verificar_aprobacion`,
tomados de `supabase/schema/baseline/08_private_api.sql` con sus wrappers de `03_funciones.sql`).

Entregables:

- `supabase/migrations/PROPUESTA_vh035c_preserva_economia_integral.sql` (prefijo `PROPUESTA_`, nunca se aplica solo;
  autocontenida; rollback al final). Sustituye a `20261010170000` y a `PROPUESTA_vh035b`.
- `supabase/tests/preservaEconomiaIntegral.test.js` — **44 casos, todos en verde** (39 sobre vh035c, 12 de ellos del §9
  STALE por definición, + 5 de referencia sobre vh035b que documentan por qué hacía falta la c). `npx vitest run supabase/tests/preservaEconomiaIntegral.test.js` ≈ 5–15 s.
- `supabase/tests/preservaEconomia.test.js` intacto (24 casos: 23 ✓ + 1 `it.fails` intencional) como documentación de vh035b.
- Verificación de apilado (script efímero, no versionado): base + `20261010170000` + vh035b + vh035c → misma conducta que
  vh035c sola (economía anidada íntegra, re-pin rechazado).
- **Composición con VH-148 (§8)**: `supabase/tests/composicionVh035cVh148.test.js` — 21 casos, ambos órdenes de
  aplicación y rollback de cada archivo. **Orden de aplicación con VH-148: cualquier orden.**
- **Nube falsa**: `crearNubeFalsa({ preservaEconomia: 'vh035c' })` en `e2e/nubeFalsa.js` (espejo JS; paridad SQL↔espejo en
  `supabase/tests/espejoNubeFalsaVh035c.test.js`, 27 casos) y `e2e/persistenciaVh035c.e2e.js` (5 escenarios en Chromium).
- **§9 (corrección 2026-10-13): STALE por DEFINICIÓN** — cierra el riesgo de composición con SEG-01
  (`docs/auditoria/SEGURIDAD_10.md` § Riesgos 1): el vendedor ya no puede guardar otro nombre/medidas conservando el costo
  de Dirección y emitirlo con folio.

## 1. Qué cambia respecto a vh035b (decisión de Dirección: corregir el diseño antes de aplicar)

| # | Regla vh035c | Mecanismo |
|---|---|---|
| 1 | Economía **anidada** se preserva (`config.costeo`, `config.insumos[].costo`, `pieza.componentes[].costo`, cualquier clave que `jsonb_sin_economia` quite a cualquier profundidad) | `private_api.repegar_economia(vieja, nueva)`: recursiva; arreglos casados por `id`/`piezaId`/`clave`/`key`/`codigo` si la clave es única, si no por igualdad exacta de la forma sin economía |
| 2 | **STALE por identidad**: `producto_id`, `producto_version_id`, `piezaId`, `bom_hash` **y material** a cualquier profundidad (`material*`, `acabado*`, `finish`, `insumoId`, `insumo_id`, `clave`, `sku`, `color`, `espesor`, `calibre`, `tela`, `textura`, `bom`) | `campos_identidad_cambiados` + `campos_material_cambiados` (huella `{ruta → valores}` insensible al orden de arreglos). Resultado: `cost_status:'UNKNOWN'` + `cost_stale:{motivo, campos, previo, economia_previa}` |
| 3 | **STALE por lote**: cambia `cantidad` y la economía guardada depende del lote | Contrato mínimo: `costo_por_lote:true` (o `economia_por_lote:true`) **o** `costoLote`/`costoLoteConMerma` a cualquier profundidad (`private_api.economia_por_lote`). Sin marca → el costo unitario se conserva aunque cambie la cantidad |
| 4 | **Re-pin sin validación**: el rol sin economía no elige versiones | Partida existente con identidad guardada: cambiar `producto_id`/`producto_version_id` → **raise** `identidad de producto protegida` (42501). Renglón nuevo o ligado por primera vez: `producto_id` debe existir (si no, raise) y `producto_version_id` se fija a `productos.version_tecnica_vigente_id`; si el cliente mandó otra → `cambios_rechazados:[{campo:'producto_version_id', motivo:'VERSION_FIJADA_POR_SERVIDOR'}]` |
| 5 | **Estados de autoridad y procedencia** sobreviven al guardado del rol sin economía | Clase AUTORIDAD (`aprobado`, `aprobado_por`, `aprobado_en`, `aprobacion`, `estado_costo`, `precio_autorizado`, `precioAutorizado`): nunca escribible; en partida existente gana lo guardado, en nueva sólo se admite `false`/`null`. Clase PROCEDENCIA (`lista_precio_item_id`, `listaPrecioItemId`, `precio_lista_snapshot`, `source_type`, `source_ref`, `price_status`, `identity_status`, `product_status`, `product_source_ref`, `economia_por_lote`): congelada en partida existente, libre en renglón nuevo. `cost_status`/`costoEstado`/`costoPendiente` son economía (`^cost`): se re-pegan; en STALE `cost_status→UNKNOWN` y el resto va a `cost_stale.economia_previa`. Cada rechazo → `cambios_rechazados:[{campo, motivo}]` (sin valores) |
| 6 | **Compuerta**: una partida STALE no se certifica ni se emite | `public.evaluar_emision_cotizacion` (wrapper INVOKER, misma firma) suma `linea_N_recosteo_pendiente_<motivo>` leídos de la **fila** (`private_api.motivos_recosteo_pendiente`, SECURITY DEFINER con las mismas comprobaciones de acceso) y degrada a `ECONOMICS_INCOMPLETE` (si ya era `BLOCKED`, los añade a `economics`) |

### Por qué rechazar y no revertir en el punto 4

Revertir en silencio dejaría una fila incoherente que el cliente no ve: `precioUnitario` del producto B (el que el vendedor
cree haber elegido) sobre la identidad del producto A, con autoguardado "exitoso". Dirección vería un renglón mentiroso y
la compuerta lo atraparía sólo al emitir (precio ≠ precio autorizado de la versión A). Rechazar (`42501`) hace que el cliente
se entere en el acto; cambiar de producto en un renglón existente = quitarlo y agregar uno nuevo (id nuevo), que es el flujo
natural del contrato de partida (`crearPartida`). Para renglones nuevos no hay verdad previa que proteger, así que ahí el
servidor **corrige** (fija la versión vigente) en vez de rechazar, y lo anota.

### Por qué `economia_previa` vive dentro de `cost_stale`

`jsonb_sin_economia` esconde al vendedor las claves con prefijo `cost`/`costo`. Un `economia_previa` de primer nivel sería
visible como clave (vacía, pero visible) y el vendedor podría mandarla de vuelta; dentro de `cost_stale` desaparece entera
de su vista y se re-pega íntegra en sus guardados posteriores. El test "la marca STALE es economía" afirma que el JSON
que recibe el vendedor no contiene `cost_stale`, `economia_previa`, `21000` ni `costo`.

## 2. Matriz de casos (PGlite)

Columnas: **Prod** = producción hoy (fixture 2026-10-13) · **2026-10-10** = migración pendiente `20261010170000` ·
**vh035b** · **vh035c**. Las columnas Prod/2026-10-10 vienen de `preservaEconomia.test.js`; vh035b/vh035c de ambos archivos.

| Caso (rol sin economía = vendedor y diseño, salvo nota) | Prod | 2026-10-10 | vh035b | vh035c |
|---|---|---|---|---|
| Cambia cantidad; partida con economía de primer nivel | economía **perdida** (diseño además la **pisa** si su cliente trae costo) | 1er nivel íntegro | igual | igual |
| Cambia cantidad; economía **anidada** (`config.costeo`, `insumos[].costo`, `componentes[].costo`) | todo perdido | anidado **perdido** | anidado **perdido** | **todo íntegro** (test `[1]` ×2 roles) |
| Reordena insumos (con clave) / componentes (sin clave) | perdido | anidado perdido | anidado perdido | cada elemento recupera su costo; sin STALE |
| Quita un componente del despiece | perdido | 1er nivel re-pegado (costo de un BOM que ya no es) | igual | **STALE** `RECOSTEO_MATERIAL_CAMBIADO`, campos `['.pieza.componentes[*].insumoId']` |
| Cambia `piezaId`/`bom_hash` (mismo id) | perdido | **re-pega** 21000 KNOWN | UNKNOWN + `cost_stale` (sin economía previa) | UNKNOWN + `cost_stale` **con `economia_previa` completa** (1er nivel + anidada); anidado no se hereda |
| Cambia material (`config.finish`, `insumos[].clave`, `componentes[].insumoId`) | perdido | re-pega 21000 KNOWN | **re-pega 21000 KNOWN** (ref. vh035b) | **STALE** `RECOSTEO_MATERIAL_CAMBIADO`, `campos` con la(s) ruta(s) |
| Cambia cantidad; costo **por lote** (`costo_por_lote:true` o `costoLote` anidado) | perdido | re-pega costo unitario del lote viejo | **re-pega** (ref. vh035b) | **STALE** `RECOSTEO_LOTE_CAMBIADO`, `previo.cantidad`; la silla sin lote conserva 1400 |
| Misma cantidad en la partida por lote (sólo precio) | perdido | conserva | conserva | conserva (incluido `costoLote` anidado) |
| Cambia `nombre`, `medidas`, `w`/`d`, `nota`, `config.ancho`, `render` o cualquier clave **no comercial** fuera de identidad/material (§9) | perdido (falla cerrado) | **re-pega** KNOWN | **re-pega** KNOWN | **STALE** `RECOSTEO_DEFINICION_CAMBIADA`, `campos` = claves de 1er nivel (antes de §9: re-pegaba KNOWN ⇒ SEG-01 reabierto) |
| Cambia sólo `precioUnitario`/`precio_unitario`/`descuento`/`descuento_solicitado`/`importe` | perdido | conserva | conserva | conserva, KNOWN, emitible |
| Cambia `producto_version_id` 1933→9999 en partida existente | **persiste 9999** | persiste 9999 + re-pega costo | persiste 9999, UNKNOWN + `cost_stale` (ref. vh035b) | **rechazado** (`identidad de producto protegida`), nada se escribe |
| Cambia `producto_id` 1→2 en partida existente | persiste | persiste + re-pega (defecto, `it.fails`) | persiste, UNKNOWN + `cost_stale` | **rechazado** |
| Liga partida legacy (sin producto) a `producto_id 2, versión 9999` | persiste 9999 | persiste 9999 + costo viejo | persiste 9999, STALE | se admite; versión **fijada a 2044** + `cambios_rechazados`; STALE `RECOSTEO_PRODUCTO_CAMBIADO` |
| Renglón nuevo con `producto_id 2, versión 9999` / sin versión / `producto_id 77` inexistente | 9999 pasa / pin pone 2044 / 77 pasa | igual | igual | 2044 + `cambios_rechazados` / 2044 / **rechazado** `producto_id 77 no existe` |
| Pisa `aprobado`, `aprobado_por`, `estado_costo`, `precio_autorizado`, `lista_precio_item_id`, `precio_lista_snapshot`, `source_*`, `price_status`, mete `aprobacion` | **todo se pisa** | todo se pisa | **todo se pisa** (ref. vh035b) | **todo intacto**; `cambios_rechazados` lista los 10 campos sin valores (×2 roles) |
| Renglón nuevo con `aprobado:true, estado_costo:'completo'` + `precioAutorizado:false` + procedencia | pasa | pasa | pasa | autoridad afirmativa **quitada** (anotada); `precioAutorizado:false` y procedencia se respetan |
| STALE con autoridad (`aprobado:true`) | n/a | n/a | n/a | `cost_status UNKNOWN`, `costoEstado`→`economia_previa`, `aprobado`/`estado_costo`/`lista_precio_item_id` intactos |
| Vendedor hostil: cuela costo/margen/`cost_status`/`cost_stale`/`config.costeo`/`cambios_rechazados` falsos; `estado:'emitida'`, `folio_oficial` arriba | arriba rechazado; abajo todo perdido | arriba rechazado; 1er nivel de Dirección gana | igual | arriba rechazado; **toda** la economía de Dirección gana (anidada incluida); `cost_stale`/`cambios_rechazados` falsos descartados; p3 nuevo UNKNOWN; `precioUnitario` sí es suyo |
| Dirección guarda normalmente | puede | puede | puede | puede: cambia costo/producto/versión, quita `cost_stale`; sin fusión ni `cambios_rechazados` |
| **Emisión** de partida canónica STALE (`cotizacion_emitible` / `emitir_revision_v2`) | n/a | **ALLOWED** (compuerta no mira cost_status) | **ALLOWED, se emite** (ref. vh035b) | `ok:false`, `ECONOMICS_INCOMPLETE`, `linea_1_recosteo_pendiente_material_cambiado`; `emitir_revision_v2` **raise**; tras recostear Dirección → ALLOWED, revisión 2 |
| Emisión de partida legacy STALE | ya bloqueada (`costo_desconocido`) | igual | igual | igual + `recosteo_pendiente_*` |
| Compuerta ya `BLOCKED` por otra causa + STALE | n/a | n/a | n/a | sigue `BLOCKED`; el motivo STALE se suma a `economics` |
| Marca `cost_stale` frente al vendedor | n/a | n/a | invisible, sobrevive | invisible (ni `economia_previa` ni cifras), sobrevive con su `economia_previa` |
| Quitar renglón / escritura cruda sin RPC | quita / strippea | quita / strippea | igual | igual |

## 3. Compuerta exacta que bloquea la certificación de una STALE

Lectura del baseline (`08_private_api.sql`):

- `private_api.evaluar_emision_cotizacion` **no lee `cost_status` ni `cost_stale`**. Para líneas canónicas
  (`producto_id` + `producto_version_id` numéricos) toma el costo de `producto_version_economia.costo_oficial_referencia`;
  para legacy toma `v_dbpt->>'costoUnitario'` de la **fila** y el veredicto `costoEstado` (`preliminar`/`incompleto`/`bloqueado`).
  Por eso una legacy STALE ya cae en `linea_N_costo_desconocido` → `ECONOMICS_INCOMPLETE`, pero una canónica STALE pasa
  `ALLOWED` (el test lo demuestra llamando a `private_api.evaluar_emision_cotizacion` directo).
- `private_api.cotizacion_emitible` → `public.evaluar_emision_cotizacion(id, snapshot_de_la_fila)` y devuelve `ok = state='ALLOWED'`.
- `private_api.emitir_revision_v2` → `v_gate := public.evaluar_emision_cotizacion(...)`; `if v_state <> 'ALLOWED' then raise
  exception 'emitir_revision_v2: emisión bloqueada [%]: %'`.
- `public.normalizar_cost_status_partidas` (trigger `trg_normalize_economics_status`) sólo normaliza vocabulario
  (`KNOWN`, `KNOWN_ZERO`, `ESTIMATED`, `USER_APPROVED_ESTIMATE`, `PENDING_PRICE`, `PENDING_MATERIAL`, `UNKNOWN`,
  `NOT_APPLICABLE`, `NO_ACCESS`, `INVALID`); no bloquea nada. vh035c usa `UNKNOWN` (dentro del vocabulario) y deja la
  semántica en `cost_stale`.

vh035c intercepta en el **wrapper** `public.evaluar_emision_cotizacion` (INVOKER, misma firma y `search_path`): tras llamar a
`private_api.evaluar_emision_cotizacion`, consulta `private_api.motivos_recosteo_pendiente(id)` (SECURITY DEFINER; devuelve `{}`
si el caller no entra o no es dueño/`puede_editar_config`) y, si hay motivos, devuelve `state:'ECONOMICS_INCOMPLETE'` con
`reasons = motivos || reasons_previos` y `recosteo_pendiente:true` (o, si ya era `BLOCKED`, añade los motivos a `economics`).
Como `cotizacion_emitible` y `emitir_revision_v2` pasan por ese wrapper, **ninguna partida con `cost_stale` se emite**
(test "COMPUERTA": revisión 1 antes, raise después, revisión 2 tras recostear). Se eligió el wrapper y no reescribir el cuerpo
de 180 líneas de `private_api.evaluar_emision_cotizacion`: menor superficie, independiente de drift entre baseline y producción.

## 4. Rollback

Está al final de la PROPUESTA, ahora como bloque **ejecutable** entre `-- >>> ROLLBACK VH-035c INICIO` / `FIN` (dentro
de `/* */`, en una transacción). Hace: (1) reinstala `private_api.actualizar_cotizacion_segura(bigint, jsonb)` y
`public.strip_seller_economics_on_cotizacion_write` con los cuerpos de `private_api_prod_20261013.sql` copiados byte a byte
(líneas 39-148 y 150-178); (2) restaura el wrapper de `public.evaluar_emision_cotizacion` de `03_funciones.sql:535`;
(3) `drop function` de las 20 ayudas de `private_api` (16 + 4 del §9); (4) datos: nada; `cost_stale`/`cambios_rechazados` que hayan
quedado son inertes y Dirección los quita al recostear; `vh.economia_preservada` es `set_config` local a la transacción.
**No toca** la sobrecarga de tres argumentos de VH-148 ni `cotizacion_segura`: si VH-148 está aplicada, su control de
versión sigue y delega en el núcleo de producción. Probado en `composicionVh035cVh148.test.js`: tras el rollback,
`md5(pg_get_functiondef)` del núcleo, del trigger de strip y de la compuerta = los de producción.

## 5. Limitaciones residuales

1. ~~**Dimensiones** (`w`, `d`, `largoMM`, `fondoMM`, `piezas` de componentes) no están en la huella de material: cambiarlas
   conserva el costo.~~ **Resuelto 2026-10-13 (§9)**: siguen fuera de la huella de material, pero cualquier cambio no
   comercial invalida por DEFINICIÓN (`RECOSTEO_DEFINICION_CAMBIADA`).
2. `totales`/`acomodo` del rol sin economía se **strippean** (como 2026-10-10 y vh035b), no se re-pegan: su economía
   (costo total, margen global) depende de las partidas y quedaría rancia; Dirección la recalcula al abrir.
3. Elementos de arreglos sin clave se casan por igualdad exacta de su forma sin economía. Desde §9, editar un campo no
   económico de un componente (p. ej. `nombre`) ya es cambio de DEFINICIÓN: toda la partida queda STALE (antes sólo ese
   componente perdía su `costo` anidado y el 1er nivel se re-pegaba). Dos elementos idénticos sin clave reciben la misma
   economía.
4. `cambios_rechazados` es visible al vendedor (a propósito, para la UI) y persiste hasta que Dirección guarde sin él.
5. `estado` **dentro** de la partida sigue sin protección (sólo el de la fila), igual que antes. `precioUnitario` y
   `descuento` siguen siendo del vendedor (la compuerta los valida contra el precio autorizado al emitir).
6. `economia_por_lote` no tiene prefijo económico: el vendedor la ve (como procedencia congelada no puede cambiarla). La
   grafía recomendada es `costo_por_lote` (invisible). **Hoy `App.jsx` no escribe ninguna**: `partidaDeCosteo` corre
   `calcular()` (costo = `costoLoteConMerma / n`) y guarda sólo `costoUnitario`. Sin la marca, vh035c conserva ese costo
   al cambiar la cantidad (como vh035b). La protección del punto 3 sólo es efectiva cuando el cliente de Dirección marque
   `costo_por_lote:true` al costear con el motor (o guarde `config.costeo.costoLote`).
7. Diseño es rol sin economía en el modelo probado (`puede_ver_economia` = sólo dirección, como producción): la fusión le
   aplica igual que al vendedor, así que **diseño tampoco puede re-pinear ni tocar autoridad**. Si Dirección quiere que
   diseño ligue productos a renglones existentes, hace falta una excepción explícita.
8. Harness: `resolver_precio_autorizado` y `resolver_precio_especial_proyecto` son stubs (lista de precios mínima; sin
   expedientes). La compuerta `evaluar_emision_cotizacion` y `emitir_revision_v2` son los cuerpos reales del baseline del
   2026-10-11, no `pg_get_functiondef` del 13 (las dos RPC de guardado sí lo son).
9. ~~**Coordinación con VH-148**: el borrador de VH-148 traía su propio cuerpo sin el bloque VH-035.~~ **Resuelto
   2026-10-13** (§8): la de 3 argumentos ya delega en este núcleo; cualquier orden de aplicación.
10. **Ruido de procedencia** (observado al componer, no corregido): `crearPartida` emite `source_type`, `source_ref`,
   `lista_precio_item_id` y `precio_lista_snapshot` como `null` en todo renglón. Si la partida guardada no tenía esas
   claves, cada guardado del vendedor deja `cambios_rechazados` con 4 entradas `PROCEDENCIA_CONGELADA` (los `null` se
   quitan; nada se pierde). No afecta economía ni emisión, pero la UI que muestre `cambios_rechazados` mostraría ruido.
   Opción: tratar `null` como "no enviado" en la clase PROCEDENCIA (como ya se hace con AUTORIDAD). Decisión pendiente.

## 6. Nube falsa (`e2e/nubeFalsa.js`) — **IMPLEMENTADO 2026-10-13**

Hecho: `crearNubeFalsa({ preservaEconomia: 'vh035c' })` (el default `false` sigue siendo producción, así que
`e2e/persistencia.e2e.js:125` sigue ROJO a propósito). Espejo JS exportado: `fusionarVh035c` (fusión recursiva
`repegarVh035c`, STALE por producto/material/lote, re-pin → 42501, producto inexistente → 23503, `producto_id` basura →
22023, autoridad/procedencia con `cambios_rechazados`), `normalizarCostStatus` (trigger normalize, en INSERT y UPDATE),
`motivosRecosteoPendiente` + `compuertaConRecosteo` aplicados a `cotizacion_emitible`, `evaluar_emision_cotizacion` y
`emitir_revision(_v2)`; `f.productos` (Map id → versión vigente). El control de versión VH-148 corre antes, igual que en SQL.
Paridad: `supabase/tests/espejoNubeFalsaVh035c.test.js` pasa 15 entradas por la SQL real y por el espejo y exige el mismo
resultado o el mismo SQLSTATE y mensaje. Spec: `e2e/persistenciaVh035c.e2e.js` — (1) el escenario de
`persistencia.e2e.js:103` con la nube vh035c → verde sin debilitar la aserción `costoUnitario 21000`; (2) el vendedor cambia
la pieza del renglón por la RPC de tres argumentos → `RECOSTEO_PRODUCTO_CAMBIADO`, "Línea 1: recosteo_pendiente_producto_cambiado"
y "Faltan datos para cotizar" para vendedor y Dirección, PDF = BORRADOR, 0 revisiones, y un segundo guardado con la versión
vieja → 40001 sin cambios; (3) desde la interfaz, botón "+" en un mueble con `costo_por_lote` → `RECOSTEO_LOTE_CAMBIADO` y
emisión bloqueada. Lo que la UI todavía no hace: traducir `recosteo_pendiente_*` a texto humano (sale el código por el
fallback de `textoRazonEmision`) ni mostrar `cambios_rechazados`.

Lista original de requisitos (cumplida):

1. Nueva opción (p. ej. `preservaEconomia: 'vh035c'`) que en la rama `fn === 'actualizar_cotizacion_segura'` sustituya
   `fusionar(c.partidas, sinEconomia(partidas))` por una fusión **recursiva** (`sinEconomia` ya es recursiva; falta el
   `repegar` por `id`/clave/forma idéntica, espejo de `private_api.repegar_economia`).
2. STALE: comparar identidad (`producto_id`, `producto_version_id`, `piezaId`, `bom_hash`), huella de material (misma
   regex de `es_clave_material`, insensible a orden) y lote (`costo_por_lote`/`costoLote` + cambio de `cantidad`); al
   marcar: `cost_status:'UNKNOWN'`, `cost_stale:{motivo, campos, previo, economia_previa}` (y `cotizacion_segura` del
   vendedor la esconde porque `sinEconomia` quita `^cost`).
3. Rechazos: `identidad de producto protegida` (cambio de `producto_id`/`producto_version_id` en renglón existente con
   identidad) y `producto_id N no existe`; para renglón nuevo, un mapa `productos → version_tecnica_vigente_id` (el mock
   hoy no tiene Producto Maestro: `evaluarEmision` devuelve `product_version_no_corresponde` a toda línea canónica) y
   `cambios_rechazados` cuando la versión difiera.
4. Clases AUTORIDAD y PROCEDENCIA congeladas / quitadas con `cambios_rechazados:[{campo, motivo}]`.
5. `evaluarEmision(fila, snap)`: leer `cost_stale` de la **fila** y degradar a `ECONOMICS_INCOMPLETE` con
   `linea_N_recosteo_pendiente_<motivo>` (sumar a `economics` si ya es `BLOCKED`); las ramas `fn === 'cotizacion_emitible'`
   y `fn === 'emitir_revision_v2'` lo heredan sin más cambios.
6. Specs: `e2e/persistencia.e2e.js:103` (golden del P0, hoy rojo con semántica de producción) pasaría a verde con
   `preservaEconomia:'vh035c'` **sin debilitar** la aserción `costoUnitario 21000`; conviene añadir un spec "vendedor
   cambia acabado → Dirección ve UNKNOWN + aviso de recosteo y no puede emitir". `e2e/emision.e2e.js` no se ve afectado
   (el vendedor no edita antes de emitir).

## 7. Decisiones que Dirección aún debe tomar

1. **Autorizar vh035c** (renombrada con timestamp) en lugar de `20261010170000` y vh035b, tras smoke en rama/fixture QA:
   Dirección costea con economía anidada → vendedor cambia cantidad (íntegra) → vendedor cambia acabado (UNKNOWN +
   `cost_stale`, no emitible) → Dirección recostea (emitible).
2. **Regla de re-pin**: confirmar "rechazar" (fail-closed) frente a "revertir y anotar"; y si diseño debe poder ligar
   productos a renglones existentes (hoy no).
3. **Marca de lote**: que el cliente de Dirección (`App.jsx`, `partidaDeCosteo`) escriba `costo_por_lote:true` cuando el
   costo venga de `calcular()`; sin eso, el punto 3 es letra muerta para las partidas costeadas con el motor.
4. **Huella de material**: ¿incluir dimensiones (`w`, `d`, `largoMM`…)? ¿`color` sí o no? Hoy: `color` sí, dimensiones no
   en la huella, pero desde §9 un cambio de dimensiones invalida igual (motivo `definicion_cambiada` en vez de `material_cambiado`).
5. ~~**VH-148**: ordenar la coexistencia~~ **Resuelto** (§8): cualquier orden.
6. **Cliente de Dirección**: al recostear debe quitar `cost_stale`/`cost_status` del patch (el test lo hace a mano) y puede
   limpiar `cambios_rechazados`; conviene que la UI muestre `cambios_rechazados` al vendedor y `cost_stale.motivo` a Dirección.
7. ~~**Nube falsa**~~ **Hecho** (§6): opción `preservaEconomia:'vh035c'` + `e2e/persistenciaVh035c.e2e.js`; el golden de
   producción (`persistencia.e2e.js:125`) se dejó rojo a propósito.
8. **Procedencia `null`** (§5.10): ¿tratar `null` como "no enviado" para no llenar `cambios_rechazados` de ruido?
9. **Texto UI** para `linea_N_recosteo_pendiente_<motivo>` en `src/datos/emisionUX.js` (hoy sale el código crudo).

## 8. Composición con VH-148 (control optimista) — orden de aplicación: **CUALQUIER ORDEN**

- **Núcleo único**: `private_api.actualizar_cotizacion_segura(bigint, jsonb)` (dos argumentos, sin `DEFAULT`) es de este
  archivo. VH-148 (`PROPUESTA_vh148_control_optimista_cotizacion.sql`) ya no lo borra ni lo copia: su sobrecarga privada
  `(bigint, jsonb, timestamptz)` (sin `DEFAULT`) valida las mismas compuertas previas, hace `SELECT … FOR UPDATE`, compara
  `actualizado` contra `p_actualizado_esperado` (40001 + `DETAIL 'actualizado=<ISO>'`) y **delega** aquí. Wrappers
  públicos: 2 args → privada de 2; 3 args → privada de 3.
- vh035c → vh148: el 3-args nace delegando en este núcleo. vh148 → vh035c: este `CREATE OR REPLACE` sustituye el núcleo y el
  3-args queda detrás sin tocar nada. En los dos órdenes, un guardado con versión pasa por fusión, STALE, rechazo de re-pin y
  autoridad protegida, y las llamadas de dos argumentos no son ambiguas.
- Al final de este archivo un `DO` verifica que ninguna sobrecarga de `actualizar_cotizacion_segura` tenga `DEFAULT`: si
  quedara instalado el **borrador viejo** de VH-148 (copia del cuerpo + `DEFAULT`), este archivo aborta en vez de componer
  en silencio.
- Rollback independiente: el de VH-148 no toca el núcleo (VH-035c sigue); el de este archivo no toca el 3-args ni
  `cotizacion_segura` (VH-148 sigue, sobre el núcleo de producción).
- **Corrección hallada al componer** (en `fusionar_economia_partidas`): un `productoId` **textual** (clave de línea:
  `'banca_doble'`, que `crearPartida` emite con `producto_id: null`) se trataba como `producto_id` y **todo renglón de línea
  NUEVO del vendedor se rechazaba con 22023** ("producto_id invalido … banca_doble"). Ahora el pin del servidor sólo considera
  `producto_id`/`product_id` (validados aunque sean basura) o `productoId` numérico, igual que
  `pin_product_versions_in_partidas`. Probado en `composicionVh035cVh148.test.js` (b2) y en la paridad del espejo.

Cómo verificar:

```
npx vitest run supabase/tests/composicionVh035cVh148.test.js supabase/tests/preservaEconomiaIntegral.test.js \
  supabase/tests/controlOptimista.test.js supabase/tests/preservaEconomia.test.js supabase/tests/espejoNubeFalsaVh035c.test.js
PW_EXECUTABLE=/opt/pw-browsers/chromium npx playwright test e2e/persistenciaVh035c.e2e.js e2e/persistencia.e2e.js --reporter=line
#   → persistenciaVh035c 5/5 ✓ (3/3 antes del §9); persistencia 5 ✓ · 1 ✗ exactamente en persistencia.e2e.js:125 (VH-035, a propósito)
```

En RC (cuando Dirección autorice, en cualquier orden): tras aplicar ambas,
`select p.oid::regprocedure, p.pronargdefaults from pg_proc p where p.proname='actualizar_cotizacion_segura'` → 4 filas,
todas con 0; `md5(pg_get_functiondef('private_api.actualizar_cotizacion_segura(bigint,jsonb)'::regprocedure))` = el de
VH-035c; y `prosrc` del 3-args no contiene `update public.cotizaciones`.

## 9. STALE por DEFINICIÓN — cierre del riesgo de composición con SEG-01 (corrección 2026-10-13)

**Riesgo demostrado** (`docs/auditoria/SEGURIDAD_10.md` § 6 "Riesgos" punto 1; `it.fails` en
`supabase/tests/seguridadGateEmisionSnapshot.test.js`, bloque de composición SEG-01 × VH-035c × VH-148): los puntos 2-3 sólo
invalidaban por identidad de producto, huella de material o cantidad por lote. Si el **vendedor guardaba** el renglón con otro
`nombre` u otras `medidas` (claves fuera de la huella), VH-035c re-pegaba el costo de Dirección como KNOWN; la fila decía
"Escritorio NOGAL MACIZO 300x120" con el costo de la melamina 120x60, el snapshot de SEG-01 coincidía con esa fila y el gate
salía `ALLOWED` ⇒ folio oficial para un mueble que nadie costeó (SEG-01 reabierto por la vía del guardado). Producción hoy no
tiene el hueco (el guardado del vendedor despoja el costo y la compuerta falla cerrada con `costo_desconocido`).

**Corrección (causa raíz, en `fusionar_economia_partidas`)**: tras los motivos existentes, y **sólo si ninguno aplicó**
(mismo orden de evaluación: producto → material → lote → definición; los tres primeros conservan su motivo y sus `campos`
exactos), se compara la partida guardada con la que queda tras la fusión (`res`: autoridad y procedencia ya devueltas a lo
guardado):

| Pieza nueva (PROPUESTA_vh035c) | Qué hace |
|---|---|
| `private_api.claves_libres_definicion_partida()` | Lista blanca de lo comercial: `precioUnitario`, `precio_unitario`, `descuento`, `descuento_solicitado`, `importe`, `cambios_rechazados` — **la misma** que `private_api.claves_libres_emision_partida()` de SEG-01, copiada (cada propuesta se aplica y se revierte sola; el rollback de SEG-01 no rompe a VH-035c) |
| `private_api.jsonb_objetos_sin_orden(jsonb)` | Arreglos de **puros objetos** se comparan como multiconjunto (reordenar componentes/insumos no es cambio, como la huella de material); un arreglo con algún escalar conserva su orden (fail-closed: `[120,60,75]` ≠ `[60,120,75]`) |
| `private_api.partida_definicion(jsonb)` | `jsonb_strip_nulls(jsonb_sin_economia(p))` − libres − claves de AUTORIDAD − `cantidad`, canonizado |
| `private_api.campos_definicion_cambiados(vieja, nueva)` | Claves de 1er nivel que difieren (sólo nombres, nunca valores) |
| Bloque `(8)` en `fusionar_economia_partidas` | Si hay campos ⇒ `cost_status:'UNKNOWN'` + `cost_stale:{motivo:'RECOSTEO_DEFINICION_CAMBIADA', campos, previo, economia_previa}`; la economía previa se conserva para auditoría (dentro de `cost_stale`, invisible al vendedor) y **no** se re-pega |

Por qué cada exclusión: **economía** — la despoja `jsonb_sin_economia` y la gobierna la fusión; **null = ausente** —
`crearPartida` manda `producto_id`, `source_type`, `render`… en `null`; **`cantidad`** — su efecto sobre el costo lo decide la
regla de lote (§1.3): sin marca de lote el costo unitario se conserva (caso `[1]`), con marca ⇒ `RECOSTEO_LOTE_CAMBIADO`;
**autoridad** — el servidor ya la fijó a lo guardado (§1.5) y un `aprobado:false` nuevo no cambia el mueble. Todo lo demás
es definición: `nombre`, `medidas`, `w`/`d`/`h`, `nota` (se imprime), `config` no material, `render`, `ruta`, catálogo y
**cualquier clave nueva del contrato** (lista blanca ⇒ fail-closed).

**Compuerta**: sin cambios de código; `private_api.motivos_recosteo_pendiente` ya traduce el motivo a
`linea_N_recosteo_pendiente_definicion_cambiada` ⇒ `ECONOMICS_INCOMPLETE` (en legacy, además `linea_N_costo_desconocido`);
`cotizacion_emitible` y `emitir_revision_v2` heredan el bloqueo. **UI**: `src/datos/emisionUX.js#textoRazonEmision` →
"Línea N: cambió su descripción, medidas u otra especificación; su costo anterior ya no vale y Dirección debe recostearla
antes de emitir." (`src/datos/preliminaryEmissionGate.test.js`). **Rollback**: borra las 4 ayudas nuevas (bloque al final).

**Nube falsa**: `fusionarVh035c` (`e2e/nubeFalsa.js`) replica el bloque (8) (`partidaDefinicion`, `camposDefinicionCambiados`,
`objetosSinOrdenJ`, `stripNullsJ`); paridad SQL↔espejo con 12 entradas nuevas en `espejoNubeFalsaVh035c.test.js` (nombre,
medidas+`w`, `config` anidado, quitar clave, sólo comercial, nulls/autoridad/`cambios_rechazados`, reorden de objetos,
reorden de escalares, material+nombre, lote+nombre, partida ya STALE con y sin cambios).

**Pruebas**:

- `preservaEconomiaIntegral.test.js` casos `[8]`: vendedor y diseño cambian `nombre` ⇒ STALE `['nombre']`, economía previa
  auditable, invisible al vendedor, `cotizacion_emitible` bloqueada para vendedor y Dirección, `emitir_revision_v2` rechaza,
  0 revisiones; sólo comercial ⇒ **no** STALE y emitible; `medidas`, `w/d`, `config.ancho`, `nota`, clave nueva (`render`),
  quitar `nota` ⇒ STALE con sus `campos`; sin falsos positivos por nulls/autoridad/`cambios_rechazados`/economía colada; el
  orden de evaluación no cambia (material y lote conservan motivo y `campos` aunque también cambie el nombre); Dirección
  recostea ⇒ KNOWN, emitible, y un guardado posterior del vendedor sin cambios conserva el costo nuevo y se emite.
- `seguridadGateEmisionSnapshot.test.js`: el `it.fails` "RIESGO VH-035c" pasa a `it` en los tres órdenes de aplicación
  (SEG01→vh035c→vh148, vh035c→vh148→SEG01, vh148→SEG01→vh035c), ahora con aserciones de punta a punta: STALE
  `['medidas','nombre']`, gate `ECONOMICS_INCOMPLETE` con `recosteo_pendiente_definicion_cambiada` (y **no**
  `no_corresponde_a_lo_costeado`: el snapshot fiel es la fila), `emitir_revision_v2` rechaza, sin revisión ni folio; tras el
  recosteo de Dirección el mismo snapshot sale `ALLOWED`, se emite y recibe folio.
- `e2e/persistenciaVh035c.e2e.js`: (1) ahora además afirma que el guardado real de la interfaz **sí lleva las partidas** y no
  dispara definición; (3) nuevo: el vendedor guarda otro nombre y medidas ⇒ "Línea 1: cambió su descripción, medidas u otra
  especificación…", PDF BORRADOR, 0 revisiones; Dirección recostea ⇒ "Lista para emitir"; (4) nuevo: "+" en un mueble sin
  lote conserva el costo y sigue lista (sin falso positivo desde la interfaz real).

**Pruebas existentes ajustadas (no debilitadas)**: cuatro casos cambiaban `nota` de paso para ilustrar *otra* regla
(cantidad sin lote en `[1]`, regla de lote en `[3]`, fusión por la ruta de 3 argumentos en `composicionVh035cVh148.test.js`
`editarVendedor`, y diseño por la ruta de 2 en (d)). Con §9 la `nota` es definición, así que esos casos ahora cambian un campo
comercial (`precioUnitario`/`descuento`) y conservan TODAS sus aserciones originales sobre la economía; el efecto de cambiar la
`nota` se afirma explícitamente (casos `[8]` y composición (d): `RECOSTEO_DEFINICION_CAMBIADA`, `campos:['nota']`). El rollback
de composición ahora también exige que desaparezcan las 4 ayudas nuevas.

**Efectos que Dirección debe conocer (decisiones)**:

1. **Más recosteos legítimos**: corregir una errata en el `nombre`, editar la `nota` o adjuntar/cambiar el `render` de un
   renglón ya costeado deja la línea en recosteo pendiente. Es el comportamiento fail-closed pedido; si Dirección quiere
   liberar alguna clave cosmética (p. ej. `render`), se añade a `claves_libres_definicion_partida()` **y** a
   `claves_libres_emision_partida()` de SEG-01 (deben seguir iguales) y al espejo.
2. **Filas viejas con blobs**: `compactarPayloadNube` convierte strings > 120 KB (base64) en `null`. Si una fila histórica
   guardó un blob así en una clave de definición, el primer guardado del vendedor lo manda en `null` ⇒ STALE por esa clave.
   Falla cerrado (pide recosteo), no abre nada.
3. **Diseño** también queda sujeto (rol sin economía): si edita medidas de un renglón costeado, Dirección recostea.

Cómo verificar:

```
npx vitest run supabase/tests/ src/datos/preliminaryEmissionGate.test.js
PW_EXECUTABLE=/opt/pw-browsers/chromium npx playwright test e2e/persistenciaVh035c.e2e.js --reporter=line   # 5/5
```
