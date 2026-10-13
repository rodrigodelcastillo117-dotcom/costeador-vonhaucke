import json,glob,os
D={}
for f in glob.glob('/home/user/costeador-vonhaucke/lab/applt/componentes/*.json'):
    d=json.load(open(f)); 
    mat=sum(m['importe_derivado'] for m in d['materiales'])
    h={k:(d['horas'].get(k) or 0) for k in ['pm','pintura','acabados','carpinteria']}
    D[d['clave']]=dict(mat=mat,h=h,desc=d['descripcion'][:60],cr=d['costos_reporte'])
MO={'pm':92.38,'carpinteria':82.61,'acabados':74.99,'pintura':371.30}; IND=82.374303
fab=lambda mat,h: mat+sum(h[a]*MO[a] for a in MO)+sum(h.values())*IND
for k,v in sorted(D.items()): print(k, round(v['mat'],2), v['h'], round(fab(v['mat'],v['h']),2), v['desc'])
def interp(a,b,xa,xb,x):
    A,B=D[a],D[b]; t=(x-xa)/(xb-xa)
    mat=A['mat']+(B['mat']-A['mat'])*t
    h={k:A['h'][k]+(B['h'][k]-A['h'][k])*t for k in MO}
    return mat,h
print('\n--- PRUEBA CIEGA (tapar la pieza y estimarla con sus hermanas) ---')
casos=[('ATPU75M','ATPU2M','ATPU3M',600,900,750),
       ('ATCUBD45ABS','ATCUBD44ABS','ATCUBD46ABS',1200,1800,1500),
       ('ATCUBS45ABS','ATCUBS44ABS','ATCUBS46ABS',1200,1800,1500)]
for real,a,b,xa,xb,x in casos:
    mat,h=interp(a,b,xa,xb,x); R=D[real]
    e=lambda p,r:(p-r)/r*100 if r else float('nan')
    print(f"{real}: MP est {mat:.2f} vs real {R['mat']:.2f} ({e(mat,R['mat']):+.1f}%) | fab est {fab(mat,h):.2f} vs real {fab(R['mat'],R['h']):.2f} ({e(fab(mat,h),fab(R['mat'],R['h'])):+.1f}%) | pm {h['pm']:.4f}/{R['h']['pm']} carp {h['carpinteria']:.4f}/{R['h']['carpinteria']}")
# extrapolación: ATOM4 desde ATOM3 con elasticidad de patas
eP_mat=(D['ATPU3M']['mat']/D['ATPU2M']['mat']-1)/(900/600-1)
eP_pm=(D['ATPU3M']['h']['pm']/D['ATPU2M']['h']['pm']-1)/(900/600-1)
print('elasticidades patas: mat',round(eP_mat,3),'pm',round(eP_pm,3))
r=1150/850-1
A=D['ATOM3']; mat=A['mat']*(1+r*1.0); h={k:A['h'][k]*(1+r*eP_pm) for k in MO}
R=D['ATOM4']
print(f"ATOM4 desde ATOM3 (material ∝ largo, horas con elasticidad de patas): MP {mat:.2f} vs {R['mat']:.2f} ({(mat/R['mat']-1)*100:+.1f}%) fab {fab(mat,h):.2f} vs {fab(R['mat'],R['h']):.2f} ({(fab(mat,h)/fab(R['mat'],R['h'])-1)*100:+.1f}%)")
A=D['ATFAL12ABS']; R=D['ATFAL150ABS']; r=900/800-1
mat=A['mat']*(1+r); h={k:A['h'][k]*(1+r*eP_pm) for k in MO}
print(f"ATFAL150 desde ATFAL12: MP {mat:.2f} vs {R['mat']:.2f} ({(mat/R['mat']-1)*100:+.1f}%) fab {fab(mat,h):.2f} vs {fab(R['mat'],R['h']):.2f} ({(fab(mat,h)/fab(R['mat'],R['h'])-1)*100:+.1f}%)  carp {h['carpinteria']:.3f} vs {R['h']['carpinteria']}")
print('\n--- extrapolación lineal (prueba ciega) ---')
for real,a,b,xa,xb,x in [('ATPU3M','ATPU2M','ATPU75M',600,750,900),('ATPU2M','ATPU75M','ATPU3M',750,900,600)]:
    mat,h=interp(a,b,xa,xb,x); R=D[real]
    print(f"{real}: MP {mat:.2f} vs {R['mat']:.2f} ({(mat/R['mat']-1)*100:+.1f}%) fab {fab(mat,h):.2f} vs {fab(R['mat'],R['h']):.2f} ({(fab(mat,h)/fab(R['mat'],R['h'])-1)*100:+.1f}%)")
mat,h=interp('ATOM3','ATOM4',850,1150,1450)
print('ATOM5 (1450 inferido):', round(mat,2), {k:round(v,4) for k,v in h.items()}, round(fab(mat,h),2))
