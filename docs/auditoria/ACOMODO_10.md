# ACOMODO 10 · Cotizar: acomodo "casi perfecto" en los planos del laboratorio

Rama: `worktree-agent-a7707a6b0bde1b59b` (desde `claude/costing-app-architecture-psf02g`, `9f66da6`). Sin merge, sin push,
sin despliegues, sin SQL, sin cambios de precio. No se tocó `formulaAlba.js` ni Cocrear.

## 1. Resultado medido (sin IA en vivo)

Antes, el acomodo quedaba **parcial o en revisión en 4 de 6 planos**. Ahora queda **parcial en 2 de 6**. C4 y C5 pasan a
**VALIDADO** (PASS, `render_ready`). C2 y C3 siguen parciales por causas reales del espacio y del catálogo; ya no se deben
a defectos del solver.

| Plano | Antes | Después | Qué cambió |
|---|---|---|---|
| C1 · recto | PASS 25/25 | PASS 25/25 | Sin cambio. |
| C2 · curvo | PARCIAL 28/41 | PARCIAL 29/41 | La silla `win-4` ya no queda contra la columna P1 y la `win-5` ya no tiene sólo 500 mm. La mesa de consejo ya entra. Faltan sus 12 sillas (§3). |
| C3 · sin cotas | PARCIAL 19/21 | PARCIAL 20/21 | En JUNTAS las dos sillas frente a la puerta ya no tienen sólo 85 mm. El módulo directivo de PRIVADO B ya entra. Falta su silla (§3). |
| C4 · dos niveles | PARCIAL 10/19 | **PASS 19/19** | Ya no aparecen la DIRECCIÓN del nivel 2 como obstáculo, su columna ni sus puertas. Las sillas tampoco quedan pegadas al muro. |
| C5 · en L | REVISIÓN 38/38 | **PASS 38/38** | La silla `win-9` ya no queda contra la columna. La cabecera de consejo ya no tiene sólo 100 mm de acceso. |
| C6 · inyección | PASS 25/25 | PASS 25/25 | Sin cambio. |

**Cómo se midió.** `src/datos/acomodoLabReplay.test.js` reconstruye cada corrida de `lab/noche/p10x/cotizar/` con la
evidencia guardada:

- la lectura real de `leer-plano-rc` (`edges.json`);
- las puertas que confirmó la persona;
- el filtro de nivel;
- las partidas que quedaron tras "Aplicar programa detectado".

Con eso corre el orquestador de la app (`resolverAcomodo`) y usa como `solve` el pipeline puro de la Edge
`acomodar-espacio-recovery-rc`. **Fidelidad: 6/6.** Las áreas reconstruidas son idénticas a las que guardó la app, y la
línea base reproduce exactamente el veredicto de la corrida real. La excepción es C4: ahí la única diferencia es que ya
no aparecen los artefactos del nivel 2, y una prueba lo verifica.

Otras mediciones:

- **Banco multi de 55 casos** (`bench/acomodo-calidad/multiBanco`), corrido contra `-rc`: PASS pasa de 21 a 25 y FAIL de
  4 a 0. Los dos casos que colocaban menos por semántica ahora colocan más: dif05 pasa de 13 a 20 y dif08 de 9 a 28.
- `npx vitest run`: **2,801 en verde** (antes 2,757).
- `npx vite build` compila.
- E2E con la nube falsa en el puerto 5175 (acomodoServidor, lecturaPlano, cotizarTexto, persistencia y resiliencia): 46
  pasan y 1 falla. El que falla es `persistencia.e2e.js:125` (VH-035), que `e2e/nubeFalsa.js` documenta como rojo a
  propósito y que no toca el acomodo.

## 2. Causas raíz (por impacto) y correcciones

| # | Causa raíz | Planos | Corrección | Prueba (fallaba antes) |
|---|---|---|---|---|
| VH-A10-01 | **Los niveles se mezclaban.** En un documento de dos plantas, `areasDeLectura` anidaba cuartos y repartía columnas y puertas entre TODAS las plantas. Así la DIRECCIÓN del nivel 2 terminaba como obstáculo de 6 × 5 m dentro de la SALA DE JUNTAS del nivel 1. | C4 | Regla `mismaPlanta` (por nivel y hoja) en el anidamiento, las columnas, las puertas, los encimes y la suma de m² por nivel. El filtro de nivel de Voni pasa a `areasDelNivelUsado`. | `planoLeido.test.js` (+3) y el replay de C4 |
| VH-A10-02 | **Las sillas no cabían.** El kit reservaba la silla, pero no el piso para retirarla, y el solver pega los kits al muro. Resultado: sillas contra el muro o contra una columna, o con 85–500 mm de acceso. | C2, C3, C4, C5 | Cada silla del kit lleva detrás una franja de acceso de 600 mm (el mismo objetivo del juez y el `ACCESO_EJECUTIVO` de VH-119b). El kit separa el **cuerpo** (mueble y sillas) de las **franjas** (piso libre compartible). Las franjas no pueden caer sobre muro, columna, barrido de puerta ni otro mueble. El pasillo de 1 m se sigue midiendo entre cuerpos. Si con holgura no cabe, queda un respaldo compacto que el juez sigue marcando: nunca PASS. | `holguraSillas.test.js` (geometría real de C5 y C2) |
| VH-A10-02 | **El "mínimo" arrastraba un desfase.** El mueble sin sus sillas conservaba el desfase de las sillas: un directivo de 1.8 × 2.4 m pedía 3.6 m. | C3 | El mínimo se re-ancla en (0,0). | `holguraSillas.test.js` |
| VH-A10-02b | **La alineación mandaba sobre la holgura.** El orden VH-154 ("lado largo con lado largo") probaba el kit compacto alineado antes que el kit con holgura. | C3 | Niveles de variante: completo con holgura → lados largos con holgura → compacto → mínimo. La alineación sólo ordena dentro de cada nivel. | `holguraSillas.test.js` (JUNTAS real de C3) |
| VH-A10-03 | **Cabeceras sin acceso.** La mesa de consejo de 12 salía 5+5+1+1 y la cabecera quedaba frente a la puerta. Los planos dibujan 6+6 (C5), 3+3 (C3, C2). | C5 | La canónica (P0.2c: 4+4+1+1) se queda. La variante "sólo lados largos" (una silla cada 650 mm) se prueba **después** de la canónica con holgura y antes del compacto. Viaja en `layout_variant` y el juez espera los mismos lugares. | `juntasLadosLargos.test.js` |
| VH-A10-04 | **Diagnóstico equivocado.** Una silla sin lugar junto a un mueble que sí cupo se reportaba como "No conserva el pasillo de 1.00 m". | C2, C3 | Código `SEAT_NO_ACCESS`: "su mueble sí cupo, pero esta silla no tiene lugar con 600 mm detrás…". | `diagnosticoAcomodo.test.js` |
| VH-A10-05 | **Opciones con medidas inventadas.** Proponía "Cambiar la mesa de 4.80 m por una de 2.88 m" (0.6 ×, no existe en el catálogo) y estaciones de N × 1500 mm con N impar. | C2 | Mesa: la misma mesa con menos sillas, en pares, verificado por simulación. Banca: menos cubiertas de la misma medida de guía (1200/1500/1800; en doble, usuarios pares), o nada. Poda por grupo aislado: la llamada de C2 bajó de 3.8 s a 1.7 s. | `opcionesSinInventar.test.js` |
| VH-A10-06 (P0-05) | **No se usaba la ficha del catálogo.** Si la partida no traía ancho × fondo, el acomodo no consultaba la ficha del banco: con el nombre editado caía a una huella por tipo (1.50 × 0.75 m para un bench de 4.50 × 1.20). La sillería (sin medida en el catálogo) se dibujaba 600 × 600 en silencio. | todos (latente) | Precedencia SPATIAL_SPEC > PARTIDA > **CATALOGO** > NOMBRE > INFERIDA. Si la ficha es de una guarda, se toma frente × fondo y no el alto. La huella estándar de la silla se dice "supuesta (sin medida en el catálogo)" en el diagnóstico y en el bloque de evidencia, sin volver PRELIMINAR el acomodo (contrato VH-092). | `espacio.test.js` (+4), `acomodoVeredicto.test.js`, `diagnosticoAcomodo.test.js` |
| VH-A10-07 | **No se revisaba la topología de las bancas.** El acomodo sentaba lo que viniera (7 usuarios = 4 + 3, cubiertas de 1050) sin compararlo con la guía. | todos | `topologiaBancaAppLT` / `islasAppLT` (guía ESP-DCC-IDP-003): en banca doble c = usuarios / 2, con usuarios pares y cubiertas de 1200/1500/1800, y 1 acometida ATACM por isla. Nuevo bloque del veredicto: "2 islas (8 + 8 usuarios; cubiertas de 1.20 m) · 2 acometidas ATACM, 1 por isla". Una banca fuera de guía dice su motivo, "Consultar con Diseño", y no se publica. | `appltArmado.test.js` (+3), `acomodoVeredicto.test.js` (+2), replay: 8 bancas dentro de guía |

VH-116 se mantiene: el replay verifica en los 6 planos que ninguna sugerencia (`sug-*`) llegue al solver y que nada
parcial salga `render_ready`.

## 3. Qué no quedó y por qué

- **C2 · SALA DE CONSEJO.** Es circular, de 5 m de diámetro, y el plano dibuja 12 sillas alrededor de una mesa redonda.
  El programa resolvió por capacidad la Eclipse rectangular de 4.80 m para 14. La mesa entra, pero sus 12 sillas no:
  ninguna mesa rectangular del catálogo las sienta con acceso en ese círculo, y el catálogo **no tiene mesa redonda para
  12** (sólo Ø 600 y 900). Es un **dato** que falta (una mesa redonda en el catálogo) o una **decisión** del vendedor (la
  opción que se le ofrece es "Quitar 12 sillas de juntas"). La pantalla lo dice: `SEAT_NO_ACCESS`, más "el conjunto
  completo con sillas no entra por la FORMA del área".
- **C3 · PRIVADO B.** Mide 6.06 × 3.02 m y tiene puertas en los dos muros largos y la columna P4. La silla directiva no
  cabe con sus 600 mm en ninguna rotación sin invadir la zona libre de alguna puerta. Se probó por fuerza bruta en 0, 90,
  180 y 270°: la variante compacta a 270° la dejaría a 75 mm. No se relajó la zona libre de puertas, que es una
  invariante existente. La pantalla lo dice: `SEAT_NO_ACCESS` y "choca con una columna/obstáculo (probado)".
- **Dimensiones de ProductVersions en la base:** siguen **BLOQUEADAS** por VH-099 (migración `vh099` escrita y no
  aplicada; no se ejecuta SQL). Con lo que la app tiene se usa la ficha del banco. Lo demás queda marcado como supuesto.
- **Sillería sin medida en el catálogo:** queda 600 × 600 "supuesta". El solver usa ese módulo de silla para sus lugares
  (`SEAT`). Admitir sillas de otra medida requiere un dato de catálogo que no existe.
- **Ruido en la revisión semántica de C2:** cuando el mueble se coloca sin sus sillas, el juez lista "lugar «side_A_n» …
  sin silla" (12 líneas con ids internos). Es correcto pero repetitivo. Se dejó así para no tocar el juez.
- **Costeador de líneas (`generarAppLT`):** acepta todavía banca doble con usuarios impares o cubierta de 1050. No se tocó
  porque no es Cotizar/acomodo. El acomodo sí lo detecta (VH-A10-07).

## 4. Despliegue pendiente (no hecho)

- **Edge a desplegar: `acomodar-espacio-recovery-rc`.** Cambian `kit-solver.js`, `placementProfiles.js`,
  `semanticPlacementJudge.js` y `opciones.js`. La Edge productiva `acomodar-espacio` no se tocó; tampoco
  `acomodar-espacio-recovery`.
- La app llama por omisión a `acomodar-espacio-recovery`. Para usar la RC, el build RC debe llevar
  `VITE_ACOMODAR_FN=acomodar-espacio-recovery-rc`, como en el laboratorio.
- Al promover `-rc` → `recovery` cambian 7 aserciones de `bench/acomodo-calidad`, que hoy prueban la copia productiva.
  Seis documentan comportamientos que esta rama corrige a propósito:
  - el camino por omisión "falla pegado al muro" y por eso ganaba `center` (`recoveryEdge`, `multiCandidato`,
    `gap13Integracion`);
  - `targetP02c` D2 esperaba la opción inventada "estación de 1 puesto" de 1.5 m para un bench de 6 m con 4 usuarios.

  La séptima, el hash de `baselineInmutable`, no aplica a una copia distinta. La regla canónica 4+4+1+1 sigue pasando.
- El frontend (lectura de plano, huellas, veredicto, diagnóstico, bancas) va en el bundle normal, sin despliegue desde
  aquí.

## 5. Commits

```
b38f153 ACOMODO 10 · replay sin IA de los 6 planos del laboratorio Cotizar (línea base)
ffcfe15 VH-A10-01 · lectura de plano: los niveles no se mezclan (C4 dos niveles: PARCIAL 10/19 → PASS 19/19)
ffe0046 VH-A10-02 (RC) · las sillas caben: franja de acceso de 600 mm detrás de cada silla del kit
f75c976 VH-A10-03 (RC) · mesa de juntas: lados largos primero, cabeceras sólo si hacen falta (C5: REVISION → PASS 38/38)
e4aa7ab VH-A10-02b (RC) · la holgura de las sillas manda sobre la alineación con el cuarto
8358398 VH-A10-04/05 · lo que falta se dice sin inventar: sillas sin lugar y opciones con medidas reales
d2b540c VH-A10-06 (P0-05) · huellas reales del catálogo; la huella supuesta se dice
67238d8 VH-A10-07 · topología de bancas APP LT en el acomodo: islas, acometidas y guía
56b0196 VH-A10-02c (RC) · el kit compacto conserva la franja interna del ejecutivo
c45a413 VH-A10-03b (RC) · la topología canónica de juntas se respeta; 'sólo lados largos' es respaldo
```
