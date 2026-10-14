# Arnés QA · VH-148 con dos conexiones reales

Este arnés queda fuera del build y de CI.

## Qué levanta

El núcleo de Supabase, en local y con binarios oficiales:

- **Postgres 16** real (no PGlite).
- **GoTrue** v2.178.0 (`supabase/auth`), con sus 55 migraciones. Aporta `auth.uid()` y `auth.jwt()` reales.
- **PostgREST** v14.5 por omisión, la que corre la nube (`pg_stat_activity.application_name`). Se cambia con `PGRST_VERSION=12.2.3 ./preparar.sh`.
- **Gateway** con las rutas de la nube: `/auth/v1` y `/rest/v1`.

Las pruebas usan dos clientes `supabase-js` 2.112.3. Cada uno tiene su propia sesión de GoTrue, hecha con `signInWithPassword`, y su propio JWT.

## Base de datos

Se carga con el **mismo SQL** que usan las pruebas PGlite:

- `supabase/tests/helpers/baseVh148b.js`, la base de producción del 14-oct;
- el catálogo;
- las propuestas P1-03b, VH-148, VH-148b, SEG-01 y SEG-01c (rev4), en modo estricto.

`shim_pglite.mjs` sólo quita del preámbulo lo que en Supabase ya existe: el esquema `auth`, los roles, las extensiones y los stubs de `auth.uid()` y `auth.jwt()`.

## Cómo correrlo

Requiere Postgres 16 en `/usr/lib/postgresql/16/bin`, Node 22 y `curl`.

    ./preparar.sh            # binarios oficiales, pg local, secreto JWT aleatorio (no se versiona)
    ./reiniciar.sh           # Postgres + GoTrue + PostgREST + gateway desde cero, base cargada
    node dos_conexiones.mjs evidencia.json     # casos 1, 1b, 2 y 3 (exit 0 sólo si todos pasan)
    node medir_40001.mjs > medicion.json       # 40001 vs PT409 en PostgREST (después: ./reiniciar.sh)

## Datos

Sólo datos QA: correos `qa148-*@vonhaucke.test`, cliente "QA-VH148 · prueba de dos conexiones (sin datos comerciales)". Las contraseñas se generan al azar en cada corrida y nunca se imprimen. No toca la nube ni producción.
