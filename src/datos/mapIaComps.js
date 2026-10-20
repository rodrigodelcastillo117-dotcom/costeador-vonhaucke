// ============================================================================
//  PROPUESTA DE LA IA → COMPONENTES DEL BOM (una sola fuente para Costear y Costeador).
//  Antes vivía duplicado en AsistenteEspecial.jsx y Costeador.jsx.
//  · Política de material (aplicarPoliticaMaterial): nunca sustituye en silencio.
//  · Piezas de ÁREA: largo × ancho × piezas. La fracción de hoja que estima la IA (`hojas`) se
//    conserva como `iaHojas` para enseñarla, pero en TABLERO la hoja la decide el MOTOR
//    (rejilla + regla A14 de Producción): la IA sólo calculaba área/hoja sin nesteo y
//    quedaba corta. En LÁMINA irregular la fracción directa de la IA sigue mandando (Rafa §1).
//  · Piezas LINEALES: `cantidad` son metros; `forma` viaja para las reglas de casa.
// ============================================================================
import { procedenciaCanonica } from '../voni/especialidades.js';
import { aplicarPoliticaMaterial, MATCH } from './materialMatch.js';

const RE_M2 = /^(m2|m²|mt2|m\^2|metros? cuadrados?)$/i;

// ESPEJO DE P0.12 (VH-157): el servidor (costear-servidor, origenSpecConfiable=false) degrada todo
// EXACT que viene de una spec del cliente sin confirmación humana a "por confirmar" y NO emite.
// El navegador debe decir lo MISMO: si aquí quedara EXACT/emitible, el precio en pantalla y el del
// servidor divergen (el cliente mostraba $4,410.57 emitible y el servidor 'incompleto'). Un EXACT
// que la IA eligió del catálogo curado es una propuesta hasta que una persona lo confirme.
export function espejoP012(comp) {
  if (!comp || comp.material_match !== MATCH.EXACT || comp.material_confirmado === true) return comp;
  const motivo = 'Coincidencia exacta PROPUESTA por la IA (sin confirmación humana). Requiere confirmación antes de emitir; el servidor aplica la misma regla.';
  return { ...comp, material_match: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED,
    _match: { ...(comp._match || {}), clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, autollenado: true, autocosteable: true, candidate_insumo_id: comp.insumoId, motivo } };
}

// Área J · R-03: ¿la propuesta trae piezas que se puedan usar? Una respuesta `ok:true` con `piezas`
// vacías, en texto o con renglones que no son objeto NO debe reemplazar el despiece de la persona.
export function propuestaConPiezas(p) {
  return Array.isArray(p?.piezas) && p.piezas.some((z) => z && typeof z === 'object' && !Array.isArray(z));
}

// Totales que la IA DECLARA en sus textos ("TOTAL 7.17 m", "total con marcos = 7.17 m"), en metros. No cuentan los
// tramos de compra ni los totales con merma: ésos no son lo que suma el despiece.
const RE_TOTAL_M = /\btotal\b([^0-9\n]{0,25}?)(\d+(?:[.,]\d+)?)\s*m(?![m²2a-záéíóúñ])/gi;
function totalesDeclaradosM(z) {
  const t = [z.nota, z.razonamiento, z.evidencia].filter(Boolean).join(' · ');
  const out = [];
  for (const m of t.matchAll(RE_TOTAL_M)) {
    if (/merma|tramo|desperd|compra|comercial/i.test(m[1])) continue;
    const v = Number(m[2].replace(',', '.'));
    if (v > 0) out.push(v);
  }
  return out;
}

// Certificación 19-oct (mesa de centro): la IA escribe "TOTAL 7.17 m" de tubo y su despiece suma 4.368 m. Por material
// lineal: si declara un total y NINGUNO cuadra (−5 %…+15 %) con la suma de sus renglones, se marca el primero del grupo; el
// validador estructural lo bloquea (aceptable). No se corrige solo: no se elige por la persona cuál número vale.
function marcarTotalLinealIncoherente(comps, piezas) {
  const grupos = new Map();
  comps.forEach((c, i) => {
    // Mismo material = el insumo que PIDIÓ la IA (la política puede dejarlo sin insumo resuelto hasta confirmar).
    const k = piezas[i]?.insumoId || c.insumoId;
    if (c.forma !== 'lineal' || !k || !(Number(c.cantidad) > 0)) return;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(i);
  });
  // SRV-01: el total que la IA declara viaja como EVIDENCIA en el renglón (ia_totales_declarados_m) para que el servidor
  // repita este mismo diagnóstico con la misma función (revisionEstructural.totalesLinealesIncoherentes).
  comps.forEach((c, i) => { if (c.forma === 'lineal') { const d = totalesDeclaradosM(piezas[i]); if (d.length) c.ia_totales_declarados_m = d; } });
  for (const [insumoId, idx] of grupos) {
    const declarados = idx.flatMap((i) => totalesDeclaradosM(piezas[i]));
    if (!declarados.length) continue;
    const suma = Math.round(idx.reduce((s, i) => s + Number(comps[i].cantidad), 0) * 1000) / 1000;
    // Cuadra si la suma queda entre −5 % y +15 % del total declarado: redondear hacia arriba por desperdicio
    // ("total ~6.6 m, ~7 m con desperdicio") es legítimo; quedarse CORTO no (falta material).
    if (declarados.some((v) => suma >= v * 0.95 && suma <= v * 1.15)) continue;
    const dice = Math.max(...declarados);
    comps[idx[0]].iaTotalIncoherente = { material: insumoId, dice, puso: suma, renglones: idx.length };
  }
  return comps;
}

const esMaterialDeHoja = (ins) => !!ins && (ins.unidad === 'hoja' || ['lamina', 'tablero'].includes(ins.formato?.tipo));

export function mapIaComps(p, insumos = {}) {
  const resolver = (id) => insumos[id];
  const catalogo = Object.values(insumos || {});
  // R-03: `piezas` que no es lista (la IA la mandó como texto) o renglones que no son objeto se ignoran
  // en vez de reventar con "….map is not a function".
  const piezas = Array.isArray(p?.piezas) ? p.piezas.filter((z) => z && typeof z === 'object' && !Array.isArray(z)) : [];
  const comps = piezas.map((z) => {
    const base = espejoP012(aplicarPoliticaMaterial({ ...z, material_solicitado: z.material_solicitado || z.nombre }, resolver, catalogo));
    base.forma = z.forma || (z.largoMM && z.anchoMM ? 'area' : 'pieza');
    // Certificación 19-oct (faldón del lote 10): la IA mandó una pieza de LÁMINA 1400 × 300 como "lineal" y se costeaba
    // como 1.4 m de un material que se vende por hoja. Si el material es de hoja (lámina/tablero) y trae largo Y ancho, es
    // una pieza de área. Un perfil (PTR, tubo, tapacanto) con ancho sigue siendo lineal. Sin catálogo no se adivina.
    // Auditoría 19-oct (mesa de trabajo): también llega como forma "pieza" ("pieza ×1" de una lámina que se costea POR
    // HOJA = una hoja entera por una pieza de 0.42 m²). Lineal o pieza: con largo y ancho de material de hoja, es área.
    const formaIa = base.forma;
    if ((formaIa === 'lineal' || formaIa === 'pieza') && Number(z.largoMM) > 0 && Number(z.anchoMM) > 0 && esMaterialDeHoja(resolver(z.insumoId || base.insumoId))) {
      base.forma = 'area'; base.formaIa = formaIa;
    }
    // VONI Ingeniería: procedencia de la IA por pieza (OBSERVADO/INFERIDO/SUPUESTO/DESCONOCIDO) + su evidencia, para que
    // una suposición nunca se confunda con un dato. No viaja al servidor (validarIntentCosteo la ignora al sanear).
    base.procedencia = procedenciaCanonica(z.procedencia);
    if (z.evidencia) base.evidencia = String(z.evidencia).slice(0, 240);
    if (Number.isFinite(Number(z.pagina)) && Number(z.pagina) > 0) base.pagina = Number(z.pagina);
    // LINEALES (VH-160 + VH-AUD-201): contrato inequívoco — largoMM = largo de UNA pieza, cantidad = NÚMERO de piezas,
    // metrosTotales = el total que la IA declara. Los metros son largoMM/1000 × piezas. NUNCA se adivina por coincidencia
    // numérica (antes "cantidad ≈ largoMM/1000 ⇒ ya son metros": 2 × 2000 mm salía 2 m, no 4). Si la IA declara un total
    // que no cuadra, o la cantidad podría ser metros (contrato viejo: no entera, o igual al largo en m), se costea como
    // piezas y queda REVIEW_REQUIRED: el validador estructural lo bloquea hasta que una persona lo confirme.
    if (base.forma === 'lineal' && !(Number(z.largoMM) > 0) && Number(z.metrosTotales) > 0) base.cantidad = Number(z.metrosTotales);
    if (base.forma === 'lineal' && Number(z.largoMM) > 0) {
      const m1 = Number(z.largoMM) / 1000, n = Number(z.cantidad) > 0 ? Number(z.cantidad) : 1;
      const total = Math.round(m1 * n * 1000) / 1000;
      base.cantidad = total;
      base.largoLinealMM = Number(z.largoMM); base.piezasLineales = n;
      const declarado = Number(z.metrosTotales) > 0 ? Number(z.metrosTotales) : null;
      if (declarado != null) {
        if (Math.abs(declarado - total) / total > 0.05) base.iaIncoherencia = { campo: 'metrosTotales', dice: declarado, puso: total, piezas: n, largoMM: Number(z.largoMM) };
      } else if (!Number.isInteger(n) || (n > 1 && Math.abs(n - m1) <= 0.05)) {
        base.iaIncoherencia = { campo: 'cantidadLineal', dice: n, puso: total, piezas: n, largoMM: Number(z.largoMM) };
      }
      // Certificación 18-oct (mesa de centro): la IA razonó "perímetro 2800 mm" y escribió largoMM 1800. Si su propio
      // razonamiento declara el perímetro de la pieza y no coincide (±5 %) con el largo que puso, se marca: el validador
      // estructural lo bloquea para que la persona lo corrija. No se corrige solo: no se elige por ella cuál número vale.
      const per = String(z.razonamiento || '').match(/per[ií]metro\s*(?:de\s*)?(\d{3,6})\s*mm/i);
      if (per && !base.iaIncoherencia) { const dice = Number(per[1]), puso = Number(z.largoMM); if (Math.abs(dice - puso) / dice > 0.05) base.iaIncoherencia = { campo: 'largoMM', dice, puso }; }
      // Certificación 19-oct: la 2ª pasada "corrigió" 2 × 2800 a 1 × 2800 escribiendo "largo total 5600 mm" en su nota.
      const lt = `${z.nota || ''} ${z.razonamiento || ''}`.match(/largo\s+total\s*(?:de\s*)?(\d{3,6})\s*mm/i);
      if (!base.iaIncoherencia && lt) { const dice = Number(lt[1]), puso = Math.round(base.cantidad * 1000); if (Math.abs(dice - puso) / dice > 0.05) base.iaIncoherencia = { campo: 'largoTotal', dice, puso }; }
    }
    if (base.forma === 'area') {
      base.largoMM = z.largoMM || 0; base.anchoMM = z.anchoMM || 0; base.piezas = z.cantidad || 1; base.cantidad = 1;
      // Una "pieza" convertida a área con cantidad NO entera (1.3, 2.8: kg o fracción, no piezas) no se adivina:
      // 1 pieza de largo × ancho y queda marcada para que la persona confirme cuántas lleva.
      if (base.formaIa === 'pieza' && !Number.isInteger(Number(z.cantidad)) && Number(z.cantidad) > 0) {
        base.piezas = 1; base.iaIncoherencia = { campo: 'cantidadPiezas', dice: Number(z.cantidad), puso: 1 };
      }
      if (z.hojas > 0) {
        base.iaHojas = z.hojas;
        const ins = base.insumoId ? resolver(base.insumoId) : null;
        const esTablero = !!ins && ins.formato && ins.formato.tipo === 'tablero' && base.largoMM > 0 && base.anchoMM > 0;
        // A/B lab 2026-10-13 (mesa de centro): la IA expresó la cubierta de cristal templado 1000×600 como "0.2 de hoja"
        // sobre un material que se VENDE POR m² y no tiene formato de hoja. Copiar esa fracción dispara el candado P0-02
        // ("falta la hoja de referencia") y el costo quedaba incompleto con la geometría a la mano. Con largo×ancho y
        // precio por m², el consumo es el área: la fracción de la IA sólo se muestra.
        // El candidato cuenta igual: al confirmarlo, la fracción de hoja no debe quedarse pegada.
        const insM2 = ins || (base.candidate_insumo_id ? resolver(base.candidate_insumo_id) : null);
        const porM2SinFormato = !!insM2 && !(Number(insM2.formato?.medida) > 0) && RE_M2.test(String(insM2.unidad || '').trim()) && base.largoMM > 0 && base.anchoMM > 0;
        if (porM2SinFormato) delete base.hojas;   // (llegaba copiada desde la propuesta)
        else if (!esTablero) base.hojas = z.hojas;   // lámina irregular / sin geometría: fracción directa
      }
    }
    return base;
  });
  return marcarTotalLinealIncoherente(comps, piezas);
}
