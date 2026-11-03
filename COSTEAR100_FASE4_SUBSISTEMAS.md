# COSTEAR 100 · FASE 4/B — Contrato de subsistemas (2026-11-03)

## Qué se construyó
`src/datos/subsistemas.js` — descompone cualquier mueble en **subsistemas de fabricación** y fija la **ubicación
económica inequívoca** de cada uno, para impedir omisiones y dobles cargos (directiva FASE 4: "no mezcles costos de
fábrica con costos logísticos o partidas comerciales"). Permite agregar familias nuevas sin reescribir el motor.

### Los 8 subsistemas y su ubicación económica
| Subsistema | Ubicación económica |
|---|---|
| Estructura (lámina, tubular, PTR, perfil, bastidor, patas) | **fábrica** (material + MO fab + GIF) |
| Panelería y carpintería (melamina, MDF, chapa, cubiertas, puertas, cajones) | **fábrica** |
| Acabados (pintura, laca, canto, gráfica, adhesivos) | **fábrica** (gráfica puede ir a tercero) |
| Herrajes (bisagras, correderas, jaladeras, cerraduras, niveladores) | **compra-venta** (consistente con el motor, decisión Dirección) |
| Transparentes (vidrio, acrílico, espejos) | **compra-venta** (posible tercero el corte) |
| Eléctrico (LED, driver, cableado) | **compra-venta** + MO de instalación |
| Equipos integrados (refrigerador, pantalla) | **confirmar** (fabricado / comprado / subcontratado / suministrado por cliente / excluido) |
| Embalaje, logística y montaje | **proyecto** (NO costo de fábrica) |

La separación es el punto clave: embalaje/logística/montaje en sitio **no** se mezclan con el costo de fábrica, y los
equipos integrados **exigen una decisión** antes de certificar.

## Validación (RED→GREEN): `subsistemas.test.js`, 18/18
- Clasifica 12 piezas representativas a su subsistema correcto.
- Ubicación económica: herrajes=compra-venta, embalaje=proyecto (no fábrica), estructura/panelería=fábrica,
  equipos=confirmar (requiere_decision_economica=true).
- Módulo REAL TELCEL: separa estructura+acabados+panelería (fábrica) de herrajes (compra-venta), 0 sin clasificar.

## Bug encontrado y corregido (lo cazó este test) — también afectaba detector y routing
La regex `lamina` hacía **substring-match con "me​lamina"** → una pieza de melamina (tablero) se clasificaba como
metal/estructura, y en el detector/routing habría disparado falsos "metal sin unión" / "soldadura" en un mueble
100% melamina. Corregido a `\blamina\b` (frontera de palabra: sí caza "lámina negra", no "melamina" ni "laminado")
en `subsistemas.js`, `deteccionOmisiones.js` y `routingFabricacion.js`. Regresiones agregadas en los tres:
un mueble sólo de melamina NO dispara metal. También se corrigió la prioridad: el **rol** manda sobre una palabra
suelta (una "cubierta" es panelería aunque su texto diga "laminado").

## UX (FASE 14)
El panel "Así lo fabricaría" de COSTEAR ahora muestra primero los **subsistemas con su ubicación económica**
(fábrica / compra-venta / proyecto / confirmar) y luego las operaciones. Completa la vista ENTENDER → DESCOMPONER
→ OPERACIONES. Sin panel nuevo (respeta "no otra pantalla interminable"). Build OK; 59 pruebas verdes.
