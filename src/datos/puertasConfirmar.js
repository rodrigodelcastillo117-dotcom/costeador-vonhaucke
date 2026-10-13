// ============================================================================
//  VH-136 · CONFIRMAR BISAGRA Y SENTIDO DE UNA PUERTA (la persona decide; nada se inventa).
//  La lectura del plano deja puertas "pendientes" (sin barrido verificable: p. ej. un acceso doble
//  de dos hojas). La compuerta decía "confirma bisagra y sentido" pero no había dónde. Aquí vive
//  la geometría de esa confirmación, en METROS y en el sistema local del cuarto (origen en la
//  esquina superior izquierda de su bbox, y hacia abajo), igual que `planoLeido`/`AcomodoBase`.
//
//  Convención de ángulos (la misma que `configurarPuerta` en AcomodoBase): 0° = +x, 90° = +y;
//  `anguloCerradaDeg` es la dirección de la hoja cerrada desde la bisagra; el barrido es de 90°
//  en `sentido` horario/antihorario hasta la dirección de apertura.
// ============================================================================

const r2 = (v) => +Number(v).toFixed(2);
const angulo = (vx, vy) => (((Math.atan2(vy, vx) * 180) / Math.PI) % 360 + 360) % 360;

/** Pared del cuarto sobre la que está la puerta: 'y0' (arriba), 'yL' (abajo), 'x0' (izquierda), 'xW' (derecha). */
export function paredDePuerta(p, area) {
  const W = Number(area?.ancho) || 0, L = Number(area?.largo) || 0;
  const x = Number(p?.x) || 0, y = Number(p?.y) || 0;
  const d = [['y0', Math.abs(y)], ['yL', Math.abs(L - y)], ['x0', Math.abs(x)], ['xW', Math.abs(W - x)]];
  d.sort((a, b) => a[1] - b[1]);
  return d[0][0];
}

function vectoresDe(pared) {
  // n = normal HACIA ADENTRO del cuarto; f = mirando a la puerta desde adentro (= -n);
  // izquierda/derecha vistas desde adentro, de pie frente a la puerta.
  const n = { y0: [0, 1], yL: [0, -1], x0: [1, 0], xW: [-1, 0] }[pared];
  const f = [-n[0], -n[1]];
  const izq = [f[1], -f[0]];
  const der = [-f[1], f[0]];
  return { n, f, izq, der };
}

/**
 * Una hoja con bisagra y sentido confirmados por la persona.
 * @param {{x:number,y:number,ancho:number}} p   puerta (centro del vano, metros locales)
 * @param {{ancho:number,largo:number}} area
 * @param {{bisagra:'izquierda'|'derecha', abre:'adentro'|'afuera'}} d
 */
export function puertaConfirmada(p, area, d) {
  const pared = paredDePuerta(p, area);
  const { n, izq, der } = vectoresDe(pared);
  const lado = d.bisagra === 'derecha' ? der : izq;
  const ancho = Number(p.ancho) > 0 ? Number(p.ancho) : 0.9;
  const cx = Number(p.x), cy = Number(p.y);
  const bisagraX = cx + lado[0] * ancho / 2, bisagraY = cy + lado[1] * ancho / 2;
  const cerrada = angulo(cx - bisagraX, cy - bisagraY);
  const abreV = d.abre === 'afuera' ? [-n[0], -n[1]] : n;
  const abierta = angulo(abreV[0], abreV[1]);
  const sentido = (((abierta - cerrada) % 360) + 360) % 360 === 90 ? 'horario' : 'antihorario';
  return {
    ...p,
    x: r2(cx), y: r2(cy), ancho: r2(ancho),
    tieneBarrido: true,
    bisagraX: r2(bisagraX), bisagraY: r2(bisagraY),
    anguloCerradaDeg: Math.round(cerrada), sentido, barridoDeg: 90,
    abre: d.abre, bisagra: d.bisagra, pared,
    confianza: 'usuario_confirmado',
  };
}

/** Acceso DOBLE (dos hojas de ancho/2, bisagras en los dos extremos, las dos abren al mismo lado). */
export function puertaDobleConfirmada(p, area, d) {
  const pared = paredDePuerta(p, area);
  const { izq, der } = vectoresDe(pared);
  const ancho = Number(p.ancho) > 0 ? Number(p.ancho) : 1.8;
  const cx = Number(p.x), cy = Number(p.y);
  const hoja = (lado, bisagra, etiqueta) => ({
    ...puertaConfirmada({ ...p, x: cx + lado[0] * ancho / 4, y: cy + lado[1] * ancho / 4, ancho: ancho / 2 }, area, { bisagra, abre: d.abre }),
    doble: true, hoja: etiqueta, vanoAncho: r2(ancho),
  });
  return [hoja(izq, 'izquierda', 'izq'), hoja(der, 'derecha', 'der')];
}

const cerca = (a, b, tol = 0.06) => Math.abs(Number(a) - Number(b)) <= tol;

/** Puertas del cuarto que todavía no tienen barrido confirmado (las que la compuerta llama "pendientes"). */
export function puertasSinConfirmar(areas = []) {
  const out = [];
  (areas || []).forEach((a, areaIdx) => {
    (a.puertas || []).forEach((p, idx) => {
      const ok = p.tieneBarrido === true && Number.isFinite(Number(p.bisagraX)) && Number.isFinite(Number(p.bisagraY));
      if (!ok) out.push({ areaIdx, idx, puerta: p, areaNombre: a.nombre || `Área ${areaIdx + 1}` });
    });
  });
  return out;
}

/**
 * Aplica la decisión de la persona a la puerta `idx` del área y la saca de `puertasPendientes`.
 * @param {{doble?:boolean, bisagra?:'izquierda'|'derecha', abre:'adentro'|'afuera'}} d
 */
export function confirmarPuertaEnArea(area, idx, d) {
  const puertas = [...(area.puertas || [])];
  const p = puertas[idx]; if (!p) return area;
  const nuevas = d.doble ? puertaDobleConfirmada(p, area, d) : [puertaConfirmada(p, area, { bisagra: d.bisagra || 'izquierda', abre: d.abre })];
  puertas.splice(idx, 1, ...nuevas);
  const pend = (area.puertasPendientes || []).filter((q) => !(cerca(q.x, p.x) && cerca(q.y, p.y)));
  const out = { ...area, puertas };
  if (pend.length) out.puertasPendientes = pend; else delete out.puertasPendientes;
  return out;
}

/** Texto corto para la persona: dónde está la puerta en su cuarto. */
export function describirPuerta(p, area) {
  const pared = paredDePuerta(p, area);
  const lado = { y0: 'pared de arriba', yL: 'pared de abajo', x0: 'pared izquierda', xW: 'pared derecha' }[pared];
  const ancho = Number(p?.ancho) > 0 ? ` · vano ${Number(p.ancho).toFixed(2)} m` : '';
  return `${lado} (a ${Number(p?.x || 0).toFixed(2)} m, ${Number(p?.y || 0).toFixed(2)} m del origen del cuarto)${ancho}`;
}
