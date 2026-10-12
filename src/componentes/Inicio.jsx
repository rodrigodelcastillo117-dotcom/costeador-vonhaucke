// ============================================================================
//  INICIO — un solo lugar para decidir: COTIZAR, COSTEAR o COSTEAR CON IA.
//  Home limpio con 3 acciones. Cada una abre su panel (con buscador donde hay
//  muchas opciones). Sin volcar 24 tiles de golpe. Diseño editorial, sin emojis.
// ============================================================================
import { useMemo, useState } from 'react';
import Icono from './Iconos.jsx';
import { heroLinea, fotoProducto } from '../datos/imagenes.js';
import { buscarProductos } from '../datos/buscarProducto.js';
import { pesos } from '../util.js';
import { flagActivo } from '../datos/flags.js';

// --- Catálogo de líneas para COSTEAR, agrupado por familia ---

const LINEAS = [
  // Operativo / benching
  { ruta: 'applt', titulo: 'App LT', desc: 'Escritorios y bancas operativas. Costo real calibrado.', icono: 'despiece', grupo: 'Operativo / benching' },
  { ruta: 'app', titulo: 'App', desc: 'Hermana de App LT: melamina o chapa de madera.', icono: 'acabado', grupo: 'Operativo / benching' },
  { ruta: 'via', titulo: 'Vía', desc: 'Bajo costo: escritorios, bancas, archiveros, libreros.', icono: 'escritorio', grupo: 'Operativo / benching' },
  { ruta: 'rio', titulo: 'Río', desc: 'Bench orgánico: estaciones y TeamSpace. Biombos.', icono: 'acabado', grupo: 'Operativo / benching' },
  { ruta: 'feather', titulo: 'Feather', desc: 'Bench tubular ligero con acometida central.', icono: 'acabado', grupo: 'Operativo / benching' },
  { ruta: 'cirque', titulo: 'Cirque', desc: 'Benching insignia: escritorios, bancas y recepciones.', icono: 'escritorio', grupo: 'Operativo / benching' },
  { ruta: 'spine', titulo: 'Spine', desc: 'Bench sobre ducto Byrne: estaciones y biombos.', icono: 'acabado', grupo: 'Operativo / benching' },
  { ruta: 'ergo4', titulo: 'Ergonova 4', desc: 'Sistema de mamparas: bancas y estación 120°.', icono: 'despiece', grupo: 'Operativo / benching' },
  { ruta: 'alba', titulo: 'Alba', desc: 'Orgánica: escritorios, mesas de juntas, bench y Olga.', icono: 'escritorio', grupo: 'Operativo / benching' },
  // Ejecutivo
  { ruta: 'eclipse', titulo: 'Eclipse', desc: 'Ejecutiva: chapa/nogal, EcoPiel, pedestales.', icono: 'ejecutivo', grupo: 'Ejecutivo' },
  { ruta: 'drift', titulo: 'Eclipse Drift', desc: 'Premium: directivos, credenzas, faldón EcoPiel.', icono: 'ejecutivo', grupo: 'Ejecutivo' },
  { ruta: 'luna', titulo: 'Luna', desc: 'Inox: escritorios, credenzas, mesas cristal/mármol.', icono: 'ejecutivo', grupo: 'Ejecutivo' },
  { ruta: 'anteo', titulo: 'Anteo', desc: 'Alta gama: escritorio sobre gabinete, guardas.', icono: 'ejecutivo', grupo: 'Ejecutivo' },
  // Guardas
  { ruta: 'mox', titulo: 'Mox', desc: 'Gavetas ligeras: rodante y pedestal.', icono: 'despiece', grupo: 'Guardas' },
  { ruta: 'modulor', titulo: 'Modulor', desc: 'Gavetas, libreros, archiveros, armarios, lockers.', icono: 'despiece', grupo: 'Guardas' },
  // Asientos / lounge
  { ruta: 'tetris', titulo: 'Tetris', desc: 'Sofás/sillones modulares: individual, 2 y 3 plazas.', icono: 'acabado', grupo: 'Asientos y lounge' },
  { ruta: 'arlequin', titulo: 'Arlequín', desc: 'Taburetes, cilindros y cubos (poufs) tapizados.', icono: 'acabado', grupo: 'Asientos y lounge' },
  { ruta: 'pac', titulo: 'Pac', desc: 'Sillón chico sin brazos, componible en filas.', icono: 'acabado', grupo: 'Asientos y lounge' },
  { ruta: 'worklounge', titulo: 'Work Lounge', desc: 'Lounge modular: Tank, Ding, Bricks y mesas Spoon.', icono: 'acabado', grupo: 'Asientos y lounge' },
  // Mesas y accesorios
  { ruta: 'pebble', titulo: 'Pebble', desc: 'Mesas de apoyo: 3 formas, 3 alturas.', icono: 'acabado', grupo: 'Mesas y accesorios' },
  { ruta: 'accents', titulo: 'Accents', desc: 'Acrílicos, mesas de centro, percheros, pizarrones.', icono: 'acabado', grupo: 'Mesas y accesorios' },
  { ruta: 'teamspace2', titulo: 'TeamSpace II', desc: 'Soporte de pantalla 48–55″: fijo o móvil.', icono: 'ejecutivo', grupo: 'Mesas y accesorios' },
  // Mamparas
  { ruta: 'privacy4', titulo: 'Privacy 4', desc: 'Muros móviles y lambrines por tipo y acabado.', icono: 'despiece', grupo: 'Mamparas y muros' },
];

// `soloCostos: true` = sólo Diseño y Dirección. A un vendedor NO se le muestran:
// antes las veía, las tocaba y caía en una pantalla que sólo le decía que no.
const HERRAMIENTAS = [
  // (Cocrear NO vive aquí: se entra desde el hero "Cocreando tu espacio", no desde Costear.)
  // ⚠️ SIN soloCostos SE COLABA A LOS VENDEDORES (auditoría 2026-08-19). Esta
  // ficha no lo llevaba, aunque su botón ("Configurar →") manda a 'costeador'
  // — que SÍ es soloCostos: un vendedor la veía, la tocaba, y caía en la
  // pantalla que sólo le dice que no. Exactamente lo que este comentario de
  // arriba dice que ya se había corregido.
  { ruta: 'catalogo', titulo: 'Otra línea de catálogo', desc: 'Un mueble de catálogo con su despiece y costo.', icono: 'catalogo', soloCostos: true },
  { ruta: 'costeador', titulo: 'Despiece libre (avanzado)', desc: 'Arma el despiece a mano en una sola pantalla.', icono: 'despiece', soloCostos: true },
  { ruta: 'precios', titulo: 'Precios de materiales', desc: 'Ver o actualizar lo que cuesta cada material.', icono: 'precios', soloCostos: true },
  // Las reglas de oficio: lo que Voni da por sabido al acomodar y al costear.
  // Rodrigo las dicta una vez y quedan para todos los proyectos.
  { ruta: 'reglas', titulo: 'Lo que Voni sabe', desc: 'Las reglas de oficio: circulación, sillas de visita, cómo se acomoda.', icono: 'precios' },
];

function Flecha() {
  return (
    <span className="tile-flecha" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </span>
  );
}

function Tarjeta({ icono, titulo, desc, onClick, destacada = false, roja = false, imagen }) {
  // Con imagen: botón tipo showroom (foto de fondo + nombre sobre velo).
  if (imagen) {
    return (
      <button className="tile tile-foto" onClick={onClick} style={{ backgroundImage: `url(${imagen})` }}>
        <span className="tile-foto-velo" />
        <span className="tile-foto-txt">
          <span className="tile-titulo">{titulo}</span>
          {desc && <span className="tile-desc">{desc}</span>}
        </span>
        <Flecha />
      </button>
    );
  }
  return (
    <button className={'tile' + (destacada ? ' tile-destacada' : '') + (roja ? ' tile-roja' : '')} onClick={onClick}>
      <span className="tile-icono"><Icono nombre={icono} tam={destacada ? 30 : 24} /></span>
      <span className="tile-cuerpo">
        <span className="tile-titulo">{titulo}</span>
        <span className="tile-desc">{desc}</span>
      </span>
      <Flecha />
    </button>
  );
}

function BarraVolver({ titulo, sub, onVolver }) {
  return (
    <div className="panel-cab">
      <button className="volver" onClick={onVolver}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        Inicio
      </button>
      <div>
        <h2 className="panel-titulo">{titulo}</h2>
        {sub && <div className="panel-sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function Inicio({ estado, onIr, onAgregarArticulo, veCostos = false, esDireccion = false, vista: vistaProp, setVista: setVistaProp, onDescartar, q: qProp, setQ: setQProp, grupoAbierto: grupoProp, setGrupoAbierto: setGrupoProp }) {
  const [vistaLocal, setVistaLocal] = useState('home');
  const vista = vistaProp ?? vistaLocal;         // controlado por App (para "Atrás"); local en preview
  const setVista = setVistaProp ?? setVistaLocal;
  // La búsqueda y el acordeón los MANDA App cuando existe (para que sobrevivan
  // al "Atrás"); local sólo en la prueba de humo y el preview.
  const [qLocal, setQLocal] = useState('');
  const [grupoLocal, setGrupoLocal] = useState(null);
  const q = qProp ?? qLocal;
  const setQ = setQProp ?? setQLocal;
  const grupoAbierto = grupoProp !== undefined ? grupoProp : grupoLocal;
  const setGrupoAbierto = setGrupoProp ?? setGrupoLocal;
  const nPartidas = estado.cotizacion?.partidas?.length || 0;
  // Las PIEZAS de verdad, que es lo que el cliente cuenta con los ojos.
  const nPzasRetomar = (estado.cotizacion?.partidas || []).reduce((a, p) => a + (p.cantidad || 0), 0);
  // La pantalla de líneas se usa en 2 modos, según la vista: 'costear' (producción)
  // o 'cotizarlinea' (cotizar de línea). Se codifica en la vista para que App la persista.
  const modoCostear = vista === 'costear';

  // ⚠️ EL BUSCADOR AHORA BUSCA PRODUCTOS, NO LÍNEAS. Medido antes: "mesa de
  // juntas" daba 0 resultados aunque 8 líneas la tienen, y "silla" daba 0.
  // Ahora son 156 productos (los 118 de línea + la sillería del banco) y al
  // tocar uno se abre su línea CON ESE PRODUCTO YA ESCOGIDO.
  const productosHallados = useMemo(() => buscarProductos(q), [q]);

  const lineasFiltradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return LINEAS;
    return LINEAS.filter((l) => (l.titulo + ' ' + l.desc + ' ' + l.grupo).toLowerCase().includes(t));
  }, [q]);

  // Las líneas que este usuario más ha abierto (la app lo aprende sola).
  const favoritas = useMemo(() => {
    const usos = estado.lineasUsadas || {};
    return Object.entries(usos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ruta]) => LINEAS.find((l) => l.ruta === ruta))
      .filter(Boolean);
  }, [estado.lineasUsadas]);

  const herramientas = useMemo(() => HERRAMIENTAS.filter((h) => !h.soloCostos || veCostos), [veCostos]);

  const grupos = useMemo(() => {
    const g = {};
    for (const l of lineasFiltradas) (g[l.grupo] = g[l.grupo] || []).push(l);
    return g;
  }, [lineasFiltradas]);

  // -------------------- HOME · OPERACIÓN SIMPLE --------------------
  // Una pantalla = una decisión. Cada botón abre DIRECTO el flujo real:
  // Cotizar -> VONI; Costear -> especial con PDF/plano/render; Cocrear -> estudio.
  // Lo avanzado sigue disponible abajo sin competir con los tres trabajos.
  if (vista === 'home') {
    const cot = estado.cotizacion || {};
    // #12: suma SÓLO precios conocidos (null NO cuenta como 0) y cuenta cuántos faltan,
    // para no mostrar un importe que parezca total final.
    const totalCot = (cot.partidas || []).reduce((s, p) => s + (Number.isFinite(Number(p.precioUnitario)) ? Number(p.precioUnitario) * (p.cantidad || 0) : 0), 0);
    const faltanCot = (cot.partidas || []).filter((p) => p.price_status === 'SIN_PRECIO' || p.precioUnitario == null).length;
    // Fotografías reales del catálogo Von Haucke (bucket público `app/catalogo`): la
    // pantalla de entrada enseña el producto, no íconos genéricos.
    const FOTO = {
      cotizar: fotoProducto('cirque', 'mesajuntas'),
      costear: heroLinea('alba'),
      cocrear: heroLinea('tetris'),
      linea: heroLinea('applt'),
      acomodo: fotoProducto('eclipse', 'mesa_consejo'),
      manual: heroLinea('modulor'),
      varios: fotoProducto('applt', 'banca_doble'),
      banco: heroLinea('via'),
      archivo: fotoProducto('ergo4', 'recepcion'),
      reglas: heroLinea('worklounge'),
      tablero: heroLinea('eclipse'),
      usuarios: heroLinea('cirque'),
    };
    const Atajo = ({ foto, titulo, sub, onClick, testid }) => (
      <button className="vh-atajo" onClick={onClick} data-testid={testid}>
        {foto ? <img className="vh-atajo-foto" src={foto} alt="" loading="lazy" /> : <span className="vh-atajo-foto vh-atajo-sin" />}
        <span className="vh-atajo-txt"><strong>{titulo}</strong><span>{sub}</span></span>
        <span className="vh-atajo-ir" aria-hidden="true">→</span>
      </button>
    );
    return (
      <div className="inicio inicio-terminal inicio-vh">
        <div className="vh-cab">
          <div className="vh-marca"><span className="vh-marca-dot" aria-hidden="true" />VH LAB</div>
          <h1 className="vh-titulo">¿Qué vas a hacer?</h1>
          <p className="vh-sub">Cotiza, costea o diseña. Cada botón abre directo su flujo, sin menús intermedios.</p>
        </div>

        {nPartidas > 0 && (
          <div className="retomar-fila">
            <button className="retomar" data-testid="home-retomar" onClick={() => onIr('cotizacion')}>
              <span className="retomar-txt">
                <span className="retomar-lbl">Proyecto en curso</span>
                <strong>{cot.cliente || 'Cotización sin nombre'} · {nPzasRetomar} pieza{nPzasRetomar === 1 ? '' : 's'}</strong>
                {faltanCot > 0
                  ? <span className="retomar-n">{totalCot > 0 ? `${pesos(totalCot)} · ` : ''}faltan {faltanCot} precio{faltanCot === 1 ? '' : 's'}</span>
                  : (totalCot > 0 && <span className="retomar-n">{pesos(totalCot)}</span>)}
              </span>
              <span className="retomar-cta">Continuar →</span>
            </button>
            {onDescartar && (
              <button className="retomar-tirar" onClick={() => {
                if (!confirm(`¿Descartar esta cotización completa?\n\nSe borran ${nPartidas} renglón${nPartidas === 1 ? '' : 'es'} y el acomodo. No se puede deshacer.`)) return;
                onDescartar();
              }}>Empezar de cero</button>
            )}
          </div>
        )}

        <div className={'vh-caminos' + (veCostos ? '' : ' dos')}>
          <button className="vh-camino principal" data-testid="home-cotizar" onClick={() => onIr('voni')}>
            <img className="vh-camino-foto" src={FOTO.cotizar} alt="" />
            <span className="vh-camino-velo" aria-hidden="true" />
            <span className="vh-camino-txt">
              <span className="vh-k">01 · Cotizar</span>
              <strong>Preparar propuesta para cliente</strong>
              <span>Sube el plano o describe lo que necesita el cliente. Voni arma la propuesta, el acomodo y el PDF.</span>
              <b>Empezar cotización →</b>
            </span>
          </button>

          {veCostos && (
            <button className="vh-camino" data-testid="home-costear" onClick={() => onIr('especial')}>
              <img className="vh-camino-foto" src={FOTO.costear} alt="" />
              <span className="vh-camino-velo" aria-hidden="true" />
              <span className="vh-camino-txt">
                <span className="vh-k">02 · Costear</span>
                <strong>Costear un producto nuevo</strong>
                <span>PDF, plano, render o foto. Voni propone el despiece y el motor calcula el costo real.</span>
                <b>Subir PDF / costear →</b>
              </span>
            </button>
          )}

          <button className="vh-camino" data-testid="home-cocrear" onClick={() => onIr('cocrear')}>
            <img className="vh-camino-foto" src={FOTO.cocrear} alt="" />
            <span className="vh-camino-velo" aria-hidden="true" />
            <span className="vh-camino-txt">
              <span className="vh-k">{veCostos ? '03' : '02'} · Cocrear</span>
              <strong>Diseñar un producto nuevo</strong>
              <span>De la necesidad del cliente a una solución fabricable, con Voni como copiloto.</span>
              <b>Empezar cocreación →</b>
            </span>
          </button>
        </div>

        <section className="vh-herr" aria-labelledby="vh-herr-titulo">
          <div className="vh-herr-cab">
            <h2 id="vh-herr-titulo">Más herramientas</h2>
            <span>Lo de todos los días, a un clic.</span>
          </div>
          <div className="vh-herr-grid">
            {nPartidas > 0 && <Atajo foto={null} titulo="Proyecto actual" sub="ver, imprimir o descargar" onClick={() => onIr('cotizacion')} />}
            {nPartidas > 0 && <Atajo foto={FOTO.acomodo} titulo="Acomodo" sub="plano y distribución" onClick={() => onIr('acomodo')} />}
            <Atajo foto={FOTO.linea} titulo="Cotizar de línea" sub="producto conocido" onClick={() => setVista('cotizarlinea')} />
            <Atajo foto={FOTO.varios} titulo="Cotizar varios con IA" sub="varios muebles de un jalón" onClick={() => onIr('cotizarIA')} />
            {veCostos && <Atajo foto={FOTO.manual} titulo="Costeo manual" sub="despiece pieza por pieza" onClick={() => onIr('costeador')} />}
            <Atajo foto={FOTO.banco} titulo="Banco de precios" sub="lo ya vendido" onClick={() => onIr('banco')} />
            <Atajo foto={FOTO.archivo} titulo="Presupuestos anteriores" sub="buscar y reabrir" onClick={() => onIr('archivo')} />
            {flagActivo('commercial_v2') && <Atajo foto={FOTO.tablero} titulo="Comercial · Proyectos" sub="pipeline y propuestas" onClick={() => onIr('comercial')} />}
            <Atajo foto={FOTO.reglas} titulo="Lo que Voni sabe" sub="reglas de oficio" onClick={() => onIr('reglas')} />
            {esDireccion && <Atajo foto={FOTO.tablero} titulo="Dirección" sub="ver el negocio" onClick={() => onIr('tablero')} />}
            {esDireccion && <Atajo foto={FOTO.usuarios} titulo="Usuarios y accesos" sub="permisos" onClick={() => onIr('usuarios')} />}
            {esDireccion && <Atajo foto={FOTO.banco} titulo="Cargar compras del ERP" sub="precios con documento" onClick={() => onIr('carga-erp')} />}
          </div>
        </section>

        {favoritas.length > 0 && (
          <div className="favoritas vh-favs">
            <div className="favoritas-lbl">Tus líneas más usadas</div>
            <div className="favoritas-chips">
              {favoritas.map((l) => (
                <button key={l.ruta} className="favorita vh-fav" onClick={() => onIr(l.ruta)}>
                  {heroLinea(l.ruta) && <img src={heroLinea(l.ruta)} alt="" loading="lazy" />}
                  {l.titulo}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------- COTIZAR --------------------
  if (vista === 'cotizar') {
    return (
      <div className="inicio">
        <BarraVolver titulo="Cotizar" sub="Arma el precio para el cliente." onVolver={() => setVista('home')} />
        <div className="inicio-botones">
          {flagActivo('commercial_v2') && <Tarjeta icono="archivo" titulo="Comercial · Proyectos" desc="Hoy, proyectos, catálogo y propuestas. Tu espacio de venta de principio a fin." onClick={() => onIr('comercial')} />}
          <Tarjeta roja icono="especial" titulo="Cotizar con IA" desc="Escribe lo que pide el cliente y la IA arma la cotización completa, con precios." onClick={() => onIr('cotizarIA')} />
          {veCostos
            ? <Tarjeta destacada icono="despiece" titulo="Cotizar de línea" desc="Escribe el mueble que necesitas —silla WIN, mesa de juntas, archivero— y te doy el precio." onClick={() => setVista('cotizarlinea')} />
            : <Tarjeta destacada icono="escritorio" titulo="Cotizar de línea" desc="Escribe el mueble que necesitas —silla WIN, mesa de juntas, archivero— y te doy el precio." onClick={() => setVista('cotizarlinea')} />}
          <Tarjeta icono="banco" titulo="Banco de precios" desc="Productos reales con su precio. Búscalos y agrégalos." onClick={() => onIr('banco')} />
          <Tarjeta icono="banco" titulo="Presupuestos que ya hicimos" desc="Todo lo cotizado, de todos los aparatos. Búscalo y ábrelo otra vez." onClick={() => onIr('archivo')} />
          <Tarjeta icono="especial" titulo="Cotizar especial (a la medida)" desc={veCostos ? 'Producto nuevo: se costea y se cotiza.' : 'A la medida. Diseño lo costea; tú lo cotizas.'} onClick={() => onIr(veCostos ? 'costeador' : 'asistente')} />
          <Tarjeta icono="documento" titulo="Mis cotizaciones" desc={nPartidas > 0 ? `${nPartidas} ${nPartidas === 1 ? 'renglón' : 'renglones'} en la lista. Descuento, ver o imprimir.` : 'Ver e imprimir para el cliente.'} onClick={() => onIr('cotizacion')} />
          <Tarjeta icono="despiece" titulo="Acomodo en el espacio (IA)" desc={nPartidas > 0 ? 'Define el área o sube tu plano; la IA los acomoda y verifica que caben.' : 'Primero agrega muebles; luego la IA los acomoda en tu espacio.'} onClick={() => onIr('acomodo')} />
        </div>
      </div>
    );
  }

  // -------------------- COSTEAR --------------------
  return (
    <div className="inicio">
      <BarraVolver
        titulo={modoCostear ? 'Costear' : 'Cotizar de línea'}
        sub={modoCostear ? 'Busca el mueble y te doy el costo real de fabricarlo.' : 'Escribe el mueble que necesitas y te lo configuro. O búscalo por línea, abajo.'}
        // Decía "Inicio" y regresaba al panel de Cotizar. Ahora que se llega
        // aquí de un toque desde el home, el botón hace lo que dice.
        onVolver={() => setVista('home')}
      />

      {/* Atajo: cotizar de línea es uno por uno. Si son varios muebles, la IA los mete de un jalón. */}
      <div className="buscador">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="¿Qué mueble necesitas? (silla WIN, mesa de juntas, archivero…)" />
        {q && <button className="buscador-x" onClick={() => setQ('')} aria-label="Limpiar">×</button>}
      </div>

      {!modoCostear && (
        <div className="atajo-ia">
          <div className="atajo-ia-txt">
            <strong>¿Son varios muebles?</strong>
            <span>Aquí escoges de uno en uno. Descríbelos todos y la IA los agrega de un jalón.</span>
          </div>
          <button className="boton primario" onClick={() => onIr('cotizarIA')}>Cotizar con IA</button>
        </div>
      )}

      {modoCostear && (
        <div className="inicio-botones una-col" style={{ marginBottom: 14 }}>
          <Tarjeta roja icono="especial" titulo="Costear con IA" desc="Sube foto/render + descríbelo (medidas, materiales); la IA arma el despiece y el motor calcula el costo." onClick={() => onIr('especial')} />
          <Tarjeta destacada icono="despiece" titulo="Costear a mano (despiece completo)" desc="Tú metes cada pieza, material y medida; el motor te da el costo. Para lo que quieras, sin IA." onClick={() => onIr('costeador')} />
        </div>
      )}


      {q && productosHallados.length > 0 && (
        <div className="hallados">
          <div className="hallados-cab">{productosHallados.length} producto{productosHallados.length === 1 ? '' : 's'}</div>
          {productosHallados.map((r) => (
            <button key={r.ruta + ':' + r.productoId} className="hallado"
              onClick={() => (r.articulo ? onAgregarArticulo?.(r) : r.banco ? onIr('banco') : onIr(r.ruta, r.productoId))}>
              <span className="hallado-txt">
                <strong>{r.nombre}</strong>
                {/* Un ARTÍCULO del catálogo trae su Precio Lista real: se muestra
                    junto a la línea y al tocarlo se agrega directo, sin configurar. */}
                <span className="hallado-linea">{r.linea}{r.articulo ? ` · ${pesos(r.precio)}` : ''}</span>
              </span>
              <span className="hallado-cta">{r.articulo ? 'Agregar →' : r.banco ? 'Ver en el banco →' : 'Configurar →'}</span>
            </button>
          ))}
        </div>
      )}

      {q && productosHallados.length === 0 && Object.keys(grupos).length === 0
        && <div className="ayuda" style={{ padding: '8px 2px' }}>Nada encontrado. Prueba otra palabra.</div>}

      {q && Object.keys(grupos).length > 0 ? (
        <div className="inicio-botones">
          {Object.values(grupos).flat().map((l) => (
            <Tarjeta key={l.ruta} icono={l.icono} imagen={heroLinea(l.ruta)} titulo={l.titulo} desc={l.desc} onClick={() => onIr(l.ruta)} />
          ))}
        </div>
      ) : (
        <div className="acordeon">
          {[...Object.entries(grupos), ...(herramientas.length ? [['Herramientas', herramientas]] : [])].map(([grupo, items]) => {
            const abierto = grupoAbierto === grupo;
            return (
              <div className={'grupo-acc' + (abierto ? ' abierto' : '')} key={grupo}>
                <button className="grupo-acc-h" onClick={() => setGrupoAbierto(abierto ? '' : grupo)} aria-expanded={abierto}>
                  <span className="grupo-acc-t">{grupo}</span>
                  <span className="grupo-acc-n">{items.length}</span>
                  <svg className="grupo-acc-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {abierto && (
                  <div className="inicio-botones grupo-acc-b">
                    {items.map((l) => (
                      <Tarjeta key={l.ruta} icono={l.icono} imagen={heroLinea(l.ruta)} titulo={l.titulo} desc={l.desc} onClick={() => onIr(l.ruta)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
