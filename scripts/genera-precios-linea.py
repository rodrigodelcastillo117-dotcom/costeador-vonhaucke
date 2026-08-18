#!/usr/bin/env python3
# ============================================================================
#  Regenera src/datos/preciosLinea.js desde el Excel de líneas.
#  Uso:  python3 scripts/genera-precios-linea.py "ruta/al/ARTICULOS - LINEAS.xlsx"
#  Requiere: pip install openpyxl
#  El Excel tiene 15 pestañas (una por línea) con columnas:
#    Clave · Clave Comercial · Descripción · Tipo · Precio 2 (FULL) ·
#    Precio Lista (cotización) · Precio Mínimo (piso) · Línea · Estatus · Fecha
# ============================================================================
import sys, json, openpyxl
RUTA = {
  'APP':'app','ALBA':'alba','ANTEO':'anteo','APPS LT':'applt','ECLIPSE':'eclipse',
  'ERGONOVA 4':'ergo4','FEATHER':'feather','RIO':'rio','TETRIS':'tetris','VIA':'via',
  'ECLIPSE DRIFT':'drift','WORK LOUNGE':'worklounge','CIRQUE':'cirque','FLEX':'flex','PRIVACY_4':'privacy4',
}
# Correcciones de datos que Rodrigo dictó (2026-08-18), aplicadas al leer el
# Excel para que sobrevivan a una regeneración. NO se inventan precios: son
# valores que él confirmó.
CORRECCIONES = {
  # El Excel trae FULL y LISTA intercambiados en este poste. Correcto: FULL 350,
  # Lista 240.
  'CIEPAT06E61508': {'f': 350, 'l': 240},
}

src = sys.argv[1] if len(sys.argv)>1 else "src/datos/fuentes/ARTICULOS-LINEAS-2026-08-18.xlsx"
wb = openpyxl.load_workbook(src, data_only=True)
faltan=[s for s in wb.sheetnames if s not in RUTA]
if faltan: sys.exit(f"Pestañas sin ruta mapeada: {faltan}")
filas=[]
for name in wb.sheetnames:
    ws=wb[name]; ruta=RUTA[name]
    for r in range(2, ws.max_row+1):
        clave=ws.cell(r,1).value
        if clave is None or str(clave).strip()=='': continue
        cc=ws.cell(r,2).value; desc=ws.cell(r,3).value; tipo=ws.cell(r,4).value
        p2=ws.cell(r,5).value; pl=ws.cell(r,6).value; pm=ws.cell(r,7).value
        try: p2=round(float(p2)); pl=round(float(pl)); pm=round(float(pm))
        except: continue
        row={'c':str(clave).strip(),'cc':str(cc).strip() if cc else '',
          'd':str(desc).strip() if desc else '','t':str(tipo).strip().capitalize() if tipo else '',
          'f':p2,'l':pl,'m':pm,'ln':name,'ruta':ruta}
        if row['c'] in CORRECCIONES: row.update(CORRECCIONES[row['c']])
        filas.append(row)
hdr = f'''// ============================================================================
//  PRECIOS DE LÍNEA — catálogo oficial de artículos por línea.
//  AUTOGENERADO desde src/datos/fuentes/ARTICULOS-LINEAS-2026-08-18.xlsx
//  (el Excel que mandó Rodrigo el 2026-08-18). NO editar a mano: si cambian los
//  precios, se regenera con scripts/genera-precios-linea.py.
//
//  Campos: c=clave ERP · cc=clave comercial · d=descripción · t=tipo ·
//          f=Precio 2 (FULL) · l=Precio Lista (con el que se cotiza) ·
//          m=Precio Mínimo (piso de descuento; 0 = sin piso capturado) ·
//          ln=nombre de pestaña · ruta=línea interna del costeador.
//  Las claves (c) son ÚNICAS en todo el catálogo: se puede indexar sin choque.
// ============================================================================
// {len(filas)} artículos en 15 líneas. Precio Lista es el que manda al cotizar.
export const PRECIOS_LINEA = ['''
body = '\n'.join('  '+json.dumps(f, ensure_ascii=False, separators=(',',':'))+',' for f in filas)
tail = '''];

// Índice por clave ERP (c) y por clave comercial (cc) para buscar en O(1).
const _porClave = new Map();
const _porComercial = new Map();
for (const a of PRECIOS_LINEA) {
  _porClave.set(a.c, a);
  if (a.cc && !_porComercial.has(a.cc)) _porComercial.set(a.cc, a);
}

/** Busca un artículo por su clave ERP o su clave comercial. Devuelve el
 *  registro { c, cc, d, t, f, l, m, ln, ruta } o null si no está. */
export function articuloPorClave(clave) {
  if (!clave) return null;
  const k = String(clave).trim();
  return _porClave.get(k) || _porComercial.get(k) || null;
}

/** Precio de cotización (Precio Lista) de una clave, o null si no coincide. */
export function precioListaDe(clave) {
  const a = articuloPorClave(clave);
  return a ? a.l : null;
}

/** Piso de descuento de una clave. Rodrigo (2026-08-18): un Precio Mínimo de 0
 *  significa \"no se descuenta\", así que el piso es la lista misma. */
export function pisoDe(clave) {
  const a = articuloPorClave(clave);
  if (!a) return null;
  return a.m > 0 ? a.m : a.l;
}
'''
open('src/datos/preciosLinea.js','w',encoding='utf-8').write(hdr+'\n'+body+'\n'+tail)
print(f"Regenerado: {len(filas)} artículos")
