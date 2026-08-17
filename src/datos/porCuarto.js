// ============================================================================
//  QUÉ VA EN CADA CUARTO, POR ESCRITO
//
//  Rodrigo (2026-08-17): "el acomodo que diga por escrito qué va en cada cuarto
//  (con gavetas y sillas)".
//
//  El 3D enseña dónde queda cada mueble, pero nadie puede leer un isométrico por
//  teléfono ni pegarlo en un correo. Y hay dos cosas que el dibujo NO puede
//  decir: las gavetas (viven debajo de la cubierta, no se dibujan) y cuántas
//  sillas quedaron en cada cuarto (se pierden entre los escritorios).
//
//  Esto NO es un motor nuevo: lee el mismo reparto por área que ya alimenta la
//  propuesta (`resumen.js`) y lo pone en español, ordenado como lo diría un
//  proyectista: primero dónde se sienta la gente, luego dónde se guarda, luego
//  con qué se sienta.
// ============================================================================
import { resumenPorArea } from './resumen.js';
import { tipoDe, vaBajoEscritorio } from './espacio.js';
import { esSillaDeTrabajo, esSillaDeVisita } from './planner.js';

const sinAcento = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Cuántas personas se sientan en ese renglón. Los generadores escriben el número
// de puestos en el nombre ("10 usuarios", "6 puestos", "2u"): es el dato que un
// proyectista busca primero, y sin él "6 bancas" no dice a cuánta gente sienta.
export function puestosDe(nombre, cantidad = 1) {
  const s = sinAcento(nombre);
  const m = /(\d+)\s*(?:puesto|plaza|persona|posicion|usuario)s?\b/.exec(s) || /(\d+)\s*u\b(?!\w)/.exec(s);
  return Math.max(1, m ? +m[1] : 1) * cantidad;
}

// El orden en que se lee un cuarto. Las sillas van aparte de los sillones: una
// silla operativa es un puesto de trabajo, un sillón es el lounge.
const RANGO = (r) => {
  const p = { nombre: r.nombre };
  if (r.bajoCubierta || vaBajoEscritorio(p)) return 5;
  const t = tipoDe(p);
  if (t === 'escritorio') return 0;
  if (t === 'juntas') return 1;
  if (esSillaDeTrabajo({ tipo: 'asiento', nombre: r.nombre })) return 3;
  if (t === 'guarda') return 2;
  if (t === 'asiento') return 4;
  return 6;
};

export function listaPorCuarto(partidas, acomodo) {
  return resumenPorArea(partidas, acomodo).map((b) => {
    const renglones = [...b.renglones]
      .map((r) => ({
        cantidad: r.cantidad,
        nombre: r.nombre,
        importe: r.importe,
        bajoCubierta: !!r.bajoCubierta,
        // Lo que el dibujo no puede decir, se dice con palabras.
        nota: r.bajoCubierta ? 'debajo de la cubierta: se cobra, no ocupa piso' : null,
        rango: RANGO(r),
      }))
      .sort((x, y) => x.rango - y.rango || y.importe - x.importe);

    const puestos = renglones
      .filter((r) => !r.bajoCubierta && tipoDe({ nombre: r.nombre }) === 'escritorio')
      .reduce((s, r) => s + puestosDe(r.nombre, r.cantidad), 0);
    const sillas = renglones
      .filter((r) => esSillaDeTrabajo({ tipo: 'asiento', nombre: r.nombre }))
      .reduce((s, r) => s + r.cantidad, 0);
    const visitas = renglones
      .filter((r) => esSillaDeVisita({ tipo: 'asiento', nombre: r.nombre }))
      .reduce((s, r) => s + r.cantidad, 0);
    const gavetas = renglones.filter((r) => r.bajoCubierta).reduce((s, r) => s + r.cantidad, 0);

    return {
      nombre: b.nombre, m2: b.m2, tipo: b.tipo, total: b.total, sinUbicar: !!b.sinUbicar,
      renglones, puestos, sillas, visitas, gavetas,
      // Una línea que se lee de un vistazo, para la cabecera del cuarto.
      titular: [
        puestos ? `${puestos} ${puestos === 1 ? 'puesto de trabajo' : 'puestos de trabajo'}` : null,
        sillas ? `${sillas} ${sillas === 1 ? 'silla' : 'sillas'}${visitas ? ` (${visitas} de visita)` : ''}` : null,
        gavetas ? `${gavetas} ${gavetas === 1 ? 'gaveta' : 'gavetas'} bajo la cubierta` : null,
      ].filter(Boolean).join(' · '),
    };
  });
}

// La misma lista en texto plano, para copiarla a un correo o a WhatsApp. Es la
// forma más rápida de que un proyectista mande "esto va en cada cuarto" sin
// tener que mandar el PDF completo.
export function textoPorCuarto(lista, { cliente = '' } = {}) {
  const out = [];
  if (cliente) out.push(`Proyecto: ${cliente}`, '');
  for (const c of lista) {
    out.push(`${c.nombre}${c.m2 ? ` (${c.m2} m2)` : ''}`);
    if (c.titular) out.push(`  ${c.titular}`);
    for (const r of c.renglones) {
      out.push(`  - ${r.cantidad} x ${r.nombre}${r.nota ? ` [${r.nota}]` : ''}`);
    }
    out.push('');
  }
  return out.join('\n').trim();
}
