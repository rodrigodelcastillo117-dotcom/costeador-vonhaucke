// ============================================================================
//  COCREAR · la pantalla de co-creación. De la IDEA al PRODUCTO, con honestidad.
//  Maneja el orquestador puro `datos/cocrear.js` (que a su vez ORQUESTA costear +
//  cotizar). No duplica motores ni inventa: muestra, paso a paso, qué se entendió,
//  cómo se clasificó, qué falta y por qué NO está listo todavía.
//  Seller-safe: un vendedor nunca ve montos de costo, sólo el estado.
//  Responsive (P0): una sola columna fluida; se usa igual en móvil, tablet y desktop.
// ============================================================================
import React, { useMemo, useState } from 'react';
import { cocrear, COCREO_STATUS, COST_STATUS } from '../datos/cocrear.js';
import { parametrosEfectivos } from './Costeador.jsx';

const EJEMPLO = 'Quiero una recepción cálida, premium, curva, 2.40 m, nogal oscuro, cubierta clara, iluminación integrada y espacio para dos personas.';

// Color de un estado (verde = ok, ámbar = parcial/estimado, rojo = bloqueo, gris = n/a).
function tonoEstado(estado) {
  const s = String(estado || '');
  if (/READY|KNOWN|CAN_BUILD|VALIDATED|lista|ok/.test(s)) return 'verde';
  if (/PARTIAL|ESTIMATED|PROPOSED|input_listo|parcial/.test(s)) return 'ambar';
  if (/BLOCKED|REQUIRES_VALIDATION|PENDING|UNKNOWN|requiere|DRAFT/.test(s)) return 'rojo';
  return 'gris';
}

const COLOR = { verde: '#067647', ambar: '#B54708', rojo: '#B42318', gris: '#667085' };
const FONDO = { verde: '#ECFDF3', ambar: '#FFFAEB', rojo: '#FEF3F2', gris: '#F2F4F7' };

function Badge({ children, estado }) {
  const t = tonoEstado(estado ?? children);
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
      color: COLOR[t], background: FONDO[t], border: `1px solid ${COLOR[t]}22`, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

// Una tarjeta-paso del pipeline.
function Paso({ titulo, estado, children }) {
  return (
    <div className="cocrear-paso">
      <div className="cocrear-paso-top">
        <h3 className="cocrear-paso-titulo">{titulo}</h3>
        {estado != null && <Badge estado={estado}>{estado}</Badge>}
      </div>
      {children}
    </div>
  );
}

const ETIQUETA_COSTO = {
  [COST_STATUS.KNOWN]: 'Costo conocido (precios reales)',
  [COST_STATUS.ESTIMATED]: 'Costo estimado (precioBase)',
  [COST_STATUS.PENDING_PRICE]: 'Material sin precio: pendiente',
  [COST_STATUS.PENDING_MATERIAL]: 'Material no está en catálogo: pendiente',
  [COST_STATUS.UNKNOWN]: 'Sin despiece: costo por determinar',
  [COST_STATUS.NOT_APPLICABLE]: 'No aplica',
};

const ETIQUETA_STATUS = {
  [COCREO_STATUS.READY]: 'Listo para cotizar',
  [COCREO_STATUS.PARTIAL]: 'Avanza — faltan piezas del pipeline',
  [COCREO_STATUS.BLOCKED]: 'Bloqueado — requiere validación',
  [COCREO_STATUS.DRAFT]: 'Borrador — hace falta más del brief',
};

export default function Cocrear({ estado, soloVentas = false, onIr }) {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState(null);

  // insumos + parámetros reales del proyecto (para costear si hay BOM).
  const insumos = estado?.insumos || {};
  const par = useMemo(() => parametrosEfectivos(estado, { componentes: [] }).par || estado?.parametros || {}, [estado]);

  const correr = () => {
    const t = (texto || '').trim();
    if (!t) return;
    setResultado(cocrear(t, { insumos, par }));
  };

  const r = resultado;

  return (
    <div className="contenido cocrear-wrap">
      <header className="cocrear-head">
        <h1 className="cocrear-h1">Cocrear</h1>
        <p className="cocrear-sub">De la idea al producto: lo entendemos, lo clasificamos, lo costeamos y te decimos — con honestidad — qué falta antes de cotizarlo.</p>
      </header>

      <div className="tarjeta cocrear-entrada">
        <label className="cocrear-label" htmlFor="cocrear-idea">Describe la idea del cliente</label>
        <textarea
          id="cocrear-idea"
          className="cocrear-textarea"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={EJEMPLO}
          rows={4}
        />
        <div className="cocrear-acciones">
          <button type="button" className="boton cocrear-btn" onClick={correr} disabled={!texto.trim()}>Co-crear</button>
          <button type="button" className="boton-fantasma cocrear-btn-sec" onClick={() => setTexto(EJEMPLO)}>Usar ejemplo</button>
        </div>
      </div>

      {r && (
        <>
          {/* Estado global, honesto y visible. */}
          <div className="cocrear-status" style={{ background: FONDO[tonoEstado(r.status)], borderColor: COLOR[tonoEstado(r.status)] }}>
            <div>
              <Badge estado={r.status}>{r.status}</Badge>
              <span className="cocrear-status-txt"> {ETIQUETA_STATUS[r.status] || ''}</span>
            </div>
            <span className="cocrear-desc">{r.lineaCotizacion.descripcion}</span>
          </div>

          {r.blockers.length > 0 && (
            <div className="tarjeta cocrear-blockers">
              <strong>Qué falta para poder cotizar</strong>
              <ul>{r.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </div>
          )}

          <div className="cocrear-pasos">
            {/* 1 · Intención */}
            <Paso titulo="1 · Qué entendimos" estado={r.intent.familia === 'DESCONOCIDA' ? 'parcial' : 'ok'}>
              <dl className="cocrear-dl">
                <div><dt>Familia</dt><dd>{r.intent.familia}</dd></div>
                {r.intent.dimensiones && <div><dt>Dimensión</dt><dd>{(r.intent.dimensiones.ancho_mm / 1000).toFixed(2)} m</dd></div>}
                {r.intent.materiales.length > 0 && <div><dt>Materiales</dt><dd>{r.intent.materiales.map((m) => `${m.material}${m.tono ? ' ' + m.tono : ''}`).join(', ')}</dd></div>}
                {r.intent.caracteristicas.length > 0 && <div><dt>Características</dt><dd>{r.intent.caracteristicas.join(', ')}</dd></div>}
                {r.intent.capacidad && <div><dt>Capacidad</dt><dd>{r.intent.capacidad.personas} personas</dd></div>}
                {(r.dna.tono || r.dna.nivel) && <div><dt>ADN</dt><dd>{[r.dna.nivel, r.dna.tono].filter(Boolean).join(' · ')}</dd></div>}
              </dl>
              {r.intent.desconocidos.length > 0 && (
                <p className="cocrear-nota-rojo">No se mencionó: {r.intent.desconocidos.join(', ')} — no lo inventamos.</p>
              )}
            </Paso>

            {/* 2 · Clasificación */}
            <Paso titulo="2 · Clasificación" estado={r.clasificacion.clasificacion}>
              <p className="cocrear-motivo">{r.clasificacion.motivos.join(' ')}</p>
              {r.clasificacion.parent_product_id && (
                <p className="cocrear-linaje">Deriva de <strong>{r.clasificacion.parent_product_id}</strong> ({r.clasificacion.parent_product_version}) · se conserva el linaje, no se cobra el estándar.</p>
              )}
              {r.clasificacion.change_set.length > 0 && (
                <ul className="cocrear-changeset">
                  {r.clasificacion.change_set.map((c, i) => <li key={i}><span className="cocrear-chip">{c.tipo}</span> {c.campo}: {String(c.a)}</li>)}
                </ul>
              )}
            </Paso>

            {/* 3 · ProductSpec */}
            <Paso titulo="3 · Ficha de producto (ProductSpec)" estado={`rev ${r.spec.rev}`}>
              <p className="cocrear-mono">{r.spec.id}@{r.spec.rev} <span className="cocrear-hash">#{r.spec.hash}</span></p>
              <p className="cocrear-ayuda">Versionada y con hash: cualquier cambio genera una revisión nueva y marca obsoleto lo de aguas abajo.</p>
            </Paso>

            {/* 4 · Ingeniería + Manufacturabilidad */}
            <Paso titulo="4 · Ingeniería y fabricación" estado={r.ingenieria.estado}>
              <p className="cocrear-motivo">{r.ingenieria.motivos.join(' ')}</p>
              <div className="cocrear-top-inline">
                <span>Manufacturabilidad:</span> <Badge estado={r.manufacturabilidad.estado}>{r.manufacturabilidad.estado}</Badge>
              </div>
              {r.manufacturabilidad.requisitos.length > 0 && (
                <p className="cocrear-ayuda">Requiere validar: {r.manufacturabilidad.requisitos.join(', ')}.</p>
              )}
            </Paso>

            {/* 5 · Costo (seller-safe) */}
            <Paso titulo="5 · Costo" estado={r.costo.cost_status}>
              <p className="cocrear-motivo">{ETIQUETA_COSTO[r.costo.cost_status]}</p>
              {!soloVentas && r.costo.official_cost != null && (
                <p className="cocrear-dato">Costo oficial: <strong>${r.costo.official_cost.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</strong></p>
              )}
              {!soloVentas && r.costo.official_cost == null && r.costo.known_cost > 0 && (
                <p className="cocrear-dato">Subtotal conocido (parcial): ${r.costo.known_cost.toLocaleString('es-MX', { maximumFractionDigits: 2 })} · el costo oficial está bloqueado hasta resolver lo pendiente.</p>
              )}
              {r.costo.unresolved_lines.length > 0 && (
                <p className="cocrear-nota-rojo">Pendiente: {r.costo.unresolved_lines.join(', ')}.</p>
              )}
            </Paso>

            {/* 6 · Línea de cotización */}
            <Paso titulo="6 · Cotización" estado={r.lineaCotizacion.costeable ? 'lista' : 'requiere desarrollo'}>
              {r.lineaCotizacion.costeable ? (
                <>
                  <p className="cocrear-motivo">Listo para cotizar. El precio lo fija la política de cotización (margen/lista); el vendedor nunca ve el costo.</p>
                  {onIr && <button type="button" className="boton cocrear-btn" onClick={() => onIr('cotizacion')}>Ir a cotización</button>}
                </>
              ) : (
                <p className="cocrear-nota-rojo">{r.lineaCotizacion.motivo}</p>
              )}
            </Paso>
          </div>
        </>
      )}
    </div>
  );
}
