// ============================================================================
//  PLANO DE ACOMODO  ·  dibuja una o varias ÁREAS a escala, en PLANTA (2D) o
//  ISOMÉTRICO (3D). Determinista: sólo dibuja lo que el motor acomodó.
//
//  DOS REGLAS QUE MANDAN EN CÓMO SE VE:
//  1) Si el cliente DIBUJÓ su oficina, las áreas traen x/y reales → se usan tal
//     cual. Antes se tiraban y todo se re-acomodaba en una cuadrícula: el 3D no
//     se parecía a su plano. Sin coordenadas (áreas escritas a mano) se empacan
//     PEGADAS, compartiendo muro, para que se lea como UNA planta y no como
//     islas flotando.
//  2) Los muros se levantan sólo en los lados LEJANOS de cada cuarto (los que
//     miran en contra de la cámara). Los cercanos quedan abiertos: así se ve
//     adentro. Funciona igual en un rectángulo que en una planta en L.
// ============================================================================
import { useState, useRef } from 'react';
import { colorTipo, altoTipo, dimsPieza, frenteDe } from '../datos/espacio.js';

const C = Math.cos(Math.PI / 6), S = Math.sin(Math.PI / 6); // iso 30°
const MURO = 130;        // grosor de muro (mm)
const ALTO_MURO = 2300;  // altura de muro dibujada (mm)
const LOSA = 180;        // espesor de la losa de piso (mm)

// Un obstáculo FÍSICO se dibuja (columna, escalera). Los huecos de 'cuarto' y
// 'puerta' sólo le dicen al motor dónde no amueblar; pintarlos metía un bloque
// negro sobre la sala de juntas y sobre cada entrada.
const fisico = (o) => o.tipo !== 'cuarto' && o.tipo !== 'puerta';

// Contorno del área en coordenadas absolutas: polígono real si lo hay, si no el
// rectángulo. Es lo que usan piso, muros y rejilla, para que nunca se separen.
function contorno(a, off) {
  if (a.poly && a.poly.length >= 3) return a.poly.map(([x, y]) => [off.x + x, off.y + y]);
  return [[off.x, off.y], [off.x + a.ancho, off.y], [off.x + a.ancho, off.y + a.largo], [off.x, off.y + a.largo]];
}

// Coloca las áreas. Con coordenadas reales (plano dibujado) las respeta; sin
// ellas empaca por repisas PEGADAS —comparten muro— para que sea una planta.
function layoutAreas(areas) {
  const reales = areas.length > 0 && areas.every((a) => Number.isFinite(a.x) && Number.isFinite(a.y));
  if (reales) {
    const minX = Math.min(...areas.map((a) => a.x)), minY = Math.min(...areas.map((a) => a.y));
    const offs = areas.map((a) => ({ x: a.x - minX, y: a.y - minY }));
    const totalW = Math.max(...areas.map((a, i) => offs[i].x + a.ancho));
    const totalH = Math.max(...areas.map((a, i) => offs[i].y + a.largo));
    return { offs, totalW, totalH, reales: true };
  }
  const sup = areas.reduce((s, a) => s + a.ancho * a.largo, 0);
  const objetivo = Math.max(...areas.map((a) => a.ancho), Math.sqrt(sup * 1.7));
  const offs = []; let x = 0, y = 0, rowH = 0, totalW = 0;
  areas.forEach((a, i) => {
    if (x > 0 && x + a.ancho > objetivo + 1) { x = 0; y += rowH + MURO; rowH = 0; }
    offs[i] = { x, y };
    x += a.ancho + MURO;
    totalW = Math.max(totalW, x - MURO);
    rowH = Math.max(rowH, a.largo);
  });
  return { offs, totalW, totalH: y + rowH, reales: false };
}

// Nombre corto y legible: quita el "(12.3 m²)" y trunca a lo que cabe.
function etiqueta(nombre, anchoMM, fs) {
  let t = (nombre || 'Área').replace(/\s*\([^)]*m²\)\s*$/i, '').trim() || 'Área';
  const max = Math.max(6, Math.floor(anchoMM / (fs * 0.52)));
  if (t.length > max) t = t.slice(0, max - 1).trimEnd() + '…';
  return t;
}

// Dibuja UN mueble en estilo arquitectónico (relleno tenue + línea fina).
// `rot` decide de qué lado va la silla: sin esto el escritorio "salía viendo"
// siempre al mismo lado por más que lo giraras.
function Glifo({ x, y, w, h, tipo, col, rot = 0 }) {
  const SW = 26; // grosor de línea (mm) — fino, tipo CAD
  const base = { x, y, width: w, height: h, fill: col, fillOpacity: 0.14, stroke: col, strokeWidth: SW };
  const rx = Math.min(w, h) * 0.08;
  const line = (x1, y1, x2, y2, op = 0.75, sw = 18) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeOpacity={op} strokeWidth={sw} />;

  if (tipo === 'guarda') {
    const n = Math.max(2, Math.min(4, Math.round(h / 380)));
    const parts = [];
    for (let k = 1; k < n; k++) { const yy = y + (h * k) / n; parts.push(<line key={'l' + k} x1={x} y1={yy} x2={x + w} y2={yy} stroke={col} strokeOpacity="0.55" strokeWidth="16" />); }
    for (let k = 0; k < n; k++) { const yy = y + (h * (k + 0.5)) / n; parts.push(<line key={'h' + k} x1={x + w / 2 - 110} y1={yy} x2={x + w / 2 + 110} y2={yy} stroke={col} strokeOpacity="0.85" strokeWidth="30" strokeLinecap="round" />); }
    return <g><rect {...base} rx={rx} />{parts}</g>;
  }
  if (tipo === 'asiento') {
    return <g>
      <rect x={x} y={y + h * 0.24} width={w} height={h * 0.76} rx={Math.min(w, h) * 0.3} fill={col} fillOpacity="0.16" stroke={col} strokeWidth={SW} />
      <rect x={x + w * 0.06} y={y} width={w * 0.88} height={h * 0.3} rx={Math.min(w, h) * 0.16} fill={col} fillOpacity="0.42" stroke={col} strokeWidth="16" />
    </g>;
  }
  if (tipo === 'juntas' || tipo === 'mesa') {
    return <g>
      <rect {...base} rx={rx} />
      <rect x={x + w * 0.12} y={y + h * 0.12} width={w * 0.76} height={h * 0.76} rx={rx} fill="none" stroke={col} strokeOpacity="0.5" strokeWidth="14" />
    </g>;
  }
  if (tipo === 'mampara') return <rect {...base} rx={Math.min(w, h) * 0.5} />;

  // escritorio: cubierta + línea de faldón + silla (arco) AL FRENTE, y el
  // frente lo da el giro. Se dibuja el arco arriba y se rota el grupo completo
  // alrededor del centro del mueble: así el mismo dibujo sirve para los cuatro
  // giros sin cuentas por caso.
  const frente = frenteDe(rot);
  const cs = Math.min(w, h) * 0.4;
  const cx = x + w / 2, cy = y + h / 2;
  const giroArco = { abajo: 0, izq: 90, arriba: 180, der: 270 }[frente];
  // Distancia del centro al borde por el que sale la silla.
  const salida = (frente === 'abajo' || frente === 'arriba') ? h / 2 : w / 2;
  const faldon = frente === 'abajo' ? [x + 30, y + h - h * 0.16, x + w - 30, y + h - h * 0.16]
    : frente === 'arriba' ? [x + 30, y + h * 0.16, x + w - 30, y + h * 0.16]
      : frente === 'izq' ? [x + w * 0.16, y + 30, x + w * 0.16, y + h - 30]
        : [x + w - w * 0.16, y + 30, x + w - w * 0.16, y + h - 30];
  return <g>
    <rect {...base} rx={rx} />
    {line(...faldon, 0.6, 20)}
    <g transform={`rotate(${giroArco} ${cx} ${cy})`}>
      <path d={`M ${cx - cs / 2} ${cy + salida + cs * 0.55} a ${cs / 2} ${cs / 2} 0 0 1 ${cs} 0`}
        fill={col} fillOpacity="0.22" stroke={col} strokeWidth="18" />
    </g>
  </g>;
}

// `limpio` = sin etiquetas ni rejilla. Es la versión que se le manda a Gemini
// para el render realista: si van, el modelo COPIA el texto del piso dentro de
// la foto ("OPEN SPACE" escrito en el concreto) y delata que era un diagrama.
// Props de EDICIÓN (sólo en planta): con `editable`, el plano deja de ser un
// dibujo y se vuelve un tablero. Voni propone; el proyectista corrige, que es
// justo al revés de como estaba: la máquina no sabe dónde va cada mueble.
export default function PlanoAcomodo({
  areas, plan, byId, modo = 'planta', limpio = false,
  editable = false, sel = null, onTocarPieza, onSoltarEn,
  // --- edición v2 (2026-08-16) -------------------------------------------
  // Rodrigo: "¿por qué no es mejor ARRASTRAR el mueble, que picar y picar?" y
  // "deberías picarle al mueble y que te abra una mini pestaña que diga girar".
  // Tenía razón: tocar-y-tocar es un flujo de teclado numérico, no de plano.
  herramienta = null,      // elemento del menú que trae el cursor: 'puerta'|'muro'|'columna'|'escalera'
  selEl = null,            // elemento del plano seleccionado ("2:1")
  onGirar, onQuitar,       // sobre la pieza seleccionada
  onPonerElemento,         // (area, x, y) con la herramienta activa
  onTocarElemento, onMoverElemento, onGirarElemento, onQuitarElemento,
}) {
  // El arrastre vive en una REFERENCIA y se copia al estado sólo para dibujar.
  // Con estado solo no basta: si dos eventos del puntero caen en el mismo tick,
  // React todavía no re-renderizó y el manejador lee el valor viejo — el mueble
  // se quedaba donde estaba. La referencia se actualiza en el acto.
  const arrRef = useRef(null);
  const [arr, setArr] = useState(null);   // copia para dibujar
  // Cuándo apareció el menú de la pieza seleccionada, para no obedecer
  // un toque que cae sobre un botón que acaba de aparecer bajo el dedo.
  const selRef = useRef({ id: null, t: 0 });
  if (!areas?.length || !plan) return null;
  const { offs, totalW, totalH } = layoutAreas(areas);
  const coloc = plan.colocacion || [];
  const zonas = plan.zonas || [];

  if (modo === 'iso') return <PlanoIso areas={areas} offs={offs} coloc={coloc} byId={byId} limpio={limpio} />;

  // ---- PLANTA (2D) ----
  const pad = 700;
  const fs = Math.max(190, Math.min(totalW, totalH) / 22);

  // Pantalla -> coordenadas del plano (mm). Sirve igual para mouse y para dedo.
  function aPlano(ev, svg) {
    const p = svg.createSVGPoint();
    p.x = ev.clientX; p.y = ev.clientY;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const q = p.matrixTransform(m.inverse());
    return { x: q.x, y: q.y };
  }
  // ¿En qué área cayó el toque? Se necesita para guardar la pieza en su cuarto.
  function areaDe(x, y) {
    for (let i = 0; i < areas.length; i++) {
      const o = offs[i];
      if (x >= o.x && x <= o.x + areas[i].ancho && y >= o.y && y <= o.y + areas[i].largo) return i;
    }
    return null;
  }
  function soltar(ev) {
    if (!editable || !onSoltarEn) return;
    const svg = ev.currentTarget;
    const q = aPlano(ev, svg);
    if (!q) return;
    const i = areaDe(q.x, q.y);
    if (i == null) return;                       // fuera de todo cuarto: se ignora
    // Con una herramienta del menú tomada, el toque PONE ese elemento.
    if (herramienta && onPonerElemento) {
      onPonerElemento(i, Math.round(q.x - offs[i].x), Math.round(q.y - offs[i].y));
      return;
    }
    onSoltarEn(i, Math.round(q.x - offs[i].x), Math.round(q.y - offs[i].y));
  }

  // ---- ARRASTRE ----------------------------------------------------------
  // Tocar y volver a tocar es un flujo de teclado, no de plano. Aquí el mueble
  // se agarra y se suelta: si el dedo casi no se movió cuenta como toque (y
  // abre el menú de la pieza), y si se movió, se coloca donde se soltó.
  // Cuánto hay que arrastrar para que cuente como MOVER y no como tocar. Va
  // contra el viewBox, no contra los metros del cuarto, para que sean siempre
  // los mismos poquitos píxeles en pantalla — el temblor normal del dedo.
  const MOVIO = (totalW + 2 * pad) / 260;

  function tomar(ev, tipo, id, area, x, y) {
    if (!editable) return;
    // Con una herramienta del menú en la mano, el toque es para PONER ese
    // elemento: el mueble no debe atraparlo. Por eso a Rodrigo "no se le ponía
    // la escalera" — con el plano lleno, casi cualquier toque cae sobre un
    // mueble y nunca llegaba al plano.
    if (herramienta) return;
    ev.stopPropagation();
    const svg = ev.currentTarget.ownerSVGElement || ev.currentTarget;
    const q = aPlano(ev, svg);
    if (!q) return;
    try { ev.currentTarget.setPointerCapture?.(ev.pointerId); } catch (e) {}
    // px0/py0 = dónde agarraste. Es contra ESE punto que se mide si hubo
    // movimiento. Antes se comparaba contra el evento anterior, así que
    // arrastrando despacio cada paso era diminuto, nunca llegaba al umbral y el
    // mueble se regresaba a su lugar: no se podía correr un mueble un poquito.
    arrRef.current = { tipo, id, area, ox: q.x - x, oy: q.y - y, x, y, px0: q.x, py0: q.y, movio: false, pid: ev.pointerId };
    setArr(arrRef.current);
  }

  function mover(ev) {
    const a = arrRef.current;
    if (!a) return;
    const q = aPlano(ev, ev.currentTarget);
    if (!q) return;
    const movio = a.movio || Math.hypot(q.x - a.px0, q.y - a.py0) > MOVIO;
    arrRef.current = { ...a, x: q.x - a.ox, y: q.y - a.oy, movio };
    setArr(arrRef.current);
  }

  function soltarArrastre(ev) {
    const a = arrRef.current;
    if (!a) return;
    arrRef.current = null;
    setArr(null);
    if (!a.movio) {                        // fue un toque: seleccionar
      if (a.tipo === 'pieza') onTocarPieza?.(a.id);
      else onTocarElemento?.(a.id);
      return;
    }
    const svg = ev.currentTarget;
    const q = aPlano(ev, svg);
    if (!q) return;
    const i = areaDe(q.x, q.y);
    if (i == null) return;                 // soltado fuera de todo cuarto: no se mueve
    const x = Math.round(a.x - offs[i].x), y = Math.round(a.y - offs[i].y);
    if (a.tipo === 'pieza') onSoltarEn?.(i, x + anchoDe(a.id).w / 2, y + anchoDe(a.id).h / 2, a.id);
    else onMoverElemento?.(a.id, i, x, y);
  }

  // Medidas dibujadas de una pieza ya colocada (para soltarla por su centro).
  function anchoDe(id) {
    const c = coloc.find((k) => k.id === id);
    const p = c && byId[c.id];
    if (!p) return { w: 0, h: 0 };
    const { pw, ph } = dimsPieza(p, c.rot);
    return { w: pw, h: ph };
  }

  // Botón redondo dibujado dentro del plano, para el menú de la pieza.
  //
  // EL TAMAÑO VA CONTRA EL VIEWBOX, no contra los metros del cuarto. Puesto en
  // milímetros del plano no hay número bueno: en una planta de 30 m un botón de
  // metro y medio tapa los muebles vecinos (por eso "picando rápido se borraban"
  // los muebles: caías en la ✕ del anterior), y uno de 70 cm son 8 px en un
  // celular y no se puede atinar. Como fracción del viewBox mide siempre lo
  // mismo EN PANTALLA, que es lo que importa para el dedo.
  const bt = (totalW + 2 * pad) / 17;

  // Y un candado para el toque rápido: un botón que ACABA de aparecer debajo del
  // dedo no obedece. Los primeros 400 ms de vida del menú ignora los toques, así
  // que dar dos toques seguidos ya no puede borrar nada.
  if (selRef.current.id !== (sel || selEl)) selRef.current = { id: sel || selEl, t: Date.now() };
  const reciente = () => Date.now() - selRef.current.t < 400;

  const Boton = ({ cx, cy, txt, onClick, fill = '#B22A22' }) => (
    <g style={{ cursor: 'pointer' }}
      onPointerDown={(e) => { e.stopPropagation(); if (reciente()) return; onClick?.(); }}>
      <circle cx={cx} cy={cy} r={bt / 2} fill={fill} stroke="#fff" strokeWidth={bt * 0.09} />
      <text x={cx} y={cy + bt * 0.20} fontSize={bt * 0.58} fill="#fff" textAnchor="middle" fontWeight="700">{txt}</text>
    </g>
  );

  // Menú de la pieza/elemento seleccionado: sale PEGADO a él, no abajo en la
  // página. Rodrigo: "el botón de abajo está mal ahí".
  const MenuPieza = ({ x, y, w, girar, quitar }) => (
    <g>
      <Boton cx={x + w / 2 - bt * 0.62} cy={y - bt * 0.75} txt="⟳" onClick={girar} />
      <Boton cx={x + w / 2 + bt * 0.62} cy={y - bt * 0.75} txt="✕" onClick={quitar} fill="#6b645c" />
    </g>
  );

  return (
    <div className="plano-wrap">
      <svg className="plano" viewBox={`${-pad} ${-pad} ${totalW + 2 * pad} ${totalH + 2 * pad}`}
        preserveAspectRatio="xMidYMid meet"
        style={editable ? { cursor: herramienta ? 'copy' : 'crosshair', touchAction: 'none' } : undefined}
        onPointerDown={editable ? soltar : undefined}
        onPointerMove={editable ? mover : undefined}
        onPointerUp={editable ? soltarArrastre : undefined}
        onPointerCancel={editable ? () => { arrRef.current = null; setArr(null); } : undefined}>
        {areas.map((a, i) => (
          <g key={'a' + i}>
            {/* Muro real: polígono si el plano dibujado no es un rectángulo. */}
            {a.poly && a.poly.length >= 3
              ? <polygon points={a.poly.map(([px, py]) => `${offs[i].x + px},${offs[i].y + py}`).join(' ')} fill="#fdfcfa" stroke="#33302c" strokeWidth="34" strokeLinejoin="round" />
              : <rect x={offs[i].x} y={offs[i].y} width={a.ancho} height={a.largo} fill="#fdfcfa" stroke="#33302c" strokeWidth="34" />}
            {/* La etiqueta va DENTRO del cuarto: con las áreas pegadas, arriba se encimaba. */}
            <text x={offs[i].x + 140} y={offs[i].y + fs + 120} fontSize={fs} fill="#3b3733" fontWeight="700">{etiqueta(a.nombre, a.ancho, fs)}</text>
            {/* Columnas y escaleras: lo que el motor dejó libre a propósito.
                Los huecos de 'cuarto' (una sala dentro del open space) y de
                'puerta' NO se dibujan: son instrucciones para no amueblar ahí,
                no objetos. Dibujarlos ponía un bloque negro encima de la sala
                de juntas y de cada entrada. */}
            {(a.obstaculos || []).filter(fisico).map((o, k) => (
              <g key={'o' + k}>
                <rect x={offs[i].x + o.x} y={offs[i].y + o.y} width={o.w} height={o.h}
                  fill={o.tipo === 'escalera' ? '#e3ddd4' : '#3C3E42'} stroke="#1E1B1A" strokeWidth="24" />
                {o.tipo === 'escalera' && <text x={offs[i].x + o.x + o.w / 2} y={offs[i].y + o.y + o.h / 2} fontSize="170" fill="#6b645c" textAnchor="middle">escalera</text>}
              </g>
            ))}
            {zonas.filter((z) => z.area === i).map((z, k) => (
              <g key={'z' + k}>
                <rect x={offs[i].x + z.x} y={offs[i].y + z.y} width={z.ancho} height={z.largo} fill="none" stroke="#c9a24a" strokeWidth="16" strokeDasharray="120 90" rx="60" />
                <text x={offs[i].x + z.x + 80} y={offs[i].y + z.y + 240} fontSize="180" fill="#9a7317" fontWeight="700">{etiqueta(z.nombre, z.ancho, 180)}</text>
              </g>
            ))}
          </g>
        ))}
        {/* Elementos del plano puestos a mano (puerta, muro, columna, escalera).
            Van encima del cuarto y debajo de los muebles, y se arrastran igual. */}
        {editable && areas.map((a, i) => (a.obstaculos || []).map((o, k) => {
          if (!fisico(o)) return null;
          const id = `el:${i}:${k}`;
          const ax = (arr?.id === id ? arr.x : offs[i].x + o.x);
          const ay = (arr?.id === id ? arr.y : offs[i].y + o.y);
          const activo = selEl === id;
          const col = o.tipo === 'escalera' ? '#e3ddd4' : o.tipo === 'muro' ? '#33302c' : '#3C3E42';
          return (
            <g key={id} style={{ cursor: 'grab' }}
              onPointerDown={(e) => tomar(e, 'el', id, i, offs[i].x + o.x, offs[i].y + o.y)}>
              <rect x={ax} y={ay} width={o.w} height={o.h} fill={col} stroke="#1E1B1A" strokeWidth="24" opacity={arr?.id === id ? 0.6 : 1} />
              {activo && <rect x={ax - 60} y={ay - 60} width={o.w + 120} height={o.h + 120}
                fill="none" stroke="#B22A22" strokeWidth="46" strokeDasharray="130 90" />}
              {activo && <MenuPieza x={ax} y={ay} w={o.w}
                girar={() => onGirarElemento?.(id)} quitar={() => onQuitarElemento?.(id)} />}
            </g>
          );
        }))}
        {/* Puertas puestas a mano: se dibujan como el vano y su barrido. */}
        {editable && areas.map((a, i) => (a.puertas || []).map((pu, k) => {
          const id = `pu:${i}:${k}`;
          const cxp = (arr?.id === id ? arr.x : offs[i].x + pu.x);
          const cyp = (arr?.id === id ? arr.y : offs[i].y + pu.y);
          const activo = selEl === id;
          const r = Math.max(450, (pu.ancho || 900) / 2);
          return (
            <g key={id} style={{ cursor: 'grab' }}
              onPointerDown={(e) => tomar(e, 'el', id, i, offs[i].x + pu.x, offs[i].y + pu.y)}>
              <path d={`M ${cxp - r} ${cyp} A ${2 * r} ${2 * r} 0 0 1 ${cxp + r} ${cyp}`}
                fill="none" stroke="#B22A22" strokeWidth="46" />
              <line x1={cxp - r} y1={cyp} x2={cxp + r} y2={cyp} stroke="#B22A22" strokeWidth="90" strokeLinecap="round" />
              {activo && <circle cx={cxp} cy={cyp} r={r + 220} fill="none" stroke="#B22A22" strokeWidth="46" strokeDasharray="130 90" />}
              {activo && <MenuPieza x={cxp - r} y={cyp - r} w={2 * r}
                girar={() => onGirarElemento?.(id)} quitar={() => onQuitarElemento?.(id)} />}
            </g>
          );
        }))}
        {coloc.map((c) => {
          const p = byId[c.id]; if (!p) return null;
          const o = offs[c.area] || offs[0];
          const { pw, ph } = dimsPieza(p, c.rot);
          const activo = editable && sel === c.id;
          const arrastrando = arr?.id === c.id;
          const px = arrastrando ? arr.x : o.x + c.x;
          const py = arrastrando ? arr.y : o.y + c.y;
          return (
            <g key={c.id}
              onPointerDown={editable ? (e) => tomar(e, 'pieza', c.id, c.area, o.x + c.x, o.y + c.y) : undefined}
              style={editable ? { cursor: arrastrando ? 'grabbing' : 'grab' } : undefined}
              opacity={arrastrando ? 0.65 : 1}>
              <Glifo x={px} y={py} w={pw} h={ph} tipo={p.tipo} col={colorTipo(p.tipo)} rot={c.rot} />
              {/* Zona de toque generosa: en celular, el glifo fino no se atina. */}
              {editable && <rect x={px - 60} y={py - 60} width={pw + 120} height={ph + 120}
                fill="transparent" stroke={activo ? '#B22A22' : 'transparent'} strokeWidth="46" strokeDasharray="130 90" />}
              {/* El menú sale PEGADO al mueble. Cada toque en ⟳ gira 90°: cuatro
                  toques dan la vuelta completa. */}
              {activo && !arrastrando && (
                <MenuPieza x={px} y={py} w={pw} girar={() => onGirar?.(c.id)} quitar={() => onQuitar?.(c.id)} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (v) => Math.round(Math.max(0, Math.min(255, v * f)));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

// Materiales Von Haucke (para el 3D). Cada uno con caras top/frente/lado ya iluminadas.
const MAT = {
  oak: '#C6A971', charcoal: '#3C3E42', white: '#E8E4DD', felt: '#77838F',
  glass: '#A9C0CB', chair: '#8B909A', floor: '#E9E1D5', wall: '#F6F3EE',
  losa: '#D9D2C7', columna: '#BFB8AD', escalera: '#CFC7BA', pantalla: '#33383F',
};

// ---- ISOMÉTRICO (3D) ----
// Orden de dibujo (algoritmo del pintor): se ordenan UNIDADES completas —un
// mueble entero, un tramo de muro, una columna— por su esquina MÁS CERCANA
// (x+w + y+d). Dentro de un mueble el orden lo pone la mano (patas → cubierta →
// monitor → silla de enfrente): ordenar pieza por pieza rompía los monitores,
// que quedaban debajo de su propia cubierta.
function PlanoIso({ areas, offs, coloc, byId, limpio = false }) {
  const P = (x, y, z = 0) => [(x - y) * C, (x + y) * S - z];
  const pts2d = (pts) => pts.map((p) => p.join(',')).join(' ');

  // ------- encuadre: se mide antes de dibujar para escalar líneas y sombras ----
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const push = ([X, Y]) => { minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y); };
  areas.forEach((a, i) => {
    contorno(a, offs[i]).forEach(([x, y]) => {
      push(P(x - MURO, y - MURO, -LOSA)); push(P(x + MURO, y + MURO, -LOSA)); push(P(x, y, ALTO_MURO));
    });
  });
  const escala = Math.max(1, maxX - minX);
  const LW = escala / 620;                    // grosor de línea ≈ 1 px en pantalla
  const BLUR = escala / 150;                  // difuminado de sombra a escala real
  const pad = escala * 0.045;
  const vb = `${minX - pad} ${minY - pad} ${(maxX - minX) + 2 * pad} ${(maxY - minY) + 2 * pad}`;

  const poly = (pts, fill, stroke, op = 1, k) =>
    <polygon key={k} points={pts2d(pts)} fill={fill} stroke={stroke} strokeWidth={LW} strokeLinejoin="round" fillOpacity={op} />;

  // Cuboide iso (3 caras) con iluminación: top clara, frente media, lado oscura.
  const cuboide = (x, y, w, d, z0, z1, col, key, opts = {}) => {
    const top = [P(x, y, z1), P(x + w, y, z1), P(x + w, y + d, z1), P(x, y + d, z1)];
    const frente = [P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x, y + d, z1)];
    const lado = [P(x + w, y, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x + w, y, z1)];
    if (opts.glass) return <g key={key}>
      {poly(frente, col, shadeHex(col, 0.72), 0.34, 'f')}
      {poly(lado, shadeHex(col, 0.9), shadeHex(col, 0.72), 0.34, 'l')}
      {poly(top, col, shadeHex(col, 0.78), 0.55, 't')}
    </g>;
    return <g key={key}>
      {poly(lado, shadeHex(col, 0.80), shadeHex(col, 0.60), 1, 'l')}
      {poly(frente, shadeHex(col, 0.91), shadeHex(col, 0.64), 1, 'f')}
      {poly(top, opts.topFill || shadeHex(col, 1.07), shadeHex(col, 0.78), 1, 't')}
    </g>;
  };

  // ------- UNIDADES: se juntan y se ordenan de lejos a cerca ------------------
  const unidades = [];  // { z: profundidad, el }
  const unidad = (z, el) => unidades.push({ z, el });

  // --- muros: sólo en los bordes LEJANOS del contorno (los cercanos, abiertos) ---
  areas.forEach((a, i) => {
    const pts = contorno(a, offs[i]);
    const n = pts.length;
    const cx = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n;
    const cen = cx + cy;
    for (let k = 0; k < n; k++) {
      const A = pts[k], B = pts[(k + 1) % n];
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      if (mx + my >= cen) continue;                      // borde cercano: se deja abierto
      const dx = B[0] - A[0], dy = B[1] - A[1];
      const len = Math.hypot(dx, dy); if (len < 1) continue;
      // normal hacia AFUERA: la que aleja el punto medio del centro del cuarto
      let nx = -dy / len, ny = dx / len;
      const lejos = (sx, sy) => (mx + nx * sx - cx) ** 2 + (my + ny * sy - cy) ** 2;
      if (lejos(100, 100) < lejos(-100, -100)) { nx = -nx; ny = -ny; }
      const tramos = Math.max(1, Math.ceil(len / 700));
      const tono = Math.abs(dx) >= Math.abs(dy) ? 1 : 0.9;   // de frente / de canto
      const col = shadeHex(MAT.wall, tono);
      for (let t = 0; t < tramos; t++) {
        const x1 = A[0] + (dx * t) / tramos, y1 = A[1] + (dy * t) / tramos;
        const x2 = A[0] + (dx * (t + 1)) / tramos, y2 = A[1] + (dy * (t + 1)) / tramos;
        const cara = [P(x1, y1, 0), P(x2, y2, 0), P(x2, y2, ALTO_MURO), P(x1, y1, ALTO_MURO)];
        const cap = [P(x1, y1, ALTO_MURO), P(x2, y2, ALTO_MURO),
          P(x2 + nx * MURO, y2 + ny * MURO, ALTO_MURO), P(x1 + nx * MURO, y1 + ny * MURO, ALTO_MURO)];
        // Los tramos existen sólo para ordenar la profundidad: si cada uno lleva
        // su contorno, el muro sale RAYADO. Se rellenan sin borde y se trazan
        // únicamente las aristas horizontales, que al ser colineales se unen.
        const linea = (a, b, op) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={shadeHex(MAT.wall, tono * 0.74)} strokeWidth={LW} strokeOpacity={op} />;
        unidad(Math.max(x1 + y1, x2 + y2), <g key={`w${i}-${k}-${t}`}>
          <polygon points={pts2d(cara)} fill={col} />
          <polygon points={pts2d(cap)} fill={shadeHex(MAT.wall, tono * 1.05)} />
          {linea(P(x1, y1, 0), P(x2, y2, 0), 0.55)}
          {linea(P(x1, y1, ALTO_MURO), P(x2, y2, ALTO_MURO), 1)}
          {linea(P(x1 + nx * MURO, y1 + ny * MURO, ALTO_MURO), P(x2 + nx * MURO, y2 + ny * MURO, ALTO_MURO), 1)}
        </g>);
      }
    }
    // columnas y escaleras del plano real
    (a.obstaculos || []).filter(fisico).forEach((o, k) => {
      const ox = offs[i].x + o.x, oy = offs[i].y + o.y;
      const alto = o.tipo === 'escalera' ? 450 : ALTO_MURO;
      const col = o.tipo === 'escalera' ? MAT.escalera : MAT.columna;
      unidad(ox + o.w + oy + o.h, cuboide(ox, oy, o.w, o.h, 0, alto, col, `ob${i}-${k}`));
    });
  });

  // --- muebles: cada uno es UNA unidad; adentro el orden es explícito ---------
  const silla = (out, cx, cy, haciaSur, key) => {
    const W = 520, D = 520;
    out.push(cuboide(cx - 70, cy - 70, 140, 140, 0, 370, shadeHex(MAT.chair, 0.72), key + 'p'));
    out.push(cuboide(cx - W / 2, cy - D / 2, W, D, 370, 450, MAT.chair, key + 'a'));
    const ry = haciaSur ? cy + D / 2 - 90 : cy - D / 2;
    out.push(cuboide(cx - W / 2 + 40, ry, W - 80, 90, 450, 950, shadeHex(MAT.chair, 1.06), key + 'r'));
  };

  const mueble = (x, y, w, d, tipo, key) => {
    const H = altoTipo(tipo);
    const atras = [], cuerpo = [], frente = [];   // se concatenan en ese orden
    if (tipo === 'escritorio') {
      const bench = d > 1000;                       // bench doble: dos hileras enfrentadas
      const n = Math.max(1, Math.round(w / 1500));  // puestos por hilera
      const mw = Math.min(520, (w / n) * 0.42);   // el monitor es acento, no protagonista
      for (let k = 0; k < n; k++) {
        const cx = x + (w * (k + 0.5)) / n;
        // En un bench doble hay gente de los dos lados; en un escritorio suelto,
        // sólo de frente. La silla de atrás va ANTES del mueble (queda detrás).
        if (bench) silla(atras, cx, y - 340, false, `${key}s1${k}`);
        silla(frente, cx, y + d + 330, true, `${key}s2${k}`);
      }
      cuerpo.push(cuboide(x + 40, y + 50, 80, d - 100, 0, H - 30, MAT.charcoal, key + 'lz'));
      cuerpo.push(cuboide(x + w - 120, y + 50, 80, d - 100, 0, H - 30, MAT.charcoal, key + 'ld'));
      cuerpo.push(cuboide(x, y, w, d, H - 30, H, MAT.oak, key + 't', { topFill: 'url(#pa-oak)' }));
      for (let k = 0; k < n; k++) {
        const cx = x + (w * (k + 0.5)) / n;
        if (bench) cuerpo.push(cuboide(cx - mw / 2, y + d * 0.28, mw, 45, H, H + 360, MAT.pantalla, `${key}m1${k}`));
        else cuerpo.push(cuboide(cx - mw / 2, y + 120, mw, 45, H, H + 360, MAT.pantalla, `${key}m${k}`));
      }
      if (bench) {
        cuerpo.push(cuboide(x + 50, y + d / 2 - 25, w - 100, 50, H, H + 370, MAT.felt, key + 'b'));
        for (let k = 0; k < n; k++) {
          const cx = x + (w * (k + 0.5)) / n;
          cuerpo.push(cuboide(cx - mw / 2, y + d * 0.72 - 50, mw, 45, H, H + 360, MAT.pantalla, `${key}m2${k}`));
        }
      }
    } else if (tipo === 'juntas' || tipo === 'mesa') {
      if (tipo === 'juntas') {                       // las sillas alrededor son lo que la hace leer como junta
        const n = Math.max(2, Math.round(w / 800));
        for (let k = 0; k < n; k++) {
          const cx = x + (w * (k + 0.5)) / n;
          silla(atras, cx, y - 350, false, `${key}sa${k}`);
          silla(frente, cx, y + d + 350, true, `${key}sb${k}`);
        }
      }
      cuerpo.push(cuboide(x + w * 0.34, y + d * 0.30, w * 0.32, d * 0.40, 0, H - 30, MAT.charcoal, key + 'p'));
      cuerpo.push(cuboide(x, y, w, d, H - 30, H, MAT.oak, key + 't', { topFill: 'url(#pa-oak)' }));
    } else if (tipo === 'guarda') {
      cuerpo.push(cuboide(x, y, w, d, 0, H - 26, MAT.white, key + 'c'));
      cuerpo.push(cuboide(x - 10, y - 10, w + 20, d + 20, H - 26, H, MAT.oak, key + 't', { topFill: 'url(#pa-oak)' }));
    } else if (tipo === 'asiento') {
      cuerpo.push(cuboide(x + w * 0.08, y + d * 0.08, w * 0.84, d * 0.84, 0, 430, MAT.chair, key + 's'));
      cuerpo.push(cuboide(x + w * 0.08, y + d * 0.08, w * 0.84, 110, 430, 810, shadeHex(MAT.chair, 1.12), key + 'r'));
    } else if (tipo === 'mampara') {
      cuerpo.push(cuboide(x, y, w, Math.max(60, d), 0, H, MAT.glass, key + 'm', { glass: true }));
    } else {
      cuerpo.push(cuboide(x, y, w, d, 0, H, colorTipo(tipo), key + 'x'));
    }
    return [...atras, ...cuerpo, ...frente];
  };

  const piezas = coloc.map((c) => {
    const p = byId[c.id]; if (!p) return null;
    const ox = offs[c.area]?.x ?? 0, oy = offs[c.area]?.y ?? 0;
    const { pw, ph } = dimsPieza(p, c.rot);
    return { key: c.id, x: ox + c.x, y: oy + c.y, pw, ph, tipo: p.tipo };
  }).filter(Boolean);
  piezas.forEach((pz) => unidad(pz.x + pz.pw + pz.y + pz.ph, <g key={pz.key}>{mueble(pz.x, pz.y, pz.pw, pz.ph, pz.tipo, pz.key)}</g>));

  unidades.sort((a, b) => a.z - b.z);

  // ------- piso: losa con espesor + rejilla de 1 m (da escala y aplomo) --------
  const etiquetas = [];
  const escenario = areas.map((a, i) => {
    const pts = contorno(a, offs[i]);
    const arriba = pts.map(([x, y]) => P(x, y, 0));
    const cen = pts.reduce((s, p) => s + p[0] + p[1], 0) / pts.length;
    const canto = [];                                  // faldón de la losa (bordes cercanos)
    for (let k = 0; k < pts.length; k++) {
      const A = pts[k], B = pts[(k + 1) % pts.length];
      if ((A[0] + A[1] + B[0] + B[1]) / 2 < cen) continue;   // borde lejano: no se ve
      canto.push(<polygon key={`c${i}-${k}`} points={pts2d([P(A[0], A[1], 0), P(B[0], B[1], 0), P(B[0], B[1], -LOSA), P(A[0], A[1], -LOSA)])}
        fill={MAT.losa} stroke={shadeHex(MAT.losa, 0.82)} strokeWidth={LW} />);
    }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const rej = [];
    for (let gx = Math.ceil(x0 / 1000) * 1000; gx < x1; gx += 1000) rej.push(<line key={`gx${gx}`} x1={P(gx, y0)[0]} y1={P(gx, y0)[1]} x2={P(gx, y1)[0]} y2={P(gx, y1)[1]} stroke="#b3a691" strokeWidth={LW * 0.8} strokeOpacity="0.35" />);
    for (let gy = Math.ceil(y0 / 1000) * 1000; gy < y1; gy += 1000) rej.push(<line key={`gy${gy}`} x1={P(x0, gy)[0]} y1={P(x0, gy)[1]} x2={P(x1, gy)[0]} y2={P(x1, gy)[1]} stroke="#b3a691" strokeWidth={LW * 0.8} strokeOpacity="0.35" />);
    // La etiqueta va ACOSTADA en el piso (como un plano de arquitecto) pero se
    // dibuja AL FINAL: si va con el piso, el primer mueble que cae encima la
    // tapa. Recortada al cuarto y con halo para que siempre se lea.
    const [tx, ty] = P(x0 + 300, y1 - 300);
    const fs = Math.max(190, Math.min((x1 - x0) / 17, (y1 - y0) / 9, 520));
    etiquetas.push(
      // OJO: el recorte va en un <g> SIN transform. Si van juntos, el clipPath
      // se resuelve ya transformado y el texto desaparece.
      <g key={'et' + i} clipPath={`url(#pa-piso${i})`}>
        <g transform={`matrix(${C} ${S} ${-C} ${S} ${tx} ${ty})`}>
          <text x="0" y="0" fontSize={fs} fontWeight="700" letterSpacing={fs * 0.08}
            fill="#6b6355" stroke="#f4f0e8" strokeWidth={fs * 0.22} strokeLinejoin="round"
            paintOrder="stroke" fillOpacity="0.62" strokeOpacity="0.55" style={{ fontFamily: 'inherit' }}>
            {etiqueta(a.nombre, (x1 - x0) * 1.5, fs).toUpperCase()}
          </text>
        </g>
      </g>,
    );
    return <g key={'esc' + i}>
      <clipPath id={`pa-piso${i}`}><polygon points={pts2d(arriba)} /></clipPath>
      {canto}
      <polygon points={pts2d(arriba)} fill="url(#pa-floor)" stroke={shadeHex(MAT.floor, 0.84)} strokeWidth={LW * 1.4} strokeLinejoin="round" />
      {!limpio && <g clipPath={`url(#pa-piso${i})`}>{rej}</g>}
    </g>;
  });

  // Sombra de contacto: la huella del mueble, corrida y difuminada.
  const sombra = (pz) => {
    const o = 130;
    const pts = [P(pz.x + o, pz.y + o), P(pz.x + pz.pw + o, pz.y + o), P(pz.x + pz.pw + o, pz.y + pz.ph + o), P(pz.x + o, pz.y + pz.ph + o)];
    return <polygon key={'s' + pz.key} points={pts2d(pts)} fill="#2b2620" />;
  };

  return (
    <div className="plano-wrap plano-wrap-3d">
      <svg className="plano" viewBox={vb} preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="pa-bg" cx="50%" cy="24%" r="88%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e3dcd1" />
          </radialGradient>
          <linearGradient id="pa-floor" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#f4efe6" />
            <stop offset="100%" stopColor="#e2dacd" />
          </linearGradient>
          <linearGradient id="pa-oak" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#dcc290" />
            <stop offset="55%" stopColor="#c6a971" />
            <stop offset="100%" stopColor="#b3945f" />
          </linearGradient>
          <filter id="pa-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation={BLUR} />
          </filter>
        </defs>
        <rect x={minX - pad} y={minY - pad} width={(maxX - minX) + 2 * pad} height={(maxY - minY) + 2 * pad} fill="url(#pa-bg)" />
        {escenario}
        <g filter="url(#pa-soft)" opacity="0.32">{piezas.map(sombra)}</g>
        {unidades.map((u, i) => <g key={i}>{u.el}</g>)}
        {!limpio && etiquetas}
      </svg>
    </div>
  );
}
