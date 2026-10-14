// Gateway mínimo con las rutas de Supabase: /auth/v1 → GoTrue, /rest/v1 → PostgREST (como Kong en la nube).
import http from 'node:http';
const destino = (u) => (u.startsWith('/auth/v1') ? { port: 59999, path: u.slice(8) || '/' } : u.startsWith('/rest/v1') ? { port: 59998, path: u.slice(8) || '/' } : null);
http.createServer((req, res) => {
  const d = destino(req.url);
  if (!d) { res.writeHead(404); return res.end(); }
  const p = http.request({ host: '127.0.0.1', port: d.port, path: d.path, method: req.method, headers: { ...req.headers, host: '127.0.0.1' } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  p.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(p);
}).listen(59990, '127.0.0.1');
