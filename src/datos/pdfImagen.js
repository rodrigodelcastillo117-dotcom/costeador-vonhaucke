// ============================================================================
//  PDF → IMAGEN  ·  para costear PLANOS multipágina de raíz.
//
//  Los planos reales llegan en PDF grandes y de varias páginas (ej. 26 MB, 9
//  hojas). Mandar eso crudo a la IA falla (demasiado de un jalón). Pero una
//  HOJA sola, como imagen, la IA la lee perfecto. Esto abre el PDF en el
//  navegador, deja elegir la hoja del mueble y la rasteriza a una imagen chica.
//
//  Toda la fragilidad de pdf.js vive AQUÍ y detrás de carga diferida: si algo
//  falla, quien llama hace su fallback (mandar el PDF crudo). Nunca rompe la app.
// ============================================================================

let _pdfjs = null;

async function getLib() {
  if (_pdfjs) return _pdfjs;
  // Legacy build = transpilado para navegadores viejos (target es2018 del app).
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  try {
    const w = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = w.default;
  } catch {
    // Si no se pudo fijar el worker, pdf.js intenta su fallback a main-thread.
  }
  _pdfjs = pdfjs;
  return pdfjs;
}

/**
 * Abre un PDF. Devuelve { numPaginas, _doc } o lanza si pdf.js no pudo.
 */
export async function abrirPdf(file) {
  const pdfjs = await getLib();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  return { numPaginas: doc.numPages, _doc: doc };
}

/**
 * Renderiza una página a un data URL JPEG (chico, listo para la IA).
 * @param docWrap  lo que devolvió abrirPdf
 * @param n        número de página (1-based)
 * @param maxPx    lado mayor en px (default 2000; suficiente para leer cotas)
 */
export async function paginaAImagen(docWrap, n, maxPx = 2000) {
  const page = await docWrap._doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const escala = Math.min(maxPx / Math.max(base.width, base.height), 3);
  const vp = page.getViewport({ scale: escala });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d');
  // Fondo blanco: un PDF transparente saldría negro al pasar a JPEG.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return canvas.toDataURL('image/jpeg', 0.85); // data URL completo
}

/**
 * Rasteriza TODAS las hojas a base64 JPEG (sin el prefijo data:), para mandar
 * un plano multipágina (un mismo mueble repartido en varias hojas) a la IA.
 * maxPx algo menor por hoja para que el total no pese de más.
 */
export async function todasLasPaginas(docWrap, maxPx = 1600) {
  const out = [];
  for (let n = 1; n <= docWrap.numPaginas; n++) {
    const dataUrl = await paginaAImagen(docWrap, n, maxPx);
    out.push(dataUrl.split(',')[1]);
  }
  return out;
}
