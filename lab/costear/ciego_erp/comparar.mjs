// Prueba ciega contra el ERP: compara, por FAMILIA de material, el BOM y el costo que la app costeó (8-dto-servidor.json)
// contra el REPORTE DEL COTIZADOR de Intelisis (hoja.erp_referencia). No ajusta nada: sólo mide.
// Uso: node lab/costear/ciego_erp/comparar.mjs lab/costear/ciego_erp/r1 [salida.md]
import fs from 'node:fs'; import path from 'node:path';

const BASE = process.argv[2] || 'lab/costear/ciego_erp/r1';
const HOJAS = 'lab/costear/ciego_erp/hojas';
const leer = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_e) { return null; } };
const r2 = (x) => (x == null || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100) / 100);

// Familia de un renglón de la app por id + nombre del insumo (no por el nombre de la pieza).
export function familiaApp(id, nombre) {
  const t = `${id} ${nombre}`.toLowerCase();
  if (/cristal|vidrio/.test(t)) return { familia: 'cristal' };
  if (/pintura|polvo|esmalte|laca/.test(t)) return { familia: 'pintura' };
  if (/nivelador/.test(t)) return { familia: 'nivelador' };
  if (/soporte/.test(t)) return { familia: 'soporte' };
  if (/canto|peabs|chapacinta|ch32/.test(t)) return { familia: 'canto' };
  if (/melamina|aglomerado|mdf|tablero|ame\d|triplay/.test(t)) { const e = t.match(/(\d{2})\s*mm|ame(\d{2})|melamina-(\d{2})|mdf-?(\d{2})/); return { familia: 'tablero', sub: e ? (e[1] || e[2] || e[3] || e[4]) : null }; }
  if (/\bl[aá]mina|ln\d{2}/.test(t)) { const c = t.match(/cal(?:ibre)?\.?\s*(\d{1,2})|ln(\d{2})/); return { familia: 'lamina', sub: c ? (c[1] || c[2]).replace(/^0/, '') : null }; }
  if (/ptr|tubular|tubo|perfil tubular|redondo|cuadrado/.test(t)) return { familia: 'tubular' };
  if (/melamina|aglomerado|mdf|tablero|ame\d|triplay|aglomer/.test(t)) { const e = t.match(/(\d{2})\s*mm|ame(\d{2})|melamina-(\d{2})|mdf-?(\d{2})/); return { familia: 'tablero', sub: e ? (e[1] || e[2] || e[3] || e[4]) : null }; }
  if (/torniller|tornillo|pija|rondana|tuerca|herraje|bisagra|corredera|jaladera|cintur|soldadura|consumible/.test(t)) return { familia: 'herraje' };
  return { familia: 'otro' };
}

function comparar(clave) {
  const hoja = leer(path.join(HOJAS, `${clave}.json`)); const dir = path.join(BASE, clave);
  const dto = leer(path.join(dir, '8-dto-servidor.json')); const bom1 = leer(path.join(dir, '1-bom-inicial.json'));
  const ref = hoja.erp_referencia;
  const fila = { clave, texto: hoja.texto, corrio: !!dto, erp_mp: ref.mp, erp_total: ref.total_fabricacion };
  if (!dto) { fila.error = fs.existsSync(path.join(dir, 'run.log')) ? (fs.readFileSync(path.join(dir, 'run.log'), 'utf8').match(/Error:[^\n]*/) || ['sin DTO'])[0] : 'no corrió'; return fila; }
  const comps = dto.req?.pieza?.componentes || []; const det = dto.res?.costo?.detalleInsumos || [];
  const costoPorId = {}; for (const d of det) costoPorId[d.insumoId] = (costoPorId[d.insumoId] || 0) + Number(d.costo || 0);
  const nombrePorId = {}; for (const d of det) nombrePorId[d.insumoId] = d.nombre;
  // Familias de la app (costo por insumo repartido entre sus renglones por igual: el DTO trae el costo por insumo).
  const app = {}; const usados = {};
  for (const c of comps) { if (c.excluida) continue; const f = familiaApp(c.insumoId || '', nombrePorId[c.insumoId] || c.material_solicitado || c.nombre || ''); const k = f.familia; (app[k] ||= { renglones: [], subs: new Set(), costo: 0 }); app[k].renglones.push(`${c.nombre} [${c.insumoId || 'SIN MATERIAL'}]`); if (f.sub) app[k].subs.add(f.sub); if (c.insumoId && !usados[c.insumoId]) { usados[c.insumoId] = 1; app[k].costo += costoPorId[c.insumoId] || 0; } }
  const erp = {}; for (const e of ref.familias) { (erp[e.familia] ||= { subs: new Set(), importe: 0, cant: [] }); if (e.sub) erp[e.familia].subs.add(e.sub); erp[e.familia].importe += e.erp_importe; erp[e.familia].cant.push(`${e.erp_cantidad} ${e.erp_unidad}${e.sub ? ' (' + e.sub + ')' : ''}`); }
  const familias = [...new Set([...Object.keys(erp), ...Object.keys(app)])].sort();
  fila.familias = familias.map((k) => {
    const a = app[k], e = erp[k];
    let estado = a && e ? 'OK' : e ? 'FALTA' : 'SOBRA';
    if (a && e && e.subs.size && a.subs.size && ![...a.subs].some((s) => e.subs.has(s))) estado = 'ESPEC_DISTINTA';
    if (k === 'herraje' && !e && a) estado = 'SOBRA_HERRAJE';
    return { familia: k, estado, erp: e ? { cant: e.cant.join(' + '), subs: [...e.subs], importe: r2(e.importe) } : null, app: a ? { renglones: a.renglones, subs: [...a.subs], costo: r2(a.costo) } : null };
  });
  const sinMaterial = comps.filter((c) => !c.insumoId && !c.excluida).map((c) => c.nombre);
  const costo = dto.res?.costo || {};
  Object.assign(fila, {
    estado_servidor: dto.res?.estado, piezas_ia: bom1?.analizar?.piezas, sin_material: sinMaterial,
    app_mp: r2(costo.materialTotal), app_mo: r2(costo.manoObra), app_gi: r2(costo.indirectosFabrica), app_total: r2(costo.costoUnitario),
    dif_mp_pct: ref.mp && costo.materialTotal != null ? r2((costo.materialTotal / ref.mp - 1) * 100) : null,
    dif_total_pct: ref.total_fabricacion && costo.costoUnitario != null ? r2((costo.costoUnitario / ref.total_fabricacion - 1) * 100) : null,
    faltan: fila.familias?.filter((x) => x.estado === 'FALTA').map((x) => x.familia), sobran: fila.familias?.filter((x) => x.estado === 'SOBRA').map((x) => x.familia),
    espec: fila.familias?.filter((x) => x.estado === 'ESPEC_DISTINTA').map((x) => `${x.familia} app ${x.app.subs} vs erp ${x.erp.subs}`),
  });
  return fila;
}

const claves = fs.existsSync(BASE) ? fs.readdirSync(BASE).filter((d) => fs.existsSync(path.join(HOJAS, `${d}.json`))).sort() : [];
const filas = claves.map(comparar);
fs.writeFileSync(path.join(BASE, 'comparacion.json'), JSON.stringify(filas, null, 1));
const md = ['| Clave | Estado app | MP app / ERP | Δ MP | Total app / ERP | Δ total | Familias que faltan | Que sobran | Especificación distinta | Sin material |', '|---|---|---|---|---|---|---|---|---|---|'];
for (const f of filas) md.push(f.corrio ? `| ${f.clave} | ${f.estado_servidor} | ${f.app_mp} / ${f.erp_mp} | ${f.dif_mp_pct}% | ${f.app_total} / ${f.erp_total} | ${f.dif_total_pct}% | ${f.faltan.join(', ') || '—'} | ${f.sobran.join(', ') || '—'} | ${f.espec.join('; ') || '—'} | ${f.sin_material.join(', ') || '—'} |` : `| ${f.clave} | NO CORRIÓ | | | | | ${f.error} | | | |`);
fs.writeFileSync(path.join(BASE, 'comparacion.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
