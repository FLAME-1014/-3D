import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = path.dirname(root);
await fs.mkdir(path.join(root, 'assets/vendor'), { recursive: true });
await fs.mkdir(path.join(root, 'assets/textures'), { recursive: true });
await fs.mkdir(path.join(root, 'assets/catalog'), { recursive: true });
for (const [from, to] of [
  ['build/three.module.js', 'three.module.js'], ['build/three.core.js', 'three.core.js'],
  ['controls/OrbitControls.js', 'OrbitControls.js'], ['LICENSE', 'THREE-LICENSE.txt']
]) await fs.copyFile(path.join(parent, 'canton-atlas/web/aero-engine/vendor', from), path.join(root, 'assets/vendor', to));

const assets = [
  ['planets/sun_sss-4k.jpg', 'textures/sun.jpg'],
  ['planets/mercury-2k.jpg', 'textures/mercury.jpg'],
  ['planets/venus_atmosphere-2k.jpg', 'textures/venus.jpg'],
  ['planets/earth_daymap-2k.jpg', 'textures/earth.jpg'],
  ['planets/earth_nightmap-2k.jpg', 'textures/earth-night.jpg'],
  ['planets/earth_clouds_nasa-2k.jpg', 'textures/earth-clouds.jpg'],
  ['planets/moon-2k.jpg', 'textures/moon.jpg'],
  ['planets/mars-2k.jpg', 'textures/mars.jpg'],
  ['planets/jupiter-2k.jpg', 'textures/jupiter.jpg'],
  ['planets/saturn-2k.jpg', 'textures/saturn.jpg'],
  ['planets/saturn-ring-2k.png', 'textures/saturn-ring.png'],
  ['planets/uranus-2k.jpg', 'textures/uranus.jpg'],
  ['planets/neptune-2k.jpg', 'textures/neptune.jpg'],
  ['planets/pluto_nh-2k.jpg', 'textures/pluto.jpg'],
  ['sky/milky-way-8k.jpg', 'textures/milky-way.jpg'],
  ['sky/catalog.json', 'catalog/constellations.json'],
  ['sky/dso.json', 'catalog/dso.json'],
  ['sky/stars/bright-names.json', 'catalog/bright-stars.json'],
  ['sky/STELLARIUM-CREDITS.md', 'catalog/STELLARIUM-CREDITS.md']
];
const results = [];
for (let i = 0; i < assets.length; i += 4) {
  const group = await Promise.allSettled(assets.slice(i, i + 4).map(async ([remote, local]) => {
    const target = path.join(root, 'assets', local);
    const url = `https://solar-system-atlas.pages.dev/${remote}`;
    try { const stat = await fs.stat(target); if (stat.size > 100) return { local, bytes: stat.size, cached: true, url }; } catch {}
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`${remote}: HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(target, data);
    return { local, bytes: data.length, url };
  }));
  for (const result of group) {
    if (result.status === 'fulfilled') { results.push(result.value); console.log(`${result.value.local}: ${Math.round(result.value.bytes / 1024)} KB`); }
    else { console.error(result.reason.message); process.exitCode = 1; }
  }
}
await fs.writeFile(path.join(root, 'assets/manifest.json'), JSON.stringify({ downloadedAt: new Date().toISOString(), assets: results }, null, 2));
