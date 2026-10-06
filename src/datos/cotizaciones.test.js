import { describe, it, expect } from 'vitest';
import { huellaMP, mpCambio, paraGuardar, textoDe, referenciasParaVoni, referenciasTexto } from './cotizaciones.js';
import { problemasDeEmision } from './senales.js';

const insumos = { a: { id: 'a', precio: 100 }, b: { id: 'b', precio: 250.5 } };
const insumosOtro = { a: { id: 'a', precio: 110 }, b: { id: 'b', precio: 250.5 } };

describe('huella de la materia prima', () => {
  it('la misma lista da la misma huella, sin importar el orden', () => {
    const alReves = { b: insumos.b, a: insumos.a };
    expect(huellaMP(insumos)).toBe(huellaMP(alReves));
  });

  it('si cambia UN precio, cambia la huella', () => {
    expect(huellaMP(insumos)).not.toBe(huellaMP(insumosOtro));
  });

  it('funciona igual con arreglo que con mapa', () => {
    expect(huellaMP(Object.values(insumos))).toBe(huellaMP(insumos));
  });

  it('sin insumos devuelve vacío en vez de inventar una huella', () => {
    expect(huellaMP(null)).toBe('');
    expect(huellaMP({})).toBe('');
  });

  // Audit 2026-10-01: la huella ya no es solo id:precio. Un cambio de unidad,
  // merma o formato mueve el costo real igual que el precio, y la huella lo capta.
  it('un cambio de UNIDAD mueve la huella aunque el precio sea el mismo', () => {
    const porHoja = { a: { id: 'a', precio: 100, unidad: 'hoja' } };
    const porM2 = { a: { id: 'a', precio: 100, unidad: 'm2' } };
    expect(huellaMP(porHoja)).not.toBe(huellaMP(porM2));
  });

  it('un cambio de MERMA de corte mueve la huella', () => {
    const m4 = { a: { id: 'a', precio: 100, mermaCorte: 4 } };
    const m8 = { a: { id: 'a', precio: 100, mermaCorte: 8 } };
    expect(huellaMP(m4)).not.toBe(huellaMP(m8));
  });

  it('un cambio de PARÁMETRO de costo (tipo de cambio) mueve la huella', () => {
    expect(huellaMP(insumos, { tipoCambio: 17.5 })).not.toBe(huellaMP(insumos, { tipoCambio: 20 }));
  });
});

describe('¿cambió la materia prima desde que se cotizó?', () => {
  it('lo detecta', () => {
    const cot = { huella_mp: huellaMP(insumos) };
    expect(mpCambio(cot, insumos)).toBe(false);
    expect(mpCambio(cot, insumosOtro)).toBe(true);
  });

  it('si la cotización no trae huella NO afirma que cambió: devuelve null', () => {
    // Es la diferencia entre "sé que cambió" y "no sé". Decir que cambió cuando
    // no se sabe manda al vendedor a recotizar de más.
    expect(mpCambio({}, insumos)).toBe(null);
  });

  it('una huella de FORMATO VIEJO no es comparable: devuelve null, no "cambió"', () => {
    // Audit 2026-10-01: al enriquecer la huella no se puede comparar una vieja
    // (mp…) contra una nueva (mp2:…) — sería una falsa alarma para TODO el archivo
    // histórico. Se responde "no se sabe", nunca se recalcula a ciegas.
    const vieja = { huella_mp: 'mp1a2b3c-2' };
    expect(mpCambio(vieja, insumos)).toBe(null);
  });
});

describe('lo que se guarda', () => {
  const estado = {
    insumos,
    cotizacion: {
      folio: '2608-001', cliente: 'Tradeco', descuentoPct: 15,
      partidas: [
        { id: 'p1', nombre: 'Banca doble App LT', cantidad: 2, precioUnitario: 17600 },
        { id: 'p2', nombre: 'Silla WIN', cantidad: 12, precioUnitario: 5210 },
      ],
    },
  };

  it('guarda el total EMITIDO (con descuento e IVA), no la suma cruda de renglones', () => {
    const f = paraGuardar(estado, 'rodrigo@vonhaucke.mx');
    // Suma de renglones 97,720 · −15% descuento → 83,062 subtotal · +16% IVA
    // → 96,352 redondeado. ANTES aquí se guardaba 97,720 —la suma sin descuento
    // ni IVA—, así que el número del Archivo NO era el que el cliente firmaba.
    // Este test codificaba ese bug; ahora exige el total emitido real. FIX-05.
    expect(f.total).toBe(96351.92);
    expect(f.total).not.toBe(2 * 17600 + 12 * 5210); // ya no es la suma cruda
    expect(f.totales.total).toBe(96352);             // el desglose cuadra con el total
    expect(f.piezas).toBe(14);
    expect(f.usuario).toBe('rodrigo@vonhaucke.mx');
  });

  it('guarda la huella de la MP con la que se costeó', () => {
    expect(paraGuardar(estado).huella_mp).toBe(huellaMP(insumos));
  });

  it('se puede buscar por cliente, por folio y por el nombre del mueble', () => {
    const t = textoDe(paraGuardar(estado));
    expect(t).toContain('tradeco');
    expect(t).toContain('2608-001');
    expect(t).toContain('banca doble app lt');
  });
});

describe('lo que Voni usa como referencia', () => {
  const cots = [
    { cliente: 'Tradeco', actualizado: '2026-08-01', huella_mp: huellaMP(insumos),
      partidas: [{ nombre: 'Banca doble App LT 1.20 · 6u', precioUnitario: 17600, cantidad: 2 }] },
    { cliente: 'Mixue', actualizado: '2026-06-26', huella_mp: huellaMP(insumosOtro),
      partidas: [{ nombre: 'Mesa de juntas 2.40', precioUnitario: 16408, cantidad: 1 },
                 { nombre: 'Banca doble App LT 1.20 · 6u', precioUnitario: 17000, cantidad: 4 }] },
  ];

  it('se queda con el precio MÁS RECIENTE de cada mueble', () => {
    const r = referenciasParaVoni(cots, insumos);
    const banca = r.find((x) => /Banca doble/.test(x.nombre));
    expect(banca.precio).toBe(17600);       // el de agosto, no el de junio
    expect(banca.cliente).toBe('Tradeco');
  });

  it('marca las que se cotizaron con OTRA materia prima', () => {
    const r = referenciasParaVoni(cots, insumos);
    expect(r.find((x) => /Mesa de juntas/.test(x.nombre)).mpCambio).toBe(true);
    expect(r.find((x) => /Banca doble/.test(x.nombre)).mpCambio).toBe(false);
  });

  it('el texto para el prompt avisa cuando la MP cambió', () => {
    const t = referenciasTexto(referenciasParaVoni(cots, insumos));
    expect(t.find((x) => /Mesa de juntas/.test(x))).toMatch(/materia prima cambió/);
    expect(t.find((x) => /Banca doble/.test(x))).not.toMatch(/materia prima cambió/);
  });

  it('respeta el tope para no reventar el prompt', () => {
    const muchas = [{ actualizado: '2026-08-01', huella_mp: huellaMP(insumos),
      partidas: Array.from({ length: 200 }, (_, i) => ({ nombre: `Mueble ${i}`, precioUnitario: 100 + i, cantidad: 1 })) }];
    expect(referenciasParaVoni(muchas, insumos, 40).length).toBeLessThanOrEqual(40);
  });
});

// Audit 2026-10-01: el bloqueo por costeo incompleto DEBE sobrevivir guardar→recuperar
// (el borrador se guarda, pero no se puede emitir hasta asignar material). Esto prueba
// la persistencia sin depender de subir un plano real.
describe('el bloqueo por material inexistente sobrevive guardar y recuperar', () => {
  const estadoBorrador = {
    insumos,
    cotizacion: {
      cliente: 'Prueba', estadoComercial: 'borrador',
      partidas: [{
        id: 'p1', nombre: 'Exhibidor Alpura', cantidad: 1, precioUnitario: 20000,
        piezasSinMaterial: 1, nombresSinMaterial: ['Acometida'],
      }],
    },
  };

  it('se guarda el borrador CON el rastro de las piezas sin material', () => {
    const guardado = paraGuardar(estadoBorrador, 'rodrigo@vonhaucke.mx');
    expect(guardado.estado).toBe('borrador');          // el borrador SÍ se guarda
    expect(guardado.partidas[0].piezasSinMaterial).toBe(1);
    expect(guardado.partidas[0].nombresSinMaterial).toEqual(['Acometida']);
  });

  it('al recuperarlo sigue bloqueada la emisión', () => {
    const guardado = paraGuardar(estadoBorrador, 'rodrigo@vonhaucke.mx');
    // Recuperar = cargar las partidas tal cual (App.jsx: `partidas: c.partidas || []`).
    const recuperado = guardado.partidas;
    const probs = problemasDeEmision(recuperado);
    expect(probs.length).toBe(1);
    expect(probs[0]).toContain('sin material');
  });

  it('al asignar un material válido se desbloquea', () => {
    // Asignado el material, el motor ya no reporta ignorados (piezasSinMaterial 0).
    const corregido = [{ id: 'p1', nombre: 'Exhibidor Alpura', cantidad: 1, precioUnitario: 20000, piezasSinMaterial: 0 }];
    expect(problemasDeEmision(corregido)).toEqual([]);
  });
});
