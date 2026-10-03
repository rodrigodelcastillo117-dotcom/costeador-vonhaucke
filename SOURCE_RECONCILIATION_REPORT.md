# SOURCE RECONCILIATION REPORT — costo de insumos · 2026-10-04

> Previo a CUALQUIER cutover del resolver de costo. Compara las 3 fuentes y clasifica
> cada divergencia. **Regla dura: lo UNKNOWN/conflicto NO migra automáticamente.**
> Datos reales de la BD de producción (Supabase mtuvnbgljwbsaizjjgzs), read-only.

## Fuentes
- **SEED** (`INSUMOS_SEMILLA`, código): lo que usan los **tests**. 254 insumos.
- **CONFIG** (`config.datos.insumos`, BD nube): lo que usa el **app LIVE** (overlay de precio sobre el seed). 92 insumos.
- **CATÁLOGO** (`catalogo_vigente`, BD): capa de **reconciliación con estados y evidencia**. 254 insumos.
- Todos los insumos de CONFIG (92) existen en CATÁLOGO y en SEED (config ⊂ seed por id).

## Clasificación de los 92 insumos CONFIG∩CATÁLOGO
| Clasificación | n | Acción |
|---|---|---|
| **SAME_PRICE_CERTIFIED** (aprobado+certificable, config=catálogo) | 30 | ✅ Autoritativo. El resolver y el vivo coinciden. Migrable sin cambio. |
| **PRICE_CONFLICT_NO_EVIDENCE** (código vs nube, ninguno con fuente) | 42 | ⛔ NO migrar. Requiere evidencia de Compras. |
| **UNIT_MISMATCH** (unidad distinta entre config y catálogo) | 8 | 🔴 CRÍTICO. Precio en unidad distinta = costo equivocado. Compras. |
| **PRICE_PENDING_UNIT_OK** (unidad aprobada, precio pendiente) | 7 | ⛔ NO migrar. Precio por certificar. |
| OTHER | 5 | Revisar caso a caso. |

## 🔴 UNIT_MISMATCH (8) — lo más peligroso (costo en unidad equivocada)
El config cobra por **m²/par**, el catálogo por **hoja/juego**. Si el motor trata el número
como por-m² pero es por-hoja, el costo sale mal. **Decisión de Compras (qué unidad/precio es el real):**

| insumo | config | catálogo |
|---|---|---|
| chapa-madera | $850 / m² | $540 / hoja |
| corredera | $95 / par | $70 / juego |
| divisor-melamina | $320 / m² | $665 / hoja |
| faldon-melamina | $320 / m² | $665 / hoja |
| laminado (HPL) | $420 / m² | $405.6 / hoja |
| mdf | $210 / m² | $437 / hoja |
| melamina-19 | $320 / m² | $544 / hoja |
| membrana-pvc | $260 / m² | $700 / hoja |

## 🟠 PRICE_PENDING_UNIT_OK (7) — unidad OK, precio sin certificar
Lámina de acero e inoxidable. **Las unidades COINCIDEN (kg=kg)**, pero el precio difiere por
orden de magnitud. ⚠️ **El valor del SEED es físicamente imposible** ($2,270/kg de acero;
el acero ronda $20–40/kg), así que aquí el valor de **nube (~$33/kg) parece el correcto** y el
**seed/código está mal** — lo contrario de "el código documentado es la verdad". Ninguno
está certificado; el catálogo los marca "PRECIO pendiente".

| insumo | seed/código | nube/config | unidad |
|---|---|---|---|
| lamina-10 | $2,270.17 | $33 | kg |
| lamina-12 | $1,336.56 | $33 | kg |
| lamina-14 | $816.48 | $33 | kg |
| lamina-18 | $571.54 | $34 | kg |
| lamina-20 | $455.82 | $32 | kg |
| lamina-22 | $378.78 | $33 | kg |
| inoxidable | $1,930 | $135 | kg |

**Implicación para los golden:** si algún producto golden usa lámina/inoxidable, su costo de
test (seed) está inflado hasta 68×. Por eso el "golden al centavo" es un **GOLDEN ENGINE** (prueba
la fórmula con el seed), **no** una reproducción del costo real. Marcado así en `sourceParity.test.js`.

## 🟡 PRICE_CONFLICT_NO_EVIDENCE (42) — código vs nube, sin fuente
Ejemplos (unidad coincide; sólo difiere el precio, ambos sin respaldo):
ducto (código 17.68 vs nube 180 /m), pasacables (6.3 vs 35 /pza), bisagra (19 vs 85 /pza),
remate-aluminio (24.6 vs 95 /m), ecopiel (90 vs 340 /m), rodaja (78 vs 22 /pza),
piel-napa (550 vs 1900 /m²), frente-metal (153.6 vs 520 /m²), tela (95 vs 280 /m), ptr-10/12…
**Ninguno migra hasta que Compras elija y documente.**

## Reglas de cutover (vinculantes)
1. Sólo **SAME_PRICE_CERTIFIED (30)** es elegible para que el resolver sea autoridad hoy
   (coincide con el vivo → cero cambio de precio).
2. UNIT_MISMATCH, PRICE_PENDING, CONFLICT, UNKNOWN: **nunca** migran automáticamente.
3. El resolver ya devuelve el **estado** por insumo (CERTIFICADO/PRELIMINAR/PROPUESTO/…);
   la UI de Dirección y Voni deben mostrar "costo no certificado" para los no-certificados.
4. Nada de esto cambia precios por sí solo: es diagnóstico + gobierno. La decisión de qué
   precio/unidad es el oficial es de **Compras** (BLOCKED_EXTERNALLY).

## Estado (taxonomía estricta)
- SOURCE PARITY test: **BUILT · TESTED** (CI).
- `resolver_costo_insumo()`: **BUILT · TESTED (SQL) · PROD_DB additive migration applied**. NO `SHADOW_VERIFIED` en tráfico real, NO `CUTOVER_COMPLETE`.
- Cutover de costo: **BLOCKED_EXTERNALLY** (Compras debe certificar 224 precios; 62 en conflicto).
