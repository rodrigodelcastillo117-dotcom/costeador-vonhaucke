# Cómo enganchar SONA 2603064 al Banco de precios

**Nada de `src/datos/banco.js` se tocó.** Esto es el plan; el JSON ya está listo en
`scratchpad/sona-productos.json` (62 renglones, 29 claves distintas, cuadre verificado).

## 1. La forma exacta que espera cada fila

Leído de `src/datos/banco.js` (218 renglones hoy) y de quien lo consume
(`src/componentes/Banco.jsx`, `buscarProducto.js`, `planner.js`, `Cotizacion.jsx`, `Voni.jsx`):

```js
{ id: 'p9-app-lt-escritorio-8750',        // string único, obligatorio
  categoria: 'Operativos / Bench',        // OBLIGATORIO, de BANCO_CATEGORIAS (lista cerrada, 9)
  tipo: 'modulo',                         // modulo | mesa | guarda | almacen | especial | silla
  linea: 'App LT',                        // opcional; si falta, la UI dice "línea no especificada"
  usuarios: 1,                            // opcional, entero
  nombre: "App LT · Escritorio",          // corto y buscable: Línea · Qué es · Modelo
  descripcion: "Modulo opertativo 1 usuarios",   // redacción literal del presupuesto
  medidas: '1500 × 600 mm',               // opcional, con × y espacios
  material: "melamina ABS, estructura metálica, …",  // opcional, lista separada por comas
  precio: 8750,                           // OBLIGATORIO, número, PRECIO DE LISTA sin IVA
  fuente: '225080025',                    // OBLIGATORIO, debe existir en BANCO_FUENTES
  clave: 'TATO1156AB0001' }               // opcional pero clave (nunca mejor dicho) para deduplicar
```

`otrosPrecios` **no se escribe a mano**: lo calcula `bancoUnico()` al fusionar duplicados.

### Campos válidos que ya existen (no inventar valores nuevos)

- `categoria` ∈ `Operativos / Bench` · `Escritorios` · `Mesas de juntas` · `Guardas y archivo` ·
  `Mesas y complementos` · `Electrificación` · `Cancelería y muros` · `Componentes y refacciones` · `Sillería`
- `tipo` ∈ `modulo` `mesa` `guarda` `almacen` `especial` `silla`
- `linea` ∈ Accents, Alba, App, App LT, Cirque, Eclipse, Ergonova 4, Modulor, Mox, Pebble, Río,
  Tetris, Wand, Work Lounge. **Bespoke NO existe todavía** (ver §4).

## 2. Qué le falta al JSON para poder pegarlo (5 campos por renglón)

El JSON trae lo que imprime el papel: `area, partida, grupo, descripcion, clave, precioUnitario,
cantidad, subtotal, cantidadModulos, totalModulo, importeArea, hoja`.

| Campo de banco.js | ¿Está en el JSON? | Cómo se llena |
|---|---|---|
| `precio` | ✅ | = `precioUnitario` tal cual |
| `clave` | ✅ (29 de 31 filas únicas) | = `clave`; 2 renglones vienen sin clave en el papel |
| `descripcion` | ✅ | = `descripcion` (literal del presupuesto) |
| `fuente` | ❌ **FALTA** | nuevo código `226030108` (ver §3) |
| `id` | ❌ **FALTA** | `sona-<slug del nombre>-<precio>` |
| `categoria` | ❌ **FALTA** | derivable de la descripción; propuesta abajo |
| `tipo` | ❌ **FALTA** | ídem |
| `nombre` | ❌ **FALTA** | hay que redactarlo corto: `Línea · Qué es · Modelo` |
| `linea` | ❌ **FALTA** | la descripción dice APP LT / ACCENTS / MOX / MODULOR / WORK LOUNGE / BESPOKE |
| `medidas` | ⚠️ embebido en la descripción | extraíbles con regex `(\d+)\s*[Xx]\s*(\d+)(\s*[Xx]\s*(\d+))?\s*mm` |
| `material` | ⚠️ embebido en la descripción | extraíble partiendo la descripción por comas y `;` |
| `usuarios` | ⚠️ embebido | regex `(\d+)\s*USUARIOS?` |

**No hay dato de `usuarios` ni de material estructurado**: el presupuesto los mete todos en una
sola cadena. Es el mismo trabajo que ya se hizo para los 9 presupuestos de agosto, así que conviene
reusar ese mismo script de normalización en vez de escribir uno nuevo.

### Mapeo `categoria`/`tipo`/`linea` propuesto para las 31 filas únicas

| Clave | categoria | tipo | linea |
|---|---|---|---|
| TATG12118AB001, TATG1158AB0001, TATG11515AB0002, CID11824BF6501 | Escritorios | modulo | App LT |
| TATO43012ABT01 | Operativos / Bench | modulo | App LT |
| TATS499AB00001, TATS103012AB01, CIS41212BF5635 | Mesas de juntas | mesa | App LT |
| MOA1154AB5055, MOA1155AB6307, MOXGAR2FMTL, A4CCCCABS, LIB36ABS | Guardas y archivo | guarda | (Mox para MOXGAR2FMTL) |
| MOCACI130LTABS | Guardas y archivo | guarda | Modulor |
| BSVIMEG2 | Guardas y archivo | guarda | Bespoke ⚠️ línea nueva |
| ACMC60-CS22, ACML60-CS22, ACMCC22ABS | Mesas y complementos | mesa | Accents |
| (sin clave) mesa centro 900×600 y 900×900 | Mesas y complementos | mesa | Work Lounge |
| C4-EM-BNF, C4-EL-BNF-CAB, ESP-REWIND, ALPHA, GAMMA-E, VION-CAJ | Sillería | silla | — |
| AESLIT, AESLDT, AESLDEP | Sillería | silla | — |
| WLSIRE3MDECP, WLSIRE3MIECP | Sillería | silla | Work Lounge |

## 3. Hay que dar de alta la fuente `226030108`

`BANCO_FUENTES` es un diccionario cerrado y la UI muestra su etiqueta (`Banco.jsx:106`). Sin alta,
el renglón muestra el código pelón. Alta propuesta:

```js
'226030108': 'SONA BLM EDrive · may 2026',
```

⚠️ El papel dice **"COTIZACION PRELIMINAR"**. Todas las demás fuentes del banco son presupuestos
formales. **Preguntarle a Rodrigo si quiere precios preliminares en el banco**, o si prefiere
marcarlos (p. ej. `'226030108': 'SONA BLM EDrive · may 2026 · PRELIMINAR'`) para que se vea en pantalla.

## 4. Duplicados contra lo que YA hay — revisado clave por clave

De las 29 claves, **sólo 3 chocan** con algo cargado, y ninguna choca por `clave` exacta salvo una:

| Clave SONA | ¿Ya está? | Precio SONA | Precio en banco | Qué pasa al cargar |
|---|---|---|---|---|
| `TATG1158AB0001` | **SÍ**, `p9-app-lt-mesa-de-juntas-6860` (fuente 225080025) | 6,860 **y** 5,700 | 6,860 | ver abajo |
| `LIB36ABS` | **SÍ**, `p9-librero-16770` (fuente 226030134) | 16,770 | 16,770 | fusión limpia, mismo precio |
| `C4-EL-BNF-CAB` | **SÍ**, `p9-silla-operativa-c4-el-bnf-2405` | 2,405 | 2,405 | fusión limpia |
| `GAMMA-E` | **SÍ** (clave `GAMMA-E`, y `silla-gamma-e` sin clave) | 4,140 | 4,140 | fusión limpia |
| `ALPHA` | **SÍ** por MODELO (`silla-alpha`, sin clave) | 11,950 | 11,950 | fusión limpia |
| Las otras 24 claves | **NO** | — | — | entran como producto nuevo |

**Cómo se van a comportar en `bancoUnico()`** (la función que ve el vendedor y ve Voni):

- La llave de fusión es `clave:<CLAVE>`, salvo en **Sillería**, donde manda el MODELO + si trae
  cabecera (`silla:<MODELO>:cab|sin`). Por eso ALPHA y GAMMA-E se fusionan aunque una fila no tenga
  clave, y por eso `C4-EM-BNF` (SONA) va a caer junto a los dos C4-EM-BNF ya cargados
  ($1,595 y $1,850) — dispersión 1.16, **se fusionan** y el de SONA queda como `otrosPrecios`.
- La regla de seguridad: si dentro de un grupo `max/min > 1.25`, **no fusiona** y deja los dos
  renglones. Eso salva de fusionar cosas que sólo comparten clave por error.

### 🔴 El problema real: `TATG1158AB0001` con dos precios

SONA trae la misma clave a **$6,860** (hojas 8 y 18) y a **$5,700** (hojas 20 y 22). Al cargarlo:
- El grupo `clave:TATG1158AB0001` quedaría con 5 renglones (1 viejo + 4 de SONA).
- max/min = 6,860 / 5,700 = **1.20 < 1.25** → `bancoUnico()` **los fusiona en silencio** y el
  vendedor sólo ve $6,860, con $5,700 escondido en `otrosPrecios`.

**Recomendación: no cargar los cuatro renglones.** Cargar **uno solo, a $6,860** (que es el que ya
coincide con el banco existente y con el presupuesto 225080025), y dejar el $5,700 anotado como
pregunta abierta hasta que Rodolfo Piro o Rodrigo digan qué es. Si se decide que $5,700 es un precio
legítimo por volumen, entra como renglón aparte con `fuente` distinta.

### `ESP-REWIND` — revisar antes de cargar
No existe con esa clave, pero el banco ya tiene sillas de visita `RE570CBT` ($3,664) y `RE570RCBT`
($3,899) con descripción casi idéntica ("silla para visitas con brazos, base 4 puntos"). SONA la
pone a **$2,749**. Como `llaveArticulo` en Sillería usa el MODELO, `ESP-REWIND` vs `RE570CBT` son
modelos distintos → **no se fusionan**, quedan como tres sillas de visita separadas en pantalla.
Puede estar bien (son modelos distintos) o puede ser el mismo mueble con dos códigos. Vale una
mirada de Rafa o Miguel antes de cargar.

### `Bespoke` es una línea nueva
`BSVIMEG2` (vitrina médica) dice "MODELO BESPOKE". `BANCO_LINEAS` se calcula de los datos, así que
la línea aparece sola en el filtro — pero conviene confirmar que Bespoke es línea Von Haucke y no
comprado-revendido, porque eso cambia el margen (§ regla del 40/45%).

## 5. Los 2 renglones sin clave

- Módulo mesa de centro 900×600, tipo WL, 1 usuario — $2,324 (hoja 13)
- Mesa de centro 900×900 Work Lounge, melamina canto ABS, base metálica — $3,077 (hoja 14)

Sin `clave`, `llaveArticulo()` devuelve `null` y **nunca se deduplican**: entran como sueltos.
Ojo: el banco ya tiene `p9-work-lounge-mesa-de-centro-work-2550` (900×600, $2,550) — es
probablemente el mismo mueble que el de $2,324, pero **sin clave no hay evidencia dura** y la regla
del banco es explícita: no fusionar por parecido de nombre. Se cargan los dos y se anota.

## 6. Lo que este presupuesto aporta que el banco NO tiene

Vale la pena cargarlo aunque sea preliminar, porque trae **24 claves nuevas**, y entre ellas cosas
que hoy no existen en ninguna fuente:

- **App LT completo por medida**: gerente 2100×1800, gerente 1500×750, gerencial 1500×1500,
  mesa 900×900 4 usuarios, operativo 3000×1200 4 usuarios con semimamparas, mesa de juntas
  3000×1200 10 usuarios. Es justo la familia que el generador de App LT usa para calibrar.
- **Módulo director 1800×2400** (`CID11824BF6501`, $17,530) — el banco sólo tenía
  `TATD11824AB001` a $12,600, misma medida, otra clave. Contraste útil.
- **Sofás Aero** (individual tela, 2 plazas tela, 2 plazas ecopiel) — línea entera que no existe.
- **Sillones Work Lounge** izquierdo/derecho a $17,450.
- **Vitrina médica Bespoke** — primer mueble de servicio médico del banco.
- **Silla de cajera VION-CAJ** $11,360 — no hay nada equivalente.

## 7. Pasos concretos, en orden

1. Decidir con Rodrigo: ¿entran precios de una **cotización preliminar** al banco? (§3)
2. Resolver el conflicto `TATG1158AB0001` $6,860 vs $5,700 (§4) — es el único que puede meter un
   precio malo sin que se note.
3. Escribir el normalizador (reusar el de los 9 presupuestos de agosto) que del JSON saque
   `id/categoria/tipo/linea/nombre/medidas/material/usuarios`.
4. Dar de alta `'226030108'` en `BANCO_FUENTES`.
5. Insertar las filas en `BANCO`, agrupadas por categoría como está el resto del archivo, con un
   comentario de bloque que explique de dónde salen (igual que el bloque de los 9 presupuestos).
6. Correr `npx vitest run src/datos/banco.test.js` — hay pruebas que se rompen si la regla de la
   cabecera se viola. `C4-EL-BNF-CAB` toca esa regla, así que la prueba
   *"el mismo modelo con cabecera … sale UNA vez"* es la que hay que ver pasar.
7. Correr las 94 pruebas completas y las 48 pantallas antes de publicar (la RED de despliegue).
8. Antes de commitear, `code-review`.

## 8. Bonus: esto también sirve para calibrar, no sólo para el banco

El presupuesto trae, por área, **el módulo tipo con su cantidad requerida**. Eso es exactamente la
forma en que la app arma una propuesta por cuarto. Se puede usar como caso de prueba de punta a
punta: meter "15 áreas, tantos m², tanta gente" y ver si el costeador escupe algo cercano a
$1,609,934 con los mismos muebles. Es la primera orden real con el desglose por área que permite
comparar el ARMADO, no sólo el precio unitario.
