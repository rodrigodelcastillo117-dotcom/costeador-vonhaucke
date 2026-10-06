import { describe,it,expect } from 'vitest';
import { compactarPayloadNube } from './cotizaciones.js';

describe('compactarPayloadNube',()=>{
  it('elimina data URLs gigantes sin tocar referencias',()=>{
    const big='data:image/png;base64,'+'A'.repeat(250000);
    const x=compactarPayloadNube({nombre:'Recepción',imagen:big,storage_url:'https://example.test/r.png',cantidad:2});
    expect(x.imagen).toBeNull();
    expect(x.storage_url).toBe('https://example.test/r.png');
    expect(x.nombre).toBe('Recepción');
    expect(x.cantidad).toBe(2);
  });
  it('preserva texto largo que no sea binario',()=>{
    const texto='detalle técnico '.repeat(10000);
    expect(compactarPayloadNube({texto}).texto).toBe(texto);
  });
});
