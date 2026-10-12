# OPERACIÓN RESCATE NOCTURNO · Von Haucke · 2026-10-12/13

Rama RC: `claude/costing-app-architecture-psf02g` · Producción auditada: `766df46` (Vercel READY, Supabase `mtuvnbgljwbsaizjjgzs`).
**Sin merge, sin deploy, sin migraciones aplicadas, sin cambios de precios/permisos/datos históricos.**

Numeración: esta matriz usa los IDs del mandato nocturno (VH-090…VH-107). Los IDs usados en RC-1 (`3b0020c`)
se citan como alias (p. ej. `VH-093-rc1 asientos` → ahora parte de VH-098; `VH-094-rc1 mensajes` → VH-093/VH-097;
`VH-095-rc1 mampara` → VH-094; `VH-097-rc1 unidades` → VH-099; `VH-098-rc1 fuente` → VH-101).

## FASE CERO · estado real (05:25 UTC)

| Qué | Valor |
|---|---|
| HEAD rama | `0e155a8` (5 commits sobre `cc1dc80` = producción + ledger) |
| Diff vs producción | 33 archivos, +1,074 / −55 (sin cambios de esquema aplicados) |
| Sin commit | 0 archivos |
| Edges en producción | costear-servidor v8 · cotizar-servidor v8 · acomodar-espacio-recovery v8 · leer-plano v11 · leer-plano-core v4 · analizar-mueble v34 · generar-render v30 · voni-council v12 |
| Edges con cambios en RC sin desplegar | costear-servidor, acomodar-espacio-recovery (kit-solver, opciones), leer-plano, leer-plano-core |
| Migraciones en repo NO aplicadas | `20261012060000_vh099_dimensiones_catalogo` (dimensiones PRELIMINAR) · `20261012061000_vh100_cargar_costos_oficiales` (economía por clave Intelisis) |
| Migración en repo sin registro en BD | `20261010170000_actualizar_cotizacion_preserva_economia` (ver nota abajo) |
| Suite | vitest 2,088/2,088 · Playwright local 28 PASS / 14 omitidos sin credenciales (+2 con credenciales: programaP01, programaVH090 PASS) · build PASS |
| Pasada en vivo (producción, QA) | 9 PASS / 2 FAIL por test (corregidos VH-096-rc1); re-corrida en curso |

Reproducido con evidencia (no hipótesis): VH-090, VH-091, VH-092, VH-093, VH-094 (cotización 757 real en BD + plano ARQ-01),
VH-099 (motor, prueba), VH-100 (SQL), VH-101 (código), VH-103 (cotizar-servidor en vivo), VH-097 (captura + código).
Hipótesis sin reproducir todavía: VH-096 (reparaciones del solver), VH-098 (PDF escaneado), VH-102 (BOM completo por tipología),
VH-105 (render al reabrir Cocrear), VH-106, VH-107.

## MATRIZ (se actualiza por bloque)

| ID | Sev | Módulo | Evidencia | Causa raíz | Archivos/RPC | Corrección | Tests | SHA | Estado | Riesgo |
|---|---|---|---|---|---|---|---|---|---|---|
| VH-090 | P0 | Cotizar | cot. 757: 18 partidas, cada mueble ×2 (REFERENCIA programa + FIRME VONI) | identidades distintas (`op-8u-…` vs `linea-banca_doble`); conciliación sólo por `bancoId` igual; `juntarIguales` sólo idénticos | `reconciliarPartidas.js`, `confirmarPrograma.js`, `App.jsx` | conciliación por ROL funcional en ambos sentidos; el producto que eligió la persona gana y hereda estructura | `reconciliarPartidas.test.js`(5) `confirmarPrograma.test.js`(+4) `vh092_cotizacion757.test.js` | `3b0020c` `0e155a8` | PASS (unit+e2e local) | bajo |
| VH-091 | P0 | Cotizar | conflicto `mj-900×900 vs mj-1200×1200`, botón muerto | conflicto programa-vs-programa sin acción | `Voni.jsx`, `App.jsx`, `confirmarPrograma.js` | botón por conflicto "Sustituir por el propuesto"; sillas del mismo kit no se duplican | `programaVH090.e2e.js` (navegador, PASS) | `6c57bcc` `0e155a8` | PARCIAL → ver A2 (3 decisiones + vista previa) | bajo |
| VH-092 | P0 | Acomodo | las 11 partidas de VONI sin `relation_role` → "sin un mueble que las reciba" | solver sólo coloca piezas con rol | `espacio.js`, `kit-solver.js` | inferencia de rol + grupo por destino; adopción de huérfanos | `vh092_cotizacion757.test.js` | `3b0020c` | PARCIAL → ver A3 (elegibilidad A/B/C) | bajo |
| VH-093 | P0 | Acomodo | "4 silla de juntass · 21 piezas · capacidad del catálogo" | plural ingenuo, causa genérica, sin rastreo por pieza | `opciones.js` | nombres + causa real | idem | `3b0020c` | PARCIAL → ver A4 (códigos por pieza) | nulo |
| VH-094 | P0 | Acomodo | banca 6000×1200 como línea en 2D | `tipoDe` → 'mampara' por "biombo" → 4800×80 | `espacio.js` | esMueble reconoce módulo/operativo; ancla nunca es mampara | `vh092_cotizacion757.test.js` | `3b0020c` | PASS (expansión) → ver A5 (traza 2D/3D) | bajo |
| VH-095 | P0 | Cotizar | "18 sillas para 10 puestos: sobran 8" | duplicados (VH-090) | `entendido.js` | fuente corregida; cuentas por función ya separadas | pendiente test | — | PARCIAL | bajo |
| VH-096 | P1 | Acomodo | — | — | — | auditoría pendiente | — | — | ABIERTO | — |
| VH-097 | P1 | Plano | 5 avisos `[puertas[i]]` | sin agrupación | `floorSpecAvisos.js` | resumen con conteo | `floorSpecAvisos.test.js`(+2) | `3b0020c` | PARCIAL → ver B1 (revisión por puerta) | nulo |
| VH-098 | P1 | Plano | `leer-plano` 29/33 REVIEW_REQUIRED; sala de 10 sillas → mesa de 4 | sólo contaba `puestos` | `leer-plano-core`, `leer-plano`, `planoLeido.js`, `programaDelPlano.js` | `asientos` observados mandan | `programaDelPlano.test.js`(+2) | `3b0020c` | PARCIAL (edge sin desplegar) | bajo |
| VH-099 | P0 | Costear | `erp-accr348` $1,018.50/hoja sin formato × 0.72 m² = $733.32 | m² × $/unidad sin conversión | `calculo.js` | `incompatibilidadUnidad` → PENDIENTE_FORMATO con motivo | `unidadesErp.test.js`(22) | `3b0020c` | PASS cliente / PARCIAL servidor (v9 sin desplegar) | bajo |
| VH-100 | P0 | ERP | 1,763 aprobados por qa-direccion; MXN asumido; IVA desconocido; 526 > 12 m; 30 sin hash | carga masiva autorizada verbalmente | — | matriz de verificación (docs/RC_2026-10-12_MATRIZ_P0.md) | SQL | — | BLOCKED (decisión humana) | alto |
| VH-101 | P0 | Costear | `fuenteCosto:"config-legado"` fijo | etiqueta fija | `costear-servidor`, `AsistenteEspecial.jsx` | fuente real + tope preliminar | contrato | `3b0020c` | PARCIAL (edge sin desplegar) | bajo |
| VH-102 | P1 | Costear | — | — | — | auditoría pendiente | — | — | ABIERTO | — |
| VH-103 | P0 | Cotizar | 1,931 partidas sin economía; `ECONOMICS_INCOMPLETE` | sin vínculo con costo Intelisis | `20261012061000_vh100…sql` | RPC de carga con procedencia (NO aplicado) | — | `d35481a` | BLOCKED (reporte Intelisis + autorización) | medio |
| VH-104 | P1 | Guardado/PDF | — | — | — | e2e existentes (persistencia 6, emisión 5) PASS local | Playwright | — | PARCIAL | — |
| VH-105 | P1 | Cocrear | `reabrir` → `setRender(null)` | por investigar | `CocrearV3.jsx` | — | — | — | ABIERTO | — |
| VH-106 | P1 | VONI | — | — | — | — | — | — | ABIERTO | — |
| VH-107 | P1 | Render | — | — | — | — | — | — | ABIERTO | — |

## CHECKPOINTS

| Hora (UTC) | SHA | Cerrados | Abiertos | Tests | E2E real | Cambios DB | Regresiones | Próximo |
|---|---|---|---|---|---|---|---|---|
| 05:25 | `0e155a8` | VH-090, VH-094, VH-099 (cliente) | resto | vitest 2,088 · PW local 28+2 | prod: 9 PASS, re-corrida en curso | ninguno | ninguna | Bloque A: A2 conflictos con 3 decisiones, A3 elegibilidad, A4 diagnóstico por pieza |
