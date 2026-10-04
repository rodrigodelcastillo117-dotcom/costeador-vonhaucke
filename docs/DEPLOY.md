# Disciplina de ambientes y deploy — Von Haucke Costeador

> Gate de cierre (auditoría 2026-10-03): **no llamar RC a un `vercel --prod`.**

## Hallazgo verificado (2026-10-03)
La API real de Vercel mostraba que el deployment más reciente tenía `target=production`
y que **los tres alias apuntaban al MISMO deployment**:

| Alias | Rol | Apuntaba a |
|---|---|---|
| `vonhaucke-rc.vercel.app` | "RC" | `costeador-vonhaucke-4a522agu4` (**target=production**) |
| `costeador-vonhaucke.vercel.app` | PRODUCCIÓN | `costeador-vonhaucke-4a522agu4` |
| `costeador-vonhaucke-rodrigos-eurotrip.vercel.app` | PRODUCCIÓN | `costeador-vonhaucke-4a522agu4` |

**Conclusión honesta:** lo que se venía reportando como `RC_DEPLOYED` era en realidad
servido también por el dominio de producción. RC y PROD **no estaban aislados**. Un
deploy hecho con `--prod` (o promovido) y luego "aliased" a `vonhaucke-rc` sigue siendo
un deployment `target=production`.

## RESUELTO 2026-10-03/04 — separación REAL por target (no por alias)
Causa raíz: el comando usado era `npx vercel --prod=false`. La CLI de Vercel **no**
interpreta `--prod=false` como preview (trata `--prod` como bandera booleana), así que el
deploy salía `target=production` y movía los dominios de prod. **El fix correcto es el deploy
BARE sin `--prod`**, que sí produce `target=preview` (verificado: `vercel inspect` → `target
preview`).

**Estado verificado actual:**
- `vonhaucke-rc.vercel.app` → `costeador-vonhaucke-hdyyxvy7s` (**target=preview**) ← RC real.
- `costeador-vonhaucke.vercel.app` (PROD) → `costeador-vonhaucke-4a522agu4` (**target=production**,
  baseline previo, congelado).
- Son deployments DISTINTOS con target DISTINTO: separación real de environment, no truco de alias.

Ya no hace falta re-aliasar producción tras un deploy de RC: un `vercel deploy` bare NO toca
los dominios de producción (sólo crea un preview). Sólo un `vercel --prod` mueve producción.

## Definición de ambientes
- **LOCAL** — `npm run dev` / `vite`. Nunca es autoridad.
- **PREVIEW / RC** — deployment con `target=preview` (NO `--prod`). Alias: **sólo**
  `vonhaucke-rc.vercel.app`. Es donde se valida antes de producción.
- **PRODUCTION** — deployment con `target=production`. Alias: `costeador-vonhaucke.vercel.app`.
  Sólo se toca en un **cutover deliberado**, tras los gates.

## Reglas de etiquetado (taxonomía)
- `RC_DEPLOYED` SÓLO si: `vercel inspect <url>` reporta `target` = preview/null **y**
  el alias `vonhaucke-rc` apunta a ESE deployment. Verificarlo, no asumirlo.
- Si el deployment tiene `target=production` → es `PROD_DEPLOYED`. No maquillar la diferencia.

## Procedimiento RC (preview, no producción)
```bash
TOK=$(cat .vercel/claude-token)
# 1) Build de PREVIEW (BARE, SIN --prod → target=preview; NO uses --prod=false):
npx vercel deploy --token="$TOK" --yes --build-env GIT_SHA=$(git rev-parse --short HEAD)
# 2) Apuntar SÓLO el alias RC al deployment recién creado (NO el dominio de prod):
npx vercel alias set <deploy-url-preview> vonhaucke-rc.vercel.app --token="$TOK"
# 3) Verificar que NO se tocó producción:
npx vercel inspect <deploy-url-preview> --token="$TOK" | grep -E 'target|Aliases'
npx vercel alias ls --token="$TOK" | grep -E 'vonhaucke|costeador'
```
El SHA servido se comprueba en la pantalla de login (footer GIT_SHA) o en el build-env.

## Cutover a PRODUCTION (sólo tras los gates)
Gates antes de tocar `costeador-vonhaucke.vercel.app`:
1. `npm test` verde + `vite build` OK.
2. Smoke en RC (login, costeo, análisis, render).
3. Verificación humana de Dirección.
4. Adversarial LIVE de edges con JWT real (hoy `BLOCKED_EXTERNALLY`: falta JWT headless).

Sólo entonces: promover el deployment validado al alias de producción, y registrar el
deployment id + SHA en el informe. Rollback = re-aliasar el dominio de producción al
deployment anterior (que queda inmutable en Vercel).
