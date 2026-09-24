# Export de Intelisis para calibrar el Costeador (piloto 5 familias)

**Para:** quien opera Intelisis (vía Rafa / Compras / Producción).
**Objetivo:** cargar 5 familias piloto con datos REALES para que el Costeador
pase de "estimado honesto" a "fidelidad medida contra la operación".
**Formato:** un Excel por cada bloque de abajo (o pestañas en un solo libro).
Una fila por registro. Si un dato no existe, dejar la celda **vacía** — NO
inventar. Es mejor un hueco visible que un número falso.

## Familias piloto (elegidas por cobertura: madera, metal, guarda, especial)
1. **App LT** (benching — metal + melamina) — ya parcialmente calibrada, sirve de control.
2. **Eclipse** (ebanistería/chapa — la de mayor valor).
3. **Una mesa** (junta o consejo).
4. **Modulor** (guarda: archivero/gaveta/locker).
5. **Un especial** reciente con orden cerrada (ej. la banca aeropuerto C-CO-510R).

---

## 1) Maestro de materiales (insumos)
Una fila por artículo de materia prima que usan esas 5 familias.
| Columna | Ejemplo | Nota |
|---|---|---|
| clave_erp | MVLSLA05261100 | SKU exacto de Intelisis |
| descripcion | LAMINA NEGRA 3X10 CAL 10 | como la llama el ERP |
| proveedor | — | quién la surte |
| unidad_compra | hoja / tramo / kg / m / pza | **la de la factura** |
| unidad_consumo | m² / m / pza | cómo se usa en el mueble |
| conversion | 1 hoja = 2.9768 m² | **explícita** (chapa por m² vs por hoja son 2 precios distintos) |
| precio | 2016.80 | última compra |
| moneda | MXN / USD | |
| vigencia | 2026-03-23 | fecha del precio |
| evidencia | folio de compra / OC | de dónde salió |

## 2) Recetas / despiece aprobado (por producto y variante)
Una fila por componente de cada producto piloto.
| Columna | Ejemplo | Nota |
|---|---|---|
| producto | Eclipse Escritorio Directivo 2.40 | |
| variante | chapa / walnut, mano D/I, espesor | la que fija el pedido |
| version_receta | v1 (2026-09) | para versionar |
| componente | Cubierta / Lateral / Cajón… | |
| clave_material | (clave_erp de arriba) | |
| cantidad | 0.8 | en unidad_consumo |
| merma_% | — | si la conocen |

## 3) Operaciones y tiempos por centro de trabajo
Una fila por operación de cada producto piloto.
| Columna | Ejemplo | Nota |
|---|---|---|
| producto / version_receta | | liga con la receta |
| operacion | Corte / Canteado / Armado / Pintura / Tapicería | |
| centro_trabajo | Carpintería / Pintura / Acabados… | |
| horas | 4.5 | por pieza |
| tarifa_hora | — | $/h de ese centro (o dárnoslo aparte) |
| preparacion_horas | 0.5 | arranque de lote |

## 4) Indirectos y su reparto (una sola hoja, la define Dirección)
| Concepto | Valor | Nota |
|---|---|---|
| base_de_reparto | % sobre material / sobre MO / por hora | **la aprobada** |
| tasa | 34% (¿o cuál?) | hoy la app usa 34% plano |
| gastos_operacion_% / utilidad_% / factor_lista | | la cascada real de precio |

## 5) Órdenes cerradas (para MEDIR fidelidad) — lo más importante
2-3 órdenes YA TERMINADAS por familia, con lo REAL incurrido.
| Columna | Ejemplo | Nota |
|---|---|---|
| orden / producto / cantidad | | |
| material_real | consumo × precio real | de Compras |
| mano_obra_real | horas reales × tarifa | de Producción |
| indirectos_real | | |
| costo_total_real | | contra esto se mide el estimado |
| precio_vendido | | |

---

## Qué hago yo en cuanto llegue cada bloque
- **Bloque 1 (materiales):** escribo el ingester (patrón `scripts/genera-precios-linea.py`),
  normalizo unidades/conversiones y marco cada precio con su fuente/vigencia. El
  medidor de "Confianza del costeo" sube a verde en esas familias.
- **Bloque 2-3 (recetas/tiempos):** reemplazo la receta estimada de esas 5 familias
  por la aprobada, versionada.
- **Bloque 4 (indirectos):** calibro el 34% contra la política real (sin sobreajustar).
- **Bloque 5 (órdenes cerradas):** mido error estimado-vs-real por componente y
  familia — la métrica que decide si es "la mejor". La banca C-CO-510R ya es la
  primera ancla (ver `src/datos/banca.caracterizacion.test.js`).

**Regla de oro:** ningún número entra a la app sin fuente. Un hueco se queda como
"costo desconocido" (la app ya lo muestra honesto), nunca como cifra inventada.
