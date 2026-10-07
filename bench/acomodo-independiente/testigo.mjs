// Testigos (soluciones armadas por mí) para PROBAR factibilidad con MI verificador.
// Por cuarto: privado y juntas+credenza con plantilla a mano; bancas con
// colocación por filas; piezas sueltas empacadas con 1.0 m de pasillo.
const n = (v) => Number(v) || 0;
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const zonaDe = (p) => p.zone_id ?? p.zonaSugerida;
export function testigo(areas, piezas) {
  const col = [];
  areas.forEach((a, ai) => {
    const mias = piezas.filter((p) => norm(zonaDe(p)) === norm(a.zone_id ?? a.nombre));
    const grupos = new Map(); const sueltas = [];
    for (const p of mias) { if (p.functional_group_id) { if (!grupos.has(p.functional_group_id)) grupos.set(p.functional_group_id, []); grupos.get(p.functional_group_id).push(p); } else sueltas.push(p); }
    let cursorY = 0;  // bloques apilados verticalmente, pasillo 1000 entre ellos
    const W = n(a.ancho);
    for (const [, g] of grupos) {
      const anc = g.find((p) => /^ANCHOR_/.test(p.relation_role));
      const seats = g.filter((p) => /SEAT$/.test(p.relation_role));
      const stor = g.filter((p) => /STORAGE$/.test(p.relation_role));
      if (anc.relation_role === 'ANCHOR_DESK') {
        // credenza al fondo, ejecutiva detrás del escritorio, visitas al frente
        const x0 = Math.round((W - n(anc.w)) / 2), y0 = cursorY;
        const vis = seats.filter((s) => s.relation_role === 'VISITOR_SEAT'), exe = seats.filter((s) => s.relation_role !== 'VISITOR_SEAT');
        vis.forEach((s, i) => col.push({ id: s.id, area: ai, x: x0 + 150 + i * 900, y: y0, rot: 0 }));
        col.push({ id: anc.id, area: ai, x: x0, y: y0 + 700, rot: 0 });
        exe.forEach((s) => col.push({ id: s.id, area: ai, x: x0 + Math.round((n(anc.w) - n(s.w)) / 2), y: y0 + 700 + n(anc.d) + 100, rot: 0 }));
        stor.forEach((s) => col.push({ id: s.id, area: ai, x: x0 + Math.round((n(anc.w) - n(s.w)) / 2), y: y0 + 700 + n(anc.d) + 100 + 700, rot: 0 }));
        cursorY = y0 + 700 + n(anc.d) + 800 + 500 + 1000;
      } else if (anc.relation_role === 'ANCHOR_MEETING') {
        const x0 = 600 + Math.max(0, Math.round((W - n(anc.w) - 1200) / 2)), y0 = cursorY + 600;
        const porLado = Math.floor(n(anc.w) / 650);
        seats.forEach((s, i) => {
          let x, y;
          if (i < porLado) { x = x0 + i * 650; y = y0 - 600; }
          else if (i < 2 * porLado) { x = x0 + (i - porLado) * 650; y = y0 + n(anc.d); }
          else if (i === 2 * porLado) { x = x0 - 600; y = y0 + 300; }
          else { x = x0 + n(anc.w); y = y0 + 300; }
          col.push({ id: s.id, area: ai, x, y, rot: 0 });
        });
        col.push({ id: anc.id, area: ai, x: x0, y: y0, rot: 0 });
        stor.forEach((s) => col.push({ id: s.id, area: ai, x: x0 + Math.round((n(anc.w) - n(s.w)) / 2), y: y0 + n(anc.d) + 600 + 300, rot: 0 }));
        cursorY = y0 + n(anc.d) + 600 + (stor.length ? 800 : 0) + 1000;
      } else {
        // banca doble / estación / recepción: la mitad de sillas en cada lado largo
        const x0 = Math.max(0, Math.round((W - n(anc.w)) / 2)), y0 = cursorY + 600;
        const k = seats.length, a1 = Math.ceil(k / 2), lado = anc.relation_role === 'ANCHOR_WORKSTATION' && /doble/i.test(anc.nombre || '') ? 2 : 1;
        const fila1 = lado === 2 ? a1 : k;
        seats.forEach((s, i) => {
          const enFila1 = i < fila1, j = enFila1 ? i : i - fila1, m = enFila1 ? fila1 : k - fila1;
          const paso = n(anc.w) / m;
          col.push({ id: s.id, area: ai, x: Math.round(x0 + j * paso + (paso - 600) / 2), y: enFila1 ? y0 - 600 : y0 + n(anc.d), rot: 0 });
        });
        col.push({ id: anc.id, area: ai, x: x0, y: y0, rot: 0 });
        stor.forEach((s, i) => col.push({ id: s.id, area: ai, x: x0 + i * 450, y: y0 + 50, rot: 0 }));
        cursorY = y0 + n(anc.d) + (lado === 2 ? 600 : 0) + 1000;
      }
    }
    // sueltas: filas con 1000 de pasillo
    let x = 0, y = cursorY, filaH = 0;
    for (const p of sueltas) {
      if (x + n(p.w) > W) { x = 0; y += filaH + 1000; filaH = 0; }
      col.push({ id: p.id, area: ai, x, y, rot: 0 }); x += n(p.w) + 1000; filaH = Math.max(filaH, n(p.d));
    }
  });
  return col;
}
