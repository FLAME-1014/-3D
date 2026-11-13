import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.join(workspace, 'auto-twin');
const web = path.join(workspace, 'canton-atlas', 'web');
const output = path.resolve(web, 'auto-twin');
// Vite clears its output directory. Bind it to the generated child of this site's root.
if (path.dirname(output) !== web || path.basename(output) !== 'auto-twin') throw new Error('Unexpected workshop site output');
try {
  const stat = await fs.lstat(output);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Workshop output must be a real generated directory');
  const entries = await fs.readdir(output);
  if (entries.length && !entries.includes('.generated-workshop')) throw new Error('Refusing to replace a directory without the workshop generation marker');
} catch (error) {if (error.code !== 'ENOENT') throw error}
const require = createRequire(path.join(project, 'package.json'));
const tsc = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
for (const args of [[tsc, '-b'], [vite, 'build', '--outDir', output, '--emptyOutDir']]) {
  const result = spawnSync(process.execPath, args, {cwd: project, stdio: 'inherit', windowsHide: true});
  if (result.error || result.status !== 0) throw new Error(result.error?.message || 'Workshop site build failed');
}
await fs.writeFile(path.join(output, '.generated-workshop'), 'Generated from auto-twin. Run node scripts/build-workshop-site.mjs.\n');
console.log('Workshop site ready: canton-atlas/web/auto-twin/');
