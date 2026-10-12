# Costear · reglas de casa y amarre al catálogo (2026-10-12)

**Origen.** Dirección pegó la salida real de Costear para un exhibidor de 3 módulos (2400 × 700 × 2200, melamina nogal, estructura PTR negra, LED, refrigerador del cliente): 15 renglones, **6 con costo y 9 "Costo pendiente"**, PTR y lámina marcados "crítico: acabado/color distinto", auditoría narrativa con "~6.1 hojas" frente a 3.35 hojas sumadas por la IA, repisas visibles en MDF crudo, respaldo de 19 mm, metrajes "supuestos". Pidió "un 9 de 10" y contestó las seis preguntas de taller:

| Pregunta | Respuesta de Dirección | Regla codificada |
|---|---|---|
| Espesores/materiales por función | "sí" (propón tú) | avisos de consistencia (`revisionEstructural`): MDF crudo visible vs melamina sin laca; respaldo > 12 mm; claro ≥ 800 mm |
| Tapacanto | "siempre es el mismo canto" | insumo estándar `tapacanto`; metros por cantos visibles (cubierta/puerta/frente 4, costado 2, entrepaño 1, respaldo 0) |
| Acero | "todo es visible, lleva pintura electro" | pintura electrostática siempre; m² = metros × perímetro del perfil (1"×1" si no se declara) + lámina × 2 caras; el color del acero no es conflicto crítico |
| Herrajes | "vienen en la lista de compras" | familias de herraje/consumible; genérico de casa ante empate; amarre a Compras (ERP) de lo pendiente |
| Refuerzos / zoclo / niveladores | "por coherencia… si tú recomiendas que lleve, ponlo" | refuerzo: aviso por claro; zoclo 100 mm en gabinete bajo sin base; 4 niveladores por módulo |
| ¿La IA amarra sola? | "sí autorizo que la IA amarre"; "que se usen todos los precios de compras, son los reales" | amarre provisional (POR CONFIRMAR) al catálogo curado y, si no hay, a todo el catálogo de Compras (`buscar_insumos_motor`) |

**Principios que no cambian.** Nada entra confirmado: todo amarre automático es `SAME_FAMILY_COMPATIBLE_PROPOSED` (costea provisional, **bloquea la emisión** hasta confirmación humana). Nunca $0 ni precio inventado: un insumo sin precio queda pendiente. Equipo externo (refrigerador, pantalla, etc.) nunca se amarra ("de vidrio" no lo convierte en cristal). Cada partida que nace de una regla lleva `_regla` y su cálculo en la nota.

## Qué se codificó (módulos y pruebas)

| Módulo | Qué hace | Pruebas |
|---|---|---|
| `src/datos/reglasTaller.js` | tabla de reglas de casa (versión `casa-2026-10-12`), metros de canto por rol, perímetro de perfil, m² de pintura | `reglasTaller.test.js` (18) |
| `src/datos/materialMatch.js` | familias nuevas (tapacanto, bisagra, corredera, jaladera, nivelador, cerradura, pintura, iluminación, eléctrico, adhesivo, tornillería, equipo externo); puntuación con acentos/plural, **calibre** (+3) y polvo por kg (+2); genérico de casa ante empate; acero con color distinto = no crítico; variante de herraje no nombrada = provisional | `materialMatch.test.js` (40, intactas) |
| `src/datos/mapIaComps.js` | mapper único IA → BOM (antes duplicado); en TABLERO la hoja la decide el motor (rejilla + A14), la fracción de la IA queda como `iaHojas`; en lámina irregular sigue la fracción directa | `reglasTaller.test.js` |
| `src/datos/autoInsumos.js` | acompañantes por geometría: zoclo, niveladores, tapacanto (completa la línea de la IA si era supuesto), pintura (pone `areaPintadaM2`/`tubular` a la línea de la IA o la crea) | `autoInsumos.test.js` (6, intactas) + `reglasTaller.test.js` |
| `src/datos/amarreERP.js` | pendientes → búsqueda en todo el catálogo de Compras; prefiere filas con precio; mismo criterio de familia/calibre; crítico → preselecciona sin costear; sin red → no cambia nada | `amarreERP.test.js` (6) |
| `src/datos/revisionEstructural.js` | roles (plural, frente de cajón, herraje primero, zoclo = base); reglas 8–10 de consistencia | `revisionEstructural.test.js` (8, intactas) |
| `src/datos/resumenMotor.js` + `InformeIA.jsx` | la sección "Merma y nesting" de la auditoría enseña **los números del motor** (m², hojas, merma real, método por insumo, provisional vs sin costo); el texto de la IA queda etiquetado como narrativo | `goldenExhibidor.test.js` |
| `AsistenteEspecial.jsx`, `Costeador.jsx` | usan el mapper compartido, pasan `insumos` a reglas y revisión, disparan el amarre ERP asíncrono (descartado si otra corrida empezó) | Playwright local |

## Antes / después con el exhibidor de Dirección (catálogo semilla, sin ERP)

| | Antes (salida pegada) | Después |
|---|---|---|
| Renglones con insumo | 6 de 15 | **14 de 15** (sólo el refrigerador del cliente queda pendiente, con motivo "equipo externo") |
| PTR cal.14 negro / lámina negra | "crítico: acabado/color distinto", sin costo | provisional: "el color lo da la pintura electrostática"; PTR cal. 14 (el calibre decide), lámina cal. 18 |
| Tapacanto | 18 m "supuesto" | 27.16 m por geometría (laterales 6.4 · cubiertas 9 · puertas 4.74 · repisas bajas 2.28 · repisas MDF 4.74); la nota conserva "la IA suponía 18 m" |
| Pintura | "~3 m² supuesto", sin costo | 4.97 m² por geometría (30 m × 1"×1" supuesto = 3.05 + lámina 0.96 × 2 caras); **kg pendiente** porque Producción no dio rendimiento en tubular (A14) |
| Hojas de tablero | IA: 3.35 (área pura); auditoría narrativa: "~6.1" | **motor: 4.81 hojas, merma real 30 %** (melamina 4.31 + MDF 0.5), por rejilla + regla A14 |
| Auditoría | cifras del modelo | sección 03 con los números del motor y la narrativa etiquetada |
| Avisos | ninguno | repisas visibles en MDF crudo vs melamina nogal (warning); respaldo de 19 mm (info) |
| Costo unitario provisional | sin total (9 pendientes) | $12,555 provisional (14 por confirmar + pintura pendiente) |

## Medición contra el catálogo REAL (config_para_rol 259 + `buscar_insumos_motor`, cuenta QA, 12-oct)

Exhibidor de Dirección contra el catálogo curado de producción: **14 de 15 con insumo y precio real** (melamina color 19 $665/hoja, MDF 19 $437, tapacanto $3.04/m, PTR cal. 14 $45.13/m, lámina cal. 18 $571.54/hoja, pintura polvo negro $59.37/kg, kit LED $3,200, bisagra $19, jaladera $37.90, nivelador $17.73); costo unitario provisional $12,555; sólo el refrigerador del cliente queda pendiente.

Pedidos típicos sin catálogo local, resueltos sólo con Compras (ERP). La búsqueda del servidor es por término, así que se consulta la frase sin acentos y cada palabra clave; ante empate gana lo certificado por Compras y más reciente ("lo que el taller compra de verdad"):

| Pedido | Amarre (provisional, por confirmar) |
|---|---|
| Bisagra | BISAGRA BIDIMENSIONAL RECTA TAC 110° CIERRE SUAVE · $20.83/pza · certificado |
| Jaladera | JALADERA BARRA 320 × Ø10 mm, 256 mm entre centros · $25/pza · certificado |
| Tapacanto PVC | Tapacanto PVC · $3.04/m (estándar de casa) |
| PTR cal.14 (sin perfil, 30 m lineales) | Tubo / PTR cal. 14 · $45.13/m (filas por metro; la "pieza de 6000 mm" por pza queda fuera porque la unidad no es la del consumo). Si no hubiera genérico, el perfil por defecto de casa 1"×1" marcado "perfil supuesto" |
| Corredera 16" | CORREDERA DE PRECISIÓN EXTENSIÓN TOTAL · $69/juego · certificado |
| Nivelador | Tornillo nivelador 3/8 plataforma 1½" cromado · $41.63/pza · certificado |
| Cerradura | CERRADURA CON ROSETA HAFELE 22 mm · $33.68/pza · certificado |
| Pintura electrostática negra | Pintura en polvo Negro Mate 8 Vitracoat · $120.68/kg · certificado |
| Melamina nogal 19 mm | AGLOMERADO MELAMINA DOS CARAS 4×8 19 mm · $677/hoja (con formato, por eso cuesta por m²) |
| Kit iluminación LED | KIT DE ILUMINACIÓN 2 LAMP 950 mm · $1,454/pza · certificado |
| Contacto eléctrico | MULTICONTACTO LUMATESOF-N 2 contactos 127 VAC · $352/pza · certificado |
| Lámina de acero cal. 18 | Lamina de acero cal. 18 · $571.54/hoja (el calibre decide) |

Unidad compatible con el consumo: pieza de área → fila con formato; metros → fila por metro o tramo; si sólo hay filas con otra unidad, se preselecciona como crítico y no costea (evita multiplicar metros × $/pieza).

Lo que NO hace: no confirma nada solo (la emisión sigue bloqueada hasta la confirmación humana), no elige entre perfiles distintos cuando el pedido trae uno, no amarra equipo externo, no inventa precio cuando la fila de Compras no lo tiene.

## Decisiones recibidas después (12-oct, tarde)
1. **Pintura en tubular = 8 m²/kg** (Dirección: "es 8"). Codificado en `politicaMerma.js` (`pinturaTubularM2PorKg: 8`); el kg de pintura de las estructuras de PTR ya costea.
2. **VH-124 corregido**: Costear ya no fija el margen al entrar; hereda SIEMPRE el `margenObjetivo` de la configuración (hoy 40 %, "1 pieza"), y sólo un expediente reabierto trae el suyo. La pantalla dice de dónde sale ("política vigente (1 pieza)" / "del expediente guardado"). El 50 % es el de los precios de lista para cotizar, no el de costear una pieza.

## Lo que sigue necesitando una decisión
1. **Margen por cantidad**: Dirección quiere que al preguntar "¿cuántas piezas iguales?" el margen dependa de la cantidad (1 pieza → 40 %; lista → 50 %). Falta la tabla intermedia (¿2–5? ¿6–20? ¿21+?). No se inventa: hasta recibirla, toda cantidad usa la política vigente y la pantalla lo dice.
2. Los precios ERP entran como provisionales; la auditoría P0-03 (1,763 aprobaciones por `qa-direccion`) sigue pendiente.

## Piloto automático (Dirección 12-oct: "que la IA haga la mayoría de las cosas, que deje lo menos para el humano, casi automatizado, pero real")

Automatiza **acciones**, no **aprobaciones**: nada provisional se disfraza de aprobado y la emisión sigue exigiendo una persona.

| Dónde | Antes (humano) | Ahora (solo) | Queda para la persona |
|---|---|---|---|
| Costear · preguntas de la IA | contestar cada pregunta | `autoRespuestas.js`: espesor 19, tapacanto estándar, pintura electrostática en acero, niveladores, zoclo, bisagras/jaladeras por puerta, refuerzo por claro; supuestos de impacto bajo se conservan como preliminares; cada respuesta lleva "(regla de casa)" y es editable | medidas y preguntas de impacto alto/medio sin regla; pulsar "Aplicar respuestas" (una llamada real a la IA) |
| Costear · materiales | confirmar renglón por renglón (14 en el exhibidor) | amarrados por regla de casa / Compras, provisionales | **una** decisión: "Confirmar los N propuestos" (queda como confirmación de la persona); los sin material (equipo externo) |
| Costear · biblioteca | nombre y palabras clave a mano | nombre del producto y palabras clave (tipo, producto, materiales) prellenados | estado borrador/aprobado y guardar |
| Cotizar · programa del plano | "Fusionar duplicados" / "Vincular lo que ya tengo" | se hace solo cuando NO hay nada que decidir: fusiona duplicados y vincula al plano lo ya descrito; aviso "Piloto automático: N fusionados, M vinculados"; idempotente; nunca quita ni AGREGA nada | **agregar los productos que el plano pide** (botón "Aplicar programa detectado", un click): agregar renglones comerciales es decisión humana. Primera versión los agregaba sola y una cotización semilla de 2 piezas pasaba a 11 (acomodo roto; detectado por acomodoVeredicto/acomodoP02). También: conflictos, filas ambiguas (Repartir, VH-116), pendientes de confirmar |
| Cotizar · acomodo | (ya era 1-clic) | se acomoda solo al tener muebles y espacio | acomodar a mano, continuar a la propuesta |
| Emisión / aprobación | humana | humana | humana (regla de Dirección) |
