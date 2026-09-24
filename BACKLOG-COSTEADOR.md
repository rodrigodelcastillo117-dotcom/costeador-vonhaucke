# Backlog Costeador Vonhaucke — mandato autónomo

Convierte el mandato "app de referencia mundial" en trabajo ordenado por
dependencia y prioridad, con **estado verificado contra el código/DB reales**
(no contra los hallazgos históricos, que en varios casos ya se corrigieron).

Leyenda: ✅ hecho y desplegado · 🔧 hecho parcial · ⛔ bloqueado (con causa) ·
🚫 fuera de alcance · ⬜ abierto.

Corte de verificación: **2026-09-24**. Repo real, Supabase `mtuvnbgljwbsaizjjgzs`,
live en costeador-vonhaucke.vercel.app.

> **Exclusión vigente en TODAS las fases:** no se tocan contraseñas, rotación de
> credenciales, ni el flujo de creación/recuperación/login por contraseña ni las
> credenciales temporales. Riesgos ahí se documentan como 🚫, sin exponer secretos.

> **Realidad operativa:** el deploy es `npx vercel --prod` directo desde la Mac
> (no auto-deploy por git). **Git está bloqueado** (`sudo xcodebuild -license
> accept` pendiente, requiere password del usuario) → **0 commits**; todo lo
> "hecho" está DESPLEGADO pero sin historial en git. Este es el bloqueo #0.

---

## Fase 1 — Integridad y acceso

| ID | Estado | Nota verificada |
|---|---|---|
| Cantidad no se pierde (Voni/catálogo/banco) | ✅ | `costearItem()` perdía `cantidad` en la rama de match de catálogo → arreglado + piso defensivo en `partidasDeItemsIA`. Test `lineas.test.js` "P0 nunca pierde la cantidad". |
| Separar precio vs costo vs derivado vs desconocido | 🔧 | Ya existen `deBanco`, `costoDerivado`, y `sinCosto` (Cotizacion muestra `≈` y no finge margen). **Falta** unificarlos en un solo `estadoFuenteCosto: real\|estimado\|derivado\|desconocido` y que los **agregados** (utilidad total) excluyan/distingan derivados. |
| Cálculo de dinero centralizado, cuadra al centavo | ✅ | **Nuevo `src/datos/totales.js` = autoridad única.** Antes la escalera estaba en 3 lados; el total GUARDADO era la suma cruda sin descuento/IVA. Ahora pantalla, PDF y guardado usan la misma función; el Archivo muestra el total emitido real. Tests `totales.test.js` (9) + `cotizaciones.test.js` corregido. FIX-05/CST-02. |
| Margen mínimo 25 vs 40 | ✅ | Unificado a **25** (decisión de Rodrigo) en `reglas.js`, `calculo.js`, `senales.js`, `Guia.jsx`. Pendiente: que Dirección lo apruebe como política versionada (ver Fase 1 → reglas). |
| **Costos fuera del alcance de Ventas (FIX-06)** | ⛔ | **CONFIRMADO real en RLS:** `config` (insumos con costos + parametros con márgenes) es legible por todo autenticado (`config_leer → puede_entrar()`); `cotizaciones` embebe `costoUnitario`. **Arreglo correcto = mover costeo al servidor (CST-01) + partir config + RLS + probar 3 roles.** Bloqueado por: (a) arquitectura cliente-side actual necesita costos en el navegador; (b) no hay sesiones reales de Ventas/Diseño/Dirección para probar sin romper al equipo. |
| Proteger `generar-render` y funciones IA | ⬜/❓ | Sigue sin verify_jwt. El mandato pide protegerla; Rodrigo dijo antes "déjala". **Conflicto de instrucciones → requiere confirmación** antes de tocar (podría romper renders). |
| Revisar funciones SECURITY DEFINER | 🔧 | Advisor confirma `es_direccion()`, `puede_editar_config()`, `puede_entrar()` ejecutables por anon/authenticated vía RPC. Solo devuelven booleanos del propio rol → riesgo bajo, pero conviene `REVOKE EXECUTE` a anon. Migración pequeña, no rompe la app (el cliente no las llama por RPC, las usa RLS). Candidato seguro. |
| `aprendizajes` abierto a todos | ⬜ | RLS: lectura/escritura/update `true` para todo autenticado. Cualquier usuario puede alterar aprendizajes. A cerrar a diseño/dirección. |
| Contraseñas recuperables / leaked-pw protection | 🚫 | Fuera de alcance por exclusión. `credenciales_temporales` ya está cerrado a `es_direccion()`. |

## Fase 2 — Fuente de verdad del costo
| ID | Estado | Nota |
|---|---|---|
| Maestro de materiales (SKU, unidades, conversión, proveedor, vigencia) | ⛔ | Necesita export de Intelisis. Spec entregada: `EXPORT-ERP-INTELISIS.md`. Hoy `insumos.js` tiene 122 insumos; ~81/236 sin `fuente`. |
| BOM/despiece versionado por config y lote | ⬜ | Hoy las recetas viven en código (`lineas.js` + módulos por línea). Falta versionado con motivo/histórico. |
| Ruta de producción (centro, tiempo, tarifa) | ⬜ | El modo `intelisis` existe (horas×tarifa) pero sin datos reales de tiempos. |
| Contrato único de cálculo en servidor + snapshot con huella | ⛔ | = CST-01, mismo bloqueo que FIX-06 (costeo server-side). `huella_mp` ya existe para MP. |
| 5 familias piloto + órdenes cerradas | ⛔ | Bloqueado por datos ERP. Banca C-CO-510R ya es la 1ª ancla (`banca.caracterizacion.test.js`). |

## Fase 3 — Cotizador de proyecto completo
Entidad `proyecto` unificada, Voni estructurado, acomodo/plano, flujo
borrador→emitido inmutable→revisión, PDF desde snapshot. **Estado:** ⬜ mayormente
por construir; partes existen (Voni, acomodo, PDF, estados comerciales parciales).
Depende de Fase 2 (motor) para no construir sobre totales que pierden datos.

## Fase 4 — Fábrica y aprendizaje
Paquete de producción, consumo/horas reales, conciliación estimado-vs-real,
indicadores por familia. **Estado:** ⛔ depende de órdenes cerradas del ERP.

## Fase 5 — Capacidades diferenciadoras
Configurador paramétrico, cotizar desde presupuesto del cliente, compras/promesa
de entrega, incertidumbre explicable, propuesta interactiva, salida CAD/CAM,
aprendizaje con evidencia. **Estado:** ⬜ posterior; requiere Fases 2-3 sólidas.

## Fase 6 — Demostrar con proyectos reales
Proyectos ciegos, medición vs línea base manual, benchmark vs CET/Microvellum/
Tacton/Fusion. **Estado:** ⬜ requiere el motor calibrado y usuarios reales.

---

## Bloqueos exactos (para desatorar)
0. **Git** — `sudo xcodebuild -license accept` (password de Rodrigo). Sin esto, 0 historial.
1. **FIX-06 / CST-01** — decidir mover costeo a servidor; y conseguir sesiones de
   prueba de los 3 roles antes de tocar RLS/acceso.
2. **Datos ERP (Intelisis)** — export de `EXPORT-ERP-INTELISIS.md` (Rafa/Compras/Producción).
3. **`generar-render`** — confirmar si se protege (conflicto: mandato sí, Rodrigo antes "déjala").
4. **Política de márgenes/indirectos** — Dirección/Finanzas aprueban 25% y la base de indirectos.

## Próxima acción concreta (no bloqueada, code-only, verificable)
Unificar `estadoFuenteCosto` (Fase 1) + hacer que la **utilidad agregada** de la
cotización excluya/distinga costos derivados y desconocidos — hoy los mezcla.
