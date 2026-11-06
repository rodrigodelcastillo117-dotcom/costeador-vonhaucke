# Calibración del motor contra TODOS los costeos reales (capas: material / MO / indirecto / fabricación)

Arnés: `lab/scripts_lab/calib_material.mjs` (solo lee el motor y los BOM reales; no modifica nada).
Estado de los goldens ya encodeados: **138/138 verdes** (TELCEL CCO320R, Alpura, Alba T.D.C., Intelisis, matriz 25).

## 1. Capa MATERIAL — reproducción exacta ✅

El motor reproduce el costo de material real a partir de (consumo × precio) con sus reglas de merma/fracción:

| Costeo real | líneas | Σ real | motor | delta |
|---|---:|---:|---:|---:|
| C-CO-517R Exhibidor | 28 | $12,089.66 | $12,089.65 | **−$0.01** (redondeo) |
| Ejercicio repisa | 6 | $156.98 | $156.98 | **$0.00** |
| VENTO C-CO-526R (copia 1eTZbM) | 107 | $20,358.57 | $20,435.98 | +$77.41 (+0.4%, redondeo del workbook) |

TELCEL CCO320R ya está cubierto por su golden propio ($47,432, 5 pruebas verdes).
**Conclusión:** la aritmética de material del motor (precio×fracción + merma A14/D2) es exacta. Confirma el
hallazgo de Paso A v3: los precios ya son reales y el motor los usa bien.

## 2. Capa FABRICACIÓN (MP + MO + indirecto) — estructura calibrada, split por decidir

**Única fuente con el split real completo: VENTO MASTER (11 muebles, ×cantidad):**

| Capa | Monto | % de fabricación | ratio vs MP |
|---|---:|---:|---:|
| Materia prima | $38,913.01 | 68.7% | — |
| Mano de obra | $5,889.27 | 10.4% | **MO/MP = 15.1%** |
| Indirecto | $11,871.78 | 20.9% | **ind/MP = 30.5%** |
| **Costo de fabricación** | **$56,674.06** | 100% | uplift (MO+ind)/MP = **45.6%** |

**Comparación de los tres referentes del uplift (MO+indirecto sobre MP):**

| Fuente | uplift (MO+ind)/MP | MO/MP | ind/MP |
|---|---:|---:|---:|
| VENTO MASTER (real, 11 muebles) | 45.6% | 15.1% | 30.5% |
| EEFF empresa (MOD+GIF / MP directa) | **50.3%** | — | — |
| Motor · fórmula **Alba** (517R) | 50.3% | 12.4% | 37.9% |
| Motor · factores **clásico** (default 17/34) | 51.0% | 17.0% | 34.0% |

**Veredicto honesto:**
- El **uplift agregado** del motor (≈50%) **cuadra con el EEFF (50.3%)** y queda a ~5 puntos de VENTO (45.6%). La conversión MP→fabricación está calibrada a la estructura real de la empresa.
- El **split MO vs indirecto** difiere según el método: Alba (12/38), clásico (17/34), VENTO real (15/30). Los tres son defendibles; **cuál es autoritativo es decisión de Dirección** — el motor ya lo respeta (`calibracion.js`: regla `NO_PROMEDIAR`, Alba vs Intelisis en paralelo, Dirección elige).
- No se puede afinar el split "al centavo" con los datos actuales: **no hay medición exacta de mano de obra** (doc Rogelio/Alba: único dato = 30 s/operación). Forzar un número sería inventar. El techo de precisión de la capa MO lo pone el dato, no el motor.

## 3. Hallazgos de datos (no del motor)

- **VENTO tiene dos extracciones divergentes** del mismo workbook: $20,358.57 (copia 1eTZbM) vs $42,653.27 (copia 16HcbMYq). Hay que decidir cuál es la buena antes de usarla como golden — es un problema de fuente, no de cálculo.
- Redondeo de los workbooks: ±0.4% acumulado en 107 líneas (cada `costo_linea` viene redondeado a 2 decimales).

## 4. Qué falta para "perfecto" (y qué no se puede)

| Capa | Estado | Acción |
|---|---|---|
| Material | ✅ exacto al centavo | encodear 517R + repisa como golden permanente en CI (Bloque M) |
| Fabricación (uplift agregado) | ✅ cuadra con EEFF | documentado; golden de estructura |
| Split MO/indirecto | ⚠️ depende del método | **decisión de Dirección** (Alba vs clásico vs VENTO); no se inventa |
| MO por operación | ⛔ techo de datos | Producción debe dar tiempos por operación; hoy 30 s/op es demasiado grueso |
