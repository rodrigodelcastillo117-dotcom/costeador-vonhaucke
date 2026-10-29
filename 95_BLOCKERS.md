# 95_BLOCKERS — lo que requiere decisión humana (no lo puede cerrar la sesión)

**Fecha:** 2026-10-29. Estos puntos están FUERA de lo que puedo cerrar solo: cambian producción,
mueven dinero/aprobaciones, o exigen una persona real de Dirección. Los separo como pide la orden.
Nada de esto se ejecutará sin tu autorización explícita (§100).

---

## B1 · [GATE DEL OBJETIVO] Producción corre edges viejos; el motor avanzado está en `-rc`
- **Qué:** prod invoca `costear-servidor` v17 / `analizar-mueble` v38. El motor mejorado vive en
  `costear-servidor-rc` v30 / `analizar-mueble-rc`, que prod **no** usa (CARRIL_RC off en prod).
- **Por qué te toca a ti:** promover `-rc` a producción cambia el cálculo de costos vivo (§100).
- **Opciones (tú eliges):**
  1. **Certificar sobre preview-RC y dejar el release listo** (lo que haré por defecto; sin deploy).
  2. Promover `-rc` a prod tras certificación y tu OK (ventana controlada, con rollback).
  3. Dejar prod como está y medir el 95 sobre prod-viejo (no recomendado: congela el avance).
- **Mi recomendación honesta:** opción 1 ahora; opción 2 cuando tú autorices la ventana.

## B2 · Aprobar el puente clave-externa → insumo (0 aprobados hoy)
- **Qué:** `insumo_mapeos_externos` = 42, todos `propuesto`, **0 aprobado**. Incluye los 25 de TELSVH120.
- **Por qué te toca:** aprobar precios/mapeos exige rol `direccion` humano (la función excluye
  cuentas no-humanas; `qa-direccion` NO sirve, por diseño correcto).
- **Acción:** una persona de Dirección aprueba los mapeos con evidencia (RPC `aprobar_mapeo_externo`).

## B3 · Cargar los 4 especiales de TELSVH120 por el flujo formal
- **Qué:** capelo cristal, placa serigrafía, cerradura cam-lock, kit LED — precios reales ya
  documentados (`lab/costear_golden/TELSVH120_4_ESPECIALES_PRECIO_REAL.md`).
- **Por qué te toca:** alta de precio por Compras/ERP (`cargar_erp_ultima_compra`), rol Dirección.
  (Probado hoy: NO se cargan a mano; los triggers/append-only lo deforman.)

## B4 · [P0-03] Auditoría de precios "aprobados por qa-direccion"
- **Qué:** histórico de ~1,763 precios aprobados por cuenta no-humana (tarea #14). El fix de autoridad
  ya impide que siga pasando; falta decidir qué hacer con los históricos (re-firmar por humano o marcar).
- **Por qué te toca:** es una decisión de confianza económica de Dirección.

## B5 · Migraciones/datos preparados pero NO aplicados a prod (§100)
- Backfill de atributos de catálogo (espesor/calibre/material/familia) — paquete revisable listo
  (commit `b50deed`), **no aplicado**. Deja medio ciego al motor hoy.
- Cualquier cambio de gate de emisión (reventa-sin-piso ya aplicado; futuros, con tu OK).
- **Por qué te toca:** cambian datos/lógica de producción.

## B6 · Política de frescura de precios (contrato Dirección)
- Definir tramos OFICIAL/CERTIFICADO/VIGENTE/ANTIGUO-APROBADO/PRELIMINAR/NECESITA-COMPRAS/SIN-COSTO
  (≤24 / 25–60 / 61–120 / >120 meses). La app ya distingue; la **política final la fija Dirección**.

## B7 · Go-live / promoción de cliente a prod
- Cualquier `git merge` a `c3.4-seller-safe`, cambio de alias de producción o promoción de deployment.
- **Por qué te toca:** es deploy productivo. No lo haré sin tu autorización.

---

### Lo que NO está aquí (sí lo puedo hacer yo, sin tu decisión)
Medir sobre preview-RC, correr pruebas/E2E, reproducir bugs, escribir fixes en mi rama, preparar
migraciones reversibles sin aplicarlas, documentar, y dejar el release-candidate listo con su manifiesto.
