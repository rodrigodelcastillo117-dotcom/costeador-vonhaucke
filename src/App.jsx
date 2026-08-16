// ============================================================================
//  APP - encabezado, pestanias, estado global y PERMISOS POR ROL.
//  El acceso a nomina/financieros/tablero NO se pide con un PIN: lo resuelve
//  la base de datos por el correo de quien entro (tabla `permitidos`).
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import Icono from './componentes/Iconos.jsx';
import MarcaLogo from './componentes/MarcaLogo.jsx';
import Tablero from './componentes/Tablero.jsx';
import Costeador, { parametrosEfectivos } from './componentes/Costeador.jsx';
import Catalogo from './componentes/Catalogo.jsx';
import Cotizacion from './componentes/Cotizacion.jsx';
import CotizadorIA from './componentes/CotizadorIA.jsx';
import CambiarContrasena from './componentes/CambiarContrasena.jsx';
import Acomodo from './componentes/Acomodo.jsx';
import Voni from './componentes/Voni.jsx';
import Precios from './componentes/Precios.jsx';
import Guia from './componentes/Guia.jsx';
import SinPantallaBlanca from './componentes/SinPantallaBlanca.jsx';
import Inicio from './componentes/Inicio.jsx';
import Asistente from './componentes/Asistente.jsx';
import AsistenteEspecial from './componentes/AsistenteEspecial.jsx';
import CosteadorLinea from './componentes/CosteadorLinea.jsx';
import { APPLT_PRODUCTOS, generarAppLT } from './datos/applt.js';
import { APP_PRODUCTOS, generarApp } from './datos/app.js';
import { ECLIPSE_PRODUCTOS, generarEclipse } from './datos/eclipse.js';
import { PEBBLE_PRODUCTOS, generarPebble } from './datos/pebble.js';
import { PRIVACY4_PRODUCTOS, generarPrivacy4 } from './datos/privacy4.js';
import { RIO_PRODUCTOS, generarRio } from './datos/rio.js';
import { TEAMSPACE2_PRODUCTOS, generarTeamspace2 } from './datos/teamspace2.js';
import { TETRIS_PRODUCTOS, generarTetris } from './datos/tetris.js';
import { ARLEQUIN_PRODUCTOS, generarArlequin } from './datos/arlequin.js';
import { PAC_PRODUCTOS, generarPac } from './datos/pac.js';
import { VIA_PRODUCTOS, generarVia } from './datos/via.js';
import { DRIFT_PRODUCTOS, generarDrift } from './datos/drift.js';
import { FLEX_PRODUCTOS, generarFlex } from './datos/flex.js';
import { MOX_PRODUCTOS, generarMox } from './datos/mox.js';
import { MODULOR_PRODUCTOS, generarModulor } from './datos/modulor.js';
import { LUNA_PRODUCTOS, generarLuna } from './datos/luna.js';
import { ACCENTS_PRODUCTOS, generarAccents } from './datos/accents.js';
import { ERGO4_PRODUCTOS, generarErgo4 } from './datos/ergo4.js';
import { SPINE_PRODUCTOS, generarSpine } from './datos/spine.js';
import { ANTEO_PRODUCTOS, generarAnteo } from './datos/anteo.js';
import { ALBA_PRODUCTOS, generarAlba } from './datos/alba.js';
import { FEATHER_PRODUCTOS, generarFeather } from './datos/feather.js';
import { WORKLOUNGE_PRODUCTOS, generarWorklounge } from './datos/worklounge.js';
import { CIRQUE_PRODUCTOS, generarCirque } from './datos/cirque.js';
import Banco from './componentes/Banco.jsx';
import Login from './componentes/Login.jsx';
import Usuarios from './componentes/Usuarios.jsx';
import Reglas from './componentes/Reglas.jsx';
import { cargarReglas } from './datos/reglas.js';
import { cargar, guardar, PARAMS_SENSIBLES } from './almacen.js';
import { leerConfig, escribirConfig, suscribirConfig, leerDireccion, escribirDireccion, sesionActual, alCambiarSesion, entrar, salir, miPermiso } from './nube.js';
import { calcular } from './motor/calculo.js';
import { idNuevo } from './util.js';
import { costoImplicito, precioDeLista } from './datos/preciosVenta.js';

// Rutas que son una línea de catálogo (para aprender cuáles usa cada quien).
const RUTAS_LINEA = new Set(['applt', 'app', 'via', 'rio', 'feather', 'cirque', 'spine', 'ergo4', 'alba',
  'eclipse', 'drift', 'luna', 'anteo', 'mox', 'modulor', 'tetris', 'arlequin', 'pac', 'worklounge',
  'pebble', 'accents', 'teamspace2', 'privacy4']);

const NOMBRE_VISTA = {
  voni: 'Voni · asistente de proyecto',
  asistente: 'Cotizar un mueble',
  banco: 'Banco de precios',
  applt: 'Costeador APP LT',
  app: 'Costeador App',
  eclipse: 'Costeador Eclipse',
  pebble: 'Costeador Pebble',
  privacy4: 'Costeador Privacy 4',
  rio: 'Costeador Río',
  teamspace2: 'Costeador TeamSpace II',
  tetris: 'Costeador Tetris',
  arlequin: 'Costeador Arlequín',
  pac: 'Costeador Pac',
  via: 'Costeador Vía',
  drift: 'Costeador Eclipse Drift',
  flex: 'Costeador Flex',
  mox: 'Costeador Mox',
  modulor: 'Costeador Modulor',
  luna: 'Costeador Luna',
  accents: 'Costeador Accents',
  ergo4: 'Costeador Ergonova 4',
  spine: 'Costeador Spine',
  anteo: 'Costeador Anteo',
  alba: 'Costeador Alba',
  feather: 'Costeador Feather',
  worklounge: 'Costeador Work Lounge',
  cirque: 'Costeador Cirque',
  especial: 'Costear desde cero',
  costeador: 'Modo avanzado',
  catalogo: 'Catálogo',
  cotizacion: 'Mis cotizaciones',
  precios: 'Precios',
  tablero: 'El negocio',
  reglas: 'Lo que Voni sabe',
  usuarios: 'Quién puede entrar',
};

function costeoEnBlanco() {
  return {
    piezaId: null, nombre: '', linea: null, piezas: 1, componentes: [],
    modoManoObra: 'porcentaje', horas: { pm: 0, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0 },
    factorDirecta: 55, factorIndirecta: 12, preparacionHoras: 0, margen: 30,
  };
}

// Lo que sube a la config COMPARTIDA. La nomina y los estados financieros
// NUNCA van aqui: viven en la tabla `direccion`, que la base de datos solo
// le entrega a quien tiene rol direccion (se resuelve por su correo). A un
// vendedor esos datos ni siquiera le llegan al navegador.
function compartidoSeguro(estado) {
  const p = { ...estado.parametros };
  for (const f of PARAMS_SENSIBLES) delete p[f];
  return {
    insumos: estado.insumos,
    piezas: estado.piezas,
    parametros: p,
  };
}

// Lo que sube a la BOVEDA de Direccion.
function soloDireccion(estado) {
  const nomina = {};
  for (const f of PARAMS_SENSIBLES) nomina[f] = estado.parametros[f];
  return { nomina, finanzas: estado.finanzas || {} };
}

// Firma estable (orden fijo) para detectar si algo cambio de verdad.
function firma(c) {
  return JSON.stringify([c.insumos, c.piezas, c.parametros]);
}
const firmaDir = (d) => JSON.stringify([d.nomina, d.finanzas]);

// Mezcla lo compartido (de la nube) sobre el estado local. Los parametros se
// FUNDEN (para no borrar la nomina que Direccion tenga desbloqueada en memoria);
// los precios, recetas y el bloque cifrado se reemplazan.
function aplicarCompartido(estado, datos) {
  const nuevo = { ...estado };
  if (datos.insumos) nuevo.insumos = datos.insumos;
  if (datos.piezas) nuevo.piezas = datos.piezas;
  // Los parametros se FUNDEN: lo compartido no debe borrar la nomina que
  // Direccion ya tenga cargada desde su boveda.
  if (datos.parametros) nuevo.parametros = { ...estado.parametros, ...datos.parametros };
  return nuevo;
}

// Borra de este navegador todo lo que solo Direccion debe tener. Se usa al
// salir y al entrar con un rol que no es direccion: si la nomina quedo
// guardada de antes de este cambio, aqui desaparece.
function limpiarSensibles(estado) {
  const parametros = { ...estado.parametros };
  for (const f of PARAMS_SENSIBLES) {
    parametros[f] = f === 'costoHoraArea' ? { pm: 0, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0 } : null;
  }
  return { ...estado, parametros, finanzas: null, dir: { cifrado: false } };
}

// Mezcla la boveda de Direccion (solo llega si el rol lo permite).
function aplicarDireccion(estado, datos) {
  if (!datos) return estado;
  return {
    ...estado,
    parametros: { ...estado.parametros, ...(datos.nomina || {}) },
    finanzas: datos.finanzas || estado.finanzas,
  };
}

export default function App() {
  const [estado, setEstado] = useState(cargar);
  const [pestania, setPestania] = useState('inicio');
  const [inicioVista, setInicioVista] = useState('home'); // sub-vista del Inicio (home/costear/cotizar)
  const [nav, setNav] = useState([]);                     // historial para "Atrás"
  const [costeo, setCosteo] = useState(costeoEnBlanco);
  const [aviso, setAviso] = useState(''); // toast "¡Listo!"
  const [voniPaso, setVoniPaso] = useState(1); // paso actual del asistente Voni (persiste al navegar)

  // Navegacion con historial: irA empuja el estado actual; atras lo restaura.
  function irA(tab) {
    if (tab === pestania) return;
    setNav((s) => [...s, { pestania, inicioVista }]);
    setPestania(tab);
    // La app aprende qué líneas usa cada quien para ponérselas al frente.
    // Es local a su computadora: no se comparte ni se sube.
    if (RUTAS_LINEA.has(tab)) {
      setEstado((e) => ({ ...e, lineasUsadas: { ...(e.lineasUsadas || {}), [tab]: ((e.lineasUsadas || {})[tab] || 0) + 1 } }));
    }
  }
  function atras() {
    setNav((s) => {
      if (s.length === 0) { setPestania('inicio'); setInicioVista('home'); return s; }
      const prev = s[s.length - 1];
      setPestania(prev.pestania);
      setInicioVista(prev.inicioVista ?? 'home');
      return s.slice(0, -1);
    });
  }
  function irInicio() { setNav([]); setInicioVista('home'); setPestania('inicio'); }

  function mostrarAviso(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(''), 2600);
  }

  const [mostrarGuia, setMostrarGuia] = useState(() => !cargar().onboardingVisto);

  function cerrarGuia(tab) {
    setEstado((e) => ({ ...e, onboardingVisto: true }));
    setMostrarGuia(false);
    if (tab) setPestania(tab);
  }

  // ---- Sesion / acceso (control de quien entra) ----
  const [sesion, setSesion] = useState(undefined); // undefined=revisando, null=sin sesion, obj=adentro
  const [permiso, setPermiso] = useState(undefined); // undefined=revisando, null=sin acceso, {rol,nombre}
  const [errorEntrar, setErrorEntrar] = useState('');
  const [recuperando, setRecuperando] = useState(false); // llegó por el enlace de recuperación

  useEffect(() => {
    sesionActual().then((s) => setSesion(s));
    // Si llega por el enlace de "olvidé mi contraseña", Supabase avisa con
    // PASSWORD_RECOVERY: se le manda directo a poner una nueva, y ahí NO se le
    // pide la anterior (justo porque no la recuerda).
    const off = alCambiarSesion((s, evento) => {
      setSesion(s);
      if (evento === 'PASSWORD_RECOVERY') { setRecuperando(true); setPestania('contrasena'); }
    });
    return off;
  }, []);

  useEffect(() => {
    if (sesion === undefined) return;
    if (!sesion) { setPermiso(undefined); return; }
    let vivo = true;
    miPermiso(sesion.user.email).then((p) => { if (vivo) setPermiso(p); });
    // Las REGLAS DE OFICIO se bajan al entrar: la circulación de 90 cm, las
    // sillas de visita, el margen mínimo. El motor las consulta en caliente, y
    // si la base no contesta se queda con los mismos valores por omisión en vez
    // de inventarse otros.
    cargarReglas();
    return () => { vivo = false; };
  }, [sesion]);

  const accesoOk = !!sesion && !!permiso;
  const esDireccion = permiso?.rol === 'direccion';
  const esDiseno = permiso?.rol === 'diseno';
  // Diseno y Direccion ven costos (para despiece). Todo lo demas es vendedor: solo precio recomendado.
  const esVendedor = !esDireccion && !esDiseno;
  // Puede ver el costo de fabricacion (Costeador, Precios de material, HojaCosto).
  const veCostos = esDireccion || esDiseno;
  // Nomina, financieros y tablero: SOLO Direccion, resuelto por su correo.
  // Ya no hay PIN: el permiso lo da la base de datos, que a los demas ni
  // siquiera les manda estos datos.
  const desbloqueado = esDireccion;

  // Cada vez que cambias de pantalla, arranca desde arriba (no a media pagina).
  useEffect(() => { window.scrollTo(0, 0); }, [pestania]);

  async function hacerLogin(email, password) {
    setErrorEntrar('');
    await entrar(email, password); // lanza si falla; alCambiarSesion actualiza
  }
  async function hacerLogout() {
    await salir();
    setPestania('inicio');
    // Al salir se borra de esta computadora todo lo de Direccion.
    setEstado((e) => limpiarSensibles(e));
  }

  // ---- Nube (datos compartidos) ----
  const [nubeEstado, setNubeEstado] = useState('conectando'); // conectando | conectado | sin-conexion
  const aplicandoRemoto = useRef(false);   // true = el cambio vino de la nube, no re-subir
  const ultimoCompartido = useRef('');     // JSON de lo ultimo compartido, para no reescribir igual
  const timerNube = useRef(null);
  const ultimoDireccion = useRef('');   // firma de la boveda, para no reescribir igual

  // Al entrar (con sesion valida): traer la config de la nube y suscribirse.
  useEffect(() => {
    if (!accesoOk) return;
    let vivo = true;
    leerConfig().then((datos) => {
      if (!vivo) return;
      if (datos && datos.insumos) {
        // La nube manda: aplica precios/recetas/parametros/nomina compartidos.
        aplicandoRemoto.current = true;
        ultimoCompartido.current = firma(datos);
        setEstado((e) => aplicarCompartido(e, datos));
      } else {
        // Nube vacia: subir la semilla para inicializarla.
        setEstado((e) => {
          const comp = compartidoSeguro(e);
          ultimoCompartido.current = firma(comp);
          escribirConfig(comp).catch(() => {});
          return e;
        });
      }
      setNubeEstado('conectado');
    }).catch(() => { if (vivo) setNubeEstado('sin-conexion'); });

    // Boveda de Direccion. A quien no es direccion la base no le devuelve
    // nada; ademas se BORRA lo que hubiera quedado guardado en su navegador
    // de antes de este cambio.
    if (esDireccion) {
      leerDireccion().then((d) => {
        if (!vivo || !d) return;
        aplicandoRemoto.current = true;
        setEstado((e) => aplicarDireccion(e, d));
        ultimoDireccion.current = firmaDir(soloDireccion(aplicarDireccion(estado, d)));
      }).catch(() => {});
    } else {
      setEstado((e) => limpiarSensibles(e));
    }

    const desuscribir = suscribirConfig((datos) => {
      if (!datos || !datos.insumos) return;
      const f = firma(datos);
      if (f === ultimoCompartido.current) return; // es mi propio cambio, ignorar
      aplicandoRemoto.current = true;
      ultimoCompartido.current = f;
      setEstado((e) => aplicarCompartido(e, datos));
    });
    return () => { vivo = false; desuscribir(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accesoOk]);

  // Guardado automatico: local siempre; lo compartido va a la nube (si cambio).
  useEffect(() => {
    guardar(estado); // localStorage: respaldo y datos de cada quien
    if (aplicandoRemoto.current) { aplicandoRemoto.current = false; return; }
    const comp = compartidoSeguro(estado);
    const f = firma(comp);
    if (f === ultimoCompartido.current) return; // no cambio lo compartido
    ultimoCompartido.current = f;
    if (!veCostos) return;   // un vendedor no escribe precios ni parametros
    if (timerNube.current) clearTimeout(timerNube.current);
    timerNube.current = setTimeout(() => {
      escribirConfig(comp).then(() => setNubeEstado('conectado')).catch(() => setNubeEstado('sin-conexion'));
    }, 600);
  }, [estado, veCostos]);

  // Guardado de la boveda: solo Direccion, y solo si cambio.
  useEffect(() => {
    if (!accesoOk || !esDireccion) return;
    const d = soloDireccion(estado);
    const f = firmaDir(d);
    if (!ultimoDireccion.current) { ultimoDireccion.current = f; return; }
    if (f === ultimoDireccion.current) return;
    ultimoDireccion.current = f;
    const t = setTimeout(() => { escribirDireccion(d).catch(() => {}); }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accesoOk, esDireccion, estado.parametros, estado.finanzas]);

  // Convierte renglones costeados de la IA en partidas de cotización.
  function partidasDeItemsIA(costados) {
    return costados.map((c) => ({
      id: idNuevo('p'), piezaId: `linea-${c.producto}`, nombre: c.nombre,
      ruta: c.ruta || null, productoId: c.producto || null, w: c.w || null, d: c.d || null,
      cantidad: c.cantidad, costoUnitario: c.costoUnitario, precioUnitario: c.precioUnitario, margen: c.margen,
      nota: c.nota || null, confianza: c.confianza || null, config: c.config || null,
      precioReal: !!c.precioReal,   // manda el sello Firme/Calibrado/Estimado
    }));
  }


  // ==========================================================================
  //  AGREGAR A LA COTIZACIÓN DESDE EL COSTEADOR DE LÍNEA / EL ASISTENTE
  //
  //  🐛 Estas dos funciones se pasaban como prop a las 23 pantallas de línea y
  //  al Asistente, pero NO EXISTÍAN. Como el identificador se evalúa al crear el
  //  JSX, y ese JSX sólo se crea cuando la pestaña activa es esa línea, el
  //  ReferenceError tumbaba App entero justo al entrar a Cotizar de línea —
  //  y en TODAS las líneas por igual. Pantalla en blanco, sin pista.
  // ==========================================================================

  // Arma la partida a partir del costeo que devuelve el costeador de línea.
  // El costo se recalcula si no vino: sin él, la utilidad y el semáforo mienten.
  function partidaDeCosteo(costeo, cantidad, precioUnitario, margen, costoUnitario) {
    const n = Math.max(1, Number(cantidad) || 1);
    let costo = costoUnitario;
    if (!Number.isFinite(costo)) {
      try { costo = calcular(costeo, n, estado.insumos, estado.parametros).costoUnitario; }
      catch (e) { costo = Number.isFinite(margen) ? precioUnitario * (1 - margen / 100) : 0; }
    }
    return {
      id: idNuevo('p'),
      piezaId: costeo.piezaId || null,
      nombre: costeo.nombre,
      ruta: costeo.ruta || null,
      productoId: costeo.productoId || null,
      w: costeo.w || null, d: costeo.d || null,
      cantidad: n,
      costoUnitario: costo,
      precioUnitario,
      margen: Number.isFinite(margen) ? margen : null,
      config: costeo.config || null,
      precioReal: !!costeo.precioReal,
    };
  }

  const sumarPartidas = (nuevas) => setEstado((e) => ({
    ...e, cotizacion: { ...e.cotizacion, partidas: [...(e.cotizacion?.partidas || []), ...nuevas] },
  }));

  // Asistente y costeador de línea sencillo: una partida.
  function agregarDesdeAsistente(costeo, cantidad, precio, margen) {
    const p = partidaDeCosteo(costeo, cantidad, precio, margen);
    sumarPartidas([p]);
    mostrarAviso(`Agregado: ${p.nombre}`);
  }

  // Módulo con add-ons (eléctrico, gaveta): el módulo va como partida y cada
  // add-on como partida aparte, que es como los cotiza Von Haucke en el papel.
  function agregarModuloAddons(costeo, cantidad, precio, margen, costoUnitario, addons) {
    const n = Math.max(1, Number(cantidad) || 1);
    const base = partidaDeCosteo(costeo, cantidad, precio, margen, costoUnitario);
    const extras = (addons || []).map((a) => ({
      id: idNuevo('p'),
      piezaId: `addon-${a.id}`,
      nombre: a.nombre,
      ruta: a.ruta || null,
      productoId: a.productoId || null,
      w: null, d: null,
      cantidad: (a.cantidad || 1) * n,
      costoUnitario: costoImplicito(a.lista),
      precioUnitario: precioDeLista(a.lista),
      margen: null,
      config: null,
    }));
    sumarPartidas([base, ...extras]);
    mostrarAviso(extras.length ? `Agregado: ${base.nombre} + ${extras.length} accesorio(s)` : `Agregado: ${base.nombre}`);
  }


  // Costear especial (modo avanzado). Mismo bug: estas tres se pasaban como prop
  // y no existían, así que "Costear especial" y "Catálogo" también morían en
  // blanco. `resultado` es el cálculo; el mueble en sí vive en `costeo`.
  function onAgregarCotizacion(resultado, precio, margen) {
    const n = Math.max(1, Number(costeo.piezas) || 1);
    sumarPartidas([{
      id: idNuevo('p'),
      piezaId: costeo.piezaId || null,
      nombre: costeo.nombre || 'Mueble a la medida',
      ruta: costeo.ruta || null,
      productoId: costeo.productoId || null,
      w: costeo.w || null, d: costeo.d || null,
      cantidad: n,
      costoUnitario: resultado?.costoUnitario ?? 0,
      precioUnitario: precio,
      margen: Number.isFinite(margen) ? margen : null,
      config: null,
    }]);
    mostrarAviso(`Agregado: ${costeo.nombre || 'mueble a la medida'}`);
  }

  // Guarda el despiece actual como pieza reutilizable del catálogo interno.
  function onGuardarPieza(resultado) {
    const id = costeo.piezaId || idNuevo('pieza');
    const pieza = { ...costeo, id, piezaId: id, costoUnitario: resultado?.costoUnitario ?? null };
    setEstado((e) => {
      const previas = e.piezas || [];
      const sinLaVieja = previas.filter((x) => (x.id || x.piezaId) !== id);
      return { ...e, piezas: [...sinLaVieja, pieza] };
    });
    setCosteo((c) => ({ ...c, piezaId: id }));
    mostrarAviso(`Guardada la pieza: ${pieza.nombre || 'sin nombre'}`);
  }

  // El catálogo carga una receta en el costeador y te lleva ahí.
  function onElegirDelCatalogo(nuevoCosteo) {
    setCosteo(nuevoCosteo);
    irA('costeador');
  }

  // Agrega renglones al proyecto SIN navegar (lo usa Voni, que maneja sus pasos).
  // `opts.reemplaza` = id del lote anterior de la IA. Al volver a interpretar
  // (por ejemplo tras contestarle a Voni) hay que QUITAR lo que puso la vez
  // pasada; si no, los muebles se agregan dos veces.
  function agregarItemsProyecto(costados, opts = {}) {
    const partidas = partidasDeItemsIA(costados).map((p) => ({ ...p, loteIA: opts.lote || null }));
    setEstado((e) => {
      const previas = e.cotizacion.partidas || [];
      const base = opts.reemplaza ? previas.filter((p) => p.loteIA !== opts.reemplaza) : previas;
      return { ...e, cotizacion: { ...e.cotizacion, partidas: [...base, ...partidas] } };
    });
    mostrarAviso(`¡Listo! ${partidas.length} mueble(s) en tu proyecto`);
  }

  // Cotizador con IA (suelto) -> agrega y navega a 'cotizacion' o 'acomodo'.
  function agregarItemsIA(costados, opts) {
    agregarItemsProyecto(costados, opts);
  }

  // Banco de precios -> agrega una partida con el precio real ya cotizado.
  function agregarDeBanco(item, cantidad) {
    const nombre = item.medidas ? `${item.nombre} (${item.medidas})` : item.nombre;
    const partida = {
      id: idNuevo('p'), piezaId: item.id, nombre,
      cantidad, costoUnitario: 0, precioUnitario: item.precio, margen: null, deBanco: true,
    };
    setEstado((e) => ({
      ...e,
      cotizacion: { ...e.cotizacion, partidas: [...(e.cotizacion.partidas || []), partida] },
    }));
  }

  const nPartidas = estado.cotizacion?.partidas?.length || 0;

  // ---- Puerta de acceso ----
  if (sesion === undefined || (sesion && permiso === undefined)) {
    return <div className="contenido" style={{ textAlign: 'center', marginTop: 70 }}><p className="gris">Un momento…</p></div>;
  }
  if (!sesion) {
    return <Login onEntrar={hacerLogin} />;
  }
  if (!permiso) {
    return (
      <div className="contenido" style={{ maxWidth: 460, marginTop: 40 }}>
        <div className="tarjeta">
          <h2>Todavía no tienes acceso</h2>
          <p className="ayuda columna-texto">Tu correo <strong>{sesion.user.email}</strong> no está en la lista. Pídele a Dirección que te dé de alta y vuelve a entrar.</p>
          <button className="boton" onClick={hacerLogout}>Salir</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="encabezado no-imprimir">
        <div className="barra-enc">
          <div className="marca" onClick={irInicio} role="button" title="Ir al inicio">
            <MarcaLogo alto={34} />
          </div>
          <div className="acciones-enc">
            {/* Carrito global: desde CUALQUIER pantalla se salta a la cotización. */}
            {nPartidas > 0 && pestania !== 'cotizacion' && (
              <button className="btn-cot" onClick={() => irA('cotizacion')} title="Ver mi cotización">
                Mi cotización <span className="btn-cot-n">{nPartidas}</span>
              </button>
            )}
            <span className="conexion" title={nubeEstado === 'conectado' ? 'Conectado: los cambios se comparten' : nubeEstado === 'sin-conexion' ? 'Sin conexión: se guarda en esta computadora' : 'Conectando…'}>
              <span className="punto" style={{ background: nubeEstado === 'conectado' ? '#3fbf8f' : nubeEstado === 'sin-conexion' ? '#B8912F' : '#8a8480' }} />
              <span className="conexion-txt">{nubeEstado === 'conectado' ? 'En línea' : nubeEstado === 'sin-conexion' ? 'Sin conexión' : '...'}</span>
            </span>
            <button className="btn-enc" onClick={() => setMostrarGuia((v) => !v)}>Guía</button>
            {esDireccion && (
              <button className="btn-enc" onClick={() => irA('usuarios')}>Usuarios</button>
            )}
            <button className="btn-enc" onClick={() => irA('contrasena')}>Contraseña</button>
            <button className="btn-enc" onClick={hacerLogout} title={sesion.user.email}>Salir</button>
          </div>
        </div>
      </header>

      <main>
        {/* Red de seguridad: un error de render ya no deja la app en blanco. */}
        <SinPantallaBlanca resetKey={pestania} onInicio={irInicio}>
        {/* Barra grande de regreso: nunca un callejon sin salida (4.2) */}
        {pestania !== 'inicio' && (
          <div className="contenido no-imprimir barra-atras" style={{ paddingBottom: 0 }}>
            <button className="boton fantasma btn-atras" onClick={atras}>‹ Atrás</button>
            <button className="boton fantasma btn-inicio-sec" onClick={irInicio} title="Ir al inicio">Inicio</button>
            {NOMBRE_VISTA[pestania] && <span className="barra-atras-t">{NOMBRE_VISTA[pestania]}</span>}
          </div>
        )}

        {/* La guía es una ventana emergente: no empuja el contenido de la página. */}
        {mostrarGuia && (
          <Guia primeraVez={!estado.onboardingVisto} onIr={cerrarGuia} onCerrar={() => cerrarGuia()}
            estado={estado} rol={esDireccion ? 'direccion' : esDiseno ? 'diseno' : 'ventas'} />
        )}
        {pestania === 'inicio' && (
          <div className="contenido"><Inicio estado={estado} onIr={irA} veCostos={veCostos} esDireccion={esDireccion} vista={inicioVista} setVista={setInicioVista} /></div>
        )}
        {pestania === 'asistente' && (
          <div className="contenido"><Asistente estado={estado} onAgregarPartida={agregarDesdeAsistente} onIr={irA} soloVentas={esVendedor} /></div>
        )}
        {pestania === 'banco' && <Banco onAgregar={agregarDeBanco} onIr={irA} />}
        {pestania === 'applt' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador APP LT" productos={APPLT_PRODUCTOS} generar={generarAppLT} onAgregar={agregarDesdeAsistente} onAgregarModulo={agregarModuloAddons} /></div>}
        {pestania === 'app' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador App" productos={APP_PRODUCTOS} generar={generarApp} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'eclipse' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Eclipse" productos={ECLIPSE_PRODUCTOS} generar={generarEclipse} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'pebble' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Pebble" productos={PEBBLE_PRODUCTOS} generar={generarPebble} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'privacy4' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Privacy 4" productos={PRIVACY4_PRODUCTOS} generar={generarPrivacy4} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'rio' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Río" productos={RIO_PRODUCTOS} generar={generarRio} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'teamspace2' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador TeamSpace II" productos={TEAMSPACE2_PRODUCTOS} generar={generarTeamspace2} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'tetris' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Tetris" productos={TETRIS_PRODUCTOS} generar={generarTetris} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'arlequin' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Arlequín" productos={ARLEQUIN_PRODUCTOS} generar={generarArlequin} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'pac' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Pac" productos={PAC_PRODUCTOS} generar={generarPac} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'via' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Vía" productos={VIA_PRODUCTOS} generar={generarVia} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'drift' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Eclipse Drift" productos={DRIFT_PRODUCTOS} generar={generarDrift} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'flex' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Flex" productos={FLEX_PRODUCTOS} generar={generarFlex} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'mox' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Mox" productos={MOX_PRODUCTOS} generar={generarMox} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'modulor' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Modulor" productos={MODULOR_PRODUCTOS} generar={generarModulor} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'luna' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Luna" productos={LUNA_PRODUCTOS} generar={generarLuna} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'accents' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Accents" productos={ACCENTS_PRODUCTOS} generar={generarAccents} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'ergo4' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Ergonova 4" productos={ERGO4_PRODUCTOS} generar={generarErgo4} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'spine' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Spine" productos={SPINE_PRODUCTOS} generar={generarSpine} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'anteo' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Anteo" productos={ANTEO_PRODUCTOS} generar={generarAnteo} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'alba' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Alba" productos={ALBA_PRODUCTOS} generar={generarAlba} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'feather' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Feather" productos={FEATHER_PRODUCTOS} generar={generarFeather} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'worklounge' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Work Lounge" productos={WORKLOUNGE_PRODUCTOS} generar={generarWorklounge} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'cirque' && <div className="contenido"><CosteadorLinea onIr={irA} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Cirque" productos={CIRQUE_PRODUCTOS} generar={generarCirque} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'especial' && (veCostos
          ? <div className="contenido"><AsistenteEspecial estado={estado} onVerDetalle={(bor) => { setCosteo({ ...costeoEnBlanco(), ...bor }); setPestania('costeador'); }} onInicio={() => setPestania('inicio')} /></div>
          : <div className="contenido"><div className="tarjeta"><p className="ayuda">Costear desde cero es para Diseño y Dirección.</p></div></div>
        )}
        {pestania === 'tablero' && (esDireccion
          ? <Tablero estado={estado} irA={setPestania} puedeVerDireccion={desbloqueado} onDireccion={null} />
          : <div className="contenido"><div className="tarjeta"><p className="ayuda">El tablero del negocio es de Dirección.</p></div></div>
        )}
        {pestania === 'costeador' && (veCostos
          ? (
            <div className="contenido">
              <Costeador estado={estado} costeo={costeo} setCosteo={setCosteo}
                onAgregarCotizacion={onAgregarCotizacion} onGuardarPieza={onGuardarPieza} />
            </div>
          )
          : <div className="contenido"><div className="tarjeta"><p className="ayuda">El modo avanzado y el costo de fabricación son para Diseño y Dirección. Usa <strong>Cotizar un mueble</strong> para el precio recomendado.</p></div></div>
        )}
        {pestania === 'catalogo' && <Catalogo estado={estado} onCargar={onElegirDelCatalogo} soloVentas={esVendedor} />}
        {pestania === 'cotizacion' && <Cotizacion estado={estado} setEstado={setEstado} soloVentas={esVendedor} onIr={irA} />}
        {pestania === 'cotizarIA' && <div className="contenido"><CotizadorIA estado={estado} onAgregarItems={agregarItemsIA} onIr={irA} verCotizacion /></div>}
        {pestania === 'voni' && (
          <Voni
            estado={estado} setEstado={setEstado} soloVentas={esVendedor} veCostos={veCostos}
            paso={voniPaso} setPaso={setVoniPaso}
            onAgregarItems={agregarItemsProyecto}
            onGuardarAcomodo={(datos, silencioso) => { setEstado((e) => ({ ...e, cotizacion: { ...e.cotizacion, acomodo: datos } })); if (!silencioso) mostrarAviso('Acomodo guardado en la propuesta'); }}
            onIr={irA}
          />
        )}
        {pestania === 'contrasena' && <CambiarContrasena email={sesion?.user?.email} recuperacion={recuperando} onListo={() => { setRecuperando(false); irInicio(); }} />}
        {pestania === 'acomodo' && <Acomodo estado={estado} onIr={irA} onGuardarAcomodo={(datos, silencioso) => { setEstado((e) => ({ ...e, cotizacion: { ...e.cotizacion, acomodo: datos } })); if (!silencioso) mostrarAviso('Acomodo guardado en la propuesta'); }} />}
        {pestania === 'precios' && (veCostos
          ? <Precios estado={estado} setEstado={setEstado} puedeVerDireccion={desbloqueado} onDireccion={null} />
          : <div className="contenido"><div className="tarjeta"><p className="ayuda">Los precios de materiales son costos y solo los ven Diseño y Dirección.</p></div></div>
        )}
        {pestania === 'usuarios' && esDireccion && <Usuarios onAviso={mostrarAviso} miCorreo={sesion?.user?.email || ''} />}
        {/* Lo que Voni sabe: lo leen todos (el motor lo aplica igual para
            todos), pero dictar o corregir una regla es de Diseño y Dirección. */}
        {pestania === 'reglas' && <Reglas puedeEditar={veCostos} />}
        </SinPantallaBlanca>
      </main>

      {aviso && <div className="toast" role="status" aria-live="polite">{aviso}</div>}
    </div>
  );
}
