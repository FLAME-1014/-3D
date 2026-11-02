(function () {
  'use strict';
  var ui = {};
  ['map','overview','details','return','status','metrics','failure'].forEach(function(id){ui[id]=document.getElementById(id);});
  var renderer;
  try { renderer = new THREE.WebGLRenderer({canvas:ui.map,antialias:true,powerPreference:'high-performance'}); }
  catch(error){ui.failure.hidden=false;ui.failure.textContent='无法创建 WebGL 场景，请使用支持硬件加速的浏览器。';return;}
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  var scene=new THREE.Scene();scene.background=new THREE.Color(0x7295a8);scene.fog=new THREE.FogExp2(0x7295a8,0.00033);
  var camera=new THREE.PerspectiveCamera(48,1,1,12000);
  scene.add(new THREE.HemisphereLight(0xdceefa,0x425d53,1.35));
  var sun=new THREE.DirectionalLight(0xffeed4,2.1);sun.position.set(-800,1200,500);scene.add(sun);
  var city=new THREE.Group();scene.add(city);
  var geo=window.FusionGeo;
  function point(id){var p=geo.toLocal(geo.anchors[id].coord,'WGS84');return new THREE.Vector3(p.x,0,p.z);}
  var museumAnchor=point('museum');
  var baseMat=new THREE.MeshStandardMaterial({color:0x889889,roughness:1});
  var roadMat=new THREE.MeshStandardMaterial({color:0x566b71,roughness:1});
  var parkMat=new THREE.MeshStandardMaterial({color:0x607f65,roughness:1});
  var waterMat=new THREE.MeshStandardMaterial({color:0x317f99,roughness:.4,metalness:.1});
  var stoneMat=new THREE.MeshStandardMaterial({color:0xb8b8a5,roughness:.9});
  var bridgeMat=new THREE.MeshStandardMaterial({color:0xb9c8c7,roughness:.7});
  function box(parent,w,h,d,x,y,z,mat){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;}
  function atBox(id,w,h,d,mat){var p=point(id);return box(city,w,h,d,p.x,h/2,p.z,mat);}
  box(city,3600,5,3200,-120,-5,100,baseMat);
  // Riverbank and road polygons are placeholders, not source geometry.
  box(city,3600,2,290,-120,-1,660,waterMat);
  box(city,280,1,180,-210,.1,360,parkMat);
  box(city,270,1,340,0,-.6,0,stoneMat);
  var axis=point('south');
  box(city,120,1,650,axis.x,-.5,-180,stoneMat);
  box(city,70,1,610,axis.x,.05,-230,parkMat);
  box(city,1800,1,28,-120,.05,axis.z+30,roadMat);
  box(city,28,1,900,175,.05,-200,roadMat);
  box(city,28,1,900,-555,.05,-200,roadMat);
  box(city,1600,1,26,-120,.05,-465,roadMat);

  atBox('youth',90,35,85,stoneMat);
  atBox('ifc',65,438.6,65,new THREE.MeshStandardMaterial({color:0x7093a0,roughness:.45,metalness:.25}));
  atBox('ctf',70,530,70,new THREE.MeshStandardMaterial({color:0x93aab0,roughness:.45,metalness:.25}));
  var op=point('opera');
  var pebbleMat=new THREE.MeshStandardMaterial({color:0x69747a,roughness:.8,flatShading:true});
  var pebble=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),pebbleMat);pebble.position.set(op.x-23,23,op.z);pebble.scale.set(58,22,40);city.add(pebble);
  var small=new THREE.Mesh(pebble.geometry,new THREE.MeshStandardMaterial({color:0xd5d6c9,flatShading:true}));small.position.set(op.x+45,14,op.z+30);small.scale.set(30,14,24);city.add(small);
  var randomSeed=49;
  function random(){randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;}
  var instances=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xa5b5b8,roughness:.85}),100);
  var matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),index=0;
  // Unnamed context stays outside the cultural core; footprints/heights are schematic.
  while(index<100){var x=(random()-.5)*2500,z=-120-random()*1100;if(x>-620&&x<240&&z>-520)continue;if(Object.keys(geo.anchors).some(function(id){return point(id).distanceTo(new THREE.Vector3(x,0,z))<130;}))continue;var h=22+random()*120;matrix.compose(new THREE.Vector3(x,h/2,z),quat,new THREE.Vector3(35+random()*35,h,35+random()*35));instances.setMatrixAt(index++,matrix);}city.add(instances);
  var towerGroup=new THREE.Group();towerGroup.position.copy(point('tower'));city.add(towerGroup);
  var profile=[[0,35],[80,30],[240,16],[340,19],[455,30]].map(function(p){return new THREE.Vector2(p[1],p[0]);});
  towerGroup.add(new THREE.Mesh(new THREE.LatheGeometry(profile,24),new THREE.MeshStandardMaterial({color:0xc8d9dc,wireframe:true})));
  box(towerGroup,3,145,3,0,527.5,0,bridgeMat);
  var labels=[];
  ['youth','ifc','ctf','tower'].forEach(function(id){var p=point(id),h=id==='tower'?630:id==='ifc'?465:id==='ctf'?555:75;var el=document.createElement('span');el.className='map-label';el.textContent=geo.anchors[id].name+' · 简模';el.hidden=true;document.body.append(el);labels.push({id:id,position:p.add(new THREE.Vector3(0,h,0)),el:el,priority:id==='tower'?40:id==='ifc'||id==='ctf'?30:10});});
  var museum=new THREE.Group();museum.position.copy(museumAnchor);scene.add(museum);
  var coarse=new THREE.Group();museum.add(coarse);
  box(coarse,113.5,35.5,113.5,0,26.75,0,new THREE.MeshStandardMaterial({color:0x414448,roughness:.7,metalness:.15}));
  box(coarse,65,9,65,0,4.5,0,new THREE.MeshStandardMaterial({color:0x96b9ba,roughness:.3}));
  box(coarse,2,17,25,-57.9,25,15,new THREE.MeshStandardMaterial({color:0xc54135}));
  var operaGroup=new THREE.Group();operaGroup.position.copy(op);scene.add(operaGroup);
  city.remove(pebble,small);var operaCoarse=new THREE.Group();operaGroup.add(operaCoarse);pebble.position.sub(op);small.position.sub(op);operaCoarse.add(pebble,small);
  var selected='museum',panelPlace=null,selectionActive=false,currentView='main',tourActive=false,districtActive=false,detailSection='about';
  var places={};
  window.FusionCatalog.places.forEach(function(config){
    var anchor=point(config.anchor),group,coarseModel;
    if(config.id==='museum'){group=museum;coarseModel=coarse;}
    else if(config.id==='opera'){group=operaGroup;coarseModel=operaCoarse;}
    else {group=new THREE.Group();group.position.copy(anchor);scene.add(group);coarseModel=new THREE.Group();group.add(coarseModel);config.coarseBoxes.forEach(function(b){box.apply(null,[coarseModel].concat(b,[bridgeMat]));});}
    var marker=document.createElement('button');marker.className='marker';marker.id='marker-'+config.id;marker.hidden=true;marker.append(document.createTextNode(config.name+' '));var hint=document.createElement('span');hint.textContent='点击靠近 ↗';marker.append(hint);document.body.append(marker);marker.onclick=function(){go(config.id);};
    places[config.id]=Object.assign({},config,{group:group,anchor:anchor,coarse:coarseModel,marker:marker,detail:null,textures:null,loading:null,visible:false,desired:false,timer:null});
  });
  var reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var target=new THREE.Vector3(-210,0,-50),theta=-.65,phi=.86,radius=1850;
  var tween=null,last=performance.now(),fps=60,frames=0,fpsAt=last,uiAt=0,renderMs=0,frameMs=0,framePrevious=last;
  var pointer=new Map(),dragStart=null,pinch=null,panMode=false;
  var panButton=document.getElementById("pan-mode");panButton.onclick=function(){panMode=!panMode;panButton.setAttribute("aria-pressed",String(panMode));};
  document.getElementById("details-toggle").onclick=function(){var body=document.getElementById("details-body");body.hidden=!body.hidden;this.textContent=body.hidden?"展开详情":"收起详情";this.setAttribute("aria-expanded",String(!body.hidden));};
  if(innerWidth<700){document.getElementById("details-body").hidden=true;var toggle=document.getElementById("details-toggle");toggle.textContent="展开详情";toggle.setAttribute("aria-expanded","false");}
  ui.map.addEventListener("contextmenu",function(e){e.preventDefault();});
  function panBy(dx,dy){var delta=window.FusionInteraction.pan(dx,dy,radius,theta,innerHeight,camera.fov);target.x=THREE.MathUtils.clamp(target.x+delta.x,-1600,1600);target.z=THREE.MathUtils.clamp(target.z+delta.z,-1600,1600);}

  var raycaster=new THREE.Raycaster();
  function pose(){camera.position.set(target.x+radius*Math.sin(phi)*Math.sin(theta),target.y+radius*Math.cos(phi),target.z+radius*Math.sin(phi)*Math.cos(theta));camera.lookAt(target);}
  function script(src){return new Promise(function(resolve,reject){var element=document.createElement('script');element.src=src;element.onload=resolve;element.onerror=function(){element.remove();reject(new Error('asset_script_failed'));};document.head.appendChild(element);});}
  function disposeDetail(place){
    if(!place.detail||place.desired)return;
    place.group.remove(place.detail);var geometries=new Set(),materials=new Set(),maps=new Set();
    place.detail.traverse(function(o){if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(function(m){materials.add(m);Object.keys(m).forEach(function(k){if(m[k]&&m[k].isTexture)maps.add(m[k]);});if(m.uniforms)Object.keys(m.uniforms).forEach(function(k){var value=m.uniforms[k].value;if(value&&value.isTexture)maps.add(value);});});});
    if(place.textures)Object.keys(place.textures).forEach(function(k){if(place.textures[k]&&place.textures[k].isTexture)maps.add(place.textures[k]);});
    geometries.forEach(function(g){g.dispose();});materials.forEach(function(m){m.dispose();});maps.forEach(function(t){t.dispose();});place.detail=null;place.textures=null;place.loading=null;place.built=null;
  }
  function ensureDetail(place){
    if(place.detail)return Promise.resolve(place.detail);
    if(place.loading)return place.loading;
    var model=place.model;
    place.loading=Promise.resolve().then(function(){return !model.textureScript||window[model.textureGlobal]?null:script(model.textureScript);}).then(function(){return window[model.global]?null:script(model.script);}).then(function(){
      place.textures=model.textureGlobal?window[model.textureGlobal].build(renderer):null;
      place.built=window[model.global].build({textures:place.textures,low:innerWidth<700,precinctOnly:true});
      place.detail=place.built.root;place.detail.visible=false;place.group.add(place.detail);if(!place.desired){clearTimeout(place.timer);place.timer=setTimeout(function(){disposeDetail(place);},15000);}return place.detail;
    }).catch(function(error){place.loading=null;place.desired=false;place.retryAt=performance.now()+5000;ui.status.textContent=place.name+'加载失败，点击靠近可重试。';throw error;});return place.loading;
  }
  function changeDetail(place,value){
    clearTimeout(place.timer);place.desired=value;
    if(!value){place.visible=false;if(place.detail)place.detail.visible=false;place.coarse.visible=true;place.timer=setTimeout(function(){disposeDetail(place);},15000);return;}
    ensureDetail(place).then(function(){if(!place.desired)return;place.detail.visible=true;place.coarse.visible=false;place.visible=true;}).catch(function(){});
  }
  var overviewView={target:new THREE.Vector3(-210,0,-50),radius:1850,theta:-.65,phi:.86};
  var explorer=document.getElementById('explorer'),exploreToggle=document.getElementById('explore-toggle'),searchInput=document.getElementById('place-search'),viewBar=document.getElementById('place-views');
  function explorerOpen(value){explorer.hidden=!value;exploreToggle.setAttribute('aria-expanded',String(value));if(value){ui.details.hidden=true;searchInput.focus();}else exploreToggle.focus();}
  function renderResults(){var matches=window.FusionCatalog.search(searchInput.value),list=document.getElementById('place-results');list.replaceChildren();document.getElementById('search-summary').textContent=matches.length?'找到 '+matches.length+' 个已接入地点':'没有匹配地点，请试试“省博”“大剧院”或“广图”。';matches.forEach(function(p){var li=document.createElement('li'),button=document.createElement('button'),title=document.createElement('strong'),meta=document.createElement('small');title.textContent=p.name;meta.textContent=p.area+' · '+p.category+' · '+p.level;button.append(title,meta);button.onclick=function(){explorerOpen(false);go(p.id);};li.append(button);list.append(li);});}
  function renderViews(){renderTour();var bar=document.getElementById('selection-bar');bar.hidden=!selectionActive;if(!selectionActive)return;var p=window.FusionCatalog.get(selected);document.getElementById('current-place').textContent='当前地点：'+p.name+' · '+p.level;viewBar.replaceChildren();p.views.forEach(function(v){var button=document.createElement('button');button.textContent=v.label;button.setAttribute('aria-pressed',String(v.id===currentView));button.onclick=function(){go(v.id);};viewBar.append(button);});}
  exploreToggle.onclick=function(){explorerOpen(explorer.hidden);};document.getElementById('explore-close').onclick=function(){explorerOpen(false);};searchInput.oninput=renderResults;searchInput.onkeydown=function(event){if(event.key==='Enter'){var match=window.FusionCatalog.search(searchInput.value);if(match.length===1){explorerOpen(false);go(match[0].id);}}};document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!explorer.hidden)explorerOpen(false);});renderResults();
  function updatePanel(){var p=places[selected];ui.details.hidden=!p.visible||!explorer.hidden;if(!p.visible){panelPlace=null;return;}if(panelPlace===selected)return;panelPlace=selected;document.getElementById('place-name').textContent=p.name;document.getElementById('place-en').textContent=p.en;document.getElementById('place-size').textContent=p.size;document.getElementById('place-height').textContent=p.height;document.getElementById('place-content').textContent=p.content;document.getElementById('place-note').textContent=p.note||'尺寸为既有模型资料口径；锚点来自历史 OSM/WGS84 考据，未重新测绘；朝向、道路、河岸与景观边界仍为示意。';document.getElementById('place-level').textContent=p.level;activateNearby();}
  function activateNearby(){if(detailSection==='nearby'&&places[selected].visible&&window.FusionPoi)window.FusionPoi.activate(selected);}
  function switchDetails(name){detailSection=name;document.getElementById('building-about').hidden=name!=='about';document.getElementById('nearby-panel').hidden=name!=='nearby';document.getElementById('detail-about').setAttribute('aria-pressed',String(name==='about'));document.getElementById('detail-nearby').setAttribute('aria-pressed',String(name==='nearby'));activateNearby();}
  document.getElementById('detail-about').onclick=function(){switchDetails('about');};document.getElementById('detail-nearby').onclick=function(){switchDetails('nearby');};
  function renderTour(){var controls=document.getElementById('tour-controls');controls.hidden=!tourActive;document.body.classList.toggle('tour-active',tourActive);if(!tourActive)return;var ids=window.FusionDistrict.ids,index=ids.indexOf(selected),next=window.FusionDistrict.next(selected);document.getElementById('tour-place').value=selected;document.getElementById('tour-progress').textContent=(index+1)+' / '+ids.length+' · 镜头探索，非步行导航';document.getElementById('tour-next').textContent=next?'下一站':'完成探索';}
  window.FusionDistrict.ids.forEach(function(id){var option=document.createElement('option');option.value=id;option.textContent=places[id].name;document.getElementById('tour-place').append(option);});
  document.getElementById('district-overview').onclick=function(){explorerOpen(false);go('district');};
  document.getElementById('tour-start').onclick=function(){tourActive=true;explorerOpen(false);go(window.FusionDistrict.ids[0]);};
  document.getElementById('tour-place').onchange=function(){go(this.value);};
  document.getElementById('tour-next').onclick=function(){var next=window.FusionDistrict.next(selected);if(next)go(next);else{tourActive=false;renderViews();exploreToggle.focus();}};
  document.getElementById('tour-exit').onclick=function(){tourActive=false;renderViews();exploreToggle.focus();};
  function districtView(){var view=window.FusionDistrict.fit(window.FusionDistrict.ids.map(function(id){return places[id].anchor;}),camera.aspect,camera.fov);return {target:new THREE.Vector3().fromArray(view.target),radius:view.radius,theta:view.theta,phi:view.phi};}
  function go(name){
    var v;
    if(name==='overview'||name==='district'){v=name==='district'?districtView():overviewView;districtActive=name==='district';tourActive=false;selectionActive=false;currentView='main';Object.keys(places).forEach(function(id){changeDetail(places[id],false);});}
    else {
      districtActive=false;explorer.hidden=true;exploreToggle.setAttribute('aria-expanded','false');
      if(window.FusionCatalog.get(name)){selected=name;currentView='main';}
      else currentView=name;
      var config=window.FusionCatalog.get(selected),view=config.views.find(function(item){return item.id===currentView;});if(!view)return;
      selectionActive=true;v={target:places[selected].anchor.clone().add(new THREE.Vector3().fromArray(view.offset)),radius:view.radius,theta:view.theta,phi:view.phi};
    }
    renderViews();tween={at:performance.now(),duration:reduced?0:2400,from:{target:target.clone(),radius:radius,theta:theta,phi:phi},to:v};if(name!=='overview'&&name!=='district')ensureDetail(places[selected]).catch(function(){});
  }
  ui.overview.onclick=ui.return.onclick=function(){go('overview');};
  function end(){tween=null;districtActive=false;}
  ui.map.addEventListener('pointerdown',function(event){end();ui.map.setPointerCapture(event.pointerId);pointer.set(event.pointerId,{x:event.clientX,y:event.clientY});dragStart={x:event.clientX,y:event.clientY,moved:pointer.size>1,pan:panMode||event.button===2||event.shiftKey};if(pointer.size===2){var pts=Array.from(pointer.values());pinch={distance:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),radius:radius};}});
  ui.map.addEventListener('pointermove',function(event){
    if(!pointer.has(event.pointerId))return;
    var old=pointer.get(event.pointerId),before=Array.from(pointer.values());pointer.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointer.size>=2&&pinch){var pts=Array.from(pointer.values());panBy((pts[0].x+pts[1].x-before[0].x-before[1].x)/2,(pts[0].y+pts[1].y-before[0].y-before[1].y)/2);radius=THREE.MathUtils.clamp(pinch.radius*pinch.distance/Math.max(1,Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)),90,4300);}
    else if(dragStart&&dragStart.pan)panBy(event.clientX-old.x,event.clientY-old.y);
    else{theta-=(event.clientX-old.x)*.005;phi=THREE.MathUtils.clamp(phi+(event.clientY-old.y)*.004,.2,1.48);}
    if(dragStart&&Math.hypot(event.clientX-dragStart.x,event.clientY-dragStart.y)>6)dragStart.moved=true;
  });
  function release(event){if(event.type==='pointerup'&&dragStart&&!dragStart.moved&&!dragStart.pan&&pointer.size===1){raycaster.setFromCamera(new THREE.Vector2(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2),camera);var hits=[];Object.keys(places).forEach(function(id){var p=places[id];var hit=raycaster.intersectObject(p.visible&&p.detail?p.detail:p.coarse,true)[0];if(hit)hits.push({id:id,distance:hit.distance});});hits.sort(function(a,b){return a.distance-b.distance;});if(hits.length)go(hits[0].id);}pointer.delete(event.pointerId);pinch=null;var remaining=Array.from(pointer.values())[0];dragStart=remaining?{x:remaining.x,y:remaining.y,moved:true,pan:panMode}:null;}
  ui.map.addEventListener('pointerup',release);ui.map.addEventListener('pointercancel',release);ui.map.addEventListener('lostpointercapture',function(event){if(pointer.has(event.pointerId))release(event);});
  ui.map.addEventListener('wheel',function(event){event.preventDefault();end();radius=THREE.MathUtils.clamp(radius*Math.exp(event.deltaY*.001),90,4300);},{passive:false});
  document.addEventListener('keydown',function(event){if(event.target.tagName==='SELECT'||event.target.tagName==='TEXTAREA'||event.target.isContentEditable||event.target.tagName==='BUTTON'||event.target.tagName==='A'||event.target.closest('aside')||event.target.closest('#explorer')||event.target.tagName==='INPUT')return;var used=true;switch(event.key.toLowerCase()){case'w':panBy(0,25);break;case's':panBy(0,-25);break;case'a':panBy(25,0);break;case'd':panBy(-25,0);break;case'arrowleft':theta-=.08;break;case'arrowright':theta+=.08;break;case'arrowup':phi=Math.max(.2,phi-.06);break;case'arrowdown':phi=Math.min(1.48,phi+.06);break;case'+':case'=':radius=Math.max(90,radius*.9);break;case'-':radius=Math.min(4300,radius*1.1);break;default:used=false;}if(used){end();event.preventDefault();}});
  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(districtActive&&!tween){var district=districtView();target.copy(district.target);radius=district.radius;}renderer.setSize(innerWidth,innerHeight,false);}addEventListener('resize',resize);resize();pose();
  function updateLabels(){
    var helper=window.FusionInteraction,obstacles=[];document.querySelectorAll("header,.actions,#explorer,#details,#selection-bar,footer").forEach(function(el){if(!el.hidden){var r=el.getBoundingClientRect();obstacles.push({left:r.left,right:r.right,top:r.top,bottom:r.bottom});}});
    var candidates=[];Object.keys(places).forEach(function(id){var p=places[id];p.marker.hidden=true;if(p.visible)return;var projected=p.anchor.clone().add(new THREE.Vector3(0,65,0)).project(camera);if(projected.z<-1||projected.z>1)return;p.marker.hidden=false;var bounds=p.marker.getBoundingClientRect();p.marker.hidden=true;var width=bounds.width,height=bounds.height,left=(projected.x*.5+.5)*innerWidth-width/2,top=(-projected.y*.5+.5)*innerHeight-height;candidates.push({id:id,el:p.marker,left:left,right:left+width,top:top,bottom:top+height,priority:selectionActive&&selected===id?100:p.labelPriority,marker:true,width:width});});
    labels.forEach(function(label){label.el.hidden=true;if(radius>2400&&label.priority<30||radius<550)return;var p=label.position.clone().project(camera);if(p.z<-1||p.z>1)return;label.el.hidden=false;var bounds=label.el.getBoundingClientRect();label.el.hidden=true;var left=(p.x*.5+.5)*innerWidth-bounds.width/2,top=(-p.y*.5+.5)*innerHeight-bounds.height;candidates.push({el:label.el,left:left,right:left+bounds.width,top:top,bottom:top+bounds.height,priority:label.priority});});
    helper.selectLabels(candidates,obstacles,{width:innerWidth,height:innerHeight},innerWidth<700?3:6).forEach(function(item){item.el.hidden=false;item.el.style.left=(item.marker?item.left+item.width/2:item.left)+"px";item.el.style.top=(item.marker?item.bottom:item.top)+"px";});
  }
  function animate(now){requestAnimationFrame(animate);if(document.hidden){framePrevious=now;return;}frameMs=frameMs*.9+(now-framePrevious)*.1;framePrevious=now;frames++;if(now-fpsAt>1000){fps=Math.round(frames*1000/(now-fpsAt));frames=0;fpsAt=now;}
    if(districtActive&&tween)tween.to=districtView();
    if(tween){var p=tween.duration===0?1:Math.min(1,(now-tween.at)/tween.duration);p=p*p*(3-2*p);target.copy(tween.from.target).lerp(tween.to.target,p);radius=Math.exp(THREE.MathUtils.lerp(Math.log(tween.from.radius),Math.log(tween.to.radius),p));theta=THREE.MathUtils.lerp(tween.from.theta,tween.to.theta,p);phi=THREE.MathUtils.lerp(tween.from.phi,tween.to.phi,p);if(p>=1)tween=null;}
    pose();camera.updateMatrixWorld();
    Object.keys(places).forEach(function(id){var p=places[id],distance=camera.position.distanceTo(p.anchor);if(selectionActive&&id===selected&&distance<390&&!p.desired&&(!p.retryAt||now>p.retryAt))changeDetail(p,true);else if((!selectionActive||id!==selected||distance>520)&&p.desired)changeDetail(p,false);if(p.built&&p.built.waterUniforms)p.built.waterUniforms.uTime.value=now/1000;if(p.built&&p.built.glassUniforms)p.built.glassUniforms.uTime.value=now/1000;});
    var refreshUI=now-uiAt>200;if(refreshUI){uiAt=now;document.body.style.setProperty('--tour-bar-height',document.getElementById('selection-bar').getBoundingClientRect().height+'px');updatePanel();updateLabels();
    ui.status.textContent=places[selected].visible?places[selected].name+' · '+places[selected].level+'与周边':(districtActive?'文化带总览 · 三座地标，同图浏览':'区域总览 · 三个地标按需加载');
    }var renderStart=performance.now();renderer.render(scene,camera);renderMs=renderMs*.9+(performance.now()-renderStart)*.1;
    if(refreshUI){ui.metrics.dataset.target=target.x.toFixed(1)+','+target.z.toFixed(1);ui.metrics.dataset.radius=radius.toFixed(1);ui.metrics.dataset.geometries=String(renderer.info.memory.geometries);ui.metrics.dataset.textures=String(renderer.info.memory.textures);
    ui.metrics.textContent=(document.hidden?'后台暂停统计':fps+' fps')+' · '+renderer.info.render.calls+' calls · '+renderer.info.render.triangles.toLocaleString()+' tris · '+renderMs.toFixed(1)+'ms CPU render / '+frameMs.toFixed(1)+'ms frame · '+renderer.info.memory.geometries+' geo / '+renderer.info.memory.textures+' tex · '+document.visibilityState+'/'+(document.hasFocus()?'focused':'unfocused')+' · '+Object.keys(places).map(function(id){var p=places[id];return id+':'+(p.visible?'detail':p.detail?'cached':'unloaded');}).join(' / ');}
  }document.addEventListener('visibilitychange',function(){frames=0;fpsAt=performance.now();framePrevious=fpsAt;frameMs=0;fps=0;if(document.hidden)ui.metrics.textContent='后台暂停渲染与统计';});requestAnimationFrame(animate);
  window.FusionDebug={get anchors(){return geo.anchors;},get scene(){return scene;},get renderer(){return renderer;},get camera(){return camera;},get detail(){return places[selected].detail;},get detailVisible(){return places[selected].visible;},get places(){return places;},get performance(){return {fps:fps,frameMs:frameMs,renderMs:renderMs,hidden:document.hidden};},get counts(){return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},go:go};
})();
