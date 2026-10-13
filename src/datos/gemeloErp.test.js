import { describe, it, expect } from 'vitest';
import { esGemeloExacto, mejorGemeloCertificable, proponerGemelosErp, fusionarGemelosEnBom, piezasConTamanoDeHoja, consultaGemelo } from './gemeloErp.js';

const FMT = { tipo: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
const mdf = { id: 'mdf', nombre: 'MDF 19 mm', unidad: 'hoja', precio: 437, formato: FMT, fraccion: true, evidencia: { estado: 'propuesto', certificable: false } };
const erp19 = { id: 'erp-mdf19', nombre: 'MDF NATURAL HOJA 4 X 8 ESPESOR 19 mm - "MDF19"', unidad: 'hoja', precio: 431.04, formato: FMT, clasificacion: 'erp', actualizado: '2026-06-01', evidencia: { estado: 'aprobado', certificable: true } };
const erp16 = { ...erp19, id: 'erp-mdf16', nombre: 'MDF NATURAL HOJA 4 X 8 ESPESOR 16 mm', precio: 372 };
const erp19viejo = { ...erp19, id: 'erp-mdf19-old', actualizado: '2014-01-01', evidencia: { estado: 'propuesto_validado', certificable: false } };
const erp19sinFormato = { ...erp19, id: 'erp-mdf19-sf', formato: null };

describe('gemelo ERP certificable (VH-152)', () => {
  it('misma familia + mismo espesor + misma unidad + formato → gemelo; otro espesor, otra unidad o sin formato → no', () => {
    expect(esGemeloExacto(mdf, erp19)).toBe(true);
    expect(esGemeloExacto(mdf, erp16)).toBe(false);
    expect(esGemeloExacto(mdf, { ...erp19, unidad: 'm2' })).toBe(false);
    expect(esGemeloExacto(mdf, erp19sinFormato)).toBe(false);
    expect(esGemeloExacto(mdf, { ...erp19, id: 'mdf' })).toBe(false);
  });
  it('elige el certificable con compra más reciente; ignora los no certificables', () => {
    expect(mejorGemeloCertificable(mdf, [erp19viejo, erp16, erp19]).id).toBe('erp-mdf19');
    expect(mejorGemeloCertificable(mdf, [erp19viejo])).toBeNull();
  });
  it('propone el gemelo sólo para curados sin precio certificable y sin confirmación humana; conserva el previo para auditoría', async () => {
    const buscar = async () => [erp16, erp19, erp19viejo];
    const comps = [
      { nombre: 'Laterales', insumoId: 'mdf', cantidad: 2 },
      { nombre: 'Puertas', insumoId: 'mdf', material_confirmado: true },
      { nombre: 'Respaldo', insumoId: 'erp-mdf8' },
    ];
    const agregados = [];
    const { comps: r, propuestos } = await proponerGemelosErp(comps, { insumos: { mdf }, buscar, agregarInsumo: (x) => agregados.push(x.id) });
    expect(r[0]).toMatchObject({ insumoId: 'erp-mdf19', material_match: 'SAME_FAMILY_COMPATIBLE_PROPOSED', cantidad: 2 });
    expect(r[0]._match).toMatchObject({ gemelo: true, erp: true, previo: 'mdf' });
    expect(r[1].insumoId).toBe('mdf');
    expect(r[2].insumoId).toBe('erp-mdf8');
    expect(propuestos).toEqual([{ nombre: 'Laterales', previo: 'mdf', id: 'erp-mdf19', insumoNombre: erp19.nombre, precio: 431.04, precioPrevio: 437 }]);
    expect(agregados).toEqual(['erp-mdf19']);
    expect(consultaGemelo(mdf)).toBe('mdf 19 mm');
  });
  it('si el curado ya es certificable, no se toca', async () => {
    const { propuestos } = await proponerGemelosErp([{ nombre: 'X', insumoId: 'mdf' }], { insumos: { mdf: { ...mdf, evidencia: { certificable: true } } }, buscar: async () => [erp19] });
    expect(propuestos).toEqual([]);
  });
  it('fusión tardía: sólo si la pieza sigue con el mismo curado y sin confirmación humana', () => {
    const prop = { nombre: 'Laterales', insumoId: 'erp-mdf19', candidate_insumo_id: 'erp-mdf19', material_match: 'SAME_FAMILY_COMPATIBLE_PROPOSED', _match: { gemelo: true, previo: 'mdf' } };
    expect(fusionarGemelosEnBom([{ nombre: 'Laterales', insumoId: 'mdf', cantidad: 3 }], [prop])[0]).toMatchObject({ insumoId: 'erp-mdf19', cantidad: 3 });
    expect(fusionarGemelosEnBom([{ nombre: 'Laterales', insumoId: 'melamina-16' }], [prop])[0].insumoId).toBe('melamina-16');
    expect(fusionarGemelosEnBom([{ nombre: 'Laterales', insumoId: 'mdf', material_confirmado: true }], [prop])[0].insumoId).toBe('mdf');
  });
});

describe('piezas con tamaño de hoja (VH-151)', () => {
  it('detecta 1220×2440 (girada o no) y piezas que exceden el formato; deja pasar piezas reales', () => {
    const r = piezasConTamanoDeHoja([
      { nombre: 'Chapa caras vistas', insumoId: 'chapa', largoMM: 1220, anchoMM: 2440 },
      { nombre: 'Lateral', insumoId: 'chapa', largoMM: 650, anchoMM: 450 },
      { nombre: 'Cubierta larga', insumoId: 'chapa', largoMM: 2600, anchoMM: 450 },
      { nombre: 'Sin insumo pero hoja', largoMM: 2440, anchoMM: 1220 },
    ], { chapa: { formato: FMT } });
    expect(r.map((x) => [x.nombre, x.motivo])).toEqual([['Chapa caras vistas', 'TAMANO_HOJA'], ['Cubierta larga', 'EXCEDE_FORMATO'], ['Sin insumo pero hoja', 'TAMANO_HOJA']]);
  });
});

describe('gemelo ERP: lo pedido manda (VH-152b)', () => {
  it('una jaladera de 128 mm no es gemela de "Jaladeras rectas 300 mm"; una chapa ENCINO no es gemela si se pidió nogal', async () => {
    const { esGemeloExacto, proponerGemelosErp } = await import('./gemeloErp.js');
    const jal = { id: 'jaladera', nombre: 'Jaladera', unidad: 'pza', precio: 37.9, evidencia: { certificable: false } };
    const jal128 = { id: 'erp-jal0791583', nombre: 'JALADERA ALUMINIO DE 128 mm CODIGO 079-1583', unidad: 'pza', precio: 21.41, clasificacion: 'erp', actualizado: '2026-01-01', evidencia: { certificable: true } };
    expect(esGemeloExacto(jal, jal128)).toBe(false);                       // 128 mm vs sin medida en el curado: no es exacto
    expect(esGemeloExacto(jal, jal128, 'jaladera · Jaladeras rectas 300 mm')).toBe(false);
    const chapa = { id: 'chapa-madera', nombre: 'Chapa de madera (sabana natural)', unidad: 'hoja', precio: 540, formato: { medida: 2.9768, largoMM: 2440, anchoMM: 1220 }, fraccion: true, evidencia: { certificable: false } };
    const encino = { id: 'erp-ch122244sb-m1099', nombre: "CHAPA DE MADERA HOJA 4' X 8' (SABANA NATURAL) · CHAPA DE MADERA ENCINO ROJO FLAMA", unidad: 'hoja', precio: 1250, formato: chapa.formato, clasificacion: 'erp', actualizado: '2026-01-01', evidencia: { certificable: true } };
    const nogal = { ...encino, id: 'erp-ch-nogal', nombre: "CHAPA DE MADERA HOJA 4' X 8' (SABANA NATURAL) · CHAPA DE MADERA NOGAL AMERICANO" };
    expect(esGemeloExacto(chapa, encino, 'Chapa de madera sabana natural nogal · Chapa nogal natural, frentes de puerta')).toBe(false);
    // Auditoría 13-oct: la ausencia de especie en el curado NO prueba igualdad con un ERP que sí la declara. Una chapa
    // genérica y una de nogal no son el mismo artículo (antes esto era true).
    expect(esGemeloExacto(chapa, nogal, 'Chapa de madera sabana natural nogal · Chapa nogal natural, frentes de puerta')).toBe(false);
    const chapaNogal = { ...chapa, id: 'chapa-nogal', nombre: 'Chapa de madera nogal (sabana natural)' };
    expect(esGemeloExacto(chapaNogal, nogal, 'Chapa nogal natural, frentes de puerta')).toBe(true);
    const { propuestos } = await proponerGemelosErp([{ nombre: 'Jaladeras rectas 300 mm', insumoId: 'jaladera', material_solicitado: 'jaladera' }], { insumos: { jaladera: jal }, buscar: async () => [jal128] });
    expect(propuestos).toEqual([]);
  });
});

describe('gemelo ERP: no peor que el curado (VH-152c)', () => {
  it('pidió MDF 18 mm; curado y ERP son 19 mm → el ERP sí es gemelo (no añade conflicto); un ERP 16 mm no', async () => {
    const { esGemeloExacto } = await import('./gemeloErp.js');
    const fmt = { medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
    const mdf = { id: 'mdf', nombre: 'MDF 19 mm', unidad: 'hoja', precio: 437, formato: fmt, fraccion: true, evidencia: { certificable: false } };
    const mdf19 = { id: 'erp-mdf19', nombre: 'MDF NATURAL HOJA 4 X 8 ESPESOR 19 mm', unidad: 'hoja', precio: 431.04, formato: fmt, clasificacion: 'erp', actualizado: '2026-06-01', evidencia: { certificable: true } };
    const mdf16 = { ...mdf19, id: 'erp-mdf16', nombre: 'MDF NATURAL HOJA 4 X 8 ESPESOR 16 mm' };
    const ped = 'MDF 18 mm enchapado nogal natural · Lateral exterior (cuerpo)';
    expect(esGemeloExacto(mdf, mdf19, ped)).toBe(true);
    expect(esGemeloExacto(mdf, mdf16, ped)).toBe(false);
  });
});

describe('gemelo ERP estricto (auditoría 13-oct): ninguna diferencia de acabado, color, espesor, calibre, formato o unidad', () => {
  const fmt = { medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
  const base = { id: 'mdf', nombre: 'MDF 19 mm', unidad: 'hoja', precio: 437, formato: fmt, fraccion: true, evidencia: { certificable: false } };
  const erp = (id, nombre, extra = {}) => ({ id, nombre, unidad: 'hoja', precio: 431, formato: fmt, clasificacion: 'erp', evidencia: { certificable: true }, ...extra });
  it('rechaza cada diferencia y acepta el idéntico', async () => {
    const { esGemeloExacto } = await import('./gemeloErp.js');
    expect(esGemeloExacto(base, erp('erp-mdf19', 'MDF NATURAL HOJA 4 X 8 ESPESOR 19 mm'))).toBe(true);
    expect(esGemeloExacto(base, erp('e1', 'MDF HOJA 4 X 8 ESPESOR 16 mm'))).toBe(false);                   // espesor
    expect(esGemeloExacto(base, erp('e2', 'MDF HOJA 4 X 8 ESPESOR 16/19 mm'))).toBe(false);                // conjunto distinto
    expect(esGemeloExacto(base, erp('e3', 'MDF NEGRO HOJA 4 X 8 ESPESOR 19 mm'))).toBe(false);             // color que el curado no declara
    expect(esGemeloExacto(base, erp('e4', 'MDF HOJA 4 X 8 ESPESOR 19 mm ACABADO MATE'))).toBe(false);      // acabado
    expect(esGemeloExacto(base, erp('e5', 'MDF HOJA 5 X 8 ESPESOR 19 mm', { formato: { medida: 3.721, largoMM: 2440, anchoMM: 1525 } }))).toBe(false); // formato
    expect(esGemeloExacto(base, erp('e6', 'MDF HOJA 4 X 8 ESPESOR 19 mm', { formato: undefined }))).toBe(false); // formato ausente ≠ igual
    expect(esGemeloExacto(base, erp('e7', 'MDF HOJA 4 X 8 ESPESOR 19 mm', { unidad: 'm2' }))).toBe(false); // unidad
    expect(esGemeloExacto({ ...base, unidad: '' }, erp('e8', 'MDF HOJA 4 X 8 ESPESOR 19 mm', { unidad: '' }))).toBe(false); // unidad ausente
    const ptr = { id: 'ptr-14', nombre: 'Tubo / PTR cal. 14', unidad: 'm', precio: 270, evidencia: { certificable: false } };
    expect(esGemeloExacto(ptr, { id: 'erp-ptr18', nombre: 'PTR 1 X 1 CAL. 18', unidad: 'm', clasificacion: 'erp', evidencia: { certificable: true } })).toBe(false); // calibre
    // Sin ningún atributo contrastable (sólo familia + unidad) no hay identidad exacta.
    const nivel = { id: 'nivelador', nombre: 'Nivelador', unidad: 'pza', precio: 70, evidencia: { certificable: false } };
    expect(esGemeloExacto(nivel, { id: 'erp-niv', nombre: 'NIVELADOR', unidad: 'pza', clasificacion: 'erp', evidencia: { certificable: true } })).toBe(false);
  });
  it('el gemelo queda PROPUESTO (por confirmar), nunca confirmado', async () => {
    const { proponerGemelosErp } = await import('./gemeloErp.js');
    const { requiereConfirmacion } = await import('./materialMatch.js');
    const { comps, propuestos } = await proponerGemelosErp([{ nombre: 'Lateral', insumoId: 'mdf', material_solicitado: 'MDF 19 mm' }], { insumos: { mdf: base }, buscar: async () => [erp('erp-mdf19', 'MDF NATURAL HOJA 4 X 8 ESPESOR 19 mm')] });
    expect(propuestos.length).toBe(1);
    expect(comps[0].material_confirmado).not.toBe(true);
    expect(comps[0]._match.confirmado_por_usuario).not.toBe(true);
    expect(requiereConfirmacion(comps[0])).toBe(true);
  });
});

describe('búsqueda tardía no sobrescribe cambios manuales (auditoría 13-oct)', () => {
  const prop = (nombre, previo, id) => ({ nombre, insumoId: id, candidate_insumo_id: id, material_match: 'SAME_FAMILY_COMPATIBLE_PROPOSED', _match: { gemelo: true, previo } });
  it('material elegido a mano, confirmación, cambio de medida, fila borrada o renombrada', async () => {
    const { fusionarGemelosEnBom } = await import('./gemeloErp.js');
    const propuestos = [prop('Lateral', 'mdf', 'erp-mdf19'), prop('Cubierta', 'mdf', 'erp-mdf19')];
    // 1) la persona eligió otro material mientras corría la búsqueda (onMaterial confirma): se respeta.
    const a = fusionarGemelosEnBom([{ nombre: 'Lateral', insumoId: 'melamina-16', material_confirmado: true }, { nombre: 'Cubierta', insumoId: 'mdf' }], propuestos);
    expect(a[0].insumoId).toBe('melamina-16');
    expect(a[1].insumoId).toBe('erp-mdf19');
    // 2) confirmó el curado tal cual: se respeta.
    const b = fusionarGemelosEnBom([{ nombre: 'Lateral', insumoId: 'mdf', material_confirmado: true }, { nombre: 'Cubierta', insumoId: 'mdf', _match: { confirmado_por_usuario: true } }], propuestos);
    expect(b.map((c) => c.insumoId)).toEqual(['mdf', 'mdf']);
    // 3) cambió la medida: el gemelo entra pero la medida manual se conserva.
    const c = fusionarGemelosEnBom([{ nombre: 'Lateral', insumoId: 'mdf', largoMM: 777, anchoMM: 450 }, { nombre: 'Cubierta', insumoId: 'mdf' }], propuestos);
    expect(c[0]).toMatchObject({ insumoId: 'erp-mdf19', largoMM: 777, anchoMM: 450 });
    // 4) borró una fila: no se aplica nada (no se puede casar por posición con seguridad).
    const d0 = [{ nombre: 'Cubierta', insumoId: 'mdf' }];
    expect(fusionarGemelosEnBom(d0, propuestos)).toBe(d0);
    // 5) renombró la pieza: no se toca.
    const e = fusionarGemelosEnBom([{ nombre: 'Lateral izquierdo', insumoId: 'mdf' }, { nombre: 'Cubierta', insumoId: 'mdf' }], propuestos);
    expect(e[0].insumoId).toBe('mdf');
  });
});
