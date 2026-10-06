// ============================================================================
//  N10 PROJECT WORKSPACE + paneles N12/N13/N14/N16/N17/N18 (IMPLEMENTED_PENDING_VISUAL_SMOKE).
//  Workspace de proyecto (no CRUD): header, KPIs, y secciones. Reutiliza C2/C4 y los
//  motores puros (aprobaciones/cierre/valueEngineering/diffRevisiones). Vendedor NO ve
//  costo/margen; Dirección sí. Estados loading/empty/error.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { pesos } from '../../util.js';
import {
  obtenerProyecto, actualizarProyecto, listarCotizacionesDeProyecto, listarActividades, agregarActividad,
  listarEscenarios, crearEscenario, seleccionarEscenario, listarAprobaciones,
  resolverAprobacion, listarRevisionesCotizacion, acomodosDeProyecto,
} from '../../datos/crm.js';
import { accionesValidas, transicion } from '../../datos/aprobaciones.js';
import { validarCierre, MOTIVOS_PERDIDA } from '../../datos/cierre.js';
import { planValueEngineering } from '../../datos/valueEngineering.js';
import { diffRevisiones } from '../../datos/diffRevisiones.js';
import { flagActivo } from '../../datos/flags.js';
import PresentarCliente from './PresentarCliente.jsx';

const dinero = (n) => (n == null || isNaN(n) || !isFinite(n) ? '—' : pesos(n));
const f = (iso) => (iso ? String(iso).slice(0, 10) : '—');

export default function ProyectoWorkspace({ proyectoId, soloVentas = false, veCostos = false, onVolver, onIr, usuario = null }) {
  const [estado, setEstado] = useState('cargando');
  const [proyecto, setProyecto] = useState(null);
  const [cots, setCots] = useState([]);
  const [seccion, setSeccion] = useState('resumen');
  const [presentar, setPresentar] = useState(false);

  async function cargar() {
    setEstado('cargando');
    const { data: p, error } = await obtenerProyecto(proyectoId);
    if (error || !p) { setEstado(error ? 'error' : 'novacio'); setProyecto(p || null); return; }
    const { data: cs } = await listarCotizacionesDeProyecto(proyectoId);
    setProyecto(p); setCots(cs); setEstado('ok');
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  const totalActual = useMemo(() => cots.reduce((s, c) => s + (Number(c.total) || 0), 0), [cots]);
  const deltaBudget = proyecto?.presupuesto != null ? totalActual - Number(proyecto.presupuesto) : null;

  if (estado === 'cargando') return <div className="tarjeta"><span className="ayuda">Cargando proyecto…</span></div>;
  if (estado === 'error') return <div className="alerta roja"><span className="texto">No se pudo cargar el proyecto.</span> <button className="boton" onClick={cargar}>Reintentar</button></div>;
  if (!proyecto) return <div className="tarjeta"><strong>Proyecto no encontrado</strong><button className="boton" style={{ marginTop: 8 }} onClick={onVolver}>‹ Volver</button></div>;

  if (presentar) return <PresentarCliente proyecto={proyecto} cots={cots} onCerrar={() => setPresentar(false)} />;

  const Secc = ({ id, children }) => <button className={`chip ${seccion === id ? 'on' : ''}`} onClick={() => setSeccion(id)}>{children}</button>;

  return (
    <div>
      <button className="boton fantasma" onClick={onVolver}>‹ Proyectos</button>
      <div className="tarjeta" style={{ marginTop: 10 }}>
        <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0 }}>{proyecto.nombre || `Proyecto ${proyecto.id}`}</h2>
            <div className="ayuda">{proyecto.clientes?.nombre_comercial || 'Cliente —'} · Vendedor {proyecto.vendedor_responsable || '—'} · Etapa <strong>{proyecto.etapa || '—'}</strong></div>
          </div>
          {flagActivo('client_presentation_v2') && <button className="boton primario" onClick={() => setPresentar(true)}>Presentar al cliente ▸</button>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <KPI t="Total actual" v={dinero(totalActual)} />
          <KPI t="Presupuesto" v={dinero(proyecto.presupuesto)} />
          <KPI t="Diferencia" v={deltaBudget == null ? '—' : dinero(deltaBudget)} alerta={deltaBudget != null && deltaBudget > 0} />
          <KPI t="Próxima acción" v={proyecto.proxima_accion || '—'} sub={f(proyecto.fecha_proxima_accion)} />
        </div>
      </div>

      <div className="chips" style={{ margin: '12px 0' }}>
        <Secc id="resumen">Resumen</Secc>
        {(flagActivo('scope_v2') || flagActivo('layout_v2') || flagActivo('render_v2')) && <Secc id="solucion">Solución</Secc>}
        <Secc id="cotizacion">Cotización</Secc>
        <Secc id="escenarios">Escenarios</Secc>
        {veCostos && <Secc id="dealdesk">Deal Desk</Secc>}
        <Secc id="ve">Presupuesto/VE</Secc>
        <Secc id="diff">Revisiones</Secc>
        <Secc id="actividad">Actividad</Secc>
        <Secc id="cierre">Cierre</Secc>
      </div>

      {seccion === 'resumen' && <Resumen proyecto={proyecto} cots={cots} totalActual={totalActual} />}
      {seccion === 'solucion' && <Solucion proyecto={proyecto} cots={cots} onIr={onIr} />}
      {seccion === 'cotizacion' && <SeccionCotizaciones cots={cots} onIr={onIr} />}
      {seccion === 'escenarios' && <Escenarios proyectoId={proyectoId} />}
      {seccion === 'dealdesk' && veCostos && <DealDesk cots={cots} usuario={usuario} />}
      {seccion === 've' && <ValueEngineeringPanel presupuesto={proyecto.presupuesto} total={totalActual} cots={cots} />}
      {seccion === 'diff' && <DiffPanel cots={cots} />}
      {seccion === 'actividad' && <Actividad proyecto={proyecto} onCambio={cargar} />}
      {seccion === 'cierre' && <Cierre proyecto={proyecto} cots={cots} onCambio={cargar} />}
    </div>
  );
}

function KPI({ t, v, sub, alerta }) {
  return (
    <div className="tarjeta" style={{ flex: 1, minWidth: 130, margin: 0 }}>
      <div className="ayuda" style={{ fontSize: 11 }}>{t}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: alerta ? '#c0392b' : 'inherit' }}>{v}</div>
      {sub && <div className="ayuda" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

function Resumen({ proyecto, cots, totalActual }) {
  return (
    <div className="tarjeta">
      <strong>Resumen</strong>
      <p className="ayuda" style={{ marginTop: 4 }}>{proyecto.brief || 'Sin brief capturado.'}</p>
      <div className="ayuda">Cotizaciones: {cots.length} · Total actual {dinero(totalActual)} · Objetivo {f(proyecto.fecha_objetivo)}</div>
    </div>
  );
}

// ---- SOLUCIÓN: alcance (N5) + layout (N6/N7) + renders (N8) ---------------
function Reconciliacion({ cots = [] }) {
  // H3: NO existe fuente de reconciliación por zonas (no hay columnas
  // scope_zonas/reconciliacion_zonas). En lugar de un cuadro vacío que parezca
  // bug, se dice exactamente qué falta y a qué cotización ir. No se fabrican datos.
  const folio = cots.find((c) => c.folio_oficial || c.folio);
  return (
    <div className="tarjeta">
      <strong>Alcance por zona</strong>
      <p className="ayuda" style={{ marginTop: 4 }}>
        Sin reconciliación por zonas capturada.
        {folio
          ? <> La solución vive en la cotización <strong>{folio.folio_oficial || folio.folio}</strong> — completa el acomodo para comparar requerido / cotizado / acomodado.</>
          : ' Liga una cotización a este proyecto para capturar requerido / cotizado / acomodado.'}
      </p>
    </div>
  );
}

function LayoutPanel({ proyectoId, onIr }) {
  // H3: el acomodo/layout vive en cotizaciones.acomodo (fuente real), no en proyectos.
  const [estado, setEstado] = useState('cargando');
  const [acos, setAcos] = useState([]);
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await acomodosDeProyecto(proyectoId);
      if (!vivo) return;
      if (error) { setEstado('error'); return; }
      setAcos((data || []).filter((c) => c.acomodo));
      setEstado('ok');
    })();
    return () => { vivo = false; };
  }, [proyectoId]);
  return (
    <div className="tarjeta">
      <strong>Distribución / layout</strong>
      {estado === 'cargando' && <p className="ayuda" style={{ marginTop: 4 }}>Revisando acomodos…</p>}
      {estado === 'error' && <p className="ayuda" style={{ marginTop: 4 }}>No se pudo leer el acomodo ahora.</p>}
      {estado === 'ok' && acos.length === 0 && <p className="ayuda" style={{ marginTop: 4 }}>Sin acomodo capturado en las cotizaciones de este proyecto. Ábrelo para acomodar el mobiliario en el plano.</p>}
      {estado === 'ok' && acos.length > 0 && <p className="ayuda" style={{ marginTop: 4 }}>Acomodo disponible en {acos.map((c) => c.folio || `Cot ${c.id}`).join(', ')}.</p>}
      {onIr && <button className="boton" style={{ marginTop: 8 }} onClick={() => onIr('acomodo')}>Abrir acomodo ›</button>}
    </div>
  );
}

function RendersPanel() {
  // H3: los renders técnicos NO viven por proyecto. Están en el expediente del
  // producto (render_aislado_url / render_ambiente_url) y en productos.render_principal_url.
  return (
    <div className="tarjeta">
      <strong>Renders</strong>
      <p className="ayuda" style={{ marginTop: 4 }}>Los renders técnicos se generan y versionan en el expediente de cada producto. El render del ambiente aparecerá aquí cuando el proyecto tenga uno ligado.</p>
    </div>
  );
}

function Solucion({ proyecto, cots = [], onIr }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {flagActivo('scope_v2') && <Reconciliacion cots={cots} />}
      {flagActivo('layout_v2') && <LayoutPanel proyectoId={proyecto.id} onIr={onIr} />}
      {flagActivo('render_v2') && <RendersPanel />}
    </div>
  );
}

function SeccionCotizaciones({ cots, onIr }) {
  if (!cots.length) return <div className="tarjeta"><strong>Sin cotizaciones</strong><p className="ayuda">Arma una cotización desde Voni y vincúlala a este proyecto.</p></div>;
  return (
    <div>
      {cots.map((c) => (
        <div className="tarjeta" key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}><strong>{c.folio_oficial || c.folio || `Cot ${c.id}`}</strong>
            <div className="ayuda">{c.estado || 'borrador'} · {dinero(c.total)} · {f(c.actualizado)}</div></div>
          {onIr && <button className="boton" onClick={() => onIr('cotizacion')}>Abrir ›</button>}
        </div>
      ))}
    </div>
  );
}

function Escenarios({ proyectoId }) {
  const [estado, setEstado] = useState('cargando');
  const [esc, setEsc] = useState([]);
  const [errAccion, setErrAccion] = useState('');
  async function cargar() { setEstado('cargando'); const { data, error } = await listarEscenarios(proyectoId); if (error) { setEstado('error'); return; } setEsc(data); setEstado('ok'); }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);
  // Se revisa el {error}: antes crear/seleccionar escenario fallaba en silencio
  // (RLS, red) y el botón parecía no hacer nada.
  async function nuevo(tipo) { setErrAccion(''); const { error } = (await crearEscenario({ proyecto_id: proyectoId, nombre: tipo === 'custom' ? 'Nuevo escenario' : tipo, tipo })) || {}; if (error) { setErrAccion(`No se pudo crear el escenario: ${error.message || 'error del servidor'}.`); return; } cargar(); }
  async function elegir(id) { setErrAccion(''); const { error } = (await seleccionarEscenario(proyectoId, id)) || {}; if (error) { setErrAccion(`No se pudo seleccionar: ${error.message || 'error del servidor'}.`); return; } cargar(); }
  if (estado === 'cargando') return <div className="tarjeta"><span className="ayuda">Cargando escenarios…</span></div>;
  if (estado === 'error') return <div className="alerta roja"><span className="texto">No se pudieron cargar.</span> <button className="boton" onClick={cargar}>Reintentar</button></div>;
  return (
    <div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {['esencial', 'recomendada', 'premium', 'custom'].map((t) => <button key={t} className="chip" onClick={() => nuevo(t)}>+ {t}</button>)}
      </div>
      {errAccion && <div className="alerta roja" style={{ marginBottom: 10 }}><span className="texto">{errAccion}</span></div>}
      {esc.length === 0 ? <div className="tarjeta"><strong>Sin escenarios</strong><p className="ayuda">Crea Esencial / Recomendada / Premium dentro del mismo proyecto (no se clona).</p></div>
        : esc.map((e) => (
          <div className="tarjeta" key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}><strong>{e.nombre}</strong> <span className="ayuda">· {e.tipo} · {dinero(e.total)}</span></div>
            {e.seleccionado ? <span className="etiqueta-verde">SELECCIONADO</span> : <button className="boton" onClick={() => elegir(e.id)}>Seleccionar</button>}
          </div>
        ))}
    </div>
  );
}

function DealDesk({ cots, usuario = null }) {
  const [cotId, setCotId] = useState(cots[0]?.id ?? null);
  const [aprs, setAprs] = useState([]);
  const [estado, setEstado] = useState('cargando');
  const [errAccion, setErrAccion] = useState('');
  async function cargar() { if (cotId == null) { setEstado('novacio'); return; } setEstado('cargando'); const { data, error } = await listarAprobaciones(cotId); if (error) { setEstado('error'); return; } setAprs(data); setEstado('ok'); }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [cotId]);
  // resuelto_por = QUIÉN resolvió (su correo), no el literal 'direccion' que borraba
  // el rastro de quién aprobó/rechazó. Y se revisa el error: antes un fallo de RLS/red
  // dejaba el botón "sin efecto" en silencio.
  async function resolver(a, accion) {
    setErrAccion('');
    const destino = transicion(a.estado, accion);
    const { error } = (await resolverAprobacion(a.id, destino, usuario || 'direccion')) || {};
    if (error) { setErrAccion(`No se pudo ${accion.toLowerCase()}: ${error.message || 'error del servidor'}.`); return; }
    cargar();
  }
  if (!cots.length) return <div className="tarjeta"><strong>Sin cotizaciones</strong><p className="ayuda">El Deal Desk opera sobre una cotización.</p></div>;
  return (
    <div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {cots.map((c) => <button key={c.id} className={`chip ${cotId === c.id ? 'on' : ''}`} onClick={() => setCotId(c.id)}>{c.folio || `Cot ${c.id}`}</button>)}
      </div>
      {estado === 'cargando' && <div className="tarjeta"><span className="ayuda">Cargando aprobaciones…</span></div>}
      {estado === 'error' && <div className="alerta roja"><span className="texto">Error.</span> <button className="boton" onClick={cargar}>Reintentar</button></div>}
      {estado === 'ok' && aprs.length === 0 && <div className="tarjeta"><strong>Sin solicitudes de aprobación</strong><p className="ayuda">Cuando una cotización requiera aprobación (descuento sobre política, precio bajo piso), aparecerá aquí.</p></div>}
      {estado === 'ok' && aprs.map((a) => (
        <div className="tarjeta" key={a.id}>
          <div className="fila" style={{ justifyContent: 'space-between' }}>
            <strong>Aprobación #{a.id} · {a.estado}</strong>
            <span className="ayuda">{f(a.creado)}</span>
          </div>
          <div className="ayuda">Descuento solicitado: {a.descuento_solicitado != null ? a.descuento_solicitado + '%' : '—'} · {a.motivo || 'sin motivo'}</div>
          <div className="chips" style={{ marginTop: 6 }}>
            {accionesValidas(a.estado).map((acc) => <button key={acc} className="boton" onClick={() => resolver(a, acc)}>{acc}</button>)}
          </div>
        </div>
      ))}
      {errAccion && <div className="alerta roja" style={{ marginTop: 8 }}><span className="texto">{errAccion}</span></div>}
      <p className="ayuda gris" style={{ fontSize: 11 }}>Resolver aprobaciones es exclusivo de Dirección (RLS). La aprobación se liga al hash de la revisión.</p>
    </div>
  );
}

function ValueEngineeringPanel({ presupuesto, total, cots = [] }) {
  const plan = planValueEngineering(presupuesto, total, []);
  // Las cotizaciones que más pesan son el lugar donde la ingeniería de valor rinde
  // más. No inventamos ahorros en pesos (cada delta lo recalcula el servidor al
  // editar la cotización); ordenamos por total y mostramos su peso real sobre la
  // propuesta, para que Dirección sepa por dónde empezar a recortar.
  const ranking = [...cots]
    .filter((c) => Number(c.total) > 0)
    .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))
    .slice(0, 5);
  const sinPresupuesto = presupuesto == null;
  return (
    <div className="tarjeta">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <KPI t="Presupuesto" v={dinero(presupuesto)} />
        <KPI t="Propuesta" v={dinero(total)} />
        <KPI t="Diferencia" v={plan.faltaBajar == null ? '—' : plan.faltaBajar <= 0 ? '—' : dinero(plan.faltaBajar)} alerta={plan.faltaBajar != null && plan.faltaBajar > 0} />
      </div>
      {plan.estado === 'NO_EVALUABLE'
        ? <p className="ayuda" style={{ marginTop: 10 }}>{plan.motivo === 'PRESUPUESTO_DESCONOCIDO'
            ? 'Este proyecto aún no tiene presupuesto objetivo. Captúralo en los datos del proyecto para comparar la propuesta contra él.'
            : 'Todavía no existe un total autoritativo de propuesta; no calculo una diferencia ficticia hasta tenerlo.'}</p>
        : plan.yaEnPresupuesto
          ? <p className="ayuda" style={{ marginTop: 10 }}>La propuesta ya está dentro del presupuesto ✓</p>
          : <>
            <p className="ayuda" style={{ marginTop: 10 }}>
              Faltan <strong>{dinero(plan.faltaBajar)}</strong> para entrar en presupuesto. Orden de palancas:
              {' '}sustitución &gt; configuración &gt; acabado &gt; opcional &gt; descuento (el descuento va al final, y sobre el máx. rentable lo aprueba Dirección).
            </p>
            {ranking.length > 0 && <>
              <div className="ayuda gris" style={{ fontSize: 11, marginTop: 8, marginBottom: 4 }}>Dónde rinde más (cotizaciones por peso):</div>
              {ranking.map((c) => {
                const peso = total > 0 ? Math.round((Number(c.total) || 0) / total * 100) : 0;
                return (
                  <div key={c.id} className="fila" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderTop: '1px solid var(--linea, #333)' }}>
                    <span className="texto" style={{ fontSize: 13 }}>{c.nombre || c.folio || `Cotización ${c.id}`}</span>
                    <span className="ayuda" style={{ fontSize: 12 }}>{dinero(c.total)} · {peso}%</span>
                  </div>
                );
              })}
            </>}
            <p className="ayuda gris" style={{ fontSize: 11, marginTop: 8 }}>Abre una cotización para sustituir material o configuración: el servidor (cotizar-servidor) recalcula el delta real de cada cambio — la app no inventa el ahorro.</p>
          </>}
    </div>
  );
}

function DiffPanel({ cots }) {
  const [cotId, setCotId] = useState(cots[0]?.id ?? null);
  const [revs, setRevs] = useState([]);
  const [estado, setEstado] = useState('cargando');
  const [a, setA] = useState(null); const [b, setB] = useState(null);
  async function cargar() { if (cotId == null) { setEstado('novacio'); return; } setEstado('cargando'); const { data, error } = await listarRevisionesCotizacion(cotId); if (error) { setEstado('error'); return; } setRevs(data); setA(data[data.length - 2]?.revision ?? null); setB(data[data.length - 1]?.revision ?? null); setEstado('ok'); }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [cotId]);
  const diff = useMemo(() => {
    const ra = revs.find((r) => r.revision === a); const rb = revs.find((r) => r.revision === b);
    return (ra && rb) ? diffRevisiones(ra.snapshot, rb.snapshot) : null;
  }, [revs, a, b]);
  if (!cots.length) return <div className="tarjeta"><strong>Sin cotizaciones</strong></div>;
  return (
    <div>
      <div className="chips" style={{ marginBottom: 8 }}>
        {cots.map((c) => <button key={c.id} className={`chip ${cotId === c.id ? 'on' : ''}`} onClick={() => setCotId(c.id)}>{c.folio || `Cot ${c.id}`}</button>)}
      </div>
      {estado === 'ok' && revs.length < 2 && <div className="tarjeta"><strong>Faltan revisiones</strong><p className="ayuda">El diff compara dos revisiones emitidas (Rev1 vs Rev2). Esta cotización tiene {revs.length}.</p></div>}
      {diff && (
        <div className="tarjeta">
          <strong>Rev {a} → Rev {b}</strong>
          {diff.lineas.length === 0 ? <p className="ayuda">Sin cambios de partidas.</p> : diff.lineas.map((l, i) => (
            <div className="fila" key={i} style={{ justifyContent: 'space-between', fontSize: 13 }}>
              <span>{l.tipo === 'agregada' ? '+ ' : l.tipo === 'quitada' ? '− ' : '~ '}{l.nombre} {l.deltaCantidad ? `(${l.deltaCantidad > 0 ? '+' : ''}${l.deltaCantidad})` : ''}</span>
              <span className="mono" style={{ color: l.deltaImporte < 0 ? '#1a7f37' : '#c0392b' }}>{l.deltaImporte > 0 ? '+' : ''}{dinero(l.deltaImporte)}</span>
            </div>
          ))}
          <div className="fila" style={{ justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid rgba(0,0,0,.1)', marginTop: 6, paddingTop: 6 }}>
            <span>Δ Total</span><span className="mono">{diff.deltas.total > 0 ? '+' : ''}{dinero(diff.deltas.total)}</span>
          </div>
          <p className="ayuda gris" style={{ fontSize: 11 }}>Rev1 es inmutable. Este diff no la modifica.</p>
        </div>
      )}
    </div>
  );
}

function Actividad({ proyecto, onCambio }) {
  const [acts, setActs] = useState([]);
  const [estado, setEstado] = useState('cargando');
  const [txt, setTxt] = useState('');
  const [accion, setAccion] = useState(proyecto.proxima_accion || '');
  const [fecha, setFecha] = useState(proyecto.fecha_proxima_accion || '');
  async function cargar() { setEstado('cargando'); const { data, error } = await listarActividades(proyecto.id); if (error) { setEstado('error'); return; } setActs(data); setEstado('ok'); }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyecto.id]);
  async function registrar() { if (!txt.trim()) return; await agregarActividad({ proyecto_id: proyecto.id, tipo: 'NOTA', descripcion: txt.trim(), fecha: new Date().toISOString() }); setTxt(''); cargar(); }
  async function guardarAccion() { await actualizarProyecto(proyecto.id, { proxima_accion: accion || null, fecha_proxima_accion: fecha || null }); onCambio?.(); }
  return (
    <div>
      <div className="tarjeta">
        <strong>Próxima acción</strong>
        <input className="campo" value={accion} onChange={(e) => setAccion(e.target.value)} placeholder="p.ej. Enviar propuesta" style={{ marginTop: 6 }} />
        <input className="campo" type="date" value={fecha || ''} onChange={(e) => setFecha(e.target.value)} style={{ marginTop: 6 }} />
        <button className="boton primario" style={{ marginTop: 8 }} onClick={guardarAccion}>Guardar próxima acción</button>
        {!accion && <div className="alerta ambar" style={{ marginTop: 8 }}><span className="texto">Proyecto activo sin próxima acción: defínela para no perder el seguimiento.</span></div>}
      </div>
      <div className="tarjeta">
        <strong>Registrar actividad</strong>
        <textarea className="campo" rows={2} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Llamada, correo, visita…" style={{ marginTop: 6 }} />
        <button className="boton" style={{ marginTop: 6 }} onClick={registrar} disabled={!txt.trim()}>Agregar al timeline</button>
      </div>
      {estado === 'cargando' && <div className="tarjeta"><span className="ayuda">Cargando actividad…</span></div>}
      {estado === 'ok' && acts.length === 0 && <div className="tarjeta"><span className="ayuda">Sin actividad todavía.</span></div>}
      {estado === 'ok' && acts.map((a) => (
        <div className="tarjeta" key={a.id} style={{ borderLeft: '3px solid #ccc' }}>
          <div className="ayuda" style={{ fontSize: 11 }}>{f(a.fecha)} · {a.tipo} · {a.creado_por || '—'}</div>
          <div>{a.descripcion}</div>
        </div>
      ))}
    </div>
  );
}

function Cierre({ proyecto, cots, onCambio }) {
  const [resultado, setResultado] = useState('');
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  // Cuál cotización GANÓ. Se elige explícitamente: antes se sumaban TODAS las
  // cotizaciones del proyecto como "total final" (infla el cierre con escenarios
  // que no se vendieron) y se inventaba revision_ganadora_id=1 (un id que puede no
  // existir). El ganador es UNA cotización real; su total es el total final.
  const [ganadoraId, setGanadoraId] = useState(() => (proyecto.revision_ganadora_id ? String(proyecto.revision_ganadora_id) : ''));
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState([]);
  const cotGanadora = cots.find((c) => String(c.id) === String(ganadoraId)) || null;
  const totalFinal = cotGanadora ? (Number(cotGanadora.total) || 0) : 0;

  async function cerrar() {
    const cierre = resultado === 'ganada'
      ? { resultado, revision_aceptada: cotGanadora ? cotGanadora.id : null, total_final: totalFinal,
          escenario: cotGanadora ? (cotGanadora.folio_oficial || cotGanadora.folio || `Cotización ${cotGanadora.id}`) : '',
          fecha: new Date().toISOString().slice(0, 10) }
      : { resultado, motivo, motivo_detalle: detalle };
    const v = validarCierre(cierre);
    if (!v.ok) { setErr(v.errores); return; }
    setErr([]); setGuardando(true);
    // Se revisa el {error} que devuelve Supabase: antes el cierre se daba por hecho
    // aunque el UPDATE fallara (RLS, red) -> el proyecto NO se cerraba y nadie se
    // enteraba. Ahora, si falla, se dice y NO se refresca como si hubiera pasado.
    const { error } = await actualizarProyecto(proyecto.id, resultado === 'ganada'
      ? { etapa: 'GANADA', fecha_cierre: cierre.fecha, revision_ganadora_id: cotGanadora.id, total_final: totalFinal }
      : { etapa: 'PERDIDA', motivo_perdida: motivo, comentario_cierre: detalle || null, fecha_cierre: new Date().toISOString().slice(0, 10) }) || {};
    setGuardando(false);
    if (error) { setErr([`No se pudo cerrar el proyecto: ${error.message || 'error del servidor'}. Intenta de nuevo.`]); return; }
    onCambio?.();
  }

  if (['GANADA', 'PERDIDA'].includes(String(proyecto.etapa).toUpperCase())) {
    return <div className="tarjeta"><strong>Proyecto cerrado: {proyecto.etapa}</strong>
      <div className="ayuda">{String(proyecto.etapa).toUpperCase() === 'PERDIDA' ? `Motivo: ${proyecto.motivo_perdida || '—'}` : `Total aceptado: ${dinero(proyecto.total_final ?? totalFinal)}`} · {f(proyecto.fecha_cierre)}</div></div>;
  }
  return (
    <div className="tarjeta">
      <strong>Cerrar proyecto</strong>
      <div className="chips" style={{ margin: '8px 0' }}>
        <button className={`chip ${resultado === 'ganada' ? 'on' : ''}`} onClick={() => setResultado('ganada')}>Ganada</button>
        <button className={`chip ${resultado === 'perdida' ? 'on' : ''}`} onClick={() => setResultado('perdida')}>Perdida</button>
      </div>
      {resultado === 'ganada' && (
        <div className="ayuda">
          <div style={{ marginBottom: 6 }}>¿Cuál cotización ganó?</div>
          {cots.length === 0
            ? <div className="alerta roja"><span className="texto">Este proyecto no tiene cotizaciones. Crea y guarda la que se vendió antes de cerrarlo como ganada.</span></div>
            : (
              <select className="campo" value={ganadoraId} onChange={(e) => setGanadoraId(e.target.value)}>
                <option value="">Elige la cotización aceptada…</option>
                {cots.map((c) => (
                  <option key={c.id} value={c.id}>{(c.folio_oficial || c.folio || `Cotización ${c.id}`)} · {dinero(Number(c.total) || 0)}</option>
                ))}
              </select>
            )}
          {cotGanadora && <div style={{ marginTop: 6 }}>Total final: <strong>{dinero(totalFinal)}</strong></div>}
        </div>
      )}
      {resultado === 'perdida' && (
        <>
          <select className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ marginTop: 6 }}>
            <option value="">Motivo (obligatorio)…</option>
            {MOTIVOS_PERDIDA.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {motivo === 'OTRO' && <input className="campo" value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Detalle del motivo" style={{ marginTop: 6 }} />}
        </>
      )}
      {err.length > 0 && <div className="alerta roja" style={{ marginTop: 8 }}><span className="texto">{err.join(' · ')}</span></div>}
      {resultado && <button className="boton primario" style={{ marginTop: 10 }} onClick={cerrar} disabled={guardando || (resultado === 'ganada' && !cotGanadora) || (resultado === 'perdida' && !motivo)}>{guardando ? 'Guardando…' : 'Confirmar cierre'}</button>}
    </div>
  );
}
