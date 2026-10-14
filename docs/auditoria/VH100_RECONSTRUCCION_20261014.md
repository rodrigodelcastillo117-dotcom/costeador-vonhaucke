# VH-100 · reconstrucción, impacto medido y criterio de cierre (14-oct-2026)

## Qué es

Los productos de lista (App LT, Omega, etc.) se cotizan con el costo industrial oficial guardado en
`producto_version_economia`. El gate de emisión de producción no emite una partida sin ese costo: la marca
`ECONOMICS_INCOMPLETE`. Esto es correcto; el sistema no inventa costos. VH-100 es el puente para cargar ese costo
desde el reporte de costo de Intelisis por clave (`productos.codigo`), con procedencia.

## Medición en producción (solo lectura, 14-oct)

| Dato | Valor |
|---|---|
| Productos activos | 1,931 |
| Productos activos **sin** costo oficial | **1,931 (100 %)** |
| Filas en `producto_version_economia` | 12 (9 son fixtures QA) |
| Productos activos **sin clave** (`codigo` nulo) | 116. La carga por clave no los alcanza; su costo debe salir de componentes, por ejemplo el módulo de 12 usuarios (id 1898). |
| Claves duplicadas | ATOM3, ATPU2M/3M/4M/75M y ATFAL150ABS. La RPC rechaza la carga sin `producto_id` explícito. |
| `cargar_costos_oficiales` en `pg_proc` | **no** (no aplicada) |
| Escritura directa a `producto_version_economia` | **sí**: la política `pm_eco_all` permite INSERT, UPDATE y DELETE a Dirección, incluida la cuenta QA, sin procedencia. |

Efecto práctico: no se puede emitir ninguna cotización con partidas de lista hasta cargar los costos. Afecta,
por ejemplo, a las cotizaciones 350, 620 y 1172.

## Defectos encontrados en la propuesta y corregidos (commit f56632a)

1. **Prefijo de fecha.** `20261012061000_…` habría entrado con `supabase db push` sin autorización. Ahora se
   llama `PROPUESTA_vh100_cargar_costos_oficiales.sql`.
2. **Rol falsificable.**
   - El rol se leía de `auth.jwt()->'user_metadata'->>'rol'`, un campo que el propio usuario edita. Un
     vendedor podía cargar costos oficiales.
   - Además, `puede_editar_config()` dejaba entrar a Diseño.
   - Ahora el rol sale solo de `permitidos` (service_role o `direccion`), y se rechaza cualquier cuenta listada
     en `cuentas_no_humanas`, que crea SEG-01c. Si esa tabla no existe, nadie carga (fail-closed).
3. **Costo sobrescrito sin rastro.** Ahora cada sobrescritura guarda la fila anterior en
   `producto_version_economia_historial`.
4. **Procedencia.** Ahora queda como `documento · fecha · sha256:<64 hex> · email`; antes el hash se recortaba a
   16 caracteres.
5. **Escritura directa.** Se revoca INSERT, UPDATE y DELETE de `authenticated` sobre `producto_version_economia`.
   El cliente solo lee esa tabla, y quien escribe son funciones SECURITY DEFINER.

Evidencia: `supabase/tests/cargarCostosOficiales.test.js` tiene 12 pruebas. Contra el archivo anterior fallan 7: 6
son los huecos de seguridad e historial, y la séptima es el cambio de 16 a 64 caracteres del hash.

## Criterio de cierre (objetivo y verificable)

VH-100 queda cerrado solo cuando se cumplen las siete condiciones:

1. `public.cargar_costos_oficiales(text, jsonb)` existe en `pg_proc` con el cuerpo de la PROPUESTA (md5
   registrado) y `authenticated` no tiene INSERT, UPDATE ni DELETE sobre `producto_version_economia`.
2. Existe un documento de Intelisis (reporte de costo por clave) cargado por **una persona de Dirección que no
   sea la cuenta QA**, con `hash` en la respuesta y en `fuente`.
3. Quedan 0 productos activos sin costo oficial, o hay una lista firmada por Dirección de excepciones. Las
   excepciones son las 116 sin clave y las claves duplicadas sin resolver, cada una con su motivo.
4. Las cotizaciones 350, 620 y 1172 dejan de devolver `ECONOMICS_INCOMPLETE` por costo faltante en
   `evaluar_emision_cotizacion`. Otros motivos, como el margen, sí pueden seguir.
5. Una emisión E2E real (borrador → evaluar → emitir v2 → PDF → reabrir) pasa con una cotización nueva de
   prueba marcada RC.
6. Cada fila de `producto_version_economia` tiene `fuente` con el formato `documento · fecha · sha256:… · email`.
7. Las 9 filas `QA_FIXTURE_*` quedan archivadas o etiquetadas (no borradas) y fuera del conteo de cierre.

## Qué falta y de quién

- **Decisión y dato (Dirección y Compras):** el reporte de costo de Intelisis por clave. No existe en el Drive
  revisado. Sin él no hay carga posible. **No lo invento.**
- **Autorización (Dirección):** aplicar `PROPUESTA_seg01c_…` primero (crea `cuentas_no_humanas`) y después
  `PROPUESTA_vh100_…`.
- **Datos (Ingeniería y Dirección):** clave ERP para los 116 productos sin código y la elección entre fichas
  duplicadas (ver `docs/auditoria/CLAVES_POR_DESCRIPCION.md`).
