# Operación 10/10 · tres muebles sintéticos más para Costear (familias y entradas distintas a V3):
#   librero_5x8.png  → tablero de 28 mm en HOJA 5×8 (el catálogo ERP 5×8 no trae formato: debe quedar pendiente, no inventarse)
#   escritorio_L.png → cubierta + retorno + paneles + faldón + cajonera comprada
#   gabinete_alto.pdf → entrada por PDF: puertas, bisagras, jaladeras, entrepaños, zoclo
# Todas las cotas y materiales están escritos en el plano: cada renglón de la hoja de control tiene evidencia.
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
INK = '#102030'
def cota(ax, x1, y1, x2, y2, txt, off=(0, 30), rot=0):
    ax.annotate('', xy=(x1, y1), xytext=(x2, y2), arrowprops=dict(arrowstyle='<->', color=INK))
    ax.text((x1 + x2) / 2 + off[0], (y1 + y2) / 2 + off[1], txt, ha='center', fontsize=9, fontweight='bold', color=INK, rotation=rot)
def nota(ax, y, txt, bold=False):
    ax.text(0, y, txt, fontsize=8, color=INK, fontweight='bold' if bold else 'normal')
def pie(ax, y):
    ax.text(0, y, 'PLANO SINTÉTICO DE LABORATORIO · NO ES PROYECTO REAL', fontsize=7, color='#6b645c')

# 1) LIBRERO 900 × 350 × 1800 en melamina 28 mm WALNUT, HOJA 5 × 8
fig, axs = plt.subplots(1, 2, figsize=(14, 12)); fig.patch.set_facecolor('white')
ax = axs[0]; ax.set_xlim(-300, 1150); ax.set_ylim(-520, 2000); ax.set_aspect('equal'); ax.axis('off')
ax.set_title('LIBRERO ABIERTO · VISTA FRONTAL · mm', fontsize=11, fontweight='bold', color=INK)
for x in (0, 872): ax.add_patch(Rectangle((x, 0), 28, 1800, fc='#8a6a4a', ec=INK))          # laterales
for y in (0, 1772): ax.add_patch(Rectangle((28, y), 844, 28, fc='#8a6a4a', ec=INK))         # piso y techo
for y in (380, 740, 1100, 1440): ax.add_patch(Rectangle((28, y), 844, 28, fc='#a88a6a', ec=INK))  # 4 entrepaños
cota(ax, 0, 1880, 900, 1880, '900'); cota(ax, 1000, 0, 1000, 1800, '1800', off=(40, 0), rot=90)
cota(ax, 28, 300, 872, 300, 'ENTREPAÑO 844', off=(0, -60))
nota(ax, -120, 'MATERIAL: AGLOMERADO MELAMINA DOS CARAS 28 mm ACABADO WALNUT, HOJA 5 × 8 (1525 × 2440)', True)
nota(ax, -170, '2 LATERALES 1800 × 350 · PISO Y TECHO 844 × 350 (2) · 4 ENTREPAÑOS FIJOS 844 × 330')
nota(ax, -220, 'RESPALDO: MELAMINA 16 mm WALNUT 1800 × 900, UNA PIEZA, ATORNILLADO')
nota(ax, -270, 'TAPACANTO PVC 2 mm WALNUT SÓLO EN CANTOS FRONTALES · 4 NIVELADORES', True)
pie(ax, -330)
ax = axs[1]; ax.set_xlim(-300, 700); ax.set_ylim(-520, 2000); ax.set_aspect('equal'); ax.axis('off')
ax.set_title('VISTA LATERAL', fontsize=11, fontweight='bold', color=INK)
ax.add_patch(Rectangle((0, 0), 350, 1800, fc='#8a6a4a', ec=INK)); ax.add_patch(Rectangle((350, 0), 16, 1800, fc='#6a4a2a', ec=INK))
cota(ax, 0, 1880, 350, 1880, '350'); cota(ax, 350, -60, 366, -60, 'RESPALDO 16', off=(60, -40))
fig.savefig('librero_5x8.png', dpi=100, bbox_inches='tight'); plt.close(fig); print('ok librero_5x8.png')

# 2) ESCRITORIO EN L 1600 × 1500 × 750 · melamina 19 mm Gris Humo
fig, axs = plt.subplots(1, 2, figsize=(16, 9)); fig.patch.set_facecolor('white')
ax = axs[0]; ax.set_xlim(-300, 1900); ax.set_ylim(-420, 1700); ax.set_aspect('equal'); ax.axis('off')
ax.set_title('ESCRITORIO EN L · PLANTA · mm', fontsize=11, fontweight='bold', color=INK)
ax.add_patch(Rectangle((0, 800), 1600, 700, fc='#d9d9d9', ec=INK, lw=2))       # cubierta principal
ax.add_patch(Rectangle((1100, 0), 500, 800, fc='#cfcfcf', ec=INK, lw=2))       # retorno 800 × 500
ax.add_patch(Rectangle((100, 850), 420, 500, fc='none', ec=INK, ls='--'))      # cajonera
ax.text(310, 1100, 'CAJONERA\nMÓVIL', ha='center', fontsize=8, color=INK)
cota(ax, 0, 1580, 1600, 1580, '1600'); cota(ax, -120, 800, -120, 1500, '700', off=(-40, 0), rot=90)
cota(ax, 1700, 0, 1700, 800, 'RETORNO 800', off=(60, 0), rot=90); cota(ax, 1100, -60, 1600, -60, '500', off=(0, -50))
nota(ax, -160, 'CUBIERTA PRINCIPAL MELAMINA 19 mm GRIS HUMO 1600 × 700 · RETORNO 800 × 500 MISMO MATERIAL', True)
nota(ax, -210, '3 PANELES LATERALES (PATAS PANEL) MELAMINA 19 mm: 2 DE 731 × 700 Y 1 DE 731 × 500')
nota(ax, -260, 'FALDÓN MELAMINA 19 mm 1500 × 300, UNA PIEZA · TAPACANTO PVC 2 mm GRIS EN CANTOS VISIBLES')
nota(ax, -310, 'CAJONERA MÓVIL 3 GAVETAS (COMPRADA, 1 PIEZA)', True)
pie(ax, -370)
ax = axs[1]; ax.set_xlim(-300, 1900); ax.set_ylim(-420, 1700); ax.set_aspect('equal'); ax.axis('off')
ax.set_title('VISTA FRONTAL', fontsize=11, fontweight='bold', color=INK)
ax.add_patch(Rectangle((0, 731), 1600, 19, fc='#d9d9d9', ec=INK, lw=2))
for x in (0, 1581): ax.add_patch(Rectangle((x, 0), 19, 731, fc='#bfbfbf', ec=INK))
ax.add_patch(Rectangle((50, 431), 1500, 300, fill=False, ec=INK, hatch='//'))
cota(ax, 1750, 0, 1750, 750, '750', off=(40, 0), rot=90); cota(ax, 50, 380, 1550, 380, 'FALDÓN 1500 × 300', off=(0, -60))
fig.savefig('escritorio_L.png', dpi=100, bbox_inches='tight'); plt.close(fig); print('ok escritorio_L.png')

# 3) GABINETE ALTO 800 × 450 × 2000 · melamina 19 mm Soft Grey · ENTRADA PDF
fig, axs = plt.subplots(1, 2, figsize=(16.5, 11.7)); fig.patch.set_facecolor('white')   # A3 apaisado
ax = axs[0]; ax.set_xlim(-300, 1050); ax.set_ylim(-600, 2200); ax.set_aspect('equal'); ax.axis('off')
ax.set_title('GABINETE ALTO 2 PUERTAS · VISTA FRONTAL · mm', fontsize=11, fontweight='bold', color=INK)
for x in (0, 781): ax.add_patch(Rectangle((x, 100), 19, 1900, fc='#b8bcc2', ec=INK))
for y in (100, 1981): ax.add_patch(Rectangle((19, y), 762, 19, fc='#b8bcc2', ec=INK))
ax.add_patch(Rectangle((19, 0), 762, 100, fc='#8d939a', ec=INK))                       # zoclo
for x in (2, 401): ax.add_patch(Rectangle((x, 102), 397, 1896, fill=False, ec=INK, lw=1.6))  # puertas
for x in (370, 430): ax.add_patch(Rectangle((x, 1000), 8, 160, fc=INK))                   # jaladeras
cota(ax, 0, 2090, 800, 2090, '800'); cota(ax, 900, 0, 900, 2000, '2000', off=(40, 0), rot=90)
cota(ax, -120, 0, -120, 100, 'ZOCLO 100', off=(-50, 0), rot=90)
nota(ax, -120, 'MATERIAL: MELAMINA 19 mm SOFT GREY (HOJA 4 × 8) · RESPALDO MDF 6 mm 1980 × 780 (UNA PIEZA)', True)
nota(ax, -170, '2 LATERALES 2000 × 450 · TECHO Y PISO 762 × 450 (2) · 4 ENTREPAÑOS AJUSTABLES 760 × 430')
nota(ax, -220, '2 PUERTAS 397 × 1896 · ZOCLO FRONTAL 762 × 100')
nota(ax, -270, 'HERRAJES: 8 BISAGRAS CIERRE SUAVE (4 POR PUERTA) · 2 JALADERAS 160 mm · 4 NIVELADORES', True)
nota(ax, -320, 'TAPACANTO PVC 2 mm SOFT GREY EN CANTOS VISIBLES Y EN TODO EL PERÍMETRO DE LAS PUERTAS')
pie(ax, -380)
ax = axs[1]; ax.set_xlim(-300, 800); ax.set_ylim(-600, 2200); ax.set_aspect('equal'); ax.axis('off')
ax.set_title('VISTA LATERAL / CORTE', fontsize=11, fontweight='bold', color=INK)
ax.add_patch(Rectangle((0, 100), 450, 1900, fill=False, ec=INK, lw=2))
for y in (520, 900, 1280, 1660): ax.add_patch(Rectangle((10, y), 430, 19, fc='#d0d4d8', ec=INK))
cota(ax, 0, 2090, 450, 2090, '450'); cota(ax, 10, 470, 440, 470, 'ENTREPAÑO 430', off=(0, -60))
fig.savefig('gabinete_alto.pdf', bbox_inches='tight'); plt.close(fig); print('ok gabinete_alto.pdf')
