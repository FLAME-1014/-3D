import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';

const scriptFile = fileURLToPath(import.meta.url);
const exclusions = ['node_modules', '.npm-cache', '.tools'];
const manifestName = 'backup-manifest.json';
const requiredFiles = [
  'package.json', 'package-lock.json', 'README.md', 'index.html',
  'src/main.tsx', 'src/app/App.tsx', 'src/scene/engine.ts',
  'specs/architecture.md', 'docs/progress.md', 'docs/acceptance-plan.md',
  'dist/index.html',
];
const samePath = (a, b) => process.platform === 'win32'
  ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
  : path.resolve(a) === path.resolve(b);
const inside = (base, candidate) => {
  const relative = path.relative(base, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};
const exists = async filename => {
  try {await fs.lstat(filename); return true} catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};
const sha256 = async filename => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
};

export async function resolveBackupPaths(stage) {
  if (!/^[1-9]\d{0,14}$/.test(stage || '')) throw new Error('Stage must be a positive integer of at most 15 digits');
  const source = path.resolve(path.dirname(scriptFile), '..');
  if (path.basename(source) !== 'auto-twin') throw new Error('Backup script must belong to the auto-twin project');
  const workspace = await fs.realpath(path.dirname(source));
  if (!samePath(await fs.realpath(source), path.join(workspace, 'auto-twin'))) {
    throw new Error('Project source resolves outside the expected workspace');
  }
  const pkg = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'));
  if (pkg.name !== 'automotive-digital-twin') throw new Error('Unexpected project package name');
  const backupRoot = path.join(workspace, '工厂备份');
  const target = path.join(backupRoot, `工厂_第${stage}步完成`);
  if (!inside(workspace, backupRoot) || !inside(backupRoot, target) || path.dirname(target) !== backupRoot) {
    throw new Error('Backup target escaped the workspace backup directory');
  }
  if (await exists(backupRoot)) {
    const entry = await fs.lstat(backupRoot);
    if (entry.isSymbolicLink() || !entry.isDirectory() || !samePath(await fs.realpath(backupRoot), backupRoot)) {
      throw new Error('Backup directory must be a real directory inside the workspace');
    }
  }
  if (await exists(target)) throw new Error(`Stage backup already exists; refusing to overwrite it: ${target}`);
  return {stage, source, workspace, backupRoot, target};
}

async function inventory(root) {
  const files = [], directories = [];
  async function visit(relative = '') {
    const entries = await fs.readdir(path.join(root, relative), {withFileTypes: true});
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (exclusions.includes(entry.name)) continue;
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      const full = path.join(root, name);
      const stat = await fs.lstat(full);
      if (stat.isSymbolicLink()) throw new Error(`Symbolic links/junctions are not supported in backups: ${name}`);
      if (stat.isDirectory()) {directories.push(name); await visit(name)}
      else if (stat.isFile()) files.push({path: name, bytes: stat.size, modifiedMs: stat.mtimeMs});
      else throw new Error(`Unsupported backup entry: ${name}`);
    }
  }
  await visit();
  return {files, directories, fileCount: files.length, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0)};
}

function assertMatchingInventories(expected, actual, checkModified = false) {
  if (expected.fileCount !== actual.fileCount || expected.totalBytes !== actual.totalBytes ||
      JSON.stringify(expected.directories) !== JSON.stringify(actual.directories)) {
    throw new Error('Backup file/directory count or total size does not match the source');
  }
  for (let index = 0; index < expected.files.length; index++) {
    const source = expected.files[index], copy = actual.files[index];
    if (source.path !== copy.path || source.bytes !== copy.bytes || (checkModified && source.modifiedMs !== copy.modifiedMs)) {
      throw new Error(`Source changed or copied file differs: ${source.path}`);
    }
  }
}

const isKeyFile = filename => requiredFiles.includes(filename) ||
  /^(src|specs|scripts|dist)\//.test(filename) ||
  /^docs\/.*\.(md|json)$/.test(filename);

// The destination directory is created before this function runs. Copy each
// source child into a child path that cannot already exist, rather than asking
// fs.cp to copy the source directory onto the already-created destination.
export async function copySourceEntries(source, destination) {
  const entries = await fs.readdir(source, {withFileTypes: true});
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (exclusions.includes(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    await fs.cp(from, to, {
      recursive: entry.isDirectory(),
      force: false,
      errorOnExist: true,
    });
  }
}

export async function createBackup(stage, {checkOnly = false} = {}) {
  const paths = await resolveBackupPaths(stage);
  if (checkOnly) return {...paths, mode: 'check-only', status: 'ready'};
  const {source, backupRoot, target} = paths;
  const original = await inventory(source);
  const names = new Set(original.files.map(file => file.path));
  for (const required of requiredFiles) if (!names.has(required)) throw new Error(`Required project file is missing: ${required}`);
  if (names.has(manifestName)) throw new Error(`Project root contains the reserved backup manifest: ${manifestName}`);
  const keys = {};
  for (const file of original.files.filter(file => isKeyFile(file.path))) keys[file.path] = await sha256(path.join(source, file.path));
  await fs.mkdir(backupRoot, {recursive: true});
  // Recheck resolved boundaries after creating the parent and before writing any backup data.
  await resolveBackupPaths(stage);
  const temporary = path.join(backupRoot, `.工厂_第${stage}步完成.incomplete-${randomUUID()}`);
  if (!inside(backupRoot, temporary)) throw new Error('Temporary backup target escaped backup directory');
  await fs.mkdir(temporary);
  try {
    await copySourceEntries(source, temporary);
    const copied = await inventory(temporary);
    assertMatchingInventories(original, copied);
    for (const [filename, expected] of Object.entries(keys)) {
      if (await sha256(path.join(temporary, filename)) !== expected || await sha256(path.join(source, filename)) !== expected) {
        throw new Error(`SHA-256 verification failed or source changed: ${filename}`);
      }
    }
    // A source changed during copying is not a coherent stage snapshot.
    assertMatchingInventories(original, await inventory(source), true);
    const manifest = {
      schemaVersion: 1, status: 'complete', stage, createdAt: new Date().toISOString(),
      source, workspace: paths.workspace, target, exclusions,
      sourceFileCount: original.fileCount, sourceDirectoryCount: original.directories.length,
      sourceBytes: original.totalBytes, manifestExcludedFromSourceTotals: true,
      verification: {filePathsAndSizes: 'matched', sourceUnchangedDuringCopy: true, keyFilesSha256: keys},
      files: original.files.map(({path: filename, bytes}) => ({path: filename, bytes})),
      directories: original.directories,
    };
    await fs.writeFile(path.join(temporary, manifestName), JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
    const written = JSON.parse(await fs.readFile(path.join(temporary, manifestName), 'utf8'));
    if (written.status !== 'complete' || written.sourceFileCount !== original.fileCount) throw new Error('Backup manifest verification failed');
    await resolveBackupPaths(stage); // Refuse a target created while this copy was running.
    await fs.rename(temporary, target);
    return {...paths, status: 'complete', fileCount: original.fileCount, bytes: original.totalBytes, manifest: path.join(target, manifestName)};
  } catch (error) {
    // Preserve partial evidence for inspection; never recursively delete a failed backup.
    await fs.writeFile(path.join(temporary, 'backup-failure.json'), JSON.stringify({
      status: 'incomplete', stage, source, intendedTarget: target,
      failedAt: new Date().toISOString(), error: error.message,
    }, null, 2) + '\n', {flag: 'wx'}).catch(() => {});
    throw new Error(`Backup failed; incomplete files retained at ${temporary}: ${error.message}`, {cause: error});
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 2 || (args.length === 2 && args[1] !== '--check')) {
    throw new Error('Usage: node scripts/backup.mjs STAGE [--check]');
  }
  console.log(JSON.stringify(await createBackup(args[0], {checkOnly: args[1] === '--check'}), null, 2));
}
if (process.argv[1] && samePath(process.argv[1], scriptFile)) {
  main().catch(error => {console.error(error.message); process.exitCode = 1});
}
