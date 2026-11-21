import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.dirname(fileURLToPath(import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const cache = new Map();

export function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/weather' || url.pathname === '/api/solar-wind') {
        const solar = url.pathname === '/api/solar-wind';
        const lat = Math.max(-90, Math.min(90, Number(url.searchParams.get('lat') ?? 26.1)));
        const lon = Math.max(-180, Math.min(180, Number(url.searchParams.get('lon') ?? 119.0)));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) { res.writeHead(400); res.end('{}'); return; }
        const remote = solar
          ? 'https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json'
          : `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC`;
        let item = cache.get(remote);
        if (!item || Date.now() - item.time > 300000) {
          const response = await fetch(remote, { signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error(`Upstream ${response.status}`);
          item = { time: Date.now(), data: await response.json() };
          cache.set(remote, item);
        }
        res.writeHead(200, { 'Content-Type': mime['.json'], 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ fetchedAt: new Date(item.time).toISOString(), source: solar ? 'NOAA SWPC' : 'Open-Meteo', data: item.data }));
        return;
      }
      const requested = decodeURIComponent(url.pathname);
      let target = path.resolve(root, `.${requested}`);
      const within = p => p === root || p.startsWith(root + path.sep);
      if (!within(target)) { res.writeHead(403); res.end(); return; }
      const stat = await fs.stat(target);
      if (stat.isDirectory()) target = path.join(target, 'index.html');
      target = await fs.realpath(target);
      if (!within(target)) { res.writeHead(403); res.end(); return; }
      const data = await fs.readFile(target);
      res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': target.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=86400' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      const api = req.url.startsWith('/api/');
      res.writeHead(api ? 503 : error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': mime['.json'] });
      res.end(JSON.stringify({ error: api ? '当前数据服务不可用，请稍后重试。' : 'File not found', available: false }));
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.SOLAR_PORT || 4208);
  const server = createServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is occupied. Set SOLAR_PORT to another port.` : error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Solar Atlas: http://127.0.0.1:${port}/`));
}
