import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const vitest = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
const tsc = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin/tsc');
const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const root = 'docs/verification/stage-10';
await fs.mkdir(path.join(project, root));
const report = {status: 'running', startedAt: new Date().toISOString(), runtime: process.version, checks: []};
const write = () => fs.writeFile(path.join(project, 'docs/verification/stage-10-validation.json'), JSON.stringify(report, null, 2) + '\n');
await write();
const commands = [
  ['logic-tests', [vitest, 'run']],
  ['tools-tests', ['--test', 'scripts/capture-checks.mjs', 'scripts/media-checks.mjs', 'scripts/backup-checks.mjs']],
  ['typecheck', [tsc, '-b']],
  ['build', [vite, 'build']],
  ['assets-check', ['scripts/assets.mjs', '--check']],
  ['summary-check', ['scripts/summarize-evidence.mjs']],
  ['browser', ['scripts/with-server.mjs', 'scripts/verify.mjs', '--strict-images', '--output', root + '/browser']],
  ['park', ['scripts/with-server.mjs', 'scripts/park.mjs', root + '/park']],
];
try {
  for (const [name, args] of commands) {
    const startedAt = new Date().toISOString();
    const child = spawn(process.execPath, args, {cwd: project, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => {output += data.toString(); process.stdout.write(data)});
    const code = await new Promise((resolve, reject) => {child.on('error', reject); child.on('exit', code => resolve(code ?? 1))});
    const log = root + '/' + name + '.log';
    await fs.writeFile(path.join(project, log), output);
    report.checks.push({name, command: [process.execPath, ...args], status: code === 0 ? 'passed' : 'failed', exitCode: code, startedAt, finishedAt: new Date().toISOString(), log});
    await write();
    if (code !== 0) throw new Error(name + ' failed; see ' + log);
  }
  report.status = 'passed';
} catch (error) {report.status = 'failed'; report.failure = error.message; process.exitCode = 1}
finally {report.finishedAt = new Date().toISOString(); await write()}
console.log(JSON.stringify({status: report.status, passed: report.checks.filter(check => check.status === 'passed').length, report: 'docs/verification/stage-10-validation.json', failure: report.failure}, null, 2));
