# COSTEAR · Por qué hoy NO cuesta la vitrina TELSVH120 (precio ↔ piezas en sync)

Medición real (2026-10-29) con la Hoja de Manufactura de fábrica + los precios del sistema.

## Resultado en una línea
De los **29 materiales reales** de la vitrina, el sistema sólo tiene precio para **3**, y
**ninguno está aprobado** (y la pintura mapeó al color equivocado). Los otros **26 no están
conectados**. → **Hoy Costear no puede costear bien este mueble**, no por la IA ni por el motor
(ambos probados), sino porque **faltan los precios/conexiones**. Esto ES el "precio y piezas en sync":
si falta material, falta dinero.

## Causa raíz (dato duro)
- Tabla `insumo_mapeos_externos`: **sólo 20 claves Intelisis mapeadas en todo el sistema.**
- De los 29 materiales de esta vitrina: **3 mapeados (estado `propuesto`), 0 `approved`, 26 sin mapeo.**
- El catálogo SÍ tiene precios (10,185 insumos) — el hueco es **el puente clave-de-fábrica → insumo**.

## Los 3 que tienen precio (pero `propuesto`, no aprobado)
| Material (fábrica) | Insumo catálogo | Precio | Problema |
|---|---|---|---|
| Lámina cal.20 3x10 | lamina-3x10-20 | $441.72/hoja | sólo `propuesto` |
| Lámina cal.14 3x10 | lamina-3x10-14 | $816.48/hoja | sólo `propuesto` |
| Pintura | pintura-polvo-antracita-tx | $227.66/kg | **color equivocado** (antracita, la vitrina es blanco) |

## Los 26 sin precio — acción de Compras (conectar + aprobar)
**Láminas/galvanizada: existen en catálogo, sólo falta conectarlas** (ej. galvanizada cal.24 = `erp-lg24410` $401):
lámina negra cal.18 3x10, cal.18 4x10, cal.20 4x10, galvanizada cal.24.
**Herrajes/consumibles/especiales (verificar o cargar precio):**
capelo de cristal, caja de luz acrílico, kit iluminación LED (5 tiras+fuente MeanWell+cable),
cerradura cam-lock, pasador seguridad, bisagra de piano, juego de correderas, 4 niveladores cromados,
88 pijas, 45 remaches, 4 tuercas 3/8, Sikaflex, silicón, película paletizado, empaque espuma,
esquinero polifoam, logo TELCEL acrílico, placa galvanizada serigrafía, madera de pino ×3 (embalaje), clavo.

## Qué desbloquea esto (el verdadero salto de Costear a 9.5)
1. **Conectar** las 29 claves de fábrica a su insumo del catálogo.
2. **Aprobar** sus precios (hoy `propuesto` → `approved`), con Compras/Dirección.
3. Corregir mis-mapeos (pintura: blanco, no antracita).
Con eso, Costear puede dar el **precio real** de un mueble nuevo. Sin eso, nombrar las piezas no sirve.

## ACTUALIZACIÓN 2026-10-29 (tras conectar por código humano)
Puenteando por el código humano del HDM (no la clave Intelisis), los precios YA estaban cargados;
sólo faltaba la conexión. Creadas como `propuesto` (Dirección aprueba; reversibles, tag
`HDM_TELSVH120_20261029`):
- **25 de 29 materiales conectados** a precio real (mayoría CERTIFICADO).
- Pintura corregida: antracita → **blanco basic white** (`pintura-polvo` $113.83).
- Madera 10cm 1-1/4 conectada (`erp-tmp1011425` $189.75).
- **4 pendientes, NO adivinados** (precio podría salir 10x mal): capelo de cristal (TELSVH120-CAP),
  kit LED 100W (TELSVH120-KIT), cerradura cam-lock (CECAM20015), placa serigrafía (TELSVH120-PLA).
  Los 4 requieren su **orden de compra real de TELCEL** (no estaba en los archivos muestreados) o
  decisión de Dirección sobre un proxy. Los 2 más caros (cristal, LED) están entre estos 4.
- El maestro "Última Compra" ya estaba cargado en el catálogo (no aportó precios nuevos).

## Honestidad del alcance
- El motor (matemática) ya reproduce costos al centavo cuando los precios están (golden TELCEL 4/4).
- El cuello de botella de Costear para muebles NUEVOS es **cobertura de datos de precio**, medible por mueble.
- Para esta vitrina hoy: **cobertura 3/29, aprobados 0/29.**
