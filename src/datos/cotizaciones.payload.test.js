import { describe,it,expect } from 'vitest';
import { compactarPayloadNube, paraGuardar } from './cotizaciones.js';

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

// Corrección de doc R15: `confirmado_modelo` SÍ persiste DENTRO de la partida cotizada.
// Sobrevive el payload de guardado (compactarPayloadNube no lo elimina). Lo que NO existe
// es una confirmación durable independiente de la partida: si la silla se elimina/reemplaza,
// la decisión se pierde — eso es otra cosa.
describe('persistencia de confirmado_modelo en el payload de guardado',()=>{
  it('paraGuardar conserva confirmado_modelo:true en las partidas',()=>{
    const estado = { cotizacion: { folio:'F-1', partidas:[
      { id:'s1', nombre:'Silla', relation_role:'WORK_SEAT', bancoId:'silla-alpha', cantidad:2, confirmado_modelo:true, precioUnitario:0 },
    ] }, parametros:{} };
    const guardado = paraGuardar(estado, 'tester');
    expect(guardado.partidas[0].confirmado_modelo).toBe(true);
  });
  it('compactarPayloadNube no elimina confirmado_modelo',()=>{
    expect(compactarPayloadNube({ confirmado_modelo:true }).confirmado_modelo).toBe(true);
  });
});
