// ============================================================================
//  PRECIOS - precios de insumos, calculadora de costo hora y parametros (7.5)
// ============================================================================
import { useRef, useState, useEffect } from 'react';
import { SECCIONES } from '../datos/insumos.js';
import { calcularCostoHora } from '../motor/calculo.js';
import Icono from './Iconos.jsx';
import { exportar, importar, restablecerPrecios } from '../almacen.js';
import { pesos2, pct, diasDesde } from '../util.js';
import { resolverPrecioInsumo, explicarPrecioInsumo } from '../datos/precioInsumoBridge.js';
import { etiquetaEstadoPrecio } from '../datos/canonicalPriceResolver.js';
import { ESTADO_PRECIO } from '../datos/precioProvenance.js';

// Color del chip de procedencia por estado. Aditivo: NO cambia ningún número del
// motor, sólo dice de DÓNDE sale el precio (REALITY CUTOVER: "¿por qué $544?").
const COLOR_ESTADO = {
  [ESTADO_PRECIO.CURRENT_VERIFIED]: { bg: '#e6f4ea', fg: '#1e7e34' },
  [ESTADO_PRECIO.REAL_OBSERVED]: { bg: '#e8f0fe', fg: '#1a56db' },
  [ESTADO_PRECIO.HISTORICAL]: { bg: '#fff4e5', fg: '#9a6700' },
  [ESTADO_PRECIO.PROVISIONAL]: { bg: '#f1f3f4', fg: '#5f6368' },
  [ESTADO_PRECIO.PENDING]: { bg: '#fce8e6', fg: '#c5221f' },
};

// Chip de procedencia de UN insumo. Si el precio fue CAPTURADO a mano (difiere
// del estimado base), NO reclama "compra real": se marca como provisional
// capturado (sin documento) — honesto hasta que se adjunte evidencia.
function ChipProcedencia({ insumo }) {
  const capturado = insumo.precioBase > 0 && insumo.precio !== insumo.precioBase;
  const paraResolver = capturado
    ? { precio: insumo.precio, unidad: insumo.unidad, nombre: insumo.nombre, fuente: null }
    : insumo;
  const r = resolverPrecioInsumo(insumo.id, paraResolver);
  const col = COLOR_ESTADO[r.estado] || COLOR_ESTADO[ESTADO_PRECIO.PROVISIONAL];
  const porque = capturado
    ? `Precio capturado a mano${insumo.actualizado ? ` · ${insumo.actualizado}` : ''}. Provisional hasta adjuntar evidencia (compra/T.D.C./lista).`
    : explicarPrecioInsumo(insumo.id, insumo);
  const texto = capturado ? 'Capturado a mano' : etiquetaEstadoPrecio(r.estado);
  return (
    <span title={porque}
      style={{ background: col.bg, color: col.fg, borderRadius: 999, padding: '1px 8px', fontSize: 11, cursor: 'help', whiteSpace: 'nowrap' }}>
      {texto}
    </span>
  );
}

// ⚠️ ESTOS CAMPOS SE VOLVÍAN $0 EN VIVO, PARA TODO EL EQUIPO, EN CADA TECLA
// (auditoría 2026-08-19). `type="number"` con `onChange={... parseFloat(v)||0}`
// escribe a `estado` (y de ahí a Supabase, compartido) en CADA tecla —
// borrar el campo para reescribir un precio (gesto normal) pasaba por un
// instante en blanco, `parseFloat('')` es NaN, `NaN||0` es 0: ese cero se
// subía de inmediato. Mismo patrón que ya resolvieron `CampoPct`
// (Cotizacion.jsx) y `CampoM2` (EmpezarEspacio.jsx) para exactamente este
// problema: se escribe libre mientras el campo tiene el foco, y sólo se
// valida/confirma al salir (`onBlur`) — nunca a medio tecleo. Si al salir
// quedó vacío o inválido, se REGRESA al valor anterior, nunca a 0.
function CampoNumero({ valor, min = 0, max = 99999999, onCambio, ancho = 110, clase = 'numero' }) {
  const [txt, setTxt] = useState(String(valor));
  const [escribiendo, setEscribiendo] = useState(false);
  useEffect(() => { if (!escribiendo) setTxt(String(valor)); }, [valor, escribiendo]);
  const cerrar = () => {
    setEscribiendo(false);
    const limpio = String(txt ?? '').trim().replace(',', '.');
    const num = limpio === '' ? NaN : Number(limpio);
    const n = Number.isFinite(num) ? Math.min(max, Math.max(min, num)) : valor;
    setTxt(String(n));
    if (n !== valor) onCambio(n);
  };
  return (
    <input
      type="text" inputMode="decimal" className={clase} style={{ maxWidth: ancho, width: ancho }}
      value={txt}
      onFocus={() => setEscribiendo(true)}
      onChange={(e) => { setEscribiendo(true); setTxt(e.target.value); }}
      onBlur={cerrar}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

export default function Precios({ estado, setEstado, puedeVerDireccion = true, onDireccion }) {
  const archivoRef = useRef();
  const p = estado.parametros;
  const { horaNominal, horaTaller, horasHombre } = calcularCostoHora(p);

  const setParam = (k, v) => setEstado({ ...estado, parametros: { ...p, [k]: v } });
  // ⚠️ Aquí quedaba escrito a mano '2026-08-11' — la fecha en que se tecleó
  // esta línea, no la de HOY. Cada vez que alguien actualizaba un precio, el
  // sello de "actualizado" quedaba fijo en ese día del pasado, así que junto
  // con `diasDesde` (ver util.js) el precio que ACABABAS de capturar ya
  // aparecía con días de antigüedad — y ese hueco crece cada día que pasa.
  const setPrecio = (id, precio) =>
    setEstado({ ...estado, insumos: { ...estado.insumos, [id]: { ...estado.insumos[id], precio, actualizado: new Date().toISOString().slice(0, 10) } } });

  async function alImportar(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const nuevo = await importar(f);
      setEstado(nuevo);
      alert('Datos importados.');
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="contenido">
      {/* Calculadora de costo hora - SOLO DIRECCION (contiene la nomina) */}
      {!puedeVerDireccion ? (
        <div className="tarjeta">
          <h2>Costo hora de taller</h2>
          <div className="alerta ambar" style={{ marginTop: 4 }}>
            <Icono nombre="candado" tam={16} />
            <span className="texto">La nómina es solo de Dirección: no se descarga a esta computadora. El costo hora que usa el sistema para costear es <strong className="mono">{pesos2(p.costoHora)}</strong>.</span>
            {onDireccion && <button className="boton" onClick={onDireccion}>Soy Dirección</button>}
          </div>
        </div>
      ) : (
      <div className="tarjeta">
        <h2>Costo hora de taller</h2>
        <div className="renglon-insumo">
          <span className="nom">Nomina semanal de planta <span className="gris">solo areas productivas</span></span>
          <CampoNumero valor={p.nominaSemanalDirecta} onCambio={(n) => setParam('nominaSemanalDirecta', n)} />
        </div>
        <div className="renglon-insumo">
          <span className="nom">Operativos en planta</span>
          <CampoNumero valor={p.operativos} min={1} onCambio={(n) => setParam('operativos', n)} />
        </div>
        <div className="renglon-insumo">
          <span className="nom">Horas por semana</span>
          <CampoNumero valor={p.jornadaSemanal} min={1} onCambio={(n) => setParam('jornadaSemanal', n)} />
        </div>
        <div className="renglon-insumo">
          <span className="nom">Eficiencia real <span className="etiqueta-dato supuesto">valor supuesto</span></span>
          <CampoNumero valor={p.eficienciaReal} min={1} onCambio={(n) => setParam('eficienciaReal', n)} />
        </div>
        <hr />
        <div className="fila-botones" style={{ justifyContent: 'space-between' }}>
          <span>Horas-hombre por semana</span><strong className="mono">{horasHombre.toLocaleString('es-MX')}</strong>
        </div>
        <div className="fila-botones" style={{ justifyContent: 'space-between' }}>
          <span>Hora nominal</span><strong className="mono">{pesos2(horaNominal)}</strong>
        </div>
        <div className="fila-botones" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <strong>HORA DE TALLER</strong>
          <strong className="precio-grande" style={{ fontSize: 28 }}>{pesos2(horaTaller)}</strong>
        </div>
        <div className="espacio" />
        <button className="boton primario" onClick={() => setParam('costoHora', Math.round(horaTaller * 100) / 100)}>Usar en los costeos ({pesos2(horaTaller)})</button>
        <div className="ayuda">Costo hora en uso hoy: {pesos2(p.costoHora)}.</div>
      </div>
      )}

      {/* Parametros de planta */}
      <div className="tarjeta">
        <h2>Parametros de planta</h2>
        <div className="dos-col" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label className="etiqueta">Gastos de fabrica (% sobre material directo)</label>
            <CampoNumero valor={p.factorIndirectosFabrica} max={1000} onCambio={(n) => setParam('factorIndirectosFabrica', n)} />
          </div>
          <div>
            <label className="etiqueta">Margen minimo (%)</label>
            <CampoNumero valor={p.margenMinimo} max={100} onCambio={(n) => setParam('margenMinimo', n)} />
          </div>
          <div>
            <label className="etiqueta">Margen de lista (% sobre precio)</label>
            <CampoNumero valor={p.margenObjetivo ?? 50} max={100} onCambio={(n) => setParam('margenObjetivo', n)} />
          </div>
          <div>
            <label className="etiqueta">Mínimo de línea (% utilidad sobre costo)</label>
            <CampoNumero valor={p.minMarkupLinea ?? 45} max={1000} onCambio={(n) => setParam('minMarkupLinea', n)} />
          </div>
          <div>
            <label className="etiqueta">Anticipo (%)</label>
            <CampoNumero valor={p.anticipoPorcentaje ?? 50} max={100} onCambio={(n) => setParam('anticipoPorcentaje', n)} />
          </div>
          <div>
            <label className="etiqueta">Factor mano de obra directa (%)</label>
            <CampoNumero valor={p.factorManoObraDirecta} max={1000} onCambio={(n) => setParam('factorManoObraDirecta', n)} />
          </div>
          <div>
            <label className="etiqueta">Factor mano de obra indirecta (%)</label>
            <CampoNumero valor={p.factorManoObraIndirecta} max={1000} onCambio={(n) => setParam('factorManoObraIndirecta', n)} />
          </div>
          <div>
            <label className="etiqueta">Aprovechamiento de hoja (%)</label>
            <CampoNumero valor={p.aprovechamientoCorte ?? 80} min={1} max={100} onCambio={(n) => setParam('aprovechamientoCorte', n)} />
            <div className="ayuda">Cuánto de cada hoja se aprovecha. Tableros y láminas se costean por fracción de hoja sobre este %: a menor aprovechamiento, mayor costo.</div>
          </div>
        </div>
      </div>

      {/* Exportar / Importar */}
      <div className="tarjeta">
        <h2>Compartir y respaldar</h2>
        <p className="ayuda columna-texto">Exporta un archivo con todos los precios, piezas y cotizaciones para pasarlo a otra computadora. Importar reemplaza lo que tengas aqui.</p>
        <div className="fila-botones">
          <button className="boton primario" onClick={() => exportar(estado)}>Exportar a archivo</button>
          <button className="boton" onClick={() => archivoRef.current?.click()}>Importar archivo</button>
          <input ref={archivoRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={alImportar} />
          <button className="boton fantasma" onClick={() => { if (confirm('Restablecer los precios de fabrica? No se pierden piezas ni cotizaciones.')) setEstado(restablecerPrecios(estado)); }}>Restablecer precios de fabrica</button>
        </div>
      </div>

      {/* Precios por seccion */}
      {SECCIONES.map((sec) => {
        const insSec = Object.values(estado.insumos).filter((i) => i.seccion === sec.id);
        if (!insSec.length) return null;
        return (
          <div className="tarjeta" key={sec.id}>
            <h3>{sec.nombre}</h3>
            <div className="tablewrap">
            <table className="datos">
              <thead>
                <tr><th>Insumo</th><th>Unidad</th><th className="num">Precio</th><th>Procedencia</th><th>Actualizado</th></tr>
              </thead>
              <tbody>
                {insSec.map((ins) => {
                  const dias = diasDesde(ins.actualizado);
                  const viejo = dias > 90;
                  const fueraRango = ins.precioBase > 0 && (ins.precio > ins.precioBase * 3 || ins.precio < ins.precioBase / 3);
                  const capturado = ins.precio !== ins.precioBase;
                  return (
                    <tr key={ins.id}>
                      <td>
                        {ins.nombre}
                        {fueraRango && <div className="ayuda ambar">unidad correcta? el estimado por {ins.unidad} es {pesos2(ins.precioBase)}</div>}
                      </td>
                      <td>{ins.unidad}</td>
                      <td className="num">
                        <CampoNumero valor={ins.precio} ancho={120} clase={`numero ${capturado ? 'capturado' : ''}`}
                          onCambio={(n) => setPrecio(ins.id, n)} />
                      </td>
                      <td><ChipProcedencia insumo={ins} /></td>
                      <td>{viejo ? <span className="semaforo ambar">{dias} días</span> : <span className="gris">{ins.actualizado}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
