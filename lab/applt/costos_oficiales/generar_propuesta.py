# Propuesta de carga de COSTO OFICIAL (VH-100 / P0-01) para componentes APP LT, regla de Dirección (2026-10-13):
# MP a último costo del ERP (reporte del cotizador Intelisis, 12/08/2026) + horas estándar × MO real por área
# + indirectos UNA vez (tarifa de planta 1/Σ(1/ind) = $82.37/h). Entregas: sin tarifa en ningún libro → no se cobran.
# NO se aplica: requiere autorización de Dirección y resolver las claves duplicadas en `productos`.
import json, glob, os
AQUI = os.path.dirname(os.path.abspath(__file__))
MO = {'pm': 92.38, 'carpinteria': 82.61, 'acabados': 74.99, 'pintura': 371.30}
IND = {'pm': 281.87, 'carpinteria': 252.06, 'acabados': 228.82, 'pintura': 3930.56}
IND_PLANTA = 1 / sum(1 / v for v in IND.values())
filas, notas = [], []
for f in sorted(glob.glob(os.path.join(AQUI, '..', 'componentes', '*.json'))):
    d = json.load(open(f))
    mp = round(sum(m['importe_derivado'] for m in d['materiales']), 2)
    h = {a: (d['horas'].get(a) or 0) for a in MO}
    mo = sum(h[a] * MO[a] for a in MO); ind = sum(h.values()) * IND_PLANTA
    costo = round(mp + mo + ind, 2)
    fila = {'codigo': d['clave'], 'costo': costo, 'moneda': 'MXN', 'fecha': '2026-08-12',
            'formula_version': 'direccion-2026-10-13:mp_ultimo_costo+horas_estandar*mo_real+ind_planta_una_vez',
            'desglose': {'mp': mp, 'mo': round(mo, 2), 'ind': round(ind, 2), 'horas': h}}
    if d['clave'] == 'ATCUBS46ABS':
        fila['excluir'] = True
        notas.append('ATCUBS46ABS: el reporte no trae carpintería; costo incompleto ($%.2f). Estimado con carpintería 0.79–1.04 h: $802–$843 (lab/applt/estimaciones). NO se carga hasta tener el dato.' % costo)
    filas.append(fila)
cargables = [{k: v for k, v in x.items() if k in ('codigo', 'costo', 'moneda', 'fecha', 'formula_version')} for x in filas if not x.get('excluir')]
json.dump({'documento': 'Reportes del cotizador Intelisis APP LT 12/08/2026 (15) + tarifas reales pedido 38247 · regla Dirección 2026-10-13',
           'ind_planta_hora': round(IND_PLANTA, 4), 'filas_rpc': cargables, 'detalle': filas, 'notas': notas},
          open(os.path.join(AQUI, 'propuesta_carga.json'), 'w'), ensure_ascii=False, indent=1)
for x in filas: print(f"{x['codigo']:<13} {x['costo']:>9.2f}  MP {x['desglose']['mp']:>8.2f}  MO {x['desglose']['mo']:>7.2f}  IND {x['desglose']['ind']:>7.2f}{'  (NO CARGAR)' if x.get('excluir') else ''}")
print('cargables', len(cargables)); [print('NOTA', n) for n in notas]
