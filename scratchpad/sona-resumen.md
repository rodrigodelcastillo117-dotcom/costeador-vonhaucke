# SONA BLM EDRIVE — lectura del presupuesto real (2603064, 08/05/2026)

Fuente: `~/Downloads/SONA 2603064 08 05 2026.pdf` (30 hojas).
Proyecto **A-2603064-001** · Presupuesto **226030108** · Asesor **RODOLFO PIRO** ·
Cliente **SONA BLM EDRIVE MEXICANA SAPI DE CV**, Silao de la Victoria, Guanajuato.
Marcado **"COTIZACION PRELIMINAR"**. Vigencia 15 días hábiles, 50% anticipo / 50% al aviso de entrega.

El PDF es casi todo imagen (229 palabras extraíbles). **Todo lo de abajo se leyó a ojo, renderizando
cada hoja a 200–700 dpi**, y cada clave alfanumérica se releyó en un segundo pase con zoom.

## Resultado: CUADRA AL PESO — 0 desviaciones

- **62 renglones** de producto, en **15 áreas**, hojas **8 a 22** del PDF.
- Cada renglón cumple `P.Unitario × Cantidad = Subtotal`.
- Cada hoja cumple `suma de renglones = Total Módulo`.
- Cada hoja cumple `Total Módulo × CANT. REQUERIDA = Importe del área`.
- La suma de las 15 áreas da **$1,609,934.00**, idéntico al subtotal de la hoja 7.
- IVA 16% = $257,589.44 → **Total proyecto $1,867,523.44**, idéntico a la carátula.

## ⚠️ Lo más importante que descubrí: cada hoja es un MÓDULO TIPO, no el área completa

La hoja de cada área **no** cotiza el área entera: cotiza **un módulo tipo** y abajo a la derecha
trae una tablita `CANT. REQUERIDA · P.U MODULO · IMPORTE` que lo multiplica.

Ejemplo que lo deja claro — **PA ABIERTA**: la tabla suma **$37,700** (Total Módulo), pero el
resumen de la hoja 7 dice **$377,000**, porque abajo dice **10 × $37,700**.

Si esto se ignora, el banco de precios queda bien pero **las cantidades quedan 10× cortas** en las
cuatro áreas con multiplicador. Por eso el JSON guarda `cantidad` (dentro del módulo),
`cantidadModulos`, `totalModulo` e `importeArea` por separado.

Áreas con multiplicador ≠ 1: PA ABIERTA (×10), PA ARCHIVE CENTER (×4), MANTENIMIENTO (×3),
PA WAITING AREA (×2). Las otras 11 van ×1.

## Cuadre área por área contra la hoja 7

| # | Área | Hoja | Renglones | Total Módulo | × Cant. | Importe | Hoja 7 | ✓ |
|---|------|------|-----------|--------------|---------|---------|--------|---|
| 1 | LOGISTICS | 8 | 5 | 46,038.00 | 1 | 46,038.00 | 46,038.00 | ✓ |
| 2 | LOGISTICS B | 9 | 6 | 138,400.00 | 1 | 138,400.00 | 138,400.00 | ✓ |
| 3 | PA ABIERTA EN EL AREA DE OFICINAS | 10 | 3 | 37,700.00 | **10** | 377,000.00 | 377,000.00 | ✓ |
| 4 | PA ARCHIVE CENTER | 11 | 2 | 31,870.00 | **4** | 127,480.00 | 127,480.00 | ✓ |
| 5 | PA PRIVADOS | 12 | 5 | 109,972.00 | 1 | 109,972.00 | 109,972.00 | ✓ |
| 6 | PA WAITING AREA | 13 | 3 | 37,224.00 | **2** | 74,448.00 | 74,448.00 | ✓ |
| 7 | OFICINA CEO | 14 | 7 | 127,024.00 | 1 | 127,024.00 | 127,024.00 | ✓ |
| 8 | SALA DE JUNTAS | 15 | 3 | 123,070.00 | 1 | 123,070.00 | 123,070.00 | ✓ |
| 9 | MANTENIMIENTO | 16 | 1 | 16,770.00 | **3** | 50,310.00 | 50,310.00 | ✓ |
| 10 | LOBBY | 17 | 4 | 156,090.00 | 1 | 156,090.00 | 156,090.00 | ✓ |
| 11 | SERVICIO MEDICO | 18 | 5 | 28,493.00 | 1 | 28,493.00 | 28,493.00 | ✓ |
| 12 | OFICINAS RH | 19 | 6 | 111,144.00 | 1 | 111,144.00 | 111,144.00 | ✓ |
| 13 | METROLOGIA | 20 | 5 | 35,185.00 | 1 | 35,185.00 | 35,185.00 | ✓ |
| 14 | METALURGIA | 21 | 2 | 59,730.00 | 1 | 59,730.00 | 59,730.00 | ✓ |
| 15 | CUARENTENA | 22 | 5 | 45,550.00 | 1 | 45,550.00 | 45,550.00 | ✓ |
| | **TOTAL** | | **62** | | | **1,609,934.00** | **1,609,934.00** | ✓ |

`+ IVA 16% $257,589.44` → **`TOTAL PROYECTO $1,867,523.44`** ✓

La hoja 7 también anota: *"Maniobras a Guanajuato pendientes por cotizar"* — el flete/maniobra
**NO** está dentro de estos $1.6M. Dato útil para la discusión del flete que ya está abierta.

## Las 29 claves con su precio (precio de LISTA de este presupuesto)

| Clave | P. Unitario | Veces | Qué es |
|-------|-------------|-------|--------|
| TATG12118AB001 | 9,310 | 2 | App LT · Módulo gerente 2100×1800, 1 usuario |
| TATG1158AB0001 | **6,860 / 5,700** ⚠️ | 4 | App LT · Módulo gerente 1500×750, 1 usuario |
| TATG11515AB0002 | 6,320 | 1 | App LT · Módulo gerencial 1500×1500 |
| TATS499AB00001 | 7,930 | 2 | App LT · Módulo mesa 900×900, 4 usuarios |
| TATO43012ABT01 | 17,620 | 1 | App LT · Módulo operativo 3000×1200, 4 usuarios (semimamparas cristal) |
| TATS103012AB01 | 34,870 | 1 | App LT · Mesa de juntas 3000×1200, 10 usuarios (2 cajas eléctricas) |
| CID11824BF6501 | 17,530 | 1 | Módulo director 1800×2400, 1 usuario |
| CIS41212BF5635 | 15,130 | 1 | Mesa de juntas 1200×1200, 4 usuarios (caja eléctrica) |
| MOA1154AB5055 | 12,980 | 1 | Módulo guarda 1500×447 |
| MOA1155AB6307 | 16,330 | 1 | Módulo guarda 1504×451 |
| MOXGAR2FMTL | 3,170 | 7 | Mox · Gaveta rodante 380×580×456 |
| A4CCCCABS | 15,100 | 5 | Archivero registro lateral 4 cajones 900×1330×465 |
| LIB36ABS | 16,770 | 5 | Librero fijo 4 entrepaños 900×1850×450 |
| MOCACI130LTABS | 7,140 | 1 | Modulor · Librero fijo 2 entrepaños 1300×745 |
| BSVIMEG2 | 10,560 | 1 | Bespoke · Vitrina médica 1500×600×430 |
| ACMC60-CS22 | 5,230 | 1 | Accents · Mesa cuadrada 600×600×400, cristal satinado 9 mm |
| ACML60-CS22 | 5,970 | 1 | Accents · Mesa cuadrada 600×600×600, cristal satinado |
| ACMCC22ABS | 2,510 | 1 | Accents · Mesa cuadrada 600×600×400, melamina canto ABS |
| C4-EM-BNF | 1,850 | 6 | Silla operativa (mesh 109, tela WT805) |
| C4-EL-BNF-CAB | 2,405 | 4 | Silla operativa con cabecera |
| ESP-REWIND | 2,749 | 4 | Silla de visitas 4 puntos |
| ALPHA | 11,950 | 1 | Silla directiva (aluminio, GT07-35E, GT-27) |
| GAMMA-E | 4,140 | 1 | Silla operativa (TF-15ZB, GT-27, HM-38) |
| VION-CAJ | 11,360 | 1 | Silla para cajera VION, descanza-pies 6328-6 |
| AESLIT | 25,650 | 1 | Aero · Sofá individual, tela |
| AESLDT | 39,480 | 2 | Aero · Sofá 2 plazas, tela |
| AESLDEP | 27,500 | 1 | Aero · Sofá 2 plazas, ecopiel |
| WLSIRE3MDECP | 17,450 | 1 | Work Lounge · Sillón rectangular 1700×719×700, respaldo derecho |
| WLSIRE3MIECP | 17,450 | 1 | Work Lounge · Sillón rectangular 1700×700×700, respaldo izquierdo |

Dos renglones **sin clave impresa** (así viene el papel, no es error de lectura):
- Módulo mesa de centro 900×600, tipo WL, 1 usuario — $2,324 (PA WAITING AREA)
- Mesa de centro 900×900 Work Lounge, melamina canto ABS, base metálica — $3,077 (OFICINA CEO)

### ⚠️ Hallazgo: la MISMA clave con dos precios en el MISMO presupuesto

`TATG1158AB0001` (App LT, módulo gerente 1500×750) sale a:
- **$6,860** en LOGISTICS (hoja 8) y SERVICIO MEDICO (hoja 18)
- **$5,700** en METROLOGIA (hoja 20) y CUARENTENA (hoja 22)

Es una diferencia del **20.4%** dentro del mismo papel, misma fecha, mismo asesor. Los dos precios
se releyeron con zoom y ambos están bien leídos. Hay que preguntarle a Rodrigo/Rodolfo si es
descuento por área, error del presupuesto, o dos configuraciones distintas con la misma clave.
Mientras no se resuelva, **no promediar**: el JSON guarda los cuatro renglones tal cual, con su hoja.

Dato de contraste: el banco ya tiene `TATG1158AB0001` a **$6,860** (fuente `225080025`), que
coincide con el precio alto. Eso refuerza que $6,860 es el de lista y $5,700 lleva algo encima.

## Renders / fotos que vale la pena extraer del PDF

Todas las hojas de módulo (8–22) traen, debajo de la tabla, tres columnas rotuladas
**Ubicación · Módulo · Sillería** con imágenes limpias de producto sobre fondo blanco. Son
exactamente el tipo de imagen que la ficha de producto y el PDF de propuesta necesitan.

Lo aprovechable, ordenado por valor:

1. **Sillería sobre fondo blanco, ya recortada** (hojas 8, 10, 12, 14, 15, 16, 18, 19, 20, 21, 22).
   Cubre C4-EM-BNF, C4-EL-BNF-CAB, ESP-REWIND, ALPHA y GAMMA-E. Se pueden empatar por clave con
   `imagenesSilleria.js` — que ya tiene 18 fotos subidas.
2. **Renders isométricos de módulo** (todas las hojas de módulo): escritorio en L App LT, bench
   operativo 4 usuarios, mesa de juntas 3000×1200, gaveta rodante Mox, librero LIB36ABS,
   archivero A4CCCCABS, sofá Aero, sillón Work Lounge, vitrina médica Bespoke. Sirven directo
   como thumbnail de la ficha de producto, indexados por clave.
3. **Planos de distribución (hojas 23–26)** — 2D a escala 1:100 y dos isométricos 3D del piso
   completo, firmados por Marco Antonio Bahena (proyectista) y Rodolfo Piro. La hoja 23 rotula
   LOGISTICS AREA, LOBBY, KITCHEN AREA, DINING ROOM; la hoja 25 rotula PRIVATE OFFICE ONE–FOUR,
   ARCHIVE CENTER, BOARDROOM, WAITING AREA, SNACK, COPY CENTER, baños. Es material de referencia
   real para el Acomodo 3D y para el render por área.
4. Ojo con la hoja 23: trae un recuadro rojo grande que dice **"MOBILIARIO SIN COTIZAR"** sobre
   el comedor / areas to train. O sea, el plano cubre más superficie que el presupuesto.

Extracción: `python3 -c "import fitz; d=fitz.open(PDF); [print(i,d[i].get_images()) for i in range(30)]"`
— cada hoja tiene 1 sola imagen embebida (la hoja completa rasterizada), así que **no se pueden
sacar los muebles como PNG sueltos**; hay que recortarlos por coordenada con
`get_pixmap(clip=fitz.Rect(...))`. Los recortes de esta sesión quedaron en
`scratchpad/sona-p*.png`, `t-p*.png`, `c-p*.png`, `d-p*.png`.

## Cómo se leyó (para poder repetirlo)

```bash
python3 -c "
import fitz
d=fitz.open('/Users/rodrigodelcastillo/Downloads/SONA 2603064 08 05 2026.pdf')
d[8].get_pixmap(dpi=260, clip=fitz.Rect(40,105,775,345)).save('scratchpad/t-p9.png')"
```
- `clip=Rect(40,105,775,345)` → la tabla de producto de una hoja de módulo.
- `clip=Rect(380,455,785,575)` → la tablita `CANT. REQUERIDA / P.U MODULO / IMPORTE`.
- `clip=Rect(166,118,480,300)` a 460 dpi → sólo la columna de descripción, para releer las claves.

La verificación está automatizada en `scratchpad/sona-build.py`: reconstruye el JSON y truena si
alguna multiplicación, algún Total Módulo o algún importe de área deja de cuadrar.
