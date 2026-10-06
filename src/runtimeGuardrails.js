// UX guardrails shared across the app.
// Important: this module NEVER bypasses business gates. It only makes blocked
// actions explain themselves instead of feeling like dead buttons.

let toastTimer = null;
function showToast(message) {
  const old = document.getElementById('vh-runtime-toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'vh-runtime-toast';
  el.setAttribute('role', 'status');
  el.style.cssText = [
    'position:fixed','left:50%','bottom:24px','transform:translateX(-50%)',
    'z-index:2147483647','max-width:min(680px,calc(100vw - 28px))','padding:12px 16px',
    'border-radius:10px','background:#1d1d1f','color:#fff','border:1px solid #d33b30',
    'box-shadow:0 10px 30px rgba(0,0,0,.35)','font:600 14px/1.4 system-ui,sans-serif'
  ].join(';');
  el.textContent = message;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 5200);
}

function nearestBlockingMessage() {
  const selectors = [
    '.aviso.rojo .texto', '.aviso.ambar .texto', '.alerta.roja .texto', '.alerta.ambar .texto',
    '.aviso.rojo', '.aviso.ambar', '.alerta.roja', '.alerta.ambar'
  ];
  for (const s of selectors) {
    const el = document.querySelector(s);
    const txt = el?.textContent?.replace(/\s+/g, ' ').trim();
    if (txt) return { el, txt };
  }
  return null;
}

// Disabled form controls do not dispatch click consistently. pointerdown is
// observed at document level and elementFromPoint lets us identify the control
// without enabling it. This preserves fail-closed emission rules.
document.addEventListener('pointerdown', (e) => {
  const hit = document.elementFromPoint?.(e.clientX, e.clientY);
  const btn = hit?.closest?.('button');
  if (!btn || !btn.disabled) return;
  const label = (btn.textContent || '').trim().toLowerCase();
  const title = btn.getAttribute('title')?.trim();
  const explicit = btn.getAttribute('data-disabled-reason')?.trim();
  const busy = /generando|analizando|verificando|cargando|guardando|subiendo|armando/.test(label);
  const blocking = nearestBlockingMessage();
  const why = explicit || title || (busy ? 'La operación está en curso.' : blocking?.txt) || 'Esta acción necesita completar un paso anterior.';
  showToast(`Todavía no: ${why}`);
  if (!busy) blocking?.el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}, true);

// If a browser print dialog cannot be opened, the native call may fail silently
// in some embedded/mobile contexts. Expose a reusable safe helper; components
// may use it without duplicating compatibility handling.
window.vhPrint = function vhPrint() {
  try {
    if (typeof window.print !== 'function') throw new Error('Impresión no disponible en este navegador.');
    window.focus?.();
    window.print();
    return true;
  } catch (err) {
    showToast(err?.message || 'No se pudo abrir la impresión. Usa Descargar PDF.');
    return false;
  }
};
