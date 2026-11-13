import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async relative => JSON.parse(await fs.readFile(path.join(project, relative), 'utf8'));
const firstPath = 'docs/verification/stage-08-foreground-final-v2/report.json';
const rerunPath = 'docs/verification/stage-08-welding-rerun/report.json';
const first = await read(firstPath), rerun = await read(rerunPath);
assert.equal(rerun.status, 'passed');
const ids = scene => scene.shop + '-' + scene.quality + (scene.station === -1 ? '' : '-station-' + scene.station);
const expected = ['park-balanced', 'park-fine', 'stamping-balanced', 'stamping-fine', 'welding-balanced', 'welding-fine', 'welding-fine-station-2'];
const accepted = new Map();
for (const [source, report] of [[firstPath, first], [rerunPath, rerun]]) {
  for (const scene of report.performance.filter(scene => scene.status === 'passed')) {
    accepted.set(ids(scene), {source, sourceReportStatus: report.status, scene});
  }
}
const scenes = expected.map(id => {
  const item = accepted.get(id);
  assert.ok(item, 'Missing valid performance evidence: ' + id);
  const {scene, source, sourceReportStatus} = item;
  assert.ok(scene.frames > 0 && scene.productionSeconds > 0);
  return {
    id, source, sourceReportStatus, status: scene.status, shop: scene.shop, quality: scene.quality, station: scene.station,
    elapsedMs: scene.elapsedMs, frames: scene.frames, renderedFps: scene.renderedFps, productionSeconds: scene.productionSeconds,
    productionToWallRatio: scene.productionToWallRatio, fullCycleCovered: scene.fullCycleCovered,
    renderSize: scene.renderSize, intervalMs: scene.intervalMs, cpuMs: scene.cpuMs, drawCalls: scene.drawCalls,
    triangles: scene.triangles, geometries: scene.geometries, textures: scene.textures,
    maxOriginalRobots: scene.maxOriginalRobots, lodStates: scene.lodStates,
    camera: scene.camera[0].camera,
  };
});
assert.equal(scenes.find(scene => scene.id === 'welding-balanced').fullCycleCovered, true);
assert.ok(rerun.checks.every(check => check.passed));
const performance = {
  status: 'passed', generatedAt: new Date().toISOString(), meaning: 'Valid measured evidence; no target FPS was specified',
  host: rerun.host, gpu: rerun.gpu, browser: rerun.browser, viewport: rerun.viewport, devicePixelRatio: rerun.devicePixelRatio,
  measurements: rerun.measurements, sources: [firstPath, rerunPath], scenes,
  checks: rerun.checks, historical: [
    {source: 'docs/verification/stage-08-performance/report.json', status: 'partial', reason: 'Long native RAF evaluations were throttled; not valid sustained foreground FPS evidence'},
    {source: firstPath, status: first.status, reason: 'Two welding panorama scenarios changed quality or shop during sampling; only its five individually passed scenarios are accepted'},
  ],
};
await fs.writeFile(path.join(project, 'docs/verification/stage-08-summary.json'), JSON.stringify(performance, null, 2) + '\n');
const shopLabel = {park: '园区', stamping: '冲压', welding: '焊装'};
const qualityLabel = {balanced: '均衡', fine: '精细'};
const num = (value, places = 2) => Number(value).toFixed(places);
const rows = scenes.map(scene => `| ${shopLabel[scene.shop]}${scene.station === 2 ? '主拼近景' : '全景'} | ${qualityLabel[scene.quality]} | ${scene.renderSize.join(' × ')} | ${num(scene.elapsedMs / 1000)} | ${num(scene.renderedFps)} | ${num(scene.intervalMs.p95)} | ${num(scene.cpuMs.mean)} / ${num(scene.cpuMs.p95)} | ${Math.round(scene.drawCalls.mean)} | ${Math.round(scene.triangles.mean)} |`).join('\n');
const performanceDoc = `# 第8阶段：真实前台性能和资源回收\n\n日期：2026-11-13。全部七个场景都有有效测量；汇总见 [stage-08-summary.json](verification/stage-08-summary.json)。passed表示前台测量与资源检查有效，没有预设FPS验收门槛。\n\n设备为AMD Ryzen 7 5700G，本机AMD Radeon集成显卡通过ANGLE Direct3D11运行；Chrome ${rerun.browser}，Windows，视口1600 × 1000，DPR=1。实际WebGL renderer：${rerun.gpu.renderer}。没有软件GPU、伪造设备或修改RAF时钟的启动参数。\n\n| 场景 | 画质 | 实际渲染尺寸 | 采样秒数 | 绘制FPS | RAF P95 / ms | CPU平均 / P95 / ms | 平均绘制调用 | 平均三角形 |\n|---|---|---|---:|---:|---:|---:|---:|---:|\n${rows}\n\n焊装均衡全景从生产零时刻推进到76.0119秒，实际覆盖完整76秒节拍，生产/墙钟比约0.99996。精细主拼近景驻留最高细节机器人最多3台，测得约32.37 FPS；全景和较低负载场景约60 FPS。这些数值仅代表该设备、画质和固定机位，不能代表所有显卡。机位、各LOD分布、首末指标和逐次样本保存在来源报告；轻量汇总保留起始机位与LOD分布。\n\n测量使用原生RAF和真实生产时钟，一个250ms前台保持操作；每10秒返回一批样本。检查引擎绘制帧数和生产时间都前进、场景/画质/尺寸稳定、每个样本可见且有焦点；任一超过500ms的调度缺口记partial。完整周期必须实际推进76秒，不能仅以墙钟时长判断。CPU提交耗时不是GPU时间；精确显存和GPU时间未测。绘制调用和三角形含阴影与后处理。\n\n七轮园区/冲压/焊装切换先seek到激光及火花工作时段，预热后实际GL Buffer、Texture、Framebuffer、Renderbuffer和Program存活数量保持稳定。这里只报告资源对象数，不换算显存；暂停600ms生产时间和绘制帧数不增加。代码回收覆盖InstancedMesh实例属性、普通Line、灯光阴影、LOD缓存及场景材质纹理。\n\n来源：初次有效采样报告 [stage-08-foreground-final-v2](verification/stage-08-foreground-final-v2/report.json) 的园区、冲压和精细近景五项；两组全景重测 [stage-08-welding-rerun](verification/stage-08-welding-rerun/report.json)。初次报告两组焊装全景中途发生配置变动，明确判failed并保留；本次仅替换无效场景的证据。更早的 [stage-08-performance](verification/stage-08-performance/report.json) 有约1秒RAF调度间隔，维持partial，未用于当前FPS结论。\n\n重现命令：\n\n\x60\x60\x60powershell\nnode scripts/with-server.mjs scripts/performance.mjs --output docs/verification/new-performance-run\n\x60\x60\x60\n`;
await fs.writeFile(path.join(project, 'docs/performance-verification.md'), performanceDoc);

const videoFolders = ['stage-09-welding-contact', 'stage-09-stamping-cycle-v3', 'stage-09-welding-process-v2'];
const videos = [];
for (const folder of videoFolders) {
  const relative = 'docs/captures/' + folder;
  const manifest = await read(relative + '/manifest.json');
  assert.equal(manifest.status, 'complete');
  assert.equal(manifest.video.status, 'complete');
  assert.equal(manifest.writtenFrames, manifest.plannedFrames);
  assert.equal(manifest.video.verification.decodedFrames, manifest.plannedFrames);
  assert.equal(manifest.errors.length, 0);
  const content = await fs.readFile(path.join(project, relative, 'capture.mp4'));
  assert.equal(createHash('sha256').update(content).digest('hex'), manifest.video.verification.sha256);
  videos.push({folder, manifest: relative + '/manifest.json', video: relative + '/capture.mp4', status: manifest.status, shop: manifest.shop,
    quality: manifest.quality, station: manifest.station, speed: manifest.speed, start: manifest.start,
    lastTime: manifest.lastFrame.productionTime, frames: manifest.writtenFrames, virtualClock: manifest.virtualClock,
    frameChecks: manifest.frameChecks.map(({index, productionTime, png}) => ({index, productionTime, png})),
    input: manifest.video.verification.input, bytes: content.length, sha256: manifest.video.verification.sha256,
    command: manifest.command, errors: manifest.errors});
}
await fs.writeFile(path.join(project, 'docs/verification/stage-09-summary.json'), JSON.stringify({status: 'passed', generatedAt: new Date().toISOString(), videos,
  verification: {eachFrame: 'DOM production time, shop, loader absence and exactly one rendered frame', pngBrightness: 'first, middle and last frames', video: 'full FFmpeg decode; frames, size, FPS, duration, codec, pixel format and blackdetect'},
}, null, 2) + '\n');
console.log(JSON.stringify({performance: performance.status, scenarios: scenes.length, videoCount: videos.length, decodedFrames: videos.map(video => video.frames)}, null, 2));
