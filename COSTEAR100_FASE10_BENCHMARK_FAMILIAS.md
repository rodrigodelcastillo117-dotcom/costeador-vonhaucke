# COSTEAR 100 · FASE 10/16 — Benchmark de familias especiales (conductual) · 2026-11-03

"NO TODO MUEBLE ES UN ESCRITORIO." Prueba que el motor industrial (subsistemas + routing + detector de omisiones +
ingeniería de valor) se comporta correctamente en muebles especiales tipo TELCEL/Alpura, no sólo escritorios.

**Honesto:** casos **sintéticos** para validar comportamiento, integridad y seguridad — **no** paridad de costo contra
fábrica (gated por datos reales). `src/datos/familiasEspeciales.bench.test.js`, 14/14.

## Familias cubiertas y qué valida cada una
| Familia | Valida |
|---|---|
| Exhibidor metálico iluminado | subsistemas estructura+acabados+eléctrico; routing soldadura+pintura+cableado+pruebas; con driver no bloquea |
| ↳ adversarial SIN driver | `led_sin_driver` → **bloquea certificación** |
| Isla con vidrio | transparentes; routing corte_vidrio+colocación; `vidrio_sin_fijacion` |
| ↳ adversarial con perfil de aluminio | NO marca falso "vidrio sin fijación" (el perfil ES la fijación) |
| Refrigerador integrado | equipos → requiere decisión económica; `equipo_sin_soporte` |
| Mixto madera-metal con herrajes | estructura+panelería+herrajes (compra-venta); routing corte_tablero+soldadura+instalación herrajes |
| Gabinete técnico con cableado | panelería+eléctrico; routing cableado+pruebas |
| Módulo modular repetido | VONI propone estandarizar (confianza ALTA) |

## Lo que confirma
Los 4 módulos del Cerebro 1 + VONI generalizan a las familias que importan (exhibidores, islas, vidrio, iluminados,
equipos, mixtos, modulares), y los **casos adversariales** se comportan seguro (bloqueo por LED sin driver; sin falso
positivo cuando el perfil es la fijación).

## Gap honesto (documentado, no asertado)
La **tapicería/ecopiel** (p. ej. forro de un mostrador) no es todavía un subsistema: una pieza "ecopiel" queda sin
clasificar. No es crítico para TELCEL (metal/panel/vidrio), pero para Alpura/mobiliario con tapiz conviene agregar un
subsistema `tapiceria` cuando entren esos expedientes. Es una línea en `subsistemas.js`.
