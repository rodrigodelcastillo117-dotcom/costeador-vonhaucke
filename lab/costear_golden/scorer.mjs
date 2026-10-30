// ============================================================================
// SCORER determinista: extracción (PDF/foto/texto → BOM) vs verdad de manufactura.
// No usa claves (un mueble en desarrollo no tiene). Empareja por ROL semántico:
// el mismo vocabulario canónico se aplica a la verdad Y a la extracción.
// No "aprueba/reprueba": MIDE (recall de roles, conteo, inventadas, material).
// ============================================================================

// Vocabulario canónico derivado del HDM real de TELSVH120. Orden = específico antes que general.
const REGLAS_ROL = [
  ['refuerzo_tapa',     /refuerzo\s+(de\s+)?tapa/],
  ['refuerzo_lateral',  /refuerzo\s+lateral/],
  ['refuerzo_puerta',   /refuerzo\s+(de\s+)?puerta/],
  ['refuerzo_oval',     /refuerzo.*oval|para\s+oval/],
  ['omega_niveladora',  /omega\s+niveladora|niveladora/],
  ['nivelador',         /nivelador(?!a)/],
  ['omega',             /\bomega\b/],
  ['tapa_frente',       /tapa\s+de\s+frente/],
  ['frente_exhibidor',  /frente\s+de\s+exhibidor/],
  ['exhibidor',         /exhibidor/],
  ['base_corredera',    /base\s+corredera/],
  ['soporte_corredera', /soporte\s+(para\s+)?corredera/],
  ['corredera',         /\bcorredera(s)?\b/],
  ['caja_luz',          /caja\s+de\s+luz|termoformad/],
  ['placa_serigrafia',  /serigraf|placa.*(venta|serigraf)|puntos\s+de\s+venta.*placa/],
  ['travesano',         /travesa/],
  ['entrepano',         /entrepa/],
  ['escuadra',          /escuadra/],
  ['sombra',            /\bsombra\b/],
  ['tapa',              /\btapa\b/],
  ['lateral',           /\blateral(es)?\b/],
  ['base',              /\bbase\b/],
  ['cuerpo',            /\bcuerpo\b/],
  ['placa',             /\bplaca\b/],
  ['puerta',            /\bpuerta(s)?\b/],
  ['bisagra',           /bisagra|gozne/],
  ['pija',              /\bpija(s)?\b|tornill/],
  ['tuerca',            /tuerca/],
  ['pasador',           /pasador|cerradura|chapa/],
  ['cristal',           /cristal|vidrio|capelo/],
  ['pelicula',          /pelicula|paletizad|emplay/],
  ['maquila',           /maquila/],
];

export function rolDe(texto) {
  const t = String(texto || '').toLowerCase();
  for (const [rol, re] of REGLAS_ROL) if (re.test(t)) return rol;
  return 'otro';
}

const num = (x) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : 1; };

// verdad.piezas[] → Map rol -> {count, materiales:Set, claves:[]}
export function rolesDeVerdad(verdad, { incluirProceso = false } = {}) {
  const m = new Map();
  for (const p of verdad.piezas || []) {
    if (p.tipo === 'proceso' && !incluirProceso) continue;
    const rol = rolDe(p.descripcion);
    const e = m.get(rol) || { count: 0, materiales: new Set(), claves: [] };
    e.count += num(p.piezas_x_mueble);
    if (p.material_desc) e.materiales.add(familiaMaterial(p.material_desc));
    e.claves.push(p.clave);
    m.set(rol, e);
  }
  return m;
}

// extracción[] = [{nombre, cantidad?, material?}] → Map rol -> {count, materiales:Set, nombres:[]}
export function rolesDeExtraccion(items) {
  const m = new Map();
  for (const it of items || []) {
    const rol = rolDe(it.nombre || it.descripcion || it.rol);
    const e = m.get(rol) || { count: 0, materiales: new Set(), nombres: [] };
    e.count += num(it.cantidad ?? it.piezas);
    if (it.material) e.materiales.add(familiaMaterial(it.material));
    e.nombres.push(it.nombre || it.descripcion || '');
    m.set(rol, e);
  }
  return m;
}

export function familiaMaterial(desc) {
  const t = String(desc || '').toLowerCase();
  const cal = t.match(/calibre\s*(\d+)/);
  if (/lamina|acero|lámina/.test(t)) return cal ? `lamina_cal_${cal[1]}` : 'lamina';
  if (/cristal|vidrio/.test(t)) return 'cristal';
  if (/galvaniz/.test(t)) return 'galvanizado';
  return 'otro';
}

// Métrica central. verdad = JSON cargado; extraccion = array del modelo.
export function puntuar(verdad, extraccion, opts = {}) {
  const V = rolesDeVerdad(verdad, opts);
  const E = rolesDeExtraccion(extraccion);
  const rolesV = [...V.keys()].filter((r) => r !== 'otro');
  const detectados = rolesV.filter((r) => E.has(r));
  const omitidos = rolesV.filter((r) => !E.has(r));
  const inventados = [...E.keys()].filter((r) => r !== 'otro' && !V.has(r));

  const detalle = rolesV.map((r) => {
    const v = V.get(r), e = E.get(r);
    const matV = [...(v.materiales || [])];
    const matE = e ? [...(e.materiales || [])] : [];
    const material_ok = matV.length === 0 ? null
      : (e ? matE.some((x) => matV.includes(x)) : false);
    return {
      rol: r,
      esperado: v.count,
      extraido: e ? e.count : 0,
      detectado: !!e,
      conteo_ok: e ? e.count === v.count : false,
      material_esperado: matV,
      material_extraido: matE,
      material_ok,
    };
  });

  const piezasV = [...V.values()].reduce((s, e) => s + e.count, 0);
  const piezasE = [...E.values()].reduce((s, e) => s + e.count, 0);

  return {
    mueble: verdad.mueble,
    total_roles_verdad: rolesV.length,
    roles_detectados: detectados.length,
    roles_omitidos: omitidos,
    roles_inventados: inventados,
    recall_roles: rolesV.length ? +(detectados.length / rolesV.length).toFixed(3) : 0,
    conteo_roles_ok: detalle.filter((d) => d.conteo_ok).length,
    material_ok: detalle.filter((d) => d.material_ok === true).length,
    material_mal: detalle.filter((d) => d.material_ok === false).length,
    piezas_verdad: piezasV,
    piezas_extraccion: piezasE,
    detalle,
  };
}
