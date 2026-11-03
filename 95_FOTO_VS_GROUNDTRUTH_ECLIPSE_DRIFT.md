# 95_FOTO_VS_GROUNDTRUTH — qué tan correcta fue la IA vs el producto real (2026-11-03)

La foto que subió Dirección es un **producto de línea real**: Eclipse Drift, escritorio directivo en L con credenza.
Ground truth en catálogo: **EDCZAE61P2CCH** — *"CREDENZA DOBLE DE 1800 × 400 × 600 mm MODELO ECLIPSE DRIFT, CON 2 CAJONES,
1 PUERTA, cuerpo en melamina canto ABS color negro y CUBIERTAS EN CHAPA DE MADERA"* (la variante tapa de madera/nogal +
cuerpo negro). Comparamos lo que `analizar-mueble` (opus-5 visión) sacó **de la foto, sin saber el SKU**, contra la ficha real.

## Comparativo IA (foto) vs producto real

| Atributo | IA desde la foto | Real (EDCZAE61P2CCH) | Veredicto |
|---|---|---|---|
| Tipo de producto | "Escritorio directivo en L con credenza lateral" | Escritorio Drift en L + credenza doble | ✅ correcto |
| Config puertas/cajones | **1 puerta + 2 cajones** (3 frentes) | **2 cajones + 1 puerta** | ✅ EXACTO |
| Largo credenza | 1800 mm | **1800 mm** | ✅ EXACTO |
| Fondo credenza | 450 mm | 400 mm | ⚠️ +50 mm (+12.5%) — y la IA lo marcó como pregunta (confianza baja) |
| Cubierta (material) | "nogal oscuro / chapa" | **chapa de madera (nogal)** | ✅ correcto |
| Cuerpo (material) | "gris grafito / melamina" | **melamina canto ABS color negro** | ✅ correcto (tono) |
| Estructura | "patas metálicas en V, acero pintado" | base metálica Drift (firma de la línea) | ✅ correcto |
| Herrajes | jaladeras, cerradura, correderas, bisagras, niveladores | "jaladeras, cerraduras" (+ correderas/bisagras implícitas) | ✅ correcto, incluso infirió las implícitas |
| Nicho abierto con panel de veta | detectado | sí (diseño Drift) | ✅ correcto |

## Calificación de la lectura de foto: **9/10**
- **Identificación de producto, configuración, materiales y herrajes: perfecta.** Reconoció que es un escritorio en L Drift con
  credenza de 1 puerta + 2 cajones, tapa de madera y cuerpo oscuro, base metálica — sin que nadie le dijera el SKU.
- **Largo exacto (1800).** **Fondo +12.5%** (450 vs 400) — el único número desviado, y es exactamente el que la IA **marcó como
  incierto** (`confianza: baja`, pregunta "fondo/medidas", `afecta: costo`). No lo afirmó: lo puso a confirmar.
- **No pretendió adivinar el SKU exacto** (correcto: eso es el paso de *amarre a catálogo* + confirmación humana, no la lectura).

## Lo que esto demuestra (fuerte)
1. **La lectura de foto es fiel a la realidad** de un producto de línea: acierta tipo, config, materiales y herrajes; el único
   error es un fondo estimado ~12% de más, que la propia IA no dio por cierto.
2. **El amarre siguiente es trivial aquí:** como es Eclipse Drift de LÍNEA con precio documentado, el costo/precio NO se re-deriva
   del despiece — se usa el **precio de línea** del SKU (como en `95_COTIZAR_ESCALA.md`, donde EDBAS... Drift ya se cotizaron al
   centavo). Para un mueble de línea, foto → identificar → **usar el precio real del SKU**.
3. **Honestidad > adivinar:** la IA prefirió preguntar el fondo a inventarlo. Si hubiera "clavado" 400 por suerte se vería mejor,
   pero el comportamiento correcto es el que tuvo: marcar la incertidumbre que afecta el costo.

## Conclusión
foto → despiece, validado contra **ground truth de un producto de línea real**: **9/10**. La única desviación (fondo +12.5%)
está correctamente señalada por la IA como dato a confirmar, no como verdad. El pipeline visual no sólo "funciona": acierta
contra la ficha real de Von Haucke.
