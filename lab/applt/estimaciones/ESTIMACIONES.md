# Qué se puede estimar y con qué error · APP LT · 2026-10-13

**Regla:** un dato estimado se marca **ESTIMADO**, con su método y su rango, y nunca se carga al motor como si fuera real. Antes de usar un método, se prueba "a ciegas": se tapa una pieza que sí conocemos, se estima con sus hermanas y se compara contra el reporte real del cotizador ERP (`lab/applt/componentes`).

Costo de fabricación = MP + horas estándar × MO real por área + indirectos UNA vez (tarifa de planta $82.37/h).

Scripts reproducibles: `prueba_ciega_medidas.py` y `prueba_ciega_acomodo_hoja.py`. Salida en `salida_*.txt`.

## 1. Prueba ciega: qué tan bien estima cada método

| Pieza tapada | Estimada con | Método | Error MP | Error costo fab. |
|---|---|---|---|---|
| ATPU75M (750) | ATPU2M + ATPU3M | interpolar por largo | +0.6 % | **+1.5 %** |
| ATPU3M (900) | ATPU2M + ATPU75M | extrapolar por largo | −1.1 % | **−2.7 %** |
| ATPU2M (600) | ATPU75M + ATPU3M | extrapolar por largo | −1.2 % | **−3.1 %** |
| ATFAL150 (900) | ATFAL12 (800) | proporcional + elasticidad de horas | −1.0 % | −5.9 % (carpintería real 0.48 h vs 0.31 h estimadas) |
| ATOM4 (1150) | ATOM3 (850) | proporcional + elasticidad de patas | −15.0 % | −11.3 % |
| ATCUBD45 (1500×1200) | ATCUBD44 + ATCUBD46 | **interpolar por largo** | **−22.1 %** | **−18.7 %** ❌ |
| ATCUBS45 (1500×600) | ATCUBS44 + ATCUBS46 | **interpolar por largo** | **−21.1 %** | **−26.2 %** ❌ |
| ATCUBD45 / ATCUBD46 | ATCUBD44 | **acomodo en hoja 4×8** + canto por perímetro | **+0.9 % / +1.8 %** | — |
| ATCUBS45 / ATCUBS46 | ATCUBS44 | **acomodo en hoja 4×8** + canto por perímetro | **+1.0 % / +1.9 %** | — |

**Lección:** el tablero NO se consume por medida, sino por cuántas piezas caben en la hoja. El ERP carga ½ hoja a la 1200×1200 y 1 hoja entera a la 1500×1200 y a la 1800×1200: la de 1500 cuesta casi lo mismo que la de 1800. Si se estima "por regla de tres", se falla −20 %; con acomodo en hoja, +1 a +2 %. El motor de la app ya tiene optimizador de corte 2D: es el método correcto para cocrear con cambio de medidas.

## 2. Estimaciones de lo que falta (ESTIMADO, no dato)

| Falta | Estimación | Método | Rango / confianza |
|---|---|---|---|
| Carpintería de ATCUBS46ABS (el reporte la trae vacía) | **≈ 0.91 h** | tendencia S44→S45 (+12 %/300 mm) = 1.04 h · patrón D45→D46 (−16 %) = 0.79 h | 0.79–1.04 h → costo fab. **$802–$843** (hoy el reporte da $672, sin carpintería). Confianza media |
| ATOM5 (omega para cubierta 1800) | MP **$93.73** · pm 0.137 h · acabados 0.120 h · pintura 0.0033 h → fab. **≈ $138** | extrapolación lineal ATOM3→ATOM4; largo **1450 mm inferido** del patrón (cubierta − 350 mm: 850/1200, 1150/1500) | ±3 % si el largo es 1450 (error de la extrapolación en patas). **Confirmar el largo con Diseño** |

## 3. Lo que NO se puede estimar bien con lo que hay

- **Carpintería de cubiertas:** ATCUBD46 (1.25 h) trae menos que ATCUBD45 (1.49 h) siendo más grande. O es un error del estándar o hay un proceso distinto. Sin esa respuesta, cualquier estimación de carpintería tiene ±15 %.
- **Muebles nuevos sin pariente en el catálogo:** con 15 piezas de una sola línea no hay base estadística para otras líneas. Para eso existen Alba × dificultad (±20–30 % por pieza, casi exacto en conjuntos) o las horas del ERP de piezas parecidas.
- **Biombos de otras medidas, ATRICDB5/6, ATPU4M:** el material sí se estima (cristal por área, lámina por largo), pero no hay reporte individual de horas. ATPU4M y ATRICDB4 tienen horas solo porque se despejaron del módulo 6U.
