// ============================================================================
//  PROPUESTA VIVA  ·  la LOCURA (2026-10-03).
//  En vez de entregarle al cliente un PDF plano, se le entrega una EXPERIENCIA:
//  su futura oficina en 3D, que se revela con animación, con ambiente
//  "showroom" o "atardecer", su marca y los números clave. Como una página de
//  producto de Apple, pero de SU espacio.
//
//  Reutiliza el motor 3D determinista (PlanoAcomodo en modo iso) — no inventa
//  geometría ni toca costos. Es CLIENT-SAFE: sólo muestra lo que se le pasa
//  (sin márgenes, sin costos internos). Aditivo y reversible: es una capa de
//  presentación encima de datos que ya existen.
// ============================================================================
import { useState } from 'react';
import PlanoAcomodo from './PlanoAcomodo.jsx';
import { pesos } from '../util.js';

const dinero = (n) => (n == null || isNaN(n) || !isFinite(n) ? null : pesos(n));

// Resumen honesto del proyecto a partir de lo que el motor ya acomodó.
function resumen(areas, plan, byId) {
  // Las zonas DENTRO de otra (islas del open space en planos leídos) no cuentan
  // como cuarto propio ni suman su m² — si no, se infla el total y baja el $/m².
  const a = (Array.isArray(areas) ? areas : []).filter((r) => !r.dentroDe);
  const coloc = plan?.colocacion || [];
  const m2 = a.reduce((s, r) => {
    const base = r.poly && r.poly.length >= 3
      ? Math.abs(r.poly.reduce((acc, [x, y], i) => { const [x2, y2] = r.poly[(i + 1) % r.poly.length]; return acc + (x * y2 - x2 * y); }, 0)) / 2
      : (r.ancho || 0) * (r.largo || 0);
    return s + base;
  }, 0) / 1e6;
  let posiciones = 0;
  for (const c of coloc) {
    const p = byId?.[c.id];
    if (!p) continue;
    if (p.tipo === 'escritorio') {
      // Una banca larga son varios puestos (uno cada ~1.5 m del lado largo).
      const largo = Math.max(p.w || 0, p.d || 0);
      posiciones += Math.max(1, Math.round(largo / 1500)) * ((p.d || 0) > 1000 && (p.w || 0) > 1000 ? 2 : 1);
    }
  }
  return { areas: a.length, m2: Math.round(m2), muebles: coloc.length, posiciones };
}

export default function PropuestaViva({ areas, plan, byId, nombre = 'Tu nueva oficina', cliente = null, inversion = null, onCerrar }) {
  const [ambiente, setAmbiente] = useState('showroom'); // showroom | atardecer
  const r = resumen(areas, plan, byId);
  const inv = dinero(inversion);

  const chips = [
    r.areas ? { k: `${r.areas}`, t: r.areas === 1 ? 'zona' : 'zonas' } : null,
    r.m2 ? { k: `${r.m2}`, t: 'm² de oficina' } : null,
    r.posiciones ? { k: `${r.posiciones}`, t: 'posiciones de trabajo' } : null,
    r.muebles ? { k: `${r.muebles}`, t: 'muebles Vonhaucke' } : null,
    inv ? { k: inv, t: 'inversión', destacado: true } : null,
    // Métricas de decisión (CFO/CEO): precio por m² y por posición. Salen de la
    // MISMA inversión al cliente — siguen siendo client-safe, no exponen costo.
    inv && r.m2 ? { k: dinero(Math.round(inversion / r.m2)), t: 'por m²' } : null,
    inv && r.posiciones ? { k: dinero(Math.round(inversion / r.posiciones)), t: 'por posición' } : null,
  ].filter(Boolean);

  return (
    <div className={`pv pv-${ambiente}`}>
      <style>{CSS}</style>
      <div className="pv-glow" aria-hidden="true" />

      <header className="pv-top">
        <div className="pv-marca">
          <span className="pv-logo">VON<span className="pv-logo-h">HAUCKE</span></span>
          <span className="pv-tag">Mobiliario de oficina · desde 1958</span>
        </div>
        <button className="pv-cerrar" onClick={onCerrar}>Salir</button>
      </header>

      <div className="pv-hero">
        <div className="pv-kicker">Propuesta viva{cliente ? ` · ${cliente}` : ''}</div>
        <h1 className="pv-titulo">{nombre}</h1>
        <div className="pv-lead">Camina por tu futura oficina. Gírala, acércate — así se verá.</div>
      </div>

      <div className="pv-escenario">
        <div className="pv-stage">
          {areas?.length && plan
            ? <PlanoAcomodo areas={areas} plan={plan} byId={byId} modo="iso" />
            : <div className="pv-vacio">Cuando el proyecto tenga su acomodo, aquí cobra vida tu oficina en 3D.</div>}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="pv-chips">
          {chips.map((c, i) => (
            <div key={i} className={`pv-chip ${c.destacado ? 'pv-chip-x' : ''}`} style={{ animationDelay: `${0.15 + i * 0.09}s` }}>
              <div className="pv-chip-k">{c.k}</div>
              <div className="pv-chip-t">{c.t}</div>
            </div>
          ))}
        </div>
      )}

      <div className="pv-amb no-imprimir">
        <button className={`pv-amb-b ${ambiente === 'showroom' ? 'on' : ''}`} onClick={() => setAmbiente('showroom')}>Showroom</button>
        <button className={`pv-amb-b ${ambiente === 'atardecer' ? 'on' : ''}`} onClick={() => setAmbiente('atardecer')}>Atardecer</button>
      </div>
    </div>
  );
}

const CSS = `
.pv{position:fixed;inset:0;z-index:9999;overflow:auto;display:flex;flex-direction:column;align-items:center;
  padding:22px 18px 40px;color:#f3efe8;background:#0c1014;
  background:radial-gradient(120% 90% at 50% -10%, #1b232c 0%, #0c1014 60%, #07090c 100%);
  font-family:inherit;animation:pv-in .7s ease both;}
.pv-atardecer{background:radial-gradient(120% 90% at 50% -10%, #3a2a24 0%, #1d1512 55%, #0b0807 100%);}
.pv-glow{position:fixed;left:50%;top:-18%;width:120vw;height:70vh;transform:translateX(-50%);pointer-events:none;
  background:radial-gradient(closest-side, rgba(120,170,220,.22), rgba(120,170,220,0) 70%);filter:blur(10px);}
.pv-atardecer .pv-glow{background:radial-gradient(closest-side, rgba(240,170,90,.28), rgba(240,170,90,0) 70%);}

.pv-top{width:100%;max-width:1040px;display:flex;justify-content:space-between;align-items:center;gap:12px;}
.pv-marca{display:flex;flex-direction:column;line-height:1.05;}
.pv-logo{font-weight:800;font-size:19px;letter-spacing:.14em;}
.pv-logo-h{color:#e0564a;}
.pv-tag{font-size:11px;opacity:.6;letter-spacing:.04em;margin-top:2px;}
.pv-cerrar{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:999px;
  padding:9px 18px;font-weight:600;cursor:pointer;min-height:40px;}
.pv-cerrar:hover{background:rgba(255,255,255,.16);}

.pv-hero{text-align:center;margin:26px 0 8px;max-width:800px;animation:pv-up .8s .05s ease both;}
.pv-kicker{text-transform:uppercase;letter-spacing:.22em;font-size:12px;color:#e0564a;font-weight:700;margin-bottom:10px;}
.pv-titulo{font-size:clamp(30px,6vw,56px);font-weight:800;margin:0;line-height:1.02;}
.pv-lead{opacity:.72;font-size:clamp(14px,2.4vw,18px);margin-top:12px;}

.pv-escenario{width:100%;max-width:1040px;margin:22px 0 6px;animation:pv-pop 1s .12s cubic-bezier(.2,.8,.2,1) both;}
.pv-stage{border-radius:22px;overflow:hidden;background:#f4efe6;
  box-shadow:0 40px 90px -30px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.08), 0 0 120px -20px rgba(120,170,220,.25);}
.pv-atardecer .pv-stage{box-shadow:0 40px 90px -30px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.08), 0 0 130px -20px rgba(240,170,90,.35);}
.pv-stage .plano-wrap-3d{margin:0;}
.pv-vacio{padding:70px 24px;text-align:center;color:#6b645c;font-size:16px;}

.pv-chips{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:18px 0 6px;max-width:1040px;}
.pv-chip{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;
  padding:14px 20px;text-align:center;min-width:120px;animation:pv-up .6s ease both;}
.pv-chip-k{font-size:26px;font-weight:800;}
.pv-chip-t{font-size:12px;opacity:.65;margin-top:2px;letter-spacing:.02em;}
.pv-chip-x{background:linear-gradient(180deg, rgba(224,86,74,.22), rgba(224,86,74,.08));border-color:rgba(224,86,74,.5);}
.pv-chip-x .pv-chip-k{color:#ff8176;}

.pv-amb{display:flex;gap:8px;margin-top:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
  border-radius:999px;padding:5px;}
.pv-amb-b{background:transparent;border:none;color:#cfc8bf;border-radius:999px;padding:9px 20px;font-weight:600;cursor:pointer;min-height:40px;}
.pv-amb-b.on{background:#e0564a;color:#fff;}

@keyframes pv-in{from{opacity:0;}to{opacity:1;}}
@keyframes pv-up{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
@keyframes pv-pop{from{opacity:0;transform:translateY(26px) scale(.965);}to{opacity:1;transform:translateY(0) scale(1);}}
@media (prefers-reduced-motion: reduce){.pv,.pv-hero,.pv-escenario,.pv-chip{animation:none !important;}}
`;
