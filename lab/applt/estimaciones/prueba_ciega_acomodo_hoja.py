import json,math
L=lambda k: json.load(open(f'/home/user/costeador-vonhaucke/lab/applt/componentes/{k}.json'))
HOJA=(2440,1220)
def por_hoja(a,b):
    f=lambda x,y: (HOJA[0]//x)*(HOJA[1]//y)
    return max(f(a,b),f(b,a))
def partes(d):
    tab=[m for m in d['materiales'] if 'AGLOMERADO' in m['descripcion']]
    canto=[m for m in d['materiales'] if 'PERFIL DE CANTO' in m['descripcion'] or 'CHAPACINTA' in m['descripcion']]
    resto=[m for m in d['materiales'] if m not in tab and m not in canto]
    s=lambda xs: sum(m['importe_derivado'] for m in xs)
    return s(tab),s(canto),s(resto),sum(m['cantidad'] for m in tab)
med={'ATCUBD44ABS':(1200,1200),'ATCUBD45ABS':(1500,1200),'ATCUBD46ABS':(1800,1200),'ATCUBS44ABS':(1200,600),'ATCUBS45ABS':(1500,600),'ATCUBS46ABS':(1800,600)}
for fam,base in [('D','ATCUBD44ABS'),('S','ATCUBS44ABS')]:
    b=L(base); tb,cb,rb,hb=partes(b); a0,b0=med[base]; per0=2*(a0+b0)
    precio_hoja=tb/hb
    print(f'base {base}: tablero {hb} hoja (ERP) vs acomodo 1/{por_hoja(a0,b0)}; canto {cb:.2f}; resto {rb:.2f}')
    for k,(x,y) in med.items():
        if not k.startswith('ATCUB'+fam) or k==base: continue
        R=L(k); tr,cr,rr,hr=partes(R)
        h=1/por_hoja(x,y); est=h*precio_hoja + cb*(2*(x+y))/per0 + rb*(x*y)/(a0*b0)
        real=tr+cr+rr
        print(f'  {k}: hojas acomodo {h:.3f} (ERP {hr}) | MP estimada {est:.2f} vs real {real:.2f} ({(est/real-1)*100:+.1f}%)')
