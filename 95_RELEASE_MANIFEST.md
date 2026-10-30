# 95_RELEASE_MANIFEST — mapa exacto frontend → edge → versión → hash → SHA

**Fecha:** 2026-10-29. Datos verificados contra Supabase (edges vivos) y Vercel (deployments).
Responde la exigencia de la orden: *"FUNCIÓN FRONTEND → EDGE REAL → VERSION → HASH → SHA DE CÓDIGO"*
y *"demostrar que este E2E probó exactamente el código que se va a poner en producción"*.

## Frontend (cliente)
| Qué | Valor |
|---|---|
| **Producción (Vercel, READY)** | `dpl_DuxmoFiMxZscSY1kf4Wv7SiuyMTn` · SHA `fece6c3` · rama `c3.4-seller-safe` |
| **Release candidate (esta rama)** | `claude/costing-app-architecture-psf02g` · head `d2509a1` (= prod + 13 commits, sólo docs/.sql/lab sobre el último código de app `ea31d459`) |
| **Preview-RC (certificación)** | `dpl_CAthKba3sUoL5TTyUGWBnSGi5SJ2` · `costeador-vonhaucke-ogz9c6w75-rodrigos-eurotrip.vercel.app` · SHA `ea31d459` · `CARRIL_RC=si` (preview) ⇒ invoca edges `-rc` |
| Env producción (Vercel) | sólo `VITE_CONTROL_OPTIMISTA=1` (sin CARRIL_RC) |
| El SHA se hornea en el build | `__BUILD_SHA__` (vite.config.js, de `VERCEL_GIT_COMMIT_SHA`) |

## Mapa función del cliente (nube.js) → Edge real → versión → hash de código (ezbr_sha256)
**Regla de ruteo (verificada en `src/nube.js:410-433` + `vite.config.js:39`):**
`CARRIL_RC = (VERCEL_ENV==='preview' && CARRIL_RC==='si') && host ~ -rodrigos-eurotrip`.
→ **Producción usa la columna PROD. El preview-RC usa la columna RC.**

| Constante cliente | PROD edge (lo que corre la oficina) | ver | ezbr_sha256 (12) | RC edge (preview) | ver | ezbr_sha256 (12) |
|---|---|---|---|---|---|---|
| FN_ANALIZAR | analizar-mueble | 38 | `a682b1c0fcd2` | analizar-mueble-rc | 8 | `f226b7927d34` |
| FN_COSTEAR | costear-servidor | 17 | `28a09647c47e` | costear-servidor-rc | 30 | `a56ab299e734` |
| FN_COTIZAR_TEXTO | cotizar-texto | 18 | `344a93487590` | cotizar-texto-rc | 1 | `14cc28151c0a` |
| FN_GENERAR_RENDER | generar-render | 31 | `ed78f9a85913` | generar-render-rc | 5 | `33a6d016f725` |
| FN_ACOMODAR | acomodar-espacio-recovery | 19 | `65740137f0fb` | acomodar-espacio-recovery-rc | 3 | `bd0dcb9cc153` |
| FN_LEER_PLANO | leer-plano (+ leer-plano-core 8 `64715a20c7e2`) | 14 | `9363bff46d36` | leer-plano-rc 3 / leer-plano-core-rc 5 | — | `3a4b0f9f3079` / `897ea278b30e` |
| voni-council (invoke directo) | voni-council | 14 | `3d47d4c694a5` | — | — | — |

**Divergencia de release (crítica):** el motor de costeo avanzado está en `costear-servidor-rc` **v30** pero
producción corre `costear-servidor` **v17**. La certificación de COSTEAR/COTIZAR descrita en `95_SCORECARD.md`
se hace sobre el **preview-RC** (columna RC). Para que ese mismo código sea el de producción hace falta
**promover los `-rc` a los slots PROD** (§100, decisión de Dirección — ver `95_BLOCKERS.md` B1). Hoy NO está hecho.

## Base de datos
- Última migración aplicada: `20261029120810 neutralizar_insumos_telsvh120_mal_cargados`.
- Hardening de seguridad/emisión/seller-safe: aplicado (ver `95_AUDIT_BASELINE.md §3,§5`).

## Pruebas / CI
- Unit/integración (vitest): **406 archivos / 3,994 pruebas verdes** (local, 2026-10-29).
- CI (`ci.yml`) verde en prod `fece6c3` (run #997) y en la rama.
- E2E contra preview-RC: en curso (resultados por pestaña se anexan a `95_SCORECARD.md`).

## Cómo se promovería a producción (cuando Dirección autorice — NO hecho)
1. Desplegar el contenido de cada `*-rc` a su slot PROD (analizar-mueble, costear-servidor, cotizar-texto, etc.).
2. Merge de la rama RC a `c3.4-seller-safe` → Vercel redeploy prod.
3. Smoke en prod + verificación de versiones/hashes (este manifiesto re-emitido con los SHA nuevos).
4. Rollback: redeploy del `dpl_Duxmo…` (fece6c3) + re-desplegar versiones previas de los edges.
