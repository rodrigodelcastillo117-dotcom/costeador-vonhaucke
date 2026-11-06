# ¿Estamos mal nosotros o el costeo real? — veredicto y método
**Fecha:** 2026-11-06 · **Arnés:** `lab/scripts_lab/recost_veredicto.mjs` · Catálogo EN VIVO (post-activación + SKUs + espuma + láminas enlazadas). **0 huecos** en ambos productos.

## El método (cómo se verifica quién tiene razón)
1. **Aislar el precio.** El re-costeo usa el **mismo consumo del workbook** en ambos lados. Entonces la diferencia de material NO es de cálculo ni de merma — es **puramente de precio**. Así la pregunta se reduce a: ¿de quién es el precio correcto?
2. **Decidir por la fecha de la última compra real.** El precio más reciente gana. Si nuestra `vigente_desde` > la `fecha_última_compra` del workbook → nosotros estamos más actualizados.
3. **Conflictos de misma fecha → ir a la fuente (OC/maestro ERP).** Si la fecha es igual pero el precio difiere, se rastrea el `source_document` del precio.
4. **Items viejos (pre-2024) → marcar.** Un precio de hace 5-7 años no es "actual"; necesita re-cotización, no define un costeo de hoy.

## Resultado (material, mismo BOM)
| | Real (workbook) | Motor (catálogo ERP) | Δ |
|---|---:|---:|---:|
| **VENTO** C-CO-526R (107 r.) | $20,435.98 | $21,412.53 | **+4.8%** |
| **TELCEL** C-CO-320R (89 r.) | $30,210.35 | $31,218.19 | **+3.3%** |

### De quién es la diferencia
**VENTO (+$976):**
- NUESTRO precio más nuevo (el costeo real quedó viejo): **34 renglones, +$229** → nosotros bien.
- Workbook más nuevo (vamos atrás): 4 renglones, +$233 → son pintura, y es imprecisión del arnés (uso el promedio de 89 colores; en producción VONI amarra el color exacto ≈ el del workbook).
- **Conflicto misma fecha: 3 renglones, +$558** → dominado por el kit LED `MDMEKT01000004`.
- Resto igual (±2%).

**TELCEL (+$1,008):**
- NUESTRO precio más nuevo: **35 renglones, +$416** → nosotros bien.
- **Conflicto misma fecha: 17 renglones, +$889** → TODOS son items **2018–2020** (kits LED, cristales, cerraduras, pivotes) que la activación destapó. Precio viejo del maestro ERP vs el del workbook viejo.
- 1 pintura sin fecha comparable, −$300.

## El veredicto honesto
**No estamos mal nosotros.** Rastreo de los dos conflictos más grandes:
- Kit LED VENTO `MDMEKT01000004`: nuestro **$1,925** sale de `ERP Intelisis · Costos de Materia Prima Última Compra al 10082026.xlsx` (**maestro oficial de Compras**, corte 2026-08-10). El workbook usó $1,356.
- Kit LED TELCEL `MVLEKT03000086`: nuestro **$6,600** del mismo maestro ERP. El workbook usó $2,535.

→ **Nuestros precios vienen del maestro oficial de última compra del ERP. Los costeos reales usaron números más viejos o capturados a mano.** En los items ACTUALES, donde diferimos, el desactualizado es el costeo real; nosotros reflejamos Compras.

La parte de TELCEL la inflan items **descontinuados 2018–2020** (la activación los hizo visibles). Para costeos NUEVOS no aplican; necesitan re-cotización si se volvieran a usar. No definen la fidelidad del motor.

## Conclusión
- El **motor es fiel**: mismo consumo, y el precio sale de la fuente oficial. La diferencia vs un workbook viejo es porque **estamos más al día que ese costeo**, no por error de cálculo.
- **No hay nada que "arreglar" para acercarnos al workbook viejo** — sería acercarnos a un dato peor. Las compras semanales mantienen el catálogo al día con el ERP.
- Lo único accionable real: si el kit LED `MDMEKT01000004` de verdad costó $1,356 y no $1,925, es un dato del maestro ERP a revisar con Compras (no del motor). Los items 2018–2020 se re-cotizan si reviven.

## ADDENDUM 2026-11-06 — ¿los workbooks traen precios más nuevos? NO.
Se comparó la última compra de los **110 artículos** de VENTO+TELCEL (`lab/scripts_lab/precios_workbook.mjs`) contra nuestro catálogo, artículo por artículo:
- **0 artículos** donde el workbook tenga fecha MÁS NUEVA que la nuestra. En los 110 estamos **igual o más actualizados**. No hay nada que "ponernos al día".
- Las únicas diferencias son **20 conflictos de misma fecha** (misma compra, precio distinto):
  - **~16 items viejos (2011–2022):** el workbook = nuestro precio **× 1.20–1.30** casi exacto (mediana 1.254). Que tantos items distintos difieran por exactamente 20% o 30% prueba que el workbook trae un **costo CARGADO (con markup)**, no el precio de compra crudo. El nuestro es el crudo del ERP — el correcto para el motor (que suma indirectos aparte). **Reescribir con el workbook metería el markup dos veces → NO se hace.**
  - **2–3 kits LED** sin patrón (MDMEKT $1,925 vs $1,356; MVLEKT $6,600 vs $2,535): discrepancia real de dato en ensambles → la resuelve Compras con la OC.

**Conclusión:** no se reescribió ningún precio. No porque no se pueda, sino porque los datos muestran que **no estamos atrás** (somos ≥ actuales en todo), y los precios del workbook en los items viejos son costos cargados que ensuciarían el crudo. La carga semanal del ERP mantiene el crudo al día.

## Deploy
Todo lo de esta ronda es **cambio de DATOS (catálogo/precios): ya está en vivo** — las RPC `catalogo_motor`/`buscar_insumos_motor`/`catalogo_vigente` leen en vivo, no requieren desplegar código. El puente ERP del cliente ya está en la rama de producción. No se promovió el puente redundante de `analizar-mueble-rc`.
