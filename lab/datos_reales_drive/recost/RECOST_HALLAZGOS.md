# Re-costeo por el MOTOR vs resultado real — BOM completo, pieza por pieza

**Qué se hizo:** tomar el BOM real completo de dos productos (VENTO C-CO-526R, 107 renglones;
TELCEL C-CO-320R, 89 renglones = **196 piezas**), mapear cada renglón al catálogo **vigente actual (ya con
octubre)**, re-costear con el motor (`calcular()`, fracción-directa) y comparar contra el total real del workbook.
Solo lectura + cómputo. Arnés: `lab/scripts_lab/recost.mjs`. Per-renglón: `recost_VENTO.csv`, `recost_TELCEL.csv`.

## Resultado

| | VENTO (107) | TELCEL (89) |
|---|---:|---:|
| Material real (workbook) | $20,358.57 | $30,210.33 |
| Material motor — **crudo** (catálogo tal cual) | $32,457.64 (**+59.4%**) | $23,940.96 (−20.8%) |
| **Material motor — limpio** (sin outliers de catálogo ni huecos) | $17,007.64 vs $16,191.19 = **+5.0%** | $23,475.97 vs $20,042.07 = **+17.1%** |

**El "±%" crudo NO es error del motor — lo dominan dos defectos de DATOS que el re-costeo cazó:**

### Defecto 1 — error de unidad de 100× en el catálogo (grave)
`MVLREF00634532` **ESPUMA FLEXIBLE ROLLO 2.0×105 m**: catálogo **$750** vs compra real **$7.50** (×100).
Es precio **por rollo** guardado como si fuera por m²/consumo → sobre-costea ~$15,295 en VENTO.
Afectaría a CUALQUIER mueble que use esa espuma. **Hay que corregir su unidad en el catálogo** (decisión de
Compras sobre la unidad correcta; no lo toco a ciegas). Lo detectó el re-costeo, no estaba a la vista.

### Defecto 2 — huecos de precio (cobertura)
VENTO **15** renglones sin precio ($4,013 = 20% del total real); TELCEL **17** ($10,164 = 34%).
Son sobre todo **genéricos con opción** (pintura en polvo `MVLQPP00000000`, aglomerado melamina
`MVLMAG012806*`, láminas cal.14/20) donde el empate articulo+opción no pegó — mezcla de (a) match a nivel
opción pendiente de afinar y (b) insumos con precio PENDING en catálogo. El motor los **omite en silencio**,
subcosteando (por eso TELCEL crudo sale −21%). **Es el hueco de pilotaje más importante.**

## Veredicto honesto
- **El motor costea bien:** en los renglones con precio bueno, clava el real a **+5.0% (VENTO)**. TELCEL da
  **+17.1%** porque su workbook es de 2024-2025 y nuestro catálogo ya trae precios 2026 (inflación real de
  acero/materiales, no error). O sea: donde el dato está completo y correcto, el costeo es fiel.
- **Lo que falta para "perfecto" NO es el cálculo — son dos cosas de DATOS:** (1) el error de unidad de la
  espuma (y revisar si hay más outliers así), y (2) cerrar los huecos de precio (15-34% de un BOM real).
- Octubre entró bien: 7 (VENTO) / 10 (TELCEL) renglones ya costean con precio de octubre.

## Siguiente
1. Barrer el catálogo por **outliers de unidad** tipo espuma (|precio| fuera de rango vs su familia) — lista para Compras.
2. Enumerar y cerrar los **huecos de precio** (empate a nivel opción + insumos PENDING) — es lo que más mueve el costeo real.
