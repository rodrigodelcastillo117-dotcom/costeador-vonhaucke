# Plantilla para volver COSTEAR confiable — 2 datos que sólo VH tiene

> Llena esto (o pásamelo en el chat) y COSTEAR pasa de "estimado" a **confiable medido**.
> No necesito despiece ni planos. Necesito **realidad** contra qué medir.

---

## DATO 1 — 5 costos REALES de fábrica (la "regla" contra la que mido)

De contabilidad / órdenes de compra / costeo cerrado de muebles **ya fabricados** (no el número del motor; el real que costó hacerlos). Con 5 basta para empezar.

| # | Mueble (clave o nombre) | Material total | Mano de obra | GIF/indirectos | Terceros (cristal/termo/etc.) | **COSTO TOTAL real** | Fuente (OC/mes) |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |

*Si sólo tienes el COSTO TOTAL (sin desglose por capa), también sirve — mido el total y te digo el error.*
*Ideal: incluir 1–2 de los del concurso (Horizontal, Torre, Isla) si existen fabricados.*

---

## DATO 2 — Cómo costea VH un mueble COMPLETO (la regla del costeador)

Respóndeme estas 4 (una línea cada una; es la sesión de ~15 min con Rafa o Alba):

1. **Mano de obra de armado/ensamble** (instalar cristal, leds, cablear, montar herrajes): ¿se carga como % del material comprado, como horas×tarifa, o va incluida en el factor de fabricación? → ______
2. **Terceros** (cristal templado, termoformado, corte láser): ¿se pasan a costo directo + qué % de manejo, o llevan margen propio? → ______
3. **GIF/indirectos** sobre terceros y comprados: ¿aplica igual que a fabricación (0.50) o distinto? → ______
4. **Margen de venta** objetivo del concurso Telcel (el que convierte costo en precio): ______ %

---

## Qué pasa cuando me lo das
1. Corro los 5 reales por el motor → **mido el error por capa** (material/MO/GIF/terceros/total).
2. Ajusto la regla de terceros/armado con el DATO 2 → el sesgo del Horizontal se corrige.
3. La `validacionCosteo` marca cada costeo **🟢 CERTIFICABLE** (dentro del error medido) o 🟡/🔴 con motivo.
4. Re-costeo el concurso con la regla calibrada → número en firme + error conocido.

**Sin estos 2 datos COSTEAR seguirá dando buenos estimados, pero no podrá decir "confío a ±X%".
Con ellos, en días.**
