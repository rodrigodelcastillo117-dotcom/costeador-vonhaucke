// ============================================================================
//  ASISTENTE ESPECIAL — costear un producto NUEVO desde cero, guiado por
//  preguntas. Arma el despiece pieza por pieza y lo cuesta con el motor real.
//  Es la Fase 1 del flujo "render → preguntas → costo" (la Fase 2 pre-llena
//  este mismo despiece leyendo una imagen con IA).
// ============================================================================
import { useMemo, useState, useEffect, useRef } from 'react';
import { calcular, precioDe, netoComponente, modeloParaPieza } from '../motor/calculo.js';
import { SECCIONES } from '../datos/insumos.js';
import { pesos } from '../util.js';
import { analizarRender, analizarRenderImagenes, verificarDespiece, costearServidor, registrarSombra, hashInput, generarRender, subirRender, guardarRender } from '../nube.js';
import { dimsDeMueble, tipoDeMueble } from './MiniRender.jsx';
import { abrirPdf, paginaAImagen, todasLasPaginas } from '../datos/pdfImagen.js';
import Cargando from './Cargando.jsx';
import Markdown from './Markdown.jsx';
import InformeIA from './InformeIA.jsx';

// Reduce una imagen a máx `lado` px y la devuelve como base64 JPEG (payload chico + más barato)
function reducirImagen(file, lado = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height));
      const w = Math.round(img.width * escala), h = Math.round(img.height * escala);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ base64: c.toDataURL('image/jpeg', 0.85).split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

// Un PDF (plano) va TAL CUAL a la IA, sin rasterizar: Claude lo lee como
// documento y rasterizarlo perdería las cotas. Mismo patrón que leerPlanoArchivo.
function archivoABase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    fr.readAsDataURL(file);
  });
}

const esPDF = (file) => file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');

// Paleta de piezas comunes: al tocar una, se agrega al despiece con un material
// por defecto y medidas de arranque. kind define cómo se mete (área/lineal/pieza).
const PARTES = [
  { label: 'Cubierta', material: 'melamina-28', kind: 'area', dims: [1500, 600] },
  { label: 'Faldón', material: 'mdf', kind: 'area', dims: [1500, 400] },
  { label: 'Costado / lateral', material: 'melamina-19', kind: 'area', dims: [600, 720] },
  { label: 'Entrepaño', material: 'melamina-19', kind: 'area', dims: [900, 400] },
  { label: 'Puerta', material: 'melamina-19', kind: 'area', dims: [450, 720] },
  { label: 'Frente de cajón', material: 'melamina-19', kind: 'area', dims: [450, 150] },
  { label: 'Canto', material: 'tapacanto', kind: 'linear' },
  { label: 'Patas / base (PTR)', material: 'ptr', kind: 'linear' },
  { label: 'Estructura lámina', material: 'lamina-20', kind: 'kg' },
  { label: 'Cristal', material: 'cristal-templado', kind: 'area', dims: [1000, 600] },
  { label: 'Mampara / biombo', material: 'acrilico', kind: 'area', dims: [1200, 400] },
  { label: 'Jaladeras', material: 'jaladera', kind: 'pza' },
  { label: 'Bisagras', material: 'bisagra', kind: 'pza' },
  { label: 'Correderas', material: 'corredera', kind: 'pza' },
  { label: 'Cerradura', material: 'cerradura', kind: 'pza' },
  { label: 'Contacto eléctrico', material: 'contacto', kind: 'pza' },
  { label: 'Caja eléctrica', material: 'caja-electrica', kind: 'pza' },
  { label: 'Tela', material: 'tela', kind: 'linear' },
  { label: 'Espuma', material: 'espuma', kind: 'area', dims: [500, 500] },
];

const DIFICULTAD = [
  { nombre: 'Muy fácil', v: 30 }, { nombre: 'Fácil', v: 40 }, { nombre: 'Estándar', v: 55 },
  { nombre: 'Difícil', v: 70 }, { nombre: 'Muy difícil', v: 90 },
];

const N_PASOS = 4;

export default function AsistenteEspecial({ estado, onVerDetalle, onInicio }) {
  const insumos = estado.insumos;
  const [paso, setPaso] = useState(0);
  const [analizando, setAnalizando] = useState(false);
  const [verificando, setVerificando] = useState(false); // 2ª pasada: la IA critica su propio despiece
  const [errorIA, setErrorIA] = useState('');
  const [preguntasIA, setPreguntasIA] = useState([]);
  const [analisis, setAnalisis] = useState(null); // {descripcionCliente, materiales, mejoras, fallasProbables, aprovechamiento}
  const [pdfSel, setPdfSel] = useState(null); // selector de hoja de plano multipágina: {doc, numPaginas, pagina, preview}
  const [b, setB] = useState({
    nombre: '', piezas: 1, componentes: [], imagen: null, descripcionCliente: '',
    modoManoObra: 'porcentaje', factorDirecta: 55, factorIndirecta: 12,
    margen: estado.parametros?.margenObjetivo ?? 50,
  });
  const set = (parcial) => setB((prev) => ({ ...prev, ...parcial }));

  const { par } = modeloParaPieza(estado.parametros, b);
  const esArea = (ins) => !!ins && (ins.formato?.tipo === 'tablero' || ins.unidad === 'm2');

  // ⚠️ Faltaba `estado.parametros` en las dependencias: si Dirección cambia un
  // parámetro (margen, factor de indirectos, costo por hora…) mientras alguien
  // sigue parado en este asistente, el costo se quedaba congelado con los
  // parámetros de cuando se abrió la pantalla hasta el próximo cambio de pieza.
  // Costeador.jsx y CosteadorLinea.jsx ya traen `estado.parametros`/`par` en su
  // lista; a éste se le había quedado fuera.
  const resultado = useMemo(() => calcular(b, b.piezas, insumos, par), [b, insumos, estado.parametros]);
  const precio = precioDe(resultado.costoUnitario, b.margen);

  // --- SHADOW (Fase 3): compara en paralelo el motor del servidor (JWT real, rol/costos
  // server-side) contra el resultado del cliente y lo registra. Fire-and-forget, debounced,
  // dedup por input: NUNCA bloquea ni cambia lo que ve el usuario. El usuario sigue viendo `precio`.
  const sombraRef = useRef('');
  useEffect(() => {
    if (!(b.componentes?.length) || !(resultado.costoUnitario > 0)) return;
    const pieza = { ...b, modeloCosteo: estado.parametros?.modeloCosteo };
    const h = hashInput({ c: b.componentes, n: b.piezas, m: b.margen });
    if (sombraRef.current === h) return; // ya comparado este input
    const t = setTimeout(async () => {
      sombraRef.current = h;
      try {
        const srv = await costearServidor(pieza, b.piezas);
        const precioSrv = srv?.precioVenta ?? null;
        await registrarSombra({
          input_hash: h,
          motor_version: srv?.versionMotor || null,
          version_catalogo: srv?.versionCatalogo || null,
          estado_servidor: srv?.estado || (srv?.ok === false ? 'error' : null),
          http_status: srv?.status ?? (srv?.ok ? 200 : null),
          precio_cliente: Math.round(precio),
          precio_servidor: precioSrv,
          costo_cliente: Math.round(resultado.costoUnitario),
          costo_servidor: srv?.costo?.costoUnitario ?? null,
          diff: precioSrv != null ? Math.round(precio) - precioSrv : null,
          campos_recibidos: srv && typeof srv === 'object' ? Object.keys(srv) : null,
          nota: b.nombre || null,
        });
      } catch (e) { /* shadow silencioso: jamás rompe el flujo */ }
    }, 1500);
    return () => clearTimeout(t);
  }, [b, resultado.costoUnitario, precio, estado.parametros]);

  // --- RENDER V1 (Fase 6): ilustra el producto YA definido; NO lo define ni lo modifica. ---
  const PROMPT_VERSION = 'render-v1-2026-10-01';
  const [renders, setRenders] = useState({ aislado: null, ambiente: null });
  const [renderMsg, setRenderMsg] = useState('');
  const [renderizando, setRenderizando] = useState(false);
  const [costoEstado, setCostoEstado] = useState(null); // 'certificado' | 'preliminar' | null
  const dimsR = useMemo(() => dimsDeMueble(b), [b]);
  // PRECEDENCIA de materiales/acabado para el render: (1-3) selección/BOM del usuario = materiales
  // de SUPERFICIE de los componentes que tiene/confirmó; (4) leyenda del plano (b.materiales de la
  // IA); (5) ninguna. Una leyenda vieja del plano NUNCA pisa la selección explícita del usuario.
  const matFinish = useMemo(() => {
    const SUP = new Set(['cubiertas', 'mamparas', 'acabados', 'metal', 'tapiceria']);
    const bom = [...new Set((b.componentes || []).map((c) => insumos[c.insumoId]).filter((x) => x && SUP.has(x.seccion)).map((x) => x.nombre))];
    if (bom.length) return { lista: bom.slice(0, 8), fuente: 'seleccion' };
    if (Array.isArray(b.materiales) && b.materiales.length) return { lista: b.materiales, fuente: 'plano' };
    return { lista: [], fuente: 'ninguna' };
  }, [b.componentes, b.materiales, insumos]);
  const materialesR = matFinish.lista;
  // Dos fidelidades SEPARADAS (no "alta" solo por existir plano):
  //  GEOMÉTRICA: alta (plano con cotas/escala) · media (plano parcial, sin escala) · limitada (foto/texto)
  //  ACABADO:    confirmado (material/color de fuente explícita) · pendiente (sin definir → neutro)
  const geomFid = (Array.isArray(b.planos) && b.planos.length)
    ? (analisis?.confianzaGeneral === 'alta' ? 'alta' : 'media') : 'limitada';
  const acabadoFid = matFinish.fuente === 'ninguna' ? 'pendiente' : 'confirmado';
  // Falta información crítica para ilustrar fielmente: se avisa, NO se inventa.
  const faltaCritico = !b.nombre?.trim() || !(b.componentes?.length) || !(dimsR.w > 0);

  // Infiere el ENTORNO real del producto (no siempre oficina): exhibidores/retail → tienda.
  function entornoDe() {
    const txt = `${b.nombre || ''} ${tipoDeMueble(b)} ${materialesR.join(' ')} ${b.descripcionCliente || ''}`.toLowerCase();
    const retail = /alpura|exhibidor|exibidor|supermercado|tienda|abarrot|refriger|charola|anaquel|g[oó]ndola|retail|oxxo|punto de venta|display|bimbo|coca|sabritas|lala/.test(txt);
    return retail
      ? { tipo: 'retail', txt: 'modern supermarket / retail store aisle with product shelving, refrigerators and bright retail lighting, polished floor' }
      : { tipo: 'oficina', txt: 'modern corporate office with warm oak furniture and natural daylight' };
  }
  // sube a Storage + guarda metadata; devuelve la URL para mostrar (o el dataUrl si Storage falla).
  async function persistir(dataUrl, modo, tipo, entornoTipo) {
    const path = `nuevo/${hashInput({ n: b.nombre, c: b.componentes })}/${modo}-${Date.now()}.png`;
    const up = await subirRender(dataUrl, path);
    if (up.ok) {
      await guardarRender({
        producto_nombre: b.nombre, producto_version: null, prompt_version: PROMPT_VERSION,
        categoria: tipo, ancho_mm: dimsR.w, fondo_mm: dimsR.d, alto_mm: null, modo,
        storage_path: up.path, storage_url: up.url,
        inputs: { materiales: materialesR, notas: b.descripcionCliente || null, piezas: (b.componentes || []).length, entorno: entornoTipo || null },
        costo_estado: costoEstado || 'preliminar', estado: 'preliminar',
      });
      return up.url;
    }
    return dataUrl; // fallback visual; NO se guarda base64 en metadata
  }

  async function generarRenders() {
    if (faltaCritico || renderizando) return;
    setRenderizando(true); setRenderMsg(''); setRenders({ aislado: null, ambiente: null });
    try { const srv = await costearServidor({ ...b }, b.piezas); if (srv?.estado) setCostoEstado(srv.estado); } catch (_e) {}
    const tipo = tipoDeMueble(b);
    const medidas = `${dimsR.w}×${dimsR.d} mm`;
    const texto = `${b.nombre}. Tipo ${tipo}. Medidas exactas ${medidas}.`
      + (materialesR.length ? ` Materiales y acabados: ${materialesR.join(', ')}.` : '')
      + (b.descripcionCliente ? ` Notas: ${b.descripcionCliente}.` : '');
    const ent = entornoDe();
    // Páginas/vistas del plano (base64 raw). La fidelidad (geomFid/acabadoFid) ya está derivada arriba.
    const paginas = Array.isArray(b.planos) ? b.planos.filter(Boolean) : [];
    // Elementos que el render DEBE conservar (los nombra el propio producto). No describe forma: refuerza fidelidad.
    const preservar = [b.nombre, b.descripcionCliente].filter(Boolean).join('. ').slice(0, 400);

    // 1) PRODUCTO AISLADO — el PLANO (todas sus vistas) es la fuente de verdad de la forma (modo catálogo).
    //    Sin plano, cae a 'render' por texto (menos fiel, se avisa).
    let aisladoDataUrl = null;
    try {
      const opt = paginas.length
        ? { modo: 'catalogo', medidas, tipo, materiales: materialesR, imagen: paginas[0], mediaType: 'image/jpeg', imagenes: paginas.slice(1, 6), preservar }
        : { modo: 'render', medidas, tipo, materiales: materialesR };
      const r = await generarRender(texto, opt);
      if (r?.ok && r.dataUrl) {
        aisladoDataUrl = r.dataUrl;
        const url = await persistir(r.dataUrl, 'aislado', tipo, ent.tipo);
        setRenders((s) => ({ ...s, aislado: url }));
        const avisos = [];
        if (geomFid === 'limitada') avisos.push('Sin plano cargado: el aislado se generó por descripción (geometría limitada). Sube el plano para fidelidad exacta.');
        else if (geomFid === 'media') avisos.push('Plano sin escala/cotas claras: geometría media. Da una medida de referencia o sube más vistas para subirla a alta.');
        if (acabadoFid === 'pendiente') avisos.push('Acabado por confirmar: sin materiales/color definidos, el render usa un acabado neutro. Elige los materiales arriba para ver el acabado real.');
        if (avisos.length) setRenderMsg(avisos.join(' '));
      } else { setRenderMsg(r?.error || 'No se pudo generar el producto aislado.'); }
    } catch (e) { setRenderMsg('Error en producto aislado: ' + String(e)); }

    // 2) EN AMBIENTE — coloca el MISMO producto (usa el aislado ya renderizado como referencia,
    //    o el plano) en su ENTORNO real inferido (supermercado para exhibidores, oficina si no).
    try {
      const prod = aisladoDataUrl || b.imagen;
      const prodRaw = prod ? String(prod).split(',')[1] : '';
      const prodMime = prod ? ((String(prod).match(/data:(.*?);/) || [])[1] || 'image/png') : 'image/png';
      if (prodRaw) {
        const r = await generarRender(texto, { modo: 'ambiente', medidas, tipo, materiales: materialesR, imagen: prodRaw, mediaType: prodMime, entorno: ent.txt });
        if (r?.ok && r.dataUrl) {
          const url = await persistir(r.dataUrl, 'ambiente', tipo, ent.tipo);
          setRenders((s) => ({ ...s, ambiente: url }));
        } else { setRenderMsg(r?.error || 'No se pudo generar el ambiente.'); }
      }
    } catch (e) { setRenderMsg('Error en ambiente: ' + String(e)); }
    setRenderizando(false);
  }

  // --- despiece ---
  function agregarParte(p) {
    const comp = { nombre: p.label, insumoId: p.material, piezas: 1, cantidad: 1 };
    if (p.kind === 'area' && p.dims) { comp.largoMM = p.dims[0]; comp.anchoMM = p.dims[1]; }
    set({ componentes: [...b.componentes, comp] });
  }
  function setPieza(i, parcial) {
    const comps = b.componentes.slice(); comps[i] = { ...comps[i], ...parcial }; set({ componentes: comps });
  }
  function quitarPieza(i) { set({ componentes: b.componentes.filter((_, j) => j !== i) }); }
  function onMaterial(i, insumoId) {
    const ins = insumos[insumoId]; const comps = b.componentes.slice(); const prev = comps[i];
    const patch = { insumoId, nombre: prev.nombre || (ins ? ins.nombre : '') };
    if (!esArea(ins)) { patch.largoMM = undefined; patch.anchoMM = undefined; }
    comps[i] = { ...prev, ...patch }; set({ componentes: comps });
  }
  function costoPieza(c, ins) {
    const neto = netoComponente(c, b.piezas); const p = ins.precio ?? ins.precioBase ?? 0;
    if (ins.formato && ins.fraccion) { const ap = (par.aprovechamientoCorte || 100) / 100; return (neto / (ins.formato.medida * ap)) * p; }
    return neto * p;
  }

  // Analiza una imagen (base64) con la IA y pre-llena las piezas. Centraliza lo
  // que comparten el render, la imagen y las hojas de PDF. Devuelve true si ok.
  const catalogoIA = () => Object.values(insumos).map((x) => ({ id: x.id, nombre: x.nombre, seccion: x.seccion, unidad: x.unidad }));

  function aplicarPropuesta(res, dataUrl, planos) {
    if (!res?.ok) { setErrorIA(res?.error || 'No se pudo analizar.'); return false; }
    const p = res.propuesta || {};
    const comps = (p.piezas || []).map((z) => {
      const existe = !!insumos[z.insumoId];
      const base = { nombre: z.nombre || 'Pieza', insumoId: existe ? z.insumoId : '', cantidad: z.cantidad || 1, piezas: 1, iaNota: z.nota || '', iaConf: z.confianza || '', iaRazon: z.razonamiento || '' };
      if (z.forma === 'area') {
        base.largoMM = z.largoMM || 0; base.anchoMM = z.anchoMM || 0; base.piezas = z.cantidad || 1; base.cantidad = 1;
        // La IA ya estimó la fracción de hoja que rinde: el motor la usa directa
        // (hojas × precio) en vez de re-nestear áreas, que es lo que oscilaba.
        if (z.hojas > 0) base.hojas = z.hojas;
      }
      return base;
    });
    // planos: TODAS las páginas/vistas del plano (base64 raw) para referencia múltiple del render.
    const paginas = Array.isArray(planos) && planos.length ? planos : (dataUrl ? [String(dataUrl).split(',')[1]] : []);
    setB((prev) => ({ ...prev, nombre: prev.nombre || p.producto || '', componentes: comps, imagen: dataUrl || null, planos: paginas, descripcionCliente: p.descripcionCliente || '', materiales: Array.isArray(p.materiales) ? p.materiales : [] }));
    setAnalisis({
      descripcionCliente: p.descripcionCliente || '',
      materiales: Array.isArray(p.materiales) ? p.materiales : [],
      informe: p.informe || '',
      volumenAsumido: p.volumenAsumido || '',
      confianzaGeneral: p.confianzaGeneral || '',
    });
    setPreguntasIA(Array.isArray(p.preguntas) ? p.preguntas : []);
    setPaso(1);
    return true;
  }

  // Una imagen (render/hoja). Paso 1: analiza. Paso 2 (solo imágenes, no PDF crudo):
  // la IA verifica su propio despiece contra las cotas. Devuelve true si ok.
  async function analizarYLlenar(base64, mediaType, dataUrl) {
    const v1 = await analizarRender(catalogoIA(), base64, mediaType);
    if (!v1?.ok || mediaType === 'application/pdf') return aplicarPropuesta(v1, dataUrl, [base64]);
    setVerificando(true);
    const v2 = await verificarDespiece(catalogoIA(), [base64], v1.propuesta);
    setVerificando(false);
    return aplicarPropuesta(v2, dataUrl, [base64]);
  }
  // Varias hojas del mismo mueble (plano multipágina). Paso 1 analiza, paso 2 verifica.
  async function analizarImagenes(imagenes, dataUrlPreview) {
    const v1 = await analizarRenderImagenes(catalogoIA(), imagenes);
    if (!v1?.ok) return aplicarPropuesta(v1, dataUrlPreview, imagenes);
    setVerificando(true);
    const v2 = await verificarDespiece(catalogoIA(), imagenes, v1.propuesta);
    setVerificando(false);
    return aplicarPropuesta(v2, dataUrlPreview, imagenes);
  }

  // Sube render/plano → la IA propone el despiece. Un PDF multipágina abre el
  // selector de hoja; si pdf.js falla, cae a mandar el PDF crudo (como antes).
  async function onImagen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const MAX_MB = 50; // el PDF se lee local y se manda SOLO una hoja (chica)
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorIA(`El archivo pesa ${(file.size / 1048576).toFixed(0)} MB (máximo ${MAX_MB} MB). `
        + 'Comprímelo o sube la hoja del mueble como imagen.');
      return;
    }
    setErrorIA(''); setAnalizando(true);
    try {
      if (esPDF(file)) {
        // Abre el PDF en el navegador y manda SOLO la hoja del mueble como imagen
        // (lo que la IA sí lee bien). Si pdf.js falla → PDF crudo (como antes).
        try {
          const doc = await abrirPdf(file);
          if (doc.numPaginas > 1) {
            const preview = await paginaAImagen(doc, 1, 1400);
            setPdfSel({ doc, numPaginas: doc.numPaginas, pagina: 1, preview });
            setAnalizando(false);
            return; // espera a que elija la hoja
          }
          const dataUrl = await paginaAImagen(doc, 1);
          await analizarYLlenar(dataUrl.split(',')[1], 'image/jpeg', dataUrl);
          return;
        } catch (ePdf) {
          const base64 = await archivoABase64(file);
          const ok = await analizarYLlenar(base64, 'application/pdf', '');
          if (!ok && file.size > 8 * 1024 * 1024) {
            setErrorIA('El plano es pesado o de varias páginas. Sube SOLO la hoja del mueble como imagen (captura de pantalla).');
          }
          return;
        }
      }
      const r = await reducirImagen(file);
      await analizarYLlenar(r.base64, r.mediaType, `data:${r.mediaType};base64,${r.base64}`);
    } catch (err) {
      setErrorIA(String(err?.message || err));
    } finally {
      setAnalizando(false);
    }
  }

  // Cambia la hoja mostrada en el selector de PDF (actualiza el preview).
  async function verPaginaPdf(n) {
    if (!pdfSel) return;
    const pagina = Math.max(1, Math.min(pdfSel.numPaginas, n));
    if (pagina === pdfSel.pagina) return;
    try {
      const preview = await paginaAImagen(pdfSel.doc, pagina, 1400);
      setPdfSel((s) => (s ? { ...s, pagina, preview } : s));
    } catch { /* deja el preview actual */ }
  }

  // Analiza SOLO la hoja elegida del PDF (rasterizada a imagen).
  async function analizarPaginaPdf() {
    if (!pdfSel) return;
    const sel = pdfSel;
    setPdfSel(null); setErrorIA(''); setAnalizando(true);
    try {
      const dataUrl = await paginaAImagen(sel.doc, sel.pagina);
      await analizarYLlenar(dataUrl.split(',')[1], 'image/jpeg', dataUrl);
    } catch (err) {
      setErrorIA('No se pudo procesar esa hoja. Intenta subirla como imagen (captura de pantalla).');
    } finally {
      setAnalizando(false);
    }
  }

  // Analiza TODAS las hojas juntas (un mismo mueble repartido en varias páginas:
  // vista general + detalle por parte). La IA las integra en un solo despiece.
  async function analizarTodasPdf() {
    if (!pdfSel) return;
    const sel = pdfSel;
    setPdfSel(null); setErrorIA(''); setAnalizando(true);
    try {
      const imgs = await todasLasPaginas(sel.doc, 1600);
      await analizarImagenes(imgs, sel.preview);
    } catch (err) {
      setErrorIA('No se pudieron procesar las hojas. Intenta subir la hoja principal como imagen.');
    } finally {
      setAnalizando(false);
    }
  }

  const puedeSeguir = (paso === 0 && b.nombre.trim()) || (paso === 1 && b.componentes.length > 0) || paso >= 2;

  if (analizando) {
    return (
      <div className="asistente">
        <Cargando titulo={verificando ? 'Verificando el despiece contra las cotas…' : 'Analizando con IA'} />
      </div>
    );
  }

  // Selector de hoja: un plano en PDF trae varias páginas (varios muebles/vistas).
  // Se elige la hoja del mueble a costear y solo esa se manda a la IA (como imagen).
  if (pdfSel) {
    return (
      <div className="asistente">
        <div className="pregunta">Tu plano tiene {pdfSel.numPaginas} páginas</div>
        <div className="pregunta-sub">Si es UN mueble repartido en varias hojas (general + detalle por parte), analízalas <strong>juntas</strong> para un costeo completo. Si cada hoja es un mueble distinto, analiza <strong>solo una</strong>.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0', flexWrap: 'wrap' }}>
          <button className="boton" onClick={() => verPaginaPdf(pdfSel.pagina - 1)} disabled={pdfSel.pagina <= 1}>‹ Anterior</button>
          <strong>Página {pdfSel.pagina} de {pdfSel.numPaginas}</strong>
          <button className="boton" onClick={() => verPaginaPdf(pdfSel.pagina + 1)} disabled={pdfSel.pagina >= pdfSel.numPaginas}>Siguiente ›</button>
        </div>
        {pdfSel.preview && (
          <img src={pdfSel.preview} alt={`Página ${pdfSel.pagina}`}
            style={{ maxWidth: '100%', border: '1px solid rgba(0,0,0,.18)', borderRadius: 8, display: 'block' }} />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button className="boton primario grande" onClick={analizarTodasPdf}>Analizar las {pdfSel.numPaginas} hojas juntas (un mueble)</button>
          <button className="boton grande" onClick={analizarPaginaPdf}>Solo esta hoja</button>
          <button className="boton fantasma" onClick={() => setPdfSel(null)}>Cancelar</button>
        </div>
        {errorIA && <div className="alerta roja" style={{ marginTop: 12 }}><span className="texto">{errorIA}</span></div>}
      </div>
    );
  }

  return (
    <div className="asistente">
      <div className="progreso">
        {Array.from({ length: N_PASOS }).map((_, i) => (
          <span key={i} className={`punto ${i <= paso ? 'activo' : ''}`} />
        ))}
      </div>
      <button className="boton fantasma" onClick={() => (paso === 0 ? onInicio() : setPaso(paso - 1))} style={{ marginBottom: 14 }}>
        ‹ {paso === 0 ? 'Inicio' : 'Atrás'}
      </button>

      {/* PASO 1 — Identidad */}
      {paso === 0 && (
        <div>
          <div className="pregunta">¿Qué vas a costear?</div>
          <div className="pregunta-sub">Un producto nuevo, a la medida. No importa si nunca se ha hecho.</div>

          <div className="tarjeta" style={{ background: 'var(--panel)' }}>
            <label className="etiqueta">Atajo: sube un render o plano (PDF) y lo analizo con IA</label>
            <div className="ayuda">Propongo las piezas y medidas leyendo la imagen o el plano en PDF; tú las confirmas. La IA no inventa el precio — lo calcula el motor.</div>
            <div className="espacio" />
            <label className={'boton ' + (analizando ? 'fantasma' : 'primario')} style={{ display: 'inline-flex', cursor: analizando ? 'default' : 'pointer' }}>
              {analizando ? 'Analizando…' : 'Subir render o plano (PDF)'}
              <input type="file" accept="image/*,application/pdf,.pdf" hidden disabled={analizando} onChange={onImagen} />
            </label>
            {errorIA && <div className="alerta roja" style={{ marginTop: 12 }}><span className="texto">{errorIA}</span></div>}
          </div>

          <label className="etiqueta">O escríbelo tú</label>
          <input type="text" autoFocus placeholder="Ej. Mostrador de recepción curvo"
            value={b.nombre} onChange={(e) => set({ nombre: e.target.value })} />
          <div className="espacio" />
          <label className="etiqueta">¿Cuántas piezas iguales?</label>
          <div className="masmenos gigante">
            <button aria-label="menos" onClick={() => set({ piezas: Math.max(1, b.piezas - 1) })}>−</button>
            <span className="valor">{b.piezas}</span>
            <button aria-label="mas" onClick={() => set({ piezas: b.piezas + 1 })}>+</button>
          </div>
        </div>
      )}

      {/* PASO 2 — Piezas */}
      {paso === 1 && (
        <div>
          <div className="pregunta">¿De qué está hecho?</div>
          <div className="pregunta-sub">Toca las piezas que lleva. Luego ajusta su material y medida.</div>
          {preguntasIA.length > 0 && (
            <div className="alerta ambar">
              <span className="texto"><strong>Confirma (IA):</strong> {preguntasIA.join(' · ')}</span>
            </div>
          )}

          {analisis && (
            <div className="ia-analisis">
              {b.imagen && <img src={b.imagen} alt="Render analizado" className="ia-thumb" />}
              <div className="ia-cuerpo">
                {analisis.descripcionCliente && <p className="ia-desc">{analisis.descripcionCliente}</p>}
                {analisis.materiales?.length > 0 && (
                  <div className="ia-bloque"><span className="ia-et">Materiales</span> {analisis.materiales.join(' · ')}</div>
                )}
                <div className="ia-badges">
                  {analisis.volumenAsumido && <span className="ia-badge">Volumen: {analisis.volumenAsumido}</span>}
                  {analisis.confianzaGeneral && <span className={'ia-badge ia-conf-' + analisis.confianzaGeneral}>Confianza {analisis.confianzaGeneral}</span>}
                </div>
                {analisis.confianzaGeneral === 'baja' && (
                  <div className="ia-nota-conf">La imagen no trae escala, así que las medidas son <strong>estimadas</strong>. Dame <strong>una medida real</strong> (p. ej. el largo total) y la precisión sube a alta.</div>
                )}
              </div>
            </div>
          )}

          {analisis?.informe && (
            <div className="ia-informe-bloque">
              <div className="ia-informe-titulo">Auditoría técnica de industrialización</div>
              <InformeIA informe={analisis.informe} />
            </div>
          )}
          <div className="chips">
            {PARTES.map((p) => (
              <button key={p.label} className="chip" onClick={() => agregarParte(p)}>
                <span className="marca-chip">+</span> {p.label}
              </button>
            ))}
          </div>
          <div className="espacio" />
          {b.componentes.length === 0 && <p className="ayuda">Aún no agregas piezas. Toca una de arriba para empezar.</p>}
          {b.componentes.map((c, i) => {
            const ins = insumos[c.insumoId];
            const area = esArea(ins);
            const cnt = c.piezas || 1;
            const m2 = area && c.largoMM && c.anchoMM ? (c.largoMM / 1000) * (c.anchoMM / 1000) * cnt : 0;
            return (
              <div className="pieza" key={i}>
                <div className="pieza-head">
                  <input className="pieza-nom" placeholder="Nombre de la pieza" value={c.nombre || ''} onChange={(e) => setPieza(i, { nombre: e.target.value })} />
                  <select className="pieza-mat" value={c.insumoId || ''} onChange={(e) => onMaterial(i, e.target.value)}>
                    <option value="">— ¿de qué es? —</option>
                    {SECCIONES.map((sec) => (
                      <optgroup label={sec.nombre} key={sec.id}>
                        {Object.values(insumos).filter((x) => x.seccion === sec.id).map((x) => (
                          <option value={x.id} key={x.id}>{x.nombre}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button className="pieza-x" onClick={() => quitarPieza(i)} aria-label="quitar">×</button>
                </div>
                {ins && (
                  <div className="pieza-med">
                    {area ? (
                      <>
                        <label>Largo mm<input type="number" className="numero" min="0" value={c.largoMM || ''} onChange={(e) => setPieza(i, { largoMM: parseFloat(e.target.value) || 0 })} /></label>
                        <span className="por">×</span>
                        <label>Ancho mm<input type="number" className="numero" min="0" value={c.anchoMM || ''} onChange={(e) => setPieza(i, { anchoMM: parseFloat(e.target.value) || 0 })} /></label>
                        <span className="por">×</span>
                        <label>Cant<input type="number" className="numero" min="1" value={cnt} onChange={(e) => setPieza(i, { piezas: parseInt(e.target.value) || 1 })} /></label>
                      </>
                    ) : (
                      <label>Cantidad ({ins.unidad})<input type="number" className="numero" step="0.01" min="0" value={c.cantidad} onChange={(e) => setPieza(i, { cantidad: parseFloat(e.target.value) || 0 })} /></label>
                    )}
                    <span className="pieza-sub">{pesos(costoPieza(c, ins))}</span>
                  </div>
                )}
                {area && m2 > 0 && <div className="pieza-calc">= {m2.toFixed(2)} m² <span className="gris">({ins.clase === 'indirecta' ? 'comprado' : 'fabricado'})</span></div>}
                {c.iaRazon && <div className="pieza-calc"><span className="gris">📐 Consumo IA: {c.iaRazon}</span></div>}
                {c.iaNota && <div className="pieza-calc"><span className="gris">IA{c.iaConf ? ` · ${c.iaConf}` : ''}: {c.iaNota}</span></div>}
              </div>
            );
          })}
        </div>
      )}

      {/* PASO 3 — Mano de obra */}
      {paso === 2 && (
        <div>
          <div className="pregunta">¿Qué tan difícil es de fabricar?</div>
          <div className="pregunta-sub">Esto define las horas de taller. En el detalle puedes meter horas exactas por proceso.</div>
          <div className="ganar-botones">
            {DIFICULTAD.map((d) => (
              <button key={d.v} className={b.factorDirecta === d.v ? 'on' : ''} onClick={() => set({ factorDirecta: d.v })}>{d.nombre}</button>
            ))}
          </div>
          <div className="espacio" />
          <p className="ayuda columna-texto">Nota: para procesos especiales (curvo, termoformado, doblez, CNC) sube la dificultad — llevan más mano de obra.</p>
        </div>
      )}

      {/* PASO 4 — Resultado */}
      {paso === 3 && (
        <div className="tarjeta-precio">
          <div className="ficha-linea">{b.nombre || 'Producto nuevo'}</div>
          <div className="ayuda" style={{ margin: '6px 0' }}>Cuesta hacer 1 pieza</div>
          <div className="precio-enorme" style={{ color: 'var(--tinta)', fontSize: 38 }}>{pesos(resultado.costoUnitario)}</div>
          <div className="espacio" />
          <div className="ayuda">Precio de lista ({b.margen}% margen)</div>
          <div className="precio-enorme">{pesos(precio)}</div>
          <div className="espacio" />
          <div className="ayuda columna-texto" style={{ textAlign: 'left' }}>
            Material {pesos(resultado.materialTotal)} · Mano de obra {pesos(resultado.manoObra)} · Fábrica {pesos(resultado.indirectosFabrica)}
          </div>

          {/* RENDER V1 — ilustra el producto definido; no lo modifica */}
          <div className="espacio" />
          <div style={{ borderTop: '1px solid var(--borde)', paddingTop: 14, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong>Generar render</strong>
              <span className="chip" style={{ background: (costoEstado === 'certificado') ? 'var(--ok,#1a7f37)' : '#8a6d00', color: '#fff', fontSize: 12 }}>
                {costoEstado === 'certificado' ? 'COSTO CERTIFICADO' : 'COSTO PRELIMINAR'}
              </span>
              <span className="chip" style={{ background: geomFid === 'alta' ? 'var(--ok,#1a7f37)' : geomFid === 'media' ? '#8a6d00' : '#8a2d00', color: '#fff', fontSize: 12 }}>
                GEOMETRÍA: {geomFid === 'alta' ? 'ALTA' : geomFid === 'media' ? 'MEDIA' : 'LIMITADA'}
              </span>
              <span className="chip" style={{ background: acabadoFid === 'confirmado' ? 'var(--ok,#1a7f37)' : '#8a2d00', color: '#fff', fontSize: 12 }}>
                ACABADO: {acabadoFid === 'confirmado' ? 'CONFIRMADO' : 'POR CONFIRMAR'}
              </span>
            </div>
            <p className="ayuda" style={{ margin: '6px 0' }}>El render ilustra el producto ya definido (medidas, materiales y despiece de arriba). No cambia el producto.</p>
            {faltaCritico && (
              <p className="ayuda" style={{ color: 'var(--alerta,#b22a22)' }}>
                Falta info para ilustrarlo bien: {[!b.nombre?.trim() && 'nombre', !(b.componentes?.length) && 'despiece', !(dimsR.w > 0) && 'medidas'].filter(Boolean).join(', ')}. Complétalo arriba; no lo invento.
              </p>
            )}
            {renderMsg && <p className="ayuda" style={{ color: 'var(--alerta,#b22a22)' }}>{renderMsg}</p>}
            <button className="boton primario" disabled={faltaCritico || renderizando} onClick={generarRenders} style={{ marginTop: 6 }}>
              {renderizando ? 'Generando…' : (renders.aislado || renders.ambiente) ? 'Regenerar render' : 'Generar render'}
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              {['aislado', 'ambiente'].map((m) => (
                <div key={m}>
                  <div className="ayuda" style={{ marginBottom: 4 }}>{m === 'aislado' ? 'Producto aislado' : 'En ambiente'}</div>
                  {renders[m]
                    ? <img src={renders[m]} alt={m} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--borde)' }} />
                    : <div style={{ aspectRatio: '4/3', borderRadius: 8, border: '1px dashed var(--borde)', display: 'grid', placeItems: 'center' }}><span className="ayuda">{renderizando ? '…' : '—'}</span></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navegación */}
      <div className="espacio" />
      {paso < N_PASOS - 1 ? (
        <button className="boton primario grande" disabled={!puedeSeguir} onClick={() => setPaso(paso + 1)}>Siguiente ›</button>
      ) : (
        <div className="fila-botones">
          <button className="boton primario grande" onClick={() => onVerDetalle(b)}>Ver detalle completo y cotizar</button>
          <button className="boton grande" onClick={() => { setB({ nombre: '', piezas: 1, componentes: [], modoManoObra: 'porcentaje', factorDirecta: 55, factorIndirecta: 12, margen: b.margen }); setPaso(0); }}>Empezar otro</button>
        </div>
      )}
    </div>
  );
}
