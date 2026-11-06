# Cómo mejorar el costeo desde PLANO CRUDO (honesto, medido)

**Hecho probado:** VONI (IA de visión) **no** produce el mismo BOM dos veces desde un plano
crudo. Medido en el ENTCBCALP: los cuerpos valieron **$3,543 en una corrida y $0 en otra**;
el material fabricado osciló **−24% a −47%** entre lecturas. Por eso **±1% automático desde
plano crudo es imposible** — ninguna regla cierra esa varianza. El camino a ±1% es el BOM
guardado por clave (Producto Maestro), ya construido y probado.

Pero el **draft** del plano crudo SÍ se puede volver mucho más útil y seguro. Ideas en orden
de impacto / costo:

## 1. Benchmark por analogía  ✅ IMPLEMENTADO (`estimacionAnaloga.js`)
El negocio hace VARIANTES de muebles con BOM confirmado. Un draft nuevo se compara contra el
**costo/m² de los muebles similares guardados**. Si queda muy por debajo (el sub-conteo típico
−40%), se **avisa y se pide revisar antes de cotizar**. No inventa el costo: caza el error.
Cazó el draft real del ENTCBCALP ($11,297 vs benchmark ~$18,749 → aviso). Ya en Costeador.

## 2. Plantilla desde la clave más parecida (nearest-BOM prior)  ⏳ SIGUIENTE
En vez de que VONI enumere 29 piezas desde cero (ruidoso), el sistema trae el **BOM de la clave
más parecida** (tipo + dims) como PLANTILLA y VONI sólo **ajusta medidas y cantidades**. Mucho
menos varianza: no confías en que VONI "recuerde" el canto o los consumibles; ya están en la
plantilla. Es el salto grande una vez que hay varias claves guardadas.

## 3. Auto-consistencia (correr VONI N veces y reconciliar)  ⏳
Correr el análisis 3× y quedarse con las piezas que aparecen en ≥2 corridas, cantidad = mediana.
Mata directo la varianza "$3,543 → $0" (los cuerpos aparecen en la mayoría; la mediana es
estable). Cuesta N× la llamada; se usa sólo para muebles nuevos que se van a guardar.

## 4. Compuerta de completitud geométrica  ⏳
Si el mueble declara dims WxHxD pero la suma de áreas de panel del despiece es mucho menor de
lo que esas dims implican, **falta estructura** → bloquear/avisar. Determinista, barato.

## 5. Canto por geometría determinista  ⏳ (parcial)
El canto NO debe depender de que VONI lo lea. La regla de casa ya calcula metros por rol, pero
subcuenta cuando las piezas no traen un rol reconocido ("Cuerpo", "Copete"). Extender: **todo
panel de tablero con dims lleva canto por perímetro** (default por tipo), sin depender del rol.

## 6. Altas de catálogo guiadas por los BOMs  ⏳
Los BOMs reales nombran materiales que faltan en el catálogo curado (MDF 25mm, perfil ABS,
consumibles). Cargarlos cierra el hueco de "precio confirmado" y hace que todo re-precie en vivo.

---
**Realista:** con #1 (hecho) + #2 + #4, el draft del plano crudo pasa de "−40% y silencioso"
a "cerca y con aviso cuando no cuadra". No es ±1% automático — eso sólo lo da el BOM guardado —
pero deja de dar números peligrosamente bajos sin que nadie lo note. Eso es lo alcanzable.
