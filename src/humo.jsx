// ============================================================================
//  PRUEBA DE HUMO — renderiza TODAS las pantallas de la app de un jalón.
//  Dev-only, no entra al build.  →  http://localhost:5173/humo.html
//
//  Existe porque el 2026-08-15 tres pantallas completas estuvieron muertas y ni
//  el build ni las pruebas del motor lo vieron: sólo truena al renderizar. Aquí
//  cada pantalla se monta dentro de su propia red, así que una que falle NO
//  tumba a las demás y se ve exactamente cuál y por qué.
//
//  El recuadro de arriba dice cuántas montaron y cuántas fallaron. Verde = se
//  puede publicar.
// ============================================================================
import { useState, Component, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import './estilos.css';
import './fuentes.css';

import { INSUMOS_SEMILLA, mapaInsumos } from './datos/insumos.js';
import { PARAMETROS_DEFAULT } from './motor/calculo.js';
import { LINEAS_REG } from './datos/lineas.js';

import Inicio from './componentes/Inicio.jsx';
import Asistente from './componentes/Asistente.jsx';
import AsistenteEspecial from './componentes/AsistenteEspecial.jsx';
import Banco from './componentes/Banco.jsx';
import Archivo from './componentes/Archivo.jsx';
import Catalogo from './componentes/Catalogo.jsx';
import Costeador from './componentes/Costeador.jsx';
import CosteadorLinea from './componentes/CosteadorLinea.jsx';
import Cotizacion from './componentes/Cotizacion.jsx';
import CotizadorIA from './componentes/CotizadorIA.jsx';
import Voni from './componentes/Voni.jsx';
import Acomodo from './componentes/Acomodo.jsx';
import DibujarPlano from './componentes/DibujarPlano.jsx';
import EditarPartida from './componentes/EditarPartida.jsx';
import Guia from './componentes/Guia.jsx';
import Precios from './componentes/Precios.jsx';
import Tablero from './componentes/Tablero.jsx';
import Usuarios from './componentes/Usuarios.jsx';
import Reglas from './componentes/Reglas.jsx';
import Login from './componentes/Login.jsx';
import CambiarContrasena from './componentes/CambiarContrasena.jsx';
import FichaPDF from './componentes/FichaPDF.jsx';
import InformeIA from './componentes/InformeIA.jsx';
import MiniRender from './componentes/MiniRender.jsx';

const nada = () => {};
const insumos = mapaInsumos(INSUMOS_SEMILLA);
// Cotización REAL: la que produjo Voni con un pedido de oficina completo
// ("20 lugares en bench, 2 ejecutivos, sala de juntas para 12, 6 archiveros,
// 4 sillones") y costeada por el motor. Probar con una sola partida escondía
// todo lo que se rompe cuando la propuesta tiene renglones de verdad.
const PARTIDAS = [
 {
  "id": "p1",
  "piezaId": "linea-banca_doble",
  "nombre": "Banca doble APP LT 1.50 · 10 usuarios · ocupa 7.50 × 1.20 m",
  "ruta": "applt",
  "productoId": "banca_doble",
  "w": 7500,
  "d": 1200,
  "cantidad": 2,
  "costoUnitario": 19185,
  "precioUnitario": 41439,
  "margen": 50,
  "precioReal": false,
  "config": {
   "producto": "banca_doble",
   "largoMM": 1500,
   "fondoMM": 1200,
   "usuarios": 10,
   "biombo": "melamina",
   "finish": "ABS",
   "electrico": false
  }
 },
 {
  "id": "p2",
  "piezaId": "linea-escritorio",
  "nombre": "Eclipse Escritorio Directivo 2.10 m · mano Derecha",
  "ruta": "eclipse",
  "productoId": "escritorio",
  "w": 2100,
  "d": 900,
  "cantidad": 2,
  "costoUnitario": 12566,
  "precioUnitario": 25132,
  "margen": 50,
  "precioReal": false,
  "config": {
   "producto": "escritorio",
   "largoMM": 2100,
   "finish": "chapa",
   "mano": "D",
   "electrico": false
  }
 },
 {
  "id": "p3",
  "piezaId": "linea-credenza",
  "nombre": "Eclipse Credenza baja 2.10 × 0.60 m · mano Derecha",
  "ruta": "eclipse",
  "productoId": "credenza",
  "w": 2100,
  "d": 600,
  "cantidad": 2,
  "costoUnitario": 9682,
  "precioUnitario": 19364,
  "margen": 50,
  "precioReal": false,
  "config": {
   "producto": "credenza",
   "largoMM": 2100,
   "fondoMM": 600,
   "finish": "chapa",
   "mano": "D",
   "electrico": false
  }
 },
 {
  "id": "p4",
  "piezaId": "linea-mesa_juntas",
  "nombre": "Alba · Mesa de juntas 3.60 m · Melamina ABS",
  "ruta": "alba",
  "productoId": "mesa_juntas",
  "w": 3600,
  "d": 1200,
  "cantidad": 1,
  "costoUnitario": 10216,
  "precioUnitario": 20432,
  "margen": 50,
  "precioReal": false,
  "config": {
   "producto": "mesa_juntas",
   "finish": "ABS",
   "largo": "3600",
   "electrico": true
  }
 },
 {
  "id": "p5",
  "piezaId": "linea-archivero_h",
  "nombre": "Modulor · Archivero horizontal 0.75 2 cajones · Melamina y canto ABS",
  "ruta": "modulor",
  "productoId": "archivero_h",
  "w": 750,
  "d": 476,
  "cantidad": 6,
  "costoUnitario": 1481,
  "precioUnitario": 2962,
  "margen": 50,
  "precioReal": false,
  "config": {
   "producto": "archivero_h",
   "finish": "ABS",
   "modelo": "cajones75",
   "cerradura": true,
   "cojin": false
  }
 },
 {
  "id": "p6",
  "piezaId": "linea-sillon",
  "nombre": "Sillón Pac 1 plaza (0.60×0.60 m) · tela",
  "ruta": "pac",
  "productoId": "sillon",
  "w": 0,
  "d": 0,
  "cantidad": 4,
  "costoUnitario": 2253,
  "precioUnitario": 4507,
  "margen": 50,
  "precioReal": false,
  "config": {
   "producto": "sillon",
   "finish": "tela",
   "plazas": "1",
   "placa": false
  }
 }
];
const partida = PARTIDAS[0];
const estado = {
  insumos, parametros: PARAMETROS_DEFAULT, piezas: [],
  cotizacion: { cliente: 'Corporativo de prueba, S.A. de C.V.', folio: '2608-001', fecha: '2026-08-16', partidas: PARTIDAS },
  historial: [], lineasUsadas: {}, onboardingVisto: true,
};
const costeo = {
  piezaId: null, nombre: 'Mueble de prueba', linea: null, piezas: 1,
  componentes: [{ nombre: 'Cubierta', insumoId: 'melamina-28', largoMM: 1500, anchoMM: 600, piezas: 1 }],
  modoManoObra: 'porcentaje', horas: {}, factorDirecta: 55, factorIndirecta: 12, margen: 50,
};

// ⚠️ VONI CON `paso` DE VERDAD (2026-08-17). Las entradas de abajo lo montan
// con `setPaso={nada}`, así que el paso NUNCA cambia y todo lo que se prueba es
// que la pantalla pinta. Por eso pasó desapercibido que en el paso 1 los
// botones "Subir el plano" y "Dibujar la oficina" sólo hacían `setPaso(3)`:
// brincaban al acomodo sin abrir nada. Rodrigo lo cazó usándola, no la prueba.
// Con estado propio, el camino se puede CAMINAR aquí.
// Las áreas del plano REAL de Rodrigo, para poder caminar el cuestionario ya
// lleno (8 islas de 4.5 × 3.5, 5 privados, 2 salas, recepción).
const AREAS_PLANO = [
  { nombre: 'Privado 1', tipo: 'privado', ancho: 4.5, largo: 5 },
  { nombre: 'Privado 2', tipo: 'privado', ancho: 3.5, largo: 6 },
  { nombre: 'Privado 3', tipo: 'privado', ancho: 5, largo: 5 },
  { nombre: 'Privado 4', tipo: 'privado', ancho: 4, largo: 5.5 },
  { nombre: 'Privado 5', tipo: 'privado', ancho: 5, largo: 5.5 },
  { nombre: 'Sala Juntas 1', tipo: 'juntas', ancho: 7, largo: 6 },
  { nombre: 'Sala Juntas 2', tipo: 'juntas', ancho: 7, largo: 5 },
  { nombre: 'Recepcion', tipo: 'recepcion', ancho: 7, largo: 8 },
  { nombre: 'Pasillo de circulacion', tipo: 'open', ancho: 23, largo: 14, contiene: 8 },
  ...[1,2,3,4,5,6,7,8].map((n) => ({ nombre: 'Area Op. ' + n, tipo: 'open', ancho: 4.5, largo: 3.5, dentroDe: 'Pasillo de circulacion' })),
];
const estadoConPlano = { ...estado, cotizacion: { ...estado.cotizacion, acomodo: { areasM: AREAS_PLANO } } };

function VoniVivo() {
  const [paso, setPaso] = useState(1);
  return <Voni estado={estado} setEstado={nada} soloVentas={false} veCostos
    paso={paso} setPaso={setPaso} onAgregarItems={nada} onGuardarAcomodo={nada} onIr={nada} />;
}

// Cada pantalla con los props que de verdad pide.
const PANTALLAS = [
  ['Login', <Login onEntrar={nada} onRecuperar={nada} />],
  ['Cambiar contraseña', <CambiarContrasena email="x@vonhaucke.mx" onListo={nada} onCancelar={nada} />],
  // ⚠️ PUNTO CIEGO QUE ESTUVO AQUÍ (2026-08-17): estas dos entradas pasaban
  // `vista="menu"` y `vista="linea"`, nombres que quedaron viejos tras un
  // renombre — `Inicio` sólo reconoce 'home' y 'cotizar'. Las dos caían al mismo
  // `else` y pintaban "Cotizar de línea" DOS veces, así que **la pantalla Home y
  // el panel Cotizar no se probaban nunca**. Salió al buscar un botón nuevo que
  // sí existía y no aparecía por ningún lado.
  ['Inicio', <Inicio estado={estado} onIr={nada} veCostos esDireccion vista="home" setVista={nada} onDescartar={nada} />],
  ['Inicio · panel cotizar', <Inicio estado={estado} onIr={nada} veCostos esDireccion vista="cotizar" setVista={nada} />],
  ['Inicio · cotizar de línea', <Inicio estado={estado} onIr={nada} veCostos esDireccion vista="cotizarlinea" setVista={nada} />],
  ['Guía', <Guia primeraVez={false} onIr={nada} onCerrar={nada} estado={estado} rol="ventas" />],
  ['Voni', <Voni estado={estado} setEstado={nada} soloVentas={false} veCostos paso={1} setPaso={nada} onAgregarItems={nada} onGuardarAcomodo={nada} onIr={nada} />],
  // El paso 2 va aparte: `paso` lo manda App, así que con uno solo montado
  // nunca se probaba el cuestionario de botones (ni el resto del paso).
  ['Voni · paso 2 muebles', <Voni estado={estado} setEstado={nada} soloVentas={false} veCostos paso={2} setPaso={nada} onAgregarItems={nada} onGuardarAcomodo={nada} onIr={nada} />],
  ['Voni vivo (se camina)', <VoniVivo />],
  ['Programa con plano', <CotizadorIA estado={estadoConPlano} onAgregarItems={nada} onIr={nada} conPrograma />],
  ['Cotizar con IA', <CotizadorIA estado={estado} onAgregarItems={nada} onIr={nada} verCotizacion />],
  ['Asistente', <Asistente estado={estado} onAgregarPartida={nada} onModoAvanzado={nada} onIr={nada} />],
  ['Asistente especial', <AsistenteEspecial estado={estado} onVerDetalle={nada} onInicio={nada} />],
  ['Banco de precios', <Banco onAgregar={nada} onIr={nada} />],
  // El archivo de presupuestos: monta contra la nube, así que en la prueba de
  // humo se ve el estado "cargando/vacío". Lo que se comprueba aquí es que la
  // pantalla MONTA y no tumba la app cuando no hay sesión.
  ['Presupuestos que ya hicimos', <Archivo estado={estado} onAbrir={nada} />],
  ['Catálogo', <Catalogo estado={estado} onCargar={nada} soloVentas={false} />],
  ['Costear especial', <Costeador estado={estado} costeo={costeo} setCosteo={nada} onAgregarCotizacion={nada} onGuardarPieza={nada} />],
  ['Propuesta (mis números)', <Cotizacion estado={estado} setEstado={nada} soloVentas={false} onIr={nada} />],
  ['Propuesta (vista cliente)', <Cotizacion estado={estado} setEstado={nada} soloVentas onIr={nada} />],
  // El guardado se ESPÍA en la prueba de humo: así se comprueba que el acomodo
  // se persiste solo (Rodrigo perdía el trabajo al cambiar de pestaña) sin
  // tener que entrar con cuenta a la app en vivo.
  ['Acomodo 3D', <Acomodo estado={estado} onIr={nada} onGuardarAcomodo={(d, silencioso) => {
    window.__guardadoAcomodo = {
      n: (window.__guardadoAcomodo?.n || 0) + 1, silencioso,
      areasM: d.areasM?.length || 0, piezas: d.plan?.colocacion?.length || 0,
    };
  }} />],
  ['Dibujar plano', <DibujarPlano onListo={nada} onCancelar={nada} />],
  ['Editar partida', <EditarPartida estado={estado} partida={partida} onGuardar={nada} onCerrar={nada} />],
  ['Precios de material', <Precios estado={estado} setEstado={nada} esDireccion />],
  ['Tablero', <Tablero estado={estado} irA={nada} puedeVerDireccion onDireccion={null} />],
  ['Usuarios', <Usuarios />],
  ['Lo que Voni sabe', <Reglas puedeEditar />],
  // ⚠️ Estas dos entradas estaban MINTIENDO (cazado el 2026-08-18):
  //   · a la Ficha se le pasaba `resultado={null}`, un prop que NO EXISTE en su
  //     firma, y NO se le pasaba `precioUnitario` — así que se probaba siempre
  //     con la ficha en $0 y nada del bloque de dinero quedaba cubierto.
  //   · a InformeIA se le pasaba `texto`, y el componente recibe `{ informe }`.
  //     `partirSecciones(undefined)` devuelve [] y el componente sale con
  //     `return null`: CERO tarjetas, y arriba decía "1 de 1 montan bien".
  // Un prop con el nombre equivocado NO truena en React: por eso, además de
  // corregirlos, hay que MEDIR el DOM (ver `Red`, más abajo).
  ['Ficha PDF', <FichaPDF estado={estado} costeo={costeo} cantidad={2} precioUnitario={41439} onCerrar={nada} />],
  ['Informe IA', <InformeIA informe={'## Prueba\n- uno\n- dos'} />],
  ['MiniRender', <MiniRender tipo="escritorio" w={1500} d={600} />],
  // Las 24 pantallas de línea: es donde estuvo el bug.
  ...Object.entries(LINEAS_REG).map(([ruta, L]) => [
    `Línea · ${L.titulo}`,
    <CosteadorLinea onIr={nada} linea={ruta} soloVentas={false} estado={estado} titulo={`Costeador ${L.titulo}`}
      productos={L.productos} generar={L.generar} onAgregar={nada} onAgregarModulo={nada} />,
  ]),
];

// ============================================================================
//  EL PUNTO CIEGO QUE ESTA PRUEBA TENÍA (cerrado el 2026-08-18)
//  ---------------------------------------------------------------------------
//  Hasta hoy el conteo era `ok = VISIBLES.length - fallos.length`, y `fallos`
//  SÓLO crecía cuando un componente TRONABA. Una pantalla que pinta `null` —
//  porque le llega el prop con otro nombre y su contenido sale vacío — contaba
//  como "monta bien" y el recuadro salía VERDE.
//  Pasó de verdad con `<InformeIA texto={...}/>` cuando el componente recibe
//  `{ informe }`: 0 tarjetas en pantalla y arriba "1 de 1 pantallas montan bien".
//  La prueba que presumía cerrar el punto ciego LO TENÍA.
//  Ahora se mide lo que quedó en el DOM: **una pantalla en blanco es un FALLO.**
//  Verificado que ningún componente pinta por portal (`createPortal`: 0 usos),
//  así que medir dentro de la caja de cada pantalla no da falsas alarmas.
// ============================================================================
//  Los umbrales van MEDIDOS, no a ojo (2026-08-18, las 53 pantallas):
//  la más flaca que es legítima es "Lo que Voni sabe" con 6 elementos, y
//  "MiniRender" pinta 13 elementos con CERO caracteres porque es un dibujo SVG.
//  Por eso la condición es Y (pocos elementos **y** poco texto): con O,
//  MiniRender daría falsa alarma en cada corrida y el aviso se volvería ruido
//  que nadie mira. Con 3 hay margen de sobra contra el suelo real de 6, y el
//  caso que importa — `return null` → 0 elementos — cae siempre.
const MIN_ELEMENTOS = 3;    // menos nodos que esto es una pantalla en blanco
const MIN_TEXTO = 12;       // caracteres visibles
const ESPERA_ASYNC = 2000;  // ms — margen para las que cargan solas

// Red por pantalla: una que truene no se lleva a las demás.
class Red extends Component {
  constructor(p) { super(p); this.state = { error: null }; this.caja = createRef(); }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { this.props.onFallo?.(this.props.titulo, error); }
  componentDidMount() { this.reloj = setTimeout(() => this.medir(), ESPERA_ASYNC); }
  componentWillUnmount() { clearTimeout(this.reloj); }

  medir() {
    if (this.state.error) return;            // ya se contó como fallo que truena
    const caja = this.caja.current;
    if (!caja) return;
    const elementos = caja.querySelectorAll('*').length;
    const texto = (caja.textContent || '').trim().length;
    if (elementos < MIN_ELEMENTOS && texto < MIN_TEXTO) {
      this.props.onVacia?.(this.props.titulo, `pintó ${elementos} elementos y ${texto} caracteres`);
    }
  }

  render() {
    if (this.state.error) {
      return <div className="alerta roja"><span className="texto">
        <strong>{this.props.titulo}</strong> — {String(this.state.error?.message || this.state.error)}
      </span></div>;
    }
    return <div ref={this.caja}>{this.props.children}</div>;
  }
}

// Para AUDITAR una pantalla sola hay que poder aislarla: con las 49 apiladas,
// los modales de una tapan a la de al lado y los clics caen en la pantalla
// equivocada.  →  humo.html?solo=acomodo   (busca por pedazo del título)
const SOLO = new URLSearchParams(location.search).get('solo')?.toLowerCase() || '';
const VISIBLES = SOLO
  ? PANTALLAS.filter(([t]) => t.toLowerCase().includes(SOLO))
  : PANTALLAS;

function Humo() {
  const [fallos, setFallos] = useState([]);
  const [vacias, setVacias] = useState([]);
  const anota = (titulo, error) => setFallos((f) => (f.some((x) => x.titulo === titulo) ? f : [...f, { titulo, error: String(error?.message || error) }]));
  // Una pantalla vacía NO truena: se detecta midiendo el DOM. Se cuenta aparte
  // de las que truenan porque el síntoma es distinto y la causa también
  // (casi siempre un prop con el nombre equivocado).
  const anotaVacia = (titulo, detalle) => setVacias((v) => (v.some((x) => x.titulo === titulo) ? v : [...v, { titulo, detalle }]));
  const malas = fallos.length + vacias.length;
  const ok = VISIBLES.length - malas;
  return (
    <>
      <div className="contenido">
        <div className={`alerta ${malas ? 'roja' : 'verde'}`} style={{ position: 'sticky', top: 0, zIndex: 50 }}>
          <span className="texto">
            <strong>{ok} de {VISIBLES.length} pantallas montan bien.</strong>
            {SOLO && <> (filtrando por “{SOLO}”)</>}
            {fallos.length > 0 && <> <strong>Truenan:</strong> {fallos.map((f) => f.titulo).join(', ')}.</>}
            {vacias.length > 0 && <> <strong>Salen EN BLANCO</strong> (montan sin quejarse y no pintan nada — casi
              siempre un prop mal nombrado): {vacias.map((v) => `${v.titulo} (${v.detalle})`).join(', ')}.</>}
          </span>
        </div>
      </div>
      {VISIBLES.map(([titulo, el]) => (
        <div key={titulo} style={{ borderTop: '3px solid var(--rojo)', marginTop: 24, paddingTop: 8 }}>
          <div className="contenido"><h3 style={{ margin: 0 }}>{titulo}</h3></div>
          <Red titulo={titulo} onFallo={anota} onVacia={anotaVacia}>{el}</Red>
        </div>
      ))}
    </>
  );
}

createRoot(document.getElementById('raiz')).render(<Humo />);
