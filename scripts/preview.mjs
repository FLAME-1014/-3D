import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(workspace, 'canton-atlas/web');
const content = path.join(workspace, 'canton-atlas/content');
const refs = path.join(workspace, 'canton-atlas/refs');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.ktx2': 'image/ktx2'
};
export function createPreview({ configPath = path.join(workspace, '.local/amap.development.json') } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/immersive/poi-config.js') {
        let config = { enabled: false, key: '', securityJsCode: '' };
        try {
          const raw = JSON.parse(await fs.readFile(configPath, 'utf8'));
          if (typeof raw.key !== 'string' || typeof raw.securityJsCode !== 'string') throw new Error('Invalid configuration');
          config = { enabled: raw.enabled === true, key: raw.key, securityJsCode: raw.securityJsCode };
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
        res.writeHead(200, { 'Content-Type': types['.js'] });
        return res.end(req.method === 'HEAD' ? undefined : 'window.CANTON_AMAP = ' + JSON.stringify(config) + ';\n');
      }
      let root = web;
      let relative = pathname;
      if (pathname === '/content' || pathname.startsWith('/content/')) {
        root = content;
        relative = pathname.slice('/content'.length) || '/';
      } else if (pathname === '/refs' || pathname.startsWith('/refs/')) {
        // 立体书素材：refs/preview/<id>-cover|silhouette|silhouette-persp.png
        root = refs;
        relative = pathname.slice('/refs'.length) || '/';
      }
      const within = (candidate) => candidate === root || candidate.startsWith(root + path.sep);
      let target = path.resolve(root, '.' + relative);
      if (!within(target)) { res.writeHead(403); return res.end(); }
      const stat = await fs.stat(target);
      if (stat.isDirectory()) target = path.join(target, 'index.html');
      const real = await fs.realpath(target);
      if (!within(real)) { res.writeHead(403); return res.end(); }
      const data = await fs.readFile(real);
      res.writeHead(200, { 'Content-Type': types[path.extname(real)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500);
      res.end('Preview request failed');
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'export') {
    (async () => {
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      const { chromium } = require('playwright');

      const defaultIds = [
        'chenjiaci','yongqingfang','shamian','beijinglu','yuexiu-park','lizhiwan',
        'shangxiajiu','opera-museum','guangxiao','six-banyan','memorial-hall','yuntai',
        'nanyue-museum','baiyun','canton-tower','sacred-heart','gd-museum','opera-house'
      ];
      const parseList = (raw) => (raw || '').split(',').map(s => s.trim()).filter(Boolean);
      const idsArg = process.argv.find(a => a.startsWith('--ids='));
      const typesArg = process.argv.find(a => a.startsWith('--types='));
      const sizeArg = process.argv.find(a => a.startsWith('--size='));
      const outArg = process.argv.find(a => a.startsWith('--out='));
      const ids = idsArg ? parseList(idsArg.slice('--ids='.length)) : defaultIds;
      const types = typesArg ? parseList(typesArg.slice('--types='.length)) : ['cover', 'silhouette', 'silhouette-persp'];
      const size = sizeArg ? Number(sizeArg.slice('--size='.length)) || 800 : 800;
      const outDir = outArg ? outArg.slice('--out='.length) : path.join(workspace, 'canton-atlas', 'refs', 'preview');
      await fs.mkdir(outDir, { recursive: true });

      const server = createPreview();
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;

      const browser = await chromium.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
      });
      const page = await browser.newPage();
      let ok = 0, fail = 0;
      for (const id of ids) {
        for (const type of types) {
          const url = `${base}/export.html?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}&size=${size}`;
          try {
            await page.goto(url, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => window.__EXPORT_READY__ === true, { timeout: 60000 });
            const result = await page.evaluate(() => window.__EXPORT_RESULT__ || null);
            const error = await page.evaluate(() => window.__EXPORT_ERROR__ || null);
            if (error || !result) { throw new Error(error || 'no result'); }
            const base64 = result.replace(/^data:image\/png;base64,/, '');
            await fs.writeFile(path.join(outDir, `${id}-${type}.png`), Buffer.from(base64, 'base64'));
            ok++;
            console.log(`exported ${id}/${type} (${size}px)`);
          } catch (e) {
            fail++;
            console.error(`export failed ${id}/${type}: ${e.message}`);
          }
        }
      }
      await browser.close();
      await new Promise(resolve => server.close(resolve));
      console.log(`导出完成：成功 ${ok}，失败 ${fail}，目录 ${outDir}`);
      process.exitCode = fail ? 1 : 0;
    })().catch((e) => { console.error(e); process.exitCode = 1; });
  } else {
  const port = Number(process.env.PORT || 4188);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  const server = createPreview();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is occupied; choose another PORT or stop the previous preview.` : 'Preview failed to start'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Development preview: http://127.0.0.1:${port} (loopback only)`));
}

}