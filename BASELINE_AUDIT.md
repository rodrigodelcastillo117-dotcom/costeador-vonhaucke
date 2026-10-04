# BASELINE_AUDIT — Von Haucke Product OS
Fecha: 2026-10-04 · SHA baseline: `198920c` · rama: `c3.4-seller-safe`
Autor: pase autónomo (contrato maestro §204). Estados: PASS / FAIL / BLOCKED / NOT VERIFIED.

> Nota de despliegue: el contrato §164 pide "RC only until final", pero Rodrigo dio
> orden explícita y reciente de **desplegar a PROD siempre / un solo link**
> (`costeador-vonhaucke.vercel.app`). Se respeta esa orden del dueño por encima del §164.

## 1. Repositorio (mapa)
- App React (Vite single-file, `vite-plugin-singlefile`). Un solo HTML final (~5.8 MB).
- `src/componentes/*.jsx`: **41** componentes. Clave: App, Inicio, Costeador, CosteadorLinea,
  CotizadorIA, Cotizacion, Acomodo, PlanoAcomodo, DibujarPlano, PropuestaViva, AsistenteEspecial,
  ProgramaProyecto, Voni (wizard), Voni2 (FAB asistente), Usuarios, Reglas, Precios, comercial/*.
- `src/datos/*.js`: **166** (motores de datos: planoLeido, programaDelPlano, floorSpec, totales,
  confianza, aprobaciones, banco, catalogo, insumos, preciosVenta, planner, rellenar…).
- `src/motor/*.js`: **13** (calculo.js = motor económico cliente; shadow).
- `src/voni/*.js`: **9** (nucleo, tools, proveedorReal, permisos, conocimiento).
- Tests: **88 archivos / 811 tests — PASS** (`npx vitest run`). Build prod: **PASS** (`npm run build`).

## 2. Edge Functions (10) — Supabase project `mtuvnbgljwbsaizjjgzs`
acomodar-espacio · analizar-mueble (v23) · analizar-negocio · costear-servidor ·
cotizar-servidor · cotizar-texto · leer-plano (v8) · generar-render · generar-video · usuarios.
- Autoridad de costo: **costear-servidor** (ignora margen del body; usa parámetros server).
- Autoridad de política: **cotizar-servidor** (falla cerrado si no hay reglas vigentes).
- `leer-plano` v8: devuelve `puestos` por isla (conteo de escritorios dibujados) + grid.
- `analizar-mueble` v23: `catalogoFuente` ('canonico'|'cliente-fallback') — fallback ya NO silencioso.
- PENDIENTE auditar a fondo por función: verify_jwt, caller, schema, DB, fallback, rol (§161).

## 3. Base de datos — 31 tablas, TODAS con RLS activo
- Con RLS y **0 policies** (fail-closed por defecto; revisar intención): `ai_eventos`,
  `auth_recovery_once`, `render_eventos`, `cotizaciones_backup_20261002`,
  `cotizaciones_revisiones_backup_20261002`. → backups a limpiar; event logs a revisar.
- Núcleo con policies: cotizaciones(3), cotizaciones_revisiones(1), proyectos(4), clientes(4),
  productos(2), producto_versiones(2), producto_version_economia(1), aprobaciones(3), config(3),
  permitidos(2), reglas_comerciales(2), insumos_catalogo(3), renders(1)…
- Usuarios: **11** en `permitidos` = 11 en `auth.users`, 11 confirmadas, 11 con password, 0 baneadas.
- `reglas_comerciales` vigente: id1 approved, `descuento_max_sin_aprobacion = 40`.
- Advisors pendientes: leaked-password protection OFF; varios SECURITY DEFINER ejecutables por
  authenticated (revisar los no usados por el cliente).

## 4. Despliegue actual
- PROD = `costeador-vonhaucke.vercel.app` (único link oficial). Al subir SHA `198920c` quedó con
  todos los fixes de esta sesión (verificado: nota-clara, fix Dibujar, gavetas, catalogoFuente).
- Nota cosmética: el pie dice "v1.0.0 · desconocido" en builds por CLI (no inyecta git SHA).
- RC (`vonhaucke-rc.vercel.app`) = banco de pruebas interno; NO compartir.

## 5. Estado vs arquitectura objetivo del contrato (§2 pipeline)
Objetivo: `ProjectSpec→FloorSpec→ProductIntent→ProductSpec→EngineeringSpec→BOM→CostSnapshot→
PlacementSpec→RenderSpec→QuoteSpec→ApprovalSnapshot→EmissionSnapshot`, todo versionado/hasheado.
- EXISTE hoy (parcial): FloorSpec (`floorSpec.js` determinista), programa del plano con procedencia,
  cotización+revisiones (hash, inmutables), aprobaciones ligadas a hash, motor de costo server,
  Voni determinista (solo lectura), renders.
- NO EXISTE aún: ProductSpec/EngineeringSpec/BOM universales versionados, ManufacturingCapability,
  lifecycle de producto, Design DNA, ProductIntent, change-impact engine, stale-graph formal,
  Cocrear como orquestador. → es el grueso del contrato, trabajo multi-sesión.

## 6. Golden conocido
- Plano Ejecutivo Complejo: envolvente 15.0×8.8 = **132 m²**, Área Operativa = **2 islas × 4 = 8 puestos**.
  Pipeline cliente verificado E2E: "8 puestos contados del plano". Invariante 8 (no 16/17/18). PASS.
