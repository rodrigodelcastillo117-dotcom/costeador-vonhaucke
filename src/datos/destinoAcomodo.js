// ============================================================================
// DESTINO SEMÁNTICO DEL MOBILIARIO
//
// La cotización sabe mucho más que el nombre comercial: las notas de Voni dicen
// "8 para la sala APP LT", "uno por oficina privada", "puesto de recepción",
// etc. Ese contexto se perdía al expandir las partidas y el planner terminaba
// repartiendo sillas/guardas por heurística. Guardamos el destino en un token
// OPACO dentro de `ruta` para que viaje hasta cada pieza sin cambiar el nombre,
// el precio ni el tipo del mueble.
// ============================================================================

export const DESTINO = {
  JUNTAS: 'juntas',
  PRIVADO: 'privado',
  RECEPCION: 'recepcion',
  OPEN: 'open',
};

const TOKEN = {
  [DESTINO.JUNTAS]: 'vh-dest-mtg',
  [DESTINO.PRIVADO]: 'vh-dest-prv',
  [DESTINO.RECEPCION]: 'vh-dest-rcp',
  [DESTINO.OPEN]: 'vh-dest-opn',
};

const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function inferirDestinoPartida(partida = {}) {
  const nombre = norm(partida.nombre);
  const nota = norm(partida.nota);
  const todo = `${nombre} ${nota}`;

  // Lo explícito gana. Recepción primero para que "silla operativa de recepción"
  // no caiga a open sólo por la palabra operativa.
  if (/recepci|lobby|mostrador|puesto de recepci|espera de recepci/.test(todo)) return DESTINO.RECEPCION;

  // Sala/mesa/sillería de reunión. También cubre notas como
  // "8 para la sala APP LT y 12 para la sala Cirque" aunque el nombre del banco
  // sea simplemente "Silla · SONATA".
  if (/sala(?:s)? de junta|sala junta|sala app\s*lt|sala cirque|\bjunta(?:s)?\b|consejo|boardroom|mesa de reunion/.test(todo)) {
    return DESTINO.JUNTAS;
  }

  // Privados/dirección. Archiveros y credenzas que Voni explica como "uno por
  // oficina privada" deben quedarse ahí y no acabar en el open space.
  if (/oficina(?:s)? privada|por oficina privada|\bprivado(?:s)?\b|direccion|directiv|ejecutiv|gerenc/.test(todo)) {
    return DESTINO.PRIVADO;
  }

  // Operación/bench. APARTADO con PAX es operativo en los planos reales.
  if (/\boperativ|\bbench\b|\bbanca\b|\bisla\b|\bapartado\b|open\s*space|puesto(?:s)? de trabajo/.test(todo)) {
    return DESTINO.OPEN;
  }
  return null;
}

export function marcarDestinoPartida(partida = {}) {
  const destino = inferirDestinoPartida(partida);
  if (!destino) return partida;
  const token = TOKEN[destino];
  const ruta = String(partida.ruta || '');
  if (ruta.includes(token)) return partida;
  return { ...partida, ruta: `${ruta} ${token}`.trim() };
}

export function destinoMarcado(pieza = {}) {
  const ruta = String(pieza.ruta || '');
  for (const [destino, token] of Object.entries(TOKEN)) {
    if (ruta.includes(token)) return destino;
  }
  return null;
}
