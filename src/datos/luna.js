// ============================================================================
//  GENERADOR LUNA · guía GE_Luna (ESP-DCC-IDP-003, v2 2025-09-09). Colección
//  EJECUTIVA: contraste de acero inoxidable (estructura pata tubular 1"x2"
//  cal.16 + marco de ángulo de 1 1/2" esp.3mm) con maderas, EcoPiel, Walnut
//  Burl y cristales. Escritorios (mesa de apoyo lateral / puente+credenza alta /
//  móvil+credenza baja), credenzas (alta 75 / baja 68) con archivero, y mesas
//  de juntas en cristal templado satín o mármol carrara, más mesa de trabajo.
//  Cubiertas MDF 19 enchapado 2 caras (chapa / EcoPiel / Walnut Burl). Claves LU.
//
//  ÍNDICES DE CLAVE (corregido según auditoría):
//   · escritorio/cubierta:  largo/30 + 30   (1500→35, 1800→36, 2100→37, 2400→38)
//   · credenza:             largo/30 + 20   (2100→27, 2400→28)
//   · faldón:               largo/300       (1500→5, 1800→6, 2100→7, 2400→8)
//   · mesa apoyo / puente:  1050→'235', 1200→'24'  (LUML/LUPU/LUCU)
//   · LUBA120 (124×74) y LUBA90 (90×90) son 2 tipos de PATA-BASE, NO tamaños.
// ============================================================================
const INOX = 'inoxidable', CHAPA = 'chapa-madera', WALNUT = 'chapa-walnut', MDF = 'mdf', ECOPIEL = 'ecopiel';
const CANTO = 'tapacanto', LAMINA = 'lamina-20', LAMINA14 = 'lamina-14', CAJA = 'caja-electrica';
const CRISTAL = 'cristal-templado', MARMOL = 'marmol';
const mm = (v) => (v / 1000);
const num = (v, def) => parseInt(v) || def;

// Acabado de cubierta: chapa (MDF enchapado), EcoPiel (MDF forrado) o Walnut Burl
// (chapa premium poro sellado). El faldón sólo existe en CH o WB (no EcoPiel).
const CUB = {
  chapa:   { sufCub: 'CH',   sufFald: 'CH',   insumo: CHAPA,   label: 'Chapa de madera' },
  ecopiel: { sufCub: 'EC',   sufFald: 'CH',   insumo: ECOPIEL, label: 'EcoPiel' },
  walnut:  { sufCub: 'CHWB', sufFald: 'CHWB', insumo: WALNUT,  label: 'Walnut Burl (chapa premium)' },
};
const CUBS = [
  { id: 'chapa', label: 'Chapa de madera' },
  { id: 'ecopiel', label: 'EcoPiel' },
  { id: 'walnut', label: 'Walnut Burl' },
];

export const LUNA_PRODUCTOS = [
  {
    id: 'escritorio', nombre: 'Escritorio ejecutivo',
    selects: [
      { key: 'config', label: 'Configuración', opciones: [
        { id: 'lateral', label: 'Mesa de apoyo lateral' },
        { id: 'puente', label: 'Puente + credenza alta' },
        { id: 'movil', label: 'Móvil + credenza baja' },
      ] },
      { key: 'largo', label: 'Largo escritorio', opciones: [
        { id: '1500', label: '1.50 m' }, { id: '1800', label: '1.80 m' },
        { id: '2100', label: '2.10 m' }, { id: '2400', label: '2.40 m' },
      ] },
      { key: 'apoyo', label: 'Mesa apoyo / puente', opciones: [
        { id: '1050', label: '1.05 m' }, { id: '1200', label: '1.20 m' },
      ] },
    ],
    finishes: CUBS,
    checks: [{ key: 'archivero', label: 'Archivero' }, { key: 'electrico', label: 'Acometida eléctrica' }],
  },
  {
    id: 'credenza', nombre: 'Credenza',
    selects: [
      { key: 'tipo', label: 'Tipo', opciones: [{ id: 'alta', label: 'Alta (75)' }, { id: 'baja', label: 'Baja (68)' }] },
      { key: 'largo', label: 'Largo', opciones: [{ id: '2100', label: '2.10 m' }, { id: '2400', label: '2.40 m' }] },
    ],
    finishes: CUBS,
    checks: [{ key: 'archivero', label: 'Archivero' }, { key: 'electrico', label: 'Caja eléctrica + ducto' }],
  },
  {
    id: 'mesa_juntas', nombre: 'Mesa de juntas',
    selects: [
      { key: 'cubierta', label: 'Cubierta', opciones: [
        { id: 'cristal', label: 'Cristal templado satín (2.40)' },
        { id: 'marmol', label: 'Mármol carrara (1.80)' },
      ] },
    ],
    checks: [{ key: 'electrico', label: 'Cajas eléctricas Node + ducto + acometida' }],
  },
  {
    id: 'mesa_trabajo', nombre: 'Mesa de trabajo (circular)',
    selects: [{ key: 'diametro', label: 'Diámetro', opciones: [{ id: '1200', label: 'Ø 1.20 m' }] }],
  },
];

// --- Índices de clave -------------------------------------------------------
const idxEsc  = (L) => Math.round(L / 300) + 30;  // 1500→35 … 2400→38 (mm/10 → cm, /30)
const idxCred = (L) => Math.round(L / 300) + 20;  // 2100→27, 2400→28
const idxFa   = (L) => Math.round(L / 300);       // 1500→5 … 2400→8
const idxApoyo = (L) => (L <= 1050 ? '235' : '24'); // 105→'235', 120→'24'

// Estructura de acero inoxidable (patas tubulares 1"x2" cal.16 + marco de ángulo), en kg.
const inoxKg = (kg, nombre, clave) => ({ insumoId: INOX, nombre: `${nombre}${clave ? ' (' + clave + ')' : ''}`, cantidad: kg });

// Cubierta enchapada (chapa / Walnut Burl) o forrada (EcoPiel), como pieza de área.
function cubierta(comp, largoMM, fondoMM, acab, etiqueta) {
  if (acab.insumo === ECOPIEL) {
    comp.push({ insumoId: MDF, nombre: `${etiqueta} · núcleo MDF 19`, cantidad: 1, largoMM, anchoMM: fondoMM });
    comp.push({ insumoId: ECOPIEL, nombre: `${etiqueta} · forro EcoPiel`, cantidad: mm(largoMM) * mm(fondoMM) / 0.55 });
  } else {
    comp.push({ insumoId: acab.insumo, nombre: `${etiqueta} · MDF 19 enchapado ${acab.label}`, cantidad: 1, largoMM, anchoMM: fondoMM });
    comp.push({ insumoId: CANTO, nombre: `${etiqueta} · canto`, cantidad: 2 * (mm(largoMM) + mm(fondoMM)) });
  }
}

// Faldón de madera (MDF 19 enchapado 2 caras). Sólo CH o WB.
function faldon(comp, largoMM, altoMM, acab, etiqueta) {
  const insumo = acab.insumo === ECOPIEL ? CHAPA : acab.insumo;
  comp.push({ insumoId: insumo, nombre: `${etiqueta} · MDF 19 enchapado`, cantidad: 1, largoMM, anchoMM: altoMM });
}

export function generarLuna(config) {
  const c = {
    producto: 'escritorio', largo: '2100', config: 'lateral', apoyo: '1200',
    tipo: 'alta', cubierta: 'cristal', diametro: '1200',
    finish: 'chapa', archivero: false, electrico: false, ...config,
  };
  const acab = CUB[c.finish] || CUB.chapa;
  const comp = [];
  const claves = [];
  const electricos = [];
  let tipoRender = 'escritorio', nombre = '';

  if (c.producto === 'escritorio') {
    const fondo = 900;
    const largo = num(c.largo, 2100);
    const apoyo = num(c.apoyo, 1200);

    // --- Estructura escritorio + cubierta + faldón (común a las 3 configs) ---
    if (c.config === 'movil') {
      // Estructura móvil sólo existe en 210/240 (LUESC37/38IN).
      const Lm = largo < 2100 ? 2100 : largo;
      comp.push(inoxKg(13 + mm(Lm) * 6, 'Estructura escritorio móvil (inox)', 'LUESC' + idxEsc(Lm) + 'IN'));
      comp.push({ insumoId: 'rodaja', nombre: 'Rodajas escritorio móvil', cantidad: 4 });
      claves.push('LUESC' + idxEsc(Lm) + 'IN', 'LUCU' + idxEsc(Lm) + acab.sufCub);
      cubierta(comp, Lm, fondo, acab, 'Cubierta escritorio');
    } else {
      comp.push(inoxKg(12 + mm(largo) * 6, 'Estructura escritorio (inox)', 'LUES' + idxEsc(largo) + 'IN'));
      cubierta(comp, largo, fondo, acab, 'Cubierta escritorio');
      faldon(comp, largo, 320, acab, 'Faldón escritorio');
      claves.push('LUES' + idxEsc(largo) + 'IN', 'LUCU' + idxEsc(largo) + acab.sufCub, 'LUFA' + idxFa(largo) + acab.sufFald);
    }

    if (c.config === 'lateral') {
      // Mesa de apoyo lateral: LUML235IN (105) / LUML24IN (120) + cubierta LUCU235/LUCU24.
      comp.push(inoxKg(8, 'Estructura mesa de apoyo lateral (inox)', 'LUML' + idxApoyo(apoyo) + 'IN'));
      cubierta(comp, apoyo, 600, acab, 'Cubierta lateral');
      claves.push('LUML' + idxApoyo(apoyo) + 'IN', 'LUCU' + idxApoyo(apoyo) + acab.sufCub);
      if (c.electrico) {
        comp.push({ insumoId: LAMINA, nombre: 'Ducto acometida escritorio (LUAC, inox cal.20)', cantidad: 2.5 });
        claves.push('LUAC'); electricos.push('Acometida LUAC');
      }
      tipoRender = 'estacion';
      nombre = `Luna · Escritorio ${mm(largo).toFixed(2)} m con mesa de apoyo ${mm(apoyo).toFixed(2)} m · ${acab.label}`;

    } else if (c.config === 'puente') {
      // Puente (LUPU235IN/LUPU24IN) es pieza SEPARADA de la credenza alta (LUCRA).
      const Lc = largo < 2100 ? 2100 : largo; // credenza alta sólo 210/240
      comp.push(inoxKg(6, 'Estructura puente de apoyo (inox)', 'LUPU' + idxApoyo(apoyo) + 'IN'));
      comp.push(inoxKg(10 + mm(Lc) * 3, 'Estructura credenza alta (inox)', 'LUCRA' + idxCred(Lc) + 'IN'));
      // Cubierta credenza: con caja eléctrica LUCUC, sin caja LUCU.
      const sufCubC = (c.electrico ? 'LUCUC' : 'LUCU') + idxCred(Lc) + acab.sufCub;
      cubierta(comp, Lc, 600, acab, 'Cubierta credenza alta');
      faldon(comp, Lc, 680, acab, 'Faldón credenza alta'); // faldón credenza alto 68 cm
      comp.push({ insumoId: LAMINA, nombre: 'Ducto credenza (LUDUCR2400-CU, lámina cal.20)', cantidad: 3 });
      claves.push('LUPU' + idxApoyo(apoyo) + 'IN', 'LUCRA' + idxCred(Lc) + 'IN', sufCubC,
        'LUFA' + idxFa(Lc) + 'CRA' + acab.sufFald, 'LUDUCR2400-CU');
      if (c.electrico) {
        comp.push({ insumoId: CAJA, nombre: 'Caja eléctrica credenza', cantidad: 1 });
        comp.push({ insumoId: LAMINA, nombre: 'Ducto acometida escritorio (LUAC, inox cal.20)', cantidad: 2.5 });
        claves.push('LUAC'); electricos.push('Caja credenza + acometida LUAC');
      }
      tipoRender = 'estacion';
      nombre = `Luna · Escritorio ${mm(largo).toFixed(2)} m con puente y credenza alta · ${acab.label}`;

    } else { // movil + credenza baja
      const Lc = largo < 2100 ? 2100 : largo; // credenza baja sólo 210/240
      comp.push(inoxKg(10 + mm(Lc) * 3, 'Estructura credenza baja (inox)', 'LUCR' + idxCred(Lc) + 'IN'));
      const sufCubC = (c.electrico ? 'LUCUC' : 'LUCU') + idxCred(Lc) + acab.sufCub;
      cubierta(comp, Lc, 600, acab, 'Cubierta credenza baja');
      faldon(comp, Lc, 680, acab, 'Faldón credenza baja'); // faldón credenza baja alto 68 cm
      // Riel deslizador: lámina negra cal.14 + MDF 28 (LUCR7 / LUCR8).
      comp.push({ insumoId: LAMINA14, nombre: 'Riel deslizador (lámina cal.14 + MDF 28)', cantidad: 1, largoMM: Lc, anchoMM: 640 });
      comp.push({ insumoId: LAMINA, nombre: 'Ducto credenza (LUDU1500, lámina cal.20)', cantidad: 3 });
      claves.push('LUCR' + idxCred(Lc) + 'IN', sufCubC, 'LUFA' + idxFa(Lc) + 'CR' + acab.sufFald,
        'LUCR' + idxFa(Lc), 'LUDU1500');
      if (c.electrico) {
        comp.push({ insumoId: CAJA, nombre: 'Caja eléctrica credenza', cantidad: 1 });
        electricos.push('Caja credenza baja');
      }
      tipoRender = 'escritorio';
      nombre = `Luna · Escritorio móvil ${mm(largo < 2100 ? 2100 : largo).toFixed(2)} m con credenza baja · ${acab.label}`;
    }

    if (c.archivero) {
      comp.push({ insumoId: MDF, nombre: 'Archivero MDF 19 enchapado', cantidad: 1, largoMM: 400, anchoMM: 600 });
      comp.push({ insumoId: 'corredera', nombre: 'Correderas archivero', cantidad: 2 });
      comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras archivero', cantidad: 2 });
      comp.push({ insumoId: 'cerradura', nombre: 'Cerradura archivero', cantidad: 1 });
    }
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores / tornillo nivelador cromado', cantidad: 4 });

  } else if (c.producto === 'credenza') {
    const largo = num(c.largo, 2100);
    const alta = c.tipo === 'alta';
    comp.push(inoxKg(10 + mm(largo) * 3, `Estructura credenza ${c.tipo} (inox)`, (alta ? 'LUCRA' : 'LUCR') + idxCred(largo) + 'IN'));
    const sufCubC = (c.electrico ? 'LUCUC' : 'LUCU') + idxCred(largo) + acab.sufCub;
    cubierta(comp, largo, 600, acab, 'Cubierta credenza');
    faldon(comp, largo, 680, acab, `Faldón credenza ${c.tipo}`); // ambos 68 cm
    if (c.electrico) {
      comp.push({ insumoId: CAJA, nombre: 'Caja eléctrica credenza', cantidad: 1 });
      comp.push({ insumoId: LAMINA, nombre: `Ducto credenza (${alta ? 'LUDUCR2400-CU' : 'LUDU1500'}, lámina cal.20)`, cantidad: 3 });
      electricos.push('Caja + ducto credenza');
    }
    if (c.archivero) {
      comp.push({ insumoId: MDF, nombre: 'Archivero MDF 19 enchapado', cantidad: 1, largoMM: 400, anchoMM: 600 });
      comp.push({ insumoId: 'corredera', nombre: 'Correderas archivero', cantidad: 2 });
      comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras archivero', cantidad: 2 });
      comp.push({ insumoId: 'cerradura', nombre: 'Cerradura archivero', cantidad: 1 });
    }
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    claves.push((alta ? 'LUCRA' : 'LUCR') + idxCred(largo) + 'IN', sufCubC,
      'LUFA' + idxFa(largo) + (alta ? 'CRA' : 'CR') + acab.sufFald);
    tipoRender = 'guarda';
    nombre = `Luna · Credenza ${c.tipo} ${mm(largo).toFixed(2)} m · ${acab.label}`;

  } else if (c.producto === 'mesa_juntas') {
    const esMarmol = c.cubierta === 'marmol';
    const largo = esMarmol ? 1800 : 2400; // cristal sólo 240; mármol 180
    const fondo = 1200;
    // Estructura mesa de juntas sobre pata-base LUBA120 (124×74).
    comp.push(inoxKg(22 + mm(largo) * 8, 'Estructura mesa de juntas (inox, base LUBA120)', 'LUBA120'));
    if (esMarmol) {
      // Cubierta ovalada mármol carrara 20 mm, con saques para caja (LUCE46MAN). SIN brazo, SIN ventosas.
      comp.push({ insumoId: MARMOL, nombre: 'Cubierta ovalada mármol carrara 20mm', cantidad: 1, largoMM: largo, anchoMM: fondo });
      claves.push('LUBA120', 'LUCE46MAN');
    } else {
      // Cubierta ovalada cristal templado 9 mm satín color plata.
      comp.push({ insumoId: CRISTAL, nombre: 'Cubierta ovalada cristal templado 9mm satín plata', cantidad: 1, largoMM: largo, anchoMM: fondo });
      comp.push(inoxKg(4, 'Brazos soporte (2 pza inox, sólo cristal)', 'brazo soporte 1"x2" cal.16'));
      comp.push({ insumoId: 'silicon', nombre: 'Ventosas VETAMI42 (sólo cristal)', cantidad: 4 });
      // Clave según caja: 3 cajas→LUCE48CSCN, sin caja→LUCE48CSCSP.
      claves.push('LUBA120', c.electrico ? 'LUCE48CSCN' : 'LUCE48CSCSP');
    }
    if (c.electrico) {
      const nCajas = esMarmol ? 1 : 3;
      comp.push({ insumoId: CAJA, nombre: `Cajas eléctricas Node BE0335911DZCM172 (×${nCajas})`, cantidad: nCajas });
      comp.push({ insumoId: LAMINA, nombre: 'Ducto para mesa (LUACMJ, lámina negra cal.20)', cantidad: 2 });
      comp.push({ insumoId: LAMINA, nombre: 'Ducto acometida (inox cal.20)', cantidad: 2 });
      claves.push('LUACMJ');
      electricos.push(`${nCajas}× caja Node BE0335911DZCM172 + ducto LUACMJ + acometida`);
    }
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    tipoRender = 'mesa';
    nombre = `Luna · Mesa de juntas ${esMarmol ? 'mármol' : 'cristal'} ${mm(largo).toFixed(2)} m`;

  } else if (c.producto === 'mesa_trabajo') {
    const dia = num(c.diametro, 1200);
    // Estructura mesa de trabajo sobre pata-base LUBA90 (90×90); cubierta cristal laminado CR4LB.
    comp.push(inoxKg(14, 'Estructura mesa de trabajo (inox, base LUBA90)', 'LUBA90'));
    comp.push({ insumoId: 'cristal-templado', nombre: 'Cubierta circular cristal laminado blanco (CR4LB)', cantidad: 1, largoMM: dia, anchoMM: dia });
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    claves.push('LUBA90', 'CR4LB');
    tipoRender = 'mesa';
    nombre = `Luna · Mesa de trabajo circular Ø ${mm(dia).toFixed(2)} m`;
  }

  return {
    producto: c.producto, nombre, componentes: comp, claves, electricos,
    modoManoObra: 'porcentaje', factorDirecta: 40, factorIndirecta: 15,
    nota: 'Luna (Fase A): línea ejecutiva inox + madera/cristal/mármol. Claves e índices reales de la guía GE_Luna (escritorio largo/30+30, credenza largo/30+20, faldón largo/300, apoyo/puente 235|24). Materiales sin insumoId exacto: acero inoxidable tubular usa "inoxidable" por kg (patas 1"x2" cal.16 + marco de ángulo y brazos soporte); Walnut Burl usa "chapa-walnut"; ductos/acometidas y riel usan "lamina-20"/"lamina-14"; ventosas VETAMI42 usan "silicon"; cristal laminado de mesa de trabajo usa "cristal-templado"; cajas Node BE0335911DZCM172 usan "caja-electrica". Falta calibrar con lista de MP real + desarrollo exacto de la estructura tubular inox y cristal/mármol ovalado por clave.',
  };
}
