import fs from 'node:fs';

// Holdout v5.4 · el proceso que escucha en el puerto del baseURL (Linux, /proc): de qué checkout es y con qué argumentos se lanzó.
// NODE_OPTIONS y las opciones de node cuentan como argumentos (la lista permitida las rechaza). Sin /proc ⇒ null.
export function servidorEnPuerto(puerto, raiz) {
  const hex = ':' + Number(puerto).toString(16).toUpperCase().padStart(4, '0');
  const inodos = new Set();
  for (const f of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch (_e) { continue; }
    for (const l of t.split('\n').slice(1)) { const c = l.trim().split(/\s+/); if (c[1]?.endsWith(hex) && c[3] === '0A') inodos.add(c[9]); }
  }
  let pids = []; try { pids = fs.readdirSync('/proc').filter((d) => /^\d+$/.test(d)); } catch (_e) { return null; }
  const real = (p) => { try { return fs.realpathSync(p); } catch (_e) { return p; } };
  const procesos = [];
  for (const pid of pids) {
    let fds = []; try { fds = fs.readdirSync(`/proc/${pid}/fd`); } catch (_e) { continue; }
    if (!fds.some((fd) => { try { const m = fs.readlinkSync(`/proc/${pid}/fd/${fd}`).match(/^socket:\[(\d+)\]$/); return m && inodos.has(m[1]); } catch (_e) { return false; } })) continue;
    const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean);
    const iVite = cmd.findIndex((x, i) => i > 0 && /\/node_modules\/(\.bin\/vite|vite\/bin\/vite\.js)$/.test(x));
    const nodeOpts = (fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').find((e) => e.startsWith('NODE_OPTIONS=')) || '').slice('NODE_OPTIONS='.length).trim();
    const cwd = real(fs.readlinkSync(`/proc/${pid}/cwd`));
    procesos.push({
      mismoCheckout: iVite > 0 && cwd === real(raiz) && real(cmd[iVite]).startsWith(real(raiz) + '/node_modules/'),
      argumentos: [...(nodeOpts ? nodeOpts.split(/\s+/) : []), ...(iVite > 0 ? [...cmd.slice(1, iVite), ...cmd.slice(iVite + 1)] : cmd.slice(1))],
    });
  }
  if (!procesos.length) return null;
  // Más de un proceso en el puerto (p. ej. uno en IPv4 y otro en IPv6): no se sabe cuál contestó ⇒ no cuenta como este checkout.
  return { mismoCheckout: procesos.length === 1 && procesos[0].mismoCheckout, argumentos: procesos.flatMap((p) => p.argumentos), procesos: procesos.length };
}
