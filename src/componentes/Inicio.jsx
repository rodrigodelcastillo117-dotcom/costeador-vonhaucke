// ============================================================================
//  INICIO — un solo lugar para decidir: COTIZAR, COSTEAR o COSTEAR CON IA.
//  Home limpio con 3 acciones. Cada una abre su panel (con buscador donde hay
//  muchas opciones). Sin volcar 24 tiles de golpe. Diseño editorial, sin emojis.
// ============================================================================
import { useMemo, useState } from 'react';
import Icono from './Iconos.jsx';
import VoniAvatar from './VoniAvatar.jsx';
import { heroLinea } from '../datos/imagenes.js';
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

  // -------------------- HOME --------------------
  if (vista === 'home') {
    const cot = estado.cotizacion || {};
    const totalCot = (cot.partidas || []).reduce((s, p) => s + (p.precioUnitario || 0) * (p.cantidad || 0), 0);
    return (
      <div className="inicio">
        <div className="inicio-hero">
          <div className="inicio-overline">Vonhaucke · Más de 68 años de oficio</div>
          <h1 className="inicio-titulo">Empecemos tu propuesta</h1>
          <div className="inicio-lead">Cotiza, acomoda y presenta con mobiliario Vonhaucke, en minutos.</div>
        </div>

        {/* En qué vas: retomar es más común que empezar de cero. */}
        {nPartidas > 0 && (
          <div className="retomar-fila">
            <button className="retomar" onClick={() => onIr('cotizacion')}>
              <span className="retomar-txt">
                <span className="retomar-lbl">Vas a la mitad</span>
                {/* ⚠️ DECÍA "6 MUEBLES" CON 17 PIEZAS (2026-08-17): contaba
                    RENGLONES. El vendedor le dice al cliente "seis muebles" con
                    $228,102 enfrente y el precio suena carísimo. */}
                <strong>{cot.cliente ? cot.cliente : 'Cotización sin nombre'} · {nPzasRetomar} pieza{nPzasRetomar === 1 ? '' : 's'} en {nPartidas} {nPartidas === 1 ? 'renglón' : 'renglones'}</strong>
                {totalCot > 0 && <span className="retomar-n">{pesos(totalCot)}</span>}
              </span>
              <span className="retomar-cta">Seguir <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
            </button>
            {/* Empezar de cero SIN quitar mueble por mueble. Con 34 partidas
                eran 34 "quitar" MÁS 34 confirmaciones. Aquí es UNA. */}
            {onDescartar && (
              <button className="retomar-tirar" title="Borrar esta cotización y empezar de cero"
                onClick={() => {
                  if (!confirm(`¿Descartar esta cotización completa?\n\nSe borran ${nPartidas} mueble${nPartidas === 1 ? '' : 's'} y el acomodo del plano. No se puede deshacer.`)) return;
                  onDescartar();
                }}>
                Descartar todo
              </button>
            )}
          </div>
        )}

        {/* ⚠️ LAS DOS PUERTAS GRANDES (Rodrigo, 2026-08-17): "lo principal de la
            app es COSTEAR bien, rápido y eficaz, y para vendedores poder
            cotizar". Son los DOS trabajos del negocio, así que van del mismo
            tamaño y lado a lado, no uno grande y el otro de atajo:
              · Voni    = vender (el vendedor describe y sale la propuesta).
              · Costear = producir (Dirección/Diseño saca el costo real).
            Costear sólo aparece con `veCostos`: el vendedor no ve costos, y
            para él la única puerta grande es Voni. */}
        <div className="puertas">
        <button className="voni-principal" onClick={() => onIr('voni')}>
          <span className="voni-principal-av"><VoniAvatar tam={64} variante="cara" /></span>
          <span className="voni-principal-txt">
            <span className="voni-principal-k">Empieza aquí</span>
            <strong>Dime qué pide el cliente</strong>
            <span>Descríbelo en tus palabras y armo el proyecto completo: los muebles, el acomodo en su espacio y la propuesta lista para entregar.</span>
          </span>
          <span className="voni-principal-cta">Empezar <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
        </button>

        {veCostos && (
          <button className="costear-principal" onClick={() => setVista('costear')}>
            <span className="voni-principal-av" aria-hidden="true">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
                <path d="M7.5 6.5h9M7.5 11h3M13 11h3.5M7.5 15h3M13 15v3.5M7.5 18.5h3" />
              </svg>
            </span>
            <span className="voni-principal-txt">
              <span className="voni-principal-k">Costear</span>
              <strong>¿Cuánto nos cuesta fabricarlo?</strong>
              <span>El costo real de producción: material, mano de obra e indirectos, pieza por pieza. Es de donde sale el precio de todo lo demás.</span>
            </span>
            <span className="voni-principal-cta">Costear <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
          </button>
        )}
        </div>

        {/* ⚠️ ESTO ERAN DOS TARJETONES DEL MISMO TAMAÑO QUE VONI (2026-08-17).
            Con tres puertas grandes al mismo nivel, Rodrigo entró por la
            equivocada: "de verdad imposible, yo me sé la app y no pude". El mapa
            que acordamos es de UNA puerta y dos herramientas:
              · Voni = EL CAMINO (arriba, grande).
              · Cotizar de línea = el destornillador: ajustar y vender piezas.
              · Banco de precios = la memoria de lo ya vendido.
            Por eso lo de abajo son ATAJOS, no acciones: letra chica, en una
            tira, y van DIRECTO a su pantalla (antes había que pasar por el
            panel "Cotizar" para llegar a cotizar de línea). */}
        <div className="atajos-bloque">
          <div className="atajos-lbl">¿Ya sabes qué quieres? Ve directo</div>
          <div className="atajos">
            <button className="atajo" onClick={() => setVista('cotizarlinea')}>
              Cotizar de línea <span>un mueble, con su precio</span>
            </button>
            <button className="atajo" onClick={() => onIr('banco')}>
              Banco de precios <span>lo ya vendido, con precio real</span>
            </button>
            <button className="atajo" onClick={() => onIr('archivo')}>
              Presupuestos que ya hicimos <span>ábrelos otra vez</span>
            </button>
            <button className="atajo" onClick={() => onIr(veCostos ? 'costeador' : 'asistente')}>
              Especial a la medida <span>lo que no está en catálogo</span>
            </button>
            {/* Costear ya NO vive aquí: subió a puerta grande, arriba. */}
            <button className="atajo atajo-mas" onClick={() => setVista('cotizar')}>
              Ver todo lo de cotizar →
            </button>
          </div>
        </div>

        {/* Lo que TÚ más cotizas, a un toque. La app lo aprende sola. */}
        {favoritas.length > 0 && (
          <div className="favoritas">
            <div className="favoritas-lbl">Tus líneas más usadas</div>
            <div className="favoritas-chips">
              {favoritas.map((l) => (
                <button key={l.ruta} className="favorita" onClick={() => onIr(l.ruta)}>{l.titulo}</button>
              ))}
            </div>
          </div>
        )}

        {esDireccion && (
          <div className="inicio-pie">
            <button className="enlace-pie" onClick={() => onIr('tablero')}>Ver el negocio (Dirección) →</button>
            <button className="enlace-pie" onClick={() => onIr('usuarios')}>Usuarios y accesos →</button>
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
