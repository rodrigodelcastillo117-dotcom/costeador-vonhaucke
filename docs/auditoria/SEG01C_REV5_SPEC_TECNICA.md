# SEG-01c rev5 · `spec_tecnica_v1`

## El hueco (P0 de la reauditoría final)

`promesa_comercial_v1` responde **qué se le promete al cliente**: nombre, medidas, materiales, piezas incluidas y excluidas, configuración y variante. Pero no distingue dos despieces técnicamente distintos si conservan los mismos nombres e insumos. En la rev4 el K de A se vinculaba a B con la promesa idéntica en estos casos:

- `1 × Entrepaño MDF18` frente a `3 × Entrepaño MDF18`;
- un lateral de 700 × 400 frente a uno de 900 × 400;
- 1 h frente a 4 h de ensamble;
- otra área pintada con el mismo insumo de pintura.

## La solución: dos autoridades separadas

| Autoridad | Pregunta | Dónde |
|---|---|---|
| `promesa_huella` | ¿Qué producto o alcance prometemos? | `promesaComercial.js` ≡ `private_api.promesa_partida` (rev4) |
| `spec_tecnica_huella` | ¿Qué definición técnica exacta costeó el servidor? | `specTecnica.js` ≡ `private_api.spec_tecnica` (rev5) |

La promesa no se tocó. No se le agregó ningún detalle técnico.

### Cómo nace la spec con K

1. Costear manda la intención técnica. `nube.costearServidor` envía `validarIntentCosteo(intentDesdePieza(costeo, n)).intent`.
2. La Edge vuelve a pasar la intención por `validarIntentCosteo`; ésa es la frontera del DTO. Después costea `intent.pieza` con el motor.
3. La fila del costeo la arma `filaCosteoServidor` (`src/datos/registroCosteo.js`), la **misma** función que usan las pruebas del pipeline. Guarda `spec_tecnica_origen = specTecnicaDeCosteo(intent.pieza)`: la pieza saneada que entró al motor, no un objeto paralelo del navegador.
4. El trigger `trg_costeo_spec_servidor`:
   - la vuelve a proyectar en SQL;
   - fija `spec_tecnica_version = 'v1'` y `spec_tecnica_huella = md5`;
   - rechaza cualquier cambio posterior, incluso de `service_role`.

   Si la spec queda fuera de contrato, la huella queda en null y ese K nunca vincula.

### Cómo se liga a la partida (relación del lado del servidor)

La partida especial no traía el BOM. `piezaId` es un id del catálogo local del navegador, y el expediente de la biblioteca es opcional y no está ligado a la partida. Por eso la partida ahora lleva su `especificacion_tecnica`. Costear la arma con la misma función y sobre la misma pieza saneada.

`adjuntar_costeo_a_partida` hace lo siguiente:

- **Re-proyecta en SQL** la especificación de la partida. No compara un hash copiado por el navegador.
- En el primer vínculo, en el recosteo K1→K2 (K2 contra **su** spec de origen) y en la rama idempotente, exige `huella_spec_tecnica(partida.especificacion_tecnica) = K.spec_tecnica_huella`.
- Rechaza si el K no trae spec, si la partida no trae especificación o si la trae fuera de contrato.

En la emisión, `motivos_autoridad_costeo` agrega dos motivos: `linea_N_costeo_sin_spec` y `linea_N_spec_distinta_al_costeo`.

**Por qué es suficiente.** La especificación de la partida es parte de la definición que se guarda, se cotiza y se emite. `huella_partida` (VH-035c, `partida_definicion`) la incluye, así que cualquier cambio después del vínculo se detecta en la emisión.

Si el navegador reescribe la especificación de la partida para que cuadre con un K barato, **esa** especificación queda como la que se cotiza y se emite. El costo vuelve a ser el de lo que se vende. Lo que ya no se puede es vender un despiece con el costo de otro.

### `bom_hash`

`bom_hash` no puede ser la autoridad, por tres razones:

- es un FNV-1a de 32 bits calculado sólo en JS;
- no cubre `horas`, `dificultad`, `areaPintadaM2`, `tubular`, `procedencia` ni `pieza_confirmada`;
- VH-035c (en producción) lo usa como dato de identidad.

Se declara **informativo** en el comentario de la columna, en la cabecera de la PROPUESTA y aquí. La única autoridad técnica es `spec_tecnica_huella`.

## Inventario: CAMPO → entra / no entra → por qué

**Regla:** entra **todo** lo que cruza la frontera del DTO (la allowlist `COMP_PERMITIDOS` de `validarIntentCosteo`, más `pendiente`, `horas` y `dificultad`). No se eligió a mano.

La prueba `specTecnica.test.js` falla si la allowlist y `SPEC_CAMPOS` divergen ("cada campo que el validador deja pasar está en SPEC_CAMPOS").

### Por componente

| Campo | ¿Entra? | Quién lo consume |
|---|---|---|
| `insumoId` | entra | `calculo.js` (precio, unidad, formato del catálogo) y `reconciliarMaterialServidor` |
| `nombre` | entra | `calculo.js` lo usa en reglas por nombre (tornillería, pintura) y en `componentesIgnorados`/`componentesExcluidos`; también `revisionEstructural` y `topeEstadoCosteo` |
| `cantidad` | entra | multiplica el consumo |
| `piezas` | entra | multiplica el consumo |
| `largoMM`, `anchoMM` | entra | área o longitud → consumo, hojas, tramos y mermas |
| `hojas` | entra | consumo explícito de hojas |
| `areaPintadaM2` | entra | pintura en polvo: kg = m² ÷ 8 (A14) |
| `tubular` | entra | merma de tubular (D2, 6.94 %) |
| `material_solicitado` | entra | reconciliación: clase efectiva y bloqueo por familia |
| `material_match` | entra | el servidor recalcula la clase, pero el estado pendiente declarado decide si un componente sin insumo sobrevive (y bloquea) |
| `material_confirmado` | entra | con capability promueve a `USER_CONFIRMED` y cambia el estado (certificado/preliminar) |
| `engineering_override` | entra | con capability permite un material de otra familia |
| `override_motivo` | entra | no cambia el número, pero es parte de la intención técnica registrada junto con el override. Excluirlo no ahorra ningún recosteo real |
| `procedencia` | entra | tope de estado: una pieza inferida sin confirmar queda preliminar |
| `pieza_confirmada` | entra | ídem |
| `pendiente` | entra | lo agrega el validador. Un componente sin insumo bloquea el costo |

### Por pieza

| Campo | ¿Entra? | Por qué |
|---|---|---|
| `horas` | entra | mano de obra y GIF por horas |
| `dificultad` | entra | factor de mano de obra (Alba) |
| `cantidad` (n de la intención) | no entra a la spec | se compara aparte, igual que en la rev3 (`K.cantidad` = `partida.cantidad`). La spec es por unidad |

### Lo que NO entra porque el servidor no lo ve

| Campo | Por qué |
|---|---|
| `excluida` | El validador lo descarta a propósito: excluir es una decisión comercial de la Cotización. Ver la observación al final |
| `margen`, `factorDirecta`/`Indirecta`, `modoManoObra`, `modeloCosteo`, `parModelo`, precios y costos | Prohibidos o descartados por el DTO. El servidor usa sus propios parámetros |
| `id`, `_match`, `candidate_insumo_id`, `largo`/`ancho` (sin `MM`), render, notas | No cruzan la allowlist |

### Entradas del servidor que no van en la spec, pero ya tienen autoridad

| Entrada | Autoridad |
|---|---|
| Catálogo (precio, unidad, formato) de los insumos usados | `base_costo_huella` y `precio_id` (frescura, rev2) |
| `config.parametros` | `base_costo_huella` |
| Versión del motor | `version_motor` y el modo estricto |
| Rol (capability) | sólo Diseño o Dirección registran un K |

## Normalización (idéntica en JS y SQL)

- **Texto:** se recortan espacio, tab, CR y LF; `''` = ausente.
- **Número:** sólo número JSON en el dominio `[0, 2^53−1]` y además `0` ó `≥ 1e-6`. En ese dominio, JS (`String(n)`) y SQL (`trim_scale(n)::text`) escriben el mismo texto.
- **Bandera:** `true` = presente; `false` = ausente.
- **Fuera de contrato:** cualquier otro tipo presente, un número fuera de dominio, una dificultad desconocida o un centro de horas repetido tras recortar ⇒ **sin spec** (null). Sin spec no hay vínculo.
- **Orden:** el de los renglones no cuenta. Se ordenan por la clave canónica `campo=valor` en el orden fijo de `SPEC_CAMPOS`, unida con U+001F, por punto de código (= `COLLATE "C"`).
- **Multiplicidad:** sí cuenta.

### Duplicados (decisión explícita)

Dos renglones idénticos de cantidad 1 **no** equivalen a un renglón de cantidad 2. El motor redondea por renglón (hojas, tramos y mermas), así que fusionarlos podría esconder una diferencia de costo. El peor caso de esta decisión es pedir un recosteo innecesario, nunca reutilizar un costo equivocado.

### Equivalencia JS ↔ SQL

Las implementaciones son **equivalentes dentro del contrato soportado**, no "para cualquier JSON". La equivalencia la demuestran 20 fixtures doradas escritas a mano (`supabase/tests/fixtures/specTecnicaGolden.json`), corridas en JS y en SQL: SQL = esperado = JS, idempotencia y misma huella.

## Pruebas

| Prueba | Qué cubre |
|---|---|
| `src/datos/specTecnica.test.js` (26) | fixtures doradas; la allowlist del DTO es exactamente `SPEC_CAMPOS`; qué cambia la spec y qué no; dominio numérico |
| `supabase/tests/specTecnicaGolden.test.js` (21) | SQL = JS en las 20 fixtures doradas; huella |
| `seg01cVinculoCosteo.test.js`, bloque rev5 | P0 (multiplicidad, dimensión, horas, pintura, dificultad, duplicados), orden, K sin spec, partida sin spec o fuera de contrato, sellado, K1→K2, K2 no lava, idempotencia, defensa en la emisión |
| `seg01cVinculoCosteo.test.js`, bloque Q3 | **pipeline real**: Costear → intent → Edge → partida → guardar → vincular; config, acabado, `nombresExcluidos`, multiplicidad y dimensión |
| `seg01cVinculoCosteo.test.js`, bloque "ANTES · rev4" | los ataques de despiece pasaban con la rev4 |

**Antes y después.** `SEG01C_MIG=supabase/tests/fixtures/seg01c_rev4_8cc0adb.sql npx vitest run supabase/tests/seg01cVinculoCosteo.test.js -t "rev 5 · spec|Q3"` da **13 fallas**. Son los ataques del P0, el sellado, el lavado con K2, la defensa en la emisión y el control del pipeline, que exige la spec. Con la rev5, todo pasa.

## Límites y observaciones

1. **La especificación de la partida la escribe el navegador.** Eso es intencional: es la definición que se cotiza y se emite. La autoridad está en que el costo **siempre** corresponde a esa especificación. Nunca se acepta un costo de otra.
2. **Partidas especiales existentes sin `especificacion_tecnica`** no vinculan: hay que recostearlas, igual que las que no tienen promesa v1. Falla cerrado.
3. **Observación fuera del alcance de esta ronda, probada:** Costear no puede agregar a una cotización un especial con una pieza marcada `excluida`.
   - El validador descarta `excluida`, así que el servidor costea esa pieza.
   - El cliente no la costea.
   - La paridad falla cerrada ("cliente y servidor difieren").

   No abre un hueco económico, pero la función de excluir piezas no sirve hoy desde Costear. Prueba: "observación (fuera de alcance)" en el bloque Q3.
