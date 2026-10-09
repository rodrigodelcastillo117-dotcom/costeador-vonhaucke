# INSTRUCCIONES PARA CHATGPT — AUDITOR FINAL

Rodrigo pidió que ChatGPT actúe inmediatamente después de Claude, sin reconstruir contexto.

## CONTEXTO MÍNIMO
- branch: `audit/final-product-completion` · HEAD `f263ba96bc87e3da6aae16ae9016576b414c3de7`
- base del cierre: `b0092ff3b8c480c988f0c9f193109330948e40fa`
- Preview Vercel READY: `https://costeador-vonhaucke-p8gqeurml-rodrigos-eurotrip.vercel.app` (dpl `dpl_4kEu62x2ck9cobnUPfz4hxzpZ2ig`)
- Production: **NO desplegado** (promoción BLOQUEADA por el harness de Claude; requiere acción de Rodrigo).
- Rollback prod actual: `dpl_1m4bDohVjcqL86fcGHRhJTnw2rJc` / `5a38d2edf6c6d55fc8c8b26e5149c88c042479a2`.

## CHATGPT DEBE
1. NO confiar ciegamente en este reporte.
2. Leer: `FINAL_AUDIT_PACKET.md`, `HANDOFF_CHATGPT.md`, `CLOSEOUT_STATE.md`, `TEST_EVIDENCE.md`.
3. Obtener el HEAD real de GitHub y compararlo contra `f263ba9` / base `b0092ff`.
4. Revisar el diff real (`git diff b0092ff..f263ba9`).
5. Auditar cada PASS importante contra el código (no asumir).
6. Revisar el Vercel Preview + build logs.
7. Revisar Supabase en read-only cuando sea necesario (edges: `leer-plano` v11 / `leer-plano-core` v4 son los VIEJOS; el lector nuevo del repo NO está desplegado).
8. Buscar regresiones y falsos verdes. Prioridad: dinero, identidad de producto, persistencia, observed→proposal→confirmation, seguridad/permisos, seller-safe.
9. NO asumir que source-assert = E2E; mock = live; recorded contract = live edge; build verde = flujo autenticado verde.
10. NO hacer Production automáticamente.

## QUÉ FALTA DE VERDAD (no es trabajo fácil tirado a ChatGPT; es lo que objetivamente requiere datos/decisión/irreversible)
- **Cutover de precios/materiales reales** (DATA_TRUTH): el catálogo real de venta ya se parseó en SHADOW con la regla de precio confirmada (mobiliario→Precio Lista, sillería→Precio Mínimo, sofás/lounge→Lista; ambiguo→PRICE_BASIS_UNKNOWN). Falta ingestar materias primas (~16.4k, `cata_mp`), despiece (`cuanti_mp`) y estructura de costo (`info_t_d_c`), construir el puente shadow→compare→cutover con evidencia, y SÓLO entonces cutover de productos NUEVOS (legacy intacto). También falta jalar el Drive de Rodrigo (materias primas + más cotizaciones).
- **Vocabulario amplio de mobiliario del lector** + **deploy de edges** `leer-plano`/`leer-plano-core` (prod v11/v4 no emiten observed_program). Validar con PDF real antes de desplegar.
- **E2E autenticado** de los 3 flujos (Costear/Cotizar/Cocrear) + reset de contraseña live: requiere credenciales de prueba.

## CHATGPT PUEDE CORREGIR DIRECTAMENTE (en rama de auditoría/RC, sin esperar a Rodrigo)
frontend, UX, tests, bugs JS/React, lógica determinista, guards, validaciones, wiring, mensajes, PDF, persistencia, performance (code-split del bundle ~1.19MB), dependencias seguras, config segura, regresiones demostrables. SIEMPRE que no requiera DATA TRUTH inventada, migración destructiva, tocar las 33 legacy, Intelisis, credenciales nuevas, ni acción irreversible en producción. Después de cada corrección: TEST → BUILD → RE-AUDIT → PREVIEW.

## DESPUÉS, CHATGPT DEBE CREAR `CHATGPT_AUDIT_FINAL.md`
# VONHAUCKE — CHATGPT FINAL AUDIT
Con: fecha; rama; SHA recibido de Claude (`f263ba9`); SHA final tras ChatGPT; qué auditó; qué aceptó; qué rechazó; errores (P0/P1/P2); cambios hechos; archivos modificados; tests agregados; tests finales; build final; Preview final; warnings; BLOCKED_EXTERNAL; DATA_TRUTH requerida; riesgos residuales; rollback SHA; GO/NO-GO.
Si NO hay errores: escribir `NO CODE CHANGES REQUIRED` + evidencia. Si SÍ corrige: documentar qué y por qué.

## LA ÚLTIMA FRONTERA
Production SÓLO después de que Rodrigo lo autorice (y en este entorno, la promoción la hace Rodrigo o un operador con permiso — el harness de Claude la bloquea).
