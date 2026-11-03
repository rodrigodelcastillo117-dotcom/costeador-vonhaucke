// Regresión del bug real (plano TELCEL PDF nativo): el pase de revisión/respuesta
// mandaba el base64 del PDF como `imagenes` (bloques image/jpeg) → el proveedor lo
// rechaza (invalid_request_error). Debe ir como DOCUMENTO cuando la fuente es PDF.
import { describe, it, expect } from 'vitest';
import { cuerpoVisionRevision } from '../nube.js';

describe('cuerpoVisionRevision · PDF nativo vs imágenes rasterizadas', () => {
  it('un PDF nativo (base64 empieza con JVBER = %PDF) → DOCUMENTO, no imagen', () => {
    const r = cuerpoVisionRevision(['JVBERi0xLjQKJσ...']); // '%PDF-1.4' en base64
    expect(r.image).toBeTruthy();
    expect(r.mediaType).toBe('application/pdf');
    expect(r.imagenes).toBeUndefined();
  });

  it('una sola imagen rasterizada (JPEG, /9j/) → sigue yendo como `imagenes`', () => {
    const r = cuerpoVisionRevision(['/9j/4AAQSkZJRg==']);
    expect(r.imagenes).toEqual(['/9j/4AAQSkZJRg==']);
    expect(r.image).toBeUndefined();
  });

  it('varias hojas rasterizadas → `imagenes` con todas', () => {
    const r = cuerpoVisionRevision(['/9j/aaa', '/9j/bbb', '/9j/ccc']);
    expect(r.imagenes).toHaveLength(3);
    expect(r.image).toBeUndefined();
  });

  it('vacío / no-array → `imagenes` vacío (no revienta)', () => {
    expect(cuerpoVisionRevision([]).imagenes).toEqual([]);
    expect(cuerpoVisionRevision(null).imagenes).toEqual([]);
    expect(cuerpoVisionRevision([null, '']).imagenes).toEqual([]);
  });
});
