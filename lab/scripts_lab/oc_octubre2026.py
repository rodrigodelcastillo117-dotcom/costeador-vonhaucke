#!/usr/bin/env python3
# Extrae las OC de octubre 2026 y las cruza (empate exacto articulo+opcion) contra
# el catálogo vivo (dump en disco). Solo lectura + cómputo; NO toca prod.
import sys, json, csv, datetime, collections, openpyxl

XLSX = sys.argv[1]
CATDUMP = "/root/.claude/projects/-home-user-costeador-vonhaucke/4ebe1775-de26-5cdd-8f53-1edeaa08f67a/tool-results/mcp-Supabase-execute_sql-1793935213065.txt"
OUT = "/home/user/costeador-vonhaucke/lab/datos_reales_drive/ordenes_compra"
import os; os.makedirs(OUT, exist_ok=True)

def norm(s): return (str(s).strip().upper() if s is not None else "")
def fnum(s):
    try: return float(str(s).replace(",", "").strip())
    except: return None
def fdate(s):
    if isinstance(s, datetime.datetime): return s.date()
    if isinstance(s, datetime.date): return s
    t = str(s).split(" ")[0].split("T")[0]
    for f in ("%Y-%m-%d","%d/%m/%Y","%m/%d/%Y"):
        try: return datetime.datetime.strptime(t, f).date()
        except: pass
    return None

# --- 1) extraer OC oct 2026 ---
wb = openpyxl.load_workbook(XLSX, data_only=True, read_only=True)
ws = wb["Hoja1"]
rows = list(ws.iter_rows(values_only=True))
hdr = [norm(c) for c in rows[0]]
col = {h: i for i, h in enumerate(hdr)}
def g(r, name):
    i = col.get(name); return r[i] if i is not None and i < len(r) else None
oc = []
for r in rows[1:]:
    art = norm(g(r, "ARTICULO"))
    if not art or not art[0].isalpha(): continue
    costo = fnum(g(r, "COSTO UNITARIO")); fecha = fdate(g(r, "FECHA EMISIÓN") or g(r, "FECHA EMISION"))
    if costo is None or costo <= 0: continue
    oc.append({
        "movimiento": str(g(r,"MOVIMIENTO") or "").strip(),
        "proveedor": str(g(r,"NOMBRE") or "").strip()[:40],
        "fecha": fecha.isoformat() if fecha else "",
        "articulo": art, "opcion": norm(g(r,"OPCIÓN") or g(r,"OPCION")),
        "descripcion": str(g(r,"DESCRIPCIÓN") or g(r,"DESCRIPCION") or "")[:60],
        "cantidad": fnum(g(r,"CANTIDAD")), "unidad": str(g(r,"UNIDAD") or "").strip(),
        "costo_unitario": costo,
    })
# CSV crudo
with open(f"{OUT}/OC_octubre_2026.csv","w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["movimiento","proveedor","fecha","articulo","opcion","descripcion","cantidad","unidad","costo_unitario"])
    w.writeheader(); w.writerows(oc)

# dedup por (articulo,opcion): quedarse con la fecha más reciente
best = {}
for o in oc:
    k = (o["articulo"], o["opcion"])
    pv = best.get(k)
    if pv is None or (o["fecha"] and o["fecha"] > pv["fecha"]):
        best[k] = o

# --- 2) catálogo vivo (dump) ---
raw = open(CATDUMP, encoding="utf-8").read()
s = raw.index("[", raw.index("<untrusted-data")); e = raw.rindex("]")
esc = raw[s:e+1]
if '\\"' in esc: esc = json.loads('"' + esc + '"')
cat = {}
for c in json.loads(esc):
    cat[(norm(c["articulo"]), norm(c.get("opcion","")))] = c

# --- 3) cruce exacto ---
diff = []
sin_cat = 0
for k, o in best.items():
    c = cat.get(k)
    if not c:
        sin_cat += 1; continue
    pc = fnum(c.get("precio_compra")); vdesde = fdate(c.get("vigente_desde"))
    if pc is None or pc <= 0:  # catálogo sin base
        diff.append({**o, "precio_catalogo":"", "fecha_catalogo":"", "delta_pct":"", "bucket":"CATALOGO_SIN_BASE", "insumo_id":c["insumo_id"]})
        continue
    delta = (o["costo_unitario"] - pc)/pc*100
    ofecha = fdate(o["fecha"])
    mas_fresco = bool(ofecha and vdesde and ofecha > vdesde)
    d = abs(delta)
    if d < 5: bucket = "IGUAL(<5%)"
    elif d >= 90: bucket = "RECHAZO_UNIDAD(>=90%)"
    elif not mas_fresco: bucket = "HUMANO_NO_MAS_FRESCO"
    elif d >= 60: bucket = "HUMANO_MAGNITUD_ALTA"
    else: bucket = "CARGAR_OC_OCT"
    diff.append({**o, "precio_catalogo":round(pc,4), "fecha_catalogo":vdesde.isoformat() if vdesde else "",
                 "delta_pct":round(delta,1), "bucket":bucket, "insumo_id":c["insumo_id"]})

cols = ["bucket","delta_pct","articulo","opcion","insumo_id","unidad","precio_catalogo","fecha_catalogo","costo_unitario","fecha","proveedor","movimiento","descripcion"]
with open(f"{OUT}/DIFF_OC_octubre2026.csv","w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    for r in sorted(diff, key=lambda r:(str(r["bucket"]), -abs(r["delta_pct"]) if isinstance(r["delta_pct"],(int,float)) else 0)):
        w.writerow(r)

# --- 4) migración B real: los CARGAR_OC_OCT como PRELIMINAR (NO ejecutar) ---
cargar = [r for r in diff if r["bucket"] == "CARGAR_OC_OCT"]
precios = []
for r in cargar:
    rec = f'{r["articulo"]}|{r["opcion"]}'
    precios.append({
        "source_record_id": rec, "insumo_id": r["insumo_id"],
        "source_price": r["costo_unitario"], "source_unit": r["unidad"] or "pieza",
        "cost_unit": r["unidad"] or "pieza", "vigente_desde": r["fecha"],
        "estado": "propuesto_validado",
        "evidencia": f'OC octubre 2026 · {r["movimiento"]} · {r["proveedor"]} · cat {r["precio_catalogo"]}({r["fecha_catalogo"]}) -> {r["costo_unitario"]} ({r["delta_pct"]:+}%)',
    })
sql = []
sql.append("-- ============================================================================")
sql.append("-- MIGRACIÓN B (real) — precios frescos de las OC de OCTUBRE 2026 → catálogo")
sql.append("-- PREPARADA PARA REVISIÓN. **NO EJECUTADA.** Prod requiere tu 'dale' explícito.")
sql.append(f"-- {len(precios)} precios como PRELIMINAR (estado='propuesto_validado' → NO certifica;")
sql.append("-- costea pero bloquea emisión en firme hasta que un humano corra aprobar_precio).")
sql.append("-- Empate EXACTO articulo+opción, fuente = Orden de Compra real, más fresca que el")
sql.append("-- catálogo, magnitud 5–60%. Idempotente. Fuente: lab/.../DIFF_OC_octubre2026.csv")
sql.append("-- ============================================================================")
sql.append("begin;")
sql.append("select public.cargar_erp_ultima_compra(")
sql.append("  'ERP Intelisis · Órdenes de Compra octubre 2026 (migración B PRELIMINAR)',")
sql.append("  '[]'::jsonb,")
sql.append("  $precios$" + json.dumps(precios, ensure_ascii=False, indent=1) + "$precios$::jsonb")
sql.append(") as resultado;")
sql.append("-- Revisa resultado: precios_nuevos=%d, duplicados=0, errores=[]. Re-corrida: idempotente." % len(precios))
sql.append("rollback;  -- cambiar por 'commit;' SÓLO con autorización explícita de Dirección.")
open(f"{OUT}/MIGRACION_B_OC_octubre2026.sql","w",encoding="utf-8").write("\n".join(sql))

b = collections.Counter(r["bucket"] for r in diff)
print(f"OC oct-2026: {len(oc)} renglones, {len(best)} claves únicas (articulo+opcion)")
print(f"  no están en catálogo (prob. muebles/equipo compra-venta): {sin_cat}")
print(f"  empatan en catálogo: {len(diff)}")
for k in ["CARGAR_OC_OCT","HUMANO_MAGNITUD_ALTA","HUMANO_NO_MAS_FRESCO","RECHAZO_UNIDAD(>=90%)","CATALOGO_SIN_BASE","IGUAL(<5%)"]:
    print(f"    {k:26s}: {b.get(k,0)}")
print("\n### CARGAR_OC_OCT (fresco + 5–60%, empate exacto) — candidatos REALES de octubre:")
for r in sorted([r for r in diff if r["bucket"]=="CARGAR_OC_OCT"], key=lambda r:-abs(r["delta_pct"])):
    print(f"  {r['delta_pct']:+7.1f}%  {r['articulo']:16s} op='{r['opcion']}' {r['precio_catalogo']}({r['fecha_catalogo']}) -> {r['costo_unitario']}({r['fecha']})  {r['descripcion']}")
print("\n### CATALOGO_SIN_BASE (insumo existe, catálogo sin precio -> OC lo llenaría):")
for r in [r for r in diff if r["bucket"]=="CATALOGO_SIN_BASE"][:20]:
    print(f"  {r['articulo']:16s} op='{r['opcion']}' -> {r['costo_unitario']}({r['fecha']})  {r['descripcion']}")
