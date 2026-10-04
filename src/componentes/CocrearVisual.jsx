// ============================================================================
//  COCREAR · VISUAL PARAMÉTRICO.  El cliente VE el producto tomar forma mientras
//  él y Von Haucke lo co-diseñan: cambia medidas, material, tono, forma o features
//  y el dibujo se actualiza al instante. Es una ELEVACIÓN FRONTAL esquemática
//  (no un render fotográfico — ese llega después por el pipeline de render), pero
//  honesta: escala a las medidas reales y refleja material/tono/forma.
//  Determinista y sin red: cero costo, respuesta inmediata.
// ============================================================================
import React, { useMemo } from 'react';
import { colorMaterial, DIMS_DEFAULT, FAMILIA } from '../datos/cocrear.js';

// Oscurece un color (para sombras/cantos).
function sombra(hex, t = 0.18) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const d = (v) => Math.round(v * (1 - t));
  return '#' + [d(r), d(g), d(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export default function CocrearVisual({ spec }) {
  const vis = useMemo(() => construir(spec), [spec]);
  return (
    <svg viewBox="0 0 400 300" className="cocrear-visual-svg" role="img"
      aria-label={`Vista previa de ${spec?.familia || 'producto'}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="cc-piso" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00000000" />
          <stop offset="100%" stopColor="#00000014" />
        </linearGradient>
        <linearGradient id="cc-luz" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE9A8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FFE9A8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* piso */}
      <rect x="0" y="262" width="400" height="38" fill="url(#cc-piso)" />
      <line x1="24" y1="262" x2="376" y2="262" stroke="#00000022" strokeWidth="1" />
      {vis.nodos}
      {/* cota de ancho */}
      <g fontFamily="ui-sans-serif, system-ui" fontSize="11" fill="#667085">
        <line x1={vis.x0} y1="276" x2={vis.x1} y2="276" stroke="#98A2B3" strokeWidth="1" />
        <line x1={vis.x0} y1="272" x2={vis.x0} y2="280" stroke="#98A2B3" strokeWidth="1" />
        <line x1={vis.x1} y1="272" x2={vis.x1} y2="280" stroke="#98A2B3" strokeWidth="1" />
        <text x={(vis.x0 + vis.x1) / 2} y="290" textAnchor="middle">{vis.anchoTxt}</text>
      </g>
    </svg>
  );
}

function construir(spec) {
  const fam = spec?.familia || FAMILIA.DESCONOCIDA;
  const dd = DIMS_DEFAULT[fam] || DIMS_DEFAULT[FAMILIA.DESCONOCIDA];
  const ancho = spec?.dimensiones?.ancho_mm || dd.ancho_mm;
  const alto = spec?.dimensiones?.alto_mm || dd.alto_mm;

  const mat0 = (spec?.materiales || [])[0] || { material: 'laminado', tono: null };
  const cuerpoColor = colorMaterial(mat0.material, mat0.tono);
  const acab = (spec?.acabados || [])[0];
  const cubiertaColor = acab ? colorMaterial(mat0.material, acab.tono)
    : ((spec?.materiales || [])[1] ? colorMaterial(spec.materiales[1].material, spec.materiales[1].tono) : colorMaterial(mat0.material, 'claro'));
  const curva = (spec?.caracteristicas || []).includes('curva');
  const luz = (spec?.caracteristicas || []).includes('iluminacion_integrada');

  // Marco de dibujo (ancho útil 320, alto útil 210), preservando proporción real.
  const maxW = 320, maxH = 210, cxC = 200, pisoY = 262;
  const aspecto = ancho / alto;
  let w = maxW, h = w / aspecto;
  if (h > maxH) { h = maxH; w = h * aspecto; }
  const x0 = cxC - w / 2, x1 = cxC + w / 2, yTop = pisoY - h;
  const anchoTxt = `${(ancho / 1000).toFixed(2)} m`;

  const ctx = { x0, x1, yTop, w, h, pisoY, cuerpoColor, cubiertaColor, curva, luz };
  let nodos;
  switch (fam) {
    case FAMILIA.RECEPCION: nodos = dibujarRecepcion(ctx); break;
    case FAMILIA.ESCRITORIO: nodos = dibujarEscritorio(ctx); break;
    case FAMILIA.MESA: nodos = dibujarMesa(ctx); break;
    case FAMILIA.LOCKER: nodos = dibujarLocker(ctx, spec); break;
    case FAMILIA.GUARDADO: nodos = dibujarGuardado(ctx); break;
    case FAMILIA.DISPLAY: nodos = dibujarDisplay(ctx); break;
    default: nodos = dibujarCaja(ctx);
  }
  return { nodos, x0, x1, anchoTxt };
}

// --- Renderers por familia (elevación frontal) ------------------------------
function dibujarRecepcion({ x0, x1, yTop, w, h, pisoY, cuerpoColor, cubiertaColor, curva, luz }) {
  const rad = curva ? Math.min(28, w / 6) : 4;
  const cubiertaH = Math.max(10, h * 0.16);
  return (
    <g>
      {/* cuerpo del mostrador */}
      <path d={`M${x0},${pisoY} L${x0},${yTop + cubiertaH + rad} Q${x0},${yTop + cubiertaH} ${x0 + rad},${yTop + cubiertaH} L${x1 - rad},${yTop + cubiertaH} Q${x1},${yTop + cubiertaH} ${x1},${yTop + cubiertaH + rad} L${x1},${pisoY} Z`}
        fill={cuerpoColor} stroke={sombra(cuerpoColor, 0.3)} strokeWidth="1.5" />
      {/* cubierta (transacción) — más ancha, en material de cubierta */}
      <rect x={x0 - 6} y={yTop} width={w + 12} height={cubiertaH} rx={curva ? cubiertaH / 2 : 3}
        fill={cubiertaColor} stroke={sombra(cubiertaColor, 0.25)} strokeWidth="1.5" />
      {/* junta vertical decorativa */}
      <line x1={x0 + w * 0.5} y1={yTop + cubiertaH + 8} x2={x0 + w * 0.5} y2={pisoY - 8} stroke={sombra(cuerpoColor, 0.35)} strokeWidth="1" opacity="0.5" />
      {luz && <rect x={x0 + 4} y={yTop + cubiertaH + 2} width={w - 8} height="14" fill="url(#cc-luz)" />}
    </g>
  );
}

function dibujarEscritorio({ x0, x1, yTop, w, h, pisoY, cuerpoColor, cubiertaColor, curva, luz }) {
  const topH = Math.max(8, h * 0.14);
  const legW = Math.max(10, w * 0.06);
  return (
    <g>
      {/* cubierta */}
      <rect x={x0} y={yTop} width={w} height={topH} rx={curva ? topH / 2 : 3} fill={cubiertaColor} stroke={sombra(cubiertaColor, 0.25)} strokeWidth="1.5" />
      {/* patas / costados */}
      <rect x={x0 + 6} y={yTop + topH} width={legW} height={pisoY - yTop - topH} fill={cuerpoColor} stroke={sombra(cuerpoColor, 0.3)} strokeWidth="1" />
      <rect x={x1 - 6 - legW} y={yTop + topH} width={legW} height={pisoY - yTop - topH} fill={cuerpoColor} stroke={sombra(cuerpoColor, 0.3)} strokeWidth="1" />
      {/* faldón */}
      <rect x={x0 + legW + 10} y={yTop + topH} width={w - 2 * legW - 20} height={Math.max(8, h * 0.12)} fill={cuerpoColor} opacity="0.85" />
      {luz && <rect x={x0 + 4} y={yTop + topH + 1} width={w - 8} height="12" fill="url(#cc-luz)" />}
    </g>
  );
}

function dibujarMesa({ x0, x1, yTop, w, h, pisoY, cuerpoColor, cubiertaColor, curva }) {
  const topH = Math.max(8, h * 0.16);
  return (
    <g>
      <rect x={x0} y={yTop} width={w} height={topH} rx={curva ? topH / 2 : 3} fill={cubiertaColor} stroke={sombra(cubiertaColor, 0.25)} strokeWidth="1.5" />
      {/* base central o patas */}
      {curva ? (
        <>
          <rect x={200 - w * 0.04} y={yTop + topH} width={w * 0.08} height={pisoY - yTop - topH} fill={cuerpoColor} />
          <rect x={200 - w * 0.18} y={pisoY - 8} width={w * 0.36} height="8" rx="3" fill={cuerpoColor} />
        </>
      ) : (
        <>
          <rect x={x0 + w * 0.08} y={yTop + topH} width={Math.max(8, w * 0.05)} height={pisoY - yTop - topH} fill={cuerpoColor} />
          <rect x={x1 - w * 0.08 - Math.max(8, w * 0.05)} y={yTop + topH} width={Math.max(8, w * 0.05)} height={pisoY - yTop - topH} fill={cuerpoColor} />
        </>
      )}
    </g>
  );
}

function dibujarLocker({ x0, x1, yTop, w, h, pisoY, cuerpoColor, cubiertaColor, luz }, spec) {
  const cols = Math.max(2, Math.min(8, Math.round((spec?.dimensiones?.ancho_mm || 1800) / 350)));
  const rows = Math.max(3, Math.min(6, Math.round((spec?.dimensiones?.alto_mm || 1950) / 420)));
  const cw = w / cols, ch = h / rows;
  const puertas = [];
  for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
    const px = x0 + c * cw, py = yTop + rr * ch;
    puertas.push(<rect key={`${c}-${rr}`} x={px + 2} y={py + 2} width={cw - 4} height={ch - 4} rx="2" fill={cuerpoColor} stroke={sombra(cuerpoColor, 0.35)} strokeWidth="1" />);
    puertas.push(<circle key={`h-${c}-${rr}`} cx={px + cw - 10} cy={py + ch / 2} r="2.4" fill={sombra(cubiertaColor, 0.1)} />);
  }
  return (
    <g>
      <rect x={x0 - 3} y={yTop - 3} width={w + 6} height={h + 3} rx="3" fill={sombra(cuerpoColor, 0.12)} />
      {puertas}
      {luz && <rect x={x0} y={yTop - 6} width={w} height="6" fill="url(#cc-luz)" />}
    </g>
  );
}

function dibujarGuardado({ x0, x1, yTop, w, h, pisoY, cuerpoColor, cubiertaColor }) {
  const cajones = Math.max(2, Math.min(5, Math.round(h / 55)));
  const ch = h / cajones;
  const lineas = [];
  for (let i = 1; i < cajones; i++) lineas.push(<line key={i} x1={x0 + 4} y1={yTop + i * ch} x2={x1 - 4} y2={yTop + i * ch} stroke={sombra(cuerpoColor, 0.35)} strokeWidth="1.5" />);
  const tiradores = [];
  for (let i = 0; i < cajones; i++) tiradores.push(<rect key={i} x={200 - 14} y={yTop + i * ch + ch / 2 - 2} width="28" height="4" rx="2" fill={sombra(cubiertaColor, 0.1)} />);
  return (
    <g>
      <rect x={x0} y={yTop} width={w} height={h} rx="3" fill={cuerpoColor} stroke={sombra(cuerpoColor, 0.3)} strokeWidth="1.5" />
      <rect x={x0 - 4} y={yTop - 5} width={w + 8} height="6" rx="2" fill={cubiertaColor} />
      {lineas}{tiradores}
    </g>
  );
}

function dibujarDisplay({ x0, x1, yTop, w, h, pisoY, cuerpoColor, cubiertaColor, luz }) {
  const niveles = Math.max(3, Math.min(6, Math.round(h / 55)));
  const ch = h / niveles;
  const repisas = [];
  for (let i = 0; i <= niveles; i++) repisas.push(<rect key={i} x={x0} y={yTop + i * ch - 2} width={w} height="5" rx="2" fill={cubiertaColor} stroke={sombra(cubiertaColor, 0.2)} strokeWidth="0.5" />);
  return (
    <g>
      <rect x={x0} y={yTop} width="6" height={h} fill={cuerpoColor} />
      <rect x={x1 - 6} y={yTop} width="6" height={h} fill={cuerpoColor} />
      {luz && repisas.map((_, i) => <rect key={`l${i}`} x={x0 + 6} y={yTop + i * ch + 2} width={w - 12} height="7" fill="url(#cc-luz)" />)}
      {repisas}
    </g>
  );
}

function dibujarCaja({ x0, yTop, w, h, cuerpoColor, curva }) {
  return <rect x={x0} y={yTop} width={w} height={h} rx={curva ? 16 : 4} fill={cuerpoColor} stroke={sombra(cuerpoColor, 0.3)} strokeWidth="1.5" />;
}
