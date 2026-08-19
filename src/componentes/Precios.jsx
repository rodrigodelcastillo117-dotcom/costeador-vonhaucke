// ============================================================================
//  PRECIOS - precios de insumos, calculadora de costo hora y parametros (7.5)
// ============================================================================
import { useRef } from 'react';
import { SECCIONES } from '../datos/insumos.js';
import { calcularCostoHora } from '../motor/calculo.js';
import Icono from './Iconos.jsx';
import { exportar, importar, restablecerPrecios } from '../almacen.js';
import { pesos2, pct, diasDesde } from '../util.js';

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
          <input type="number" className="numero" value={p.nominaSemanalDirecta} onChange={(e) => setParam('nominaSemanalDirecta', parseFloat(e.target.value) || 0)} />
        </div>
        <div className="renglon-insumo">
          <span className="nom">Operativos en planta</span>
          <input type="number" className="numero" value={p.operativos} onChange={(e) => setParam('operativos', parseInt(e.target.value) || 1)} />
        </div>
        <div className="renglon-insumo">
          <span className="nom">Horas por semana</span>
          <input type="number" className="numero" value={p.jornadaSemanal} onChange={(e) => setParam('jornadaSemanal', parseFloat(e.target.value) || 1)} />
        </div>
        <div className="renglon-insumo">
          <span className="nom">Eficiencia real <span className="etiqueta-dato supuesto">valor supuesto</span></span>
          <input type="number" className="numero" value={p.eficienciaReal} onChange={(e) => setParam('eficienciaReal', parseFloat(e.target.value) || 1)} />
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
            <input type="number" className="numero" value={p.factorIndirectosFabrica} onChange={(e) => setParam('factorIndirectosFabrica', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="etiqueta">Margen minimo (%)</label>
            <input type="number" className="numero" value={p.margenMinimo} onChange={(e) => setParam('margenMinimo', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="etiqueta">Margen de lista (% sobre precio)</label>
            <input type="number" className="numero" value={p.margenObjetivo ?? 50} onChange={(e) => setParam('margenObjetivo', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="etiqueta">Mínimo de línea (% utilidad sobre costo)</label>
            <input type="number" className="numero" value={p.minMarkupLinea ?? 45} onChange={(e) => setParam('minMarkupLinea', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="etiqueta">Anticipo (%)</label>
            <input type="number" className="numero" value={p.anticipoPorcentaje ?? 50} onChange={(e) => setParam('anticipoPorcentaje', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="etiqueta">Factor mano de obra directa (%)</label>
            <input type="number" className="numero" value={p.factorManoObraDirecta} onChange={(e) => setParam('factorManoObraDirecta', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="etiqueta">Factor mano de obra indirecta (%)</label>
            <input type="number" className="numero" value={p.factorManoObraIndirecta} onChange={(e) => setParam('factorManoObraIndirecta', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="etiqueta">Aprovechamiento de hoja (%)</label>
            <input type="number" className="numero" value={p.aprovechamientoCorte ?? 80} onChange={(e) => setParam('aprovechamientoCorte', parseFloat(e.target.value) || 1)} />
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
                <tr><th>Insumo</th><th>Unidad</th><th className="num">Precio</th><th>Actualizado</th></tr>
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
                        <input type="number" className={`numero ${capturado ? 'capturado' : ''}`} style={{ maxWidth: 120 }}
                          value={ins.precio} onChange={(e) => setPrecio(ins.id, parseFloat(e.target.value) || 0)} />
                      </td>
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
