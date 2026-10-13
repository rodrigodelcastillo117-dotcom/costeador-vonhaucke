# Turno nocturno 2026-10-13 · informe para Dirección (sin merge, sin deploy, sin migraciones aplicadas)

Rama `claude/costing-app-architecture-psf02g` · base de producción `c8dd2b3` (Vercel `dpl_Bm7FFwdP…`, igual que al dormir) ·
PR **borrador** [#37](https://github.com/rodrigodelcastillo117-dotcom/costeador-vonhaucke/pull/37) sólo para que corra CI
(no mergear) · SHA final: ver § 9 · árbol limpio · estado vivo en `NIGHT_SHIFT_STATE.md`.

Todo lo de abajo corrió de verdad entre las 04:50 y las 06:10 UTC (logs y JSON en los directorios que se citan). Nada
se afirma por un test unitario solo: los ciclos se hicieron en el navegador contra las edges y la base reales con la
cuenta QA (registros de laboratorio nombrados "(lab …)", en borrador, sin emitir).

## 1. Resumen por bloque

| bloque | antes | después | primer punto de fallo real | PASS/FAIL/PARTIAL/BLOCKED |
|---|---|---|---|---|
| Fase 0 preservar | — | estado registrado, nada perdido, 5 prompts conservados | — | PASS |
| P0-A VH-035 integridad económica | 8 casos PGlite con fixture del 10-oct; golden e2e verde porque el mock fingía la migración | 24 casos con SQL **real de hoy** (23 ✓ + 1 rojo a propósito); mock = producción; PROPUESTA vh035b | producción: el vendedor que reabre y guarda **borra** `costoUnitario/margen/costoDerivado` de Dirección; la migración pendiente los preserva pero **recicla** el costo viejo si cambia el producto | **PARTIAL** → BLOCKED (decisión + migración) |
| P0-B precios ERP → motor | 8 213 precios "preliminares" sin explicación; 4 defectos de cliente | traza completa, paridad 15/15 a centavos, política con conteos por ventana, 2 PROPUESTAS, VH-143/144/145/146 corregidos | los 8 213 son compras de **> 24 meses** (6 856 de > 5 años); la ventana es decisión de Dirección | **PASS (RC)** + BLOCKED (ventana) |
| P0-C COSTEAR real | nunca cerrado en navegador | ciclo completo: imagen → BOM → ERP a mano → preguntas → precio → biblioteca → reabrir (mismo BOM, mismo costo) | VH-150: el recálculo con respuestas perdía el material elegido a mano → costo "Pendiente"; corregido; paridad servidor: ver § 4 | ver § 4 |
| P0-D COTIZAR real | Torre Norte (1336) | + **C1 desde cero** (1372): lectura 7/7, puerta confirmada, 7 partidas, acomodo 25, guardado, reabierto, PDF $266,315.24 | borrador por P0-01 (módulo sin costeo válido); render prod 0/4 por el contador mudo (VH-125) | **PASS** (ciclo) · render FAIL en prod / 4/5 en RC |
| P1 concurrencia | no medido | reproducido en UI: **último escribe gana** (VH-148); PROPUESTA control optimista | `actualizar_cotizacion_segura` sin versión esperada | PARTIAL (propuesta, sin aplicar) |
| P1 tests falsamente verdes | Cocrear E2E verde sin guardar; render 0 aceptados = PASS | ambos fallan cuando deben; render reporta aceptados/total | — | PASS |
| P1 retención QA | — | 1 279 cotizaciones QA (417 "parecen prueba"), tabla 69 MB, BD 161 MB; **nada borrado** | sin impacto de rendimiento medible hoy | PASS (medido) |
| Q5 cinco prompts | RC v1 | RC v2 renders **4/5** (prod 1/5), analizar/cotizar/G12/reglas PASS | — | PASS (RC, promoción pendiente) |

## 2. P0-A · VH-035 (`docs/auditoria/VH035_SQL_VS_MOCK.md`, `supabase/tests/preservaEconomia.test.js`)

- Cuerpos SQL de producción leídos hoy (`supabase/tests/fixtures/private_api_prod_20261013.sql`): idénticos a los del
  10-oct en las dos RPC; triggers reales cargados en PGlite en su orden.
- ANTES (producción): Dirección guarda `costoUnitario 21000 / margen 30`; vendedor abre (no los ve), cambia cantidad y
  guarda → **se pierden**, incluida la economía anidada; `normalize` corre antes de `strip` y la fila queda sin
  `cost_status`. Diseño escribe tal cual (puede pisar 21000→1).
- Patch malicioso del vendedor: `estado`/`folio_oficial` de primer nivel → excepción (bien); `costoUnitario:1`,
  `margen:99` dentro de partidas → hoy el trigger los strippea (bien), pero la economía original ya no está.
- DESPUÉS (migración `20261010170000`, **no aplicada**): preserva primer nivel para vendedor y diseño y bloquea la
  inyección; **defecto**: si el vendedor cambia producto/versión/piezaId/bom_hash conservando el `id`, re-pega el costo
  del producto anterior (caso STALE, test rojo a propósito).
- PROPUESTA `supabase/migrations/PROPUESTA_vh035b_preserva_economia_sin_reciclar.sql`: re-pega sólo con la misma
  identidad de producto; si cambia, descarta la economía y marca `cost_status:'UNKNOWN'` + `cost_stale{motivo}`
  (7/7 verdes). Limitación conocida en ambas: economía anidada (`config.costeo`) no se restaura.
- Mock `e2e/nubeFalsa.js` ahora = producción → `e2e/persistencia.e2e.js` **falla en su caso :125** por la causa real.
  No se debilitó. CI del PR #37 quedará rojo por esto hasta que producción preserve la economía.
- Rollback de la migración: en el propio archivo (bloque final).

## 3. P0-B · ERP (`docs/auditoria/ERP_PRECIOS_ELEGIBILIDAD.md`, `lab/erp/`)

Reconfirmado: 11 074 precios ERP (9 311 + 1 763), 9 966 en vista, **todos** MXN, factor 1, trazables. Paridad
`source_price → cost_unit_price_mxn → catalogo_motor().precio` 15/15 al centavo (8 familias). La vista no es legible por
REST (42501): correcto, seller-safe. Elegibles con la política propuesta (reglas 1–5): 9 966; la regla 6 (ventana de
última compra) es de Dirección: ≤12 m 1 159 · ≤24 m 1 650 · ≤36 m 1 970 · ≤60 m 3 000 · sin ventana 9 966.
Motivos residuales: antigüedad (8 213), hojas sin `formato` (341 tablero + 84 lámina; backfill propuesto para 241),
clasificación heurística de familia con errores visibles (p. ej. "ángulo de fierro" → acero_inoxidable) — no corregida
esta noche (dato, no código).

## 4. P0-C · COSTEAR real (`e2e/labCostear.e2e.js`; corridas en `lab/noche/costear/`)

Fixture: `lab/costear/credenza_nogal.png` (credenza 1800×450×750, MDF 18 mm nogal, PTR cal. 14, melamina 16, respaldo
MDF 9 mm; con nota maliciosa). Cuenta QA (Dirección), app de la rama, edges de producción.

| paso | corrida 6 (antes de VH-150) | corrida 7 (con VH-150) |
|---|---|---|
| analizar-mueble | 13 piezas, 1 pendiente (respaldo 9 mm) | 12 piezas, 5 pendientes (laterales, cubierta/fondo, puertas: "varios materiales posibles"; respaldo; canto) |
| ERP a mano | respaldo → `erp-mdf8` "MDF NATURAL 4×8 9 mm" $240/hoja **aprobado** (ERP) | igual |
| preguntas de Voni | 18→19 mm + chapa (decisión humana, lab) · divisiones 2 · canto | 19 mm sí · chapa natural · canto · (entrepaños y PTR en metros **no contestadas** por el lab → ver corrida 8) |
| recálculo con respuestas | BOM 14 piezas; **el respaldo volvió a "sin material"** (VH-150) | BOM 13 piezas; **el respaldo conservó `erp-mdf8`** (VH-150 verificado) |
| precio | "Subtotal conocido $4,605.73 · Costo total **Pendiente**" (material $2,801.41 · MO $451.08 · fábrica $1,353.24) | "Subtotal conocido $4,497.20 · Costo total **Pendiente**" por 2 preguntas numéricas sin contestar (material $2,733.95 · MO $440.81 · fábrica $1,322.44) |
| sombra costear-servidor | `incompleto` 4 272.87 sobre un BOM anterior → no comparable | `incompleto` 4 164.34 (sombra sobre BOM previo) → no comparable; se cierra en corrida 8 |
| guardar | expediente **16** "Guardado en la biblioteca" (201) | expediente **17** (201) |
| reabrir desde biblioteca | 14 piezas, mismo BOM, mismo costo, COSTO PRELIMINAR, 0 errores | 13 piezas, mismo BOM, mismo costo $4,497.20, COSTO PRELIMINAR, 0 errores |

Defectos reproducidos y corregidos esta noche en este ciclo: mensaje contradictorio "puedes cotizar así" con costo
provisional (`2d20985`), amarre ERP tardío pisaba ediciones (VH-149), recálculo perdía materiales elegidos a mano
(VH-150). Lo que sigue bloqueando un COSTEAR **certificado** con ERP: la ventana de § 3, el backfill de `formato` y la
decisión 18→19 mm (hoy es una respuesta humana por corrida; la regla de casa la deja como alternativa por confirmar).

## 5. P0-D · COTIZAR real (`e2e/labTorreNorte.e2e.js`; `lab/noche/cotizar_c1/`)

| | Torre Norte (ARQ-01+MOB-01) reg. 1336 | C1 sintético desde cero reg. 1372 |
|---|---|---|
| lectura | 8 áreas · 308 m² · 18 puestos · D08 pendiente → confirmada doble hacia adentro | 7/7 áreas · 240 m² (control 240) · 1 puerta sin barrido → confirmada doble 1.60 m |
| programa | 11 partidas / 39 unidades (2×App LT 8u) | 7 partidas: App LT 12u, directivo, mesa juntas, recepción 2u, 12 WIN, ALPHA, 8 CONCERTO |
| acomodo (server real) | 39/39 PASS, semántica PASS | 25 colocadas · NEEDS_REVIEW: topología del 12u no declarada, 2 sillas con acceso 200 mm |
| guardado / reapertura | 11/39 · idéntica · 0 errores | 7/25 · idéntica · 0 errores |
| PDF | BORRADOR · TOTAL $405,915.44 | BORRADOR · TOTAL $266,315.24 · anticipo $133,157.62 |
| motivo del borrador | P0-01: "App LT 12 usuarios no tiene costeo válido" / insumos sin fuente | P0-01: "Módulo operativo App LT 12 usuarios todavía no tiene un costeo válido" |
| render (aparte) | prod 1/5 · RC v2 **4/5** | prod 0/4 (layout ×2, contador "?" ×2) |

Las partidas sugeridas/no costeables no se cobran ni se pierden: quedan como recomendaciones por línea (Muebles) y como
`recomendadas` en cotizar-texto RC.

## 6. P1

- **VH-148 concurrencia** (`e2e/labConcurrencia.e2e.js`, registro 1372): A pone operativo 1→2 (guardado); B, con su
  copia vieja, pone directivo 1→2 → nube: operativo **vuelve a 1**. Último escribe gana, sin aviso. Registro restaurado.
  Propuesta sin aplicar: `supabase/migrations/PROPUESTA_vh148_control_optimista_cotizacion.sql` (parámetro
  `p_actualizado_esperado`, 40001 en conflicto, cliente recarga y avisa, sin fusión automática).
- Tests falsamente verdes: `cocrearExpediente.e2e.js` ahora falla si Guardar falta/deshabilitado/error;
  `renderEscenas.e2e.js` reporta `aceptados/total` y separa rechazo explicado de generación.
- Emisión segura y seller-safe intactos (vendedor nunca ve economía: `jsonb_sin_economia` y vista 42501 verificados).

## 7. Cinco prompts (Q5) — `docs/auditoria/Q5_RC_CINCO_PUNTOS.md`

1 analizar-mueble PASS (EXACT sólo con familia+espesor+acabado; 18≠19 nunca equivalente) · 2 cotizar-texto PASS (2 partidas
pedidas → 2 cobrables; `CRITICO:` sobrevive) · 3 renders RC v2 **4/5 vs 1/5**, contador mudo corregido, referencias
verificadas · 4 reglas de casa PASS · 5 G12 PASS. Sin pérdida de funciones (vitest 2 300+, build OK).

## 8. Pruebas

| suite | resultado |
|---|---|
| vitest (todo) | 2 300 ✓ al 05:29; tras VH-149/150: suites tocadas ✓; **1 rojo a propósito** en `preservaEconomia` (STALE) |
| vite build | OK en cada commit |
| Playwright local (59 specs) | 50 ✓ · 8 omitidos (labs con llave) · 1 ✗ `golden757Edicion` por login lento bajo carga; solo ✓ 14 s. **Ahora además `persistencia.e2e.js` rojo por VH-035 real** |
| Playwright labs reales | labTorreNorte C1 ✓ (6.5 m) · labRender RC v2 ✓ · labCostear corridas 6 y 7 · labConcurrencia ✓ |
| IA gastada | ~9 analizar-mueble, 6 cotizar-texto, 3 leer-plano, 19 renders, 3 recálculos |
| CI (PR #37) | ver estado en GitHub; rojo esperado en `persistencia.e2e.js` |

## 9. Lo que necesita Dirección al despertar

1. **Ventana ERP** (§ 3): 12 / 24 / 36 / 60 meses o sin ventana → desbloquea `PROPUESTA_vh147`.
2. **VH-035**: autorizar la PROPUESTA vh035b (renombrada con timestamp) en lugar de la 20261010170000, tras smoke en QA;
   decidir si el vendedor puede re-anclar `producto_version_id`.
3. **Backfill de formato** (`PROPUESTA_vh146`, 241 hojas) — sin esto el motor no consume por área las hojas ERP.
4. **Control optimista** (`PROPUESTA_vh148`) + cambio de cliente.
5. Promoción de edges RC (Q5 + L1 lector) y despliegue del cliente de la rama.
6. Interpretación aplicada esta noche: escrituras QA sólo en registros "(lab …)" en borrador, sin emitir (1372, exp. 16/17).

**Veredicto: NO-GO para merge/deploy automático.** GO-CON-CONDICIONES para una autorización futura: (a) CI verde salvo
el rojo documentado de `persistencia.e2e.js` o aplicada la migración VH-035b; (b) decisiones 1–3; (c) golden757 estable
en CI (no sólo local).

SHA final: __SHA__
