// ============================================================================
//  LEER UN PLANO DESDE UN ARCHIVO  ·  un solo lugar.
//
//  ⚠️ POR QUÉ EXISTE (2026-08-17). Esto vivía DENTRO de `Acomodo`, que es el
//  paso 3. Como el paso 1 no tenía cómo leer un plano, subir el PDF te
//  empujaba al 3 "de paso" y el paso 2 —los muebles— se lo saltaba.
//  Rodrigo, tres veces: *"me sigue mandando al paso 3, nunca he llegado al 2"*,
//  *"debería ser paso 1, paso 2, paso 3, paso 4. No 1, 3, 4. No entiendooo"*.
//  Tenía razón: el orden del producto no puede depender de en qué componente
//  quedó escrita una función. Aquí queda suelta y la usan los dos.
// ============================================================================
import { leerPlano } from '../nube.js';
import { areasDeLectura, revisarAreas } from './planoLeido.js';
import { programaDelPlano } from './programaDelPlano.js';
import { observedProgramDeLectura } from './floorPlanReader.js';

const archivoABase64 = (file) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result).split(',')[1]);
  fr.onerror = reject;
  fr.readAsDataURL(file);
});

// Las fotos de plano llegan enormes del celular; se bajan a 1600 px antes de
// mandarlas. Un PDF va tal cual: rasterizarlo perdería las cotas.
const imagenABase64 = (file, max = 1600) => new Promise((resolve, reject) => {
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

export const esCAD = (file) => /\.(dwg|dxf)$/i.test(file?.name || '');
export const MAX_PLANO_MB = 30;
// ⚠️ TIMEOUT de lectura de plano. Era 60 s y se observó en PROD una lectura real
// que tardó 64.841 s → el cliente abortaba una lectura que el servidor SÍ iba a
// completar (ChatGPT #1). Leer un PDF de plano con visión (Gemini) es pesado;
// se sube a 180 s para dar holgura real sin colgar indefinidamente.
export const TIMEOUT_LECTURA_MS = 180000;
// Carrera con timeout que SÍ limpia su timer y, si se le pasa un AbortController,
// ABORTA la petición al vencer (ChatGPT P0-3: Promise.race sola deja viva la red).
// Exportada para prueba determinista con fake timers (delayed-success / timeout).
export function conTimeout(promesa, ms = TIMEOUT_LECTURA_MS, controller = null) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => {
      try { controller?.abort(); } catch (e) { /* noop */ }
      reject(new Error('La lectura del plano tardó demasiado (más de 3 minutos). Intenta otra vez o sube una captura de la hoja principal.'));
    }, ms);
  });
  return Promise.race([promesa, timeout]).finally(() => clearTimeout(t));
}

/**
 * Lee el plano de un archivo y devuelve las áreas listas para la app.
 * @returns { ok, areas, nota, error }   areas en METROS (como `areasDeLectura`)
 */
export async function leerPlanoDeArchivo(file) {
  if (!file) return { ok: false, error: 'No llegó ningún archivo.' };
  // AutoCAD no se lee: quien mira el plano es un modelo que VE la hoja, y un
  // .dwg es binario. Decirlo es mejor que fallar como si el plano estuviera mal.
  if (file.size > MAX_PLANO_MB * 1024 * 1024) {
    return { ok: false, error: `El archivo pesa ${(file.size / 1048576).toFixed(0)} MB. Para que la lectura sea estable, usa un PDF de máximo ${MAX_PLANO_MB} MB o sube la hoja principal como imagen.` };
  }
  if (esCAD(file)) {
    return { ok: false, error: 'Todavía no leo archivos de AutoCAD (.dwg / .dxf). '
      + 'Expórtalo a PDF desde AutoCAD (Imprimir → PDF) o mándame una captura de pantalla del '
      + 'plano: eso sí lo leo, y con las cotas a la vista sale igual de exacto.' };
  }
  try {
    const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const b64 = esPdf ? await archivoABase64(file) : await imagenABase64(file);
    // AbortController real: al vencer el timeout se aborta la petición (donde el
    // cliente lo soporte) en vez de dejarla viva (ChatGPT P0-3).
    const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const r = await conTimeout(
      leerPlano(b64, esPdf ? 'application/pdf' : 'image/jpeg', undefined, { signal: controller?.signal }),
      TIMEOUT_LECTURA_MS,
      controller,
    );
    if (!r || !r.ok) return { ok: false, error: r?.error || 'No se pudo leer el plano.' };
    const lec = r.lectura;
    const { areas } = areasDeLectura(lec);
    const notas = [];
    if (!lec.tieneCotas) notas.push('El plano no traía cotas: las medidas son estimadas, revísalas.');
    // La revisión va ANTES de las notas del modelo: si el levantamiento no cuadra
    // como planta, el proyectista tiene que saberlo, no descubrirlo al final.
    const problemas = revisarAreas(lec);
    if (problemas.length) notas.push('Revisa esto:', ...problemas.map((p) => '· ' + p));
    if (!areas.length) notas.push('No pude reconocer los cuartos. Sube el plano en mejor calidad o dibújalo.');
    if (lec.notas?.length) notas.push(...lec.notas);
    // ChatGPT #5: CONSERVAR la procedencia completa hasta VONI/"Esto entendí".
    // Antes se devolvían sólo `areas`+`nota` y se tiraban lectura/floorSpec/page/
    // request_id. Aquí se conservan.
    //
    // ChatGPT P0-R9-1 — AUTORIDAD: el observed_program que gobierna es el que el
    // SERVIDOR revalidó (r.observed_program / r.floorSpec.observed_program), NUNCA
    // el crudo de la IA (r.lectura.observed_program). El servidor ya normalizó,
    // mapeó confianza textual→número y marcó issues; el cliente consume ESO tal cual.
    //
    // ChatGPT P0-R9-4 — ESTADO: si el lector REAL entregó mobiliario, lo observado
    // GOBIERNA (no se reconstruye desde áreas). Estados:
    //   · PRESENT_VALID          → observado válido gobierna.
    //   · PRESENT_REVIEW_REQUIRED → observado con pendientes: NO inventar desde
    //                               áreas; enseñar pendientes y pedir confirmación.
    //   · ABSENT                 → el lector no dio mobiliario → heurística legacy OK.
    const serverObserved = Array.isArray(r.observed_program) ? r.observed_program
      : (Array.isArray(r.floorSpec?.observed_program) ? r.floorSpec.observed_program : null);
    const observedValidation = r.floorSpec?.observed_validation || null;
    let observedProgram = [];
    let observedSource = 'none';
    let observedState = 'ABSENT';
    try {
      if (Array.isArray(serverObserved) && serverObserved.length) {
        // AUTORIDAD servidor: ya viene saneado; no se re-mapea el crudo de la IA.
        observedProgram = serverObserved;
        observedSource = 'server';
        observedState = (observedValidation?.state === 'REVIEW_REQUIRED') ? 'PRESENT_REVIEW_REQUIRED' : 'PRESENT_VALID';
      } else {
        // El lector no entregó mobiliario → heurística por áreas (NO autoritativa).
        observedProgram = observedProgramDeLectura(programaDelPlano(areas));
        observedSource = observedProgram.length ? 'heuristic' : 'none';
        observedState = 'ABSENT';
      }
    } catch { /* best-effort */ observedProgram = []; observedSource = 'none'; observedState = 'ABSENT'; }
    return {
      ok: true,
      areas,
      nota: notas.join(' '),
      lectura: lec,                       // cotas/evidencia/page/notas del lector
      floorSpec: r.floorSpec || null,     // validación geométrica determinista del servidor
      request_id: r.request_id || null,   // trazabilidad de la llamada
      observed_program: observedProgram,  // programa observado SANEADO por el servidor (o heurística si ABSENT)
      observed_source: observedSource,    // 'server' | 'heuristic' | 'none'
      observed_state: observedState,      // 'PRESENT_VALID' | 'PRESENT_REVIEW_REQUIRED' | 'ABSENT'
      observed_validation: observedValidation,  // {state, issues, warnings, metrics} del servidor
    };
  } catch (e) {
    // Leer un plano es tarea central: si falla, hay que dejar rastro para
    // diagnosticar (antes se tragaba `e` y el mensaje genérico no decía nada).
    console.error('[leerPlanoDeArchivo] falló:', e);
    const detalle = e?.message ? ` (${e.message})` : '';
    return { ok: false, error: `No se pudo procesar el archivo${detalle}. Verifica que sea un PDF o imagen legible del plano, o dibújalo.` };
  }
}
