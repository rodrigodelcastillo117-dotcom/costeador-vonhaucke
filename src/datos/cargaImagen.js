// ============================================================================
//  CARGA DE IMAGEN / PLANO DEL USUARIO · un solo flujo para Costear y Cocrear (N-04).
//  Antes vivía dentro de AsistenteEspecial.jsx; Cocrear no tenía cómo subir una imagen de
//  referencia. Ahora ambos usan ESTAS funciones (no se duplica la lógica):
//   - reducirImagen: máx `lado` px → base64 JPEG (payload chico, más barato para la IA).
//   - archivoABase64: un PDF va TAL CUAL (la IA lo lee como documento; rasterizar pierde cotas).
//   - esPDF / validarArchivoImagen: qué se acepta y con qué tamaño.
//  Sólo navegador (Image/canvas/FileReader). No sube nada: la persistencia va por
//  imagenStorage.js (Storage, nunca base64 en el estado).
// ============================================================================

export const MAX_MB_ARCHIVO = 50; // el PDF se lee local y a la IA se manda SÓLO una hoja (chica)

export const esPDF = (file) => file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');
export const esImagen = (file) => /^image\//.test(file?.type || '') || /\.(png|jpe?g|webp|gif|heic)$/i.test(file?.name || '');

/** null si el archivo se puede usar; si no, el motivo en palabras (para mostrarlo tal cual). */
export function validarArchivoImagen(file, { aceptaPdf = true, maxMB = MAX_MB_ARCHIVO } = {}) {
  if (!file) return 'No se eligió ningún archivo.';
  if (file.size > maxMB * 1024 * 1024) {
    return `El archivo pesa ${(file.size / 1048576).toFixed(0)} MB (máximo ${maxMB} MB). Comprímelo o sube la hoja del mueble como imagen.`;
  }
  if (esPDF(file)) return aceptaPdf ? null : 'Aquí sólo se aceptan imágenes (JPG, PNG o WebP).';
  if (!esImagen(file)) return 'Formato no reconocido: sube una imagen (JPG, PNG o WebP)' + (aceptaPdf ? ' o un PDF.' : '.');
  return null;
}

// Reduce una imagen a máx `lado` px y la devuelve como base64 JPEG (payload chico + más barato)
export function reducirImagen(file, lado = 1600) {
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
export function archivoABase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    fr.readAsDataURL(file);
  });
}
