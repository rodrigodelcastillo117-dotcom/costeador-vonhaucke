// COSTEO POR CLAVE (Producto Maestro). Escribe la clave de un mueble de catálogo
// (ENTCBCALP, …) → trae su BOM confirmado de estimaciones y lo RE-COSTEA con los
// precios vigentes del catálogo + la política VH. Determinista, ±1%, sin VONI.
// Seller-safe: la tabla sólo la leen roles que ven economía (RLS).
import React, { useState } from 'react';
import { cargarBOMporClave } from '../datos/productoMaestroCarga.js';
import { costearBOM } from '../datos/productoMaestro.js';
import { sanarBOM } from '../datos/mapeoPorClave.js';
import { semaforoCertificacion } from '../datos/semaforoCertificacion.js';

const pesos = (x) => (x == null || !Number.isFinite(Number(x))) ? '—' : '$' + Number(x).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CosteoPorClave({ insumos = {} }) {
  const [clave, setClave] = useState('');
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);   // { bom, costo }

  async function costear(e) {
    e && e.preventDefault && e.preventDefault();
    setErr(''); setRes(null); setCargando(true);
    try {
      const r = await cargarBOMporClave(clave);
      if (!r.ok) { setErr(r.error); return; }
      // Auto-sanador: amarra por clave ERP las líneas sin insumoId antes de costear (no destructivo;
      // sólo cuando la clave es única y la unidad compatible — ver mapeoPorClave.js).
      const { bom, mapeadas } = sanarBOM(r.bom, insumos);
      const costo = costearBOM(bom, insumos);
      setRes({ bom, costo, mapeadas });
    } catch (ex) {
      // Antes era try/finally SIN catch: si sanarBOM/costearBOM lanzaban (BOM/insumos mal formados),
      // el spinner se apagaba y el usuario se quedaba sin resultado NI error. Ahora se muestra.
      setErr('No se pudo costear la clave: ' + String(ex?.message || ex));
    } finally { setCargando(false); }
  }

  const c = res && res.costo;
  const pendientes = res ? res.costo.lineas.filter((l) => l.fuente === 'confirmado') : [];
  const vencidos = res ? res.costo.lineas.filter((l) => l.fuente === 'catalogo' && l.fresco === false) : [];
  const sinPrecio = res ? res.costo.lineas.filter((l) => l.fuente === 'sin_precio') : [];
  const sem = c ? semaforoCertificacion(c) : null;
  const icono = { verde: '✅', ambar: '🟡', gris: '⚪', rojo: '🔴' };

  return (
    <div className="tarjeta" data-testid="costeo-por-clave" style={{ marginTop: 12, borderLeft: '4px solid #2e6f4e' }}>
      <div style={{ fontWeight: 800, marginBottom: 2 }}>Costear por clave (Producto Maestro)</div>
      <div className="ayuda" style={{ marginBottom: 8 }}>
        Mueble de catálogo con BOM confirmado por estimaciones → costo exacto (±1%) con precios vigentes. No depende de VONI.
      </div>
      <form onSubmit={costear} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Clave (p.ej. ENTCBCALP)"
          data-testid="clave-input" style={{ flex: '1 1 220px', textTransform: 'uppercase' }} />
        <button type="submit" disabled={cargando || !clave.trim()} data-testid="clave-costear">
          {cargando ? 'Costeando…' : 'Costear'}
        </button>
      </form>

      {err && <div className="alerta ambar" style={{ marginTop: 8 }} data-testid="clave-error"><span className="texto">⚠ {err}</span></div>}

      {c && (
        <div style={{ marginTop: 10 }} data-testid="clave-resultado">
          <div style={{ fontWeight: 700 }}>{res.bom.nombre} <span className="ayuda">· {res.bom.clave}</span></div>
          {!!(res.mapeadas && res.mapeadas.length) && (
            <div className="ayuda" data-testid="clave-automap" style={{ marginTop: 4 }}>
              🔗 {res.mapeadas.length} línea(s) amarrada(s) automáticamente a su material del catálogo por clave ERP.
            </div>
          )}

          {/* SELLO DE ESTADO (lo más importante para el piloto: jamás confundir estimación con costo certificado) */}
          {!c.emitible ? (
            <div className="alerta roja" data-testid="clave-estado" data-estado="no_emitible" style={{ marginTop: 8 }}>
              <span className="texto">✕ <strong>Costo NO EMITIBLE</strong> — {c.bloqueos.length} bloqueo(s): {c.bloqueos.slice(0, 4).map((b) => b.desc || b.estado).join(' · ')}. No se puede cotizar ni certificar.</span>
            </div>
          ) : c.certificable ? (
            <div className="ayuda" data-testid="clave-estado" data-estado="certificable" style={{ marginTop: 8 }}>
              <strong>✓ Certificable por materiales</strong> — precios vigentes del catálogo + BOM detallado verificado.
            </div>
          ) : (
            <div className="alerta ambar" data-testid="clave-estado" data-estado="orientativo" style={{ marginTop: 8 }}>
              <span className="texto">⚠ <strong>Estimación orientativa — NO es costo oficial certificado.</strong>{' '}
                {c.tipoBom === 'AGREGADO_HISTORICO' ? 'BOM agregado histórico, sin desglose por material.' : (
                  <>
                    {c.hayPrecioViejo ? `${c.cobertura.catalogoViejo} precio(s) de catálogo vencido(s) (>24 meses) → el servidor los marca PRELIMINAR. ` : ''}
                    {c.cobertura.conConfirmado ? `${c.cobertura.conConfirmado} línea(s) con precio histórico (falta alta en catálogo). ` : ''}
                    Refresca esos precios en Compras para certificar.
                  </>
                )}
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6, marginTop: 8 }}>
            <div><div className="ayuda">Material fabricado</div><strong>{pesos(c.materialFabricado)}</strong></div>
            <div><div className="ayuda">Material compra-venta</div><strong>{pesos(c.materialCompraVenta)}</strong></div>
            <div><div className="ayuda">Mano de obra{c.material > 0 ? ` (${(100 * c.manoObra / c.material).toFixed(1)}%)` : ''}</div><strong>{pesos(c.manoObra)}</strong></div>
            <div><div className="ayuda">Gasto indirecto{c.material > 0 ? ` (${(100 * c.gif / c.material).toFixed(1)}%)` : ''}</div><strong>{pesos(c.gif)}</strong></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="ayuda">Costo de fabricación</div>
              <strong className="dinero" style={{ fontSize: '1.15em' }} data-testid="clave-cosfab">{pesos(c.costoFabricacion)}</strong>
              {c.cosFabReal != null && (
                <span className="ayuda" style={{ marginLeft: 8 }}>
                  vs estimaciones {pesos(c.cosFabReal)} · <b>{c.deltaPct >= 0 ? '+' : ''}{c.deltaPct.toFixed(2)}%</b>
                </span>
              )}
            </div>
          </div>
          <div className="ayuda" style={{ marginTop: 8 }}>
            {c.cobertura.lineas} líneas · {c.cobertura.conCatalogo} con precio del catálogo vigente · {c.cobertura.conConfirmado} con precio confirmado de estimaciones
            {c.cobertura.sinPrecio ? ` · ${c.cobertura.sinPrecio} SIN precio` : ''}.
          </div>
          {sem && (sem.resumen.ambar + sem.resumen.gris + sem.resumen.rojo > 0) && (
            <details style={{ marginTop: 8 }} data-testid="clave-semaforo" open>
              <summary className="ayuda" style={{ cursor: 'pointer', fontWeight: 700 }}>
                🚦 Semáforo de certificación — {sem.resumen.verde}{icono.verde} · {sem.resumen.ambar}{icono.ambar} · {sem.resumen.gris}{icono.gris} · {sem.resumen.rojo}{icono.rojo}
              </summary>
              {!!sem.acciones.length && (
                <div className="ayuda" style={{ margin: '6px 0' }}>
                  <strong>Para certificar falta:</strong>
                  <ul style={{ margin: '4px 0 0 16px' }}>
                    {sem.acciones.map((a, i) => <li key={i}>{icono[a.nivel]} {a.accion}</li>)}
                  </ul>
                </div>
              )}
              <table className="ayuda" style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
                <tbody>
                  {sem.filas.map((f, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: '2px 6px', whiteSpace: 'nowrap' }}>{icono[f.nivel]}</td>
                      <td style={{ padding: '2px 6px' }}>{f.desc}</td>
                      <td style={{ padding: '2px 6px', color: '#777' }}>{f.etiqueta}{f.accion ? ` — ${f.accion}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
          {!!pendientes.length && (
            <details style={{ marginTop: 6 }}>
              <summary className="ayuda" style={{ cursor: 'pointer' }}>{pendientes.length} material(es) aún sin insumo en catálogo (usan precio de estimaciones; pendientes de alta por Compras)</summary>
              <ul className="ayuda" style={{ margin: '6px 0 0 16px' }}>
                {pendientes.slice(0, 40).map((l, i) => <li key={i}>{l.desc} — {pesos(l.precio)} × {l.cantidad}</li>)}
              </ul>
            </details>
          )}
          {!!vencidos.length && (
            <details style={{ marginTop: 6 }} data-testid="clave-vencidos">
              <summary className="ayuda" style={{ cursor: 'pointer' }}>{vencidos.length} material(es) con precio de catálogo vencido (&gt;24 meses; el servidor los marca PRELIMINAR — refrescar en Compras)</summary>
              <ul className="ayuda" style={{ margin: '6px 0 0 16px' }}>
                {vencidos.slice(0, 40).map((l, i) => <li key={i}>{l.desc} — {pesos(l.precio)} × {l.cantidad}</li>)}
              </ul>
            </details>
          )}
          {!!sinPrecio.length && (
            <div className="alerta roja" style={{ marginTop: 6 }}><span className="texto">✕ {sinPrecio.length} línea(s) sin precio: {sinPrecio.map((l) => l.desc).slice(0, 5).join(', ')}</span></div>
          )}
        </div>
      )}
    </div>
  );
}
