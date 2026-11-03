# 95_POSTDEPLOY_HERRAJES_AUDIT — auditoría económica de la reclasificación de herrajes (FASE 1, 2026-11-03)

Cambio en producción (`f0056a5`): la sección `herrajes` pasó de 'general' (MO 20% / GI 3×MO = 60% del material) a
**compra-venta (MO 1% / GI 5% del material)** en la estimación de Alba, y se resta de la base de MO en la ruta de factores
explícitos. Esta auditoría NO acepta "bajó el costo" ni "4,020 tests" como prueba; compara contra operaciones reales y criterio.

## 1. Qué ítems se reclasificaron (alcance real)
Sección `herrajes` del catálogo curado = **solo hardware COMPRADO, ninguno fabricado**:
`corredera, bisagra, jaladera, nivelador, rodaja, cerradura, cerradura-electronica (StealthLock), riel, escuadra, tornilleria`.
- La **caja de cajón** (melamina) NO está en herrajes: vive en su sección fabricada y **conserva su MO de fabricación**.
  Por tanto el cambio NO quita el armado del cajón; solo cambia la corredera/jaladera/cerradura que se le montan.
- Alcance correcto: el cambio toca lo que se compra e instala, no ensambles fabricados.

## 2. Antes/después por componente (analítico, al material M)
| | MO | GI | Fabricación | Δ fab |
|---|---|---|---|---|
| Antes (general) | 0.20·M | 3×MO = 0.60·M | **1.80·M** | — |
| Después (compra-venta) | 0.01·M | 0.05·M | **1.06·M** | **−0.74·M (−41%)** |
El **precio de compra del herraje (M) queda ÍNTEGRO**: el motor hace `materialDirecto/Indirecto += r.costo` con `r.costo = comprado × precio`, y `SIN_MO_SECCIONES` SÓLO afecta MO/GI y la base de MO — estructuralmente NO toca el precio de material. (Punto 1 ✓, demostrado por construcción, no por que bajó.)

## 3. Verificación de los 10 puntos
1. **Precio de compra íntegro** ✓ — estructural (ver §2); el material no pasa por `SIN_MO_SECCIONES`.
2. **Montaje/colocación no desaparece** ⚠️ **PUNTO A VALIDAR POR INGENIERÍA.** La MO estimada del hardware cayó 20%→1%.
   Las **Maniobras (3%, nivel proyecto)** son instalación EN OBRA, no armado de fábrica. El armado de fábrica del herraje
   (montar corredera/bisagra/cerradura) **ya no se cuenta explícitamente** en la estimación de Alba. Ver §4.
3. **MO no se cuenta dos veces** ✓ — el cambio REDUCE MO; no introduce doble conteo.
4. **Indirectos no se omiten mal** ⚠️ — GI del herraje bajó 60%→5% del material. Es el criterio de compra-venta de Alba
   (traslado), pero es una reducción real; ver §4.
5. **Maniobras ≠ instalación de fábrica** ✓ (no se confunden en el código: maniobras es comercial nivel-proyecto; MO de
   herraje es por-pieza) — pero el *armado de fábrica* del herraje queda en tierra de nadie (§4).
6. **Rutas Alba/clásico/Intelisis** ✓ — el cambio actúa en la ruta Alba (`manoObraGiAlba`→compraventa) y en la de factores
   explícitos (`materialSinMO`). La ruta **Intelisis NO se toca**.
7. **App LT / horas medidas sin cambio** ✓ — modo `horas` usa `manoObraPorHoras` (horas×tarifa) y GIF `gifPorHoras`;
   ninguno lee `SIN_MO_SECCIONES`. Verificado en matrizGolden: applt/app/mox NO cambiaron (0 Δ).
8. **Ningún presupuesto comercial vigente cambia en silencio** ✓ — los **precios de LÍNEA** (`PRECIOS_LINEA`) son
   documentados, NO se re-derivan del motor; un producto de línea cotiza su lista, no el motor. Solo cambian los costeos
   A LA MEDIDA nuevos (COSTEAR de especiales).
9. **Revisiones antiguas conservan su economía** ✓ — las cotizaciones guardan su snapshot económico (VH-035/SEG-01); reabrir
   muestra el número guardado, no recomputa con la fórmula nueva. (A re-verificar en vivo en FASE 6.)
10. **Piso comercial y aprobaciones válidos** ✓ — `minMarkupLinea`/`margenMinimo` son % sobre costo/precio, intactos; las
    aprobaciones de `insumo_precios` no se tocan.

## 4. El único hallazgo real (honesto): política, no mecánica
La mecánica es correcta y acotada. El punto que NO cierra "bajó el costo / pasaron los tests" es el **criterio**:
- La compra-venta de Alba (1%/5%) está calibrada "al centavo" contra su T.D.C. para **kit LED, logos, gráficos, guardas
  armadas** (su "id_02 compra-venta"). **Herrajes no estaba explícitamente en esa lista.**
- Montar una corredera, una bisagra o una cerradura SÍ lleva trabajo de fábrica (barrenar, atornillar, alinear, ajustar).
  Tratarlo como traslado puro (1% MO) **puede subcostear ese armado** en la estimación pura (no en órdenes con horas medidas,
  no en productos de línea con precio documentado).
- **Magnitud:** cada herraje aporta ahora 1.06·M en vez de 1.80·M. En las familias con más herrajería el costo total baja
  hasta −4.64% (modulor/gaveta). Si el armado real del herraje vale más que 1% de su material, la estimación lo subcuenta.

## 5. Veredicto y recomendación
- **Mecánicamente: CORRECTO y acotado** (solo hardware comprado, precio íntegro, Intelisis/horas/línea intactos, snapshots
  protegen revisiones).
- **Como política: REQUIERE SIGN-OFF DE ALBA / INGENIERÍA.** La pregunta "¿un herraje montado en fábrica vale 1% de MO (como
  un logo) o lleva armado real?" es de Ingeniería, no se cierra con los tests. No la cambio unilateralmente (regla: no tocar
  política oficial sin aprobación).
- **Opciones de fix si Ingeniería dice que hay armado real (RED→GREEN listo para implementar):**
  (a) una tasa de MO específica de herrajes entre 1% y 20% (p. ej. la que Alba calibre con su T.D.C. real);
  (b) una línea de "armado de herrajes" separada del traslado;
  (c) dejarlo en compra-venta si Ingeniería confirma que el armado de hardware ya está en las horas medidas de las órdenes
      reales (y la estimación pura es solo un preliminar que se reemplaza por la orden).
- **Mientras tanto NO hay subcosteo peligroso** porque: ningún precio de material se tocó, las líneas usan precio documentado,
  y el fail-closed sigue bloqueando lo incompleto. El riesgo es un preliminar de estimación ~1-5% bajo en especiales con mucha
  herrajería — acotado y reversible (quitar `'herrajes'` del Set + restaurar 16 goldens).

## Pendiente humano concreto → RESUELTO
Alba / Ingeniería: ¿el armado de fábrica de herrajes (correderas/bisagras/cerraduras) es traslado puro (1% MO) o lleva labor?
De su respuesta sale el fix (a/b/c) o la confirmación de dejarlo. Es la única pregunta abierta de este release.

**DECISIÓN (2026-11-03, Rodrigo del Castillo, Dirección): SE DEJA.** Herrajes permanece en compra-venta (MO 1% / GI 5%),
opción (c): Dirección confirma el criterio. Queda documentado el riesgo acotado (estimación pura de especiales con mucha
herrajería ~1-5% baja; líneas y órdenes con horas no afectadas; reversible). No se abre fix (a) ni (b). Punto cerrado.
