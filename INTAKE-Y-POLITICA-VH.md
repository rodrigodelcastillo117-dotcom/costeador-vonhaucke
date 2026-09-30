# Cómo Vonhaucke solicita y costea de verdad (Rafa + Alba)

Fuente: dos formatos reales que pasó Rodrigo el 2026-09-30.
- **Archivo 1 (Rafa):** `REG-DCC-IDP-012` "SOLICITUD DE DESARROLLO Y COSTOS" — cómo
  se PIDE un producto nuevo (el intake).
- **Archivo 2 (Alba):** `REG-DCC-IDP-032` "SOLICITUD DE TABLA DE COMPARACIÓN"
  (C-CO-516R) — cómo se ENTREGAN costos + la política de precios estándar.
  Ojo: este archivo trae la política y la plantilla, NO los $ ya llenos de ese
  copete. Para calibrar números sigue haciendo falta una T.D.C. LLENA.

---

## 1) Taxonomía de intake (archivo de Rafa) — lo que la app debería capturar
Por cada pieza/artículo:
- **Se compone de:** Cuerpos estructurales · Cajones · Puertas · Ductos ·
  Accesos/acometidas · **Dirección de vetas** · **Dirección de satinados**.
- **Materiales con espesor/calibre:** Aglomerado · MDF · Cristales ·
  **Láminas (calibre)** · **Tubular cuadrado/redondo (calibre + medida, p.ej. 1")** ·
  Tubular rectangular · Superficie sólida · Acrílico/Policarbonato · Cubre canto.
- **Acabados con código Op:** Melaminas · Pinturas · PVC · Chapas · Mármoles ·
  Madera natural · HP. (La Hoja2 del archivo trae el CATÁLOGO completo de valores
  válidos, con sus códigos Op — sirve como fuente de los dropdowns.)
- **Herrajes:** Correderas · Cerraduras · Bisagras · Jaladeras · Componentes
  eléctricos.
- **Empaque** (opciones tipificadas) · **Tipo de venta** (co_creación / tradicional) ·
  **Tipo de entrega** (con/sin maniobras-transporte-instalación + zona: metro,
  república, frontera, USA por región).
- **Rangos de volumen:** 1 · 2-10 · 11-25 · 26-50 · 51-75 · 76-100 · 100-499 ·
  500-749 · 750-1000 · pieza única. Precio por rango en **PM / PL / P2** +
  **Costo de fabricación**.

### Respuestas de Rafa (2026-09-30) — confirmaciones clave
- La estructura "se compone de" es correcta. **En cada parte lo que se le envía a
  Alba es la CANTIDAD DE MATERIAL A CONSUMIR** (lámina, tubular, tablero en
  melamina o chapa, cristales, correderas, cerraduras, etc.). → El intake ES un
  **despiece por consumo**. Esto valida la dirección de la app (costear desde el
  consumo / fracción de hoja).
- Los acabados salen del **catálogo de acabados**. Un **acabado especial** se pide
  con previa cotización, o se toma un precio comercial de internet. → El catálogo
  Op es la lista maestra; los especiales son ad-hoc, no de catálogo.
- **PM / PL / P2 no son costos distintos: son precios con distintos FACTORES DE
  UTILIDAD** que aplica Alba sobre el mismo costo.
- **FLUJO REAL: primero el COSTEO, después el desarrollo.** El desarrollo se pide
  con base en los consumos del costeo. → El costeo (desde consumos) es el artefacto
  primario; la app debe centrarse en eso y de ahí derivar todo lo demás.

## 2) Política de precios (archivo de Alba) — `standard_line`
Factores por tipo de producto (columnas del REG-DCC-IDP-032):

| Tipo | costo_producto | mano_de_obra | gasto_indirecto | precio_mín | comercial |
|---|---|---|---|---|---|
| mueble_fabricado | 0.2 | 3 | 1.45 | 0.7 | 0.1 |
| componente_fabricado | 0.15 | 3 | 1.45 | 0.7 | 0.1 |
| mueble_compra_venta | 0.01 | 0.05 | 1.25 | 0.7 | 0.1 |
| componente_compra_venta | 0.05 | 0.05 | 1.25 | 0.7 | 0.1 |
| accesorio_compra_venta | 0.01 | 0.05 | 1.25 | 0.7 | 0.1 |
| servicio_directo | 0.1 | 2.75 | 1.2 | — | 1.2 |

Diferenciación clara: **fabricado carga más indirecto que compra-venta** (1.45 vs
1.25). La app hoy usa **34% plano** para todo — por eso subestima lo fabricado.

## 3) ✅ FÓRMULA DERIVADA Y VERIFICADA AL CENTAVO (T.D.C. llena de Alba, 2026-09-30)
Alba mandó `C-CO-516R ... ejercicio.xlsx` — el T.D.C. LLENO con despiece + resultado.
De ahí se derivó la fórmula real y se verificó exacta contra el número de Alba.

**Copete id_01 (mueble fabricado, volumen 750-1000):**
- Material = Σ(consumo_unitario × costo_última_compra) = **$460.57**
  (tubular 183.62 + bisagras 66.06 + lám cal14 22.51 + lám cal18 13.93 +
   tornillo 100 + tuerca 2.64 + pintura 60.06 + empaque 11.75 = 460.57 exacto)
- Mano de obra = **$92.11 = material × 0.20**  ✅ exacto
- Gasto indirecto = **$276.33 = mano de obra × 3**  ✅ exacto
- **Costo de fabricación = $829.01 = material + MO + indirecto = material × 1.80** ✅

**Fórmula de costo por tipo** (factores de la política `standard_line`; MO = factor
sobre material, Indirecto = factor sobre MO):

| Tipo | MO (× material) | Indirecto (× MO) |
|---|---|---|
| mueble_fabricado | 0.20 | 3 |
| componente_fabricado | 0.15 | 3 |
| mueble_compra_venta | 0.01 | 0.05 |
| componente_compra_venta | 0.05 | 0.05 |
| accesorio_compra_venta | 0.01 | 0.05 |
| servicio_directo | 0.10 | 3 |

**Precio (nivel × volumen)** sobre el costo de fabricación:
- precio_mínimo = costo_fab × factor_volumen
  (mueble_fabricado: 1.55 alto / 1.95 intermedio / 2.35 bajo)
- precio_lista = precio_mínimo ÷ 0.7
- precio_2     = precio_mínimo ÷ 0.42
- Verificado: 829.01 × 1.55 = 1285 (→ $1,290) · ÷0.7 = $1,850 · ÷0.42 = $3,080.
- Factores de volumen: compra_venta 1.4/1.8/2.2; accesorio 1.4/1.45/1.5;
  servicio 1.2/1.2/1.2.

**Consistencia con la banca C-CO-510R:** indirecto = MO×3 también cuadra
($1,180×3 = $3,540 ≈ $3,576 real). La banca tiene MO≈15.5% del material (no 20%),
probablemente por ser costeo anterior/especial; el copete es el método vigente.

**Estructura del despiece (hoja Explo_MP):** por artículo — familia_de_operación,
articulo (clave ERP), descripción, opción, unidad, fecha_última_compra,
costo_última_compra, **consumo_unitario**, costo_unitario (= consumo × costo).
Es exactamente el modelo de la app (fracción de hoja / consumo).

## 4) Plan "todo" (en cuanto se fije la fórmula del punto 3)
1. **Motor:** indirecto/MO diferenciado por tipo (fabricado 1.45/×3 · compra-venta
   1.25) en vez de 34% plano. Recalibrar la banca a ~$12,342.
2. **Captura:** alinear intake (Voni + Costeador) a la taxonomía del punto 1 —
   se-compone-de, materiales con calibre, acabados con código Op (dropdowns desde
   el catálogo de la Hoja2), rangos de volumen.
3. **Salida:** precio por rango de volumen (PM/PL/P2) + costo de fabricación,
   como en la solicitud.
