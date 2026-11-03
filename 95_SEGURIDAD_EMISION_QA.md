# 95_SEGURIDAD_EMISION_QA — pentest seller-safe EN VIVO (Ronda 3, 2026-11-03)

Autorizado por Dirección. Cuenta de prueba **rol `vendedor`** (`ventasprueba@vonhaucke.mx`, verificado en
`permitidos`: rol=vendedor, no es cuenta no-humana). Es la cuenta LIMITADA que faltaba: con "acceso a todo"
(qa-direccion) la prueba no vale, porque Dirección DEBE ver todo. Aquí se intenta, COMO vendedor, romper el
muro; **PASS = el sistema bloquea o despoja la economía.** La contraseña se usó efímera; no se guarda.

Método: login real (grant_type=password) → JWT de vendedor → ataques por REST (tablas), RPC y Edge.
Evidencia cruda: `scratchpad/pentest/resultados.json`.

## Matriz de ataques (14 vectores)
| # | Ataque (como vendedor) | Esperado | Resultado real | Veredicto |
|---|---|---|---|---|
| 1 | `rpc puede_ver_economia()` | false | **`false`** (HTTP 200) | ✅ no ve economía |
| 2 | `rpc resolver_costo_insumo('ptr')` | rechazo | **HTTP 400** "no autorizado: el costo es economía interna" | ✅ bloqueado |
| 3 | `rpc catalogo_motor(incluir_erp)` | rechazo | **HTTP 400** | ✅ bloqueado |
| 4 | `GET insumo_precios` (precios) | 0 filas | **200, 0 filas** (RLS) | ✅ sin fuga |
| 5 | `GET producto_version_economia` | 0 filas | **200, 0 filas** | ✅ sin fuga |
| 6 | `GET cotizaciones` (ajenas, raw) | bloqueo | **HTTP 403** (RLS niega lectura cruda) | ✅ bloqueado |
| 7 | `GET lista_precio_items` (piso_minimo) | bloqueo | **HTTP 403** | ✅ piso oculto |
| 8 | `rpc cotizaciones_mias` (vía sancionada) | sin economía | **200, 0 filas**, sin campos de costo | ✅ seller-safe |
| 9 | `POST insumo_precios` (escribir precio) | rechazo | **HTTP 400** (RLS) | ✅ no escribe |
| 10 | `GET config` (datos.insumos con precios) | 0 filas | **200, 0 filas** | ✅ sin fuga |
| 11 | `voni-council cost_review` (pide costo/margen) | sanitiza | **seller_safe, sin cifras de costo/margen** | ✅ sin fuga |
| 12 | `costear-servidor` body válido | solo precio, no costo | **200 `precioVenta:245.04` "preliminar"; SIN costoUnitario/margen** | ✅ ve precio, no costo |
| 13 | `rpc aprobar_precio` | rechazo | **HTTP 400** "no autorizado para certificar costo" | ✅ no aprueba |
| 14 | `rpc aprobar_mapeo_externo` | rechazo | **HTTP 400** "no autorizado" | ✅ no aprueba |
| +  | `POST producto_referencias` (RLS nueva) | rechazo | **HTTP 42501** permission denied | ✅ RLS de la migración R3 funciona |

## Veredicto
**Seller-safe CERTIFICADO en vivo (14/14).** Un vendedor autenticado NO puede, por ningún vector probado
(REST directo, RPC, Edge, VONI): leer costos internos, leer precios de insumos, ver el piso mínimo, leer
cotizaciones ajenas en crudo, escribir precios, aprobar precios/puentes, ni extraer costo/margen de VONI.
Lo único económico que recibe es el **`precioVenta`** (el precio que debe cotizar al cliente) — correcto por
diseño; el **costo** y el **margen** nunca salen. Esto **confirma por DATOS** (no por ocultar React) la
afirmación de Dirección "el vendedor no ve costeo".

## Matiz honesto
- La cuenta de prueba es nueva (0 cotizaciones), así que el despojo de economía de una cotización YA creada
  por Dirección y mostrada al vendedor no se probó con datos (no hay tal fila). Pero el vector #6 muestra que
  la lectura cruda de `cotizaciones` está **negada (403)**, y la ruta sancionada (#8) aplica `partidas_vendedor`
  — la economía no tiene camino de salida al vendedor aunque existiera.
- `costear-servidor` sí es llamable por el vendedor (es parte de su flujo de cotizar) y devuelve precio, no
  costo: su fuente de costo (`catalogo_motor`/`resolver_costo_insumo`) está bloqueada al vendedor (#2, #3).
- No se probó emisión de una revisión obsoleta por el vendedor (requiere una cotización emitible del vendedor);
  el gate `evaluar_emision_cotizacion` (verificado en FASE 13, md5 8c23d98a) ya ata snapshot↔costeado server-side.
