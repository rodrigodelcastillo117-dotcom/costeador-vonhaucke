// ============================================================================
//  GUÍA  ·  el manual completo de la app, en una ventana.
//
//  Cuatro decisiones de diseño, por si alguien la toca después:
//
//  1. ES UN MANUAL, NO UN TOUR. Cubre TODAS las pantallas y TODOS los conceptos.
//     Por eso va en SECCIONES con índice y buscador: una lista plana de 40
//     temas no se puede usar.
//  2. NADIE LEE UN MURO DE TEXTO. Cada tema muestra una línea; el detalle se
//     abre si lo pides. Se barre en segundos y se profundiza si hace falta.
//  3. LO QUE SE VE SE RECUERDA. Los temas clave traen el pedazo REAL de
//     interfaz (el sello Firme/Estimado, la barra del precio, el punto de
//     conexión). Cuando el usuario lo vea en la app, ya lo conoce.
//  4. NO PUEDE MENTIR. Las reglas de negocio se leen de los parámetros VIVOS.
//     Si Dirección cambia el margen, la guía lo dice sola.
//
//  Secciones y temas se filtran por ROL: a Ventas no se le enseña el costeo.
//  Recuerda qué temas ya viste (localStorage) para no empezar de cero.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import MarcaLogo from './MarcaLogo.jsx';

const LLAVE_VISTOS = 'vh_guia_vistos_v2';
const leerVistos = () => { try { return JSON.parse(localStorage.getItem(LLAVE_VISTOS) || '[]'); } catch { return []; } };
const guardarVistos = (v) => { try { localStorage.setItem(LLAVE_VISTOS, JSON.stringify(v)); } catch { /* modo privado */ } };

const sinAcentos = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// --- Pedazos REALES de la app, para anclar visualmente -----------------------
const DEMOS = {
  sellos: () => (
    <div className="guia-demo">
      <div className="guia-demo-fila"><span>Banca doble APP LT 1.50</span><span className="sello sello-firme">Firme</span><span className="guia-demo-n">$26,800</span></div>
      <div className="guia-demo-fila"><span>Recepción Cirque curva 2.40</span><span className="sello sello-estimado">Estimado</span><span className="guia-demo-n">$41,300</span></div>
      <div className="guia-demo-pie">Verde lo sostienes. Ámbar confírmalo antes de comprometerlo.</div>
    </div>
  ),
  precio: ({ margenObjetivo }) => (
    <div className="guia-demo">
      <div className="guia-demo-barra">
        <span style={{ width: '32%', background: '#8a6d3b' }} /><span style={{ width: '13%', background: '#3b6fb0' }} />
        <span style={{ width: '11%', background: '#7a7570' }} /><span style={{ width: `${margenObjetivo}%`, background: 'var(--verde)' }} />
      </div>
      <div className="guia-demo-leyenda">
        <em><i style={{ background: '#8a6d3b' }} />Material</em><em><i style={{ background: '#3b6fb0' }} />Mano de obra</em>
        <em><i style={{ background: '#7a7570' }} />Indirectos</em><em><i style={{ background: 'var(--verde)' }} />Utilidad {margenObjetivo}%</em>
      </div>
    </div>
  ),
  conexion: () => (
    <div className="guia-demo">
      <div className="guia-demo-fila"><i className="guia-punto" style={{ background: '#3fbf8f' }} /><span><strong>En línea</strong> — lo que haces se comparte con todo el equipo.</span></div>
      <div className="guia-demo-fila"><i className="guia-punto" style={{ background: '#B8912F' }} /><span><strong>Sin conexión</strong> — se guarda en tu computadora y se sube al volver el internet.</span></div>
    </div>
  ),
};

// --- EL MANUAL ---------------------------------------------------------------
// v: visibilidad — 'todos' | 'costos' (Diseño y Dirección) | 'direccion'
function manual({ margenObjetivo, minMarkup, margenMinimo }) {
  return [
    {
      id: 'empezar', titulo: 'Empezar aquí', v: 'todos',
      temas: [
        { t: '¿Qué es esta app?', r: 'Convierte lo que pide un cliente en una propuesta con precios de Vonhaucke.',
          d: 'Tiene las 24 líneas del catálogo con sus medidas, acabados y precios. Arma la cotización, acomoda los muebles en el espacio del cliente y genera el PDF que se entrega. Lo que antes eran tres archivos y varias llamadas, aquí es una sola pantalla.' },
        { t: 'Todo se guarda solo', r: 'No hay botón de guardar. Nunca pierdes trabajo.',
          d: 'Puedes cerrar la app a media cotización y al volver está igual. El punto de la barra de arriba te dice cómo está guardando en este momento.', demo: 'conexion' },
        { t: 'La barra de arriba', r: 'El logo te regresa al inicio; a la derecha están tus herramientas.',
          d: 'El logo te lleva al Inicio desde cualquier lado. A la derecha: el estado de la conexión, esta Guía, tu Contraseña y Salir. Cuando traes muebles en una cotización aparece además un botón rojo "Mi cotización" con el número: te lleva a la propuesta desde donde estés.' },
        { t: 'Nunca te quedas atrapado', r: 'Siempre hay "‹ Atrás" e "Inicio" arriba a la izquierda.',
          d: 'Cualquier pantalla que abras tiene esos dos botones. Atrás te regresa a la anterior; Inicio te lleva al principio. Nada se descompone por navegar de más.' },
        { t: 'Qué ve cada quien', r: 'Ventas ve precios. Diseño ve costos. Dirección ve todo.',
          d: 'Tu correo define lo que puedes abrir, y lo aplica la base de datos, no la pantalla. Ventas ve precios pero nunca costo de fabricación ni utilidad, para que ninguna pantalla suya exponga eso frente a un cliente. Diseño y Proyectos ve además todo el costeo y los precios de material. Dirección ve todo, más el tablero, los accesos, la nómina y los estados financieros. Lo que no te toca no se te esconde: no se te manda.' },
        { t: 'Funciona en el celular', r: 'La misma app, en el teléfono, en casa del cliente.',
          d: 'Todo está pensado para usarse con el dedo: botones grandes, las tablas se vuelven tarjetas, y en el costeador el precio y el botón de agregar se quedan fijos abajo para que no tengas que bajar la página.' },
      ],
    },
    {
      id: 'cotizar', titulo: 'Cotizar', v: 'todos',
      temas: [
        { t: 'Los cuatro caminos', r: 'Voni, cotizar de línea, banco de precios y especial. Se pueden mezclar.',
          d: 'Todo cae en la MISMA cotización, así que puedes empezar con Voni, agregarle un mueble de línea y rematar con uno del banco. Arriba siempre ves cuántos llevas.' },
        { t: 'Voni: escríbelo como te lo dijo el cliente', r: 'No tienes que saberte las 24 líneas.',
          d: 'Voni es el camino rápido cuando son varios muebles: describes el proyecto en palabras normales y te arma los renglones con línea, medida y precio. Entre más concreto seas con cantidades y medidas, mejor le atina. Si no sabes una medida, no la pongas: usa la común y la cambias después.',
          ejemplo: '20 lugares de trabajo en bench de 1.50, 2 escritorios ejecutivos de 2.10 con su credenza, 1 mesa de juntas para 8 personas y 12 archiveros de 2 cajones',
          boton: 'Abrir Voni', tab: 'voni' },
        { t: 'Revisa siempre lo que armó', r: 'Voni acierta casi siempre, pero la cotización la firmas tú.',
          d: 'Cada renglón trae cantidad, medida y precio: cámbiale la cantidad con + y −, o quítalo. Si faltó algo, agrégalo de línea o del banco. Lo normal es ajustar dos o tres renglones; si tuviste que corregir todo, faltó detalle en lo que escribiste.' },
        { t: 'Cotizar de línea: uno por uno, con todo el detalle', r: 'Línea → producto → medida → acabado → precio.',
          d: 'Es el camino del que ya sabe qué quiere. Escoges la línea, el tipo de mueble y sus opciones (largo, fondo, acabado, biombo, gavetas) y el precio se actualiza al instante. Puedes agregar varios seguidos sin salirte: la cantidad se reinicia sola y te dice cuántos llevas.' },
        { t: 'Banco de precios', r: 'Productos ya cotizados en proyectos reales, con su precio cerrado.',
          d: 'Los buscas por nombre, ajustas cantidad y se agregan. Ojo: esos precios ya traen el descuento del proyecto de donde salieron; si tu proyecto lleva otro descuento, ajústalo.',
          boton: 'Ver el banco', tab: 'banco' },
        { t: 'Especial: lo que no está en catálogo', r: 'A la medida. Lo costea Diseño y tú lo presentas.',
          d: 'Si el cliente pide algo que no existe en las líneas, va por especial. Describes la pieza y Diseño la costea. Mientras no esté costeada, su precio es estimado.' },
        { t: 'El sello: FIRME o ESTIMADO', r: 'Lo más importante. Verde lo sostienes; ámbar todavía no.',
          d: 'FIRME es precio de lista real, salido de un presupuesto que ya cotizamos: lo puedes comprometer. ESTIMADO lo calculó el modelo porque esa configuración exacta aún no tiene precio real. Si el cliente va a firmar sobre un ámbar, pide a Diseño que lo confirme primero.',
          demo: 'sellos', nota: 'Aquí es donde se pierde dinero. Si dudas, pregunta antes de mandar.' },
        { t: 'Complementos que se cotizan aparte', r: 'Sistema eléctrico y gavetas van como renglones separados.',
          d: 'Igual que en los presupuestos de siempre: el módulo por un lado, y el sistema eléctrico, la gaveta rodante o la silla por otro. Así el cliente ve qué está pagando y se pueden quitar sin rehacer la cotización.' },
      ],
    },
    {
      id: 'espacio', titulo: 'El espacio', v: 'todos',
      temas: [
        { t: 'Para qué sirve el acomodo', r: 'Comprueba que de verdad cabe, y le enseña al cliente cómo se va a ver.',
          d: 'Son dos cosas distintas: el plano es un cálculo exacto (¿cabe o no cabe?) y el render es una imagen para vender. El primero nunca te va a mentir; el segundo es una interpretación bonita.',
          boton: 'Abrir el acomodo', tab: 'acomodo' },
        { t: 'Dibuja la oficina con el dedo', r: 'Aunque no sea un rectángulo: hay forma libre.',
          d: 'Con "Cuarto" arrastras un rectángulo. Con "Forma libre" tocas esquina por esquina y cierras tocando la primera — es para plantas en L o con recortes. Cada cuadro de la rejilla es un metro y todo se acomoda a medios metros.' },
        { t: 'Columnas, escaleras y puertas', r: 'Márcalas y el sistema no pone muebles encima.',
          d: 'Las columnas se marcan con un toque; las escaleras, arrastrando. El motor las esquiva de verdad al acomodar, dejando además un paso alrededor. Las puertas se marcan para que el render las respete.' },
        { t: 'El espacio de la silla', r: 'No basta que quepa el mueble: tiene que caber quien lo usa.',
          d: 'El sistema reserva alrededor de cada mueble su espacio de uso real: un metro detrás de un escritorio para la silla y el paso, noventa centímetros alrededor de una mesa de juntas, sesenta para abrir un cajón. Dos muebles vecinos comparten el pasillo de en medio en vez de pedir uno cada quien.' },
        { t: 'Cuando NO cabe, te lo dice', r: 'Prefiere darte una mala noticia a tiempo que una buena mentira.',
          d: 'Si los muebles no entran en el espacio que dibujaste, te dice cuántos se quedaron fuera. No los encima ni los saca del plano para aparentar que sí cupieron. Ahí decides: quitas muebles o marcas más área.' },
        { t: 'Renders con IA', r: 'Foto de cada mueble, imagen de la oficina completa, o amueblar una foto real.',
          d: 'Tres cosas distintas. "Una foto de cada mueble" genera la imagen de cada partida. "Una imagen de la oficina completa" arma una escena con los muebles reales que cotizaste. Y el amueblado virtual toma una FOTO REAL del espacio del cliente y le pone los muebles encima, respetando muros y perspectiva. Todo entra a la propuesta y al PDF.' },
      ],
    },
    {
      id: 'propuesta', titulo: 'La propuesta', v: 'todos',
      temas: [
        { t: 'Dos vistas de lo mismo', r: '"Mis números" para ti; "Como la ve el cliente" es el documento.',
          d: 'En Mis números ves y editas los renglones. En la vista de cliente ves exactamente lo que va a recibir: portada, fotos, acomodo, precios y condiciones. Revísala siempre antes de descargar.' },
        { t: 'Descuento de proyecto', r: 'El precio que ves ya es el de venta. Lo que descuentes va encima.',
          d: 'Escribes el porcentaje y se aplica a toda la propuesta. Ojo: los precios que ves ya son los de venta al cliente, así que este descuento se resta ENCIMA de eso. Si te pasas del piso, las partidas afectadas se marcan y necesitas visto bueno de Dirección.',
          demo: 'precio', nota: 'Nunca mandes una propuesta marcada en rojo sin autorización.' },
        { t: 'Imprevistos de obra', r: 'Un colchón para lo que se hace especial.',
          d: 'Un porcentaje extra sobre el subtotal, para proyectos con mucha pieza a la medida donde siempre aparecen ajustes. No es ganancia: es cobertura de lo que siempre aparece en obra.' },
        { t: 'Descargar el PDF', r: 'Sale con el nombre del cliente y su folio.',
          d: 'Lleva portada, la razón social y el teléfono de la empresa, fotos por partida, el acomodo si lo hiciste, precios, condiciones, bloque de firma y vigencia. La app espera a que carguen las fotos antes de imprimir, así que dale unos segundos.' },
        { t: 'Vigencia de 15 días', r: 'Toda propuesta la trae impresa.',
          d: 'Es la ventana en la que sostenemos ese precio. Pasada esa fecha hay que volver a cotizar, porque los materiales se mueven.' },
      ],
    },
    {
      id: 'costear', titulo: 'Costear', v: 'costos',
      temas: [
        { t: 'Empieza por la línea, no por cero', r: 'Siete de cada diez proyectos son catálogo.',
          d: 'Escoges línea, producto y medida, y el sistema arma el despiece con la guía oficial: cada panel, cada canto, cada herraje, con su clave. El motor lo cuesta con los precios de material vigentes. No estás capturando desde cero, estás revisando lo que el sistema propone — y ahí es donde vale tu ojo.' },
        { t: 'Lee la hoja de costo', r: 'Material, mano de obra, indirectos y utilidad.',
          d: `La barra te dice en qué se va el dinero y cuánto queda de cada venta. El precio de lista sale del margen objetivo (${margenObjetivo}%). Si una pieza baja de ${margenMinimo}% salta el aviso: revisa si el despiece trae de más o si algún material está mal capturado.`,
          demo: 'precio' },
        { t: 'De dónde sale la mano de obra', r: 'De la nómina real, convertida a costo por hora.',
          d: 'El costo por hora se calcula con la nómina semanal, la gente de producción, la jornada y la eficiencia. Se puede afinar por área: carpintería, pintura, acabados, tapicería. Tú ves el número que se usa para costear; los sueldos y el personal sólo los ve Dirección.' },
        { t: 'Desperdicio', r: 'Lo que se pierde al cortar ya está contado.',
          d: 'Cada material trae su porcentaje de desperdicio y el motor lo suma al costo. En el tablero se puede ver qué materiales son los que más desperdicio generan.' },
        { t: 'Especial: lo que no existe en catálogo', r: 'Describes o subes una foto, y el sistema propone el despiece.',
          d: 'Tú lo corriges y el motor lo cuesta. Aquí es donde vale tu criterio: el sistema no conoce ese mueble, tú sí.',
          boton: 'Costear desde cero', tab: 'especial' },
        { t: 'Modo avanzado: despiece a mano', r: 'Cuando quieres controlar cada pieza tú mismo.',
          d: 'Armas el despiece renglón por renglón: material, medida, cantidad y horas. Es el camino largo, para lo que no encaja en ningún molde.',
          boton: 'Abrir el modo avanzado', tab: 'costeador' },
        { t: 'Confirma los ámbar del vendedor', r: 'Es tu trabajo más importante aquí.',
          d: 'Cuando un vendedor trae un ESTIMADO, tú lo aterrizas: costeas esa configuración exacta y le confirmas el precio. Cada configuración confirmada con un presupuesto real se carga al catálogo, y desde ahí sale FIRME para todo el equipo. Así la app se vuelve más exacta sola.',
          demo: 'sellos' },
      ],
    },
    {
      id: 'materiales', titulo: 'Materiales', v: 'costos',
      temas: [
        { t: 'Los precios de material son la base de todo', r: 'Si están viejos, la app cotiza barato y la fábrica lo paga.',
          d: 'Todo el costeo cuelga de esta pantalla. Revísala cuando llegue lista nueva de Compras. Es el mantenimiento más importante de toda la herramienta.',
          boton: 'Ver precios de materiales', tab: 'precios' },
        { t: 'Cómo se organizan', r: 'Por secciones: tableros, cantos, herrajes, metal, tapicería.',
          d: 'Cada material trae su unidad, su precio y su desperdicio. Cambias el precio y todo lo que use ese material se recalcula al instante, en toda la app.' },
        { t: 'Compartir y respaldar', r: 'Puedes exportar los datos para respaldarlos.',
          d: 'Desde la misma pantalla de precios. Sirve para llevar un respaldo antes de una actualización grande de listas.' },
      ],
    },
    {
      id: 'direccion', titulo: 'Dirección', v: 'direccion',
      temas: [
        { t: 'El tablero', r: 'Qué se cotiza, con qué margen, y quién descuenta de más.',
          d: 'Composición del costo, desperdicio por material, costo por pieza según el lote, últimas piezas costeadas y la salud del negocio. Es el lugar para detectar si el equipo está regalando margen antes de que se vuelva costumbre.',
          boton: 'Abrir el tablero', tab: 'tablero' },
        { t: 'Las reglas las pones tú', r: `Objetivo ${margenObjetivo}% · piso al descontar ${minMarkup}% · aviso abajo de ${margenMinimo}%.`,
          d: 'El margen objetivo es de donde sale el precio de lista de toda la empresa. El piso es hasta dónde puede descontar un vendedor sin pedirte permiso. El aviso interno es cuándo se le prende el foco a Diseño en el costeo. Cambiarlos cambia lo que cotiza todo el equipo desde ese momento — y esta guía lo dirá sola.' },
        { t: 'La nómina no sale de Dirección', r: 'No hay PIN: el permiso lo da tu correo.',
          d: 'La nómina, los estados financieros y este tablero viven en una bóveda aparte de la base de datos. La base sólo se los entrega a quien tiene rol de Dirección, y lo decide por el correo con el que entró. A un vendedor o a un diseñador no se le esconden en la pantalla: nunca le llegan a su computadora. Diseño sí ve el costo por hora que se usa para costear — ese número lo necesita — pero no ve los sueldos ni cuánta gente hay.' },
        { t: 'Usuarios y accesos', r: 'Das de alta a cada persona con su rol.',
          d: 'Ventas, Diseño y Proyectos, o Dirección. El rol define qué pantallas puede abrir y si ve costos. Al dar de alta a alguien, escoge el rol más bajo que le permita trabajar.',
          boton: 'Usuarios y accesos', tab: 'usuarios' },
        { t: 'Qué te van a pedir a ti', r: 'Autorizar descuentos en rojo. Nada más te interrumpe.',
          d: 'La app está armada para que sólo llegues tú cuando hace falta. Los precios en ámbar los confirma Diseño sin pasar por ti. Si te están llegando muchas autorizaciones, no es indisciplina del equipo: es que el precio de lista o el piso están mal puestos.' },
      ],
    },
    {
      id: 'problemas', titulo: 'Si algo falla', v: 'todos',
      temas: [
        { t: '"No me deja entrar a una pantalla"', r: 'Es tu rol, no una falla.',
          d: 'El costeo y los precios de material son para Diseño y Dirección. Si necesitas ese acceso, pídeselo a Dirección.' },
        { t: '"No veo el costo ni la utilidad"', r: 'Es a propósito, si eres de Ventas.',
          d: 'Para que ninguna pantalla tuya exponga costos frente a un cliente. La app igual te protege: te marca en rojo cuando un descuento ya no aguanta, sin enseñarte el costo.' },
        { t: '"El PDF salió sin fotos"', r: 'Espera a que carguen y vuelve a descargar.',
          d: 'La app espera a que las imágenes estén listas antes de imprimir. Si tu internet va lento, dale unos segundos y repite.' },
        { t: '"Dice que no caben mis muebles"', r: 'Es una respuesta real, no un error.',
          d: 'El acomodo cuenta el espacio de uso de cada mueble, no sólo su tamaño: un escritorio necesita su silla. Quita muebles, marca más área, o acepta que ese espacio no da para tantos puestos.' },
        { t: '"Un precio se ve raro"', r: 'Mira primero el sello.',
          d: 'Si es ESTIMADO, el modelo lo calculó y puede moverse: pídelo confirmado a Diseño. Si es FIRME y aun así te parece raro, avísale a Diseño — puede ser un precio de material desactualizado.' },
        { t: '"Se me fue el internet"', r: 'Sigue trabajando. Se guarda en tu computadora.',
          d: 'Cuando vuelva la conexión se sube solo. Lo único que no funciona sin internet son los renders con IA.', demo: 'conexion' },
      ],
    },
  ];
}

export default function Guia({ onIr, onCerrar, primeraVez, estado, rol = 'ventas' }) {
  const [seccion, setSeccion] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [q, setQ] = useState('');
  const [vistos, setVistos] = useState(leerVistos);
  const cajaRef = useRef(null);
  const cerrarRef = useRef(null);
  const cuerpoRef = useRef(null);

  const p = estado?.parametros || {};
  const margenObjetivo = p.margenObjetivo ?? 50;
  const minMarkup = p.minMarkupLinea ?? 45;
  const margenMinimo = p.margenMinimo ?? 25;
  const cfg = { margenObjetivo, minMarkup, margenMinimo };

  const secciones = useMemo(() => {
    const puede = (v) => v === 'todos' || (v === 'costos' && rol !== 'ventas') || (v === 'direccion' && rol === 'direccion');
    return manual({ margenObjetivo, minMarkup, margenMinimo }).filter((s) => puede(s.v));
  }, [rol, margenObjetivo, minMarkup, margenMinimo]);

  // Si la sección guardada no existe para este rol, cae a la primera: nunca
  // se queda una pantalla en blanco.
  const secActual = secciones.some((s) => s.id === seccion) ? seccion : secciones[0]?.id;

  // Buscar atraviesa TODAS las secciones: es un manual, se consulta.
  const resultados = useMemo(() => {
    const t = sinAcentos(q.trim());
    if (!t) return null;
    const out = [];
    for (const s of secciones)
      for (const tema of s.temas)
        if (sinAcentos(tema.t + ' ' + tema.r + ' ' + tema.d).includes(t)) out.push({ ...tema, sec: s.titulo });
    return out;
  }, [q, secciones]);

  const lista = resultados || secciones.find((s) => s.id === secActual)?.temas || [];
  const totalTemas = secciones.reduce((n, s) => n + s.temas.length, 0);
  const nVistos = vistos.length;

  function abrir(clave) {
    setAbierto((prev) => (prev === clave ? null : clave));
    if (!vistos.includes(clave)) { const v = [...vistos, clave]; setVistos(v); guardarVistos(v); }
  }

  function irSeccion(id) {
    setSeccion(id); setQ(''); setAbierto(null);
    if (cuerpoRef.current) cuerpoRef.current.scrollTop = 0;
  }

  useEffect(() => {
    const antes = document.activeElement;
    const tecla = (e) => {
      if (e.key === 'Escape') { onCerrar(); return; }
      if (e.key !== 'Tab') return;
      const f = cajaRef.current?.querySelectorAll('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!f?.length) return;
      const pri = f[0], ult = f[f.length - 1];
      if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
      else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
    };
    document.addEventListener('keydown', tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrarRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = overflow;
      if (antes instanceof HTMLElement) antes.focus();
    };
  }, [onCerrar]);

  const pintarDemo = (k) => (DEMOS[k] ? DEMOS[k](cfg) : null);
  const nombreRol = rol === 'direccion' ? 'Dirección' : rol === 'diseno' ? 'Diseño y Proyectos' : 'Ventas';

  return (
    <div className="modal-fondo no-imprimir" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="modal-caja guia-caja" role="dialog" aria-modal="true" aria-label="Guía de uso" ref={cajaRef}>
        <div className="guia-cab">
          <MarcaLogo alto={32} />
          <div className="guia-cab-txt">
            <h2>{primeraVez ? 'Bienvenido al costeador' : 'Cómo funciona todo'}</h2>
            <div className="ayuda">Manual completo · {totalTemas} temas · {nombreRol}</div>
          </div>
          <button className="modal-x" onClick={onCerrar} aria-label="Cerrar la guía" ref={cerrarRef}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="guia-buscar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setAbierto(null); }} placeholder="Buscar en la guía… (descuento, sello, render, PDF)" />
          {q && <button className="guia-buscar-x" onClick={() => setQ('')} aria-label="Limpiar la búsqueda">×</button>}
        </div>

        {!resultados && (
          <div className="guia-indice" role="tablist" aria-label="Secciones de la guía">
            {secciones.map((s) => (
              <button key={s.id} role="tab" aria-selected={s.id === secActual}
                className={`guia-pista ${s.id === secActual ? 'on' : ''}`} onClick={() => irSeccion(s.id)}>
                {s.titulo}
              </button>
            ))}
          </div>
        )}

        <div className="guia-cuerpo" ref={cuerpoRef}>
          {resultados && (
            <div className="guia-resultados">
              {resultados.length ? `${resultados.length} tema(s) para "${q}"` : `Nada encontrado para "${q}". Prueba otra palabra.`}
            </div>
          )}
          {lista.map((s) => {
            const clave = (s.sec || secActual) + '|' + s.t;
            const open = abierto === clave;
            const visto = vistos.includes(clave);
            return (
              <div className={`guia-paso ${open ? 'abierto' : ''}`} key={clave}>
                <button className="guia-paso-h" onClick={() => abrir(clave)} aria-expanded={open}>
                  <span className={`guia-num ${visto ? 'visto' : ''}`}>
                    {visto
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      : '?'}
                  </span>
                  <span className="guia-paso-t">
                    <strong>{s.t}</strong>
                    <span className="guia-paso-r">{s.r}</span>
                    {s.sec && <span className="guia-paso-sec">{s.sec}</span>}
                  </span>
                  <svg className="guia-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {open && (
                  <div className="guia-detalle">
                    <p>{s.d}</p>
                    {s.ejemplo && (
                      <div className="guia-ejemplo">
                        <span className="guia-ejemplo-lbl">Así se le escribe a Voni</span>
                        <span className="guia-ejemplo-txt">{s.ejemplo}</span>
                      </div>
                    )}
                    {s.demo && pintarDemo(s.demo)}
                    {s.nota && <div className="guia-nota">{s.nota}</div>}
                    {s.boton && <button className="boton" onClick={() => onIr(s.tab)}>{s.boton} ›</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="guia-pie">
          <span className="guia-prog" aria-label={`${nVistos} de ${totalTemas} temas leídos`}>
            <span className="guia-prog-barra"><i style={{ width: `${Math.min(100, (nVistos / totalTemas) * 100)}%` }} /></span>
            {nVistos} de {totalTemas} leídos
          </span>
          <button className="boton primario" onClick={onCerrar}>{primeraVez ? 'Empezar' : 'Cerrar'}</button>
        </div>
      </div>
    </div>
  );
}
