#!/usr/bin/env python3
# Reconstruye BOM por línea de los módulos TELCEL (C-CO-320R) desde explo_x_id.csv.
# DETERMINISTA, sin inventar: toma las líneas con artículo + costo_unitario que preceden
# a cada marcador "id_0X costo_total: T", y SOLO acepta la reconstrucción si la suma de
# líneas reconcilia el total del módulo (±$1). Los módulos con sub-bloques anidados
# duplicados (suma ≫ total) quedan marcados NO_RECONCILIA → pendientes, nunca forzados.
# Uso: python3 reconstruir_bom_telcel.py <explo_x_id.csv> [CLAVE_A_EMITIR]
import csv, sys, re, json

MOD = {  # id del explosor → (clave producto_maestro, nombre, factor_mo, factor_gif)
    'id_01': ('TELCEL-VH-HORIZONTAL', 'Vitrina horizontal metal (Telcel C-CO-320R)', 0.10, 0.25),
    'id_02': ('TELCEL-VH-TORRE',      'Vitrina torre metal (Telcel C-CO-320R)',      0.10, 0.25),
    'id_03': ('TELCEL-VH-ISLA',       'Vitrina isla metal (Telcel C-CO-320R)',       0.10, 0.25),
    'id_04': ('TELCEL-MOD-ALMACEN',   'Módulo de almacenamiento metal (Telcel C-CO-320R)', 0.10, 0.25),
}

def num(x):
    try: return float(str(x).replace(',', '').replace('$', ''))
    except Exception: return None

def parse(path):
    rows = list(csv.reader(open(path, encoding='utf-8-sig')))
    out = {}
    buf = []
    for r in rows:
        txt = ' '.join(c for c in r if c)
        m = re.search(r'(id_0\d) costo_total:', txt)
        if m:
            idk, total = m.group(1), num(r[26]) if len(r) > 26 else None
            if idk in MOD and total and total > 0:
                suma = round(sum(l['precioConfirmado'] * l['cantidad'] for l in buf), 2)
                out[idk] = {'total': total, 'suma': suma, 'reconcilia': abs(suma - total) <= 1.0, 'lineas': buf[:]}
            buf = []
            continue
        art = r[18].strip() if len(r) > 18 else ''
        cu = num(r[26]) if len(r) > 26 else None
        if art and art.lower() != 'articulo' and cu is not None and cu > 0:
            desc = (r[19].strip() if len(r) > 19 else '') or art
            opcion = r[20].strip() if len(r) > 20 else ''
            unidad = r[22].strip() if len(r) > 22 else ''
            buf.append({
                'desc': re.sub(r'\s+', ' ', desc)[:80],
                'articulo': art, 'opcion': opcion, 'unidad': unidad or None,
                'cantidad': 1, 'precioConfirmado': round(cu, 2),
                'insumoId': None, 'esCompraVenta': False,  # mapeo a catálogo = acción gobernada aparte
            })
    return out

if __name__ == '__main__':
    data = parse(sys.argv[1])
    emitir = sys.argv[2] if len(sys.argv) > 2 else None
    for idk, (clave, nombre, fmo, fgif) in MOD.items():
        d = data.get(idk)
        if not d:
            print(f"{clave:24} SIN DATOS", file=sys.stderr); continue
        estado = 'RECONCILIA' if d['reconcilia'] else 'NO_RECONCILIA (sub-bloques anidados; pendiente)'
        print(f"{clave:24} total={d['total']:>9.2f} suma_lineas={d['suma']:>10.2f} lineas={len(d['lineas']):>2} → {estado}", file=sys.stderr)
        if emitir and clave == emitir and d['reconcilia']:
            bom = {
                'clave': clave, 'nombre': nombre,
                'fuente': f'reconstruido de explo_x_id {sys.argv[1].split("/")[-1]} (id={idk})',
                'tipo_bom': 'BOM_DETALLADO_VERIFICADO',
                'cos_fab_real': round(d['total'] * (1 + fmo + fgif), 2),
                'material_real': d['total'], 'factor_mo': fmo, 'factor_gif': fgif,
                'lineas': d['lineas'],
            }
            print(json.dumps(bom, ensure_ascii=False, indent=2))
