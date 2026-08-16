// ============================================================================
//  GENERADOR WORK LOUNGE · guía GE_Work Lounge (CTG-DIN-DPR-001, v4 2024).
//  Concepto de lounge modular que integra Tetris/Arlequín/Pac (líneas propias)
//  MÁS complementos: Tank (taburetes circulares), Ding (sillones rectangulares
//  y esquineros con caja eléctrica), Bricks (conectores triangulares, empalmes
//  izq/der y sofá trapezoidal) y Spoon (repisas tubulares + mesas con base
//  metálica -EST y cubierta melamina ABS -CU / cristal satinado -CRS).
//  Acabados EcoPiel / Tela. Claves WL. FASE A: MP estimada.
// ============================================================================
const BASTIDOR = 'bastidor-madera', ESPUMA = 'espuma', ECOPIEL = 'ecopiel', TELA = 'tela';
const PTR = 'ptr', MEL = 'melamina-19', CRISTAL = 'cristal-satinado', CANTO = 'tapacanto';
const LAMINA = 'lamina-20', PINTURA = 'pintura-electrostatica', CAJA = 'caja-electrica';
const mm = (v) => (v / 1000);

// --- Tablas reales de la guía (PAG 11-13) --------------------------------
// Tank: SOLO tres medidas. Clave WLTAC{Øcm}{Altocm}ECP.
const TANK = {
  '4542': { dia: 450, alto: 420 }, // Ø0.45 × 0.42 m
  '4560': { dia: 450, alto: 600 }, // Ø0.45 × 0.60 m
  '6042': { dia: 600, alto: 420 }, // Ø0.60 × 0.42 m
};

// Bricks: conector (T), empalme izq (EI), empalme der (ED) llevan sufijo de
// fondo/alto 42|60. Trapezoidal (R) sólo 42. Clave WLBRIT{cod}{42|60}ECP.
const BRICKS = {
  conector:    { cod: 'T',  w: 500, base: 'fondo',  otras: { d: null, h: 580 } }, // fondo varía (420/600)
  empalme_izq: { cod: 'EI', w: 500, base: 'alto',   otras: { d: 400, h: null } }, // alto varía (420/600)
  empalme_der: { cod: 'ED', w: 500, base: 'alto',   otras: { d: 400, h: null } },
};

// Spoon MESA: base metálica (-EST) + cubierta (ABS -CU / cristal -CRS).
// SÓLO tres medidas reales: 900×900, 900×600, 600×400.
const MESA_SPOON = {
  '900x900': { w: 900, d: 900, base: 'WLMSP33-EST',   cubABS: 'WLMSP33ABS-CU',     cubCRS: 'WLMSP33CRS-CRS' },
  '900x600': { w: 900, d: 600, base: 'WLSPME32-EST',  cubABS: 'WLSPME32ABS-CU',    cubCRS: 'WLSPME32CRS-CRS' },
  '600x400': { w: 600, d: 400, base: 'WLSPME35-EST',  cubABS: 'WLSPME2475ABS-CU',  cubCRS: 'WLSPME2475CRS-CRS' },
};

// Spoon REPISA tubular: 34/35 son IDs, NO medidas. 34→120 cm, 35→150 cm.
const REPISA_SPOON = {
  '120': { largo: 1200, clave: 'WLLIBE34ABS' },
  '150': { largo: 1500, clave: 'WLLIBE35ABS' },
};

export const WORKLOUNGE_PRODUCTOS = [
  {
    id: 'tank', nombre: 'Taburete Tank',
    selects: [{ key: 'medida', label: 'Medida', opciones: [
      { id: '4542', label: 'Ø0.45 × 0.42 m' }, { id: '4560', label: 'Ø0.45 × 0.60 m' }, { id: '6042', label: 'Ø0.60 × 0.42 m' },
    ] }],
    finishes: [{ id: 'ecopiel', label: 'EcoPiel' }, { id: 'tela', label: 'Tela' }],
  },
  {
    id: 'ding', nombre: 'Sillón Ding',
    selects: [{ key: 'tipo', label: 'Tipo', opciones: [
      { id: 'rectangular_der', label: 'Rectangular derecho' }, { id: 'rectangular_izq', label: 'Rectangular izquierdo' }, { id: 'esquinero', label: 'Esquinero (caja eléctrica)' },
    ] }],
    finishes: [{ id: 'ecopiel', label: 'EcoPiel' }, { id: 'tela', label: 'Tela' }],
    checks: [{ key: 'electrico', label: 'Caja eléctrica (esquinero)' }],
  },
  {
    id: 'bricks', nombre: 'Sofá Bricks',
    selects: [
      { key: 'tipo', label: 'Tipo', opciones: [
        { id: 'conector', label: 'Conector triangular' }, { id: 'empalme_izq', label: 'Empalme izquierdo' }, { id: 'empalme_der', label: 'Empalme derecho' }, { id: 'trapezoidal', label: 'Modular trapezoidal' },
      ] },
      { key: 'fondo', label: 'Fondo / Alto', opciones: [{ id: '42', label: '0.42 m' }, { id: '60', label: '0.60 m' }] },
    ],
    finishes: [{ id: 'ecopiel', label: 'EcoPiel' }, { id: 'tela', label: 'Tela' }],
  },
  {
    id: 'spoon', nombre: 'Mesa / repisa Spoon',
    selects: [
      { key: 'tipo', label: 'Tipo', opciones: [{ id: 'mesa', label: 'Mesa (base + cubierta)' }, { id: 'repisa', label: 'Repisa tubular' }] },
      { key: 'medida', label: 'Medida', opciones: [
        { id: '900x900', label: 'Mesa 0.90 × 0.90 m' }, { id: '900x600', label: 'Mesa 0.90 × 0.60 m' }, { id: '600x400', label: 'Mesa 0.60 × 0.40 m' },
        { id: '120', label: 'Repisa 1.20 m' }, { id: '150', label: 'Repisa 1.50 m' },
      ] },
    ],
    finishes: [{ id: 'ABS', label: 'Melamina ABS' }, { id: 'cristal', label: 'Cristal satinado' }],
  },
];

// Asiento tapizado (bastidor + espuma + tapiz ecopiel/tela + placa base)
function asiento(comp, w, d, h, tapiz, nBastidor = 1) {
  comp.push({ insumoId: BASTIDOR, nombre: 'Bastidor de madera', cantidad: nBastidor });
  comp.push({ insumoId: ESPUMA, nombre: 'Espuma', cantidad: 1, largoMM: w, anchoMM: d });
  const areaTapiz = (mm(w) * mm(d)) + 2 * (mm(w) + mm(d)) * mm(h); // top + costados
  comp.push({ insumoId: tapiz === 'tela' ? TELA : ECOPIEL, nombre: `Tapiz ${tapiz === 'tela' ? 'tela' : 'EcoPiel'}`, cantidad: areaTapiz / 0.55 });
  comp.push({ insumoId: LAMINA, nombre: 'Base / placa metálica', cantidad: (mm(w) * mm(d)) * 7.16 });
}

export function generarWorklounge(config) {
  const c = { producto: 'tank', medida: '4542', tipo: 'rectangular_der', fondo: '42', finish: 'ecopiel', electrico: false, ...config };
  const comp = [];
  const claves = [];
  const electricos = [];
  const esTela = c.finish === 'tela';
  const tapizTxt = esTela ? 'tela' : 'EcoPiel';
  let nombre = '';

  if (c.producto === 'tank') {
    const t = TANK[c.medida] || TANK['4542'];
    asiento(comp, t.dia, t.dia, t.alto, c.finish, 1);
    claves.push('WLTAC' + (TANK[c.medida] ? c.medida : '4542') + 'ECP');
    nombre = `Work Lounge · Taburete Tank Ø${mm(t.dia).toFixed(2)}×${mm(t.alto).toFixed(2)} m · ${tapizTxt}`;

  } else if (c.producto === 'ding') {
    const esq = c.tipo === 'esquinero';
    const [w, d, h] = esq ? [700, 700, 700] : [1700, 700, 700];
    asiento(comp, w, d, h, c.finish, esq ? 1 : 2);
    comp.push({ insumoId: MEL, nombre: 'Cara en tablero melamínico (Ding)', cantidad: 1, largoMM: w, anchoMM: h });
    if (esq || c.electrico) { comp.push({ insumoId: CAJA, nombre: 'Caja eléctrica esquinero', cantidad: 1 }); electricos.push('Caja eléctrica (aparte)'); }
    claves.push(esq ? 'WLEQ77S4ABSECP' : ('WLSIRE3ABS' + (c.tipo === 'rectangular_izq' ? 'I' : 'D') + 'ECP'));
    nombre = `Work Lounge · Sillón Ding ${esq ? 'esquinero' : 'rectangular ' + (c.tipo === 'rectangular_izq' ? 'izq' : 'der')} · ${tapizTxt}`;

  } else if (c.producto === 'bricks') {
    if (c.tipo === 'trapezoidal') {
      asiento(comp, 1500, 1000, 420, c.finish, 2);
      claves.push('WLBRITR42ECP');
      nombre = `Work Lounge · Bricks modular trapezoidal · ${tapizTxt}`;
    } else {
      const b = BRICKS[c.tipo] || BRICKS.conector;
      const fondo = c.fondo === '60' ? 60 : 42;
      const dimVar = fondo === 60 ? 600 : 420;
      const w = b.w;
      const d = b.base === 'fondo' ? dimVar : b.otras.d;
      const h = b.base === 'alto' ? dimVar : b.otras.h;
      asiento(comp, w, d, h, c.finish, 1);
      claves.push('WLBRIT' + b.cod + fondo + 'ECP');
      const etq = { conector: 'conector triangular', empalme_izq: 'empalme izquierdo', empalme_der: 'empalme derecho' }[c.tipo];
      nombre = `Work Lounge · Bricks ${etq} 0.${fondo} · ${tapizTxt}`;
    }

  } else if (c.producto === 'spoon') {
    if (c.tipo === 'repisa') {
      const r = REPISA_SPOON[c.medida] || REPISA_SPOON['120'];
      const L = r.largo, fondo = 450, altoRep = 1200;
      // Estructura tubular metálica: 4 postes verticales + perímetro de 2 repisas
      comp.push({ insumoId: PTR, nombre: 'Estructura tubular Spoon (metal)', cantidad: 4 * mm(altoRep) + 2 * (2 * (mm(L) + mm(fondo))) });
      comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática', cantidad: 2 * (mm(L) * mm(fondo)) + mm(L) * mm(altoRep) });
      comp.push({ insumoId: MEL, nombre: 'Repisas melamina ABS', cantidad: 2, largoMM: L, anchoMM: fondo });
      comp.push({ insumoId: CANTO, nombre: 'Canto repisas', cantidad: 2 * (2 * (mm(L) + mm(fondo))) });
      claves.push(r.clave);
      nombre = `Work Lounge · Repisa tubular Spoon ${mm(L).toFixed(2)} m`;
    } else {
      const m = MESA_SPOON[c.medida] || MESA_SPOON['900x900'];
      const w = m.w, d = m.d, altoMesa = 430;
      const esCristal = c.finish === 'cristal';
      // BASE metálica (-EST): postes + marco perimetral + pintura + niveladores
      comp.push({ insumoId: PTR, nombre: 'Base metálica Spoon (-EST)', cantidad: 4 * mm(altoMesa) + 2 * (mm(w) + mm(d)) });
      comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática base', cantidad: 0.4, largoMM: w, anchoMM: d });
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      // CUBIERTA (-CU melamina ABS / -CRS cristal satinado)
      if (esCristal) {
        comp.push({ insumoId: CRISTAL, nombre: 'Cubierta cristal satinado', cantidad: 1, largoMM: w, anchoMM: d });
      } else {
        comp.push({ insumoId: MEL, nombre: 'Cubierta melamina ABS', cantidad: 1, largoMM: w, anchoMM: d });
        comp.push({ insumoId: CANTO, nombre: 'Canto cubierta', cantidad: 2 * (mm(w) + mm(d)) });
      }
      claves.push(m.base);
      claves.push(esCristal ? m.cubCRS : m.cubABS);
      nombre = `Work Lounge · Mesa Spoon ${mm(w).toFixed(2)}×${mm(d).toFixed(2)} m · ${esCristal ? 'cristal satinado' : 'melamina ABS'}`;
    }
  }

  return {
    producto: c.producto, nombre, componentes: comp, claves, electricos,
    modoManoObra: 'porcentaje', factorDirecta: 36, factorIndirecta: 12,
    nota: 'Work Lounge (Fase A): complementos lounge Tank/Ding/Bricks/Spoon con claves y medidas reales de la guía GE_Work Lounge v4. Tank sólo 4542/4560/6042; Bricks conector/empalmes con fondo 42/60 + trapezoidal R42; Spoon mesa separa BASE (-EST) de CUBIERTA (-CU/-CRS), sólo 900×900/900×600/600×400; repisa WLLIBE34ABS(120)/WLLIBE35ABS(150). MP estimada: metal→ptr, base/placa tapizado→lamina-20, cubierta/repisa ABS→melamina-19, cristal→cristal-satinado, tapiz→ecopiel/tela. Tetris/Arlequín/Pac son líneas aparte. Falta calibrar con lista de MP real.',
  };
}
