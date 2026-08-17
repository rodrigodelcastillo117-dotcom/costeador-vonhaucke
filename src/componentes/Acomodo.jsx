// ============================================================================
//  ACOMODO EN EL ESPACIO (Fase 2)  ·  "¿caben los muebles?"
//  Toma los muebles de la cotización, defines una o VARIAS áreas (o SUBES el
//  plano y la IA lee las medidas), y la IA acomoda cada mueble. El sistema
//  dibuja el plano a escala (PLANTA o 3D) y VERIFICA que caben. Se guarda en la
//  propuesta para que salga en el PDF del cliente.
// ============================================================================
import { useMemo, useState, useEffect, useRef } from 'react';
import { acomodarEspacio, leerPlano, generarRender } from '../nube.js';
import { TIPOS, dimsPieza, expandirPiezas, mapaPiezas, contarBajoEscritorio } from '../datos/espacio.js';
import { imagenProducto, heroLinea } from '../datos/imagenes.js';
import { acomodarLocal } from '../datos/planner.js';
import { escenasDeAcomodo, lineasDeEscena, tipoDeEscena } from '../datos/escenas.js';
import { LINEAS_REG } from '../datos/lineas.js';
import { areasDeLectura, revisarAreas } from '../datos/planoLeido.js';
import PlanoAcomodo from './PlanoAcomodo.jsx';
import DibujarPlano from './DibujarPlano.jsx';
import Cargando from './Cargando.jsx';

// Un dibujo para lo que no tiene foto. Las sillas del banco vienen de
// presupuestos y no traen render de catálogo: antes se pintaba un CUADRADO CAFÉ
// plano y era imposible saber qué era. Un glifo no es una foto, pero al menos
// dice "esto es una silla".
const GLIFO = { asiento: '🪑', escritorio: '▬', juntas: '▭', guarda: '▤', mampara: '▐', mesa: '▭', mueble: '▢' };

// Reduce una imagen a base64 jpeg (máx 1600 px) para mandarla a la IA.
function imagenABase64(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * esc); cv.height = Math.round(img.height * esc);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Lee un archivo (PDF) tal cual a base64, sin procesar.
function archivoABase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// Metros -> mm, conservando la geometría. La FORMA (`poly`) y los huecos que no
// se amueblan (`obstaculos`) viajan junto al tamaño: es lo que hace que el motor
// respete una planta orgánica, esquive una columna y no meta muebles dentro de
// la sala de juntas que está en medio del open space.
function aMM(areas) {
  return areas.map((a) => ({
    nombre: a.nombre,
    ...(a.tipo ? { tipo: a.tipo } : {}),
    // x/y sólo existen si el cuarto tiene posición REAL (plano subido o
    // dibujado); sin ellas el plano se reacomoda en una cuadrícula inventada.
    ...(Number.isFinite(a.x) && Number.isFinite(a.y) ? { x: Math.round(a.x * 1000), y: Math.round(a.y * 1000) } : {}),
    ancho: Math.round((a.ancho || 0) * 1000),
    largo: Math.round((a.largo || 0) * 1000),
    ...(a.poly ? { poly: a.poly.map(([x, y]) => [Math.round(x * 1000), Math.round(y * 1000)]) } : {}),
    ...(a.obstaculos?.length ? { obstaculos: a.obstaculos.map((o) => ({ x: Math.round(o.x * 1000), y: Math.round(o.y * 1000), w: Math.round(o.w * 1000), h: Math.round(o.h * 1000), tipo: o.tipo })) } : {}),
    // Las puertas son el punto desde el que el motor comprueba que se LLEGUE
    // caminando a cada mueble.
    ...(a.puertas?.length ? { puertas: a.puertas.map((p) => ({ x: Math.round(p.x * 1000), y: Math.round(p.y * 1000), ancho: Math.round(p.ancho * 1000) })) } : {}),
  }));
}

// Sugiere un espacio del tamaño del proyecto (huella total ÷ ocupación objetivo).
function areaSugerida(piezas) {
  const foot = piezas.reduce((s, p) => s + (p.w || 1000) * (p.d || 700), 0); // mm²
  const room = Math.max(foot / 0.28, 32e6); // mín 32 m²; ~28% de ocupación
  const ancho = Math.sqrt(room * 1.5), largo = room / ancho;
  const r = (mm) => Math.max(4, Math.round((mm / 1000) * 2) / 2);
  return { nombre: 'Mi espacio', ancho: r(ancho), largo: r(largo) };
}

export default function Acomodo({ estado, onIr, onGuardarAcomodo }) {
  const partidas = (estado.cotizacion?.partidas) || [];
  // LO QUE YA HABÍAS ACOMODADO. Rodrigo: "si me salgo, no se guarda el acomodo
  // que yo tenía cuando regreso a la cotización… ni el plano se guarda".
  // Tenía razón y era grave: el acomodo y las áreas vivían SÓLO en esta
  // pantalla, así que al cambiar de pestaña se desmontaba el componente y se
  // perdía media hora de trabajo. Ahora se rescatan de la propuesta al entrar y
  // se guardan solos con cada cambio.
  const guardadoPrevio = estado.cotizacion?.acomodo || null;
  const [areas, setAreas] = useState(() => (
    guardadoPrevio?.areasM?.length
      ? guardadoPrevio.areasM
      : guardadoPrevio?.areas?.length
        // Respaldo: si sólo hay la versión en mm (guardada antes de este
        // arreglo), se convierte a metros para no perderla.
        ? guardadoPrevio.areas.map((a) => ({
          nombre: a.nombre, ...(a.tipo ? { tipo: a.tipo } : {}),
          ...(Number.isFinite(a.x) ? { x: a.x / 1000, y: a.y / 1000 } : {}),
          ancho: a.ancho / 1000, largo: a.largo / 1000,
          ...(a.poly ? { poly: a.poly.map(([x, y]) => [x / 1000, y / 1000]) } : {}),
          ...(a.obstaculos ? { obstaculos: a.obstaculos.map((o) => ({ x: o.x / 1000, y: o.y / 1000, w: o.w / 1000, h: o.h / 1000, tipo: o.tipo })) } : {}),
          ...(a.puertas ? { puertas: a.puertas.map((p) => ({ x: p.x / 1000, y: p.y / 1000, ancho: p.ancho / 1000 })) } : {}),
        }))
        : [areaSugerida(expandirPiezas(partidas))]
  ));
  const [modo, setModo] = useState('iso');
  const [cargando, setCargando] = useState('');   // '' | 'acomodo' | 'plano'
  const [error, setError] = useState('');
  const [plan, setPlan] = useState(() => guardadoPrevio?.plan || null);
  const [notaPlano, setNotaPlano] = useState('');
  const [guardado, setGuardado] = useState(false);
  const [staging, setStaging] = useState(false);      // generando staging
  const [stagingUrl, setStagingUrl] = useState(() => guardadoPrevio?.render3d || '');   // resultado (foto amueblada)
  const [errStaging, setErrStaging] = useState('');
  const [dibujando, setDibujando] = useState(false);  // lienzo "dibuja tu oficina"
  const [planReal, setPlanReal] = useState(!!guardadoPrevio?.planReal);   // áreas de plano/dibujo real → no crecer
  const [dibujoMeta, setDibujoMeta] = useState({});   // {alto, columnas, escaleras, dobles[]}

  const piezas = useMemo(() => expandirPiezas(partidas), [partidas]);
  // Las gavetas rodantes van bajo la cubierta: no se acomodan, pero se dicen.
  const bajoEscritorio = useMemo(() => contarBajoEscritorio(partidas), [partidas]);
  const byId = useMemo(() => mapaPiezas(piezas), [piezas]);
  // Metros -> mm, conservando la geometría (forma real y obstáculos) para que
  // el motor y el plano dibujen y calculen sobre el MISMO espacio.
  const areasMM = aMM(areas);

  // Al corregir a mano el ancho/largo de un cuarto que vino de un plano, su
  // FORMA se escala con él. Sin esto el número decía una cosa y el dibujo otra:
  // el contorno seguía siendo el del plano y el mueble se salía.
  const setArea = (i, campo, val) => setAreas((as) => as.map((a, j) => {
    if (j !== i) return a;
    const nuevo = { ...a, [campo]: val };
    const eje = campo === 'ancho' ? 0 : campo === 'largo' ? 1 : -1;
    const antes = campo === 'ancho' ? a.ancho : a.largo;
    if (eje < 0 || !a.poly || !(antes > 0) || !(val > 0)) return nuevo;
    const k = val / antes;
    nuevo.poly = a.poly.map((p) => (eje === 0 ? [+(p[0] * k).toFixed(3), p[1]] : [p[0], +(p[1] * k).toFixed(3)]));
    if (a.obstaculos?.length) {
      nuevo.obstaculos = a.obstaculos.map((o) => (eje === 0
        ? { ...o, x: +(o.x * k).toFixed(3), w: +(o.w * k).toFixed(3) }
        : { ...o, y: +(o.y * k).toFixed(3), h: +(o.h * k).toFixed(3) }));
    }
    return nuevo;
  }));
  const addArea = () => setAreas((as) => [...as, { nombre: `Privado ${as.length}`, ancho: 3.5, largo: 4 }]);
  const delArea = (i) => setAreas((as) => as.filter((_, j) => j !== i));

  // Acomodo DETERMINISTA (instantáneo). Con un solo espacio, GARANTIZA que todo
  // cabe (ajusta el tamaño); con plano multi-cuarto, respeta las medidas reales.
  function acomodar() {
    setError(''); setGuardado(false);
    try {
      const auto = !planReal && areasMM.length <= 1;
      const r = acomodarLocal(areasMM, piezas, { ajustar: auto });
      setPlan(r);
      if (auto && r.areas?.length) setAreas(r.areas.map((a) => ({ nombre: a.nombre, ancho: +(a.ancho / 1000).toFixed(2), largo: +(a.largo / 1000).toFixed(2) })));
    } catch (e) { setError('No se pudo acomodar: ' + String(e?.message || e)); }
  }

  // 1-CLIC: al entrar con muebles, genera el 3D automáticamente (motor local, gratis).
  const autoRef = useRef(false);
  useEffect(() => {
    if (autoRef.current || piezas.length === 0) return;
    autoRef.current = true;
    // Si vuelves a entrar y ya tenías un acomodo guardado, NO se re-acomoda:
    // borrar el trabajo del proyectista "para empezar de cero" es justo lo que
    // Rodrigo estaba sufriendo.
    if (guardadoPrevio?.plan?.colocacion?.length) return;
    acomodar();
  }, [piezas]);

  // ---- GUARDADO SOLO ------------------------------------------------------
  // Cada cambio del plano o de las áreas se escribe en la propuesta, sin avisos
  // ni botones. El botón "Guardar en la propuesta" se queda para lo explícito,
  // pero ya no es lo que evita perder el trabajo.
  const primerGuardado = useRef(true);
  useEffect(() => {
    if (!onGuardarAcomodo) return;
    if (primerGuardado.current) { primerGuardado.current = false; return; }
    const t = setTimeout(() => {
      onGuardarAcomodo({
        areas: aMM(areas), areasM: areas, plan, planReal,
        ...(dibujoMeta && Object.keys(dibujoMeta).length ? { dibujoMeta } : {}),
        ...(stagingUrl ? { render3d: stagingUrl } : {}),
      }, true);
    }, 600);
    return () => clearTimeout(t);
  }, [areas, plan, planReal, stagingUrl]);
  // Acomodo con IA (alterna): útil para casos raros; el motor local es el default.
  async function acomodarIA() {
    setError(''); setPlan(null); setGuardado(false); setCargando('acomodo');
    try {
      const r = await acomodarEspacio(areasMM, piezas);
      if (!r || !r.ok) { setError(r?.error || 'No se pudo acomodar. Vuelve a intentar.'); return; }
      setPlan(r.plan);
    } catch (e) {
      setError('No se pudo conectar con el asistente. Revisa tu internet y vuelve a intentar.');
    } finally {
      setCargando('');
    }
  }

  async function subirPlano(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setError(''); setNotaPlano(''); setCargando('plano');
    try {
      const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const b64 = esPdf ? await archivoABase64(file) : await imagenABase64(file);
      const r = await leerPlano(b64, esPdf ? 'application/pdf' : 'image/jpeg');
      setCargando('');
      if (!r || !r.ok) { setError(r?.error || 'No se pudo leer el plano.'); return; }
      const lec = r.lectura;
      // La lectura trae la FORMA REAL de cada cuarto (polígono o círculo) en mm
      // absolutos. `areasDeLectura` la pasa a lo que ya usa el resto de la app:
      // posición + contorno relativo, en metros. Un cuarto declarado dentro de
      // otro (la sala circular en medio del open space) se le entrega al padre
      // como obstáculo, para que no le acomode muebles encima.
      const { areas: leidas } = areasDeLectura(lec);
      if (leidas.length) { setAreas(leidas); setPlanReal(true); }
      const notas = [];
      if (!lec.tieneCotas) notas.push('El plano no traía cotas: las medidas son estimadas, revísalas.');
      // La revisión se enseña ANTES que las notas del modelo: si el levantamiento
      // no cuadra como planta, el proyectista tiene que saberlo, no descubrirlo
      // cuando el 3D salga raro.
      const problemas = revisarAreas(lec);
      if (problemas.length) notas.push('Revisa esto:', ...problemas.map((p) => '· ' + p));
      if (!leidas.length) notas.push('No pude reconocer los cuartos. Sube el plano en mejor calidad o dibújalo con “Dibujar mi oficina”.');
      if (lec.notas?.length) notas.push(...lec.notas);
      setNotaPlano(notas.join(' '));
      // Acomodar de inmediato: subir el plano y quedarse con la pantalla igual
      // hacía pensar que no había pasado nada.
      if (leidas.length) {
        try { setPlan(acomodarLocal(aMM(leidas), piezas, { ajustar: false })); }
        catch (err2) { setError('Leí el plano pero no pude acomodar: ' + String(err2?.message || err2)); }
      }
    } catch (err) { setCargando(''); setError('No se pudo procesar la imagen.'); }
  }

  // El usuario dibujó su oficina → usar esas áreas reales y amueblar.
  function usarDibujo(areasDib, meta) {
    // La geometría (forma real + obstáculos) viaja en mm junto al tamaño: es lo
    // que hace que el motor respete una planta en L y esquive columnas.
    const mm = areasDib.map((a) => ({
      nombre: a.nombre,
      tipo: a.tipo || null,
      ancho: Math.round(a.ancho * 1000),
      largo: Math.round(a.largo * 1000),
      poly: a.poly ? a.poly.map(([x, y]) => [Math.round(x * 1000), Math.round(y * 1000)]) : null,
      obstaculos: (a.obstaculos || []).map((o) => ({
        x: Math.round(o.x * 1000), y: Math.round(o.y * 1000),
        w: Math.round(o.w * 1000), h: Math.round(o.h * 1000), tipo: o.tipo,
      })),
    }));
    setAreas(areasDib); setDibujoMeta(meta || {}); setPlanReal(true); setDibujando(false); setGuardado(false); setError('');
    try { setPlan(acomodarLocal(mm, piezas, { ajustar: false })); } catch (e) { setError('No se pudo acomodar: ' + String(e?.message || e)); }
  }

  // Piezas que TODAVÍA no están en el plano: son las de la paleta.
  const colocadas = new Set((plan?.colocacion || []).map((c) => c.id));
  const pendientes = piezas.filter((p) => !colocadas.has(p.id));
  // Las pendientes AGRUPADAS por producto, conservando el orden en que se
  // pidieron. `ids` es la lista de las que faltan de ese producto: su largo es
  // la cuenta que se enseña y baja sola conforme se van colocando.
  // La revisión de Voni está VENCIDA si movieron algo después, o si la cuenta que
  // ella reportó ya no coincide con la realidad de ahora (se agregaron muebles a
  // la cotización después de acomodar). Sin esto la tarjeta decía "faltan 8" y
  // "✓ 36 de 36" al mismo tiempo.
  const vencida = !!plan?.auditoriaVencida ||
    (!!plan?.auditoria?.length && (plan.colocacion || []).length !== piezas.length);

  const agrupadas = useMemo(() => {
    const m = new Map();
    for (const p of pendientes) {
      const clave = `${p.nombre}|${p.w}x${p.d}`;
      if (!m.has(clave)) m.set(clave, { clave, muestra: p, ids: [] });
      m.get(clave).ids.push(p.id);
    }
    return [...m.values()];
  }, [pendientes]);

  // ---- DESHACER ----------------------------------------------------------
  // Rodrigo: "si le pico rápido, se borran los muebles que estaba acomodando".
  // Aunque ya se arregló lo que lo causaba (botones enormes encima de los
  // muebles vecinos), acomodar a mano SIN deshacer es acomodar con miedo: un
  // resbalón te tira media hora de trabajo. Se guardan los últimos 40 pasos.
  const [historia, setHistoria] = useState([]);
  const recordar = () => setHistoria((h) => [...h.slice(-39), { colocacion: plan?.colocacion || [], areas }]);
  const hayQueDeshacer = historia.length > 0;
  function deshacer() {
    if (!historia.length) return;
    const ult = historia[historia.length - 1];
    setHistoria((h) => h.slice(0, -1));
    setPlan((pl) => (pl ? { ...pl, colocacion: ult.colocacion } : pl));
    setAreas(ult.areas);
    setSelPieza(null); setSelEl(null); setEnLaMano(null); setGuardado(false);
  }
  // Ctrl+Z / Cmd+Z, como en cualquier programa donde se dibuja.
  useEffect(() => {
    if (!aMano) return;
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); deshacer(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const editarColocacion = (fn) => setPlan((pl) => {
    if (!pl) return pl;
    // 🐛 La auditoría se calculaba UNA vez y esto no la tocaba: al vaciar el
    // plano seguía diciendo "✓ Todas las piezas colocadas · 17 de 17" mientras
    // arriba decía "faltan 17 por colocar". Ahora, en cuanto el proyectista
    // mueve algo, la revisión queda marcada como VENCIDA: sigue a la vista lo
    // que decía, pero se dice que ya no vale.
    return { ...pl, colocacion: fn(pl.colocacion || []), auditoriaVencida: true };
  });

  // Poner en el plano lo que traigo en la mano, o mover lo que está seleccionado.
  function soltarEn(area, x, y, idArrastrado) {
    // Un toque en el plano vacío ya NO mueve la pieza seleccionada: para eso
    // está el arrastre. Antes, seleccionar un mueble y tocar en otro lado lo
    // teletransportaba, que es otra forma de perder el acomodo sin querer.
    const id = idArrastrado || enLaMano;
    if (!id) return;
    recordar();
    const p = byId[id]; if (!p) return;
    // Se suelta por el CENTRO: es donde el dedo cree que está el mueble.
    const cx = Math.max(0, Math.round(x - (p.w || 0) / 2));
    const cy = Math.max(0, Math.round(y - (p.d || 0) / 2));
    editarColocacion((cs) => {
      const sin = cs.filter((c) => c.id !== id);
      const antes = cs.find((c) => c.id === id);
      return [...sin, { id, area, x: cx, y: cy, rot: antes?.rot || 0 }];
    });
    setEnLaMano(null); setSelPieza(id); setGuardado(false);
  }
  // Cada toque gira 90°: cuatro toques dan la vuelta completa. Antes sólo
  // alternaba 0/90 y, además, el dibujo no cambiaba de frente — por eso el
  // mueble "salía viendo" siempre igual por más que lo giraras.
  const girar = (id = selPieza) => id && (recordar(), true) && editarColocacion((cs) => cs.map((c) => (c.id === id ? { ...c, rot: ((c.rot || 0) + 90) % 360 } : c)));
  const quitar = (id = selPieza) => { if (!id) return; recordar(); editarColocacion((cs) => cs.filter((c) => c.id !== id)); setSelPieza(null); };

  // ---- ELEMENTOS DEL PLANO puestos a mano -------------------------------
  // Rodrigo: "el plano, nunca ponen puertas, ¿cómo las ponemos? Piensa en un
  // menú estilo Word que tenga puertas, escaleras, columnas, paredes, y que
  // tengas la libertad de ponerlo donde quieras." Sin esto, leer puertas del
  // plano no sirve de nada: los planos reales no las traen dibujadas, y sin
  // puertas el motor no puede orientar los escritorios ni medir circulación.
  const [herramienta, setHerramienta] = useState(null);
  const [selEl, setSelEl] = useState(null);
  const ELEMENTOS = {
    puerta:   { et: 'Puerta',   ancho: 0.90 },
    muro:     { et: 'Muro',     w: 3.00, h: 0.15 },
    columna:  { et: 'Columna',  w: 0.40, h: 0.40 },
    escalera: { et: 'Escalera', w: 1.20, h: 2.50 },
  };

  function ponerElemento(area, xmm, ymm) {
    const t = herramienta; if (!t) return;
    const x = xmm / 1000, y = ymm / 1000;
    recordar(); setGuardado(false);
    setAreas((as) => as.map((a, i) => {
      if (i !== area) return a;
      if (t === 'puerta') {
        return { ...a, puertas: [...(a.puertas || []), { x: +x.toFixed(2), y: +y.toFixed(2), ancho: ELEMENTOS.puerta.ancho }] };
      }
      const d = ELEMENTOS[t];
      const o = { x: +(x - d.w / 2).toFixed(2), y: +(y - d.h / 2).toFixed(2), w: d.w, h: d.h, tipo: t };
      return { ...a, obstaculos: [...(a.obstaculos || []), o] };
    }));
    setHerramienta(null);
  }

  // id = "el:<area>:<k>" (obstáculo) | "pu:<area>:<k>" (puerta)
  const partesEl = (id) => { const [k, a, i] = String(id).split(':'); return { clase: k, area: +a, idx: +i }; };

  function moverElemento(id, area, xmm, ymm) {
    const { clase, area: a0, idx } = partesEl(id);
    recordar(); setGuardado(false);
    setAreas((as) => as.map((a, i) => {
      if (clase === 'pu') {
        if (i === a0) { const ps = [...(a.puertas || [])]; const q = ps[idx]; ps.splice(idx, 1);
          return i === area ? { ...a, puertas: [...ps, { ...q, x: +(xmm / 1000).toFixed(2), y: +(ymm / 1000).toFixed(2) }] } : { ...a, puertas: ps }; }
        if (i === area) { const q = as[a0].puertas[idx];
          return { ...a, puertas: [...(a.puertas || []), { ...q, x: +(xmm / 1000).toFixed(2), y: +(ymm / 1000).toFixed(2) }] }; }
        return a;
      }
      if (i === a0) { const os = [...(a.obstaculos || [])]; const q = os[idx]; os.splice(idx, 1);
        return i === area ? { ...a, obstaculos: [...os, { ...q, x: +(xmm / 1000).toFixed(2), y: +(ymm / 1000).toFixed(2) }] } : { ...a, obstaculos: os }; }
      if (i === area) { const q = as[a0].obstaculos[idx];
        return { ...a, obstaculos: [...(a.obstaculos || []), { ...q, x: +(xmm / 1000).toFixed(2), y: +(ymm / 1000).toFixed(2) }] }; }
      return a;
    }));
    setSelEl(null);
  }

  function girarElemento(id) {
    const { clase, area, idx } = partesEl(id);
    if (clase === 'pu') return;                    // una puerta redonda no cambia al girar
    recordar(); setGuardado(false);
    setAreas((as) => as.map((a, i) => (i !== area ? a : {
      ...a,
      obstaculos: (a.obstaculos || []).map((o, k) => (k !== idx ? o : { ...o, w: o.h, h: o.w })),
    })));
  }

  function quitarElemento(id) {
    const { clase, area, idx } = partesEl(id);
    recordar(); setGuardado(false);
    setAreas((as) => as.map((a, i) => (i !== area ? a : (clase === 'pu'
      ? { ...a, puertas: (a.puertas || []).filter((_, k) => k !== idx) }
      : { ...a, obstaculos: (a.obstaculos || []).filter((_, k) => k !== idx) }))));
    setSelEl(null);
  }

  // ---- VISTA REALISTA: el isométrico se convierte en imagen y Gemini la
  // re-fotografía. Misma jugada que el catálogo: el DIBUJO manda la geometría
  // (cuántos muebles y dónde, que es lo que el motor ya calculó) y el modelo
  // manda el realismo. Sin la imagen, Gemini inventa una oficina bonita que no
  // es la del cliente.
  const isoLimpioRef = useRef(null);   // la copia SIN etiquetas: es la que se manda
  const [realista, setRealista] = useState('');

  // ---- UNA ESCENA POR CUARTO -----------------------------------------------
  // Rodrigo, probándola en el celular: "el render sale así siempre, no pone
  // Eclipse ni nada que realmente debería; debería generar render de los
  // privados también, tomando en cuenta el plano".
  // El render de antes recibía UNA lista de texto y nada más, así que sólo podía
  // dibujar una oficina genérica. Aquí se le manda, por cada cuarto: el DIBUJO
  // de ese cuarto (geometría), los RENDERS REALES de sus muebles (fidelidad) y
  // la línea, el acabado y las medidas (el texto).
  // El modo `escena` de `generar-render` está desplegado (v17) y probado contra
  // la función en vivo: devuelve una fotografía a nivel de ojo, 3:2, de UN
  // cuarto, con el lenguaje Von Haucke y la geometría del diagrama respetada.
  // La prueba está en `scratchpad/` y se puede repetir con curl.
  const escenas = useMemo(
    () => escenasDeAcomodo(partidas, { areas: areasMM, plan }),
    [partidas, areasMM, plan],
  );
  const escenasRef = useRef({});                 // areaIndex -> nodo con su isométrico
  const [imgEscena, setImgEscena] = useState({});// areaIndex -> dataUrl
  const [genEscena, setGenEscena] = useState(null);
  const [errEscena, setErrEscena] = useState('');
  // ---- ACOMODO A MANO ------------------------------------------------------
  // Voni entiende el pedido y lo cotiza; DÓNDE va cada mueble lo sabe el
  // proyectista, no la máquina. El auto-acomodo se queda como punto de partida
  // (un clic y ya hay algo), pero aquí se corrige arrastrando.
  const [aMano, setAMano] = useState(false);
  const [enLaMano, setEnLaMano] = useState(null);   // pieza tomada de la paleta
  const [selPieza, setSelPieza] = useState(null);   // pieza ya puesta, seleccionada
  const [generandoReal, setGenerandoReal] = useState(false);

  // El SVG se pasa a JPEG por canvas. Se usa un blob URL y NO un data: URL:
  // con data: el navegador no dispara `onload` cuando el SVG es grande.
  function isoAJpeg(svg, ancho = 1280) {
    return new Promise((resolve, reject) => {
      const vb = (svg.getAttribute('viewBox') || '0 0 1000 1000').split(/\s+/).map(Number);
      const alto = Math.round((ancho * vb[3]) / vb[2]);
      let xml = new XMLSerializer().serializeToString(svg);
      if (!/xmlns=/.test(xml)) xml = xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = ancho; c.height = alto;
        const g = c.getContext('2d');
        g.fillStyle = '#F4F1EC'; g.fillRect(0, 0, ancho, alto);
        g.drawImage(img, 0, 0, ancho, alto);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.92).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('no se pudo leer el dibujo')); };
      img.src = url;
    });
  }

  async function vistaRealista() {
    // Se lee SIEMPRE la copia limpia, no la visible: la visible puede estar en
    // modo Planta (sin isométrico) y además lleva las etiquetas del piso.
    const svg = isoLimpioRef.current?.querySelector('svg.plano');
    if (!svg) { setErrStaging('Primero acomoda el espacio.'); return; }
    setErrStaging(''); setGenerandoReal(true);
    try {
      const b64 = await isoAJpeg(svg);
      const lista = partidas.map((p) => `${p.cantidad}× ${p.nombre}`).join(', ');
      const r = await generarRender(lista || 'mobiliario de oficina Von Haucke', {
        modo: 'acomodo', imagen: b64, mediaType: 'image/jpeg', aspecto: '16:9',
        medidas: areas.map((a) => `${a.nombre} ${a.ancho}×${a.largo} m`).join('; '),
      });
      if (!r || !r.ok) { setErrStaging(r?.error || 'No se pudo generar la vista realista.'); return; }
      setRealista(r.dataUrl);
    } catch (e) {
      setErrStaging('No se pudo generar la vista realista: ' + String(e?.message || e));
    } finally { setGenerandoReal(false); }
  }

  // Trae el render de catálogo de una pieza como base64, para mandárselo al
  // modelo como referencia del producto REAL.
  async function fotoDeProducto(ruta, productoId) {
    const url = ruta ? (imagenProducto(ruta, productoId) || heroLinea(ruta)) : null;
    if (!url) return null;
    try {
      const r = await fetch(url); const b = await r.blob();
      return await new Promise((res) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1]);
        fr.onerror = () => res(null);
        fr.readAsDataURL(b);
      });
    } catch (e) { return null; }
  }

  // Genera la escena de UN cuarto. Se hace de uno en uno —no en paralelo— porque
  // cada llamada tarda y en el celular disparar cinco a la vez las tumba.
  async function generarEscena(esc) {
    const nodo = escenasRef.current[esc.areaIndex];
    const svg = nodo?.querySelector('svg.plano');
    if (!svg) return { ok: false, error: 'No se pudo leer el dibujo de ' + esc.nombre };
    const dibujo = await isoAJpeg(svg, 1024);
    // Los renders de los muebles de ESTE cuarto, los más presentes primero.
    const fotos = [];
    for (const p of esc.piezas.slice(0, 5)) {
      const f = await fotoDeProducto(p.ruta, p.productoId);
      if (f) fotos.push(f);
    }
    return generarRender(esc.descripcion, {
      modo: 'escena',
      imagen: dibujo, mediaType: 'image/jpeg',
      imagenes: fotos,
      cuarto: tipoDeEscena(esc.nombre),
      lineas: lineasDeEscena(esc).map((r) => (LINEAS_REG?.[r]?.titulo || r)),
      medidas: `${(esc.anchoMM / 1000).toFixed(2)} × ${(esc.largoMM / 1000).toFixed(2)} m (${esc.m2} m2)`,
    });
  }

  async function generarTodasLasEscenas() {
    setErrEscena('');
    for (const esc of escenas) {
      setGenEscena(esc.areaIndex);
      try {
        const r = await generarEscena(esc);
        if (r?.ok) setImgEscena((m) => ({ ...m, [esc.areaIndex]: r.dataUrl }));
        else setErrEscena(r?.error || `No se pudo generar ${esc.nombre}.`);
      } catch (e) {
        setErrEscena(`No se pudo generar ${esc.nombre}: ${String(e?.message || e)}`);
      }
    }
    setGenEscena(null);
  }

  // Render fotorrealista de la oficina desde las áreas/dibujo (sin foto real).
  async function renderOficina() {
    setErrStaging(''); setStaging(true);
    try {
      const lista = partidas.map((p) => `${p.cantidad}× ${p.nombre}`).join(', ') || 'mobiliario de oficina Von Haucke';
      const layout = areas.map((a) => `${a.nombre} ${a.ancho}×${a.largo}m`).join('; ');
      const ex = [];
      if (dibujoMeta.columnas) ex.push(`${dibujoMeta.columnas} structural column(s)`);
      if (dibujoMeta.escaleras) ex.push(`${dibujoMeta.escaleras} staircase(s)`);
      if (dibujoMeta.dobles?.length) ex.push(`double-height ceiling in ${dibujoMeta.dobles.join(', ')}`);
      const extras = ex.length ? ` The space has ${ex.join(', ')}; keep furniture clear of columns and stairs.` : '';
      const desc = `${lista}. Layout: ${layout}.${extras}`;
      const urls = [...new Set(partidas.map((p) => (p.ruta ? imagenProducto(p.ruta, p.productoId) || heroLinea(p.ruta) : null)).filter(Boolean))].slice(0, 6);
      const u2b = async (url) => { try { const rr = await fetch(url); const b = await rr.blob(); return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = () => res(null); fr.readAsDataURL(b); }); } catch (e) { return null; } };
      const imagenes = (await Promise.all(urls.map(u2b))).filter(Boolean);
      const r = await generarRender(desc, { modo: 'oficina', medidas: `${areas.length} área(s), altura ${dibujoMeta.alto || 2.7} m`, imagenes });
      if (!r || !r.ok) { setErrStaging(r?.error || 'No se pudo generar la oficina.'); return; }
      setStagingUrl(r.dataUrl);
    } catch (e) { setErrStaging('No se pudo conectar.'); }
    finally { setStaging(false); }
  }

  function guardarEnPropuesta() {
    if (onGuardarAcomodo && plan) { onGuardarAcomodo({ areas: areasMM, plan, ...(stagingUrl ? { render3d: stagingUrl } : {}) }); setGuardado(true); }
  }

  // STAGING VIRTUAL: subir foto real del espacio → la IA lo amuebla con lo cotizado.
  async function amueblarFoto(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setErrStaging(''); setStaging(true);
    try {
      const b64 = await imagenABase64(file);
      const desc = partidas.map((p) => `${p.cantidad}× ${p.nombre}`).join(', ') || 'mobiliario de oficina Von Haucke';
      const r = await generarRender(desc, { modo: 'staging', imagen: b64, mediaType: 'image/jpeg' });
      if (!r || !r.ok) { setErrStaging(r?.error || 'No se pudo amueblar la foto.'); return; }
      setStagingUrl(r.dataUrl);
    } catch (err) { setErrStaging('No se pudo procesar la foto.'); }
    finally { setStaging(false); }
  }
  function guardarStaging() {
    if (onGuardarAcomodo && stagingUrl) { onGuardarAcomodo({ areas: areasMM, plan: plan || null, render3d: stagingUrl }); setGuardado(true); }
  }

  // VERIFICACIÓN determinista por área: dentro de bordes + sin traslapes.
  const chequeo = useMemo(() => {
    if (!plan) return null;
    const tol = 20;
    const cajas = (plan.colocacion || []).map((c) => {
      const p = byId[c.id]; if (!p) return null;
      const { pw, ph } = dimsPieza(p, c.rot);
      return { area: c.area ?? 0, nombre: p.nombre, x0: c.x, y0: c.y, x1: c.x + pw, y1: c.y + ph };
    }).filter(Boolean);
    const fuera = [], enc = new Set();
    for (const b of cajas) {
      const a = areasMM[b.area]; if (!a) continue;
      if (b.x0 < -tol || b.y0 < -tol || b.x1 > a.ancho + tol || b.y1 > a.largo + tol) fuera.push(b.nombre);
    }
    for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i], b = cajas[j]; if (a.area !== b.area) continue;
      const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (ix > tol && iy > tol) { enc.add(a.nombre); enc.add(b.nombre); }
    }
    const problemas = [...new Set(fuera)].map((n) => `Se sale del área: ${n}`).concat([...enc].map((n) => `Encimado: ${n}`));
    // NÚMEROS QUE SÍ DICEN ALGO. El "% de ocupación de piso" era inútil —
    // Rodrigo: "está pésimo, no es eso"— y además mentía: dividía la superficie
    // de TODAS las piezas (incluidas las que no cupieron) entre el piso. Un
    // proyectista mira otras dos cosas: cuántos PUESTOS quedaron y cuántos m²
    // hay por persona (7–10 m² es lo normal en oficina).
    const colocadasIds = new Set((plan.colocacion || []).map((c) => c.id));
    // Una banca DOBLE (fondo ≥ 1000 mm) sienta a dos personas de frente por cada
    // columna: cuenta doble. Antes se dividía sólo el largo entre 1.50 y salía la
    // mitad de los puestos reales.
    const puestos = piezas.filter((p) => p.tipo === 'escritorio' && colocadasIds.has(p.id))
      .reduce((n, p) => {
        const largo = Math.max(p.w, p.d), fondo = Math.min(p.w, p.d);
        const columnas = Math.max(1, Math.round(largo / 1500));
        return n + columnas * (fondo >= 1000 ? 2 : 1);
      }, 0);
    const sinColocar = piezas.length - colocadasIds.size;
    const areaPiso = areasMM.reduce((s, a) => s + a.ancho * a.largo, 0) / 1e6;   // m²
    // "Todo cabe" tiene que significar TODO: antes decía que sí mientras el
    // renglón de abajo decía "caben 27 de 36".
    return {
      ok: problemas.length === 0 && sinColocar === 0,
      problemas: problemas.slice(0, 10), nProblemas: problemas.length,
      puestos, sinColocar,
      m2Persona: puestos ? Math.round((areaPiso / puestos) * 10) / 10 : null,
      areaPiso: Math.round(areaPiso),
    };
  }, [plan, byId, areasMM, piezas]);

  if (cargando === 'acomodo') return <Cargando voni titulo="Voni está acomodando el espacio" mensajes={['Midiendo las áreas…', 'Asignando muebles a cada cuarto…', 'Dejando circulaciones…', 'Verificando que todo quepa…']} />;
  if (cargando === 'plano') return <Cargando voni titulo="Voni está leyendo el plano" mensajes={['Reconociendo muros…', 'Midiendo los cuartos…', 'Sacando las áreas…']} />;

  const usados = Object.keys(TIPOS).filter((t) => piezas.some((p) => p.tipo === t));

  return (
    <div className="contenido" style={{ maxWidth: 1000 }}>
      {dibujando && <DibujarPlano onListo={usarDibujo} onCancelar={() => setDibujando(false)} />}
      <div className="tarjeta no-imprimir" style={dibujando ? { display: 'none' } : undefined}>
        <button className="boton fantasma" style={{ minHeight: 40, marginBottom: 10 }} onClick={() => onIr('cotizacion')}>← Volver a la cotización</button>
        <h2>Tu espacio en 3D</h2>
        <p className="ayuda columna-texto">
          Ya acomodamos los <strong>{piezas.length}</strong> muebles de tu cotización en un espacio a escala (abajo, en 3D).
          Ajusta las medidas o <strong>sube tu plano real</strong> y vuelve a acomodar; luego guárdalo en la propuesta.
          {bajoEscritorio > 0 && <> Aparte van <strong>{bajoEscritorio}</strong> {bajoEscritorio === 1 ? 'gaveta' : 'gavetas'} debajo de la cubierta: se cobran, pero <strong>no ocupan piso</strong>, por eso no se dibujan sueltas.</>}
        </p>

        {piezas.length === 0 ? (
          <div className="alerta ambar"><span className="texto">Tu cotización está vacía. Agrega muebles primero (Cotizar con IA) y regresa.</span></div>
        ) : (
          <>
            {/* Áreas */}
            <label className="etiqueta">Áreas del proyecto</label>
            {areas.map((a, i) => (
              <div className="fila-botones" key={i} style={{ alignItems: 'flex-end', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}><input type="text" value={a.nombre} onChange={(e) => setArea(i, 'nombre', e.target.value)} placeholder="Nombre (ej. Open space)" /></div>
                <div><input type="number" className="numero" style={{ width: 90 }} min="1" step="0.5" value={a.ancho} onChange={(e) => setArea(i, 'ancho', parseFloat(e.target.value) || 0)} /><span className="ayuda" style={{ display: 'inline', marginLeft: 4 }}>ancho m</span></div>
                <div><input type="number" className="numero" style={{ width: 90 }} min="1" step="0.5" value={a.largo} onChange={(e) => setArea(i, 'largo', parseFloat(e.target.value) || 0)} /><span className="ayuda" style={{ display: 'inline', marginLeft: 4 }}>largo m</span></div>
                {areas.length > 1 && <button className="boton fantasma" style={{ minHeight: 44, padding: '0 12px' }} onClick={() => delArea(i)}>Quitar</button>}
              </div>
            ))}
            <div className="fila-botones" style={{ gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <button className="boton fantasma" style={{ minHeight: 44 }} onClick={addArea}>+ Agregar área</button>
              <button className="boton" style={{ minHeight: 44 }} onClick={() => setDibujando(true)}>Dibujar mi oficina</button>
              <label className="boton fantasma" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }} title="PDF (de AutoCAD/SketchUp), foto o captura de croquis.">
                Subir plano (PDF o foto)
                <input type="file" accept="image/*,application/pdf,.pdf" style={{ display: 'none' }} onChange={subirPlano} />
              </label>
              <button className="boton primario" style={{ minHeight: 50, marginLeft: 'auto' }} onClick={acomodar}>Acomodar</button>
              <button className="boton fantasma" style={{ minHeight: 50 }} onClick={acomodarIA} title="Alterna con IA (el acomodo normal ya es automático)">Con IA</button>
            </div>
            {notaPlano && <div className="alerta ambar" style={{ marginTop: 10 }}><span className="texto">{notaPlano}</span></div>}
          </>
        )}
        {error && <div className="alerta roja" style={{ marginTop: 12 }}><span className="texto">{error}</span></div>}
      </div>

      {/* STAGING VIRTUAL con IA: foto real del espacio → amueblada con lo cotizado */}
      {piezas.length > 0 && (
        <div className="tarjeta">
          <h2>Amuebla una foto real (IA)</h2>
          <p className="ayuda columna-texto">Sube una foto del espacio del cliente (aunque esté vacío) y la IA lo amuebla con los muebles de esta cotización, respetando muros, ventanas y perspectiva. Ideal para la propuesta: <em>“así se vería tu oficina”.</em></p>
          <div className="fila-botones" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label className="boton primario" style={{ minHeight: 48, display: 'inline-flex', alignItems: 'center', cursor: staging ? 'default' : 'pointer', pointerEvents: staging ? 'none' : 'auto', opacity: staging ? 0.6 : 1 }}>
              {staging ? 'Generando…' : stagingUrl ? 'Probar con otra foto' : 'Subir foto y amueblar'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={amueblarFoto} disabled={staging} />
            </label>
            <button className="boton" style={{ minHeight: 48 }} disabled={staging} onClick={renderOficina}>Render de mi oficina (IA)</button>
          </div>
          <div className="ayuda">O genera la oficina fotorrealista desde tus áreas/dibujo, sin foto.</div>
          {errStaging && <div className="alerta roja" style={{ marginTop: 10 }}><span className="texto">{errStaging}</span></div>}
          {staging && <div className="render-gen" style={{ position: 'relative', height: 180, marginTop: 12 }}><span className="render-gen-spin" /><span>La IA está amueblando el espacio…</span></div>}
          {stagingUrl && !staging && (
            <div style={{ marginTop: 12 }}>
              <img src={stagingUrl} alt="Espacio amueblado por IA" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--linea)' }} />
              <div className="fila-botones" style={{ gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <button className="boton primario" style={{ minHeight: 46 }} onClick={guardarStaging}>Guardar en la propuesta</button>
                {onIr && <button className="boton" style={{ minHeight: 46 }} onClick={() => onIr('cotizacion')}>Ver propuesta →</button>}
              </div>
              {guardado && <div className="ayuda verde" style={{ marginTop: 6 }}>Guardado. Ya aparece en el PDF de la propuesta.</div>}
            </div>
          )}
        </div>
      )}

      {plan && (
        <div className="tarjeta">
          {chequeo && (
            <div className={`alerta ${chequeo.ok ? '' : 'ambar'}`} style={chequeo.ok ? { background: '#e9f5f1', borderColor: 'var(--verde)', color: '#0b5c54' } : undefined}>
              <span className="texto">
                {chequeo.ok ? '✓ Todo cabe.' : chequeo.sinColocar > 0
                  ? `⚠ Faltan ${chequeo.sinColocar} mueble(s) por colocar.`
                  : `⚠ ${chequeo.nProblemas} ajuste(s) por revisar.`}
                {chequeo.puestos > 0 && <> {' '}<strong>{chequeo.puestos} puestos de trabajo</strong> en {chequeo.areaPiso} m²
                  {chequeo.m2Persona ? ` · ${chequeo.m2Persona} m² por persona` : ''}.</>}
              </span>
            </div>
          )}
          {plan.resumen && <p className="ayuda" style={{ marginTop: 4 }}>{plan.resumen}</p>}

          {/* 🐛 La tarjeta se contradecía a sí misma: arriba "⚠ Faltan 8 mueble(s)"
              y abajo "✓ Todas las piezas colocadas · 36 de 36". La revisión se
              hizo cuando había 36 piezas; después se agregaron más y nadie la
              volvió a correr. Si la cuenta viva no coincide con la guardada, la
              revisión está VENCIDA — y eso se dice, no se esconde. */}
          {plan.auditoria?.length > 0 && (
            <div className="voni-audit no-imprimir">
              <div className="voni-audit-t">
                {vencida ? 'Voni revisó ANTES de que cambiaras el proyecto:' : 'Voni revisó:'}
              </div>
              {vencida && (
                <p className="ayuda" style={{ margin: '2px 0 6px' }}>
                  El proyecto cambió después de esta revisión, así que ya no vale.
                  Toca <strong>“Que lo acomode Voni otra vez”</strong> para que la vuelva a hacer.
                </p>
              )}
              <div className="voni-audit-grid" style={vencida ? { opacity: 0.45 } : undefined}>
                {plan.auditoria.map((a, k) => (
                  <span className={`voni-check ${vencida ? 'warn' : (a.ok ? 'ok' : 'warn')}`} key={k}>
                    <b>{vencida ? '·' : (a.ok ? '✓' : '⚠')}</b> {a.check}{a.detalle ? <em> · {a.detalle}</em> : null}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Toggle planta / 3D */}
          <div className="fila-botones no-imprimir" style={{ gap: 8, marginTop: 8 }}>
            <button className={`boton ${modo === 'planta' ? 'primario' : 'fantasma'}`} style={{ minHeight: 42 }} onClick={() => setModo('planta')}>Planta</button>
            <button className={`boton ${aMano ? 'tinta' : 'fantasma'}`} style={{ minHeight: 42 }}
              onClick={() => { setAMano((v) => !v); setModo('planta'); setEnLaMano(null); setSelPieza(null); }}>
              {aMano ? 'Terminar de acomodar' : 'Acomodar a mano'}
            </button>
            <button className={`boton ${modo === 'iso' ? 'primario' : 'fantasma'}`} style={{ minHeight: 42 }} onClick={() => setModo('iso')}>Vista 3D</button>
            <button className="boton" style={{ minHeight: 42 }} disabled={generandoReal || !plan} onClick={vistaRealista}>
              {generandoReal ? 'Generando…' : realista ? 'Volver a generar' : 'Vista realista (IA)'}
            </button>
            {onGuardarAcomodo && !guardado && <button className="boton" style={{ minHeight: 42, marginLeft: 'auto' }} onClick={guardarEnPropuesta}>Guardar en la propuesta</button>}
            {guardado && <button className="boton primario" style={{ minHeight: 42, marginLeft: 'auto' }} onClick={() => onIr('cotizacion')}>Ver cotización con el acomodo →</button>}
          </div>
          {guardado && <div className="ayuda verde no-imprimir" style={{ marginTop: 6 }}>✓ Guardado. Ya aparece en el PDF de la propuesta.</div>}

          <PlanoAcomodo areas={areasMM} plan={plan} byId={byId} modo={modo}
            editable={aMano && modo === 'planta'} sel={selPieza}
            onTocarPieza={(id) => { setSelPieza(id); setSelEl(null); setEnLaMano(null); }}
            onSoltarEn={soltarEn}
            herramienta={herramienta} selEl={selEl}
            onGirar={girar} onQuitar={quitar}
            onPonerElemento={ponerElemento}
            onTocarElemento={(id) => { setSelEl(id); setSelPieza(null); setEnLaMano(null); }}
            onMoverElemento={moverElemento}
            onGirarElemento={girarElemento} onQuitarElemento={quitarElemento} />

          {aMano && modo === 'planta' && (
            <div className="tarjeta" style={{ marginTop: 12 }}>
              <h3 style={{ marginTop: 0 }}>Tus muebles</h3>
              <p className="ayuda columna-texto">
                <strong>Arrastra</strong> los muebles con el dedo o el mouse. Tócalos una vez y te salen ahí mismo
                los botones de <strong>girar</strong> (cada toque, 90°) y <strong>quitar</strong>.
                {pendientes.length === 0 && <> <strong>Ya están todos en el plano.</strong></>}
              </p>
              {/* Los planos reales casi nunca traen puertas dibujadas, y sin
                  puertas el motor no sabe hacia dónde mira un escritorio ni
                  puede medir si se llega caminando. Aquí se ponen a mano. */}
              <div className="fila-botones" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="ayuda"><strong>Poner en el plano:</strong></span>
                {Object.entries(ELEMENTOS).map(([k, d]) => (
                  <button key={k} className={`boton ${herramienta === k ? 'primario' : 'fantasma'}`} style={{ minHeight: 40 }}
                    onClick={() => { setHerramienta(herramienta === k ? null : k); setSelPieza(null); setSelEl(null); }}>
                    {d.et}
                  </button>
                ))}
                {herramienta && <span className="ayuda">Ahora toca el plano donde va.</span>}
              </div>
              {/* Sin esto la paleta abre VACÍA: el auto-acomodo ya puso todo y
                  el proyectista no tenía de dónde tomar. El flujo que pidió
                  Rodrigo —"Voni te pasa las piezas y tú las acomodas"— necesita
                  poder empezar con el plano en blanco. */}
              <div className="fila-botones" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <button className="boton fantasma" style={{ minHeight: 40 }}
                  disabled={!(plan?.colocacion || []).length}
                  onClick={() => { recordar(); editarColocacion(() => []); setSelPieza(null); setEnLaMano(null); setGuardado(false); }}>
                  Vaciar el plano y acomodar yo
                </button>
                <button className="boton fantasma" style={{ minHeight: 40 }} onClick={() => { acomodar(); setSelPieza(null); setEnLaMano(null); }}>
                  Que lo acomode Voni otra vez
                </button>
                <button className="boton fantasma" style={{ minHeight: 40 }} disabled={!hayQueDeshacer} onClick={deshacer}>
                  ↶ Deshacer
                </button>
                <span className="ayuda">{(plan?.colocacion || []).length} en el plano · {pendientes.length} por poner</span>
              </div>
              {selPieza && (
                <div className="fila-botones" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span className="ayuda">Seleccionado: <strong>{byId[selPieza]?.nombre}</strong> · los botones están sobre el mueble</span>
                </div>
              )}
              {/* AGRUPADA POR PRODUCTO, CON SU CUENTA. Rodrigo, acomodando a mano:
                  "deberían salir los muebles que pediste... si pides 6, que salga
                  escritorio Eclipse ×6, y como vas colocando va bajando; ejemplo
                  muevo uno y ya sale ×5, para que no puedas pasarte de los que
                  pediste". Antes se pintaba UNA TARJETA POR PIEZA: 44 tarjetas de
                  sillas idénticas, imposible de usar y sin forma de saber cuántas
                  te faltan de cada cosa. */}
              {/* Rodrigo: "en caso que quieras agregar más, que salga un botón que
                  diga agregar otro producto". La paleta sólo tiene lo que ya se
                  cotizó —eso es a propósito, para no pasarte de lo que pediste—
                  así que para meter algo nuevo hay que ir por él al catálogo. */}
              {onIr && (
                <div className="fila-botones" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <button className="boton fantasma" style={{ minHeight: 44 }} onClick={() => onIr('banco')}>
                    + Agregar otro producto
                  </button>
                  <span className="ayuda" style={{ display: 'inline' }}>
                    Aquí sólo salen los muebles que ya cotizaste, para que no te pases de la cuenta.
                  </span>
                </div>
              )}
              <div className="paleta">
                {agrupadas.map((g) => {
                  const p = g.muestra;
                  const img = p.ruta && p.productoId ? imagenProducto(p.ruta, p.productoId) : null;
                  const enMano = g.ids.includes(enLaMano);
                  return (
                    <button key={g.clave} className={`paleta-item ${enMano ? 'on' : ''}`}
                      onClick={() => { setEnLaMano(g.ids[0]); setSelPieza(null); }}>
                      {img ? <img src={img} alt="" loading="lazy" />
                        : <span className={`paleta-glifo tipo-${p.tipo}`} aria-hidden="true">{GLIFO[p.tipo] || '▭'}</span>}
                      <span className="paleta-n">{g.ids.length}</span>
                      <span className="paleta-t">{p.nombre}</span>
                      <span className="ayuda gris">{(p.w / 1000).toFixed(2)} × {(p.d / 1000).toFixed(2)} m</span>
                    </button>
                  );
                })}
              </div>
              {enLaMano && <div className="alerta verde" style={{ marginTop: 10 }}><span className="texto">Ahora toca el plano donde va <strong>{byId[enLaMano]?.nombre}</strong>.</span></div>}
            </div>
          )}
          {/* Copia OCULTA del isométrico sin etiquetas ni rejilla: es la que se
              le manda a Gemini. Si se le manda la visible, el modelo copia el
              texto del piso dentro de la foto. */}
          <div ref={isoLimpioRef} style={{ position: 'absolute', left: -99999, top: 0, width: 1280 }} aria-hidden="true">
            <PlanoAcomodo areas={areasMM} plan={plan} byId={byId} modo="iso" limpio />
          </div>
          {/* Y una copia oculta POR CUARTO: de ahí sale el dibujo que se le manda
              al modelo para que la escena sea de ESE cuarto y no de una oficina
              genérica. Cada una lleva sólo su área y sólo sus muebles. */}
          {escenas.map((esc) => (
            <div key={esc.areaIndex} aria-hidden="true"
              ref={(n) => { if (n) escenasRef.current[esc.areaIndex] = n; }}
              style={{ position: 'absolute', left: -99999, top: 0, width: 1024 }}>
              <PlanoAcomodo areas={esc.recorte.areas} plan={esc.recorte.plan} byId={byId} modo="iso" limpio />
            </div>
          ))}
          {realista && (
            <div style={{ marginTop: 12 }}>
              <img src={realista} alt="Vista realista del acomodo" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--linea)' }} />
              <div className="ayuda gris">Generada con IA a partir de tu acomodo: respeta cuántos muebles hay y dónde van.</div>
            </div>
          )}

          {/* UNA FOTO POR CUARTO — lo que pidió Rodrigo */}
          {escenas.length > 0 && (
            <div className="tarjeta no-imprimir" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong>Cómo se vería cada área</strong>
                <span className="ayuda" style={{ display: 'inline' }}>
                  · una foto por cuarto, con tus muebles y tu acomodo
                </span>
              </div>
              <p className="ayuda columna-texto" style={{ marginTop: 4 }}>
                A cada imagen se le manda el dibujo de ese cuarto, los renders reales de los muebles que
                pusiste ahí y su línea. Por eso sale tu proyecto y no una oficina cualquiera.
              </p>
              <div className="fila-botones" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="boton primario" style={{ minHeight: 44 }}
                  disabled={genEscena != null} onClick={generarTodasLasEscenas}>
                  {genEscena != null
                    ? `Generando ${escenas.find((e) => e.areaIndex === genEscena)?.nombre || ''}…`
                    : Object.keys(imgEscena).length ? 'Volver a generar' : (escenas.length === 1 ? 'Generar la imagen del área' : `Generar las ${escenas.length} áreas`)}
                </button>
                {Object.keys(imgEscena).length > 0 && onGuardarAcomodo && (
                  <button className="boton" style={{ minHeight: 44 }}
                    onClick={() => { onGuardarAcomodo({ areas: areasMM, plan, escenas: escenas.map((e) => ({ nombre: e.nombre, m2: e.m2, img: imgEscena[e.areaIndex] || null })).filter((e) => e.img) }); setGuardado(true); }}>
                    Guardar en la propuesta
                  </button>
                )}
              </div>
              {errEscena && <div className="alerta roja" style={{ marginTop: 8 }}><span className="texto">{errEscena}</span></div>}
              <div className="escenas-grid" style={{ marginTop: 10 }}>
                {escenas.map((esc) => (
                  <figure key={esc.areaIndex} style={{ margin: 0 }}>
                    {imgEscena[esc.areaIndex]
                      ? <img src={imgEscena[esc.areaIndex]} alt={`Vista de ${esc.nombre}`}
                          style={{ width: '100%', borderRadius: 12, border: '1px solid var(--linea)', display: 'block' }} />
                      : <div style={{ width: '100%', aspectRatio: '3 / 2', borderRadius: 12, border: '1px dashed var(--linea)', display: 'grid', placeItems: 'center', background: 'var(--papel)' }}>
                          <span className="ayuda">{genEscena === esc.areaIndex ? 'Generando…' : 'Sin generar'}</span>
                        </div>}
                    <figcaption className="ayuda" style={{ marginTop: 4 }}>
                      <strong>{esc.nombre}</strong> · {esc.m2} m² · {esc.piezas.reduce((n, p) => n + p.cantidad, 0)} muebles
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}

          <div className="plano-leyenda">
            {usados.map((t) => (
              <span className="leg" key={t}><span className="leg-color" style={{ background: TIPOS[t].color }} />{TIPOS[t].label}</span>
            ))}
          </div>

          {chequeo && !chequeo.ok && <ul className="lista-ia">{chequeo.problemas.map((p, i) => <li key={i}>{p}</li>)}</ul>}
          {plan.notas?.length > 0 && <div className="ayuda gris" style={{ marginTop: 8 }}><strong>Notas:</strong> {plan.notas.join(' · ')}</div>}
          <div className="ayuda gris" style={{ marginTop: 8, fontSize: 12 }}>Plano esquemático a escala. La IA propone; el sistema verifica bordes y traslapes.</div>
        </div>
      )}
    </div>
  );
}
