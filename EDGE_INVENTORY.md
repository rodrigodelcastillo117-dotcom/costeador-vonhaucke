# EDGE_INVENTORY.md — Supabase Edge Functions (§32)

> Medido HOY (2026-10-28) en proyecto `mtuvnbgljwbsaizjjgzs`. **29 funciones ACTIVE.**
> `deploy_src`: **repo** = `entrypoint_path` bajo `/home/runner/work/...` (desplegada desde CI/repo, trazable) · **fuera-de-banda** = bajo `/tmp/user_fn_...` (subida manual/dashboard, **no trazable a un SHA del repo**).
> Clasificación preliminar. **No retirar nada sin probar que no tiene caller y sin autorización de Dirección** (§32, §100).

| Edge | ver | deploy_src | verify_jwt | Clase | Nota |
|---|---:|---|---|---|---|
| costear-servidor | 17 | fuera-de-banda | sí | **PROD_CURRENT** | motor autoritativo de costeo |
| costear-servidor-rc | 30 | repo | sí | **RC** | versión más alta; desarrollo activo |
| cotizar-servidor | 8 | fuera-de-banda | sí | **PROD_CURRENT** | |
| cotizar-texto | 18 | fuera-de-banda | sí | **PROD_CURRENT** | |
| cotizar-texto-rc | 1 | repo | sí | RC | |
| analizar-mueble | 38 | fuera-de-banda | sí | **PROD_CURRENT** | análisis principal de mueble |
| analizar-mueble-rc | 8 | repo | sí | RC | |
| analizar-mueble-strict | 1 | fuera-de-banda | sí | STRICT | |
| analizar-mueble-preview | 2 | fuera-de-banda | sí | PREVIEW | |
| leer-plano | 14 | fuera-de-banda | sí | **PROD_CURRENT** | |
| leer-plano-core | 8 | fuera-de-banda | sí | **PROD_CURRENT** | núcleo |
| leer-plano-core-rc | 5 | repo | sí | RC | |
| leer-plano-rc | 3 | repo | sí | RC | |
| leer-plano-strict | 1 | fuera-de-banda | sí | STRICT | |
| acomodar-espacio | 10 | fuera-de-banda | sí | **PROD_CURRENT?** | ¿superseded por -recovery? verificar caller |
| acomodar-espacio-recovery | 19 | fuera-de-banda | sí | **PROD_CURRENT** | acomodo vivo |
| acomodar-espacio-recovery-rc | 3 | repo | sí | RC | |
| acomodar-espacio-strict | 1 | fuera-de-banda | sí | STRICT | |
| generar-render | 31 | repo | sí | **PROD_CURRENT** | (entrypoint runner) |
| generar-render-rc | 5 | repo | sí | RC | |
| generar-render-strict | 1 | fuera-de-banda | sí | STRICT | |
| generar-video | 4 | fuera-de-banda | sí | UNKNOWN | ¿feature activa? verificar caller |
| voni-council | 14 | fuera-de-banda | sí | PROD_CURRENT | default OFF (§46/§47) |
| voni-council-health | 6 | fuera-de-banda | sí | PROD_CURRENT | health probe |
| costear-vision | 4 | fuera-de-banda | sí | UNKNOWN/LEGACY | ¿superseded por analizar-mueble? verificar |
| costear-compras-rc | 3 | fuera-de-banda | sí | RC | costeo con precios de Compras |
| analizar-negocio | 2 | fuera-de-banda | sí | UNKNOWN | verificar caller |
| usuarios | 9 | fuera-de-banda | sí | PROD_CURRENT | gestión de usuarios |
| app | 4 | fuera-de-banda | **no** | PROD_CURRENT | hosting del cliente (verify_jwt=false) |
| bootstrap-temp-claude | 5 | fuera-de-banda | sí | **TEMP** | retirar (temporal) |

## Hallazgos
- **P1-EDGE-01 — trazabilidad rota:** la mayoría de las edges de **producción** están **fuera de banda** (`/tmp`). No se puede probar byte-a-byte qué código corre en prod. **Acción (gobernada):** redesplegar las prod críticas desde el repo/CI al SHA final y dejar que la respuesta incluya `build_sha`/`edge_version` (§31). Requiere autorización (§100: deploy a prod).
- **Retiro candidato (tras probar sin caller + autorización):** `bootstrap-temp-claude` (TEMP), posible `costear-vision` / `analizar-negocio` / `generar-video` (UNKNOWN), `*-strict` si no se usan en el flujo del piloto.
- **Caller analysis pendiente:** grep en `src/` de cada slug para confirmar PROD_CURRENT real vs UNUSED antes de cualquier retiro.
