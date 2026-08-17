import { describe, it, expect } from 'vitest';
import { huellaMP, mpCambio, paraGuardar, textoDe, referenciasParaVoni, referenciasTexto } from './cotizaciones.js';

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

  it('calcula total y piezas', () => {
    const f = paraGuardar(estado, 'rodrigo@vonhaucke.mx');
    expect(f.total).toBe(2 * 17600 + 12 * 5210);
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
