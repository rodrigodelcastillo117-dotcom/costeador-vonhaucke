# Extractor de presupuestos VH por COORDENADAS (impecable, con checksum).
# Uso: python3 presup_extract.py "<ruta pdf>"   → imprime módulos + Σ mobiliario.
# Método: fitz words + columnas ancladas al encabezado (P.Unitario/Cantidad/Subtotal
# y rollup CANT.REQUERIDA/P.U MODULO). Anidamiento: total = Σ(comp_pu×comp_cant)×cantReq.
# Sillería (SILLA/SILLON/BANCO/PUFF/SOFA) se separa (va a banco, no a calibración de línea).
# VALIDAR SIEMPRE: Σ mobiliario == "Importe Proyecto: Mobiliario" (pág 1) al centavo.
import fitz, re, sys
from collections import defaultdict
def money(s):
    s=s.replace(',',''); return float(s) if re.match(r'^\d+\.\d{2}$',s) else None
SILL=re.compile(r'\b(SILLA|SILLON|BANCO|PUFF|SOFA|BANQUETA|SILLERIA)\b')
def extract(path):
    doc=fitz.open(path); groups=[]; cur=[]; col={}
    for pg in doc:
        rows=defaultdict(list)
        for w in pg.get_text("words"): rows[round(w[1]/2)*2].append(w)
        ys=sorted(rows)
        for y in ys:
            ws=rows[y]; wl=[w[4] for w in ws]
            if 'Unitario' in wl and 'Subtotal' in wl:
                col['pu']=next(w[0] for w in ws if w[4]=='Unitario'); col['cant']=next((w[0] for w in ws if w[4]=='Cantidad'),col.get('cant'))
            if 'REQUERIDA' in wl and 'MODULO' in wl:
                col['pumod']=next(w[0] for w in ws if w[4]=='MODULO'); col['cantreq']=next(w[0] for w in ws if w[4]=='REQUERIDA')
        if 'pu' not in col: continue
        near=lambda x,c,tol=46: c is not None and abs(x-c)<=tol
        for y in ys:
            ws=sorted(rows[y],key=lambda w:w[0])
            pumod=next((money(w[4]) for w in ws if col.get('pumod') and near(w[0],col['pumod'],40) and money(w[4])),None)
            puc=next((money(w[4]) for w in ws if near(w[0],col['pu']) and not (col.get('pumod') and near(w[0],col['pumod'],40)) and money(w[4])),None)
            lab=' '.join(w[4] for w in ws if w[0]<col['pu']-70 and not re.match(r'^[\d,]+\.\d{2}$',w[4]) and not re.match(r'^\d+%?$',w[4])).strip()
            if puc is not None:
                cant=next((int(w[4]) for w in ws if near(w[0],col.get('cant'),42) and re.match(r'^\d+$',w[4])),1)
                cur.append({'label':lab,'pu':puc,'cant':cant,'pg':pg.number+1})
            elif pumod is not None and cur:
                cantReq=next((int(w[4]) for w in ws if near(w[0],col.get('cantreq'),42) and re.match(r'^\d+$',w[4])),1)
                groups.append({'comps':cur,'cantReq':cantReq}); cur=[]
    if cur: groups.append({'comps':cur,'cantReq':1})
    return groups
def target_mob(path):
    t=fitz.open(path)[0].get_text(); m=re.search(r'Mobiliario\s*[\n:]*\s*\$?\s*([\d,]+\.\d{2})',t); return money(m.group(1)) if m else None
if __name__=='__main__':
    p=sys.argv[1]; g=extract(p); tgt=target_mob(p)
    mob=sum(c['pu']*c['cant']*gr['cantReq'] for gr in g for c in gr['comps'] if not SILL.search(c['label']))
    for gr in g:
        print("MÓDULO x%d:"%gr['cantReq'])
        for c in gr['comps']: print("   p%-2d %-40s %11.2f x%d"%(c['pg'],c['label'][:40],c['pu'],c['cant']))
    print("Σ mobiliario lista = {:,.2f}  target {}  {}".format(mob, ("{:,.2f}".format(tgt) if tgt else "?"), "CUADRA ✓" if (tgt and abs(mob-tgt)<2) else "revisar"))
