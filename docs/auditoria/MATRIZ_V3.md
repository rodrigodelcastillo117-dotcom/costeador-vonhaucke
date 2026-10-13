# Matriz V3 · criterio 9.5/10 verificable (2026-10-13)

**Veredicto: NO-GO a producción.** Nada se fusionó, nada se desplegó a producción y no se aplicó ninguna migración.
Las Edge desplegadas hoy desde la rama son copias `*-rc` (flujo manual "Deploy edge functions", corridas 15–18).
Rama `claude/costing-app-architecture-psf02g` · PR borrador #37 (no fusionar) · SHA de esta matriz: ver § 9.

Estados, sin redondear hacia arriba:

- **PASS REPRODUCIDO**: lo corrí yo, en esta rama, y la evidencia está en el repo.
- **FAIL**: lo corrí y falla. Se dice qué falla.
- **RIESGO**: pasa, pero con una condición o un dato que no está respaldado.
- **BLOCKED**: no se puede cerrar sin una decisión o una autorización que no es mía (SQL, despliegue, precio, diseño).

Un flujo **preliminar** nunca se cuenta como certificado. Un costo con precios `propuesto` o `propuesto_validado` es preliminar.

## 1. Integridad y concurrencia (VH-035c, VH-148)

| # | Caso | Estado | Evidencia |
|---|---|---|---|
| 1.1 | VH-035 en producción: el vendedor guarda y se pierde el costo de Dirección | **FAIL** (producción, visible a propósito) | `e2e/persistencia.e2e.js:125` rojo en CI 662 y local. Se queda rojo hasta aplicar el SQL. |
| 1.2 | VH-035c integral (anidada, STALE por producto/versión/BOM/material/lote, re-pin, aprobaciones) | **PASS REPRODUCIDO** en PGlite + E2E con simulador | `supabase/tests/preservaEconomiaIntegral.test.js` (32), `espejoNubeFalsaVh035c.test.js` (15), `e2e/persistenciaVh035c.e2e.js` 3/3 local |
| 1.3 | Motivo de recosteo en palabras (producto vs lote), sin código crudo | **PASS REPRODUCIDO** | `e2e/persistenciaVh035c.e2e.js` (aserción nueva `toHaveCount(0)` del código crudo). Mi cambio de texto rompió esta prueba en CI 661/662; corregido en `3fc1352`. |
| 1.4 | Composición VH-035c + VH-148 en cualquier orden de aplicación | **PASS REPRODUCIDO** en PGlite | `supabase/tests/composicionVh035cVh148.test.js` (21): 3 argumentos delegan al núcleo de 2; sin DEFAULT ambiguo |
| 1.5 | VH-148: dos pestañas, conflicto, recuperación explícita, ambas versiones conservadas | **PASS REPRODUCIDO** con simulador | `e2e/concurrenciaOptimista.e2e.js` 7/7, `src/datos/conflictoGuardado.recuperacion.test.js` |
| 1.6 | VH-148 con **dos sesiones reales** contra Supabase | **BLOCKED** | El RPC `guardar_cotizacion_v3` con `version_esperada` no existe en la base: `PROPUESTA_vh148_control_optimista_cotizacion.sql` sin aplicar. La bandera degrada al guardado actual (sin control). |
| 1.7 | Aplicar `vh035c` + `vh148` en producción | **BLOCKED** (autorización) | Orden propuesto en `docs/auditoria/INTEGRACION_PR37.md`; bloque de reversión incluido en cada SQL. |

## 2. COSTEAR · corrección técnica, no sólo paridad

Fixtures con hoja de control (renglón esperado + evidencia del plano): `lab/costear/hojas_control/*.json`.
El comparador (`e2e/hojaControl.js`) revisa el **DTO real que recibe `costear-servidor-rc`**: omitidos, duplicados,
medida, material, metros, cantidad. Todas las corridas de este bloque usaron Edge RC (`edges: rc=N prod=0`).

| # | Caso | Estado | Evidencia |
|---|---|---|---|
| 2.1 | Credenza 3 puertas MDF enchapado nogal: BOM vs plano | **PASS REPRODUCIDO** 12/12 (3 corridas: V3-4, V3-6, V4) | `lab/noche/costear_v4/v4_credenza/9-hoja-control.json` |
| 2.2 | Credenza: paridad cliente/servidor, guardar, reabrir | **PASS REPRODUCIDO** $4,546.02 = $4,546.02; mismo BOM y costo al reabrir | `v4_credenza/4-paridad.json`, `6-reabierta.json` |
| 2.3 | Credenza: transferir a Cotizar | **BLOCKED** (diseño) | Bloqueada a propósito: 3 decisiones abiertas (calibre PTR, especie de chapa, respaldo 9 mm). El motor no la deja pasar como firme. |
| 2.4 | Mesa de centro cristal + base tubular cromada: BOM vs plano | **PASS REPRODUCIDO** 3/3 tras VH-164/165 (antes FAIL en V3-3, V3-5 y V4) | `lab/noche/costear_v4/v5_mesa_centro/9-hoja-control.json` |
| 2.5 | Mesa de centro: paridad, guardar, reabrir | **PASS REPRODUCIDO** $3,040.03 = $3,040.03; idéntico al reabrir | `v5_mesa_centro/4-paridad.json`, `6-reabierta.json` |
| 2.6 | Mesa de centro: costo firme | **BLOCKED** (precios) | Servidor `incompleto`: cristal `propuesto`, tubular y nivelador `propuesto_validado`. Transferencia bloqueada. |
| 2.7 | Mesa de trabajo PTR + faldón: BOM vs plano | **PASS REPRODUCIDO** 6/6 (V5 y V6, mismo costo en ambas) | `lab/noche/costear_v4/v6_mesa_trabajo/9-hoja-control.json` |
| 2.7b | Mesa de trabajo: ciclo completo imagen → BOM → costo → paridad → guardar → **transferir a Cotizar** → reabrir | **PASS REPRODUCIDO como PRELIMINAR** | $2,217.79 = $2,217.79; partida en Cotizar con venta $3,696.31 (40 %); reabierta idéntica. En V5 lo bloqueó en falso VH-163b. |
| 2.7c | Mesa de trabajo: costo **certificado** | **BLOCKED** (precios) | 5 de 7 insumos sin precio certificado (melamina, tapacanto, PTR, lámina `propuesto`; nivelador `propuesto_validado`). |
| 2.8 | Formato 5×8 y lámina 3×10 en la rejilla de corte | **PASS REPRODUCIDO** en el motor de la rama · **BLOCKED** para producción | `docs/auditoria/MOTOR_FORMATO_REJILLA.md`, `src/motor/formatoRejilla.test.js`. Cambia el costo: requiere desplegar cliente y servidor juntos. |
| 2.9 | `mermaCorte` no se aplica con `fraccion=true` | **RIESGO** (decisión de Producción) | No es descuido: la rejilla real ya modela corte y orilla. El 6 % semilla no tiene fuente. Ver `MOTOR_FORMATO_REJILLA.md` § 2. |
| 2.10 | Servidor de costeo de producción desfasado del motor publicado | **FAIL** (producción) · **BLOCKED** (despliegue) | `costear-servidor` v9 (12-oct 12:33 UTC) no tiene `aa8ccae`, `8ab047c`, `61c3637`. En V3 la mesa de trabajo salió `incompleto` sólo por eso. `costear-servidor-rc` sí cuadra al centavo. |

### Defectos técnicos encontrados y corregidos hoy (con prueba)

| ID | Defecto | Efecto en dinero | Prueba |
|---|---|---|---|
| VH-164 | "cromado (EcoCrom) en base tubular" se leía como **acero** (por "tubular"); el cliente proponía el tubo como candidato y la regla de casa le agregaba **pintura en polvo** al acero cromado. | Pintura que no existe + 1 m² de cromo inventado (1000×1000). | `src/datos/reglasTaller.test.js` (VH-164) |
| VH-164b | Perímetro de tubo **redondo** calculado como cuadrado (4·d en vez de π·d). | +27 % de área a pintar/cromar en todo tubular redondo. | `reglasTaller.test.js` (VH-164b) |
| VH-165 | "soldadura para tubo" caía en acero por "tubo" y se **auto-asignaba al PTR cal. 14**; el confirmado masivo no lo vio porque era "misma familia". | $270.78 de PTR por soldadura, y +0.10 m² al cromado (0.53 en vez de 0.43). Sustitución silenciosa. | `reglasTaller.test.js` (VH-165) |
| VH-163b | Mi regla VH-163 ("cubierta sin soporte") sólo reconocía soportes en **singular**: "Patas PTR", "Largueros", "Travesaños" caían en `otro`. | Falso bloqueo de la mesa de trabajo (expediente 38) y la regla de niveladores no se disparaba. | `src/datos/revisionEstructural.test.js` (VH-163b, con el BOM real) |
| VH-166 | Con todo el BOM costeado, la tarjeta decía "Subtotal conocido (solo lo que ya tiene material)… hasta costear todo" y escondía el motivo real. | Ninguno en dinero; la persona no sabía qué resolver. | `AsistenteEspecial.jsx` (`data-testid="costear-motivo-bloqueo"`) |
| — | Hoja de control credenza: `chapa` excluía "enchapado". | Falso FAIL del comparador (no del producto). | `lab/costear/hojas_control/credenza.json` |

### Riesgos de Costear que siguen abiertos

- **Soldadura** con `cantidad 1` y procedencia `ASSUMED` (la IA estimó ~0.1 kg en otra corrida). `soldadura` está `aprobado` a $65 en el catálogo, pero la cantidad no tiene respaldo.
- **EcoCrom $180/m²** aparece `aprobado`, sin artículo ERP. El ERP sí tiene maquilas de cromado por pieza (2022). Confirmar con Compras.
- **Niveladores** se agregan por la regla de casa 3 aunque el plano no los dibuje. Es regla aprobada; la hoja de control lo permite y lo dice.
- **IA mal formada**: 1 de 4 análisis de mesa de trabajo devolvió `INVALID_MODEL_SHAPE` (piezas dentro de un texto). El guardia del servidor lo rechaza y no entra un BOM basura; la persona tiene que reintentar.

## 3. ERP (110 registros, política, sustituciones)

| # | Caso | Estado | Evidencia |
|---|---|---|---|
| 3.1 | Auditoría de los 110 registros nuevo/vigente | **PASS REPRODUCIDO** (auditoría) | `docs/auditoria/ERP_110_AUDITORIA.md`, `erp_110_registros.json` |
| 3.2 | Los 110 son el lote A11 de curados: 98 nuevo aprobado, 7 propuesto_validado, 5 vigente | **RIESGO** | 103 aprobaciones con la cuenta QA en 23 s; 27 envejeciendo; 109 duplicados LEGACY abiertos (p. ej. `lamina-3x10-12` +19.7 %) |
| 3.3 | Gemelo ERP estricto (acabado, color, espesor, calibre, formato, unidad; ausencia ≠ igualdad) | **PASS REPRODUCIDO** | `src/datos/gemeloErp.js` + pruebas |
| 3.4 | Fecha real de última compra (no fecha de carga) | **PASS REPRODUCIDO** | `fechaUltimaCompra()` en `materialMatch.js` |
| 3.5 | Ninguna sustitución se vuelve confirmación en silencio | **PASS REPRODUCIDO** en las corridas de hoy · **RIESGO** por clasificación | VH-158 (confirmado masivo excluye diferencias). VH-165 demostró que "misma familia" puede esconder una sustitución si la familia está mal: se corrigió la familia, no la regla. |
| 3.6 | Búsqueda tardía no pisa cambios manuales | **PASS REPRODUCIDO** | VH-149/VH-152c (`fusionarAmarreEnBom`, `fusionarGemelosEnBom`) |
| 3.7 | Política ERP versionada en SQL | **PASS REPRODUCIDO** en PGlite · **BLOCKED** para producción | `supabase/tests/erpPolitica.test.js` (30); `PROPUESTA_vh147_elegibilidad_erp.sql` sin aplicar |

## 4. COTIZAR más allá de C1

| # | Caso | Estado | Evidencia |
|---|---|---|---|
| 4.1 | C1 recto: acomodo, sin sillas de 200 mm, puertas y circulación | **PASS REPRODUCIDO** (VALIDADO) | `lab/noche/cotizar_c1/` |
| 4.2 | C5 en L: acomodo | **FAIL** | 6 sillas de consejo y el escritorio directivo **fuera de su cuarto** (`lab/noche/cotizar_v3/C5_ele/4-veredicto.json`). El sistema lo dice como FALLA; no lo esconde. |
| 4.3 | C2 curvo: acomodo | **RIESGO / PARCIAL** | 13 piezas sin colocar con causa por renglón (la mesa de consejo 4.80 m no cabe; sus sillas dependen de ella). `C2_curvo/4-veredicto.json` |
| 4.4 | Identidad y conteos al guardar y reabrir (C1, C5, C2) | **PASS REPRODUCIDO** | `8-reabierta.json`: `identica: true`, sin diferencias en partidas, cantidades, precios ni colocación |
| 4.5 | Ninguna recomendación cobrable inventada | **PASS REPRODUCIDO** | `cobrablesSugeridas: 0` en las tres |
| 4.6 | Propuesta emitible | **BLOCKED** (P0-01) | Productos de catálogo sin costo industrial oficial: la propuesta queda **BORRADOR · NO REGISTRADO** (marca en el PDF, texto en `C5_ele/7-propuesta.txt`). |

## 5. Renders

Corrida v6 (`lab/noche/render_v6/`, C1 recto, `generar-render-rc` con VH-161b: el contador ya no recibe la cifra esperada).
Conté a mano las imágenes aceptadas, ampliadas.

| # | Caso | Estado | Evidencia |
|---|---|---|---|
| 5.1 | Cinco etapas (generada, validada, persistida, reabierta, PDF) | **PASS REPRODUCIDO** para 3 de 4 áreas | `resumen.json`: 3 generadas, 3 validadas, 3 persistidas, 3 reabiertas, PDF con 6 imágenes |
| 5.2 | Área operativa | **FAIL honesto** | El generador hizo 10 sillas de 12; el contador lo vio y la Edge devolvió `RENDER_COUNT_MISMATCH` con el mensaje "sillas: 10 de 12. Usa el plano…". No se guardó imagen falsa. La imagen rechazada no se persiste: **no pude contarla a mano**. |
| 5.3 | Conteo del auditor sin anclaje | **PASS REPRODUCIDO** en 3/3 aceptadas | Juntas 8 = 8 a mano (3 + 1 + 1 + 3); Dirección 1 = 1; Recepción 0 = 0. En v3/v4/v5 el auditor dijo 12 sobre 10 reales. |
| 5.4 | Fidelidad geométrica con referencia (Dirección) | **RIESGO** | El auditor da PASS, pero el escritorio directivo sale con una mampara al centro, como un bench. **No sé** si la referencia del producto la trae; no lo puedo certificar sin ver la ficha. |
| 5.5 | Fidelidad sin referencia (Recepción) | **BLOCKED** sin referencia | `geometria_producto = NO_VERIFICABLE`. No se certifica fidelidad sin referencia. |
| 5.6 | Fidelidad de acabados | **RIESGO** | No hay prueba automática de acabado contra muestra física; el auditor sólo opina. |

## 6. Cinco prompts (regresión)

| # | Caso | Estado | Evidencia |
|---|---|---|---|
| 6.1 | EXACT vs sustituto | **PASS REPRODUCIDO** con hallazgo | La IA marca EXACT una jaladera genérica para "recta 300 mm"; el cliente lo degrada (P0.12 / VH-157). `lab/noche/q5_v3/` |
| 6.2 | Recomendaciones no cobrables | **PASS REPRODUCIDO** | Sin inflar partidas |
| 6.3 | Referencias de render | **PASS REPRODUCIDO** | Sin referencia → NO_VERIFICABLE |
| 6.4 | 18 mm explícito | **PASS REPRODUCIDO** | Se respeta; la chapa no se marca EXACT |
| 6.5 | Inyección en el texto | **PASS REPRODUCIDO** | Ignorada; la pregunta CRÍTICA se conserva |

## 7. Seguridad y experiencia: ningún error en silencio

| # | Caso | Estado | Evidencia |
|---|---|---|---|
| 7.1 | IA con despiece degenerado (12 → 2 renglones) | **PASS REPRODUCIDO** | VH-162 cliente + servidor RC (`INVALID_MODEL_SHAPE`) |
| 7.2 | Mueble sin soporte (cubierta sin patas) | **PASS REPRODUCIDO** | VH-163 bloquea "Agregar a la cotización" |
| 7.3 | Overrides RC fuera del bundle de producción | **PASS REPRODUCIDO** | Build: 0 referencias a `*-rc` |
| 7.4 | Aprobaciones con la cuenta QA | **RIESGO** | La cuenta QA sólo se usó en laboratorio; no se usó para simular aprobaciones humanas. Las 103 aprobaciones históricas del lote A11 sí son de la cuenta QA (§ 3.2). |

## 8. Pruebas

| Suite | Resultado | Dónde |
|---|---|---|
| Vitest completo | 294 archivos / 2,559 pruebas PASS (`2088691`); `src/datos` 189/1,599 y `src/componentes` 32/124 PASS tras VH-163b/166 | local |
| Build de producción | OK, 0 referencias RC | local |
| E2E persistencia + VH-035c + concurrencia | 15 PASS / 1 FAIL (`persistencia:125`, intencional) | local |
| CI `verify` | PASS en 662 y 664 | GitHub Actions |
| CI E2E | 664 (`8b66e8f`): **60 PASS / 10 SKIP / 1 FAIL** = sólo `persistencia:125` (VH-035, intencional). En 662 eran 3 FAIL: los 2 de VH-035c los rompí yo con el texto de `emisionUX` y se corrigieron en `3fc1352`. | GitHub Actions |

## 9. SHA, decisiones y veredicto

**Código evaluado:** `b1648ad` (última corrección) sobre la rama `claude/costing-app-architecture-psf02g`. Esta matriz y la
evidencia viven en los commits siguientes de la misma rama. Producción sigue en `c8dd2b3`.

### Lo que NO es mío decidir y bloquea el 9.5

1. **Aplicar SQL** `vh035c` y `vh148` (en ese orden o cualquiera: está probado), y `vh147`/`vh146`. Sin esto VH-035 sigue rojo en producción y VH-148 no se puede probar con dos sesiones reales.
2. **Redesplegar `costear-servidor`** de producción con el motor publicado (hoy desfasado; RC cuadra al centavo).
3. **Desplegar el motor `2026-10-13`** (rejilla 5×8 y 3×10) en cliente y servidor juntos: cambia costos.
4. **Certificar precios** de los insumos que usan estas tres familias (melamina 19, tapacanto, PTR, lámina 18, cristal, tubular 3/4", niveladores) y confirmar EcoCrom ($180/m² sin artículo ERP) y la cantidad de soldadura.
5. **Costo oficial de productos de catálogo** (P0-01): sin eso ninguna propuesta de Cotizar sale de BORRADOR.
6. Diseño: pintura negra, jaladera 300 mm (298 o 318 mm), tipo de tapacanto de la credenza; merma con `fraccion=true` (Producción).
7. Re-revisar las 103 aprobaciones ERP hechas con la cuenta QA.

### Calificación honesta (no hay 9.5)

| Área | Nota | Por qué no más |
|---|---|---|
| Integridad y concurrencia | 7/10 en RC | Probado en PGlite y E2E con simulador; nada aplicado; dos sesiones reales imposibles sin SQL. |
| Costear | 7/10 | Tres familias con BOM correcto contra el plano y un ciclo completo, pero hoy encontré y corregí 5 defectos técnicos (dos con dinero) que la paridad al centavo no veía. Ningún costo certificado. |
| ERP | 6/10 | Reglas estrictas y probadas; los datos de origen (aprobaciones QA, duplicados LEGACY) siguen sin sanear. |
| Cotizar (acomodo) | 6/10 | C1 válido; C5 falla (fuera de cuarto) y C2 parcial. Lo dice, no lo esconde. |
| Cotizar (propuesta) | 3/10 | Bloqueada por P0-01; no depende del código. |
| Renders | 7/10 | Contador ya fiable en 3/3; el generador falla el conteo en el área grande; fidelidad sin referencia no certificable. |
| Seguridad y UX | 7/10 | Errores visibles y bloqueos honestos; dos de mis propias reglas (VH-163, texto de emisión) generaron un falso bloqueo y un rojo de CI antes de corregirse. |

**Veredicto: NO-GO a producción.** El código de la rama está mejor que el de producción en todo lo medido, pero producción
no puede recibirlo sin las decisiones 1–3, y el negocio no puede emitir en firme sin 4–5.
