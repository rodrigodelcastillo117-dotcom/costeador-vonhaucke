# Respuesta a la auditoría adversarial de ChatGPT — verificación cruzada + plan
**Fecha:** 2026-11-06 · Reproduje cada número de ChatGPT con mis propias consultas. **Su auditoría es correcta (9.5/10).** Veredicto: coincido — **GO condicionado** para piloto supervisado sin emisión automática; **NO-GO** para certificación económica integral hasta cerrar la gobernanza del dato.

## 1. Cross-check (reproducido por mí, SELECT en prod)
| Hallazgo | Número de ChatGPT | Mi reproducción |
|---|---|---|
| VH-A01 certificables sin `source_document` | 140 | **140 ✓** |
| VH-A02 insumos con >1 precio aprobado abierto | 1,673 | **1,673 ✓** |
| VH-A02 con precio distinto entre abiertos | 1,360 | **1,360 ✓** |
| VH-A02 seleccionado ≠ aprobado más reciente | 111 | **111 ✓** |
| VH-A05 `costeoEmitible` acepta $0 | sí | **sí ✓** (calculo.js: `costoCorrupto = !finite || costo<0`; el 0 pasaba) |

## 2. Donde ESTUVE EQUIVOCADO (lo concedo)
- **±2% no es defendible como afirmación general.** Mi última corrida real (tras cargar los precios del workbook) dio +2.0%/+0.8%, pero no actualicé los docs commiteados (siguen +4.8%/+3.3%) y es UN alcance, UNA corrida. ChatGPT tiene razón: hace falta UN manifiesto por proyecto.
- **El VH-A02 lo agravé yo:** la espuma quedó con **3 filas abiertas** — mi corrección $7.143/m (que la vista sí elige por ser la más nueva) y **2 filas viejas de $750/rollo, de unidad ya incorrecta, aún abiertas**. Al insertar sin cerrar las viejas (el append-only me lo impidió sin la RPC), sumé deuda.
- **"Está perfecto" fue optimismo.** Reproducir la aritmética de un BOM conocido ≠ reconstruir un mueble especial desde un plano. Lo segundo no está probado de forma independiente.

## 3. Refinamientos que encontré (matizan sin contradecir a ChatGPT)
### VH-A01 (140 sin source_document) — no todos son iguales
Muchos **SÍ tienen procedencia en el campo `fuente`**, solo que no en el campo estructurado `source_document` que exige el contrato DATA_TRUTH_V1:
- **Con procedencia real (fuente poblada):** listas Sonara 2025 (Rafa), TDC Alpura C-CO-517R (Rafa/Alba), "Compras lista 2026-08-14", "ERP última compra". Son curados; el fix es **backfillear `source_document` desde `fuente`**.
- **Genuinamente débiles (sin fuente):** los de `fuente='codigo SEMILLA sin fuente'` y `fuente='codigo=nube'` (p.ej. Acrílico 12mm $1,200, Bastidor $900, Base motorizada $5,885). **Estos NO deberían ser certificables** hasta documentarlos.

Lista completa reproducible (read-only):
```sql
select c.nombre, cv.insumo_id, cv.precio, cv.vigente_desde, p.fuente, p.creado_por
from catalogo_vigente cv join insumo_precios p on p.id=cv.precio_id join insumos_catalogo c on c.id=cv.insumo_id
where cv.certificable=true and (p.source_document is null or btrim(p.source_document)='') order by cv.precio desc;
```

### VH-A02 (111 mal seleccionados) — el grueso son melaminas, con una cola de ruido
- **Conflictos REALES (~15-20):** variantes de melamina de color y una lámina, donde un precio más viejo con confianza **'alta'** gana a uno de 2026-10-01 con **'media'**. Ejemplos: Melamina 19 Walnut (sel $914.4 2026-09-02 vs $671.95 2026-10-01, −26.5%), Lámina 3×10 cal.12 (sel $1,336.56 vs $1,116.28, −16.5%), Melamina 16 Antracite Oak (+20.8%). **Confirma el punto de ChatGPT: confianza > fecha.** Cuál es el correcto lo decide Compras — NO voltear al más nuevo a ciegas.
- **Ruido (~resto):** delta ≈ $0.00 (el mismo precio guardado con decimales distintos en dos filas abiertas). No son conflictos de dinero; son higiene de datos.

Lista completa reproducible (read-only):
```sql
with latest as (select distinct on (insumo_id) insumo_id, id lid, precio lp, vigente_desde lf
  from insumo_precios where estado='aprobado' and vigente_hasta is null
  order by insumo_id, vigente_desde desc nulls last, id desc)
select c.nombre, cv.insumo_id, cv.precio sel, cv.vigente_desde sel_f, l.lp reciente, l.lf reciente_f,
  round((l.lp-cv.precio)::numeric,2) delta
from catalogo_vigente cv join latest l on l.insumo_id=cv.insumo_id join insumos_catalogo c on c.id=cv.insumo_id
where cv.precio_id<>l.lid order by abs(l.lp-cv.precio) desc;
```

## 4. Lo que YA arreglé (tightening fail-closed, en dev — sin desplegar)
**VH-A05:** `costeoEmitible` ahora rechaza costo **≤ 0** (antes el 0 pasaba como emitible). 128/128 gates + 4 tests nuevos verdes. Alinea cliente y servidor. Commit en `claude/costing-app-architecture-psf02g`.

## 5. Gobernanza de precios (VH-A01/A02) — PROPUESTA, NO APLICADA
No la ejecuto a ciegas porque (a) los 111 conflictos necesitan criterio de Compras y (b) cambia la semántica de "certificado" en prod. Ver `lab/datos_reales_drive/PROPUESTA_gobernanza_precios.sql`. En resumen:
1. **Exigir `source_document` estructurado para certificar** (o excepción humana auditable). Backfill desde `fuente` donde haya procedencia real; marcar SEMILLA/nube como pendiente-de-documento.
2. **Cerrar filas superseded**, empezando por las 2 de espuma $750/rollo (basura de unidad que yo dejé abierta).
3. **Definir precedencia formal**: para igual insumo, fecha de compra manda sobre confianza histórica, salvo excepción documentada. Auditar los ~15-20 conflictos de melamina con Compras ANTES de voltear precios.
4. **Versionar el motor por hash** (VH-A03) de reglas+parámetros+fórmula, para que un cambio de herrajes no quede con la misma etiqueta `2026-10-14b`.

## 6. Veredicto (coincido con ChatGPT)
- Piloto supervisado, sin emisión comercial automática → **GO condicionado**.
- Costos oficiales automáticos de muebles especiales / certificación integral → **NO-GO** hasta cerrar §5.
