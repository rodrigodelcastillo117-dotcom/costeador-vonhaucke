# ACOMODO_LIST_MISMATCH — diagnóstico de identidad / stale plan

**Rama:** `claude/costing-app-architecture-psf02g`  
**Base auditada:** HEAD `21943622d5904c6a4730631830789c3b4808bfd0`  
**Alcance:** diagnóstico solamente. No se modifica código, DB, motor ni datos.

## Conclusión ejecutiva

Sí existe una explicación determinista para el síntoma **“92/92 dentro del cuarto, sin traslape, pero cada mueble ‘no está en la lista’”**:

1. La geometría y la identidad se validan por caminos distintos.
2. El servidor puede haber validado 92 colocaciones contra la lista de piezas que recibió en ESA corrida.
3. El cliente reconstruye después una **lista esperada actual** desde `cotizacion.partidas`.
4. Si el plan que conserva la UI pertenece a una versión anterior del programa y sus IDs ya no coinciden byte-a-byte con los IDs recién reconstruidos, el cliente marca cada colocación como `GHOST_PLACEMENT` aunque las coordenadas sigan siendo perfectamente válidas.
5. Hay un hueco reactivo concreto: el saneo de plan stale existe, pero el estado React que guarda `acomodoLocal` / `plan` se inicializa una vez y no se invalida automáticamente cuando cambian las partidas manteniendo el componente montado.
6. Además existe un **gap de provenance del servidor desplegado**: el repo no puede probar que la Edge viva sea exactamente el código de esta rama. Los propios comentarios de `acomodar-espacio-recovery` se contradicen sobre si la fuente está desplegada.

Por tanto, el síntoma no demuestra un fallo geométrico. Es compatible con un **mismatch de identidad / versión del programa**.

---

## 1. Dónde se construye la “lista esperada” y qué ID espera

### 1.1 Identidad estructural del programa

`src/datos/resolverPrograma.js:47-49`

- `requirement_id = req:<zone_id>:<rol>:<ord>`
- `instance_id = inst:<requirement_id>:#<ord>`
- `functional_group_id = fg:<requirement_id>:#<ord>`

Ejemplo de forma estructural:

`req:zona-a:privado:0`  
`inst:req:zona-a:privado:0:#0`

Estas identidades representan requerimiento/ancla, no son todavía necesariamente el `id` final que usa PlacementSpec.

### 1.2 Confirmación comercial crea otro `id`

`src/datos/confirmarPrograma.js:132-149`

`aItemConfirmado()` asigna:

`id = <slot>::<bancoId>`

mientras conserva por separado:

- `instance_id`
- `anchor_instance_id`
- `functional_group_id`
- `requirement_id`
- `zone_id`

Para dependientes, el slot incorpora la instancia del ancla:

`src/datos/confirmarPrograma.js:441-467`

`slot = <rol>|<relation_role>|<anchor_instance_id>`

Como `anchor_instance_id` puede ser `inst:req:...:#n`, un ID comercial confirmado puede contener esa cadena, por ejemplo conceptualmente:

`privado|VISITOR_SEAT|inst:req:<zona>:privado:0:#0::<sku>`

### 1.3 Ese ID comercial se conserva hacia Acomodo

`src/datos/programaRealDelPlano.js:39-75`

`aPartidaAcomodo()` usa como prioridad:

`id: it.id || it.instance_id || it.bancoId`

Es decir: si ya existe el `id` comercial de confirmación, Acomodo usa ése; `instance_id` queda como metadata estructural.

### 1.4 La expansión por cantidad produce el ID exacto de cada pieza

`src/datos/espacio.js:218-272`

Cada partida se expande con:

`id: \`${pt.id}-${k + 1}\``

Por eso el ID efectivo de una colocación termina con el ordinal de unidad. En dependientes puede verse una forma como:

`...|inst:req:...:#n::<sku>-1`  
`...|inst:req:...:#n::<sku>-2`

La parte `inst:req:...` no es el ID completo por sí sola: normalmente está embebida en el `slot` comercial y después se agrega el sufijo `-k`.

### 1.5 La lista esperada canónica del cliente

`src/datos/acomodoPayload.js:92-102`

`construirPayloadAcomodo()` llama a `expandirPiezas(reales)`.

`src/datos/acomodoPayload.js:145-174`

Después construye:

- `piezasLimpias`
- `payload.piezas = piezasLimpias`
- `requested = piezasLimpias.length`
- `program_hash = programHashCanonico(piezasLimpias)`

Esa es la **lista esperada canónica** que el cliente considera verdad para esa versión del programa.

### 1.6 El cross-check que produce “no está en la lista”

`src/datos/acomodoInvariantes.js:84-111`

El cliente crea:

`porId = new Map(payload.piezas.map(p => [String(p.id), p]))`

y para cada colocación:

- si `colocacion[i].id` no está en `porId` → `GHOST_PLACEMENT`
- las colocaciones fantasma no cuentan como `colocadosValidos`
- todos los IDs actuales que no aparezcan se vuelven `unplaced`

El texto visible está en:

`src/datos/acomodoVeredicto.js:80-91`

`GHOST_PLACEMENT: 'colocación de un mueble que no está en la lista'`

---

## 2. Dónde genera el servidor los IDs de colocación

La Edge recovery recibe `piezas` ya expandidas desde el cliente.

`src/nube.js:380-385`

Se manda literalmente:

`body: { areas, piezas }`

La ruta por defecto es:

`src/nube.js:429-432`

`acomodar-espacio-recovery` (un override a `-rc` sólo puede entrar por el carril permitido en desarrollo).

### 2.1 El solver no debería renombrar el ID

`supabase/functions/acomodar-espacio-recovery/kit-solver.js:678-693`

Al producir cada placement:

`id: p.id`

O sea, con la fuente actual del repo, el servidor **preserva el ID recibido**. Añade metadata como `anchor_instance_id`, `slot_id`, `side`, `facing`, etc., pero no debería sustituir `p.id`.

### 2.2 El servidor también valida identidad exacta

`supabase/functions/acomodar-espacio-recovery/recovery-core.js:324-358`

Para contar colocadas:

`colocacion.id` sólo cuenta si existe un `piezas[].id` idéntico.

El servidor deriva:

- `placed`
- `unplaced`
- `requested`
- `invariant_ok`

contra SU lista de `piezas` de esa petición.

`supabase/functions/acomodar-espacio-recovery/recoveryPipeline.js:42-83`

El `layoutSpec` guarda esos valores y las placements devueltas.

**Consecuencia:** con el código de repo actual, una respuesta fresca del mismo request no debería inventar IDs ajenos. Si el servidor dice 92 colocadas y el cliente inmediatamente marca esas 92 como fantasmas, la lista con la que el cliente está revalidando ya no es la misma lista de identidad que produjo/validó ese plan, o la Edge viva no corresponde a esta fuente.

---

## 3. Cómo puede existir “92/92 geométricamente bien” y a la vez “cada mueble no está en la lista”

La validación de forma y la validación de identidad son independientes.

Un placement viejo puede conservar perfectamente:

- `area`
- `x`
- `y`
- `rot`

y por tanto seguir estando dentro del cuarto y sin traslapes.

Pero si su `id` era, por ejemplo:

`<slot_v1>::<sku>-7`

y el programa actual reconstruye esa misma pieza física como:

`<slot_v2>::<sku>-7`

la comparación es de string exacto. No existe equivalencia semántica por SKU, nombre, posición o geometría.

En `src/datos/acomodoInvariantes.js:84-111` ocurre entonces:

- 92 placements viejas → 92 `GHOST_PLACEMENT`
- `colocadosValidos = 0`
- las 92 piezas actuales → 92 `unplaced`

Hay además un detalle importante: la igualdad de cobertura usa

`requested === placed + unplaced.length`

Por tanto, con `requested=92`, `placed=0` y `unplaced=92`, `invariant_ok` puede seguir siendo verdadero aunque existan 92 ghosts. El estado final sigue siendo FAIL porque los `GHOST_PLACEMENT` son fallas duras.

Eso explica por qué diferentes superficies de UI/servidor pueden mostrar simultáneamente números aparentemente incompatibles: un contador puede venir del `layoutSpec` que validó el servidor y el bloque de “Geometría” puede estar describiendo el cross-check local actual.

### Qué cambios pueden alterar los IDs sin cambiar físicamente el mobiliario

Por la composición documentada arriba, cambia el ID si cambia cualquiera de estas piezas de identidad:

- `zone_id`
- rol / `relation_role`
- ordinal del requerimiento
- `anchor_instance_id`
- slot resultante
- `bancoId` / producto confirmado
- forma en que una fila fue reutilizada/repartida al confirmar
- ID comercial de la partida
- agrupación/cantidad que determina el sufijo `-k`

La geometría puede seguir siendo la misma.

---

## 4. Desfase stale: cliente y servidor

### 4.1 Stale de plan dentro del cliente: **CONFIRMADO por código**

Existe un saneador correcto:

`src/componentes/Acomodo.jsx:103-121`

`sanearAcomodoContraPartidas()` vuelve a expandir las partidas y, si alguna colocación tiene un ID ajeno o `requested` ya no coincide, elimina el plan y marca:

`layoutEstado: 'STALE_PROGRAM'`

El problema es cuándo se aplica.

`src/componentes/Acomodo.jsx:135-153`

El saneo se usa para producir `guardadoNormalizado`.

Pero después:

`src/componentes/Acomodo.jsx:151-166`

`acomodoLocal` se inicializa con `useState(...)`. Esa inicialización no vuelve a ejecutarse sólo porque cambien `props.estado.cotizacion.partidas`.

Además:

`src/componentes/Acomodo.jsx:316-323`

la key de `AcomodoBase` es:

`acomodo-demo-${revision}-${hayReales ? 'real' : 'sug'}`

No incluye `program_hash`, una firma de partidas ni los IDs esperados. Si antes y después hay partidas reales, `hayReales` sigue siendo `real` y el componente puede permanecer montado.

Dentro de `AcomodoBase`:

`src/componentes/AcomodoBase.jsx:99-108`

`plan` también se inicializa una sola vez desde:

`useState(() => guardadoPrevio?.plan || null)`

Mientras tanto la lista esperada sí se recalcula:

`src/componentes/AcomodoBase.jsx:127-165`

- `piezasBase = expandirPiezas(partidas)`
- `payloadAcomodo = construirPayloadAcomodo({ partidas, ... })`
- `evaluarInvariantesAcomodo({ payload: payloadAcomodo, plan })`

Así puede ocurrir exactamente este estado:

**plan viejo en state + payload nuevo derivado de partidas nuevas = todos los placements son ghosts.**

El orquestador sí conoce los hashes:

`src/datos/acomodoOrquestador.js:60-80`

y `planEstaStale()` evita conservar posiciones manuales cuando `program_hash` o `floor_hash` cambian. Pero ese control entra al ejecutar/re-ejecutar el solver; no elimina por sí solo un `plan` viejo que ya está en state antes de esa acción.

### 4.2 Stale entre código del repo y Edge viva: **PROVENANCE GAP CONFIRMADO; binario exacto NO demostrable desde repo**

El cliente llama por defecto a:

`src/nube.js:429-432`

`acomodar-espacio-recovery`.

Sin embargo, dentro del propio directorio del servidor hay declaraciones incompatibles:

`supabase/functions/acomodar-espacio-recovery/index.ts:4-13`

dice que fue **“DESPLEGADA como v7”**, pero también dice **“Nivel de evidencia: PENDIENTE DE ACTIVACIÓN”**.

`supabase/functions/acomodar-espacio-recovery/recovery-core.js:1-9`

dice explícitamente:

- **“Esta fuente NO está desplegada.”**
- el cliente invoca una función viva **“desplegada fuera de banda”**
- el archivo del repo agrega invariantes que el edge productivo no modela como regla dura.

Por lo tanto, desde esta rama **no se puede demostrar que el código que validó una respuesta real del servidor sea byte-a-byte el código versionado aquí**.

Además, en HEAD actual `acomodar-espacio-recovery` y `acomodar-espacio-recovery-rc` no son idénticos en varios componentes del solver (`recoveryPipeline.js`, `kit-solver.js`, `qualityJudge.js`, `semanticPlacementJudge.js`, `spatial-core.js`). Esto confirma que hay más de una implementación posible del mismo contrato.

No se puede afirmar, sólo con el repo y sin inspeccionar el despliegue vivo, cuál binario exacto respondió a una corrida concreta. Lo que sí queda demostrado es que **el repo carece de una prueba fuerte de source↔deployed-version para esta Edge**.

---

## Diagnóstico final

### Causa primaria más consistente con “92/92 pero todos fuera de lista”

**STALE_PROGRAM / IDENTITY_MISMATCH entre el plan conservado y la lista actual de piezas.**

El plan conserva IDs de una versión anterior; el cliente actual reconstruye otros IDs. La geometría no necesita cambiar para que todas las colocaciones fallen el cross-check de identidad.

### Bug/gap concreto en cliente

El saneo de `Acomodo.jsx:103-121` es correcto al entrar, pero no está cableado como invalidación reactiva del `acomodoLocal.plan` / `AcomodoBase.plan` cuando cambia la firma de partidas durante la misma sesión.

### Riesgo adicional de versión servidor

Hay un gap de provenance real: los comentarios del source dicen simultáneamente “desplegada” y “fuente no desplegada / viva fuera de banda”. El cliente tampoco recibe un commit SHA/build SHA del servidor; sólo el contrato `PLACEMENT_SPEC_V2_RECOVERY`. Por eso un mismatch de implementación desplegada no puede descartarse ni probarse a partir de la respuesta actual.

## Qué NO es

Con esta evidencia, “cada mueble no está en la lista” **no significa** que los 92 muebles estén fuera del cuarto ni encimados. Es específicamente una falla de **identidad exacta placement.id ↔ payload.piezas[].id**.
