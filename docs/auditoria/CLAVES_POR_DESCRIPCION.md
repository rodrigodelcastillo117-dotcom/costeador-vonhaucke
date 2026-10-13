# Claves por descripción: patas ATPU, ATFAL150ABS y el módulo App LT de 12 usuarios · 2026-10-13

**Para:** Dirección. **Alcance:** en Supabase `mtuvnbgljwbsaizjjgzs` solo se hicieron consultas `SELECT`; no se escribió nada. En el repo solo se escribió este archivo y no hay commit.

**Pregunta de Dirección:** "¿Cuánto varían las patas ATPU y ATFAL150ABS, y por qué? Revisa las descripciones al 100 %. El módulo de 12 usuarios sí debe tener clave ERP propia. Revisa todas las dudas de claves por descripción; probablemente ahí está la respuesta."

---

## 0. Respuesta corta

1. **Los dos registros de cada código duplicado no varían en precio ni en medida.** Los 6 pares (ATOM3, ATPU2M, ATPU3M, ATPU4M, ATPU75M y ATFAL150ABS) tienen el mismo precio de lista y las mismas medidas. Lo que cambia es la ficha:
   - el **nombre**: la descripción ERP completa contra "App LT · Pata";
   - el **origen**: `linea` contra `banco`;
   - el **piso mínimo**, que solo tiene el registro `linea`;
   - en el registro `banco` de ATFAL150ABS, la **categoría y el orden de las medidas**.

   Existen dos porque la migración base del 2026-10-02 cargó **por separado** el catálogo de línea (Excel ARTICULOS-LINEAS 2026-08-18) y el banco de precios (presupuesto 225120019, PrestigeMotors, dic-2025). No deduplicó por clave. **Ninguna cotización usa ninguno de los dos registros.** **El canónico debe ser el de línea:** ids 433, 444, 445, 446, 449 y 426.
2. **Lo que sí varía, y mucho, es la familia ATPU entre sí y contra su costo:**
   - El precio de lista **no sigue la medida**. ATPU75M (750 mm) cuesta $890, más que ATPU3M (900 mm, $650) y que ATPU4M (1200 mm, $770). ATPU6M (1800 mm, $1,700) cuesta más que ATPU7M (2100 mm, $1,550).
   - El costo sí sigue la medida. Fabricación según Intelisis: 600 → $743, 750 → $787, 900 → $856.
   - El patrón de precios muestra **dos reglas distintas** en el mismo Excel:
     - 2M, 3M, 4M y 5M: lista ≈ 0.52 × FULL y mínimo = 0.80 × lista.
     - 75M, 6M, 7M y ATPU: lista ≈ 0.60 × FULL y mínimo ≈ 0.70 × lista.
   - **ATPU4M se vende por debajo del costo ERP.** La lista es de $770 y el costo de entrada de PT del pedido 38247 es de $1,005.49 (−23 %).
   - **ATFAL150ABS no es una pata.** Es el *conducto faldón para escritorio de 1500* (mide 900 × 379 × 177). El banco lo bautizó "App LT · Escritorio".
3. **Módulo de 12 usuarios (id 1898): no existe clave ERP propia en ninguna fuente consultada.** Revisé la base, el repo, los Excel de `src/datos/fuentes` y `lab/applt`.
   - El patrón de las claves que sí existen lleva a **PROPUESTA: `TATO127212ABCT01`**. Alternativa: `TATO127212ABCRT01`.
   - Es una propuesta y no un dato. Hay que darla de alta o confirmarla en Intelisis.
4. **Otras dudas que se resuelven por descripción:**
   - 28 códigos activos duplicados (no 6).
   - 116 productos activos de banco sin código. De ellos, 17 tienen una clave existente con el mismo precio y la misma medida, y 8 pares son el mismo mueble cargado dos veces sin clave.
   - 11 registros de banco cuya clave pertenece a otra cosa: 2 con una clave de componente puesta a un mueble completo y 9 con un nombre o una categoría que contradice la descripción.

---

## 1. Los 6 códigos duplicados, campo por campo

### 1.1 Ficha en `productos`

Evidencia Q1: `select * from productos where id in (433,1844,444,1847,445,1848,446,1849,449,1850,426,1732,1898)`.

Campos **iguales** en los 12 registros:
- `estado` = `activo`
- `activo` = `true`
- `ficha_tecnica` = `null`
- `descripcion_comercial` = `null`
- `render_principal_url` = `null`
- `creado_por` = `baseline_migration`

| Campo | Registro **línea** (ERP) | Registro **banco** |
|---|---|---|
| ids | 433 ATOM3 · 444 ATPU2M · 445 ATPU3M · 446 ATPU4M · 449 ATPU75M · 426 ATFAL150ABS | 1844 · 1847 · 1848 · 1849 · 1850 · 1732 |
| `nombre` | Descripción Intelisis completa, p. ej. `PATA TIPO "U" DE 600 X 720 mm MODELO APPS LT; METALICA -- ATPU2M` | Nombre corto: "App LT · Omega", "App LT · Pata" (×4), "App LT · Escritorio" (ATFAL150ABS) |
| `familia` | `APPS LT` | `App LT` |
| `source_type` / `source_ref` | `linea` / la clave (`ATPU2M`…) | `banco` / `p9-app-lt-pata-610`, `-650`, `-770`, `-890`, `p9-app-lt-omega-200`, `p9-app-lt-escritorio-950` |
| `legacy_meta` | `{cc, piso, ruta:'applt', precio_v1}` | `{tipo, fuente:'225120019', medidas, material, categoria, precio_v1}` |
| `creado` | 2026-10-02 06:06:52.005 (lote línea) | 2026-10-02 06:06:53.169 (lote banco, 1 s después) |
| Versión técnica | 1 versión `base`, `aprobado`; `dimensiones`, `atributos` y `bom_hash` en `null` (Q2) | Igual: 1 versión `base`, sin dimensiones |
| `producto_version_economia` | Sin fila: costo oficial vacío (Q2) | Sin fila |
| `variantes_producto` | Ninguna (Q3) | Ninguna |

Versiones vigentes:
- Línea: 1324, 1245, 1906, 577, 83 y 1256.
- Banco: 1578, 166, 1014, 895, 476 y 59.

### 1.2 Precio y medidas por par

Fuentes:
- Q4: `lista_precio_items` × `listas_precio`. Una sola lista, *Von Haucke — Lista Base V1*, aprobada el 2026-10-02.
- `src/datos/preciosLinea.js:457,464,475-477,480`.
- `src/datos/banco.js:46,158,161-164`.

| Clave | Medida en descripción ERP | Medida en banco | Lista (línea / banco) | Piso mínimo (línea / banco) | FULL ("precio 2") | ¿Varía? |
|---|---|---|---|---|---|---|
| ATPU2M | 600 × 720 | 600 × 720 | 610 / 610 | 490 / **null** | 1,170 | Solo el piso |
| ATPU75M | 750 × 720 | 750 × 720 | 890 / 890 | 630 / **null** | 1,490 | Solo el piso |
| ATPU3M | 900 × 720 | 900 × 720 | 650 / 650 | 520 / **null** | 1,240 | Solo el piso |
| ATPU4M | 1200 × 720 | 1200 × 720 | 770 / 770 | 620 / **null** | 1,470 | Solo el piso |
| ATOM3 | 850 × 100 × 17 | 850 × 100 × 17 | 200 / 200 | 160 / **null** | 370 | Solo el piso |
| ATFAL150ABS | **900 × 379 × 177** | **900 × 177 × 379** | 950 / 950 | 760 / **null** | 1,800 | Piso, **orden de medidas** y **categoría** |

Diferencias en ATFAL150ABS (`banco.js:46`):
- **Orden de medidas.** El banco reacomodó las medidas. Si se aplica VH-099 (`supabase/migrations/20261012060000_vh099_dimensiones_catalogo.sql`, que toma de banco "ancho × fondo × alto" en ese orden), el registro de banco quedaría con fondo 177 y alto 379, y el de línea con fondo 379 y alto 177.
- **Categoría.** El banco lo clasifica como `categoria:'Escritorios', tipo:'modulo'` cuando es un **componente**. La descripción literal del mismo renglón dice "Conducto faldon para escritorio modelo apps lt…".

### 1.3 Uso en cotizaciones

Evidencia Q5: búsqueda en `cotizaciones.partidas` (jsonb) por `productoId`, `producto_id`, `productoVersionId`, `producto_version_id` y `bancoId`, y por texto en `cotizaciones_revisiones.snapshot`.

| Registro | Partidas | Cotizaciones |
|---|---|---|
| 433, 444, 445, 446, 449 y 426 (línea) | 0 | 0 |
| 1844, 1847, 1848, 1849, 1850 y 1732 (banco) | 0 | 0 |
| **Los 56 productos de los 28 códigos duplicados** | **0** | **0** |
| Snapshots de revisiones con ATPU*, ATOM3 o ATFAL150ABS | 0 | 0 |

Las claves ATPU3M y ATPU4M sí aparecen en 12 partidas, pero solo como **texto dentro del BOM paramétrico** del configurador APP LT, por ejemplo `"Pata U (ATPU4M)", cantidad 13.2, insumoId "ptr"`. Ahí se cuestan como metros de PTR, no como el producto. Ese costo no viene de ninguno de los dos registros.

Las cotizaciones son la 840, 757, 702, 703, 783, 784, 834, 1157, 1658 y 1668.

### 1.4 Por qué existen dos

- El registro **línea** viene de `src/datos/preciosLinea.js`, autogenerado del Excel `ARTICULOS-LINEAS-2026-08-18.xlsx` (`preciosLinea.js:1-15`). Trae clave ERP, descripción Intelisis, FULL, lista y mínimo.
- El registro **banco** viene de `src/datos/banco.js`. Es un renglón leído del presupuesto **225120019 (PrestigeMotors, dic-2025)** (`banco.js:388,417`). Ese presupuesto cotizó las piezas sueltas a precio de lista, por eso el precio coincide. El nombre corto y buscable se generó con la regla "Línea · Qué es" (`banco.js:26-30`).
- La migración base (`creado_por = baseline_migration`, 2026-10-02) cargó los dos lotes uno tras otro sin deduplicar por clave. El deduplicador `bancoUnico()` (`banco.js:393-490`) solo junta renglones **dentro del banco**, no banco contra línea.
- La RPC de carga de costo oficial ya previó el choque. `supabase/migrations/20261012061000_vh100_cargar_costos_oficiales.sql:51-56` rechaza con `CODIGO_DUPLICADO` si no se manda `producto_id`. **Esa función no existe hoy en la base:** `pg_proc` no tiene `cargar_costos_oficiales` (Q6). La migración no está aplicada.

### 1.5 Recomendación: canónico para cargar costo

**Usar el registro de línea:** 433 (ATOM3), 444 (ATPU2M), 445 (ATPU3M), 446 (ATPU4M), 449 (ATPU75M) y 426 (ATFAL150ABS).

Evidencia:
1. Su `nombre` es **idéntico, carácter por carácter, a la descripción del artículo** en las tres fuentes ERP independientes:
   - los reportes del cotizador Intelisis (`lab/applt/componentes/ATPU2M.json`, `"descripcion"`);
   - el pedido real 38247 (`src/datos/appltDatos.js:15-37`);
   - el Excel de líneas (`preciosLinea.js:475`).
2. Es el único que tiene **piso mínimo** (`lista_precio_items.piso_minimo`), que la política comercial necesita.
3. Su `source_ref` es la clave ERP. En el de banco es un id interno de presupuesto.
4. Mover el costo a línea no rompe nada, porque ninguno de los dos tiene cotizaciones (§1.3).
5. El de banco de ATFAL150ABS está mal clasificado (escritorio/módulo) y con las medidas en otro orden.

Para que la propuesta de costos de `lab/applt/costos_oficiales/propuesta_carga.json` entre, hay que cargarla con esos `producto_id`. Hoy va solo con `codigo` y la RPC la rechazaría. Valores de la propuesta:

| Clave | Costo propuesto |
|---|---|
| ATPU2M | 547.41 |
| ATPU3M | 615.23 |
| ATPU75M | 572.94 |
| ATOM3 | 75.29 |
| ATFAL150ABS | 429.87 |

Después, el registro de banco puede desactivarse o redirigirse a la versión de línea. Eso lo decide Dirección; aquí no se tocó nada.

---

## 2. Cuánto varían las patas ATPU y por qué

### 2.1 Toda la familia ATPU

Fuentes: `preciosLinea.js:474-481` y Q7.

| Clave | Descripción ERP | Claro (mm) | FULL | **Lista** | Mínimo | Lista/FULL | Mín./Lista |
|---|---|---|---|---|---|---|---|
| ATPU | PATA **UNIVERSAL** 150 × 722 × 102, Basic White | — | 550 | **340** | 231 | 0.62 | 0.68 |
| ATPU2M | PATA TIPO "U" 600 × 720 | 600 | 1,170 | **610** | 490 | 0.52 | 0.80 |
| ATPU75M | PATA TIPO "U" 750 × 720 | 750 | 1,490 | **890** | 630 | 0.60 | 0.71 |
| ATPU3M | PATA TIPO "U" 900 × 720 | 900 | 1,240 | **650** | 520 | 0.52 | 0.80 |
| ATPU4M | PATA TIPO "U" 1200 × 720 | 1200 | 1,470 | **770** | 620 | 0.52 | 0.81 |
| ATPU5M | PATA TIPO U 1500 × 720 × 146, "APP LT", **sin "-- ATPU5M" al final** | 1500 | 1,690 | **890** | 710 | 0.53 | 0.80 |
| ATPU6M | PATA TIPO U 1800 × 720 × 146 | 1800 | 2,830 | **1,700** | 1,190 | 0.60 | 0.70 |
| ATPU7M | PATA TIPO U 2100 × 720 × 146 | 2100 | 2,580 | **1,550** | 1,082 | 0.60 | 0.70 |

Lectura de la tabla:
- **El precio no es monótono con la medida.**
  - La de 750 cuesta $890, igual que la de 1500 y más que las de 900 y 1200.
  - La de 1800 ($1,700) cuesta más que la de 2100 ($1,550).
  - En FULL pasa lo mismo: 75M ($1,490) > 4M ($1,470) > 3M ($1,240).
- **Hay dos reglas de precio en el mismo catálogo:**
  - 2M, 3M, 4M y 5M: lista ≈ 0.52 × FULL y mínimo = 0.80 × lista.
  - 75M, 6M, 7M y ATPU: lista ≈ 0.60 × FULL y mínimo ≈ 0.70 × lista. Esto equivale a "FULL con 40 % de descuento", la regla que `banco.js:14-19` describe para el "precio 2".

  Es un cálculo nuestro sobre las columnas del Excel. **Cuál de las dos reglas es la vigente no lo sé.** Hay que preguntarlo a quien mantiene la lista.
- **Hay dos redacciones de descripción:**
  - 2M, 3M, 4M y 75M: `PATA TIPO "U" DE n X 720 mm MODELO APPS LT; METALICA -- CLAVE`.
  - 5M, 6M y 7M: `PATA TIPO U  DE n X 720 X 146 mm MODELO APP LT, METALICA`, con doble espacio, tercera medida y "APP" en vez de "APPS". La de ATPU5M no trae la clave al final.

  Parecen dados de alta en otro momento o por otra persona. Es una inferencia por redacción; no tengo la fecha de alta.

### 2.2 El nombre de la clave sí cuadra con la medida

- Patrón: un dígito n significa n × 300 mm. 2M = 600, 3M = 900, 4M = 1200, 5M = 1500, 6M = 1800 y 7M = 2100. Así lo mapea el generador: `src/datos/applt.js:69-70`.
- "75" es 750 mm literal, la misma convención de las cubiertas. Por ejemplo, ATCE675ABSOPG es 1800 × **750** (`preciosLinea.js`, Q8).
- No hay error de clave contra descripción en las ATPU.

### 2.3 Costo contra precio: aquí está la variación grande

Fuentes:
- `lab/applt/componentes/ATPU*.json` (`costos_reporte`, reportes Intelisis del 12/08/2026).
- `lab/applt/costos_oficiales/propuesta_carga.json` (regla de Dirección 2026-10-13).
- `src/datos/appltDatos.js:735-748` (pedido 38247: costo de entrada de PT y lista del pedido).

| Clave | MP | Horas PM | Costo fabricación Intelisis | Costo propuesta Dirección | Costo ERP (entrada PT, pedido 38247) | "Precio lista" del cotizador Intelisis | **Lista comercial** | Lista ÷ costo Dirección |
|---|---|---|---|---|---|---|---|---|
| ATPU2M (600) | 275.83 | 1.4078 | 743.36 | 547.41 | — | 3,483 | **610** | 1.11 |
| ATPU75M (750) | 282.54 | 1.5012 | 786.58 | 572.94 | 785.20 | 3,682 | **890** | 1.55 |
| ATPU3M (900) | 292.42 | 1.6628 | 855.83 | 615.23 | — | 4,006 | **650** | 1.06 |
| ATPU4M (1200) | sin reporte (`componentes/LEEME.md` §2) | 2.1556 (`applt.js:208`) | — | — | **1,005.49** | — | **770** | 0.77 contra ERP |

- De 600 a 900 mm, el costo sube 12 % según la propuesta de Dirección (547 → 615) y 15 % según Intelisis (743 → 856). En el mismo tramo, la lista va de 610 a 890 y luego a 650. **La variación del precio de lista no la explica el costo.**
- **Riesgo de margen:**
  - **ATPU4M a lista ($770) queda 23 % abajo de su costo ERP real ($1,005.49).**
  - **ATPU2M y ATPU3M a piso mínimo (490 y 520) quedan abajo del costo propuesto** (547 y 615).
- El "precio lista" que imprime el cotizador Intelisis, de $3,483 a $4,006, sale de la cascada GO 30 % + utilidad 20 % + incremento 200 %. Es 4 a 6 veces la lista comercial y no se usa para cotizar.

### 2.4 ATFAL150ABS: qué es y por qué se llama así

- **Descripción ERP** (`preciosLinea.js:457`; `componentes/ATFAL150ABS.json`): `CONDUCTO FALDON PARA ESCRITORIO DE 900 X 379 X 177 mm MODELO APPS LT CON MELAMINA CANTO ABS; METALICO`. Es un faldón, no una pata ni un escritorio.
- **La serie ATFAL usa otra convención:** el número es el **largo del escritorio en decímetros**, no la medida de la pieza (`src/datos/applt.js:115`, `FALDON_CLAVE`).

  | Escritorio | Clave | Medida del faldón | Lista |
  |---|---|---|---|
  | 1200 | ATFAL12ABS | 800 | $830 |
  | **1500** | **ATFAL150ABS** | **900** | **$950** |
  | 1800 | ATFAL18ABS | 1200 | $1,340 |
  | 2100 | ATFAL21ABS | 1500 | $1,670 |
  | 2400 | ATFAL24ABS | 1800 | $2,130 |

  Fuentes: `preciosLinea.js:456-460`.
- "150" rompe la serie, que con dos dígitos sería ATFAL15ABS. Es la clave real del ERP y no hay que cambiarla. Explica por qué parece "1500" cuando la pieza mide 900.
- **Costos:** fabricación Intelisis 491.92, propuesta Dirección 429.87, lista 950, piso 760. Lista ÷ costo = 2.2.
- **No varía entre sus dos registros:** precio 950 en ambos. Solo cambian la categoría y el orden de las medidas (§1.2).

---

## 3. Clave ERP del módulo de 12 usuarios (id 1898)

### 3.1 Lo que hay hoy

Fuentes: Q1, Q4 y Q9; `src/datos/banco.js:237-239`.

**Producto:**

| Campo | Valor |
|---|---|
| id | 1898 |
| `codigo` | `NULL` |
| `nombre` | "Módulo operativo App LT 12 usuarios (biombo cristal)" |
| `source_ref` | `op-12u-7200x1200-cristal` |
| `medidas` | 7200 × 1200 mm |
| `material` | "Cubiertas ABS, biombo en cristal transparente, estructura y acometida metálica" |
| `fuente` | **226030004** (Grupo Tradeco, mar-2026). `BANCO_FUENTES` la etiqueta "con descuento vol." (`banco.js:379`) |
| Versión técnica | 1100: sin dimensiones y sin costo |
| Lista | $34,010 |

**Uso:** 9 partidas en 9 cotizaciones (ids 1295, 1296, 1329, 1331, 1372, 1484, 1485, 1706 y 1708). Todas son borradores de `qa-direccion@…` del 2026-10-13, con `cost_status: UNKNOWN` (Q10).

### 3.2 Búsqueda de la clave

En ninguna fuente aparece una clave para APP LT 12U 7200 × 1200.

| Fuente | Qué se buscó | Resultado |
|---|---|---|
| `productos` (codigo, nombre, source_ref, legacy_meta) | `^TATO`, "12 usuarios", 7200, 12U | Solo 5 TATO: TATO1126AB0001, TATO1156AB0001, TATO21512ABCT01, TATO63612ABCRT01 y TATO84812ABCT01. Con 12 usuarios o 7200 solo aparece el 1898 |
| `insumos_catalogo` (10,964 artículos ERP) | id, nombre o atributos con TATO, ATPU, 7200 o APP LT | Ningún TATO. Los 3 "TATO" son PRESOSTATO y TERMOSTATO, coincidencias de texto |
| `insumo_mapeos_externos`, `variantes_producto`, `expedientes`, `reglas`, `aprendizajes`, `config`, `direccion`, `confirmaciones` | `TATO[0-9]` | 0 |
| `cotizaciones.partidas` y `cotizaciones_revisiones.snapshot` | `TATO[0-9]` | 0 |
| Repo completo (sin `node_modules` ni `dist`) | `TATO[0-9A-Z]+` | 10 claves: TATO63612AB001, TATO63612ABS001, TATO63612ABCRT01, TATO84812ABCT01, TATO84812ABY01, TATO21512ABCT01, TATO43012ABT01, TATO1156AB0001, TATO1126AB0001 y "TATO84812" (texto de búsqueda). **Ninguna de 12U** |
| `src/datos/fuentes/*.xlsx` (ARTICULOS-LINEAS, COSTOS-Alba ×2, SOLICITUD-Rafa) | `TATO`, "12 USUARIOS", 7200 en sharedStrings | Sin TATO. El "7200" solo aparece dentro de números de artículo y de pedido ajenos |
| `lab/applt/*` (pedido 38247, libro Coste APP LT, guía, 15 reportes) | — | Solo 6U (TATO63612AB001) y 8U (TATO84812ABY01) |

**Conclusión: la clave ERP propia del 12U no está en ninguna fuente a la que tengo acceso.**

Hay una pista, pero no es prueba. El texto de `material` del 1898, "Cubiertas ABS, … estructura y acometida metálica", tiene la misma redacción que la descripción ERP del 6U: "CON CUBIERTAS EN ABS, SIN BIOMBO, ESTRUCTURA Y ACOMETIDA METALICA" (`appltDatos.js:12`). Eso sugiere que el presupuesto 226030004 se transcribió de un artículo ERP. La carga original de BMU y Tradeco (`banco.js:215-239`) **no guardó el campo `clave`** en ningún renglón `op-*`.

**Siguiente paso:** revisar el PDF del presupuesto 226030004 o buscar en Intelisis "MODULO OPERATIVO APP LT DE 7200 X 1200".

### 3.3 Patrón de clave deducido de las claves reales

| Clave real | Descripción | Usuarios | Largo | Fondo | Lectura |
|---|---|---|---|---|---|
| TATO1126AB0001 | Módulo operativo 1 usuario 1200 × 600 (`banco.js:34`) | 1 | 1200 | 600 | TATO·1·12·6 |
| TATO1156AB0001 | Módulo operativo 1 usuario 1500 × 600 (`banco.js:32`) | 1 | 1500 | 600 | TATO·1·15·6 |
| TATO21512ABCT01 | 2 usuarios, bench doble, cristal 1500 × 1200 (`banco.js:121`) | 2 | 1500 | 1200 | TATO·2·15·12 |
| TATO43012ABT01 | 4 usuarios 3000 × 1200, semimamparas de cristal transparente (`scratchpad/sona-build.py:25`) | 4 | 3000 | 1200 | TATO·4·30·12 |
| TATO63612AB001 / ABS001 | 6 usuarios 3600 × 1200 **sin biombo** (`appltDatos.js:11-12`) | 6 | 3600 | 1200 | TATO·6·36·12 |
| TATO63612ABCRT01 | 6 usuarios 3600 × 1200, **cristal transparente** (`banco.js:122`) | 6 | 3600 | 1200 | TATO·6·36·12 |
| TATO84812ABCT01 | 8 usuarios 4800 × 1200, **cristal transparente** (`banco.js:123`) | 8 | 4800 | 1200 | TATO·8·48·12 |
| TATO84812ABY01 | 8 usuarios 4800 × 1200, **biombo PET** (`lab/applt/REGLAS_ARMADO.md:42`) | 8 | 4800 | 1200 | TATO·8·48·12 |
| **TAPO129615ABSS01** (línea App, no App LT) | "Modulo operativo de **12 usuarios 9600** x 1482 mm" (`banco.js:147`) | **12** | 9600 | 1482 | TAPO·**12**·96·15 |
| TAPO108015ABSS01 (App) | 10 usuarios 8000 × 1482 (Q11) | 10 | 8000 | 1482 | TAPO·10·80·15 |

Reglas que se infieren:
- Estructura: `TAT` + tipo (`O` operativo, `G` gerente, `D` directivo, `V` varios) + **usuarios** + **largo en dm** + **fondo en dm** + `AB` + acabado o biombo + consecutivo. `REGLAS_ARMADO.md:51` ya lo dejó anotado como deducido.
- **Con 10 o 12 usuarios el número va completo con dos dígitos.** La familia App lo hace así en TAPO108015 y TAPO129615.
- Sufijos para cristal transparente vistos: `CT` (2 casos, uno de ellos el 8U), `CRT` (1 caso, 6U) y `T` (1 caso, 4U). `Y` = PET. `AB001`/`ABS001` = sin biombo.

### 3.4 PROPUESTA (no es dato)

> **PROPUESTA: `TATO127212ABCT01`**: MODULO OPERATIVO APP LT DE 7200 X 1200 MM DE 12 USUARIOS CON CUBIERTAS EN ABS, BIOMBO DE CRISTAL TRANSPARENTE, ESTRUCTURA Y ACOMETIDA METALICA.
>
> - Alternativa, si se sigue el 6U con cristal: `TATO127212ABCRT01`.
> - Sin biombo: `TATO127212AB001`.
> - Hay que darla de alta o confirmarla en Intelisis antes de usarla. No la inventé como existente.

**BOM según la guía** (`REGLAS_ARMADO.md` §1; c = 6 cubiertas de 1200):

| Componente | Cantidad |
|---|---|
| ATCUBD44ABS | 6 |
| ATPU4M | 2 |
| ATPU75M | 5 |
| ATOM3 | 12 |
| ATRICDB4 | 6 |
| CIEPLA01300778 | 10 |
| ATACM | 1 |
| ATBIOCRT4 (biombo cristal transparente 1100 × 400, porque la cubierta es de 1200) | 6 |

**Contraste de precio, cálculo nuestro con la lista vigente:**

| Concepto | Monto |
|---|---|
| ATCUBD44ABS: 6 × 1,890 | 11,340 |
| ATPU4M: 2 × 770 | 1,540 |
| ATPU75M: 5 × 890 | 4,450 |
| ATOM3: 12 × 200 | 2,400 |
| ATRICDB4: 6 × 640 | 3,840 |
| ATACM: 1 × 270 | 270 |
| Placas CIEPLA01300778 (lista 0 en el pedido 38247) | 0 |
| **Subtotal sin biombo** | **23,840** |
| ATBIOCRT4: 6 × 1,510 | 9,060 |
| **Total con biombo** | **$32,900** |

- El banco dice $34,010, que es 3.4 % más.
- Con el biombo satinado ATBIOCRS4 (6 × 1,640) el total sería $33,680.

**Relacionados:**
- El 8U del banco **sin clave** (id 1896, `op-8u-4800x1200-cristal`, $23,070, Tradeco) tiene la misma configuración que **TATO84812ABCT01** (id 1809, $23,340, diferencia 1.2 %). Es muy probable que sea esa clave.
- El 10U (id 1897, 6000 × 1200, cristal, $28,540) tampoco tiene clave. Por el patrón sería `TATO106012ABCT01`; **PROPUESTA**, no dato.

---

## 4. Otras dudas de claves que se resuelven por descripción

### 4.1 Conteos

Fuentes: Q7, Q12, Q13 y Q14; el análisis de `banco.js` y `preciosLinea.js` está en §5.

| Hallazgo | Cantidad |
|---|---|
| Códigos activos duplicados en `productos` | **28** (56 productos) |
| · línea contra banco | 23 |
| · banco contra banco | 5: ALS41212BH7481, BCPU, LENO, MOAPDCU6ABS, SONATA-SB |
| · del par línea/banco, con el mismo precio | 14 |
| · del par línea/banco, con distinto precio | 9 |
| Partidas de cotización que usan alguno de los 56 | **0** |
| Productos activos de banco **sin código** | **116** (de 215 activos de banco) |
| · con clave existente, mismo precio y misma medida | **17** |
| · con clave probable o dudosa (precio cercano, misma configuración) | 3: 8U contra TATO84812ABCT01 (1.2 %), CONCERTO (6 %) y directivo 1800 × 2400 contra TATD11824AB001 (25 %, dudoso) |
| · mismo mueble cargado dos veces, ambos sin clave | **8 pares** |
| Banco con clave de **componente** puesta a un **mueble completo** | 2 (ABPATA90M, ATCUMJC3ABSOPG) |
| Banco con nombre o categoría que contradice su descripción | 9: 1732, 1733, 1717, 1806, 1784, 1745, 1718, 1785 y el de `p9-app-pata-3360` |
| Productos de línea activos con clave al final de la descripción distinta del `codigo` | 4, más 1 marcado "OBSOLETO" |
| Productos de línea activos sin "-- CLAVE" al final | 31. La mayoría trae la clave entre comillas (`- "CLAVE"`); las de ATPU5M y 4 de VIA no la traen |
| Módulos TATO reales **sin producto** en `productos` | 3: TATO63612AB001 (el del pedido 38247), TATO84812ABY01 y TATO43012ABT01 |

### 4.2 Los 20 casos más relevantes

| # | Caso | Evidencia | Qué dice la descripción | Acción sugerida |
|---|---|---|---|---|
| 1 | **ATPU4M** 446/1849 | Q1; `appltDatos.js:736,746` | Pata U 1200. Lista $770 contra costo ERP $1,005.49 | Revisar el precio de lista. Canónico: 446 |
| 2 | **ATPU75M** 449/1850 | Q1; `preciosLinea.js:480` | 750 mm a $890, más caro que 900 y 1200 | Confirmar la regla de precio (0.60 contra 0.52 × FULL). Canónico: 449 |
| 3 | **ATPU2M / ATPU3M** 444/1847, 445/1848 | `propuesta_carga.json` | Piso mínimo (490 y 520) abajo del costo propuesto (547 y 615) | Revisar el piso. Canónicos: 444 y 445 |
| 4 | **ATFAL150ABS** 426/1732 | `banco.js:46`; `applt.js:115` | Conducto faldón de escritorio 1500, pieza de 900. El banco lo llama "Escritorio" | Canónico: 426. Corregir la categoría del 1732 |
| 5 | **ATOM3** 433/1844 | Q1; `REGLAS_ARMADO.md` §6 | ERP 850 × 100 × 17; la guía GE dice 800 × 98 × 14 | Canónico: 433. Que Diseño confirme la medida |
| 6 | **Módulo 12U** 1898 sin código | §3 | 12 usuarios, 7200 × 1200, cristal | PROPUESTA TATO127212ABCT01 |
| 7 | 8U 1896 sin código | `banco.js:231,123` | 8U 4800 × 1200 cristal, $23,070 contra TATO84812ABCT01 $23,340 | Probablemente es TATO84812ABCT01 (id 1809) |
| 8 | op-1u 1892 sin código | `banco.js:219,32` | 1U 1500 × 600, $8,750 | Es **TATO1156AB0001** (id 1718): mismo precio y medida |
| 9 | ger-1500x750 1900 sin código | `banco.js:245,59` | Gerente 1500 × 750, $6,860 | Es **TATG1158AB0001** (id 1745) |
| 10 | ger-1800x750 1901 sin código | `banco.js:248,52` | Gerente 1800 × 750, $7,780 | Es **TATG11875ABF00001** (id 1738) |
| 11 | esc-varios-1800x900 1899 sin código | `banco.js:242,99` | 1800 × 900, $5,700 | Es **TATV1189AB0001** (id 1785) |
| 12 | rec-2420x830 1905 sin código | `banco.js:260,93` | Recepción 2U 2420 × 830, $29,920 | Es **TER42248ABD001** (id 1779) |
| 13 | mj-1200x1200-melamina 1910 sin código | `banco.js:277,63` | Mesa de juntas 1200 × 1200, $5,510 | Es **ALS41212BH7481** (id 1749). Esa clave ya está duplicada a $4,320 (1748) y $5,510 (1749) |
| 14 | op-2u / op-4u / op-6u (1893-1895) y p9 1723/1728/1729, todos sin clave | `banco.js:222-228` | Mismo precio y medida dos veces: 15,700, 25,980 y 36,260. Fuente 2508040 contra 225080025 | Mismo mueble cargado dos veces. Falta la clave TATO (por patrón: 2U 1500, 4U 3000, 6U 4500 × 1200) |
| 15 | **ABPATA90M** 248/1782 | `banco.js:96` | Clave de **pata Alba** ($1,240) puesta a una "Mesa alta 4 usuarios" ($5,170). El texto `material` dice "patas ALBA ABPATA90M" | Al 1782 le falta la clave del módulo; ABPATA90M es solo la pata |
| 16 | **ATCUMJC3ABSOPG** 421/1744 | `banco.js:58` | Clave de **cubierta circular Ø 900** ($2,020) puesta a una "Mesa circular" completa con base BESPOKE ($5,280) | Igual: falta la clave del módulo mesa |
| 17 | **ATCUMJ44ABS** 413/1717 | `banco.js:31` | El banco lo llama "Bench doble", categoría Operativos, y la descripción dice "Cubierta cuadrada… para banca doble". Precio $2,120 contra lista $2,690 | Es una cubierta. Canónico: 413 |
| 18 | ATCE42/52/675ABSOPG, ATCUL32/1052ABSOPG (377/1841, 382/1842, 390/1843, 412/1839, 411/1840) | Q12 | Las mismas cubiertas en banco (dic-2025) a 21-30 % menos que la lista 2026-08 | Precio viejo del banco; canónico: línea |
| 19 | p9-app-lt-mesa-de-juntas-6860 (1745) y p9-app-lt-escritorio-8750 (1718) | `banco.js:59,32` | El nombre dice "Mesa de juntas" o "Escritorio"; la descripción y la clave dicen "Módulo gerente" (TATG) y "Módulo operativo" (TATO) | Corregir el nombre corto: la clave manda |
| 20 | Línea: clave al final distinta del `codigo` (Q13) | Q13 | Ver lista abajo | Revisar con el ERP cuál es la vigente |

Detalle del caso 20:
- `CASPCIOMCU` (1516): la descripción termina en `CIOMCU900`.
- `EDFALBAS67EP` (1141): termina en `EXEDFALBAS67EP`.
- `P4EPFI02061295` (1714): termina en `PCH1516CN04-PI`.
- `CIRPC5` (35): termina en `.CIRPC5`.
- `HOESAC42ABSO` (278): termina en "HOESAC42ABS OBSOLETO", pero el producto está activo.

**Otros hallazgos en insumos ERP de APP LT** (`insumos_catalogo`, Q15):
- `ATBIOCRT580-CR` dice "CRISTAL **SATINADO**", aunque CRT significa transparente.
- `ATBIOCRS4-CR` es de **9 mm**; el de 6 mm es `ATBIOCRS4-CR6`.
- La clave guardada `ATBIOCRTRA580-C` está **truncada**: la descripción dice `ATBIOCRTRA580-CR`.

---

## 5. Consultas usadas (todas SELECT)

- **Q1:** `select * from productos where id in (433,1844,444,1847,445,1848,446,1849,449,1850,426,1732,1898)`
- **Q2:** `select v.*, e.* from producto_versiones v left join producto_version_economia e on e.producto_version_id=v.id where v.producto_id in (…)`. `producto_version_economia` tiene 12 filas en total, ninguna de estos productos.
- **Q3:** `select v.* from variantes_producto v join producto_versiones pv on pv.id=v.producto_version_id where pv.producto_id in (…)`: 0 filas.
- **Q4:** `select i.*, l.* from lista_precio_items i join listas_precio l on l.id=i.lista_precio_id where i.producto_id in (…)`. Existe 1 sola lista (id 1, 1,931 renglones).
- **Q5:** `jsonb_array_elements(cotizaciones.partidas)` con filtro por `coalesce(p->>'productoId',p->>'producto_id')`, `productoVersionId`/`producto_version_id` y `bancoId`, más `p::text like '%ATPU%'`. Además, `cotizaciones_revisiones.snapshot::text like '%<clave>%'`.
- **Q6:** `select proname from pg_proc where proname ilike '%costo%'`: solo `puede_certificar_costo` y `resolver_costo_insumo`.
- **Q7:** `select … from productos p left join lista_precio_items i … where p.codigo ~ '^(ATPU|ATFAL|ATCUBD44ABS$|ATRICDB4$|ATACM$|ATBIOCR|CIEPLA01300778)'`
- **Q8:** `preciosLinea.js`: ATCE675ABSOPG "CUBIERTA RECTANGULAR DE 1800 X 750 mm".
- **Q9:** búsqueda de TATO o 12U en `productos`, `insumos_catalogo`, `insumo_mapeos_externos`, `variantes_producto`, `expedientes`, `reglas`, `aprendizajes`, `config`, `direccion`, `confirmaciones`, `cotizaciones` y `cotizaciones_revisiones` (`~* 'TATO[0-9]'`, `'12 usuarios'`, `'7200'`).
- **Q10:** partidas con `productoId = 1898`: folio, estado, `precioUnitario`, `cost_status`.
- **Q11:** `banco.js` (volcado con Node a JSON en el scratchpad): renglones con `clave` que no está en `PRECIOS_LINEA`.
- **Q12:** `select codigo, count(*) … from productos where activo and codigo is not null group by codigo having count(*)>1`, con detalle de precio y medidas.
- **Q13:** `substring(nombre from '-{2,3}\s*"?([A-Za-z0-9./_-]+)"?\s*-*\s*$')` contra `codigo` en `productos` de línea activos: 1,681 coinciden, 4 difieren y 31 no tienen ese sufijo.
- **Q14:** productos de banco activos sin `codigo` (116), cruzados con banco con clave y con línea por precio y medida (script en el scratchpad, §4.1).
- **Q15:** `select … from insumos_catalogo where clasificacion='erp' and atributos->'erp'->>'clave' ~* '^(AT|TATO)'`

## 6. Lo que no pude determinar

- **La clave ERP real del 12U.** No está en ninguna fuente accesible. Hace falta el PDF 226030004 o una consulta en Intelisis.
- **Cuál de las dos reglas de precio de la familia ATPU es la vigente** (0.52 o 0.60 × FULL), y por qué ATPU75M y ATPU6M quedaron más caras que piezas más grandes. No hay fecha de alta por artículo.
- **El costo de fabricación estándar de ATPU4M.** No hay reporte del cotizador; solo existe el costo de entrada de PT del pedido 38247.
- **La medida correcta de ATOM3**: el ERP dice 850 × 100 × 17 y la guía GE dice 800 × 98 × 14.
- **Si los pares "gemelos sin clave" son el mismo presupuesto.** Las fuentes 2508040 y 225080025 tienen los mismos precios y medidas; podría ser un número mal capturado, pero no lo sé.
