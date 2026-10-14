# RELEASE 9.5 GATE · Operación Von Haucke (14-oct-2026)

**Regla de este gate:** un área llega a 9.5 solo si su comportamiento es correcto, la evidencia es reproducible y la
prueba **falla con el código anterior**. "No verificable" no cuenta como PASS.

| | |
|---|---|
| Rama | `claude/costing-app-architecture-psf02g` (PR #37) |
| Producción (cliente) | `c3.4-seller-safe` @ `c8dd2b3`. **Sin cambios.** |
| Link RC | Preview de Vercel generado para el SHA del head de esta revisión (el id va en el paquete de auditoría y en el PR: un documento no puede llevar el deployment de su propio commit). El anterior `dpl_HPsG8T32RJd9kzswNm6sD7odpvY1` es de `bf096aa` y **ya no representa el código**. |
| Edge RC | `costear-servidor-rc`: se redespliega con cada cambio de su código; versión y `ezbr_sha256` vigentes en `lab/costear/holdout_intelisis/edges_*.json` y en el paquete. |
| SQL aplicado en producción en esta operación | **ninguno** (vh146c ya estaba aplicada) |

## 1. Veredicto

**NO-GO a producción.** Tras la reauditoría externa v2 (14-oct) hay un **incidente de seguridad activo** que va
antes que todo: la contraseña de `qa-direccion` (rol `direccion`, sin MFA) estuvo en el repositorio, que es **público**.
Se quitó del HEAD (`70ac719`), pero sigue en el historial y la cuenta **no está rotada**: Rodrigo decidió no tocar
producción todavía. Mientras no se rote, debe tratarse como comprometida.

Después, el negocio **no puede emitir en firme** sin estas condiciones:

0. Rotar la contraseña de `qa-direccion`, revocar sus sesiones (6,266), actualizar el secreto de CI y limpiar el historial.
1. Aplicar SEG-01 v1, P1-03b, VH-148b, SEG-01c rev 2 (modo preparado) y VH-100, en ese orden. SEG-01c **exige** VH-148b
   y aborta sin ella (autorización de Rodrigo; ver `docs/auditoria/RESPUESTA_REAUDITORIA_V2_OP95_20261014.md`).
2. Cargar el reporte de costo de Intelisis por clave (Compras). Hoy 1,931 de 1,931 productos de lista no tienen
   costo oficial.
3. Que una persona de Dirección apruebe precios con su cuenta, para que exista el primer costo VALIDADO real.
4. Tomar las decisiones D1 y D2-Producción.

## 2. Matriz antes/después (escala 1–10)

"Antes" es la MATRIZ_V3 del 13-oct. Las notas sin medición se marcan como **estimado**.

| Área | Antes | Después | Evidencia | ¿≥ 9.5? | Por qué no más |
|---|---|---|---|---|---|
| SEG-01: emisión sin confiar en el cliente | 4 (gap abierto) | **8.5** (reauditoría v3: 6.5 sobre la rev 2) | **SEG-01c rev 3**: identidad del mueble declarada con el despiece y exigida en el primer vínculo; vínculo vigente aparte (recostear K1→K2); traspaso Diseño→Dirección idempotente; estricto exige versión de motor. Rev 2: huella de la definición de la partida fijada al vincular y exigida al emitir; CAS en el vínculo (exige VH-148b); canónica = ids numéricos (cierra el hueco de `productoId` de texto); frescura de precio por `precio_id` y de la base de costo (parámetros + catálogo + motor). 47 pruebas como sesión `authenticated` sobre la base de producción, más un bloque ANTES que demuestra que los 4 ataques pasaban con la revisión 1. | No | Sin aplicar. Política `frescura` es decisión de Dirección (por omisión fail-closed). VH-035c (producción) invalida el costo cuando el vendedor guarda un render (observación nueva). Sin concurrencia real ni E2E con base real. |
| Estado del costo (incompleto/preliminar) | 6 | **9** | Antes, el servidor devolvía `incompleto` con 0 motivos en el librero 5×8; ahora `preliminar` con 5 motivos (smoke vivo, exp. 159). 7 pruebas del estado, invariante "no certificado ⇒ con motivo". | No | Falta verlo en más familias vivas. |
| P1-03: aprobación del precio exacto | 3 (regex por e-mail) | **8.5** (reauditoría: 7.8) | P1-03b (PROPUESTA): la vista expone `precio_id` y la Edge lo usa; la re-elección en JS queda como respaldo marcado en la traza. PGlite con la vista de producción (incluye el empate real 287). | No | Sin aplicar. 0 aprobaciones humanas reales. |
| VH-100: costo oficial de líneas | 2 | **5** | Migración convertida en PROPUESTA (estaba en riesgo de `db push`). Hueco de rol por `user_metadata` cerrado. Historial y fin de la escritura directa. 6 pruebas que fallan con la versión anterior. | No | Falta el dato: 1,931/1,931 sin costo, 116 sin clave. **Bloqueado por Compras.** |
| VH-148: concurrencia (409) | 5 | **7.5** (reauditoría: 6.5) | VH-148b más **VH-148d**: `vincular_cotizacion` sin versión retirada (verificado que nadie la llama) y nueva sobrecarga con CAS (40001/22004). 73 pruebas; 15 fallan sin la propuesta. | No | Sin aplicar. La espera real entre dos conexiones y PostgREST real no se probaron (PGlite tiene una sola conexión). |
| Costear motor (paridad, unidades, $0) | 7 | **8** | Paridad al centavo en vivo ($6,614.24; difícil $7,362.69). Hoja de control 6/6. 3,007 pruebas. | No | Holdout fuera de muestra no corrido (no hay datos nuevos). In-sample: MAPE 33.2 %, sesgo +18.9 %. |
| Holdout Intelisis (preparación) | 0 | **8.5** (reauditoría v2: 7.5) | **Holdout v3**: archivos = cierre transitivo de imports (la lista a mano dejaba fuera ~70, entre ellos `reglasTaller.js` y `acabados.js`), más el script y `package-lock.json`; modelos de IA congelados por (fn, modo) y verificados con `--modelos` (en 7 días la Edge RC resolvió 3 modelos con el mismo SHA). 10 pruebas. | n/a | Falta re-congelar con la Edge RC nueva y, sobre todo, los datos de Compras. El comportamiento del proveedor no se puede congelar; su identidad sí. |
| ERP / precios | 6 | 6 | Medido: 1,763 aprobados por QA, 30 por `reconciliacion`, 0 por personas | No | Datos de origen sin sanear; D1 sin firmar. |
| Cotizar (propuesta/emisión) | 3 | 3 | Sigue bloqueada por VH-100 | No | No depende del código. |
| Cotizar (acomodo) | 6 | **7** | APP LT 10U (6000×1200) con el solver real: 7 pruebas nuevas (cabe o no cabe por geometría, 0 encimados, 0 fuera de área); texto en singular corregido | No | C5 (fuera de cuarto) y C2 parcial siguen abiertos (MATRIZ_V3); falta reverificar con plano real. |
| Cocrear | estimado 7 | estimado 7 | sin cambios en esta operación | No | No reverificado. |
| Renders | 7 | 7 (medido) | `render_eventos`, 14 días: de 63 con veredicto QA, 43 `QA_PASS` (68 %) y 20 rechazados (`layout_match`, `geometry_match`, `extra_objects`). Otros 72 eventos sin veredicto. | No | Un tercio de los renders evaluados no coincide con el producto, aunque la compuerta lo rechaza correctamente. La fidelidad sin referencia no es certificable. |
| Council (Anthropic + Gemini) | estimado 7 | **4 (medido)** | Desde el 6-oct, Anthropic no respondió ninguna vez: `max_tokens` el 6-oct; el 13-oct se abortó a los 14 s. Su latencia real es de 29–43 s. Todo sale SINGLE_PROVIDER (Gemini). La degradación sí se etiqueta bien. | No | Defecto de configuración (presupuesto 14–22 s contra 29–43 s). Arreglarlo exige tocar la Edge de producción `voni-council`: **requiere autorización**. |
| Biblioteca / datos QA | estimado 6 | **8** | Los 80 más recientes eran todos de QA, así que los reales no aparecían. Filtro con interruptor y límite de 400. PROPUESTA de etiquetado de 154 ids exactos con 4 pruebas PGlite. | No | Etiquetado sin aplicar. |
| Seguridad | 7 | **2** (medido, reauditoría v2) | Contraseña de `qa-direccion` (rol `direccion`, sin MFA, 6,266 sesiones) en el repo **público**. Quitada del HEAD; no rotada. Sin evidencia de altas de usuarios ni de escrituras raras (eso no prueba que nadie entró: las lecturas no dejan rastro y el log de Auth está vacío). | **No** | Rotar, revocar sesiones, mover a secretos, limpiar historial. Hasta entonces, 2/10. |
| Rendimiento | estimado 7 | 7 | Advisors: solo INFO (3 llaves foráneas sin índice, 13 índices sin uso) | No | Sin medición de tiempos de usuario en esta operación. |
| Pruebas, CI y E2E | 39 archivos STATIC GUARD; **CI E2E rojo desde antes de la operación** | **8** (reauditoría: 7) | CI de GitHub **verde** en `df9a21a` (verify + E2E): el mock refleja VH-035c, que está en producción. Script de depuración sin aserciones eliminado. E2E local: 71 pasan, 0 fallan. 137→118 string-assert. | No | 118 static guards siguen. "Refactor puro" no está demostrado (las mutaciones miden sensibilidad, no equivalencia). |

**Ninguna área llega a 9.5 medida y defendible.** Las que más se acercan (estado del costo y preparación del
holdout) dependen de datos o de decisiones que no son de código.

## 3. Evidencia por gate (reproducible)

| Gate | Cómo se reproduce | Resultado |
|---|---|---|
| Suite completa | `npx vitest run --exclude '.claude/**' --exclude 'node_modules/**'` y lo mismo con `VERCEL_ENV=preview CARRIL_RC=si` | Ver `CI_ESTADO.txt` del paquete de cada revisión (en `d5b45d6`: 343 archivos, 3,196 pruebas, build y E2E 93/0 fallas). |
| SEG-01c adversarial | `npx vitest run supabase/tests/seg01cVinculoCosteo.test.js` | Sesiones authenticated sobre la base de producción. Dos bloques ANTES: la rev 1 y la rev 2 (la que auditó la reauditoría v3) contra sus ataques, que pasaban. |
| VH-100 | `npx vitest run supabase/tests/cargarCostosOficiales.test.js`; con `VH100_MIG=<archivo viejo>` fallan 7 | 12/12 |
| Estado y precio exacto | `npx vitest run src/datos/autoridadCosteoServidor.test.js` | 20/20 |
| Smoke vivo | `lab/rescate/preview_link/librero_5x8_post_seg01b/` y `librero_5x8_integrado_bf096aa/` | 6/6, paridad al centavo, guardar y reabrir. Hubo una corrida FAIL intermedia (2649de8) por una regresión propia en la biblioteca, ya corregida. |
| Edge RC | `scripts/edge_boot_check.sh costear-servidor-rc` y el workflow `deploy-edge.yml` run 38509149245 | arranca; despliegue OK |
| Holdout v4 | `node scripts/congelar_holdout.mjs --verificar --db … --edges … --modelos … --requests …` | Falta cualquiera, modelos vacíos o un request sin evento: exit 2. Un modelo distinto al esperado o cualquier cambio: exit 1. |

## 4. Hallazgos ya corregidos en código (antes listados aquí como abiertos)

- **Medio centavo JS↔SQL:** corregido; `precioConDescuento(1000.10, 5)` = 950.10, igual que `emitir_revision_v2`.
- **Costo 0 "certificado":** corregido; CHECK en `costeos_servidor` y estado `incompleto` en el servidor de costeo.
- **Abierto (P2):** la sombra cliente↔servidor redondea al peso del lado cliente; solo afecta el diagnóstico.

## 5. No verificable en esta operación (y por qué)

- **Primer costo VALIDADO real:** requiere que una persona de Dirección apruebe precios. La cuenta QA no puede ni
  debe hacerlo.
- **Holdout fuera de muestra:** no hay reportes nuevos de Intelisis.
- **Emisión E2E de líneas de catálogo:** bloqueada por VH-100 (dato).
- **Council con ambos proveedores:** requiere desplegar `voni-council` (producción) con otro presupuesto o modelo.
- **SEG-01c, VH-148b/d, VH-100 y P1-03b en producción:** sin autorización para aplicar.

## 6. Decisiones pendientes (de Rodrigo / Dirección / Compras / Producción)

0. **Rotar la contraseña de `qa-direccion` y revocar sus sesiones** (incidente activo).
1. Elegir la política de frescura de SEG-01c: `exigir_vigente` (por omisión: un cambio de parámetros, catálogo o precio invalida el costeo) o `congelar_al_costear` (el costo vale durante la vigencia de la cotización).
1b. Autorizar SEG-01c en modo preparado y, después del despliegue de la Edge y el cliente, pasarlo a estricto (y elegir: estricto, o fecha de transición `legacy_sin_costeo_hasta`; hay 27 cotizaciones con
   folio y renglones sin costeo del servidor).
2. Autorizar VH-148b con VH-148d (paso 1; el paso 2 `vh148c` solo cuando no quede ningún cliente viejo abierto) y VH-100.
3. D1: vigencia de 24 meses, y firma por política o precio por precio.
4. ¿Compras puede aprobar precios, o solo Dirección?
5. Umbral de aceptación del holdout (propuesta: MAPE ≤ 10 %, sesgo ±5 %, ≥ 80 % dentro de ±10 %).
6. Council: autorizar el cambio de presupuesto o modelo de Anthropic en la Edge de producción.
7. D2: ratificación de Producción (merma de corte del tubular).
8. Etiquetar los 154 expedientes QA (PROPUESTA lista).

## 14-oct-2026 · Firma de precios ERP y tramo vendido por pieza (`07ff56d`)

**APLICADO en producción (autorizado por Rodrigo: "SI AUTORIZO")**, en 6 migraciones `firma_precios_erp_*`:
- `cuentas_no_humanas` (QA y reconciliación);
- `aprobaciones_precio_historial` (append-only);
- `firmar_precios_erp_vigentes(int)` y `firmar_precios_erp_lote(int, bigint, int)`.

Verificado:
- anon no ejecuta ni lee;
- 1,783 candidatos ≤ 24 meses, de los cuales 3 requieren validación de Compras;
- **0 firmas hechas**: la firma la da Rodrigo con su sesión. La cuenta QA es rechazada por la base.

Nota técnica: el MCP de Supabase se cuelga 60 s ante cualquier `drop`, porque pide una confirmación que no llega. Las tres primeras llamadas no aplicaron nada (verificado).

**Motor 2026-10-14a (RC; `costear-servidor-rc` desplegada, run 41):** tramo vendido por pieza, con $/m = $/pieza ÷ medida.
- Paridad con Intelisis en ATPU2M/75M/3M dentro de ±1.5 %, con merma de corte del tubular de 6.94 %.
- La merma se calculó de esos tres reportes (rango 6.2–7.7 %, supuesto pata U = 2×720 + ancho) y la autorizó Dirección.
- Las pruebas fallan con el motor anterior.

**SIN APLICAR (requiere autorización expresa):** `PROPUESTA_tramo_por_pieza_catalogo.sql` marca 155 barras ERP:
- 128 tubulares al 6.94 % y 27 perfiles al 5 %;
- la marca va en `atributos.tramoPorPieza`. El motor de producción la ignora (sin cambio de costo); el RC la usa.

Sin esa migración, todo mueble con tubular ERP sigue sin costear (unidad pza sin formato → conflicto crítico en el amarre).

**Bandera `D2_RATIFICADA_POR_PRODUCCION = false` (sin cambio):** todo costo con tubular por fracción queda tope `preliminar` y no se emite. Cambiarla es decisión de Rodrigo / Producción.

**Holdout:** INVÁLIDO desde `07ff56d` (cambió `calculo.js` y `nube.js`). No se ha corrido; hay que re-congelarlo (v5) antes de correrlo.
