// ============================================================================
//  GENERADOR SPINE · guía GE_Spine (ESP-DCC-COC-001 / ESP-DCC-IDP-003, v3
//  2025-09-09). Sistema de mobiliario modular que se arma por DUCTOS + PATAS:
//  un ducto central metálico ("spine") aloja el arnés Byrne y se cierra con
//  tapas frontales (troquel voz-datos / ciega / sin V-D) y tapas laterales de
//  refuerzo; las patas (base / unión escuadra-T-cruz) sostienen y unen ductos.
//  Las CUBIERTAS son ACCESORIO, no requerimiento. Biombo acrílico o PET conmuta
//  el ducto (con soporte SPDUH## / sin soporte SPDUHSB##). Máx 4 ductos por lado
//  y toda configuración cierra con tapas laterales. Claves reales SP*. MP metálica
//  estimada (lámina cal.20 + pintura electrostática); cubiertas/biombos por área.
// ============================================================================
const LAMINA = 'lamina-20', PINTURA = 'pintura-electrostatica', CANTO = 'tapacanto';
const PATA = 'pata-metalica', NIVEL = 'nivelador', TORN = 'tornilleria';
const ACRIL = 'acrilico', PET = 'pet-acustico', CAJA = 'caja-electrica', ACOMETIDA = 'acometida', BYRNE = 'byrne-phase2';
const KG20 = 7.16;
const laminaKg = (m2) => m2 * KG20;
const mm = (v) => (v / 1000);
const num = (v, def) => parseInt(v) || def;

// Acabados de cubierta (accesorio). Ecolegno (HPELABS) es el acabado por defecto.
const ACAB = {
  HPELABS: { insumo: 'laminado', suf: 'HPELABS', label: 'Ecolegno' },
  ABS: { insumo: 'melamina-28', suf: 'ABS', label: 'Melamina ABS' },
  TF: { insumo: 'membrana-pvc', suf: 'TF', label: 'Termoformado' },
  CH: { insumo: 'chapa-madera', suf: 'CH', label: 'Chapa' },
};
const FINISHES = [
  { id: 'HPELABS', label: 'Ecolegno' },
  { id: 'ABS', label: 'Melamina ABS' },
  { id: 'TF', label: 'Termoformado' },
  { id: 'CH', label: 'Chapa' },
];
const LARGOS = [{ id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }, { id: '1650', label: '1.65 m' }, { id: '1800', label: '1.80 m' }];
const LARGOS_CUB = [{ id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }];
const MATERIAL = { key: 'material', label: 'Biombo', opciones: [{ id: 'acrilico', label: 'Acrílico' }, { id: 'pet', label: 'Acústico PET' }] };
const LADO = { key: 'lado', label: 'Lateralidad', opciones: [{ id: 'D', label: 'Derecha' }, { id: 'I', label: 'Izquierda' }] };

// Sufijo de clave por largo de ducto (1200→4, 1500→5, 1650→165, 1800→6)
const IDX = { 1200: '4', 1500: '5', 1650: '165', 1800: '6' };
// Índice de cubierta por largo (24 = 1200×750, 25 = 1500×750). Sólo existen estos.
const CUBIDX = { 1200: '24', 1500: '25' };
const UNION = { escuadra: 'SPPATUEM', T: 'SPPATUTM', cruz: 'SPPATUCM' };
const UNION_LABEL = { escuadra: 'escuadra', T: '“T”', cruz: 'cruz' };

export const SPINE_PRODUCTOS = [
  {
    id: 'ducto', nombre: 'Ducto individual',
    selects: [{ key: 'largo', label: 'Largo', opciones: LARGOS }, MATERIAL, LADO],
    finishes: FINISHES,
    checks: [{ key: 'biombo', label: 'Biombo' }, { key: 'cubierta', label: 'Cubierta (accesorio)' }, { key: 'electrico', label: 'Conexión Byrne' }],
  },
  {
    id: 'configuracion', nombre: 'Configuración de ductos',
    selects: [
      { key: 'tipo', label: 'Configuración', opciones: [{ id: 'lineal', label: 'Lineal' }, { id: 'escuadra', label: 'Pata escuadra (2)' }, { id: 'T', label: 'Pata en T (3)' }, { id: 'cruz', label: 'Pata en cruz (4)' }] },
      { key: 'ductos', label: 'Ductos por lado', opciones: [{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }, { id: '4', label: '4' }] },
      { key: 'largo', label: 'Largo ducto', opciones: LARGOS },
      MATERIAL,
    ],
    finishes: FINISHES,
    checks: [{ key: 'biombo', label: 'Biombo' }, { key: 'cubierta', label: 'Cubierta (accesorio)' }, { key: 'electrico', label: 'Conexión Byrne' }],
  },
  {
    id: 'biombo', nombre: 'Biombo para ducto',
    selects: [MATERIAL, { key: 'largo', label: 'Largo', opciones: LARGOS }],
  },
  {
    id: 'cubierta', nombre: 'Cubierta (accesorio)',
    selects: [{ key: 'largo', label: 'Largo', opciones: LARGOS_CUB }, LADO],
    finishes: FINISHES,
  },
];

// Estructura metálica del ducto (spine). Con soporte biombo (SPDUH##) o sin él
// (SPDUHSB##). Lámina cal.20 desarrollada + pintura + tornillería con imanes IM175.
function emitDucto(comp, claves, largo, biombo, n) {
  const idx = IDX[largo] || '5';
  const sinBiombo = !biombo && (largo === 1200 || largo === 1500);   // sólo 4M/5M tienen variante SB
  claves.push('SPDUH' + (sinBiombo ? 'SB' : '') + idx + 'M');
  const devW = biombo ? 480 : 380;                                   // desarrollo transversal aprox (canal 117 alto)
  const area = mm(largo) * mm(devW);
  comp.push({ insumoId: LAMINA, nombre: `Estructura ducto Spine ${largo}mm (lámina cal.20)`, cantidad: laminaKg(area) * n });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática ducto', cantidad: area * n, largoMM: largo, anchoMM: devW });
  comp.push({ insumoId: TORN, nombre: 'Tornillería ducto + imanes IM175 (×8/ducto)', cantidad: n });
}

// Juego de tapas frontales según configuración y voz-datos.
function juegoFrontal(idx, tipo, electrico) {
  if (tipo === 'individual') return idx === '4' ? 'SPJGTFLTIDD4' : 'SPJGTFLTLD5';
  if (electrico) return idx === '4' ? 'SPJGTTVDID4' : 'SPJGTDBTVDL5';
  return idx === '4' ? 'SPJGTDHFBSVD4' : 'SPJGTDHFB1VD5';
}

// Tapas frontales metálicas: 2 por ducto (una por cara larga, ~115/145 × 13.7 cm).
// Con Byrne: troqueles voz-datos izq + der (NUNCA coincidentes). Sin: tapa ciega.
function emitTapasFrontales(comp, claves, largo, nDuctos, electrico, tipo) {
  const idx = IDX[largo];
  const tapas = 2 * nDuctos;
  const area = mm(largo) * mm(137);
  comp.push({ insumoId: LAMINA, nombre: 'Tapas frontales ducto (lámina cal.20)', cantidad: laminaKg(area) * tapas });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática tapas frontales', cantidad: area * tapas, largoMM: largo, anchoMM: 137 });
  if (idx === '4' || idx === '5') {
    if (electrico) claves.push('SPTDHBVDI' + idx + 'M', 'SPTDHBVDD' + idx + 'M');
    else claves.push('SPTAPDHC' + idx + 'M');
    claves.push(juegoFrontal(idx, tipo, electrico));
  }
}

// Tapas laterales de refuerzo SPTAPLRM (~124×102 mm). Toda config cierra con ellas.
function emitTapasLaterales(comp, claves, n) {
  const area = mm(124) * mm(102);
  comp.push({ insumoId: LAMINA, nombre: 'Tapas laterales de refuerzo SPTAPLRM (lámina cal.20)', cantidad: laminaKg(area) * n });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática tapas laterales', cantidad: area * n, largoMM: 124, anchoMM: 102 });
  claves.push('SPTAPLRM');
  if (n >= 2) claves.push('SPJGTLDHBVD');
}

// Patas base (SPPATBM, 2 niveladores c/u) + pata de unión (escuadra/T/cruz, 1 nivelador).
function emitPatas(comp, claves, patasBase, tipo) {
  if (patasBase > 0) {
    comp.push({ insumoId: PATA, nombre: 'Pata base SPPATBM (metal)', cantidad: patasBase });
    claves.push('SPPATBM');
  }
  let niv = patasBase * 2;
  const unionClave = UNION[tipo];
  if (unionClave) {
    comp.push({ insumoId: PATA, nombre: `Pata de unión ${UNION_LABEL[tipo]} (${unionClave})`, cantidad: 1 });
    claves.push(unionClave);
    niv += 1;
  }
  comp.push({ insumoId: NIVEL, nombre: 'Niveladores TO38112CNIC', cantidad: niv });
}

// Cubierta accesorio, fondo 750, lateralidad izq/der. Sólo largos 1200/1500.
function emitCubierta(comp, claves, largo, acab, lado, n) {
  const cidx = CUBIDX[largo];
  if (!cidx) return false;
  const fondo = 750;
  const ld = lado === 'I' ? 'I' : 'D';
  comp.push({ insumoId: acab.insumo, nombre: `Cubierta Spine ${acab.label} (${ld === 'D' ? 'derecha' : 'izquierda'})`, cantidad: n, largoMM: largo, anchoMM: fondo });
  comp.push({ insumoId: CANTO, nombre: 'Canto perímetro cubierta', cantidad: n * 2 * (mm(largo) + mm(fondo)) });
  claves.push('SPCUB' + ld + cidx + acab.suf);
  return true;
}

// Biombo acrílico (SPBIO##AC) o PET acústico (SPBIO##PT), 400 mm de alto + aumentos.
function emitBiombo(comp, claves, largo, material, n) {
  const idx = IDX[largo] || '5';
  const esPet = material === 'pet';
  comp.push({ insumoId: esPet ? PET : ACRIL, nombre: esPet ? 'Biombo acústico PET + aumentos metal' : 'Biombo acrílico + aumentos', cantidad: n, largoMM: largo, anchoMM: 400 });
  claves.push('SPBIO' + idx + (esPet ? 'PT' : 'AC'));
}

// Instalación eléctrica Byrne Phase 2: arnés + caja + acometida por ducto.
function emitElectrico(comp, electricos, nDuctos, largo) {
  comp.push({ insumoId: BYRNE, nombre: 'Arnés Byrne Phase 2 BE52413-2-2-30', cantidad: nDuctos });
  comp.push({ insumoId: CAJA, nombre: 'Caja eléctrica doble Byrne + contactos', cantidad: nDuctos });
  comp.push({ insumoId: ACOMETIDA, nombre: 'Acometida', cantidad: Math.max(1, Math.ceil(nDuctos / 4)) });
  const ext = largo >= 1500 ? '48” (BE52463-2-48)' : '42” (BE52463-2-42)';
  electricos.push(`${nDuctos} arnés Byrne BE52413-2-2-30 + jumper 18” (BE52463-2-18) / extensión ${ext}; conector en Y BE52418-2; acometida (se cotiza aparte)`);
}

export function generarSpine(config) {
  const c = {
    producto: 'configuracion', tipo: 'lineal', ductos: '2', largo: '1500',
    material: 'acrilico', lado: 'D', finish: 'HPELABS',
    biombo: false, cubierta: false, electrico: false, ...config,
  };
  const largo = num(c.largo, 1500);
  const acab = ACAB[c.finish] || ACAB.HPELABS;
  const comp = [], claves = [], electricos = [];
  let nombre = '';

  if (c.producto === 'biombo') {
    emitBiombo(comp, claves, largo, c.material, 1);
    nombre = `Spine · Biombo ${c.material === 'pet' ? 'PET acústico' : 'acrílico'} ${mm(largo).toFixed(2)} m`;

  } else if (c.producto === 'cubierta') {
    const ok = emitCubierta(comp, claves, largo, acab, c.lado, 1);
    nombre = `Spine · Cubierta ${acab.label} ${mm(largo).toFixed(2)} m (${c.lado === 'I' ? 'izquierda' : 'derecha'})` + (ok ? '' : ' — sin clave (sólo 1.20/1.50)');

  } else if (c.producto === 'ducto') {
    emitDucto(comp, claves, largo, c.biombo, 1);
    emitTapasFrontales(comp, claves, largo, 1, c.electrico, 'individual');
    emitTapasLaterales(comp, claves, 2);              // ducto individual cierra con 2 laterales
    emitPatas(comp, claves, 2, null);                 // 2 patas base
    if (c.biombo) emitBiombo(comp, claves, largo, c.material, 1);
    if (c.cubierta) emitCubierta(comp, claves, largo, acab, c.lado, 1);
    if (c.electrico) emitElectrico(comp, electricos, 1, largo);
    nombre = `Spine · Ducto individual ${mm(largo).toFixed(2)} m${c.biombo ? ' con biombo' : ''}`;

  } else {   // configuracion
    const tipo = c.tipo || 'lineal';
    const porLado = Math.min(4, Math.max(1, num(c.ductos, 2)));
    const brazos = { lineal: 1, escuadra: 2, T: 3, cruz: 4 }[tipo] || 1;
    const totalDuctos = tipo === 'lineal' ? Math.min(4, Math.max(2, porLado)) : brazos * porLado;
    const patasBase = tipo === 'lineal' ? totalDuctos + 1 : totalDuctos;   // radial: 1 base al extremo de cada ducto
    const laterales = tipo === 'lineal' ? 2 : brazos;                      // tapas laterales = extremos abiertos

    emitDucto(comp, claves, largo, c.biombo, totalDuctos);
    emitTapasFrontales(comp, claves, largo, totalDuctos, c.electrico, tipo);
    emitTapasLaterales(comp, claves, laterales);
    emitPatas(comp, claves, patasBase, tipo);
    if (c.biombo) emitBiombo(comp, claves, largo, c.material, totalDuctos);
    if (c.cubierta) emitCubierta(comp, claves, largo, acab, c.lado, totalDuctos);
    if (c.electrico) emitElectrico(comp, electricos, totalDuctos, largo);

    const nom = { lineal: 'Lineal', escuadra: 'Escuadra', T: '“T”', cruz: 'Cruz' }[tipo] || 'Lineal';
    nombre = `Spine · Configuración ${nom} · ${totalDuctos} ductos ${mm(largo).toFixed(2)} m`;
  }

  return {
    producto: c.producto, nombre, componentes: comp, claves, electricos,
    modoManoObra: 'porcentaje', factorDirecta: 38, factorIndirecta: 12,
    nota: 'Spine (Fase A): sistema modular que se arma por DUCTOS + PATAS (las cubiertas ' +
      'son accesorio). Ductos SPDUH##/SPDUHSB## (con/sin soporte biombo; el biombo conmuta el ducto), ' +
      'tapas frontales SPTDHBVDI/D · SPTAPDHC (ciega) · SPTAPDHSVDB · juegos SPJGT*, tapa lateral ' +
      'de refuerzo SPTAPLRM, patas base SPPATBM y de unión SPPATUEM/UTM/UCM, cubiertas SPCUBD/I##· ' +
      'biombos SPBIO##AC/PT. Máx 4 ductos por lado; toda config cierra con tapas laterales; troqueles ' +
      'Byrne SIEMPRE coinciden y voz-datos NUNCA. MP metálica estimada: lámina cal.20 desarrollada + ' +
      'pintura electrostática (ductos y tapas), pata-metalica por pata, tornillería como juego (incluye ' +
      'imanes IM175 ×8/ducto). Sin insumoId exacto: imán IM175, niveladores TO38112CNIC y tornillería ' +
      'allen se agrupan en "tornilleria"/"nivelador"; Ecolegno HPELABS se costea como "laminado". ' +
      'Falta calibrar con lista de MP real y desarrollo exacto de ducto/tapas/patas por clave.',
  };
}
