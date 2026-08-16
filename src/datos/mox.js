// ============================================================================
//  GENERADOR MOX · guía GE_Mox (ESP-DCC-IDP-003, v6 2025-09-09). Sistema de
//  GAVETAS (guardas ligeras, bajo costo): gaveta rodante (con ruedas) y gaveta
//  pedestal (fija, alta). Frentes en melamina canto ABS o en lámina; tapa en
//  melamina / metálica / cojín tapizado en tela. Cuerpo metálico ligero.
//  Claves MOX. FASE A: estructura + dimensiones reales de la guía; MP estimada.
// ============================================================================
const CUERPO = 'lamina-20', MEL = 'melamina-19', CANTO = 'tapacanto';
const ESPUMA = 'espuma', TELA = 'tela', MDF = 'mdf-16', PINTURA = 'pintura-electrostatica';
const KG20 = 7.16; // kg de lámina cal.20 por m²
const laminaKg = (m2) => m2 * KG20;

export const MOX_PRODUCTOS = [
  {
    id: 'rodante', nombre: 'Gaveta rodante',
    selects: [
      { key: 'frentes', label: 'Frentes', opciones: [{ id: 'melamina', label: 'Melamina ABS' }, { id: 'lamina', label: 'Lámina' }] },
      { key: 'tapa', label: 'Tapa', opciones: [{ id: 'melamina', label: 'Melamina' }, { id: 'metal', label: 'Metálica' }, { id: 'cojin', label: 'Cojín tapizado (tela)' }] },
    ],
    checks: [{ key: 'cerradura', label: 'Cerradura' }, { key: 'lapicera', label: 'Lapicera' }],
  },
  {
    id: 'pedestal', nombre: 'Gaveta pedestal',
    selects: [
      { key: 'frentes', label: 'Frentes', opciones: [{ id: 'melamina', label: 'Melamina ABS' }, { id: 'lamina', label: 'Lámina' }] },
    ],
    checks: [{ key: 'cerradura', label: 'Cerradura' }],
  },
];

const mm = (v) => (v / 1000);

export function generarMox(config) {
  const c = { producto: 'rodante', frentes: 'melamina', tapa: 'melamina', cerradura: true, lapicera: false, ...config };
  const comp = [];
  const claves = [];

  const rodante = c.producto === 'rodante';
  const ancho = 380;
  // Fondo por variante: rodante melamina 460 / lámina 480; pedestal 456 (guía §Componentes).
  const fondo = rodante ? (c.frentes === 'lamina' ? 480 : 460) : 456;
  // Alto del rodante varía según la tapa: metálica 561 / melamina 580 / cojín 600. Pedestal 720.
  const alto = rodante ? ({ metal: 561, melamina: 580, cojin: 600 }[c.tapa] || 580) : 720;
  const cajones = rodante ? 2 : 3; // rodante: archivero+papelero · pedestal: archivero+2 papeleros

  // Cuerpo metálico ligero (laterales + piso + respaldo)
  const areaCuerpo = 2 * mm(fondo) * mm(alto) + mm(ancho) * mm(fondo) + mm(ancho) * mm(alto);
  comp.push({ insumoId: CUERPO, nombre: 'Cuerpo metálico (lámina cal.20)', cantidad: laminaKg(areaCuerpo) });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática cuerpo', cantidad: areaCuerpo, largoMM: alto, anchoMM: fondo });

  // Frentes de cajones (melamina ABS o lámina)
  const altoFrente = Math.round(alto / cajones);
  if (c.frentes === 'melamina') {
    comp.push({ insumoId: MEL, nombre: 'Frentes de cajón (melamina)', cantidad: cajones, largoMM: ancho, anchoMM: altoFrente });
    comp.push({ insumoId: CANTO, nombre: 'Canto ABS frentes', cantidad: cajones * 2 * (mm(ancho) + mm(altoFrente)) });
  } else {
    comp.push({ insumoId: CUERPO, nombre: 'Frentes de cajón (lámina)', cantidad: laminaKg(cajones * mm(ancho) * mm(altoFrente)) });
  }

  // Cajones interiores (cajas de lámina) + correderas + jaladeras
  comp.push({ insumoId: CUERPO, nombre: 'Cajas de cajón (lámina cal.20)', cantidad: laminaKg(cajones * 0.35) });
  comp.push({ insumoId: 'corredera', nombre: 'Correderas', cantidad: cajones });
  comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras metálicas', cantidad: cajones });

  // Tapa / cubierta (solo aplica selección en rodante; pedestal lleva tapa melamina)
  const tapa = rodante ? c.tapa : 'melamina';
  if (tapa === 'cojin') {
    comp.push({ insumoId: MDF, nombre: 'Base cojín (MDF)', cantidad: 1, largoMM: ancho, anchoMM: fondo });
    comp.push({ insumoId: ESPUMA, nombre: 'Espuma cojín', cantidad: 1, largoMM: ancho, anchoMM: fondo });
    comp.push({ insumoId: TELA, nombre: 'Tela tapiz cojín', cantidad: mm(ancho) * mm(fondo) / 0.55 });
  } else if (tapa === 'metal') {
    comp.push({ insumoId: CUERPO, nombre: 'Tapa metálica (lámina cal.20)', cantidad: laminaKg(mm(ancho) * mm(fondo)) });
  } else {
    comp.push({ insumoId: MEL, nombre: 'Tapa melamina', cantidad: 1, largoMM: ancho, anchoMM: fondo });
    comp.push({ insumoId: CANTO, nombre: 'Canto ABS tapa', cantidad: 2 * (mm(ancho) + mm(fondo)) });
  }

  // Accesorios
  if (rodante) comp.push({ insumoId: 'rodaja', nombre: 'Rodajas', cantidad: 4 });
  else comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
  if (c.cerradura) comp.push({ insumoId: 'cerradura', nombre: 'Cerradura metálica', cantidad: 1 });
  if (rodante && c.lapicera) comp.push({ insumoId: 'tornilleria', nombre: 'Lapicera', cantidad: 1 });

  // Clave: MOXGA + R/P + n + F + M/L (+ T tapa)
  const claveTapa = tapa === 'cojin' ? 'TT' : tapa === 'metal' ? 'TL' : 'TM';
  claves.push('MOXGA' + (rodante ? 'R' : 'P') + cajones + 'F' + (c.frentes === 'melamina' ? 'M' : 'L') + (rodante ? claveTapa : ''));

  const nombre = `Mox · Gaveta ${rodante ? 'rodante' : 'pedestal'} ${cajones} cajones · frentes ${c.frentes === 'melamina' ? 'melamina' : 'lámina'}${rodante ? ` · tapa ${tapa}` : ''}`;
  return {
    producto: c.producto, nombre, componentes: comp, claves, electricos: [],
    modoManoObra: 'porcentaje', factorDirecta: 34, factorIndirecta: 12,
    nota: 'Mox (Fase A): gavetas ligeras (lámina + melamina). Dimensiones reales de la guía GE_Mox; MP estimada (lámina cal.20 cuerpo/cajas, melamina 19 canto ABS, espuma/tela cojín). Falta calibrar con lista de MP real + desarrollo exacto de cajones y correderas por clave.',
  };
}
