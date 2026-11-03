# COSTEAR 100 · FASE 21 — VONI ingeniería de valor (segundo cerebro) · 2026-11-03

## Qué se construyó
`src/datos/ingenieriaValor.js` — el **Cerebro 2**. Mientras el Cerebro 1 calcula lo que cuesta el diseño original,
VONI analiza el producto y **propone mejoras** (menos desperdicio, mejor fabricación, menos piezas/operaciones,
sustitución de material). **No cambia el diseño ni el costo original**; las versiones coexisten. Se compone sobre
subsistemas + routing (no es motor paralelo).

### Oportunidades v1
| Regla | Categoría | ¿Requiere Ingeniería? | Ahorro |
|---|---|---|---|
| `reducir_soldaduras` | fabricación | **sí** (afecta rigidez) | hipótesis |
| `nesting_tableros` | material | no | hipótesis |
| `estandarizar_repetidas` | diseño | no | hipótesis (señal factual: N repeticiones) |
| `material_durabilidad` (MDF con laca → HPL) | material | no, pide confirmación | **null** (es calidad, puede costar MÁS) |
| `fabricacion_lote` | fabricación | no | hipótesis |

Además, `resumen.palanca_de_costo`: con costos cargados, identifica **dónde se concentra el material** (participación
CALCULADA real, no un ahorro) para enfocar el esfuerzo de ingeniería de valor.

### Honestidad (directiva FASE 21, textual)
- "No confundas una propuesta más barata con una propuesta mejor." → `material_durabilidad` se presenta como mejora de
  **calidad** con ahorro `null` (puede costar más).
- "Si el impacto es desconocido, presenta una hipótesis, no un ahorro inventado." → todo `ahorro` es `null`,
  `{fuente:'HIPOTESIS', base}` (sin monto), o `{fuente:'CALCULADO', monto}` **sólo** con datos reales de antes/después.
  Hoy, sin datos de corte/tiempos/precios alternativos: **ahorros con monto calculado = 0**; el resumen lo declara.
- Cambios estructurales (reducir soldaduras) → `requiere_validacion_ingenieria: true`. VONI propone; Ingeniería valida.
- No cambia el diseño ni el costo original.

## Validación (RED→GREEN): `ingenieriaValor.test.js`, 9/9
- Cada regla dispara con su entrada; ningún ahorro HIPÓTESIS trae monto; `ahorros_calculados=0`.
- `palanca_de_costo` identifica el subsistema dominante con costos reales (estructura 80%+ en un caso); null sin costos.
- Módulo REAL TELCEL: la **pintura en polvo del metal NO dispara** "MDF→HPL" (es acabado del acero, no del MDF);
  sí propone evaluar uniones soldadas (4 láminas).

## UX (FASE 21 §9)
Panel **"¿Qué mejoraría VONI?"** en COSTEAR: tarjetas con mejora, por qué, beneficio, riesgo, ahorro (hipótesis o
calculado) y si requiere Ingeniería; más la palanca de costo. Sin pantalla interminable. Build OK; 20 pruebas verdes.

## Estado
Los **dos cerebros** de COSTEAR ya existen: Cerebro 1 (precisión industrial: subsistemas + routing + omisiones +
materiales) y Cerebro 2 (ingeniería de valor). Para que VONI dé ahorros **calculados** (no hipótesis) faltan los datos
de corte/tiempos/precios alternativos — mismo gating que el resto (integración de fábrica).

## Mejora 2026-11-03 (segunda iteración, autorizada "mejorías en VONI")
- **Versiones A/B/C** (FASE 21 §6): las oportunidades se agrupan en **A** (Original, referencia), **B** (Optimización
  económica: reducir soldaduras, nesting, estandarizar, lote, consolidar materiales) y **C** (Optimización de
  calidad/fabricación: sustitución por durabilidad, modularizar). El panel de COSTEAR las muestra por versión.
- **2 reglas nuevas** (deterministas, sin datos nuevos, ahorro en hipótesis):
  - `reducir_materiales_distintos` (compras): ≥6 SKUs distintos → consolidar reduce compras/inventario/preparaciones.
  - `modularizar_transporte` (diseño, requiere Ingeniería): pieza ≥2400 mm → dividir en módulos facilita transporte e
    instalación; las juntas pueden requerir refuerzo.
- Validación: `ingenieriaValor.test.js` ampliado (variantes A/B/C + reglas nuevas) + build. Sigue sin inventar ahorros.
