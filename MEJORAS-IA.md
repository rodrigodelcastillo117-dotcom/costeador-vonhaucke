# Mejorar TODA la IA del Costeador — mapa (corte 2026-09-30)

Sí se puede mejorar en todos los sentidos. La IA ya existe en 8 funciones; esto
mapea qué hace cada una, qué tan buena está, y la mejora de más palanca. **Regla:
una superficie a la vez, probada EN VIVO (necesita login de Rodrigo) antes de la
siguiente — así no se rompe nada.** La "inteligencia" ya es fuerte (Opus 5); casi
todas las ganancias son de DATOS, PROMPT/esquema, UX y MEDICIÓN, no de modelo.

## Las 8 funciones de IA
| Sentido | Función | Modelo | Estado / mejora de más palanca |
|---|---|---|---|
| Reconocer | `analizar-mueble` | Opus 5 | ✅ ya acepta PDF. Mejora: anclar mejor a catálogo (menos insumoId=''), pedir 1 cota de escala siempre. |
| Reconocer | `costear-vision` | Opus 5 | **Posible duplicado** de analizar-mueble — revisar si se consolida (una sola, menos divergencia). |
| Colocar | `leer-plano` | Opus 5 | Mejora: devolver también cotas por cuarto y validar que la suma de áreas cuadre. |
| Colocar | `acomodar-espacio` | Opus 5 | Mejora: respetar puertas/circulación (hoy sin datos de geometría de puerta). |
| Cotizar | `cotizar-texto` | Opus 5 | Mejora: que SIEMPRE devuelva cantidad+unidad validadas contra catálogo; nunca precio (lo da el motor). |
| Aportar | `analizar-negocio` | Opus 5 | Mejora: alimentarlo con señales reales (márgenes bajos, precios vencidos) ya calculadas. |
| Renders | `generar-render` | Gemini nano-banana | Mejora: anclar el render a las medidas/acabados reales de la partida (hoy puede idealizar). |
| Video | `generar-video` | Gemini Veo | Mejora: solo tras render confiable; control de gasto. |

## Mejoras transversales (suben TODA la IA de golpe)
1. **Grounding con datos reales** — el límite #1. Catálogo con claves vigentes +
   recetas + tiempos + órdenes cerradas (lo que pedimos a Vicente/Producción/Edgar).
   Mejor dato → mejor reconocimiento, costeo y cotización, sin tocar prompts.
2. **Confianza y confirmación** — que cada salida de IA muestre su nivel de confianza
   y el fragmento/evidencia de dónde salió; el humano confirma. (La app ya tiene
   `iaConf`/medidor; extenderlo a todas.)
3. **La IA NUNCA pone dinero** — reconocer/proponer sí; precio y margen los fija el
   MOTOR. Blindar esto en las 8 (ya es la regla en analizar-mueble/cotizar-texto).
4. **Medir la IA** — comparar propuesta de IA vs corrección humana vs orden real;
   % de acierto por familia. Sin esto, "mejor IA" es opinión.
5. **Costo/latencia de IA** — presupuesto por usuario/proyecto, reintentos seguros,
   caché de análisis repetidos. Evita gasto sin valor.

## "Editar" (el sentido que falta nombrar)
Hoy el humano edita la propuesta de IA a mano (partidas, medidas). Mejora: que Voni
acepte "cámbiale la cubierta a melamina 19 / sube a 2 cajones" en lenguaje natural y
re-proponga — con el humano confirmando. Es un flujo nuevo, mediano.

## Cómo lo hacemos sin romper nada
- Una función por tanda. Cambio de prompt/esquema → **probar EN VIVO** (Rodrigo con
  login) con 2-3 casos reales → recién entonces la siguiente.
- Los cambios de IA no se pueden testear por unit-test (dependen del modelo); por eso
  el ciclo es: cambio → deploy → prueba humana → ajuste.
- Prioridad sugerida: (1) consolidar/pulir reconocer (analizar-mueble vs costear-vision),
  (2) cotizar-texto anclado a catálogo, (3) render anclado a medidas, (4) medición.

## Realidad
La IA ya es capaz en los 8 sentidos. El salto de "buena" a "la mejor" es 80% DATOS
y MEDICIÓN, 20% prompt. No es reprogramar el cerebro — es alimentarlo y medirlo.
