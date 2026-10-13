#!/usr/bin/env python3
"""Prueba CIEGA contra el ERP (2026-10-13). Entrada = SOLO la descripción comercial del artículo Intelisis
(lo que un vendedor copiaría del catálogo). El despiece y el costo del "REPORTE DEL COTIZADOR" (lab/applt/componentes)
NO se le dan a la app: quedan en `erp_referencia` para comparar después (comparar.mjs).
Las familias esperadas salen de los renglones del reporte, no de lo que la app sabe hacer."""
import json, re, glob, os
AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, '..', '..', '..'))

def fam(desc):
    d = desc.upper()
    if 'AGLOMERADO MELAMINA' in d:
        esp = re.search(r'ESPESOR (\d+)', d).group(1); return ('tablero', esp)
    if 'PERFIL DE CANTO' in d: return ('canto', re.search(r'ANCHO (\d+)', d).group(1))
    if 'CHAPACINTA' in d: return ('chapacinta', None)
    if 'LAMINA NEGRA' in d: return ('lamina', re.search(r'CALIBRE (\d+)', d).group(1))
    if 'TUBULAR' in d: return ('tubular', None)
    if 'CRISTAL' in d: return ('cristal', None)
    if 'PINTURA' in d: return ('pintura', None)
    if 'NIVELADOR' in d: return ('nivelador', None)
    if 'SOPORTE' in d: return ('soporte', None)
    return ('herraje', None)

for f in sorted(glob.glob(os.path.join(REPO, 'lab/applt/componentes/*.json'))):
    d = json.load(open(f))
    texto = re.sub(r'\s*--\s*\S+\s*$', '', d['descripcion']).strip()          # sin la clave ERP
    texto = texto[0] + texto[1:].lower()
    fams = {}
    for m in d['materiales']:
        k = fam(m['descripcion']); fams.setdefault(k, []).append(m)
    esperado = []
    for (t, sub), ms in fams.items():
        cant = round(sum(m['cantidad'] for m in ms), 4); u = ms[0]['unidad'].lower()
        e = {'clave': f'{t}{"-" + sub if sub else ""}', 'familia': t, 'sub': sub, 'erp_cantidad': cant, 'erp_unidad': u,
             'erp_articulos': sorted({m['articulo'] for m in ms}), 'erp_importe': round(sum(m['cantidad'] * m['costo_reporte'] for m in ms), 2)}
        esperado.append(e)
    cr = d.get('costos_reporte', {})
    hoja = {'texto': texto, 'producto': d['descripcion'], 'clave_erp': d['clave'],
            'proposito': 'Prueba ciega: sólo la descripción comercial; el BOM del cotizador Intelisis queda fuera de la app.',
            'respuestas': [], 'esperado': [], 'extrasPermitidos': 'torniller|rondana|pija|tuerca|cintur|tornillo|consumible|soldadura|empaque',
            'erp_referencia': {'familias': esperado, 'mp': cr.get('mp'), 'mo': cr.get('mo'), 'gif': cr.get('gif'), 'total_fabricacion': cr.get('total'),
                               'horas': d.get('horas'), 'fuente': d['fuente']}}
    json.dump(hoja, open(os.path.join(AQUI, 'hojas', d['clave'] + '.json'), 'w'), ensure_ascii=False, indent=1)
    print(d['clave'], '|', texto)
