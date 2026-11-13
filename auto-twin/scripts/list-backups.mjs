import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backupRoot = path.join(path.dirname(project), '工厂备份');
const backups = [];
for (const stage of [7, 8, 9, 10]) {
  const directory = path.join(backupRoot, `工厂_第${stage}步完成`);
  const filename = path.join(directory, 'backup-manifest.json');
  const bytes = await fs.readFile(filename);
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.status, 'complete');
  assert.equal(Number(manifest.stage), stage);
  for (const [relative, expected] of Object.entries(manifest.verification.keyFilesSha256)) {
    const content = await fs.readFile(path.join(directory, relative));
    assert.equal(createHash('sha256').update(content).digest('hex'), expected, `Backup ${stage} checksum differs: ${relative}`);
  }
  backups.push({stage, directory, manifest: filename, status: manifest.status, createdAt: manifest.createdAt,
    sourceFileCount: manifest.sourceFileCount, sourceBytes: manifest.sourceBytes, exclusions: manifest.exclusions,
    manifestSha256: createHash('sha256').update(bytes).digest('hex'), verifiedKeyFiles: Object.keys(manifest.verification.keyFilesSha256).length});
}
const entries = await fs.readdir(backupRoot);
const output = {status: 'verified', verifiedAt: new Date().toISOString(), backups,
  historicalStages: [1, 2, 3, 4, 5, 6], incompleteAuditDirectories: entries.filter(name => name.includes('.incomplete-')),
  note: 'Stages 8-10 were archived after integrated final acceptance. This inventory was written after snapshot creation; the source snapshots retain their own immutable backup manifests.',
};
await fs.writeFile(path.join(project, 'docs/backups.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({status: output.status, backups: backups.map(({stage, sourceFileCount, sourceBytes, verifiedKeyFiles}) => ({stage, sourceFileCount, sourceBytes, verifiedKeyFiles}))}, null, 2));
