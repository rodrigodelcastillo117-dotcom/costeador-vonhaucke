import { describe, it, expect } from 'vitest';
import { renderIA, imagenProducto, imagenPartida, fotoProducto, heroLinea } from './imagenes.js';

// Hallazgo de Edgar Serna: las imágenes de Eclipse "no corresponden" porque 5
// de sus 11 productos nunca tuvieron foto real — el render se fabricó desde
// texto usando una foto de OTRO mueble de la línea como referencia de estilo.
// renderIA() debe negarse a devolver esos renders fabricados.
describe('renderIA(): solo cuenta el render con foto real propia detrás', () => {
  it('devuelve el render cuando el producto SÍ tiene foto real (eclipse/escritorio)', () => {
    expect(fotoProducto('eclipse', 'escritorio')).toBeTruthy();
    expect(renderIA('eclipse', 'escritorio')).toBe(
      'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/render-ia/eclipse/escritorio.jpg',
    );
  });

  it('niega el render fabricado cuando el producto NO tiene foto real (eclipse/credenza)', () => {
    expect(fotoProducto('eclipse', 'credenza')).toBeNull();
    expect(renderIA('eclipse', 'credenza')).toBeNull();
  });

  it('imagenProducto() cae a null (no a un render inventado) para eclipse/credenza', () => {
    expect(imagenProducto('eclipse', 'credenza')).toBeNull();
  });

  it('imagenPartida() cae al hero honesto de la línea, no a la pieza fabricada', () => {
    expect(imagenPartida({ ruta: 'eclipse', productoId: 'credenza' })).toBe(heroLinea('eclipse'));
  });

  it('mismo caso para los otros 4 productos de Eclipse sin foto real', () => {
    for (const prodId of ['credenza_modulable', 'credenza_vertical', 'gaveta', 'mesa_regulable']) {
      expect(renderIA('eclipse', prodId)).toBeNull();
    }
  });
});
