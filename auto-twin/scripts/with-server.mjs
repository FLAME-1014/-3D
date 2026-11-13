import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [relativeScript, ...args] = process.argv.slice(2);
if (!relativeScript) throw new Error('Usage: node scripts/with-server.mjs scripts/capture.mjs [arguments]');
const script = path.resolve(project, relativeScript);
if (!script.startsWith(path.join(project, 'scripts') + path.sep) || !script.endsWith('.mjs')) throw new Error('Expected a project verification script');
const url = 'http://127.0.0.1:4200';
const ready = async () => {
  try {
    const response = await fetch(url, {signal: AbortSignal.timeout(500)});
    return response.ok && (await response.text()).includes('src/main.tsx');
  } catch {return false}
};
let server, child;
try {
  if (!await ready()) {
    const require = createRequire(import.meta.url);
    const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
    server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', '4200', '--strictPort'], {cwd: project, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    let failure;
    server.stderr.on('data', data => {failure = data.toString()});
    const deadline = Date.now() + 15000;
    while (!await ready()) {
      if (server.exitCode !== null || Date.now() > deadline) throw new Error('Local service did not start: ' + (failure || 'timeout'));
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('Local workshop service is ready');
  }
  child = spawn(process.execPath, [script, ...args], {cwd: project, windowsHide: true, stdio: 'inherit'});
  process.exitCode = await new Promise((resolve, reject) => {child.on('error', reject); child.on('exit', code => resolve(code ?? 1))});
} finally {
  if (child?.exitCode === null) child.kill();
  if (server?.exitCode === null) server.kill();
}
