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

### Defecto 2 — "huecos" de precio: NO es que falte el precio, está ESCONDIDO (corregido 2026-11-06)
Verificado tras el reto de Dirección ("¿de verdad no tenemos esos precios?"). De los 11 "huecos":
- **5 SÍ tienen precio CERTIFICADO** pero su insumo está **`activo=false`** → el view `catalogo_vigente`
  los esconde y el motor no los ve (cerradura cam lock $320, jaladera $79, pivote $450, kit ilum, cristal).
  **No faltaba el precio: el insumo estaba apagado.** (El re-costeo lo marcó "sin precio" = imprecisión mía.)
- **2 genéricos** (aglomerado `MVLMAG01280600`: 32 opciones $677–718; pintura `MVLQPP00000000`: 89 opciones)
  — la familia está totalmente costeada; sólo faltaba la OPCIÓN de color exacta (B721 / A550). Precio base conocido.
- **3 sí faltan como SKU** (lámina cal.14 `MVLSLA05260202`, cal.20 `MVLSLA05260502`, placa alum `MVLEPL0408C8A6`)
  — pero su precio está en el workbook ($849.50, $449.06…) y en las fuentes crudas. Falta CREARLOS como insumo.

**Escala del problema (catálogo completo): 1,108 insumos ERP con precio CERTIFICADO están `activo=false`**
→ invisibles para el motor. PERO matiz honesto: **935 (84%) no se compran desde antes de 2020** (descontinuados
de verdad; surfacear su precio de hace 6+ años sería peor que el hueco). Sólo ~9 tienen compra 2025-26 y ~18
desde 2024. **El fix NO es reactivar 1,108 — es quirúrgico:** reactivar los que aparecen en BOMs reales actuales
/ compras recientes, crear los 2-3 SKU faltantes, y (opción de motor) usar un precio certificado-pero-inactivo con
bandera "revisar" en vez de omitirlo en silencio. Esto conecta con P0-01 (parte de las "partidas sin costo" es
visibilidad, no dato faltante).

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
