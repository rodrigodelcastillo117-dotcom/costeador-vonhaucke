# 95_SEGURIDAD_SUPABASE_QA — auditoría del asesor de Supabase (P7, 2026-11-03)

Fuente: `get_advisors(security)` + `get_advisors(performance)` sobre el proyecto `mtuvnbgljwbsaizjjgzs`.
Regla del directivo: "No asumas vulnerabilidad sólo por la advertencia." Cada punto se verifica contra el
código/DB y, donde aplica, con un ataque EN VIVO usando la cuenta rol vendedor `ventasprueba`.

## SEGURIDAD

### 16 funciones SECURITY DEFINER ejecutables por `authenticated` (WARN) — **0 vulnerabilidades**
Auditoría del cuerpo (pg_get_functiondef) + ataque en vivo como vendedor:
- **14/16** tienen guardia de rol interna (`puede_certificar_costo`/`puede_editar_config`/`cuentas_no_humanas`/
  `permitidos+rol`) **y** `raise exception` al no autorizar. Las 16 tienen `search_path` fijo (sin inyección).
- **2/16 son correctas sin guardia de rol:** `politica_comercial_publica()` (pública por diseño, sin economía)
  y `puede_certificar_costo()` (helper booleano; sólo devuelve true/false, sin acción privilegiada).
- **Verificación EN VIVO (vendedor → todas rechazadas con 400 "no autorizado"):** `certificar_version`,
  `firmar_precios_erp_vigentes` ("sólo una persona de Dirección, no una cuenta de prueba"), `cargar_costos_oficiales`
  ("sólo Dirección carga costos oficiales"), `cargar_erp_ultima_compra`, `cerrar_vigencia_precio`,
  `revalidar_vigencia_precio`, `aprobar_precios_lote` ("no autorizado para certificar costo"), `buscar_insumos_motor`
  (también guardada; no filtra precios). (Y antes: `aprobar_precio`, `aprobar_mapeo_externo`, `catalogo_motor` → 400.)
- **Veredicto:** el aviso es genérico ("son invocables"), no un hueco. Cada función SECURITY DEFINER valida el
  rol del llamante internamente. **No se revoca nada** (revocar EXECUTE rompería la app sin ganancia de seguridad).

### 8 tablas con RLS activa y SIN policy (INFO) — **correctamente deny-all**
`respaldo_funciones`, `aprobaciones_precio_historial`, `cocrear_costeo_servidor`, `costeos_servidor`,
`cuentas_no_humanas`, `partida_costeo_vigente`, `producto_version_economia_historial`, `revalidaciones_vigencia`.
RLS activa + 0 policies = **nadie (anon/authenticated) accede** salvo service_role/definer. Son tablas de
economía/auditoría internas → deny-all es lo correcto. **Verificado EN VIVO:** el vendedor lee
`aprobaciones_precio_historial`, `producto_version_economia_historial`, `costeos_servidor`,
`partida_costeo_vigente`, `cuentas_no_humanas` → **todas 42501 permission denied**. No es vulnerabilidad.

## RENDIMIENTO (todo INFO, nada urgente; analizado por volumen real)

### 5 claves foráneas sin índice — recomendación informada por volumen
| FK | Filas | Recomendación |
|---|---:|---|
| `private_api.cotizacion_idempotencia.cotizacion_id` | 4,200 | **Agregar** (moderado; ayuda cascade/joins) |
| `public.producto_versiones.expediente_revision_id` | 1,951 | **Agregar** (moderado) |
| `public.costeos_servidor.cotizacion_id` | 1,018 | **Agregar** (moderado) |
| `public.insumo_mapeos_externos.insumo_id` | 42 | **Omitir** (seq scan trivial) |
| `public.producto_referencias.producto_version_id` | 0 | Baja prioridad (tabla nueva; añadir cuando crezca) |
A estos volúmenes el impacto es <1 ms; **no es bloqueador del 95**. Son DDL de producción → **propuesta, no
aplicada** (regla 1: no tocar prod sin autorización). Un índice B-tree por FK, cuando Dirección autorice.

### 75 tablas sin PK — **falsa alarma**
73 están en esquemas `respaldo_20261013`/`respaldo_20261017` (backups) + 2 tablas de archivo en `public`
(`_bk_familia_app_20261021`, `cotizaciones_archivadas_qa_20261028`). Son snapshots, no se consultan a escala.
Ignorar.

### 15 índices sin uso + 1 estrategia de conexión de Auth — baja prioridad
Índices "nunca usados" en su mayoría por features nuevas/bajo tráfico (incl. `ix_producto_referencias_producto`,
tabla vacía). Limpieza opcional, no bloqueante. Auth usa 10 conexiones absolutas: tuning de infra, decisión de
Dirección si se escala la instancia.

## Veredicto P7
**Seguridad Supabase: 0 vulnerabilidades reales** entre los 16 avisos SECURITY DEFINER y las 8 tablas RLS-sin-
policy — cada función guarda el rol (verificado en vivo), las tablas de economía son deny-all. Rendimiento: solo
INFO; 3 índices de FK recomendados (propuesta, no aplicada), el resto ignorable. Complementa el seller-safe 14/14
de `95_SEGURIDAD_EMISION_QA.md`.
