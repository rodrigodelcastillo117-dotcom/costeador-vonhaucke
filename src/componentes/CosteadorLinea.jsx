// ============================================================================
//  COSTEADOR DE LÍNEA (paramétrico, genérico) — una sola pantalla para TODAS
//  las líneas. Recibe {titulo, productos, generar}. Escoges producto + medida
//  + opciones y el generador de la línea arma el despiece con su guía oficial.
//  Data-driven: agregar una línea nueva es solo pasar sus datos + generador.
// ============================================================================
import { useMemo, useState } from 'react';
import { calcular, precioDe, precioVenta } from '../motor/calculo.js';
import { pesos } from '../util.js';
import { imagenProducto, fichaRender } from '../datos/imagenes.js';
import { footprintDe } from '../datos/lineas.js';
import { buscarPrecioVenta, costoImplicito, precioDeLista } from '../datos/preciosVenta.js';
import { factorDeLinea } from '../datos/factoresLinea.js';
import { precioPorUsuarioAppLT } from '../datos/preciosVenta.js';
import HojaCosto from './HojaCosto.jsx';
import FichaPDF from './FichaPDF.jsx';

export default function CosteadorLinea({ estado, titulo, productos, generar, onAgregar, onAgregarModulo, linea, soloVentas = false, onIr }) {
  const [prodId, setProdId] = useState(productos[0].id);
  const prod = productos.find((p) => p.id === prodId) || productos[0];
  const foto = imagenProducto(linea, prodId);
  const fichaMed = fichaRender(linea, prodId);   // medidas del render de referencia

  const [largo, setLargo] = useState(prod.largos?.[1] || prod.largos?.[0] || 1500);
  const [fondo, setFondo] = useState(prod.fondos?.[0] || 600);
  const [diametro, setDiametro] = useState(prod.diametros?.[0] || 1200);
  const [usuarios, setUsuarios] = useState(prod.usuarios?.[0] || 4);
  const [largoLateral, setLargoLateral] = useState(prod.largosLateral?.[0] || 1050);
  const [biombo, setBiombo] = useState(null);
  const [finish, setFinish] = useState('ABS');
  const [checks, setChecks] = useState({});
  const [gavetas, setGavetas] = useState(0);
  const defSels = (p) => Object.fromEntries((p.selects || []).map((s) => [s.key, s.opciones[0].id]));
  const [sels, setSels] = useState(() => defSels(productos[0]));
  const [cantidad, setCantidad] = useState(1);
  const [ficha, setFicha] = useState(false);
  const [ultimo, setUltimo] = useState('');   // último mueble agregado (confirmación en la misma pantalla)
  const nEnCot = estado.cotizacion?.partidas?.length || 0;
  const margen = estado.parametros.margenObjetivo ?? 50;
  const esAppLT = linea === 'applt';

  function elegirProducto(id) {
    const p = productos.find((x) => x.id === id);
    setProdId(id);
    if (p.largos) setLargo(p.largos[1] || p.largos[0]);
    if (p.fondos) setFondo(p.fondos[0]);
    if (p.diametros) setDiametro(p.diametros[0]);
    if (p.usuarios) setUsuarios(p.usuarios[0]);
    if (p.largosLateral) setLargoLateral(p.largosLateral[0]);
    setBiombo(null); setChecks({}); setSels(defSels(p)); setGavetas(0);
  }

  const config = { producto: prodId, largoMM: largo, fondoMM: fondo, diametroMM: diametro, usuarios, largoLateralMM: largoLateral, biombo, finish, gavetas, ...sels, ...checks };
  const g = useMemo(() => generar(config), [prodId, largo, fondo, diametro, usuarios, largoLateral, biombo, finish, gavetas, sels, checks]);
  // Modelo de costeo: si el generador lo declara 'intelisis' (App LT), usa la cascada
  // real (tarifas de planta + precioVenta lista); si no, el clásico (margen sobre precio).
  const esIntelisis = g.modeloCosteo === 'intelisis';
  const par = useMemo(() => (esIntelisis ? { ...estado.parametros, modeloCosteo: 'intelisis', usarCostoPorArea: true, ...(g.parModelo || {}) } : estado.parametros), [esIntelisis, estado.parametros, g.parModelo]);
  const pieza = { nombre: g.nombre, componentes: g.componentes, horas: g.horas, modoManoObra: g.modoManoObra, modeloCosteo: g.modeloCosteo, factorDirecta: g.factorDirecta, factorIndirecta: g.factorIndirecta };
  const resultado = useMemo(() => calcular(pieza, cantidad, estado.insumos, par), [g, cantidad, estado.insumos, par]);
  // Von Haucke nunca cotiza el "precio 2": siempre lleva −40% para llegar al
  // precio de lista. Aplica al modelo Intelisis y al price-book; el modelo
  // clásico ya sale de costo × margen y no pasa por ahí.
  const precioModelo = esIntelisis ? precioDeLista(precioVenta(resultado.costoUnitario, par).lista) : precioDe(resultado.costoUnitario, margen);
  // Precio de venta REAL (price-book) si existe esta config; si no, el modelo.
  // 🐛 2026-08-16: a esta lista de dependencias le faltaban `sels` y `checks`, y
  // eso se ve nada más ejercitando la pantalla. Al marcar "Biombos laterales" el
  // DESPIECE sí cambiaba (su useMemo sí las trae) pero el precio se quedaba
  // congelado en el estimado del modelo y NUNCA pegaba con el precio real del
  // presupuesto. Cualquier opción que viva en un select o en una casilla —
  // laterales, divisores, el modelo de archivero Modulor, los frentes de la
  // gaveta Mox— tiene que estar aquí o su ancla de papel es inalcanzable en vivo.
  const real = useMemo(() => buscarPrecioVenta(linea, config), [linea, prodId, largo, fondo, usuarios, biombo, sels, checks]);
  const factor = (g.factorPrecio || 1) * factorDeLinea(linea, prodId);
  // Las bancas App LT se cobran POR USUARIO (Rodrigo, 2026-08-16): la escalera
  // sale de presupuestos cerrados y manda sobre el modelo, que venía ~20%
  // arriba. Si hay precio REAL de esta configuración exacta, ése sigue mandando.
  const porUsuario = !real && linea === 'applt' ? precioPorUsuarioAppLT(config) : null;
  const precio = real ? precioDeLista(real.lista) : (porUsuario ? porUsuario.lista : precioModelo * factor);
  const costoModulo = real ? costoImplicito(real.lista)
    : (porUsuario ? costoImplicito(porUsuario.lista / (1 - 0.40)) : resultado.costoUnitario * factor);
  // Add-ons: si el módulo real YA incluye eléctrico, no lo cobres otra vez.
  const addons = (g.addons || []).filter((a) => !(real?.incluyeElectrico && a.id === 'electrico'));
  const totalAddons = addons.reduce((s, a) => s + precioDeLista(a.lista) * (a.cantidad || 1), 0);
  const fp = footprintDe(g.componentes, g.nombre);
  // `precioReal` y `config` viajan con el costeo: el sello de la propuesta y el
  // botón de editar dependen de ellos. Sin esto, un módulo agregado desde aquí
  // salía como "Estimado" aunque su precio viniera de un presupuesto cerrado.
  const costeoObj = { ...pieza, piezaId: `linea-${prodId}`, linea: titulo, ruta: linea, productoId: prodId, w: fp.w, d: fp.d, nombre: g.nombre, piezas: cantidad, precioReal: !!real, config };
  function agregar() {
    if (onAgregarModulo && (esIntelisis || addons.length || real)) onAgregarModulo(costeoObj, cantidad, precio, real ? null : (esIntelisis ? null : margen), costoModulo, addons);
    else onAgregar(costeoObj, cantidad, precio, margen);
    setCantidad(1);
    setUltimo(g.nombre);
  }

  const Chips = ({ opciones, valor, set, fmt }) => (
    <div className="chips" style={{ marginBottom: 12 }}>
      {opciones.map((o) => <button key={o} className={`chip ${valor === o ? 'on' : ''}`} onClick={() => set(o)}>{fmt ? fmt(o) : o}</button>)}
    </div>
  );

  return (
    <div className="dos-col-costeo">
      {/* IZQUIERDA */}
      <div>
        <div className="tarjeta">
          <h2>{titulo}</h2>
          <p className="ayuda columna-texto">Escoge el producto y la medida. El sistema arma el despiece con la guía oficial y te da el costo real.</p>
          <label className="etiqueta">Producto</label>
          <div className="chips" style={{ marginBottom: 14 }}>
            {productos.map((p) => <button key={p.id} className={`chip ${prodId === p.id ? 'on' : ''}`} onClick={() => elegirProducto(p.id)}>{p.nombre}</button>)}
          </div>
          {foto && (
            <>
              <div className="linea-foto" style={{ backgroundImage: `url(${foto})` }} role="img" aria-label={prod.nombre}>
                <span className="linea-foto-tag">{prod.nombre}</span>
              </div>
              {fichaMed && (
                <div className="ayuda gris foto-pie">
                  Imagen de referencia · {fichaMed.medidas}. Tu configuración de arriba manda en el precio.
                </div>
              )}
            </>
          )}
          {prod.largos && (<><label className="etiqueta">Largo</label><Chips opciones={prod.largos} valor={largo} set={setLargo} fmt={(o) => (o / 1000).toFixed(2) + ' m'} /></>)}
          {prod.fondos && prod.fondos.length > 1 && (<><label className="etiqueta">Fondo</label><Chips opciones={prod.fondos} valor={fondo} set={setFondo} fmt={(o) => (o / 1000).toFixed(2) + ' m'} /></>)}
          {prod.largosLateral && (<><label className="etiqueta">Retorno (lateral)</label><Chips opciones={prod.largosLateral} valor={largoLateral} set={setLargoLateral} fmt={(o) => (o / 1000).toFixed(2) + ' m'} /></>)}
          {prod.diametros && (<><label className="etiqueta">Diámetro</label><Chips opciones={prod.diametros} valor={diametro} set={setDiametro} fmt={(o) => 'Ø ' + (o / 1000).toFixed(2) + ' m'} /></>)}
          {prod.usuarios && (<><label className="etiqueta">Usuarios</label><Chips opciones={prod.usuarios} valor={usuarios} set={setUsuarios} /></>)}
          {(prod.selects || []).map((s) => (
            <div key={s.key}>
              <label className="etiqueta">{s.label}</label>
              <div className="chips" style={{ marginBottom: 12 }}>
                {s.opciones.map((o) => <button key={o.id} className={`chip ${sels[s.key] === o.id ? 'on' : ''}`} onClick={() => setSels((v) => ({ ...v, [s.key]: o.id }))}>{o.label}</button>)}
              </div>
            </div>
          ))}
        </div>

        {(prod.biombo || prod.finishes || (prod.checks && prod.checks.length > 0)) && (
          <div className="tarjeta">
            <h3>Opciones</h3>
            {prod.finishes && (
              <>
                <label className="etiqueta">Acabado</label>
                <div className="chips" style={{ marginBottom: 8 }}>
                  {prod.finishes.map((f) => <button key={f.id} className={`chip ${finish === f.id ? 'on' : ''}`} onClick={() => setFinish(f.id)}>{f.label}</button>)}
                </div>
              </>
            )}
            {prod.biombo && (
              <>
                <label className="etiqueta">Biombo</label>
                <div className="chips" style={{ marginBottom: 8 }}>
                  <button className={`chip ${!biombo ? 'on' : ''}`} onClick={() => setBiombo(null)}>Sin biombo</button>
                  {esAppLT && <button className={`chip ${biombo === 'pet' ? 'on' : ''}`} onClick={() => setBiombo('pet')}>PET acústico 9mm</button>}
                  <button className={`chip ${biombo === 'cristal' ? 'on' : ''}`} onClick={() => setBiombo('cristal')}>Cristal 6mm</button>
                  <button className={`chip ${biombo === 'melamina' ? 'on' : ''}`} onClick={() => setBiombo('melamina')}>Melamina 9mm</button>
                </div>
              </>
            )}
            {(prod.checks || []).map((ch) => (
              <label className="check" key={ch.key}><input type="checkbox" checked={!!checks[ch.key]} onChange={(e) => setChecks((s) => ({ ...s, [ch.key]: e.target.checked }))} /> {ch.label}</label>
            ))}
          </div>
        )}

        {esAppLT && (
          <div className="tarjeta">
            <h3>Complementos (partidas aparte)</h3>
            <p className="ayuda" style={{ marginTop: -4, marginBottom: 8 }}>Se cotizan como renglones separados, a precio de lista real — igual que en tus presupuestos.</p>
            <label className="etiqueta">Gavetas rodantes MOX</label>
            <span className="masmenos" style={{ display: 'inline-flex', marginBottom: 4 }}>
              <button style={{ width: 46, height: 46 }} onClick={() => setGavetas((n) => Math.max(0, n - 1))}>−</button>
              <span className="valor" style={{ minWidth: '2ch' }}>{gavetas}</span>
              <button style={{ width: 46, height: 46 }} onClick={() => setGavetas((n) => Math.min(20, n + 1))}>+</button>
            </span>
          </div>
        )}
      </div>

      {/* DERECHA */}
      <div className="pegado">
        {!soloVentas && (
        <div className="tarjeta">
          <h3 style={{ marginBottom: 4 }}>{g.nombre}</h3>
          {g.claves?.length > 0 && <div className="ayuda" style={{ marginBottom: 10 }}>Claves: <span className="mono">{g.claves.join(' · ')}</span></div>}
          <div className="tablewrap">
            <table className="datos">
              <thead><tr><th>Componente</th><th className="num">Cantidad</th></tr></thead>
              <tbody>
                {g.componentes.map((c, i) => {
                  const ins = estado.insumos[c.insumoId];
                  return (
                    <tr key={i}>
                      <td>{c.nombre}{c.largoMM ? <span className="gris"> · {c.largoMM}×{c.anchoMM} mm</span> : ''}</td>
                      <td className="num">{c.cantidad.toFixed(2)} {ins?.unidad}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {g.electricos?.length > 0 && <div className="ayuda" style={{ marginTop: 8 }}>Eléctrico (aparte): {g.electricos.join(' · ')}</div>}
          <div className="ayuda gris" style={{ marginTop: 8, fontSize: 11 }}>{g.nota}</div>
        </div>
        )}

        {!soloVentas && <HojaCosto resultado={resultado} insumos={estado.insumos} pieza={pieza} parametros={par} />}

        <div className="tarjeta roja" style={{ marginTop: 14 }}>
          <div className="fila" style={{ alignItems: 'center' }}>
            <label className="etiqueta" style={{ margin: 0 }}>Cantidad</label>
            <span className="masmenos" style={{ marginLeft: 'auto' }}>
              <button style={{ width: 48, height: 48, fontSize: 20 }} onClick={() => setCantidad((n) => Math.max(1, n - 1))}>−</button>
              <span className="valor" style={{ fontSize: 18, minWidth: '2ch' }}>{cantidad}</span>
              <button style={{ width: 48, height: 48, fontSize: 20 }} onClick={() => setCantidad((n) => n + 1)}>+</button>
            </span>
          </div>
          <div className="precio-grande" style={{ marginTop: 8 }}>{pesos(precio)}</div>
          {real ? (
            <>
              <div className="ayuda" style={{ color: 'var(--verde)', fontWeight: 600 }}>Precio de lista real · presupuesto {real.fuente}</div>
              {/* Qué trae ese precio adentro. La mesa de juntas 2.40 real YA
                  incluye 2 cajas eléctricas: sin decirlo, el vendedor la cotiza
                  para una sala sin electrificar y cobra ~19% de más. */}
              {real.nota && <div className="ayuda ambar-txt" style={{ color: '#9a6a00', fontWeight: 600 }}>Ojo: {real.nota}</div>}
            </>
          ) : (
            <div className="ayuda" style={{ color: '#9a6a00' }}>≈ Estimado por el modelo{esIntelisis ? ' (Intelisis)' : ''} — aún sin precio real de esta config</div>
          )}
          <div className="ayuda gris" style={{ fontSize: 11 }}>
            {soloVentas
              ? <>Éste es el <strong>precio de venta</strong>. El descuento de proyecto se aplica al final, en la cotización.</>
              : <>Precio de lista (el precio 2 ya lleva su 40%); el descuento de proyecto va aparte. Costo: <strong className="mono">{pesos(costoModulo)}</strong></>}
          </div>
          {addons.length > 0 && (
            <div style={{ marginTop: 10, borderTop: '1px solid rgba(0,0,0,.1)', paddingTop: 8 }}>
              {addons.map((a) => (
                <div className="fila" key={a.id} style={{ justifyContent: 'space-between', fontSize: 13 }}>
                  <span>+ {a.nombre}{a.cantidad > 1 ? ` ×${a.cantidad}` : ''}</span>
                  <span className="mono">{pesos(precioDeLista(a.lista) * (a.cantidad || 1))}</span>
                </div>
              ))}
              <div className="fila" style={{ justifyContent: 'space-between', fontWeight: 700, marginTop: 6 }}>
                <span>Total módulo{cantidad > 1 ? ` × ${cantidad}` : ''}</span>
                <span className="mono">{pesos((precio + totalAddons) * cantidad)}</span>
              </div>
            </div>
          )}
          <div className="espacio" />
          <button className="boton primario grande" onClick={agregar}>Agregar a la cotización</button>
          {ultimo && (
            <div className="agregado-ok">
              <span className="texto">Agregado: {ultimo}. Puedes seguir escogiendo y se van sumando.</span>
              {onIr && <button className="boton" style={{ minHeight: 44, marginTop: 8, width: '100%' }} onClick={() => onIr('cotizacion')}>Ver mi cotización ({nEnCot})</button>}
            </div>
          )}
          <div className="espacio" />
          <button className="boton fantasma grande" onClick={() => setFicha(true)}>Ver ficha PDF</button>
        </div>
      </div>

      {/* Barra fija (celular): precio + cantidad + agregar, sin bajar la página */}
      <div className="barra-compra no-imprimir">
        <div className="bc-precio">
          <span className="bc-monto">{pesos((precio + totalAddons) * cantidad)}</span>
          <span className="bc-nota">{real ? 'Precio de lista real' : 'Precio estimado'}</span>
        </div>
        <span className="masmenos bc-mm">
          <button onClick={() => setCantidad((n) => Math.max(1, n - 1))} aria-label="Menos">−</button>
          <span className="valor">{cantidad}</span>
          <button onClick={() => setCantidad((n) => n + 1)} aria-label="Más">+</button>
        </span>
        <button className="boton primario bc-add" onClick={agregar}>Agregar</button>
      </div>

      {ficha && <FichaPDF estado={estado} costeo={costeoObj} cantidad={cantidad} precioUnitario={precio} onCerrar={() => setFicha(false)} />}
    </div>
  );
}
