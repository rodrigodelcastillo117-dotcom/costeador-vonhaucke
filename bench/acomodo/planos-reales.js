// ============================================================================
//  BANCO LOCAL · CASOS DERIVADOS DE PLANOS REALES DE RODRIGO (congelados).
//
//  PROVENANCE (regla de planos reales): sólo se usan planos que EXISTEN y están
//  versionados en el repo. Para cada caso se enumera archivo + ruta + hash git +
//  qué zonas reales derivan en el caso. Los PDF crudos de oficinas reales NO están
//  versionados (sólo copias en scratchpad, no versionadas, y un two-page.pdf
//  genérico de auth) → se reporta FUENTE_FALTANTE, sin sustituir por sintéticos.
//
//  Qué se deriva: la GEOMETRÍA REAL de las zonas (envolvente/bbox + puertas) de
//  cada plano. El programa de mobiliario es un conjunto REPRESENTATIVO, válido por
//  catálogo, dimensionado para caber en cada zona real; NO es una reconstrucción
//  del conteo exacto de muebles del plano. Cada caso trae witness validado por el
//  JUEZ NEUTRAL (prueba de factibilidad); al solver sólo se le pasa areas+piezas.
// ============================================================================
import { kitWorkstation, kitMeeting, kitPrivado, kitReception } from './casos-dificiles.js';

export const FUENTES = [
  {
    archivo: 'planoGolden132.test.js', ruta: 'src/datos/planoGolden132.test.js',
    hash_git: '7577ab48af2790522ff076632ea2fe9f117d2143',
    deriva: 'real01 · QA-COT-01 132 m² (envolvente 15000×8800; zonas OPEN SPACE 8 puestos, DIRECCION, SALA DE JUNTAS, RECEPCION; 1 puerta real de OPEN SPACE)',
  },
  {
    archivo: 'planoDeRodrigo.test.js', ruta: 'src/datos/planoDeRodrigo.test.js',
    hash_git: '6d08e3eff01072e37c151babc4add30d2b7a3fca',
    deriva: 'real02 · plano Rodrigo (islas operativas 4.5×3.5 m, privados, salas de juntas, recepción; programa representativo que cabe en cada zona real)',
  },
];

// Planos crudos (PDF/imagen) de oficinas reales versionados en el repo:
export const FUENTE_FALTANTE = {
  buscado: 'PDF/imagen de plano real de cliente, versionado, que entre por el pipeline leer-plano',
  hallado: 'NINGUNO versionado. e2e/fixtures/two-page.pdf (890 B) es genérico de auth; las copias en scratchpad/ NO están en git.',
  accion: 'FUENTE_FALTANTE — no se sustituye por caso sintético ni se reconstruye de memoria.',
};

// Ensambla un caso multi-área: zonas=[{area, kits:[{kit,x,y}]}].
function multiArea(nombre, zonas, extra = {}) {
  const areas = zonas.map((z) => z.area);
  const program = [];
  const witnessColoc = [];
  const ownerAll = {};
  zonas.forEach((z, ai) => {
    for (const { kit, x, y } of z.kits) {
      program.push(...kit.program);
      const { coloc, owner } = kit.place(x, y);
      witnessColoc.push(...coloc.map((c) => ({ ...c, area: ai })));
      Object.assign(ownerAll, owner);
    }
  });
  const witnessPiezas = program.map((p) => ({ ...p, anchor_instance_id: ownerAll[p.id] ?? null }));
  return { nombre, factible: true, real: true, areas, piezas: program, witnessPiezas, witnessColoc, ...extra };
}

const area = (nombre, zone, tipo, ancho, largo, extra = {}) => ({ nombre, zone_id: zone, tipo, ancho, largo, ...extra });

export function construirPlanosReales() {
  const casos = [];

  // real01 · QA-COT-01 132 m². Zonas = bbox reales del golden (mm). Puerta real de
  // OPEN SPACE (envolvente x3300,y6800 → local a la zona: x0,y6800).
  {
    const open = area('OPEN SPACE', 'OPEN SPACE', 'open', 7200, 8800, { puertas: [{ x: 0, y: 6800, ancho: 900 }] });
    const direccion = area('DIRECCION', 'DIRECCION', 'privado', 4500, 3000);
    const juntas = area('SALA DE JUNTAS', 'SALA DE JUNTAS', 'juntas', 4500, 3111);
    const recep = area('RECEPCION', 'RECEPCION', 'recepcion', 3300, 2727);
    const w1 = kitWorkstation('gOpen1', 'OPEN SPACE', 4), w2 = kitWorkstation('gOpen2', 'OPEN SPACE', 4);
    const dir = kitPrivado('gDir', 'DIRECCION');
    const mesa = kitMeeting('gJun', 'SALA DE JUNTAS', 8);
    const rec = kitReception('gRec', 'RECEPCION', 2);
    casos.push(multiArea('real01 · QA-COT-01 132 m²', [
      { area: open, kits: [{ kit: w1, x: 100, y: 100 }, { kit: w2, x: 100, y: 2900 }] },
      { area: direccion, kits: [{ kit: dir, x: 100, y: 100 }] },
      { area: juntas, kits: [{ kit: mesa, x: 100, y: 100 }] },
      { area: recep, kits: [{ kit: rec, x: 100, y: 100 }] },
    ], { fuente: 'planoGolden132.test.js@7577ab48' }));
  }

  // real02 · plano Rodrigo. Zonas reales (m→mm). Programa representativo que CABE.
  {
    const isla1 = area('Área Op. 1', 'Área Op. 1', 'open', 4500, 3500);
    const isla2 = area('Área Op. 2', 'Área Op. 2', 'open', 4500, 3500);
    const priv = area('Privado 1', 'Privado 1', 'privado', 4500, 5000);
    const sala = area('Sala Juntas 1', 'Sala Juntas 1', 'juntas', 7000, 6000);
    const recep = area('Recepción', 'Recepción', 'recepcion', 7000, 8000);
    const op1 = kitWorkstation('gIsla1', 'Área Op. 1', 2);   // 3000×1800 cabe en 4500×3500
    const op2 = kitWorkstation('gIsla2', 'Área Op. 2', 2);
    const d1 = kitPrivado('gPriv1', 'Privado 1');
    const mesa = kitMeeting('gSala1', 'Sala Juntas 1', 8);
    const rec = kitReception('gRecep', 'Recepción', 3);
    casos.push(multiArea('real02 · plano Rodrigo (zonas reales)', [
      { area: isla1, kits: [{ kit: op1, x: 100, y: 100 }] },
      { area: isla2, kits: [{ kit: op2, x: 100, y: 100 }] },
      { area: priv, kits: [{ kit: d1, x: 100, y: 100 }] },
      { area: sala, kits: [{ kit: mesa, x: 100, y: 100 }] },
      { area: recep, kits: [{ kit: rec, x: 100, y: 100 }] },
    ], { fuente: 'planoDeRodrigo.test.js@6d08e3ef' }));
  }

  return casos;
}
