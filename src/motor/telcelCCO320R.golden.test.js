// GOLDEN · TELCEL C-CO-320R (workbook real Von Haucke, 2026-10-02)
// Objetivo: el MOTOR debe producir el costo de materiales a partir de consumo + precio,
// no copiar el subtotal. Fixtures: *_explo_x_id.csv, secciones METAL id_01..id_04.
import { describe, it, expect } from 'vitest';
import { calcular, PARAMETROS_DEFAULT } from './calculo.js';

const CERO = { pm: 0, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0, otros: 0 };
const MODULOS = [
  {
    "id": "id_01",
    "title": "LISTA MATERIALES METAL \"VITRINA HORIZONTAL\"",
    "target": 4483.13,
    "sourceStart": 22,
    "sourceEnd": 30,
    "materials": [
      {
        "sourceRow": 22,
        "sku": "MVLSLA05260402",
        "descripcion": "LAMINA NEGRA HOJA 3 X 10 CALIBRE 18 ACERO 1008 - \"\"LN18310\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2024-05-27 00:00:00",
        "precio": 571.54,
        "consumo": 3.04,
        "costoLinea": 1737.48
      },
      {
        "sourceRow": 23,
        "sku": "MVLSLA05270402",
        "descripcion": "LAMINA NEGRA HOJA 4 X 10 CALIBRE 18 ACERO 1008 - \"\"LN18410\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2024-06-27 00:00:00",
        "precio": 751.14,
        "consumo": 0.88,
        "costoLinea": 661
      },
      {
        "sourceRow": 24,
        "sku": "MVLSLA05270402",
        "descripcion": "LAMINA NEGRA HOJA 4 X 10 CALIBRE 18 ACERO 1008 - \"\"LN18410\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2024-06-27 00:00:00",
        "precio": 751.14,
        "consumo": 0.53,
        "costoLinea": 398.1
      },
      {
        "sourceRow": 25,
        "sku": "MVLSLA05270202",
        "descripcion": "LAMINA NEGRA HOJA 4 X 10 CALIBRE 14 ACERO 1008 - \"\"LN14410\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2024-06-24 00:00:00",
        "precio": 1190.49,
        "consumo": 0.04,
        "costoLinea": 47.62
      },
      {
        "sourceRow": 26,
        "sku": "MVLQPP00000000",
        "descripcion": "PINTURA EN POLVO - \"\"PPH\"\"\"",
        "opcion": "A529",
        "opcionDescripcion": "COLOR METAL BLANCO 9016 549/11340 TELCEL MELEMA",
        "unidad": "Kg",
        "fecha": "2020-07-08 00:00:00",
        "precio": 171.01,
        "consumo": 2.11,
        "costoLinea": 360.83
      },
      {
        "sourceRow": 27,
        "sku": "MVLQPP00000000",
        "descripcion": "PINTURA EN POLVO - \"\"PPH\"\"\"",
        "opcion": "A10",
        "opcionDescripcion": "COLOR METAL RAL 5002 49/42220 SM GL TRIBO (AZUL TELCEL)",
        "unidad": "Kg",
        "fecha": "2018-08-28 00:00:00",
        "precio": 249.58,
        "consumo": 0.21,
        "costoLinea": 52.41
      },
      {
        "sourceRow": 28,
        "sku": "MLEMTM01040000",
        "descripcion": "TIRA DE MADERA DE PINO DE SEGUNDA DE 5 CMS. DE ANCHO X 3/4\" (1.9 CMS) DE ESPESOR, POR 250 CMS. DE LARGO - \"TMP534250\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "pieza",
        "fecha": "2024-05-31 00:00:00",
        "precio": 47.43,
        "consumo": 6.4,
        "costoLinea": 303.55
      },
      {
        "sourceRow": 29,
        "sku": "MLEMTM01050000",
        "descripcion": "TIRA DE MADERA DE PINO DE SEGUNDA DE 10 CMS DE ANCHO X 1 1/4\" (3.2 CMS) DE ESPESOR, POR 250 CMS. DE LARGO - \"TMP10114250\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "pieza",
        "fecha": "2024-07-03 00:00:00",
        "precio": 189.75,
        "consumo": 0.76,
        "costoLinea": 144.21
      },
      {
        "sourceRow": 30,
        "sku": "MLEMTM01060000",
        "descripcion": "TIRA DE MADERA DE PINO DE SEGUNDA DE 10 CMS. DE ANCHO X 3/4\" (1.9 CMS) DE ESPESOR, POR 250 CMS. DE LARGO - \"TMP1034250\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "pieza",
        "fecha": "2024-07-03 00:00:00",
        "precio": 94.87,
        "consumo": 8.2,
        "costoLinea": 777.93
      }
    ],
    "nombre": "Vitrina Horizontal · METAL"
  },
  {
    "id": "id_02",
    "title": "LISTA MATERIALES METAL \"VITRINA TORRE\"",
    "target": 2966.15,
    "sourceStart": 61,
    "sourceEnd": 68,
    "materials": [
      {
        "sourceRow": 61,
        "sku": "MVLSLA05260502",
        "descripcion": "LAMINA NEGRA HOJA 3 X 10 CALIBRE 20 ACERO 1008 - LN20310",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2024-05-27 00:00:00",
        "precio": 428.65,
        "consumo": 1.08,
        "costoLinea": 462.94
      },
      {
        "sourceRow": 62,
        "sku": "MVLSLA05260402",
        "descripcion": "LAMINA NEGRA HOJA 3 X 10 CALIBRE 18 ACERO 1008 - \"\"LN18310\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2024-05-27 00:00:00",
        "precio": 571.54,
        "consumo": 2.564,
        "costoLinea": 1465.43
      },
      {
        "sourceRow": 63,
        "sku": "MVLSLA05260202",
        "descripcion": "LAMINA NEGRA HOJA 3 X 10 CALIBRE 14 ACERO 1008 - LN14310",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2023-12-20 00:00:00",
        "precio": 816.48,
        "consumo": 0.057,
        "costoLinea": 46.54
      },
      {
        "sourceRow": 64,
        "sku": "MVLSTU01080501",
        "descripcion": "TUBULAR INDUSTRIAL CUADRADO 1\"\" CALIBRE 20 PIEZA DE 6000 mm - \"\"TC201\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "pieza",
        "fecha": "2024-05-21 00:00:00",
        "precio": 96.71,
        "consumo": 0.166,
        "costoLinea": 16.05
      },
      {
        "sourceRow": 65,
        "sku": "MVLSLA05270502",
        "descripcion": "LAMINA NEGRA HOJA 4 X 10 CALIBRE 20 ACERO 1008 -- LN20410",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2024-06-24 00:00:00",
        "precio": 571.52,
        "consumo": 0.166,
        "costoLinea": 94.87
      },
      {
        "sourceRow": 66,
        "sku": "MVLMMR050000E7",
        "descripcion": "MADERA PARA EMBALAJE DE 1/2\" (13 mm.) DE ESPESOR, 80 mm. (8 cms.) DE ANCHO Y 2500 mm. (2.50 mts.) DE LARGO - \"ME258EX\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "pieza",
        "fecha": "2018-10-01 00:00:00",
        "precio": 26.5,
        "consumo": 8,
        "costoLinea": 212
      },
      {
        "sourceRow": 67,
        "sku": "MVLQPP00000000",
        "descripcion": "PINTURA EN POLVO - \"\"PPH\"\"\"",
        "opcion": "A10",
        "opcionDescripcion": "COLOR METAL RAL 5002 49/42220 SM GL TRIBO (AZUL TELCEL)",
        "unidad": "Kg",
        "fecha": "2018-08-28 00:00:00",
        "precio": 249.58,
        "consumo": 0.65,
        "costoLinea": 162.23
      },
      {
        "sourceRow": 68,
        "sku": "MVLQPP00000000",
        "descripcion": "PINTURA EN POLVO - \"\"PPH\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Kg",
        "fecha": null,
        "precio": 449.06,
        "consumo": 1.127,
        "costoLinea": 506.09
      }
    ],
    "nombre": "Vitrina Torre · METAL"
  },
  {
    "id": "id_03",
    "title": "LISTA MATERIALES METAL \"VITRINA ISLA\"",
    "target": 3297.84,
    "sourceStart": 106,
    "sourceEnd": 116,
    "materials": [
      {
        "sourceRow": 106,
        "sku": "MVLSLA05280402",
        "descripcion": "LAMINA NEGRA HOJA 4' X 8' CALIBRE 18 ACERO 1008 - \"LN1848\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2017-05-12 00:00:00",
        "precio": 585.51,
        "consumo": 0.6,
        "costoLinea": 351.31
      },
      {
        "sourceRow": 107,
        "sku": "MVLSLA05260402",
        "descripcion": "LAMINA NEGRA HOJA 3 X 10 CALIBRE 18 ACERO 1008 - \"\"LN18310\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2024-05-27 00:00:00",
        "precio": 571.54,
        "consumo": 0.13,
        "costoLinea": 74.3
      },
      {
        "sourceRow": 108,
        "sku": "MVLSTU01080401",
        "descripcion": "TUBULAR INDUSTRIAL CUADRADO 1\" CALIBRE 18 PIEZA DE 6000 mm - TC181",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "pieza",
        "fecha": "2024-06-17 00:00:00",
        "precio": 132.5,
        "consumo": 2.75,
        "costoLinea": 364.38
      },
      {
        "sourceRow": 109,
        "sku": "MPMTLA01030601",
        "descripcion": "LAMINA NEGRA HOJA 4' X 8' CALIBRE 14 ACERO 1008 -- LN4814ACE",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": null,
        "fecha": null,
        "precio": 900.38,
        "consumo": 0.02,
        "costoLinea": 18.01
      },
      {
        "sourceRow": 110,
        "sku": "LN1838",
        "descripcion": "LAMINA NEGRA HOJA 3 X 8 CALIBRE 18 ACERO 1008 - \"\"LN1838\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": null,
        "fecha": null,
        "precio": 722.46,
        "consumo": 0.5,
        "costoLinea": 361.23
      },
      {
        "sourceRow": 111,
        "sku": "MVLSLA05270402",
        "descripcion": "LAMINA NEGRA HOJA 4 X 10 CALIBRE 18 ACERO 1008 - \"\"LN18410\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2024-06-27 00:00:00",
        "precio": 751.14,
        "consumo": 0.09,
        "costoLinea": 67.6
      },
      {
        "sourceRow": 112,
        "sku": "LN2038",
        "descripcion": "LAMINA NEGRA HOJA 3 X 8 CALIBRE 20 ACERO 1008 - \"\"LN2038\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": null,
        "fecha": null,
        "precio": 541.86,
        "consumo": 0.25,
        "costoLinea": 135.47
      },
      {
        "sourceRow": 113,
        "sku": "MVLQPP00000000",
        "descripcion": "PINTURA EN POLVO - \"\"PPH\"\"\"",
        "opcion": "A529",
        "opcionDescripcion": "COLOR METAL BLANCO 9016 549/11340 TELCEL MELEMA",
        "unidad": "Kg",
        "fecha": "2020-07-08 00:00:00",
        "precio": 171.01,
        "consumo": 1.18,
        "costoLinea": 201.79
      },
      {
        "sourceRow": 114,
        "sku": "MLEMTM01040000",
        "descripcion": "TIRA DE MADERA DE PINO DE SEGUNDA DE 5 CMS. DE ANCHO X 3/4\" (1.9 CMS) DE ESPESOR, POR 250 CMS. DE LARGO - \"TMP534250\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "pieza",
        "fecha": "2024-05-31 00:00:00",
        "precio": 47.43,
        "consumo": 9,
        "costoLinea": 426.87
      },
      {
        "sourceRow": 115,
        "sku": "MLEMTM01050000",
        "descripcion": "TIRA DE MADERA DE PINO DE SEGUNDA DE 10 CMS DE ANCHO X 1 1/4\" (3.2 CMS) DE ESPESOR, POR 250 CMS. DE LARGO - \"TMP10114250\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "pieza",
        "fecha": "2024-07-03 00:00:00",
        "precio": 189.75,
        "consumo": 1.07,
        "costoLinea": 203.03
      },
      {
        "sourceRow": 116,
        "sku": "MLEMTM01060000",
        "descripcion": "TIRA DE MADERA DE PINO DE SEGUNDA DE 10 CMS. DE ANCHO X 3/4\" (1.9 CMS) DE ESPESOR, POR 250 CMS. DE LARGO - \"TMP1034250\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "pieza",
        "fecha": "2024-07-03 00:00:00",
        "precio": 94.87,
        "consumo": 11.53,
        "costoLinea": 1093.85
      }
    ],
    "nombre": "Vitrina Isla · METAL"
  },
  {
    "id": "id_04",
    "title": "MODULO DE ALMACENAMIENTO \"METAL\"",
    "target": 3596.14,
    "sourceStart": 154,
    "sourceEnd": 170,
    "materials": [
      {
        "sourceRow": 154,
        "sku": null,
        "descripcion": "LAMINA NEGRA HOJA 3 X 8 CALIBRE 18 ACERO 1008 - \"\"LN1838\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": null,
        "fecha": null,
        "precio": 722.46,
        "consumo": 1,
        "costoLinea": 722.46
      },
      {
        "sourceRow": 155,
        "sku": "MVLSLA05260402",
        "descripcion": "LAMINA NEGRA HOJA 3 X 10 CALIBRE 18 ACERO 1008 - \"\"LN18310\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2024-05-27 00:00:00",
        "precio": 571.54,
        "consumo": 1.62,
        "costoLinea": 925.89
      },
      {
        "sourceRow": 156,
        "sku": "MVLSLA05280402",
        "descripcion": "LAMINA NEGRA HOJA 4' X 8' CALIBRE 18 ACERO 1008 - \"LN1848\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2017-05-12 00:00:00",
        "precio": 585.51,
        "consumo": 0.49,
        "costoLinea": 286.9
      },
      {
        "sourceRow": 157,
        "sku": "MVLSLA05270402",
        "descripcion": "LAMINA NEGRA HOJA 4 X 10 CALIBRE 18 ACERO 1008 - \"\"LN18410\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "Hoja",
        "fecha": "2024-06-27 00:00:00",
        "precio": 751.14,
        "consumo": 1,
        "costoLinea": 751.14
      },
      {
        "sourceRow": 158,
        "sku": "MVLQPP00000000",
        "descripcion": "PINTURA EN POLVO - \"\"PPH\"\"\"",
        "opcion": "A529",
        "opcionDescripcion": "COLOR METAL BLANCO 9016 549/11340 TELCEL MELEMA",
        "unidad": "Kg",
        "fecha": "2020-07-08 00:00:00",
        "precio": 171.01,
        "consumo": 2.15,
        "costoLinea": 367.67
      },
      {
        "sourceRow": 159,
        "sku": "MVLQPP00000000",
        "descripcion": "PINTURA EN POLVO - \"\"PPH\"\"\"",
        "opcion": "A10",
        "opcionDescripcion": "COLOR METAL RAL 5002 49/42220 SM GL TRIBO (AZUL TELCEL)",
        "unidad": "Kg",
        "fecha": "2018-08-28 00:00:00",
        "precio": 249.58,
        "consumo": 0.15,
        "costoLinea": 37.44
      },
      {
        "sourceRow": 160,
        "sku": "MVLABI19000000",
        "descripcion": "BISAGRA BIDIMENSIONAL, MONTAJE SOBREPUESTO, ANGULO DE 110° - \"\"BIBI\"\"\"",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": "pieza",
        "fecha": "2024-03-05 00:00:00",
        "precio": 13.66,
        "consumo": 4,
        "costoLinea": 54.64
      },
      {
        "sourceRow": 161,
        "sku": null,
        "descripcion": "Superficie de trabajo, cubierta MDF 12mm una cara laminado blanco con una cara posterior acabado superficie PVC termo formado cristal White.",
        "opcion": "-",
        "opcionDescripcion": null,
        "unidad": null,
        "fecha": null,
        "precio": 1800,
        "consumo": 0.25,
        "costoLinea": 450
      }
    ],
    "nombre": "Módulo de almacenamiento · METAL"
  }
];

function armar(modulo) {
  const insumos = {};
  const componentes = [];
  for (const m of modulo.materials) {
    const id = `telcel-${modulo.id}-r${m.sourceRow}`; // identidad de fixture, NO SKU comercial inventado
    const esHoja = /^hoja$/i.test(String(m.unidad || '')) || /\bhoja\b/i.test(m.descripcion || '');
    insumos[id] = {
      nombre: m.descripcion,
      seccion: 'otros',
      unidad: m.unidad || '',
      precio: m.precio,
      skuWorkbook: m.sku,
      opcionWorkbook: m.opcion,
      sourceRow: m.sourceRow,
      ...(esHoja ? { formato: { medida: 1, unidad: 'hoja' } } : {}),
    };
    componentes.push(esHoja
      ? { nombre: m.descripcion, insumoId: id, hojas: m.consumo }
      : { nombre: m.descripcion, insumoId: id, cantidad: m.consumo });
  }
  const par = {
    ...PARAMETROS_DEFAULT,
    modeloCosteo: 'intelisis',
    usarCostoPorArea: true,
    costoHoraArea: CERO,
    costoHoraGIF: CERO,
    gastosOperacionPct: 0,
    utilidadPct: 0,
    factorPrecioLista: 1,
    mermaProceso: 0,
  };
  return {
    pieza: { nombre: modulo.nombre, modeloCosteo: 'intelisis', modoManoObra: 'horas', horas: {}, componentes },
    insumos, par,
  };
}

describe('golden · TELCEL C-CO-320R · materiales METAL salen del motor', () => {
  it('las fronteras crudas de los 4 módulos suman exactamente los subtotales del workbook', () => {
    for (const m of MODULOS) {
      const sumaLineas = m.materials.reduce((s, x) => s + x.costoLinea, 0);
      expect(Math.abs(sumaLineas - m.target)).toBeLessThanOrEqual(0.01);
    }
  });
  for (const modulo of MODULOS) {
    it(`${modulo.nombre}: motor reproduce material a centavos`, () => {
      const { pieza, insumos, par } = armar(modulo);
      const r = calcular(pieza, 1, insumos, par);
      expect(r.estadoCosto).toBe('completo');
      expect(Math.abs(r.materialTotal - modulo.target)).toBeLessThanOrEqual(0.05);
    });
  }
});
