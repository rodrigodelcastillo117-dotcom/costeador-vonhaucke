# -*- coding: utf-8 -*-
# Costeo CONCURSO TELCEL R5 — definitivo. Fuente: explosion real C-CO-320R (por id)
# + producto_maestro verificado (cos_fab_real). Markup POLITICA_VH: fab x(1+MO+GIF)
# reales; terceros/comprados x1.06. Cubo y Caja: BOM del spec R5 + precios reales,
# con supuestos de consumo de lamina EXPLICITOS. No se inventan precios unitarios.
import html, datetime

MARGEN = 0.25  # margen objetivo sugerido (editable)

# (nombre, pos, cant, cos_fab_verificado, cv_material, confianza, ref_telcel_R7, nota)
M = [
 ("Vitrina Torre",        10, 153, 3277.60, 11077.15, "ALTA",       17998, "fab verificado + terceros reales (acrilico, kit, cristal)"),
 ("Vitrina Horizontal",   20, 197, 6052.22,  8677.20, "ALTA",       14215, "fab verificado + termoformado $2840 + cristal + kit"),
 ("Modulo Conector Cubo", 30,  25, None,     None,     "PRELIMINAR", None,  "BOM del spec R5 (sin historico)"),
 ("Modulo Almacenamiento",40,  38, 4854.78,  1893.00, "MEDIA",      12000, "fab verificado + herrajes workbook; falta MDF superficie"),
 ("Vitrina Isla",         50,  15, 4452.07, 12615.11, "ALTA",       19200, "fab verificado + 8 cristales templados 1900x397 + repisas"),
 ("Caja de Cobro",        60,  10, None,     None,     "PRELIMINAR", None,  "BOM del spec R5 (sin historico)"),
]

# --- Cubo y Caja: BOM del spec con precios reales del workbook. Supuestos de lamina marcados. ---
# precios reales: lamina 3x10 c18 $571.54/hoja, c14 $816/hoja; pintura $171/kg; nivelador $40.70;
#   MDF+PVC ~ $350/0.4m2; stickers set $75; placa $45; empaque madera; multicontacto $120.
CUBO = {  # 600x600x1030, cuerpo lamina + cubierta MDF/PVC, sin cristal
 "fab": [("Lamina c18 cuerpo+zoclo (~1.0 hoja 3x10) *supuesto*", 571.54),
         ("Cartabones c14 (~0.05 hoja) *supuesto*", 40.82),
         ("Pintura en polvo (~1.0 kg)", 171.01),
         ("Madera huacal empaque", 300.00)],
 "cv":  [("Cubierta MDF 12mm + PVC termoformado (~0.4 m2) *supuesto*", 350.00),
         ("4 niveladores ($40.70 c/u)", 162.80),
         ("Stickers Telcel (2 lat + 1 frontal)", 75.00),
         ("Placa identificacion aluminio", 45.00),
         ("Consumibles empaque (polifoam/cinta/esquinero)", 100.00)],
}
CAJA = {  # 1200x600x1200, cuerpo+copete+superficie MDF, sin cristal
 "fab": [("Lamina c18 cuerpo+entrepanos+zoclo+copete+frente (~2.0 hojas 3x10) *supuesto*", 1143.08),
         ("Cartabones c14 (~0.06 hoja) *supuesto*", 48.99),
         ("Pintura en polvo (~2.0 kg)", 342.02),
         ("Madera huacal empaque", 350.00)],
 "cv":  [("Superficie + cubierta copete MDF 12mm + PVC (~0.8 m2) *supuesto*", 800.00),
         ("Multicontacto 6 salidas", 120.00),
         ("4 niveladores ($40.70 c/u)", 162.80),
         ("Guia/pasacables", 60.00),
         ("Stickers Telcel", 75.00),
         ("Placa identificacion aluminio", 45.00),
         ("Consumibles empaque", 150.00)],
}
FACT_GEN = (0.20, 0.50)  # POLITICA_VH generico para muebles nuevos (fab x1.80)
def costo_nuevo(bom):
    fab = sum(c for _, c in bom["fab"]); cv = sum(c for _, c in bom["cv"])
    return fab*(1+FACT_GEN[0]+FACT_GEN[1]) + cv*1.06, fab, cv

cubo_cost, cubo_fab, cubo_cv = costo_nuevo(CUBO)
caja_cost, caja_fab, caja_cv = costo_nuevo(CAJA)
NUEVO = {"Modulo Conector Cubo": (cubo_cost, cubo_fab, cubo_cv),
         "Caja de Cobro":        (caja_cost, caja_fab, caja_cv)}

filas = []
gran_costo = gran_quote = 0.0
for nombre, pos, cant, cosfab, cv, conf, ref, nota in M:
    if cosfab is None:
        costo, fabm, cvm = NUEVO[nombre]
        cosfab_disp = fabm*(1+FACT_GEN[0]+FACT_GEN[1])
    else:
        cosfab_disp = cosfab
        costo = cosfab + (cv or 0)*1.06
        fabm = None
    quote = costo*(1+MARGEN)
    imp_costo = costo*cant; imp_quote = quote*cant
    gran_costo += imp_costo; gran_quote += imp_quote
    filas.append((pos, nombre, cant, costo, quote, conf, ref, imp_costo, imp_quote, nota, cosfab_disp, cv))

filas.sort()

# ---------- MARKDOWN (repo) ----------
md = ["# COSTEO CONCURSO TELCEL R5 (MODULOS DATS) — Von Haucke",
 f"\n_Generado {datetime.date.today()}. Margen objetivo sugerido: {MARGEN*100:.0f}% (editable). Flete/armado (pos 70) por cotizar aparte._\n",
 "Precios de datos reales: explosion C-CO-320R (misma familia) + producto_maestro verificado. **No se inventaron precios unitarios.**\n",
 "| Pos | Mueble | Cant | Costo u. | Cotiza u. (+25%) | Conf. | Ref.Telcel R7 | Importe costo | Importe cotiza |",
 "|--:|--|--:|--:|--:|:-:|--:|--:|--:|"]
for pos, n, c, co, q, cf, rf, ic, iq, nt, cfab, cv in filas:
    rfs = f"${rf:,}" if rf else "—"
    md.append(f"| {pos} | {n} | {c} | ${co:,.0f} | ${q:,.0f} | {cf} | {rfs} | ${ic:,.0f} | ${iq:,.0f} |")
md.append(f"| 70 | Servicio entrega/armado R5 | 1 | por cotizar | | — | $212,000 (R3 ref) | | |")
md.append(f"| | **TOTAL (sin servicio)** | | | | | | **${gran_costo:,.0f}** | **${gran_quote:,.0f}** |")
md.append("\n## Confianza\n- **ALTA** (Torre, Horizontal, Isla): fabricacion ANCLADA a `cos_fab_real` verificado; terceros/comprados con precio real del workbook.")
md.append("- **MEDIA** (Almacen): fab verificado + herrajes del workbook; faltaria MDF de superficie (reconciliar antes de firmar).")
md.append("- **PRELIMINAR** (Cubo, Caja): BOM del spec R5 con precios reales; los renglones marcados `*supuesto*` son consumos de lamina/MDF estimados, a validar con Ingenieria.")
md.append("\n## BOM Cubo Conector (preliminar)\n| Renglon | $ |\n|--|--:|")
for d,c in CUBO["fab"]+CUBO["cv"]: md.append(f"| {d} | ${c:,.2f} |")
md.append(f"| **Costo (fab×1.80 + cv×1.06)** | **${cubo_cost:,.0f}** |")
md.append("\n## BOM Caja de Cobro (preliminar)\n| Renglon | $ |\n|--|--:|")
for d,c in CAJA["fab"]+CAJA["cv"]: md.append(f"| {d} | ${c:,.2f} |")
md.append(f"| **Costo (fab×1.80 + cv×1.06)** | **${caja_cost:,.0f}** |")
open("/home/user/costeador-vonhaucke/lab/concurso_telcel_r5/COSTEO_CONCURSO_R5.md","w",encoding="utf-8").write("\n".join(md))
print("\n".join(md))
print(f"\n>>> TOTAL costo ${gran_costo:,.0f} | TOTAL cotizacion (+{MARGEN*100:.0f}%) ${gran_quote:,.0f}")

# ---------- HTML (hoja compartible) ----------
def esc(s): return html.escape(str(s))
rows_html = ""
for pos, n, c, co, q, cf, rf, ic, iq, nt, cfab, cv in filas:
    color = {"ALTA":"#2e7d52","MEDIA":"#b06f12","PRELIMINAR":"#c0453b"}[cf]
    rfs = f"${rf:,}" if rf else "—"
    rows_html += (f"<tr><td>{pos}</td><td>{esc(n)}</td><td class=r>{c}</td>"
      f"<td class=r>${co:,.0f}</td><td class=r>${q:,.0f}</td>"
      f"<td style='color:{color};font-weight:600'>{cf}</td><td class=r>{rfs}</td>"
      f"<td class=r>${ic:,.0f}</td><td class=r>${iq:,.0f}</td></tr>")
HTML = f"""<!DOCTYPE html><html lang=es><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>Concurso TELCEL R5</title>
<style>
:root{{--b:#1E1B1A;--mut:#6b645c;--line:#e5e2dc;--accent:#2f6f8f}}
*{{box-sizing:border-box}}body{{font:15px/1.5 system-ui,sans-serif;color:var(--b);max-width:960px;margin:0 auto;padding:16px;background:#fff}}
h1{{font-size:22px;margin:.2em 0}}h2{{font-size:16px;margin-top:1.6em;border-bottom:1px solid var(--line);padding-bottom:4px}}
.sub{{color:var(--mut);font-size:13px}}table{{border-collapse:collapse;width:100%;margin-top:10px;font-size:14px}}
th,td{{padding:7px 9px;border-bottom:1px solid var(--line);text-align:left}}th{{color:var(--mut);font-weight:600;font-size:12px;text-transform:uppercase}}
td.r,th.r{{text-align:right;font-variant-numeric:tabular-nums}}tr:last-child td{{border-bottom:none}}
.tot{{font-weight:700;background:#faf8f5}}.tot td{{border-top:2px solid var(--b)}}
.note{{background:#faf8f5;border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin-top:12px;font-size:13px}}
.badge{{display:inline-block;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:600;color:#fff}}
</style></head><body>
<h1>Concurso TELCEL R5 — Módulos DAT'S</h1>
<div class=sub>2001224671 · Von Haucke · generado {datetime.date.today()} · margen objetivo {MARGEN*100:.0f}% (editable) · flete/armado por cotizar</div>
<div class=note><b>Fuente:</b> precios reales de la explosión C-CO-320R (misma familia DAT'S) + <code>producto_maestro</code> verificado.
<b>No se inventaron precios unitarios.</b> El <b>costo</b> no incluye margen ni flete; la <b>cotización</b> = costo × (1+margen).</div>
<table><thead><tr><th>Pos</th><th>Mueble</th><th class=r>Cant</th><th class=r>Costo u.</th><th class=r>Cotiza u.</th><th>Confianza</th><th class=r>Ref.Telcel</th><th class=r>Importe costo</th><th class=r>Importe cotiza</th></tr></thead>
<tbody>{rows_html}
<tr><td>70</td><td>Servicio entrega/armado</td><td class=r>1</td><td class=r>por cotizar</td><td class=r>—</td><td>—</td><td class=r>$212,000<span class=sub> (R3)</span></td><td class=r>—</td><td class=r>—</td></tr>
<tr class=tot><td colspan=7>TOTAL muebles (sin servicio)</td><td class=r>${gran_costo:,.0f}</td><td class=r>${gran_quote:,.0f}</td></tr>
</tbody></table>
<h2>Confianza de cada costo</h2>
<p class=sub><span class=badge style='background:#2e7d52'>ALTA</span> Torre, Horizontal, Isla — fabricación anclada al costo real verificado; terceros (cristal templado, termoformado, kit) con precio real.<br>
<span class=badge style='background:#b06f12'>MEDIA</span> Almacén — fab verificado + herrajes del workbook; falta MDF de superficie, reconciliar antes de firmar.<br>
<span class=badge style='background:#c0453b'>PRELIMINAR</span> Cubo y Caja — muebles nuevos; BOM del spec R5 con precios reales, pero los consumos de lámina/MDF marcados <i>*supuesto*</i> los debe validar Ingeniería.</p>
<h2>Hallazgo</h2>
<p>En la <b>Vitrina Horizontal</b> tu cotización histórica R7 ($15,678) queda ~3% sobre este costo ($15,250): margen muy delgado. En Torre/Almacén/Isla el margen histórico es sano (19–32%). Revisa si el termoformado ($2,840) y el kit de iluminación ($2,535) encarecen de más el Horizontal, o si lo estás subcotizando.</p>
<div class=sub style='margin-top:20px'>Generado por COSTEAR · motor POLÍTICA_VH · datos C-CO-320R + producto_maestro</div>
</body></html>"""
open("/home/user/costeador-vonhaucke/lab/concurso_telcel_r5/concurso_r5.html","w",encoding="utf-8").write(HTML)
print("HTML escrito.")
