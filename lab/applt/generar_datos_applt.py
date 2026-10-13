"""Genera src/datos/appltDatos.js desde los JSON extraídos de Drive (lab/applt/). Reproducible:
   python3 lab/applt/generar_datos_applt.py   — no inventa nada: sólo copia y ordena."""
import json, os
R = os.path.dirname(os.path.abspath(__file__))
e = json.load(open(os.path.join(R, 'ejemplo01_TATO63612AB001.json')))
c = json.load(open(os.path.join(R, 'coste_applt_20261002.json')))

bom = [{'clave': x['Componente'], 'cantidad': x['Cantidad'], 'descripcion': x['Descripción']} for x in c['modulo']['componentes']]
mats = [{'articulo': m['Material'], 'descripcion': m['Material Descripción'], 'unidad': m['Unidad'],
         'cantidad': m['Cantidad'], 'opcionLetra': (m['Sub Cuenta'] or '')[:1] or None,
         'fila': m['_fila']} for m in c['materiales_por_modulo']]
arts = {m['articulo'] for m in mats}
compras = {}
for r in c['compras_ultimo_costo_por_articulo_opcion']:
    if r['articulo'] in arts:
        compras.setdefault(r['articulo'], {})[r['opcion'] or '-'] = {
            'mn': round(r['ultimo_costo_unitario_MN'], 6), 'original': round(r['ultimo_costo_unitario_original'], 6),
            'fecha': r['fecha'], 'movimiento': r['movimiento']}
consumo = {}
for r in e['material']['consumido']:
    a, op = r.get('Artículo'), r.get('Opción')
    if a in arts and op and isinstance(r.get('Costo'), (int, float)):
        consumo.setdefault(a, {})[op] = round(r['Costo'], 6)
horas = {k: v['valor'] for k, v in c['fabricar_totales_fila34'].items()}
erp = {k: v['costo_unitario_erp_pt'] for k, v in e['despiece_por_componente'].items() if v.get('costo_unitario_erp_pt')}
lista = {p['articulo']: p['precio_unitario_derivado'] for p in e['partidas'] if p.get('precio_unitario_derivado') is not None}
out = {
  'fuente': {'pedido': e['cabecera']['pedido'], 'presupuesto': e['cabecera']['presupuesto'], 'costeLibro': 'Coste APP LT 20261002.xlsx', 'comprasAl': c['compras_meta']['fecha_max']},
  'modulo': {'clave': c['modulo']['clave'], 'descripcion': c['modulo']['descripcion'], 'bom': bom},
  'materialesPorModulo': mats, 'compras': compras, 'costoConsumoPedido': consumo,
  'horasEstandarPorModulo': {'pm': horas['O34'], 'pintura': horas['P34'], 'acabados': horas['Q34'], 'carpinteria': horas['R34'], 'entregas': horas['V34']},
  'costoErpUnitario': erp, 'listaPedido': lista,
}
js = ("// GENERADO por lab/applt/generar_datos_applt.py desde los libros de Dirección (Drive, 2026-10-13). NO editar a mano.\n"
      "// Pedido 38247 (TATO63612AB001) + Coste APP LT 20261002. Todo es dato del ERP; nada inventado.\n"
      "export const APPLT_DATOS = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n")
open(os.path.join(R, '..', '..', 'src', 'datos', 'appltDatos.js'), 'w').write(js)
print('ok', len(bom), 'componentes', len(mats), 'materiales', sum(len(v) for v in compras.values()), 'precios de compra')
