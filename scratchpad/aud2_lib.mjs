// AUDITORÍA 2 · arnés común. Pide a la edge function REAL y cuesta con el MOTOR
// real, igual que la pantalla. El estado es un MAPA de insumos: con el arreglo
// todo sale en 0 y la auditoría se felicita sola.
import { catalogoIA, costearItem } from '../src/datos/lineas.js';
import { BANCO } from '../src/datos/banco.js';
import { INSUMOS_SEMILLA, mapaInsumos } from '../src/datos/insumos.js';
import { PARAMETROS_DEFAULT } from '../src/motor/calculo.js';

export const LLAVE = 'sb_publishable_lDPhCTatyJ2cap3FNEGs7A_uPapgg6y';
export const BASE = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/functions/v1/';
export const CAT = catalogoIA();
export const ESTADO = { insumos: mapaInsumos(INSUMOS_SEMILLA), parametros: PARAMETROS_DEFAULT, piezas: {} };

// Las 4 reglas de ámbito 'cotizacion' que HOY viajan de verdad (tabla `reglas`).
export const REGLAS_REALES = [
  '· En una oficina privada siempre se cotiza la silla del puesto MÁS 2 sillas de visita de 4 patas.',
  '· Si piden mas puestos de los que arma un bench, se saca el precio POR PUESTO del escalon que si existe y se multiplica por los que piden. Nunca se cotiza otra cantidad distinta a la pedida.',
  '· Jerarquia de lineas operativas, de mas premium a mas economica: CIRQUE > RIO > APP LT. Si el cliente no dice el nivel, se usa App LT (la de volumen) y se menciona que existe la premium.',
  '· Un proyecto de oficina SIEMPRE lleva silleria: sillas operativas, ejecutivas, de visita, de juntas y de comedor. Estan en el Banco de precios con precio real de presupuestos cerrados. Nunca decir que no hay sillas en el catalogo.',
];

export async function fn(nombre, body, intentos = 3) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(BASE + nombre, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: LLAVE, Authorization: 'Bearer ' + LLAVE },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j && (j.ok || j.error)) return j;
      ultimo = j;
    } catch (e) { ultimo = { ok: false, error: String(e) }; }
    await new Promise((s) => setTimeout(s, 2500 * (i + 1)));
  }
  return ultimo || { ok: false, error: 'sin respuesta' };
}

// Un pedido completo, costeado como lo haría la pantalla.
export async function cotizar({ texto, reglas, aprendizajes }) {
  const body = { texto, catalogo: CAT };
  if (reglas) body.reglas = reglas;
  if (aprendizajes) body.aprendizajes = aprendizajes;
  const j = await fn('cotizar-texto', body);
  if (!j?.ok) return { ok: false, error: j?.error || 'falló', texto };

  const p = j.propuesta || {};
  const renglones = [];
  let total = 0;
  const inventados = [];

  for (const it of p.items || []) {
    const cantidad = Math.max(1, Math.round(Number(it.cantidad) || 1));
    const c = costearItem(ESTADO, { ...it, cantidad });
    if (!c) { inventados.push(`ITEM inexistente: ${it.ruta}/${it.producto}`); continue; }
    const imp = (c.precioUnitario || 0) * cantidad;
    total += imp;
    renglones.push({ origen: 'linea', ruta: it.ruta, producto: it.producto, nombre: c.nombre, cantidad, unit: c.precioUnitario, imp, nota: it.nota || '', conf: it.confianza });
  }
  for (const b of p.banco || []) {
    const pieza = BANCO.find((x) => x.id === b.id);
    if (!pieza) { inventados.push(`BANCO id inexistente: ${b.id}`); continue; }
    const cantidad = Math.max(1, Math.round(Number(b.cantidad) || 1));
    const imp = pieza.precio * cantidad;
    total += imp;
    renglones.push({ origen: 'banco', id: pieza.id, nombre: pieza.nombre, cantidad, unit: pieza.precio, imp, nota: b.nota || '' });
  }

  return {
    ok: true, texto, total, renglones, inventados,
    preguntas: p.preguntas || [], noEncontrado: p.noEncontrado || [], resumen: p.resumen || '',
    uso: j.uso || null,
  };
}

export const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

// Corre N cosas a la vez sin ahogar la función.
export async function enParalelo(tareas, ancho = 4) {
  const out = new Array(tareas.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(ancho, tareas.length) }, async () => {
    while (i < tareas.length) { const k = i++; out[k] = await tareas[k](); }
  }));
  return out;
}
