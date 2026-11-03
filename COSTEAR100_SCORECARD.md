# COSTEAR 100 · Scorecard (estimación honesta, NO certificación) — 2026-11-03

Regla: "No otorgues puntos sin evidencia. No declares 100 porque los tests pasen." Esto es mi estimación con
evidencia, con ~40% de los puntos **gated** por datos/infra fuera de mi alcance hoy. No es una certificación.

| Dimensión | Pts | Estim. | Evidencia / por qué no más |
|---|---:|---:|---|
| Interpretación del mueble | 15 | 8 | multimodal + `structuralGraph` maduros; sin re-benchmark de modelos (FASE 3) |
| Cobertura componentes/BOM | 20 | 13 | BOM sólido + **detector de omisiones** (FASE 11/22) + **subsistemas** (FASE 4/B) nuevos; falta Input→BOM certificado |
| Procesos, MO, GIF | 15 | 6 | **ROUTING** nuevo (operaciones por centro); tiempos/MO/GIF **bloqueados** (Torre GIF + sin tiempos de fábrica) |
| Exactitud vs fábrica | 25 | 10 | materiales TELCEL 4/4 al centavo + lab por subsistema (Σ=target); MO/GIF + más familias + integración de fábrica **gated** |
| Seguridad y trazabilidad | 10 | 8 | seller-safe, fail-closed, fuga RLS tapada, propone-no-impone en todo lo nuevo |
| UX y flujo | 5 | 4 | secuencia ENTENDER→DESCOMPONER→OMISIONES→OPERACIONES visible en COSTEAR |
| Estabilidad y E2E | 10 | 5 | 4,066 tests verdes; P0.COSTEO concurrencia sin cerrar (**staging = infra**) |
| **TOTAL** | **100** | **~54** | subió de ~48 con las 4 piezas nuevas; el techo sin datos/infra es ~60-65 |

## Lo construido esta operación (todo en rama, probado, sin tocar prod/precios/motor/edges)
1. **Detector de omisiones / ingeniería invisible** (FASE 11+22) — `deteccionOmisiones.js`, 15 tests.
2. **ROUTING de fabricación** (FASE 5/C) — `routingFabricacion.js`, 12 tests.
3. **Contrato de subsistemas + ubicación económica** (FASE 4/B) — `subsistemas.js`, 18 tests.
4. **Laboratorio TELCEL por subsistema** — `telcelSubsistemas.lab.js`, 8 tests; cobertura 4/4, Σ=target.
5. Fix cross-módulo `\blamina\b` (melamina≠lámina) + captura de madera maciza.
Todo cableado en COSTEAR como paneles informativos (¿Es de línea? · Así lo fabricaría · Auditoría ¿qué falta?).

## Bloqueadores que NO puedo cerrar yo (listos para quien decide)
1. **Dirección/Costos** — GIF Vitrina Torre 0.5% sin regla (`TORRE_GIF_RULE=UNRESOLVED`); + ¿embalaje de Torre $212 sale del material de fábrica a partida de proyecto? (hallazgo del lab).
2. **Compras** — 9 datos (SKU/unidad/precio) + revalidar 49 precios históricos.
3. **Infra** — staging aislado para cerrar P0.COSTEO (concurrencia/latencia).
4. **Integración de datos de fábrica** (Rogelio/Miguel/Daniel, Alpura real) — la directiva la pone al final, tras P0.COSTEO.

## Veredicto
COSTEAR **no es certificable 100 hoy** (la directiva lo prohíbe antes de cerrar P0.COSTEO e integrar fábrica). El
Cerebro 1 (precisión industrial) avanzó de forma real y probada; el techo alcanzable sin datos/infra nuevos es ~60-65.
Para pasar de ahí se necesitan las 4 decisiones/datos de arriba. Nada de lo nuevo está en producción aún: requiere tu
autorización de merge para que el piloto lo use.
