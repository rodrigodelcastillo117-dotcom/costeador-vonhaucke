#!/usr/bin/env python3
# Paso A v3 — matcher corregido: empate EXACTO por (articulo, opcion) contra
# atributos->erp->articulo del catalogo. Fuente de precio real: mp_master_fresco
# (Costo Ultima Compra + Fecha Ultima Compra, con Opcion). Fechas reales -> frescura real.
import csv, json, collections, datetime, io, sys

# CAT_TXT = dump JSON de esta query (solo lectura) sobre el proyecto Supabase:
#   select cv.insumo_id, c.atributos->'erp'->>'articulo' as articulo,
#          coalesce(c.atributos->'erp'->>'opcion','') as opcion, c.unidad_costeo,
#          cv.precio_compra, cv.vigente_desde, cv.estado, cv.evidence_status,
#          cv.requiere_validacion_compras
#   from catalogo_vigente cv join insumos_catalogo c on c.id=cv.insumo_id
#   where c.atributos->'erp'->>'articulo' is not null order by articulo, opcion;
# (ajusta la ruta al archivo donde guardes el resultado)
CAT_TXT = "/root/.claude/projects/-home-user-costeador-vonhaucke/4ebe1775-de26-5cdd-8f53-1edeaa08f67a/tool-results/mcp-Supabase-execute_sql-1793935213065.txt"
MP = "/home/user/costeador-vonhaucke/lab/datos_reales_drive/mp_master_fresco/CostosMP_10082026__Hoja1.csv"
OUTDIR = "/home/user/costeador-vonhaucke/lab/datos_reales_drive"

def norm(s):
    return (s or "").strip().upper()

def parse_date(s):
    s = (s or "").strip()
    if not s:
        return None
    s = s.split(" ")[0].split("T")[0]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None

def to_float(s):
    try:
        v = float(str(s).replace(",", "").strip())
        return v
    except (ValueError, TypeError):
        return None

# ---- 1) catalogo (JSON del tool-result) ----
raw = open(CAT_TXT, encoding="utf-8").read()
start = raw.index("[", raw.index("<untrusted-data"))
end = raw.rindex("]")
esc = raw[start:end+1]
if '\\"' in esc:                       # comillas escapadas -> des-escapar
    esc = json.loads('"' + esc + '"')
cat_rows = json.loads(esc)
# index por (articulo, opcion)
cat = {}
dup_key = 0
for r in cat_rows:
    k = (norm(r["articulo"]), norm(r.get("opcion", "")))
    if k in cat:
        dup_key += 1
    cat[k] = r

# ---- 2) mp_master_fresco (precio real, opcion-aware) ----
mp = {}
mp_rows = 0
mp_con_costo = 0
with open(MP, encoding="utf-8", errors="replace") as f:
    rd = csv.DictReader(f)
    for row in rd:
        mp_rows += 1
        art = norm(row.get("Articulo"))
        op = norm(row.get("Opción") or row.get("Opcion"))
        costo = to_float(row.get("Costo Última Compra") or row.get("Costo Ultima Compra"))
        fecha = parse_date(row.get("Fecha Última Compra") or row.get("Fecha Ultima Compra"))
        if costo and costo > 0:
            mp_con_costo += 1
        k = (art, op)
        # si repetido, quedate con el de mayor fecha
        prev = mp.get(k)
        if prev is None or (fecha and prev[1] and fecha > prev[1]) or (fecha and not prev[1]):
            mp[k] = (costo, fecha, row.get("Descripcion", ""), norm(row.get("Clave Comercial")), (row.get("Unidad") or "").strip())

# ---- 3) join exacto + clasificacion ----
rows = []   # dicts por fila con delta
sin_match = 0
sin_base = 0   # catalogo sin precio_compra > 0
match_igual = 0  # delta < 5%
for k, c in cat.items():
    pc = to_float(c.get("precio_compra"))
    vdesde = parse_date(c.get("vigente_desde"))
    m = mp.get(k)
    if not m:
        sin_match += 1
        continue
    real, rfecha, rdesc, rclave, runidad = m
    if real is None or real <= 0:
        sin_match += 1
        continue
    if pc is None or pc <= 0:
        sin_base += 1
        continue
    delta = (real - pc) / pc * 100.0
    if abs(delta) < 5.0:
        match_igual += 1
        continue
    ratio = round(real / pc, 4)
    rows.append({
        "insumo_id": c["insumo_id"],
        "articulo": k[0],
        "opcion": k[1],
        "unidad_costeo": c.get("unidad_costeo"),
        "precio_catalogo": round(pc, 4),
        "fecha_catalogo": vdesde.isoformat() if vdesde else "",
        "precio_real": round(real, 4),
        "fecha_real": rfecha.isoformat() if rfecha else "",
        "delta_pct": round(delta, 1),
        "ratio": ratio,
        "mas_fresco": bool(rfecha and vdesde and rfecha > vdesde),
        "sin_fecha_cat": vdesde is None,
        "sin_fecha_real": rfecha is None,
        "descripcion": (rdesc or "")[:60],
        "clave": rclave,
    })

# ---- 4) deteccion de clusters de unidad (ratios idénticos compartidos) ----
by_ratio = collections.Counter(r["ratio"] for r in rows)
cluster_ratios = {rt for rt, n in by_ratio.items()
                  if n >= 3 and not (0.9 <= rt <= 1.1)}

# ---- 5) clasificacion por fila ----
def clasificar(r):
    d = abs(r["delta_pct"])
    if r["ratio"] in cluster_ratios:
        return "RECHAZO_UNIDAD_CLUSTER"
    if d >= 90.0:
        return "RECHAZO_UNIDAD_MAGNITUD"
    if not r["mas_fresco"]:
        return "HUMANO_NO_MAS_FRESCO"
    if d >= 60.0:
        return "HUMANO_MAGNITUD_ALTA"
    return "CARGAR"

for r in rows:
    r["bucket"] = clasificar(r)

buckets = collections.Counter(r["bucket"] for r in rows)
rows.sort(key=lambda r: (r["bucket"], -abs(r["delta_pct"])))

# ---- 6) salidas ----
cols = ["bucket","delta_pct","articulo","opcion","insumo_id","unidad_costeo",
        "precio_catalogo","fecha_catalogo","precio_real","fecha_real","ratio",
        "mas_fresco","clave","descripcion"]
with open(f"{OUTDIR}/DIFF_pasoA_v3_todos.csv","w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
    for r in rows: w.writerow({k:r[k] for k in cols})
with open(f"{OUTDIR}/DIFF_pasoA_v3_cargar.csv","w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
    for r in rows:
        if r["bucket"]=="CARGAR": w.writerow({k:r[k] for k in cols})

# ---- 7) resumen (lo unico que leo) ----
L = []
L.append("# PASO A v3 — matcher corregido (empate exacto articulo+opcion, fechas reales)")
L.append("")
L.append(f"Catálogo vigente con articulo ERP: {len(cat)} (claves duplicadas articulo+opcion: {dup_key})")
L.append(f"mp_master_fresco: {mp_rows} filas, {mp_con_costo} con costo>0, {len(mp)} claves únicas (articulo+opcion)")
L.append("")
L.append("## Cobertura del join exacto")
L.append(f"  catálogo SIN match en mp_master : {sin_match}")
L.append(f"  catálogo sin precio base (<=0)  : {sin_base}")
L.append(f"  match con |delta|<5% (sin cambio): {match_igual}")
L.append(f"  match con |delta|>=5% (cambios) : {len(rows)}")
L.append("")
L.append("## Clasificación de los cambios (>=5%)")
for b in ["CARGAR","HUMANO_NO_MAS_FRESCO","HUMANO_MAGNITUD_ALTA","RECHAZO_UNIDAD_CLUSTER","RECHAZO_UNIDAD_MAGNITUD"]:
    L.append(f"  {b:28s}: {buckets.get(b,0)}")
L.append("")
L.append("## Clústeres de unidad detectados (ratio idéntico >=3 artículos)")
if cluster_ratios:
    for rt in sorted(cluster_ratios):
        ids = [r["articulo"] for r in rows if r["ratio"]==rt]
        L.append(f"  ratio {rt} (≈1/{round(1/rt,2) if rt else 0}): {len(ids)} artículos -> {', '.join(ids[:12])}")
else:
    L.append("  (ninguno)")
L.append("")
L.append("## CARGAR — candidatos que pasan TODO (exacto + más fresco + 5–60%)")
cargar = [r for r in rows if r["bucket"]=="CARGAR"]
L.append(f"  total: {len(cargar)}")
for r in sorted(cargar, key=lambda r:-abs(r["delta_pct"]))[:40]:
    L.append(f"  {r['delta_pct']:+7.1f}%  {r['articulo']:16s} op='{r['opcion']}' "
             f"{r['precio_catalogo']}({r['fecha_catalogo']}) -> {r['precio_real']}({r['fecha_real']})  "
             f"u={r['unidad_costeo']}  {r['descripcion']}")
L.append("")
L.append("## HUMANO_MAGNITUD_ALTA (60–90%, revisar unidad/spec)")
for r in sorted([r for r in rows if r['bucket']=='HUMANO_MAGNITUD_ALTA'], key=lambda r:-abs(r['delta_pct']))[:30]:
    L.append(f"  {r['delta_pct']:+7.1f}%  {r['articulo']:16s} op='{r['opcion']}' "
             f"{r['precio_catalogo']} -> {r['precio_real']}  {r['descripcion']}")
L.append("")
L.append("## RECHAZO_UNIDAD_MAGNITUD (|delta|>=90%, no cluster)")
for r in sorted([r for r in rows if r['bucket']=='RECHAZO_UNIDAD_MAGNITUD'], key=lambda r:-abs(r['delta_pct']))[:30]:
    L.append(f"  {r['delta_pct']:+8.1f}%  {r['articulo']:16s} {r['precio_catalogo']} -> {r['precio_real']}  {r['descripcion']}")
# ============================================================================
# OVERLAY OC/ENTRADA — transacciones recientes (la fuente que SÍ puede ser más
# fresca que el catálogo). Solo artículos con UNA sola opción en el catálogo
# (sin ambigüedad de opción). Clave = articulo.
# ============================================================================
PVM = f"{OUTDIR}/precios_vigentes_master.csv"
# catalogo: articulo -> lista de keys (para detectar unicidad)
art_to_keys = collections.defaultdict(list)
for k in cat:
    art_to_keys[k[0]].append(k)

oc = {}  # articulo -> (costo, fecha, tipo, fuente, desc)
with open(PVM, encoding="utf-8", errors="replace") as f:
    for row in csv.DictReader(f):
        if row.get("tipo_fuente") not in ("orden_compra", "entrada_compra"):
            continue
        art = norm(row.get("articulo"))
        costo = to_float(row.get("costo_vigente"))
        fecha = parse_date(row.get("fecha"))
        if not costo or costo <= 0:
            continue
        prev = oc.get(art)
        if prev is None or (fecha and prev[1] and fecha > prev[1]) or (fecha and not prev[1]):
            oc[art] = (costo, fecha, row.get("tipo_fuente"), row.get("fuente", ""), (row.get("descripcion") or "")[:60])

oc_rows = []
oc_ambiguo = 0
oc_sin_cat = 0
for art, (costo, fecha, tipo, fuente, desc) in oc.items():
    keys = art_to_keys.get(art)
    if not keys:
        oc_sin_cat += 1
        continue
    if len(keys) != 1:
        oc_ambiguo += 1
        continue
    c = cat[keys[0]]
    pc = to_float(c.get("precio_compra"))
    vdesde = parse_date(c.get("vigente_desde"))
    if pc is None or pc <= 0:
        continue
    delta = (costo - pc) / pc * 100.0
    if abs(delta) < 5.0:
        continue
    mas_fresco = bool(fecha and vdesde and fecha > vdesde)
    d = abs(delta)
    if d >= 90.0:
        bucket = "RECHAZO_UNIDAD_MAGNITUD"
    elif not mas_fresco:
        bucket = "HUMANO_NO_MAS_FRESCO"
    elif d >= 60.0:
        bucket = "HUMANO_MAGNITUD_ALTA"
    else:
        bucket = "CARGAR_OC"
    oc_rows.append({
        "bucket": bucket, "insumo_id": c["insumo_id"], "articulo": art,
        "opcion": keys[0][1], "unidad_costeo": c.get("unidad_costeo"),
        "precio_catalogo": round(pc, 4), "fecha_catalogo": vdesde.isoformat() if vdesde else "",
        "precio_real": round(costo, 4), "fecha_real": fecha.isoformat() if fecha else "",
        "delta_pct": round(delta, 1), "tipo_fuente": tipo, "fuente": fuente,
        "mas_fresco": mas_fresco, "descripcion": desc,
    })

oc_buckets = collections.Counter(r["bucket"] for r in oc_rows)
oc_cols = ["bucket","delta_pct","articulo","opcion","insumo_id","unidad_costeo",
           "precio_catalogo","fecha_catalogo","precio_real","fecha_real",
           "tipo_fuente","fuente","mas_fresco","descripcion"]
oc_rows.sort(key=lambda r:(r["bucket"], -abs(r["delta_pct"])))
with open(f"{OUTDIR}/DIFF_pasoA_v3_oc.csv","w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=oc_cols); w.writeheader()
    for r in oc_rows: w.writerow({k:r[k] for k in oc_cols})

L.append("")
L.append("=" * 76)
L.append("## OVERLAY OC/ENTRADA (transacciones recientes, solo artículos de 1 opción)")
L.append(f"  OC/entrada con costo>0 (únicas por articulo): {len(oc)}")
L.append(f"  articulo no está en catálogo    : {oc_sin_cat}")
L.append(f"  articulo con >1 opción (ambiguo): {oc_ambiguo} -> NECESITA_HUMANO (no se puede asignar opción)")
L.append(f"  comparables (1 opción, |delta|>=5%): {len(oc_rows)}")
for b in ["CARGAR_OC","HUMANO_NO_MAS_FRESCO","HUMANO_MAGNITUD_ALTA","RECHAZO_UNIDAD_MAGNITUD"]:
    L.append(f"    {b:26s}: {oc_buckets.get(b,0)}")
L.append("")
L.append("### CARGAR_OC — OC/entrada más fresca que el catálogo, 5–60% (candidatos REALES)")
cargar_oc = [r for r in oc_rows if r["bucket"]=="CARGAR_OC"]
for r in sorted(cargar_oc, key=lambda r:-abs(r["delta_pct"])):
    L.append(f"  {r['delta_pct']:+7.1f}%  {r['articulo']:16s} "
             f"{r['precio_catalogo']}({r['fecha_catalogo']}) -> {r['precio_real']}({r['fecha_real']}) "
             f"[{r['tipo_fuente']}] u={r['unidad_costeo']}  {r['descripcion']}")
L.append("")
L.append("### HUMANO_MAGNITUD_ALTA OC (60–90%)")
for r in sorted([r for r in oc_rows if r['bucket']=='HUMANO_MAGNITUD_ALTA'], key=lambda r:-abs(r['delta_pct']))[:40]:
    L.append(f"  {r['delta_pct']:+7.1f}%  {r['articulo']:16s} {r['precio_catalogo']}({r['fecha_catalogo']}) -> "
             f"{r['precio_real']}({r['fecha_real']}) [{r['tipo_fuente']}]  {r['descripcion']}")

open(f"{OUTDIR}/DIFF_pasoA_v3_resumen.txt","w",encoding="utf-8").write("\n".join(L))
print("\n".join(L[L.index('='*76):]))  # imprime solo la sección overlay
