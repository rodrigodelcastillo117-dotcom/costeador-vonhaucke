import { describe, it, expect } from 'vitest';
import { huellaReal, expandirPiezas, tipoDe } from './espacio.js';

// ---------------------------------------------------------------------------
//  LA HUELLA DE LAS BANCAS SE CALCULABA DOS VECES (2026-08-16).
//  `nombreConBloque` (lineas.js) expande la banca al armar la partida y guarda
//  ahí la huella del bloque; `expandirPiezas` la volvía a expandir. Una banca
//  doble App LT de 10 usuarios a 1.50 pasaba de 7.50 m a 37.50 m, no cabía en
//  ninguna oficina y el open space se quedaba vacío mientras el acomodo decía
//  "se sale del área". No se ve leyendo el código: sólo aparece acomodando un
//  proyecto real, así que aquí queda clavado.
// ---------------------------------------------------------------------------
describe('huella de bancas y sofás', () => {
  it('expande una banca cuando la medida es de UN puesto', () => {
    // Cirque: 6 puestos, doble, 1.20 × 0.75 por puesto -> 3 columnas × 2 hileras.
    expect(huellaReal('Cirque · Banca doble 6 puestos', 1200, 750, 'escritorio'))
      .toEqual([3600, 1500]);
  });

  it('NO la vuelve a expandir si el nombre ya declara la huella', () => {
    expect(huellaReal('Cirque · Banca doble 6 puestos · ocupa 3.60 × 1.50 m', 3600, 1500, 'escritorio'))
      .toEqual([3600, 1500]);
  });

  it('NO expande una medida que ya es de bloque', () => {
    // App LT, 10 usuarios: el módulo REAL op-10u mide 6.00 × 1.20 m (no 7.50 —
    // esa era la geometría fantasma #102). Un bloque real ya no se re-expande.
    expect(huellaReal('Banca doble APP LT · 10 usuarios', 6000, 1200, 'escritorio'))
      .toEqual([6000, 1200]);
  });

  it('es idempotente: aplicarla dos veces da lo mismo que una', () => {
    const nombre = 'Banca doble APP LT · 10 usuarios · ocupa 6.00 × 1.20 m';
    const una = huellaReal(nombre, 6000, 1200, 'escritorio');
    const dos = huellaReal(nombre, ...una, 'escritorio');
    expect(dos).toEqual(una);
  });

  it('un sofá de 3 plazas no se multiplica si ya viene armado', () => {
    expect(huellaReal('Pac · Sofá 3 plazas', 2100, 800, 'asiento')).toEqual([2100, 800]);
    // Pero un módulo suelto de 0.70 sí arma el sofá completo.
    expect(huellaReal('Pac · Sofá 3 plazas', 700, 800, 'asiento')).toEqual([2100, 800]);
  });
});

describe('expandirPiezas con la cotización real', () => {
  const PARTIDA = {
    id: 'p1',
    nombre: 'Banca doble APP LT · 10 usuarios · ocupa 6.00 × 1.20 m',
    w: 6000, d: 1200, cantidad: 2, ruta: 'applt', productoId: 'banca_doble',
  };

  it('deja la banca en su medida real y no la multiplica por sus puestos', () => {
    const piezas = expandirPiezas([PARTIDA]);
    expect(piezas).toHaveLength(2);
    for (const p of piezas) {
      expect(p.w).toBe(6000);           // real op-10u, jamás 7500 ni 60000
      expect(p.d).toBe(1200);
    }
  });
});

// ⚠️ EL BIOMBO ES UN ACCESORIO, NO UN TIPO DE MUEBLE. Salió armando el PDF de
// prueba: una "Banca doble con biombos laterales" caía en la regla de mamparas,
// y `enderezarAlto` le dejaba 80 mm de fondo — un bench de 6 usuarios dibujado
// como un muro de 4.50 × 0.08 m. Ningún producto del catálogo se llama así hoy,
// pero los nombres que escribe Voni desde el texto del cliente sí pueden.
describe('el biombo del bench no lo convierte en mampara', () => {
  it('una banca con biombos sigue siendo escritorio', () => {
    expect(tipoDe({ ruta: 'applt', nombre: 'Banca doble APP LT 1.50 · 6 usuarios, biombos laterales' })).toBe('escritorio');
    expect(tipoDe({ ruta: 'alba', nombre: 'Escritorio Alba 1.80 con biombo de cristal' })).toBe('escritorio');
  });

  it('y un biombo de verdad sigue siendo mampara', () => {
    expect(tipoDe({ ruta: 'via', nombre: 'Biombo' })).toBe('mampara');
    expect(tipoDe({ ruta: 'spine', nombre: 'Biombo para ducto' })).toBe('mampara');
    expect(tipoDe({ ruta: 'accents', nombre: 'Semimampara / biombo divisor' })).toBe('mampara');
    expect(tipoDe({ ruta: 'privacy4', nombre: 'Muro / Panel' })).toBe('mampara');
  });
});

// VH-112 · la capacidad declarada en el nombre viaja al solver (sin inventar nada).
import { describe as dCap, it as iCap, expect as eCap } from 'vitest';
import { capacidadDeNombre, expandirPiezas as expandirCap } from './espacio.js';
dCap('VH-112 · capacidadDeNombre', () => {
  iCap('lee "8 usuarios", "6 puestos", "10 personas"; sin número y banca doble ⇒ 2 × módulos; sin evidencia ⇒ null', () => {
    eCap(capacidadDeNombre('Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m')).toBe(8);
    eCap(capacidadDeNombre('Módulo operativo 6 puestos')).toBe(6);
    eCap(capacidadDeNombre('Mesa de juntas para 10 personas')).toBe(10);
    eCap(capacidadDeNombre('Banca doble APP LT', { w: 6000, rol: 'ANCHOR_WORKSTATION' })).toBe(8);
    eCap(capacidadDeNombre('Banca doble APP LT', { w: 6000, rol: 'ANCHOR_MEETING' })).toBe(null);
    eCap(capacidadDeNombre('Escritorio APP LT 1.50 × 0.75')).toBe(null);
  });
  iCap('expandirPiezas: la banca "8 usuarios" sale con user_capacity 8 (inferida); con user_capacity explícito gana el explícito', () => {
    const [b] = expandirCap([{ id: 'b', nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', cantidad: 1, w: 6000, d: 1200, piezaId: 'linea-banca_doble', productoId: 'banca_doble' }]);
    eCap(b.relation_role).toBe('ANCHOR_WORKSTATION'); eCap(b.user_capacity).toBe(8); eCap(b.user_capacity_inferida).toBe(true);
    const [c] = expandirCap([{ id: 'c', nombre: 'Banca doble APP LT 1.50 · 8 usuarios', cantidad: 1, w: 6000, d: 1200, user_capacity: 6, piezaId: 'linea-banca_doble', productoId: 'banca_doble' }]);
    eCap(c.user_capacity).toBe(6); eCap(c.user_capacity_inferida).toBeUndefined();
  });
});

// VH-120 · la fuente de la capacidad viaja al solver; `usuarios` (VONI: "3 bancas de 8") ya no se pierde.
dCap('VH-120 · capacity_source en el payload del solver', () => {
  iCap('usuarios de la persona ⇒ USUARIO; ficha del banco ⇒ CATALOGO; nombre ⇒ INFERIDA (+ user_capacity_inferida)', () => {
    const [u] = expandirCap([{ id: 'u', nombre: 'Banca doble APP LT', cantidad: 1, w: 6000, d: 1200, usuarios: 12, piezaId: 'linea-banca_doble', productoId: 'banca_doble' }]);
    eCap(u.user_capacity).toBe(12); eCap(u.capacity_source).toBe('USUARIO'); eCap(u.user_capacity_inferida).toBeUndefined();
    const [c] = expandirCap([{ id: 'c', nombre: 'Bench doble APP LT 4.80', cantidad: 1, w: 4800, d: 1200, usuarios: 8, deBanco: true, origen: 'banco', piezaId: 'p9-app-lt-bench-doble-8' }]);
    eCap(c.user_capacity).toBe(8); eCap(c.capacity_source).toBe('CATALOGO');
    const [i] = expandirCap([{ id: 'i', nombre: 'Banca doble APP LT 1.50 · 8 usuarios · ocupa 6.00 × 1.20 m', cantidad: 1, w: 6000, d: 1200, piezaId: 'linea-banca_doble', productoId: 'banca_doble' }]);
    eCap(i.user_capacity).toBe(8); eCap(i.capacity_source).toBe('INFERIDA'); eCap(i.user_capacity_inferida).toBe(true);
    const [s] = expandirCap([{ id: 's', nombre: 'Escritorio APP LT 1.50 × 0.75', cantidad: 1, w: 1500, d: 750, piezaId: 'linea-escritorio', productoId: 'escritorio' }]);
    eCap(s.user_capacity).toBeUndefined(); eCap(s.capacity_source).toBeUndefined();
  });
});

// ACOMODO 10 · VH-A10-06 (P0-05): la huella REAL del catálogo cuando la partida no trae ancho × fondo. Las partidas
// del banco guardan la medida sólo en el TEXTO del nombre ("(4500 × 1200 mm)"); si la persona edita el nombre, el
// acomodo caía a la huella genérica por tipo (1.50 × 0.75 m para un bench de 4.50 × 1.20) aunque el catálogo sí la tenga.
dCap('VH-A10-06 · huella de catálogo antes que la huella por tipo', () => {
  iCap('pieza del banco sin w/d y con el nombre editado ⇒ medida de su ficha, fuente CATALOGO', () => {
    const [b] = expandirCap([{ id: 'b', piezaId: 'op-6u-4500x1200', nombre: 'Bench equipo ventas', cantidad: 1, precioUnitario: 36260 }]);
    eCap([b.w, b.d, b.huella_fuente]).toEqual([4500, 1200, 'CATALOGO']);
  });
  iCap('guarda con alto en la ficha (900 × 1570 × 450): la huella es frente × fondo, no el alto', () => {
    const [g] = expandirCap([{ id: 'g', piezaId: 'gabinete-multiusos', nombre: 'Gabinete', cantidad: 1, precioUnitario: 11790 }]);
    eCap([g.w, g.d, g.huella_fuente]).toEqual([900, 450, 'CATALOGO']);
  });
  iCap('la medida capturada en la partida manda sobre la ficha', () => {
    const [b] = expandirCap([{ id: 'b', piezaId: 'op-6u-4500x1200', nombre: 'Bench', cantidad: 1, w: 3000, d: 1200 }]);
    eCap([b.w, b.d, b.huella_fuente]).toEqual([3000, 1200, 'PARTIDA']);
  });
  iCap('sin medida en ningún lado: huella por tipo, marcada INFERIDA (visible como supuesta)', () => {
    const [x] = expandirCap([{ id: 'x', nombre: 'Mueble especial', cantidad: 1 }]);
    eCap(x.huella_fuente).toBe('INFERIDA');
  });
});
