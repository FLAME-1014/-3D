import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(projectRoot, 'docs', 'assets-manifest.json');
const argumentsList = process.argv.slice(2);
if (argumentsList.includes('--help')) {
  console.log('npm run assets [-- --check]\nGenerate SHA-256 inventory from current procedural sources and package lock; --check validates the existing manifest without changing it.');
  process.exit(0);
}
if (argumentsList.some(argument => argument !== '--check')) throw new Error('Only --check and --help are supported');
const checkOnly = argumentsList.includes('--check');
const modelVersion = 'procedural-v1';
const normalize = value => value.split(path.sep).join('/');
async function walk(directory) {
  const entries = await fs.readdir(directory, {withFileTypes: true});
  const paths = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(entryPath));
    else if (entry.isFile()) paths.push(normalize(path.relative(projectRoot, entryPath)));
  }
  return paths;
}
const requiredSources = ['src/scene/stamping.ts', 'src/welding/scene.ts', 'src/core/clock.ts', 'src/core/production.ts', 'src/welding/logic.ts'];
const allSources = await walk(path.join(projectRoot, 'src'));
function includeSource(relativePath) {
  if (!relativePath.endsWith('.ts') || /\.(test|spec)\.ts$/.test(relativePath)) return false;
  return relativePath.startsWith('src/prefabs/') || relativePath.startsWith('src/park/') || requiredSources.includes(relativePath) || /(^|\/)lod[^/]*\.ts$/i.test(relativePath);
}
const sourcePaths = allSources.filter(includeSource).sort();
const missingRequired = requiredSources.filter(source => !sourcePaths.includes(source));
if (missingRequired.length) throw new Error(`Required procedural source missing: ${missingRequired.join(', ')}`);
function category(relativePath) {
  if (/\/lod[^/]*\.ts$/i.test(relativePath)) return 'lod-policy';
  if (relativePath === 'src/prefabs/materials.ts') return 'procedural-material-textures';
  if (relativePath === 'src/prefabs/sparks.ts') return 'procedural-particles';
  if (relativePath.startsWith('src/prefabs/')) return 'procedural-model-prefab';
  if (relativePath.startsWith('src/park/')) return 'procedural-park-scene';
  if (relativePath.endsWith('/stamping.ts') || relativePath.endsWith('/scene.ts')) return 'procedural-shop-scene';
  if (relativePath.endsWith('/clock.ts')) return 'production-clock';
  return 'deterministic-production-logic';
}
async function checksum(relativePath) {
  const content = await fs.readFile(path.join(projectRoot, relativePath));
  return {path: relativePath, bytes: content.byteLength, sha256: crypto.createHash('sha256').update(content).digest('hex')};
}
const sources = await Promise.all(sourcePaths.map(async relativePath => ({
  id: `procedural:${relativePath.replace(/^src\//, '').replace(/\.ts$/, '').replaceAll('/', ':')}`,
  version: modelVersion, category: category(relativePath), ...await checksum(relativePath),
  origin: {kind: 'self-authored-procedural-source', originalFormat: 'TypeScript', externalAssetUrl: null, externalAssetLicense: null, originalDownload: null, usdToGlbConversion: null},
})));
const configurationFiles = await Promise.all(['package.json', 'package-lock.json'].map(checksum));
const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const lock = JSON.parse(await fs.readFile(path.join(projectRoot, 'package-lock.json'), 'utf8'));
if (!lock.packages) throw new Error('package-lock.json must contain the resolved packages table');
const dependencies = [];
for (const group of ['dependencies', 'devDependencies']) {
  for (const [name, requestedRange] of Object.entries(packageJson[group] || {}).sort(([a], [b]) => a.localeCompare(b))) {
    const lockPath = `node_modules/${name}`;
    const dependency = lock.packages[lockPath];
    if (!dependency?.version) throw new Error(`Resolved version missing in package lock: ${name}`);
    dependencies.push({name, group, requestedRange, resolvedVersion: dependency.version, license: dependency.license ?? null, licenseEvidence: 'package-lock.json license field; full text remains in the installed package LICENSE', lockPath});
  }
}
const optionalGroups = [
  {id: 'park-sources', exists: sourcePaths.some(source => source.startsWith('src/park/'))},
  {id: 'lod-policy-source', exists: sourcePaths.some(source => /(^|\/)lod[^/]*\.ts$/i.test(source))},
];
const current = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  project: {name: packageJson.name, version: packageJson.version},
  modelVersion,
  checksumAlgorithm: 'SHA-256',
  selectedModelRoute: 'self-authored procedural simplified geometry',
  sources,
  configurationFiles,
  dependencies,
  scan: {
    include: ['src/prefabs/**/*.ts', 'src/scene/stamping.ts', 'src/welding/scene.ts', 'src/park/**/*.ts', 'src/core/clock.ts', 'src/core/production.ts', 'src/welding/logic.ts', 'src/**/lod*.ts'],
    exclude: ['**/*.test.ts', '**/*.spec.ts'],
    optionalGroups,
    sourceCount: sources.length,
    sourceBytes: sources.reduce((total, source) => total + source.bytes, 0),
  },
  conditions: {
    noDownloadedSimReadyAssets: true,
    nvidiaOrComauModelLicenseClaimed: false,
    precision: 'Self-authored schematic geometry; lower precision than manufacturer CAD/SimReady; no certified collision, kinematics, manufacturing surfaces, or metrology properties.',
    data: 'Production quantities, quality, OEE, measurement deviations and events are demo data.',
    projectLicense: 'No project-wide license is assigned by this manifest; external software package licenses are separate from model provenance.',
    lod: {
      targetTiers: ['proxy', 'low', 'medium', 'original-procedural-detail'],
      originalMeans: 'highest detail generated by this project, not official USD/CAD detail',
      targetMaximumOriginalRobots: 3,
      implementationStatus: 'Source inventory does not establish runtime implementation or acceptance; confirm in phase records and engine debug output.',
      measuredTriangleCounts: null,
      measuredResidentCounts: null,
      runtimeEvidence: null,
    },
    hashes: 'Hashes establish file identity only; they do not certify license eligibility, factory accuracy, LOD behavior, frame rate, or completed acceptance.',
  },
};
if (checkOnly) {
  const recorded = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const changed = [];
  for (const key of ['project', 'modelVersion', 'sources', 'configurationFiles', 'dependencies', 'scan']) {
    if (JSON.stringify(recorded[key]) !== JSON.stringify(current[key])) changed.push(key);
  }
  if (changed.length) throw new Error(`Asset manifest is stale (${changed.join(', ')}); rerun npm run assets after reviewing the changes`);
  console.log(JSON.stringify({status: 'current', manifest: manifestPath, sources: sources.length, directDependencies: dependencies.length}, null, 2));
} else {
  await fs.mkdir(path.dirname(manifestPath), {recursive: true});
  await fs.writeFile(manifestPath, JSON.stringify(current, null, 2) + '\n');
  console.log(JSON.stringify({status: 'generated', manifest: manifestPath, modelVersion, sources: sources.length, sourceBytes: current.scan.sourceBytes, directDependencies: dependencies.length, optionalGroups}, null, 2));
}
