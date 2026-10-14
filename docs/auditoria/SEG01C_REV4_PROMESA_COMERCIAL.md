# SEG-01c rev4 · `promesa_comercial_v1`

## Qué se corrigió

En la rev3 se comparaba la **identidad** del mueble: nombre, w, d, h, medidas, material (texto) y descripción. Eso no veía lo que de verdad cambia el mueble que se fabrica y se entrega:

- el material del despiece (`insumoId`);
- acabado, color, accesorios y electrificación (viven en `config`);
- las piezas incluidas y las excluidas;
- la variante de catálogo.

Consecuencia: el costeo K de un escritorio de melamina blanca se podía vincular por primera vez a otro escritorio con el mismo nombre, las mismas medidas y la misma cantidad, pero en nogal, electrificado o con el cristal excluido.

La rev4 define la **promesa comercial v1**: una proyección versionada de la partida que conserva sólo lo que se le promete al cliente. Hay una sola definición con dos implementaciones que deben dar exactamente lo mismo:

- **JS:** `src/datos/promesaComercial.js` → `promesaComercialDeCosteo()`. La usan el cliente y la Edge `costear-servidor-rc`.
- **SQL:** `private_api.promesa_partida()` y `private_api.huella_promesa()`, en `supabase/migrations/PROPUESTA_seg01c_vinculo_costeo_partida.sql`, dentro del bloque marcado `promesa_v1`.
- **Fixtures doradas compartidas:** `supabase/tests/fixtures/promesaComercialGolden.json`, 11 casos con el resultado esperado escrito a mano.
  - JS: `src/datos/promesaComercial.test.js`.
  - SQL: `supabase/tests/promesaComercialGolden.test.js`. Comprueba que SQL = esperado = JS, que la función es idempotente y que la huella es la misma.

## Inventario de campos de la partida

Fuente: inventario de `cotizaciones.partidas[]` hecho con citas `archivo:línea` sobre el código de la rama. Los productores son `crearPartida`, `partidaAutoritativaDeCosteo`, `programaRealDelPlano`, `reconciliarPartidas` y `confirmarPrograma`. Lo que se imprime sale de `pdfPropuesta.js` y de `Cotizacion.jsx .cot-cliente`.

### Campos que ENTRAN a la promesa

| Campo | Razón |
|---|---|
| `nombre` | Es el único texto descriptivo que se imprime (PDF y vista de impresión). |
| `w`, `d`, `h` | Medidas del mueble. `w` y `d` se editan en EditarPartida; `h` se incluye por si algún camino lo llena (hoy ninguno lo hace). |
| `medidas`, `material`, `acabado`, `descripcion` (texto) | Hoy ningún camino los escribe, pero algún código los lee (`clientSafe.js:32`, `juntasLayout.js:47`). Si aparecen, son promesa. Fail-closed. |
| `usuarios` | Capacidad declarada del mueble (filas de programa del plano). |
| `config` completo, sin nulos | Es la configuración del generador: largo, fondo, lateral, diámetro, usuarios, acabado (`finish`), `color`, `biombo`, **accesorios** (`archivero`, `gaveta(s)`, `cerradura`, `pantalla`, `faldon`, `laterales`, `divisores`, `manejacables`, `ductos`) y **electrificación** (`electrico`, `arnes`, `cableada`, `acometida`). Decide qué se fabrica. No existe un campo `accesorios` ni `electrificacion` aparte. |
| `catalogo.clave` | Identidad de la variante. Voni cambia la clave al elegir terminación. |
| `producto_id`, `producto_version_id`, `productoId`, `claveLinea` | Identidad del producto y de la línea. Se aceptan las tres grafías que circulan. |
| `materiales` | Viene del `insumoId` de todo el despiece: `componentes` de un costeo y `pieza.componentes` de una partida de IA. El `insumoId` identifica el material y el acabado exactos, por ejemplo `erp-mdf16m-b806`. La partida especial de la rev4 lo lleva explícito. |
| `piezas` | Piezas incluidas: los nombres del despiece menos los excluidos. |
| `nombresExcluidos` | Piezas que Von Haucke **no** suministra. Se imprimen en la cláusula del PDF. Une `nombresExcluidos` con los componentes marcados `excluida: true`. |

### Campos que NO ENTRAN a la promesa

| Campo | Razón |
|---|---|
| `render`, `imagen` | Son la ilustración. El render se regenera desde `nombre` y `ruta`. |
| `ruta` | Sólo elige la foto de catálogo y el tipo de mueble en planos y hojas de área. Es visual. |
| `zone_id`, `instance_id`, `anchor_instance_id`, `anchor_role`, `functional_group_id`, `relation_role`, `requirement_id`, `plan_tag`, `plan_source_ref`, `grouping`, `placement_profile`, `user_capacity`, `bancoId` | Enlaces del acomodo. No cambian el mueble. |
| `id`, `piezaId`, `origen`, `loteIA`, `source`, `source_type`, `source_ref`, `product_source_ref`, `evidence`, `expedienteId` | Identificadores internos y procedencia. El producto lo fijan nombre, medidas, materiales y variante. |
| `nota`, `confianza`, `avisos`, `sellerSafe`, `candadoUsuarios`, `requiereProyectista` | Notas y metadatos de interfaz. `nota` no se imprime: es la justificación que da la IA. |
| `variantes` | Es la lista de opciones, no la opción elegida. Lo elegido va en `catalogo.clave`. |
| `catalogo.lista`, `catalogo.minimo`, `catalogo.full`, `precioUnitario`, `costoUnitario`, `margen`, `costoDerivado`, `costoPendiente`, `precioReal`, `precio_lista_snapshot`, `lista_precio_item_id`, `descuento`, `supplier`, `profit`, `precioAutorizado`, `precioProvisional`, `costoDesconocido` | Son economía. Ésta tiene su propio control: costo idéntico al del servidor, frescura y `precio_id`. |
| `cantidad` | Se compara aparte, como en la rev3: el costeo es de N piezas. |
| `costoEstado`, `costeoId`, `bomHash`, `versionMotor`, `versionCatalogo`, `piezasSinMaterial`, `nombresSinMaterial` | Son el estado y la traza del costo, no la promesa. |
| `identity_status`, `price_status`, `product_status`, `cost_status` | Son banderas de estado. |
| `pieza.horas`, `pieza.factor*`, `pieza.modoManoObra` | Son la base técnica y económica del costo. |
| `descripcionCliente`, `materiales` y `tipoMueble` **del Costeador** | No viajan a la partida (`agregarCosteo.js`). Sólo los imprime FichaPDF, sobre el costeo, no en la propuesta. |

## Cómo se ata la promesa al costeo

1. **Costear.** `intentDesdePieza` declara `promesa` con la misma identidad, la clave de línea y las excluidas que tendrá la partida.
2. **Validar.** `validarIntentCosteo` corre en el cliente y en la Edge. Se queda sólo con lo declarable (`PROMESA_DECLARABLE`). Saca `materiales` y `piezas` del despiece saneado que se costea, nunca de lo que diga el navegador.
3. **Registrar.** La Edge guarda `promesa_origen` en `costeos_servidor`. El trigger `trg_costeo_promesa_servidor` hace tres cosas:
   - la vuelve a proyectar con la función SQL;
   - fija `promesa_version = 'v1'` y `promesa_huella = md5(promesa)`;
   - rechaza cualquier cambio posterior, incluso de `service_role`.
4. **Agregar a la cotización.** `partidaAutoritativaDeCosteo` arma la partida con **esa misma** promesa: `materiales`, `piezas`, `nombresExcluidos`, nombre, w y d.
5. **Vincular.** `adjuntar_costeo_a_partida`:
   - Si el K no trae promesa v1, no hay vínculo. La promesa nunca se aprende de la partida.
   - En el primer vínculo y en el recosteo, exige `huella_promesa(partida actual) = promesa_huella(K)`. En el recosteo, K2 se compara contra **su** promesa de origen.
   - En la rama idempotente (mismo K vigente y misma partida) exige la misma huella de partida y la misma promesa. No exige que lo vincule quien creó el costeo.
6. **Emitir.** `motivos_autoridad_costeo` agrega dos motivos: `linea_N_costeo_sin_promesa` y `linea_N_promesa_distinta_al_costeo`.

## Pruebas

Archivo: `supabase/tests/seg01cVinculoCosteo.test.js`. Usa PGlite con el SQL real y sesiones `authenticated`.

### Bloque rev4

- **Q2.** El K de A no se vincula por primera vez a B cuando B tiene el mismo nombre, las mismas medidas y la misma cantidad pero cambia cualquiera de estos campos:
  - material (`insumoId`);
  - acabado (en `config` y como texto);
  - accesorio;
  - electrificación;
  - configuración (lateral);
  - `nombresExcluidos`;
  - variante de catálogo.

  En cada caso se verifica que no queda vínculo vigente, que el costeo no se consume y que la emisión no se permite.
- **Cristal excluido ⇄ incluido.** Falla en los dos sentidos. Cada versión sí se vincula con su propio K.
- **K sin promesa.** No se vincula.
- **K1→K2.** K2 vincula con su promesa. K1 queda `reemplazado_por` y no revive. Sólo K2 queda vigente.
- **K2 no lava un cambio posterior.** Si la partida cambia después de nacer K2, K2 no se vincula. Un K3 costeado con la promesa nueva sí se vincula.
- **Campos visuales** (render, acomodo, instancia): el vínculo sigue siendo idempotente, no hay motivos y la emisión sigue ALLOWED.
- **Rama idempotente con traspaso Diseño → Dirección:** funciona sin exigir al creador.
- **Emisión:** detecta una promesa distinta aunque el vínculo se haya escrito por fuera de la RPC.
- **Sellado:** el servidor fija la versión y la huella, nadie las puede cambiar después y una versión desconocida se rechaza.

### Bloque "ANTES · rev3 (96bab98)"

Fixture: `supabase/tests/fixtures/seg01c_rev3_96bab98.sql`. Los mismos ataques **pasaban** con la rev3: distinto material, acabado, electrificación o cristal excluido terminaban vinculados y ALLOWED.

### Propiedades de la rev3 que se conservan

Replay entre cotizaciones y entre partidas, mutación después del vínculo, CAS entre guardado y vínculo, K1→K2, idempotencia, frescura de precio/catálogo/configuración/motor, costo certificado > 0 y `precio_id` exacto. Siguen pasando las 77 pruebas del archivo.

**Cambio de comportamiento intencional:** un especial con `productoId` de texto, que es la clave de línea, ahora necesita un K que declare esa misma clave.

## Límites conocidos

1. **La promesa la declara quien costea.** El servidor no puede saber que un despiece "es" una mesa. Lo que sí garantiza es que nombre, medidas, configuración, variante y exclusiones son los mismos que se declararon al costear, y que `materiales` y `piezas` salen del despiece que de verdad costeó.
2. **Exclusiones por nombre.** La Edge no recibe la bandera `excluida`, porque el validador la descarta a propósito. Por eso la resta de excluidas se hace por nombre en los dos lados. Si dos piezas se llaman igual y sólo una está excluida, ambas salen de `piezas`. El resultado es el mismo en el cliente y en el servidor, así que no abre un hueco, pero describe peor la pieza.
3. **Render guardado por un vendedor.** En producción, VH-035c (fuera de SEG-01c) marca "recosteo pendiente" cuando un vendedor guarda un render. Es fail-closed: no abre un hueco económico, pero obliga a recostear sin necesidad. Corregirlo requiere otra migración y no entra en este cierre.
4. **Dominio del contrato (JS ↔ SQL).** `promesaComercialDeCosteo` y `private_api.promesa_partida` son **equivalentes dentro del contrato soportado**, no "para cualquier JSON". Ese contrato son los números admitidos dentro del rango exacto de un `double` de JS (enteros hasta `Number.MAX_SAFE_INTEGER` = 2^53−1 y decimales de hasta 15 cifras significativas), los textos y las listas de las fixtures doradas.

   Fuera de ese dominio, por ejemplo un número con más precisión de la que guarda un `double`, JS redondea y SQL no. La huella sale distinta y el resultado es un **rechazo** (fail-closed), nunca un vínculo indebido.

   No es blocker. La spec técnica (rev5) sí rechaza explícitamente los números fuera de dominio en JS y en SQL (`SEG01C_REV5_SPEC_TECNICA.md`).
