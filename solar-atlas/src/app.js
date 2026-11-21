import { AtlasScene } from './scene.js';
import { queryEnvironment } from './environment.js';
import { PLANETS, MOON, MISSIONS, DEEP_OBJECTS, SCIENCE_LAYERS, QUOTES, OCEAN_CURRENTS, SPECIES, DIVE_SITES, WATER_LAYERS, LESSONS, TEXT, AU, planetById, formatNumber } from './data.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=id=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const currentYear=new Date().getFullYear();
let preferences={};try{preferences=JSON.parse(localStorage.getItem('solar-atlas-preferences')||'{}');}catch{}
const state={lang:preferences.lang==='en'?'en':'zh',landing:true,ready:false,mode:'atlas',selection:null,panel:null,quality:preferences.quality||'auto',year:currentYear,playing:false,category:'all',audio:false,immersive:false,libraryTab:'currents',libraryQuery:'',lesson:0,depth:1000,globeLayer:'natural',location:{lon:119,lat:26.1},weather:null,solarWind:null,fps:false,searchIndex:0,searchResults:[],catalog:null};
const t=key=>TEXT[state.lang][key]||key;
const nameOf=object=>state.lang==='en'?object.en:object.name;
const savePreferences=()=>{try{localStorage.setItem('solar-atlas-preferences',JSON.stringify({lang:state.lang,quality:state.quality}));}catch{}};
let toastTimer,quoteTimer,audioContext,audioNodes=[],lastTimelineFrame=0;

function toast(message,duration=3600){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,duration);}
function sourceLink(url,label){return `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`;}
function switchRow(label,name,checked,description=''){return `<div class="switch-row"><div><span class="row-label">${label}</span>${description?`<small>${description}</small>`:''}</div><button class="switch" role="switch" aria-label="${escape(label.replace(/<[^>]*>/g,''))}" aria-checked="${checked}" data-setting="${name}"></button></div>`;}
function facts(items){return `<div class="fact-grid">${items.map(([label,value])=>`<div><small>${escape(label)}</small><strong>${escape(value)}</strong></div>`).join('')}</div>`;}
function directory(items){return items.map(item=>`<button class="directory-item" data-directory="${escape(item.id)}"><span><strong>${escape(item.name)}</strong><small>${escape(item.en||item.subtitle||'')}</small></span><b>${item.detail?escape(item.detail):'↗'}</b></button>`).join('');}

const scene=new AtlasScene($('#scene'),$('#scene-labels'),{
  onProgress(progress,stage){$('#boot-percent').innerHTML=`${String(Math.round(progress*100)).padStart(3,'0')}<span>%</span>`;$('#boot-stage').textContent=progress>=1?'图谱已就绪':`正在加载 · ${stage.toUpperCase()}`;},
  onReady(){state.ready=true;$('#boot').style.opacity='0';setTimeout(()=>{$('#boot').hidden=true;if(state.landing)$('#landing').hidden=false;},450);$('#stat-missions').textContent=MISSIONS.length;$('#stat-years').textContent=currentYear-1957;scene.setQuality(state.quality);restoreURL();},
  onWarning(message){toast(message,5500);},
  onSelect(selection){selectObject(selection);},
  onMode(mode){syncMode(mode);},
  onCatalog(catalog){state.catalog=catalog;$('#sky-stars').textContent=formatNumber(catalog.stars.length);if(state.panel==='directory')renderPanel('directory');},
  onStats(stats){$('#sky-ra').textContent=`${stats.ra.toFixed(1)}°`;$('#sky-dec').textContent=`${stats.dec.toFixed(1)}°`;$('#sky-fov').textContent=`${stats.fov.toFixed(1)}°`;$('#fps').textContent=`${stats.fps} FPS · ${formatNumber(stats.stars)} CATALOG STARS`;},
  onFlight:updateFlightHUD,
  onFlightTarget(id){renderFlightTargets(id);},
  onArrival(name){toast(`已抵达 ${name} 附近，自动驾驶已停止。`);},
  onGlobePick(location){state.location=location;$('#globe-coordinate').textContent=formatCoordinate(location);if(state.panel==='weather')loadWeather();}
});
window.solarAtlas={get state(){return {mode:state.mode,ready:state.ready,year:state.year,selection:state.selection,playing:state.playing,lang:state.lang,globeLayer:state.globeLayer};},scene};

function updateLanguage(){
  document.documentElement.lang=state.lang==='en'?'en':'zh-CN';document.title=state.lang==='en'?'Solar Atlas · Explore our universe':'太阳系图谱 · Solar Atlas';
  $$('[data-i18n]').forEach(element=>element.textContent=t(element.dataset.i18n));
  $('#landing-lang').innerHTML=state.lang==='zh'?'中 <span>/ EN</span>':'<span>中 /</span> EN';
  $('#search-input').placeholder=state.lang==='en'?'Search worlds, moons, missions, or actions…':'搜索天体、卫星、任务，或输入一个操作…';
  renderPlanetRail();renderTimeline();if(state.panel)renderPanel(state.panel);if(!$('#archive').hidden&&state.selection)renderArchive(state.selection);savePreferences();
}

function renderPlanetRail(){
  $('#planet-rail').innerHTML=PLANETS.map(p=>`<button data-planet="${p.id}" aria-label="${escape(nameOf(p))}" style="--planet-color:${p.color}"><i></i><span>${escape(nameOf(p))} <small>${p.a?`${p.a.toFixed(p.a<10?2:1)} AU`:state.lang==='en'?'STAR':'恒星'}</small></span></button>`).join('');
}

function enter(mode='atlas'){
  if(!state.ready)return;state.landing=false;document.body.classList.remove('is-landing');$('#landing').hidden=true;$('#explorer-ui').hidden=false;scene.setLanding(false);changeMode(mode);startQuotes();
}
function home(){
  stopTimeline();closePanel();closeArchive();state.landing=true;state.selection=null;state.mode='atlas';document.body.dataset.mode='atlas';document.body.classList.add('is-landing');$('#explorer-ui').hidden=true;$('#landing').hidden=false;$('#landing').scrollTop=0;scene.setLanding(true);clearInterval(quoteTimer);setURL();
}
function changeMode(mode){if(mode==='live'||mode==='flight'){state.year=currentYear;$('#year-range').value=currentYear;}stopTimeline();closePanel();closeArchive();state.selection=null;scene.setMode(mode);setURL();}
function syncMode(mode){
  state.mode=mode;document.body.dataset.mode=mode;$$('#mode-nav button').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.mode===mode)));
  $('#flight-ui').hidden=mode!=='flight';$('#globe-ui').hidden=mode!=='globe';$('#deep-status').hidden=mode!=='deep';$('#deep-directory').hidden=mode!=='deep';
  $('#selected-crumb').hidden=true;$('#open-detail').hidden=true;
  $('#root-crumb span').textContent=mode==='deep'?(state.lang==='en'?'Deep sky':'深空'):(state.lang==='en'?'Solar system':'太阳系');
  const captions={atlas:'距离与天体尺寸经压缩 · 轨道方向为示意排布',three:'轨道采用 J2000 根数近似 · 天体尺寸与距离经过压缩',live:'当前日期的开普勒轨道近似 · 非高精度实时星历',deep:'',flight:'',globe:''};
  $('#view-caption-text').textContent=captions[mode]||'';
  if(mode==='flight')renderFlightTargets('earth');
  if(mode==='globe'){scene.setGlobeLayer(state.globeLayer);updateGlobeLegend();}
}

function selectObject(selection,open=true){
  if(!selection?.id)return;closePanel();state.selection=selection;
  if(selection.type==='planet'){
    scene.focus(selection.id);const p=planetById(selection.id);if(!p)return;$('#selected-crumb').textContent=nameOf(p);$('#selected-crumb').hidden=false;$('#open-detail').hidden=false;
  }else if(selection.type==='mission'){
    const m=MISSIONS.find(m=>m.id===selection.id);if(!m)return;scene.focus(m.body);state.selection=selection;$('#selected-crumb').textContent=nameOf(m);$('#selected-crumb').hidden=false;$('#open-detail').hidden=false;
  }else if(selection.type==='deep'){
    const d=DEEP_OBJECTS.find(d=>d.id===selection.id);if(!d)return;if(state.mode!=='deep')scene.setMode('deep');scene.lookAtSky(d.ra,d.dec);state.selection=selection;
  }
  if(open)renderArchive(selection);else closeArchive();setURL();
}

function setURL(){
  const url=new URL(location.href);url.search='';if(!state.landing)url.searchParams.set('view',state.mode);if(state.selection){url.searchParams.set('type',state.selection.type);url.searchParams.set('object',state.selection.id);}if(state.lang==='en')url.searchParams.set('lang','en');history.replaceState(null,'',url);
}
function restoreURL(){
  const params=new URL(location.href).searchParams;if(params.get('lang')==='en'){state.lang='en';updateLanguage();}
  const view=params.get('view');if(['atlas','three','live','deep','flight','globe'].includes(view)){const object=params.get('object'),type=params.get('type');enter(view);if(object&&['planet','mission','deep'].includes(type))selectObject({type,id:object});}
}

function startQuotes(){
  clearInterval(quoteTimer);let index=0;const show=()=>{const q=QUOTES[index%QUOTES.length];$('#quote-text').textContent=q[0];$('#quote-author').textContent=`— ${q[1]} · ${q[2]}`;index++;};show();quoteTimer=setInterval(show,22000);
}

function renderTimeline(){
  const span=currentYear-1957;$('#year-range').max=currentYear;$('#timeline-year').textContent=Math.floor(state.year);$('#timeline-count').textContent=`${MISSIONS.filter(m=>m.year<=state.year).length} ${t('objects')}`;
  $('#timeline-ticks').innerHTML=[1960,1970,1980,1990,2000,2010,2020].filter(y=>y<=currentYear).map(y=>`<span>${y}</span>`).join('');
  const visible=state.category==='all'?MISSIONS:MISSIONS.filter(m=>m.category===state.category);
  $('#timeline-events').innerHTML=`<span class="event-label">${state.year>=2024?'2024 EUROPA CLIPPER':Math.floor(state.year)+' · HUMAN EXPLORATION'}</span>`+visible.map((m,i)=>{
    const left=(m.year-1957)/span*100,width=((m.end||currentYear)-m.year)/span*100;return `<div class="event-line" style="left:${left}%;width:${width}%;top:${8+(i%3)*5}px"></div><button class="event-dot" style="left:${left}%" aria-label="${escape(m.name)} · ${m.year}" title="${escape(m.name)} · ${m.year}" data-mission="${m.id}"></button>`;
  }).join('');
  $('#timeline-list').innerHTML=visible.filter(m=>m.year<=state.year).slice().reverse().map(m=>`<button data-mission="${m.id}"><span>${escape(nameOf(m))}</span><small>${m.year}</small></button>`).join('');
  $('#timeline-play').innerHTML=`<span>${state.playing?'Ⅱ':'▶'}</span><span>${state.playing?t('pause'):t('replay')}</span>`;
}
function setYear(value){state.year=Number(value);$('#year-range').value=state.year;scene.setDate(Date.UTC(Math.floor(state.year),0,1)+(state.year%1)*365.256*86400000,state.playing);renderTimeline();}
function stopTimeline(){state.playing=false;scene.playing=false;lastTimelineFrame=0;renderTimeline();}
function playTimeline(){
  if(state.playing){stopTimeline();return;}if(state.year>=currentYear-.1)state.year=1957;state.playing=true;renderTimeline();requestAnimationFrame(timelineFrame);
}
function timelineFrame(now){if(!state.playing)return;const dt=lastTimelineFrame?Math.min((now-lastTimelineFrame)/1000,.2):0;lastTimelineFrame=now;const next=Math.min(currentYear,state.year+dt*3);setYear(next);if(next>=currentYear){stopTimeline();return;}requestAnimationFrame(timelineFrame);}

function renderArchive(selection){
  closePanel();$('#archive').hidden=false;$('#archive-content').scrollTop=0;
  if(selection.type==='planet')renderPlanetArchive(planetById(selection.id));
  else if(selection.type==='mission')renderMissionArchive(MISSIONS.find(m=>m.id===selection.id));
  else if(selection.type==='deep')renderDeepArchive(DEEP_OBJECTS.find(d=>d.id===selection.id));
}
function closeArchive(){$('#archive').hidden=true;}
function renderPlanetArchive(p){
  if(!p){closeArchive();return;}
  $('#archive-kicker').textContent=`WORLD ARCHIVE · ${p.id.toUpperCase()}`;
  const gravity=6.6743e-11*p.mass/(p.radius*1000)**2;
  const rows=[['半径',`${formatNumber(p.radius,1)} km`],['质量',`${p.mass.toExponential(3)} kg`],['表面重力',`${gravity.toFixed(2)} m/s²`],['平均温度',`${p.temperature>0?'+':''}${p.temperature} °C`],['自转周期',`${formatNumber(Math.abs(p.day),2)} h`],['公转周期',p.period?`${formatNumber(p.period,1)} d`:'—'],['轨道半长轴',p.a?`${p.a.toFixed(4)} AU`:'—'],['轨道偏心率',p.a?p.e.toFixed(4):'—'],['轴倾角',`${p.tilt}°`]];
  const related=MISSIONS.filter(m=>m.body===p.id);
  const article=p.id==='earth'?[
    ['内部结构','从地表向内，地球依次包括地壳、地幔与金属核心。板块运动、地幔对流和地核的流体运动，让地球成为持续变化的系统。'],
    ['大气与水循环','对流层中发生大多数天气现象。水通过蒸发、凝结、降水与地表径流，在海洋、大气和陆地之间循环，输送热量并塑造环境。'],
    ['磁场与磁层','地核中的导电流体运动产生地磁场。太阳风压缩向阳面的磁层并拉长夜侧磁尾；磁层不是阻挡所有辐射的固体屏障。'],
    ['海洋、生命与气候','海洋储存和输送大量热量。洋流、海气交换、碳循环与生命活动相互影响。继续进入地球探索，可以把表层环流与深海水层联系起来。']
  ]:[['内部与主要成分',p.composition],['大气与环境',p.atmosphere],['阅读轨道',`本图使用简化开普勒轨道。${p.name}的偏心率为 ${p.e.toFixed(4)}；数字与图形均来自同一数据记录。距离和尺寸在图谱模式下分别压缩，以便观察。`]];
  $('#archive-content').innerHTML=`<h1>${escape(nameOf(p))}</h1><p class="archive-subtitle">${escape(p.en)}</p><span class="category-tag">${escape(p.kind)}</span><div class="archive-world"><i class="archive-orbit"></i><img src="./assets/textures/${p.id}.jpg" alt="${escape(p.name)}表面贴图"></div>${p.id==='earth'?`<button class="ocean-gateway" data-action="earth"><span>探索这颗星球的海洋</span><strong>${t('learnEarth')} ↗</strong><small>地球 → 洋流 → 深海生命</small></button>`:''}<h2>${escape(p.subtitle)}</h2><p>${escape(p.description)}</p>${facts(rows)}<span class="archive-eyebrow">深入认识这个世界</span>${article.map(([title,body],i)=>`<details class="article-section" ${i===0?'open':''}><summary><span>${String(i+1).padStart(2,'0')}</span>${escape(title)}</summary><p>${escape(body)}</p></details>`).join('')}${p.id==='earth'?`<h2>卫星系统</h2><button class="directory-item" data-planet="moon"><span><strong>月球</strong><small>THE MOON · 27.322 DAYS</small></span><b>↗</b></button>`:''}${related.length?`<h2>探索这个世界的造物 <span class="data-tag">${related.length}</span></h2>${related.map(m=>`<button class="directory-item" data-mission="${m.id}"><span><strong>${escape(nameOf(m))}</strong><small>${escape(m.en)}</small></span><b>${m.year}</b></button>`).join('')}`:''}<div class="source-links">${sourceLink(p.source,'NASA Science — '+p.en)}${sourceLink('https://ssd.jpl.nasa.gov/planets/approx_pos.html','JPL · Approximate positions of the planets')}${sourceLink('https://www.solarsystemscope.com/textures/','Solar System Scope · Texture attribution')}<small>基础资料为静态科普记录；卫星总数会随新发现变化，本地目录不表示完整最新名录。</small></div><div class="archive-nav"><button class="pill-button" data-action="prev-planet">← 上一颗</button><button class="pill-button" data-action="next-planet">下一颗 →</button></div>`;
}
function renderMissionArchive(m){
  if(!m){closeArchive();return;}$('#archive-kicker').textContent=`MISSION ARCHIVE · ${m.id.toUpperCase()}`;
  $('#archive-content').innerHTML=`<h1>${escape(nameOf(m))}</h1><p class="archive-subtitle">${escape(m.en)}</p><span class="category-tag">${escape({satellite:'人造卫星',crewed:'载人航天',probe:'轨道器与探测器',lander:'着陆器与巡视器',telescope:'空间望远镜'}[m.category])}</span><div class="mission-mark">${icon(m.category==='telescope'?'deep':'rocket')}</div><div class="status-banner"><b>历史 / 示意位置 · 非实时</b>档案标记用于浏览任务与所在天体的关系，未接入航天器当前高精度星历。</div>${facts([['发射年份',m.year],['运营方',m.operator],['发射质量',m.mass],['任务年龄',`${currentYear-m.year} 年`],['任务记录',m.end?`${m.end} 年结束`:'延伸探索 / 静态资料'],['关联天体',planetById(m.body)?.name||'太阳系']])}<h2>任务始末</h2><p>${escape(m.description)}</p><h2>关键节点</h2><div class="milestones">${m.milestones.map(item=>`<div class="milestone"><b>${item.year}${item.year>currentYear?' · 计划':''}</b><p>${escape(item.label)}</p></div>`).join('')}</div><button class="secondary-button panel-action" data-planet="${m.body}">探索${escape(planetById(m.body)?.name||'太阳系')} ${icon('arrow')}</button><div class="source-links">${sourceLink(m.source,'NASA Science · 相关任务资料')}${sourceLink('https://www.esa.int/Science_Exploration','ESA · Science & Exploration')}${sourceLink('https://www.cnsa.gov.cn/','CNSA · 国家航天局')}<small>任务参数与状态为静态科普资料；未来节点属于任务计划，可能调整。</small></div>`;
}
function renderDeepArchive(d){
  if(!d){closeArchive();return;}$('#archive-kicker').textContent=`DEEP SKY ARCHIVE · ${d.id.toUpperCase()}`;
  $('#archive-content').innerHTML=`<h1>${escape(d.name)}</h1><p class="archive-subtitle">${escape(d.en)}</p><div class="mission-mark">${icon('deep')}</div><span class="category-tag">${escape(d.type)}</span>${facts([['距离',d.distance],['赤经',`${d.ra.toFixed(3)}°`],['赤纬',`${d.dec.toFixed(3)}°`]])}<h2>认识这个深空世界</h2><p>${escape(d.description)}</p><div class="status-banner good"><b>观测影像与目录位置</b>星图为保存的全天影像与 J2000 星表。它展示天球方向，不是当前地点、当前时刻的地平天空。</div><button class="secondary-button panel-action" data-look-sky="${d.id}">在星图中居中 ${icon('arrow')}</button><div class="source-links">${sourceLink(d.source,'NASA Science · 进一步阅读')}${sourceLink('https://www.eso.org/public/images/eso0932a/','ESO / S. Brunier · All-sky Milky Way')}${sourceLink('https://github.com/mattiaverga/OpenNGC','OpenNGC · Deep-sky catalog')}</div>`;
}

function closePanel(){state.panel=null;$('#panel').hidden=true;$$('[data-panel]').forEach(b=>b.classList.remove('active'));}
function openPanel(id){if(state.panel===id){closePanel();return;}closeArchive();renderPanel(id);}
function renderPanel(id){
  state.panel=id;$('#panel').hidden=false;$$('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===id));
  const titles={science:['SCIENCE LAYERS',t('science')],layers:['SCENE & CAMERA',t('layers')],quality:['RENDERING',t('quality')],more:['SOLAR ATLAS',t('more')],directory:['DEEP SKY DIRECTORY','深空目录'],views:['EARTH SYSTEM','地球与环境'],library:['OCEAN LIBRARY','资料库'],lesson:['EXPLORATION PATH','探索路径'],deep:['0 — 11,000 METERS','深海剖面'],dive:['DIVE ATLAS','参考潜区'],weather:['OBSERVATION & FORECAST','位置气象'],species:['OCEAN LIFE','海洋生命'],current:['OCEAN CURRENTS','洋流档案'],diveDetail:['DIVE SITE','潜区档案']};
  const pair=titles[id]||['SOLAR ATLAS',id];$('#panel-kicker').textContent=pair[0];$('#panel-title').textContent=pair[1];
  const content=$('#panel-content');
  if(id==='science'){
    const groups=[...new Set(SCIENCE_LAYERS.map(l=>l.group))];content.innerHTML=`<p class="section-description" style="margin-top:15px">把看不见的物理结构，变成可探索的空间。</p>${groups.map(group=>`<section class="panel-section"><span class="section-label">${group}</span>${SCIENCE_LAYERS.filter(l=>l.group===group).map(layer=>`<div class="science-item"><div class="switch-row"><div><span class="row-label">${layer.name}</span><span class="data-tag model">${layer.tag}</span></div><button class="switch" role="switch" aria-label="${layer.name}" aria-checked="${scene.layers.has(layer.id)}" data-science="${layer.id}"></button></div><p>${layer.description}</p>${layer.body?`<button class="text-button" data-focus="${layer.body}">聚焦${planetById(layer.body).name} ↗</button>`:''}${layer.id==='magnetic'?`<button class="text-button" data-action="solar-wind" style="margin-left:15px">查询太阳风 ↗</button><div id="solar-wind-result"></div>`:''}</div>`).join('')}</section>`).join('')}<div class="data-note">模型层帮助理解结构；小行星粒子是生成示意，不是实际星表。图谱尺寸与距离分别压缩。</div>`;
  }else if(id==='layers'){
    const categories=[['all','全部任务'],['satellite','人造卫星'],['crewed','载人航天'],['probe','轨道器与探测器'],['lander','着陆器与巡视器'],['telescope','空间望远镜']];
    content.innerHTML=`<section class="panel-section"><span class="section-label">任务类别</span><select class="select-field" id="mission-filter" aria-label="任务类别">${categories.map(([value,label])=>`<option value="${value}" ${state.category===value?'selected':''}>${label} · ${value==='all'?MISSIONS.length:MISSIONS.filter(m=>m.category===value).length}</option>`).join('')}</select></section><section class="panel-section"><span class="section-label">场景</span>${switchRow('人造物','missions',scene.settings.missions,'航天器与探测任务的示意标记')}${switchRow('轨道线','orbits',scene.settings.orbits)}${switchRow('小行星带','asteroids',scene.settings.asteroids,'6,000 个示意粒子')}${switchRow('天体标注','labels',scene.settings.labels)}${switchRow('恒星','stars',scene.settings.stars)}${switchRow('黄道网格','grid',scene.settings.grid)}</section><section class="panel-section"><span class="section-label">镜头</span>${switchRow('自动环绕','auto',scene.settings.auto,'左键转动 · 右键平移 · 滚轮缩放')}<div class="setting-grid"><button data-action="zoom-in">拉近</button><button data-action="zoom-out">推远</button><button data-action="reset">复位</button></div></section><section class="panel-section"><button class="text-button" data-action="immersive">沉浸观看 · 隐藏所有界面 <kbd>I</kbd></button></section>`;
  }else if(id==='quality'){
    content.innerHTML=`<section class="panel-section"><span class="section-label">画质档位</span><div class="setting-grid">${[['auto','自动'],['high','高'],['medium','中'],['low','低']].map(([value,label])=>`<button data-quality="${value}" class="${state.quality===value?'active':''}">${label}</button>`).join('')}</div><p class="section-description" style="margin-top:13px">调整渲染分辨率。较低档位适合移动设备；自动档根据设备像素比设置。</p></section><section class="panel-section"><span class="section-label">画面</span>${switchRow('暗角','vignette',!$('.vignette').hidden)}${switchRow('胶片颗粒','grain',!$('.grain').hidden)}${switchRow('地球云层','clouds',scene.settings.clouds)}${switchRow('显示帧率','fps',state.fps)}</section><section class="panel-section"><span class="section-label">动态效果</span>${switchRow('减少动态效果','reduced',document.body.classList.contains('reduce-motion'),'减少界面动画与自动环绕')}</section><p class="data-note">行星贴图存放在本地；银河背景在基础场景就绪后加载。无需每次重新下载整个场景。</p>`;
  }else if(id==='more'){
    content.innerHTML=`<div class="panel-menu"><button data-action="language">${state.lang==='zh'?'切换为 English':'切换为中文'}<small>中 / EN</small></button><button data-action="audio">背景音乐 <small>${state.audio?'开':'关'}</small></button><button data-action="guide">操作指南 <kbd>?</kbd></button><button data-action="earth">地球与海洋 <span>↗</span></button><button data-action="share">复制当前探索链接 <span>↗</span></button><button data-action="about">项目与资料来源 <span>↗</span></button></div><p class="data-note">一份可以在本地运行、可以继续扩展的科学图谱。</p>`;
  }else if(id==='directory'){
    const figures=state.catalog?.figures||[];content.innerHTML=`<section class="panel-section"><span class="section-label">精选深空天体</span>${directory(DEEP_OBJECTS.map(d=>({...d,detail:'◇'})))}</section><section class="panel-section"><span class="section-label">${figures.length||6} 个星座 · J2000</span>${directory((figures.length?figures:scene.constellations).map((c,i)=>({id:`constellation:${i}`,name:c.name,en:c.en})))}</section><div class="data-note">可以拖动环顾全天，滚轮放大。星座连线来自 Stellarium / d3-celestial 星表资料。</div>`;
  }else if(id==='views'){
    content.innerHTML=`<div class="panel-menu">${[['natural','自然地球','陆地、海洋、云层与大气'],['currents','海洋环流','表层环流模型与方向'],['wind','全球风带','气候风带示意；具体位置可查询天气'],['rain','降水示意','解析生成的空间分布，不是实时预报']].map(([value,label,description])=>`<button data-globe-layer="${value}" style="display:block"><span style="color:${state.globeLayer===value?'var(--gold)':'inherit'}">${label}</span><small style="display:block;margin-top:7px">${description}</small></button>`).join('')}</div><button class="secondary-button panel-action" data-ocean-panel="deep">深海剖面 ${icon('arrow')}</button><div class="data-note">自然地球采用保存的摄影贴图。洋流、风带、降水动画是模型示意；位置气象来自带有效时间的 Open-Meteo 数据。</div>`;
  }else if(id==='library')renderLibrary();
  else if(id==='lesson')renderLesson();
  else if(id==='deep')renderOceanDepth();
  else if(id==='dive'){
    content.innerHTML=`<p class="section-description" style="margin-top:17px">14 个参考潜区。选择潜点查看位置、生态与流况说明。</p>${directory(DIVE_SITES.map(d=>({id:d.id,name:d.name,subtitle:`${d.country} · ${d.current}`})))}<div class="data-note">流况为资料性质的概括，不是当日海况或潜水安全预报。</div>`;
  }else if(id==='weather'){
    content.innerHTML=`<p class="section-description" style="margin-top:18px">单击地球选择位置，再查询当地气象。</p><p class="eyebrow">${formatCoordinate(state.location)}</p><div id="weather-result"><div class="status-banner">正在查询气象数据…</div></div><button class="pill-button panel-action" data-action="weather-refresh">刷新位置气象</button><div class="data-note">数据：Open-Meteo 全球天气模型。有效时间、更新时间和单位随结果显示；服务不可用时不会用模拟数值冒充实测。</div>`;
  }
  if(id==='weather')loadWeather();
}

function setGlobeLayer(layer){state.globeLayer=layer;scene.setGlobeLayer(layer);updateGlobeLegend();if(state.panel==='views')renderPanel('views');}
function updateGlobeLegend(){
  const labels={natural:'自然视图',currents:'洋流',wind:'风带',rain:'降水示意'};$('#globe-layer-name').textContent=labels[state.globeLayer]||'自然视图';
  const legends={
    natural:'<b>摄影云层</b><p>保存的卫星摄影合成 · 非实时影像</p><small>Solar System Scope · CC BY 4.0</small>',
    currents:'<b>表层洋流 · 模型示意</b><p><span style="color:#efbc80">━ 暖流</span>　<span style="color:#8bcee0">━ 寒流</span></p><p>流线用于阅读方向，速度经过视觉调整。</p><small>命名洋流结构参考 NOAA</small>',
    wind:'<b>全球风带 · 解析模型示意</b><div class="legend-gradient"></div><p>风带方向用于科普，不是当前全球风速。</p><small>查询具体位置：点击地球 → 位置气象</small>',
    rain:'<b>降水空间分布 · 模型示意</b><div class="legend-gradient rain"></div><p>生成的可视化纹理 · 非气象实况或预报</p><small>查询降水：点击地球 → 位置气象</small>'
  };$('#globe-legend').innerHTML=legends[state.globeLayer];
}
function formatCoordinate({lon,lat}){return `${Math.abs(lat).toFixed(3)}° ${lat>=0?'N':'S'}　${Math.abs(lon).toFixed(3)}° ${lon>=0?'E':'W'}`;}

function renderLibrary(){
  const source=state.libraryTab==='species'?SPECIES:OCEAN_CURRENTS;const q=state.libraryQuery.trim().toLowerCase();const filtered=source.filter(item=>`${item.name} ${item.en}`.toLowerCase().includes(q));
  $('#panel-content').innerHTML=`<input class="input-field" id="library-search" aria-label="搜索资料库" placeholder="搜索名称或学名" value="${escape(state.libraryQuery)}"><div class="filter-tabs"><button class="filter-button ${state.libraryTab==='currents'?'active':''}" data-library-tab="currents">洋流</button><button class="filter-button ${state.libraryTab==='species'?'active':''}" data-library-tab="species">物种</button></div><div id="library-results">${directory(filtered.map(item=>({...item,detail:state.libraryTab==='species'?'↗':item.warm?'暖流':'寒流'})))||'<p class="empty-search">没有找到相关资料。</p>'}</div><div class="data-note">资料用于生态和地理阅读，不表示物种实时位置或精确洋流边界。</div>`;
}
function renderCurrent(id){
  const current=OCEAN_CURRENTS.find(c=>c.id===id);if(!current)return;renderPanel('current');
  const mid=current.points[Math.floor(current.points.length/2)];scene.flyToGeo(...mid);setGlobeLayer('currents');
  $('#panel-content').innerHTML=`<span class="archive-eyebrow">${escape(current.en)}</span><h3 style="font-size:27px;font-weight:300">${escape(current.name)}</h3><span class="data-tag ${current.warm?'model':''}">${current.warm?'暖流':'寒流'}</span><p class="section-description" style="margin-top:18px">${escape(current.description)}</p><div class="status-banner"><b>长期结构 · 非实时流况</b>地图使用概括路径与移动粒子帮助理解流向。真实洋流包含变化的锋面、分支与涡旋。</div><h3>从海水运动走向生命</h3><p class="section-description">海流输送热量、营养盐与生物。与物种的关联用于说明生态联系，不代表它只生活在某一条流线上。</p><button class="pill-button panel-action" data-library-tab="species">继续探索海洋生命 ↗</button><div class="source-links">${sourceLink('https://oceanservice.noaa.gov/education/tutorial_currents/','NOAA · Ocean currents tutorial')}</div>`;
}
function renderSpecies(id){
  const species=SPECIES.find(s=>s.id===id);if(!species)return;renderPanel('species');
  $('#panel-content').innerHTML=`<div class="species-symbol" style="--species-color:${species.color}">${species.icon}</div><h3 style="font-size:26px;font-weight:300">${escape(species.name)}</h3><p class="eyebrow" style="font-size:8px;line-height:1.8">${escape(species.en)}</p><span class="data-tag">${escape(species.class)}</span><div class="readout"><div style="grid-column:1/-1"><small>栖息深度与海域</small><strong style="font:12px var(--sans)">${escape(species.depth)}</strong></div></div><p class="section-description">${escape(species.description)}</p><button class="pill-button panel-action" data-ocean-panel="deep">查看深海水层 ↗</button><div class="source-links">${sourceLink(`https://www.marinespecies.org/aphia.php?p=taxlist&tName=${encodeURIComponent(species.en)}`,'WoRMS · 海洋物种名录')}${sourceLink('https://ocean.si.edu/','Smithsonian Ocean · 进一步探索')}</div><div class="data-note">插画符号用于导航。栖息深度为概括范围，物种可跨越多个水层。</div>`;
}
function renderDiveDetail(id){
  const site=DIVE_SITES.find(s=>s.id===id);if(!site)return;renderPanel('diveDetail');scene.flyToGeo(site.lon,site.lat);state.location={lon:site.lon,lat:site.lat};$('#globe-coordinate').textContent=formatCoordinate(state.location);
  $('#panel-content').innerHTML=`<span class="archive-eyebrow">${escape(site.country.toUpperCase())}</span><h3 style="font-size:25px;font-weight:300">${escape(site.name)}</h3><p class="eyebrow">${formatCoordinate(site)}</p><div class="readout"><div><small>参考流况</small><strong>${escape(site.current)}</strong></div><div><small>资料性质</small><strong style="font-size:13px">静态参考</strong></div></div><p class="section-description">旋转地球，可以比较这个潜区的位置与附近海域。洋流、地形和天气都会影响当地生态与能见度，实际流况随季节与潮汐变化。</p><button class="pill-button panel-action" data-action="weather-location">查询这个位置的气象 ↗</button><div class="data-note">本目录为科普参考，不提供实时水温、潜水安全评估或当日潜点条件。</div>`;
}

function renderLesson(){
  const lesson=LESSONS[state.lesson];setGlobeLayer('currents');
  $('#panel-content').innerHTML=`<p class="section-description" style="margin-top:17px">副热带环流怎样形成？从大气的运动开始。</p><div class="lesson-progress">${LESSONS.map((item,i)=>`<button aria-label="${item.title}" class="${i<=state.lesson?'active':''}" data-lesson="${i}"></button>`).join('')}</div><div class="lesson-number">${String(state.lesson+1).padStart(2,'0')}<span style="font-size:13px;color:#69796e"> / 05</span></div><h3 style="font-size:24px;font-weight:300;margin-top:5px">${lesson.title}</h3><p class="section-description">${lesson.text}</p><div class="lesson-actions"><button class="pill-button" data-lesson="${state.lesson-1}" ${state.lesson===0?'disabled':''}>← 上一步</button><button class="pill-button" data-lesson="${state.lesson+1}" ${state.lesson===LESSONS.length-1?'disabled':''}>下一步 →</button></div><section class="panel-section"><span class="section-label">章节目录</span>${LESSONS.map((item,i)=>`<button class="directory-item" data-lesson="${i}"><strong style="font-size:11px;font-weight:400;color:${i===state.lesson?'var(--gold)':'inherit'}">${i+1}. ${item.title}</strong><b>${i===state.lesson?'●':'+'}</b></button>`).join('')}</section><h3>读图与证据的边界</h3><p class="section-description">流线展示大洋环流的概括结构，移动速度经过视觉调整。北半球副热带环流通常顺时针，南半球通常逆时针；赤道流系与南极绕极流有不同的几何条件。</p><div class="source-links">${sourceLink('https://oceanservice.noaa.gov/facts/gyre.html','NOAA · What is an ocean gyre?')}</div>`;
}
function depthTemperature(depth){return 1.5+25.5*Math.exp(-depth/450)+1.7*Math.exp(-depth/3000);}
function depthSalinity(depth){return 34.7+.4*Math.exp(-depth/300)-.3*Math.exp(-((depth-500)**2)/250000);}
function renderOceanDepth(){
  const layer=WATER_LAYERS.find(l=>state.depth>=l.min&&state.depth<=l.max)||WATER_LAYERS[4];
  const curve=Array.from({length:80},(_,i)=>{const d=i/79*11000;return `${20+depthTemperature(d)/30*245},${20+d/11000*190}`;}).join(' ');
  const salinity=Array.from({length:80},(_,i)=>{const d=i/79*11000;return `${20+(depthSalinity(d)-34)/1.5*245},${20+d/11000*190}`;}).join(' ');
  $('#panel-content').innerHTML=`<p class="section-description" style="margin-top:17px">选择深度，认识光照、压力与生命的变化。</p><div class="depth-scale"></div><div class="readout"><div><small>选取深度</small><strong id="depth-value">${formatNumber(state.depth)} m</strong></div><div><small>近似静水压力</small><strong id="depth-pressure">${formatNumber(state.depth/10+1)} atm</strong></div></div><label class="section-label" for="depth-range">拖动探索水层</label><input id="depth-range" type="range" min="0" max="11000" step="10" value="${state.depth}" aria-label="选取深度"><div id="depth-readout"><p class="section-description"><b style="color:${layer.color}">${layer.name}</b> · ${depthTemperature(state.depth).toFixed(1)} °C · ${depthSalinity(state.depth).toFixed(2)} PSU</p></div><svg viewBox="0 0 295 235" role="img" aria-label="温度与盐度示意剖面" style="width:100%;height:235px;overflow:visible;stroke-width:1"><path d="M20 15v195h250" stroke="#777d7244"/><path d="M20 58h250M20 115h250M20 172h250" stroke="#777d721d"/><polyline points="${curve}" stroke="#dfa878" stroke-width="1.8" fill="none"/><polyline points="${salinity}" stroke="#70bbc7" stroke-width="1.4" fill="none"/><path id="depth-guide" d="M20 ${20+state.depth/11000*190}h250" stroke="#d6d6ba66" stroke-dasharray="3 4"/><text x="24" y="230" fill="#dfa878" stroke="none" font-size="9">温度 0—30 °C</text><text x="155" y="230" fill="#70bbc7" stroke="none" font-size="9">盐度 34—35.5 PSU</text><text x="0" y="18" fill="#7a8f81" stroke="none" font-size="8">0</text><text x="0" y="208" fill="#7a8f81" stroke="none" font-size="8">11k</text></svg>${WATER_LAYERS.map(l=>`<div class="water-card"><div class="layer-title"><span style="width:3px;height:30px;background:${l.color};border-radius:3px"></span><span>${l.name}<small>${l.en}</small></span><span style="margin-left:auto;font:10px var(--mono);color:#a1b2a4">${formatNumber(l.min)}–${formatNumber(l.max)} m</span></div><p>${l.light}<br>${l.temperature} · ${l.life}</p></div>`).join('')}<button class="pill-button panel-action" data-library-tab="species">探索海洋生命 ↗</button><div class="data-note">温盐曲线为解析示意，不是全球平均实测或某一站位数据。压力按约每 10 m 增加 1 atm 简化计算。</div>`;
}

let weatherRequest=0;
async function loadWeather(){
  const request=++weatherRequest;const target=$('#weather-result');if(!target)return;target.innerHTML='<div class="status-banner">正在查询气象数据…</div>';
  try{
    const result=await queryEnvironment('weather',state.location);if(request!==weatherRequest||!$('#weather-result'))return;
    const current=result.data?.current,units=result.data?.current_units;if(!current||!units)throw new Error('气象服务未返回有效数据');state.weather=result;
    const validDate=new Date(current.time.endsWith('Z')?current.time:current.time+'Z');const stale=!Number.isFinite(validDate.getTime())||Math.abs(Date.now()-validDate.getTime())>86400000;
    $('#weather-result').innerHTML=`<div class="status-banner ${stale?'':'good'}"><b>${stale?'数据时间较旧，请核对有效时间':'已获得带有效时间的气象数据'}</b>来源：${escape(result.source)} · 全球天气模型</div><div class="readout"><div><small>气温</small><strong>${escape(current.temperature_2m)} ${escape(units.temperature_2m)}</strong></div><div><small>相对湿度</small><strong>${escape(current.relative_humidity_2m)} ${escape(units.relative_humidity_2m)}</strong></div><div><small>10 米风速</small><strong>${escape(current.wind_speed_10m)} ${escape(units.wind_speed_10m)}</strong></div><div><small>风向</small><strong>${escape(current.wind_direction_10m)}°</strong></div><div style="grid-column:1/-1"><small>降水</small><strong>${escape(current.precipitation)} ${escape(units.precipitation)}</strong></div></div><p class="data-note">有效时间：${escape(current.time)} UTC<br>获取时间：${escape(result.fetchedAt)}<br>位置：${formatCoordinate(state.location)}</p>`;
  }catch(error){if(request===weatherRequest&&$('#weather-result'))$('#weather-result').innerHTML=`<div class="status-banner"><b>当前气象数据不可用</b>${escape(error.message)}<br>没有用模拟数值替代真实查询结果。</div>`;}
}
async function loadSolarWind(){
  const target=$('#solar-wind-result');if(!target)return;target.innerHTML='<p class="section-description" style="margin-top:12px">正在查询 NOAA 太阳风…</p>';
  try{
    const result=await queryEnvironment('solar-wind');const rows=result.data;if(!Array.isArray(rows)||rows.length<2)throw new Error('未返回有效观测');
    const header=rows[0],last=rows.slice(1).reverse().find(row=>row[header.indexOf('speed')]!==null);if(!last)throw new Error('最新记录没有有效速度');if(!$('#solar-wind-result'))return;
    const value=key=>last[header.indexOf(key)];$('#solar-wind-result').innerHTML=`<div class="status-banner good"><b>NOAA SWPC · 太阳风观测</b>速度 ${escape(value('speed'))} km/s<br>密度 ${escape(value('density'))} protons/cm³<br>温度 ${escape(value('temperature'))} K<br><small>有效时间 ${escape(value('time_tag'))} UTC</small></div>`;
  }catch(error){if($('#solar-wind-result'))$('#solar-wind-result').innerHTML=`<div class="status-banner"><b>观测服务暂不可用</b>${escape(error.message)}<br>磁层仍为模型示意。</div>`;}
}

function openSearch(){if(!state.ready)return;if(state.landing)enter();$('#search-dialog').showModal();$('#search-input').value='';state.searchIndex=0;renderSearch('');$('#search-input').focus();}
function searchItems(query){
  const q=query.trim().toLowerCase();const items=[...PLANETS,MOON].map(p=>({id:p.id,type:'planet',name:nameOf(p),en:p.en,detail:p.kind,icon:'◉'}));
  items.push(...MISSIONS.map(m=>({id:m.id,type:'mission',name:nameOf(m),en:m.en,detail:String(m.year),icon:'◇'})),...DEEP_OBJECTS.map(d=>({id:d.id,type:'deep',name:d.name,en:d.en,detail:d.type,icon:'✦'})));
  const actions=[['three','切换到三维视图','3D VIEW'],['live','切换到实时位置','LIVE POSITIONS'],['deep','打开深空探索','DEEP SKY'],['flight','进入飞行模拟','FLIGHT SIMULATION'],['globe','探索地球与海洋','EARTH & OCEAN'],['science','科学图层','SCIENCE LAYERS'],['guide','操作指南与快捷键','CONTROLS']].map(([id,name,en])=>({id,name,en,type:'action',detail:'操作',icon:'↗'}));items.push(...actions);
  if(!q)return [...items.filter(i=>i.type==='planet'),...actions].slice(0,18);
  return items.filter(item=>`${item.name} ${item.en} ${item.id}`.toLowerCase().includes(q)).slice(0,50);
}
function renderSearch(query){
  state.searchResults=searchItems(query);state.searchIndex=clamp(state.searchIndex,0,Math.max(0,state.searchResults.length-1));
  $('#search-results').innerHTML=state.searchResults.map((item,i)=>`<button class="search-result ${i===state.searchIndex?'active':''}" id="search-option-${i}" role="option" aria-selected="${i===state.searchIndex}" data-search-index="${i}"><span class="result-icon">${item.icon}</span><span><strong>${escape(item.name)}</strong><small>${escape(item.en)}</small></span><span>${escape(item.detail)}</span></button>`).join('')||'<p class="empty-search">没有找到相关天体或任务。</p>';
  $('#search-input').setAttribute('aria-activedescendant',`search-option-${state.searchIndex}`);$('#search-count').textContent=`${state.searchResults.length} 项`;
}
function activateSearch(index){
  const result=state.searchResults[index];if(!result)return;$('#search-dialog').close();
  if(result.type==='action'){if(['three','live','deep','flight','globe'].includes(result.id))changeMode(result.id);else if(result.id==='guide')showGuide();else openPanel(result.id);}else selectObject({type:result.type,id:result.id});
}

function renderFlightTargets(active=scene.flight.target){
  $('#flight-targets').innerHTML=[...PLANETS,MOON].map(p=>`<button data-flight-target="${p.id}" class="${p.id===active?'active':''}">${escape(p.name)}<span>${p.a?`${p.a.toFixed(2)} AU`:'恒星'}</span></button>`).join('');
  const p=planetById(active);$('#flight-target-name').textContent=p?.name||'地球';$('#flight-bottom-target').textContent=p?.name||'地球';
}
function updateFlightHUD(data){
  const seconds=Math.floor(data.elapsed);$('#flight-timer').textContent=`T+ ${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  $('#flight-date').textContent=new Date().toISOString().replace('T',' ').slice(0,19)+' UTC';
  const values={'flight-sun':`${data.sunAU.toFixed(4)} AU`,'flight-closest':data.closest,'flight-travel':`${formatNumber(data.travelled)} km`,'flight-irradiance':`${formatNumber(data.irradiance)} W/m²`,'flight-light':`${Math.floor(data.lightSun/60)}:${String(Math.floor(data.lightSun%60)).padStart(2,'0')}`,'flight-gravity':`${data.gravity.toFixed(4)} m/s²`,'flight-escape':`${data.escape.toFixed(2)} km/s`,'flight-gamma':data.gamma.toFixed(6),'flight-target-distance':`${formatNumber(data.distance)} km`,'flight-speed':formatNumber(data.speed,1),'flight-altitude':formatNumber(Math.max(0,data.altitude)),'flight-distance':formatNumber(data.distance),'flight-gforce':(data.acceleration/9.80665).toFixed(2),'flight-cruise':`巡航 ${formatNumber(data.cruise,1)} km/s`};
  for(const [id,value] of Object.entries(values))$('#'+id).textContent=value;
  $('#flight-eta').textContent=data.autopilot?'自动减速中':data.speed>.1?`${formatNumber(data.distance/data.speed/3600,1)} h`:'—';
  $('#flight-auto').classList.toggle('active',data.autopilot);$('#flight-auto').setAttribute('aria-pressed',String(data.autopilot));
}

function showInfo(title,html,kicker='SOLAR ATLAS'){closePanel();$('#info-title').textContent=title;$('#info-content').innerHTML=html;$('#info-kicker').textContent=kicker;$('#info-dialog').showModal();}
function showGuide(){showInfo('操作指南',`<p>从图谱认识整体，选择一颗星球查看档案，或者搜索一个航天任务，重访它的旅程。</p><div class="help-grid">${[['1 / 2 / 3','图谱 / 三维 / 实时'],['4 / 5','深空 / 飞行模拟'],['Ctrl K','搜索天体、任务与操作'],['D','打开 / 收起当前档案'],['S / L / G','科学图层 / 图层 / 画质'],['H / I','返回首页 / 沉浸观看'],['左键拖动','旋转视角'],['右键拖动','平移视角'],['滚轮 / 双指','缩放场景'],['Esc','关闭面板或退出模拟']].map(([key,label])=>`<div><kbd>${key}</kbd>${label}</div>`).join('')}</div><h3>飞行模拟</h3><p>WASD 推进或平移，R / F 上下移动，拖动改变朝向。滚轮调整巡航速度；Z 对准目标，G 开关自动驾驶，X 急停。自动驾驶会在目标附近减速停止。</p><h3>地球与海洋</h3><p>在地球档案中点击“探索地球”。洋流、风带与降水场为明确标注的模型示意；单击地球后可查询该位置带有效时间的气象数据。</p>`,'EXPLORE · OBSERVE · UNDERSTAND');}
function showAbout(){showInfo('关于这份图谱',`<p>参考 Solar System Atlas 的界面与探索方式，重新编写的本地独立实现。包含 ${MISSIONS.length} 个精选航天任务、太阳与八大行星、冥王星和月球，以及深空星表与地球海洋分支。</p><h3>空间与时间</h3><p>行星位置由 J2000 基础轨道根数与开普勒方程近似计算，未包含完整摄动与高精度实时星历。图谱模式压缩天体尺寸和距离；模拟模式使用真实比例与简化牛顿引力。航天任务标记、小行星粒子及环境场为示意。</p><h3>贴图与观测资料</h3><p>${sourceLink('https://www.solarsystemscope.com/textures/','Solar System Scope · CC BY 4.0')}<br>${sourceLink('https://www.eso.org/public/images/eso0932a/','ESO / S. Brunier · 全天银河影像')}<br>${sourceLink('https://stellarium.org/','Stellarium · 星座资料')}<br>${sourceLink('https://github.com/ofrohn/d3-celestial','d3-celestial · 星表与星名')}<br>${sourceLink('https://github.com/mattiaverga/OpenNGC','OpenNGC · CC BY-SA 4.0')}<br>${sourceLink('https://science.nasa.gov/photojournal/','NASA / JPL Photojournal · 行星影像')}</p><h3>环境数据</h3><p>${sourceLink('https://open-meteo.com/','Open-Meteo · 位置气象')}<br>${sourceLink('https://www.swpc.noaa.gov/','NOAA SWPC · 太阳风观测')}<br>观测查询显示有效时间；上游不可用时明确提示。海洋与天气动画均有模型标注。</p><h3>实现与参考</h3><p>Three.js · MIT License<br>${sourceLink('https://solar-system-atlas.pages.dev/','参考网站 · Solar System Atlas')}<br>界面与运行代码在本项目重新实现；素材出处记录在项目 ATTRIBUTION.md。</p>`,'SOURCES & METHODS');}
async function toggleAudio(){
  try{
    if(state.audio){for(const node of audioNodes)try{node.stop?.();node.disconnect();}catch{}audioNodes=[];state.audio=false;}
    else{
      audioContext??=new (window.AudioContext||window.webkitAudioContext)();await audioContext.resume();const master=audioContext.createGain();master.gain.value=.018;master.connect(audioContext.destination);
      for(const freq of [110,164.81,220,329.63]){const oscillator=audioContext.createOscillator();const gain=audioContext.createGain();oscillator.type='sine';oscillator.frequency.value=freq;gain.gain.value=.3;oscillator.connect(gain);gain.connect(master);oscillator.start();audioNodes.push(oscillator,gain);}audioNodes.push(master);state.audio=true;
    }
    $('#landing-audio').textContent=`音乐 · ${state.audio?'开':'关'}`;if(state.panel==='more')renderPanel('more');
  }catch{toast('当前浏览器无法启用环境音乐。');}
}

function applySetting(name,value){
  if(name==='fps'){state.fps=value;$('#fps').hidden=!value;}
  else if(name==='vignette')$('.vignette').hidden=!value;
  else if(name==='grain')$('.grain').hidden=!value;
  else if(name==='reduced'){document.body.classList.toggle('reduce-motion',value);scene.setSetting('auto',false);}
  else scene.setSetting(name,value);
  updateScienceBadge();
}
function updateScienceBadge(){const count=[...scene.layers].length;$('#science-badge').textContent=count;$('#science-badge').hidden=count===0;}
function immersive(){state.immersive=!state.immersive;document.body.classList.toggle('is-immersive',state.immersive);}
function navigatePlanet(direction){const worlds=[...PLANETS,MOON],index=worlds.findIndex(p=>p.id===state.selection?.id);selectObject({type:'planet',id:worlds[(index+direction+worlds.length)%worlds.length].id});}
const actions={
  about:showAbout,guide:showGuide,audio:toggleAudio,language(){state.lang=state.lang==='zh'?'en':'zh';updateLanguage();setURL();},
  earth(){if(state.landing)enter('globe');else changeMode('globe');},
  'zoom-in'(){scene.zoom(-1);},'zoom-out'(){scene.zoom(1);},reset(){scene.resetView();},immersive,
  'solar-wind':loadSolarWind,'weather-refresh':loadWeather,'weather-location'(){renderPanel('weather');},
  'prev-planet'(){navigatePlanet(-1);},'next-planet'(){navigatePlanet(1);},
  async share(){try{await navigator.clipboard.writeText(location.href);toast('已复制当前探索链接。');}catch{showInfo('当前探索链接',`<p style="word-break:break-all">${escape(location.href)}</p>`);}}
};

$('#enter-atlas').addEventListener('click',()=>enter('atlas'));$('#enter-deep').addEventListener('click',()=>enter('deep'));
$('#landing-lang').addEventListener('click',actions.language);$('#landing-audio').addEventListener('click',toggleAudio);
$('#home').addEventListener('click',home);$('#root-crumb').addEventListener('click',()=>changeMode(state.mode==='deep'?'atlas':state.mode));
$('#selected-crumb').addEventListener('click',()=>{if(state.selection)renderArchive(state.selection);});
$('#open-detail').addEventListener('click',()=>{if(!state.selection)return;$('#archive').hidden?renderArchive(state.selection):closeArchive();});
$('#close-archive').addEventListener('click',closeArchive);$('#close-panel').addEventListener('click',closePanel);
$('#open-search').addEventListener('click',openSearch);$('#close-search').addEventListener('click',()=>$('#search-dialog').close());
$('#close-info').addEventListener('click',()=>$('#info-dialog').close());
$('#zoom-in').addEventListener('click',()=>scene.zoom(-1));$('#zoom-out').addEventListener('click',()=>scene.zoom(1));$('#reset-view').addEventListener('click',()=>scene.resetView());
$('#deep-directory').addEventListener('click',()=>openPanel('directory'));
$('#year-range').addEventListener('input',event=>{if(state.playing)stopTimeline();setYear(event.target.value);});
$('#timeline-play').addEventListener('click',playTimeline);
$('#timeline-toggle').addEventListener('click',()=>{const expanded=$('#timeline').classList.toggle('expanded');$('#timeline-toggle').setAttribute('aria-expanded',String(expanded));$('#timeline-toggle').setAttribute('aria-label',expanded?'收起时间线':'展开时间线');});
$('#back-solar').addEventListener('click',()=>{changeMode('atlas');selectObject({type:'planet',id:'earth'});});
$('#flight-reset').addEventListener('click',()=>{scene.startFlight();renderFlightTargets('earth');});$('#flight-exit').addEventListener('click',()=>changeMode('three'));
$('#flight-align').addEventListener('click',()=>scene.alignFlight());$('#flight-auto').addEventListener('click',()=>scene.autopilot());
$('#flight-help-toggle').addEventListener('click',()=>{const body=$('#flight-help-content');body.hidden=!body.hidden;$('#flight-help-toggle').textContent=body.hidden?'展开':'收起';});
$('#search-input').addEventListener('input',event=>{state.searchIndex=0;renderSearch(event.target.value);});
$('#search-input').addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const count=state.searchResults.length;if(!count)return;state.searchIndex=(state.searchIndex+(event.key==='ArrowDown'?1:-1)+count)%count;renderSearch(event.target.value);$(`#search-option-${state.searchIndex}`)?.scrollIntoView({block:'nearest'});}
  if(event.key==='Enter'){event.preventDefault();activateSearch(state.searchIndex);}
});
for(const dialog of [$('#search-dialog'),$('#info-dialog')])dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});

document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;const d=button.dataset;
  if(d.action){actions[d.action]?.();return;}
  if(d.mode){changeMode(d.mode);return;}
  if(d.panel){openPanel(d.panel);return;}
  if(d.planet){selectObject({type:'planet',id:d.planet});return;}
  if(d.mission){selectObject({type:'mission',id:d.mission});return;}
  if(d.focus){scene.focus(d.focus);return;}
  if(d.science){const enabled=button.getAttribute('aria-checked')!=='true';button.setAttribute('aria-checked',String(enabled));scene.setScience(d.science,enabled);updateScienceBadge();return;}
  if(d.setting){const value=button.getAttribute('aria-checked')!=='true';button.setAttribute('aria-checked',String(value));applySetting(d.setting,value);return;}
  if(d.quality){state.quality=d.quality;scene.setQuality(d.quality);savePreferences();renderPanel('quality');return;}
  if(d.directory){
    if(d.directory.startsWith('constellation:')){const index=Number(d.directory.split(':')[1]);const c=(state.catalog?.figures||scene.constellations)[index];if(c){scene.lookAtSky(...c.coord);closePanel();}return;}
    if(DEEP_OBJECTS.some(item=>item.id===d.directory)){selectObject({type:'deep',id:d.directory});return;}
    if(OCEAN_CURRENTS.some(item=>item.id===d.directory)){renderCurrent(d.directory);return;}
    if(SPECIES.some(item=>item.id===d.directory)){renderSpecies(d.directory);return;}
    if(DIVE_SITES.some(item=>item.id===d.directory)){renderDiveDetail(d.directory);return;}
  }
  if(d.oceanPanel){openPanel(d.oceanPanel);return;}
  if(d.globeLayer){setGlobeLayer(d.globeLayer);return;}
  if(d.libraryTab){state.libraryTab=d.libraryTab;state.libraryQuery='';renderPanel('library');return;}
  if(d.lesson!==undefined){state.lesson=clamp(Number(d.lesson),0,LESSONS.length-1);renderLesson();return;}
  if(d.searchIndex!==undefined){activateSearch(Number(d.searchIndex));return;}
  if(d.flightTarget){scene.setFlightTarget(d.flightTarget);renderFlightTargets(d.flightTarget);return;}
  if(d.lookSky){const obj=DEEP_OBJECTS.find(o=>o.id===d.lookSky);if(obj)scene.lookAtSky(obj.ra,obj.dec);closeArchive();}
});
document.addEventListener('change',event=>{
  if(event.target.id==='mission-filter'){state.category=event.target.value;scene.setMissionFilter(state.category);renderTimeline();}
});
document.addEventListener('input',event=>{
  if(event.target.id==='library-search'){
    state.libraryQuery=event.target.value;const source=state.libraryTab==='species'?SPECIES:OCEAN_CURRENTS;const query=state.libraryQuery.toLowerCase();$('#library-results').innerHTML=directory(source.filter(item=>`${item.name} ${item.en}`.toLowerCase().includes(query)).map(item=>({...item,detail:state.libraryTab==='species'?'↗':item.warm?'暖流':'寒流'})))||'<p class="empty-search">没有找到相关资料。</p>';
  }
  if(event.target.id==='depth-range'){
    state.depth=Number(event.target.value);const layer=WATER_LAYERS.find(l=>state.depth>=l.min&&state.depth<=l.max)||WATER_LAYERS[4];$('#depth-value').textContent=`${formatNumber(state.depth)} m`;$('#depth-pressure').textContent=`${formatNumber(state.depth/10+1)} atm`;$('#depth-readout').innerHTML=`<p class="section-description"><b style="color:${layer.color}">${layer.name}</b> · ${depthTemperature(state.depth).toFixed(1)} °C · ${depthSalinity(state.depth).toFixed(2)} PSU</p>`;$('#depth-guide').setAttribute('d',`M20 ${20+state.depth/11000*190}h250`);
  }
});

$('#geo-search').addEventListener('submit',event=>{
  event.preventDefault();const query=$('#geo-query').value.trim();const places={'北京':[116.4,39.9],'上海':[121.47,31.23],'广州':[113.26,23.13],'太平洋':[-150,5],'大西洋':[-35,15],'印度洋':[75,-15],'南极':[0,-75],'北极':[0,85],'日本':[139.7,35.7],'beijing':[116.4,39.9],'pacific':[-150,5],'atlantic':[-35,15],'london':[-.12,51.5]};let coords=places[query]||places[query.toLowerCase()];
  if(!coords){const parsed=query.replace(/，/g,',').split(',').map(s=>Number(s.trim()));if(parsed.length===2&&parsed.every(Number.isFinite)&&query.includes(','))coords=parsed;}
  if(!coords||Math.abs(coords[0])>180||Math.abs(coords[1])>90){toast('可输入北京、上海、太平洋等地点，或“经度,纬度”。');return;}state.location={lon:coords[0],lat:coords[1]};scene.flyToGeo(...coords);$('#globe-coordinate').textContent=formatCoordinate(state.location);if(state.panel==='weather')loadWeather();
});

document.addEventListener('keydown',event=>{
  if(event.key.toLowerCase()==='k'&&(event.ctrlKey||event.metaKey)){event.preventDefault();if(!$('#info-dialog').open&&!$('#search-dialog').open)openSearch();return;}
  if(event.target.closest('input,textarea,select,[contenteditable]')||$('#search-dialog').open||$('#info-dialog').open)return;
  const key=event.key.toLowerCase();
  if(key==='escape'){
    if(!$('#archive').hidden){closeArchive();return;}if(state.panel){closePanel();return;}if(state.immersive){immersive();return;}if(state.mode==='flight'){changeMode('three');return;}if(state.mode==='globe'){changeMode('atlas');return;}if(state.selection){state.selection=null;changeMode(state.mode);return;}return;
  }
  if(state.landing){if(key==='enter'){event.preventDefault();enter();}return;}
  if(state.mode==='flight')return;
  if(['1','2','3','4','5'].includes(key)){changeMode(['atlas','three','live','deep','flight'][Number(key)-1]);return;}
  if(key==='h')home();if(key==='i')immersive();if(key==='s')openPanel('science');if(key==='l')openPanel('layers');if(key==='g')openPanel('quality');if(key==='?')showGuide();
  if(key==='d'&&state.selection)$('#archive').hidden?renderArchive(state.selection):closeArchive();
  if(key===' '&&['atlas','three','live'].includes(state.mode)){event.preventDefault();playTimeline();}
});
$('#landing').addEventListener('wheel',event=>{if(event.deltaY>55&&$('#landing').scrollHeight<innerHeight+40)enter();},{passive:true});

updateLanguage();updateScienceBadge();
scene.init().catch(error=>{
  console.error(error);$('#boot-stage').textContent='三维场景暂时无法启动';$('#boot-percent').innerHTML='!';
  const retry=document.createElement('button');retry.className='secondary-button';retry.textContent='重新加载';retry.addEventListener('click',()=>location.reload());$('.boot-center').append(retry);
});
