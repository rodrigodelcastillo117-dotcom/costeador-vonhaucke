// ============================================================================
//  ASISTENTE - cotizar un mueble, una pregunta por pantalla.
//  Botones grandes, lenguaje de taller, imposible perderse.
// ============================================================================
import { useMemo, useState } from 'react';
import { FAMILIAS, MUEBLES, lineasDeMueble } from '../datos/catalogo.js';
import Icono from './Iconos.jsx';
import { construirCosteo } from '../recetas.js';
import { recetaBench } from '../datos/bench.js';
import { calcular, precioDe } from '../motor/calculo.js';
import { pesos } from '../util.js';
import HojaCosto from './HojaCosto.jsx';
import FichaPDF from './FichaPDF.jsx';

const PASOS = ['familia', 'mueble', 'opcion', 'cantidad', 'precio', 'listo'];
const GANAR = [
  { nombre: 'Poco', v: 20 },
  { nombre: 'Normal', v: 30 },
  { nombre: 'Bueno', v: 40 },
  { nombre: 'Mucho', v: 50 },
];

function piezaDe(c) {
  return {
    nombre: c.nombre, componentes: c.componentes, horas: c.horas, modoManoObra: c.modoManoObra,
    factorDirecta: c.factorDirecta, factorIndirecta: c.factorIndirecta, preparacionHoras: c.preparacionHoras,
  };
}

export default function Asistente({ estado, onAgregarPartida, onModoAvanzado, onIr, soloVentas = false }) {
  const margenObjetivo = estado.parametros.margenObjetivo ?? 40;
  const [paso, setPaso] = useState('familia');
  const [familia, setFamilia] = useState(null);
  const [mueble, setMueble] = useState(null);
  const [costeo, setCosteo] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [margen, setMargen] = useState(margenObjetivo);
  const [verDetalle, setVerDetalle] = useState(false);
  const [avisoOpcion, setAvisoOpcion] = useState('');
  const [fichaAbierta, setFichaAbierta] = useState(false);
  // Vendedores: precio recomendado fijo al margen objetivo, sin ver costo ni escoger margen.
  const margenEfectivo = soloVentas ? margenObjetivo : margen;

  const idx = PASOS.indexOf(paso);

  // Precio de venta de cada linea, para el paso "opcion"
  const opciones = useMemo(() => {
    if (!mueble) return [];
    const lineas = lineasDeMueble(mueble);
    const conPrecio = lineas.map((l) => {
      const c = construirCosteo(l, mueble, estado);
      const tieneReceta = c.componentes.length > 0;
      const r = tieneReceta ? calcular(piezaDe(c), 1, estado.insumos, estado.parametros) : null;
      return { linea: l, costeo: c, precio: r ? precioDe(r.costoUnitario, margenObjetivo) : null, tieneReceta };
    });
    conPrecio.sort((a, b) => {
      if (a.precio != null && b.precio != null) return a.precio - b.precio;
      if (a.precio != null) return -1;
      if (b.precio != null) return 1;
      return a.linea.gama - b.linea.gama;
    });
    return conPrecio;
  }, [mueble, estado.insumos, estado.parametros]);

  // Resultado del costeo actual
  const resultado = useMemo(() => {
    if (!costeo) return null;
    return calcular(piezaDe(costeo), cantidad, estado.insumos, estado.parametros);
  }, [costeo, cantidad, estado.insumos, estado.parametros]);
  const precio = resultado ? precioDe(resultado.costoUnitario, margenEfectivo) : 0;

  function escogerFamilia(f) { setFamilia(f); setPaso('mueble'); setAvisoOpcion(''); }
  function escogerMueble(m) { setMueble(m); setPaso('opcion'); setAvisoOpcion(''); }
  function escogerOpcion(o) {
    if (!o.tieneReceta) {
      setAvisoOpcion(`La línea ${o.linea.nombre} todavía no tiene su receta cargada, por eso no puedo darte el precio. Escoge otra línea, o pídele a Dirección que la arme en Modo avanzado.`);
      return;
    }
    setAvisoOpcion('');
    setCosteo(o.costeo); setCantidad(1); setPaso('cantidad');
  }

  function cambiarPersonas(n) {
    const personas = Math.max(2, n);
    const b = recetaBench({ ...costeo.bench, personas });
    setCosteo({ ...costeo, bench: { ...costeo.bench, personas }, benchDescripcion: b.descripcion, componentes: b.componentes, horas: b.horas, nombre: `${costeo.linea} — Bench ${personas} usuarios` });
  }

  function atras() {
    const orden = ['familia', 'mueble', 'opcion', 'cantidad', 'precio'];
    const i = orden.indexOf(paso);
    if (i <= 0) { onIr('inicio'); return; }
    setPaso(orden[i - 1]);
  }

  function agregar() {
    onAgregarPartida(costeo, cantidad, precio, margenEfectivo);
    setPaso('listo');
  }

  function empezarDeNuevo() {
    setFamilia(null); setMueble(null); setCosteo(null); setCantidad(1); setMargen(30); setVerDetalle(false); setPaso('familia');
  }

  const esBench = !!costeo?.bench;

  return (
    <div className="asistente">
      {paso !== 'listo' && (
        <button className="boton fantasma" style={{ marginBottom: 10 }} onClick={atras}>‹ Atrás</button>
      )}

      {paso !== 'listo' && (
        <div className="progreso">
          {['familia', 'mueble', 'opcion', 'cantidad', 'precio'].map((p, i) => (
            <span key={p} className={`punto ${i <= idx ? 'activo' : ''}`} />
          ))}
        </div>
      )}

      {/* PASO 1: familia */}
      {paso === 'familia' && (
        <>
          <div className="pregunta">¿Qué tipo de mueble?</div>
          <div className="pregunta-sub">Escoge el grupo. Luego el mueble exacto.</div>
          <div className="opciones-grandes">
            {FAMILIAS.map((f) => (
              <button key={f.id} className="opcion-grande" onClick={() => escogerFamilia(f)}>
                {f.nombre}<span className="flecha">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* PASO 2: mueble */}
      {paso === 'mueble' && familia && (
        <>
          <div className="pregunta">¿Cuál mueble?</div>
          <div className="pregunta-sub">De {familia.nombre.toLowerCase()}.</div>
          <div className="opciones-grandes">
            {familia.muebles.map((m) => (
              <button key={m} className="opcion-grande" onClick={() => escogerMueble(m)}>
                {MUEBLES[m]}<span className="flecha">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* PASO 3: opcion (linea) */}
      {paso === 'opcion' && (
        <>
          <div className="pregunta">¿De qué línea?</div>
          <div className="pregunta-sub">La más barata sale primero. El precio ya es de venta.</div>
          {avisoOpcion && <div className="alerta ambar" style={{ marginBottom: 12 }}><span className="texto">{avisoOpcion}</span></div>}
          <div className="opciones-grandes">
            {opciones.map((o, i) => (
              <button key={o.linea.id} className="opcion-grande" onClick={() => escogerOpcion(o)}
                style={o.tieneReceta ? undefined : { opacity: 0.55 }}>
                <span>
                  {o.linea.nombre}
                  {i === 0 && o.tieneReceta && <span className="etiqueta-verde" style={{ marginLeft: 8 }}>MÁS BARATA</span>}
                </span>
                <span className="precio-lado" style={{ fontSize: o.tieneReceta ? undefined : 14, fontFamily: 'var(--sans)', fontWeight: 400, color: 'var(--gris)' }}>
                  {o.tieneReceta ? pesos(o.precio) : 'aún sin receta'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* PASO 4: cantidad (o personas si es bench) */}
      {paso === 'cantidad' && costeo && (
        <>
          <div className="pregunta">{esBench ? '¿Para cuántas personas?' : '¿Cuántas piezas vas a hacer?'}</div>
          <div className="pregunta-sub">{esBench ? 'El bench siempre es en par.' : 'Entre más hagas, más barata sale cada una.'}</div>
          <div className="masmenos gigante" style={{ justifyContent: 'center', margin: '30px 0' }}>
            {esBench ? (
              <>
                <button onClick={() => cambiarPersonas(costeo.bench.personas - 2)}>−</button>
                <span className="valor">{costeo.bench.personas}</span>
                <button onClick={() => cambiarPersonas(costeo.bench.personas + 2)}>+</button>
              </>
            ) : (
              <>
                <button onClick={() => setCantidad(Math.max(1, cantidad - 1))}>−</button>
                <span className="valor">{cantidad}</span>
                <button onClick={() => setCantidad(cantidad + 1)}>+</button>
              </>
            )}
          </div>
          {esBench && <p className="ayuda columna-texto" style={{ textAlign: 'center' }}>{costeo.benchDescripcion}</p>}
          <button className="boton primario grande" onClick={() => setPaso('precio')}>Ver el precio ›</button>
        </>
      )}

      {/* PASO 5: precio */}
      {paso === 'precio' && resultado && (
        <>
          <div className="pregunta">El precio</div>
          {soloVentas ? (
            <div className="pregunta-sub">Este es el <strong>precio recomendado</strong> para esta pieza.</div>
          ) : (
            <div className="pregunta-sub">Cuesta hacer 1 pieza: <strong className="mono">{pesos(resultado.costoUnitario)}</strong>. Ahora dime cuánto quieres ganar.</div>
          )}

          {!soloVentas && (
            <div className="ganar-botones" style={{ marginBottom: 18 }}>
              {GANAR.map((g) => (
                <button key={g.v} className={margen === g.v ? 'on' : ''} onClick={() => setMargen(g.v)}>{g.nombre}</button>
              ))}
            </div>
          )}

          <div className="tarjeta-precio">
            <div className="ayuda" style={{ marginBottom: 6 }}>{soloVentas ? 'Precio recomendado por pieza' : 'Precio de venta por pieza'}</div>
            <div className="precio-enorme">{pesos(precio)}</div>
            {cantidad > 1 && <div className="ayuda" style={{ marginTop: 8 }}>{cantidad} piezas = {pesos(precio * cantidad)}</div>}
          </div>

          {!soloVentas && (
            <>
              <div style={{ textAlign: 'center', margin: '16px 0' }}>
                <button className="boton fantasma" onClick={() => setVerDetalle((v) => !v)}>{verDetalle ? 'Ocultar el detalle' : 'Ver el detalle de dónde sale'}</button>
              </div>
              {verDetalle && <HojaCosto resultado={resultado} insumos={estado.insumos} pieza={piezaDe(costeo)} parametros={estado.parametros} />}
            </>
          )}

          <div className="espacio" />
          <button className="boton primario grande" onClick={agregar}>Agregar a la cotización</button>
          <div className="espacio" />
          <button className="boton grande" onClick={() => setFichaAbierta(true)}>Ver ficha PDF</button>
        </>
      )}

      {fichaAbierta && costeo && (
        <FichaPDF estado={estado} costeo={costeo} cantidad={cantidad} precioUnitario={precio} onCerrar={() => setFichaAbierta(false)} />
      )}

      {/* PASO 6: listo */}
      {paso === 'listo' && (
        <div className="exito">
          <div className="palomita" style={{ color: 'var(--verde)' }}><Icono nombre="check" tam={44} grosor={2.4} /></div>
          <div className="pregunta" style={{ marginTop: 8 }}>¡Listo!</div>
          <div className="pregunta-sub">Se agregó a tu cotización a {pesos(precio)} por pieza.</div>
          <div className="fila-botones" style={{ justifyContent: 'center' }}>
            <button className="boton primario" onClick={empezarDeNuevo}>Cotizar otro mueble</button>
            <button className="boton" onClick={() => onIr('cotizacion')}>Ver mis cotizaciones</button>
            <button className="boton fantasma" onClick={() => onIr('inicio')}>Ir al inicio</button>
          </div>
        </div>
      )}
    </div>
  );
}
