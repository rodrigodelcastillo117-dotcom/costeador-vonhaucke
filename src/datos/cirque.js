// ============================================================================
//  GENERADOR CIRQUE · guía GE_Cirque (ESP-DCC-IDP-003, v2 2025-09-09). Sistema
//  de benching INSIGNIA (cubierta CICE / CICUB, pata universal, conducto).
//  Escritorios, bancas (sencilla/doble), estaciones 120° (Y de 3), recepciones
//  rectas y curvas (ensamble multipieza), mesas de juntas (cuadradas/circulares
//  en melamina/cristal/mármol), barras/mesas altas y credenzas. Claves reales CI.
//  Fase A: dimensiones reales de la guía; MP estimada donde falta lista real.
// ============================================================================

// Cirque estaba cotizando a 0.58× App LT y en realidad vale MUCHO más: Rodrigo
// (2026-08-15) la fija en 4× App LT. Medido producto por producto contra App LT
// en configs equivalentes, el factor sobre el modelo propio de Cirque es 6.9.
// OJO: la razón contra App LT no es uniforme (escritorio 0.49, juntas 0.81), así
// que con un solo factor la mesa de juntas queda algo arriba de 4×.
// Es calibración, no dato: se borra en cuanto haya precios reales de Cirque.
// El ajuste de Cirque vive ahora en `factoresLinea.js` (escalera de líneas).

import { aplicarColor } from './colorMelamina.js';
import { coloresDe } from './acabados.js';

const CANTO = 'tapacanto', PTR = 'ptr', LAMINA = 'lamina-20';
const PINTURA = 'pintura-electrostatica';
const ACOMETIDA = 'acometida', CAJA = 'caja-electrica';
const KG20 = 7.16;
const laminaKg = (m2) => m2 * KG20;
const mm = (v) => (v / 1000);
const num = (v, def) => parseInt(v) || def;

// Acabados de cubierta. suf = sufijo real en clave CICE/CICUB; mj = sufijo mesa juntas.
const ACAB = {
  ABS:     { insumo: 'melamina-28',      suf: 'ABS', mj: 'ABS', label: 'Melamina ABS' },
  chapa:   { insumo: 'chapa-madera',     suf: 'CH',  mj: 'CH',  label: 'Chapa de madera' },
  TF:      { insumo: 'membrana-pvc',     suf: 'TF',  mj: 'TF',  label: 'Termoformado' },
  CRS:     { insumo: 'cristal-satinado', suf: 'CRS', mj: 'CRS', label: 'Cristal satinado' },
  cristal: { insumo: 'cristal-templado-12', suf: 'CRL', mj: 'CRL', label: 'Cristal laminado', vidrio: true },
  marmol:  { insumo: 'marmol',           suf: 'MC',  mj: 'MC',  label: 'Mármol carrara', vidrio: true },
};
// cubiertas de cristal/mármol no llevan tapacanto
const esVidrio = (a) => a.insumo === 'cristal-satinado' || a.insumo === 'cristal-templado-12' || a.insumo === 'marmol';

const FIN_TABLERO = [{ id: 'ABS', label: 'Melamina ABS' }, { id: 'chapa', label: 'Chapa de madera' }, { id: 'TF', label: 'Termoformado' }];
const FIN_CUBIERTA = [...FIN_TABLERO, { id: 'CRS', label: 'Cristal satinado' }];
const FIN_JUNTAS = [...FIN_TABLERO, { id: 'cristal', label: 'Cristal laminado' }, { id: 'marmol', label: 'Mármol carrara' }];

const SEMIMAT = { key: 'semimat', label: 'Semimampara', opciones: [
  { id: 'cristal', label: 'Cristal transparente' }, { id: 'satinado', label: 'Cristal satinado' },
  { id: 'serig', label: 'Cristal serigrafiado' }, { id: 'tela', label: 'Tela pinchable' },
] };

const CIRQUE_PRODUCTOS_BASE = [
  {
    id: 'escritorio', nombre: 'Escritorio',
    selects: [{ key: 'largo', label: 'Largo', opciones: [{ id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }, { id: '1800', label: '1.80 m' }, { id: '2100', label: '2.10 m' }, { id: '2400', label: '2.40 m' }] }, SEMIMAT],
    fondos: [600, 750, 900],
    finishes: FIN_CUBIERTA,
    checks: [{ key: 'retorno', label: 'Retorno lateral (1.05 m)' }, { key: 'biombo', label: 'Semimampara' }, { key: 'electrico', label: 'Acometida' }],
  },
  {
    id: 'banca', nombre: 'Banca',
    selects: [
      { key: 'tipo', label: 'Tipo', opciones: [{ id: 'sencilla', label: 'Sencilla' }, { id: 'doble', label: 'Doble' }] },
      { key: 'usuarios', label: 'Puestos', opciones: [{ id: '2', label: '2' }, { id: '4', label: '4' }, { id: '6', label: '6' }] },
      { key: 'largo', label: 'Largo por puesto', opciones: [{ id: '900', label: '0.90 m' }, { id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }, { id: '1650', label: '1.65 m' }, { id: '1800', label: '1.80 m' }] },
      SEMIMAT,
    ],
    fondos: [600, 750, 900],
    finishes: FIN_TABLERO,
    checks: [{ key: 'biombo', label: 'Semimampara' }, { key: 'electrico', label: 'Conducto + acometida' }],
  },
  {
    id: 'estacion', nombre: 'Estación 120°',
    selects: [{ key: 'largo', label: 'Largo por ala', opciones: [{ id: '1050', label: '1.05 m' }, { id: '1200', label: '1.20 m' }] }, SEMIMAT],
    finishes: FIN_TABLERO,
    checks: [{ key: 'biombo', label: 'Semimamparas' }, { key: 'electrico', label: 'Conducto + acometida' }],
  },
  {
    id: 'mesajuntas', nombre: 'Mesa de juntas',
    selects: [
      { key: 'forma', label: 'Forma', opciones: [{ id: 'cuadrada', label: 'Cuadrada' }, { id: 'circular', label: 'Circular' }] },
      { key: 'medida', label: 'Medida', opciones: [{ id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }, { id: '1800', label: '1.80 m' }, { id: '2100', label: '2.10 m (circular)' }, { id: '2400', label: '2.40 m (circular)' }] },
    ],
    finishes: FIN_JUNTAS,
    checks: [{ key: 'electrico', label: 'Caja eléctrica (Ellora E2X)' }],
  },
  {
    id: 'barra', nombre: 'Barra / Mesa alta',
    selects: [{ key: 'medida', label: 'Largo (×0.40 m)', opciones: [{ id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }, { id: '1800', label: '1.80 m' }, { id: '2100', label: '2.10 m' }] }],
    finishes: FIN_CUBIERTA,
  },
  {
    id: 'credenza', nombre: 'Credenza',
    selects: [{ key: 'medida', label: 'Largo (×0.60 m)', opciones: [{ id: '1800', label: '1.80 m' }, { id: '2100', label: '2.10 m' }, { id: '2400', label: '2.40 m' }] }],
    finishes: FIN_TABLERO,
  },
  {
    id: 'recepcion', nombre: 'Recepción',
    selects: [
      { key: 'forma', label: 'Forma', opciones: [{ id: 'recta', label: 'Recta' }, { id: 'curva', label: 'Curva' }] },
      { key: 'largo', label: 'Largo', opciones: [{ id: '1800', label: '1.80 m' }, { id: '2400', label: '2.40 m' }] },
    ],
    finishes: FIN_TABLERO,
    checks: [{ key: 'gajoAcrilico', label: 'Gajo acrílico (curva)' }, { key: 'electrico', label: 'Acometida' }],
  },
];
// Colores reales de melamina 28mm (catálogo de acabados) para el selector.
// Todos los finishes 'ABS' de Cirque (cubiertas, credenza, barra, etc.) resuelven
// a 'melamina-28' vía ACAB — mismo insumo base en todos los productos de la línea.
export const CIRQUE_PRODUCTOS = CIRQUE_PRODUCTOS_BASE.map((p) => ({ ...p, colores: coloresDe('melamina-28') }));

// --- Claves reales ---------------------------------------------------------
// Escritorio: CICE + [dígito ancho = round(largo/300)] + [fondo: 600->'2', 750->'75', 900->'3'] + acabado.
const anchoDig = (L) => Math.round(L / 300);
const fondoCod = (F) => (F >= 900 ? '3' : F >= 750 ? '75' : '2');
const cveCubierta = (L, F, suf) => 'CICE' + anchoDig(L) + fondoCod(F) + suf;
// Semimampara: índice 3=900,4=1200,5=1500,6=1800. Familias por material.
const semiIdx = (L) => Math.min(6, Math.max(3, Math.round(L / 300)));
const SEMI = {
  cristal:  { fam: (i) => 'CICR' + i + 'CT',  insumo: 'cristal-templado', label: 'cristal transparente 9mm' },
  satinado: { fam: (i) => 'CICR' + i + 'ST',  insumo: 'cristal-satinado', label: 'cristal satinado 9mm' },
  serig:    { fam: (i) => 'CICR' + i + 'CCS', insumo: 'cristal-templado', label: 'cristal serigrafiado 9mm' },
  tela:     { fam: (i) => 'CISMO' + i + 'T',  insumo: 'frente-tela',      label: 'tela pinchable 25mm' },
};

// --- Ensambles reutilizables ----------------------------------------------
// Pata universal Cirque: lámina (bastidor/charola) + tubular (PTR) + pintura
function pataUniversal(comp, n) {
  comp.push({ insumoId: PTR, nombre: 'Pata universal · tubular', cantidad: n * (2 * 0.72 + 0.55) });
  comp.push({ insumoId: LAMINA, nombre: 'Pata universal · bastidor + charola (lámina)', cantidad: laminaKg(n * 0.25) });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura patas', cantidad: n * 0.3, largoMM: 720, anchoMM: 550 });
  comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: n * 2 });
}
// Conducto / charola pasacables con tapa registrable (spine central)
function conducto(comp, largoMM) {
  comp.push({ insumoId: LAMINA, nombre: 'Conducto pasacables + tapa registrable (lámina)', cantidad: laminaKg(mm(largoMM) * 0.35) });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura conducto', cantidad: mm(largoMM) * 0.35, largoMM, anchoMM: 200 });
  comp.push({ insumoId: 'charola', nombre: 'Charola pasacables', cantidad: mm(largoMM) });
}

export function generarCirque(config) {
  const c = {
    producto: 'escritorio', largo: '1500', tipo: 'sencilla', usuarios: '4', forma: 'recta',
    medida: '1500', finish: 'ABS', semimat: 'cristal', retorno: false, biombo: false,
    electrico: false, gajoAcrilico: false, ...config,
  };
  const a = ACAB[c.finish] || ACAB.ABS;
  const largo = num(c.largo, 1500);
  const fondo = num(c.fondoMM, 600);
  const comp = [];
  const claves = [];
  const electricos = [];
  let tipoRender = 'escritorio', nombre = '';

  // Cubierta genérica (bajocubierta+cubierta+sobrecubierta se agregan como 1 tablero).
  const cubierta = (n, L, F, acab = a) => {
    comp.push({ insumoId: acab.insumo, nombre: `Cubierta ${esVidrio(acab) ? '(' + acab.label + ') ' : ''}${mm(L).toFixed(2)}×${mm(F).toFixed(2)}`, cantidad: n, largoMM: L, anchoMM: F });
    if (!esVidrio(acab)) comp.push({ insumoId: CANTO, nombre: 'Canto perímetro cubierta', cantidad: n * 2 * (mm(L) + mm(F)) });
  };
  // Semimampara Cirque: cristal 9mm (transp/satin/serig, alto 430) o tela pinchable, en riel.
  const biombo = (n, L = largo) => {
    const s = SEMI[c.semimat] || SEMI.cristal;
    const i = semiIdx(L);
    comp.push({ insumoId: s.insumo, nombre: `Semimampara ${s.label} (${s.fam(i)})`, cantidad: n, largoMM: L, anchoMM: 430 });
    if (c.semimat === 'serig') comp.push({ insumoId: 'serigrafia', nombre: 'Serigrafía semimampara', cantidad: n, largoMM: L, anchoMM: 430 });
    if (c.semimat === 'tela') comp.push({ insumoId: 'bastidor-mampara', nombre: 'Bastidor tela semimampara', cantidad: n, largoMM: L, anchoMM: 430 });
    comp.push({ insumoId: 'remate-aluminio', nombre: 'Perfil/riel semimampara', cantidad: n * mm(L) });
    claves.push(s.fam(i));
  };
  const elec = (n) => {
    comp.push({ insumoId: ACOMETIDA, nombre: 'Acometida', cantidad: Math.max(1, Math.ceil(n / 3)) });
    comp.push({ insumoId: CAJA, nombre: 'Cajas eléctricas', cantidad: n });
    electricos.push(`${n} caja(s) + acometida (piezas eléctricas aparte)`);
  };

  if (c.producto === 'escritorio') {
    cubierta(1, largo, fondo);
    pataUniversal(comp, 2);
    if (c.retorno) { cubierta(1, 1050, 600); pataUniversal(comp, 1); claves.push('CICE1235' + a.suf); tipoRender = 'estacion'; }
    if (c.biombo) biombo(1);
    if (c.electrico) { conducto(comp, largo); elec(1); }
    claves.unshift(cveCubierta(largo, fondo, a.suf));
    if (tipoRender !== 'estacion') tipoRender = 'escritorio';
    nombre = `Cirque · Escritorio ${mm(largo).toFixed(2)}×${mm(fondo).toFixed(2)} m · ${a.label}`;

  } else if (c.producto === 'banca') {
    const nUs = num(c.usuarios, 4);
    const doble = c.tipo === 'doble';
    const filas = doble ? 2 : 1;
    const porFila = Math.ceil(nUs / filas);
    const d = Math.min(6, Math.max(3, Math.round(largo / 300)));
    const f75 = fondo >= 750 ? '75' : '';
    cubierta(nUs, largo, fondo);
    conducto(comp, porFila * largo);
    pataUniversal(comp, porFila + 1);
    if (c.biombo) biombo(nUs);
    if (c.electrico) elec(nUs);
    // Cubierta CICUB{d}{75}{acab}; estructura sencilla CIBIES1{d}{75}COM-A / doble CIBDES2{d}COM-A (600) o CIBDES75{d}COM-A (750).
    claves.push('CICUB' + d + f75 + a.suf);
    claves.push(doble ? (f75 ? 'CIBDES75' + d : 'CIBDES2' + d) + 'COM-A' : 'CIBIES1' + d + f75 + 'COM-A');
    tipoRender = 'bench';
    nombre = `Cirque · Banca ${doble ? 'doble' : 'sencilla'} ${nUs} puestos · ${mm(largo).toFixed(2)}×${mm(fondo).toFixed(2)} m · ${a.label}`;

  } else if (c.producto === 'estacion') {
    const nUs = 3;                          // Estación 120° = Y de 3 puestos
    cubierta(nUs, largo, 600);
    conducto(comp, 2 * largo);
    pataUniversal(comp, 4);
    comp.push({ insumoId: PTR, nombre: 'Poste central 120° (Y)', cantidad: 1.15 });
    if (c.biombo) biombo(nUs);
    if (c.electrico) elec(nUs);
    claves.push((largo >= 1200 ? 'CICE124' : 'CICE1235') + a.suf);
    tipoRender = 'estacion';
    nombre = `Cirque · Estación 120° 3 puestos · ${mm(largo).toFixed(2)} m · ${a.label}`;

  } else if (c.producto === 'mesajuntas') {
    const circular = c.forma === 'circular';
    let medida = num(c.medida, 1500);
    if (!circular && medida > 1800) medida = 1800;   // cuadradas 1200/1500/1800
    const d = Math.round(medida / 300);              // 4=1200 … 8=2400
    // Cubierta: cuadrada = medida×medida; circular = área de círculo (π/4 del cuadrado envolvente).
    const areaFactor = circular ? Math.PI / 4 : 1;
    comp.push({ insumoId: a.insumo, nombre: `Cubierta ${circular ? 'circular Ø' : 'cuadrada '}${mm(medida).toFixed(2)}${esVidrio(a) ? ' (' + a.label + ')' : ''}`, cantidad: areaFactor, largoMM: medida, anchoMM: medida });
    if (!esVidrio(a)) comp.push({ insumoId: CANTO, nombre: 'Canto perímetro', cantidad: circular ? Math.PI * mm(medida) : 4 * mm(medida) });
    // Estructura / bastidor + patas universales en lámina
    comp.push({ insumoId: LAMINA, nombre: 'Estructura + bastidor (lámina)', cantidad: laminaKg(mm(medida) * mm(medida) * 0.6) });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura estructura', cantidad: mm(medida) * mm(medida) * 0.6, largoMM: medida, anchoMM: 600 });
    pataUniversal(comp, medida >= 2100 ? 4 : circular ? 1 : 2);
    if (c.electrico) { comp.push({ insumoId: CAJA, nombre: 'Caja eléctrica Ellora E2X', cantidad: 1 }); electricos.push('Caja Ellora E2X + espiral pasacables (aparte)'); }
    // Claves: cuadrada cubierta CICUMJ{dd}{acab} + estructura CIMJ{dd}ES{CR/MC}-A.
    //         circular cubierta CICUMJC{d}{acab} + bastidor CIMJBE{d}CT-A.
    if (circular) {
      claves.push('CICUMJC' + d + a.mj);
      claves.push('CIMJBE' + d + 'CT-A');
    } else {
      const dd = '' + d + d;                          // 44/55/66
      claves.push('CICUMJ' + dd + a.mj);
      claves.push('CIMJ' + dd + 'ES' + (c.finish === 'cristal' ? 'CR' : c.finish === 'marmol' ? 'MC' : '') + '-A');
    }
    tipoRender = 'mesa';
    nombre = `Cirque · Mesa de juntas ${circular ? 'circular Ø' : 'cuadrada '}${mm(medida).toFixed(2)} m · ${a.label}`;

  } else if (c.producto === 'barra') {
    let medida = num(c.medida, 1500);
    if (medida > 2100) medida = 2100;
    const F = 400;
    const d = Math.round(medida / 300);              // 4=1200 … 7=2100
    // Cubierta CRS con claves irregulares; melamina/chapa/TF = CICUMAB{d}{acab}
    const cubCRS = { 4: 'CICUCRMA4', 5: 'CICUMAB5CRS', 6: 'CICUMAB6CRS', 7: 'CICUCRMA7' };
    cubierta(1, medida, F);
    // Estructura mesa alta con patas altas, descansapies y bastidor
    comp.push({ insumoId: PTR, nombre: 'Patas altas + descansapiés (tubular)', cantidad: 2 * 1.05 + mm(medida) });
    comp.push({ insumoId: LAMINA, nombre: 'Bastidor mesa alta (lámina)', cantidad: laminaKg(mm(medida) * 0.3) });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura estructura', cantidad: mm(medida) * 0.3, largoMM: medida, anchoMM: 400 });
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    claves.push(c.finish === 'CRS' ? (cubCRS[d] || ('CICUMAB' + d + 'CRS')) : 'CICUMAB' + d + a.suf);
    claves.push('CIMAB' + d + 'ES-A');
    tipoRender = 'mesa';
    nombre = `Cirque · Barra / Mesa alta ${mm(medida).toFixed(2)}×0.40 m · ${a.label}`;

  } else if (c.producto === 'credenza') {
    let medida = num(c.medida, 1800);
    if (medida > 2400) medida = 2400;
    const F = 600;
    const cod = medida >= 2400 ? '82' : medida >= 2100 ? '72' : '62';
    const nPtas = Math.round(medida / 600);
    // Cuerpo melamina (costados+fondo+entrepaños ≈ 2.4× frente)
    comp.push({ insumoId: a.insumo, nombre: `Cubierta credenza ${mm(medida).toFixed(2)}×0.60`, cantidad: 1, largoMM: medida, anchoMM: F });
    comp.push({ insumoId: a.insumo, nombre: 'Cuerpo credenza (costados/fondo/entrepaños)', cantidad: 1, largoMM: medida, anchoMM: 1500 });
    comp.push({ insumoId: a.insumo, nombre: 'Puertas credenza', cantidad: 1, largoMM: medida, anchoMM: 720 });
    comp.push({ insumoId: CANTO, nombre: 'Canto credenza', cantidad: 2 * (mm(medida) + mm(F)) + nPtas * 2 * (0.6 + 0.72) });
    comp.push({ insumoId: 'bisagra', nombre: 'Bisagras', cantidad: nPtas * 2 });
    comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras', cantidad: nPtas });
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería', cantidad: 1 });
    claves.push('CICRE' + cod + '-A');
    tipoRender = 'guarda';
    nombre = `Cirque · Credenza ${mm(medida).toFixed(2)}×0.60 m · ${a.label}`;

  } else if (c.producto === 'recepcion') {
    const curva = c.forma === 'curva';
    const L = num(c.largo, 1800);
    if (curva) {
      // Ensamble multipieza: mostrador curvo + escritorio + gajos + repisa cristal + estructuras
      comp.push({ insumoId: a.insumo, nombre: `Cubierta curva central (CIRECUCC${a.suf} 1550×710)`, cantidad: 1, largoMM: 1550, anchoMM: 710 });
      comp.push({ insumoId: a.insumo, nombre: `Cubierta curva derecha escritorio (CIRECUCCD${a.suf})`, cantidad: 1, largoMM: 1757, anchoMM: 961 });
      comp.push({ insumoId: CANTO, nombre: 'Canto cubiertas curvas', cantidad: 2 * (mm(1550) + mm(710)) + 2 * (mm(1757) + mm(961)) });
      // Estructuras mostrador/escritorio en lámina (CIREESCCR/CIREESCCE)
      comp.push({ insumoId: LAMINA, nombre: 'Estructura mostrador curva CIREESCCR (lámina)', cantidad: laminaKg(mm(1443) * mm(980)) });
      comp.push({ insumoId: LAMINA, nombre: 'Estructura escritorio CIREESCCE (lámina)', cantidad: laminaKg(mm(1443) * mm(613)) });
      comp.push({ insumoId: PINTURA, nombre: 'Pintura estructuras', cantidad: mm(1443) * (mm(980) + mm(613)), largoMM: 1443, anchoMM: 980 });
      // Patas tubulares (izq/der mostrador CIREPARI/CIREPARD, escritorio CIREPAEI/CIREPAED) + postes
      comp.push({ insumoId: PTR, nombre: 'Patas tubulares mostrador/escritorio + postes', cantidad: 4 * 0.97 + 2 * 0.72 });
      comp.push({ insumoId: LAMINA, nombre: 'Patas tubulares con bastidor (lámina)', cantidad: laminaKg(4 * 0.42) });
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 8 });
      // Gajos curvos: metálicos (juego) siempre; acrílico opcional
      comp.push({ insumoId: LAMINA, nombre: 'Juego gajos metálicos curvos CIRELACCR (lámina)', cantidad: laminaKg(mm(1577) * mm(943) * 0.4) });
      if (c.gajoAcrilico) comp.push({ insumoId: 'acrilico', nombre: 'Gajo curvo acrílico CIREACCCR', cantidad: 1, largoMM: 1619, anchoMM: 943 });
      // Repisa cristal satinado + conducto charola
      comp.push({ insumoId: 'cristal-satinado', nombre: 'Repisa curva cristal satinado 9mm (CIRERECCCR 1719×539)', cantidad: 1, largoMM: 1719, anchoMM: 539 });
      comp.push({ insumoId: 'charola', nombre: 'Conducto charola CIRECOP', cantidad: mm(1200) });
      if (c.electrico) elec(2);
      claves.push('CIRECUCC' + a.suf, 'CIRECUCCD' + a.suf, 'CIREESCCR', 'CIREESCCE', 'CIRERECCCR');
      nombre = `Cirque · Recepción curva · ${a.label}`;
    } else {
      // Recta: cubiertas + repisa cristal de transacción + patas laterales + conducto
      cubierta(1, L, 710);
      comp.push({ insumoId: a.insumo, nombre: 'Bajocubierta / sobrecubierta mostrador', cantidad: 1, largoMM: L, anchoMM: 350 });
      comp.push({ insumoId: 'cristal-satinado', nombre: 'Cristal de transacción satinado 9mm (1719×539)', cantidad: 1, largoMM: 1719, anchoMM: 539 });
      comp.push({ insumoId: LAMINA, nombre: 'Patas laterales + bastidor mostrador (lámina)', cantidad: laminaKg(mm(L) * 1.0) });
      comp.push({ insumoId: PINTURA, nombre: 'Pintura mostrador', cantidad: mm(L) * 1.0, largoMM: L, anchoMM: 1000 });
      pataUniversal(comp, 2);
      comp.push({ insumoId: 'pasacables', nombre: 'Conducto pasacables', cantidad: 1 });
      if (c.electrico) elec(1);
      claves.push('CICE' + anchoDig(L) + '2' + a.suf);
      nombre = `Cirque · Recepción recta ${mm(L).toFixed(2)} m · ${a.label}`;
    }
    tipoRender = 'guarda';
  }

  return aplicarColor({
    producto: c.producto, nombre, componentes: comp, claves, electricos,
    modoManoObra: 'porcentaje', factorDirecta: 38, factorIndirecta: 12,
    nota: 'Cirque (Fase A): benching insignia GE_Cirque. Escritorios/bancas/estaciones 120° con clave real CICE/CICUB/CIBIES/CIBDES y semimampara CICR/CISMO por material (transp/satin/serig/tela). Mesas de juntas cuadradas (CICUMJ/CIMJ) y circulares (CICUMJC/CIMJBE) en melamina/cristal/mármol; barras CIMAB4-7 (cubierta CICUMAB/CICUCRMA, cristal satinado); credenzas CICRE62/72/82; recepción curva como ensamble multipieza (CIRECUCC/CIREESC/CIRERECCCR) y recta con cristal de transacción 1719×539. MP estimada: sin lista real, cristal laminado usa cristal-templado-12 y tela usa frente-tela+bastidor-mampara (no hay insumoId exacto). Falta calibrar desarrollo de lámina de estructuras/gajos y áreas circulares con lista de MP real.',
  }, c);
}
