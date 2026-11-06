#!/usr/bin/env python3
# Importador de hojas de estimaciones Von Haucke → BOM de Producto Maestro.
# Lee T_d_C (material/MO/GIF/cos_fab) y Explo_MP (líneas del BOM, id_01=fabricado / id_02=compra-venta),
# mapea materiales al catálogo curado donde se puede, y emite el JSON para producto_maestro.
# Uso:  python3 importar_estimaciones.py <xlsx> <CLAVE> [nombre]
import sys, re, json
import openpyxl

def num(x): return isinstance(x,(int,float))

def parse(path, clave, nombre_cli=None):
    wb = openpyxl.load_workbook(path, data_only=True)
    # --- T_d_C: material/MO/GIF/cos_fab (3 sumandos + total) y nombre/dims ---
    # Puede haber VARIAS filas (material/MO/GIF/cos_fab): la formulaica por componente y la REAL del producto.
    # Elegimos: la que CONTIENE la clave; si ninguna, la de mayor cos_fab (el total del mueble).
    material=mo=gif=cosfab=None; nombre=nombre_cli or ''; dims=None
    candidatos=[]
    for ws in wb.worksheets:
        if 'T_d_C' not in ws.title and 't_d_c' not in ws.title.lower(): continue
        for row in ws.iter_rows(values_only=True):
            nums=[c for c in row if num(c)]
            txt=' '.join(str(x) for x in row if isinstance(x,str))
            for i in range(len(nums)-3):
                a,b,c,d = nums[i],nums[i+1],nums[i+2],nums[i+3]
                if all(x>20 for x in (a,b,c,d)) and abs((a+b+c)-d)/d < 0.02:
                    tieneClave = clave.upper() in txt.upper()
                    candidatos.append((tieneClave, d, a, txt)); break
    if candidatos:
        # prioridad: fila con la clave; si no, la de mayor cos_fab
        candidatos.sort(key=lambda t:(t[0], t[1]), reverse=True)
        _, cosfab, material, txt = candidatos[0]
        md=re.search(r'(\d{2,4})\s*[xX×]\s*(\d{2,4})\s*[xX×]\s*(\d{2,4})', txt)
        if md: dims=[int(md.group(1)),int(md.group(2)),int(md.group(3))]
        if not nombre:
            m2=re.search(r'([A-Za-zÁÉÍÓÚáéíóúñ][^0-9]{8,60})', txt)
            if m2: nombre=m2.group(1).strip()[:80]
    # --- Explo_MP: líneas de BOM, fab/cv por id_01/id_02 ---
    # El marcador "id_0X costo_total" CIERRA el bloque previo (sus líneas van arriba). Buffer + flush:
    # id_01 = fabricado, id_02+ = compra-venta (LED/gráficos/logo).
    lineas=[]
    for ws in wb.worksheets:
        if 'Explo' not in ws.title: continue
        buf=[]
        for row in ws.iter_rows(values_only=True):
            txt=' '.join(str(c) for c in row if c is not None)
            m=re.search(r'id_0(\d)\s+costo_total', txt)
            if m:
                es_cv = m.group(1) != '1'
                for L in buf: L['esCompraVenta']=es_cv
                lineas.extend(buf); buf=[]
                continue
            cand=[c for c in row if isinstance(c,str) and len(c)>10 and 'familia' not in c and 'componente' not in c and 'costo_total' not in c and 'mueble_' not in c]
            desc=max(cand, key=len) if cand else None   # la descripción larga, no el código ERP corto
            nums=[c for c in row if num(c)]
            if desc and len(nums)>=3:
                precio,cant,imp=nums[-3],nums[-2],nums[-1]
                if precio>0 and cant>0 and abs(precio*cant-imp)/max(imp,1)<0.05:
                    buf.append({'desc':re.sub(r'\s+',' ',desc)[:70].strip(),'cantidad':round(cant,4),'precioConfirmado':round(precio,2),'esCompraVenta':False,'insumoId':mapId(desc)})
        # líneas sin marcador de cierre (raro): fabricado
        lineas.extend(buf)
        break
    return {'clave':clave,'nombre':nombre,'dims_mm':dims,'fuente':f'estimaciones import {path.split("/")[-1]}','cos_fab_real':round(cosfab,2) if cosfab else None,
            '_material_real':round(material,2) if material else None,'lineas':lineas}

def mapId(d):
    t=d.upper()
    rules=[('PERFIL DE CANTO','tapacanto'),('PEABS','tapacanto'),
           ('LAMINA NEGRA',None),  # se afina por calibre abajo
           ('PINTURA EN POLVO','pintura-polvo-negro'),('ACRILICO CRISTAL','acrilico-cristal-3'),('ACRILICO TRASLUCIDO','acrilico-traslucido-3'),
           ('TORNILLO NIVELADOR','nivelador-plataforma'),('KIT DE ILUMINACION','kit-led-5000k'),('TIRAS LED','kit-led-5000k'),
           ('LOGOTIPO','logo-acrilico-iluminado'),('BISAGRA','bisagra')]
    if 'LAMINA NEGRA' in t:
        for cal,iid in [('CALIBRE 20','lamina-20'),('CALIBRE 18','lamina-18'),('CALIBRE 14','lamina-14'),('CALIBRE 12','lamina-12')]:
            if cal in t: return iid
        return None
    if 'IMPRESION EN ESTIRENO' in t: return 'impresion-estireno-g' if '1640' in t else 'impresion-estireno-ch'
    for k,iid in rules:
        if k in t and iid: return iid
    return None

if __name__=='__main__':
    if len(sys.argv)<3: print('uso: importar_estimaciones.py <xlsx> <CLAVE> [nombre]'); sys.exit(1)
    path,clave=sys.argv[1],sys.argv[2]; nom=sys.argv[3] if len(sys.argv)>3 else None
    bom=parse(path,clave,nom)
    fab=sum(L['precioConfirmado']*L['cantidad'] for L in bom['lineas'] if not L['esCompraVenta'])
    cv=sum(L['precioConfirmado']*L['cantidad'] for L in bom['lineas'] if L['esCompraVenta'])
    mapped=sum(1 for L in bom['lineas'] if L['insumoId'])
    print(f"clave={bom['clave']} nombre={bom['nombre']!r} dims={bom['dims_mm']}",file=sys.stderr)
    print(f"líneas={len(bom['lineas'])} mapeadas={mapped} | fab={fab:.2f} cv={cv:.2f} material={fab+cv:.2f} (real {bom.get('_material_real')}) | cos_fab_real={bom['cos_fab_real']}",file=sys.stderr)
    bom.pop('_material_real',None)
    print(json.dumps(bom,ensure_ascii=False))
