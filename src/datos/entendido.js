// ============================================================================
//  "ESTO ENTENDÍ" · lectura humana de las partidas antes de acomodar
// ============================================================================
import { tipoDe, vaBajoEscritorio } from './espacio.js';
import { esSillaDeVisita } from './planner.js';
import { puestosDe } from './porCuarto.js';

const sinAcento = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esBench = (pt) => /banca|bench/.test(sinAcento(pt.nombre)) || puestosDe(pt.nombre) > 1;

// Sólo una silla inequívocamente de puesto entra como "silla de trabajo".
// Antes SONATA/juntas se mezclaba aquí y aparecía "49 para 28: sobran 21".
const esSillaPuesto = (pt) => {
  const n = sinAcento(pt?.nombre);
  return /operativ|directiv|ejecutiv|\bwin(?:-cab)?\b|gamma|\bdex\b|c4-|\balpha\b|\benergy\b/.test(n);
};
const esAsiento = (pt) => tipoDe(pt) === 'asiento';

const GRUPOS = [
  { clave: 'puestos', titulo: 'Puestos de trabajo', unidad: 'personas',
    es: (pt) => tipoDe(pt) === 'escritorio', cuenta: (pt) => puestosDe(pt.nombre, pt.cantidad) },
  { clave: 'juntas', titulo: 'Mesas de juntas', unidad: 'mesas', es: (pt) => tipoDe(pt) === 'juntas' },
  { clave: 'guardas', titulo: 'Guardado de piso', unidad: 'muebles',
    es: (pt) => tipoDe(pt) === 'guarda' && !vaBajoEscritorio(pt) },
  { clave: 'gavetas', titulo: 'Gavetas bajo la cubierta', unidad: 'gavetas', es: (pt) => vaBajoEscritorio(pt) },
  { clave: 'sillas', titulo: 'Sillas de trabajo', unidad: 'sillas',
    es: (pt) => esAsiento(pt) && esSillaPuesto(pt) && !esSillaDeVisita({ tipo: 'asiento', nombre: pt.nombre }) },
  { clave: 'visita', titulo: 'Sillas de visita', unidad: 'sillas',
    es: (pt) => esAsiento(pt) && esSillaDeVisita({ tipo: 'asiento', nombre: pt.nombre }) },
  { clave: 'reunion', titulo: 'Sillas de reunión / otras', unidad: 'sillas', es: (pt) => esAsiento(pt) },
  { clave: 'mamparas', titulo: 'Mamparas y muros', unidad: 'piezas', es: (pt) => tipoDe(pt) === 'mampara' },
  { clave: 'otros', titulo: 'Lo demás', unidad: 'piezas', es: () => true },
];

const esPrivado = (a) => /priv|direcc|gerenc|oficina/.test(sinAcento(a?.nombre)) || a?.tipo === 'privado';

export function loQueEntendi(partidas = [], areasM = []) {
  const grupos = GRUPOS.map((g) => ({ ...g, renglones: [], cuentaTotal: 0 }));
  for (const pt of partidas) {
    const g = grupos.find((x) => x.es(pt));
    g.renglones.push({ id: pt.id, nombre: pt.nombre, cantidad: pt.cantidad || 0 });
    g.cuentaTotal += g.cuenta ? g.cuenta(pt) : (pt.cantidad || 0);
  }
  const vivos = grupos.filter((g) => g.renglones.length).map(({ es, cuenta, ...g }) => g);
  const de = (clave) => vivos.find((g) => g.clave === clave)?.cuentaTotal || 0;
  const puestos = de('puestos');
  const sillas = de('sillas');
  const visitas = de('visita');
  const reunion = de('reunion');
  const gavetas = de('gavetas');
  const totalSillas = sillas + visitas + reunion;

  const cuartos = (areasM || []).map((a) => ({
    nombre: a.nombre,
    m2: Math.round((a.ancho || 0) * (a.largo || 0)),
    privado: esPrivado(a),
  }));
  const espacio = {
    hay: cuartos.length > 0,
    m2: Math.round(cuartos.reduce((s, c) => s + c.m2, 0)),
    cuartos,
    privados: cuartos.filter((c) => c.privado).length,
    pisos: new Set((areasM || []).map((a) => a.nivel ?? 0)).size,
  };

  const avisos = [];
  if (!espacio.hay) avisos.push({ tono: 'ambar', texto: 'Todavía no me dijiste dónde va el proyecto. Sin espacio no puedo acomodar.' });

  // Visitas pueden cubrir provisionalmente un puesto si faltan sillas, para no
  // romper el chequeo histórico; PERO jamás generan un "sobran" de trabajo.
  // Las de reunión tampoco participan en ninguna de las dos cuentas.
  if (puestos > 0 && sillas + visitas < puestos) {
    avisos.push({ tono: 'ambar', texto: `Son ${puestos} puestos de trabajo y ${sillas + visitas} silla(s): faltan ${puestos - sillas - visitas}.` });
  }
  if (puestos > 0 && sillas > puestos) {
    avisos.push({ tono: 'ambar', texto: `Hay ${sillas} sillas de trabajo para ${puestos} puestos: sobran ${sillas - puestos}.` });
  }
  if (gavetas > puestos && puestos > 0) {
    avisos.push({ tono: 'ambar', texto: `Hay ${gavetas} gavetas para ${puestos} puestos: sobran ${gavetas - puestos}.` });
  }
  if (espacio.privados > 0) {
    const individuales = partidas.filter((pt) => tipoDe(pt) === 'escritorio' && !esBench(pt)).reduce((s, pt) => s + (pt.cantidad || 0), 0);
    if (individuales < espacio.privados) {
      avisos.push({ tono: 'ambar', texto: `Dijiste ${espacio.privados} privado(s) y hay ${individuales} escritorio(s) individual(es): ${espacio.privados - individuales} se quedaría(n) vacío(s).` });
    }
  }

  return {
    espacio, grupos: vivos, avisos,
    puestos, sillas, visitas, reunion, totalSillas, gavetas,
    titular: [
      espacio.hay ? `${espacio.m2} m²${espacio.pisos > 1 ? ` en ${espacio.pisos} pisos` : ''}` : null,
      espacio.privados ? `${espacio.privados} privado${espacio.privados === 1 ? '' : 's'}` : null,
      puestos ? `${puestos} puesto${puestos === 1 ? '' : 's'} de trabajo` : null,
      totalSillas ? `${totalSillas} silla${totalSillas === 1 ? '' : 's'}` : null,
      gavetas ? `${gavetas} gaveta${gavetas === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · '),
  };
}
