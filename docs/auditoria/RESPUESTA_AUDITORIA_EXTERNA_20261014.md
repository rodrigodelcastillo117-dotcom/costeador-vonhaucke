# Respuesta a la auditoría externa del 14-oct-2026 (rango 961c42e → e77d6d4)

La escribe la IA implementadora. Primero se verificó cada hallazgo contra el código, y solo después se corrigió.
Todo vive en la rama `claude/costing-app-architecture-psf02g` y en las Edge Functions `-rc`. **Producción no se tocó.**

## Estado por hallazgo

| # | Hallazgo | ¿Se confirmó? | Estado | Evidencia |
|---|---|---|---|---|
| P0-01/02/03 | SEG-01, VH-148, VH-100 | — | **Abiertos**. Requieren autorización de producción. | — |
| P1-01 | `material_confirmado` hacía dos trabajos | Sí | Corregido. Nuevo campo `pieza_confirmada`, usado en la pantalla, en las especialidades y en el servidor (con capability). Botón "Sí lleva esta pieza". | `auditoriaExterna20261014.test.js`, `especialidades.test.js` |
| P1-02 | Servidor `incompleto` → la pantalla decía PRELIMINAR | Sí | Corregido. El servidor manda: `incompleto`, `bloqueado` o un estado desconocido → BLOQUEADO, con las advertencias del servidor. | ídem |
| P1-03 | Aprobación humana no ligada al precio exacto | Sí | **Abierto**. Requiere ligar `insumo_precio_id` al snapshot y una política firmada (D1). Hoy nada llega a VALIDADO. | — |
| P1-04 | D2: el documento decía "pendiente" y el código "firmado" | Sí | Corregido el registro. Dirección firmó D2 y D3 el 13-oct; Producción no. Con D2 sin ratificar, un costo con tubular por fracción **no puede salir VALIDADO**. | `DECISIONES_DIRECCION_COSTEAR_20261013.md`, prueba D2 |
| P1-05 | El preview escribe en la base real | Sí | Mitigado, no aislado. Lo que se guarda desde el carril RC lleva "PRUEBA RC ·" y la etiqueta `prueba-rc`; verificado en el link. Los 136 expedientes del 13-oct siguen ahí, a la espera de que Dirección decida. | `run.log` de ATCUBS45ABS_postauditoria |
| P1-06 | Un artifact de preview promovido conservaría el modo RC | Sí | Corregido. Además de la bandera de build, se exige estar en una URL `*-rodrigos-eurotrip.vercel.app`; en el dominio de producción se apaga solo. | `carrilRcActivo` |
| P1-07 | Una cubierta suelta se bloqueaba por "falta la base" | Sí | Corregido y verificado de punta a punta en el link (ATCUBS45ABS). | `lab/rescate/preview_link/ATCUBS45ABS_v2` |
| P2-01 | Las hermanas heredaban la confirmación humana | Sí | Corregido. Quedan como "propuesta por confirmar" y registran `propagado_desde`. | prueba P2-01 |
| P2-02 | Regex `herraje_soporte` demasiado abierta | Parcial | **Abierto**. Falta medirla contra los 10,964 artículos del ERP. | — |
| P2-03 | `medidasDe` tomaba los primeros tres números | Sí | Corregido. Ahora usa un patrón dimensional (A x B x C, en cm o m). | prueba P2-03 |
| P2-04 | Pruebas de `carrilRc` que solo comparan texto | Sí | Reemplazadas por pruebas de comportamiento (`carrilRcActivo` con distintos hostnames). | ídem |
| P2-05 | Una regex sobre los imports no prueba que la función arranque | Sí | `scripts/edge_boot_check.sh` levanta la Edge en Deno. Con la importación duplicada que tumbó la RC dice "NO ARRANCA"; con la versión actual, "ARRANCA". | — |
| P2-06 | `resultadoIngenieria`/`resultadoCostos` no se usan en el flujo | Sí | **Abierto**. Se conectará en la Entrega 2. | — |
| P2-07 | Prueba de exclusión que solo compara texto | Sí | **Abierto**. | — |
| P2-08 | Riesgo de rollback en `vh146` | Sí | Corregido en `PROPUESTA_vh146b` (sin aplicar). Ver la sección siguiente. | `formatoHojasErpVh146b.test.js` (PGlite) |

## Defectos nuevos encontrados al repetir el caso de la auditoría en el link

1. **Descuadre entre pantalla y servidor en el canto.** La pantalla daba $1,068.48 y el servidor $1,089.73, por dos causas:
   - Mi corrección VH-182 leía "32 x 2 mm" como 2 mm.
   - El servidor le asignaba "Tapacanto PVC" por su cuenta a una pieza que llegó sin material.

   Corregidos los dos. Ahora cuadra al centavo: $1,307.29 en ambos lados. Este descuadre ya aparecía en r2 (ATCUBS44ABS) y no lo había investigado.
2. **Una pieza sin material dejaba el costo en PRELIMINAR**, con $0 en el total. Ahora bloquea.

## vh146b (no aplicada)

| Condición del auditor | Cómo quedó |
|---|---|
| Solo 4×8/5×8 explícito | Sí. Se quitaron los respaldos por decimales. |
| Acrílico | Fuera (16 filas). |
| Lista congelada | Sí, se respalda con nombre y familia. |
| UPDATE con re-verificación | Sí: familia, unidad, nombre y "sin formato". |
| Todo en una transacción | Sí. Si la cuenta no es **231**, aborta. |
| AME28152 | Se verifica que quede como 5×8 (1525×2440). |
| Precios | Se comparan las huellas antes y después. La prueba en PGlite no tiene filas de precio, así que esa verificación **no se ejerció**. |
| Rollback | Solo restaura las filas que siguen exactamente como las dejó la migración. |

La cuenta de candidatos se midió en producción (solo lectura): 247 = 215 de 4×8 + 32 de 5×8. Coincide con la del auditor.

## Pruebas

- vitest 2,954/2,954, en el entorno normal y simulando el entorno de Vercel (`VERCEL_ENV=preview CARRIL_RC=si`).
- Las pruebas nuevas **fallan con el código anterior**: 10 de 15 en la primera tanda y 3 de 3 en la de paridad. Las demás son protecciones de regresión.

## Errores propios en esta ronda

- Dos builds del link fallaron porque no corrí la suite simulando el entorno de Vercel.
- Un `pkill -f` mató mi propia sesión de shell y dejó un archivo modificado. Lo restauré antes de hacer commit.

---

## Reauditoría (14-oct, tarde): vh146b → vh146c y posible P1 de D2

### `PROPUESTA_vh146c_formato_hojas_erp.sql` (sin aplicar; sustituye a vh146 y vh146b; vh146b eliminada)

| Gate pedido | Cómo quedó | Prueba (`supabase/tests/formatoHojasErpVh146c.test.js`, PGlite, datos reales) |
|---|---|---|
| Manifest exacto | 231 pares `(id, formato)` escritos en el SQL. Huella md5 `399f4b969536318069dd28459b79a13b`, la misma que se midió en producción en solo lectura. Antes del UPDATE se exige que la huella cuadre, que cada id siga como se auditó y que los candidatos vivos sean exactamente el manifest. | 231/231 ids exactos, 200 de 4×8 y 31 de 5×8. Abortos con 0 cambios en tres casos: un candidato nuevo, una fila que ya cambió y un manifest alterado. |
| `fraccion=true` | Se conserva. | Verificado en las 231. |
| No escribir `mermaCorte` | Conserva la merma original; la propia migración lo verifica. | Si se reintroduce `mermaCorte=6`, la migración aborta sola. |
| Precios reales | El fixture trae 6 filas reales de `insumo_precios` (AME28152-b709, AME1648, MDF18H, LP48BLACK y otras). | Idénticas fila por fila después de la migración. |
| One-shot | Si existe `respaldo_vh146c_atributos`, aborta. `atributos_despues` se escribe una sola vez. | Una segunda ejecución aborta con 0 cambios. |
| AME28152 por id | Se verifica `erp-ame28152-b709` (Walnut, el del librero). | 1525×2440. |
| 0 filas fuera del manifest | Huellas de las filas fuera del manifest, y de las demás columnas en las 231. | 0 modificadas, incluidos los 16 acrílicos. |
| Rollback inmediato | Líneas `-- RB`. Solo restaura las filas que siguen igual a como las dejó la migración. | Byte a byte. |
| Librero 5×8 | — | Con la hoja que devuelve `catalogo_motor` tras la migración: ya no bloquea por formato y cliente y servidor cuadran al centavo. Es la reconciliación y el motor de `costear-servidor-rc` corridos en Node; **la prueba en vivo solo es posible tras aplicar.** |

Fixture: `supabase/tests/fixtures/vh146c_catalogo_real_20261014.json` (253 filas del catálogo y 6 precios, leídos en solo lectura con la cuenta QA).

### Posible P1 de D2: **confirmado y corregido en RC**

- **Cadena real.** El servidor podía devolver `certificado` con tubular cobrado por fracción (D2). Ese estado viajaba tal cual:
  - al renglón de Cotizar (`App.jsx`, `costoEstado: autoridad.estado`);
  - al expediente (`estado_costo`, y la Biblioteca lo mostraba como "· certificado").

  La emisión, tanto la local como el SQL de producción, solo frena `preliminar`, `incompleto` o `bloqueado`.
- **Latente hoy**: ningún precio tiene aprobación humana, así que el servidor nunca dice `certificado`. Con D1 firmada habría ocurrido.
- **Corrección**:
  - `src/datos/topeEstadoCosteo.js` define `D2_RATIFICADA_POR_PRODUCCION = false`, una sola bandera para la pantalla y el servidor;
  - `costear-servidor-rc` topa en `preliminar` cualquier costo con D2. Como también es la ruta de registro de Cocrear, la cubre igual.
- **Prueba** (`supabase/tests/seguridadGateEmisionSnapshot.test.js`, con el SQL EXACTO de producción, md5 verificado):
  - con el estado que entrega el servidor tras el tope, `evaluar_emision_cotizacion` da `ECONOMICS_INCOMPLETE` (`linea_1_costo_preliminar_no_certificado`);
  - control: el mismo renglón marcado `certificado` pasa. Eso demuestra que el tope tiene que vivir en el servidor.
- **Fuera de alcance, sigue abierto**: el `costoEstado` del renglón lo escribe el cliente al guardar la cotización. Atar el estado al costeo persistido es SEG-01 (P0 heredado).
