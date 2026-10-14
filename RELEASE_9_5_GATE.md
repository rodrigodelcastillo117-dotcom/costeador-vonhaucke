# RELEASE 9.5 GATE · Operación Von Haucke (14-oct-2026)

**Regla de este gate:** un área llega a 9.5 solo si su comportamiento es correcto, la evidencia es reproducible y la
prueba **falla con el código anterior**. "No verificable" no cuenta como PASS.

| | |
|---|---|
| Rama | `claude/costing-app-architecture-psf02g` (PR #37) |
| Producción (cliente) | `c3.4-seller-safe` @ `c8dd2b3`. **Sin cambios.** |
| Link RC | `dpl_EwkGsCs61qwaLv7pLxKGVYivDuUr` (commit f56632a) |
| Edge RC | `costear-servidor-rc` @ 6d1cd13 |
| SQL aplicado en producción en esta operación | **ninguno** (vh146c ya estaba aplicada) |

## 1. Veredicto

**NO-GO a producción.** No es por calidad del código de la rama, que mejora a producción en todo lo medido. Es
porque el negocio **no puede emitir en firme** sin estas condiciones:

1. Aplicar SEG-01b, VH-148 y VH-100 (autorización de Rodrigo).
2. Cargar el reporte de costo de Intelisis por clave (Compras). Hoy 1,931 de 1,931 productos de lista no tienen
   costo oficial.
3. Que una persona de Dirección apruebe precios con su cuenta, para que exista el primer costo VALIDADO real.
4. Tomar las decisiones D1 y D2-Producción.

## 2. Matriz antes/después (escala 1–10)

"Antes" es la MATRIZ_V3 del 13-oct. Las notas sin medición se marcan como **estimado**.

| Área | Antes | Después | Evidencia | ¿≥ 9.5? | Por qué no más |
|---|---|---|---|---|---|
| SEG-01: emisión sin confiar en el cliente | 4 (gap abierto) | **8** | 15 pruebas adversariales PGlite sobre el SQL exacto de producción; 14 fallan sin la propuesta; rollback al md5 de producción | No | PROPUESTA sin aplicar. Al aplicarla, ninguna línea especial se emite sin costeo del servidor certificado y con aprobación humana. Eso hoy significa 0 emisiones de especiales hasta que Rodrigo apruebe precios. |
| Estado del costo (incompleto/preliminar) | 6 | **9** | Antes, el servidor devolvía `incompleto` con 0 motivos en el librero 5×8; ahora `preliminar` con 5 motivos (smoke vivo, exp. 159). 7 pruebas del estado, invariante "no certificado ⇒ con motivo". | No | Falta verlo en más familias vivas. |
| P1-03: aprobación del precio exacto | 3 (regex por e-mail) | **8** | 13 pruebas con datos reales de producción (aprobadores, empate real `lamina-3x10-14`). Botón de Dirección en Costear. | No | Ningún precio tiene aprobación humana real. El primer VALIDADO requiere a Rodrigo; no se puede verificar con QA. |
| VH-100: costo oficial de líneas | 2 | **5** | Migración convertida en PROPUESTA (estaba en riesgo de `db push`). Hueco de rol por `user_metadata` cerrado. Historial y fin de la escritura directa. 6 pruebas que fallan con la versión anterior. | No | Falta el dato: 1,931/1,931 sin costo, 116 sin clave. **Bloqueado por Compras.** |
| VH-148: concurrencia (409) | 5 | *pendiente del agente* | ver §4 | | |
| Costear motor (paridad, unidades, $0) | 7 | **8** | Paridad al centavo en vivo ($6,614.24; difícil $7,362.69). Hoja de control 6/6. 3,007 pruebas. | No | Holdout fuera de muestra no corrido (no hay datos nuevos). In-sample: MAPE 33.2 %, sesgo +18.9 %. |
| Holdout Intelisis (preparación) | 0 | **9** (preparación) | Congelamiento de 37 archivos más huellas de base de datos, `--verificar`, métricas fijadas y probadas | n/a | La medición en sí no existe; faltan de 10 a 15 reportes nuevos de Compras. |
| ERP / precios | 6 | 6 | Medido: 1,763 aprobados por QA, 30 por `reconciliacion`, 0 por personas | No | Datos de origen sin sanear; D1 sin firmar. |
| Cotizar (propuesta/emisión) | 3 | 3 | Sigue bloqueada por VH-100 | No | No depende del código. |
| Cotizar (acomodo) | 6 | **7** | APP LT 10U (6000×1200) con el solver real: 7 pruebas nuevas (cabe o no cabe por geometría, 0 encimados, 0 fuera de área); texto en singular corregido | No | C5 (fuera de cuarto) y C2 parcial siguen abiertos (MATRIZ_V3); falta reverificar con plano real. |
| Cocrear | estimado 7 | estimado 7 | sin cambios en esta operación | No | No reverificado. |
| Renders | 7 | 7 (medido) | `render_eventos`, 14 días: de 63 con veredicto QA, 43 `QA_PASS` (68 %) y 20 rechazados (`layout_match`, `geometry_match`, `extra_objects`). Otros 72 eventos sin veredicto. | No | Un tercio de los renders evaluados no coincide con el producto, aunque la compuerta lo rechaza correctamente. La fidelidad sin referencia no es certificable. |
| Council (Anthropic + Gemini) | estimado 7 | **4 (medido)** | Desde el 6-oct, Anthropic no respondió ninguna vez: `max_tokens` el 6-oct; el 13-oct se abortó a los 14 s. Su latencia real es de 29–43 s. Todo sale SINGLE_PROVIDER (Gemini). La degradación sí se etiqueta bien. | No | Defecto de configuración (presupuesto 14–22 s contra 29–43 s). Arreglarlo exige tocar la Edge de producción `voni-council`: **requiere autorización**. |
| Biblioteca / datos QA | estimado 6 | **8** | Los 80 más recientes eran todos de QA, así que los reales no aparecían. Filtro con interruptor y límite de 400. PROPUESTA de etiquetado de 154 ids exactos con 4 pruebas PGlite. | No | Etiquetado sin aplicar. |
| Seguridad (advisors) | 7 | **8** | 0 ERROR. 10 SECURITY DEFINER revisadas, todas con chequeo de rol interno. Escritura directa a la economía oficial detectada y cerrada (en PROPUESTA). | No | `qa-direccion` tiene rol `direccion` en `permitidos`: pasa `puede_certificar_costo()`. Mitigado en la Edge y en SEG-01b, no en la base. 7 funciones con `search_path` mutable. |
| Rendimiento | estimado 7 | 7 | Advisors: solo INFO (3 llaves foráneas sin índice, 13 índices sin uso) | No | Sin medición de tiempos de usuario en esta operación. |
| Pruebas (static → comportamiento) | 39 archivos STATIC GUARD | *pendiente del agente* | ver §4 | | |

**Ninguna área llega a 9.5 medida y defendible.** Las que más se acercan (estado del costo y preparación del
holdout) dependen de datos o de decisiones que no son de código.

## 3. Evidencia por gate (reproducible)

| Gate | Cómo se reproduce | Resultado |
|---|---|---|
| Suite completa | `npx vitest run --exclude '.claude/**' --exclude 'node_modules/**'` y lo mismo con `VERCEL_ENV=preview CARRIL_RC=si` | 332 archivos, 3,007 pruebas (e549839), ambos entornos |
| SEG-01b adversarial | `npx vitest run supabase/tests/seguridadGateEmisionSnapshot.test.js -t "SEG-01b"` | 15/15; 14 fallan sin la propuesta |
| VH-100 | `npx vitest run supabase/tests/cargarCostosOficiales.test.js`; con `VH100_MIG=<archivo viejo>` fallan 7 | 12/12 |
| Estado y precio exacto | `npx vitest run src/datos/autoridadCosteoServidor.test.js` | 20/20 |
| Smoke vivo | `lab/rescate/preview_link/librero_5x8_post_seg01b/` (`run.log`, `8-dto-servidor.json`) | 6/6, paridad al centavo |
| Edge RC | `scripts/edge_boot_check.sh costear-servidor-rc` y el workflow `deploy-edge.yml` run 38509149245 | arranca; despliegue OK |
| Holdout | `node scripts/congelar_holdout.mjs --verificar` | OK (37 archivos) |

## 4. Pendiente de integrar en este documento

- VH-148 fail-closed: el agente trabaja en un worktree; se integrará con su evidencia.
- Static guards → comportamiento: el agente trabaja en un worktree; se integrará con sus mutaciones probadas.

## 5. No verificable en esta operación (y por qué)

- **Primer costo VALIDADO real:** requiere que una persona de Dirección apruebe precios. La cuenta QA no puede ni
  debe hacerlo.
- **Holdout fuera de muestra:** no hay reportes nuevos de Intelisis.
- **Emisión E2E de líneas de catálogo:** bloqueada por VH-100 (dato).
- **Council con ambos proveedores:** requiere desplegar `voni-council` (producción) con otro presupuesto o modelo.
- **SEG-01b, VH-148 y VH-100 en producción:** sin autorización para aplicar.

## 6. Decisiones pendientes (de Rodrigo / Dirección / Compras / Producción)

1. Autorizar SEG-01b (y elegir: estricto, o fecha de transición `legacy_sin_costeo_hasta`; hay 27 cotizaciones con
   folio y renglones sin costeo del servidor).
2. Autorizar VH-148 y VH-100.
3. D1: vigencia de 24 meses, y firma por política o precio por precio.
4. ¿Compras puede aprobar precios, o solo Dirección?
5. Umbral de aceptación del holdout (propuesta: MAPE ≤ 10 %, sesgo ±5 %, ≥ 80 % dentro de ±10 %).
6. Council: autorizar el cambio de presupuesto o modelo de Anthropic en la Edge de producción.
7. D2: ratificación de Producción (merma de corte del tubular).
8. Etiquetar los 154 expedientes QA (PROPUESTA lista).
