// ============================================================================
//  COTIZACION  ·  Mis números (interno) / Propuesta al cliente (premium).
//  Al IMPRIMIR siempre sale la propuesta al cliente (nunca la tabla interna),
//  con cantidad visible y diseño editorial Von Haucke (68 años).
// ============================================================================
import { useState, useMemo, useEffect } from 'react';
import MarcaLogo from './MarcaLogo.jsx';
import { resumenPorArea, especificacion } from '../datos/resumen.js';
import { listaPorCuarto } from '../datos/porCuarto.js';
import { descargarPropuesta, cargarFotos, cargarMarca } from '../datos/pdfPropuesta.js';
import EditarPartida, { sePuedeEditar } from './EditarPartida.jsx';
import { pesos, leePct, selloPartida, claseCosto } from '../util.js';
import { senalesCotizacion, senalesInsumos, problemasDeEmision } from '../datos/senales.js';
import { porQueNoPuedoEmitir } from '../datos/voniContext.js';
import { totalesCotizacion } from '../datos/totales.js';
import { imagenPartida } from '../datos/imagenes.js';
import VoniAvatar from './VoniAvatar.jsx';
import { confianzaDe, textoConfianza } from '../datos/confianza.js';
import { expandirPiezas, mapaPiezas } from '../datos/espacio.js';
import { generarRender, analizarNegocio, resolverRendersCanonicos } from '../nube.js';
import { estadoRenderPartida, claveRenderPartida, ESTADO_RENDER } from '../datos/renderCanonico.js';
import { textoRazonEmision, ESTADO_EMISION, razonesPorLinea } from '../datos/emisionUX.js';
import MontoAnimado from './MontoAnimado.jsx';
import PlanoAcomodo from './PlanoAcomodo.jsx';
import ConfirmarCandado from './ConfirmarCandado.jsx';

// El render IA de la partida manda; si no, la foto de catálogo; y si es una
// silla del banco (que no tiene línea), su foto de presupuesto.
const fotoPartida = imagenPartida;


// ⚠️ UN PORCENTAJE NO SE PUEDE TECLEAR SI SE LIMPIA EN CADA TECLA (2026-08-17).
// El campo era controlado y pasaba por `leePct` en CADA pulsación. Medido tecla
// por tecla escribiendo "12.5" en el descuento (máximo 60... y en maniobras, con
// máximo 30):
//     1 → 1 · 2 → 12 · . → 12  (¡el punto se lo traga!) · 5 → 125 → TOPE
// O sea que **un 12.5% de descuento terminaba en el máximo**, y "0.5" quedaba en
// 5. Es dinero, y lo teclea el vendedor ENFRENTE DEL CLIENTE.
// El arreglo: mientras escribes, el campo guarda TU TEXTO tal cual y no se
// recalcula nada; al salir del campo (o al dar Enter) se lee, se acota y se
// normaliza. Así se puede escribir "12.5", borrar todo para reescribir, o dejar
// un punto a medias sin que el número salte solo.
function CampoPct({ valor, max, onCambio, ancho = 90 }) {
  const [txt, setTxt] = useState(String(valor));
  const [escribiendo, setEscribiendo] = useState(false);
  // Si el valor cambia desde afuera (se abrió otra cotización) y no estoy
  // escribiendo, el campo se pone al día.
  useEffect(() => { if (!escribiendo) setTxt(String(valor)); }, [valor, escribiendo]);
  const cerrar = () => {
    setEscribiendo(false);
    const n = leePct(txt, max);
    setTxt(String(n));
    if (n !== valor) onCambio(n);
  };
  return (
    <input
      type="text" inputMode="decimal" className="numero" style={{ width: ancho }}
      value={txt}
      onFocus={() => setEscribiendo(true)}
      onChange={(e) => { setEscribiendo(true); setTxt(e.target.value); }}
      onBlur={cerrar}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

// La UX del gate (textoRazonEmision / ESTADO_EMISION / razonesPorLinea) vive ahora en
// src/datos/emisionUX.js (lógica pura, reutilizable y testeable). Aquí sólo se consume.

// Chip económico seller-safe pegado a una partida. `tono`: 'falta' (ámbar, faltan
// datos) | 'aprob' (requiere visto bueno de Dirección).
function EstadoLinea({ info }) {
  if (!info) return null;
  const aprob = info.tono === 'aprob';
  return (
    <span
      className={`linea-estado ${aprob ? 'aprob' : 'falta'}`}
      title={info.textos.join(' · ')}
    >
      <span className="linea-estado-punto" aria-hidden="true" />
      {aprob ? 'Requiere aprobación' : 'Falta confirmar'}
    </span>
  );
}

// Estado del RENDER CANÓNICO de la partida (interno, para Dirección): dice si la
// imagen que verá el cliente es la vigente de la revisión anclada, un histórico
// stale, o si falta. Nunca aparece para líneas sin versión (catálogo/banco legacy).
function RenderChip({ estado }) {
  const MAP = {
    VIGENTE: { t: 'Render vigente', cls: 'ok' },
    STALE: { t: 'Render histórico (stale)', cls: 'stale' },
    SIN_RENDER_VALIDO: { t: 'Sin render de esta versión', cls: 'none' },
  };
  const m = MAP[estado];
  if (!m) return null; // SIN_VERSION u otro → no aplica el contrato canónico
  return <span className={`render-chip render-chip-${m.cls}`} title={`Render canónico de la revisión anclada: ${estado}`}>{m.t}</span>;
}

export default function Cotizacion({ estado, setEstado, soloVentas = false, onIr, onEmitida, verificarEmision, veCostos = false }) {
  const [vistaClienteManual, setVistaClienteManual] = useState(false);
  const vistaCliente = soloVentas || vistaClienteManual;
  const setVistaCliente = setVistaClienteManual;
  const cot = estado.cotizacion;
  const partidas = cot.partidas || [];
  // Voni Cerebro, Fase 2: la narración con IA es UN clic, nunca automática —
  // cada llamada a Claude cuesta.
  const [voniCargando, setVoniCargando] = useState(false);
  const [voniMensaje, setVoniMensaje] = useState('');
  const [voniError, setVoniError] = useState('');

  const setCot = (parcial) => setEstado({ ...estado, cotizacion: { ...cot, ...parcial } });

  // RENDER CANÓNICO por partida: se resuelve SÓLO por producto_version_id (nunca por
  // nombre). mapaRenders = { [versionId]: filas[] }; estadoRenderPartida decide
  // VIGENTE/STALE/SIN_RENDER_VALIDO/SIN_VERSION. Una partida queda congelada a su
  // versión (el id es inmutable), así una revisión nueva no cambia el PDF ya emitido.
  const [mapaRenders, setMapaRenders] = useState({});
  const versionesPartidas = useMemo(
    () => [...new Set(partidas.map((p) => claveRenderPartida(p)?.productoVersionId).filter((v) => v != null))].sort().join(','),
    [partidas]
  );
  useEffect(() => {
    const ids = versionesPartidas ? versionesPartidas.split(',') : [];
    if (!ids.length) { setMapaRenders({}); return; }
    let vivo = true;
    resolverRendersCanonicos(ids).then((m) => { if (vivo) setMapaRenders(m || {}); }).catch(() => {});
    return () => { vivo = false; };
  }, [versionesPartidas]);
  const estadoRenderDe = (pt) => estadoRenderPartida(pt, mapaRenders);
  // Imagen VIGENTE de una partida: canónica si está anclada a una versión; si no,
  // catálogo/ad-hoc (legacy). Nunca cae a catálogo "por nombre" para un canónico ni
  // muestra un render stale como vigente.
  const fotoResuelta = (pt) => {
    const est = estadoRenderDe(pt);
    if (est.estado === ESTADO_RENDER.SIN_VERSION) return fotoPartida(pt);
    if (est.estado === ESTADO_RENDER.VIGENTE) return est.url;
    return null;
  };

  // Adjuntar render 3D del acomodo (reescala para no inflar el estado)
  const subirRender = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1400; let w = img.width, h = img.height;
        const sc = Math.min(1, max / Math.max(w, h)); w = Math.round(w * sc); h = Math.round(h * sc);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        setCot({ acomodo: { ...(cot.acomodo || {}), render3d: c.toDataURL('image/jpeg', 0.85) } });
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  };
  const quitarRender = () => { const a = { ...(cot.acomodo || {}) }; delete a.render3d; setCot({ acomodo: a }); };

  // --- Renders de calidad con IA (Gemini) ---
  const [genPart, setGenPart] = useState(null); // id de partida en proceso
  const [genOficina, setGenOficina] = useState(false);
  const [errGen, setErrGen] = useState('');
  // La propuesta ABRE ARRIBA. Se llegaba a ella con el scroll de la pantalla
  // anterior, o sea a media hoja, y había que subir todo para orientarse.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('.contenido')?.scrollTo?.(0, 0);
  }, []);
  const [editando, setEditando] = useState(null);   // índice de la partida que se edita

  async function renderPartida(i) {
    const pt = partidas[i]; if (!pt) return;
    setErrGen(''); setGenPart(pt.id);
    try {
      const r = await generarRender(pt.nombre || 'mueble de oficina', { tipo: pt.ruta || '' });
      if (r?.ok) setPartida(i, { render: r.dataUrl }); else setErrGen(r?.error || 'No se pudo generar el render.');
    } catch (e) { setErrGen('No se pudo conectar.'); }
    finally { setGenPart(null); }
  }
  async function renderTodas() {
    setErrGen('');
    const ps = partidas.slice();
    for (let i = 0; i < ps.length; i++) {
      if (ps[i].render) continue;
      setGenPart(ps[i].id);
      // ⚠️ CATCH VACÍO, INCONSISTENTE CON renderPartida (auditoría 2026-08-19):
      // si truena la red a media tanda, esa pieza se quedaba sin imagen y sin
      // aviso — la versión de "un solo render" (arriba) sí avisa.
      try { const r = await generarRender(ps[i].nombre || 'mueble', { tipo: ps[i].ruta || '' }); if (r?.ok) ps[i] = { ...ps[i], render: r.dataUrl }; else if (r?.error) setErrGen(r.error); } catch (e) { setErrGen('No se pudo conectar.'); }
    }
    setGenPart(null); setCot({ partidas: ps });
  }
  async function urlABase64(url) {
    try { const r = await fetch(url); const b = await r.blob(); return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = () => res(null); fr.readAsDataURL(b); }); } catch (e) { return null; }
  }
  async function renderOficina() {
    setErrGen(''); setGenOficina(true);
    try {
      const lista = partidas.map((p) => `${p.cantidad}× ${p.nombre}`).join(', ') || 'mobiliario de oficina Von Haucke';
      const ctx = cot.acomodo?.areas?.length ? `${cot.acomodo.areas.length} área(s) de trabajo` : '';
      // Fotos reales de los productos cotizados → referencia (específico a las líneas VH).
      const urls = [...new Set(partidas.map((p) => fotoPartida(p)).filter(Boolean))].slice(0, 6);
      const imagenes = (await Promise.all(urls.map(urlABase64))).filter(Boolean);
      const r = await generarRender(lista, { modo: 'oficina', medidas: ctx, imagenes });
      if (r?.ok) setCot({ acomodo: { ...(cot.acomodo || {}), render3d: r.dataUrl } }); else setErrGen(r?.error || 'No se pudo generar la oficina.');
    } catch (e) { setErrGen('No se pudo conectar.'); }
    finally { setGenOficina(false); }
  }

  // DESCARGAR de verdad: se genera el archivo y se baja. Antes esto abría el
  // diálogo de impresión y dejaba al vendedor buscando "Guardar como PDF" en un
  // menú del navegador — Rodrigo: "me manda a imprimir, no lo descarga".
  const [pdfErr, setPdfErr] = useState('');
  const [bajandoPDF, setBajandoPDF] = useState(false);
  // Guardrail de EXCLUSIONES (audit #3): piezas marcadas "$0 por decisión" (las pone
  // el cliente/otra área). Hay que CONFIRMARLAS antes de emitir y escribirlas en el
  // PDF — si no, un clic apurado vende el mueble sin cristal/herrajes en números rojos.
  const [confirmoExcluidas, setConfirmoExcluidas] = useState(false);
  const [verPorque, setVerPorque] = useState(false); // panel "¿por qué no puedo emitir?"
  const [gate, setGate] = useState(null);            // resultado del gate server-side
  const [gateCargando, setGateCargando] = useState(false);
  // Punto de corte real del candado (Rodrigo, 2026-08-20): a diferencia del
  // aviso temprano en Voni (que se puede saltar sin querer), esto es lo que
  // de verdad produce algo que llega al cliente — sin importar por cuál
  // camino entró la partida (Voni, Cotizar de línea, lo que sea).
  const [accionPendiente, setAccionPendiente] = useState(null); // null | () => void
  // No se puede emitir con un renglón sin cantidad o sin precio: sería inventar
  // un número en el documento que llega al cliente (mandato Fase 1).
  const probEmision = problemasDeEmision(partidas);
  // Piezas excluidas de TODO el proyecto (únicas). Si hay, no se emite sin confirmar.
  const excluidasProyecto = [...new Set(partidas.flatMap((p) => p.nombresExcluidos || []))];
  const bloqueoExcluidas = excluidasProyecto.length > 0 && !confirmoExcluidas;
  // Fail-closed: si cambia QUÉ piezas están excluidas, se re-exige la confirmación
  // (no se arrastra un "confirmo" viejo sobre una lista distinta).
  useEffect(() => { setConfirmoExcluidas(false); }, [excluidasProyecto.join('|')]);
  function conCandado(fn) {
    return async () => {
      if (probEmision.length) { setPdfErr('No se puede emitir: ' + probEmision[0]); return; }
      if (bloqueoExcluidas) { setPdfErr('Confirma las piezas excluidas antes de emitir.'); return; }
      // GATE AUTORITATIVO server-side ANTES de emitir (costo/versión/margen/aprobación).
      // Degrada: si el gate no está disponible (DESCONOCIDO) no bloquea — el servidor
      // re-valida al registrar la emisión (fail-closed real vive en la DB).
      if (verificarEmision) {
        setGateCargando(true);
        let g = null;
        try { g = await verificarEmision(); } catch (e) { g = { estado: 'DESCONOCIDO' }; }
        setGateCargando(false);
        setGate(g);
        if (g && g.estado && g.estado !== 'ALLOWED' && g.estado !== 'DESCONOCIDO') {
          setVerPorque(true);
          setPdfErr(`No se puede emitir: ${(ESTADO_EMISION[g.estado] || {}).titulo || g.estado}`);
          return;
        }
      }
      if (partidas.some((p) => p.candadoUsuarios || p.requiereProyectista)) setAccionPendiente(() => fn);
      else fn();
    };
  }
  // Razones del gate, traducidas y seller-safe (motivos duros + económicos).
  const gateRazones = gate ? [...new Set([...(gate.motivos || []), ...(gate.economics || [])])].map(textoRazonEmision) : [];
  // Estado económico POR LÍNEA (chips pegados a cada partida). 1-based → {tono, textos}.
  const razonesLinea = useMemo(() => razonesPorLinea(gate), [gate]);
  async function descargarPDF() {
    setPdfErr(''); setBajandoPDF(true);
    try {
      // Los renders se traen ANTES de armar el documento: si se dibujara sin
      // esperarlos, el PDF saldría con los recuadros vacíos.
      // El logo y la foto de la casa van en la MISMA espera que las fotos: la
      // portada sin logo es justo lo que Rodrigo no quiere volver a ver.
      // El PDF usa la MISMA resolución canónica que la pantalla: render vigente de la
      // versión anclada; nunca catálogo por nombre ni un render stale como vigente.
      const [fotos, marca] = await Promise.all([cargarFotos(partidas, fotoResuelta), cargarMarca()]);
      // Evidencia PRIMERO (audit 2026-10-01): se conserva la revisión ANTES de
      // entregar el documento. El contenido que se congela es el mismo que se
      // dibuja abajo. Si no se pudo registrar, el PDF sale pero se avisa que NO es
      // una emisión definitiva.
      const reg = onEmitida ? await onEmitida() : { ok: false };
      descargarPropuesta({
        cot, partidas, resumen, especificacion, nPzas, fotos, marca,
        piezas: expandirPiezas(partidas),
        // Si NO se registró la emisión, el PDF sale MARCADO como borrador: no se
        // entrega al cliente un documento que parezca definitivo sin evidencia
        // conservada (audit 2026-10-01).
        borrador: !reg?.ok,
        // La hoja "Qué va en cada área", en palabras y con las gavetas: el
        // plano no las puede enseñar porque viven debajo de la cubierta.
        cuartos: listaPorCuarto(partidas, estado.cotizacion?.acomodo),
        // Piezas excluidas (audit #3): se imprimen como cláusula explícita bajo el total.
        exclusionesBOM: excluidasProyecto,
        totales: { precioLista, descuento, descuentoPct, subtotal, contingencia, contingenciaPct,
          maniobras, maniobrasPct, flete, fletePct,
          iva, ivaPct, total,
          anticipoPct, anticipo, cliente: cot.cliente, folio: cot.folio },
      });
      if (!reg?.ok) {
        const necesitaAprob = /aprobaci|politica|supera/i.test(reg?.motivo || '');
        setPdfErr(necesitaAprob
          ? '⚠️ Salió como BORRADOR: el descuento supera la política comercial y requiere APROBACIÓN DE DIRECCIÓN antes de emitirse en definitiva. No cuenta como emisión oficial.'
          : '⚠️ Se generó el PDF, pero NO se registró la emisión (su evidencia no quedó conservada): NO cuenta como emisión definitiva. Revisa tu conexión e inténtalo de nuevo.');
      }
    } catch (e) {
      // Si algo falla, queda el camino de siempre en vez de dejarlo sin nada.
      setPdfErr('No se pudo generar el archivo; se abrirá la impresión para guardarlo como PDF.');
      imprimir();
    } finally { setBajandoPDF(false); }
  }

  // Imprimir: nombra el archivo, y espera que las fotos (remotas) decodifiquen
  // antes de imprimir para que NUNCA salga una partida sin imagen en el PDF.
  async function imprimir() {
    // Misma regla que el PDF (audit 2026-10-01): conservar la evidencia ANTES de
    // una salida definitiva. Si no se registró, NO se imprime como definitiva.
    const reg = onEmitida ? await onEmitida() : { ok: false };
    if (!reg?.ok) {
      const necesitaAprob = /aprobaci|politica|supera/i.test(reg?.motivo || '');
      setPdfErr(necesitaAprob
        ? 'No se imprime como definitiva: el descuento supera la política y requiere APROBACIÓN DE DIRECCIÓN. Mientras tanto usa "Descargar PDF" (sale como borrador).'
        : 'No se registró la emisión: no se imprime como definitiva. Usa "Descargar PDF" (sale marcado como borrador) o revisa tu conexión y reintenta.');
      return;
    }
    const prev = document.title;
    document.title = ['Propuesta', cot.folio, cot.cliente].filter(Boolean).join(' ').trim() || 'Propuesta Vonhaucke';
    try {
      const imgs = Array.from(document.querySelectorAll('.cot-cliente img'));
      await Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
    } catch (e) { /* seguir de todas formas */ }
    window.print();
    setTimeout(() => { document.title = prev; }, 800);
    // Abrir el diálogo de impresión NO prueba que se imprimió ni que el cliente
    // recibió algo (audit 2026-10-01): aquí NO se registra una revisión. La
    // emisión definitiva (con evidencia conservada) es "Descargar PDF".
  }
  const setPartida = (i, parcial) => { const ps = partidas.slice(); ps[i] = { ...ps[i], ...parcial }; setCot({ partidas: ps }); };
  const quitar = (i) => {
    const pt = partidas[i];
    if (!confirm(`¿Quitar "${pt?.nombre || 'este renglón'}" de la cotización?`)) return;
    setCot({ partidas: partidas.filter((_, j) => j !== i) });
  };

  // El acomodo dice qué mueble quedó en qué cuarto; con eso el resumen reparte
  // el importe por área. Si todavía no hay acomodo, sale una sola agrupación
  // ("Sin ubicar") en vez de mentir con áreas inventadas.
  const resumen = useMemo(() => resumenPorArea(partidas, estado.cotizacion?.acomodo), [partidas, estado.cotizacion?.acomodo]);

  // TODA la escalera de dinero —suma, descuento, subtotal, imprevistos, maniobras,
  // flete, IVA, total, anticipo— sale de UNA sola función (src/datos/totales.js),
  // la misma que guarda cotizaciones.js y con la que se arma el PDF. Antes esto
  // se calculaba inline aquí, otra vez en el PDF y de forma DISTINTA (sin IVA ni
  // descuento) al guardar: tres números para el mismo folio. `totalRedondeado` =
  // suma de los renglones ya redondeados al peso = lo que el cliente ve y firma
  // (el PDF cuadra al peso porque suma esos mismos renglones); `total` es el
  // flotante, uso interno. MANIOBRAS/FLETE van sobre el subtotal ya descontado,
  // igual que en el papel de Von Haucke.
  const { precioLista, descuentoPct, descuento, subtotal, contingenciaPct, contingencia,
    maniobrasPct, maniobras, fletePct, flete, ivaPct, iva, baseGravable, total, totalRedondeado,
    anticipoPct, anticipo, hayLineaInvalida } = totalesCotizacion(partidas, cot, estado.parametros);
  const costoTotal = partidas.reduce((a, p) => a + (p.costoUnitario || 0) * p.cantidad, 0);
  const utilidadTotal = baseGravable - costoTotal;
  const minMarkup = estado.parametros.minMarkupLinea ?? 45;
  const factorDesc = 1 - descuentoPct / 100;
  const markupPartida = (pt) => (pt.costoUnitario > 0 ? ((pt.precioUnitario * factorDesc - pt.costoUnitario) / pt.costoUnitario) * 100 : null);
  // El vendedor NO tiene costo (seller-safe): su piso se mide contra el PRECIO
  // MÍNIMO autorizado del catálogo (`catalogo.minimo`, un precio, no un costo). Si
  // el precio ya con descuento cae por debajo de ese mínimo, requiere visto bueno.
  const bajoPiso = (pt) => {
    const m = markupPartida(pt);
    if (m != null) return m < minMarkup;                 // Diseño/Dirección: markup sobre costo
    const min = pt.catalogo?.minimo;                      // Vendedor: piso por precio mínimo
    return min > 0 && (pt.precioUnitario * factorDesc) < min;
  };
  const nBajoPiso = partidas.filter(bajoPiso).length;
  const conCosto = partidas.filter((p) => p.costoUnitario > 0 && !p.deBanco);
  const dMaxPartida = (p) => 100 * (1 - (p.costoUnitario * (1 + minMarkup / 100)) / p.precioUnitario);
  const descuentoMax = conCosto.length ? Math.max(0, Math.floor(Math.min(...conCosto.map(dMaxPartida)))) : null;

  const nPzas = partidas.reduce((a, p) => a + p.cantidad, 0);
  // Voni Cerebro, Fase 1: señales determinísticas (sin IA) sobre ESTA
  // cotización — mismo umbral y mismo cálculo de margen que ya usa la tabla
  // de abajo, nada más juntado en un resumen (src/datos/senales.js).
  const senalesProyecto = senalesCotizacion(partidas, estado.parametros.margenMinimo);
  const senalesInsumosProyecto = senalesInsumos(Object.values(estado.insumos || {}), estado.parametros);
  const preguntarleAVoni = async () => {
    setVoniCargando(true); setVoniError(''); setVoniMensaje('');
    // ⚠️ SIN try/catch, EL BOTÓN SE QUEDABA "PENSANDO…" PARA SIEMPRE (auditoría
    // 2026-08-19). `analizarNegocio()` normalmente resuelve con {ok:false} en
    // vez de lanzar, pero si algo lanza de verdad (JSON no serializable,
    // cliente mal inicializado), `setVoniCargando(false)` nunca corría.
    try {
      const r = await analizarNegocio(senalesProyecto, 'cotizacion');
      if (!r?.ok) { setVoniError(r?.error || 'No se pudo conectar con Voni.'); return; }
      setVoniMensaje(r.propuesta?.mensaje || '');
    } catch (e) {
      setVoniError('No se pudo conectar con Voni.');
    } finally {
      setVoniCargando(false);
    }
  };

  return (
    <div className="contenido cotizacion-pg">
      {/* Editor de datos (solo pantalla) */}
      <div className="tarjeta no-imprimir">
        <div style={{ marginBottom: 12 }}><MarcaLogo alto={42} /></div>
        <div className="form-3">
          <div><label className="etiqueta">Cliente</label><input type="text" value={cot.cliente} onChange={(e) => setCot({ cliente: e.target.value })} /></div>
          {/* Rodrigo, probándola en el celular: "no entiendo eso de Folio, ¿quién
              lo pone? ¿qué es?". Tenía razón: era una caja vacía sin una palabra
              que la explicara. Es el número con el que ESTA propuesta se va a
              identificar después —el mismo que traen sus presupuestos— y lo pone
              el vendedor. Si no lo escribe, la app le propone uno con el formato
              de la casa (AAMM-NNN) para que no se quede en blanco. */}
          <div>
            <label className="etiqueta">Folio de la propuesta</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" value={cot.folio} placeholder="ej. 2608-001"
                onChange={(e) => setCot({ folio: e.target.value })} style={{ flex: '1 1 160px' }} />
              {!cot.folio && (
                <button className="boton fantasma" style={{ minHeight: 44, padding: '0 14px' }}
                  onClick={() => {
                    const d = new Date();
                    const aa = String(d.getFullYear()).slice(2), mm = String(d.getMonth() + 1).padStart(2, '0');
                    setCot({ folio: `${aa}${mm}-001` });
                  }}>Ponme uno</button>
              )}
            </div>
            <p className="ayuda" style={{ marginTop: 4 }}>
              Tu número para identificar esta propuesta después. Lo pones tú y se imprime en el documento.
              Si lo dejas vacío, la propuesta sale sin folio.
            </p>
          </div>
          <div><label className="etiqueta">Fecha</label><input type="text" value={cot.fecha} onChange={(e) => setCot({ fecha: e.target.value })} /></div>
        </div>
      </div>

      {editando != null && partidas[editando] && (
        <EditarPartida
          estado={estado}
          partida={partidas[editando]}
          soloVentas={soloVentas}
          onCerrar={() => setEditando(null)}
          onGuardar={(nueva) => { setPartida(editando, nueva); setEditando(null); }}
        />
      )}


      {/* ⚠️ QUÉ TAN FIRME ES ESTE NÚMERO — INTERNO, NUNCA se imprime.
          Medido: de las 24 líneas sólo 4 tienen precio real de venta (applt,
          río, modulor, mox); las otras 20 salen del modelo. Y en la propuesta
          los dos renglones se ven IDÉNTICOS, así que nadie sabe cuál puede
          defender enfrente del cliente. Esto no inventa precisión: la mide.
          Y de paso dice de qué línea urge conseguir un presupuesto cerrado —
          que es el trabajo que de verdad sube la exactitud. */}
      {!soloVentas && partidas.length > 0 && (() => {
        const c = confianzaDe(partidas);
        return (
          <div className={`confianza no-imprimir ${c.pct >= 60 ? 'ok' : c.pct >= 25 ? 'media' : 'baja'}`}>
            <div className="confianza-barra"><span style={{ width: `${c.pct}%` }} /></div>
            <div className="confianza-txt">
              <strong>{c.pct}% del precio sale de proyectos ya cerrados.</strong>{' '}
              <span className="gris">{textoConfianza(c)}</span>
              {c.lineasFlojas.length > 0 && (
                <div className="ayuda" style={{ marginTop: 4 }}>
                  Lo calcula el modelo en: {c.lineasFlojas.slice(0, 4).map((l) => l.linea).join(' · ')}
                  {c.lineasFlojas.length > 4 ? ` y ${c.lineasFlojas.length - 4} más` : ''}.
                  {' '}Con un presupuesto cerrado de <strong>{c.lineasFlojas[0].linea}</strong> se ancla lo más caro.
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {partidas.length === 0 ? (
        <div className="tarjeta" style={{ textAlign: 'center', padding: '40px 22px' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><MarcaLogo alto={40} /></div>
          <h3 style={{ marginBottom: 6 }}>Tu propuesta está en blanco</h3>
          <p className="ayuda columna-texto" style={{ margin: '0 auto 18px' }}>Agrega los muebles del proyecto y aquí armamos una propuesta con fotos, plano y precios, lista para el cliente.</p>
          {onIr && (
            <div className="fila-botones" style={{ justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button className="boton primario" onClick={() => onIr('cotizarIA')}>Cotizar con IA</button>
              <button className="boton" onClick={() => onIr('voni')}>Abrir Voni</button>
              <button className="boton" onClick={() => onIr('banco')}>Del banco de precios</button>
            </div>
          )}
        </div>
      ) : (<>

        {/* ---------- VENDEDOR · lista simple: solo precio, sin costo ni margen ---------- */}
        {soloVentas && (
          <div className="tarjeta no-imprimir">
            <h3 style={{ marginBottom: 2 }}>Muebles de la propuesta</h3>
            <p className="ayuda" style={{ marginTop: 0, marginBottom: 10 }}>Ajusta cantidades o quita lo que no va. El cliente ve la propuesta de abajo.</p>
            {partidas.map((pt, i) => (
              <div className="vt-fila" key={pt.id}>
                <div className="vt-nombre">{pt.nombre}<EstadoLinea info={razonesLinea.get(i + 1)} /></div>
                {/* El vendedor ve TRES cosas y nada más: precio unitario,
                    cantidad y total. Nunca costo, utilidad ni margen —Rodrigo,
                    2026-08-18: "ellos precio unitario, cantidad y total". Antes
                    esta fila sólo enseñaba el total, y el unitario —el número
                    que el cliente pregunta primero— no salía por ningún lado. */}
                <span className="vt-unit"><span className="vt-rot">c/u</span>{pesos(pt.precioUnitario)}</span>
                <span className="masmenos">
                  <button style={{ width: 44, height: 44 }} onClick={() => setPartida(i, { cantidad: Math.max(1, pt.cantidad - 1) })} aria-label="Menos">−</button>
                  <span className="valor">{pt.cantidad}</span>
                  <button style={{ width: 44, height: 44 }} onClick={() => setPartida(i, { cantidad: pt.cantidad + 1 })} aria-label="Más">+</button>
                </span>
                <span className="vt-importe"><span className="vt-rot">total</span>{pesos(pt.precioUnitario * pt.cantidad)}</span>
                {sePuedeEditar(pt) && (
                  <button className="icono-btn" title="Editar medidas, acabado y cantidad" aria-label={`Editar ${pt.nombre}`} onClick={() => setEditando(i)}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  </button>
                )}
                <button className="boton fantasma vt-quitar" onClick={() => quitar(i)}>Quitar</button>
              </div>
            ))}
            {onIr && (
              <div className="fila-botones" style={{ gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                <button className="boton" onClick={() => onIr('cotizarIA')}>Agregar más muebles</button>
                <button className="boton" onClick={() => onIr('acomodo')}>Acomodar en el espacio</button>
              </div>
            )}
          </div>
        )}

        {/* ---------- INTERNA · Mis números (nunca imprime) ---------- */}
        {!vistaCliente && (
          <div className="tarjeta cot-interna no-imprimir">
            {(senalesProyecto.length > 0 || senalesInsumosProyecto.length > 0) && (
              <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                {[...senalesProyecto, ...senalesInsumosProyecto].map((s, i) => (
                  <div className={`alerta ${s.tipo}`} key={i}><span className="texto">{s.texto}</span></div>
                ))}
              </div>
            )}
            {/* Voni Cerebro, Fase 2: la narración con IA sobre las señales de
                arriba — no recalcula nada, solo las explica. Un clic, nunca
                automática (cada llamada a Claude cuesta). */}
            <div style={{ marginBottom: 14 }}>
              <button className="boton fantasma" style={{ minHeight: 40, padding: '0 14px' }}
                disabled={voniCargando} onClick={preguntarleAVoni}>
                {voniCargando ? 'Voni está pensando…' : 'Pregúntale a Voni'}
              </button>
              {voniMensaje && (
                <div className="tarjeta" style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <VoniAvatar tam={32} variante="cara" />
                  <span className="texto">{voniMensaje}</span>
                </div>
              )}
              {voniError && <div className="alerta roja" style={{ marginTop: 10 }}><span className="texto">{voniError}</span></div>}
            </div>
            <div className="tablewrap solo-escritorio">
              <table className="datos">
                <thead><tr>
                  <th>Concepto</th><th className="num">Cant.</th><th className="num">Precio</th>
                  <th className="num">Costo</th><th className="num">Utilidad</th><th className="num">Importe</th><th></th><th></th>
                </tr></thead>
                <tbody>
                  {partidas.map((pt, i) => {
                    // costo $0 = costo DESCONOCIDO, no margen del 100% (audit
                    // externo 2026-09-24): nunca presentar margen sobre costo 0/proxy.
                    const cc = claseCosto(pt);
                    const sinCosto = cc.sinCosto;
                    const margenReal = pt.costoUnitario != null && pt.precioUnitario
                      ? ((pt.precioUnitario - pt.costoUnitario) / pt.precioUnitario) * 100 : pt.margen;
                    const bajo = !sinCosto && margenReal < estado.parametros.margenMinimo;
                    const util = (pt.precioUnitario - (pt.costoUnitario || 0)) * pt.cantidad;
                    const s = selloPartida(pt);
                    return (
                      <tr key={pt.id} className={bajo ? 'nota-clara' : undefined} style={bajo ? { background: '#fbeceb' } : undefined}>
                        <td>{pt.nombre} <span className={`sello sello-${s.tipo}`} title={s.nota}>{s.texto}</span>
                          <EstadoLinea info={razonesLinea.get(i + 1)} />
                          <RenderChip estado={estadoRenderDe(pt).estado} />
                          {bajo && <div className="ayuda rojo">Debajo del mínimo de {estado.parametros.margenMinimo}%</div>}</td>
                        <td className="num"><span className="masmenos"><button onClick={() => setPartida(i, { cantidad: Math.max(1, pt.cantidad - 1) })}>−</button><span className="valor">{pt.cantidad}</span><button onClick={() => setPartida(i, { cantidad: pt.cantidad + 1 })}>+</button></span></td>
                        <td className="num">{pesos(pt.precioUnitario)}</td>
                        <td className="num" title={cc.aprox ? 'Costo aproximado (derivado del precio, no del despiece real)' : undefined}>{sinCosto ? '—' : (cc.aprox ? '≈ ' : '') + pesos(pt.costoUnitario)}</td>
                        <td className="num">{sinCosto ? '—' : (cc.aprox ? '≈ ' : '') + pesos(util)}</td>
                        <td className="num">{pesos(pt.precioUnitario * pt.cantidad)}</td>
                        {/* ⚠️ AQUÍ NO HABÍA CÓMO EDITAR (2026-08-17). El lápiz
                            estaba escrito SÓLO dentro del bloque `soloVentas`, o
                            sea que en el rol de Dirección/Diseño —el que usa
                            Rodrigo— corregir una partida era IMPOSIBLE desde la
                            propuesta: había que quitarla, salir, volver a la
                            línea, reconfigurarla y regresar. **11 toques, y el
                            renglón quedaba fuera de orden al final de la lista.**
                            Con el lápiz son 3, y `EditarPartida` ya existía y ya
                            recotiza en vivo: nomás no estaba enchufado. */}
                        <td className="num">
                          {sePuedeEditar(pt) && (
                            <button className="icono-btn" title="Editar medidas, acabado y cantidad"
                              aria-label={`Editar ${pt.nombre}`} onClick={() => setEditando(i)}>
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                            </button>
                          )}
                        </td>
                        <td><button className="boton fantasma" style={{ minHeight: 40, padding: '0 12px' }} onClick={() => quitar(i)}>Quitar</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* tarjetas móviles */}
            <div className="solo-movil">
              {partidas.map((pt, i) => {
                const cc = claseCosto(pt);
                const sinCosto = cc.sinCosto;
                const util = (pt.precioUnitario - (pt.costoUnitario || 0)) * pt.cantidad;
                return (
                  <div className="cot-card" key={pt.id}>
                    <div className="cot-nombre">{pt.nombre}<EstadoLinea info={razonesLinea.get(i + 1)} /></div>
                    <div className="cot-linea">
                      <span className="masmenos"><button style={{ width: 44, height: 44 }} onClick={() => setPartida(i, { cantidad: Math.max(1, pt.cantidad - 1) })}>−</button><span className="valor">{pt.cantidad}</span><button style={{ width: 44, height: 44 }} onClick={() => setPartida(i, { cantidad: pt.cantidad + 1 })}>+</button></span>
                      <span className="cot-importe">{pesos(pt.precioUnitario * pt.cantidad)}</span>
                    </div>
                    <div className="cot-datos"><span>Precio c/u: <b>{pesos(pt.precioUnitario)}</b></span><span>Costo: {sinCosto ? '—' : (cc.aprox ? '≈ ' : '') + pesos(pt.costoUnitario)}</span><span>Utilidad: {sinCosto ? '—' : (cc.aprox ? '≈ ' : '') + pesos(util)}</span></div>
                    <button className="boton fantasma" style={{ minHeight: 44, marginTop: 10 }} onClick={() => quitar(i)}>Quitar</button>
                  </div>
                );
              })}
            </div>
            {nBajoPiso > 0 && <div className="alerta roja" style={{ marginTop: 10 }}><span className="texto">Con {descuentoPct}% de descuento, {nBajoPiso} partida(s) quedan por debajo del mínimo de línea ({minMarkup}%). Requiere visto bueno de Dirección.</span></div>}
          </div>
        )}

        {/* Controles comerciales (no imprimen) */}
        <div className="tarjeta no-imprimir" style={{ display: 'grid', gap: 10 }}>
          <div className="fila-botones" style={{ justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label className="etiqueta" style={{ margin: 0 }}>Descuento de proyecto (%)</label>
            <CampoPct valor={descuentoPct} max={60} onCambio={(v) => setCot({ descuentoPct: v })} />
            {!soloVentas && descuentoMax != null && <button className="boton fantasma" style={{ minHeight: 40, padding: '0 12px' }} onClick={() => setCot({ descuentoPct: descuentoMax })} title={`Máximo sin bajar del piso de ${minMarkup}% SOBRE COSTO (markup). Ojo: ${minMarkup}% sobre costo equivale a ${Math.round(100 * (minMarkup / (100 + minMarkup)))}% de margen sobre precio, que es otra cuenta.`}>Máx. rentable: {descuentoMax}%</button>}
          </div>
          {/* Rodrigo, 2026-08-16: "el precio que tenemos ya es precio de lista, es el de
              venta con el 40%". O sea que este campo NO es el 40% — va ENCIMA. Sin
              decirlo, un vendedor cree que está aplicando el descuento de siempre y en
              realidad está regalando margen por segunda vez. */}
          <div className="ayuda" style={{ textAlign: 'right', marginTop: -4 }}>
            Los precios de arriba <strong>ya son de venta</strong> (el 40% ya está aplicado).
            Lo que escribas aquí se descuenta <strong>encima</strong> de eso.
          </div>
          <div className="fila-botones" style={{ justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label className="etiqueta" style={{ margin: 0 }}>Imprevistos de obra (%)</label>
            <CampoPct valor={contingenciaPct} max={50} onCambio={(v) => setCot({ contingenciaPct: v })} />
          </div>
          <div className="fila-botones" style={{ justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label className="etiqueta" style={{ margin: 0 }}>Maniobras e instalación (%)</label>
            <CampoPct valor={maniobrasPct} max={30} onCambio={(v) => setCot({ maniobrasPct: v })} />
          </div>
          <div className="ayuda" style={{ textAlign: 'right', marginTop: -4 }}>
            3% es lo estándar (así lo imprimen tus presupuestos). Sube con elevador, horario inhábil o acarreo largo.
          </div>
          <div className="fila-botones" style={{ justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label className="etiqueta" style={{ margin: 0 }}>Flete (%)</label>
            <CampoPct valor={fletePct} max={30} onCambio={(v) => setCot({ fletePct: v })} />
          </div>
          {soloVentas && nBajoPiso > 0 && <div className="alerta roja"><span className="texto">Este descuento deja {nBajoPiso} partida(s) por debajo del margen permitido. Requiere visto bueno de Dirección.</span></div>}
        </div>

        {/* Renders con IA (no imprimen) */}
        <div className="tarjeta no-imprimir" style={{ display: 'grid', gap: 10 }}>
          <div><strong>Imágenes de la propuesta</strong> <span className="ayuda" style={{ display: 'inline' }}>· las genera la IA, estilo Vonhaucke</span></div>
          <div className="fila-botones" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button className="boton" style={{ minHeight: 46 }} disabled={genPart != null || genOficina} onClick={renderTodas}>
              {genPart != null ? 'Generando muebles…' : 'Una foto de cada mueble'}
            </button>
            <button className="boton" style={{ minHeight: 46 }} disabled={genOficina || genPart != null} onClick={renderOficina}>
              {genOficina ? 'Generando oficina…' : 'Una imagen de la oficina completa'}
            </button>
            {onIr && partidas.length > 0 && <button className="boton" style={{ minHeight: 46 }} onClick={() => onIr('acomodo')}>Ver el acomodo en 3D</button>}
          </div>
          {(genOficina || genPart != null) && (
            <div className="render-gen" style={{ position: 'relative', height: 90 }}><span className="render-gen-spin" /><span>{genOficina ? 'Creando el render de la oficina… (10–20 s)' : 'Generando renders de los muebles…'}</span></div>
          )}
          {cot.acomodo?.render3d && !genOficina && (
            <div>
              <img src={cot.acomodo.render3d} alt="Render de oficina" style={{ width: '100%', maxWidth: 360, borderRadius: 10, border: '1px solid var(--linea)', display: 'block' }} />
              <div className="ayuda verde" style={{ marginTop: 4 }}>Listo: ya aparece en la propuesta y en el PDF.</div>
              <button className="boton fantasma" style={{ minHeight: 40, padding: '0 12px', marginTop: 6 }} onClick={quitarRender}>Quitar esta imagen</button>
            </div>
          )}
          <label className="enlace-sutil" style={{ cursor: 'pointer' }}>
            {cot.acomodo?.render3d ? 'o subir otra imagen mía' : 'o subir una imagen mía'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => subirRender(e.target.files?.[0])} />
          </label>
          {errGen && <div className="alerta roja"><span className="texto">{errGen}</span></div>}
        </div>

        {/* ---------- CLIENTE · Propuesta premium (SIEMPRE imprime) ---------- */}
        <div className={`cot-cliente ${vistaCliente ? 'activa' : ''}`}>
          {/* Portada */}
          <section className="propx-cover">
            <div className="propx-cover-top">
              <MarcaLogo alto={52} />
              <span className="propx-sello">Más de 68 años de oficio</span>
            </div>
            <div className="propx-cover-rule" />
            <div className="propx-cover-doc">Propuesta de mobiliario</div>
            <h1 className="propx-cover-tit">{cot.cliente ? `Preparada para ${cot.cliente}` : 'Propuesta para su proyecto'}</h1>
            <div className="propx-cover-meta">
              {cot.folio && <><span>Folio <b>{cot.folio}</b></span><span className="propx-dot">·</span></>}
              {cot.fecha && <><span>Fecha <b>{cot.fecha}</b></span><span className="propx-dot">·</span></>}
              <span><b>{partidas.length}</b> líneas · <b>{nPzas}</b> piezas</span>
              <span className="propx-dot">·</span><span>Vigencia <b>15 días hábiles</b></span>
            </div>
          </section>

          {/* RESUMEN POR ÁREA. Rodrigo: "que haga un resumen con precios de lo
              que es, ejemplo Sala Operativa (que son 15 benchs), que ponga la
              especificación y el TOTAL DE ESA ÁREA". Es como se lee un proyecto
              de oficina: el cliente decide por área, no pieza por pieza. */}
          {/* Si NO hay acomodo, el resumen sería un solo bloque llamado "Sin
              ubicar en el plano" con TODO el proyecto dentro: al cliente eso no
              le dice nada y encima suena a error. En ese caso no se enseña. */}
          {resumen.length > 0 && !(resumen.length === 1 && resumen[0].sinUbicar) && (
            <section className="propx-resumen">
              <h2 className="propx-res-tit">Resumen del proyecto</h2>
              {resumen.map((b, i) => (
                <div className="propx-res-area" key={i}>
                  <div className="propx-res-cab">
                    <div>
                      <div className="propx-res-nom">{b.nombre}</div>
                      <div className="propx-res-esp">
                        {b.m2 > 0 && <>{b.m2} m² · </>}{especificacion(b)}
                      </div>
                    </div>
                    <div className="propx-res-tot">{pesos(b.total)}</div>
                  </div>
                  <ul className="propx-res-lista">
                    {b.renglones.map((r, k) => (
                      <li key={k}>
                        <span className="propx-res-cant">{r.cantidad}</span>
                        <span className="propx-res-item">{r.nombre}</span>
                        <span className="propx-res-imp">{pesos(r.importe)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {/* Renglones con foto */}
          <section className="propx-items">
            {partidas.map((pt) => {
              const foto = fotoResuelta(pt);
              const s = selloPartida(pt);
              return (
                <article className="propx-item" key={pt.id}>
                  {foto
                    ? <img className="propx-foto" src={foto} alt={pt.nombre} decoding="sync" />
                    : <div className="propx-foto sin" />}
                  <div className="propx-info">
                    <div className="propx-nombre">{pt.nombre}</div>
                    {/* El sello NO va en el documento del cliente (Rodrigo,
                        2026-08-16): es una señal interna para el vendedor, y
                        leer "sujeto a confirmación" en 5 de 6 renglones debilita
                        la propuesta. Sigue visible en "Mis números". */}
                    <div className="propx-sub"><span className="propx-unit">{pesos(pt.precioUnitario)} c/u</span></div>
                  </div>
                  <div className="propx-cant"><span className="propx-cant-n">{pt.cantidad}</span><span className="propx-cant-l">{pt.cantidad === 1 ? 'pza' : 'pzas'}</span></div>
                  <div className="propx-importe">{pesos(pt.precioUnitario * pt.cantidad)}</div>
                </article>
              );
            })}
          </section>

          {/* Distribución en el espacio */}
          {(cot.acomodo?.plan || cot.acomodo?.render3d) && (
            <section className="propx-acomodo">
              <h2 className="propx-h2">Distribución en el espacio</h2>
              {cot.acomodo?.render3d && (
                <figure className="propx-render3d">
                  <img src={cot.acomodo.render3d} alt="Vista 3D del acomodo" />
                  <figcaption>Vista 3D de referencia del acomodo con mobiliario Vonhaucke</figcaption>
                </figure>
              )}
              {/* El plano SVG solo si NO hay render de IA (el render Gemini manda). */}
              {cot.acomodo?.plan && !cot.acomodo?.render3d && (
                <PlanoAcomodo areas={cot.acomodo.areas} plan={cot.acomodo.plan} byId={mapaPiezas(expandirPiezas(partidas))} modo="iso" />
              )}
            </section>
          )}

          {/* Totales */}
          <section className="propx-tot">
            <div className="propx-tot-box">
              {/* ⚠️ DECÍA "PRECIO DE LISTA" (2026-08-17). En el idioma de los
                  presupuestos de esta casa, "precio de lista" es el BRUTO, el de
                  ANTES del −40%… y estos precios YA traen el 40% aplicado (lo
                  dice la propia app dos cuadros arriba). Cualquier comprador con
                  oficio lee "precio de lista" y su siguiente frase es "¿y mi
                  descuento de lista?". El PDF ya lo llamaba bien. Ahora los dos
                  documentos dicen lo mismo. */}
              <div className="propx-tot-row"><span>Suma de los renglones</span><b>{pesos(precioLista)}</b></div>
              {descuento > 0 && <div className="propx-tot-row"><span>Descuento {descuentoPct}%</span><b className="rojo">− {pesos(descuento)}</b></div>}
              {/* Sin descuento, "Subtotal" imprimía EXACTAMENTE el mismo número
                  que el renglón de arriba: dos renglones idénticos justo donde el
                  cliente baja la vista a buscar el precio. Se lee como si se
                  hubiera caído el descuento. Igual que en el PDF: sólo aparece
                  cuando de verdad hay algo que restar. */}
              {descuento > 0 && <div className="propx-tot-row"><span>Subtotal</span><b>{pesos(subtotal)}</b></div>}
              {contingencia > 0 && <div className="propx-tot-row"><span>Imprevistos de obra {contingenciaPct}%</span><b>{pesos(contingencia)}</b></div>}
              {maniobras > 0 && <div className="propx-tot-row"><span>Maniobras e instalación {maniobrasPct}%</span><b>{pesos(maniobras)}</b></div>}
              {flete > 0 && <div className="propx-tot-row"><span>Flete {fletePct}%</span><b>{pesos(flete)}</b></div>}
              <div className="propx-tot-row"><span>IVA {estado.parametros.ivaPorcentaje}%</span><b>{pesos(iva)}</b></div>
              {/* Fail-closed: si un renglón tiene precio inválido (NaN/Infinity), NO se
                  muestra un total barato falso — se marca inválido y la emisión ya está
                  bloqueada (problemasDeEmision). */}
              {hayLineaInvalida ? (
                <div className="propx-tot-grand"><span>TOTAL</span><b style={{ color: '#b3261e' }}>⚠ Cálculo inválido</b></div>
              ) : (
                <>
                  <div className="propx-tot-grand"><span>TOTAL</span><b><MontoAnimado valor={totalRedondeado} /></b></div>
                  <div className="propx-tot-anticipo">Anticipo {anticipoPct}%: <b>{pesos(anticipo)}</b> · Saldo contra entrega: <b>{pesos(totalRedondeado - anticipo)}</b></div>
                </>
              )}
            </div>
          </section>

          {/* Condiciones + sellos + pie */}
          <section className="propx-cond">
            {/* Sin sellos en el documento del cliente. */}
            <p><b>Condiciones.</b> Vigencia de esta propuesta: 15 días hábiles. Anticipo {anticipoPct}% y {100 - anticipoPct}% contra entrega. {/* ⚠️ ESTO SE CONTRADECÍA CON LA ESCALERA (2026-08-17). El documento cobra
                  un renglón visible "Flete 10% $22,810" y aquí abajo decía "está
                  incluido": el cliente lee o una cosa o la otra, y de ahí sale a
                  pedir descuento. Ahora dice DÓNDE está cobrado, que es la verdad. */}
              {maniobras > 0 ? `Las maniobras e instalación están cobradas en su renglón (${maniobrasPct}%). ` : 'Instalación y maniobras se cotizan por separado. '}{flete > 0 ? `El flete al área metropolitana está cobrado en su renglón (${fletePct}%); foráneo se cotiza por evento. ` : 'Flete foráneo por evento. '}Empaque según proyecto. Tiempo de entrega según programa. Precios en pesos mexicanos. El total de esta propuesta YA incluye IVA. Sujetos a cambio sin previo aviso.</p>
            <div className="propx-firma">
              <div className="propx-firma-linea"><span>Aceptación de conformidad</span></div>
              <div className="propx-firma-linea"><span>Nombre y firma · Fecha</span></div>
            </div>
            <div className="propx-pie">
              <MarcaLogo alto={30} />
              <div className="propx-pie-legal">
                <b>Aparatos Electromecánicos Von Haucke, S.A. de C.V.</b>
                <span>Tel. (55) 5999 9200 · www.vonhaucke.mx · Más de 68 años fabricando mobiliario de oficina en México.</span>
              </div>
            </div>
          </section>
        </div>
      {/* ⚠️ LOS BOTONES VAN ABAJO Y SE QUEDAN (2026-08-17). Rodrigo: *"me pone
          hasta abajo, tengo que subir TODOOO para encontrar los botones de
          descargar pdf o imprimir. Debería abrir hasta arriba, así bajas para
          ver la propuesta, y abajo que estén los botones"*. Eran dos problemas
          juntos: la pantalla abría a media propuesta (el scroll de la pantalla
          anterior) y los controles estaban ARRIBA. La propuesta ya abre en la
          primera línea.
          ⚠️ Y EL PRIMER ARREGLO DE LA BARRA ESTUVO MAL: se dejó donde estaba —
          arriba del documento— con `sticky; bottom: 0`. **Sticky-bottom sólo
          pega mientras el elemento va POR DELANTE en el scroll**; en cuanto lo
          rebasas se va con la página. Medido: en un documento de 3,142 px la
          barra desaparecía a los 570 px y ya no volvía, así que abajo —viendo
          el TOTAL con el cliente— había que subir 2,600 px para hallar
          "Descargar PDF". Y con ella se iba el interruptor que ESCONDE mis
          costos. Ahora el bloque vive al FINAL del documento, que es donde
          Rodrigo lo pidió, y ahí el sticky sí lo mantiene pegado todo el
          recorrido. */}
      <div className="cot-acciones cot-acciones-fija no-imprimir">
        {!soloVentas && (
          <div className="segmento" role="group" aria-label="Cómo ver la cotización">
            <button className={!vistaCliente ? 'on' : ''} onClick={() => setVistaCliente(false)}>Mis números</button>
            <button className={vistaCliente ? 'on' : ''} onClick={() => setVistaCliente(true)}>Como la ve el cliente</button>
          </div>
        )}
        <button className="boton tinta cot-pdf" onClick={conCandado(descargarPDF)} disabled={bajandoPDF || probEmision.length > 0 || bloqueoExcluidas} title={probEmision.length ? probEmision[0] : (bloqueoExcluidas ? 'Confirma las piezas excluidas' : undefined)}>
          {bajandoPDF ? 'Armando el PDF…' : 'Descargar PDF'}
        </button>
        <button className="boton fantasma no-imprimir" style={{ minHeight: 42 }} onClick={conCandado(imprimir)} disabled={probEmision.length > 0 || bloqueoExcluidas} title={probEmision.length ? probEmision[0] : (bloqueoExcluidas ? 'Confirma las piezas excluidas' : undefined)}>Imprimir</button>
        {verificarEmision && (
          <button className="boton fantasma no-imprimir" style={{ minHeight: 42 }} disabled={gateCargando}
            onClick={async () => { setGateCargando(true); try { setGate(await verificarEmision()); } catch { setGate({ estado: 'DESCONOCIDO' }); } setGateCargando(false); }}>
            {gateCargando ? 'Verificando…' : 'Verificar emisión'}
          </button>
        )}
      </div>
      {/* FIX (2026-10-05) · cero botones muertos: antes `pdfErr` se asignaba
          (al imprimir sin registrar la emisión, al fallar el gate con el botón
          HABILITADO) pero NUNCA se dibujaba — el vendedor hacía clic y "no pasaba
          nada". El guardrail global cubre el botón DESHABILITADO; esto cubre el
          caso habilitado-pero-bloqueado. El motivo siempre se ve. */}
      {pdfErr && (
        <div className="aviso rojo no-imprimir" role="alert" aria-live="assertive"
          style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span className="texto">{pdfErr}</span>
          <button className="boton fantasma" style={{ minHeight: 28, fontSize: 12, flex: '0 0 auto' }} onClick={() => setPdfErr('')}>Entendido</button>
        </div>
      )}
      {/* GATE DE EMISIÓN autoritativo (server-side). Explica el estado y QUÉ falta,
          en lenguaje claro y seller-safe (sin cifras de costo/margen). */}
      {gate && gate.estado && gate.estado !== 'DESCONOCIDO' && (() => {
        const info = ESTADO_EMISION[gate.estado] || { tono: 'rojo', titulo: gate.estado };
        const col = info.tono === 'verde' ? '#067647' : info.tono === 'ambar' ? '#B54708' : '#B42318';
        const bg = info.tono === 'verde' ? '#ECFDF3' : info.tono === 'ambar' ? '#FFFAEB' : '#FEF3F2';
        return (
          <div className="no-imprimir" style={{ marginTop: 8, border: `1px solid ${col}33`, background: bg, borderRadius: 10, padding: 12, color: col }}>
            <div style={{ fontWeight: 800 }}>{info.titulo}</div>
            {gateRazones.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {gateRazones.map((t, i) => <li key={i} style={{ fontSize: 13, margin: '2px 0' }}>{t}</li>)}
              </ul>
            )}
            {gate.estado === 'ALLOWED' && <div style={{ fontSize: 13, marginTop: 4 }}>Todo en regla: puedes descargar el PDF definitivo.</div>}
          </div>
        );
      })()}
      {/* Guardrail de exclusiones (audit #3): bandera ámbar + confirmación obligatoria.
          Sin marcar el checkbox, no se puede emitir; lo que se confirma se imprime en el PDF. */}
      {excluidasProyecto.length > 0 && (
        <div className="aviso ambar no-imprimir" style={{ marginTop: 8, background: '#fdf3df', border: '1px solid var(--ambar, #d8a800)', color: '#7a5600', borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ Esta cotización NO incluye {excluidasProyecto.length} pieza(s) — corren por cuenta del cliente</div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>{excluidasProyecto.join(' · ')}</div>
          <label className="check" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={confirmoExcluidas} onChange={(e) => setConfirmoExcluidas(e.target.checked)} />
            <span>Confirmo que estas piezas NO están costeadas y las provee el cliente o un tercero.</span>
          </label>
        </div>
      )}
      {probEmision.length > 0 && (() => {
        const diag = porQueNoPuedoEmitir({ cotizacion: { partidas } });
        return (
          <div className="aviso rojo no-imprimir" style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span><b>No se puede emitir todavía.</b> {diag.resumen}</span>
              <button className="boton fantasma" style={{ minHeight: 32, fontSize: 13 }} onClick={() => setVerPorque((v) => !v)}>
                {verPorque ? 'Ocultar' : '¿Por qué no puedo emitir?'}
              </button>
            </div>
            {verPorque && (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                {diag.bloqueos.map((b, i) => (
                  <div key={i} style={{ borderLeft: '3px solid #b3261e', paddingLeft: 10 }}>
                    <div style={{ fontWeight: 700 }}>{b.titulo}</div>
                    {b.porque && <div style={{ fontSize: 13, opacity: 0.9 }}>Por qué: {b.porque}</div>}
                    {b.corregir && <div style={{ fontSize: 13 }}>✓ Cómo arreglarlo: {b.corregir}</div>}
                  </div>
                ))}
                <div className="ayuda gris" style={{ fontSize: 11 }}>Voni lo detecta del costeo real; corrige esto y el botón de emitir se habilita solo.</div>
              </div>
            )}
          </div>
        );
      })()}
      {accionPendiente && (
        <ConfirmarCandado
          partidas={partidas}
          onConfirmar={() => { const fn = accionPendiente; setAccionPendiente(null); fn(); }}
          onCancelar={() => setAccionPendiente(null)}
        />
      )}
      </>)}
    </div>
  );
}
