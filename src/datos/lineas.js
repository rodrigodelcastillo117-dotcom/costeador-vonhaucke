// ============================================================================
//  REGISTRO CENTRAL DE LÍNEAS  (para el cotizador con IA y usos compartidos)
//  Mapea cada ruta -> { titulo, productos, generar }. Además expone:
//   - catalogoIA(): esquema compacto de TODAS las líneas/productos/opciones
//     para que Claude mapee lenguaje natural -> {ruta, producto, seleccion}.
//   - configDesde(producto, seleccion): arma el config EXACTO que espera el
//     generador (misma lógica que CosteadorLinea) para costear igual que la app.
// ============================================================================
import { APPLT_PRODUCTOS, generarAppLT } from './applt.js';
import { APP_PRODUCTOS, generarApp } from './app.js';
import { ECLIPSE_PRODUCTOS, generarEclipse } from './eclipse.js';
import { PEBBLE_PRODUCTOS, generarPebble } from './pebble.js';
import { PRIVACY4_PRODUCTOS, generarPrivacy4 } from './privacy4.js';
import { RIO_PRODUCTOS, generarRio } from './rio.js';
import { TEAMSPACE2_PRODUCTOS, generarTeamspace2 } from './teamspace2.js';
import { TETRIS_PRODUCTOS, generarTetris } from './tetris.js';
import { ARLEQUIN_PRODUCTOS, generarArlequin } from './arlequin.js';
import { PAC_PRODUCTOS, generarPac } from './pac.js';
import { VIA_PRODUCTOS, generarVia } from './via.js';
import { DRIFT_PRODUCTOS, generarDrift } from './drift.js';
import { FLEX_PRODUCTOS, generarFlex } from './flex.js';
import { MOX_PRODUCTOS, generarMox } from './mox.js';
import { MODULOR_PRODUCTOS, generarModulor } from './modulor.js';
import { LUNA_PRODUCTOS, generarLuna } from './luna.js';
import { ACCENTS_PRODUCTOS, generarAccents } from './accents.js';
import { ERGO4_PRODUCTOS, generarErgo4 } from './ergo4.js';
import { SPINE_PRODUCTOS, generarSpine } from './spine.js';
import { ANTEO_PRODUCTOS, generarAnteo } from './anteo.js';
import { ALBA_PRODUCTOS, generarAlba } from './alba.js';
import { FEATHER_PRODUCTOS, generarFeather } from './feather.js';
import { WORKLOUNGE_PRODUCTOS, generarWorklounge } from './worklounge.js';
import { CIRQUE_PRODUCTOS, generarCirque } from './cirque.js';
import { ECOACUSTIC_PRODUCTOS, generarEcoAcustic } from './ecoacustic.js';
import { calcular, precioDe, precioVenta, modeloParaPieza } from '../motor/calculo.js';
import { buscarPrecioVenta, costoImplicito, precioDeLista } from './preciosVenta.js';
import { factorDeLinea } from './factoresLinea.js';
import { precioPorUsuarioAppLT } from './preciosVenta.js';
import { tipoDe, huellaReal, HUELLA } from './espacio.js';
import { BANCO, bancoUnico } from './banco.js';
import { resolverArticuloCatalogo } from './resolverArticulo.js';
import { autorizadoPorRef } from './precioAutorizado.js';

export const LINEAS_REG = {
  applt: { titulo: 'App LT', productos: APPLT_PRODUCTOS, generar: generarAppLT },
  app: { titulo: 'App', productos: APP_PRODUCTOS, generar: generarApp },
  via: { titulo: 'Vía', productos: VIA_PRODUCTOS, generar: generarVia },
  rio: { titulo: 'Río', productos: RIO_PRODUCTOS, generar: generarRio },
  feather: { titulo: 'Feather', productos: FEATHER_PRODUCTOS, generar: generarFeather },
  cirque: { titulo: 'Cirque', productos: CIRQUE_PRODUCTOS, generar: generarCirque },
  spine: { titulo: 'Spine', productos: SPINE_PRODUCTOS, generar: generarSpine },
  ergo4: { titulo: 'Ergonova 4', productos: ERGO4_PRODUCTOS, generar: generarErgo4 },
  alba: { titulo: 'Alba', productos: ALBA_PRODUCTOS, generar: generarAlba },
  eclipse: { titulo: 'Eclipse', productos: ECLIPSE_PRODUCTOS, generar: generarEclipse },
  drift: { titulo: 'Eclipse Drift', productos: DRIFT_PRODUCTOS, generar: generarDrift },
  luna: { titulo: 'Luna', productos: LUNA_PRODUCTOS, generar: generarLuna },
  // Flex tenía su pantalla en App.jsx pero NO estaba en el registro, así que no
  // salía en el catálogo ni la alcanzaba la escalera de precios por línea.
  flex: { titulo: 'Flex', productos: FLEX_PRODUCTOS, generar: generarFlex },
  anteo: { titulo: 'Anteo', productos: ANTEO_PRODUCTOS, generar: generarAnteo },
  mox: { titulo: 'Mox', productos: MOX_PRODUCTOS, generar: generarMox },
  modulor: { titulo: 'Modulor', productos: MODULOR_PRODUCTOS, generar: generarModulor },
  tetris: { titulo: 'Tetris', productos: TETRIS_PRODUCTOS, generar: generarTetris },
  arlequin: { titulo: 'Arlequín', productos: ARLEQUIN_PRODUCTOS, generar: generarArlequin },
  pac: { titulo: 'Pac', productos: PAC_PRODUCTOS, generar: generarPac },
  worklounge: { titulo: 'Work Lounge', productos: WORKLOUNGE_PRODUCTOS, generar: generarWorklounge },
  pebble: { titulo: 'Pebble', productos: PEBBLE_PRODUCTOS, generar: generarPebble },
  accents: { titulo: 'Accents', productos: ACCENTS_PRODUCTOS, generar: generarAccents },
  teamspace2: { titulo: 'TeamSpace II', productos: TEAMSPACE2_PRODUCTOS, generar: generarTeamspace2 },
  privacy4: { titulo: 'Privacy 4', productos: PRIVACY4_PRODUCTOS, generar: generarPrivacy4 },
  ecoacustic: { titulo: 'EcoAcustic', productos: ECOACUSTIC_PRODUCTOS, generar: generarEcoAcustic },
};

// --- Arma el config EXACTO que espera el generador (idéntico a CosteadorLinea) --
// `seleccion` = objeto con llaves sueltas (largoMM/fondoMM/diametroMM/usuarios/
// largoLateralMM/biombo/finish/<selectKey>/<checkKey>). Valores faltantes -> default.
// ⚠️ LO QUE NO SE PIDE, SE SUSTITUYE — Y ANTES SE HACÍA EN SILENCIO.
//  Auditoría 2026-08-16: si Voni pedía "bench de 8 usuarios" y ese producto sólo
//  existe de 2 o de 6, la app cotizaba **2 usuarios** sin decir nada. El vendedor
//  pedía 8 puestos y se llevaba el precio de 2. Igual con "99 usuarios", con un
//  largo de 7777 mm o con texto basura: todo caía al primer valor de la lista.
//  Dos cambios:
//   1) se ajusta al valor VÁLIDO MÁS CERCANO, no al primero de la lista
//      (8 usuarios → 6, no → 2);
//   2) cada ajuste se APUNTA en `avisos` para poder enseñarlo en pantalla.
//  `avisos` es opcional: si no se pasa, se comporta como siempre.
export function configDesde(producto, seleccion = {}, avisos = null) {
  const s = seleccion || {};
  const anota = (que, pedido, usado) => {
    // Sólo si de verdad pidió algo: cuando no especifica, el default no es un
    // ajuste que haya que avisarle.
    const pidio = pedido != null && String(pedido) !== '' && String(pedido) !== 'NaN' && String(pedido) !== 'undefined';
    if (avisos && pidio && String(pedido) !== String(usado)) {
      avisos.push(`Pediste ${que} "${pedido}" y ese producto no lo tiene: se cotizó "${usado}".`);
    }
  };
  // El más cercano de la lista, que para una medida es lo que un vendedor
  // esperaría: si pide 1.60 y hay 1.50 y 1.80, quiere el de 1.50, no el primero.
  const cercano = (arr, val, def) => {
    if (!arr) return undefined;
    if (arr.includes(val)) return val;
    if (!Number.isFinite(val)) return def;
    return arr.reduce((a, b) => (Math.abs(b - val) < Math.abs(a - val) ? b : a), arr[0]);
  };
  const pick = (arr, val, def, que) => {
    const r = cercano(arr, val, def);
    anota(que, s[que], r);
    return r;
  };
  const largo = producto.largos ? pick(producto.largos, Number(s.largoMM), producto.largos[1] || producto.largos[0], 'largoMM') : undefined;
  const fondo = producto.fondos ? pick(producto.fondos, Number(s.fondoMM), producto.fondos[0], 'fondoMM') : undefined;
  const diam = producto.diametros ? pick(producto.diametros, Number(s.diametroMM), producto.diametros[0], 'diametroMM') : undefined;
  const usuarios = producto.usuarios ? pick(producto.usuarios, Number(s.usuarios), producto.usuarios[0], 'usuarios') : undefined;
  const lateral = producto.largosLateral ? pick(producto.largosLateral, Number(s.largoLateralMM), producto.largosLateral[0], 'largoLateralMM') : undefined;
  const sels = {};
  for (const sel of producto.selects || []) {
    const ids = sel.opciones.map((o) => o.id);
    let usado;
    if (ids.includes(s[sel.key])) usado = s[sel.key];
    else {
      // Si las opciones son NÚMEROS (usuarios, medidas), se toma la más
      // cercana: pedir 8 usuarios donde hay 2 y 6 debe dar 6, no 2. Antes caía
      // siempre al primero de la lista y un bench de 8 se cotizaba como de 2.
      const num = Number(s[sel.key]);
      const todosNum = ids.every((x) => !Number.isNaN(Number(x)));
      usado = (todosNum && Number.isFinite(num))
        ? ids.reduce((a, b) => (Math.abs(Number(b) - num) < Math.abs(Number(a) - num) ? b : a), ids[0])
        : sel.opciones[0].id;
    }
    anota(sel.label || sel.key, s[sel.key], usado);
    sels[sel.key] = usado;
  }
  const checks = {};
  for (const ch of producto.checks || []) checks[ch.key] = !!s[ch.key];
  const finish = s.finish || (producto.finishes ? producto.finishes[0].id : 'ABS');
  // Color de melamina (catálogo real, ver acabados.js). A propósito SIN
  // default forzado aquí: si nadie eligió, se deja `undefined` y cada
  // generador decide (App LT cae en 'ivory' adentro de generarAppLT; las
  // demás líneas se quedan en su color genérico compartido de siempre).
  // Forzar aquí el primero de la lista pisaría ese default por línea.
  const color = producto.colores ? (s.color || undefined) : undefined;
  const biombo = producto.biombo ? (s.biombo || null) : undefined;
  return {
    producto: producto.id,
    largoMM: largo, fondoMM: fondo, diametroMM: diam, usuarios, largoLateralMM: lateral,
    biombo, finish, color, ...sels, ...checks,
  };
}

// --- Huella (footprint) del mueble: la pieza de ÁREA más grande (cubierta) -------
// Devuelve {w, d} en mm para dibujar el mueble a escala en el plano.
//  ⚠️ LA PIEZA MÁS GRANDE NO ES LA HUELLA. En un mueble de caja (credenza,
//  archivero, librero) la pieza de más área del despiece es el CUERPO —costados,
//  fondo y entrepaños desarrollados en un solo tablero—, y eso da un fondo
//  imposible: la credenza Cirque salía de 1.80 × 1.50 m cuando mide 0.60 de
//  fondo. Con esa huella el acomodo reserva metro y medio de paso y dice que no
//  cabe. La huella de un mueble de caja es su CUBIERTA.
//  Y si el despiece no trae medidas (un sillón es bastidor, espuma y tela), se
//  lee del nombre, que sí las dice: "Sillón Pac 1 plaza (0.60×0.60 m)".
const FONDO_MAX = 1500;   // más de 1.5 m de fondo no es un mueble, es un error

export function footprintDe(componentes, nombre = '') {
  const conMedida = (componentes || []).filter((c) => c.largoMM && c.anchoMM);
  // 1) La cubierta, si el despiece la nombra. OJO: `.find()` devolvía la PRIMERA
  //    que pegara con el patrón, y "tapa registrable" pega — mide 152 mm y le
  //    ganaba a la "Cubierta" de 1200. Resultado: una mesa de juntas de 1.80 m
  //    dibujada de 15 cm, que el acomodo mete en cualquier rendija.
  //    Se toma la de MÁS ÁREA, y una "cubierta" siempre le gana a una "tapa".
  const mayorPor = (re) => (componentes || [])
    .filter((c) => c.largoMM && c.anchoMM && re.test(c.nombre || ''))
    .sort((a, b) => b.largoMM * b.anchoMM - a.largoMM * a.anchoMM)[0];
  const cubierta = mayorPor(/cubierta|cubiert|superficie/i) || mayorPor(/tapa/i);
  if (cubierta) return { w: cubierta.largoMM, d: cubierta.anchoMM };
  // 2) La pieza de más área con un FONDO creíble.
  let w = 0, d = 0, area = 0;
  for (const c of conMedida) {
    const fondo = Math.min(c.largoMM, c.anchoMM);
    if (fondo > FONDO_MAX) continue;
    const a = c.largoMM * c.anchoMM;
    if (a > area) { area = a; w = c.largoMM; d = c.anchoMM; }
  }
  if (w && d) return { w, d };
  // 3) Del nombre: "(0.60×0.60 m)" o "1.20 × 0.75 m".
  const m = String(nombre).match(/(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*m\b/);
  if (m) return { w: Math.round(parseFloat(m[1]) * 1000), d: Math.round(parseFloat(m[2]) * 1000) };
  // 4) Última opción: la más grande aunque el fondo no cuadre, como antes.
  for (const c of conMedida) {
    const a = c.largoMM * c.anchoMM;
    if (a > area) { area = a; w = c.largoMM; d = c.anchoMM; }
  }
  return { w, d };
}

// --- Cuesta un item de la IA con el MOTOR (idéntico a CosteadorLinea) -----------
// item = { ruta, producto, seleccion:[{clave,valor}], cantidad }
// Devuelve datos listos para armar una partida, o null si no se pudo resolver.

// Los generadores nombran las bancas con la medida de UN PUESTO ("Banca doble
// 6 puestos · 1.20×0.75 m"), y se lee como si el mueble entero midiera eso.
// Un bench de 6 personas ocupa 3.60 × 1.50 m. Se le agrega el total.
function nombreConBloque(nombre, ruta, w, d) {
  const tipo = tipoDe({ ruta, nombre });
  const [bw, bd] = huellaReal(nombre, w, d, tipo);
  if (bw === w && bd === d) return { nombre, w, d };
  const m = (v) => (v / 1000).toFixed(2);
  return { nombre: `${nombre} · ocupa ${m(bw)} × ${m(bd)} m`, w: bw, d: bd };
}

// EL PRECIO DE UNA PIEZA, igual que en la pantalla de cotizar de línea:
//   1) si el catálogo tiene el PRECIO REAL de esa configuración, ese manda;
//   2) si el generador declara modelo 'intelisis' (cascada real de planta), se
//      usa esa cascada;
//   3) si no, el modelo clásico de siempre.
export function precioDePieza(estado, ruta, g, pieza, cantidad, config) {
  const { par, esIntelisis } = modeloParaPieza(estado.parametros, g);
  const piezaFull = { ...pieza, modeloCosteo: g.modeloCosteo, factorDirecta: g.factorDirecta, factorIndirecta: g.factorIndirecta };
  const resultado = calcular(piezaFull, cantidad, estado.insumos, par);
  const margen = estado.parametros.margenObjetivo ?? 50;
  // El modelo Intelisis y el price-book hablan en "precio 2", que Von Haucke
  // nunca cotiza: siempre se le quita el 40% para llegar al precio de lista.
  // El modelo clásico no pasa por ahí (ya sale de costo × margen), así que no
  // se le aplica: descontarlo dos veces le comería el margen.
  const precioModelo = esIntelisis
    ? precioDeLista(precioVenta(resultado.costoUnitario, par).lista)
    : precioDe(resultado.costoUnitario, margen);
  const real = buscarPrecioVenta(ruta, config);
  // Algunos generadores declaran un factor de calibración (Anteo escritorio:
  // inox + contrapeso + mármol sin MP cargada). Sólo afecta al modelo: si hay
  // precio real del papel, ése manda y no se toca.
  const factor = (g.factorPrecio || 1) * factorDeLinea(ruta, config?.producto);
  // Bancas App LT: precio por usuario (ver preciosVenta.js). Es el arreglo del
  // error que estaba abierto —banca doble 1.50 de 10 usuarios salía 45% arriba
  // del precio real— porque el price-book sólo tiene anclas a módulo 1.20.
  const porUsuario = !real && ruta === 'applt' ? precioPorUsuarioAppLT(config) : null;
  const precio = real ? precioDeLista(real.lista) : (porUsuario ? porUsuario.lista : precioModelo * factor);
  const costo = real ? costoImplicito(real.lista)
    : (porUsuario ? costoImplicito(porUsuario.lista / (1 - 0.40)) : resultado.costoUnitario * factor);
  return { resultado, margen, precio, costo, real: !!real && !real.heredada, par };
}

// --- SELLER-SAFE: el vendedor NUNCA recibe economía interna ------------------
//  Principio #2 de VH: después del cutover, una partida que llega al vendedor no
//  trae costo/margen/factores/horas por NINGUNA vía. `sellerSafePartida` quita esos
//  campos y recorta `catalogo` a lo que sí puede ver (clave/lista/mínimo), y `pieza`
//  a su estructura sin factores ni horas. No es ocultar en CSS: el dato no viaja.
function sellerSafePartida(p) {
  if (!p) return p;
  const safe = { ...p, sellerSafe: true };
  delete safe.costoUnitario; delete safe.margen; delete safe.costo; delete safe.costoDerivado;
  if (safe.catalogo) safe.catalogo = { clave: safe.catalogo.clave, lista: safe.catalogo.lista, minimo: safe.catalogo.minimo };
  if (safe.pieza) {
    const { factorDirecta, factorIndirecta, horas, modoManoObra, preparacionHoras, ...pz } = safe.pieza;
    safe.pieza = pz;
  }
  return safe;
}
// Fail-closed: cuando el precio del vendedor SÓLO podría salir del modelo de costo
//  (no hay precio AUTORIZADO: ni catálogo, ni price-book), NO se inventa un número ni
//  se muestra $0 — se devuelve una partida marcada "sin precio autorizado".
function sinPrecioVendedor(base) {
  return {
    ruta: base.ruta, linea: base.linea, producto: base.producto, nombre: base.nombre,
    cantidad: base.cantidad, w: base.w, d: base.d, config: base.config,
    sinPrecioAutorizado: true, sellerSafe: true,
    avisos: base.avisos || [], requiereProyectista: !!base.requiereProyectista,
  };
}
// LÍNEA V2: adjunta la identidad de Producto Maestro (producto_id/version/item +
//   precio_lista_snapshot) para que la EMISIÓN la revalide server-side. `ref` es el
//   source_ref (clave de línea = `c`, o id de banco). Sin match, deja la partida igual.
function conIdentidadV2(p, sourceType, ref) {
  const a = autorizadoPorRef(ref);
  if (!a) return p;
  return {
    ...p,
    source_type: sourceType, source_ref: a.source_ref,
    producto_id: a.producto_id, producto_version_id: a.producto_version_id,
    lista_precio_item_id: a.lista_precio_item_id, precio_lista_snapshot: a.precio_lista,
  };
}

// `opciones.soloVentas=true` => salida SELLER-SAFE con fail-closed (sin economía,
//  precio sólo si es AUTORIZADO). Sin la opción, el comportamiento es idéntico al de
//  siempre (Dirección/Diseño no cambian en absoluto).
export function costearItem(estado, item, opciones = {}) {
  const soloVentas = !!opciones.soloVentas;
  const L = LINEAS_REG[item.ruta];
  if (!L) return null;
  const prod = L.productos.find((p) => p.id === item.producto);
  if (!prod) return null;
  const sel = {};
  for (const par of item.seleccion || []) {
    if (!par || !par.clave) continue;
    const esCheck = (prod.checks || []).some((c) => c.key === par.clave);
    sel[par.clave] = esCheck ? /^(si|sí|true|1|x)$/i.test(String(par.valor)) : par.valor;
  }
  // Los avisos viajan con el renglón: es lo que permite que la pantalla diga
  // "pediste 8 usuarios y se cotizaron 6" en vez de callárselo.
  const avisos = [];
  const config = configDesde(prod, sel, avisos);
  let g;
  // ⚠️ 2026-08-18: el catch tragaba `e` entero — un renglón desaparecía en
  // "sinCostear" con una etiqueta genérica y nadie (ni Rodrigo ni quien
  // depura) podía saber POR QUÉ. Se deja en consola: no cambia el contrato
  // (sigue devolviendo null), sólo deja de ser un error mudo.
  try { g = L.generar(config); } catch (e) { console.warn(`costearItem: no se pudo generar "${prod?.nombre || item?.producto}"`, e); return null; }
  const pieza = {
    nombre: g.nombre, componentes: g.componentes, horas: g.horas,
    modoManoObra: g.modoManoObra, factorDirecta: g.factorDirecta, factorIndirecta: g.factorIndirecta,
  };
  const cantidad = Math.max(1, Math.round(Number(item.cantidad) || 1));
  // MISMO camino de precio que la pantalla de "cotizar de línea". Antes esto
  // usaba siempre el modelo clásico y NO consultaba el catálogo de precios
  // reales: por eso una banca App LT de 4 usuarios salía en $8,269 cuando su
  // lista real es $26,800.
  const pr = precioDePieza(estado, item.ruta, g, pieza, cantidad, config);
  const resultado = pr.resultado;
  const margen = pr.margen;
  let precio = pr.precio;

  // ---- BENCH CON MÁS PUESTOS DE LOS QUE OFRECE EL PRODUCTO ------------------
  //  Rodrigo (2026-08-16): "si tenemos el precio de 6 usuarios, divide entre 6:
  //  eso da cuánto es por usuario. Si son 8, precio de 1 usuario × 8."
  //  Es la regla correcta y la misma que ya usa App LT. Antes, pedir 8 puestos
  //  donde el producto sólo tiene 2 y 6 cotizaba OTRA cosa —2 o 6 puestos— y el
  //  cliente recibía un precio que no era el de lo que pidió. Ahora se cotizan
  //  los 8: se toma el precio del escalón más cercano, se divide entre sus
  //  usuarios y se multiplica por los que de verdad se necesitan.
  const pedidos = Number(sel.usuarios);
  const usados = Number(config.usuarios ?? sel.usuarios);
  let escalado = null;
  if (Number.isFinite(pedidos) && Number.isFinite(usados) && usados > 0 && pedidos > 0 && pedidos !== usados) {
    const porUsuario = precio / usados;
    precio = porUsuario * pedidos;
    escalado = { pedidos, usados, porUsuario };
    // El aviso de "no lo tiene" ya no aplica: sí se cotizó lo que pidieron.
    for (let k = avisos.length - 1; k >= 0; k--) if (/usuario/i.test(avisos[k])) avisos.splice(k, 1);
    avisos.push(`Este producto se arma de ${usados} puestos: se cotizaron ${pedidos} a ${Math.round(porUsuario).toLocaleString('es-MX')} pesos por puesto.`);
  }
  // ⚠️ CANDADO CONTRA "cantidad = total de gente" EN VEZ DE "cantidad = bancas"
  // (2026-08-19). Rodrigo: "multiplico 30 usuarios por 12. eso esta mal" — la
  // IA pidió usuarios:12 (opción YA válida, sin escalar arriba) con
  // cantidad:30, y eso cobró y contó 30 BANCAS de 12 (360 personas, 12× el
  // precio) en vez de 1 banca de 30 personas. Se corrigió el prompt de Voni,
  // pero un candado de CÓDIGO no depende de que la IA se acuerde la próxima
  // vez: si el producto tiene 'usuarios' y no hubo escalado (porque el número
  // pedido YA calzaba con una opción del catálogo) pero cantidad > 1, es
  // EXACTAMENTE la mezcla ambigua que causó el sobrecobro — se avisa siempre.
  // Ahora además queda marcado como dato (`candadoUsuarios`), no sólo como
  // texto, para que la pantalla pueda EXIGIR una confirmación explícita antes
  // de imprimir/avanzar, no solo mostrar un aviso que se puede ignorar.
  const candadoUsuarios = !escalado && !!config.usuarios && cantidad > 1;
  if (candadoUsuarios) {
    avisos.push(`Esto se cotiza como ${cantidad} bancas SEPARADAS de ${config.usuarios} usuarios cada una (${cantidad * config.usuarios} personas en total, ${cantidad}× el precio de una banca). Si en realidad pediste ${cantidad} PERSONAS y no ${cantidad} bancas, corrige la cantidad a 1.`);
  }
  // ⚠️ TECHO DE CORDURA EN USUARIOS (2026-08-20, decisión de Rodrigo: "normalmente
  // se manejan en pares, nunca he visto uno de más de 14; en ese caso se tiene
  // que cotizar con un proyectista"). No topa el precio ni lo esconde — arriba de
  // este umbral la extrapolación automática deja de ser confiable (nadie ha
  // armado uno así de grande) y se marca para que un humano lo revise antes de
  // que llegue al cliente, mismo mecanismo del candado de arriba.
  const MAX_USUARIOS_AUTOMATICO = 14;
  const requiereProyectista = Number.isFinite(pedidos) && pedidos > MAX_USUARIOS_AUTOMATICO;
  if (requiereProyectista) {
    avisos.push(`Más de ${MAX_USUARIOS_AUTOMATICO} puestos no se cotiza automático: pide que un proyectista lo revise antes de mandarlo al cliente. Este precio es solo de referencia.`);
  }
  let fp = footprintDe(g.componentes, g.nombre);
  // Último recurso: la huella típica de su tipo. Un sofá que no trae medidas en
  // el despiece ni en el nombre salía en 0 × 0, y una pieza sin huella el plano
  // ni la dibuja ni la puede acomodar.
  if (!fp.w || !fp.d) {
    const [hw, hd] = HUELLA[tipoDe({ ruta: item.ruta, nombre: g.nombre })] || HUELLA.mueble;
    fp = { w: hw, d: hd };
  }
  // OJO CON EL ORDEN: `nombreConBloque` vuelve a leer los puestos DEL NOMBRE
  // para armar la huella del bloque. Si primero se le cambia el nombre a "8
  // puestos" y se le pasa el ancho ya escalado, la expande otra vez y la huella
  // sale disparatada (12 puestos daban 3 m). Por eso se arma con el nombre y el
  // ancho ORIGINALES, y el escalado se aplica DESPUÉS, sobre el resultado.
  const nb = nombreConBloque(g.nombre, item.ruta, fp.w, fp.d);
  if (escalado) {
    const k = escalado.pedidos / escalado.usados;
    nb.w = Math.round(nb.w * k);
    // Y el nombre dice los puestos que se cotizaron, no los del escalón.
    const re = new RegExp(`\\b${escalado.usados}\\s*(u\\b|usuarios?|puestos?)`, 'i');
    nb.nombre = re.test(nb.nombre)
      ? nb.nombre.replace(re, `${escalado.pedidos} $1`)
      : `${nb.nombre} · ${escalado.pedidos} puestos`;
    // La medida que trae el nombre ("ocupa 4.50 × 1.20 m") también cambia.
    nb.nombre = nb.nombre.replace(/ocupa\s+[\d.]+\s*×/, `ocupa ${(nb.w / 1000).toFixed(2)} ×`);
  }
  // ---- EL CATÁLOGO OFICIAL MANDA -------------------------------------------
  //  Rodrigo (2026-08-18): "que Voni utilice esos precios para todo". Cuando el
  //  item coincide con un artículo del catálogo (mueble completo: escritorio,
  //  credenza, archivero, mesa…), su Precio Lista REAL sustituye al calculado
  //  —que salía ±, y en escritorios directivos hasta 4× por debajo—. El
  //  benching y lo no mapeado caen a 'ninguno' y se quedan con el cálculo.
  let catalogo = null;
  let variantes = null;
  const res = resolverArticuloCatalogo({ ruta: item.ruta, producto: prod.id, config });
  if (res.estado !== 'ninguno' && res.articulo && res.articulo.lista > 0) {
    const a = res.articulo;
    precio = a.lista;                       // el de lista es el que se cotiza
    catalogo = { clave: a.clave, lista: a.lista, full: a.full, minimo: a.minimo };
    // Cuando hay varias variantes (misma medida/mano, distinta terminación),
    // Voni NO elige: se lleva el base y ADJUNTA las opciones para que el
    // vendedor toque la correcta en la pantalla (decisión de Rodrigo).
    if (res.estado === 'varios') variantes = res.candidatos.slice(0, 8);
    // Con precio de lista real, el costo se deja IMPLÍCITO (mismo criterio que
    // el price-book): así Dirección sigue viendo una utilidad coherente.
    const partidaCatalogo = {
      ruta: item.ruta, linea: L.titulo, producto: prod.id, nombre: nb.nombre,
      // ⚠️ `cantidad` DEBE IR AQUÍ. Sin él, la rama de catálogo (la de PRECIO
      // REAL) devolvía la partida sin cantidad y los totales la multiplicaban
      // por `cantidad || 0` = $0 — se perdía el renglón entero (audit externo
      // 2026-09-24, P0: 10 partidas firmes sin cantidad en cotizaciones reales).
      // La rama de precio calculado (abajo) siempre la traía; esta la olvidaba.
      cantidad,
      // ⚠️ COSTO SUBESTIMADO ~40-50% (auditoría 2026-08-19). `costoImplicito()`
      // espera PRECIO 2 (divide entre 3.6) — pero `a.lista` aquí es Precio
      // LISTA, ya con el descuento real del artículo aplicado (47%-60%, no un
      // 40% fijo: verificado contra 500 artículos reales del catálogo). Usar
      // `a.full` (el Precio 2 real de CADA artículo, ya viene en los datos)
      // en vez de aproximar con un descuento fijo.
      costoUnitario: costoImplicito(a.full || a.lista), precioUnitario: precio, margen, pieza,
      // El costo aquí es DERIVADO del precio (costoImplicito ≈ precio/3.6), no de
      // un despiece real. Se marca para NO presentar su margen como medido
      // (audit 2026-09-24): la pantalla lo muestra con "≈".
      costoDerivado: true,
      w: nb.w, d: nb.d, config,
      precioReal: true, catalogo, variantes,
      avisos, candadoUsuarios, requiereProyectista,
    };
    // Vendedor: precio AUTORIZADO del catálogo, con identidad Línea V2 y sin economía interna.
    return soloVentas ? sellerSafePartida(conIdentidadV2(partidaCatalogo, 'linea', a.clave)) : partidaCatalogo;
  }

  const partidaModelo = {
    ruta: item.ruta, linea: L.titulo, producto: prod.id, nombre: nb.nombre,
    cantidad, costoUnitario: pr.costo, precioUnitario: precio, margen, pieza,
    w: nb.w, d: nb.d, config,
    // ¿El precio salió de un presupuesto real o del modelo? El sello de la
    // propuesta depende de esto, no de una lista de líneas escrita a mano.
    precioReal: pr.real,
    // Lo que se AJUSTÓ de lo que pidió Voni, para poder decirlo en pantalla.
    avisos, candadoUsuarios, requiereProyectista,
  };
  // FAIL-CLOSED para el vendedor: si el precio NO es autorizado (price-book), es
  // un precio de MODELO derivado del costo => no se le entrega. Autorizado => OK sin economía.
  if (soloVentas) return pr.real ? sellerSafePartida(partidaModelo) : sinPrecioVendedor(partidaModelo);
  return partidaModelo;
}

// --- Recostear una partida con una CONFIG ya armada (editar un mueble) ---------
// Devuelve los campos que cambian al tocar medidas/acabados, o null si la
// línea/producto ya no existe.
export function costearConfig(estado, ruta, productoId, config, cantidad = 1) {
  const L = LINEAS_REG[ruta];
  if (!L) return null;
  const prod = L.productos.find((p) => p.id === productoId);
  if (!prod) return null;
  const cfg = configDesde(prod, config);
  let g;
  try { g = L.generar(cfg); } catch (e) { return null; }
  const pieza = {
    nombre: g.nombre, componentes: g.componentes, horas: g.horas,
    modoManoObra: g.modoManoObra, factorDirecta: g.factorDirecta, factorIndirecta: g.factorIndirecta,
  };
  const n = Math.max(1, Math.round(Number(cantidad) || 1));
  const pr = precioDePieza(estado, ruta, g, pieza, n, cfg);
  const resultado = pr.resultado;
  const margen = pr.margen;
  const fp = footprintDe(g.componentes, g.nombre);
  const nb = nombreConBloque(g.nombre, ruta, fp.w, fp.d);
  // El catálogo manda AQUÍ también: si el vendedor cambia la medida/acabado y la
  // nueva config casa con un artículo real, su Precio Lista sustituye al modelo
  // (y se recalculan las variantes de la nueva medida). Sin esto, editar un
  // mueble le tiraba el precio de lista de vuelta al calculado.
  const res = resolverArticuloCatalogo({ ruta, producto: productoId, config: cfg });
  if (res.estado !== 'ninguno' && res.articulo && res.articulo.lista > 0) {
    const a = res.articulo;
    return {
      nombre: nb.nombre, config: cfg, cantidad: n,
      costoUnitario: costoImplicito(a.full || a.lista), precioUnitario: a.lista,
      margen, w: nb.w, d: nb.d, precioReal: true,
      catalogo: { clave: a.clave, lista: a.lista, full: a.full, minimo: a.minimo },
      variantes: res.estado === 'varios' ? res.candidatos.slice(0, 8) : null,
    };
  }
  return {
    nombre: nb.nombre, config: cfg, cantidad: n,
    costoUnitario: pr.costo, precioUnitario: pr.precio,
    margen, w: nb.w, d: nb.d,
    // Igual que costearItem: sin esto, una partida editada perdía el sello
    // "Firme" aunque su precio siguiera saliendo de un presupuesto real.
    precioReal: pr.real,
    // Sin match del catálogo: se limpia cualquier variante vieja de la partida.
    catalogo: null, variantes: null,
  };
}

// Datos del producto para pintar los controles de edición.
export function productoDe(ruta, productoId) {
  const L = LINEAS_REG[ruta];
  if (!L) return null;
  const prod = L.productos.find((p) => p.id === productoId);
  return prod ? { producto: prod, linea: L.titulo } : null;
}

// --- Esquema compacto para la IA: qué puede pedir de cada línea/producto --------
// ============================================================================
//  EL CATÁLOGO QUE VE VONI
//
//  Rodrigo (2026-08-16): "¿sabe los precios Voni? Los tienes guardados, debería
//  poder seleccionar de ahí. Y sí hay sillería: todos los presupuestos que te he
//  mandado traen sillería con precios."
//
//  Tenía razón en las dos. El BANCO DE PRECIOS tiene 221 piezas con precio REAL
//  de presupuestos cerrados —53 de ellas sillería— y Voni no veía ninguna:
//  sólo recibía las 24 líneas de generador, que no incluyen sillas. Por eso
//  contestaba "no hay sillería en el catálogo", que era verdad de la app y
//  mentira del negocio, y dejaba fuera un pedazo grande de cada proyecto.
//  Ahora recibe las dos cosas, y del banco recibe además el PRECIO, así que
//  puede elegir con criterio de presupuesto en vez de a ciegas.
// ============================================================================
export function catalogoIA() {
  const out = {};
  for (const [ruta, L] of Object.entries(LINEAS_REG)) {
    out[ruta] = {
      titulo: L.titulo,
      productos: L.productos.map((p) => {
        const params = {};
        if (p.largos) params.largoMM = p.largos;
        if (p.fondos && p.fondos.length > 1) params.fondoMM = p.fondos;
        if (p.diametros) params.diametroMM = p.diametros;
        if (p.usuarios) params.usuarios = p.usuarios;
        if (p.largosLateral) params.largoLateralMM = p.largosLateral;
        if (p.biombo) params.biombo = [null, 'cristal', 'melamina'];
        for (const sel of p.selects || []) params[sel.key] = sel.opciones.map((o) => o.id);
        if (p.finishes) params.finish = p.finishes.map((f) => f.id);
        const checks = (p.checks || []).map((c) => c.key);
        return { id: p.id, nombre: p.nombre, params, checks };
      }),
    };
  }
  // El banco va como una "línea" más, con precio real por pieza. Se recorta a lo
  // esencial: el prompt ya pesa 21 KB y no hace falta mandarle la descripción
  // completa de cada mueble para que sepa elegir.
  out.__banco = {
    titulo: 'Banco de precios (piezas con PRECIO REAL de presupuestos cerrados)',
    nota: 'Estas NO se configuran: se piden por id y cantidad. Aquí está la sillería.',
    // ⚠️ SIN DUPLICADOS. Con el banco crudo, la misma silla CONCERTO estaba dos
    // veces (de dos presupuestos, a $5,470 y $5,140) y Voni pedía las dos: dos
    // renglones en la cotización para una sola silla. Rodrigo lo vio en pantalla.
    piezas: bancoUnico().map((b) => ({
      id: b.id,
      nombre: b.nombre,
      categoria: b.categoria,
      precio: b.precio,
      ...(b.medidas ? { medidas: b.medidas } : {}),
      ...(b.usuarios ? { usuarios: b.usuarios } : {}),
    })),
  };
  return out;
}
