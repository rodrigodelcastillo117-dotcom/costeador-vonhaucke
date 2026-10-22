# UX_BEFORE_AFTER — Von Haucke

**Comparación antes/después por flujo**, derivada del inventario (`UX_FUNCTION_INVENTORY.md`, ANTES) y de la arquitectura nueva (`UX_INFORMATION_ARCHITECTURE.md`, DESPUÉS). Documento en papel; **no cambia código.**

- Rama `claude/costing-app-architecture-psf02g` · HEAD `00c32d8` · 2026-10-22

> **Honestidad sobre las cifras.** Las columnas estructurales (pasos, CTA por pantalla, controles en superficie primaria, términos técnicos visibles) se cuentan HOY desde el inventario y el código. Las métricas de recorrido en vivo (`human_decisions`, `warnings_visible`, `blocking_errors`, `backtracks`, `retry_count`…) **sólo se miden con la UI construida y los E2E instrumentados** — esa es la fase que cuesta créditos de IA. Aquí van como OBJETIVO, no como medición cumplida. No voy a declarar una reducción "medida" que no corrí.

---

## COSTEAR

| Dimensión | ANTES (hoy) | DESPUÉS (objetivo) |
|---|---|---|
| Pantallas / pasos | Costeador avanzado = **1 lienzo largo** con todo simultáneo (sin pasos) | **4 pasos**: Empezar → Esto entendí → Decisiones → Resultado |
| Controles en superficie primaria | **~35-40** (nombre, descripción, piezas, tipo, despiece completo con material/medidas/mermas, sliders MO directa/indirecta, horas por área, prep/empaque/merma, gastos fábrica, margen, render, auditoría, confianza, estructura Voni) todos visibles a la vez | **1 CTA primario por paso**; ingeniería (BOM, mermas, MO, indirectos, auditoría, confianza, estructura) plegada en **"Ver ingeniería"** |
| Decisiones antes del costo | Mezcladas con ingeniería; el usuario arma el despiece a mano | Una a la vez, sólo si falta (con opción "recomendada") · objetivo **human_decisions ≤ 3** |
| Términos técnicos en 1er plano | BOM, fracción de hoja, factor directo/indirecto, "USER_CONFIRMED", pendientes, Alba V1 | **0** en superficie primaria (viven en "Ver ingeniería") |
| Blockers | Fail-closed técnicos visibles mezclados con precio | Mismos gates, redactados humanos (`UX_LANGUAGE_MAP.md`); objetivo **blocking_errors = 0** salvo dato real faltante |
| Funciones | 98 entradas (sección 2) | **98 presentes** (paridad), reubicadas por prominencia |

## COTIZAR

| Dimensión | ANTES (hoy) | DESPUÉS (objetivo) |
|---|---|---|
| Pantallas / pasos | ~5 superficies densas (EmpezarEspacio, CotizadorIA, EstoEntendi, Acomodo, Cotización) sin stepper unificado | **5 pasos** con stepper: ¿Dónde va? → Analizando → Esto entendí → Acomodo → Propuesta |
| Pantalla más cargada | **Acomodo**: cartel de estado + diagnóstico + veredicto por 7 bloques + auditoría medida + floor editor + paleta + escenas, todo junto | Acomodo muestra resultado + 1 recomendación; diagnóstico/veredicto/floor-editor bajan a **"Acomodar a mano"** y "detalles" |
| Puertas/bisagras | Confirmación pedida por puerta | Inferir si es seguro · auto-reparar primero · preguntar sólo si cambia el resultado |
| Progreso de análisis | Técnico / sin feedback humano | "Leyendo plano… · Buscando mobiliario…" (sin logs) |
| Warnings simultáneos | Múltiples banners (no-catálogo, material especial, sin costear, sin precio, truncado, acomodo no certificado…) | Agrupados a **"N cosas que recomendamos revisar"** (objetivo ≤3 visibles) |
| Borrador de propuesta | Acomodo pendiente puede frenar la sensación de avance | **BORRADOR permitido** con productos/economía válidos aunque acomodo = pendiente (sin marcar validado en falso) |
| Decisiones | Programa + ambiguas + conflictos + puertas + acomodo | objetivo **human_decisions ≤ 5** |
| Funciones | 128 entradas (sección 3) | **128 presentes** (paridad) |

## COCREAR (CocrearV3)

| Dimensión | ANTES (hoy) | DESPUÉS (objetivo) |
|---|---|---|
| Pantallas / pasos | Idea → Conceptos → Studio (studio muy denso: diseño + 3D + verdad industrial + costo + ingeniería) | **4 pasos**: Idea → Conceptos → Studio → Registrar |
| "Cambiar algo" | Panel con ~14 campos (tipología, capacidad, medidas, material, tono, funciones) | **Conversación en lenguaje natural** primero ("20 cm más alta, base de zoclo"); los 14 campos siguen en "Editar medidas y componentes" |
| Decisiones de acabado | Con referencia técnica | Lenguaje humano (chapa premium / melamina económica) |
| Costo/ingeniería | "Verdad industrial" + explicación + validar ingeniería en primer plano (sólo veCostos) | Mismos, bajo "Ver ingeniería"; vendedor seller-safe | 
| Decisiones | objetivo **human_decisions ≤ 5** hasta propuesta + render + costo |
| Funciones | 129 entradas (sección 4) | **129 presentes** (paridad) |

---

## Global

| Dimensión | ANTES | DESPUÉS (objetivo) |
|---|---|---|
| Entrada | Home + **panel legacy `home/cotizar` duplicado** (10 tarjetas) | Home único (3 primarios + "Más herramientas"); legacy **consolidado** sin perder destinos |
| Profundidad máx. | funciones avanzadas dispersas | **≤ 2 niveles** desde la pantalla del flujo |
| Estados crudos en pantalla | 13+ familias (`ECONOMICS_INCOMPLETE`, `PRELIMINAR`, `layoutEstado`, códigos de diagnóstico, procedencia, RenderChip…) | Traducidos a frase humana (`UX_LANGUAGE_MAP.md`); crudo sólo en "Ver detalles técnicos" |
| Niveles de color | amarillo usado como pseudo-bloqueador | 3 niveles: verde listo / amarillo "puedes continuar" / rojo bloquea de verdad |
| Funciones totales | **471** | **471 presentes · FUNCTION_LOSS = 0** |

## Métricas obligatorias (se instrumentan en la fase de construcción)

Por flujo, a medir con la UI nueva + E2E "persona nueva": `human_decisions`, `blocking_errors`, `warnings_visible`, `technical_messages_visible`, `steps`, `backtracks`, `manual_edits`, `retry_count`. Objetivos: COSTEAR `human_decisions ≤ 3`; COTIZAR `≤ 5`; COCREAR `≤ 5`; `blocking_errors = 0` salvo dato/material real faltante. **Estas cifras aún NO están medidas** — requieren construir y correr los recorridos (fase que gatea costo de IA).
