# Genera catalogo.html a partir de bom.json (despiece + costos) y de dibujos SVG paramétricos.
import json, math, html, os
HERE = os.path.dirname(os.path.abspath(__file__))
B = {p['id']: p for p in json.load(open(os.path.join(HERE, 'bom.json')))}

def cost(pid, acb=None):
    p = B[pid]
    for c in p['costos']:
        if acb is None or c['acabado'] == acb:
            return c
    return p['costos'][0]

def m(x):  # moneda
    return '$' + f"{round(x):,}"

def r100(x):
    return int(math.ceil(x / 100.0) * 100)

# ---------------------------------------------------------------- dibujo
class D:
    def __init__(self, w, h, pl=40, pr=40, pt=40, pb=40, fs=None):
        self.w, self.h = w, h
        self.pl, self.pr, self.pt, self.pb = pl, pr, pt, pb
        vw, vh = w + pl + pr, h + pt + pb
        self.fs = fs or max(vw, vh * 0.9) * 0.03
        self.e = []
    def Y(self, y): return self.h - y
    def rect(self, x, y, w, h, c, rx=0):
        self.e.append(f'<rect x="{x:.1f}" y="{self.Y(y+h):.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" class="{c}"/>')
    def poly(self, pts, c):
        s = ' '.join(f'{x:.1f},{self.Y(y):.1f}' for x, y in pts)
        self.e.append(f'<polygon points="{s}" class="{c}"/>')
    def ell(self, cx, cy, rx, ry, c):
        self.e.append(f'<ellipse cx="{cx:.1f}" cy="{self.Y(cy):.1f}" rx="{rx:.1f}" ry="{ry:.1f}" class="{c}"/>')
    def circ(self, cx, cy, r, c):
        self.e.append(f'<circle cx="{cx:.1f}" cy="{self.Y(cy):.1f}" r="{r:.1f}" class="{c}"/>')
    def line(self, x1, y1, x2, y2, c='ln'):
        self.e.append(f'<line x1="{x1:.1f}" y1="{self.Y(y1):.1f}" x2="{x2:.1f}" y2="{self.Y(y2):.1f}" class="{c}"/>')
    def arch(self, x, y, w, h, c):
        # arco: rectángulo con remate semicircular arriba, base en y
        r = w / 2
        d = (f'M{x:.1f},{self.Y(y):.1f} L{x:.1f},{self.Y(y+h-r):.1f} '
             f'A{r:.1f},{r:.1f} 0 0 1 {x+w:.1f},{self.Y(y+h-r):.1f} L{x+w:.1f},{self.Y(y):.1f} Z')
        self.e.append(f'<path d="{d}" class="{c}"/>')
    def text(self, x, y, s, c='lbl', anchor='middle', size=1.0, rot=False):
        fs = self.fs * size
        t = f' transform="rotate(-90 {x:.1f} {self.Y(y):.1f})"' if rot else ''
        self.e.append(f'<text x="{x:.1f}" y="{self.Y(y):.1f}" font-size="{fs:.1f}" text-anchor="{anchor}" class="{c}"{t}>{html.escape(s)}</text>')
    def hdim(self, x1, x2, y, label=None):
        t = self.fs * 0.35
        self.line(x1, y, x2, y, 'dim'); self.line(x1, y - t, x1, y + t, 'dim'); self.line(x2, y - t, x2, y + t, 'dim')
        self.text((x1 + x2) / 2, y - self.fs * 1.15, label or f'{round(x2 - x1)}', 'dimt', size=0.85)
    def vdim(self, y1, y2, x, label=None):
        t = self.fs * 0.35
        self.line(x, y1, x, y2, 'dim'); self.line(x - t, y1, x + t, y1, 'dim'); self.line(x - t, y2, x + t, y2, 'dim')
        self.text(x + self.fs * 1.1, (y1 + y2) / 2, label or f'{round(y2 - y1)}', 'dimt', size=0.85, rot=True)
    def svg(self, title):
        vb = f'{-self.pl} {-self.pt} {self.w + self.pl + self.pr} {self.h + self.pt + self.pb}'
        return (f'<svg class="dw" viewBox="{vb}" role="img" aria-label="{html.escape(title)}">'
                + ''.join(self.e) + '</svg>')

def niveladores(d, xs, h=15):
    for x in xs:
        d.rect(x - 15, 0, 30, h, 'f-metal')

# ---- Barra 118: frente con piel luminosa + corte lateral
def dw_barra_frente(piel='luz'):
    d = D(1180, 1100, pl=60, pr=150, pt=60, pb=170)
    niveladores(d, [60, 1120])
    d.rect(0, 15, 1180, 1060, 'f-negro')
    cls = {'luz': 'f-luz', 'roble': 'f-roble', 'marca': 'f-negro2'}[piel]
    d.rect(0, 20, 1180, 1040, cls)
    if piel == 'marca':
        d.text(590, 470, 'TU MARCA', 'brand', size=3.2)
        d.text(590, 330, 'vinil impreso · se cambia por evento', 'lbl-on-dark', size=0.9)
    d.rect(0, 1075, 1180, 25, 'f-hpl')
    d.hdim(0, 1180, -70)
    d.vdim(0, 1100, 1180 + 70)
    return d

def dw_barra_corte():
    d = D(590, 1100, pl=60, pr=150, pt=60, pb=170)
    d.rect(100, 15, 490, 1060, 'f-hueco')          # lateral visto (fondo)
    d.rect(20, 20, 80, 1040, 'f-luz')               # piel luminosa 80
    d.rect(100, 15, 18, 1060, 'f-negro')            # frente estructural
    d.rect(118, 15, 472, 18, 'f-trip')              # piso hidrófugo
    d.rect(118, 832, 450, 18, 'f-negro')            # entrepaño 850
    d.rect(572, 975, 18, 100, 'f-negro')            # travesaño
    d.rect(572, 15, 18, 80, 'f-trip')               # zoclo
    d.rect(0, 1075, 590, 25, 'f-hpl')               # cubierta con vuelo 100
    niveladores(d, [130, 560])
    d.text(345, 900, 'entrepaño barman h 850', 'lbl', size=0.75)
    d.text(345, 60, 'piso triplay hidrófugo', 'lbl', size=0.75)
    d.hdim(0, 590, -70)
    d.hdim(0, 100, 1100 + 40, 'vuelo 100')
    d.vdim(0, 850, 590 + 70)
    d.text(60, -150, 'cliente', 'lbl', size=0.8)
    d.text(540, -150, 'barman', 'lbl', size=0.8)
    return d

def dw_piel(kind):
    d = D(1180, 1040, pl=20, pr=20, pt=20, pb=20, fs=80)
    cls = {'roble': 'f-roble', 'luz': 'f-luz', 'marca': 'f-negro2'}[kind]
    d.rect(0, 0, 1180, 1040, cls)
    if kind == 'marca':
        d.text(590, 470, 'TU MARCA', 'brand', size=1.7)
    return d

# ---- Pedestal 59
def dw_pedestal():
    d = D(590, 1100, pl=60, pr=150, pt=60, pb=170)
    niveladores(d, [60, 530])
    d.rect(0, 15, 490, 1060, 'f-negro')
    d.rect(0, 20, 490, 1040, 'f-roble')             # piel roble cara frontal
    d.rect(490, 15, 100, 1060, 'f-negro2')          # costado (otra cara con vuelo)
    d.rect(0, 1075, 590, 25, 'f-hpl')
    d.hdim(0, 590, -70)
    d.vdim(0, 1100, 590 + 70)
    return d

# ---- Plantas del sistema (vista superior, público abajo)
def dw_sistema():
    W = 3540 * 2 + 900 + 2400 + 900 + 400
    d = D(W, 2300, pl=80, pr=80, pt=120, pb=260, fs=150)
    def top(x, y, w, h, front=None, cls='f-hpl'):
        d.rect(x, y, w, h, cls)
        if front == 'S': d.rect(x, y, w, 60, 'f-luz')
        if front == 'W': d.rect(x, y, 60, h, 'f-luz')
    # A: barra recta 3 módulos
    x0 = 0
    for i in range(3):
        top(x0 + i * 1180, 0, 1180, 590, 'S')
    d.text(x0 + 1770, -200, 'Recta · 3 barras · 3.54 m', 'lbl', size=0.9)
    # B: L
    x1 = 3540 + 900
    top(x1, 0, 590, 590, None, 'f-roble')
    top(x1 + 590, 0, 1180, 590, 'S'); top(x1 + 590 + 1180, 0, 1180, 590, 'S')
    top(x1, 590, 590, 1180, 'W')
    d.text(x1 + 1475, -200, 'En L · 1 pedestal + 3 barras', 'lbl', size=0.9)
    # C: cabina DJ
    x2 = x1 + 2950 + 900
    top(x2, 0, 590, 590, None, 'f-roble'); top(x2 + 590, 0, 1180, 590, 'S'); top(x2 + 1770, 0, 1180, 590, 'S'); top(x2 + 2950, 0, 590, 590, None, 'f-roble')
    d.rect(x2 + 570, 700, 2400, 700, 'f-negro')
    d.text(x2 + 1770, 1050, 'mesa DJ h 950', 'lbl-on-dark', size=0.8)
    d.rect(x2 + 1270, 1550, 1000, 600, 'dash')
    d.text(x2 + 1770, 1800, 'DJ', 'lbl', size=0.9)
    d.text(x2 + 1770, -200, 'Cabina DJ · fachada 3.54 m', 'lbl', size=0.9)
    d.text(W / 2, 2250, 'público ↓ (vista desde arriba)', 'dimt', size=0.8)
    return d

# ---- Periquera
def dw_periquera():
    d = D(590, 1100, pl=60, pr=150, pt=60, pb=170)
    d.rect(125, 6, 340, 6, 'f-metal')                       # lastre
    niveladores(d, [15, 575], h=12)
    d.poly([(0, 12), (590, 12), (420, 1075), (170, 1075)], 'f-negro')
    d.rect(286, 12, 18, 1063, 'f-negro2')                   # panel cruzado de canto
    d.rect(0, 1075, 590, 25, 'f-hpl')
    d.text(295, 40, 'lastre acero 1/4"', 'lbl-on-dark', size=0.6)
    d.hdim(0, 590, -70)
    d.vdim(0, 1100, 590 + 70)
    return d

def dw_periquera_planta():
    d = D(590, 590, pl=40, pr=40, pt=40, pb=40, fs=34)
    d.circ(295, 295, 295, 'f-hpl-soft')
    d.rect(0, 286, 590, 18, 'f-negro')
    d.rect(286, 0, 18, 590, 'f-negro')
    d.text(295, -30, 'planta · ensamble a media madera', 'dimt', size=0.9)
    return d

# ---- Mesa imperial
def dw_mesa():
    d = D(2400, 760, pl=60, pr=200, pt=60, pb=200)
    for cx in (400, 2000):
        d.poly([(cx - 250, 12), (cx + 250, 12), (cx + 200, 732), (cx - 200, 732)], 'f-negro')
        d.rect(cx - 9, 12, 18, 720, 'f-negro2')
        niveladores(d, [cx - 235, cx + 235], h=12)
    d.rect(400, 612, 1600, 120, 'f-negro2')
    d.rect(0, 732, 2400, 28, 'f-roble')
    d.text(1200, 520, 'viga central · evita pandeo', 'lbl', size=0.8)
    d.hdim(0, 2400, -80)
    d.vdim(0, 760, 2400 + 80)
    return d

def dw_mesa_cabecera():
    d = D(1000, 760, pl=60, pr=200, pt=60, pb=200)
    d.poly([(100, 12), (900, 12), (800, 732), (200, 732)], 'f-negro')
    d.rect(491, 12, 18, 720, 'f-negro2')
    d.rect(482, 612, 36, 120, 'f-metal')
    niveladores(d, [115, 885], h=12)
    d.rect(0, 732, 1000, 28, 'f-roble')
    d.hdim(0, 1000, -80)
    return d

# ---- Cabina DJ frente
def dw_dj():
    d = D(3540, 1100, pl=60, pr=200, pt=60, pb=200)
    d.rect(590 - 20, 950, 2400, 25, 'dash')
    d.rect(1100, 975, 1340, 95, 'dash')
    xs = [(0, 590, 'f-roble'), (590, 1180, 'f-luz'), (1770, 1180, 'f-luz'), (2950, 590, 'f-roble')]
    for x, w, c in xs:
        d.rect(x, 15, w, 1060, 'f-negro')
        d.rect(x, 20, w, 1040, c)
        d.rect(x, 1075, w, 25, 'f-hpl')
        niveladores(d, [x + 40, x + w - 40])
    d.text(1770, 1015, 'equipo sobre mesa DJ a 950 (oculto)', 'lbl', size=0.7)
    d.hdim(0, 3540, -80)
    d.vdim(0, 1100, 3540 + 80)
    return d

# ---- Tocador
def dw_tocador(acb='negro'):
    body = 'f-negro' if acb == 'negro' else 'f-roble'
    d = D(1100, 1660, pl=60, pr=170, pt=60, pb=170)
    d.rect(0, 0, 1100, 732, 'f-hueco')
    d.rect(0, 0, 16, 732, body); d.rect(1084, 0, 16, 732, body)
    d.rect(384, 0, 16, 600, body)
    d.rect(400, 600, 684, 132, 'f-hueco')
    d.rect(416, 420, 668, 150, 'f-hueco2')               # travesaño trasero (al fondo)
    for i, y in enumerate((20, 255, 490)):
        d.rect(2, y, 396, 210, body)
        d.rect(2, y + 210, 396, 25, 'f-gola')
    d.rect(402, 600, 680, 100, body)
    d.rect(402, 700, 680, 25, 'f-gola')
    d.rect(0, 732, 1100, 28, body)
    d.rect(100, 760, 900, 900, body)
    d.rect(150, 810, 800, 800, 'glow')
    d.rect(150, 810, 800, 800, 'f-espejo')
    d.text(550, 1210, 'espejo 800 × 800', 'lbl', size=0.8)
    d.text(550, 1150, 'LED 4000 K · CRI 90 · dimmer', 'lbl', size=0.7)
    d.hdim(0, 1100, -70)
    d.vdim(0, 760, 1100 + 60)
    d.vdim(0, 1660, 1100 + 150)
    return d

# ---- Escritorio
def dw_escritorio(acb='roble'):
    body = 'f-roble' if acb == 'roble' else 'f-negro'
    d = D(1500, 870, pl=60, pr=200, pt=60, pb=200)
    d.rect(450, 422, 1022, 300, 'f-hueco2')               # faldón trasero
    d.rect(0, 15, 19, 707, body); d.rect(431, 15, 19, 707, body)
    d.rect(19, 15, 412, 19, body)
    d.rect(19, 34, 412, 417, 'f-hueco')                   # nicho
    d.rect(40, 34, 370, 70, 'f-cojin', rx=30)
    d.text(225, 250, 'nicho mascota', 'lbl', size=0.7)
    d.rect(19, 451, 412, 19, body)
    d.rect(2, 470, 446, 250, body)
    d.rect(150, 690, 150, 12, 'f-gola')
    d.rect(1472, 0, 28, 722, body)
    d.rect(0, 722, 1500, 28, body)
    d.rect(1060, 750, 400, 19, body); d.rect(1060, 769, 19, 101, body); d.rect(1441, 769, 19, 101, body)
    d.rect(1079, 769, 362, 45, 'f-cojin', rx=18)
    d.text(1260, 900 - 10, 'repisa gato', 'lbl', size=0.7)
    niveladores(d, [30, 420])
    d.hdim(0, 1500, -80)
    d.vdim(0, 750, 1500 + 70)
    d.vdim(0, 870, 1500 + 170)
    return d

# ---- Mesa de centro
def dw_mesacentro(acb='roble'):
    body = 'f-roble' if acb == 'roble' else 'f-negro'
    d = D(1100, 420, pl=60, pr=170, pt=60, pb=170, fs=48)
    d.rect(0, 10, 28, 382, body); d.rect(1072, 10, 28, 382, body)
    d.rect(28, 20, 1044, 19, body)
    d.rect(28, 39, 500, 353, body)
    d.ell(278, 215, 140, 100, 'f-hueco')
    d.rect(180, 120, 196, 40, 'f-cojin', rx=16)
    d.rect(528, 39, 19, 353, body)
    d.rect(547, 39, 525, 353, 'f-hueco')
    d.rect(620, 39, 260, 40, 'f-hueco2'); d.rect(640, 79, 220, 30, 'f-hueco2')
    d.rect(0, 392, 1100, 28, body)
    d.hdim(0, 1100, -70)
    d.vdim(0, 420, 1100 + 60)
    return d

def dw_mesacentro_lado(acb='roble'):
    body = 'f-roble' if acb == 'roble' else 'f-negro'
    d = D(590, 420, pl=40, pr=40, pt=60, pb=120, fs=26)
    d.rect(0, 10, 590, 382, body)
    d.arch(175, 39, 240, 270, 'f-hueco')
    d.rect(0, 392, 590, 28, body)
    d.text(295, -70, 'costado: entrada en arco', 'dimt', size=0.8)
    return d

# ---- Mueble TV
def dw_tv(acb='negro'):
    body = 'f-negro' if acb == 'negro' else 'f-roble'
    d = D(1800, 1380, pl=60, pr=200, pt=60, pb=200)
    d.rect(290, 690, 1220, 690, 'dash')
    d.text(900, 1035, 'TV 55"', 'dimt', size=0.9)
    for x in (40, 880, 1720):
        d.rect(x, 0, 40, 110, 'f-metal')
    d.rect(0, 110, 1800, 472, 'f-hueco')
    d.rect(0, 110, 19, 472, body); d.rect(1781, 110, 19, 472, body)
    d.rect(19, 110, 1762, 19, body)
    d.rect(21, 131, 596, 449, body)
    for i in range(6):
        d.rect(120, 420 + i * 24, 400, 10, 'f-hueco')
    d.rect(619, 131, 19, 449, body); d.rect(1162, 131, 19, 449, body)
    d.rect(638, 345, 524, 19, body)
    d.rect(760, 129, 280, 70, 'f-hueco2')
    d.rect(1183, 131, 596, 449, body)
    d.rect(0, 582, 1800, 28, body)
    d.text(319, 250, 'arenero', 'lbl-on-dark', size=0.75)
    d.hdim(0, 1800, -80)
    d.vdim(0, 610, 1800 + 70)
    d.vdim(0, 110, 1800 + 170, '110')
    return d

def dw_tv_lado(acb='negro'):
    body = 'f-negro' if acb == 'negro' else 'f-roble'
    d = D(480, 610, pl=40, pr=40, pt=60, pb=120, fs=26)
    d.rect(20, 0, 40, 110, 'f-metal'); d.rect(420, 0, 40, 110, 'f-metal')
    d.rect(0, 110, 480, 472, body)
    d.arch(130, 129, 220, 260, 'f-hueco')
    d.rect(0, 582, 480, 28, body)
    d.text(240, -70, 'costado: entrada Ø220', 'dimt', size=0.8)
    return d

# ---- Hoja de corte antes / después
def dw_hoja(piezas, titulo):
    d = D(2440, 1220, pl=20, pr=20, pt=40, pb=170, fs=110)
    d.rect(0, 0, 2440, 1220, 'f-hoja')
    for (x, y, w, h) in piezas:
        d.rect(x, y, w, h, 'f-hpl')
    d.text(1220, -120, titulo, 'dimt', size=0.9)
    return d

hoja_antes = dw_hoja([(10, 10, 1200, 650), (1216, 10, 1200, 650)], '1200 × 650 → 2 cubiertas por hoja')
hoja_desp = dw_hoja([(10, 10, 1180, 590), (1196, 10, 1180, 590), (10, 606, 1180, 590), (1196, 606, 1180, 590)], '1180 × 590 → 4 cubiertas por hoja')

# ---------------------------------------------------------------- datos de venta
# Referencias de mercado encontradas (ver fuentes). None = no encontré precio en MXN.
EV_MULT = 1.5   # venta B2B a rentadoras / agencias / venues sobre maquila VH (25%)
LV_MULT = 2.5   # venta a casa vía Mercado Libre / Amazon (comisión, envío, devoluciones, anuncios)
MASS = 1.4 / 0.75 * 2.0  # escenario "diseño a costo": factor de línea 1.4, margen VH 25%, venta directa ×2

def cdj():
    bar, ped, mdj, pl = cost('BAR-118')['maquila25'], cost('PED-59')['maquila25'], cost('MESA-DJ')['maquila25'], cost('PIEL-L')['maquila25']
    pr = cost('PIEL-R')['maquila25'] * 0.5  # piel roble del pedestal ≈ media piel de barra
    return 2 * bar + 2 * ped + mdj + 2 * pl + 2 * pr

def cdj_fab():
    return 2 * cost('BAR-118')['fab'] + 2 * cost('PED-59')['fab'] + cost('MESA-DJ')['fab'] + 2 * cost('PIEL-L')['fab'] + cost('PIEL-R')['fab']

def cdj_mat():
    return 2 * cost('BAR-118')['material'] + 2 * cost('PED-59')['material'] + cost('MESA-DJ')['material'] + 2 * cost('PIEL-L')['material'] + cost('PIEL-R')['material']

EVENTOS = [
    dict(id='BAR-118', nombre='Barra Modular 118', med='1180 × 590 × 1100 mm',
         mat=cost('BAR-118')['material'] + cost('PIEL-R')['material'],
         fab=cost('BAR-118')['fab'] + cost('PIEL-R')['fab'],
         maq=cost('BAR-118')['maquila25'] + cost('PIEL-R')['maquila25'],
         nota_costo='Precio con piel Roble. Con piel Luminosa: ' + m(r100((cost('BAR-118')['maquila25'] + cost('PIEL-L')['maquila25']) * EV_MULT)) + '.',
         mercado=[('Liverpool', 'Barra de bar HAUS Rivoli, madera y chapa (para casa, no evento)', 18899),
                  ('Mercado Libre / Walmart', 'Mesa plegable portafolio 1.80 m que se usa como barra con mantel', 699)],
         armado='Llega armada. Une módulos con 4 tornillos y llave Allen (2 min). Piel: se cuelga en 30 s.',
         puntos=['Cubierta HPL 25 mm: aguanta hielo, limón y alcohol. La melamina se mancha y se hincha en el canto.',
                 'Piso de triplay hidrófugo: es el único lugar del catálogo con madera, porque ahí gotea el hielo.',
                 'Cuerpo de MDF 18 mm: aguanta armar y desarmar 50+ veces. El aglomerado se desmorona en el minifix a la tercera.',
                 'Frente con colgador francés: cambia de look con una piel (Roble, Luminosa o Marca) sin herramienta.',
                 'Niveladores 3/8": jardines y haciendas nunca están parejos. Huecos de mano en los costados, pesa unos 60 kg.']),
    dict(id='PED-59', nombre='Pedestal Esquinero 59', med='590 × 590 × 1100 mm',
         mat=cost('PED-59')['material'], fab=cost('PED-59')['fab'], maq=cost('PED-59')['maquila25'],
         nota_costo='Precio sin piel.',
         mercado=[('Mercado Libre / Amazon', 'Pedestal exhibidor para evento', None)],
         armado='Llega armado. Se une a la barra con 4 tornillos. Tapa trasera con imanes, sin herramienta.',
         puntos=['Esquina de las barras en L y U, remate de la cabina DJ.',
                 'Solo también funciona: podio, hostess, exhibidor de botella en una activación de marca.',
                 'Vuelo de cubierta en dos caras, así cierra la esquina sin hueco.',
                 'Tapa trasera removible con imanes: guardado para hielo seco, cables, servilletas.']),
    dict(id='PER-X', nombre='Periquera Equis', med='Ø590 × 1100 mm',
         mat=cost('PER-X')['material'], fab=cost('PER-X')['fab'], maq=cost('PER-X')['maquila25'],
         nota_costo='Los dos paneles X se pueden rotular con vinil de marca.',
         mercado=[('Mercado Libre', 'Mesa periquera de madera', 1642)],
         armado='Sin herramienta: dos paneles se ensamblan en X y la cubierta se fija con 4 perillas. 1 minuto.',
         puntos=['Se guarda plana: 10 periqueras caben en unos 60 cm de rack, contra un cuarto lleno de periqueras armadas.',
                 'Cubierta Ø590 HPL y no Ø600: así salen 8 por hoja en vez de 3 (-31% de costo).',
                 'Placa lastre de acero 1/4" abajo (5.8 kg, pintura en polvo VH).',
                 'Riesgo: según mi cuenta se vuelca con unos 55 kg recargados en el borde en diagonal. Hay que probarlo en el prototipo.']),
    dict(id='MESA-X', nombre='Mesa Imperial Equis', med='2400 × 1000 × 760 mm · 10 personas',
         mat=cost('MESA-X', 'roble')['material'], fab=cost('MESA-X', 'roble')['fab'], maq=cost('MESA-X', 'roble')['maquila25'],
         nota_costo='Cubierta Roble 28 mm: sale una hoja exacta por mesa (83% de aprovechamiento).',
         mercado=[('Mercado Libre / Walmart / Liverpool', 'Mesa plegable portafolio 1.80 m (plástico)', 699),
                  ('Costco / Home Depot', 'Mesa plegable Lifetime 2.44 m', None)],
         armado='Sin herramienta: caballetes en X, viga que se engancha y cubierta con perillas. 2 personas, 3 minutos.',
         puntos=['Mismos caballetes X que la periquera: mismo programa de CNC, menos SKUs.',
                 'Se alinea en línea: mesas imperiales de 10, 20 o 30 m para bodas.',
                 'Viga central doble: el aglomerado de 28 mm en 1.6 m de claro se pandea con los años.',
                 'Se ve como madera sin mantel, que es justo lo que no da la mesa plegable de plástico.']),
    dict(id='DJ-354', nombre='Cabina DJ 354', med='Fachada 3540 × 590 × 1100 mm + mesa DJ 2400 × 700 × 950',
         mat=cdj_mat(), fab=cdj_fab(), maq=cdj(),
         nota_costo='Kit: 2 barras + 2 pedestales + mesa DJ + 2 pieles luminosas + pieles roble en los pedestales.',
         mercado=[('Tiendas DJ (España)', 'Vonyx DB5 Pro plegable 2.0 m, marco metálico + licra', '€599'),
                  ('Tiendas DJ (España)', 'Innox FlexBooth 200', '€199')],
         armado='10 minutos y una llave Allen. La única pieza nueva es la mesa DJ. Todo lo demás es la barra.',
         puntos=['La fachada oculta el equipo: la mesa DJ va atrás a 950 y la fachada mide 1100.',
                 'Mesa con grommets, repisa trasera y multicontacto: cero cables colgando al frente.',
                 'Cuando no hay DJ, las piezas se rentan como barra. Eso sube el uso del inventario.',
                 'Las cabinas plegables de licra son de 1.2 a 2 m y se ven de DJ de fiesta. Esta es de 3.5 m y se ve de marca.']),
]

LIVING = [
    dict(id='TOC-01', nombre='Tocador Hollywood', med='1100 × 450 × 760 mm · con espejo 1660',
         full=cost('TOC-01', 'roble'), lite=cost('TOC-01L', 'roble'),
         mercado=[('Walmart', 'Vanity LED, 5 cajones + taburete, 80×40×140', 3379),
                  ('Amazon (vía Promodescuentos)', 'Tocador con espejo y 10 luces', 3880)],
         objetivo=6900,
         armado='15 min y un desarmador. Los cajones y el espejo con LED llegan armados y cableados.',
         puntos=['Espejo 800 × 800 con LED en perfil difusor, sin focos (los focos se ven baratos, calientan y se funden).',
                 'Pide 4000 K y CRI 90 o más. El kit del ERP es de 2700 K, que cambia el tono de piel. Malo para maquillaje.',
                 '3 cajones + 1 cajón plano para maquillaje, sin jaladeras (perfil gola de aluminio).',
                 'Correa antivuelco al muro: el espejo arriba sube el centro de gravedad.',
                 'Si va en baño: cubierta HPL y cantos sellados.']),
    dict(id='ESC-01', nombre='Escritorio Compañero', med='1500 × 590 × 750 mm',
         full=cost('ESC-01', 'roble'),
         mercado=[('Mercado Libre', 'Escritorio 120×48 con cajón y llave', 2899),
                  ('Mercado Libre', 'Escritorio 1.2 m con cajón y repisas', 3999)],
         objetivo=6900,
         armado='10 min. El pedestal llega armado y la cubierta, la pata y el faldón van con minifix.',
         puntos=['Nicho a ras de piso junto a tus pies (412 × 410 × 560) con cojín lavable de tapicería VH. Le cabe un gato o un perro chico; un perro mediano no.',
                 'Repisa para gato junto al monitor: le das un lugar alto a tu lado y deja de acostarse en el teclado.',
                 'Canal de cables cerrado con tapa: los cables quedan fuera del alcance de los dientes.',
                 'Melamina TX (texturizada): esconde los rayones de uñas. La lisa o el brillo los marcan.']),
    dict(id='MC-01', nombre='Mesa de Centro Guarida', med='1100 × 590 × 420 mm',
         full=cost('MC-01', 'roble'),
         mercado=[('Liverpool', 'Mesa de centro armable melamina (Nuestro Nido)', 1499),
                  ('Liverpool', 'Mesa de centro armable melamina (Excelsior)', 4189)],
         objetivo=4900,
         armado='5 minutos y 4 minifix. El cojín va aparte.',
         puntos=['Cueva cerrada con entrada en arco por el costado y ventana ovalada al frente.',
                 'Bolsillo para rascador de cartón estándar: lo venden en cualquier tienda de mascotas. El sisal se acaba y no se cambia.',
                 'Repisa abierta para control y revistas. Esquinas R50.',
                 'Es la pieza más barata de Living y la más fotografiable. La recomiendo como pieza héroe.']),
    dict(id='TV-01', nombre='Mueble TV Arenero', med='1800 × 480 × 610 mm',
         full=cost('TV-01', 'roble'),
         mercado=[('Liverpool', 'Mueble TV armable 180 cm MDP (Madesa)', 3589),
                  ('Walmart', 'Mueble arenero oculto 140×45×52, 2 gatos', 4693)],
         objetivo=7900,
         armado='15 min. Patas atornilladas a insertos y puertas ajustadas desde fábrica.',
         puntos=['Compartimento de arenero con entrada Ø220 por el costado (izquierda o derecha, se decide al fabricar), puerta ranurada y filtro de carbón.',
                 'Charola interior de MDF con HPL, desmontable: la orina hincha el aglomerado en semanas. No es negociable.',
                 'Trasero cerrado con pasacables: no queda ningún cable al alcance de los dientes.',
                 'Patas de 110 mm: pasa la aspiradora robot por el pelo. Kit antivuelco para mueble y tele.']),
]

# ---------------------------------------------------------------- html
def mkt_rows(mercado, nuestro):
    out = []
    for tienda, desc, p in mercado:
        if p is None:
            ps, x = 'no encontré precio', ''
        elif isinstance(p, str):
            ps, x = p, ''
        else:
            ps, x = m(p), f'{nuestro / p:.1f}×'
        out.append(f'<tr><td>{html.escape(tienda)}<span class="sub">{html.escape(desc)}</span></td><td class="num">{ps}</td><td class="num mult">{x}</td></tr>')
    return ''.join(out)

def card_evento(p, svgs):
    precio = r100(p['maq'] * EV_MULT)
    pts = ''.join(f'<li>{html.escape(t)}</li>' for t in p['puntos'])
    return f'''
<article class="sheet" id="{p['id'].lower()}">
  <header class="sheet-h"><span class="code">{p['id']}</span><h3>{html.escape(p['nombre'])}</h3><span class="med">{html.escape(p['med'])}</span></header>
  <div class="sheet-b">
    <div class="draw">{svgs}</div>
    <div class="spec">
      <ul class="pts">{pts}</ul>
      <p class="armado"><b>Armado fácil.</b> {html.escape(p['armado'])}</p>
      <table class="money">
        <tr><th>Material (ERP VH)</th><td class="num">{m(p['mat'])}</td></tr>
        <tr><th>Costo fabricación VH (fórmula Alba ×1.8)</th><td class="num">{m(p['fab'])}</td></tr>
        <tr><th>Maquila VH (margen piso 25%)</th><td class="num">{m(p['maq'])}</td></tr>
        <tr class="hl"><th>Nuestro precio B2B (×{EV_MULT})</th><td class="num">{m(precio)}</td></tr>
      </table>
      <p class="fine">{html.escape(p['nota_costo'])}</p>
      <table class="mkt"><thead><tr><th>Lo parecido en el mercado</th><th class="num">Precio</th><th class="num">Nosotros</th></tr></thead>{mkt_rows(p['mercado'], precio)}</table>
    </div>
  </div>
</article>'''

def card_living(p, svgs):
    f = p['full']
    hoy = r100(f['maquila25'] * LV_MULT)
    obj = p['objetivo']
    mat_perm = obj / MASS
    base = p.get('lite') or f
    gap = mat_perm / base['material'] - 1
    pts = ''.join(f'<li>{html.escape(t)}</li>' for t in p['puntos'])
    lite_row = ''
    if p.get('lite'):
        l = p['lite']
        lite_row = f'<tr><th>Versión Lite (LED de línea $700, correderas Häfele, sin multicontacto)</th><td class="num">{m(l["material"])}</td><td class="num">{m(r100(l["maquila25"] * LV_MULT))}</td></tr>'
    return f'''
<article class="sheet" id="{p['id'].lower()}">
  <header class="sheet-h"><span class="code">{p['id']}</span><h3>{html.escape(p['nombre'])}</h3><span class="med">{html.escape(p['med'])}</span></header>
  <div class="sheet-b">
    <div class="draw">{svgs}</div>
    <div class="spec">
      <ul class="pts">{pts}</ul>
      <p class="armado"><b>Armado fácil.</b> {html.escape(p['armado'])}</p>
      <table class="money three">
        <thead><tr><th></th><th class="num">Material</th><th class="num">Precio público</th></tr></thead>
        <tr><th>Hoy: costo VH ×1.8, maquila 25%, venta en ML ×{LV_MULT}</th><td class="num">{m(f['material'])}</td><td class="num">{m(hoy)}</td></tr>
        {lite_row}
        <tr class="hl"><th>Objetivo: diseño increíble, un poco más caro que el importado</th><td class="num">{m(mat_perm)}</td><td class="num">{m(obj)}</td></tr>
      </table>
      <p class="fine">Para llegar al objetivo, el material tiene que bajar <b>{abs(gap) * 100:.0f}%</b> y VH tiene que dar factor de línea (ver “¿Premium o un poco más abajo?”).</p>
      <table class="mkt"><thead><tr><th>Lo parecido en ML / Amazon / retail</th><th class="num">Precio</th><th class="num">Objetivo</th></tr></thead>{mkt_rows(p['mercado'], obj)}</table>
    </div>
  </div>
</article>'''

def fig(d, cap, cls=''):
    return f'<figure class="{cls}">{d.svg(cap)}<figcaption>{html.escape(cap)}</figcaption></figure>'

ev_svgs = {
    'BAR-118': fig(dw_barra_frente('luz'), 'Frente con piel Luminosa') + fig(dw_barra_corte(), 'Corte lateral'),
    'PED-59': fig(dw_pedestal(), 'Frente con piel Roble y costado'),
    'PER-X': fig(dw_periquera(), 'Alzado') + fig(dw_periquera_planta(), 'Planta'),
    'MESA-X': fig(dw_mesa(), 'Lateral largo', 'wide') + fig(dw_mesa_cabecera(), 'Cabecera'),
    'DJ-354': fig(dw_dj(), 'Frente: pedestales con piel Roble, barras con piel Luminosa', 'wide'),
}
lv_svgs = {
    'TOC-01': fig(dw_tocador('negro'), 'Frente, acabado Negro'),
    'ESC-01': fig(dw_escritorio('roble'), 'Frente, acabado Roble', 'wide'),
    'MC-01': fig(dw_mesacentro('roble'), 'Frente, acabado Roble', 'wide') + fig(dw_mesacentro_lado('roble'), 'Costado', 'side'),
    'TV-01': fig(dw_tv('negro'), 'Frente, acabado Negro', 'wide') + fig(dw_tv_lado('negro'), 'Costado', 'side'),
}

pieles = ''.join(
    f'<figure class="piel">{dw_piel(k).svg(n)}<figcaption><b>{n}</b><span>{d}</span><span class="num">{m(r100(cost(pid)["maquila25"] * EV_MULT))}</span></figcaption></figure>'
    for k, n, d, pid in [('roble', 'Piel Roble', 'Melamina 16 Roble TX', 'PIEL-R'),
                         ('luz', 'Piel Luminosa', 'Acrílico opalino + LED', 'PIEL-L'),
                         ('marca', 'Piel Marca', 'MDF 5.5 + vinil del cliente', 'PIEL-M')])

ev_cards = ''.join(card_evento(p, ev_svgs[p['id']]) for p in EVENTOS)
for p in EVENTOS:
    if p['id'] == 'BAR-118':
        pass
ev_cards = ev_cards.replace('<article class="sheet" id="ped-59">',
    f'<section class="pieles"><h4>Pieles de la barra: el mismo cuerpo, otra cara</h4><div class="piel-row">{pieles}</div></section>\n<article class="sheet" id="ped-59">', 1)
lv_cards = ''.join(card_living(p, lv_svgs[p['id']]) for p in LIVING)

# tabla resumen
def rng(precio, ref):
    vs = sorted(precio / x[2] for x in ref)
    return f'{vs[0]:.1f}×' if len(vs) == 1 else f'{vs[0]:.1f}–{vs[-1]:.1f}×'
rows = []
for p in EVENTOS:
    precio = r100(p['maq'] * EV_MULT)
    ref = [x for x in p['mercado'] if isinstance(x[2], (int, float))]
    refs = ', '.join(m(x[2]) for x in ref) if ref else '—'
    mult = rng(precio, ref) if ref else '—'
    rows.append(f'<tr><td>Eventos</td><td>{html.escape(p["nombre"])}</td><td class="num">{m(p["mat"])}</td><td class="num">{m(p["fab"])}</td><td class="num">{m(precio)}</td><td class="num">{refs}</td><td class="num">{mult}</td></tr>')
for p in LIVING:
    hoy = r100(p['full']['maquila25'] * LV_MULT)
    ref = [x for x in p['mercado'] if isinstance(x[2], (int, float))]
    refs = ', '.join(m(x[2]) for x in ref)
    lo = min(x[2] for x in ref)
    rows.append(f'<tr><td>Living</td><td>{html.escape(p["nombre"])}</td><td class="num">{m(p["full"]["material"])}</td><td class="num">{m(p["full"]["fab"])}</td><td class="num">{m(hoy)} <span class="sub">objetivo {m(p["objetivo"])}</span></td><td class="num">{refs}</td><td class="num">{rng(hoy, ref)} <span class="sub">objetivo {rng(p["objetivo"], ref)}</span></td></tr>')
tabla = ''.join(rows)

proto = 2 * cost('BAR-118')['maquila25'] + cost('PED-59')['maquila25'] + cost('PIEL-R')['maquila25'] + cost('PIEL-L')['maquila25'] + cost('PIEL-M')['maquila25'] + 2 * cost('PER-X')['maquila25']
proto_living = cost('MC-01', 'roble')['maquila25'] * 2

tpl = open(os.path.join(HERE, 'plantilla.html'), encoding='utf-8').read()
out = (tpl.replace('{{EVENTOS}}', ev_cards).replace('{{LIVING}}', lv_cards)
          .replace('{{SISTEMA}}', fig(dw_sistema(), 'Tres configuraciones con las mismas dos piezas', 'wide'))
          .replace('{{HOJA_ANTES}}', hoja_antes.svg('Antes')).replace('{{HOJA_DESP}}', hoja_desp.svg('Después'))
          .replace('{{TABLA}}', tabla)
          .replace('{{PROTO}}', m(proto)).replace('{{PROTO_LV}}', m(proto_living))
          .replace('{{MASS}}', f'{MASS:.1f}'))
open(os.path.join(HERE, 'catalogo.html'), 'w', encoding='utf-8').write(out)
print('ok', len(out), 'proto', round(proto), 'mass', round(MASS, 2))
for p in LIVING:
    base = p.get('lite') or p['full']
    print(p['id'], 'mat', round(base['material']), 'permitido', round(p['objetivo'] / MASS), 'gap %.0f%%' % ((p['objetivo'] / MASS / base['material'] - 1) * 100))
for p in EVENTOS:
    print(p['id'], 'precio', r100(p['maq'] * EV_MULT))
