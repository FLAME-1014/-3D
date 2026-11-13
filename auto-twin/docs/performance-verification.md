# 第8阶段：真实前台性能和资源回收

日期：2026-11-13。全部七个场景都有有效测量；汇总见 [stage-08-summary.json](verification/stage-08-summary.json)。passed表示前台测量与资源检查有效，没有预设FPS验收门槛。

设备为AMD Ryzen 7 5700G，本机AMD Radeon集成显卡通过ANGLE Direct3D11运行；Chrome 157.0.8103.52，Windows，视口1600 × 1000，DPR=1。实际WebGL renderer：ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)。没有软件GPU、伪造设备或修改RAF时钟的启动参数。

| 场景 | 画质 | 实际渲染尺寸 | 采样秒数 | 绘制FPS | RAF P95 / ms | CPU平均 / P95 / ms | 平均绘制调用 | 平均三角形 |
|---|---|---|---:|---:|---:|---:|---:|---:|
| 园区全景 | 均衡 | 1040 × 650 | 8.00 | 59.86 | 20.90 | 2.36 / 3.90 | 209 | 69225 |
| 园区全景 | 精细 | 1600 × 1000 | 8.01 | 59.94 | 19.60 | 1.52 / 2.10 | 209 | 69225 |
| 冲压全景 | 均衡 | 1040 × 650 | 12.02 | 59.92 | 24.10 | 4.77 / 7.90 | 835 | 426940 |
| 冲压全景 | 精细 | 1600 × 1000 | 12.00 | 59.91 | 23.50 | 4.69 / 7.10 | 835 | 426938 |
| 焊装全景 | 均衡 | 1040 × 650 | 76.02 | 59.84 | 23.90 | 8.14 / 12.10 | 1505 | 180734 |
| 焊装全景 | 精细 | 1600 × 1000 | 12.00 | 59.74 | 23.50 | 7.34 / 11.60 | 1480 | 179887 |
| 焊装主拼近景 | 精细 | 1600 × 1000 | 10.01 | 32.37 | 38.20 | 6.15 / 8.50 | 956 | 604524 |

焊装均衡全景从生产零时刻推进到76.0119秒，实际覆盖完整76秒节拍，生产/墙钟比约0.99996。精细主拼近景驻留最高细节机器人最多3台，测得约32.37 FPS；全景和较低负载场景约60 FPS。这些数值仅代表该设备、画质和固定机位，不能代表所有显卡。机位、各LOD分布、首末指标和逐次样本保存在来源报告；轻量汇总保留起始机位与LOD分布。

测量使用原生RAF和真实生产时钟，一个250ms前台保持操作；每10秒返回一批样本。检查引擎绘制帧数和生产时间都前进、场景/画质/尺寸稳定、每个样本可见且有焦点；任一超过500ms的调度缺口记partial。完整周期必须实际推进76秒，不能仅以墙钟时长判断。CPU提交耗时不是GPU时间；精确显存和GPU时间未测。绘制调用和三角形含阴影与后处理。

七轮园区/冲压/焊装切换先seek到激光及火花工作时段，预热后实际GL Buffer、Texture、Framebuffer、Renderbuffer和Program存活数量保持稳定。这里只报告资源对象数，不换算显存；暂停600ms生产时间和绘制帧数不增加。代码回收覆盖InstancedMesh实例属性、普通Line、灯光阴影、LOD缓存及场景材质纹理。

来源：初次有效采样报告 [stage-08-foreground-final-v2](verification/stage-08-foreground-final-v2/report.json) 的园区、冲压和精细近景五项；两组全景重测 [stage-08-welding-rerun](verification/stage-08-welding-rerun/report.json)。初次报告两组焊装全景中途发生配置变动，明确判failed并保留；本次仅替换无效场景的证据。更早的 [stage-08-performance](verification/stage-08-performance/report.json) 有约1秒RAF调度间隔，维持partial，未用于当前FPS结论。

重现命令：

```powershell
node scripts/with-server.mjs scripts/performance.mjs --output docs/verification/new-performance-run
```
