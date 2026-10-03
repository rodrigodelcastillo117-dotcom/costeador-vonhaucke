// ============================================================================
//  COMERCIAL — superficie principal de venta (IMPLEMENTED_PENDING_VISUAL_SMOKE).
//  Un solo punto de entrada con sub-navegación interna para no llenar el menú:
//    HOY (N19) · PROYECTOS/Workspace (N10 + paneles) · PRODUCTOS (N9) · DIRECCIÓN (N20).
//  Todo client-safe para vendedor; Dirección ve su tablero. Usa los motores puros
//  (atencion/crm) ya probados. Estados: loading/empty/error en cada vista.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { pesos } from '../../util.js';
import { listarProyectos, crearCliente, crearProyecto } from '../../datos/crm.js';
import { hoyNecesitaAtencion, hechosDireccion, proyectosSinProximaAccion } from '../../datos/atencion.js';
import ProyectoWorkspace from './ProyectoWorkspace.jsx';
import ProductoMaestro from './ProductoMaestro.jsx';

// Dinero seguro: nunca "$0" como placeholder de "no hay dato".
export const dinero = (n) => (n == null || isNaN(n) || !isFinite(n) ? '—' : pesos(n));
export const fechaCorta = (iso) => (iso ? String(iso).slice(0, 10) : '—');

function Cargando({ que = 'Cargando…' }) {
  return <div className="tarjeta"><span className="ayuda">{que}</span></div>;
}
function Vacio({ titulo, detalle }) {
  return <div className="tarjeta"><strong>{titulo}</strong><p className="ayuda" style={{ marginTop: 4 }}>{detalle}</p></div>;
}
function ErrorCard({ onReintentar }) {
  return (
    <div className="alerta roja">
      <span className="texto">No se pudo cargar. Revisa tu conexión.</span>
      {onReintentar && <button className="boton" style={{ marginLeft: 8 }} onClick={onReintentar}>Reintentar</button>}
    </div>
  );
}

const SEV = { alta: '#c0392b', media: '#9a6a00', baja: '#555' };

// ---- N19 HOY ---------------------------------------------------------------
function Hoy({ onAbrirProyecto }) {
  const [estado, setEstado] = useState('cargando');
  const [proyectos, setProyectos] = useState([]);
  async function cargar() {
    setEstado('cargando');
    const { data, error } = await listarProyectos();
    if (error) { setEstado('error'); return; }
    setProyectos(data); setEstado('ok');
  }
  useEffect(() => { cargar(); }, []);
  const cards = useMemo(() => hoyNecesitaAtencion({ proyectos }), [proyectos]);

  if (estado === 'cargando') return <Cargando que="Revisando lo de hoy…" />;
  if (estado === 'error') return <ErrorCard onReintentar={cargar} />;
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Hoy necesita tu atención</h3>
      {cards.length === 0
        ? <Vacio titulo="Todo al día ✓" detalle="No hay pendientes que requieran acción inmediata." />
        : cards.map((c, i) => (
          <div className="tarjeta" key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, borderLeft: `4px solid ${SEV[c.severidad] || '#999'}` }}>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 13 }}>{c.tipo.replaceAll('_', ' ')}</strong>
              <div className="ayuda">{c.texto}</div>
            </div>
            {c.ref != null && c.tipo === 'SIN_PROXIMA_ACCION' && (
              <button className="boton" onClick={() => onAbrirProyecto?.(c.ref)}>Abrir ›</button>
            )}
          </div>
        ))}
      <p className="ayuda gris" style={{ fontSize: 11, marginTop: 10 }}>Hechos, no estimaciones. Las cards se generan de tus proyectos y cotizaciones reales.</p>
    </div>
  );
}

// ---- N20 DIRECCIÓN ---------------------------------------------------------
function Direccion() {
  const [estado, setEstado] = useState('cargando');
  const [proyectos, setProyectos] = useState([]);
  async function cargar() {
    setEstado('cargando');
    const { data, error } = await listarProyectos();
    if (error) { setEstado('error'); return; }
    setProyectos(data); setEstado('ok');
  }
  useEffect(() => { cargar(); }, []);
  const h = useMemo(() => hechosDireccion({ proyectos }), [proyectos]);

  if (estado === 'cargando') return <Cargando que="Cargando tablero…" />;
  if (estado === 'error') return <ErrorCard onReintentar={cargar} />;
  if (!proyectos.length) return <Vacio titulo="Sin proyectos todavía" detalle="Cuando existan proyectos, aquí verás los hechos de Dirección." />;

  const KPI = ({ t, v }) => (
    <div className="tarjeta" style={{ flex: 1, minWidth: 120 }}>
      <div className="ayuda" style={{ fontSize: 11 }}>{t}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div>
    </div>
  );
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Dirección — hechos</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <KPI t="Proyectos activos" v={h.proyectosActivos} />
        <KPI t="Ganadas" v={h.ganadas} />
        <KPI t="Perdidas" v={h.perdidas} />
        <KPI t="Monto ganado" v={dinero(h.montoGanado)} />
        <KPI t="Cotizaciones oficiales" v={h.cotizacionesOficiales} />
      </div>
      <div className="tarjeta" style={{ marginTop: 10 }}>
        <strong style={{ fontSize: 13 }}>Pipeline por etapa</strong>
        {Object.entries(h.porEtapa).map(([et, n]) => (
          <div className="fila" key={et} style={{ justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}><span>{et}</span><span className="mono">{n}</span></div>
        ))}
      </div>
      {Object.keys(h.motivosPerdida).length > 0 && (
        <div className="tarjeta">
          <strong style={{ fontSize: 13 }}>Motivos de pérdida</strong>
          {Object.entries(h.motivosPerdida).map(([m, n]) => (
            <div className="fila" key={m} style={{ justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}><span>{m}</span><span className="mono">{n}</span></div>
          ))}
        </div>
      )}
      <p className="ayuda gris" style={{ fontSize: 11 }}>Los borradores sin folio oficial NO cuentan como ventas. Margen sólo cuando el costo es confiable.</p>
    </div>
  );
}

// ---- Alta de proyecto (cliente + proyecto; usa mutaciones existentes) -------
function NuevoProyecto({ usuario, onCreado }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [cliente, setCliente] = useState('');
  const [presupuesto, setPresupuesto] = useState('');
  const [brief, setBrief] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');

  async function crear() {
    if (!nombre.trim() || !cliente.trim()) { setErr('Nombre del proyecto y cliente son obligatorios.'); return; }
    setErr(''); setGuardando(true);
    try {
      const { data: cli, error: e1 } = await crearCliente({ nombre_comercial: cliente.trim(), activo: true, creado_por: usuario || null });
      if (e1 || !cli) throw new Error('cliente');
      const presup = presupuesto.trim() ? Number(String(presupuesto).replace(/[^0-9.]/g, '')) : null;
      const { data: proy, error: e2 } = await crearProyecto({
        nombre: nombre.trim(), cliente_id: cli.id, vendedor_responsable: usuario || 'sin-asignar',
        presupuesto: Number.isFinite(presup) ? presup : null, brief: brief.trim() || null, moneda: 'MXN',
      });
      if (e2 || !proy) throw new Error('proyecto');
      setAbierto(false); setNombre(''); setCliente(''); setPresupuesto(''); setBrief('');
      onCreado?.(proy.id);
    } catch (_e) {
      setErr('No se pudo crear. Revisa los datos o tu conexión e intenta de nuevo.');
    } finally { setGuardando(false); }
  }

  if (!abierto) return <button className="boton primario" style={{ marginBottom: 12 }} onClick={() => setAbierto(true)}>+ Nuevo proyecto</button>;
  return (
    <div className="tarjeta" style={{ marginBottom: 12 }}>
      <strong>Nuevo proyecto</strong>
      <input className="campo" style={{ marginTop: 8 }} placeholder="Nombre del proyecto *" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <input className="campo" style={{ marginTop: 6 }} placeholder="Cliente *" value={cliente} onChange={(e) => setCliente(e.target.value)} />
      <input className="campo" style={{ marginTop: 6 }} inputMode="numeric" placeholder="Presupuesto (opcional)" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} />
      <input className="campo" style={{ marginTop: 6 }} placeholder="Brief (opcional)" value={brief} onChange={(e) => setBrief(e.target.value)} />
      {err && <div className="alerta roja" style={{ marginTop: 8 }}><span className="texto">{err}</span></div>}
      <div className="fila" style={{ gap: 8, marginTop: 8 }}>
        <button className="boton primario" disabled={guardando} onClick={crear}>{guardando ? 'Creando…' : 'Crear proyecto'}</button>
        <button className="boton fantasma" disabled={guardando} onClick={() => { setAbierto(false); setErr(''); }}>Cancelar</button>
      </div>
    </div>
  );
}

// ---- N10 PROYECTOS (lista) -------------------------------------------------
function ListaProyectos({ onAbrir, usuario }) {
  const [estado, setEstado] = useState('cargando');
  const [proyectos, setProyectos] = useState([]);
  async function cargar() {
    setEstado('cargando');
    const { data, error } = await listarProyectos();
    if (error) { setEstado('error'); return; }
    setProyectos(data); setEstado('ok');
  }
  useEffect(() => { cargar(); }, []);
  const sinAccion = useMemo(() => new Set(proyectosSinProximaAccion(proyectos).map((p) => p.id)), [proyectos]);

  if (estado === 'cargando') return <Cargando que="Cargando proyectos…" />;
  if (estado === 'error') return <ErrorCard onReintentar={cargar} />;
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Proyectos</h3>
      <NuevoProyecto usuario={usuario} onCreado={(id) => { cargar(); onAbrir(id); }} />
      {!proyectos.length && <Vacio titulo="Aún no hay proyectos" detalle="Crea tu primer proyecto con el botón de arriba." />}
      {proyectos.map((p) => (
        <div className="tarjeta" key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <strong>{p.nombre || `Proyecto ${p.id}`}</strong>
            <div className="ayuda">{(p.etapa || '—')} · Presupuesto {dinero(p.presupuesto)} · Objetivo {fechaCorta(p.fecha_objetivo)}</div>
          </div>
          {sinAccion.has(p.id) && <span className="etiqueta-dato supuesto" title="Sin próxima acción">sin acción</span>}
          <button className="boton primario" onClick={() => onAbrir(p.id)}>Abrir ›</button>
        </div>
      ))}
    </div>
  );
}

// ---- SHELL -----------------------------------------------------------------
export default function Comercial({ estado, soloVentas = false, veCostos = false, onIr, usuario = null }) {
  const [vista, setVista] = useState('hoy');          // hoy | proyectos | proyecto | productos | direccion
  const [proyectoId, setProyectoId] = useState(null);
  const abrir = (id) => { setProyectoId(id); setVista('proyecto'); };

  const Tab = ({ id, children }) => (
    <button className={`chip ${vista === id ? 'on' : ''}`} onClick={() => setVista(id)} style={{ minHeight: 40 }}>{children}</button>
  );

  return (
    <div className="contenido" style={{ maxWidth: 1000 }}>
      <div className="chips" style={{ marginBottom: 14 }}>
        <Tab id="hoy">Hoy</Tab>
        <Tab id="proyectos">Proyectos</Tab>
        <Tab id="productos">Productos</Tab>
        {veCostos && <Tab id="direccion">Dirección</Tab>}
      </div>

      {vista === 'hoy' && <Hoy onAbrirProyecto={abrir} />}
      {vista === 'proyectos' && <ListaProyectos onAbrir={abrir} usuario={usuario} />}
      {vista === 'productos' && <ProductoMaestro soloVentas={soloVentas} veCostos={veCostos} />}
      {vista === 'direccion' && veCostos && <Direccion />}
      {vista === 'proyecto' && proyectoId != null && (
        <ProyectoWorkspace proyectoId={proyectoId} estado={estado} soloVentas={soloVentas} veCostos={veCostos}
          usuario={usuario} onVolver={() => setVista('proyectos')} onIr={onIr} />
      )}
    </div>
  );
}
