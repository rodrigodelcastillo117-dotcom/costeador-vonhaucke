# P0-B · Precios reales de Compras (ERP Intelisis) hacia el motor — traza, política propuesta y evidencia (2026-10-13)

Decisión empresarial confirmada por Dirección: el Excel "Costos de Materia Prima Última Compra al 10/08/2026" es
una exportación del ERP Intelisis de Compras; sus precios de última compra son **reales y con procedencia**. Este
documento sigue el dato hasta la pantalla, dice exactamente dónde se degrada, propone una política versionada de
elegibilidad y deja los números para que Dirección decida. **Nada de esto cambia producción**: las correcciones de
cliente están en la rama; la migración de formato es un archivo pendiente de aprobación.

## 1. Números reconfirmados (SQL, 05:20 UTC)

| conjunto | n | detalle |
|---|---|---|
| `insumo_precios` ERP (`source_system='erp_intelisis'`, `DATA_TRUTH_V1`, documentada, alta, MXN, trazables, vigentes) | **11 074** | 9 311 `propuesto_validado` + 1 763 `aprobado`; 100 % con `cost_unit_price_mxn > 0`, `source_document` y `source_record_id` |
| ERP en `catalogo_vigente` (vista; 1 fila por insumo activo) | **9 966** | 8 213 `propuesto_validado` · `certificable=false` · `requiere_validacion_compras=false`; 1 753 `aprobado` · `certificable=true` |
| conversión de unidades | 0 | `source_units_per_cost_unit = 1` y `factor_conversion = 1` en los 11 074: el precio ERP **es por unidad de compra = unidad de costeo**; no hay conversiones kg→m² ni tramo→m en los datos |
| moneda | 100 % MXN | sin FX |
| `formato` (hoja 1.22×2.44 etc.) | 604 de 1 093 hojas lo tienen | 341 hojas en `cubiertas` sin formato (210 son 4×8 que el patrón no reconoció por la comilla `4' X 8'`, 31 son 5×8), 84 láminas de metal sin formato (26 son 3×10 ft), 64 de ellas `aprobado` |
| antigüedad de la última compra | — | `aprobado`: 1 159 ≤ 12 m, 491 de 12–24 m · `propuesto_validado`: 320 de 24–36 m, 1 030 de 36–60 m, **6 856 > 60 m** |

Lectura honesta: los 8 213 "preliminares" no son precios dudosos, son **compras de hace más de dos años** (el cargador
los marcó así por una regla de 24 meses que BUG_LEDGER reconoce como "regla mía, no de Dirección"). Un precio de 2012
es real pero no es un costo de reposición. Esa es la decisión que falta.

## 2. Traza del dato y cada condición que lo degrada

| # | capa | archivo | condición | efecto |
|---|---|---|---|---|
| 1 | cargador | `src/datos/erpCarga.js` | `costo_uc ≤ 0`, unidad desconocida, duplicado, `estatus ≠ ALTA`, sin `fecha_uc`, compra > 24 meses | no carga · inactivo · sin precio · `propuesto_validado` |
| 2 | RPC `cargar_erp_ultima_compra` | `20261012050000_vh089_cargar_erp.sql` | sólo Dirección; `cost_unit = unidad_costeo` | inserta `DATA_TRUTH_V1`; `propuesto` pasa por `aprobar_precio` |
| 3 | vista `catalogo_vigente` | baseline `04_vistas.sql` | `vigente_hasta is null and activo`; ranking aprobado > propuesto_validado > propuesto | `certificable = estado='aprobado' and not requiere_validacion_compras` |
| 4 | `catalogo_motor(p_incluir_erp=false, p_ids)` | `20261012043000_vh088_catalogo_motor.sql` | ERP sólo por `p_ids`, búsqueda o amarre | `precio`, `formato` (de `atributos`), `evidencia{estado,certificable,fuente…}`; **no hay `fuente` de primer nivel** |
| 5 | `costear-servidor` v9 | `supabase/functions/costear-servidor/index.ts` | `!emitible → incompleto`; algún insumo no certificable → `preliminar`; `config-fallback` → tope preliminar; si falla la lectura de evidencias → todo preliminar **en silencio** | `precioVenta` sólo en certificado/preliminar |
| 6 | motor | `src/motor/calculo.js` | sin `precioUsable` → pendiente; **P0-02**: área/hojas sin `formato` → pendiente ("precio por hoja sin formato del material") | `emitible=false` |
| 7 | amarre | `src/datos/amarreERP.js` | sin familia, ambiguo, unidad incompatible → sin candidato / conflicto; si no → `SAME_FAMILY_COMPATIBLE_PROPOSED` (por confirmar) | emisión bloqueada hasta confirmar (correcto) |
| 8 | cliente | `App.jsx` `aplicarCompartido` | reemplazaba el mapa de insumos → los ERP elegidos a mano desaparecían | motor local "Pendiente" vs servidor costeando → **VH-145 corregido** |
| 9 | cliente | `Costeador.jsx` `ConfianzaCosteo`, `senales.js` | leían `fuente` y el catálogo manda `evidencia.fuente` → "SIN fuente confirmada" para TODO el catálogo | **VH-143 corregido** |
| 10 | cliente | `Costeador.jsx` | pistas a `analizar-mueble` en objeto, la edge exige arreglo → se descartaban | **VH-144 corregido** |
| 11 | cargador | `erpCarga.js` | patrón `4 x 8` no reconocía `4' X 8'` ni 5×8 | **VH-146 corregido** (cargas futuras) + backfill propuesto |

## 3. Paridad a centavos, 15 artículos de 8 familias (`lab/erp/verificar_rpc.mjs`, sesión QA Dirección)

tablero melamina 19 mm (306.00), MDF 18 mm blanco (725.40), melamina 5×8 28 mm (645.37), acrílico (1 085.28),
ángulo de fierro (436.90), seguro galvanizado (280.00), bisagra Hettich (86.2068), barrenancla (13.00), adhesivo
19 L (2 090.00), cable 20 AWG (17.29), concha acústica (68.98), silla de visita en caja (1 633.5489), bomba de
pintura (4 300.00), cristal 9 mm (878.45), bisagra Blum (186.88).

`source_price` → `cost_unit_price_mxn` → `catalogo_motor().precio`: **15/15 iguales al centavo**. Hop `catalogo_vigente`
por REST: `42501 permission denied` (la vista no se expone al rol autenticado; sólo la leen las RPC SECURITY
DEFINER: correcto, seller-safe). Los 15 llegan al motor con `evidencia.estado` (aprobado/propuesto_validado) y
`certificable` coherentes con la vista. Sólo `erp-ame1948-b14` trae `formato=tablero`; los demás hoja no (P0-02).

Lo que la paridad NO prueba: que el BOM, el consumo, la merma, la MO y los indirectos sean correctos. Eso es P0-C.

## 4. Política propuesta `ERP_ULTIMA_COMPRA_V1` (para decisión de Dirección; no implantada)

Un precio ERP es **elegible para costear** si y sólo si:

1. `source_system='erp_intelisis'`, `contract_status='DATA_TRUTH_V1'`, `source_document` y `source_record_id` presentes (rastreable al Excel y al artículo|opción).
2. `source_currency='MXN'` o FX completo (`fx_rate`, `fx_date`, `fx_source`); hoy 100 % MXN.
3. `cost_unit = insumos_catalogo.unidad_costeo` (ya lo exige el trigger).
4. `cost_unit_price_mxn > 0`.
5. insumo `activo` (estatus ALTA en el ERP).
6. `vigente_hasta is null` y `vigente_desde` (fecha de última compra) **dentro de la ventana que fije Dirección**.

Con 1–5 cumplen los **9 966** ERP vigentes. La condición 6 es la decisión:

| ventana de última compra | elegibles (aprobado + propuesto_validado) | quedan fuera |
|---|---|---|
| ≤ 12 meses | 1 159 | 8 807 |
| ≤ 24 meses (= lo aprobado hoy) | 1 650 | 8 316 |
| ≤ 36 meses | 1 970 | 7 996 |
| ≤ 60 meses | 3 000 | 6 966 |
| sin ventana | 9 966 | 0 (6 856 son compras de hace más de 5 años) |

Propuesta de implementación cuando Dirección elija la ventana (archivo `supabase/migrations/PROPUESTA_vh147_elegibilidad_erp.sql`,
**no aplicar**): columna calculada `elegible_erp` en la vista + `motivo_no_elegible`, y `certificable := (aprobado and not
requiere_validacion) or elegible_erp`. No cambia `estado` masivamente (se conserva el histórico y el importe original),
no toca fórmulas, margen mínimo, precios de lista ni aprobaciones de venta. Los que queden fuera siguen costeando como
`PRELIMINAR` con el motivo visible ("última compra 2014-08-26, fuera de ventana").

## 5. Dos problemas separados (como pide la orden)

- **(a) 8 213 preliminares por la condición `aprobado`**: es la ventana de antigüedad disfrazada de estado. Se resuelve con la
  decisión de § 4, no aprobando en masa.
- **(b) VONI arranca con ~259 insumos curados y busca ERP después**: la IA nunca ve los ~10k (correcto); el ERP entra por
  `buscar_insumos_motor` (índice, ≤100 filas, por tokens) y por el amarre (≤4 consultas × 30 filas por pieza). No se mandan
  10 mil artículos al prompt. Lo que fallaba era el cliente (VH-143/144/145), no la búsqueda.

## 6. Formato de hojas: backfill propuesto (`supabase/migrations/PROPUESTA_vh146_formato_hojas_erp.sql`, no aplicar)

Asigna `atributos.formato` = tablero 1.22×2.44 (`fraccion=true`, `mermaCorte=6`) a las hojas ERP de familias tablero cuyo
nombre contiene 4×8 / 1.22 / 2.44, y 1.525×2.44 a las 5×8. No toca precios ni estados. Láminas de metal (84, 26 de 3×10):
**no** se asigna formato porque la `medida` de una lámina es kg por hoja según calibre y el nombre no siempre lo trae; se
deja con Compras (VH-099b).

## 7. Qué falta para que un COSTEAR con precios ERP sea CERTIFICADO

1. Dirección fija la ventana de § 4 (o decide re-cotizar con Compras los antiguos).
2. Aplicar (con autorización) el backfill de formato § 6 para que el motor pueda consumir por área las hojas ERP.
3. P0-C: cerrar un costeo real con BOM + ERP + paridad (ver `NIGHT_SHIFT_STATE.md`).
