# Auditoría "con lupa" del sistema de costeo — antes de cualquier deploy
**Fecha:** 2026-11-06 · **Alcance:** por qué VONI no costea muebles nuevos, por qué "no usa" los precios de materias primas, y si merma / sobrante / aprovechamiento / mano de obra / unidades son reales.
**Método:** lectura directa del código del motor, la política de material, el servidor autoritativo y el cliente; definición real de las RPC; conteos en la base de producción. Solo lectura + cómputo. **No se desplegó nada.**

---

## 0. Veredicto en una línea
El **cálculo** (motor, merma, gates) es real y está bien blindado (fail-closed). El puente que hace que VONI use los precios de Compras **ya existe en el código y está cableado**. El problema de "VONI no usa los precios" es un **defecto de DATOS/visibilidad**, no de cálculo, y **mi puente en `analizar-mueble-rc` era redundante y ciego al mismo defecto** (ESTABA EQUIVOCADO; ver §5).

---

## 1. ¿Por qué VONI "detecta el material pero no pone el precio"? (causa raíz REAL)

### El diseño (correcto)
- La IA (`analizar-mueble`) ve **solo el catálogo curado (~258)**, **por diseño**. No es el bug — está documentado en `gemeloErp.js`: *"Por qué VONI usa curados habiendo ERP exacto: la IA sólo ve el catálogo CURADO (por diseño)"*.
- El hueco se tapa en el **cliente** con dos piezas maduras y **ya cableadas**:
  - `amarrarPendientesERP` (`src/datos/amarreERP.js`) — regla de casa 12-oct, autorizada por Dirección: lo pendiente se busca en **todo** el catálogo por `buscar_insumos_motor`, misma política determinista, entra PROVISIONAL (por confirmar), y `agregarInsumo` lo mete al mapa del motor para que cueste.
  - `proponerGemelosErp` (`src/datos/gemeloErp.js`) — para un curado sin precio certificado, propone el gemelo ERP certificable.
  - Cableado real: `Costeador.jsx:184`, `AsistenteEspecial.jsx:717` y `:737`, con `onAgregarInsumo={agregarInsumoCatalogo}` (`App.jsx:909,1530,1548`). `agregarInsumoCatalogo` sí inyecta el insumo a `estado.insumos` del motor.

### El defecto (real, medido)
`buscar_insumos_motor` — la búsqueda que usa el puente — filtra **`where c.activo`**. Por lo tanto:

> **Los insumos con precio CERTIFICADO pero `activo=false` son INVISIBLES para el puente.** Para un mueble cuyo material solo tiene precio en un insumo apagado, el puente busca, no encuentra, y la pieza queda pendiente → **"ya tenemos el costo pero VONI no lo usa"**. Es exactamente el síntoma reportado.

**Escala (producción, 2026-11-06):**
| | # |
|---|---:|
| Insumos con precio aprobado **y `activo=false`** (invisibles) | **1,108** |
| └ con compra 2025–26 (apagados por error) | 9 |
| └ con compra 2024 (apagados por error) | 9 |
| └ con compra < 2024 (descontinuados de verdad) | 1,090 |
| Insumos con precio **y activos** (sí visibles) | 10,185 |

**Matiz honesto:** el fix NO es reactivar 1,108 (surfacear precios de hace 6+ años sería peor que el hueco). Son **18** los que están mal apagados (compra reciente) + los que aparezcan en BOMs reales actuales. Ya confirmado en datos reales: el re-costeo de VENTO encontró 5 renglones con precio certificado escondido por `activo=false` (cerradura cam lock $320, jaladera $79, pivote $450, kit iluminación, cristal).

**Segundo riesgo (secundario):** `buscar_insumos_motor` exige `service_role` **o** `puede_editar_config()`. Un rol de **Diseño** sin ese permiso haría que la búsqueda lance "no autorizado"; el puente lo traga en silencio (`catch` de mejor esfuerzo) → "VONI no hace nada". No afecta a Dirección. **Verificar** qué permiso tiene el rol Diseño.

---

## 2. ¿La merma / sobrante / aprovechamiento son reales? (`src/motor/politicaMerma.js`, `calculo.js`)

| Concepto | ¿Real? | Nota |
|---|---|---|
| Merma A14 (½/1 hoja a 1.50 m, pintura 8 m²/kg, D2 tubular 6.94%, tramo 6 m) | **REAL** | Documento Rogelio/Alba, aprobado por Dirección. |
| Nesting real (`piezasPorTablero`: rejilla, kerf 6 mm, recorte orilla 10 mm, veta) | **REAL** | Es geometría, no supuesto. Donde hay medidas, la hoja la decide el motor. |
| Fracción de hoja | **REAL** | Sale de la rejilla; A14 pone piso ½/1 hoja. |
| Sobrante/desperdicio | **REAL** | comprado − neto, con precio. Material de inventario guarda el sobrante (no redondea a la alza en falso). |
| Tramo por pieza (tubo 6 m costeado por fracción) | **REAL** | D2. |
| Unidades (candado P0-02: bloquea m² × $/hoja sin formato) | **REAL** | Fail-closed. |
| **Aprovechamiento 80% + eficiencia 80%** | **SUPUESTO** | Marcado "dato supuesto" en `PARAMETROS_DEFAULT`. Solo aplica a piezas **sin geometría** (retazos/canto suelto); las piezas con medida usan la rejilla real. |
| Pintura tubular = 8 m²/kg (igual que plana) | **DECISIÓN de Dirección** | "Producción dijo que rinde menos, sin cifra". No es medición. |

**Hueco real de perfección:** `esPinturaPolvo` solo reconoce ids curados (`pintura-polvo*`); **no** reconoce la pintura ERP. Si el puente amarra una pintura ERP, la regla A14 de pintura podría no aplicarse. (Hoy menor, porque el puente está bloqueado por §1.)

---

## 3. ¿La mano de obra es real?
- Dos métodos: **Alba** (% por material, calibrado al centavo contra la tabla de Alba) e **Intelisis** (horas × tarifa × GIF).
- **Techo de datos (honesto):** no hay **tiempos reales por operación** (solo "~30 s/op" del documento). La nómina real no está en el código (params en 0; se carga de tabla con rol). Alba es una fórmula %, no tiempos medidos. Es la mejor aproximación con los datos de hoy; "perfecto al centavo" en MO no es posible sin que Producción mida tiempos.
- Indirectos/GIF (34%, o Alba 3×MO, o Intelisis por hora): cuadra con EEFF (~50% uplift) en las validaciones previas.

---

## 4. Gates / fail-closed — lo mejor del sistema
- **Nunca $0:** precio no finito o costo corrupto → `NaN`/`null`, jamás un $0 barato (`precioDe`, `precioVenta`).
- **`costeoEmitible`** (único juez): bloquea por material/precio faltante, formato que no cabe, tarifas faltantes, material por confirmar, costo no finito.
- **Material cruza familia NUNCA se auto-sustituye** (requiere confirmación humana; `ENGINEERING_OVERRIDE` explícito para cruzar).
- **Servidor autoritativo** (`costeoServidor.js`): `reconciliarMaterialServidor` recalcula la clase de CADA componente desde `material_solicitado` sin confiar en el navegador; `catalogo_motor` resuelve por id los ERP amarrados; un browser que falsee `material_match='EXACT'` no se salta el gate. Fallback nunca certifica; frescura avisa precios viejos; aprobación humana verificada por rol + `cuentas_no_humanas`.

Calificación de los gates: **9/10** (sólidos; el −1 es el hueco de pintura ERP de §2 y el silencio del `catch` de §1).

---

## 5. Mi puente en `analizar-mueble-rc`: ESTABA EQUIVOCADO
- Diagnostiqué que el bug era `neq.erp` en `analizar-mueble` (la IA ciega al ERP) y construí `resolverMaterialesERP` para amarrar ERP en la propuesta del servidor.
- **Es redundante:** el cliente ya amarra con `amarrarPendientesERP`/`gemeloErp`, mejor (compatibilidad de unidad, gemelo, fusión que no pisa ediciones del usuario), y esos archivos **ya están en la rama de prod**.
- **Es ciego al mismo defecto:** mi puente usa el mismo `buscar_insumos_motor` → choca con el mismo muro `activo=false`. **No resuelve el síntoma reportado.**
- **Recomendación:** **no promover** `analizar-mueble-rc` por este cambio; abandonar/revertir el puente (queda a tu decisión; no lo revertí ni desplegué nada).

---

## 6. Qué sí arregla el problema (orden de impacto; nada hecho aún, requiere tu autorización)
1. **Reactivación quirúrgica** de los ~18 insumos con precio y compra reciente mal apagados (+ los que aparezcan en BOMs reales actuales). Reversible. Hace que el puente EXISTENTE los encuentre. **No reactivar los 1,090 viejos.**
2. **Opción de motor:** que `buscar_insumos_motor` surface un precio certificado-pero-inactivo con bandera "revisar" en vez de esconderlo en silencio (decisión de diseño; más grande).
3. **Error de unidad de 100× en espuma `MVLREF00634532`** ($750 vs $7.50 real): decisión de Compras sobre la unidad correcta.
4. **Pintura ERP + A14:** que `esPinturaPolvo` reconozca la pintura ERP si el puente llega a amarrarla.
5. **Verificar el permiso del rol Diseño** para `buscar_insumos_motor` (que no falle en silencio).

---

## 7. Calificación honesta (1–10)
- Motor de material + merma + nesting: **9/10** (real; −1 por los supuestos de aprovechamiento/eficiencia donde no hay geometría, que están bien marcados).
- Gates / fail-closed / servidor autoritativo: **9/10**.
- Mano de obra: **6/10** (buena fórmula, pero techo de datos: sin tiempos reales medidos no hay "perfecto").
- Que VONI **use los precios de Compras hoy**: **4/10** — la arquitectura existe pero el filtro `activo` esconde precios reales; es visibilidad de datos, no cálculo.
- Mi puente de esta tanda: **2/10** (redundante y ciego al bug real; buena noticia: la auditoría lo cazó antes de desplegarlo).
