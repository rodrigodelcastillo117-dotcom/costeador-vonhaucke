# 95_SCORECARD — matriz de áreas (meta ≥95/100 REAL por área)

**Fecha de corte:** 2026-10-29 · Base: `95_AUDIT_BASELINE.md` (prod `fece6c3`, rama `d031cff`).
**Regla:** el score no se manipula. `SIN MEDIR` = no se ha ejercitado la app corriendo; **no es un número**.
Un área sólo sube de `SIN MEDIR` a un número cuando hay evidencia E2E (navegador/preview) o prueba real.

Leyenda columnas: **Dato/Código/UX/E2E/ProdVerif** = ✅ verificado · ⚠️ parcial · ❌ falta · `—` no aplica aún.

| # | Área | Score | P0 | P1 | P2 | Dato | Código | UX | E2E | ProdVerif | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | INICIO | SIN MEDIR | — | — | — | — | — | ❌ | ❌ | ❌ | No ejercitado. |
| 2 | COSTEAR | SIN MEDIR | sí | — | — | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | Motor avanzado sólo en `-rc`; prod=v17. Puente clave→insumo 0 aprobado. |
| 3 | COTIZAR | SIN MEDIR | sí | — | — | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | P1 limbo texto→plano por confirmar. `-rc` vs prod. |
| 4 | COCREAR | SIN MEDIR | — | — | — | — | ⚠️ | ❌ | ❌ | ❌ | Costo cocrear server-side sólo en `-rc` (ver nube.js:604). |
| 5 | ACOMODO | SIN MEDIR | sí | — | — | — | ⚠️ | ❌ | ❌ | ❌ | prod usa `acomodar-espacio-recovery` v19. Paridad cliente/servidor SIN MEDIR. |
| 6 | RENDERS | SIN MEDIR | — | — | — | — | ⚠️ | ❌ | ❌ | ❌ | Identidad canónica + stale: código existe (migraciones), E2E SIN MEDIR. |
| 7 | VONI | SIN MEDIR | — | — | — | — | ⚠️ | ❌ | ❌ | ❌ | voni-council v14 vivo; council real SIN MEDIR. |
| 8 | INSUMOS/ERP/PRECIOS | ~70 (prov.) | — | sí | — | ✅ | ✅ | ❌ | ❌ | ⚠️ | 10,185 activos; 30% CERT / 70% PRELIM; autoridad server-side ✅. UX SIN MEDIR. |
| 9 | CATÁLOGO/PRODUCTOS | SIN MEDIR | — | sí | — | ⚠️ | — | ❌ | ❌ | ❌ | Legacy grande; migración canónica incremental pendiente. |
| 10 | ARCHIVO/REABRIR | SIN MEDIR | — | sí | — | — | ⚠️ | ❌ | ❌ | ❌ | Control optimista VH-148 ON en prod (código). Reabrir/concurrencia SIN MEDIR. |
| 11 | PDF/EMISIÓN | ~88 (prov.) | — | sí | — | ✅ | ✅ | ❌ | ❌ | ✅ | Gate server-side verificado: economía incompleta→ECONOMICS_INCOMPLETE, identidad ligada, precio autoritativo, wrapper no bypass ✅. Falta UX/E2E "TOTAL INCOMPLETO". |
| 12 | SEGURIDAD | ~90 (prov.) | — | sí | — | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | Autoridad server-side ✅; seller-safe ✅; RLS money/propiedad auditada: sin IDOR a nivel tabla ✅. Falta prueba viva 2-JWT + RPC cotizaciones_mias. |
| 13 | MOBILE | SIN MEDIR | — | — | sí | — | — | ❌ | ❌ | ❌ | No probado en viewport real. |
| 14 | RELEASE/INFRA | ~60 (prov.) | sí | — | — | ✅ | ⚠️ | — | ❌ | ⚠️ | Prod corre edges viejos; `-rc` no promovido. Falta RELEASE_MANIFEST + mapa fn→edge→hash. |

## Scores provisionales — justificación (sólo donde hay evidencia dura)
- **INSUMOS ~70:** datos y autoridad verificados reales; baja por 70% PRELIMINAR y 0 mapeos aprobados y UX/E2E sin medir. No es 95.
- **SEGURIDAD ~85:** lo verificado está bien hecho (autoridad server-side, seller-safe, RLS default-deny). No llega a 95 hasta probar BOLA/IDOR por objeto y emisión server-side en E2E real.
- **RELEASE ~60:** el tema de fondo (prod ≠ RC) y la falta de manifiesto fn→edge→versión→hash lo mantienen lejos de 95.
- Las 12 restantes: **SIN MEDIR**. No pongo número sin E2E. Darles 90 "porque el código se ve bien" sería exactamente lo que la orden prohíbe.

## Resultado P0 seguridad + pruebas (2026-10-29, verificado)
- **Suite completa: 406 archivos, 3,994 pruebas, TODAS verdes** (exit 0, 197s), tras quitar 3 worktrees
  duplicados de `.claude/worktrees` que inflaban el conteo y la corrida. CI de prod/rama también verde.
- **Auditoría RLS BOLA/IDOR (tablas dinero/propiedad):**
  - `cotizaciones` SELECT = `puede_editar_config()` (rol direccion/diseno) **AND** aislamiento qa
    (RESTRICTIVE). El vendedor **no** lee la tabla cruda; usa la RPC segura sin economía. **Sin IDOR.**
  - `producto_version_economia` = `puede_ver_economia()` = **solo direccion**. Diseño NO ve costos.
  - `insumo_precios` / `expediente_revisiones` = gateadas por rol. `renders` = acotada al dueño.
  - `cocrear_costeo_servidor` / `costeos_servidor` / `partida_costeo_vigente` = RLS deny-all (solo servidor). Correcto.
  - **No se encontró hueco abierto.** Pendiente para 95 pleno: prueba viva 2-JWT por REST + acotamiento
    por dueño dentro de `cotizaciones_mias`.

## Resultado P0 emisión (2026-10-29, verificado leyendo `private_api.evaluar_emision_cotizacion`)
Recalcula todo server-side desde la cotización guardada; NO confía en la economía del cliente.
- Costo desconocido/preliminar/no certificado ⇒ `ECONOMICS_INCOMPLETE` (nunca TOTAL falso ni $0).
- Renglón del snapshot debe SER lo costeado (identidad + `campos_partida_no_corresponden`) ⇒ si no, `BLOCKED`.
- Precio especial recalculado y autoritativo (rechaza `precio_especial_no_autoritativo` si el cliente lo cambió).
- Bajo costo / margen < mínimo / reventa sin piso ⇒ `APPROVAL_REQUIRED`.
- Wrapper `public.emitir_revision_v2` sólo valida sesión y delega al núcleo SECURITY DEFINER ⇒ sin bypass del cliente.
- Respaldado por `seguridadGateEmisionSnapshot.test.js` (55 pruebas, incluye prueba de rollback que reintroduce el defecto).
- **Pendiente 95 pleno:** E2E de que la UI muestre "TOTAL INCOMPLETO" (no un total) ante `ECONOMICS_INCOMPLETE`.

## Orden de ataque (FASE 2→6 de la orden)
1. **FASE 0/1 (hecho):** baseline + scorecard reales.
2. **Medición real primero:** levantar preview de esta rama (CARRIL_RC) + correr suite de pruebas + leer CI. Convierte 12 `SIN MEDIR` en números con evidencia.
3. **P0 (datos/seguridad/emisión/cálculo):** puente clave→insumo; paridad prod-edge vs `-rc`; BOLA/IDOR; emisión "TOTAL INCOMPLETO".
4. **P1 (flows rotos):** limbo texto→plano (COTIZAR), reabrir/concurrencia, acomodo paridad, mesa redonda (PR #82).
5. **FASE 4 datos canónicos / FASE 5 UX / FASE 6 certificación.**
6. **95_RELEASE_MANIFEST.md + 95_BLOCKERS.md** (lo que requiera decisión humana, separado).

**Decisión de Dirección que condiciona el objetivo (no la tomo yo):** ¿el "95 en producción" se certifica
promoviendo los edges `-rc` a prod (con su certificación, §100), o se mide sobre un preview-RC equivalente?
Hasta esa decisión, mido sobre preview-RC y dejo el release listo, sin deploy productivo.
