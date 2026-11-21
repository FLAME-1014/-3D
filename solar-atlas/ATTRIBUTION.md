# 素材与资料来源

本项目参考 [Solar System Atlas](https://solar-system-atlas.pages.dev/) 的视觉与交互，界面、轨道计算和运行代码在本项目独立编写。下载的静态素材来自参考站公开分发的下列资源；原始路径、下载日期与字节大小记录在 `assets/manifest.json`。

## 三维库

- **Three.js / OrbitControls**：Three.js authors，MIT License。完整许可保存在 `assets/vendor/THREE-LICENSE.txt`。本项目从当前工作区已有的 vendor 文件复制。

## 行星与月球贴图

- **Solar System Scope**：[Textures](https://www.solarsystemscope.com/textures/)，CC BY 4.0。主要用于太阳、行星、月球、地球日面、夜面及土星环的摄影 / 制图纹理。
- **NASA / JPL Photojournal**：[Photojournal](https://science.nasa.gov/photojournal/)。参考站分发的地球云层、冥王星等影像涉及 NASA 任务素材。
- 冥王星源文件名为 `planets/pluto_nh-2k.jpg`，参考站标注 New Horizons MVIC：NASA / JHUAPL / SwRI。
- 太阳源文件名为 `planets/sun_sss-4k.jpg`；地球云层源文件名为 `planets/earth_clouds_nasa-2k.jpg`。
- 本地资源按展示对象重命名，例如 `earth_daymap-2k.jpg` 保存为 `assets/textures/earth.jpg`。贴图没有被重新生成或去除署名信息。

## 银河背景

- **ESO / S. Brunier**：[The Milky Way panorama](https://www.eso.org/public/images/eso0932a/)。参考站提供的 `sky/milky-way-8k.jpg` 保存为 `assets/textures/milky-way.jpg`。
- 使用时保留 ESO / S. Brunier 署名；详细影像使用条款见 [ESO copyright](https://www.eso.org/public/outreach/copyright/)。

## 星表与星座

- `assets/catalog/constellations.json` 来自参考站的 `sky/catalog.json`，包含 J2000 恒星位置、88 个星座连线和精选亮星。
- 星座资料来源涉及 **Stellarium team**。原站提供的说明为：Text and data: **CC BY-SA**；Illustrations: **Free Art License**，插画作者 **Johan Meuris**。
- 本项目只使用其中的星座坐标和连线，不下载或渲染星座人物插画。随项目保留 `assets/catalog/STELLARIUM-CREDITS.md`。
- `assets/catalog/bright-stars.json` 的来源字段注明 **d3-celestial / Olaf Frohn**，BSD-3-Clause。项目：[d3-celestial](https://github.com/ofrohn/d3-celestial)。该文件随目录保留，当前 UI 未逐条展示全部星名。
- `assets/catalog/dso.json` 来源字段注明 **OpenNGC / Mattia Verga**，CC BY-SA 4.0。项目：[OpenNGC](https://github.com/mattiaverga/OpenNGC)。当前 UI 使用独立编写的 10 个精选对象条目，没有渲染完整深空目录。

## 文字、计算与公开数据

- 基础天体数据与科普资料参考 [NASA Science](https://science.nasa.gov/)、[NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/)、[ESA](https://www.esa.int/) 与 [CNSA](https://www.cnsa.gov.cn/)。档案页面保留相关入口。
- 简化轨道采用 J2000 根数与开普勒方程；方法参考 [JPL Approximate Positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html)。当前根数为静态科普近似，未接入高精度星历。
- 洋流科普参考 [NOAA Ocean Service](https://oceanservice.noaa.gov/education/tutorial_currents/)；海洋物种参考 [WoRMS](https://www.marinespecies.org/) 与 [Smithsonian Ocean](https://ocean.si.edu/)。洋流路径、教学文字、粒子与温盐曲线是本项目的简化示意。
- 位置气象查询：[Open-Meteo](https://open-meteo.com/)，页面显示提供方、有效时间和获取时间。数据许可参考提供方的 CC BY 4.0 说明及服务条款。
- 太阳风查询：[NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov/)，接口 `products/solar-wind/plasma-2-hour.json`。
- 背景环境声音由 Web Audio 正弦波合成，不包含参考站音乐文件。

第三方素材保留各自许可，不因本项目新增代码而改变其授权。分发时应保留本文件、随附许可与页面中的来源说明。
