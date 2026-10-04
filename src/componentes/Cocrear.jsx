// ============================================================================
//  COCREAR STUDIO · co-diseño EN VIVO con el cliente.
//  El cliente IMAGINA → VE → CAMBIA → COMPARA → DECIDE, y el producto evoluciona
//  visualmente frente a él. VONI propone; Costear/Cotizar operan debajo (backstage).
//  El protagonista es el PRODUCTO (canvas), no una tabla ni un formulario.
//
//  Loop: "¿Qué tienes en mente?" → Voni entiende → concepto visual → el cliente
//  ajusta (controles o lenguaje natural) → el producto cambia de verdad (revisión)
//  → Voni sugiere mejoras honestas → comparar A/B → historia → guardar.
//
//  Responsive P0 (móvil/tablet/desktop). Seller-safe. Determinista + instantáneo.
// ============================================================================
import React, { useMemo, useState, useRef } from 'react';
import {
  interpretarIntent, cocrearDesdeIntent, construirProductSpec, extraerDNA, clasificarProducto,
  aplicarCambioTexto, sugerenciasVoni, descripcionCorta, lineaCocreada,
  cocrearAExpediente, cocrearDeExpediente, cocrearPayload,
  DIMS_DEFAULT, MATERIALES_EDIT, FAMILIA, COCREO_STATUS, COST_STATUS,
} from '../datos/cocrear.js';
import { listarCocreaciones, guardarCocrearSeguro, cargarCocrearSeguro, registrarProductoDesdeExpediente, subirRenderCanonico } from '../nube.js';
import CocrearVisual from './CocrearVisual.jsx';
import { parametrosEfectivos } from './Costeador.jsx';
import { precioVenta } from '../motor/calculo.js';
import { compileRenderPrompt, renderStale } from '../datos/renderPrompt.js';
import { voniTurno, voniReview } from '../datos/voni.js';
import { generarRender } from '../nube.js';

const EJEMPLOS = [
  'Quiero una recepción cálida, premium, curva, 2.40 m, nogal oscuro, cubierta clara, iluminación integrada, para dos personas.',
  'Necesito lockers inteligentes para aeropuerto, 1.80 m, con cerraduras y pantalla.',
  'Un escritorio ejecutivo 1.80 m en nogal, con cajones y cargador de celular.',
  'Un exhibidor de juguetes para tienda, 1.20 m, con iluminación.',
];

const MATERIAL_LABEL = { nogal: 'Nogal', roble: 'Roble', encino: 'Encino', maple: 'Maple', laminado: 'Laminado', solid_surface: 'Solid surface', cristal: 'Cristal', metal: 'Metal', piedra: 'Piedra' };
const FEATURE_LABEL = {
  iluminacion_integrada: 'Iluminación', cajones: 'Cajones', flotante: 'Flotante', carga_inalambrica: 'Cargador',
  cerraduras: 'Cerraduras', electronica: 'Pantalla/electrónica', ventilacion: 'Ventilación', curva: 'Curva',
  refuerzo_inferior: 'Refuerzo inferior', registro_mantenimiento: 'Registro mant.', acceso_definido: 'Acceso definido', ruedas: 'Ruedas',
};
// Qué features ofrece el panel por familia (controles especializados, §8).
const FEATURES_POR_FAMILIA = {
  [FAMILIA.RECEPCION]: ['iluminacion_integrada', 'cajones', 'flotante', 'carga_inalambrica'],
  [FAMILIA.ESCRITORIO]: ['cajones', 'carga_inalambrica', 'electronica', 'flotante'],
  [FAMILIA.MESA]: ['iluminacion_integrada', 'carga_inalambrica'],
  [FAMILIA.LOCKER]: ['cerraduras', 'electronica', 'ventilacion', 'acceso_definido'],
  [FAMILIA.DISPLAY]: ['iluminacion_integrada', 'ruedas', 'cajones'],
  [FAMILIA.GUARDADO]: ['cajones', 'cerraduras'],
  [FAMILIA.DESCONOCIDA]: ['iluminacion_integrada', 'cajones'],
};
const RANGO_ANCHO = {
  [FAMILIA.RECEPCION]: [1400, 4000], [FAMILIA.ESCRITORIO]: [1000, 2400], [FAMILIA.MESA]: [1200, 4000],
  [FAMILIA.LOCKER]: [600, 3000], [FAMILIA.DISPLAY]: [600, 2400], [FAMILIA.GUARDADO]: [600, 2400], [FAMILIA.DESCONOCIDA]: [600, 3000],
};

const tono = (s) => {
  const x = String(s || '');
  if (/READY|KNOWN|CAN_BUILD|VALIDATED|ok|lista/.test(x)) return 'verde';
  if (/PARTIAL|ESTIMATED|PROPOSED|parcial/.test(x)) return 'ambar';
  if (/BLOCKED|REQUIRES_VALIDATION|PENDING|UNKNOWN|requiere|DRAFT/.test(x)) return 'rojo';
  return 'gris';
};
const COLOR = { verde: '#067647', ambar: '#B54708', rojo: '#B42318', gris: '#667085' };
const FONDO = { verde: '#ECFDF3', ambar: '#FFFAEB', rojo: '#FEF3F2', gris: '#F2F4F7' };
const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
const DRAFT_KEY = 'cocrear_draft_v1';

function Badge({ children, estado }) {
  const t = tono(estado ?? children);
  return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: COLOR[t], background: FONDO[t], border: `1px solid ${COLOR[t]}22`, whiteSpace: 'nowrap' }}>{children}</span>;
}

export default function Cocrear({ estado, soloVentas = false, onIr, onAgregar }) {
  const [fase, setFase] = useState('inicio');
  const [texto, setTexto] = useState('');
  const [intent, setIntent] = useState(null);       // diseño vivo
  const [historia, setHistoria] = useState([]);      // revisiones [{rev,intent,label}]
  const [comparA, setComparA] = useState(null);      // snapshot para A/B
  const [propuestas, setPropuestas] = useState(null);
  const [nl, setNl] = useState('');
  const [vozMsg, setVozMsg] = useState('');
  const [voniPensando, setVoniPensando] = useState(false);
  const [cotizadoHash, setCotizadoHash] = useState(null);  // hash de la rev agregada a cotización
  const [tecnico, setTecnico] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [render, setRender] = useState(null);       // { dataUrl, specHash, expected, version }
  const [renderCargando, setRenderCargando] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [expedienteId, setExpedienteId] = useState(null);  // id en Supabase (persistencia real)
  const [guardando, setGuardando] = useState(false);
  const [misCocreaciones, setMisCocreaciones] = useState([]);
  const [analizando, setAnalizando] = useState(false);     // transición "VONI entendiendo…"
  const draggingRef = useRef(false);

  // En la pantalla de inicio, lista las co-creaciones GUARDADAS (reabrir de verdad,
  // no sólo draft del navegador). Degradación suave si no hay conexión.
  React.useEffect(() => {
    if (fase !== 'inicio') return;
    let vivo = true;
    (async () => {
      try {
        const r = await listarCocreaciones(8);
        if (vivo && r?.ok) setMisCocreaciones(r.items || []);
      } catch { /* sin conexión: queda el draft local */ }
    })();
    return () => { vivo = false; };
  }, [fase]);

  const insumos = estado?.insumos || {};
  const par = useMemo(() => parametrosEfectivos(estado, { componentes: [] }).par || estado?.parametros || {}, [estado]);
  const veCostos = !soloVentas;

  const rev = historia.length;
  const spec = useMemo(() => (intent ? construirProductSpec(intent, extraerDNA(intent), clasificarProducto(intent, {}), { rev: rev || 1 }) : null), [intent, rev]);
  const pipeline = useMemo(() => (intent ? cocrearDesdeIntent(intent, { insumos, par, rev: rev || 1 }) : null), [intent, insumos, par, rev]);
  const sugerencias = useMemo(() => (spec ? sugerenciasVoni(spec) : []), [spec]);

  const hayDraft = useMemo(() => { try { return !!localStorage.getItem(DRAFT_KEY); } catch { return false; } }, [fase]);

  // --- mutaciones ---
  const commit = (next, label) => {
    setIntent(next);
    setHistoria((h) => [...h, { rev: h.length + 1, intent: JSON.parse(JSON.stringify(next)), label }]);
    setGuardado(false);
  };
  const live = (next) => setIntent(next);  // durante drag: visual sigue, sin revisión

  const empezar = (t) => {
    const brief = (t ?? texto).trim();
    if (!brief) return;
    const it = interpretarIntent(brief);
    // rellena dimensiones faltantes con defaults de la familia (para el visual).
    const dd = DIMS_DEFAULT[it.familia] || DIMS_DEFAULT[FAMILIA.DESCONOCIDA];
    it.dimensiones = { ...dd, ...(it.dimensiones || {}) };
    setIntent(it);
    setHistoria([{ rev: 1, intent: JSON.parse(JSON.stringify(it)), label: 'Idea inicial' }]);
    setFase('studio'); setPropuestas(null); setVozMsg(''); setComparA(null); setExpedienteId(null);
  };

  // CTA principal: "Diseñarlo con VONI" — ejecuta la cadena real (idea → VONI
  // interpreta → ProductIntent/clasificación → ProductSpec/concepto → Studio) con
  // una transición breve "VONI está entendiendo…". No es sólo mandar texto a un chat.
  const disenarConVoni = () => {
    if (!texto.trim() || analizando) return;
    setAnalizando(true);
    setTimeout(() => { empezar(); setAnalizando(false); }, 650);
  };

  // Entrada secundaria: entrar al Studio completo aunque no haya brief todavía
  // (parte de un producto base que el cliente re-moldea con controles/VONI).
  const entrarStudioDirecto = () => {
    const it = interpretarIntent('recepción 2.40 m');
    it.dimensiones = { ...DIMS_DEFAULT[it.familia] };
    setIntent(it);
    setHistoria([{ rev: 1, intent: JSON.parse(JSON.stringify(it)), label: 'Producto base' }]);
    setFase('studio'); setPropuestas(null); setVozMsg(''); setComparA(null); setExpedienteId(null);
  };

  const retomar = () => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (d?.historia?.length) { setHistoria(d.historia); setIntent(d.historia[d.historia.length - 1].intent); setTexto(d.brief || ''); setFase('studio'); }
    } catch { /* noop */ }
  };
  // GUARDAR REAL: persiste en Supabase (expedientes + revisiones inmutables),
  // reutilizando el modelo existente. Mantiene el draft local como respaldo offline.
  // GUARDAR REAL vía RPC server-authority (guardar_cocrear_seguro): valida rol/
  // propiedad, versiona inmutable (rev+1), despoja economía al vendedor. Draft local
  // como respaldo offline. Devuelve el expediente_id canónico.
  const guardar = async () => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ brief: texto, historia })); } catch { /* noop */ }
    setGuardando(true);
    try {
      const res = await guardarCocrearSeguro(expedienteId, cocrearPayload({ brief: texto, intent, historia, render }));
      if (res?.ok) { if (res.expediente_id) setExpedienteId(res.expediente_id); setGuardado(true); }
      else throw new Error(res?.error || 'no se pudo guardar');
    } catch (e) { setVozMsg('Guardado local OK; la nube falló: ' + String(e?.message || e)); setGuardado(true); }
    setGuardando(false);
  };

  // REABRIR vía RPC seguro (cocrear_seguro): server-authority + seller-safe.
  const reabrir = async (id) => {
    try {
      const res = await cargarCocrearSeguro(id);
      const est = res?.ok ? cocrearDeExpediente({ cocrear: res.cocrear }) : null;
      if (est?.intent) {
        setHistoria(est.historia.length ? est.historia : [{ rev: 1, label: 'Idea inicial', intent: est.intent }]);
        setIntent(est.intent); setTexto(est.brief || ''); setExpedienteId(id);
        setRender(null); setPropuestas(null); setVozMsg(''); setComparA(null); setFase('studio');
      }
    } catch { /* noop */ }
  };

  // Cambia una dimensión (vivo durante el drag, revisión al soltar).
  const setAncho = (v, commitIt) => {
    const next = { ...intent, dimensiones: { ...(intent.dimensiones || {}), ancho_mm: Number(v) } };
    if (commitIt) commit(next, `Ancho ${(Number(v) / 1000).toFixed(2)} m`); else live(next);
  };
  const setMaterial = (mat) => commit({ ...intent, materiales: [{ material: mat, tono: intent.materiales?.[0]?.tono || null }, ...(intent.materiales || []).slice(1)] }, `Material: ${MATERIAL_LABEL[mat]}`);
  const setTono = (tn) => { const m = [{ material: intent.materiales?.[0]?.material || 'laminado', tono: tn }, ...(intent.materiales || []).slice(1)]; commit({ ...intent, materiales: m }, `Tono: ${tn || 'natural'}`); };
  const toggleFeature = (f) => {
    const has = (intent.caracteristicas || []).includes(f);
    const cs = has ? intent.caracteristicas.filter((c) => c !== f) : [...(intent.caracteristicas || []), f];
    commit({ ...intent, caracteristicas: cs }, `${has ? 'Quitar' : 'Agregar'}: ${FEATURE_LABEL[f] || f}`);
  };

  // El input de Voni pasa por el ORQUESTADOR: understand → validar → tool
  // (crear revisión) → verify → invalidar dependencias → responder. Nunca dice
  // "listo" si la tool/verify falla (tool-failure honesto).
  const enviarNL = async () => {
    const frase = nl.trim(); if (!frase || !intent) return;
    setNl(''); setVoniPensando(true); setPropuestas(null);
    const revSig = (historia.length || 0) + 1;
    const tools = {
      CREATE_REVISION: async (nextIntent) => {
        const h = construirProductSpec(nextIntent, extraerDNA(nextIntent), clasificarProducto(nextIntent, {}), { rev: revSig }).hash;
        commit(nextIntent, frase);
        return { ok: true, rev: revSig, hash: h };
      },
      REVIEW_PRODUCT: async (it) => voniReview(construirProductSpec(it, extraerDNA(it), clasificarProducto(it, {}), { rev: rev || 1 })),
    };
    const estudio = { spec, rev, historiaLen: historia.length, renderState: render ? (rStale ? 'stale' : 'ok') : 'none', costState: { cost_status: r?.costo?.cost_status } };
    try {
      const out = await voniTurno(frase, { intentActual: intent, role: soloVentas ? 'vendedor' : 'direccion', tools, estudio });
      setVozMsg(out.response.humano);
      setPropuestas(out.understand.proposals || null);
      // Si el producto ya estaba en la cotización y cambió, avisar (revisión nueva).
      if (out.newRev && cotizadoHash) setCotizadoHash((prev) => prev); // mantiene; la UI compara hash abajo
    } catch (e) { setVozMsg('No pude procesar la petición: ' + String(e?.message || e)); }
    setVoniPensando(false);
  };
  const elegirPropuesta = (p) => { commit(p.intent, p.label); setPropuestas(null); setVozMsg(''); };
  const aplicarSugerencia = (s) => { if (s.accion?.addFeature) commit({ ...intent, caracteristicas: [...new Set([...(intent.caracteristicas || []), s.accion.addFeature])] }, s.accion.label); };

  const verRevision = (h) => commit(h.intent, `Volver a Rev ${h.rev}`);

  // Render REAL: se compila desde el ProductSpec exacto (geometría bloqueada) y se
  // ancla al hash del spec; si el diseño cambia, el render queda STALE.
  const generar = async () => {
    if (!spec) return;
    setRenderCargando(true); setRenderError('');
    try {
      const c = compileRenderPrompt(spec, spec.dna);
      const res = await generarRender(c.descripcion, { render_spec: c.render_spec, materiales: c.materiales, medidas: c.medidas, tipo: c.tipo, modo: c.modo, aspecto: c.aspecto });
      if (res?.ok && res.dataUrl) setRender({ dataUrl: res.dataUrl, specHash: spec.hash, expected: c.expected, version: c.version });
      else setRenderError(res?.error || 'No se pudo generar el render.');
    } catch (e) { setRenderError(String(e?.message || e)); }
    setRenderCargando(false);
  };
  const rStale = render && renderStale(render, spec);

  // RENDER CANÓNICO: guarda el expediente, registra/reutiliza la ProductRevision y sube
  // la imagen al Storage registrándola contra esa versión exacta (spec_hash). Si el
  // diseño cambió (rStale) NO se guarda — habría que regenerarlo primero.
  const [guardandoRender, setGuardandoRender] = useState(false);
  const [renderMsg, setRenderMsg] = useState('');
  const guardarRenderCanonico = async () => {
    if (!render || rStale) return;
    setGuardandoRender(true); setRenderMsg('');
    try {
      const g = await guardarCocrearSeguro(expedienteId, cocrearPayload({ brief: texto, intent, historia, render }));
      const id = g?.ok ? (g.expediente_id || expedienteId) : expedienteId;
      if (id) setExpedienteId(id);
      let prodId = null, verId = null;
      if (id) { const reg = await registrarProductoDesdeExpediente(id); if (reg?.ok) { prodId = reg.producto_id; verId = reg.version_id; } }
      // El render canónico se liga a una ProductVersion REAL, que sólo existe con costo
      // conocido. Sin costo completo no se canoniza (una sola verdad): se explica, honesto.
      if (!verId) { setRenderMsg('El render se generó. Para guardarlo ligado al producto, primero completa el costo (desarrolla el despiece en “Detalle técnico”).'); setGuardandoRender(false); return; }
      const r = await subirRenderCanonico({ expedienteId: id, productoId: prodId, productoVersionId: verId, dataUrl: render.dataUrl, promptVersion: render.version, modo: 'render', specHash: spec.hash, inputs: render.expected || {} });
      setRenderMsg(r.ok ? `Render guardado en el proyecto (versión canónica v${verId}).` : 'No se pudo guardar el render: ' + (r.error || ''));
    } catch (e) { setRenderMsg('No se pudo guardar el render: ' + String(e?.message || e)); }
    setGuardandoRender(false);
  };

  // A/B
  const compararAB = () => setComparA(JSON.parse(JSON.stringify(intent)));
  const elegir = (cualIntent, cual) => { commit(cualIntent, `Elegí opción ${cual}`); setComparA(null); };

  const agregarACotizacion = async () => {
    if (!pipeline || !veCostos || pipeline.costo.official_cost == null || !onAgregar) return;
    // Una sola verdad de producto: antes de cotizar, el especial debe existir como
    // ProductRevision canónica. Guarda (secure) y registra/reutiliza el producto.
    let prodVersionId = null, prodId = null;
    try {
      const g = await guardarCocrearSeguro(expedienteId, cocrearPayload({ brief: texto, intent, historia, render }));
      const id = g?.ok ? (g.expediente_id || expedienteId) : expedienteId;
      if (id) { setExpedienteId(id); const reg = await registrarProductoDesdeExpediente(id); if (reg?.ok) { prodVersionId = reg.version_id || null; prodId = reg.producto_id || null; } }
    } catch { /* la cotización no se bloquea por la nube; el precio ya es honesto */ }
    const costeo = { nombre: descripcionCorta(spec), componentes: spec.componentes, w: spec.dimensiones?.ancho_mm || null, d: null, productoId: prodId, productVersionId: prodVersionId, precioReal: false, config: null };
    const margen = Number.isFinite(par.margenObjetivo) ? par.margenObjetivo : 40;
    onAgregar(costeo, 1, precioVenta(pipeline.costo.official_cost, par).precio, margen);
    setCotizadoHash(spec.hash);   // la cotización queda PINNED a esta revisión (hash)
    setVozMsg(`Agregado al proyecto: ${descripcionCorta(spec)} (Rev ${rev}${prodVersionId ? ' · v' + prodVersionId : ''})`);
  };
  // La cotización está pinned a una revisión anterior y el producto ya cambió.
  const cotizaDesactualizada = cotizadoHash && spec && cotizadoHash !== spec.hash;

  // ---------- INICIO ----------
  if (fase === 'inicio') {
    return (
      <div className="contenido cocrear-wrap">
        <header className="cocrear-head">
          <p className="cocrear-kicker">VON HAUCKE · COCREAR</p>
          <h1 className="cocrear-h1">¿Qué tienes en mente?</h1>
          <p className="cocrear-sub">Diséñalo con nosotros, en vivo. Describe tu idea y la vemos tomar forma — la cambias, la comparas y decides. Lo imaginamos contigo.</p>
        </header>
        <div className="tarjeta cocrear-entrada">
          <textarea className="cocrear-textarea" value={texto} onChange={(e) => setTexto(e.target.value)} rows={3}
            placeholder="Ej. Quiero una recepción curva, premium, en nogal, 2.40 m, para dos personas…" />
          <div className="cocrear-chips">
            {EJEMPLOS.map((e, i) => <button key={i} type="button" className="cocrear-chip-ej" onClick={() => { setTexto(e); }}>{e.split(',')[0]}</button>)}
          </div>
          <div className="cocrear-acciones">
            {/* CTA principal: VONI toma el control y convierte la idea en diseño.
                Cuando no hay texto NO es un botón muerto: explica qué falta. */}
            {texto.trim()
              ? <button type="button" className="boton cocrear-btn cocrear-cta-voni" onClick={disenarConVoni} disabled={analizando}>{analizando ? 'VONI está entendiendo…' : 'Diseñarlo con VONI →'}</button>
              : <span className="cocrear-cta-hint">✍️ Describe tu idea arriba para que VONI empiece a diseñar</span>}
            <button type="button" className="boton-fantasma cocrear-btn-sec" onClick={entrarStudioDirecto}>Entrar a Cocreación completa</button>
            {hayDraft && <button type="button" className="boton-fantasma cocrear-btn-sec" onClick={retomar}>Retomar lo último</button>}
          </div>
        </div>
        {analizando && (
          <div className="cocrear-analizando">
            <span className="cocrear-analizando-pulse" />
            VONI está entendiendo tu idea…
          </div>
        )}
        {misCocreaciones.length > 0 && (
          <div className="cocrear-guardadas">
            <h3 className="cc-panel-tit">Mis co-creaciones guardadas</h3>
            <div className="cocrear-guardadas-lista">
              {misCocreaciones.map((x) => (
                <button key={x.id} type="button" className="cocrear-guardada" onClick={() => reabrir(x.id)}>
                  <strong>{x.nombre || 'Sin nombre'}</strong>
                  <span>{x.producto_tipo || ''} · {new Date(x.actualizado || x.creado).toLocaleDateString('es-MX')}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- STUDIO ----------
  const r = pipeline;
  const feats = intent.caracteristicas || [];
  const rango = RANGO_ANCHO[intent.familia] || RANGO_ANCHO[FAMILIA.DESCONOCIDA];
  const anchoMM = intent.dimensiones?.ancho_mm || (DIMS_DEFAULT[intent.familia] || DIMS_DEFAULT[FAMILIA.DESCONOCIDA]).ancho_mm;
  const specA = comparA ? construirProductSpec(comparA, extraerDNA(comparA), clasificarProducto(comparA, {}), { rev: 'A' }) : null;

  return (
    <div className="contenido cocrear-studio">
      {/* Barra superior: producto + versión + acciones */}
      <div className="cc-top">
        <div className="cc-top-id">
          <button type="button" className="cocrear-chip-ej" onClick={() => setFase('inicio')}>‹ Nueva idea</button>
          <strong className="cc-top-nombre">{descripcionCorta(spec)}</strong>
          <Badge estado={`Rev ${rev}`}>Rev {rev}</Badge>
        </div>
        <div className="cc-top-acciones">
          <button type="button" className="boton-fantasma cocrear-btn-sec" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : (guardado ? '✓ Guardado' : 'Guardar')}</button>
          {!comparA ? <button type="button" className="boton-fantasma cocrear-btn-sec" onClick={compararAB}>Comparar A/B</button>
            : <button type="button" className="boton-fantasma cocrear-btn-sec" onClick={() => setComparA(null)}>Cancelar A/B</button>}
        </div>
      </div>

      <div className="cc-grid">
        {/* ---- DECISIONES ---- */}
        <aside className="cc-panel cc-decisiones">
          <h3 className="cc-panel-tit">Decisiones</h3>

          <div className="cc-ctrl">
            <label className="cc-ctrl-lbl">Ancho <span className="cc-ctrl-val">{(anchoMM / 1000).toFixed(2)} m</span></label>
            <input type="range" className="cc-slider" min={rango[0]} max={rango[1]} step={50} value={anchoMM}
              onChange={(e) => { draggingRef.current = true; setAncho(e.target.value, false); }}
              onPointerUp={(e) => { draggingRef.current = false; setAncho(e.target.value, true); }}
              onKeyUp={(e) => setAncho(e.target.value, true)} />
          </div>

          <div className="cc-ctrl">
            <label className="cc-ctrl-lbl">Material</label>
            <div className="cc-swatches">
              {MATERIALES_EDIT.map((m) => {
                const activo = (intent.materiales?.[0]?.material) === m;
                return <button key={m} type="button" title={MATERIAL_LABEL[m]} className={'cc-swatch' + (activo ? ' on' : '')}
                  style={{ background: swatchColor(m) }} onClick={() => setMaterial(m)}><span className="cc-swatch-lbl">{MATERIAL_LABEL[m]}</span></button>;
              })}
            </div>
          </div>

          <div className="cc-ctrl">
            <label className="cc-ctrl-lbl">Tono</label>
            <div className="cc-seg">
              {[['claro', 'Claro'], [null, 'Natural'], ['oscuro', 'Oscuro']].map(([v, l]) => (
                <button key={l} type="button" className={'cc-seg-b' + ((intent.materiales?.[0]?.tono || null) === v ? ' on' : '')} onClick={() => setTono(v)}>{l}</button>
              ))}
            </div>
          </div>

          {[FAMILIA.RECEPCION, FAMILIA.MESA, FAMILIA.ESCRITORIO].includes(intent.familia) && (
            <div className="cc-ctrl">
              <label className="cc-ctrl-lbl">Forma</label>
              <div className="cc-seg">
                <button type="button" className={'cc-seg-b' + (!feats.includes('curva') ? ' on' : '')} onClick={() => feats.includes('curva') && toggleFeature('curva')}>Recta</button>
                <button type="button" className={'cc-seg-b' + (feats.includes('curva') ? ' on' : '')} onClick={() => !feats.includes('curva') && toggleFeature('curva')}>Curva</button>
              </div>
            </div>
          )}

          <div className="cc-ctrl">
            <label className="cc-ctrl-lbl">Características</label>
            <div className="cc-feats">
              {(FEATURES_POR_FAMILIA[intent.familia] || []).map((f) => (
                <button key={f} type="button" className={'cc-feat' + (feats.includes(f) ? ' on' : '')} onClick={() => toggleFeature(f)}>
                  {feats.includes(f) ? '✓ ' : '+ '}{FEATURE_LABEL[f] || f}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ---- CANVAS (protagonista) ---- */}
        <main className="cc-canvas">
          {comparA ? (
            <div className="cc-ab">
              <div className="cc-ab-col">
                <div className="cc-ab-tag">A · como estaba</div>
                <CocrearVisual spec={specA} />
                <button type="button" className="boton-fantasma cocrear-btn-sec" onClick={() => elegir(comparA, 'A')}>Elegir A</button>
              </div>
              <div className="cc-ab-col">
                <div className="cc-ab-tag">B · con tus cambios</div>
                <CocrearVisual spec={spec} />
                <button type="button" className="boton cocrear-btn" onClick={() => elegir(intent, 'B')}>Elegir B</button>
              </div>
            </div>
          ) : (
            <div className="cc-canvas-inner">
              <CocrearVisual spec={spec} />
            </div>
          )}
          {/* RENDER REAL — el momento WOW (del ProductSpec exacto) */}
          {!comparA && (
            <div className="cc-render">
              <div className="cc-render-top">
                <strong>Render realista</strong>
                <button type="button" className="boton cocrear-btn" onClick={generar} disabled={renderCargando}>
                  {renderCargando ? 'Generando…' : (render ? 'Regenerar' : 'Ver cómo quedaría')}
                </button>
              </div>
              {renderError && <p className="cocrear-nota-rojo">{renderError}</p>}
              {render && (
                <div className="cc-render-out">
                  {rStale && <div className="cc-render-stale">El diseño cambió desde este render — está desactualizado. Regenéralo para verlo al día.</div>}
                  <img className={'cc-render-img' + (rStale ? ' stale' : '')} src={render.dataUrl} alt={`Render de ${descripcionCorta(spec)}`} />
                  <div className="cc-render-manifiesto">
                    <span className="cc-render-badge">Pendiente de verificación visual de fidelidad</span>
                    <p className="cocrear-ayuda">Lo que bloqueamos para este render: {render.expected.features.length ? render.expected.features.join(', ') + '. ' : ''}{render.expected.finish.join('; ')}.</p>
                    {!rStale && (
                      <button type="button" className="boton-fantasma cocrear-btn-sec" onClick={guardarRenderCanonico} disabled={guardandoRender}>
                        {guardandoRender ? 'Guardando render…' : 'Guardar render en el proyecto'}
                      </button>
                    )}
                    {renderMsg && <p className="cocrear-ayuda">{renderMsg}</p>}
                  </div>
                </div>
              )}
              {!render && !renderCargando && <p className="cocrear-ayuda">El render sale del producto EXACTO que estás diseñando (medidas, material, forma, features). No es una imagen inventada.</p>}
            </div>
          )}
          {/* Historia visual */}
          <div className="cc-historia">
            {historia.map((h) => (
              <button key={h.rev} type="button" className={'cc-hist' + (h.rev === rev ? ' on' : '')} onClick={() => verRevision(h)} title={h.label}>
                <span className="cc-hist-rev">R{h.rev}</span><span className="cc-hist-lbl">{h.label}</span>
              </button>
            ))}
          </div>
        </main>

        {/* ---- VONI ---- */}
        <aside className="cc-panel cc-voni">
          <h3 className="cc-panel-tit">Voni</h3>
          <div className="cc-nl">
            <input className="cc-nl-input" value={nl} onChange={(e) => setNl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviarNL()}
              placeholder='Dile a Voni: "hazla 30 cm más corta, más cálida y dime qué mejorarías"…' disabled={voniPensando} />
            <button type="button" className="boton cocrear-btn" onClick={enviarNL} disabled={!nl.trim() || voniPensando}>{voniPensando ? 'Pensando…' : 'Pedir a Voni'}</button>
          </div>
          {vozMsg && <p className="cc-voni-msg">{vozMsg}</p>}
          {cotizaDesactualizada && <p className="cocrear-nota-rojo">Nueva revisión disponible: la cotización usa una versión anterior. Agrégala de nuevo para actualizarla.</p>}
          {propuestas && (
            <div className="cc-propuestas">
              {propuestas.map((p) => (
                <button key={p.id} type="button" className="cc-propuesta" onClick={() => elegirPropuesta(p)}>
                  <strong>{p.label}</strong><span>{p.detalle}</span>
                </button>
              ))}
            </div>
          )}
          <div className="cc-sugs">
            {sugerencias.map((s, i) => (
              <div key={i} className={'cc-sug cc-sug-' + tono(s.tipo === 'ok' ? 'ok' : s.tipo === 'validacion' || s.tipo === 'riesgo' ? 'REQUIRES' : 'PARTIAL')}>
                <div className="cc-sug-top"><strong>{s.que}</strong>{s.confianza && <span className="cc-sug-conf">{s.confianza}</span>}</div>
                <p className="cc-sug-why">{s.porque}</p>
                {s.accion && <button type="button" className="cocrear-chip-ej" onClick={() => aplicarSugerencia(s)}>{s.accion.label}</button>}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ---- BARRA INFERIOR: estado + precio-safe + técnico ---- */}
      <div className="cc-bottom">
        <div className="cc-ready">
          <ReadyChip ok={!!intent.familia && intent.familia !== 'DESCONOCIDA'} label="Diseño" />
          <ReadyChip ok={!!intent.dimensiones} label="Geometría" />
          <ReadyChip ok={(intent.materiales || []).length > 0} label="Material" />
          <ReadyChip estado={r.ingenieria.estado} label="Ingeniería" />
          <ReadyChip estado={r.costo.cost_status} label="Costo" />
        </div>
        <div className="cc-precio">
          {veCostos ? (
            r.costo.official_cost != null
              ? <><span>Costo: <strong>{pesos(r.costo.official_cost)}</strong></span>
                  {onAgregar && <button type="button" className="boton cocrear-btn" onClick={agregarACotizacion}>Agregar al proyecto</button>}</>
              : <span className="cocrear-nota-rojo">Precio por definir — falta desarrollar el despiece (Detalle técnico).</span>
          ) : <span>El precio lo confirma Diseño/Dirección al desarrollar el producto.</span>}
        </div>
      </div>

      {veCostos && (
        <div className="cc-tecnico">
          <button type="button" className="cc-tecnico-toggle" onClick={() => setTecnico((v) => !v)}>{tecnico ? '▾' : '▸'} Detalle técnico (Diseño / Dirección)</button>
          {tecnico && (
            <div className="tarjeta cc-tecnico-body">
              <p><strong>Clasificación:</strong> {r.clasificacion.clasificacion} — {r.clasificacion.motivos.join(' ')}</p>
              <p><strong>Ficha:</strong> <span className="cocrear-mono">{spec.id}@{spec.rev} #{spec.hash}</span></p>
              <p><strong>Manufacturabilidad:</strong> {r.manufacturabilidad.estado}{r.manufacturabilidad.requisitos.length ? ` — validar: ${r.manufacturabilidad.requisitos.join(', ')}` : ''}</p>
              <p><strong>Costo:</strong> {r.costo.cost_status}{r.costo.unresolved_lines.length ? ` — pendiente: ${r.costo.unresolved_lines.join(', ')}` : ''}</p>
              <TecnicoBOM intent={intent} insumos={insumos} onSet={(componentes) => {
                // el BOM desarrollado se guarda como una revisión del mismo producto.
                commit({ ...intent, _componentes: componentes }, `Despiece: ${componentes.length} partida(s)`);
              }} componentesIniciales={intent._componentes || []} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReadyChip({ ok, estado, label }) {
  const t = estado ? tono(estado) : (ok ? 'verde' : 'gris');
  return <span className="cc-ready-chip" style={{ color: COLOR[t], background: FONDO[t] }}>{label}</span>;
}

// Color de muestra para el swatch (sin tono, para reconocer el material).
function swatchColor(m) {
  return { nogal: '#6B4423', roble: '#B88A5A', encino: '#C9A06A', maple: '#D8B98A', laminado: '#CBB79B', solid_surface: '#ECEAE6', cristal: '#AFC8D6', metal: '#9AA0A6', piedra: '#C9C3B8' }[m] || '#B89A7A';
}

// Constructor de BOM — SÓLO en el backstage técnico (no es la experiencia primaria).
function TecnicoBOM({ insumos, onSet, componentesIniciales }) {
  const [busca, setBusca] = useState('');
  const [comps, setComps] = useState(componentesIniciales);
  const matches = useMemo(() => {
    const q = busca.trim().toLowerCase(); if (!q) return [];
    return Object.values(insumos).filter((i) => i && i.id && String(i.nombre || '').toLowerCase().includes(q)).slice(0, 6);
  }, [busca, insumos]);
  const add = (ins) => { const n = [...comps, { nombre: ins.nombre, insumoId: ins.id, cantidad: 1, piezas: 1 }]; setComps(n); setBusca(''); onSet(n); };
  const qty = (i, v) => { const n = comps.map((c, k) => (k === i ? { ...c, cantidad: Math.max(0, Number(v) || 0) } : c)); setComps(n); onSet(n); };
  const del = (i) => { const n = comps.filter((_, k) => k !== i); setComps(n); onSet(n); };
  return (
    <div className="cc-bom">
      <p className="cocrear-ayuda">Desarrolla el despiece con el catálogo real (mismo motor que Costear). El costo de arriba se recalcula.</p>
      <input className="cocrear-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar material (tablero, herraje, LED)…" />
      {matches.length > 0 && <div className="cocrear-bom-matches">{matches.map((i) => <button key={i.id} type="button" className="cocrear-bom-match" onClick={() => add(i)}><span>{i.nombre}</span><span className="cocrear-bom-unidad">{i.unidad || ''}</span></button>)}</div>}
      {comps.length > 0 && <ul className="cocrear-bom-lista">{comps.map((c, i) => (
        <li key={i} className="cocrear-bom-item"><span className="cocrear-bom-nombre">{c.nombre}</span>
          <input className="cocrear-input cocrear-bom-qty" type="number" min="0" step="0.01" value={c.cantidad} onChange={(e) => qty(i, e.target.value)} />
          <span className="cocrear-bom-unidad">{insumos[c.insumoId]?.unidad || ''}</span>
          <button type="button" className="cocrear-bom-x" onClick={() => del(i)}>×</button></li>
      ))}</ul>}
    </div>
  );
}
