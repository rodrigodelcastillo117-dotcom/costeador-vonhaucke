// ============================================================================
//  ARCHIVO DE COTIZACIONES — "presupuestos que ya hice"
//
//  Nace de dos cosas que pidió Rodrigo el 2026-08-16:
//   1) "si lo hago con mi usuario en mi celular, no me lo pone en la
//      computadora, como si fueran 2 diferentes" — la cotización vivía en el
//      navegador de cada aparato;
//   2) "estaría padre que haya una base de datos con cotizaciones reales que se
//      guarden siempre y para siempre, para poder ver y buscar presupuestos
//      viejos".
//
//  Aquí se ven TODAS, de todos los aparatos y de todo el equipo, con buscador.
//  Abrir una la trae al proyecto actual; el archivo no se destruye desde aquí
//  (sacar de la lista sólo la marca inactiva).
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { listarCotizaciones, archivarCotizacion, mpCambio } from '../datos/cotizaciones.js';
import { listarRevisiones } from '../datos/revisiones.js';
import { armarRespaldo, validarRespaldo, nombreArchivoRespaldo, descargarJSON, leerArchivoJSON } from '../datos/respaldo.js';
import { pesos, coincide } from '../util.js';

const fechaCorta = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
};

export default function Archivo({ estado, onAbrir, veCostos = false, usuario = null, onRestaurar = null }) {
  const [lista, setLista] = useState(null);   // null = cargando
  const [busca, setBusca] = useState('');
  const [error, setError] = useState('');
  const [respaldoMsg, setRespaldoMsg] = useState('');
  const archivoRef = useRef(null);

  // RESPALDO LOCAL DE UN CLIC (Bloque 1). Lo que vive sólo en este navegador sale a
  // un archivo; el rol decide qué sale (ver datos/respaldo.js). Restaurar reemplaza la
  // cotización actual (se pregunta antes) y sigue editando LA MISMA en la nube.
  function exportarRespaldo() {
    const r = armarRespaldo(estado, { veCostos, usuario });
    descargarJSON(nombreArchivoRespaldo(r), r);
    const n = r.cotizacion?.partidas?.length || 0;
    setRespaldoMsg(`Respaldo descargado: ${n} renglón(es)${veCostos ? ', con costos, insumos y parámetros' : ', sin economía interna'}.`);
  }
  async function restaurarRespaldo(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !onRestaurar) return;
    try {
      const r = await leerArchivoJSON(f);
      const v = validarRespaldo(r);
      if (!v.ok) { setRespaldoMsg(`No se restauró: ${v.motivo}`); return; }
      const hay = (estado?.cotizacion?.partidas || []).length;
      if (hay && !confirm(`Tienes ${hay} mueble(s) en el proyecto actual. ¿Los reemplazo con el respaldo (${r.cotizacion.cliente || 'sin cliente'}, ${r.cotizacion.partidas.length} renglones)?`)) return;
      const res = onRestaurar(r);
      setRespaldoMsg(res?.ok === false ? `No se restauró: ${res.motivo}` : `Respaldo restaurado: ${r.cotizacion.partidas.length} renglón(es) de ${r.cotizacion.cliente || 'sin cliente'}.`);
    } catch (err) {
      setRespaldoMsg(`No se restauró: ${err?.message || err}`);
    }
  }

  async function refrescar() {
    setError('');
    try {
      const c = await listarCotizaciones({ limite: 200 });
      setLista(c);
    } catch (e) { setError('No se pudo leer el archivo.'); setLista([]); }
  }
  useEffect(() => { refrescar(); }, []);

  const vistas = (lista || []).filter((c) =>
    coincide(busca, c.cliente, c.folio, (c.partidas || []).map((p) => p.nombre).join(' ')));

  return (
    <div className="contenido">
      <div className="tarjeta" data-testid="respaldo-local">
        <h3 style={{ marginTop: 0 }}>Respaldo de esta computadora</h3>
        <p className="ayuda columna-texto">
          Lo que tienes abierto vive también en este navegador. Descárgalo a un archivo para no perderlo
          o para seguir en otra computadora. {veCostos ? 'Tu respaldo incluye costos, insumos y parámetros (nunca la nómina).' : 'Tu respaldo no incluye economía interna.'}
        </p>
        <div className="fila-botones" style={{ gap: 8 }}>
          <button className="boton primario" style={{ minHeight: 44 }} onClick={exportarRespaldo}>Descargar respaldo</button>
          {onRestaurar && (
            <button className="boton" style={{ minHeight: 44 }} onClick={() => archivoRef.current?.click()}>Restaurar respaldo</button>
          )}
          <input ref={archivoRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={restaurarRespaldo} data-testid="respaldo-archivo" />
        </div>
        {respaldoMsg && <div className="ayuda" style={{ marginTop: 8 }} data-testid="respaldo-msg">{respaldoMsg}</div>}
      </div>
      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Presupuestos que ya hicimos</h2>
        <p className="ayuda columna-texto">
          Todo lo que se cotiza se guarda solo, con tu usuario. Aparece aquí desde cualquier
          aparato: si lo empezaste en el celular, lo abres en la computadora.
        </p>
        <input
          type="search" className="campo" value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Busca por cliente, folio o mueble: Tradeco, 2608-001, bench Cirque…"
          style={{ minHeight: 46, marginBottom: 12 }}
        />
        {error && <div className="alerta roja"><span className="texto">{error}</span></div>}
        {lista === null && <p className="gris">Cargando…</p>}
        {lista !== null && !lista.length && (
          <p className="ayuda">Todavía no hay presupuestos guardados. En cuanto agregues un mueble a
            una cotización, aparece aquí solo.</p>
        )}
        {lista !== null && lista.length > 0 && (
          <div className="ayuda" style={{ marginBottom: 8 }}>
            {vistas.length} de {lista.length}
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {vistas.map((c) => {
            // ⚠️ La condición que puso Rodrigo: un precio viejo sólo se reusa si
            // la materia prima no se movió desde entonces.
            const movio = mpCambio(c, estado?.insumos, estado?.parametros);
            return (
              <div key={c.id} className="tarjeta" style={{ padding: 12, display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 16 }}>{c.cliente || 'Sin cliente'}</strong>
                  {c.folio && <span className="ayuda" style={{ display: 'inline' }}>Folio {c.folio}</span>}
                  <span className="mono" style={{ marginLeft: 'auto', fontWeight: 700 }}>{pesos(c.total)}</span>
                </div>
                <div className="ayuda">
                  {fechaCorta(c.actualizado || c.creado)} · {(c.partidas || []).length} renglón(es) · {c.piezas} pieza(s)
                  {c.usuario ? ` · ${c.usuario}` : ''}
                </div>
                <div className="ayuda" style={{ opacity: 0.85 }}>
                  {(c.partidas || []).slice(0, 3).map((p) => p.nombre).join(' · ')}
                  {(c.partidas || []).length > 3 ? ' …' : ''}
                </div>
                {movio === true && (
                  <div className="alerta ambar" style={{ margin: 0 }}>
                    <span className="texto">
                      Los precios de materia prima cambiaron desde que se hizo. Sirve de referencia,
                      pero <strong>vuelve a costear</strong> antes de mandarla.
                    </span>
                  </div>
                )}
                <div className="fila-botones" style={{ gap: 8 }}>
                  <button className="boton primario" style={{ minHeight: 44 }}
                    onClick={() => onAbrir && onAbrir(c)}>Abrir</button>
                  <button className="boton fantasma" style={{ minHeight: 44 }}
                    onClick={async () => {
                      if (!confirm(`¿Sacar de la lista el presupuesto de ${c.cliente || 'sin cliente'}? No se borra, sólo deja de aparecer.`)) return;
                      try { await archivarCotizacion(c.id); refrescar(); }
                      catch (e) { setError('No se pudo sacar de la lista. Revisa tu internet y vuelve a intentar.'); }
                    }}>Sacar de la lista</button>
                </div>
                <Emisiones cotizacionId={c.id} folio={c.folio} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Historial de EMISIONES de una cotización: lo que de verdad se le ofreció al
// cliente, conservado (fecha + responsable + total), sin poder borrarse ni
// editarse. Carga bajo demanda para no pegarle a la nube por cada tarjeta.
function Emisiones({ cotizacionId, folio }) {
  const [abierto, setAbierto] = useState(false);
  const [revs, setRevs] = useState(null); // null = aún no cargado
  async function abrir() {
    setAbierto(true);
    if (revs === null) setRevs(await listarRevisiones(cotizacionId, folio));
  }
  if (!abierto) {
    return (
      <button className="boton fantasma" style={{ minHeight: 36, marginTop: 6, fontSize: 13 }} onClick={abrir}>
        Ver emisiones
      </button>
    );
  }
  if (revs === null) return <div className="ayuda" style={{ marginTop: 6 }}>Cargando emisiones…</div>;
  if (!revs.length) return <div className="ayuda" style={{ marginTop: 6 }}>Todavía no se ha emitido (no hay PDF ni impresión guardada).</div>;
  return (
    <div style={{ marginTop: 6, display: 'grid', gap: 3 }}>
      <div className="ayuda" style={{ fontWeight: 700 }}>{revs.length} emisión(es) conservada(s):</div>
      {revs.map((r) => (
        <div key={r.id} className="ayuda" style={{ opacity: 0.9 }}>
          Rev. {r.revision} · {fechaCorta(r.emitida_en)} · {r.usuario || 'autor desconocido'} · {pesos(r.total)}
        </div>
      ))}
    </div>
  );
}
