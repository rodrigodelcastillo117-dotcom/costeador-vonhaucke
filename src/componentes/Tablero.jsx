// ============================================================================
//  TABLERO / dashboard (master 7.1)
//  Todo sale de los costeos guardados + parametros. Nada inventado.
// ============================================================================
import { useMemo } from 'react';
import Icono from './Iconos.jsx';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { calcular } from '../motor/calculo.js';
import { pesos, pct1, colorMargen, diasDesde } from '../util.js';

export default function Tablero({ estado, irA, puedeVerDireccion = true, onDireccion }) {
  const h = estado.historial || [];
  const p = estado.parametros;

  const agregado = useMemo(() => {
    const a = { md: 0, mi: 0, mo: 0, ind: 0, desp: 0, costeado: 0, piezas: 0, margen: 0, n: h.length };
    for (const e of h) {
      a.md += e.materialDirecto || 0;
      a.mi += e.materialIndirecto || 0;
      a.mo += e.manoObra || 0;
      a.ind += e.indirectosFabrica || 0;
      a.desp += e.desperdicio || 0;
      a.costeado += (e.costoUnitario || 0) * (e.piezas || 1);
      a.piezas += e.piezas || 1;
      a.margen += e.margen || 0;
    }
    a.margenProm = h.length ? a.margen / h.length : 0;
    a.total = a.md + a.mi + a.mo + a.ind;
    return a;
  }, [h]);

  // Composicion del costo (grafica 1)
  const composicion = agregado.total > 0 ? [{
    name: 'Costo',
    'Material directo': agregado.md,
    'Material indirecto': agregado.mi,
    'Mano de obra': agregado.mo,
    'Indirectos fabrica': agregado.ind,
  }] : [];

  // Desperdicio por material (grafica 2)
  const despPorMat = useMemo(() => {
    const m = {};
    for (const e of h) for (const d of (e.desperdicioPorInsumo || [])) m[d.nombre] = (m[d.nombre] || 0) + d.monto;
    return Object.entries(m).map(([nombre, monto]) => ({ nombre, monto })).sort((a, b) => b.monto - a.monto).slice(0, 8);
  }, [h]);
  const promDesp = despPorMat.length ? despPorMat.reduce((a, d) => a + d.monto, 0) / despPorMat.length : 0;

  // Costo por pieza segun el lote (grafica 3), para la ultima pieza
  const curvaLote = useMemo(() => {
    if (!estado.ultimaPieza) return [];
    const pts = [];
    for (let k = 1; k <= 20; k++) {
      pts.push({ lote: k, costo: Math.round(calcular(estado.ultimaPieza.pieza, k, estado.insumos, estado.parametros).costoUnitario) });
    }
    return pts;
  }, [estado.ultimaPieza, estado.insumos, estado.parametros]);

  // Alertas
  const alertas = [];
  const bajoMargen = h.filter((e) => e.margen < p.margenMinimo);
  if (bajoMargen.length) alertas.push({ tipo: 'roja', texto: `${bajoMargen.length} pieza(s) cotizadas por debajo del margen minimo de ${p.margenMinimo}%.` });
  const viejos = Object.values(estado.insumos).filter((i) => diasDesde(i.actualizado) > 90);
  if (viejos.length) alertas.push({ tipo: 'ambar', texto: `${viejos.length} precios llevan mas de 90 dias sin actualizar.`, accion: () => irA('precios') });
  const fueraRango = Object.values(estado.insumos).filter((i) => i.precioBase > 0 && (i.precio > i.precioBase * 3 || i.precio < i.precioBase / 3));
  if (fueraRango.length) alertas.push({ tipo: 'ambar', texto: `${fueraRango.length} precio(s) fuera de rango: ${fueraRango.slice(0, 3).map((i) => i.nombre).join(', ')}.`, accion: () => irA('precios') });
  alertas.push({ tipo: 'ambar', texto: `La eficiencia de planta sigue en el valor supuesto de ${p.eficienciaReal}%. Confirmala con Produccion.` });

  const COLORES = ['#D02E26', '#B8912F', '#0F766E', '#6B6664'];

  return (
    <div className="contenido">
      {/* Franja de KPIs */}
      <div className="kpis">
        <div className="kpi"><div className="rotulo">Costeado (guardado)</div><div className="cifra">{pesos(agregado.costeado)}</div><div className="pie">{agregado.piezas} piezas · {agregado.n} costeos</div></div>
        <div className="kpi"><div className="rotulo">Margen promedio</div><div className="cifra">{pct1(agregado.margenProm)}</div><div className="pie">de los costeos guardados</div></div>
        <div className="kpi"><div className="rotulo">Desperdicio</div><div className="cifra">{pesos(agregado.desp)}</div><div className="pie">{agregado.total > 0 ? pct1((agregado.desp / agregado.total) * 100) : '0%'} del costo</div></div>
        <div className="kpi"><div className="rotulo">Costo hora de taller</div><div className="cifra">{pesos(p.costoHora)}</div><div className="pie">{p.eficienciaReal}% eficiencia</div></div>
      </div>

      <div className="espacio" />

      {/* Alertas */}
      {alertas.map((a, i) => (
        <div className={`alerta ${a.tipo}`} key={i}>
          <span className="texto">{a.texto}</span>
          {a.accion && <button className="boton" onClick={a.accion}>Abrir</button>}
        </div>
      ))}

      {h.length === 0 && (
        <div className="tarjeta"><p className="ayuda">Aún no hay costeos guardados. Ve al Costeador, calcula una pieza y agrégala a la cotización o guárdala: aquí aparecerán los números.</p></div>
      )}

      {h.length > 0 && (
        <>
          {/* Grafica 1 */}
          <div className="tarjeta">
            <h3>De que se compone el costo</h3>
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={composicion} layout="vertical" stackOffset="expand">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip formatter={(v) => pesos(v)} />
                <Bar dataKey="Material directo" stackId="a" fill="#D02E26" />
                <Bar dataKey="Material indirecto" stackId="a" fill="#e08a86" />
                <Bar dataKey="Mano de obra" stackId="a" fill="#0F766E" />
                <Bar dataKey="Indirectos fabrica" stackId="a" fill="#B8912F" />
              </BarChart>
            </ResponsiveContainer>
            <div className="fila-botones" style={{ gap: 16, fontSize: 14 }}>
              <span><span style={{ color: '#D02E26' }}>■</span> Directo {pct1(agregado.total ? agregado.md / agregado.total * 100 : 0)}</span>
              <span><span style={{ color: '#e08a86' }}>■</span> Indirecto {pct1(agregado.total ? agregado.mi / agregado.total * 100 : 0)}</span>
              <span><span style={{ color: '#0F766E' }}>■</span> Mano de obra {pct1(agregado.total ? agregado.mo / agregado.total * 100 : 0)}</span>
              <span><span style={{ color: '#B8912F' }}>■</span> Indirectos {pct1(agregado.total ? agregado.ind / agregado.total * 100 : 0)}</span>
            </div>
          </div>

          {/* Grafica 2 */}
          {despPorMat.length > 0 && (
            <div className="tarjeta">
              <h3>Desperdicio por material</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={despPorMat} margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tickFormatter={(v) => pesos(v)} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => pesos(v)} />
                  <ReferenceLine y={promDesp} stroke="#6B6664" strokeDasharray="4 4" />
                  <Bar dataKey="monto">{despPorMat.map((_, i) => <Cell key={i} fill="#D02E26" />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Grafica 3 */}
          {curvaLote.length > 0 && (
            <div className="tarjeta">
              <h3>Costo por pieza segun el lote {estado.ultimaPieza?.pieza?.nombre ? '· ' + estado.ultimaPieza.pieza.nombre : ''}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={curvaLote} margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="lote" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => pesos(v)} tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                  <Tooltip formatter={(v) => pesos(v)} labelFormatter={(l) => `Lote de ${l}`} />
                  <Line type="stepAfter" dataKey="costo" stroke="#D02E26" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla ultimas piezas */}
          <div className="tarjeta">
            <h3>Ultimas piezas costeadas</h3>
            <div className="tablewrap"><table className="datos">
              <thead><tr><th>Pieza</th><th>Fecha</th><th className="num">Piezas</th><th className="num">Costo</th><th className="num">Precio</th><th className="num">Margen</th></tr></thead>
              <tbody>
                {h.slice().reverse().slice(0, 12).map((e) => (
                  <tr key={e.id}>
                    <td>{e.nombre}</td><td>{e.fecha}</td><td className="num">{e.piezas}</td>
                    <td className="num">{pesos(e.costoUnitario)}</td><td className="num">{pesos(e.precioUnitario)}</td>
                    <td className="num"><span className={`semaforo ${colorMargen(e.margen)}`}>{pct1(e.margen)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {/* Franja inferior: salud del negocio - SOLO DIRECCION */}
      <div className="tarjeta">
        <h3>La salud del negocio</h3>
        {puedeVerDireccion && estado.finanzas ? (
          <>
            <div className="fila-botones" style={{ gap: 30 }}>
              <div><div className="rotulo gris">Margen bruto del periodo</div><strong className="mono" style={{ fontSize: 22 }}>{pct1(estado.finanzas.margenBruto)}</strong></div>
              <div><div className="rotulo gris">Utilidad de operacion</div><strong className="mono" style={{ fontSize: 22 }}>{pesos(estado.finanzas.utilidadOperacion)}</strong></div>
            </div>
            <p className="ayuda columna-texto" style={{ marginTop: 10 }}>Con la utilidad operativa actual, un error de costeo del 10% se come todo el margen.</p>
            <p className="ayuda ambar">Estos numeros vienen de los estados financieros; hay que confirmar cual documento es el bueno (pregunta 14.2 del master) antes de tomarlos como definitivos.</p>
          </>
        ) : (
          <div className="alerta ambar" style={{ marginTop: 4 }}>
            <Icono nombre="candado" tam={16} />
            <span className="texto">Los números de utilidad e ingresos son solo para Dirección.</span>
            {onDireccion && <button className="boton" onClick={onDireccion}>Soy Dirección</button>}
          </div>
        )}
      </div>
    </div>
  );
}
