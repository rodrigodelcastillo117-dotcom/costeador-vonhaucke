// Cierre ChatGPT v3 (C7 ×3 en producción): 1 de 3 lecturas del MISMO plano salió con cotas mal leídas por la IA y la
// validación geométrica determinista del servidor la rechazó (FLOOR_SPEC_INVALID) — correcto: no entró ningún dato malo,
// pero la persona tenía que volver a subir el plano. Ahora: UNA segunda lectura automática sólo en ese caso. El validador
// no se relaja; si la segunda también falla, se muestra el error (con `reintentado: true`). Nunca más de un reintento.
export async function lecturaConReintento(leerUnaVez) {
  const r1 = await leerUnaVez();
  if (!(r1 && r1.ok === false && r1.code === 'FLOOR_SPEC_INVALID')) return r1;
  const r2 = await leerUnaVez();
  if (r2 && r2.ok === false) return { ...r2, reintentado: true, primerRechazo: r1.floorSpec?.validation?.issues || null };
  return r2 && typeof r2 === 'object' ? { ...r2, reintentoGeometrico: true } : r2;
}
