// ============================================================================
//  INSUMOS ACOMPAÑANTES (determinista). Hay materiales que SIEMPRE arrastran otro. Cada
//  acompañante se agrega editable y borrable, con `_auto: true` y `_regla` (qué regla y qué
//  cálculo). No inventa precio (sale del catálogo/motor) ni toca las demás piezas. Idempotente.
//
//  Reglas:
//   1) Superficie sólida → adhesivo acrílico (histórica).
//   REGLAS DE CASA (2026-10-12, aprobadas por Dirección), sólo cuando se pasa `insumos`:
//   2) Gabinete bajo sin base/patas → zoclo de 100 mm del mismo material que los costados.
//   3) Mueble con base/patas/zoclo → 4 niveladores por módulo.
//   4) Piezas de tablero → tapacanto en los cantos VISIBLES (metros por geometría y rol).
//   5) Acero (PTR/tubo/lámina) → pintura electrostática en polvo (m² por geometría: metros ×
//      perímetro del perfil; lámina × 2 caras). En tubular el motor deja el kg PENDIENTE
//      mientras Producción no dé rendimiento (A14): se dice, no se inventa.
//      Si el despiece trae un acabado metálico (EcoCrom/cromado) el acero NO se pinta: el área por
//      geometría va a ese renglón (VH-164).
// ============================================================================
import { aplicarPoliticaMaterial, familiaDeMaterial } from './materialMatch.js';
import { rolDe } from './revisionEstructural.js';
import { REGLAS_TALLER, metrosDeCanto, areaPintadaTubularM2 } from './reglasTaller.js';

const REGLAS = [
  {
    cuando: (id) => /^solid-surface/.test(String(id || '')),
    insumoId: 'adhesivo-solid-surface',
    pieza: { nombre: 'Adhesivo acrílico (uniones solid surface)', insumoId: 'adhesivo-solid-surface', cantidad: 1, piezas: 1, _auto: true },
  },
];

const PANELES = new Set(['melamina', 'mdf', 'laminado_hpl', 'chapa_madera', 'madera_solida']);
const r2 = (x) => Math.round(Number(x) * 100) / 100;

function familiaDe(c, insumos) {
  const ins = c && c.insumoId && insumos ? insumos[c.insumoId] : null;
  return familiaDeMaterial((ins && ins.nombre) || c.material_solicitado || c.nombre || '');
}
function nombreMaterial(c, insumos) {
  const ins = c && c.insumoId && insumos ? insumos[c.insumoId] : null;
  return (ins && ins.nombre) || c.material_solicitado || c.nombre || '';
}
function esTubular(c, insumos) {
  const t = nombreMaterial(c, insumos) + ' ' + (c.nombre || '');
  return /ptr|tubo|tubular|perfil/i.test(t) || c.forma === 'lineal';
}
function pieza(base, insumos, regla, nota) {
  const comp = aplicarPoliticaMaterial({ ...base }, (id) => insumos[id], Object.values(insumos));
  return { ...comp, ...base, insumoId: comp.insumoId, material_match: comp.material_match, candidate_insumo_id: comp.candidate_insumo_id, _match: comp._match, _auto: true, _regla: regla, iaNota: nota, iaConf: 'regla de casa' };
}

/**
 * Devuelve el despiece con sus insumos acompañantes garantizados (sin duplicar).
 * @param {Array} componentes
 * @param {object} [insumos]  mapa id → insumo (activa las reglas de casa)
 * @returns {Array} nuevo arreglo (no muta el de entrada)
 */
export function conAcompanantes(componentes = [], insumos = null) {
  let comps = Array.isArray(componentes) ? componentes.slice() : [];
  const ids = new Set(comps.map((c) => c && c.insumoId).filter(Boolean));
  for (const r of REGLAS) {
    const disparado = comps.some((c) => c && r.cuando(c.insumoId));
    if (disparado && !ids.has(r.insumoId)) { comps.push({ ...r.pieza }); ids.add(r.insumoId); }
  }
  if (!insumos || typeof insumos !== 'object') return comps;

  const vivos = () => comps.filter((c) => c && (c.nombre || c.insumoId));
  const conRol = () => vivos().map((c) => ({ c, rol: rolDe(c.nombre || ''), fam: familiaDe(c, insumos) }));
  const hayFam = (f) => conRol().some((x) => x.fam === f);
  const hayRol = (r) => conRol().some((x) => x.rol === r);

  // 2) Zoclo en gabinete bajo sin base.
  const esGabinete = hayRol('lateral') && (hayRol('puerta') || hayRol('entrepano') || hayRol('gaveta'));
  if (esGabinete && !hayRol('pata') && !comps.some((c) => c && c._regla === 'zoclo')) {
    const cub = conRol().filter((x) => x.rol === 'cubierta' && x.c.largoMM > 0);
    const cos = conRol().find((x) => x.rol === 'lateral');
    const largo = cub.length ? cub.reduce((s, x) => s + Number(x.c.largoMM) * Math.max(1, Number(x.c.piezas) || 1), 0) : Number(cos && cos.c.largoMM) || 0;
    if (largo > 0 && cos) {
      comps.push(pieza({ nombre: 'Zoclo (regla de casa)', material_solicitado: nombreMaterial(cos.c, insumos), largoMM: largo, anchoMM: REGLAS_TALLER.zoclo.altoMM, piezas: 1, cantidad: 1, forma: 'area' }, insumos, 'zoclo',
        `Regla de casa: gabinete bajo sin base → zoclo de ${REGLAS_TALLER.zoclo.altoMM} mm (durabilidad y vista), ${largo} mm de largo, mismo material que los costados. Bórralo si no aplica.`));
    }
  }
  // 3) Niveladores: 4 por módulo cuando hay base/patas/zoclo.
  if (hayRol('pata') && !hayFam('herraje_nivelador')) {
    const modulos = Math.max(1, conRol().filter((x) => x.rol === 'cubierta').reduce((s, x) => s + Math.max(1, Number(x.c.piezas) || 1), 0));
    const n = REGLAS_TALLER.niveladores.porModulo * modulos;
    comps.push(pieza({ nombre: 'Niveladores', material_solicitado: REGLAS_TALLER.niveladores.solicitado, cantidad: n, piezas: 1, forma: 'pieza' }, insumos, 'niveladores',
      `Regla de casa: ${REGLAS_TALLER.niveladores.porModulo} niveladores por módulo × ${modulos} módulo(s) = ${n}.`));
  }
  // 4) Tapacanto en cantos visibles de las piezas de tablero. Si la IA ya puso la línea, su metraje
  //    era un SUPUESTO: la geometría manda y se deja constancia de lo que decía la IA.
  {
    const paneles = conRol().filter((x) => PANELES.has(x.fam) && x.c.largoMM > 0 && x.c.anchoMM > 0);
    if (paneles.length) {
      const detalle = []; let metros = 0;
      for (const x of paneles) {
        const rol = x.rol === 'lateral' ? 'costado' : x.rol;
        const m = metrosDeCanto({ largoMM: x.c.largoMM, anchoMM: x.c.anchoMM, piezas: x.c.piezas || 1, rol });
        if (m > 0) { metros += m; detalle.push(`${x.c.nombre}: ${r2(m)} m`); }
      }
      const nota = `Regla de casa: cantos visibles por tipo de pieza (cubierta/puerta/frente 4 lados, costado 2, entrepaño 1, respaldo 0) = ${r2(metros)} m (${detalle.join(' · ')}). El color iguala el acabado.`;
      const existente = conRol().find((x) => x.fam === 'tapacanto');
      if (metros > 0 && existente && !existente.c._regla && !existente.c.cantidad_confirmada) {
        const idx = comps.indexOf(existente.c);
        comps[idx] = { ...existente.c, iaCantidad: existente.c.cantidad, cantidad: r2(metros), _regla: 'tapacanto', iaNota: `${nota}${Number(existente.c.cantidad) > 0 ? ` (la IA suponía ${existente.c.cantidad} m).` : ''}` };
      } else if (metros > 0 && !existente) {
        comps.push(pieza({ nombre: 'Tapacanto (cantos visibles)', material_solicitado: 'Tapacanto PVC', cantidad: r2(metros), piezas: 1, forma: 'lineal' }, insumos, 'tapacanto', nota));
      }
    }
  }
  // 5) Pintura electrostática para el acero. Si la IA ya puso la línea sin área, se le pone el
  //    área por geometría (si no, el motor cobraría "1 kg" a ciegas).
  if (REGLAS_TALLER.acero.pinturaSiempre) {
    const acero = conRol().filter((x) => x.fam === 'metal_lamina' && !/inoxidable|inox\b/i.test(nombreMaterial(x.c, insumos)));
    if (acero.length) {
      let m2 = 0, tubular = false; const detalle = [];
      for (const x of acero) {
        if (esTubular(x.c, insumos)) {
          const metros = Number(x.c.cantidad) * Math.max(1, Number(x.c.piezas) || 1);
          const a = areaPintadaTubularM2(metros, nombreMaterial(x.c, insumos) + ' ' + (x.c.material_solicitado || ''));
          if (a.m2 > 0) { m2 += a.m2; tubular = true; detalle.push(`${x.c.nombre}: ${r2(metros)} m × perfil ${a.perfil} = ${r2(a.m2)} m²`); }
        } else if (x.c.largoMM > 0 && x.c.anchoMM > 0) {
          const area = (x.c.largoMM / 1000) * (x.c.anchoMM / 1000) * Math.max(1, Number(x.c.piezas) || 1) * REGLAS_TALLER.acero.carasLamina;
          m2 += area; detalle.push(`${x.c.nombre}: ${r2(area)} m² (2 caras)`);
        }
      }
      // VH-164: si el despiece ya trae un ACABADO metálico (EcoCrom/cromado), el acero va con ese
      // acabado, no pintado: su cantidad (m²) sale de la misma geometría y no se agrega pintura.
      // Nunca se borra una línea de pintura que haya puesto la IA o la persona (se dice, no se esconde).
      const acabados = conRol().filter((x) => x.fam === 'acabado_metal');
      if (acabados.length) {
        if (m2 > 0) {
          const notaAc = `Regla de casa: el acero lleva el acabado de este renglón, no pintura. Área por geometría = ${r2(m2)} m² (${detalle.join(' · ')}).`;
          for (const x of acabados) {
            if (x.c._regla || x.c.cantidad_confirmada) continue;
            const idx = comps.indexOf(x.c);
            const { largoMM: _l, anchoMM: _a, ...resto } = x.c;
            comps[idx] = { ...resto, iaCantidad: x.c.cantidad, iaMedida: (_l > 0 && _a > 0) ? `${_l}×${_a}` : undefined, cantidad: r2(m2 / acabados.length), piezas: 1, forma: 'pieza', _regla: 'acabado_metal', iaNota: notaAc };
          }
        }
        return comps;
      }
      const colores = new Set();
      for (const x of acero) for (const [k, re] of [['negro', /negr[oa]|black/i], ['blanco', /blanc[oa]|white/i], ['gris', /\bgris\b|gr[ae]y/i]]) if (re.test(`${x.c.material_solicitado || ''} ${x.c.nombre || ''}`)) colores.add(k);
      const color = colores.size === 1 ? [...colores][0] : '';
      const notaPin = `Regla de casa: todo el acero visible lleva pintura electrostática. Área por geometría = ${r2(m2)} m² (${detalle.join(' · ')}).${tubular ? ' En tubular Producción no dio rendimiento (plano: 8 m²/kg): el motor deja el kg pendiente hasta que lo confirmes.' : ''}`;
      const existente = conRol().find((x) => x.fam === 'pintura_polvo');
      if (m2 > 0 && existente && !existente.c._regla && !(existente.c.areaPintadaM2 > 0)) {
        const idx = comps.indexOf(existente.c);
        comps[idx] = { ...existente.c, areaPintadaM2: r2(m2), tubular, cantidad: 1, piezas: 1, _regla: 'pintura', iaNota: notaPin };
      } else if (m2 > 0 && !existente) {
        comps.push(pieza({ nombre: 'Pintura electrostática (acero)', material_solicitado: `${REGLAS_TALLER.acero.pinturaSolicitada}${color ? ' ' + color : ''}`, cantidad: 1, piezas: 1, areaPintadaM2: r2(m2), tubular, forma: 'pieza' }, insumos, 'pintura',
          notaPin));
      }
    }
  }
  return comps;
}
