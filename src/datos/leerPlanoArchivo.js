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
import { areasDeLectura, revisarAreas, resumenLectura } from './planoLeido.js';
import { avisosDeValidacion, problemasDeValidacion, estadoServidor, nivelCombinado, TEXTO_ESTADO_SERVIDOR } from './floorSpecAvisos.js';

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
const conTimeout = (promesa, ms = 60000) => Promise.race([
  promesa,
  new Promise((_, reject) => setTimeout(() => reject(new Error('La lectura del plano tardó demasiado. Intenta otra vez o sube una captura de la hoja principal.')), ms)),
]);

// Vista previa del plano para la pantalla de confirmación: la imagen tal cual, o la
// página 1 del PDF rasterizada (pdfImagen, cargado bajo demanda para no pesar siempre).
async function vistaPrevia(file, esPdf, b64) {
  try {
    if (!esPdf) return `data:${file.type || 'image/jpeg'};base64,${b64}`;
    const { abrirPdf, paginaAImagen } = await import('./pdfImagen.js');
    return await paginaAImagen(await abrirPdf(file), 1, 1400);
  } catch { return ''; }
}

/**
 * Lee el plano de un archivo y devuelve las áreas listas para la app.
 * VH-043: TAMBIÉN devuelve la lectura cruda, el resumen de confianza (con la
 * comprobación de escala) y una vista previa, para que la app pida CONFIRMACIÓN
 * antes de usar nada. Un solo orquestador: lo usan Voni (paso 1) y Acomodo.
 * @returns { ok, areas, lectura, floorSpec, resumen, imagen, nota, error, code, requestId }   areas en METROS
 * VH-064: `resumen.servidor` = { estado PASS|REVIEW_REQUIRED|FAIL|SIN_VALIDACION, texto, requestId } y
 * `resumen.problemas` incluye los avisos deterministas del servidor.
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
    const r = await conTimeout(leerPlano(b64, esPdf ? 'application/pdf' : 'image/jpeg'), 60000);
    if (!r || !r.ok) {
      // VH-064: un FAIL del servidor (422) trae los `issues` concretos; se enseñan.
      const fallas = problemasDeValidacion(r?.floorSpec?.validation);
      const ref = r?.request_id ? ` (ref. ${r.request_id})` : '';
      const error = (r?.error || 'No se pudo leer el plano.') + (fallas.length ? ' ' + fallas.map((p) => '· ' + p).join(' ') : '') + ref;
      return { ok: false, error, code: r?.code, requestId: r?.request_id || null };
    }
    const lec = r.lectura;
    const { areas } = areasDeLectura(lec);
    const local = resumenLectura(lec);
    // VH-064: la validación determinista del SERVIDOR (procedencia MEASURED/ASSUMED,
    // cotas vs envolvente, puertas sin barrido…) entra al resumen. El servidor puede
    // bajar el nivel, nunca subirlo; sin validación no se declara "confiable".
    const validacion = r.floorSpec?.validation;
    const estado = estadoServidor(r.floorSpec);
    const avisos = avisosDeValidacion(validacion);
    const problemas = [...local.problemas, ...avisos.filter((a) => !local.problemas.includes(a))];
    const nivel = nivelCombinado(local.nivel, estado);
    const resumen = {
      ...local, problemas, nProblemas: problemas.length, nivel,
      confiable: nivel === 'alta' && areas.length > 0,
      cotas: !!lec.tieneCotas,
      servidor: { estado, texto: TEXTO_ESTADO_SERVIDOR[estado], requestId: r.request_id || null },
    };
    const notas = [];
    if (!lec.tieneCotas) notas.push('El plano no traía cotas: las medidas son estimadas, revísalas.');
    // La revisión va ANTES de las notas del modelo: si el levantamiento no cuadra
    // como planta, el proyectista tiene que saberlo, no descubrirlo al final.
    if (problemas.length) notas.push('Revisa esto:', ...problemas.map((p) => '· ' + p));
    if (!areas.length) notas.push('No pude reconocer los cuartos. Sube el plano en mejor calidad o dibújalo.');
    if (lec.notas?.length) notas.push(...lec.notas);
    const imagen = await vistaPrevia(file, esPdf, b64);
    return { ok: true, areas, lectura: lec, floorSpec: r.floorSpec || null, resumen, imagen, nota: notas.join(' ') };
  } catch (e) {
    // Leer un plano es tarea central: si falla, hay que dejar rastro para
    // diagnosticar (antes se tragaba `e` y el mensaje genérico no decía nada).
    console.error('[leerPlanoDeArchivo] falló:', e);
    const detalle = e?.message ? ` (${e.message})` : '';
    return { ok: false, error: `No se pudo procesar el archivo${detalle}. Verifica que sea un PDF o imagen legible del plano, o dibújalo.` };
  }
}
