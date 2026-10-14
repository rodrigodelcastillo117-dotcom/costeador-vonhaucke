const D = new URL('.', import.meta.url).pathname;
export async function resolve(spec, ctx, next) {
  if (spec === '@electric-sql/pglite') return { url: 'file://' + D + 'shim_pglite.mjs', shortCircuit: true };
  if (spec === '@electric-sql/pglite/contrib/pgcrypto') return { url: 'file://' + D + 'shim_pgcrypto.mjs', shortCircuit: true };
  return next(spec, ctx);
}
