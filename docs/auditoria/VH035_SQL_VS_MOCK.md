# VH-035 · SQL real vs nube falsa (2026-10-13)

Rama `claude/costing-app-architecture-psf02g`. **Producción no cambió**: nada de lo que sigue se aplicó;
no se corrió `supabase` CLI ni `apply_migration`. Todo es base aislada (PGlite = PostgreSQL real en
WASM) con los cuerpos SQL leídos de producción el 2026-10-13 05:20 UTC
(`supabase/tests/fixtures/private_api_prod_20261013.sql`, md5 en su encabezado; las dos RPC son
byte a byte las del fixture del 10-oct) y los CUATRO triggers de `public.cotizaciones` con sus nombres
reales (Postgres los dispara en orden alfabético: guard → normalize → pin → strip).

## 1. Reproducción (resumen)

Prueba: `npx vitest run supabase/tests/preservaEconomia.test.js` (24 casos, ~11 s).

Escenario base: Dirección deja en la cotización del vendedor una partida con economía de primer nivel
(`costoUnitario 21000, margen 30, costoDerivado false`), economía anidada
(`config.costeo.{costoUnitario,materiales,manoObra}`, `config.insumos[0].costo`) e identidad de
producto (`producto_id 1, producto_version_id 1933, piezaId bench-6, bom_hash sha256:aaa`). El rol
sin economía reabre por `cotizacion_segura` (recibe las partidas despojadas por `jsonb_sin_economia`:
también desaparecen `cost_status` y `config.costeo`, porque el patrón `^cost.*` las atrapa), cambia
`cantidad` y guarda por `actualizar_cotizacion_segura`. Dirección reabre.

**Producción hoy (ANTES)**: la RPC escribe lo que llega (fixture `:109-116`); `trg_strip_seller_economics`
sólo actúa si el rol es `vendedor` (fixture `:164-173`) y strippea, no preserva. Resultado: la economía de
Dirección **se pierde** en el guardado del vendedor (y en el de diseño, cuya escritura ni siquiera se
strippea: si su cliente trae un costo, lo PISA). Además, como `normalize` corre antes que `strip`, la fila
guardada por un vendedor queda **sin `cost_status`** (normalize lo pone, strip lo borra). El P0 es real y
vigente.

## 2. Diferencias de comportamiento SQL vs mock (`e2e/nubeFalsa.js`)

Estado al inicio de esta auditoría: el mock declaraba (encabezado, antes `:5-11`) simular "la base
DESPUÉS de la migración 20261010170000", que **no está aplicada**. Por eso `e2e/persistencia.e2e.js:103`
("vendedor abre, edita y guarda → costos intactos") estaba en verde contra el mock mientras producción
pierde los costos: el golden certificaba una conducta que el servidor real no tiene.

| # | Comportamiento | SQL producción (fixture `private_api_prod_20261013.sql`) | Mock antes | Mock ahora |
|---|---|---|---|---|
| 1 | Vendedor guarda partidas | RPC escribe tal cual (`:109-116`); trigger strip quita economía del vendedor (`:164-173`). Economía vieja **perdida** | `fusionar(c.partidas, sinEconomia(...))` re-pegaba la economía vieja (antes `:316`) → **inventaba la migración** | `nubeFalsa.js:323-326`: default `preservaEconomia=false` → `sinEconomia` sin fusión (= producción). `preservaEconomia: true` → fusión (= migración) |
| 2 | Diseño guarda partidas | RPC tal cual; strip NO aplica a diseño → lo que mande se persiste (perdiendo la economía si venía despojado; pisándola si trae otra) | fusionaba igual que vendedor | `:162` `strippeaEscritura`: en producción sólo `vendedor`; diseño escribe tal cual |
| 3 | `acomodo`/`totales` del vendedor y diseño | strip sólo vendedor (`:170-172`) | strippeaba a todo rol sin economía (antes `:321-322`) | `:331-332` sólo vendedor en modo producción |
| 4 | `folio_oficial` en el patch | rechazado si difiere (`:87-89`) | no se validaba | **sin cambio** (no lo ejercita ningún E2E; anotado) |
| 5 | `cost_status` tras guardado de vendedor | borrado por strip después de normalize → fila sin veredicto | el mock no tiene normalize ni cost_status | **sin cambio** (el mock no modela `cost_status`) |
| 6 | `pin_product_versions` / `guard_estado_directo` | triggers reales | ausentes | **sin cambio** (fuera de alcance del E2E de persistencia) |
| 7 | `crear_cotizacion_segura` del rol sin economía | cuerpo NO está en el fixture; el trigger de INSERT strippea sólo vendedor | strippea a todo rol sin economía (`:308`) | **sin cambio**: no verificado contra producción; pendiente leer el cuerpo real |
| 8 | `cotizacion_segura` | dueño o `puede_editar_config`; `jsonb_sin_economia(payload)` si no ve economía (`:22-35`) | igual (`:168-173`) | igual |

Cambio al mock: **sólo** la opción `preservaEconomia` (default = producción) y el encabezado; nada más.
Ningún spec la activa; ninguna aserción se debilitó.

### Resultado del E2E `npx playwright test e2e/persistencia.e2e.js` (Chromium local, dev server 5173)

**5 passed, 1 failed**. Falla `persistencia.e2e.js:125` (`expect(fila.partidas[0].costoUnitario).toBe(21000)` →
`undefined`). Es el P0 real: con la semántica de producción, el vendedor que reabre, edita el cliente y
autosalva **borra `costoUnitario/margen/costoDerivado` de Dirección**. La aserción se conserva tal cual; el
golden volverá a verde sólo cuando producción preserve la economía (migración autorizada) y el mock se
corra con `preservaEconomia: true` como representación de ese estado.

Colateral revisado: `e2e/emision.e2e.js` 5/5 en verde — el vendedor abre sin editar ("reabrir sin editar
NO escribe"), así que la fila conserva el costo y la compuerta sigue evaluando igual.

## 3. Matriz de casos (PGlite, `supabase/tests/preservaEconomia.test.js`)

ANTES = producción hoy · DESPUÉS = migración pendiente `20261010170000` · PROPUESTA = `PROPUESTA_vh035b_preserva_economia_sin_reciclar.sql`

| Caso | ANTES | DESPUÉS | PROPUESTA |
|---|---|---|---|
| Vendedor cambia cantidad, agrega renglón | economía de Dirección perdida; p3 sin economía | costo/margen/costoDerivado/producto_version_id al centavo; cantidad 3; p3 sin economía | igual que DESPUÉS |
| Vendedor cambia cantidad (partida con economía anidada) | primer nivel y anidado perdidos; `cost_status` desaparece | primer nivel intacto, `cost_status KNOWN` conservado; **`config.costeo` e `insumos[].costo` PERDIDOS** (limitación conocida, test `:326` lo afirma como tal, no como PASS) | igual que DESPUÉS (limitación heredada, documentada) |
| Diseño cambia cantidad | todo perdido (escritura tal cual; strip no le aplica); `cost_status UNKNOWN` | primer nivel intacto (la fusión aplica a todo rol sin economía); anidado perdido | igual que DESPUÉS |
| Diseño con costo propio en su cliente (`costoUnitario: 1`) | **PISA** 21000 → 1 | 21000 se conserva | 21000 se conserva |
| Vendedor hostil: `estado:'emitida'` / `folio_oficial` arriba | rechazados (`estado protegido`, `folio_oficial protegido`); nada se escribe | igual | igual |
| Vendedor hostil: `costoUnitario:1, margen:99, cost_status:'KNOWN'` en p1; p3 nuevo con costo | ni el colado ni el de Dirección sobreviven; `cost_status` borrado | gana la economía de Dirección (21000/30/KNOWN); p3 `UNKNOWN` | p1 queda **UNKNOWN + `cost_stale`** porque también cambió `producto_version_id` (ver fila siguiente); p3 `UNKNOWN` |
| Vendedor cambia `producto_version_id` 1933→9999 / `precioUnitario` / `estado` dentro de la partida | **sí puede** (no es economía): persiste 9999, precio 10, `estado:'emitida'` en la partida | **sí puede**: persiste; y la economía vieja se re-pega sobre la versión nueva | la versión cambia, pero la economía NO se hereda: `cost_status UNKNOWN`, `cost_stale.campos=['producto_version_id']` |
| Vendedor cambia de producto (producto_id 1→2, versión 1933→2044, piezaId, bom_hash; mismo `id`) | nada que reciclar: toda la economía perdida | **STALE**: re-pega 21000/30/KNOWN del producto 1 sobre el producto 2 → costo falso para Dirección. Test `:353` **FALLA a propósito** | sin costo, `cost_status 'UNKNOWN'`, `cost_stale {motivo RECOSTEO_PRODUCTO_CAMBIADO, campos [4], previo {identidad vieja}}` |
| Marca `cost_stale` frente al vendedor | n/a | n/a | invisible al vendedor (`^cost`), no la puede borrar, sobrevive a su siguiente guardado |
| Dirección recostea el producto nuevo | n/a | n/a | guarda 19500/40 sin `cost_stale` → `KNOWN`, marca desaparece |
| Dirección cambia la economía | puede | puede (el merge no la congela) | puede |
| Escritura cruda del vendedor (sin RPC) | strippeada | strippeada (el trigger sólo cede con `vh.economia_preservada`) | strippeada |
| Quitar un renglón | se quita | se quita (no resucita) | se quita |

Conteo: **23 passed, 1 failed**. El fallo es el test `STALE:` del bloque DESPUÉS, intencional: describe el
defecto de `20261010170000` y pasa en verde con la PROPUESTA (bloque VH-035b, 7 casos, todos verdes).
Dejarlo rojo es deliberado: la alternativa (afirmar el comportamiento rancio como "esperado") haría
parecer correcto un costo falso.

## 4. Hallazgos clave

1. **P0 vigente**: producción pierde la economía de Dirección en cada guardado de vendedor; diseño además
   puede pisarla. El golden `persistencia.e2e.js:103` estaba verde sólo porque el mock fingía la migración.
2. **La migración `20261010170000` corrige el P0 pero recicla economía sobre otro producto** cuando el
   vendedor cambia `producto_id`/`producto_version_id`/`piezaId`/`bom_hash` conservando el `id` de la
   partida (el cliente permite re-costear/reemplazar renglones). El costo mostrado a Dirección sería del
   producto anterior con `cost_status KNOWN`. Por eso NO se recomienda aplicarla tal cual.
3. **El vendedor puede cambiar `producto_version_id` y `precioUnitario`** en producción y con cualquiera de
   las dos migraciones: no son claves económicas. La PROPUESTA no lo impide (respeta el cambio) pero invalida
   la economía heredada. Si Dirección quiere que el vendedor NO pueda re-pinear versiones, es otra regla
   (pendiente de decisión).
4. **`estado` dentro de una partida no está protegido** (sólo `estado`/`folio_oficial` de la fila). Es
   dato libre; conviene que el cliente no lo use para nada comercial.
5. **Economía anidada (`config.costeo`, `insumos[].costo`) se pierde con ambas migraciones**: la fusión es
   de primer nivel. Está afirmado en el test como limitación, no como preservación. Se resuelve al mover
   el costeo al servidor (o extendiendo la fusión a `config` cuando identidad no cambia).
6. **Orden de triggers**: `trg_normalize_economics_status` corre antes que `trg_strip_seller_economics`, así
   que hoy toda fila guardada por vendedor queda **sin `cost_status`** (normalize lo pone, strip lo borra).
   Con la migración/PROPUESTA el strip cede y el `cost_status` viejo se re-pega.
7. `crear_cotizacion_segura` no está en el fixture de producción: la conducta del mock en creación no
   está verificada.

## 5. Estado de corridas

- `npx vitest run supabase/tests/preservaEconomia.test.js`: 24 casos → **23 passed, 1 failed** (STALE intencional).
- `PW_EXECUTABLE=/opt/pw-browsers/chromium npx playwright test e2e/persistencia.e2e.js`: 6 → **5 passed, 1 failed**
  (`:103`, el P0 real; aserción intacta).
- `e2e/emision.e2e.js` tras el cambio del mock: 5 → **5 passed** (sin colateral: el vendedor abre sin editar,
  así que la fila conserva el costo y la compuerta evalúa igual).

## 6. Plan de rollback de la migración (si se llegara a aplicar `20261010170000` o la PROPUESTA)

No reescriben filas: sólo funciones. Revertir = reinstalar los cuerpos de producción y borrar las ayudas.

```sql
-- 1) Cuerpos de producción (copiar de supabase/tests/fixtures/private_api_prod_20261013.sql):
--    CREATE OR REPLACE FUNCTION private_api.actualizar_cotizacion_segura(...)   (líneas 39-147)
--    CREATE OR REPLACE FUNCTION public.strip_seller_economics_on_cotizacion_write()  (líneas 150-177)
-- 2) Ayudas introducidas:
drop function if exists private_api.fusionar_economia_partidas(jsonb, jsonb);
drop function if exists private_api.campos_identidad_cambiados(jsonb, jsonb);   -- sólo PROPUESTA
drop function if exists private_api.identidad_producto_partida(jsonb);          -- sólo PROPUESTA
drop function if exists private_api.economia_de_partida(jsonb);
-- 3) Verificar md5(pg_get_functiondef) contra el encabezado del fixture:
--    actualizar_cotizacion_segura 84da6ec052f590d433f5d0c2a1a8e031 · cotizacion_segura fce4c268a4c835f53cf7de8df40f3949
```

Datos: las marcas `cost_stale` que hubieran quedado son inertes (normalize las deja, `jsonb_sin_economia`
las esconde al vendedor); Dirección las quita al recostear. `vh.economia_preservada` es un `set_config`
local a la transacción: no deja rastro.

## 7. Qué debe autorizar Dirección

1. **Aplicar la PROPUESTA (renombrada con timestamp) en lugar de `20261010170000`**, tras probarla en una
   rama de Supabase / fixture QA con el smoke por rol (Dirección costea → vendedor edita → Dirección reabre;
   vendedor cambia producto → Dirección ve UNKNOWN + `cost_stale`, no un costo viejo).
2. **Regla sobre `producto_version_id`**: ¿puede el vendedor re-pinear versiones? Hoy sí (en producción y
   con ambas migraciones). Si no debe, hace falta una regla adicional en la RPC.
3. **Cliente de Dirección**: al recostear una partida marcada, debe quitar `cost_stale` y `cost_status`
   del patch (el test lo hace a mano). Hasta entonces, un guardado de Dirección que conserve `cost_status:
   'UNKNOWN'` lo deja en UNKNOWN aunque ponga costo.
4. **Economía anidada**: aceptar la limitación (se pierde `config.costeo` al guardar un rol sin economía)
   mientras el costeo no viva en el servidor, o pedir extender la fusión a `config` cuando la identidad no
   cambia.
5. **Golden E2E**: `persistencia.e2e.js:103` queda ROJO a propósito hasta que producción preserve la
   economía. Autorizar que, una vez aplicada la migración, los specs que describen el servidor migrado se
   corran con `crearNubeFalsa({ usuarios, preservaEconomia: true })` — y que ese flag se quite del mock
   cuando el default de producción sea preservar.
