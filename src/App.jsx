// ============================================================================
//  APP - encabezado, pestanias, estado global y PERMISOS POR ROL.
//  El acceso a nomina/financieros/tablero NO se pide con un PIN: lo resuelve
//  la base de datos por el correo de quien entro (tabla `permitidos`).
// ============================================================================
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import Icono from './componentes/Iconos.jsx';
import MarcaLogo from './componentes/MarcaLogo.jsx';
// Diferidos (carga bajo demanda): recharts (Tablero) y pdfjs (AsistenteEspecial) son
// los vendors más pesados y sólo los usa Dirección/Diseño en pantallas puntuales —
// no deben pesar en la carga inicial del vendedor. (ver AsistenteEspecial abajo)
const Tablero = lazy(() => import('./componentes/Tablero.jsx'));
import Costeador, { parametrosEfectivos } from './componentes/Costeador.jsx';
const Catalogo = lazy(() => import('./componentes/Catalogo.jsx'));
const Cotizacion = lazy(() => import('./componentes/Cotizacion.jsx'));
const CotizadorIA = lazy(() => import('./componentes/CotizadorIA.jsx'));
const CambiarContrasena = lazy(() => import('./componentes/CambiarContrasena.jsx'));
const Acomodo = lazy(() => import('./componentes/Acomodo.jsx'));
const Cocrear = lazy(() => import('./componentes/Cocrear.jsx'));
const Voni = lazy(() => import('./componentes/Voni.jsx'));
const Precios = lazy(() => import('./componentes/Precios.jsx'));
const Guia = lazy(() => import('./componentes/Guia.jsx'));
import SinPantallaBlanca from './componentes/SinPantallaBlanca.jsx';
import Inicio from './componentes/Inicio.jsx';
const Asistente = lazy(() => import('./componentes/Asistente.jsx'));
const AsistenteEspecial = lazy(() => import('./componentes/AsistenteEspecial.jsx'));
const Biblioteca = lazy(() => import('./componentes/Biblioteca.jsx'));
const CosteadorLinea = lazy(() => import('./componentes/CosteadorLinea.jsx'));
import { aplicarPrograma, partidaComercialDesdeConfirmado, actualizarPartidasDePrograma } from './datos/programaRealDelPlano.js';
import { reconciliarNuevasConPrograma } from './datos/reconciliarPartidas.js';
import { fusionarAcomodo } from './datos/acomodoEstado.js';
import { aplicarCompartido } from './datos/aplicarCompartido.js';
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
const Banco = lazy(() => import('./componentes/Banco.jsx'));
const Archivo = lazy(() => import('./componentes/Archivo.jsx'));
import Login from './componentes/Login.jsx';
const Usuarios = lazy(() => import('./componentes/Usuarios.jsx'));
const CargaERP = lazy(() => import('./componentes/CargaERP.jsx'));
const Reglas = lazy(() => import('./componentes/Reglas.jsx'));
import { cargarReglas } from './datos/reglas.js';
import { cargarAprendizajes } from './datos/aprendizaje.js';
import { guardarCotizacion, cargarCotizacionCompleta, paraGuardar, firmaGuardado, claveCreacionNueva } from './datos/cotizaciones.js';
import { avisoVinculosFallidos } from './datos/vinculoCosteo.js';
import {
  controlOptimistaActivo, esperadoParaGuardar, conflictoDesdeResultado, respaldoConflicto, aplicarFilaServidor,
  camposMezcla, mezclarRespaldo, resumenDiferencias, confirmacionRecuperar, confirmacionDescartar,
  leerRespaldoConflicto, guardarRespaldoConflicto, descartarRespaldoConflicto, retirarRespaldoRecuperado, ETIQUETAS_CAMPO,
  marcarConflictoAbierto, leerConflictoAbierto, CONFIRMACION_REAPLICAR,
} from './datos/conflictoGuardado.js';
import ConflictoGuardado from './componentes/ConflictoGuardado.jsx';
import RespaldoConflicto from './componentes/RespaldoConflicto.jsx';
import { totalesCotizacion } from './datos/totales.js';
import { aplicarRespaldo } from './datos/respaldo.js';
import { crearPartida } from './datos/partida.js';
import { partidaAutoritativaDeCosteo, partidaDeCosteo as partidaDeCosteoPura } from './datos/agregarCosteo.js';
import { juntarIguales, costoDeBanco, margenDeBanco } from './datos/renglonesComerciales.js';
import { identidadDeCatalogo } from './datos/precioAutorizado.js';
import { verificarEmisionViva, registrarEmisionViva } from './datos/emisionViva.js';
import { costeoVivoParaVoni, partidasLocalesVoni, economiaVoni } from './datos/contextoVoni.js';
import { normalizarRol, veCostosCosteo } from './datos/roles.js';
import { guardarRevision, snapshotEmitido } from './datos/revisiones.js';
import { cargar, guardar, razonDeArranqueEnBlanco, PARAMS_SENSIBLES } from './almacen.js';
import { leerBorradorCosteo, guardarBorradorCosteo, borrarBorradorCosteo } from './datos/borradorCosteo.js';
import { borrarBorradorPedido } from './datos/borradorPedido.js';
import { crearSeguroDobleClic, firmaAgregado } from './datos/dobleClic.js';
import { insumosCompartibles } from './datos/insumosCompartibles.js';
import { leerConfig, escribirConfig, suscribirConfig, leerDireccion, escribirDireccion, sesionActual, alCambiarSesion, entrar, salir, miPermiso, costearServidor, evaluarEmision, solicitarAprobacionSnapshot, CARRIL_RC } from './nube.js';
import { modeloParaPieza, pendientesDeCosteo } from './motor/calculo.js';
import { idNuevo } from './util.js';
import { costoImplicito, precioDeLista } from './datos/preciosVenta.js';
import { catalogoTecnicoMateriales } from './datos/materialKnowledge.js';
const Comercial = lazy(() => import('./componentes/comercial/Comercial.jsx'));
import Voni2 from './componentes/Voni2.jsx';
import { flagActivo } from './datos/flags.js';

// Rutas que son una línea de catálogo (para aprender cuáles usa cada quien).
const RUTAS_LINEA = new Set(['applt', 'app', 'via', 'rio', 'feather', 'cirque', 'spine', 'ergo4', 'alba',
  'eclipse', 'drift', 'luna', 'anteo', 'mox', 'modulor', 'tetris', 'arlequin', 'pac', 'worklounge',
  'pebble', 'accents', 'teamspace2', 'privacy4']);

const NOMBRE_VISTA = {
  comercial: 'Comercial · proyectos y propuestas',
  voni: 'Voni · asistente de proyecto',
  cocrear: 'Cocrear · de la idea al producto',
  asistente: 'Cotizar un mueble',
  banco: 'Banco de precios',
  archivo: 'Presupuestos que ya hicimos',
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
    // CUTOVER A ALBA (2026-10-02): el costo OFICIAL por defecto es Alba (sin factores a
    // mano). El 55/12 legacy ya no se siembra: así "Ver detalle" de un producto Alba no
    // se recostea en Legacy55. Mover un factor a mano = SIMULACIÓN no oficial (Costeador).
    factorDirecta: null, factorIndirecta: null, preparacionHoras: 0,
    // null = hereda margenObjetivo de la configuración canónica. Un margen sólo
    // se guarda aquí cuando el usuario lo elige explícitamente.
    margen: null,
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
    // Cierre v3: los insumos ERP elegidos a mano se quedan en ESTA computadora; no se escriben en la config de todos.
    insumos: insumosCompartibles(estado.insumos),
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

// aplicarCompartido vive en datos/aplicarCompartido.js (VH-145: conserva los insumos ERP elegidos a mano).

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
  // Renglones del programa guardados antes de CATALOG_LIST se re-evalúan al arrancar (si no, no se emiten).
  const [estado, setEstado] = useState(() => {
    const est = cargar();
    const partidas = actualizarPartidasDePrograma(est.cotizacion?.partidas);
    return partidas === est.cotizacion?.partidas ? est : { ...est, cotizacion: { ...est.cotizacion, partidas } };
  });
  const [pestania, setPestania] = useState('inicio');
  const [voniAbierto, setVoniAbierto] = useState(false);
  const [inicioVista, setInicioVista] = useState('home'); // sub-vista del Inicio (home/costear/cotizar)
  const [expedienteAbierto, setExpedienteAbierto] = useState(null); // expediente de biblioteca a reabrir en el asistente
  // COCREAR 10 (D-01): puente Cocrear → Costear → Cocrear. Lleva la semilla (nombre, medidas, materiales,
  // funciones, descripción, imagen de referencia) al asistente y la SESIÓN de Cocrear para regresar a ella
  // con el despiece (retorno). Vive aquí porque Cocrear y Costear son pantallas distintas.
  const [puenteCocrear, setPuenteCocrear] = useState(null);
  const [prodInicial, setProdInicial] = useState(null);   // producto que pidió el buscador
  // ⚠️ LA BÚSQUEDA Y EL ACORDEÓN VIVEN AQUÍ, NO EN `Inicio`. App DESMONTA
  // Inicio al navegar, así que cada "Atrás" repliega el acordeón y borra lo que
  // habías tecleado. Eran 2 toques de castigo por CADA producto extra: escoger
  // 3 costaba 15 toques en vez de 9.
  const [inicioQ, setInicioQ] = useState('');
  const [inicioGrupo, setInicioGrupo] = useState(null);
  const [nav, setNav] = useState([]);                     // historial para "Atrás"
  // Área J · R-05: el despiece del Costeo manual sobrevive una recarga/cierre (borrador en ESTA computadora,
  // datos/borradorCosteo.js). Antes vivía sólo en memoria y se perdía en silencio.
  const borradorCosteo = useRef(undefined);
  if (borradorCosteo.current === undefined) borradorCosteo.current = (() => { try { return leerBorradorCosteo(localStorage); } catch { return null; } })();
  const [costeo, setCosteo] = useState(() => (borradorCosteo.current ? { ...costeoEnBlanco(), ...borradorCosteo.current.costeo } : costeoEnBlanco()));
  const [aviso, setAviso] = useState(''); // toast "¡Listo!"
  const [voniPaso, setVoniPaso] = useState(1); // paso actual del asistente Voni (persiste al navegar)

  // Navegacion con historial: irA empuja el estado actual; atras lo restaura.
  // DESCARTAR EL PROYECTO DE UN GOLPE. Rodrigo: "si le pico al botón de 'vas a
  // la mitad' debería haber un botón de eliminar todo; si no, tengo que picarle
  // quitar y abre un pop up que dice quitar, entonces es tardado".
  // Con 34 muebles eso son 34 "quitar" MÁS 34 confirmaciones. Empezar de cero es
  // UNA decisión: se borra la cotización completa —partidas y acomodo— con UNA
  // confirmación.
  const descartarProyecto = () => {
    // EMPEZAR DE CERO = cotización NUEVA, no seguir editando la anterior.
    // Antes sólo se vaciaban las partidas y el acomodo, pero `idCotizacion`
    // seguía apuntando al registro viejo: la "nueva" cotización se guardaba
    // ENCIMA de la anterior en la biblioteca, y cliente/folio quedaban pegados.
    // Al soltar el id, el guardado automático crea un registro limpio.
    epocaCot.current += 1;        // invalida cualquier guardado en vuelo
    idCotizacion.current = null;
    ultimaFirmaNube.current = '';
    fijarConflicto(null);         // VH-148: la cotización nueva no arrastra el conflicto de la anterior
    baseNube.current = null;      // VH-148: sin versión del servidor conocida
    setEstado((e) => ({
      ...e,
      cotizacion: {
        ...e.cotizacion, partidas: [], acomodo: null, cliente: '', folio: '',
        // 21-oct: el "pedido" que interpretó Voni (programaBrief) es de ESA cotización. Se quedaba pegado y el
        // programa del siguiente plano pedía los Eclipse de la anterior ("ESCRITORIO_SOLICITADO_NO_CANONICO").
        programaBrief: null,
        // Bloque 1: el id de la nube vive en el estado (persiste al recargar). Una
        // cotización nueva = sin id y con clave de creación propia (idempotencia).
        id: null, claveCreacion: claveCreacionNueva(),
        actualizado: null,        // VH-148: sin versión conocida hasta que el servidor la devuelva
        // No arrastrar el descuento/ajustes del cliente anterior a la nueva.
        descuentoPct: 0, contingenciaPct: 0, maniobrasPct: 0, fletePct: 0,
        // E2E 2026-10-20: la propuesta nueva salía con la fecha del día en que se creó el estado del
        // navegador ("3 de octubre" el 20). Una cotización nueva lleva la fecha de HOY.
        fecha: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
      },
    }));
    setVoniPaso(1);               // y empieza en el paso 1 (Espacio), no en la Propuesta en blanco
    borrarBorradorPedido();       // el pedido a Voni de la cotización anterior no se arrastra a la nueva
    mostrarAviso('Listo: empezaste una cotización nueva, desde cero.');
  };

  // ⚠️ `irA` ahora acepta un PRODUCTO. El buscador de Inicio devuelve productos
  // (no líneas), y al tocar uno hay que abrir su línea CON ESE PRODUCTO YA
  // ESCOGIDO. Sin esto el vendedor caía en la línea con el primer producto de la
  // lista y tenía que volver a buscar el chip: el toque que se quería ahorrar.
  // ⚠️ EL ACOMODO SE GUARDA MEZCLANDO, NO REEMPLAZANDO.
  // Esto escribía `acomodo: datos` tal cual, y `datos` cambia según QUIÉN
  // guarda: el guardado automático manda `areasM` y `planReal`; el botón
  // "Guardar en la propuesta" manda sólo `areas` y `plan`; el de las escenas
  // manda `escenas`. Cada uno le borraba al otro lo suyo — se perdían los
  // metros del espacio (y el paso "esto entendí" volvía a decir "todavía no me
  // dijiste dónde va"), se perdía `planReal` de un plano REAL subido, y se
  // perdía el render de la portada del PDF.
  function guardarAcomodo(datos, silencioso) {
    // VH-109: idempotente. AcomodoBase guarda solo (600 ms) y cada guardado re-renderizaba el
    // acomodo con un objeto NUEVO del mismo contenido → AcomodoBase volvía a guardar → ciclo
    // cada ~650 ms que reiniciaba para siempre el autosave (1.5 s) a la nube: el plan nunca
    // llegaba a `cotizaciones.acomodo`. Si no cambió nada, se devuelve el MISMO estado.
    setEstado((e) => {
      const fusion = fusionarAcomodo(e.cotizacion?.acomodo, datos);
      if (fusion.sinCambios) return e;
      return { ...e, cotizacion: { ...e.cotizacion, acomodo: fusion.acomodo } };
    });
    if (!silencioso) mostrarAviso('Acomodo guardado en la propuesta');
  }

  function irA(tab, productoInicial = null) {
    setProdInicial(productoInicial);
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

  function mostrarAviso(texto, ms = 2600) {
    setAviso(texto);
    setTimeout(() => setAviso(''), ms);
  }

  // ⚠️ Si `cargar()` no pudo leer lo guardado (localStorage dañado), antes la
  // app arrancaba en blanco sin decir nada — el vendedor descubría que "perdió
  // todo" horas después, si acaso. Un toast más largo que el normal (10 s, no
  // 2.6 s): esto no es un "¡Listo!", es avisar que se perdió trabajo.
  useEffect(() => {
    const razon = razonDeArranqueEnBlanco();
    if (razon) mostrarAviso(razon, 10000);
  }, []);

  const [mostrarGuia, setMostrarGuia] = useState(() => !cargar().onboardingVisto);

  // ⚠️ `setPestania` DIRECTO NO EMPUJA AL HISTORIAL (auditoría 2026-08-19). La
  // Guía promete "nada se descompone por navegar de más — siempre hay Atrás".
  // Pero saltar de pestaña así (sin pasar por `irA`) deja "Atrás" sin saber de
  // dónde venías: toca "Atrás" y te salta una pantalla entera sin avisar.
  function cerrarGuia(tab) {
    setEstado((e) => ({ ...e, onboardingVisto: true }));
    setMostrarGuia(false);
    if (tab) irA(tab);
  }

  // ---- Sesion / acceso (control de quien entra) ----
  const [sesion, setSesion] = useState(undefined); // undefined=revisando, null=sin sesion, obj=adentro
  // Área J · R-05: cada cambio del costeo manual queda en esta computadora (sólo con sesión; al salir se borra).
  useEffect(() => {
    if (!sesion) return;
    guardarBorradorCosteo(localStorage, costeo);
  }, [costeo, sesion]);
  // …y al volver a la pantalla tras una recarga se DICE que se recuperó (una vez).
  const avisoBorradorCosteo = useRef(false);
  useEffect(() => {
    if (pestania !== 'costeador' || !borradorCosteo.current || avisoBorradorCosteo.current) return;
    avisoBorradorCosteo.current = true;
    const h = new Date(borradorCosteo.current.guardado);
    const hora = Number.isNaN(h.getTime()) ? '' : ` (de las ${h.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })})`;
    mostrarAviso(`Recuperé el costeo que tenías a medias${hora}: estaba guardado en esta computadora.`, 7000);
  }, [pestania]);

  const [permiso, setPermiso] = useState(undefined); // undefined=revisando, null=sin acceso, 'error'=no se pudo consultar, {rol,nombre}
  const [errorEntrar, setErrorEntrar] = useState('');
  const [recuperando, setRecuperando] = useState(false); // llegó por el enlace de recuperación
  const [avisoEnlace, setAvisoEnlace] = useState(''); // mensaje si el enlace de correo venía con error (p. ej. otp_expired)

  useEffect(() => {
    // ⚠️ SIN ESTO, UN sesionActual() COLGADO DEJABA LA PANTALLA EN "Un
    // momento…" PARA SIEMPRE (2026-08-20, reportado por un usuario en Safari).
    // `sesionActual()` no tenía `.catch()` ni límite de tiempo: si getSession()
    // de Supabase se cuelga (red lenta, algo que el navegador bloquea), `sesion`
    // se queda en `undefined` y la puerta de acceso (línea ~715) no sale nunca
    // de "Un momento…" — que a primera vista, con letra chica y gris, se ve
    // igual que una pantalla en blanco. Si no resuelve en 8s, se cae a "sin
    // sesión" (manda a Login, con algo que hacer) en vez de colgarse; si la
    // sesión SÍ era válida, `alCambiarSesion` la corrige sola en cuanto
    // Supabase conteste, sin que el usuario haga nada.
    // El enlace de correo (recuperación / confirmación) puede volver con error en
    // el hash: #error=access_denied&error_code=otp_expired cuando el enlace caducó
    // o ya se usó. Antes NO se decía nada: el usuario veía el Login normal sin pista
    // de por qué su enlace no funcionó (justo lo que le pasó a Rodrigo). Lo leemos,
    // mostramos un mensaje claro y limpiamos el hash para que no quede pegado.
    try {
      const h = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
      const err = h.get('error') || h.get('error_code');
      if (err) {
        const code = h.get('error_code') || '';
        setAvisoEnlace(/otp_expired|expired/i.test(code)
          ? 'Tu enlace de recuperación caducó o ya se usó. Pide uno nuevo con "¿Olvidaste tu contraseña?".'
          : (h.get('error_description') || 'El enlace de correo no es válido. Pide uno nuevo.').replace(/\+/g, ' '));
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (e) { /* hash raro: sin ruido */ }
    let resuelto = false;
    sesionActual()
      .then((s) => { resuelto = true; setSesion(s); })
      .catch(() => { resuelto = true; setSesion(null); });
    const limite = setTimeout(() => { if (!resuelto) setSesion(null); }, 8000);
    // Si llega por el enlace de "olvidé mi contraseña", Supabase avisa con
    // PASSWORD_RECOVERY: se le manda directo a poner una nueva, y ahí NO se le
    // pide la anterior (justo porque no la recuerda).
    const off = alCambiarSesion((s, evento) => {
      setSesion(s);
      if (evento === 'PASSWORD_RECOVERY') {
        setRecuperando(true);
        setPestania('contrasena');
        // Supabase ya consumió el fragmento de recovery y creó la sesión.
        // Quitamos access_token/refresh_token de la barra de direcciones para
        // que no queden en screenshots, copy/paste, historial o soporte.
        try {
          if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        } catch (_e) {}
      }
    });
    return () => { clearTimeout(limite); off(); };
  }, []);

  useEffect(() => {
    if (sesion === undefined) return;
    if (!sesion) { setPermiso(undefined); return; }
    let vivo = true;
    // Si la consulta del permiso falla (red, RLS), `miPermiso` ahora lanza en
    // vez de devolver null: null significa "no estás en la lista" y NO es lo
    // mismo que "no se pudo consultar". Sin este catch, alguien de la casa con
    // acceso de verdad vería "Todavía no tienes acceso" por un simple error de
    // red — justo el mensaje que le dice, falsamente, que le pida de alta a
    // Dirección otra vez.
    // Auto-reintento ante fallo TRANSITORIO (red intermitente, token recién
    // refrescado): un blip no debe reemplazar la app por "No se pudo verificar
    // acceso" a media demo. Hasta 3 intentos con backoff; sólo entonces se rinde.
    // Sigue siendo fail-closed: si de verdad no hay acceso (null) se respeta ya;
    // sólo los ERRORES se reintentan, y nunca conceden acceso por sí solos.
    (async () => {
      for (let intento = 1; intento <= 3 && vivo; intento++) {
        try {
          const p = await miPermiso(sesion.user.email);
          if (vivo) setPermiso(p);
          return;
        } catch (e) {
          console.error(`miPermiso (intento ${intento}/3):`, e);
          if (intento === 3) { if (vivo) setPermiso('error'); return; }
          await new Promise((r) => setTimeout(r, 1200 * intento));
        }
      }
    })();
    // Las REGLAS DE OFICIO se bajan al entrar: la circulación de 90 cm, las
    // sillas de visita, el margen mínimo. El motor las consulta en caliente, y
    // si la base no contesta se queda con los mismos valores por omisión en vez
    // de inventarse otros.
    cargarReglas();
    cargarAprendizajes();   // lo que Voni ya aprendió, para que no lo vuelva a preguntar
    return () => { vivo = false; };
  }, [sesion]);

  // ---------------------------------------------------------------------------
  //  LA COTIZACIÓN VIAJA CON EL USUARIO, NO CON EL APARATO
  //  Rodrigo: "si lo hago con mi usuario en mi celular, no me lo pone en la
  //  computadora, como si fueran 2 diferentes". Vivía en localStorage. Ahora se
  //  guarda sola en la nube, con el correo de quien entró.
  //
  //  Se guarda con RETRASO (1.5 s desde el último cambio) y NO en cada tecla:
  //  un vendedor escribiendo el nombre del cliente dispararía una escritura por
  //  letra. Y nunca bloquea: si la nube falla, se sigue cotizando igual y se
  //  reintenta al siguiente cambio.
  //
  //  ⚠️ A PROPÓSITO NO SE SOBRESCRIBE lo que estás editando con lo que venga de
  //  otro aparato. Eso borraría trabajo sin avisar. Lo de los otros aparatos
  //  aparece en "Mis cotizaciones" y se abre a mano.
  // Bloque 1 (2026-10-10, VH-034/VH-035). El id de la cotización en la nube vive en
  // `estado.cotizacion.id` y por tanto se PERSISTE con el resto del estado. Antes era
  // sólo este ref: al recargar la página nacía en null y el autosave INSERTABA otra
  // fila (673 cotizaciones, muchas duplicadas). El ref se conserva como espejo para
  // los closures async; la verdad es el estado.
  const idCotizacion = useRef(estado.cotizacion?.id ?? null);
  // Época de la cotización: sube al "empezar de cero". Un guardado en vuelo que
  // resuelva DESPUÉS no debe restaurar el id viejo sobre la cotización nueva.
  const epocaCot = useRef(0);
  // Firma de lo ÚLTIMO que el servidor confirmó. Si lo que se guardaría es idéntico,
  // no se escribe nada (ni al reabrir desde el Archivo, ni al fijar el id).
  const ultimaFirmaNube = useRef('');
  // Al reabrir desde el Archivo (o restaurar un respaldo) lo que llega ya ESTÁ en la
  // nube: se fija su firma como "último guardado" para que no se escriba nada hasta que
  // el usuario edite de verdad. (Antes era una bandera que se consumía en el siguiente
  // guardado: una edición dentro del 1.5 s del debounce se tragaba sin escribir.)
  const fijarFirmaComoGuardada = (estadoNuevo) => {
    const email = sesion?.user?.email || null;
    ultimaFirmaNube.current = firmaGuardado(paraGuardar(estadoNuevo, email));
  };
  // Una CREACIÓN en vuelo a la vez: dos creates con la misma clave pero distinto
  // contenido harían que el servidor rechace la segunda (y rotar la clave duplicaría).
  // Al resolver, fijar el id cambia `estado.cotizacion` y el autosave vuelve a correr
  // con lo más reciente, así que nada se queda sin guardar.
  const creandoEnVuelo = useRef(false);
  // Área J · R-01: cuántos guardados de la cotización van en vuelo → la cabecera dice "Guardando…" (antes, con la
  // red lenta, decía "En línea" durante 10 s aunque el cambio todavía no llegaba a la nube).
  const guardadosEnVuelo = useRef(0);
  const [guardandoNube, setGuardandoNube] = useState(false);
  const avisoNubeCaida = useRef(false);

  // VH-148 · CONTROL OPTIMISTA (detrás de bandera: VITE_CONTROL_OPTIMISTA=1 o
  // localStorage['vh:controlOptimista']='1'). La versión conocida de la cotización abierta vive en
  // `estado.cotizacion.actualizado` (la fija cotizacion_segura al abrir y cada guardado confirmado;
  // persiste con el estado, así que sobrevive recargas). Se manda TAL CUAL como
  // `p_actualizado_esperado`; si el servidor responde 40001 (otra persona guardó antes) NO se
  // reintenta ni se fusiona: lo local queda intacto, se enseña el aviso (ConflictoGuardado) y el
  // autosave queda EN PAUSA hasta que la persona escoja "Ver la versión del servidor" o "Volver a
  // aplicar mis cambios". El ref es espejo del estado para los closures del autosave (setTimeout).
  const controlOptimista = useMemo(() => controlOptimistaActivo(), []);
  const [conflicto, setConflicto] = useState(null);
  const conflictoRef = useRef(null);
  const [resolviendoConflicto, setResolviendoConflicto] = useState(false);
  // P1-REL-02: el conflicto abierto se marca en esta computadora para que sobreviva a recargar (ver efecto de abajo).
  const fijarConflicto = (c, id = idCotizacion.current) => {
    conflictoRef.current = c; setConflicto(c);
    // La marca lleva la BASE de la fusión (lo que esta pestaña sabía del servidor): si se recarga a media resolución, el
    // respaldo que se haga después sigue sabiendo qué cambió la persona (sin base, todo sería "choque").
    if (controlOptimistaActivo()) marcarConflictoAbierto(typeof localStorage === 'undefined' ? null : localStorage, id ?? null, c ? { ...c, base: baseNube.current } : null);
  };
  // VH-148 · BASE de la fusión de tres vías: lo que esta pestaña sabe que está en el servidor (campos
  // comparables de la cotización al abrirla, al cargar la versión del servidor y tras cada guardado
  // confirmado). Viaja dentro del respaldo de conflicto para que "Recuperar mis cambios" sepa qué
  // campos cambió la persona. No persiste al recargar: sin base, la recuperación trata todo campo
  // distinto como choque y pide confirmación (documento completo).
  const baseNube = useRef(null);
  // VH-148 · el respaldo de conflicto de la cotización abierta (localStorage). `versionRespaldo` se
  // incrementa tras escribir/retirar para releerlo. `recuperandoRef` frena el autosave mientras
  // "Recuperar mis cambios" está guardando (evita un segundo envío con la versión ya vieja).
  const [versionRespaldo, setVersionRespaldo] = useState(0);
  const recuperandoRef = useRef(false);
  const idAbierta = estado.cotizacion?.id ?? null;
  // Porcentajes EFECTIVOS (los que se guardan en `totales`): local puede tener `ivaPct` vacío = "el de
  // parámetros" y el servidor guarda 16; comparados crudos serían cambios fantasma.
  const normalizarPct = (cot) => {
    const c = cot || {};
    const t = totalesCotizacion(c.partidas || [], c, estado.parametros || {});
    return { ...c, descuentoPct: t.descuentoPct, contingenciaPct: t.contingenciaPct, maniobrasPct: t.maniobrasPct, fletePct: t.fletePct, ivaPct: t.ivaPct, anticipoPct: t.anticipoPct };
  };
  const comparables = (cot) => camposMezcla(normalizarPct(cot));
  const respaldoActual = useMemo(() => {
    if (!controlOptimista || idAbierta == null) return null;
    try { return leerRespaldoConflicto(localStorage, idAbierta); } catch { return null; }
  }, [controlOptimista, idAbierta, versionRespaldo]);   // versionRespaldo: releer tras escribir/retirar

  // ÚNICA PUERTA de guardado a la nube (autosave, verificar emisión, emitir).
  // Devuelve el resultado de guardarCotizacion y mantiene id/clave/firma coherentes.
  // `reaplicar` (VH-148): la persona pidió volver a aplicar lo suyo encima de la versión del
  // servidor; `esperado` es esa versión fresca (del error 40001 o de recargar la fila).
  // `estadoForzado` (VH-148, recuperar el respaldo): el estado ya mezclado que se acaba de fijar con
  // setEstado y que el closure de este render todavía no ve.
  async function guardarEnNube({ reaplicar = false, esperado = undefined, estadoForzado = null } = {}) {
    if (!sesion?.user?.email) return { id: idCotizacion.current, guardado: false, motivo: 'sin-sesion' };
    // Con un conflicto sin resolver nada se guarda solo (ni autosave ni emisión): la decisión es de la persona.
    if (conflictoRef.current && !reaplicar) return { id: idCotizacion.current, guardado: false, motivo: 'conflicto-pendiente' };
    // Mientras "Recuperar mis cambios" guarda, nadie más manda nada (ese guardado ES el de este estado).
    if (recuperandoRef.current && !estadoForzado) return { id: idCotizacion.current, guardado: false, motivo: 'en-vuelo' };
    const est = estadoForzado || estado;
    const epoca = epocaCot.current;
    const fila = paraGuardar(est, sesion.user.email);
    if (!fila.partidas.length) return { id: idCotizacion.current, guardado: false, motivo: 'vacia' };
    const firma = firmaGuardado(fila);
    if (idCotizacion.current && firma === ultimaFirmaNube.current) {
      return { id: idCotizacion.current, guardado: true, sinCambios: true };
    }
    let clave = est.cotizacion?.claveCreacion;
    if (!idCotizacion.current) {
      if (creandoEnVuelo.current) return { id: null, guardado: false, motivo: 'en-vuelo' };
      if (!clave) {
        clave = claveCreacionNueva();
        setEstado((e) => ({ ...e, cotizacion: { ...e.cotizacion, claveCreacion: clave } }));
      }
      creandoEnVuelo.current = true;
    }
    let r;
    guardadosEnVuelo.current += 1; setGuardandoNube(true);
    try {
      // VH-148: la versión desde la que se edita (o la fresca, al volver a aplicar). Sólo viaja con la
      // bandera prendida y una versión conocida; si no, la llamada es la de siempre (dos argumentos).
      const version = reaplicar ? esperado : est.cotizacion?.actualizado;
      r = await guardarCotizacion(est, sesion.user.email, idCotizacion.current, {
        claveCreacion: clave,
        actualizadoEsperado: esperadoParaGuardar(version, controlOptimista),
      });
    } finally {
      creandoEnVuelo.current = false;
      guardadosEnVuelo.current = Math.max(0, guardadosEnVuelo.current - 1);
      if (!guardadosEnVuelo.current) setGuardandoNube(false);
    }
    // Se empezó de cero mientras guardaba: NADA de lo guardado vale para la cotización viva.
    if (epocaCot.current !== epoca) return { id: null, guardado: false, motivo: 'epoca' };
    // VH-148: otra persona guardó antes. Lo local NO se toca; se enseña el aviso y se pausa el autosave.
    if (r.motivo === 'conflicto') {
      fijarConflicto(conflictoDesdeResultado(r));
      setNubeEstado('conectado');   // la nube respondió: no es un problema de red
      return r;
    }
    // AVISO CLARO cuando la nube no recibe la cotización (antes fallaba en silencio y el
    // vendedor creía que estaba guardado). El punto del encabezado pasa a "Sin conexión"
    // y se avisa UNA vez por racha; al volver, el punto regresa a "En línea".
    // VH-173: la nube respondió pero RECHAZÓ la cotización. No es "sin conexión": se dice el motivo y que el trabajo
    // sigue sólo en esta computadora (no se reintenta en silencio como si fuera la red).
    // Área J · R-07: la sesión ya no sirve. No es la red ni una fila ajena: se dice, se conserva el id y lo local,
    // y al volver a entrar el siguiente guardado va a LA MISMA cotización.
    if (r.motivo === 'sesion') {
      setNubeEstado('rechazado');
      if (!avisoNubeCaida.current) {
        avisoNubeCaida.current = true;
        mostrarAviso('Tu sesión expiró o ya no es válida: la cotización NO se guardó en la nube. Sigue en esta computadora; sal y vuelve a entrar para guardarla.', 12000);
      }
    } else if (r.motivo === 'rechazado') {
      setNubeEstado('rechazado');
      if (!avisoNubeCaida.current) {
        avisoNubeCaida.current = true;
        mostrarAviso(`La nube no aceptó la cotización (${r.detalle || 'motivo no informado'}). Sigue guardada SÓLO en esta computadora: avisa a soporte antes de cerrar.`, 12000);
      }
    } else if (r.motivo === 'red' || r.motivo === 'desconocido') {
      setNubeEstado('sin-conexion');
      if (!avisoNubeCaida.current) {
        avisoNubeCaida.current = true;
        mostrarAviso('No se pudo guardar la cotización en la nube. Sigue guardada en esta computadora; se reintenta solo al siguiente cambio.', 8000);
      }
    } else if (r.guardado) {
      if (avisoNubeCaida.current) mostrarAviso('Conexión recuperada: la cotización ya está guardada en la nube.', 5000);
      avisoNubeCaida.current = false;
      setNubeEstado('conectado');
      // SEG-01c · P1-03: un costo especial sin vínculo del servidor no se podrá emitir; se dice ahora, no al emitir.
      const avisoVinculo = avisoVinculosFallidos(r.vinculosFallidos);
      if (avisoVinculo) mostrarAviso(avisoVinculo, 12000);
    }
    if (r.guardado && r.id) {
      ultimaFirmaNube.current = firma;
      baseNube.current = comparables(est.cotizacion);   // VH-148: esto es lo que ahora está en el servidor
      if (reaplicar) fijarConflicto(null);   // VH-148: lo local ya quedó encima de la versión del servidor
      // VH-148: la versión que el servidor acaba de escribir (null con la RPC vieja → sin control
      // en el siguiente guardado). Se escribe SIEMPRE para no arrastrar una versión rancia.
      const actualizado = r.actualizado ?? null;
      if (idCotizacion.current !== r.id || (est.cotizacion?.actualizado ?? null) !== actualizado) {
        idCotizacion.current = r.id;
        setEstado((e) => ({ ...e, cotizacion: { ...e.cotizacion, id: r.id, actualizado } }));
      }
    } else if (r.soltarId) {
      // La fila es de otro usuario o ya no existe (p. ej. otro vendedor usó este
      // navegador): se olvida el id y la siguiente escritura crea una propia.
      idCotizacion.current = null;
      ultimaFirmaNube.current = '';
      baseNube.current = null;
      setEstado((e) => ({ ...e, cotizacion: { ...e.cotizacion, id: null, claveCreacion: claveCreacionNueva(), actualizado: null } }));
    } else if (r.rotarClave) {
      setEstado((e) => ({ ...e, cotizacion: { ...e.cotizacion, claveCreacion: claveCreacionNueva() } }));
    }
    return r;
  }

  // VH-148 · las DOS salidas explícitas del conflicto. Ninguna fusiona nada.
  // 1) Ver la versión del servidor: primero se respalda lo local en esta computadora
  //    (localStorage `costeador-vonhaucke-conflicto-<id>`), luego se carga la fila del servidor.
  async function verVersionDelServidor() {
    const c = conflictoRef.current;
    if (!c) return;
    const id = idCotizacion.current ?? estado.cotizacion?.id ?? null;
    setResolviendoConflicto(true);
    try {
      // Se apila sobre un respaldo anterior sin resolver (nunca se pisa) y lleva la base para la
      // recuperación campo por campo.
      let respaldado = false;
      try { respaldado = guardarRespaldoConflicto(localStorage, id, respaldoConflicto(estado, c, { base: baseNube.current })); }
      catch (e) { console.error('[VH-148] no se pudo respaldar lo local antes de cargar el servidor:', e); }
      if (!respaldado) {
        // Sin respaldo NO se carga el servidor: se perdería lo local. La persona puede "Volver a aplicar".
        mostrarAviso('No se pudo guardar una copia de tus cambios en esta computadora; no se cargó la versión del servidor. Tus cambios siguen en pantalla.', 8000);
        return;
      }
      setVersionRespaldo((v) => v + 1);
      const full = id != null ? await cargarCotizacionCompleta(id) : null;
      if (!full) { mostrarAviso('No se pudo leer la versión del servidor. Tus cambios siguen en esta computadora; intenta de nuevo.', 7000); return; }
      epocaCot.current += 1;   // invalida guardados en vuelo de lo local
      const cot = aplicarFilaServidor(estado.cotizacion, full);
      fijarFirmaComoGuardada({ ...estado, cotizacion: cot });   // lo que llega YA está en la nube: no se reescribe
      baseNube.current = comparables(cot);
      setEstado((e) => ({ ...e, cotizacion: cot }));
      fijarConflicto(null);
      mostrarAviso('Se cargó la versión del servidor. Tus cambios quedaron respaldados en esta computadora.', 7000);
    } finally {
      setResolviendoConflicto(false);
    }
  }
  // 3) Recuperar mis cambios (desde el respaldo): se RELEE la versión actual del servidor, se aplica
  //    el respaldo encima con la fusión de tres vías por campo (conflictoGuardado.js · mezclarRespaldo)
  //    y se guarda con el `actualizado` recién leído. Si eso reemplaza algo que la otra persona también
  //    cambió, se pide confirmación. El respaldo se retira SÓLO si el servidor confirmó el guardado.
  async function recuperarMisCambios() {
    const resp = respaldoActual;
    const id = idCotizacion.current ?? estado.cotizacion?.id ?? null;
    if (!resp || id == null || conflictoRef.current) return;
    setResolviendoConflicto(true);
    recuperandoRef.current = true;
    try {
      const full = await cargarCotizacionCompleta(id);
      if (!full) { mostrarAviso('No se pudo leer la versión actual del servidor. Tu respaldo sigue en esta computadora; intenta de nuevo.', 7000); return; }
      const servidorCot = aplicarFilaServidor(estado.cotizacion, full);
      const mezcla = mezclarRespaldo({ base: resp.base ?? null, local: resp.cotizacion, servidor: servidorCot, normalizar: normalizarPct });
      if (!mezcla.aplicados.length) {
        // Nada que aplicar: el servidor ya tiene todo lo del respaldo (no se pierde información).
        retirarRespaldoRecuperado(localStorage, id, { guardado: true });
        setVersionRespaldo((v) => v + 1);
        mostrarAviso('Tu respaldo ya coincidía con la versión del servidor; se retiró de esta computadora.', 6000);
        return;
      }
      const pregunta = confirmacionRecuperar(mezcla);
      if (pregunta && !confirm(pregunta)) return;   // la persona no aceptó reemplazar lo ajeno: nada cambia
      epocaCot.current += 1;   // invalida cualquier guardado en vuelo de lo que había en pantalla
      const nuevo = { ...estado, cotizacion: { ...servidorCot, ...mezcla.cotizacion, actualizado: servidorCot.actualizado } };
      setEstado(nuevo);
      const r = await guardarEnNube({ estadoForzado: nuevo });
      if (r.guardado) {
        retirarRespaldoRecuperado(localStorage, id, r);
        setVersionRespaldo((v) => v + 1);
        const campos = mezcla.aplicados.map((k) => ETIQUETAS_CAMPO[k] || k).join(', ');
        mostrarAviso(`Listo: recuperaste tus cambios (${campos}) encima de la versión del servidor. El respaldo se retiró de esta computadora.`, 7000);
      } else if (r.motivo !== 'conflicto') {
        mostrarAviso(`No se pudo guardar lo recuperado (${r.motivo || 'sin detalle'}). Tu respaldo sigue en esta computadora.`, 7000);
      }
      // motivo 'conflicto': alguien guardó entre la lectura y el guardado → reaparece el aviso; el respaldo se queda.
    } finally {
      recuperandoRef.current = false;
      setResolviendoConflicto(false);
    }
  }
  // 4) Descartar mi respaldo: SÓLO con confirmación explícita.
  function descartarMiRespaldo() {
    const id = idCotizacion.current ?? estado.cotizacion?.id ?? null;
    if (id == null) return;
    const ok = descartarRespaldoConflicto(localStorage, id, (r) => confirm(confirmacionDescartar(r)));
    if (ok) {
      setVersionRespaldo((v) => v + 1);
      mostrarAviso('Respaldo descartado. En pantalla sigue la versión del servidor.', 5000);
    }
  }
  // Lo que difiere entre el respaldo y lo que está en pantalla (la versión del servidor), y qué haría
  // "Recuperar" (vista previa; al pulsar se recalcula contra la versión más reciente del servidor).
  const totalDe = (cot) => totalesCotizacion(cot?.partidas || [], cot || {}, estado.parametros || {}).totalRedondeado;
  const filasRespaldo = respaldoActual ? resumenDiferencias(respaldoActual.cotizacion, estado.cotizacion, { totalDe, normalizar: normalizarPct }) : [];
  const mezclaRespaldo = respaldoActual ? mezclarRespaldo({ base: respaldoActual.base ?? null, local: respaldoActual.cotizacion, servidor: estado.cotizacion, normalizar: normalizarPct }) : null;
  // 2) Volver a aplicar mis cambios: UN clic explícito re-guarda lo local con la versión fresca del
  //    servidor. Si alguien volvió a guardar en medio, el aviso reaparece con la hora nueva (sin bucle).
  async function reaplicarMisCambios() {
    const c = conflictoRef.current;
    if (!c) return;
    // P1-REL-02: reemplaza lo de la otra persona con el documento completo: sólo con confirmación explícita.
    if (!confirm(CONFIRMACION_REAPLICAR)) return;
    setResolviendoConflicto(true);
    try {
      let esperado = c.actualizadoServidor;
      if (!esperado && idCotizacion.current) esperado = (await cargarCotizacionCompleta(idCotizacion.current))?.actualizado ?? null;
      const r = await guardarEnNube({ reaplicar: true, esperado });
      if (r.guardado) mostrarAviso('Listo: tus cambios quedaron guardados encima de la versión del servidor.', 5000);
      else if (r.motivo !== 'conflicto') mostrarAviso(`No se pudo volver a guardar (${r.motivo || 'sin detalle'}). Tus cambios siguen en esta computadora.`, 7000);
    } finally {
      setResolviendoConflicto(false);
    }
  }

  // P1-REL-02 · recargar con un conflicto SIN RESOLVER: antes lo local se reenviaba, el aviso reaparecía y la versión del
  // servidor no se mostraba. Ahora, con la sesión lista, se respalda lo local y se carga la versión del servidor (lo mismo
  // que "Ver la versión del servidor"); recuperar lo propio sigue siendo una decisión explícita (tarjeta de respaldo).
  const conflictoRecargaHecho = useRef(false);
  useEffect(() => {
    if (!controlOptimista || conflictoRecargaHecho.current || !sesion?.user?.email) return;
    const id = idCotizacion.current ?? estado.cotizacion?.id ?? null;
    let pendiente = null;
    try { pendiente = leerConflictoAbierto(localStorage, id); } catch { pendiente = null; }
    if (!pendiente) return;
    conflictoRecargaHecho.current = true;
    if (!baseNube.current && pendiente.base) baseNube.current = pendiente.base;   // la base sobrevive a la recarga
    if (!conflictoRef.current) { conflictoRef.current = pendiente; setConflicto(pendiente); }
    verVersionDelServidor().then(() => {
      if (!conflictoRef.current) mostrarAviso('Recargaste con un conflicto sin resolver: en pantalla está la versión del servidor y tus cambios quedaron respaldados en esta computadora.', 9000);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlOptimista, sesion?.user?.email, idAbierta]);

  // Cambió la persona (salir / entrar otro correo): lo "ya guardado" era de la sesión
  // anterior. Se olvida la firma para que el siguiente guardado vaya al servidor y éste
  // decida (p. ej. 'sin acceso' → se suelta el id y se crea una propia, sin pisar la ajena).
  useEffect(() => {
    ultimaFirmaNube.current = '';
    avisoNubeCaida.current = false;
  }, [sesion?.user?.email]);

  useEffect(() => {
    if (!sesion?.user?.email) return;
    const n = estado.cotizacion?.partidas?.length || 0;
    if (!n) return;
    const t = setTimeout(() => { guardarEnNube(); }, 1500);
    return () => clearTimeout(t);
  }, [estado.cotizacion, sesion]);

  // AL EMITIR (PDF/impresión): se asegura de guardar la cotización viva y congela
  // una REVISIÓN inmutable de lo ofrecido (evidencia con fecha y responsable). No
  // duplica si no cambió nada; nunca rompe la emisión si la nube falla.
  // Gate de emisión AUTORITATIVO (server-side): guarda la cotización para tener id
  // real y consulta `cotizacion_emitible`. Devuelve {ok, estado, motivos, economics}.
  // Degrada suave: si no hay sesión o falla, no bloquea (el servidor re-gatea al emitir).
  // Lógica pura en datos/emisionViva.js (probada por comportamiento en liveQuoteEmissionGate.test.js):
  // sólo se gatea lo que SÍ quedó guardado, sobre el MISMO snapshot que se emitirá (VH-055).
  function verificarEmision() {
    return verificarEmisionViva({
      haySesion: !!sesion?.user?.email, guardarEnNube, evaluarEmision,
      snapshot: () => snapshotEmitido(estado),
    });
  }

  // VH-055: pedir aprobación a Dirección sobre la versión EXACTA que se va a emitir.
  async function solicitarAprobacion(motivo) {
    if (!sesion?.user?.email) return { ok: false, error: 'Inicia sesión para solicitar aprobación.' };
    try {
      const g = await guardarEnNube();
      if (!g.id) return { ok: false, error: g.motivo || 'No se pudo guardar la cotización.' };
      return await solicitarAprobacionSnapshot(g.id, snapshotEmitido(estado), motivo);
    } catch (e) { return { ok: false, error: String(e?.message || e) }; }
  }

  // datos/emisionViva.js: la revisión inmutable se congela contra el id del guardado VIVO confirmado.
  function onEmitida() {
    return registrarEmisionViva({
      haySesion: !!sesion?.user?.email, guardarEnNube, guardarRevision, estado,
      alNuevaRevision: (r) => mostrarAviso(`Revisión ${r.revision} guardada — se conservó lo que se emitió.`),
    });
  }

  // permiso === 'error' (no se pudo consultar) NO cuenta como acceso: sin este
  // descarte, el efecto de sincronización con la nube (más abajo, depende de
  // accesoOk) arrancaría igual que si el permiso sí se hubiera confirmado.
  const accesoOk = !!sesion && !!permiso && permiso !== 'error';
  // VH-054: los booleanos de rol salen de datos/roles.js (espejo del servidor).
  const rolNorm = normalizarRol(permiso?.rol);
  const esDireccion = rolNorm === 'direccion';
  const esDiseno = rolNorm === 'diseno';
  // Diseno y Direccion ven costos (para despiece). Todo lo demas es vendedor: solo precio recomendado.
  const esVendedor = rolNorm === 'vendedor';
  // Puede ver el costo de fabricacion (Costeador, Precios de material, HojaCosto).
  const veCostos = esDireccion || esDiseno;   // = veCostosCosteo(rolNorm): una sola verdad de quién ve costos
  // Catálogo técnico seller-safe: VONI puede conocer formatos/unidades/materiales
  // sin recibir precios ni costos, incluso para vendedores.
  const materialesTecnicosVoni = useMemo(
    () => catalogoTecnicoMateriales(estado?.insumos || {}),
    [estado?.insumos],
  );

  // VONI mira EXACTAMENTE el mismo resultado vivo que Costeador. No existe un
  // "costeo para IA" paralelo. Si no hay BOM o el rol no ve economía, no se crea.
  // Lógica pura en datos/contextoVoni.js (probada en voniLiveCosting.test.js).
  const voniCosting = useMemo(() => costeoVivoParaVoni({ veCostos, estado, costeo }), [veCostos, estado, costeo]);
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
    borrarBorradorCosteo(localStorage);   // R-05: el borrador técnico no se queda en una computadora sin sesión
    borrarBorradorPedido();               // el pedido a Voni a medio escribir tampoco (datos/borradorPedido.js)
    setPestania('inicio');
    // Al salir se borra de esta computadora todo lo de Direccion.
    setEstado((e) => limpiarSensibles(e));
  }

  // ---- Nube (datos compartidos) ----
  const [nubeEstado, setNubeEstado] = useState('conectando'); // conectando | conectado | sin-conexion | rechazado (VH-173)
  // Área J · R-09: al VOLVER la red se reintenta el guardado solo (evento 'online' y, mientras siga "Sin conexión",
  // cada 30 s). Antes la cotización se quedaba sólo en esta computadora hasta que la persona editara otra cosa.
  const guardarEnNubeRef = useRef(null);
  guardarEnNubeRef.current = guardarEnNube;
  useEffect(() => {
    if (nubeEstado !== 'sin-conexion' || !sesion?.user?.email) return;
    const reintentar = () => { guardarEnNubeRef.current?.(); };
    window.addEventListener('online', reintentar);
    const t = setInterval(reintentar, 30000);
    return () => { window.removeEventListener('online', reintentar); clearInterval(t); };
  }, [nubeEstado, sesion]);
  const aplicandoRemoto = useRef(false);   // true = el cambio vino de la nube, no re-subir
  const ultimoCompartido = useRef('');     // JSON de lo ultimo compartido, para no reescribir igual
  const timerNube = useRef(null);
  // VH-088: un insumo elegido a mano del catálogo grande (ERP) entra al mapa del motor local para
  // que el costeo en pantalla coincida con el del servidor (que lo resuelve por id).
  const agregarInsumoCatalogo = (ins) => {
    if (!ins || !ins.id) return;
    setEstado((e) => (e.insumos && e.insumos[ins.id] ? e : { ...e, insumos: { ...e.insumos, [ins.id]: ins } }));
  };
  const ultimoDireccion = useRef('');   // firma de la boveda, para no reescribir igual
  const avisoGuardadoLocal = useRef(false); // ya se avisó que localStorage no guarda (no repetir en cada tecla)

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
        setNubeEstado('conectado');
      } else {
        // Nube vacia: subir la semilla para inicializarla. El punto "En
        // línea" solo debe encenderse si esta subida inicial de verdad
        // funcionó, no solo porque la lectura anterior no truene.
        setEstado((e) => {
          const comp = compartidoSeguro(e);
          ultimoCompartido.current = firma(comp);
          escribirConfig(comp)
            .then(() => { if (vivo) setNubeEstado('conectado'); })
            .catch(() => { if (vivo) setNubeEstado('sin-conexion'); });
          return e;
        });
      }
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
      }).catch(() => {
        if (vivo) mostrarAviso('No se pudo cargar la información financiera de Dirección. Reintenta o revisa tu conexión.', 6000);
      });
    } else {
      setEstado((e) => limpiarSensibles(e));
    }

    // La suscripción en vivo a `config` trae precios/costos de insumos: SOLO para
    // quien ve costos (Dirección/Diseño). El vendedor no la necesita y, tras el
    // cierre de RLS de config, tampoco podría leerla. Para el vendedor es no-op.
    // VH-088: el payload en vivo trae la fila cruda de `config` (insumos de la foto), no el catálogo.
    // Se usa sólo como SEÑAL y se vuelve a leer por la RPC, que arma los insumos desde el catálogo.
    const desuscribir = veCostos ? suscribirConfig(() => {
      leerConfig().then((datos) => {
        if (!vivo || !datos || !datos.insumos) return;
        const f = firma(datos);
        if (f === ultimoCompartido.current) return; // es mi propio cambio, ignorar
        aplicandoRemoto.current = true;
        ultimoCompartido.current = f;
        setEstado((e) => aplicarCompartido(e, datos));
      }).catch(() => {});
    }) : () => {};
    return () => { vivo = false; desuscribir(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accesoOk]);

  // Guardado automatico: local siempre; lo compartido va a la nube (si cambio).
  useEffect(() => {
    // ⚠️ `guardar()` puede fallar (cuota llena, modo privado que bloquea
    // localStorage) y antes eso pasaba callado: "Guardado automático en cada
    // cambio" es la promesa de 4.5 "Nada se pierde", así que si esta
    // computadora dejó de cumplirla hay que decirlo, no fingir que se guardó.
    // Una sola vez por sesión: si sigue roto, no tiene caso repetirlo en cada
    // tecla — y la cotización SIGUE viajando a la nube si hay sesión, así que
    // no todo se pierde.
    if (!guardar(estado) && !avisoGuardadoLocal.current) {
      avisoGuardadoLocal.current = true;
      mostrarAviso('Esta computadora no está guardando tus cambios localmente (memoria llena o modo privado). Si tienes sesión, sigue viajando a la nube.', 8000);
    }
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
    // Los precios/parámetros de Dirección son núcleo del costeo: si el guardado
    // falla y nadie se entera, Dirección los ve en pantalla pero no quedan en la
    // nube. Se refleja en el mismo indicador de conexión que el resto.
    const t = setTimeout(() => {
      escribirDireccion(d)
        .then(() => setNubeEstado('conectado'))
        .catch((e) => { console.error('[bóveda Dirección] no se guardó:', e); setNubeEstado('sin-conexion'); });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accesoOk, esDireccion, estado.parametros, estado.finanzas]);

  // Convierte renglones costeados de la IA en partidas de cotización.
  // VH-044: TODO renglón nace por el contrato único (datos/partida.js). Aquí sólo se
  // traduce lo que trae cada camino; el contrato unifica nombres, decide qué economía
  // viaja según el rol y conserva la identidad de Producto Maestro (antes este camino
  // la tiraba: una partida de Voni llegaba a la cotización sin producto_id).
  function partidasDeItemsIA(costados) {
    return costados.map((c) => crearPartida({
      ...c,
      piezaId: c.producto ? `linea-${c.producto}` : (c.piezaId ?? null),
      productoId: c.producto || c.productoId || null,
      nombresExcluidos: Array.isArray(c.nombresExcluidos) ? c.nombresExcluidos
        : (c.componentes || []).filter((x) => x && x.excluida).map((x) => x.nombre || 'Partida excluida'),
    }, { veCostos, origen: c.deBanco ? 'banco' : 'ia' }));
  }

  // Lógica pura en datos/agregarCosteo.js (probada por comportamiento: lineItemCostFailClosed.test.js).
  // VENDEDOR: no corre el motor ni siembra costo/margen. Quien ve costos: si el motor falla, el costo
  // queda DESCONOCIDO (FAIL-CLOSED), nunca derivado del precio ni $0.
  function partidaDeCosteo(costeo, cantidad, precioUnitario, margen, costoUnitario) {
    return partidaDeCosteoPura({
      costeo, cantidad, precioUnitario, margen, costoUnitario,
      veCostos, insumos: estado.insumos, parametros: estado.parametros,
    });
  }

  const sumarPartidas = (nuevas) => setEstado((e) => ({
    ...e, cotizacion: { ...e.cotizacion, partidas: [...(e.cotizacion?.partidas || []), ...nuevas] },
  }));

  // P0.1 · "Aplicar programa detectado": confirma la PROPUESTA contra lo ya
  // cotizado (reconcilia, idempotente) y agrega SÓLO las partidas nuevas como
  // PARTIDAS COMERCIALES canónicas (adapter dedicado, NO partidaDeCosteo). El
  // precio es snapshot de DISPLAY (nunca $0, nunca firme); el servidor lo revalida.
  //
  // ATÓMICO (#8): la reconciliación corre DENTRO de setEstado(prev=>...), así dos
  // clicks seguidos (antes del rerender) ven el estado ya actualizado por el
  // primero → el segundo reconcilia y no duplica. `aplicandoPrograma` evita reentradas.
  const aplicandoProgramaRef = useRef(false);
  function aplicarProgramaDetectado(propuesta, opts = {}) {
    if (!propuesta) return { confirmadas: 0, conflictos: [], pendientes: [] };
    // VH-091: `opts.sustituir` = slots cuyo conflicto la persona resolvió a favor del propuesto.
    const sustituir = Array.isArray(opts.sustituir) ? opts.sustituir : [];
    const mantenerAmbos = Array.isArray(opts.mantenerAmbos) ? opts.mantenerAmbos : [];
    const repartir = Array.isArray(opts.repartir) ? opts.repartir : [];
    const roles = opts.roles && typeof opts.roles === 'object' ? opts.roles : {};
    const destinos = opts.destinos && typeof opts.destinos === 'object' ? opts.destinos : {};
    const decisiones = opts.decisiones && typeof opts.decisiones === 'object' ? opts.decisiones : {};
    // Piloto automático: `opts.sinNuevas` = sólo fusiona duplicados y vincula lo ya descrito; NO agrega
    // productos nuevos al proyecto (agregar renglones comerciales sigue siendo decisión de la persona).
    const sinNuevas = opts.sinNuevas === true;
    // P1: recomendaciones de casa agregadas por línea (claves); nunca entran solas.
    const incluir = Array.isArray(opts.incluir) ? opts.incluir : [];
    // Vista para la UI (contra el estado actual): conflictos y pendientes a mostrar.
    const vista = aplicarPrograma(propuesta, { existentes: estado.cotizacion?.partidas || [], sustituir, mantenerAmbos, repartir, roles, destinos, incluir });
    if (aplicandoProgramaRef.current) {
      return { confirmadas: 0, conflictos: vista.conflictos || [], pendientes: propuesta.pendientes || [] };
    }
    aplicandoProgramaRef.current = true;
    setEstado((prev) => {
      const existentes0 = prev.cotizacion?.partidas || [];
      const { confirmacion } = aplicarPrograma(propuesta, { existentes: existentes0, sustituir, mantenerAmbos, repartir, roles, destinos, incluir });
      // VH-091: los sustituidos por decisión explícita salen del proyecto.
      const fuera = new Set((confirmacion.reemplazados || []).map(String));
      const existentes = fuera.size ? existentes0.filter((p) => !fuera.has(String(p.id))) : existentes0;
      const enriquecidos = confirmacion.enriquecidos || [];
      // #4: ENRIQUECE en el sitio los existentes reutilizados (WIN/gavetas apuntan
      // ahora al ancla APP LT) — sólo metadata estructural, sin tocar economics.
      const porId = new Map(enriquecidos.map((e) => [String(e.id), e.patch]));
      const patched = existentes.map((p) => {
        const patch = porId.get(String(p.id));
        // #10: la semántica estructural vive SÓLO top-level (un dueño). NO se copia a config.
        return patch ? { ...p, ...patch } : p;
      });
      const nuevas = (sinNuevas && !incluir.length) ? [] : confirmacion.confirmadas.map(partidaComercialDesdeConfirmado);
      // VH-090: proyectos que YA traían duplicados (programa aplicado antes de describir con VONI,
      // como la cotización 757): al aplicar/vincular se concilian las filas de la persona contra las
      // genéricas del programa del mismo rol. Idempotente: sin equivalentes no cambia nada.
      const todas = [...patched, ...nuevas];
      const delPrograma = todas.filter((p) => p.source === 'CONFIRMADO_PROGRAMA');
      const dePersona = todas.filter((p) => p.source !== 'CONFIRMADO_PROGRAMA');
      const rec = reconciliarNuevasConPrograma(delPrograma, dePersona, { decisiones });
      const conciliadas = rec.sustituidas.length ? rec.partidas : todas;
      if (!nuevas.length && !enriquecidos.length && !fuera.size && !rec.sustituidas.length) return prev;    // idempotente: nada que hacer
      return { ...prev, cotizacion: { ...prev.cotizacion, partidas: conciliadas } };
    });
    // Libera el lock tras el commit (microtask: después del setEstado batcheado).
    Promise.resolve().then(() => { aplicandoProgramaRef.current = false; });
    return {
      confirmadas: (vista.confirmacion?.confirmadas || []).length,
      conflictos: vista.conflictos || [],
      pendientes: propuesta.pendientes || [],
    };
  }

  // Área J · R-06: un doble clic en "Agregar" no mete dos partidas idénticas (datos/dobleClic.js).
  const seguroAgregar = useRef(null);
  if (!seguroAgregar.current) seguroAgregar.current = crearSeguroDobleClic();
  const agregadoRepetido = (partidas) => seguroAgregar.current(firmaAgregado(partidas));

  // Asistente y costeador de línea sencillo: una partida.
  function agregarDesdeAsistente(costeo, cantidad, precio, margen) {
    const p = partidaDeCosteo(costeo, cantidad, precio, margen);
    if (agregadoRepetido([p])) return;
    sumarPartidas([p]);
    mostrarAviso(`Agregado: ${p.nombre}`);
  }

  // Módulo con add-ons (eléctrico, gaveta): el módulo va como partida y cada
  // add-on como partida aparte, que es como los cotiza Von Haucke en el papel.
  function agregarModuloAddons(costeo, cantidad, precio, margen, costoUnitario, addons) {
    const n = Math.max(1, Number(cantidad) || 1);
    const base = partidaDeCosteo(costeo, cantidad, precio, margen, costoUnitario);
    const extras = (addons || []).map((a) => crearPartida({
      piezaId: `addon-${a.id}`,
      nombre: a.nombre,
      ruta: a.ruta || null,
      productoId: a.productoId || null,
      cantidad: (a.cantidad || 1) * n,
      // Seller-safe: el vendedor no guarda costo (ni el derivado del precio).
      costoUnitario: veCostos ? costoImplicito(a.lista) : null,
      costoDerivado: veCostos,
      precioUnitario: precioDeLista(a.lista),
    }, { veCostos, origen: 'addon' }));
    if (agregadoRepetido([base, ...extras])) return;
    sumarPartidas([base, ...extras]);
    mostrarAviso(extras.length ? `Agregado: ${base.nombre} + ${extras.length} accesorio(s)` : `Agregado: ${base.nombre}`);
  }


  // Costear especial (modo avanzado). Mismo bug: estas tres se pasaban como prop
  // y no existían, así que "Costear especial" y "Catálogo" también morían en
  // blanco. `resultado` es el cálculo; el mueble en sí vive en `costeo`.
  async function onAgregarCotizacion(resultado, precio, margen) {
    // GATE AUTORITATIVO (lógica pura en datos/agregarCosteo.js, probada por comportamiento en
    // authoritativeCostGate.test.js / advancedSpecialUnknownCost.test.js): antes de convertir un costeo
    // NUEVO en una línea comercial, el servidor recalcula; un centavo de diferencia falla cerrado y la
    // partida lleva el costo DEL SERVIDOR (con costoEstado/costeoId/bomHash para la emisión).
    const r = await partidaAutoritativaDeCosteo({
      costeo, resultado, precio, margen, costearServidor,
      pendientes: () => pendientesDeCosteo(costeo, estado.insumos, modeloParaPieza(estado.parametros, costeo).par),
      nuevoId: () => idNuevo('p'),
    });
    if (!r.ok) {
      mostrarAviso(r.error, r.avisoMs);
      return { ok: false, error: r.error };
    }
    sumarPartidas([r.partida]);
    mostrarAviso(`Agregado y verificado: ${costeo.nombre || 'mueble a la medida'}`);
    return { ok: true, costoUnitario: r.costoUnitario, estado: r.estado };
  }

  // Guarda el despiece actual como pieza reutilizable del catálogo interno.
  function onGuardarPieza(resultado) {
    const id = costeo.piezaId || idNuevo('pieza');
    const pieza = { ...costeo, id, piezaId: id, costoUnitario: resultado?.costoUnitario ?? null };
    // `estado.piezas` es un OBJETO id→pieza (ver almacen.js), no un arreglo.
    // Antes esto hacía `.filter()` encima y tronaba con "previas.filter is not a
    // function": el botón de guardar un especial NUNCA funcionó, y el mensaje de
    // error decía "No perdiste nada" cuando en realidad se perdía todo.
    setEstado((e) => ({ ...e, piezas: { ...(e.piezas || {}), [id]: pieza } }));
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
  // Dos renglones del MISMO mueble al mismo precio son un solo renglón con más
  // piezas. Rodrigo lo vio en su teléfono: la silla ALPHA aparecía dos veces, una
  // con 6 y otra con 12, porque Voni la pidió para dos áreas distintas. Un
  // presupuesto de Von Haucke nunca repite un renglón idéntico: lo suma.
  // Se agrupa por lo que de verdad lo hace el mismo mueble —nombre, precio,
  // producto y configuración—, nunca por nombre solo: dos muebles que se llaman
  // igual con distinto acabado SÍ son renglones distintos.
  // mismoRenglon / juntarIguales: datos/renglonesComerciales.js (precio comparado AL CENTAVO).

  function agregarItemsProyecto(costados, opts = {}) {
    const nuevas = partidasDeItemsIA(costados).map((p) => ({ ...p, loteIA: opts.lote || null }));
    let sustituidas = [];
    setEstado((e) => {
      const previas = e.cotizacion.partidas || [];
      const base0 = opts.reemplaza ? previas.filter((p) => p.loteIA !== opts.reemplaza) : previas;
      // VH-090: lo que describe la persona SUSTITUYE a la partida genérica del programa del
      // plano con el mismo rol (y hereda su estructura para el acomodo). Antes se duplicaba.
      const rec = reconciliarNuevasConPrograma(base0, nuevas);
      sustituidas = rec.sustituidas;
      const base = rec.partidas.slice(0, rec.partidas.length - nuevas.length);
      const partidas = rec.partidas.slice(rec.partidas.length - nuevas.length);
      // #5: una interpretación NUEVA REEMPLAZA el brief (no se queda pegado el
      // anterior). Si opts trae programaBrief (hubo interpretación), manda; si no,
      // se conserva el existente (fue un add que no vino del intérprete).
      const programaBrief = ('programaBrief' in opts) ? opts.programaBrief : e.cotizacion.programaBrief;
      return { ...e, cotizacion: { ...e.cotizacion, partidas: juntarIguales([...base, ...partidas]), ...(programaBrief !== undefined ? { programaBrief } : {}) } };
    });
    mostrarAviso(sustituidas.length
      ? `¡Listo! ${nuevas.length} mueble(s) en tu proyecto · ${sustituidas.length} del programa del plano sustituido(s) por lo que describiste`
      : `¡Listo! ${nuevas.length} mueble(s) en tu proyecto`);
  }

  // Cotizador con IA (suelto) -> agrega y navega a 'cotizacion' o 'acomodo'.
  function agregarItemsIA(costados, opts) {
    agregarItemsProyecto(costados, opts);
  }

  // ---------------------------------------------------------------------------
  //  EL SEMÁFORO DE MARGEN ESTABA MUERTO PARA TODO LO DEL BANCO
  //  Las piezas del banco entraban con `costoUnitario: 0` y `margen: null`, así
  //  que el piso de utilidad NUNCA se calculaba para ellas — y el banco es donde
  //  vive la SILLERÍA, que es lo más caro de un proyecto. Un vendedor podía
  //  descontar sobre eso sin que se encendiera una sola alerta.
  //
  //  El costo se DERIVA de dos cosas que ya sabemos con certeza:
  //   · Rodrigo (2026-08-16): "el precio que tenemos ya es precio de lista, es el
  //     de venta con el 40%" → para MUEBLE, precio 2 = precio ÷ 0.60.
  //   · La sillería NUNCA lleva ese 40% (verificado: 31 de 31 renglones de
  //     226030018 salen sin descuento) → para SILLA, precio 2 = el precio tal cual.
  //  De ahí, costo = precio 2 ÷ 3.6, que es la cascada de Von Haucke.
  //
  //  ⚠️ ES DERIVADO, NO MEDIDO. La sillería es comprada-revendida y lleva otra
  //  utilidad; su costo real es más alto que esta cuenta y el margen que se
  //  muestre para ella sale optimista. Sirve para que la alerta EXISTA —hoy no
  //  existía— y se sustituye en cuanto Compras dé el costo real de la silla.
  // ---------------------------------------------------------------------------
  // costoDeBanco / margenDeBanco: datos/renglonesComerciales.js (costo con dinero(), a centavos).

  // Banco de precios -> agrega una partida con el precio real ya cotizado.
  function agregarDeBanco(item, cantidad) {
    const nombre = item.medidas ? `${item.nombre} (${item.medidas})` : item.nombre;
    // RC3: antes sembraba costo/margen a TODOS los roles; el contrato los quita al vendedor.
    // Identidad de catálogo (Producto Maestro) ⇒ la emisión la trata como reventa con su
    // precio de lista (P0-01) en vez de exigir un costo que una pieza comprada no tiene.
    const ident = identidadDeCatalogo('banco', item.id);
    const partida = crearPartida({
      piezaId: item.id, nombre,
      cantidad, costoUnitario: costoDeBanco(item), costoDerivado: true, precioUnitario: item.precio,
      margen: margenDeBanco(item), deBanco: true, precioReal: true,
      ...(ident ? { ...ident, precio_lista_snapshot: item.precio } : {}),
    }, { veCostos, origen: 'banco' });
    if (agregadoRepetido([partida])) return;
    setEstado((e) => ({
      ...e,
      cotizacion: { ...e.cotizacion, partidas: [...(e.cotizacion.partidas || []), partida] },
    }));
  }

  // Un ARTÍCULO del catálogo oficial (Excel de Rodrigo): precio de venta REAL,
  // sin costo/despiece (es un producto terminado con Precio Lista). Se agrega
  // directo desde el buscador de Inicio, como el banco pero de línea propia.
  // Sin margen -> cuenta como `sinCosto`: el vendedor ve sólo precio; Dirección
  // ve "—" en costo/utilidad, que es la verdad (el catálogo no trae costo).
  function agregarArticuloLinea(r) {
    if (!r || !(r.precio > 0)) return;
    const partida = crearPartida({
      piezaId: r.clave ? `linea-${r.clave}` : null, nombre: r.nombre,
      ruta: r.ruta || null, productoId: r.clave || null, claveLinea: r.clave || null,
      cantidad: 1, precioUnitario: r.precio, deLinea: true, precioReal: !!r.precioReal,
      // Identidad de Producto Maestro si el artículo la trae (Línea V2).
      producto_id: r.producto_id ?? null, producto_version_id: r.producto_version_id ?? null,
      lista_precio_item_id: r.lista_precio_item_id ?? null, source_type: r.source_type ?? null, source_ref: r.source_ref ?? null,
    }, { veCostos, origen: 'linea' });
    if (agregadoRepetido([partida])) return;
    setEstado((e) => ({
      ...e,
      cotizacion: { ...e.cotizacion, partidas: [...(e.cotizacion.partidas || []), partida] },
    }));
    mostrarAviso(`Agregado: ${r.nombre}`);
  }

  const nPartidas = estado.cotizacion?.partidas?.length || 0;

  // ---- Puerta de acceso ----
  if (sesion === undefined || (sesion && permiso === undefined)) {
    return <div className="contenido" style={{ textAlign: 'center', marginTop: 70 }}><p className="gris">Un momento…</p></div>;
  }
  if (!sesion) {
    return <Login onEntrar={hacerLogin} aviso={avisoEnlace} />;
  }
  if (permiso === 'error') {
    // No es "no tienes acceso": es que la consulta del permiso falló (red,
    // RLS). Decirlo distinto importa — lo otro manda a alguien con acceso de
    // verdad a pedirle de alta a Dirección por un error que no es suyo.
    return (
      <div className="contenido" style={{ maxWidth: 460, marginTop: 40 }}>
        <div className="tarjeta">
          <h2>No se pudo verificar tu acceso</h2>
          <p className="ayuda columna-texto">Hubo un problema consultando tus permisos. Revisa tu internet y vuelve a intentar.</p>
          <button className="boton" onClick={() => window.location.reload()}>Reintentar</button>
          <button className="boton fantasma" onClick={hacerLogout}>Salir</button>
        </div>
      </div>
    );
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
      {CARRIL_RC && (
        <div data-testid="carril-rc" className="no-imprimir" style={{ background: '#B42318', color: '#fff', textAlign: 'center', fontSize: 12, padding: '4px 8px' }}>
          LINK DE PRUEBA (RC) · Costear usa el motor en prueba · no es producción · lo que guardes queda en la base real: márcalo como prueba
        </div>
      )}
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
            <span className="conexion" data-testid="nube-estado" data-estado={nubeEstado} data-guardando={guardandoNube ? '1' : '0'} title={guardandoNube ? 'Guardando en la nube… (lo tuyo ya está en esta computadora)' : nubeEstado === 'conectado' ? 'Conectado: los cambios se comparten' : nubeEstado === 'sin-conexion' ? 'Sin conexión: se guarda en esta computadora' : nubeEstado === 'rechazado' ? 'La nube rechazó el último guardado: el trabajo está sólo en esta computadora' : 'Conectando…'}>
              <span className="punto" style={{ background: nubeEstado === 'conectado' ? '#3fbf8f' : nubeEstado === 'sin-conexion' ? '#B8912F' : nubeEstado === 'rechazado' ? '#B42318' : '#8a8480' }} />
              <span className="conexion-txt">{guardandoNube ? 'Guardando…' : nubeEstado === 'conectado' ? 'En línea' : nubeEstado === 'sin-conexion' ? 'Sin conexión' : nubeEstado === 'rechazado' ? 'No guardada' : '...'}</span>
            </span>
            {/* Cuenta: lo que no es trabajo (guía, usuarios, contraseña) va en un menú;
                Salir se queda a la vista. */}
            <details className="menu-cuenta">
              <summary className="btn-enc" title={sesion.user.email}>
                <span className="menu-cuenta-ini" aria-hidden="true">{String(sesion.user.email || '?').slice(0, 1).toUpperCase()}</span>
                Cuenta
              </summary>
              <div className="menu-cuenta-lista" role="menu">
                <span className="menu-cuenta-correo">{sesion.user.email}</span>
                <button role="menuitem" onClick={(e) => { e.currentTarget.closest('details')?.removeAttribute('open'); setMostrarGuia((v) => !v); }}>Guía</button>
                {esDireccion && <button role="menuitem" onClick={(e) => { e.currentTarget.closest('details')?.removeAttribute('open'); irA('usuarios'); }}>Usuarios</button>}
                <button role="menuitem" onClick={(e) => { e.currentTarget.closest('details')?.removeAttribute('open'); setRecuperando(false); irA('contrasena'); }}>Contraseña</button>
              </div>
            </details>
            <button className="btn-enc" onClick={hacerLogout} title={sesion.user.email}>Salir</button>
          </div>
        </div>
      </header>

      <main>
        {/* VH-148: otra persona guardó antes; lo local sigue aquí y la persona decide. Visible en
            cualquier pantalla porque el autosave está en pausa mientras no se resuelva. */}
        <ConflictoGuardado conflicto={conflicto} ocupado={resolviendoConflicto} onVerServidor={verVersionDelServidor} onReaplicar={reaplicarMisCambios} />
        {/* VH-148: las DOS versiones siguen vivas hasta que la persona decida (recuperar / descartar). */}
        <RespaldoConflicto respaldo={respaldoActual} filas={filasRespaldo} mezcla={mezclaRespaldo} ocupado={resolviendoConflicto} bloqueado={!!conflicto}
          onRecuperar={recuperarMisCambios} onDescartar={descartarMiRespaldo} />
        {/* Red de seguridad: un error de render ya no deja la app en blanco. */}
        <SinPantallaBlanca resetKey={pestania} onInicio={irInicio}>
        <Suspense fallback={(
          <div className="contenido vh-skel-cargando" style={{ marginTop: 20 }} aria-busy="true" aria-label="Cargando">
            <div className="vh-skel vh-skel-bloque" />
            <div className="vh-skel vh-skel-linea" style={{ width: '60%' }} />
            <div className="vh-skel vh-skel-linea" style={{ width: '85%' }} />
            <div className="vh-skel vh-skel-linea" style={{ width: '45%' }} />
          </div>
        )}>
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
          <div className="contenido"><Inicio estado={estado} onIr={irA} onAgregarArticulo={agregarArticuloLinea} veCostos={veCostos} esDireccion={esDireccion} vista={inicioVista} setVista={setInicioVista} onDescartar={descartarProyecto} q={inicioQ} setQ={setInicioQ} grupoAbierto={inicioGrupo} setGrupoAbierto={setInicioGrupo} /></div>
        )}
        {pestania === 'asistente' && (
          <div className="contenido"><Asistente estado={estado} onAgregarPartida={agregarDesdeAsistente} onIr={irA} soloVentas={esVendedor} /></div>
        )}
        {pestania === 'cocrear' && (
          // onAgregar enchufa "Agregar al proyecto": el especial co-diseñado entra a
          // Cotizar como partida con producto_id + producto_version_id ya fijados
          // (partidaDeCosteo). Sin esta prop el botón nunca aparecía y el camino
          // Cocrear→Cotizar quedaba muerto (una sola verdad de producto).
          <Cocrear
            estado={estado}
            soloVentas={esVendedor}
            rol={esDireccion ? 'direccion' : esDiseno ? 'diseno' : 'ventas'}
            usuarioEmail={sesion?.user?.email || null}
            onIr={irA}
            onAgregar={agregarDesdeAsistente}
            puente={puenteCocrear}
            onPasarACostear={veCostos ? (p) => { setExpedienteAbierto(null); setPuenteCocrear({ ...p, retorno: null }); irA('especial'); } : null}
            onPuenteConsumido={() => setPuenteCocrear(null)}
          />
        )}
        {pestania === 'banco' && <Banco onAgregar={agregarDeBanco} onIr={irA} />}
        {pestania === 'archivo' && (
          <Archivo
            estado={estado}
            veCostos={veCostos}
            puedeAprobar={esDireccion}
            usuario={sesion?.user?.email || null}
            onRestaurar={(r) => {
              // Restaurar un respaldo = reabrir ESA cotización (mismo id/clave): no se
              // escribe a la nube hasta que el usuario edite (igual que abrir del Archivo).
              try {
                const nuevo = aplicarRespaldo(estado, r, { veCostos });
                epocaCot.current += 1;
                idCotizacion.current = nuevo.cotizacion?.id ?? null;
                if (idCotizacion.current) fijarFirmaComoGuardada(nuevo); else ultimaFirmaNube.current = '';
                baseNube.current = null;   // VH-148: un respaldo restaurado no sabe qué hay hoy en el servidor
                setEstado(nuevo);
                irA('cotizacion');
                mostrarAviso(`Respaldo restaurado: ${nuevo.cotizacion?.cliente || 'sin cliente'}.`);
                return { ok: true };
              } catch (e) { return { ok: false, motivo: String(e?.message || e) }; }
            }}
            onAbrir={async (c) => {
              // Abrir un presupuesto viejo trae SUS renglones al proyecto actual.
              // Se pregunta antes si ya hay algo cargado: reemplazar sin avisar es
              // perder trabajo, que es justo lo que veníamos arreglando.
              const hay = (estado.cotizacion?.partidas || []).length;
              if (hay && !confirm(`Tienes ${hay} mueble(s) en el proyecto actual. ¿Los reemplazo con este presupuesto?`)) return;
              // La lista del Archivo es LIGERA (solo nombres) por rendimiento; aquí se
              // trae la cotización COMPLETA por id (seller-safe) para poder re-editarla.
              // Si la nube falla, se cae a lo que traía la tarjeta (degradación suave).
              const full = (await cargarCotizacionCompleta(c.id)) || c;
              // P1-REL-02: abrir desde la lista con un conflicto sin resolver ya NO tira lo local: primero se respalda (la
              // misma pila que "Ver la versión del servidor"), y el respaldo se ofrece al volver a esa cotización.
              if (conflictoRef.current) {
                const idPrevio = idCotizacion.current ?? estado.cotizacion?.id ?? null;
                let ok = false;
                try { ok = guardarRespaldoConflicto(localStorage, idPrevio, respaldoConflicto(estado, conflictoRef.current, { base: baseNube.current })); } catch { ok = false; }
                if (!ok && !confirm('No se pudo guardar una copia de tus cambios sin guardar. Si abres este presupuesto, se pierden. ¿Abrir de todos modos?')) return;
                fijarConflicto(null, idPrevio);
              }
              epocaCot.current += 1;          // invalida guardados en vuelo de la anterior
              idCotizacion.current = c.id;   // seguir editando ESE, no crear otro
              fijarConflicto(null);           // VH-148: se abre otra cotización; el conflicto anterior ya no aplica
              const cotAbierta = {
                ...estado.cotizacion,
                id: c.id, claveCreacion: claveCreacionNueva(),
                // VH-148: la versión desde la que se edita (cadena tal cual; null con la RPC vieja).
                actualizado: typeof full.actualizado === 'string' ? full.actualizado : null,
                cliente: full.cliente || '', folio: full.folio || '',
                partidas: actualizarPartidasDePrograma(full.partidas || []), acomodo: full.acomodo || null,
                programaBrief: full.programaBrief ?? null,   // el pedido de ESTA cotización, nunca el de la que estaba abierta
                descuentoPct: full.totales?.descuentoPct ?? estado.cotizacion.descuentoPct,
                contingenciaPct: full.totales?.contingenciaPct ?? estado.cotizacion.contingenciaPct,
                maniobrasPct: full.totales?.maniobrasPct ?? estado.cotizacion.maniobrasPct,
                fletePct: full.totales?.fletePct ?? estado.cotizacion.fletePct,
                ivaPct: full.totales?.ivaPct ?? estado.cotizacion.ivaPct,
                anticipoPct: full.totales?.anticipoPct ?? estado.cotizacion.anticipoPct,
              };
              // Lo que se acaba de abrir YA está en la nube: no se reescribe (ni se pisa la
              // economía que este rol no ve) hasta que el usuario edite algo.
              // EXCEPCIÓN: la reparación de renglones viejos (actualizarPartidasDePrograma) SÍ tiene que
              // subir. La firma y la base son las de lo que hay en el SERVIDOR; si la reparación cambió algo,
              // el autoguardado lo sube. Antes se firmaba lo reparado y nunca se guardaba: la emisión comparaba
              // el renglón reparado contra el guardado y decía "no corresponde a lo que se costeó" (4048, 20-oct).
              const cotServidor = { ...cotAbierta, partidas: full.partidas || [] };
              fijarFirmaComoGuardada({ ...estado, cotizacion: cotServidor });
              baseNube.current = comparables(cotServidor);   // VH-148: desde aquí se edita
              setEstado((e) => ({ ...e, cotizacion: cotAbierta }));
              irA('cotizacion');
              mostrarAviso(`Abierto: ${full.cliente || c.cliente || 'sin cliente'}`);
            }}
          />
        )}
        {pestania === 'applt' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador APP LT" productos={APPLT_PRODUCTOS} generar={generarAppLT} onAgregar={agregarDesdeAsistente} onAgregarModulo={agregarModuloAddons} /></div>}
        {pestania === 'app' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador App" productos={APP_PRODUCTOS} generar={generarApp} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'eclipse' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Eclipse" productos={ECLIPSE_PRODUCTOS} generar={generarEclipse} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'pebble' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Pebble" productos={PEBBLE_PRODUCTOS} generar={generarPebble} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'privacy4' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Privacy 4" productos={PRIVACY4_PRODUCTOS} generar={generarPrivacy4} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'rio' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Río" productos={RIO_PRODUCTOS} generar={generarRio} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'teamspace2' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador TeamSpace II" productos={TEAMSPACE2_PRODUCTOS} generar={generarTeamspace2} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'tetris' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Tetris" productos={TETRIS_PRODUCTOS} generar={generarTetris} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'arlequin' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Arlequín" productos={ARLEQUIN_PRODUCTOS} generar={generarArlequin} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'pac' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Pac" productos={PAC_PRODUCTOS} generar={generarPac} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'via' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Vía" productos={VIA_PRODUCTOS} generar={generarVia} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'drift' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Eclipse Drift" productos={DRIFT_PRODUCTOS} generar={generarDrift} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'flex' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Flex" productos={FLEX_PRODUCTOS} generar={generarFlex} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'mox' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Mox" productos={MOX_PRODUCTOS} generar={generarMox} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'modulor' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Modulor" productos={MODULOR_PRODUCTOS} generar={generarModulor} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'luna' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Luna" productos={LUNA_PRODUCTOS} generar={generarLuna} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'accents' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Accents" productos={ACCENTS_PRODUCTOS} generar={generarAccents} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'ergo4' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Ergonova 4" productos={ERGO4_PRODUCTOS} generar={generarErgo4} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'spine' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Spine" productos={SPINE_PRODUCTOS} generar={generarSpine} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'anteo' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Anteo" productos={ANTEO_PRODUCTOS} generar={generarAnteo} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'alba' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Alba" productos={ALBA_PRODUCTOS} generar={generarAlba} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'feather' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Feather" productos={FEATHER_PRODUCTOS} generar={generarFeather} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'worklounge' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Work Lounge" productos={WORKLOUNGE_PRODUCTOS} generar={generarWorklounge} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'cirque' && <div className="contenido"><CosteadorLinea onIr={irA} productoInicial={prodInicial} linea={pestania} soloVentas={esVendedor} estado={estado} titulo="Costeador Cirque" productos={CIRQUE_PRODUCTOS} generar={generarCirque} onAgregar={agregarDesdeAsistente} /></div>}
        {pestania === 'especial' && (veCostos
          ? <div className="contenido"><AsistenteEspecial estado={estado} rol={esDireccion ? 'direccion' : esDiseno ? 'diseno' : 'ventas'} onAgregarInsumo={agregarInsumoCatalogo} onVerDetalle={(bor) => { setCosteo({ ...costeoEnBlanco(), ...bor, factorDirecta: bor.factorDirecta ?? null, factorIndirecta: bor.factorIndirecta ?? null }); irA('costeador'); }} onInicio={irInicio} onBiblioteca={() => irA('biblioteca')} expedienteInicial={expedienteAbierto}
              semillaCocrear={puenteCocrear?.semilla || null}
              onVolverCocrear={puenteCocrear ? (retorno) => { setPuenteCocrear((p) => (p ? { ...p, retorno: retorno || null } : p)); irA('cocrear'); } : null} /></div>
          : <div className="contenido"><div className="tarjeta"><p className="ayuda">Costear desde cero es para Diseño y Dirección.</p></div></div>
        )}
        {pestania === 'biblioteca' && (veCostos
          ? <div className="contenido"><Biblioteca onInicio={irInicio} onNuevo={() => { setExpedienteAbierto(null); irA('especial'); }} onAbrir={(exp) => { setExpedienteAbierto(exp); irA('especial'); }} /></div>
          : <div className="contenido"><div className="tarjeta"><p className="ayuda">La biblioteca de productos es para Diseño y Dirección.</p></div></div>
        )}
        {pestania === 'tablero' && (esDireccion
          ? <Tablero estado={estado} irA={irA} puedeVerDireccion={desbloqueado} onDireccion={null} />
          : <div className="contenido"><div className="tarjeta"><p className="ayuda">El tablero del negocio es de Dirección.</p></div></div>
        )}
        {pestania === 'costeador' && (veCostos
          ? (
            <div className="contenido">
              <Costeador estado={estado} costeo={costeo} setCosteo={setCosteo}
                onAgregarCotizacion={onAgregarCotizacion} onGuardarPieza={onGuardarPieza}
                puedeVerComercial={esDireccion} onAgregarInsumo={agregarInsumoCatalogo} />
            </div>
          )
          : <div className="contenido"><div className="tarjeta"><p className="ayuda">El modo avanzado y el costo de fabricación son para Diseño y Dirección. Usa <strong>Cotizar un mueble</strong> para el precio recomendado.</p></div></div>
        )}
        {pestania === 'catalogo' && <Catalogo estado={estado} onCargar={onElegirDelCatalogo} soloVentas={esVendedor} />}
        {pestania === 'cotizacion' && <Cotizacion estado={estado} setEstado={setEstado} soloVentas={esVendedor} onIr={irA} onEmitida={onEmitida} verificarEmision={verificarEmision} onSolicitarAprobacion={solicitarAprobacion} veCostos={veCostos} />}
        {pestania === 'cotizarIA' && <div className="contenido"><CotizadorIA estado={estado} onAgregarItems={agregarItemsIA} onIr={irA} verCotizacion soloVentas={esVendedor} /></div>}
        {pestania === 'comercial' && (flagActivo('commercial_v2')
          ? <Comercial estado={estado} soloVentas={esVendedor} veCostos={veCostos} onIr={irA} usuario={sesion?.user?.email || null} />
          : <div className="contenido"><div className="tarjeta"><p className="ayuda">El módulo comercial no está disponible en este momento.</p></div></div>
        )}
        {pestania === 'voni' && (
          <Voni
            estado={estado} setEstado={setEstado} soloVentas={esVendedor} veCostos={veCostos}
            paso={voniPaso} setPaso={setVoniPaso}
            onAgregarItems={agregarItemsProyecto}
            onGuardarAcomodo={guardarAcomodo}
            onAplicarPrograma={aplicarProgramaDetectado}
            onEmpezarDeCero={descartarProyecto}
            onIr={irA}
          />
        )}
        {pestania === 'contrasena' && <CambiarContrasena email={sesion?.user?.email} recuperacion={recuperando} onListo={() => { setRecuperando(false); irInicio(); }} />}
        {pestania === 'acomodo' && <Acomodo estado={estado} onIr={irA} onGuardarAcomodo={guardarAcomodo} onAplicarPrograma={aplicarProgramaDetectado} />}
        {pestania === 'precios' && (veCostos
          ? <Precios estado={estado} setEstado={setEstado} puedeVerDireccion={desbloqueado} onDireccion={null} />
          : <div className="contenido"><div className="tarjeta"><p className="ayuda">Los precios de materiales son costos y solo los ven Diseño y Dirección.</p></div></div>
        )}
        {pestania === 'usuarios' && esDireccion && <Usuarios onAviso={mostrarAviso} miCorreo={sesion?.user?.email || ''} />}
        {pestania === 'carga-erp' && esDireccion && <CargaERP onAviso={mostrarAviso} />}
        {/* Lo que Voni sabe: lo leen todos (el motor lo aplica igual para
            todos), pero dictar o corregir una regla es de Diseño y Dirección. */}
        {pestania === 'reglas' && <Reglas puedeEditar={veCostos} />}
        </Suspense>
        </SinPantallaBlanca>
      </main>

      {aviso && <div className="toast" role="status" aria-live="polite">{aviso}</div>}

      {/* VONI 2.0 — cerebro transversal. Lanzador flotante en cualquier ruta
          (salvo login/cambio de contraseña). Respeta el rol real del usuario. */}
      {permiso && permiso !== 'error' && pestania !== 'contrasena' && flagActivo('voni_2') && (
        <>
          <button
            type="button"
            aria-label="Abrir Voni"
            onClick={() => setVoniAbierto(true)}
            // Rutas con barra de acción fija abajo: el FAB se eleva/reserva hueco para
            // no tapar sus botones. Cotizar (acciones) y Costeador de línea (compra).
            className={'voni-fab'
              + (pestania === 'cotizacion' ? ' voni-fab--conbarra' : '')
              + (RUTAS_LINEA.has(pestania) ? ' voni-fab--compra' : '')}>
            Voni
          </button>
          {voniAbierto && (
            <Voni2
              ctx={{
                user: sesion?.user || { email: sesion?.user?.email || 'sesion' },
                role: esDireccion ? 'direccion' : esDiseno ? 'diseno' : 'ventas',
                route: pestania,
                quote_id: estado?.cotizacion?.id ?? null,
                // CONEXIÓN CON EL TRABAJO VIVO: para que Voni analice lo que está
                // en pantalla (no sólo lo guardado en la BD comercial). Las
                // partidas van YA recortadas a seller-safe (nombre/cantidad/precio),
                // NUNCA costo ni margen — fail-closed, aunque el saneador ya re-filtra.
                partidasLocales: partidasLocalesVoni(estado.cotizacion?.partidas),
                // Acomodo vivo (geometría, sin economía) para "¿cabe? ¿está acomodado?".
                acomodoLocal: estado.cotizacion?.acomodo || null,
                // Fuente económica autorizada: SÓLO veCostos, y sólo el BOM del
                // costeo actual (la tool igual bloquea a vendedor/cliente).
                ...economiaVoni({ veCostos, costeo, voniCosting }),
                materialesTecnicos: materialesTecnicosVoni,
                clientSafe: false,
              }}
              onCerrar={() => setVoniAbierto(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
