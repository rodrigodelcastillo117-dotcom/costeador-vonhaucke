# PLAN DE CARGA — precios reales al motor (para aprobación antes de tocar prod)

**Objetivo:** convertir la data real ya capturada (`lab/datos_reales_drive/`, `lab/precios_*`, `lab/compras_reales/`)
en costeo real, cargando los **precios vigentes por clave** al catálogo del motor, con gate humano y rollback.
**Nada de esto se ejecuta en producción sin tu autorización explícita.** Esto es el plan; la ejecución va por pasos.

Base: rama `claude/costing-app-architecture-psf02g`. Catálogo prod: `catalogo_vigente` (Supabase `mtuvnbgljwbsaizjjgzs`).

---

## 1. Qué ENTRA al catálogo y qué NO (separación honesta)

| Fuente real | ¿Entra al catálogo de COSTO? | Uso |
|---|---|---|
| `precios_vigentes_master.csv` (9,009 art. con costo + procedencia) | **SÍ** — costo de MP por clave | precio del insumo en el motor |
| Órdenes de Compra / entrada_compra 2025-26 (dentro del master) | **SÍ** (máxima prioridad) | precio "de hoy" |
| `cata_mp` (última compra, 2009-2026) | **SÍ sólo lo reciente**; viejo = marcado | precio con antigüedad |
| `claves_producto_precio_venta.csv` (994, precio de VENTA) | **NO** — nunca a costo de MP | referencia de venta, tabla aparte |
| **EEFF** (costo real empresa/línea: ventas $52.9M, MP 45.1%, MUEBLES $29.8M / SILLAS $3.9M) | **NO por artículo** | **BENCHMARK** para validar el costeo total |
| Reglas de merma/tiempos (Rogelio/Alba) | **YA está en el motor** (`politicaMerma.js` A14) | nada que cargar; sólo confirmar |

> **Hallazgo:** las reglas de merma reales (½/1 hoja por pieza grande, pintura 8 m²/kg, tubular 6 m, lámina 0.91/1.22 m)
> **ya coinciden** con lo que el motor aplica hoy. Esa mitad del "costeo real" está hecha y validada contra el documento.

## 2. Política de frescura / precedencia (por artículo, gana el real más reciente)
Orden: **Orden de Compra (transacción real)** > entrada_compra 2026 > `cata_mp` fecha reciente > histórico.
- Precio con última compra **< 2024 → se marca "viejo / por revisar"**: costea pero NO se emite en firme sin confirmación humana.
- **Nunca $0, nunca inventado.** Cada precio conserva su procedencia (archivo + fecha), ya está en el master.
- *Decisión tuya:* umbral de frescura (propuesta: 24 meses).

## 3. Mapeo de clave Intelisis ↔ insumo (el paso delicado)
La data real usa clave Intelisis (`MVL…`, clave_comercial); el catálogo del motor usa `insumo_id` (`erp-…`, curados).
**Metodología SEGURA (reusa `lab/precios_telcel/TELCEL_LOAD_PLAN.md`):** un artículo es **AUTO_CARGABLE** sólo si hay
**match EXACTO** (misma clave/artículo + opción) con precio numérico positivo y unidad usable. Si no → **NECESITA_HUMANO**.
**Cero** matches por descripción, familia o clave parecida. (En el ejercicio TELCEL: 49 auto-cargables / 9 humano de 58.)

## 4. Mecánica de carga (fail-closed, con gate humano)
1. **Staging primero:** tabla `precios_staging` con los propuestos + procedencia. NO toca `catalogo_vigente` directo.
2. **Dry-run / diff:** comparar propuestos vs catálogo actual → reporte "qué sube, qué baja, por cuánto". Ej. ya visto:
   `MVLMLP00280000` OC-2026 $410 vs catálogo $117.86 (**+248 %**); `MDMPRE02020102` +817 % (marcar: posible unidad distinta).
3. Los precios entran como **PRELIMINAR / propuesto** (`requiere_validacion_compras=true`), **NO** certificados para emisión.
   Un humano con rol dirección/compras los pasa a **CERTIFICADO** (`aprobar_precio`, por lote). El motor ya gatea:
   PRELIMINAR costea pero **bloquea emisión en firme** hasta aprobación. No se relaja ningún gate.
4. Migración **versionada + rollback** (igual que las ventanas previas).

## 5. Pasos concretos y qué necesita tu autorización
- **Paso A — SIN tocar prod (lo puedo hacer ya):** construir offline el **diff/staging** desde los masters contra el
  catálogo vivo (solo lectura) → te muestro: nº AUTO_CARGABLE, nº NECESITA_HUMANO, y los deltas de precio grandes.
- **Paso B — toca prod (requiere tu OK):** migración `precios_staging` + cargar los AUTO_CARGABLE como PRELIMINAR.
- **Paso C — humano (Compras/Dirección):** aprobar los precios (por lote) → CERTIFICADO.
- **Paso D — verificación:** re-costear TEVTSU / TELCEL / VENTO end-to-end y comparar contra los costeos reales
  ($47,432 / $55,395 / $56,674) y el **benchmark del EEFF** (estructura de costo 70.8 % / MP 45.1 %).

## 6. Gates de seguridad (constraints duras, intactas)
Nunca inventar precio · nunca $0 · nunca certificar con cuenta QA · fail-closed · nada se emite en firme sin aprobación
humana · precios de VENTA jamás como costo · datos bancarios/nómina excluidos · rollback listo antes de ejecutar.

## 7. Decisiones tuyas (para arrancar)
1. Umbral de frescura (propuesta 24 meses) y qué hacer con los `< 2024`.
2. Qué hacer con los **NECESITA_HUMANO** (los que no mapean exacto): ¿pedírselos a Daniel/Compras?
3. **MO/tiempos:** el único dato real es "30 s por operación" — demasiado grueso para regla de motor. ¿Se deja la
   estimación de MO actual (que ya usa la merma real) o Producción entrega tiempos por operación para afinarla?

**Recomendación:** apruebas este plan → hago el **Paso A** (diff/staging offline, sin tocar prod) y te traigo los números
exactos (cuántos entran, cuánto cambia el costo) para que decidas el Paso B con datos, no a ciegas.
