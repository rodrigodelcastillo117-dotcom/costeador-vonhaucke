// ============================================================================
//  APP - encabezado, pestanias, estado global y PERMISOS POR ROL.
//  El acceso a nomina/financieros/tablero NO se pide con un PIN: lo resuelve
//  la base de datos por el correo de quien entro (tabla `permitidos`).
// ============================================================================
import { useEffect, useRef, useState, lazy, Suspense } from 'react';
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
const Reglas = lazy(() => import('./componentes/Reglas.jsx'));
import { cargarReglas } from './datos/reglas.js';
import { cargarAprendizajes } from './datos/aprendizaje.js';
import { guardarCotizacion, cargarCotizacionCompleta } from './datos/cotizaciones.js';
import { guardarRevision } from './datos/revisiones.js';
import { cargar, guardar, razonDeArranqueEnBlanco, PARAMS_SENSIBLES } from './almacen.js';
import { leerConfig, escribirConfig, suscribirConfig, leerDireccion, escribirDireccion, sesionActual, alCambiarSesion, entrar, salir, miPermiso, cotizacionEmitible, costearServidor } from './nube.js';
import { calcular, modeloParaPieza, componentesSinMaterial } from './motor/calculo.js';
import { idNuevo } from './util.js';
import { costoImplicito, precioDeLista } from './datos/preciosVenta.js';
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
    factorDirecta: null, factorIndirecta: null, preparacionHoras: 0, margen: 30,
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
  const [voniAbierto, setVoniAbierto] = useState(false);
  const [inicioVista, setInicioVista] = useState('home'); // sub-vista del Inicio (home/costear/cotizar)
  const [expedienteAbierto, setExpedienteAbierto] = useState(null); // expediente de biblioteca a reabrir en el asistente
  const [prodInicial, setProdInicial] = useState(null);   // producto que pidió el buscador
  // ⚠️ LA BÚSQUEDA Y EL ACORDEÓN VIVEN AQUÍ, NO EN `Inicio`. App DESMONTA
  // Inicio al navegar, así que cada "Atrás" repliega el acordeón y borra lo que
  // habías tecleado. Eran 2 toques de castigo por CADA producto extra: escoger
  // 3 costaba 15 toques en vez de 9.
  const [inicioQ, setInicioQ] = useState('');
  const [inicioGrupo, setInicioGrupo] = useState(null);
  const [nav, setNav] = useState([]);                     // historial para "Atrás"
  const [costeo, setCosteo] = useState(costeoEnBlanco);
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
    setEstado((e) => ({
      ...e,
      cotizacion: {
        ...e.cotizacion, partidas: [], acomodo: null, cliente: '', folio: '',
        // No arrastrar el descuento/ajustes del cliente anterior a la nueva.
        descuentoPct: 0, contingenciaPct: 0, maniobrasPct: 0, fletePct: 0,
      },
    }));
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
    setEstado((e) => ({ ...e, cotizacion: { ...e.cotizacion, acomodo: { ...(e.cotizacion?.acomodo || {}), ...datos } } }));
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
      if (evento === 'PASSWORD_RECOVERY') { setRecuperando(true); setPestania('contrasena'); }
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
  const idCotizacion = useRef(null);
  // Época de la cotización: sube al "empezar de cero". Un guardado en vuelo que
  // resuelva DESPUÉS no debe restaurar el id viejo sobre la cotización nueva.
  const epocaCot = useRef(0);
  useEffect(() => {
    if (!sesion?.user?.email) return;
    const n = estado.cotizacion?.partidas?.length || 0;
    if (!n) return;
    const t = setTimeout(async () => {
      const epoca = epocaCot.current;
      const id = await guardarCotizacion(estado, sesion.user.email, idCotizacion.current);
      if (id && epocaCot.current === epoca) idCotizacion.current = id;
    }, 1500);
    return () => clearTimeout(t);
  }, [estado.cotizacion, sesion]);

  // AL EMITIR (PDF/impresión): se asegura de guardar la cotización viva y congela
  // una REVISIÓN inmutable de lo ofrecido (evidencia con fecha y responsable). No
  // duplica si no cambió nada; nunca rompe la emisión si la nube falla.
  // Gate de emisión AUTORITATIVO (server-side): guarda la cotización para tener id
  // real y consulta `cotizacion_emitible`. Devuelve {ok, estado, motivos, economics}.
  // Degrada suave: si no hay sesión o falla, no bloquea (el servidor re-gatea al emitir).
  async function verificarEmision() {
    if (!sesion?.user?.email) return { ok: false, estado: 'DESCONOCIDO', motivos: [] };
    try {
      const epoca = epocaCot.current;
      const id = await guardarCotizacion(estado, sesion.user.email, idCotizacion.current);
      if (id && epocaCot.current === epoca) idCotizacion.current = id;
      return await cotizacionEmitible(idCotizacion.current);
    } catch (e) { return { ok: false, estado: 'DESCONOCIDO', motivos: [], error: String(e?.message || e) }; }
  }

  async function onEmitida() {
    if (!sesion?.user?.email) return { ok: false, motivo: 'sin-sesion' };
    try {
      const epoca = epocaCot.current;
      const id = await guardarCotizacion(estado, sesion.user.email, idCotizacion.current);
      if (id && epocaCot.current === epoca) idCotizacion.current = id;
      const r = await guardarRevision(estado, idCotizacion.current);
      if (r?.ok && r.nueva) mostrarAviso(`Revisión ${r.revision} guardada — se conservó lo que se emitió.`);
      return r || { ok: false, motivo: 'desconocido' };
    } catch (e) {
      return { ok: false, motivo: String(e?.message || e) };
    }
  }

  // permiso === 'error' (no se pudo consultar) NO cuenta como acceso: sin este
  // descarte, el efecto de sincronización con la nube (más abajo, depende de
  // accesoOk) arrancaría igual que si el permiso sí se hubiera confirmado.
  const accesoOk = !!sesion && !!permiso && permiso !== 'error';
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
    const desuscribir = veCostos ? suscribirConfig((datos) => {
      if (!datos || !datos.insumos) return;
      const f = firma(datos);
      if (f === ultimoCompartido.current) return; // es mi propio cambio, ignorar
      aplicandoRemoto.current = true;
      ultimoCompartido.current = f;
      setEstado((e) => aplicarCompartido(e, datos));
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
  function partidasDeItemsIA(costados) {
    return costados.map((c) => ({
      // Sin `producto` NO se arma `linea-undefined` (ese id falso hacía que dos
      // muebles distintos sin clave se fundieran en un mismo renglón): sin clave,
      // el piezaId queda null, que `mismoRenglon` ya maneja bien (audit 2026-10-01).
      id: idNuevo('p'), piezaId: c.producto ? `linea-${c.producto}` : null, nombre: c.nombre,
      ruta: c.ruta || null, productoId: c.producto || null, w: c.w || null, d: c.d || null,
      // `|| 1`: piso de seguridad. Una partida FIRME siempre es ≥1 pieza; si por
      // cualquier ruta llegara sin cantidad, jamás debe guardarse en 0 (los
      // totales hacen precio × (cantidad||0) y perderían el renglón). No inventa
      // cantidades de borradores viejos —eso se recupera aparte— solo evita el $0.
      // VENDEDOR (seller-safe): la partida NO lleva economía en su estado (costo,
      // margen, costoDerivado). El precio de venta sí (lo puede ver). Defensa en
      // profundidad además del saneo por rol de las tools de Voni.
      cantidad: c.cantidad || 1, costoUnitario: veCostos ? c.costoUnitario : null, precioUnitario: c.precioUnitario, margen: veCostos ? c.margen : null,
      nota: c.nota || null, confianza: c.confianza || null, config: c.config || null,
      precioReal: !!c.precioReal,   // manda el sello Firme/Calibrado/Estimado
      // El artículo del catálogo con el que casó (para el piso de descuento) y,
      // si hay varias terminaciones, las opciones para que el vendedor elija.
      catalogo: c.catalogo || null, variantes: c.variantes || null,
      // ¿Voni lo PROPUSO como acompañante (silla, gaveta…) o lo pidió el cliente?
      sugerido: !!c.sugerido,
      // Se perdían al reconstruir la partida desde cero: sin esto, ni los
      // avisos de costearItem() llegaban a pantalla (EstoEntendi.jsx ya los
      // esperaba, pero `avisos` nunca venía) ni el candado podía sobrevivir
      // hasta el punto donde de verdad hace falta bloquear (Imprimir).
      avisos: c.avisos || [],
      candadoUsuarios: !!c.candadoUsuarios,
      requiereProyectista: !!c.requiereProyectista,
      // ⚠️ `deBanco` DEBE sobrevivir el mapeo (audit externo 2026-09-24). Sin él,
      // una pieza del banco (precio real de proyecto cerrado, SIN costo de
      // fabricación conocido) llegaba como precioReal:true / costo 0, y la
      // pantalla le pintaba un MARGEN FALSO del 100% en vez de "costo
      // desconocido". Con la marca, el sello y el margen la tratan como banco.
      deBanco: !!c.deBanco,
      // Costo DERIVADO del precio (≈ precio/3.6), no de un despiece real: la
      // pantalla muestra su margen como aproximado, no medido (audit 2026-09-24).
      costoDerivado: veCostos ? !!c.costoDerivado : false,
      // Piezas excluidas ($0 por decisión) también por el camino de la IA/Voni.
      nombresExcluidos: Array.isArray(c.nombresExcluidos) ? c.nombresExcluidos
        : (c.componentes || []).filter((x) => x && x.excluida).map((x) => x.nombre || 'Partida excluida'),
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
    // VENDEDOR (seller-safe): NO se corre el motor de costo en su navegador ni se
    // siembra costo/margen en el estado. El precio sale del catálogo autorizado y la
    // emisión revalida en el servidor por identidad (producto_id). Antes, si el
    // costeo llegaba sin costo, este camino ejecutaba calcular() con estado.insumos y
    // guardaba un costoUnitario REAL en la partida del vendedor (fuga client-side).
    let costo = null;
    let margenEf = null;
    if (veCostos) {
      costo = costoUnitario;
      if (!Number.isFinite(costo)) {
        try { costo = calcular(costeo, n, estado.insumos, modeloParaPieza(estado.parametros, costeo).par).costoUnitario; }
        catch (e) { costo = Number.isFinite(margen) ? precioUnitario * (1 - margen / 100) : 0; }
      }
      margenEf = Number.isFinite(margen) ? margen : null;
    }
    return {
      id: idNuevo('p'),
      piezaId: costeo.piezaId || null,
      nombre: costeo.nombre,
      ruta: costeo.ruta || null,
      productoId: costeo.productoId || null,
      // Pin de la versión canónica del producto (una sola verdad): el gate de emisión
      // exige producto_version_id en toda línea ligada a producto (Cocrear/catálogo).
      producto_version_id: costeo.productVersionId || costeo.producto_version_id || null,
      // Imagen canónica del especial co-diseñado (URL de Storage, nunca base64): la
      // misma que el cliente vio en Cocrear viaja a la partida (una sola verdad).
      render: costeo.render || null,
      w: costeo.w || null, d: costeo.d || null,
      cantidad: n,
      costoUnitario: costo,
      precioUnitario,
      margen: margenEf,
      config: costeo.config || null,
      precioReal: !!costeo.precioReal,
      // Mismo candado que ya trae `costearItem()` (camino de Voni) — este
      // camino manual ("Cotizar de línea") lo armaba sin pasar por ahí, así
      // que hasta hoy no detectaba NADA de esto (hueco real, más allá de lo
      // que cubrió la auditoría original).
      candadoUsuarios: !!(costeo.config?.usuarios && n > 1),
      requiereProyectista: !!(costeo.config?.usuarios && Number(costeo.config.usuarios) > 14),
      // Costeo incompleto: piezas del despiece sin material en el catálogo
      // (se costean en $0). Bloquea la emisión, no el guardado.
      // Completitud del costeo (piezas sin material en catálogo) SOLO para quien
      // ve costos: el vendedor no corre el motor y su emisión revalida por identidad
      // de catálogo, no por BOM — correr esto sin insumos lo marcaría todo "sin material".
      ...(veCostos
        ? (() => { const s = componentesSinMaterial(costeo.componentes, estado.insumos); return { piezasSinMaterial: s.length, nombresSinMaterial: s }; })()
        : { piezasSinMaterial: 0, nombresSinMaterial: [] }),
      // Piezas EXCLUIDAS ($0 por decisión: "lo pone el cliente / otra área"). No es
      // economía (es una decisión del despiece) → viaja siempre, para que la
      // cotización obligue a confirmarlas y el PDF imprima la cláusula. Sin esto, un
      // clic apurado vende el mueble sin cristal/herrajes y nadie se entera.
      nombresExcluidos: (costeo.componentes || []).filter((c) => c && c.excluida).map((c) => c.nombre || 'Partida excluida'),
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
      // Seller-safe: el vendedor no guarda costo (ni el derivado del precio).
      costoUnitario: veCostos ? costoImplicito(a.lista) : null,
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
  async function onAgregarCotizacion(resultado, precio, margen) {
    const n = Math.max(1, Number(costeo.piezas) || 1);

    // AUTORIDAD ECONÓMICA: antes de permitir que un costeo NUEVO entre a la
    // cotización, el servidor vuelve a correr EL MISMO motor con su config real.
    // Si cliente y servidor difieren siquiera $0.01, falla cerrado: no guardamos
    // una cifra que mañana no podamos defender.
    let autoritativo;
    try {
      autoritativo = await costearServidor(costeo, n);
    } catch (e) {
      const error = 'No se agregó: no pude certificar el costo con el servidor.';
      mostrarAviso(error, 7000);
      return { ok: false, error };
    }
    if (!autoritativo?.ok) {
      const error = 'No se agregó: ' + (autoritativo?.error || 'el servidor no pudo certificar este costeo.');
      mostrarAviso(error, 7000);
      return { ok: false, error };
    }
    if (autoritativo.estado === 'incompleto' || autoritativo.estado === 'bloqueado') {
      const error = 'No se agregó: el costo autoritativo está ' + autoritativo.estado + '.';
      mostrarAviso(error, 7000);
      return { ok: false, error };
    }

    const costoServidor = Number(autoritativo?.costo?.costoUnitario);
    const costoCliente = Number(resultado?.costoUnitario);
    if (!Number.isFinite(costoServidor) || !Number.isFinite(costoCliente)) {
      const error = 'No se agregó: el costo no es finito o no pudo certificarse.';
      mostrarAviso(error, 7000);
      return { ok: false, error };
    }
    const clienteCentavos = Math.round((costoCliente + Math.sign(costoCliente || 1) * Number.EPSILON) * 100);
    const servidorCentavos = Math.round((costoServidor + Math.sign(costoServidor || 1) * Number.EPSILON) * 100);
    if (clienteCentavos !== servidorCentavos) {
      const delta = Math.abs(servidorCentavos - clienteCentavos) / 100;
      const error = `No se agregó: cliente y servidor difieren $${delta.toFixed(2)}. Recarga los datos y vuelve a costear.`;
      mostrarAviso(error, 9000);
      return { ok: false, error, cliente: costoCliente, servidor: costoServidor };
    }

    // Piezas sin material: el motor ya las reporta; si no vino el resultado, se
    // deriva del despiece. Viaja con la partida para bloquear la emisión (no el
    // guardado) hasta que se les asigne material.
    const sinMat = Array.isArray(resultado?.componentesIgnorados)
      ? resultado.componentesIgnorados
      : componentesSinMaterial(costeo.componentes, estado.insumos);
    // Piezas excluidas ($0 por decisión): el motor ya las reporta; si no, del despiece.
    const excl = Array.isArray(resultado?.componentesExcluidos)
      ? resultado.componentesExcluidos
      : (costeo.componentes || []).filter((c) => c && c.excluida).map((c) => c.nombre || 'Partida excluida');

    sumarPartidas([{
      id: idNuevo('p'),
      piezaId: costeo.piezaId || null,
      nombre: costeo.nombre || 'Mueble a la medida',
      ruta: costeo.ruta || null,
      productoId: costeo.productoId || null,
      w: costeo.w || null, d: costeo.d || null,
      cantidad: n,
      // La cifra que entra a la cotización es la del SERVIDOR, no la del navegador.
      costoUnitario: costoServidor,
      precioUnitario: precio,
      margen: Number.isFinite(margen) ? margen : null,
      config: null,
      costoEstado: autoritativo.estado || null,
      versionMotor: autoritativo.versionMotor || null,
      versionCatalogo: autoritativo.versionCatalogo || null,
      piezasSinMaterial: sinMat.length,
      nombresSinMaterial: sinMat,
      nombresExcluidos: excl,
    }]);
    mostrarAviso(`Agregado y verificado: ${costeo.nombre || 'mueble a la medida'}`);
    return { ok: true, estado: autoritativo.estado, costoUnitario: costoServidor };
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
  const mismoRenglon = (a, b) =>
    a.nombre === b.nombre &&
    Math.round(a.precioUnitario || 0) === Math.round(b.precioUnitario || 0) &&
    (a.piezaId || null) === (b.piezaId || null) &&
    (a.ruta || null) === (b.ruta || null) &&
    (a.productoId || null) === (b.productoId || null) &&
    JSON.stringify(a.config || null) === JSON.stringify(b.config || null);

  function juntarIguales(lista) {
    const out = [];
    for (const p of lista) {
      const ya = out.find((q) => mismoRenglon(q, p));
      if (ya) ya.cantidad = (ya.cantidad || 0) + (p.cantidad || 0);
      else out.push({ ...p });
    }
    return out;
  }

  function agregarItemsProyecto(costados, opts = {}) {
    const partidas = partidasDeItemsIA(costados).map((p) => ({ ...p, loteIA: opts.lote || null }));
    setEstado((e) => {
      const previas = e.cotizacion.partidas || [];
      const base = opts.reemplaza ? previas.filter((p) => p.loteIA !== opts.reemplaza) : previas;
      return { ...e, cotizacion: { ...e.cotizacion, partidas: juntarIguales([...base, ...partidas]) } };
    });
    mostrarAviso(`¡Listo! ${partidas.length} mueble(s) en tu proyecto`);
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
  const costoDeBanco = (item) => {
    const p = Number(item?.precio) || 0;
    if (!p) return 0;
    const esSilleria = item?.categoria === 'Sillería';
    const precio2 = esSilleria ? p : p / 0.60;
    return Math.round(costoImplicito(precio2));
  };
  const margenDeBanco = (item) => {
    const c = costoDeBanco(item), p = Number(item?.precio) || 0;
    return p > 0 && c > 0 ? Math.round(((p - c) / p) * 100) : null;
  };

  // Banco de precios -> agrega una partida con el precio real ya cotizado.
  function agregarDeBanco(item, cantidad) {
    const nombre = item.medidas ? `${item.nombre} (${item.medidas})` : item.nombre;
    const partida = {
      id: idNuevo('p'), piezaId: item.id, nombre,
      cantidad, costoUnitario: costoDeBanco(item), precioUnitario: item.precio,
      margen: margenDeBanco(item), deBanco: true,
    };
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
    const partida = {
      id: idNuevo('p'), piezaId: r.clave ? `linea-${r.clave}` : null, nombre: r.nombre,
      ruta: r.ruta || null, productoId: r.clave || null, claveLinea: r.clave || null,
      cantidad: 1, costoUnitario: null, precioUnitario: r.precio,
      margen: null, deLinea: true,
    };
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
            <button className="btn-enc" onClick={() => { setRecuperando(false); irA('contrasena'); }}>Contraseña</button>
            <button className="btn-enc" onClick={hacerLogout} title={sesion.user.email}>Salir</button>
          </div>
        </div>
      </header>

      <main>
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
          <Cocrear estado={estado} soloVentas={esVendedor} onIr={irA} onAgregar={agregarDesdeAsistente} />
        )}
        {pestania === 'banco' && <Banco onAgregar={agregarDeBanco} onIr={irA} />}
        {pestania === 'archivo' && (
          <Archivo
            estado={estado}
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
              idCotizacion.current = c.id;   // seguir editando ESE, no crear otro
              setEstado((e) => ({
                ...e,
                cotizacion: {
                  ...e.cotizacion,
                  cliente: full.cliente || '', folio: full.folio || '',
                  partidas: full.partidas || [], acomodo: full.acomodo || null,
                  descuentoPct: full.totales?.descuentoPct ?? e.cotizacion.descuentoPct,
                  contingenciaPct: full.totales?.contingenciaPct ?? e.cotizacion.contingenciaPct,
                  maniobrasPct: full.totales?.maniobrasPct ?? e.cotizacion.maniobrasPct,
                  fletePct: full.totales?.fletePct ?? e.cotizacion.fletePct,
                },
              }));
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
          ? <div className="contenido"><AsistenteEspecial estado={estado} onVerDetalle={(bor) => { setCosteo({ ...costeoEnBlanco(), ...bor, factorDirecta: bor.factorDirecta ?? null, factorIndirecta: bor.factorIndirecta ?? null }); irA('costeador'); }} onInicio={irInicio} onBiblioteca={() => irA('biblioteca')} expedienteInicial={expedienteAbierto} /></div>
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
                onAgregarCotizacion={onAgregarCotizacion} onGuardarPieza={onGuardarPieza} />
            </div>
          )
          : <div className="contenido"><div className="tarjeta"><p className="ayuda">El modo avanzado y el costo de fabricación son para Diseño y Dirección. Usa <strong>Cotizar un mueble</strong> para el precio recomendado.</p></div></div>
        )}
        {pestania === 'catalogo' && <Catalogo estado={estado} onCargar={onElegirDelCatalogo} soloVentas={esVendedor} />}
        {pestania === 'cotizacion' && <Cotizacion estado={estado} setEstado={setEstado} soloVentas={esVendedor} onIr={irA} onEmitida={onEmitida} verificarEmision={verificarEmision} veCostos={veCostos} />}
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
            onIr={irA}
          />
        )}
        {pestania === 'contrasena' && <CambiarContrasena email={sesion?.user?.email} recuperacion={recuperando} onListo={() => { setRecuperando(false); irInicio(); }} />}
        {pestania === 'acomodo' && <Acomodo estado={estado} onIr={irA} onGuardarAcomodo={guardarAcomodo} />}
        {pestania === 'precios' && (veCostos
          ? <Precios estado={estado} setEstado={setEstado} puedeVerDireccion={desbloqueado} onDireccion={null} />
          : <div className="contenido"><div className="tarjeta"><p className="ayuda">Los precios de materiales son costos y solo los ven Diseño y Dirección.</p></div></div>
        )}
        {pestania === 'usuarios' && esDireccion && <Usuarios onAviso={mostrarAviso} miCorreo={sesion?.user?.email || ''} />}
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
                partidasLocales: (estado.cotizacion?.partidas || []).map((p) => ({
                  nombre: p.nombre,
                  cantidad: p.cantidad,
                  precioUnitario: p.precioUnitario,
                  sinPrecioAutorizado: !(Number(p.precioUnitario) > 0),
                })),
                // Acomodo vivo (geometría, sin economía) para "¿cabe? ¿está acomodado?".
                acomodoLocal: estado.cotizacion?.acomodo || null,
                // Fuente económica autorizada: SÓLO veCostos, y sólo el BOM del
                // costeo actual (la tool igual bloquea a vendedor/cliente).
                bom: veCostos ? (costeo?.componentes || null) : null,
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
