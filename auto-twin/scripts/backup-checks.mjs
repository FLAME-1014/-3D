import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {copySourceEntries, createBackup, resolveBackupPaths} from './backup.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.dirname(project);
const backupRoot = path.join(workspace, '工厂备份');

test('rejects invalid stages before creating anything', async () => {
  for (const stage of ['', '0', '-1', '1.5', '../7', '7/../../other', '01', '1e2', '1234567890123456']) {
    await assert.rejects(() => resolveBackupPaths(stage), /Stage must/, stage);
  }
});

test('check-only paths are independent of cwd and create no backup directories', async () => {
  const before = (await fs.readdir(backupRoot)).sort();
  const stage = '999999999999999';
  assert.ok(!before.includes(`工厂_第${stage}步完成`), 'reserved test stage already exists');
  const previous = process.cwd();
  try {
    for (const cwd of [project, workspace, path.join(project, 'scripts')]) {
      process.chdir(cwd);
      const value = await createBackup(stage, {checkOnly: true});
      assert.equal(value.source.toLowerCase(), project.toLowerCase());
      assert.equal(value.workspace.toLowerCase(), workspace.toLowerCase());
      assert.equal(value.target.toLowerCase(), path.join(backupRoot, `工厂_第${stage}步完成`).toLowerCase());
      assert.equal(value.mode, 'check-only');
    }
  } finally {process.chdir(previous)}
  assert.deepEqual((await fs.readdir(backupRoot)).sort(), before);
});

test('existing stage refuses overwrite even in check-only mode', async () => {
  const existing = (await fs.readdir(backupRoot)).find(name => /^工厂_第[1-9]\d*步完成$/.test(name));
  assert.ok(existing, 'an existing project stage backup is required for this read-only check');
  const stage = existing.match(/^工厂_第(\d+)步完成$/)[1];
  await assert.rejects(() => resolveBackupPaths(stage), /already exists; refusing to overwrite/);
});

test('copies entries into an existing destination and preserves exclusions', async () => {
  const fixture = path.join(workspace, 'tmp', `backup-fixture-${randomUUID()}`);
  const source = path.join(fixture, 'source');
  const destination = path.join(fixture, 'destination');
  await fs.mkdir(path.join(source, 'nested'), {recursive: true});
  await fs.mkdir(destination, {recursive: true});
  await fs.writeFile(path.join(source, 'package.json'), '{"name":"fixture"}\n');
  await fs.writeFile(path.join(source, 'nested', 'evidence.txt'), 'evidence\n');
  await fs.mkdir(path.join(source, 'node_modules'));
  await fs.writeFile(path.join(source, 'node_modules', 'ignored.txt'), 'ignored\n');
  try {
    await copySourceEntries(source, destination);
    assert.equal(await fs.readFile(path.join(destination, 'package.json'), 'utf8'), '{"name":"fixture"}\n');
    assert.equal(await fs.readFile(path.join(destination, 'nested', 'evidence.txt'), 'utf8'), 'evidence\n');
    await assert.rejects(() => fs.access(path.join(destination, 'node_modules')), {code: 'ENOENT'});
    await assert.rejects(() => copySourceEntries(source, destination), /EEXIST|already exists/);
  } finally {
    await fs.rm(fixture, {recursive: true, force: true});
  }
});
