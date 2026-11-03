# COSTEAR 100 · FASE 11 + 22 — Detector de omisiones / ingeniería invisible (2026-11-03)

## Qué se construyó
`src/datos/deteccionOmisiones.js` — auditoría determinista que, **antes de dar el costo**, se pregunta
"¿cómo se sostiene, ensambla y funciona este mueble, y qué NO está costeado?" Detecta componentes/operaciones
físicamente implicados pero ausentes del BOM/routing. Se apoya en los roles de `revisionEstructural` y el despiece
existente — **no es un motor paralelo**.

### Reglas v1 (9)
| Clave | Subsistema | Severidad | ¿Bloquea? |
|---|---|---|---|
| `puertas_sin_bisagra` | herrajes | RIESGO | no (podría ser corrediza/pivote) |
| `cajones_sin_corredera` | herrajes | RIESGO | no |
| `metal_sin_union` | estructura | RIESGO | no (routing incompleto) |
| `led_sin_driver` | eléctrico | **OMISIÓN** | **sí** (no funciona sin alimentación) |
| `vidrio_sin_fijacion` | transparentes | RIESGO | no |
| `equipo_sin_soporte` | equipos | RIESGO | no |
| `cubierta_claro_sin_refuerzo` | estructura | RIESGO | no (ingeniería invisible: omega/bastidor) |
| `tablero_sin_canto` | acabados | SUGERENCIA | no |
| `ensamble_sin_tornilleria` | herrajes | SUGERENCIA | no |
| `modulo_sin_embalaje` | embalaje | SUGERENCIA | no |

### Reglas de casa respetadas (misión + FASE 11/22)
- **Propone, nunca agrega cantidades ni cambia el BOM.** La IA propone; Ingeniería confirma; el motor costea.
- **Severidad**: OMISIÓN (casi seguro) / RIESGO (probable, depende del diseño) / SUGERENCIA (opcional / bajo impacto).
- **Certeza** (matriz FASE 22): INFERIDO / POR_CONFIRMAR. **Nunca DOCUMENTADO** — es inferencia, no evidencia.
- **Materialidad** (FASE 22 §9): sólo una omisión funcional crítica bloquea el costo oficial. No se bloquea
  "por si hay un tornillo oculto".
- **DESCARTADO**: una exclusión confirmada por un humano apaga su regla.

## Validación (RED→GREEN): `deteccionOmisiones.test.js`, 14/14
- Puerta sin bisagra → RIESGO; puerta CON bisagra → no marca (sin falso positivo).
- LED sin driver → OMISIÓN que **bloquea**; LED con driver → no bloquea.
- Metal sin operación de unión → RIESGO; con soldadura en el routing → no marca.
- Exclusión confirmada apaga la regla; ordena por severidad; **no muta la entrada ni inventa cantidades**.
- **Módulo REAL TELCEL C-CO-320R (Almacenamiento METAL)**: NO inventa "puertas sin bisagra" (las 4 bisagras
  existen) y **NO bloquea** la certificación; sí observa, correctamente, que la estructura metálica no tiene
  operación de unión costeada (el golden de materiales es materiales-only → routing incompleto, verdad del dato).

## UX (FASE 14)
Cableado en `AsistenteEspecial.jsx` (COSTEAR) como panel informativo **"Auditoría de ingeniería — ¿qué podría
faltar?"**, tras "Esto entendí". Muestra cada hallazgo con su severidad y su pregunta; si hay omisión crítica,
avisa que el costo no debería certificarse. `try/catch` defensivo; se limpia al reiniciar/cambiar de producto.
Build (`vite build`) OK; 144 pruebas de AsistenteEspecial + 14 del detector en verde.

## Lo que falta (siguiente valor)
- Más reglas con geometría/relaciones del `structuralGraph` (soporte real de cubierta vía relación `supports`,
  no sólo keyword) y por familia de mueble (exhibidor/isla/torre).
- Conectar el `bloquea_certificacion` al gate de estado de costo (hoy el panel avisa; el gate económico es aparte).
- Medir recall de omisiones contra BOMs reales (holdout) cuando entre la verdad de fábrica.
