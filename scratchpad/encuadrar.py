#!/usr/bin/env python3
"""
Normaliza un render de catálogo Von Haucke a una ficha uniforme.

Gemini entrega el producto fiel sobre fondo PLANO (así se lo pide la receta de
`generar-render` en modo catalogo). Aquí el encuadre y la puesta en escena dejan
de ser opinión del modelo y pasan a ser deterministas:

  1. Se mide el color de fondo en el marco exterior de la imagen.
  2. Se detecta el producto por distancia a ese color, exigiendo que la fila o
     columna tenga suficientes píxeles (si no, el ruido de JPEG en una esquina
     estira la caja a toda la imagen).
  3. Se abre la caja a 4:3 con el producto siempre a la misma escala y posición.
  4. Lo que quede fuera se rellena con el MISMO fondo: no hay costura.
  5. Se agrega una sombra de contacto propia, igual para todos.

NO se borra ningún píxel (nada de recorte por alfa): el recorte por alfa se come
los biombos de cristal de App LT y los muros Privacy 4.

Uso: python3 scratchpad/encuadrar.py entrada.jpg salida.jpg
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

LIENZO = (1200, 900)
ASPECTO = LIENZO[0] / LIENZO[1]
OCUPACION_W = 0.84       # del ancho del lienzo
OCUPACION_H = 0.78       # del alto del lienzo
CENTRO_Y = 0.47          # centro del producto (un pelo arriba: deja aire al pie
UMBRAL = 22              # distancia de color para "no es fondo"
UMBRAL_BORDE = 18        # fuerza de borde para "esto es el producto"
MIN_FRACCION = 0.004     # % de píxeles de una fila/columna para que cuente
FONDO_OBJETIVO = (240, 238, 234)


def color_fondo(a):
    """Fondo = mediana del marco exterior (4% de cada lado)."""
    h, w, _ = a.shape
    k = max(4, round(min(h, w) * 0.04))
    marco = np.concatenate([
        a[:k].reshape(-1, 3), a[-k:].reshape(-1, 3),
        a[:, :k].reshape(-1, 3), a[:, -k:].reshape(-1, 3),
    ])
    return np.median(marco, axis=0)


def _caja_de_mascara(m, w, h):
    cols = np.where(m.sum(axis=0) >= max(3, h * MIN_FRACCION))[0]
    rows = np.where(m.sum(axis=1) >= max(3, w * MIN_FRACCION))[0]
    if not len(cols) or not len(rows):
        return None
    return int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1


def caja_por_color(a, bg):
    """Lo que se aparta del color de fondo. Falla cuando el fondo trae sombra o
    caída de luz: entonces marca la imagen entera."""
    h, w, _ = a.shape
    return _caja_de_mascara(np.abs(a - bg).max(axis=2) > UMBRAL, w, h)


def caja_por_bordes(img):
    """Detección principal: el producto tiene BORDES; el ciclorama y sus sombras
    son suaves aunque no sean de un color plano. Mucho más robusto que comparar
    contra un color de fondo."""
    g = img.convert("L").filter(ImageFilter.GaussianBlur(1.0)).filter(ImageFilter.FIND_EDGES)
    e = np.asarray(g).astype(np.int16).copy()
    e[:2] = 0; e[-2:] = 0; e[:, :2] = 0; e[:, -2:] = 0   # FIND_EDGES deja marco falso
    h, w = e.shape
    return _caja_de_mascara(e > UMBRAL_BORDE, w, h)


def caja_producto(img, a, bg):
    """Bordes manda. El color sólo suma cuando dio un resultado creíble (no
    marcó casi toda la imagen), para no perder partes de bajo contraste."""
    caja = caja_por_bordes(img)
    color = caja_por_color(a, bg)
    if caja is None:
        return color
    if color is not None:
        h, w, _ = a.shape
        if (color[2] - color[0]) < w * 0.92 and (color[3] - color[1]) < h * 0.92:
            caja = (min(caja[0], color[0]), min(caja[1], color[1]),
                    max(caja[2], color[2]), max(caja[3], color[3]))
    return caja


def encuadrar(entrada, salida):
    img = Image.open(entrada).convert("RGB")
    a = np.asarray(img).astype(np.int16)
    bg = color_fondo(a)
    caja = caja_producto(img, a, bg)
    estado = "ok"
    if caja is None:
        estado = "sin-caja"
        caja = (0, 0, img.width, img.height)

    x0, y0, x1, y1 = caja
    pw, ph = x1 - x0, y1 - y0
    # Ventana (en píxeles del render) que deja al producto en la escala pedida.
    ancho = max(pw / OCUPACION_W, (ph / OCUPACION_H) * ASPECTO)
    alto = ancho / ASPECTO
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2 - (CENTRO_Y - 0.5) * alto

    # La ventana se ENCAJA dentro del render. Rellenar con un color plano dejaba
    # bandas visibles en las orillas: el fondo de Gemini no es perfectamente
    # uniforme. Si no cabe, se encoge hasta caber.
    ancho = min(ancho, img.width)
    alto = ancho / ASPECTO
    if alto > img.height:
        alto = img.height
        ancho = alto * ASPECTO
    izq = round(min(max(0, cx - ancho / 2), img.width - ancho))
    arr = round(min(max(0, cy - alto / 2), img.height - alto))
    der, aba = round(izq + ancho), round(arr + alto)

    fondo = tuple(int(v) for v in bg)
    lienzo = img.crop((izq, arr, der, aba)).resize(LIENZO, Image.LANCZOS)

    # Sombra de contacto propia (misma para los 67), bajo la base del producto.
    esc = LIENZO[0] / (der - izq)
    base_y = (y1 - arr) * esc
    centro_x = (cx - izq) * esc
    ancho_p = pw * esc
    if estado == "ok" and 0 < base_y < LIENZO[1] and ancho_p > 20:
        capa = Image.new("L", LIENZO, 0)
        d = ImageDraw.Draw(capa)
        rx, ry = ancho_p * 0.52, max(6, ancho_p * 0.045)
        d.ellipse([centro_x - rx, base_y - ry, centro_x + rx, base_y + ry], fill=70)
        capa = capa.filter(ImageFilter.GaussianBlur(max(6, ancho_p * 0.035)))
        lienzo = Image.composite(Image.new("RGB", LIENZO, (150, 145, 139)), lienzo, capa)

    # Empareja el tono de fondo entre productos.
    d_rgb = [int(o - f) for o, f in zip(FONDO_OBJETIVO, fondo)]
    if max(abs(v) for v in d_rgb) > 2:
        lienzo = lienzo.point([min(255, max(0, i + d)) for d in d_rgb for i in range(256)])

    lienzo.save(salida, "JPEG", quality=88, optimize=True)
    return f"{estado} fondo={fondo} producto={pw}x{ph}"


if __name__ == "__main__":
    print(encuadrar(sys.argv[1], sys.argv[2]))
