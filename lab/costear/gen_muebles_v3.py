# Dos muebles sintéticos de familias distintas a la credenza, con TODAS las cotas y materiales escritos en el plano,
# para que cada cantidad del BOM tenga evidencia. Hojas de control en lab/costear/hojas_control/.
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
INK='#102030'
def cota(ax, x1, y1, x2, y2, txt, off=(0, 30), rot=0):
    ax.annotate('', xy=(x1, y1), xytext=(x2, y2), arrowprops=dict(arrowstyle='<->', color=INK))
    ax.text((x1 + x2) / 2 + off[0], (y1 + y2) / 2 + off[1], txt, ha='center', fontsize=9, fontweight='bold', color=INK, rotation=rot)

# 1) MESA DE TRABAJO 1500 × 700 × 750: cubierta melamina blanca 19 mm, estructura PTR 1"×2" cal. 16, faldón lámina cal. 18
fig, axs = plt.subplots(1, 2, figsize=(16, 9)); fig.patch.set_facecolor('white')
ax = axs[0]; ax.set_xlim(-250, 1800); ax.set_ylim(-320, 1000); ax.set_aspect('equal'); ax.axis('off')
ax.set_title('MESA DE TRABAJO · VISTA FRONTAL · mm', fontsize=11, fontweight='bold', color=INK)
ax.add_patch(Rectangle((0, 731), 1500, 19, fc='#e8e8e8', ec=INK, lw=2))                 # cubierta
for x in (25, 1425): ax.add_patch(Rectangle((x, 0), 50, 731, fc='#6b7a8c', ec=INK))      # patas
ax.add_patch(Rectangle((75, 681), 1350, 50, fc='#6b7a8c', ec=INK))                       # larguero
ax.add_patch(Rectangle((50, 381), 1400, 300, fill=False, ec=INK, lw=1.4, hatch='//'))   # faldón
cota(ax, 0, 850, 1500, 850, '1500'); cota(ax, 1600, 0, 1600, 750, '750', off=(40, 0), rot=90)
cota(ax, -120, 0, -120, 731, 'PATA 731', off=(-40, 0), rot=90); cota(ax, 50, 330, 1450, 330, 'FALDÓN 1400 × 300', off=(0, -60))
ax.text(0, -120, 'CUBIERTA MELAMINA BLANCA 19 mm 1500 × 700 · TAPACANTO PVC 2 mm PERIMETRAL (4.40 m)', fontsize=8, color=INK, fontweight='bold')
ax.text(0, -170, 'ESTRUCTURA PTR 1" × 2" CAL. 16: 4 PATAS DE 731 + 2 LARGUEROS DE 1350 + 2 TRAVESAÑOS DE 600 (TOTAL 6.82 m)', fontsize=8, color=INK)
ax.text(0, -220, 'FALDÓN LÁMINA DE ACERO CAL. 18, 1400 × 300, UNA PIEZA', fontsize=8, color=INK)
ax.text(0, -270, 'PINTURA EN POLVO BLANCO RAL 9016 EN ESTRUCTURA Y FALDÓN · 4 NIVELADORES', fontsize=8, color=INK, fontweight='bold')
ax = axs[1]; ax.set_xlim(-250, 1100); ax.set_ylim(-320, 1000); ax.set_aspect('equal'); ax.axis('off')
ax.set_title('VISTA LATERAL', fontsize=11, fontweight='bold', color=INK)
ax.add_patch(Rectangle((0, 731), 700, 19, fc='#e8e8e8', ec=INK, lw=2))
for x in (25, 625): ax.add_patch(Rectangle((x, 0), 50, 731, fc='#6b7a8c', ec=INK))
ax.add_patch(Rectangle((75, 100), 550, 50, fc='#6b7a8c', ec=INK))   # 1 travesaño por lado (2 en total)
cota(ax, 0, 850, 700, 850, '700'); cota(ax, 50, 40, 650, 40, 'TRAVESAÑO 600', off=(0, -60))
ax.text(0, -270, 'PLANO SINTÉTICO DE LABORATORIO · NO ES PROYECTO REAL', fontsize=7, color='#6b645c')
fig.savefig('mesa_trabajo.png', dpi=110, bbox_inches='tight'); plt.close(fig); print('ok mesa_trabajo.png')

# 2) MESA DE CENTRO 1000 × 600 × 420: cubierta cristal templado 9 mm, base tubular redondo 3/4" cal. 18 cromado
fig, axs = plt.subplots(1, 2, figsize=(16, 8)); fig.patch.set_facecolor('white')
ax = axs[0]; ax.set_xlim(-250, 1300); ax.set_ylim(-320, 700); ax.set_aspect('equal'); ax.axis('off')
ax.set_title('MESA DE CENTRO · VISTA FRONTAL · mm', fontsize=11, fontweight='bold', color=INK)
ax.add_patch(Rectangle((0, 411), 1000, 9, fc='#cfe8ee', ec=INK, lw=2))                  # cristal
for x in (50, 931): ax.add_patch(Rectangle((x, 0), 19, 411, fc='#b0b8c0', ec=INK))
ax.add_patch(Rectangle((50, 392), 900, 19, fc='#b0b8c0', ec=INK)); ax.add_patch(Rectangle((50, 0), 900, 19, fc='#b0b8c0', ec=INK))
cota(ax, 0, 520, 1000, 520, '1000'); cota(ax, 1100, 0, 1100, 420, '420', off=(40, 0), rot=90)
ax.text(0, -120, 'CUBIERTA CRISTAL TEMPLADO 9 mm 1000 × 600, CANTO PULIDO', fontsize=8, color=INK, fontweight='bold')
ax.text(0, -170, 'BASE TUBULAR REDONDO 3/4" CAL. 18: 2 MARCOS RECTANGULARES 900 × 500 + 4 POSTES DE 392 (TOTAL 7.17 m)', fontsize=8, color=INK)
ax.text(0, -220, 'ACABADO DE LA BASE: CROMADO (ECOCROM)', fontsize=8, color=INK, fontweight='bold')
ax = axs[1]; ax.set_xlim(-250, 900); ax.set_ylim(-320, 700); ax.set_aspect('equal'); ax.axis('off')
ax.set_title('VISTA LATERAL', fontsize=11, fontweight='bold', color=INK)
ax.add_patch(Rectangle((0, 411), 600, 9, fc='#cfe8ee', ec=INK, lw=2))
for x in (50, 531): ax.add_patch(Rectangle((x, 0), 19, 411, fc='#b0b8c0', ec=INK))
ax.add_patch(Rectangle((50, 392), 500, 19, fc='#b0b8c0', ec=INK)); ax.add_patch(Rectangle((50, 0), 500, 19, fc='#b0b8c0', ec=INK))
cota(ax, 0, 520, 600, 520, '600'); cota(ax, 50, -40, 550, -40, 'MARCO 500', off=(0, -50))
ax.text(0, -270, 'PLANO SINTÉTICO DE LABORATORIO · NO ES PROYECTO REAL', fontsize=7, color='#6b645c')
fig.savefig('mesa_centro.png', dpi=110, bbox_inches='tight'); plt.close(fig); print('ok mesa_centro.png')
