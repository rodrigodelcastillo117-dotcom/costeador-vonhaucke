// Fusión idempotente del acomodo guardado en la cotización.
//
// VH-109 · AcomodoBase guarda solo cada cambio (600 ms). Si cada guardado produce un objeto nuevo
// con el MISMO contenido, el componente se re-renderiza, vuelve a guardar y así cada ~650 ms; el
// autosave a la nube (1.5 s de calma) nunca llega a dispararse y el plan no se persiste. Aquí se
// decide, por contenido, si de verdad cambió algo. Sin cambios ⇒ el llamador conserva el estado.

const serializar = (v) => {
  try { return JSON.stringify(v ?? null); } catch (_e) { return null; }
};

export function fusionarAcomodo(previo, datos) {
  const base = previo && typeof previo === 'object' ? previo : {};
  const parche = datos && typeof datos === 'object' ? datos : {};
  const acomodo = { ...base, ...parche };
  const a = serializar(base);
  const b = serializar(acomodo);
  const sinCambios = a != null && b != null && a === b;
  return { acomodo: sinCambios ? base : acomodo, sinCambios };
}
