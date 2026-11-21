import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(workspace, 'solar-atlas');
const web = path.join(workspace, 'canton-atlas', 'web');
const output = path.resolve(web, 'solar-atlas');
if (path.dirname(output) !== web || path.basename(output) !== 'solar-atlas') throw new Error('Unexpected solar atlas output path.');
try {
  const stat = await fs.lstat(output);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Solar atlas output must be a real generated directory.');
  const entries = await fs.readdir(output);
  if (entries.length && !entries.includes('.generated-solar-atlas')) throw new Error('Refusing to replace a directory without the generation marker.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }

await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, '.generated-solar-atlas'), 'Generated from solar-atlas by scripts/build-solar-atlas-site.mjs.\n');
await fs.writeFile(path.join(output, '.gitignore'), '*\n');
for (const file of ['index.html', 'styles.css', 'favicon.svg', 'ATTRIBUTION.md']) await fs.copyFile(path.join(source, file), path.join(output, file));
for (const directory of ['src', 'assets']) await fs.cp(path.join(source, directory), path.join(output, directory), { recursive: true });
await fs.writeFile(path.join(output, 'config.js'), "window.SOLAR_ATLAS_CONFIG = Object.freeze({ dataTransport: 'direct', deployment: 'github-pages' });\n");
await fs.writeFile(path.join(output, 'build-info.json'), JSON.stringify({ commit: process.env.GITHUB_SHA || 'local', builtAt: new Date().toISOString(), sitePath: '/solar-atlas/' }, null, 2));
console.log('Solar atlas site ready: canton-atlas/web/solar-atlas/ (static data transport)');
