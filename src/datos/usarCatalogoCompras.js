import { useEffect, useMemo, useState } from 'react';
import { leerCatalogoComprasEconomico } from '../nube.js';
import { construirCatalogoCompras } from './catalogoComprasEfectivo.js';

// Catálogo enriquecido VIVO, local a la vista. No entra a estado.insumos ni a
// autosave de config: las 33 cotizaciones legacy y los precios compartidos
// existentes no se alteran por abrir esta pantalla.
export function usarCatalogoCompras(insumosBase = {}, habilitado = true) {
  const [data, setData] = useState(null);
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!habilitado) {
      setData(null); setError(''); setEstado('sin-permiso');
      return;
    }
    let vivo = true;
    leerCatalogoComprasEconomico().then((d) => {
      if (!vivo) return;
      setData(d); setError(''); setEstado('conectado');
    }).catch((err) => {
      if (!vivo) return;
      setData(null); setError(String(err?.message || 'No se pudo leer Compras'));
      setEstado('sin-conexion');
    });
    return () => { vivo = false; };
  }, [habilitado]);
  const economia = useMemo(() => construirCatalogoCompras(
    insumosBase,
    data?.referencias || [], data?.precios || [], data?.mapeos || [],
  ), [insumosBase, data]);
  return { ...economia, estado, error, mapeosRestringidos: !!data?.mapeosRestringidos };
}
