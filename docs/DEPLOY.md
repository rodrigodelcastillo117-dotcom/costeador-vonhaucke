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

## Actualización 2026-10-03 (segundo intento, verificado)
Se intentó un deploy **`--prod=false`** y aun así Vercel lo marcó `target=production`
y **movió automáticamente** los dominios de producción al nuevo deployment. Es decir:
desde la CLI, este proyecto **promueve todo deploy a producción** (no respeta `--prod=false`
para el aliasing de producción). Por eso la separación RC/PROD **no se puede garantizar sólo
con flags de CLI**.

**Mitigación aplicada:** tras cada deploy se **re-aliasan a mano** los dominios de producción
al deployment baseline aprobado, dejando `vonhaucke-rc` en el nuevo. Estado actual:
- `vonhaucke-rc.vercel.app` → `4pfj6zrvf` (trabajo nuevo de hoy).
- `costeador-vonhaucke.vercel.app` (PROD) → `4a522agu4` (baseline previo, congelado).

**Fix real pendiente (manual, Vercel dashboard/API):** configurar el proyecto para que
los deploys de CLI sean *preview* por defecto (p.ej. conectar Git y fijar la Production
Branch, o usar un proyecto Vercel separado para producción). Hasta entonces, **todo deploy
debe ir seguido del re-alias manual de producción**, o se promueve sin querer.

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
# 1) Build de PREVIEW (NO --prod):
npx vercel --token="$TOK" --yes --prod=false --build-env GIT_SHA=$(git rev-parse --short HEAD)
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
