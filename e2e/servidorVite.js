import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const realDe = (p) => { try { return fs.realpathSync(p); } catch (_e) { return p; } };
// El vite del proceso es de ESTE checkout: su ruta resuelta vive bajo el node_modules de este checkout, también si
// node_modules es un enlace a otra carpeta (worktrees que comparten dependencias).
const viteDeEsteCheckout = (rutaVite, raiz) => {
  const nm = realDe(path.join(raiz, 'node_modules'));
  return realDe(rutaVite).startsWith(nm + '/') || realDe(rutaVite).startsWith(realDe(raiz) + '/node_modules/');
};

// macOS (sin /proc): lsof da el proceso que escucha y su carpeta; `ps eww` su comando y su entorno (NODE_OPTIONS).
function servidorEnPuertoMac(puerto, raiz) {
  const sh = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_e) { return ''; } };
  const pids = [...new Set(sh('lsof', ['-nP', `-iTCP:${puerto}`, '-sTCP:LISTEN', '-t']).split('\n').map((x) => x.trim()).filter(Boolean))];
  if (!pids.length) return null;
  const procesos = pids.map((pid) => {
    const cmd = sh('ps', ['-o', 'command=', '-ww', '-p', pid]).trim().split(/\s+/).filter(Boolean);
    const env = sh('ps', ['eww', '-o', 'command=', '-p', pid]);
    const nodeOpts = ((env.match(/(?:^|\s)NODE_OPTIONS=(\S*)/) || [])[1] || '').trim();
    const cwd = realDe((sh('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn']).split('\n').find((l) => l.startsWith('n')) || 'n').slice(1));
    const iVite = cmd.findIndex((x, i) => i > 0 && /\/node_modules\/(\.bin\/vite|vite\/bin\/vite\.js)$/.test(x));
    return {
      mismoCheckout: iVite > 0 && cwd === realDe(raiz) && viteDeEsteCheckout(cmd[iVite], raiz),
      argumentos: [...(nodeOpts ? nodeOpts.split(/\s+/) : []), ...(iVite > 0 ? [...cmd.slice(1, iVite), ...cmd.slice(iVite + 1)] : cmd.slice(1))],
    };
  });
  return { mismoCheckout: procesos.length === 1 && procesos[0].mismoCheckout, argumentos: procesos.flatMap((p) => p.argumentos), procesos: procesos.length };
}

// Holdout v5.4 · el proceso que escucha en el puerto del baseURL (Linux, /proc; macOS, lsof/ps): de qué checkout es y con
// qué argumentos se lanzó. NODE_OPTIONS y las opciones de node cuentan como argumentos (la lista permitida las rechaza).
export function servidorEnPuerto(puerto, raiz) {
  if (process.platform === 'darwin') return servidorEnPuertoMac(puerto, raiz);
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
      mismoCheckout: iVite > 0 && cwd === real(raiz) && viteDeEsteCheckout(cmd[iVite], raiz),
      argumentos: [...(nodeOpts ? nodeOpts.split(/\s+/) : []), ...(iVite > 0 ? [...cmd.slice(1, iVite), ...cmd.slice(iVite + 1)] : cmd.slice(1))],
    });
  }
  if (!procesos.length) return null;
  // Más de un proceso en el puerto (p. ej. uno en IPv4 y otro en IPv6): no se sabe cuál contestó ⇒ no cuenta como este checkout.
  return { mismoCheckout: procesos.length === 1 && procesos[0].mismoCheckout, argumentos: procesos.flatMap((p) => p.argumentos), procesos: procesos.length };
}
