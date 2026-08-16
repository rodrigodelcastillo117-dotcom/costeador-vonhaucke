// ============================================================================
//  CATALOGO - dos pasos (master 7.3)
//  Paso 1: familias plegadas -> muebles.  Paso 2: lineas de ese mueble,
//  ordenadas de mas barata a mas cara. La mas barata lleva etiqueta verde.
// ============================================================================
import { useState } from 'react';
import { FAMILIAS, MUEBLES, LINEAS, lineasDeMueble, REGLAS_LINEA } from '../datos/catalogo.js';
import { PIEZAS_SEMILLA } from '../datos/piezas.js';
import { recetaBench } from '../datos/bench.js';
import { calcular } from '../motor/calculo.js';
import { pesos, idNuevo, coincide } from '../util.js';

// Busca receta semilla para una linea+mueble
function recetaDe(lineaId, muebleId) {
  return PIEZAS_SEMILLA.find((p) => p.linea === lineaId && p.mueble === muebleId);
}

function costoDeLinea(lineaId, muebleId, estado) {
  const receta = recetaDe(lineaId, muebleId);
  if (!receta) return null;
  return calcular(receta, 1, estado.insumos, estado.parametros).costoUnitario;
}

export default function Catalogo({ estado, onCargar, soloVentas = false }) {
  const [familiaAbierta, setFamiliaAbierta] = useState(null);
  // Los 7 proyectistas que van a usar esto dijeron lo mismo en el levantamiento:
  // prefieren UNA LISTA CON BUSCADOR a navegar por menús. El catálogo no tenía
  // buscador; había que adivinar en qué familia guardamos cada mueble.
  const [busca, setBusca] = useState('');
  const [mueble, setMueble] = useState(null); // {muebleId, familiaId}
  // En modo Ventas se muestra el precio recomendado (margen objetivo), nunca el costo.
  const margenObjetivo = estado.parametros.margenObjetivo ?? 40;
  const aMostrar = (costo) => (soloVentas ? costo / (1 - margenObjetivo / 100) : costo);

  // ---- Paso 2: lineas de un mueble ----
  if (mueble) {
    const lineas = lineasDeMueble(mueble.muebleId);
    const conCosto = lineas.map((l) => ({
      linea: l,
      costo: costoDeLinea(l.id, mueble.muebleId, estado),
    }));
    // Ordenar: las que tienen costo, de menor a mayor; luego las de solo gama
    conCosto.sort((a, b) => {
      if (a.costo != null && b.costo != null) return a.costo - b.costo;
      if (a.costo != null) return -1;
      if (b.costo != null) return 1;
      return a.linea.gama - b.linea.gama;
    });

    return (
      <div className="contenido">
        <button className="boton fantasma" onClick={() => setMueble(null)}>‹ Otras opciones</button>
        <h2 style={{ marginTop: 14 }}>{MUEBLES[mueble.muebleId]}</h2>
        <p className="ayuda">Escoge la línea. La más barata primero.</p>
        {conCosto.map(({ linea, costo }, idx) => (
          <div className="tarjeta" key={linea.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>{linea.nombre}</strong>
                {idx === 0 && costo != null && <span className="etiqueta-verde">MÁS BARATA</span>}
                {linea.confirmar && <span className="etiqueta-dato supuesto">confirmar</span>}
              </div>
              <div className="ayuda">{linea.que}{REGLAS_LINEA[linea.id]?.nota ? ' · ' + REGLAS_LINEA[linea.id].nota : ''}</div>
            </div>
            {costo != null ? <div className="dinero">{pesos(aMostrar(costo))}</div> : <span className="etiqueta-dato supuesto">sin receta</span>}
            <button className="boton primario" onClick={() => cargar(linea, mueble.muebleId, mueble.familiaId, estado, onCargar)}>{soloVentas ? 'Configurar →' : 'Usar'}</button>
          </div>
        ))}
      </div>
    );
  }

  // ---- Paso 1: familias -> muebles ----
  return (
    <div className="contenido">
      <h2>Catálogo</h2>
      <p className="ayuda columna-texto">Busca el mueble por su nombre, o ábrelo por familia. Se carga en el Costeador.</p>
      <input
        type="search" className="campo" value={busca} onChange={(e) => setBusca(e.target.value)}
        placeholder="Busca como se te ocurra: bench, archivero 2 cajones, mesa juntas, recepción…"
        style={{ marginBottom: 14, minHeight: 46 }}
      />
      {busca.trim() && (() => {
        // Buscando NO se navega por familias: sale la lista plana, que es lo que
        // pidieron. Se busca por el nombre del mueble Y por el de su familia,
        // porque un proyectista escribe "guarda" tanto como "archivero".
        const hits = [];
        for (const fam of FAMILIAS) for (const m of fam.muebles)
          if (coincide(busca, MUEBLES[m], fam.nombre)) hits.push({ m, fam });
        return (
          <div className="tarjeta" style={{ marginBottom: 16 }}>
            <div className="ayuda" style={{ marginBottom: 8 }}>
              {hits.length ? `${hits.length} mueble(s)` : 'Nada con esas palabras. Prueba con menos: "archivero", "bench", "junta".'}
            </div>
            {hits.map(({ m, fam }) => (
              <div className="renglon-insumo" key={fam.id + m}>
                <span className="nom"><strong>{MUEBLES[m]}</strong> <span className="gris">· {fam.nombre} · {lineasDeMueble(m).length} líneas</span></span>
                <button className="boton" onClick={() => setMueble({ muebleId: m, familiaId: fam.id })}>Ver líneas</button>
              </div>
            ))}
          </div>
        );
      })()}
      {!busca.trim() && FAMILIAS.map((fam) => {
        const abierta = familiaAbierta === fam.id;
        return (
          <div className={`plegable ${abierta ? 'conContenido' : ''}`} key={fam.id}>
            <div className="cabeza" onClick={() => setFamiliaAbierta(abierta ? null : fam.id)}>
              <span className="titulo">{fam.nombre}</span>
              <span className="subtotal gris" style={{ fontFamily: 'var(--sans)', fontWeight: 400 }}>{fam.muebles.length} muebles</span>
              <span className="flecha">{abierta ? '▲' : '▼'}</span>
            </div>
            {abierta && (
              <div className="cuerpo">
                {fam.muebles.map((m) => {
                  const nLineas = lineasDeMueble(m).length;
                  return (
                    <div className="renglon-insumo" key={m}>
                      <span className="nom"><strong>{MUEBLES[m]}</strong> <span className="gris">· {nLineas} lineas</span></span>
                      <button className="boton" onClick={() => setMueble({ muebleId: m, familiaId: fam.id })}>Ver lineas</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Aplica las reglas de linea (8.4): quita, sustituye o agrega insumos.
function aplicarReglas(componentes, lineaId, insumos) {
  const regla = REGLAS_LINEA[lineaId];
  if (!regla) return componentes.map((c) => ({ ...c }));
  let comps = componentes.map((c) => ({ ...c }));
  if (regla.quita) comps = comps.filter((c) => !regla.quita.includes(c.insumoId));
  if (regla.sustituye) {
    comps = comps.map((c) =>
      regla.sustituye[c.insumoId]
        ? { ...c, insumoId: regla.sustituye[c.insumoId], nombre: c.nombre }
        : c
    );
  }
  if (regla.agrega) {
    for (const id of regla.agrega) {
      if (!comps.some((c) => c.insumoId === id)) {
        comps.push({ insumoId: id, nombre: insumos[id]?.nombre || id, cantidad: 1 });
      }
    }
  }
  return comps;
}

function cargar(linea, muebleId, familiaId, estado, onCargar) {
  // Bench: se arma con el generador modular (8.5), no con receta fija
  if (muebleId === 'bench') {
    const bench = { personas: 4, lineaId: linea.id, divisor: 'divisor-melamina', faldon: false };
    const b = recetaBench(bench);
    onCargar({
      piezaId: idNuevo('bench'),
      nombre: `${linea.nombre} — Bench ${b.personas} usuarios`,
      linea: linea.nombre,
      piezas: 1,
      bench,
      benchDescripcion: b.descripcion,
      componentes: b.componentes,
      modoManoObra: 'horas',
      horas: b.horas,
      factorDirecta: 55,
      factorIndirecta: 12,
      preparacionHoras: 0,
      margen: 30,
    });
    return;
  }

  const receta = recetaDe(linea.id, muebleId);
  if (receta) {
    onCargar({
      piezaId: receta.id,
      nombre: receta.nombre,
      linea: linea.nombre,
      piezas: 1,
      componentes: aplicarReglas(receta.componentes, linea.id, estado.insumos),
      modoManoObra: receta.modoManoObra || 'horas',
      horas: { ...(receta.horas || {}) },
      factorDirecta: receta.factorDirecta ?? 55,
      factorIndirecta: receta.factorIndirecta ?? 12,
      preparacionHoras: receta.preparacionHoras || 0,
      margen: 30,
    });
  } else {
    // Sin receta: arranca en blanco con nombre y linea puestos
    onCargar({
      piezaId: idNuevo('pieza'),
      nombre: `${linea.nombre} — ${MUEBLES[muebleId]}`,
      linea: linea.nombre,
      piezas: 1,
      componentes: [],
      modoManoObra: 'porcentaje',
      horas: {},
      factorDirecta: 55,
      factorIndirecta: 12,
      preparacionHoras: 0,
      margen: 30,
    });
  }
}
