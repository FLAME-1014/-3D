import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'canton-atlas/web');
const atlas = path.join(root, 'canton-atlas');
const spots = path.join(atlas, 'content/spots');
const read = file => fs.readFileSync(file, 'utf8');
const stageCore = read(path.join(web, 'js/stage-core.js'));
const bookJs = read(path.join(web, 'js/book.js'));
const bookCss = read(path.join(web, 'book.css'));

function buildCatalog() {
  const context = vm.createContext({window: {}});
  vm.runInContext(read(path.join(web, 'data.js')) + '\nwindow.__ATLAS_PLACES = PLACES;', context);
  vm.runInContext(read(path.join(web, 'museum-catalog.js')), context);
  return context.window.MUSEUM_CATALOG;
}

test('18 件展品各有三镜，机位真实、短句克制、素材齐全', () => {
  const catalog = buildCatalog();
  assert.equal(catalog.entries.length, 18);
  const allTexts = [];
  for (const entry of catalog.entries) {
    const card = JSON.parse(read(path.join(spots, entry.id, 'spot.json')));
    const presets = card.presets || [];
    assert.equal(entry.shots.length, 3, `${entry.id} 恰好三镜`);
    assert.equal(entry.shots[0].preset, 'overview', `${entry.id} 第一镜为远观`);
    for (const shot of entry.shots) {
      assert.ok(presets.includes(shot.preset), `${entry.id} 机位 ${shot.preset} 存在于数据卡`);
      assert.ok(shot.text.length > 0 && shot.text.length <= 20, `${entry.id} 文案 ≤20 字`);
      allTexts.push(shot.text);
    }
    for (const file of [entry.coverClean, entry.silhouetteOrtho, entry.silhouettePersp]) {
      const target = path.join(atlas, file);
      assert.ok(fs.existsSync(target), `${entry.id} 素材 ${file} 存在`);
      assert.ok(fs.statSync(target).size > 8000, `${entry.id} 素材 ${file} 非空白`);
    }
    // 历史回归：剖切方向写反时，干净封面会导出成一张全透明 PNG
    assert.ok(fs.statSync(path.join(atlas, entry.coverClean)).size > 25000,
      `${entry.id} 干净封面含可见模型`);
  }
  assert.equal(allTexts.length, 54, '共 54 条三镜短句');
  assert.equal(new Set(allTexts).size, 54, '54 条互不重复');
});

test('三镜文案定稿：不残留已纠正的史实/场景错误，考据细节落到短句里', () => {
  const catalog = buildCatalog();
  const texts = catalog.entries.flatMap(e => e.shots.map(s => s.text));
  // 旧稿中的硬伤（见方案 4.3.1）：无考据的朝代数、把现存寺院写成旧址、
  // 六祖错安到六榕寺、无依据的屋顶动线、把别件模型的水院搬过来，以及模型术语
  const banned = ['十几个朝代', '古寺旧址', '六祖与东坡', '走上屋顶', '正对一湾水',
    '出土器物的位置', '剖面', '切面', '压缩示意', '图层'];
  for (const w of banned) {
    assert.ok(!texts.some(t => t.includes(w)), `定稿不应残留「${w}」`);
  }
  // 改后应能读到数据卡 hotspots[].note 里的具体细节
  const kept = ['十一层路面', '瘗发塔', '外观九层', '玉圭门阙', '玻璃温室',
    '24 根斜柱', '西门宽台阶', '六角亭', '云鹤华表', '锦绣南天牌坊'];
  for (const w of kept) {
    assert.ok(texts.some(t => t.includes(w)), `定稿应含考据细节「${w}」`);
  }
  assert.ok(Math.max(...texts.map(t => [...t].length)) <= 20, '全部 ≤20 字');
});

test('立起使用全局剖切平面，方向为自下而上显现', () => {
  assert.match(stageCore, /new THREE\.Plane\(new THREE\.Vector3\(0, -1, 0\)/);
  assert.match(stageCore, /risePlane\.constant = box\.min\.y \+ riseProgress \* size\.y/);
  assert.match(stageCore, /renderer\.clippingPlanes = \[risePlane\]/);
  assert.doesNotMatch(stageCore, /m\.clippingPlanes = \[risePlane\]/);
  assert.match(read(path.join(web, 'spike-rise.html')), /new THREE\.Vector3\(0, -1, 0\)/);
});

test('纸页在画布之下，浮层按钮不被画布盖住', () => {
  assert.match(bookCss, /#bookCanvas \{[^}]*z-index: 3/);
  assert.match(bookCss, /\.sheet \{[^}]*z-index: 1/);
  assert.match(bookCss, /\.footprint \{[^}]*z-index: 2/);
  assert.match(bookCss, /\.tools \{[^}]*z-index: 14/);
  assert.match(bookCss, /\.page-footer \{ bottom: calc\(72px/);
  assert.match(bookCss, /\.footprint\.is-flat \{ opacity: \.58/);
});

test('三镜依次看完才盖已看章，深链/返回恢复不误盖章', () => {
  assert.doesNotMatch(bookJs, /if \(n >= shots\.length - 1\) markSeen/);
  assert.match(bookJs, /rec\[0\] && rec\[1\] && rec\[2\]/);
  assert.match(bookJs, /if \(state\.restoring\) return;/);
  assert.match(bookJs, /canton-atlas-museum-seen/);
  assert.doesNotMatch(bookJs, /canton-atlas-marks/);
});

test('展开是可自由旋转缩放的展柜，机位取数据卡全量', () => {
  assert.match(stageCore, /function orbit\(/);
  assert.match(stageCore, /orbit: orbit/);
  assert.match(bookJs, /stage\.orbit\(/);
  assert.match(bookJs, /stage\.zoom\(/);
  assert.match(bookJs, /setPointerCapture/);
  assert.match(bookJs, /spot && spot\.presets/);
});

test('URL 与浏览器前进返回一致，尾页参数可直达', () => {
  assert.match(bookJs, /if \(v === 'end'\) v = 'colophon'/);
  assert.match(bookJs, /pushState/);
  assert.match(bookJs, /addEventListener\('popstate', applyRoute\)/);
  assert.match(bookJs, /function applyRoute/);
  assert.match(bookJs, /function openBookChrome\(\)[\s\S]*?classList\.add\('is-out'\)/);
  assert.match(bookJs, /function goToc\(\)[\s\S]*?openBookChrome\(\)/);
});

test('剪影用像素后处理生成墨色实心轮廓，导出不再裁断', () => {
  const html = read(path.join(web, 'export.html'));
  assert.match(html, /getImageData/);
  assert.match(html, /stage\.rise\(1\)/);
  assert.doesNotMatch(html, /stage\.rise\(0\)/);
  assert.match(html, /maxDim \* 0\.5 \* 1\.25/);
});

test('封面先显示墨色剪影，翻开进入剪影印谱', () => {
  assert.match(bookCss, /\.cover-demo \.footprint-img \{[^}]*opacity: \.92/);
  assert.match(bookCss, /\.cover-demo::before/);
  assert.match(bookJs, /coverItem\.silhouettePersp/);
  assert.match(bookJs, /canton-tower/);
  assert.match(bookJs, /goToc\(\);/);
});

// ---------------------------------------------------------------- 阶段 5
test('阶段 5：五个主题分组覆盖全部 18 件，完成章只在整组看完时落下', () => {
  const catalog = buildCatalog();
  const themes = catalog.themeList.filter(t => t.id !== 'all');
  assert.equal(themes.length, 5);
  const ids = new Set(themes.map(t => t.id));
  assert.equal(new Set(catalog.entries.map(e => e.theme)).size, 5);
  for (const e of catalog.entries) assert.ok(ids.has(e.theme), `${e.id} 主题有效`);
  assert.match(bookJs, /function themeProgress\(\)/);
  assert.match(bookJs, /list\.length > 0 && done === list\.length/);
  assert.match(bookJs, /本卷看完/);
  assert.match(bookJs, /cpThemeList/);
});

test('阶段 5：收藏与长廊共用同一份藏册，目录/尾页都有角标', () => {
  assert.match(bookJs, /var FAV_KEY = 'canton-atlas-museum-favorites'/);
  assert.equal(
    /favoriteKey = "canton-atlas-museum-favorites"/.test(read(path.join(web, 'museum.js'))),
    true, '与 museum.js 的 localStorage key 一致'
  );
  assert.match(bookJs, /function toggleFavorite\(\)/);
  assert.match(bookJs, /aria-pressed/);
  assert.match(bookJs, /function refreshMarks\(\)/);
  assert.match(bookCss, /\.toc-card\.is-fav \.fav/);
  assert.match(bookCss, /\.cp-item\.is-fav \.cp-fav/);
});

test('阶段 5：分享卡由同源 Canvas 生成，可保存/系统分享/复制链接', () => {
  assert.match(bookJs, /function drawShareCard\(\)/);
  assert.match(bookJs, /width="1080" height="1440"/);
  assert.match(bookJs, /cv\.toBlob\(resolve, 'image\/png'\)/);
  assert.match(bookJs, /function loadImage\(src\)/);
  assert.match(bookJs, /img\.onerror = function \(\) \{ resolve\(null\)/);
  assert.match(bookJs, /entries\.forEach\(function \(it, i\)/);   // 18 枚剪影网格
  assert.match(bookJs, /function fitFont\(/);                      // 名称不截断
  assert.match(bookJs, /风格化示意 · 非测绘/);
  assert.match(bookJs, /a\.download = '广州立体志-我的印谱\.png'/);
  assert.match(bookJs, /navigator\.canShare/);
  assert.match(bookJs, /navigator\.clipboard\.writeText/);
  assert.match(bookJs, /function shareURL\(\)/);
  assert.match(bookCss, /\.share-modal\[hidden\] \{ display: none/);
});

test('阶段 5：分享弹层是模态对话框，Escape 关闭、Tab 焦点陷阱、焦点归还', () => {
  assert.match(bookJs, /role="dialog" aria-modal="true"/);
  assert.match(bookJs, /function openShare\(\)/);
  assert.match(bookJs, /function closeShare\(\)/);
  assert.match(bookJs, /shareFocusReturn = document\.activeElement/);
  assert.match(bookJs, /if \(state\.shareOpen\) \{[\s\S]*?Escape[\s\S]*?Tab/);
  assert.match(bookJs, /focusEl\(shareFocusReturn \|\| \$\('cpShare'\)\)/);
  assert.match(bookJs, /syncA11y\(\)/);
});

test('阶段 5：减少动态为 200ms 交叉淡化，无倾斜、无第二个 WebGL', () => {
  assert.match(bookJs, /function crossfadeRise\(\)/);
  assert.match(bookJs, /opacity \.2s linear/);
  assert.match(bookJs, /setTimeout\(function \(\) \{[\s\S]*?\}, 200\)/);
  assert.match(bookJs, /if \(state\.reduced\) return;   \/\/ 减少动态：不倾斜/);
  assert.match(bookJs, /motionQuery\.addEventListener\('change', onMotion\)/);
  assert.match(bookJs, /classList\.toggle\('reduce-motion', state\.reduced\)/);
  assert.match(bookJs, /stage\.setPreset\(s\.preset, state\.reduced\)/);
  // 减少动态时封面直接给静态图，不创建第二个渲染器
  assert.match(bookJs, /if \(state\.reduced\) \{[\s\S]*?is-static[\s\S]*?return;/);
  assert.match(bookJs, /demo\.querySelector\('\.cover-model'\)\.src = coverItem\.coverClean/);
  assert.match(bookCss, /html\.reduce-motion \.page-seen \{ transform: none/);
  assert.match(bookCss, /html\.reduce-motion \.rise-line \{ display: none/);
  assert.match(read(path.join(web, 'book.html')), /classList\.add\('reduce-motion'\)/);
});

test('阶段 5：键盘 ←/→ 翻页、↑/↓ 推进镜头，Home/End 直达两端', () => {
  assert.match(bookJs, /case 'ArrowLeft': case 'PageUp': e\.preventDefault\(\); turnPage\(-1\)/);
  assert.match(bookJs, /case 'ArrowRight': case 'PageDown': e\.preventDefault\(\); turnPage\(1\)/);
  assert.match(bookJs, /case 'ArrowUp': e\.preventDefault\(\); prevShot\(\)/);
  assert.match(bookJs, /case 'ArrowDown': e\.preventDefault\(\); nextShot\(\)/);
  assert.match(bookJs, /e\.key === 'Home'/);
  assert.match(bookJs, /e\.key === 'End'/);
  assert.match(bookJs, /if \(onControl\) return;/);   // 不抢按钮的空格/回车
});

test('阶段 5：焦点管理、inert 隐藏非当前视图、读屏播报页码与 lead', () => {
  assert.match(bookJs, /function setInert\(el, on\)/);
  assert.match(bookJs, /function syncA11y\(\)/);
  assert.match(bookJs, /function focusView\(preferred\)/);
  assert.match(bookJs, /el\.setAttribute\('inert', ''\)/);
  assert.match(bookJs, /el\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(bookJs, /function announcePage\(\)/);
  assert.match(bookJs, /announce\('第 ' \+ \(n \+ 1\) \+ ' 镜/);
  assert.match(bookJs, /aria-live="polite"/);
  assert.match(bookJs, /role="status"/);
  assert.match(bookJs, /tabindex="-1"/);
  assert.match(bookJs, /role="button" tabindex="0"/);   // 抽屉把手可键盘操作
  assert.match(bookCss, /\.sr-only \{/);
});
