#!/usr/bin/env python3
# Reconstruye los 4 BOM TELCEL (C-CO-320R) desde explo_x_id.csv — ENTREGA 1.
# DETERMINISTA, sin inventar. Las líneas-hoja de cada módulo son las que están ENTRE su
# marcador `id_0X` (col 15) y su `id_0X costo_total:` — NO "desde el total anterior" (eso
# arrastraba la sub-explosión por componente y sobre-sumaba). Captura TODA línea con
# costo_unitario>0; las que no traen Artículo quedan necesita_humano=true (identidad
# pendiente), con su costo, para que el módulo sume su total real sin inventar identidad.
# Uso: python3 reconstruir_bom_telcel.py <explo_x_id.csv> [--emitir DIR]  (escribe 4 JSON)
import csv, sys, re, json, os

MOD = {
    'id_01': ('TELCEL-VH-HORIZONTAL', 'Vitrina horizontal metal (Telcel C-CO-320R)', 4483.13),
    'id_02': ('TELCEL-VH-TORRE',      'Vitrina torre metal (Telcel C-CO-320R)',      2966.15),
    'id_03': ('TELCEL-VH-ISLA',       'Vitrina isla metal (Telcel C-CO-320R)',       3297.84),
    'id_04': ('TELCEL-MOD-ALMACEN',   'Módulo de almacenamiento metal (Telcel C-CO-320R)', 3596.14),
}
FMO, FGIF = 0.10, 0.25  # factores Telcel metal (de la hoja; se re-evalúan por evidencia en ENTREGA 2)

def num(x):
    try: return float(str(x).replace(',', '').replace('$', ''))
    except Exception: return None

def marcador_id(r):
    cols = [c.strip() for c in r if c and c.strip()]
    if 'id_0' in ' '.join(cols) and not any('costo_total' in c for c in cols):
        m = re.fullmatch(r'id_0\d', (r[15].strip() if len(r) > 15 else ''))
        if m: return m.group(0)
    return None

def total_id(r):
    txt = ' '.join(c for c in r if c and c.strip())
    m = re.search(r'(id_0\d)\s+costo_total:\s*([\d.,]+)', txt)
    return (m.group(1), num(m.group(2))) if m else (None, None)

def parse(path):
    rows = list(csv.reader(open(path, encoding='utf-8-sig')))
    cur, buf, res = None, [], {}
    for r in rows:
        mk = marcador_id(r)
        tid, tot = total_id(r)
        if mk: cur, buf = mk, []; continue
        if tid:
            if tid in MOD and tot and tot > 0 and cur == tid:
                res[tid] = {'tot': tot, 'lineas': buf[:]}
            cur, buf = None, []; continue
        if not cur: continue
        art = (r[18].strip() if len(r) > 18 else '')
        cu = num(r[26]) if len(r) > 26 else None
        desc = (r[19].strip() if len(r) > 19 else '') or art
        if art.lower() == 'articulo': continue
        if cu and cu > 0:
            tiene_id = bool(art)
            buf.append({
                'desc': re.sub(r'\s+', ' ', desc)[:80] or 'LÍNEA SIN DESCRIPCIÓN',
                'articulo': art or None,
                'opcion': (r[20].strip() if len(r) > 20 else '') or None,
                'unidad': (r[22].strip() if len(r) > 22 else '') or None,
                'cantidad': 1, 'precioConfirmado': round(cu, 2),
                'insumoId': None, 'esCompraVenta': False,
                'necesita_humano': not tiene_id,  # sin Artículo = identidad pendiente
            })
    return res

def bom_de(idk, d):
    clave, nombre, tot = MOD[idk]
    con_id = sum(l['precioConfirmado'] for l in d['lineas'] if not l['necesita_humano'])
    sin_id = sum(l['precioConfirmado'] for l in d['lineas'] if l['necesita_humano'])
    suma = round(con_id + sin_id, 2)
    return {
        'clave': clave, 'nombre': nombre,
        'fuente': f'reconstruido de explo_x_id C-CO-320R ({idk})',
        'tipo_bom': 'BOM_DETALLADO_VERIFICADO',
        'material_real': tot, 'factor_mo': FMO, 'factor_gif': FGIF,
        'cos_fab_real': round(tot * (1 + FMO + FGIF), 2),
        'reconcilia': abs(suma - tot) <= 1.0,
        'cobertura_identidad_pct': round(100 * con_id / tot, 1) if tot else 0,
        'pendiente_identidad': round(sin_id, 2),
        'lineas': d['lineas'],
    }

if __name__ == '__main__':
    data = parse(sys.argv[1])
    emitir = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--emitir' else None
    for idk in MOD:
        d = data.get(idk)
        if not d: print(f"{MOD[idk][0]:24} SIN BLOQUE", file=sys.stderr); continue
        b = bom_de(idk, d)
        print(f"{b['clave']:24} lineas={len(b['lineas']):2} suma={round(sum(l['precioConfirmado'] for l in b['lineas']),2):9.2f} "
              f"total={b['material_real']:9.2f} ident={b['cobertura_identidad_pct']:5.1f}% pend={b['pendiente_identidad']:8.2f} "
              f"→ {'RECONCILIA' if b['reconcilia'] else 'NO'}", file=sys.stderr)
        if emitir:
            os.makedirs(emitir, exist_ok=True)
            open(os.path.join(emitir, f"{b['clave']}.json"), 'w').write(json.dumps(b, ensure_ascii=False, indent=1))
