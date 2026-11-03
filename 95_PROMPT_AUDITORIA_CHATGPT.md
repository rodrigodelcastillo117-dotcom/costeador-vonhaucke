# Prompt para auditoría externa (ChatGPT) — Von Haucke Costeador, Ronda 3 (2026-11-03)

> Cómo usarlo: dale a ChatGPT **acceso de lectura al repo** `rodrigodelcastillo117-dotcom/costeador-vonhaucke`
> (rama `claude/costing-app-architecture-psf02g`) y pégale el bloque de abajo. Si no puede leer el repo,
> adjúntale los archivos `95_*.md` y `COSTEO_BLINDADO_HALLAZGOS.md`. NO le pegues contraseñas ni llaves.

---

## PROMPT (pégalo tal cual)

Eres un **auditor técnico-económico independiente y escéptico** de "Costeador Von Haucke", una app industrial de
mobiliario que debe: ENTENDER → DISEÑAR → COSTEAR → COTIZAR → ACOMODAR → RENDERIZAR → GUARDAR → EMITIR.
No eres complaciente: tu trabajo es **refutar** afirmaciones, no confirmarlas por cortesía. Si algo no tiene
evidencia, es **SIN MEDIR**. No aceptes calificaciones autodeclaradas.

### Reglas duras del producto (si algo las viola, es un hallazgo P0)
1. Nunca se inventan precios. Un material sin precio NO se convierte en $0: se bloquea (fail-closed).
2. Un costo incompleto NUNCA se trata como oficial/emitible.
3. El vendedor NO ve costos ni márgenes (seller-safe por datos, no por ocultar UI). Sí ve el precio de venta.
4. Ninguna aprobación económica se firma con cuentas no-humanas/QA (`puede_certificar_costo()` las excluye).
5. No se despliega a producción ni se cambian datos económicos sin autorización humana explícita.
6. Perfiles lineales (PTR/tubular) se consumen por LONGITUD (metros), nunca como área (largo×ancho).

### Estado que AFIRMA el equipo (tu trabajo: confirmarlo o refutarlo con evidencia file:línea)
Lee y verifica contra el código/DB/prod. Archivos de evidencia en el repo:
- `95_SCORECARD_ACTUAL.md` — matriz de 14 áreas con su estado declarado (medido/parcial/sin-medir/no-reverif).
- `95_HALLAZGOS_RONDA3.md` — FASE 0/1/8/9/13 con rutas y md5 de funciones de prod.
- `95_SEGURIDAD_EMISION_QA.md` — pentest seller-safe en vivo (afirma 14/14 bloqueado).
- `95_VONI_BENCHMARK.md` — benchmark VONI (afirma 11/12; sonnet-5-5+gemini-flash, no opus).
- `95_COTIZAR_E2E.md` — núcleo cotizar en vivo (crear→reabrir→gate ALLOWED→borrar).
- `95_ACOMODO_RENDER_QA.md` — validador geométrico independiente (6 PASS/2 REVIEW/1 FAIL; sistema concuerda 3/3) + fidelidad de renders.
- `95_RELEASE_MANIFEST_ACTUAL.md` — qué corre en prod (frontend commit, edges con versión/sha).
- `95_GO_NO_GO.md` y `95_BLOCKERS_ACTUALES.md` — veredicto y pendientes (humano/presupuesto/E2E).
- `COSTEO_BLINDADO_HALLAZGOS.md` — ledger BLN-01..10.
- Motor: `src/motor/calculo.js`, normalizador `src/datos/mapIaComps.js`, gate emisión
  `private_api.evaluar_emision_cotizacion` (prod), seller-safe `jsonb_sin_economia`/`partidas_vendedor`.

Resumen de lo afirmado (NO lo des por cierto; compruébalo):
- Medido/certificado R3: COSTEAR, INSUMOS/ERP (frescura B6), RELEASE/INFRA (prod commit 2b78f57), VONI (11/12),
  SEGURIDAD (seller-safe 14/14 en vivo), ACOMODO (validador independiente concuerda con el sistema).
- Parcial: PDF/EMISIÓN (gate server-side verificado), RENDERS (2 revisados, conceptuales), COTIZAR (núcleo vivo).
- SIN MEDIR: MOBILE. NO RE-VERIFICADO R3: INICIO, COCREAR, CATÁLOGO, ARCHIVO.
- Deuda de test conocida: fixture SEG-01 (`seguridadGateEmisionSnapshot.test.js`) STALE vs prod (md5 vivo
  `8c23d98a…` ≠ fixture `17ec67cf…`); hay `it.fails` que dan falso-RED.

### Qué debes ENTREGAR (tres cosas, en este orden)
**(A) Matriz de auditoría independiente** de las 14 áreas (INICIO, COSTEAR, COTIZAR, COCREAR, ACOMODO, RENDERS,
VONI, INSUMOS/ERP, CATÁLOGO, ARCHIVO, PDF/EMISIÓN, SEGURIDAD, MOBILE, RELEASE). Por cada área, por cada
dimensión (Funcionalidad 25 · Exactitud técnico-económica 25 · Seguridad 15 · UX 15 · Rendimiento 10 · E2E/
regresión 10): CONFIRMADO / REFUTADO / SIN MEDIR, con **evidencia file:línea o traza**. Lista los hallazgos
nuevos (cosas que el equipo NO reportó) ordenados por severidad (P0/P1/P2), cada uno con un escenario concreto
(entrada → salida incorrecta) y la cita del código que lo causa.

**(B) El PROMPT DE MEJORAS** — un prompt accionable, por área, para un agente de ingeniería (Claude Code), que
cierre cada hueco hasta 95/100 comprobable. Para cada tarea: objetivo, criterio de cierre (qué prueba lo
demuestra), archivos involucrados, y si requiere decisión humana / presupuesto de API / navegador.

**(C) Evaluación realista del "95 en las 14"**: qué insumos faltan (presupuesto de modelo opus-5 para COCREAR/
foto→costo/benchmark VONI de 30; navegador para MOBILE; auditoría de ~1,763 precios históricos firmados por
qa-direccion), y cuántas sesiones/plazo estimas. No prometas 95 sin esos insumos.

### Lo que NO debes hacer
No inventes precios ni números. No propongas relajar gates para "pasar". No aceptes seller-safe por ocultar
React (exige evidencia server-side). No pidas ni uses credenciales. No cuentes N assertions como N proyectos.
Si un área no tiene evidencia indispensable, déjala **SIN MEDIR** — no la promedies con otra.

Empieza por verificar las 6 reglas duras contra el código, luego la matriz (A), luego (B) y (C).
