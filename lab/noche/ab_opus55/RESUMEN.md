# A/B · lectura de planos e imágenes: Sonnet 5.5 (producción) contra Opus 5.5 (RC) · 2026-10-13

Mismas 8 hojas de control, misma app (dev 5173 con Edge `-rc`) y cuenta QA. Solo cambia el modelo de la 1ª pasada visual y de la revisión de `analizar-mueble-rc`; el esfuerzo sigue en "low". El texto lo lee otro modelo (`claude-opus-5`), así que mesa_juntas_texto no cambia.

| Hoja | Sonnet 5.5 (`lab/noche/dif`) | Opus 5.5 (este) |
|---|---|---|
| credenza | FAIL 8/12 | **RIESGO 11/12** (PTR de la base 10.5 m contra 4.9–6; el plano no lo acota) |
| escritorio_L | ~~FAIL 4/6~~ → **PASS 6/6** | ~~FAIL 3/6~~ → **PASS 6/6** (falso FAIL de la hoja de control; ver corrección abajo) |
| gabinete_alto | FAIL 2/10 (respuesta degenerada, VH-178) | **PASS 10/10** |
| librero_5x8 | FAIL 4/6 (material 5×8, no lectura) | FAIL 4/6 (igual) |
| mesa_centro | FAIL 1/3 | **PASS 3/3** (el costo quedó incompleto por la cubierta de cristal en "hoja": corregido en `mapIaComps`) |
| mesa_juntas_texto | PASS 6/6 | PASS 6/6 |
| mesa_trabajo | PASS 6/6 | PASS 6/6 |
| mesa_trabajo_lote10 | PASS 6/6 | PASS 6/6 |
| **Renglones correctos** | **39 / 55 (71 %)** | **52 / 55 (95 %)** |
| Hojas PASS | 4 / 8 | 6 / 8 (+1 RIESGO) |

**Tiempo** (`ai_eventos`, solo lectura): Opus 5.5 tarda 25 s en imagen y 29 s en revisión en promedio (máximo 39 s), con 0 errores en 14 llamadas. Sonnet 5.5 tarda 21 s y 27 s, con 3 errores en 89 llamadas y un máximo de 76 s. El tiempo límite es 75 s. El problema de timeout que tenía el Opus anterior no se repite con Opus 5.5 en esfuerzo "low".

**Costo por lectura** (tokens medidos: ~23,400 de entrada y ~3,000–3,500 de salida, iguales en los dos modelos):

| | Sonnet 5.5 ($2/$10 por M) | Opus 5.5 ($4/$20 por M) |
|---|---|---|
| Imagen | ≈ $0.08 USD | ≈ $0.15 USD |
| Revisión | ≈ $0.09 USD | ≈ $0.17 USD |
| Mueble analizado (imagen + revisión) | ≈ $0.17 USD | ≈ $0.32 USD |

Es decir, cerca de **+$0.15 USD por mueble analizado**: el doble por lectura, a cambio de pasar de 71 % a 95 % de renglones bien leídos.

**Recomendación:** adoptar Opus 5.5 para la lectura visual. En RC ya está. En producción requiere autorización de Dirección y desplegar `analizar-mueble`. ~~El escritorio en L sigue fallando con los dos modelos.~~ **Corrección (2026-10-13):** la IA leía bien el escritorio. La hoja de control buscaba "cubierta" en el nombre, y la IA nombró los paneles "Panel lateral (pata panel) cubierta principal": la hoja los contaba como cubiertas duplicadas. Con `noPatron` en cubierta y retorno, las tres corridas guardadas (Sonnet, Opus y p10x) dan PASS 6/6 (`node lab/costear/verificarHoja.mjs`).
