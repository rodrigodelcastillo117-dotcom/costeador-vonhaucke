# Motor · rejilla de corte por formato y merma con `fraccion=true` (2026-10-13, RC)

**Estado: corregido en la rama, NO desplegado.** Cambia una fórmula de costo, así que requiere autorización de Dirección.
`MOTOR_VERSION` pasa de `2026-10-12` a `2026-10-13`. Las cotizaciones guardadas con el motor anterior conservan su huella.

## 1. Defecto: la rejilla ignoraba el formato del material

`piezasPorTablero` (`src/motor/calculo.js`) calculaba cuántas piezas caben en una hoja con las medidas globales
`tableroLargoMM` × `tableroAnchoMM` = 2440 × 1220, para cualquier material. Los materiales con otro formato se nesteaban
como si fueran 4×8:

| Material | Formato real | Efecto antes de la corrección |
|---|---|---|
| Tableros ERP 5×8 (31 hojas en el catálogo) | 2440 × 1525 | Rinden menos piezas de las reales: **sobrecosto**. |
| `lamina-3x10-20`, `-14`, `-12` (curados) | 3048 × 914 | Una tira de 3000 mm "no cabe" y cae al aprovechamiento genérico del 80 %. |
| Todo tablero y lámina 4×8 | 2440 × 1220 | Sin cambio. |

**Corrección.** `parametrosDeFormato(par, insumo)` usa las medidas del formato del insumo cuando las declara, y las globales
cuando no. Se aplica en el costeo (`comprarInsumo`) y en la sugerencia de medida (`sugerenciaMedida`).

**Evidencia** (`src/motor/formatoRejilla.test.js`, `src/motor/formatoHojaErp.test.js`):

| Caso | Antes | Después |
|---|---|---|
| 650×450 ×2 + 1800×450, ERP 5×8 a $645.37 | 0.8333 hojas · $537.81 | 0.70 hojas · $451.76 |
| 4 piezas 1100×700 en 5×8 a $306 | 4/3 hoja · $408.00 | 1 hoja · $306.00 |
| 3000×400 en lámina 3×10 | no cabe | 2 por hoja |
| Cualquier pieza en 4×8 | — | idéntico al anterior |

La suite completa no cambia fuera de estos casos: goldens, paridad Intelisis 15/15 y Alba siguen iguales.

**Riesgo de despliegue.** `costear-servidor` importa el mismo `calculo.js`. Cliente y servidor deben desplegarse juntos;
si sólo se publica uno, la paridad se rompe en materiales 5×8 y 3×10.

**Pendiente de Producción.** La regla A14 (½ hoja o 1 hoja para piezas de más de 1.50 m) está calibrada para 4×8. No hay
regla documentada para 5×8: se deja igual.

## 2. `mermaCorte` no se aplica con `fraccion=true`

No es un descuido del código: en la rama de fracción de hoja la merma se modela con la rejilla real (corte de sierra de
6 mm, orilla de 10 mm por lado), la regla A14 de Producción y el 80 % de aprovechamiento para lo que no trae medida.
`mermaCorte` sólo entra cuando se compra el formato completo (`fraccion=false`).

**Lo que no está respaldado.** El 6 % de `mermaCorte` de los tableros curados es un valor semilla sin fuente de Producción.
Sumarlo encima de la rejilla contaría dos veces el desperdicio de corte. Tampoco hay dato de defectos o errores de
taller. Sin respaldo técnico no se agrega merma.

**Cuánto movería si Producción lo respalda.** Para la credenza (MDF 0.8333 hojas) un 6 % adicional serían 0.05 hojas más.

**Decisión para Dirección y Producción.** Confirmar si hace falta una merma de defectos/reproceso en la rama de fracción y con
qué porcentaje documentado. Si es así, entra como un parámetro nuevo y con su propia versión del motor, no reutilizando `mermaCorte`.
