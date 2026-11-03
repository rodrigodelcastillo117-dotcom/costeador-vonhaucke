# 95_POSTDEPLOY_FASE3 — aviso de multi-mueble en COSTEAR · 2026-11-03

`segmentarPorProducto` (FASE 17 #2) existía con pruebas pero NO estaba conectado a la UI. Para el piloto, en vez de
cambiar el flujo de despiece en silencio (riesgo justo antes de poner a prueba), lo conecté como **aviso informativo**,
el mismo patrón de bajo riesgo del banner de línea.

## Qué hace
Cuando la IA devuelve un despiece cuyas piezas pertenecen a ≥2 muebles (p. ej. "escritorio en L con credenza"), aparece
un aviso: *"Parece haber varios muebles (escritorio + credenza). Para un costo más preciso, costea cada uno por separado.
Este es sólo un aviso; no cambié el despiece."*

- **No parte ni recostea nada automáticamente.** Sólo sugiere al usuario tomar una foto/descripción por mueble.
- Cae en `try/catch`: si falla, no rompe el flujo (banner simplemente no aparece).
- La lógica (`segmentarPorProducto`) ya está cubierta por 3 pruebas en `emparejarLinea.test.js`.

## Fix adicional (latente): los banners no se limpiaban al reiniciar
Encontré que `sugerenciaLinea` (banner de línea, FASE 17) no se reseteaba en `nuevaCorrida()` ni al cambiar de producto
→ podía quedar un banner viejo pegado al empezar un producto nuevo. Agregué `setSugerenciaLinea(null)` y
`setMultiMueble(null)` a ambos reset. 144 pruebas de AsistenteEspecial en verde; `vite build` compila.

## Estado: FASE 3 cerrada (como aviso, no como cambio de flujo). Decisión consciente: menos riesgo para el piloto.
Si Dirección quiere que además PARTA el despiece automáticamente (costear cada mueble como partida separada), es un
cambio de flujo mayor que haría aparte, con su RED→GREEN y revisión — no en la víspera del piloto.
