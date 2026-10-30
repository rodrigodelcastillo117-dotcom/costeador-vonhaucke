# 95_RELEASE_MANIFEST_ACTUAL — qué corre en producción (2026-10-30)

Fuente: Vercel (deploy prod) + Supabase (list_edge_functions). Verificado en vivo, no declarado.

## Frontend (Vercel · proyecto costeador-vonhaucke)
| Campo | Valor |
|---|---|
| Dominio producción | `costeador-vonhaucke.vercel.app` |
| Deploy en vivo | `dpl_4PPfKgethFsF8cF5Yw8Bg5G5xzpD` · **READY** · target=production · aliasError null |
| Commit | `d19557d` (merge de `claude/costing-app-architecture-psf02g` → `c3.4-seller-safe`) |
| Asset servido | `index-DewNbwu7.js` (confirmado por cambio de hash desde `index-BDj_J2fL.js`) |
| Rama de deploy | `c3.4-seller-safe` (auto-deploy por integración GitHub) |
| **Rollback** | `dpl_DuxmoFiMxZscSY1kf4Wv7SiuyMTn` (commit `fece6c3`), `isRollbackCandidate: true` |

Cambios de bundle en este release vs `fece6c3` (6 archivos): pantalla **Aprobar puentes** (B2, solo
Dirección), **BLN-01** fail-closed en `calculo.js`, perf de render en `AcomodoBase.jsx`.

> PENDIENTE de deploy (vive en la rama, NO en prod): el hardening **BLN-09** de `mapIaComps.js` (commit
> `3b32802`). Requiere un nuevo merge+deploy autorizado para llegar a producción.

## Edge Functions (Supabase · proyecto mtuvnbgljwbsaizjjgzs) — versiones PROD (no-rc)
| Edge | Versión | ezbr_sha256 (prefijo) |
|---|---:|---|
| costear-servidor | 18 | 107bd1fa |
| analizar-mueble | 39 | 6fc1ffcc |
| cotizar-texto | 19 | 75d012b7 |
| cotizar-servidor | 8 | d1aea9e9 |
| leer-plano-core | 9 | 8137faf6 |
| acomodar-espacio-recovery | 20 | f25b5df2 |
| generar-render | 32 | 73fd1119 |
| voni-council | 14 | 3d47d4c6 |

RC (banco de pruebas, NO servidas por prod salvo CARRIL_RC): costear-servidor-rc v30, analizar-mueble-rc v8,
leer-plano-core-rc v5, acomodar-espacio-recovery-rc v3, generar-render-rc v5, cotizar-texto-rc v1.

El motor avanzado ya fue promovido a los slots prod (no-rc) en ronda previa (commit `e1a9449`).

## Verificación de build de este release
- `npm test`: **4008 pruebas, 407 archivos, 0 fallos, 0 skips** (incluye las 13 de BLN-09).
- `vite build`: verde.
