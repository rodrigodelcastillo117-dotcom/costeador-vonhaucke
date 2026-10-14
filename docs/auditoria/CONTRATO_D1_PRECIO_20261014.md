# Contrato D1 · precio real vs. precio vigente para costeo oficial (14-oct-2026)

## Por qué existe este documento

Rodrigo pidió que ningún costo marque INCOMPLETO "porque ya tienes el precio de compra real, auténtico".

Tiene razón a medias:

- **Correcto:** el **importe** es real. Es la última compra registrada en Intelisis, con documento y fecha. El
  costo se calcula con él y aparece al centavo en pantalla y en el servidor. Desde OP9.5-04, un material propuesto
  con precio real ya **no** marca "incompleto": marca "preliminar" con sus motivos. En el smoke del librero 5×8
  (expediente 159) el servidor pasó de `incompleto` sin motivos a `preliminar` con 5 motivos.
- **Incorrecto:** "real" no es lo mismo que "aprobado para costeo oficial". Ninguno de los 1,793 precios aprobados
  en producción lo aprobó una persona: 1,763 los aprobó `qa-direccion@vonhaucke.mx` y 30 el proceso
  `reconciliacion`. Un costo con esos precios es **real pero no validado**. Por eso dice PRELIMINAR, no BLOQUEADO
  ni INCOMPLETO.
- **INCOMPLETO** solo queda cuando falta de verdad un dato para calcular (material, precio, tarifa o costo no
  finito), y siempre nombra la pieza.

## Las dos cosas que la app distingue

| Concepto | Qué es | Dónde vive | Quién lo establece |
|---|---|---|---|
| **PRECIO_REAL** | Importe de la última compra en Intelisis, con documento (`source_document`), fecha (`vigente_desde`) y unidad. | `insumo_precios` (append-only: importe, unidad y procedencia son inmutables) | La carga ERP (VH-088 y VH-147) |
| **PRECIO_VIGENTE_PARA_COSTEO_OFICIAL** | El mismo `insumo_precios.id`, **aprobado por una persona de Dirección** con nombre y fecha, dentro de la vigencia que firme D1. | `insumo_precios.estado='aprobado'`, `approved_by` y `approved_at`, escritos solo vía la RPC de producción `aprobar_precio(p_precio_id)` | Dirección (rol `direccion` en `permitidos`), nunca una cuenta de `cuentas_no_humanas` |

### Trazabilidad por costeo (P1-03)

Ya está en la Edge RC (`costear-servidor-rc`, commit 6d1cd13) y en el registro `costeos_servidor.precios`, que
existirá al aplicar SEG-01c. Por cada insumo usado registra:

- `insumo_id`, `precio_usado` y `unidad`;
- `precio_id`: la misma fila que elige la vista `catalogo_vigente`;
- `precio`, `estado`, `approved_by` y `rol_aprobador`;
- `approved_at` y `source_document`;
- `humana` y `motivo`.

Reglas, todas probadas en `src/datos/autoridadCosteoServidor.test.js`:

1. El precio que usó el motor debe ser **al centavo** el de la fila aprobada. Si no, no cuenta.
2. Un empate entre precios vigentes distintos es ambiguo y no cuenta. Hay uno real: `lamina-3x10-14`, filas
   273/281/287, en estado propuesto.
3. El aprobador debe estar en `permitidos` con rol `direccion` y **no** estar en `cuentas_no_humanas`. Esto
   reemplaza la regex por e-mail, que aceptaba a cualquier vendedor.
4. Sin la tabla `cuentas_no_humanas`, ninguna aprobación se cuenta como humana (fail-closed).
5. `certificado` exige aprobación humana de **todos** los precios usados. Si falta alguna, el estado queda en
   `preliminar` con el motivo.

### Cómo llega un costo a VALIDADO (nuevo en la app)

Cuando el costo no está bloqueado, Costear muestra a Dirección "Revisar con el servidor los precios usados". La
lista trae, por precio, el insumo, el importe, la unidad, el documento y por qué la aprobación no cuenta. El botón
"Aprobar N precio(s) como Dirección" llama a `aprobar_precio` con el **id exacto** del precio, y después revalida
con el servidor.

No ofrece aprobar un precio que no coincide con el usado, un empate ni un insumo sin precio: eso lo resuelve
Compras.

**No verificado en vivo:** aprobar un precio real requiere una persona de Dirección real. La cuenta QA no puede ni
debe hacerlo, por instrucción de Rodrigo. El primer VALIDADO de verdad lo produce Rodrigo con su cuenta.

## Lo que sigue fail-closed hasta que Dirección decida

| Decisión pendiente | Efecto mientras no se tome |
|---|---|
| **D1 · vigencia:** ¿la última compra de Intelisis de ≤ 24 meses, con documento, cuenta como precio vigente? (`PROPUESTA_vh147`, no aplicada) | Los precios de más de 24 meses se calculan, pero no se ofrecen como vigentes certificables. |
| **D1-b · ¿firma por política o precio por precio?** Firmar la política V1 una vez, o aprobar los ~1,660 precios ERP uno por uno. | Hoy solo existe la aprobación precio por precio, ahora con botón. La aprobación por política requiere SQL nuevo y autorización. |
| **¿Quién más puede aprobar precios?** (Compras) | Solo `direccion` (`ROLES_APROBADORES_PRECIO`; la RPC de producción usa `puede_certificar_costo()`, que también es solo `direccion`). |
| **Re-aprobación de precios de la cuenta QA** | `aprobar_precio` sobrescribe `approved_by`, así que se pierde que antes lo aprobó la cuenta QA. Para conservarlo hace falta una tabla de historial de aprobaciones (no incluida, decisión pendiente). |
| **Aplicar SEG-01c** (crea `cuentas_no_humanas` y `costeos_servidor`) | Sin esa tabla, ninguna aprobación cuenta como humana, ni siquiera la de Rodrigo: el servidor no puede descartar la cuenta QA. |

**Orden mínimo para el primer costo VALIDADO real:**

1. Rodrigo autoriza SEG-01c.
2. Rodrigo, con su cuenta, aprueba los precios exactos de un mueble.
3. El servidor devuelve `certificado` con `aprobacionHumana=true`.
4. La pantalla dice COSTO VALIDADO, siempre que no haya otros supuestos: D2 sin ratificar, tornillería genérica o
   piezas inferidas.
