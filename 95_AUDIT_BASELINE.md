# 95_AUDIT_BASELINE — estado real verificado (FASE 0)

**Fecha:** 2026-10-29 · **Autor:** sesión Claude (rama `claude/costing-app-architecture-psf02g`)
**Regla de este documento:** sólo afirma lo que fue **verificado** contra producción/DB/Vercel hoy.
Lo no medido se marca `SIN MEDIR`, nunca se inventa un número.

Método de verificación: git contra `origin`, Supabase MCP (proyecto `mtuvnbgljwbsaizjjgzs`),
Vercel MCP (prj `rJ3FhV1y983Mi00Xe4NQ3rHJ2cE5` / team `y5VLcyRVx28nqY45InYc14Jf`), lectura de código fuente.

---

## 1. Topología de release (VERIFICADO)

| Qué | Valor real hoy |
|---|---|
| **Producción (Vercel, target production, READY)** | deployment `dpl_DuxmoFiMxZscSY1kf4Wv7SiuyMTn` |
| **SHA de producción (frontend)** | `fece6c3` · rama `c3.4-seller-safe` |
| Mensaje del commit prod | "puede_certificar_costo excluye cuentas_no_humanas (PROPUESTA, no aplicada)" |
| **Mi rama de trabajo** | `claude/costing-app-architecture-psf02g` = `d031cff` = **prod + 13 commits, 0 atrás** |
| **FINAL-100 (PR #83, rama `release/final-100`)** | `b7a8d99` · **DRAFT · NO MERGE** |
| FINAL-100 vs prod | final-100 está **64 commits DETRÁS** de prod (sólo 13 adelante) |
| Env de producción (Vercel) | sólo `VITE_CONTROL_OPTIMISTA=1`. Sin `CARRIL_RC`. |

**Conclusión 1:** La instrucción de NO mergear FINAL-100 es correcta: está muy desfasado respecto a
producción. Cualquier cierre se reconstruye sobre `fece6c3` (que mi rama ya contiene).

**Nota de verdad documental:** varios commits de prod dicen "PROPUESTA, no aplicada" (reventa-sin-piso,
puede_certificar), pero las migraciones correspondientes **SÍ están aplicadas en la DB** (ver §3). El
mensaje de commit quedó obsoleto; el estado real de la DB es el endurecido. Hay que confiar en la DB,
no en el texto del commit.

---

## 2. Edge Functions — el hallazgo central de integridad (VERIFICADO)

Hay **31 Edge Functions ACTIVAS**: familia prod + `-rc` + `-strict` + `-recovery` + `-preview`. Sprawl real.

Divergencia crítica prod vs RC:

| Función | Prod (versión) | RC (versión) | Gap |
|---|---|---|---|
| costear-servidor / **costear-servidor-rc** | v17 | **v30** | ~13 versiones sólo en RC |
| analizar-mueble / **analizar-mueble-rc** | v38 | v8 (rama) | lógica distinta |
| leer-plano-core / leer-plano-core-rc | v8 | v5 | — |
| acomodar-espacio-recovery / -rc | v19 | v3 | — |
| cotizar-texto / cotizar-texto-rc | v18 | v1 | — |
| generar-render / generar-render-rc | v31 | v5 | — |

**Wiring real frontend→edge** (`src/nube.js:410-433`):
```
CARRIL_RC = (__CARRIL_RC__ === true) && hostname ~ /-rodrigos-eurotrip\.vercel\.app$/
FN_COSTEAR  = CARRIL_RC ? 'costear-servidor-rc' : 'costear-servidor'
FN_ANALIZAR = CARRIL_RC ? 'analizar-mueble-rc'  : 'analizar-mueble'
envFn() sólo lee overrides VITE_* cuando import.meta.env.DEV === true (local)
```
`__CARRIL_RC__` se pone **sólo en builds Preview con env `CARRIL_RC=si`** (existe en target *preview* de
`release/final-100` y de esta rama; **NO existe en target production**).

**Conclusión 2 (el punto más importante del release):** **Producción corre los edges VIEJOS**
(`costear-servidor` v17, `analizar-mueble` v38). **Todo el avance del motor de costeo/lectura vive sólo
en los edges `-rc`, que producción NO invoca.** Esto es, literal, el riesgo "una RC funciona pero
producción no". Antes de declarar COSTEAR/COTIZAR ≥95 *en producción*, hay que decidir (decisión de
Dirección, §100) si se promueven los `-rc` a prod y se certifican — o si el objetivo 95 se mide sobre un
preview que use `-rc`. Hoy esa promoción **no está hecha** y **no se hará sin autorización**.

Buena señal de arquitectura (VERIFICADO): el motor de costeo se extrajo a módulos compartidos
(`src/datos/costeoServidor.js`, `promesaComercial.js`, `cocrearServidor.js`) que importan tanto el
cliente/pruebas como la Edge `-rc`. Es la "fuente canónica" pedida: sin duplicar lógica cliente/servidor.
**Pendiente de confirmar:** que `costear-servidor` (prod v17) se haya desplegado desde esos mismos
módulos (si no, hay drift prod-edge vs canónico). `SIN MEDIR`.

---

## 3. Migraciones DB (VERIFICADO)

Total aplicadas: ~230 (las primeras ~70 de ago-12/13 son ruido de scaffolding `app_temp_write_open/close`).
Las sustantivas arrancan ~2026-09-24. Últimas aplicadas, en orden:

```
20261028225054 reventa_sin_piso_aprobacion
20261029000501 puede_certificar_costo_excluye_no_humanas
20261029042907 piso_minimo_oculto_a_vendedor           ← fix seller-safe de esta sesión
20261029120810 neutralizar_insumos_telsvh120_mal_cargados ← limpieza de esta sesión
```
La DB está al día con la intención de mi rama. Las migraciones de seguridad (emisión server-side,
hard-gate de aprobación, strip de economía al vendedor, RLS default-deny) **están aplicadas**.

---

## 4. Verdad de datos (VERIFICADO, producción)

| Métrica | Valor real |
|---|---:|
| insumos_catalogo (total / activos) | 11,294 / 10,185 |
| insumo_precios (filas, append-only) | 12,973 |
| catalogo_vigente · CERTIFICADO | **3,083** |
| catalogo_vigente · PRELIMINAR | **7,102** |
| insumo_mapeos_externos (clave externa→insumo) | **42 total, 42 `propuesto`, 0 `aprobado`** |
| cuentas_no_humanas | 2 |

**Conclusión 4:** El catálogo tiene precios (10,185 activos), pero:
- Sólo ~30% está CERTIFICADO; 70% es PRELIMINAR (por vigencia/aprobación/validación-compras).
- El **puente clave-externa (Intelisis/fábrica) → insumo tiene 0 mapeos aprobados.** Costear un mueble
  *nuevo* por su clave/BOM depende de ese puente; hoy, en producción, está casi vacío aprobado. Esto
  confirma el cuello de botella medido en TELSVH120 (25/29 conectados pero en `propuesto`).
- Regla a respetar (ya codificada): sin precio ⇒ `PENDIENTE/SIN COSTO`, nunca $0.

---

## 5. Seguridad (VERIFICADO)

**Advisor security de Supabase:**
- `rls_enabled_no_policy` — INFO, 8 tablas (respaldo_funciones, aprobaciones_precio_historial,
  cocrear_costeo_servidor, costeos_servidor, cuentas_no_humanas, partida_costeo_vigente,
  producto_version_economia_historial, revalidaciones_vigencia). RLS ON + sin política = **deny-all a
  `authenticated`** (acceso sólo service_role). Aparenta intencional (tablas internas). `REVISAR` que
  ninguna necesite lectura por dueño, pero no es hueco abierto.
- `authenticated_security_definer_function_executable` — WARN, 16 funciones. **Verificado leyendo el
  código de las 6 más sensibles:** `aprobar_precio`, `aprobar_precios_lote`, `aprobar_mapeo_externo`,
  `certificar_version` exigen `puede_certificar_costo()`; `cargar_costos_oficiales` y
  `firmar_precios_erp_lote` exigen rol `direccion` **leído de la tabla `permitidos`** (no del JWT que el
  usuario edita) y **excluyen `cuentas_no_humanas`** (fail-closed). → **La autoridad está server-side,
  bien hecha. El WARN es ruido**: ser ejecutable por `authenticated` es inofensivo porque la función
  misma reja. No es P0.

**Seller-safe (VERIFICADO esta sesión):** `lista_precio_items.piso_minimo` ya no es legible por
`authenticated` (migración aplicada; 42501 al intentar leer la columna).

**SIN MEDIR aún:** BOLA/IDOR por objeto (abrir cotización/expediente/render de otro dueño vía REST
directo), exposición de storage de renders, y verificación de que emisión es 100% server-side en el
recorrido real (el código de la migración dice que sí; falta el E2E que lo pruebe desde el navegador).

---

## 6. PRs abiertos — triage (VERIFICADO)

| PR | Título | Veredicto |
|---|---|---|
| #83 | FINAL-100 cierre como conjunto | **DRAFT · NO MERGE.** 64 commits detrás de prod. No tocar. |
| #82 | Costear: mesa redonda ya no se bloquea por "pieza más grande que el mueble" | **Relevante** (tu caso huella Ø1800). Base vieja (251c259). Revisar/rebasar sobre prod. |
| #72 | acomodo: DEPENDENT_DETACHED evalúa (0/89 PASS cambian) | Revisar; impacto declarado nulo. |
| #64 | lab lector planos RC | NO FUSIONAR (lab). |
| #24,#23,#22,#21,#20,#18 | recovery/chatgpt de principios de octubre | **Cementerio.** Bases en ramas muertas. Candidatos a cerrar. |

---

## 7. Lo que NO está medido todavía (honestidad de alcance)

Ninguna de estas tiene score real aún porque requieren ejercitar la app corriendo (E2E navegador/preview):

- Funcional por pestaña: INICIO, COSTEAR, COTIZAR, COCREAR, ACOMODO, RENDERS, VONI, INSUMOS,
  CATÁLOGO, ARCHIVO, PDF, MOBILE. → `SIN MEDIR` en el scorecard.
- Estado de CI (últimas corridas verdes/rojas) y qué exactamente prueban. → `SIN MEDIR`.
- Paridad numérica real costear-servidor (prod v17) vs costear-servidor-rc (v30) sobre los golden. → `SIN MEDIR`.
- Persistencia/reabrir/concurrencia probadas contra la DB real desde la UI. → `SIN MEDIR`.

---

## 8. Hallazgos ordenados por impacto (base para P0/P1)

1. **[RELEASE · bloqueante del objetivo]** Producción corre edges viejos; el motor avanzado está varado en
   `-rc`. Decisión de Dirección: promover `-rc` a prod (con certificación) o medir 95 sobre preview-RC.
2. **[DATOS · P0 para COSTEAR de muebles nuevos]** 0 mapeos clave-externa→insumo aprobados en prod; 70%
   del catálogo PRELIMINAR. Costear por clave/BOM nuevo no tiene puente aprobado.
3. **[PROCESO]** 31 edges sin mapa canónico función-frontend→edge→versión→hash. Falta `95_RELEASE_MANIFEST.md`.
4. **[LIMPIEZA]** PRs cementerio (#18–#24) y ~30 ramas muertas generan ruido y riesgo de mergear lo viejo.
5. **[REVISAR]** 8 tablas RLS-sin-política (confirmar que todas deben ser deny-all).
6. **[FUNCIONAL]** 12 pestañas SIN MEDIR: requieren E2E real antes de cualquier número.

**No-bloqueante confirmado sano:** autoridad de precios/certificación server-side; seller-safe piso_minimo;
emisión con hard-gate (en código); control optimista VH-148 ON en prod.
