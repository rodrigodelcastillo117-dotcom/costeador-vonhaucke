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

## 3) ⚠️ DISCREPANCIA ABIERTA — no tocar el motor hasta resolverla
Rodrigo dijo "indirecto = MO × 1.45". Pero contra la banca real C-CO-510R
(la única T.D.C. LLENA que tenemos):
- MO real $1,180 × 1.45 = **$1,711** ≠ indirectos reales **$3,576**.
- Lo que SÍ cuadra: indirectos ≈ **MO × 3** ($1,180×3 = $3,540, dentro de 1%).
- Y la política trae un "3" en la columna de mano de obra.

O sea el Excel guardó los VALORES, no las FÓRMULAS, y el encadenamiento no es
obvio. **Antes de cambiar `calculo.js` hay que fijar la fórmula exacta**, con una
de dos:
1. Rafa/Alba confirman textual cómo se encadenan costo_producto / mano_de_obra /
   gasto_indirecto / precio_mín / comercial.
2. O nos pasan **una T.D.C. YA LLENA** de un mueble fabricado (ideal el copete
   C-CO-516R con sus $), y yo derivo y verifico la fórmula contra ese número.

## 4) Plan "todo" (en cuanto se fije la fórmula del punto 3)
1. **Motor:** indirecto/MO diferenciado por tipo (fabricado 1.45/×3 · compra-venta
   1.25) en vez de 34% plano. Recalibrar la banca a ~$12,342.
2. **Captura:** alinear intake (Voni + Costeador) a la taxonomía del punto 1 —
   se-compone-de, materiales con calibre, acabados con código Op (dropdowns desde
   el catálogo de la Hoja2), rangos de volumen.
3. **Salida:** precio por rango de volumen (PM/PL/P2) + costo de fabricación,
   como en la solicitud.
