// ============================================================================
//  FICHA / COTIZACION EN PDF — elegante, para enviar al cliente.
//  Muestra: mini render del mueble, especificacion, cantidad y precios.
//  Imprime SOLO esta hoja (window.print -> Guardar como PDF).
//  Client-facing: nunca muestra costo de fabricacion, solo precio.
// ============================================================================
import { useEffect } from 'react';
import MarcaLogo from './MarcaLogo.jsx';
import MiniRender, { tipoDeMueble, dimsDeMueble } from './MiniRender.jsx';
import { pesos } from '../util.js';
import { LINEAS } from '../datos/catalogo.js';

// Arma la especificacion legible a partir del costeo (componentes + insumos)
function especificacion(costeo, insumos) {
  const comps = costeo.componentes || [];
  const porSeccion = (secs) =>
    [...new Set(comps
      .filter((c) => secs.includes(insumos[c.insumoId]?.seccion))
      .map((c) => c.nombre || insumos[c.insumoId]?.nombre)
      .filter(Boolean))];

  const material = porSeccion(['cubiertas', 'mamparas']);
  const estructura = porSeccion(['metal']);
  const acabado = porSeccion(['acabados']);

  // Medida principal: la pieza de mayor area con dimensiones
  let medida = '';
  let mayor = 0;
  for (const c of comps) {
    if (c.largoMM && c.anchoMM && c.largoMM * c.anchoMM > mayor) {
      mayor = c.largoMM * c.anchoMM;
      medida = `${(c.largoMM / 1000).toFixed(2)} × ${(c.anchoMM / 1000).toFixed(2)} m`;
    }
  }
  if (!medida && costeo.bench) medida = costeo.benchDescripcion || '';

  // Incluye: lista corta de componentes con cantidad
  const incluye = comps
    .map((c) => {
      const n = c.nombre || insumos[c.insumoId]?.nombre;
      return n ? (c.cantidad > 1 ? `${n} (${c.cantidad})` : n) : null;
    })
    .filter(Boolean)
    .slice(0, 10);

  return { material, estructura, acabado, medida, incluye };
}

export default function FichaPDF({ estado, costeo, cantidad = 1, precioUnitario = 0, onCerrar }) {
  const insumos = estado.insumos;
  const cot = estado.cotizacion || {};
  const spec = especificacion(costeo, insumos);
  const materialesCliente = Array.isArray(costeo.materiales) ? costeo.materiales : [];
  const tipo = tipoDeMueble(costeo);
  const dims = dimsDeMueble(costeo);

  const lineaObj = LINEAS.find((l) => l.nombre === costeo.linea);
  const que = lineaObj?.que && !lineaObj.confirmar ? lineaObj.que : '';

  const importe = precioUnitario * cantidad;
  const ivaPct = estado.parametros?.ivaPorcentaje ?? 16;
  const iva = importe * (ivaPct / 100);
  const total = importe + iva;

  const anticipoPct = estado.parametros?.anticipoPorcentaje ?? 50;

  // Respaldo para Safari <15.4 (sin :has()): marca el body mientras la ficha está abierta.
  useEffect(() => {
    document.body.classList.add('ficha-abierta');
    return () => document.body.classList.remove('ficha-abierta');
  }, []);

  async function imprimir() {
    const prev = document.title;
    document.title = ['Cotización', cot.folio, costeo.nombre || cot.cliente].filter(Boolean).join(' ').trim() || 'Cotización Von Haucke';
    try {
      const imgs = Array.from(document.querySelectorAll('.ficha-pdf img'));
      await Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
    } catch (e) { /* imprimir de todas formas */ }
    window.print();
    setTimeout(() => { document.title = prev; }, 800);
  }

  return (
    <div className="ficha-overlay">
      <div className="ficha-controls no-imprimir">
        <button className="boton primario grande" onClick={imprimir}>Guardar / enviar PDF</button>
        <button className="boton grande" onClick={onCerrar}>Cerrar</button>
      </div>

      <div className="ficha-pdf">
        {/* Encabezado de marca */}
        <header className="ficha-head">
          <div className="ficha-marca">
            <div>
              <MarcaLogo alto={44} />
              <div className="ficha-tag" style={{ marginTop: 6 }}>Mobiliario de oficina · Más de 68 años (desde 1958)</div>
            </div>
          </div>
          <div className="ficha-doc">
            <div className="ficha-doc-t">COTIZACIÓN</div>
            {cot.folio && <div className="ficha-doc-l">Folio <b>{cot.folio}</b></div>}
            {cot.fecha && <div className="ficha-doc-l">Fecha <b>{cot.fecha}</b></div>}
          </div>
        </header>

        <div className="ficha-cliente">
          <span><span className="ficha-k">Cliente</span> {cot.cliente || '—'}</span>
          <span><span className="ficha-k">Vigencia</span> 15 días hábiles</span>
        </div>

        {/* Producto: imagen del cliente (si subió render) o render isométrico + especificacion */}
        <section className="ficha-producto">
          <div className={'ficha-render' + (costeo.imagen ? ' ficha-render-foto' : '')}>
            {costeo.imagen
              ? <img src={costeo.imagen} alt={costeo.nombre || 'Mueble'} className="ficha-foto" />
              : <MiniRender tipo={tipo} w={dims.w} d={dims.d} />}
          </div>
          <div className="ficha-info">
            {costeo.linea && <div className="ficha-linea">Línea {costeo.linea}</div>}
            <h1 className="ficha-nombre">{costeo.nombre || 'Mueble a la medida'}</h1>
            {(costeo.descripcionCliente || que) && <p className="ficha-que">{costeo.descripcionCliente || que}</p>}

            <dl className="ficha-spec">
              {spec.medida && (<><dt>Medidas</dt><dd>{spec.medida}</dd></>)}
              {materialesCliente.length > 0 && (<><dt>Materiales</dt><dd>{materialesCliente.join(' · ')}</dd></>)}
              {!costeo.descripcionCliente && spec.material.length > 0 && (<><dt>Cubiertas</dt><dd>{spec.material.join(', ')}</dd></>)}
              {!costeo.descripcionCliente && spec.estructura.length > 0 && (<><dt>Estructura</dt><dd>{spec.estructura.join(', ')}</dd></>)}
              {spec.acabado.length > 0 && (<><dt>Acabado</dt><dd>{spec.acabado.join(', ')}</dd></>)}
            </dl>
          </div>
        </section>

        {/* Precio */}
        <section className="ficha-precio">
          <table className="ficha-tabla">
            <thead>
              <tr><th>Concepto</th><th className="num">Cantidad</th><th className="num">Precio unitario</th><th className="num">Importe</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>{costeo.nombre || 'Mueble a la medida'}</td>
                <td className="num">{cantidad}</td>
                <td className="num">{pesos(precioUnitario)}</td>
                <td className="num">{pesos(importe)}</td>
              </tr>
            </tbody>
          </table>
          <div className="ficha-totales">
            <div><span>Subtotal</span><b>{pesos(importe)}</b></div>
            <div><span>IVA {ivaPct}%</span><b>{pesos(iva)}</b></div>
            <div className="ficha-total"><span>Total</span><b>{pesos(total)}</b></div>
          </div>
        </section>

        {/* Condiciones */}
        <section className="ficha-cond">
          <b>Condiciones:</b> Anticipo {anticipoPct}% y {100 - anticipoPct}% contra aviso de entrega.
          Flete en CDMX y área metropolitana 3%; foráneo se cotiza por evento. Maniobras e instalación por separado. Precios sujetos a cambio sin previo aviso.
          Madera natural, mármol, telas y cristales pueden variar de tono y veta.
        </section>

        <footer className="ficha-foot">
          <span>APARATOS ELECTROMECÁNICOS VON HAUCKE, S.A. de C.V.</span>
          <span>Tel. (55) 5999 9200 · www.vonhaucke.mx</span>
        </footer>
      </div>
    </div>
  );
}
