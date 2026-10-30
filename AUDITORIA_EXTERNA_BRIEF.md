# Brief para auditoría externa del Costeador (para pegar a ChatGPT u otro auditor)

**Cómo dárselo (elige una):**
- **A (mejor):** conéctale el repo de GitHub `rodrigodelcastillo117-dotcom/costeador-vonhaucke` (rama `claude/costing-app-architecture-psf02g`) para que lea el código.
- **B:** pégale los 5 documentos de estado (`95_AUDIT_BASELINE.md`, `95_SCORECARD.md`, `95_BLOCKERS.md`, `95_AUDIT_MO_GIF.md`, `95_PROMOCION_RUNBOOK.md`) + los archivos del motor (`src/motor/calculo.js`, `src/datos/costeoServidor.js`, `src/datos/politicaVH.js`, `src/motor/formulaAlba.js`, `src/datos/appltCosto.js`).
- **C (mínimo):** pégale solo este brief y pídele la lista de preguntas/pruebas que necesitaría para auditar — él te dirá qué pegarle.

---

## PROMPT (cópialo tal cual)

Eres un auditor técnico-económico independiente y escéptico. Vas a auditar el "Costeador" de Von Haucke (software que cuesta muebles de oficina) con UN objetivo: **encontrar lo que haría que un costo salga MAL, se pueda vender a pérdida, o engañe al usuario — y proponer cómo mejorarlo.** No eres porrista. Si algo está bien, dilo en una línea y sigue. Si no puedes verificar algo, escribe "NO VERIFICABLE con lo que me diste" en vez de suponer.

CONTEXTO (no lo des por cierto; es lo que me dijeron, verifícalo contra el código):
- Stack: React/Vite (SPA) + Supabase (Postgres + Edge Functions en Deno) + Vercel. Multi-rol: dirección, diseño, vendedor.
- Motor de costeo: `src/motor/calculo.js` (función `calcular`) y `src/datos/costeoServidor.js` (`costearConMotor`, `atenderCosteo`). Cadena: despiece (BOM) → material (precio de catálogo × consumo con merma/nesting) → mano de obra (MO) → indirectos de fábrica (GIF) → costo fabricación → precio (política VH).
- Dos modelos de costo conviven: (1) "clasico" [default]: GIF = 34% del material directo, o fórmula de Alba (MO% por tipo de material + GIF = 3×MO); (2) "intelisis" [solo línea App LT]: MO y GIF = Σ horas_por_centro × tarifa_por_hora, con tarifas inyectadas por `parModelo` (`src/datos/applt.js` APPLT_RATES; referencia alterna en `src/datos/appltCosto.js` TARIFA_REAL_APPLT).
- Reglas de precio: `src/datos/politicaVH.js` (factores MO/IND por tipo; precio mínimo = costo × factor volumen; lista = mín/0.7; precio2 = mín/0.42).
- Catálogo: vista `catalogo_vigente` + `config.datos` (insumos/parametros). Puentes clave-externa→insumo en `insumo_mapeos_externos`.
- Compuerta de emisión: `private_api.evaluar_emision_cotizacion` (SECURITY DEFINER) recalcula TODO en el servidor y devuelve BLOCKED / ECONOMICS_INCOMPLETE / APPROVAL_REQUIRED / ALLOWED. Regla de oro declarada: nunca inventar precio, nunca poner $0 (material sin precio → PENDIENTE), nunca mostrar costo al vendedor (seller-safe).

AFIRMACIONES QUE DEBES RETAR (las hizo el asistente anterior; confírmalas o túmbalas con evidencia, cita archivo:línea):
1. "El modelo MO/GIF es sólido; el `costoHoraGIF` en ceros del config es inerte y fail-closed." → ¿Hay ALGÚN camino donde un costo salga con GIF=0 o MO=0 sin bloquear la emisión?
2. "App LT cobra las horas de metal a tarifa 'otros' ($296/h) en vez de 'pm' ($374/h) → ~$995 menos por banca (hallazgo MG-1)." → ¿Es real? ¿Hay más centros/líneas con la misma fuga de tarifa?
3. "Nunca sale $0 ni precio inventado: todo hueco es PENDIENTE." → busca un componente con material pero sin consumo, o unidad incompatible, o fracción/merma mal, que cueste $0 en silencio o infle/desinfle el costo.
4. "La emisión recalcula en servidor y no confía en el cliente." → busca un bypass: ¿se puede emitir con un total/precio/margen del cliente que el servidor no recompute?
5. "Seller-safe: el vendedor no ve costos." → busca fuga de costo/margen/precio de compra en payloads, vistas o RPCs accesibles al rol vendedor.

AUDITA ESTAS 8 ÁREAS, en orden de impacto en el COSTO:
1. **Corrección aritmética del costo**: unidades (hoja/m²/m/pza/kg), nesting/merma, fracciones de tablero, redondeo a centavos, cantidades por geometría, lote. Casos borde que rompan el número.
2. **Política económica**: ¿los factores MO/GIF/markup/margen son coherentes entre clasico/Alba/intelisis? ¿Dónde se puede subcostear o sobrecostear? ¿La política de "precio mínimo/lista/precio2" protege contra venta a pérdida?
3. **Integridad de datos de precio**: procedencia, certificación, precios viejos (>24 meses), puentes clave→insumo sin aprobar, materiales especiales faltantes. ¿Qué tan fácil es que un costo se arme con un precio no confiable sin avisar?
4. **Compuertas y seguridad del dinero**: emisión, aprobación, seller-safe, "nunca $0 / nunca inventar". Busca el bypass.
5. **Seguridad (RLS/IDOR/privilegios)**: ¿un rol puede leer/escribir lo que no debe (costos, cotizaciones ajenas, precios)?
6. **Fiabilidad/rendimiento**: timeouts de edge, modos de falla, ¿qué pasa si la IA o el catálogo no responde? ¿Falla hacia "caro/bloqueado" o hacia "barato/$0"?
7. **UX del costeo**: ¿el usuario entiende qué es PENDIENTE, por qué, y qué le falta? ¿Los errores son claros? ¿El vendedor ve algo que no debería?
8. **Pruebas y CI**: ¿los gates críticos tienen test que FALLE si se reintroduce el defecto? Busca tests "falsamente verdes" (que pasan sin probar lo que dicen).

REGLAS DE LA AUDITORÍA:
- Cada hallazgo = {severidad P0/P1/P2/P3, área, afirmación en 1 frase, archivo:línea o pasos de reproducción, escenario concreto que falla con entradas y salida esperada vs real, arreglo propuesto proporcional}. Ordena por severidad.
- Prohibido: proponer "relajar un gate para que pase", inventar precios, o convertir PENDIENTE en $0. Si un arreglo cuesta más código del que ahorra, dilo.
- Separa claramente: (a) bugs de software (arreglables en código), de (b) decisiones humanas (política de frescura, aprobar precios/puentes) que NO son bugs.
- Al final: tabla de las 8 áreas con un puntaje 1–10 justificado SOLO donde tengas evidencia (si no la tienes, "SIN MEDIR"), y las **5 mejoras de mayor retorno** para el costeador, con esfuerzo estimado.

Entrega: (1) resumen ejecutivo de 10 líneas, (2) tabla de hallazgos ordenada por severidad, (3) tabla de puntajes por área, (4) top-5 mejoras. Sé concreto y cita evidencia; lo que no puedas verificar, márcalo.
