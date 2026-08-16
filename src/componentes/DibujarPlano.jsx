// ============================================================================
//  DIBUJAR PLANO  ·  lienzo para trazar la oficina con el dedo/mouse.
//  Dibujas cuartos (rectángulos) a escala, les pones nombre/medida y altura,
//  agregas puertas, y con eso el sistema acomoda los muebles de la cotización.
//  Todo en METROS; snap a 0.5 m. Touch + mouse (pointer events).
// ============================================================================
import { useRef, useState } from 'react';
import { contornoDeTrazo, areaDe, SELLOS, pegarAVecinos } from '../datos/trazo.js';

const W = 22, H = 15;      // lienzo en metros
const GRID = 0.5;          // snap
const snap = (v) => Math.round(v / GRID) * GRID;

// QUÉ ES cada cuarto. El acomodo reparte por esto: sin decirlo, todos los
// cuartos valen igual y los muebles se amontonan en el más grande.
const TIPOS_CUARTO = [
  { id: 'open', t: 'Open space' },
  { id: 'privado', t: 'Privado' },
  { id: 'juntas', t: 'Sala de juntas' },
  { id: 'recepcion', t: 'Recepción' },
  { id: 'lounge', t: 'Lounge / comedor' },
  { id: 'servicio', t: 'Baño / servicio' },
];
// Propuesta inicial por tamaño, para que casi nunca haya que corregirla.
const tipoPorTamano = (w, h) => {
  const m2 = w * h;
  if (m2 <= 6) return 'servicio';
  if (m2 <= 16) return 'privado';
  if (m2 <= 30) return 'juntas';
  return 'open';
};

export default function DibujarPlano({ onListo, onCancelar }) {
  const [rooms, setRooms] = useState([]);
  const [doors, setDoors] = useState([]);
  const [cols, setCols] = useState([]);       // columnas (punto)
  const [stairs, setStairs] = useState([]);   // escaleras (rect)
  const [alto, setAlto] = useState(2.7);
  const [tool, setTool] = useState('room');   // 'room' | 'forma' | 'door' | 'columna' | 'escalera'
  const [drag, setDrag] = useState(null);
  const [vertices, setVertices] = useState([]); // forma libre en construcción
  // El trazo se acumula en una REFERENCIA, no en estado: los eventos del dedo
  // llegan muy seguidos y con estado se pierden puntos (React no alcanza a
  // re-renderizar entre uno y otro). El estado es sólo para ir pintándolo.
  const trazoRef = useRef(null);
  const [trazo, setTrazo] = useState(null);     // copia para dibujar
  const svgRef = useRef(null);

  // Área de un polígono (fórmula del agrimensor) y su caja envolvente.
  const areaPoly = (p) => Math.abs(p.reduce((s, [x, y], i) => {
    const [x2, y2] = p[(i + 1) % p.length];
    return s + (x * y2 - x2 * y);
  }, 0)) / 2;
  const cajaDe = (p) => {
    const xs = p.map(([x]) => x), ys = p.map(([, y]) => y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };

  function cerrarForma() {
    if (vertices.length < 3) return;
    const c = cajaDe(vertices);
    setRooms((r) => [...r, { id: Date.now(), ...c, poly: vertices, nombre: `Área ${r.length + 1}`, tipo: tipoPorTamano(c.w, c.h), doble: false }]);
    setVertices([]);
  }

  const toM = (e, conSnap = true) => {
    const r = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(W, (e.clientX - r.left) / r.width * W));
    const y = Math.max(0, Math.min(H, (e.clientY - r.top) / r.height * H));
    // El trazo a mano NO se ajusta a la cuadrícula: un snap de 50 cm convierte
    // cualquier curva en escalones, que es justo lo que hay que evitar.
    return conSnap ? [snap(x), snap(y)] : [x, y];
  };

  function down(e) {
    e.preventDefault();
    const [x, y] = toM(e);
    if (tool === 'forma') {
      // Cerca del primer vértice = cerrar la forma.
      if (vertices.length >= 3 && Math.hypot(x - vertices[0][0], y - vertices[0][1]) < 0.8) { cerrarForma(); return; }
      setVertices((v) => [...v, [x, y]]);
      return;
    }
    if (tool === 'mano') {
      const [xr, yr] = toM(e, false);
      trazoRef.current = [[xr, yr]];
      setTrazo(trazoRef.current);
      try { e.target.setPointerCapture?.(e.pointerId); } catch (_) {}
      return;
    }
    if (tool.startsWith('sello:')) {
      const sel = SELLOS.find((q) => q.tipo === tool.slice(6));
      if (sel) {
        setRooms((rs) => {
          const caja = pegarAVecinos({ x: snap(x - sel.w / 2), y: snap(y - sel.h / 2), w: sel.w, h: sel.h }, rs);
          const n = rs.filter((q) => q.tipo === sel.tipo).length + 1;
          return [...rs, { id: Date.now(), ...caja, poly: null,
            nombre: `${sel.et} ${n}`, tipo: sel.tipo, doble: false }];
        });
      }
      return;
    }
    if (tool === 'door') { setDoors((d) => [...d, { id: Date.now(), x, y }]); return; }
    if (tool === 'columna') { setCols((c) => [...c, { id: Date.now(), x, y }]); return; }
    setDrag({ x0: x, y0: y, x1: x, y1: y, kind: tool });   // room | escalera
    try { e.target.setPointerCapture?.(e.pointerId); } catch (_) {}
  }
  function move(e) {
    if (trazoRef.current) {
      const [x, y] = toM(e, false);
      // Sólo se apuntan los puntos que aportan: 5 cm de paso deja el trazo
      // suave sin guardar mil puntos del temblor del dedo.
      const t = trazoRef.current;
      const u = t[t.length - 1];
      if (Math.hypot(x - u[0], y - u[1]) >= 0.05) {
        trazoRef.current = [...t, [x, y]];
        setTrazo(trazoRef.current);
      }
      return;
    }
    if (!drag) return;
    const [x, y] = toM(e);
    setDrag((d) => ({ ...d, x1: x, y1: y }));
  }
  function up() {
    // Trazo a mano alzada terminado: se simplifica, se enderezan los muros que
    // iban casi rectos, se respeta lo que es curva y se cierra el cuarto solo.
    if (trazoRef.current) {
      const poly = contornoDeTrazo(trazoRef.current);
      trazoRef.current = null;
      setTrazo(null);
      if (poly) {
        const c = cajaDe(poly);
        if (c.w >= 0.8 && c.h >= 0.8) {
          setRooms((r) => [...r, { id: Date.now(), ...c, poly,
            nombre: `Área ${r.length + 1}`, tipo: tipoPorTamano(c.w, c.h), doble: false }]);
        }
      }
      return;
    }
    if (!drag) return;
    const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
    if (drag.kind === 'escalera') { if (w >= 0.8 && h >= 0.8) setStairs((s) => [...s, { id: Date.now(), x, y, w, h }]); }
    else if (w >= 1 && h >= 1) setRooms((r) => [...r, { id: Date.now(), x, y, w, h, nombre: `Área ${r.length + 1}`, tipo: tipoPorTamano(w, h), doble: false }]);
    setDrag(null);
  }

  const setRoom = (id, campo, val) => setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, [campo]: val } : r)));
  const delRoom = (id) => setRooms((rs) => rs.filter((r) => r.id !== id));
  const totalM2 = rooms.reduce((a, r) => a + (r.poly ? areaPoly(r.poly) : r.w * r.h), 0);

  const dragRect = drag && { x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0) };

  function listo() {
    if (!rooms.length) return;
    // Cada área viaja con su GEOMETRÍA real: el polígono (si no es un
    // rectángulo) y los obstáculos que le caen dentro, ya en coordenadas
    // locales al cuarto. Con eso el motor esquiva columnas y escaleras de
    // verdad, en vez de sólo mencionarlas en el render.
    const dentroDe = (r, x, y, w = 0, h = 0) =>
      x + w >= r.x && x <= r.x + r.w && y + h >= r.y && y <= r.y + r.h;
    const areas = rooms.map((r) => {
      const obst = [
        ...cols.filter((c) => dentroDe(r, c.x - 0.2, c.y - 0.2, 0.4, 0.4))
          .map((c) => ({ x: c.x - 0.2 - r.x, y: c.y - 0.2 - r.y, w: 0.4, h: 0.4, tipo: 'columna' })),
        ...stairs.filter((s) => dentroDe(r, s.x, s.y, s.w, s.h))
          .map((s) => ({ x: s.x - r.x, y: s.y - r.y, w: s.w, h: s.h, tipo: 'escalera' })),
      ];
      return {
        nombre: r.nombre || 'Área', ancho: r.w, largo: r.h, tipo: r.tipo || tipoPorTamano(r.w, r.h),
        // La POSICIÓN del cuarto en el plano viaja también: sin ella el 3D
        // re-acomodaba los cuartos en una cuadrícula inventada y el dibujo no se
        // parecía a la oficina que el cliente acababa de trazar.
        x: r.x, y: r.y,
        poly: r.poly ? r.poly.map(([x, y]) => [x - r.x, y - r.y]) : null,
        obstaculos: obst,
      };
    });
    const meta = {
      alto,
      doors: doors.length,
      columnas: cols.length,
      escaleras: stairs.length,
      dobles: rooms.filter((r) => r.doble).map((r) => r.nombre || 'Área'),
    };
    onListo(areas, meta);
  }

  return (
    <div className="tarjeta">
      <div className="fila-botones" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Dibuja tu oficina</h2>
        <div className="fila-botones" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className={`boton ${tool === 'room' ? 'primario' : 'fantasma'}`} style={{ minHeight: 42 }} onClick={() => setTool('room')}>Cuarto</button>
          <button className={`boton ${tool === 'mano' ? 'primario' : 'fantasma'}`} style={{ minHeight: 42 }} onClick={() => setTool('mano')}>Trazo a mano</button>
          <button className={`boton ${tool === 'forma' ? 'primario' : 'fantasma'}`} style={{ minHeight: 42 }} onClick={() => setTool('forma')}>Esquina por esquina</button>
          <button className={`boton ${tool === 'door' ? 'primario' : 'fantasma'}`} style={{ minHeight: 42 }} onClick={() => setTool('door')}>Puerta</button>
          <button className={`boton ${tool === 'columna' ? 'primario' : 'fantasma'}`} style={{ minHeight: 42 }} onClick={() => setTool('columna')}>Columna</button>
          <button className={`boton ${tool === 'escalera' ? 'primario' : 'fantasma'}`} style={{ minHeight: 42 }} onClick={() => setTool('escalera')}>Escalera</button>
        </div>
      </div>
      {/* SELLOS: un toque por cuarto. Es lo más rápido que hay para armar una
          planta de oficina, que casi siempre es "cinco privados, una sala de
          juntas, dos baños y el open". Cada sello ya trae su tipo, que es lo
          que el motor necesita para repartir los muebles. */}
      <div className="fila-botones" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
        <span className="ayuda"><strong>Sellar cuarto:</strong></span>
        {SELLOS.map((sl) => (
          <button key={sl.tipo} className={`boton ${tool === 'sello:' + sl.tipo ? 'primario' : 'fantasma'}`}
            style={{ minHeight: 40 }}
            onClick={() => setTool(tool === 'sello:' + sl.tipo ? 'room' : 'sello:' + sl.tipo)}>
            {sl.et} <span className="gris" style={{ fontWeight: 400 }}>{sl.w}×{sl.h}</span>
          </button>
        ))}
      </div>
      <p className="ayuda columna-texto">
        {tool.startsWith('sello:') ? 'Toca el plano y el cuarto queda puesto, con su medida y su nombre. Se pega solo al cuarto de al lado para que compartan muro. Las medidas se corrigen abajo.'
          : tool === 'room' ? 'Un privado es un solo arrastre: aprieta y estira la caja. Cada cuadro de la rejilla es 1 m.'
          : tool === 'mano' ? 'Dibuja el contorno de corrido, sin soltar, como con un lápiz. Los muros que te salgan casi rectos se enderezan solos, las CURVAS se respetan, y el cuarto se cierra al volver cerca de donde empezaste.'
          : tool === 'forma' ? 'Para trazar esquina por esquina, con precisión: toca cada esquina y cierra tocando otra vez la primera.'
          : tool === 'door' ? 'Toca sobre una pared para poner una puerta.'
          : tool === 'columna' ? 'Toca donde haya una columna. El sistema NO pondrá muebles encima.'
          : 'Arrastra para marcar una escalera (zona que no se amuebla).'}
      </p>

      <svg
        ref={svgRef}
        className="dibujo-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        style={{ touchAction: 'none' }}
      >
        {/* rejilla */}
        {Array.from({ length: W + 1 }).map((_, i) => <line key={'v' + i} x1={i} y1={0} x2={i} y2={H} stroke={i % 5 === 0 ? '#cdc6be' : '#e8e3dc'} strokeWidth={i % 5 === 0 ? 0.04 : 0.02} />)}
        {Array.from({ length: H + 1 }).map((_, i) => <line key={'h' + i} x1={0} y1={i} x2={W} y2={i} stroke={i % 5 === 0 ? '#cdc6be' : '#e8e3dc'} strokeWidth={i % 5 === 0 ? 0.04 : 0.02} />)}
        {/* cuartos */}
        {rooms.map((r) => (
          <g key={r.id}>
            {r.poly
              ? <polygon points={r.poly.map(([px, py]) => `${px},${py}`).join(' ')} fill="rgba(178,42,34,0.06)" stroke="#1E1B1A" strokeWidth="0.12" />
              : <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(178,42,34,0.06)" stroke="#1E1B1A" strokeWidth="0.12" />}
            <text x={r.x + r.w / 2} y={r.y + r.h / 2 - 0.15} fontSize="0.5" fill="#1E1B1A" fontWeight="700" textAnchor="middle">{r.nombre}</text>
            <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 0.55} fontSize="0.42" fill="#746E68" textAnchor="middle">{r.poly ? `${areaPoly(r.poly).toFixed(1)} m²` : `${r.w.toFixed(1)} × ${r.h.toFixed(1)} m`}</text>
            <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 1.15} fontSize="0.38" fill="#B22A22" fontWeight="700" textAnchor="middle">{(TIPOS_CUARTO.find((t) => t.id === (r.tipo || tipoPorTamano(r.w, r.h))) || {}).t}</text>
            {r.doble && <text x={r.x + r.w / 2} y={r.y + 0.55} fontSize="0.34" fill="#B22A22" fontWeight="700" textAnchor="middle">doble altura</text>}
          </g>
        ))}
        {/* puertas */}
        {doors.map((d) => <g key={d.id}><rect x={d.x - 0.45} y={d.y - 0.12} width="0.9" height="0.24" fill="#fff" stroke="#B22A22" strokeWidth="0.06" /><path d={`M ${d.x - 0.45} ${d.y} a 0.9 0.9 0 0 1 0.9 0`} fill="none" stroke="#B22A22" strokeWidth="0.05" /></g>)}
        {/* columnas */}
        {cols.map((c) => <rect key={c.id} x={c.x - 0.2} y={c.y - 0.2} width="0.4" height="0.4" fill="#3C3E42" stroke="#1E1B1A" strokeWidth="0.05" />)}
        {/* escaleras */}
        {stairs.map((s) => (
          <g key={s.id}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="#e3ddd4" stroke="#1E1B1A" strokeWidth="0.08" />
            {Array.from({ length: Math.max(2, Math.round(s.h / 0.3)) }).map((_, k) => <line key={k} x1={s.x} y1={s.y + (s.h * (k + 1)) / Math.max(2, Math.round(s.h / 0.3))} x2={s.x + s.w} y2={s.y + (s.h * (k + 1)) / Math.max(2, Math.round(s.h / 0.3))} stroke="#8a8178" strokeWidth="0.04" />)}
            <text x={s.x + s.w / 2} y={s.y + s.h / 2} fontSize="0.3" fill="#746E68" textAnchor="middle">escalera</text>
          </g>
        ))}
        {/* preview */}
        {vertices.length > 0 && (
          <g>
            <polyline points={vertices.map(([x, y]) => `${x},${y}`).join(' ')} fill="rgba(178,42,34,0.10)" stroke="#B22A22" strokeWidth="0.1" strokeDasharray="0.3 0.2" />
            {vertices.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 0 ? 0.28 : 0.18} fill={i === 0 ? '#B22A22' : '#fff'} stroke="#B22A22" strokeWidth="0.07" />)}
          </g>
        )}
        {trazo && trazo.length > 1 && (
          <polyline points={trazo.map(([x, y]) => `${x},${y}`).join(' ')} fill="rgba(178,42,34,0.08)"
            stroke="#B22A22" strokeWidth="0.12" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {dragRect && dragRect.w > 0 && <rect x={dragRect.x} y={dragRect.y} width={dragRect.w} height={dragRect.h} fill="rgba(178,42,34,0.12)" stroke="#B22A22" strokeWidth="0.1" strokeDasharray="0.3 0.2" />}
      </svg>

      <div className="fila-botones" style={{ gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="etiqueta" style={{ margin: 0 }}>Altura (m)</label>
        <input type="number" className="numero" style={{ width: 80 }} min="2" max="6" step="0.1" value={alto} onChange={(e) => setAlto(parseFloat(e.target.value) || 2.7)} />
        {vertices.length >= 3 && <button className="boton primario" style={{ minHeight: 42 }} onClick={cerrarForma}>Cerrar forma ({vertices.length} esquinas)</button>}
        {vertices.length > 0 && vertices.length < 3 && <span className="ayuda">Marca al menos 3 esquinas…</span>}
        {vertices.length > 0 && <button className="boton fantasma" style={{ minHeight: 42 }} onClick={() => setVertices([])}>Descartar forma</button>}
        <span className="ayuda" style={{ marginLeft: 'auto' }}>{rooms.length} cuarto(s) · {totalM2.toFixed(1)} m²{cols.length ? ` · ${cols.length} col.` : ''}{stairs.length ? ` · ${stairs.length} escal.` : ''}</span>
        {(rooms.length || cols.length || stairs.length || doors.length) > 0 && <button className="boton fantasma" style={{ minHeight: 42 }} onClick={() => { setRooms([]); setDoors([]); setCols([]); setStairs([]); setVertices([]); }}>Limpiar</button>}
      </div>

      {rooms.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <label className="etiqueta">Cuartos</label>
          {rooms.map((r) => (
            <div className="fila-botones" key={r.id} style={{ alignItems: 'flex-end', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 130 }}><input type="text" value={r.nombre} onChange={(e) => setRoom(r.id, 'nombre', e.target.value)} placeholder="Nombre" /></div>
              <div><input type="number" className="numero" style={{ width: 80 }} min="1" step="0.5" value={r.w} onChange={(e) => setRoom(r.id, 'w', parseFloat(e.target.value) || 1)} /><span className="ayuda" style={{ display: 'inline', marginLeft: 4 }}>ancho</span></div>
              <div><input type="number" className="numero" style={{ width: 80 }} min="1" step="0.5" value={r.h} onChange={(e) => setRoom(r.id, 'h', parseFloat(e.target.value) || 1)} /><span className="ayuda" style={{ display: 'inline', marginLeft: 4 }}>largo</span></div>
              <label className="ayuda" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><input type="checkbox" checked={!!r.doble} onChange={(e) => setRoom(r.id, 'doble', e.target.checked)} /> doble altura</label>
              <button className="boton fantasma" style={{ minHeight: 44, padding: '0 12px' }} onClick={() => delRoom(r.id)}>Quitar</button>
              <div style={{ flexBasis: '100%' }}>
                <div className="chips" style={{ marginBottom: 0 }}>
                  {TIPOS_CUARTO.map((t) => (
                    <button key={t.id} className={`chip ${(r.tipo || tipoPorTamano(r.w, r.h)) === t.id ? 'on' : ''}`}
                      onClick={() => setRoom(r.id, 'tipo', t.id)}>{t.t}</button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fila-botones" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="boton primario grande" style={{ flex: 1, minWidth: 200 }} disabled={!rooms.length} onClick={listo}>Amueblar mi oficina →</button>
        {onCancelar && <button className="boton fantasma grande" onClick={onCancelar}>Cancelar</button>}
      </div>
    </div>
  );
}
