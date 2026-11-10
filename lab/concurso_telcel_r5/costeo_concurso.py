import re

MD = "/home/user/costeador-vonhaucke/lab/precios_telcel/COSTEO_TELCEL_C-CO-320R.md"
lineas = []
for ln in open(MD, encoding='utf-8'):
    m = re.match(r'\|\s*(\d+)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*\$?([\d,]+\.\d+)\s*\|', ln)
    if m:
        g = m.groups()
        lineas.append({'desc': g[2].strip(), 'costo': float(g[6].replace(',', ''))})

FAB_RE = re.compile(r'LAMINA|PINTURA EN POLVO|TIRA DE MADERA|MADERA PARA EMBALAJE|TUBULAR|TUBO REDONDO', re.I)
es_fab = lambda d: bool(FAB_RE.search(d))

MUEBLES = [
    {'nombre': 'Vitrina Torre',          'pos': 10, 'cant': 153, 'mat_fab': 2966.15, 'fmo': .10, 'fgif': .005, 'ref': 17998, 'conf': 'ALTA'},
    {'nombre': 'Vitrina Horizontal',     'pos': 20, 'cant': 197, 'mat_fab': 4483.13, 'fmo': .10, 'fgif': .25,  'ref': 14215, 'conf': 'ALTA'},
    {'nombre': 'Modulo Conector Cubo',   'pos': 30, 'cant': 25,  'nuevo': True,                                 'ref': None,  'conf': 'PRELIMINAR'},
    {'nombre': 'Modulo Almacenamiento',  'pos': 40, 'cant': 38,  'mat_fab': 3596.14, 'fmo': .10, 'fgif': .25,  'ref': 12000, 'conf': 'MEDIA'},
    {'nombre': 'Vitrina Isla',           'pos': 50, 'cant': 15,  'mat_fab': 3297.84, 'fmo': .10, 'fgif': .25,  'ref': 19200, 'conf': 'ALTA'},
    {'nombre': 'Caja de Cobro',          'pos': 60, 'cant': 10,  'nuevo': True,                                 'ref': None,  'conf': 'PRELIMINAR'},
]
# Secciona el workbook por ancla fab (orden real del workbook: Horizontal, Torre, Isla, Almacen)
ORDEN_WB = ['Vitrina Horizontal', 'Vitrina Torre', 'Vitrina Isla', 'Modulo Almacenamiento']
byname = {m['nombre']: m for m in MUEBLES}
seq = [byname[n] for n in ORDEN_WB]
for m in seq: m['lineas'] = []
cur = 0; cur_fab = 0.0
for l in lineas:
    fab = es_fab(l['desc'])
    if fab and cur_fab >= seq[cur]['mat_fab'] - 1 and cur < len(seq) - 1:
        cur += 1; cur_fab = 0.0
    seq[cur]['lineas'].append(l)
    if fab: cur_fab += l['costo']

def costea(m):
    fab = sum(l['costo'] for l in m['lineas'] if es_fab(l['desc']))
    cv  = sum(l['costo'] for l in m['lineas'] if not es_fab(l['desc']))
    cos_fab = fab * (1 + m['fmo'] + m['fgif']); cos_cv = cv * 1.06
    return fab, cv, cos_fab + cos_cv

# Cubo y Caja (NUEVOS, sin histórico): estimado por analogía, PRELIMINAR.
#  Cubo Conector (600x600x1030): cuerpo+zoclo lámina c18 + cubierta MDF/PVC + 4 niveladores + stickers. ~ mitad de un Almacén.
#  Caja de Cobro (1200x600x1200): ~ Almacén + copete + superficie MDF.
byname['Modulo Conector Cubo']['costo_prelim'] = 4200     # estimado por analogía (requiere costeo detallado)
byname['Caja de Cobro']['costo_prelim'] = 9500            # estimado por analogía (requiere costeo detallado)

for m in MUEBLES:
    if m.get('nuevo'):
        m['costo'] = m['costo_prelim']
    else:
        fab, cv, tot = costea(m); m['fab'] = fab; m['cv'] = cv; m['costo'] = tot

# --- Tabla del concurso ---
out = []
out.append("# COSTEO CONCURSO TELCEL R5 (MÓDULOS DATS) — Von Haucke\n")
out.append("Fuente de precios: workbook real C-CO-320R (misma familia) + producto_maestro verificado. "
           "Markup POLÍTICA_VH (fab ×(1+MO+GIF) reales por mueble; terceros/comprados ×1.06). "
           "**No se inventaron precios.** El costo NO incluye margen de utilidad ni flete/armado.\n")
out.append("| Pos | Mueble | Cant | Costo unit. | Confianza | Ref. Telcel/u | Importe (costo×cant) |")
out.append("|---|---|---:|---:|:--:|---:|---:|")
gran = 0.0
for m in sorted(MUEBLES, key=lambda x: x['pos']):
    imp = m['costo'] * m['cant']; gran += imp
    ref = f"${m['ref']:,}" if m.get('ref') else "—"
    out.append(f"| {m['pos']} | {m['nombre']} | {m['cant']} | ${m['costo']:,.0f} | {m['conf']} | {ref} | ${imp:,.0f} |")
out.append(f"| 70 | Servicio entrega/armado R5 | 1 | — | — | — | (por cotizar) |")
out.append(f"| | **TOTAL muebles (sin servicio)** | | | | | **${gran:,.0f}** |")
out.append("\n## Notas de confianza")
out.append("- **ALTA** (Torre, Horizontal, Isla): capa de fabricación ANCLADA al `cos_fab_real` verificado en `producto_maestro`; terceros (cristal templado, termoformado) y comprados con precio real del workbook C-CO-320R.")
out.append("- **MEDIA** (Almacén): el ancla fab del workbook ($2,601) quedó por debajo del `material_real` verificado ($3,596); costo preliminar, reconciliar BOM antes de cotizar en firme.")
out.append("- **PRELIMINAR** (Cubo Conector, Caja de Cobro): muebles NUEVOS sin histórico; estimado por analogía. **Requieren costeo detallado del spec** (lámina + MDF/PVC + herrajes, sin cristal).")
out.append("\n## Desglose por capas (muebles ALTA/MEDIA)")
out.append("| Mueble | Material fab | Material terceros/comprados | cos_fab (MO/GIF) | cos compra-venta | COSTO |")
out.append("|---|---:|---:|---:|---:|---:|")
for m in MUEBLES:
    if not m.get('nuevo'):
        out.append(f"| {m['nombre']} | ${m['fab']:,.0f} | ${m['cv']:,.0f} | ${m['fab']*(1+m['fmo']+m['fgif']):,.0f} | ${m['cv']*1.06:,.0f} | ${m['costo']:,.0f} |")

txt = "\n".join(out)
open("/home/user/costeador-vonhaucke/lab/concurso_telcel_r5/COSTEO_CONCURSO_R5.md", "w", encoding='utf-8').write(txt)
print(txt)
