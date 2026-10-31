# 95_GO_NO_GO — veredicto honesto (Ronda 3, 2026-10-31)

El veredicto se separa por alcance. No hay un "GO global a 95" porque hay áreas SIN MEDIR (ver
`95_SCORECARD_ACTUAL.md`). Lo que SÍ se puede afirmar con evidencia:

## 1) Estado desplegado en producción HOY — **GO para el alcance actual del piloto**
- Frontend `d19557d` en vivo (`costeador-vonhaucke.vercel.app`, deploy `dpl_4PPf` READY), con **rollback a
  `fece6c3`** a un clic.
- Delta vs prod previo: pantalla Aprobar puentes (aditiva, solo Dirección) + **BLN-01 fail-closed (más
  conservador)** + perf de render. Ninguno relaja un gate; BLN-01 lo endurece.
- Núcleo económico fail-closed verificado: sin precio → no cuesta; sin confirmar → no emite; unidad
  incompatible → rechaza con materialDirecto 0; cantidad inválida → bloqueada (BLN-09 hardening en rama).
- 4008 pruebas verde, build verde.
- **Condición de uso del piloto:** costear/cotizar muebles con materiales **confirmados**; las partidas sin
  `material_confirmado` quedan correctamente no-emitibles (no es un bug, es el gate).

## 2) "95 comprobable en cada una de las 14 áreas" — **NO-GO todavía**
Bloqueado por evidencia faltante, no por defectos conocidos:
- **SIN MEDIR:** VONI (benchmark 30 casos), RENDERS (fidelidad), MOBILE, pentest vivo de SEGURIDAD.
- **NO RE-VERIFICADO en R3:** INICIO, COTIZAR, COCREAR, ACOMODO, CATÁLOGO, ARCHIVO.
- Requiere: (a) presupuesto de API de pago (Gemini/renders), (b) cuenta `qa-ventas`, (c) pasada E2E de 24
  proyectos con datos aislados.

## 3) Lo que NO debe ir a producción sin más trabajo/decisión
- Promoción de la rama a prod MÁS ALLÁ del delta ya desplegado: cualquier cambio económico nuevo necesita OK.
- El hardening **BLN-09** (`mapIaComps`) vive en la rama; requiere su propio merge+deploy autorizado.
- Aprobar los 42 puentes: pantalla lista; el click es de un humano de Dirección.

## Recomendación
**GO** para seguir el piloto con el alcance actual (muebles con material confirmado), con rollback armado.
**NO-GO** para anunciar "95 en las 14 áreas" hasta cerrar las 4 SIN MEDIR y re-verificar las 6 pendientes.
Rollback inmediato disponible si producción muestra cualquier regresión: `request_rollback` → `dpl_Duxmo…`.
