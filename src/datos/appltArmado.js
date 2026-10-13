// ============================================================================
//  ARMADO APP LT · BANCA DOBLE · regla de la guía oficial ESP-DCC-IDP-003 v3
//  (lab/applt/REGLAS_ARMADO.md, reglas_armado_applt.json). c = cubiertas = usuarios / 2.
//
//    Cubierta ATCUBD4{4|5|6}ABS ........ c          (GE p24-25, p35)
//    Pata U ATPU4M (extremos) .......... 2          (GE p24-25 cuadro 4)
//    Pata U ATPU75M (entre lugares) .... c − 1      (GE p25 cuadro 8)
//    Omega ATOM3/4/5 ................... 2c         (GE p24-25 cuadro 5; vistas inferiores)
//    Riel ATRICDB4/5/6 ................. c          (GE p24-25 cuadro 3)
//    Placa unión CIEPLA01300778 ........ 2(c − 1)   (GE p25 cuadro 7) — INCLUIDA sin cargo (Dirección)
//    Acometida ATACM ................... 1 por ISLA  (GE p24-25 cuadro 6; Dirección 2026-10-13: "sólo 2 si los 8
//                                                    usuarios están en dos islas separadas de 4" → cada isla es
//                                                    su propia banca y se arma por separado)
//  ⚠ El artículo ERP del 8U (TATO84812ABY01) trae las horas de EXACTAMENTE 3 ATACM (16.994 h metal = 15.9636 + 2×0.5152):
//    contradice la regla de 1 por isla; se reporta a Dirección, no se copia.
//    Biombo (opcional) ................. c
//
//  Verificado contra el pedido real 38247 (6U, 1200): 2 + 2 + 6 + 3 + 3 + 4 + 1 = idéntico.
//  Lo que la guía NO define (largo 1050, usuarios impares, biombo PET/satinado fuera de la guía, el 8U con
//  sus ATACM) NO se inventa: se devuelve como pendiente.
// ============================================================================
import { articuloPorClave } from './preciosLinea.js';

const POR_MEDIDA = Object.freeze({
  1200: { cubierta: 'ATCUBD44ABS', omega: 'ATOM3', riel: 'ATRICDB4', biombo: { cristal: 'ATBIOCRT4', cristal_satinado: 'ATBIOCRS4', melamina: 'ATBIOABS4' } },
  1500: { cubierta: 'ATCUBD45ABS', omega: 'ATOM4', riel: 'ATRICDB5', biombo: { cristal: 'ATBIOCRT5', melamina: 'ATBIOABS5' } },
  1800: { cubierta: 'ATCUBD46ABS', omega: 'ATOM5', riel: 'ATRICDB6', biombo: { cristal: 'ATBIOCRT6', melamina: 'ATBIOABS6' } },
});
const PLACA_UNION = 'CIEPLA01300778';

/**
 * Despiece comercial de una banca doble APP LT según la guía.
 * @param {{usuarios:number, largoMM:1200|1500|1800, biombo?:'cristal'|'cristal_satinado'|'melamina'|null}} cfg
 * @returns {{ok:boolean, componentes:Array<{clave,cantidad,rol,fuente,lista,importe,incluidaSinCargo?}>, lista:number|null, pendientes:string[]}}
 */
export function armadoBancaDobleAppLT({ usuarios, largoMM, biombo = null } = {}) {
  const pendientes = [];
  const m = POR_MEDIDA[largoMM];
  if (!m) pendientes.push(`La guía sólo define cubiertas de 1200, 1500 y 1800 mm (pediste ${largoMM}).`);
  if (!(usuarios >= 2) || usuarios % 2) pendientes.push(`Banca doble = 2 usuarios por cubierta: ${usuarios} usuarios no está en la guía.`);
  if (pendientes.length && (!m || !(usuarios >= 2) || usuarios % 2)) return { ok: false, componentes: [], lista: null, pendientes };
  const c = usuarios / 2;
  const filas = [
    { clave: m.cubierta, cantidad: c, rol: 'cubierta', fuente: 'GE p24-25, p35' },
    { clave: 'ATPU4M', cantidad: 2, rol: 'pata U extremos', fuente: 'GE p24-25 cuadro 4' },
    { clave: 'ATPU75M', cantidad: c - 1, rol: 'pata U entre lugares', fuente: 'GE p25 cuadro 8' },
    { clave: m.omega, cantidad: 2 * c, rol: 'omega de refuerzo (2 por cubierta)', fuente: 'GE p24-25 cuadro 5' },
    { clave: m.riel, cantidad: c, rol: 'riel pasacables', fuente: 'GE p24-25 cuadro 3' },
    { clave: PLACA_UNION, cantidad: 2 * (c - 1), rol: 'placa unión (2 por junta)', fuente: 'GE p25 cuadro 7', incluidaSinCargo: true },
    { clave: 'ATACM', cantidad: 1, rol: 'acometida', fuente: 'GE p24-25 cuadro 6' },
  ];
  if (biombo) {
    const kb = m.biombo[biombo];
    if (kb) filas.push({ clave: kb, cantidad: c, rol: `biombo ${biombo}`, fuente: biombo === 'cristal_satinado' ? 'pedido 38247 (no viene en la guía)' : 'GE p24-25 cuadro 1, p37' });
    else pendientes.push(`Biombo "${biombo}" en ${largoMM} no viene en la guía ni en un pedido real.`);
  }
  const componentes = filas.filter((f) => f.cantidad > 0).map((f) => {
    if (f.incluidaSinCargo) return { ...f, lista: 0, importe: 0 };
    const a = articuloPorClave(f.clave);
    if (!a || !(a.l > 0)) { pendientes.push(`${f.clave}: sin precio de lista en el catálogo.`); return { ...f, lista: null, importe: null }; }
    return { ...f, lista: a.l, importe: a.l * f.cantidad };
  });
  const completo = componentes.every((x) => x.importe != null);
  return { ok: completo && !pendientes.length, componentes, lista: completo ? componentes.reduce((s, x) => s + x.importe, 0) : null, pendientes };
}

// ============================================================================
//  ACOMODO 10 · VH-A10-07 · TOPOLOGÍA DE UNA BANCA QUE ACOMODA COTIZAR (misma guía, sin BOM ni precios).
//  Doble (fondo 1200): 2 usuarios por cubierta → usuarios PARES, c = usuarios / 2. Sencilla (fondo 600): 1 por
//  cubierta. Largo de cubierta = largo de la banca ÷ c, y sólo existe 1200/1500/1800. Cada banca es UNA isla con
//  UNA acometida ATACM (GE p24-25 cuadro 6; Dirección: "sólo 2 si los 8 usuarios están en dos islas de 4").
//  Lo que no cuadra NO se corrige solo: queda pendiente "consultar con Diseño" (la guía lo dice así).
// ============================================================================
const LARGOS_GUIA = [1200, 1500, 1800];
export function topologiaBancaAppLT({ w, d, usuarios } = {}) {
  const W = Number(w), D = Number(d), U = Number(usuarios);
  const pendientes = [];
  const tipo = D === 1200 ? 'doble' : D === 600 ? 'sencilla' : null;
  if (!tipo) pendientes.push(`Fondo de ${Number.isFinite(D) ? D : '?'} mm: la guía sólo define banca doble (1200) y sencilla (600).`);
  if (!(Number.isInteger(U) && U >= 1)) pendientes.push('La banca no declara cuántos usuarios lleva.');
  else if (tipo === 'doble' && U % 2) pendientes.push(`${U} usuarios en banca doble no está en la guía (2 usuarios por cubierta: debe ser par).`);
  const cubiertas = tipo && Number.isInteger(U) && U >= 1 ? (tipo === 'doble' ? U / 2 : U) : null;
  const largoCubiertaMM = Number.isInteger(cubiertas) && cubiertas > 0 && W > 0 ? W / cubiertas : null;
  if (largoCubiertaMM != null && !LARGOS_GUIA.includes(largoCubiertaMM)) pendientes.push(`Cubiertas de ${Math.round(largoCubiertaMM)} mm: la guía sólo define 1200, 1500 y 1800 mm.`);
  const dentroDeGuia = pendientes.length === 0;
  return { tipo, usuarios: Number.isFinite(U) ? U : null, cubiertas: dentroDeGuia ? cubiertas : null, largoCubiertaMM: dentroDeGuia ? largoCubiertaMM : null, acometidas: 1, dentroDeGuia, pendientes };
}

const esBancaAppLT = (p) => p?.relation_role === 'ANCHOR_WORKSTATION' && (/app\s*lt/i.test(String(p?.nombre || '')) || String(p?.linea || '') === 'App LT');

/** Islas APP LT de un acomodo (piezas expandidas del payload): topología por banca, acometidas y lo fuera de guía. */
export function islasAppLT(piezas = [], colocacion = []) {
  const colocadas = new Set((colocacion || []).map((c) => String(c.id)));
  const islas = (piezas || []).filter(esBancaAppLT).map((p) => ({
    id: String(p.id), nombre: p.nombre || String(p.id), colocada: colocadas.has(String(p.id)),
    ...topologiaBancaAppLT({ w: p.w, d: p.d, usuarios: p.user_capacity }),
  }));
  return {
    islas,
    acometidas: islas.filter((i) => i.dentroDeGuia).reduce((s, i) => s + i.acometidas, 0),
    fueraDeGuia: islas.filter((i) => !i.dentroDeGuia).map((i) => ({ id: i.id, nombre: i.nombre, pendientes: i.pendientes })),
  };
}
