(function () {
  'use strict';
  var ui = {};
  ['map','overview','visit','visit-opera','roof','entry','marker','marker-opera','details','return','status','metrics','failure'].forEach(function(id){ui[id]=document.getElementById(id);});
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
  atBox('library',105,50,65,bridgeMat);
  var library=point('library');
  for(var f=0;f<12;f++)box(city,2,53,70,library.x-49+f*9,26.5,library.z,stoneMat);
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
  function label(text,x,y,z){var c=document.createElement('canvas');c.width=512;c.height=96;var ctx=c.getContext('2d');ctx.fillStyle='rgba(18,39,51,.8)';ctx.fillRect(0,0,512,96);ctx.font='34px Microsoft YaHei, sans-serif';ctx.textAlign='center';ctx.fillStyle='#ecf3f2';ctx.fillText(text,256,62);var sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:true}));sprite.position.set(x,y,z);sprite.scale.set(170,32,1);city.add(sprite);return sprite;}
  var labels=[];
  ['opera','library','youth','ifc','ctf','tower'].forEach(function(id){var p=point(id),h=id==='tower'?630:id==='ifc'?465:id==='ctf'?555:75;if(id!=='opera')labels.push(label(geo.anchors[id].name+' · 简模',p.x,h,p.z));});
  labels.push(label('珠江 · 岸线示意',-600,15,660));
  var museum=new THREE.Group();museum.position.copy(museumAnchor);scene.add(museum);
  var coarse=new THREE.Group();museum.add(coarse);
  box(coarse,113.5,35.5,113.5,0,26.75,0,new THREE.MeshStandardMaterial({color:0x414448,roughness:.7,metalness:.15}));
  box(coarse,65,9,65,0,4.5,0,new THREE.MeshStandardMaterial({color:0x96b9ba,roughness:.3}));
  box(coarse,2,17,25,-57.9,25,15,new THREE.MeshStandardMaterial({color:0xc54135}));
  var operaGroup=new THREE.Group();operaGroup.position.copy(op);scene.add(operaGroup);
  city.remove(pebble,small);var operaCoarse=new THREE.Group();operaGroup.add(operaCoarse);pebble.position.sub(op);small.position.sub(op);operaCoarse.add(pebble,small);
  var selected='museum',panelPlace=null;
  var places={
    museum:{name:'广东省博物馆',en:'GUANGDONG MUSEUM',group:museum,anchor:museumAnchor,coarse:coarse,marker:ui.marker,prefix:'gd-museum',textureGlobal:'GdMuseumTextures',modelGlobal:'GdMuseumModel',size:'约 113.5 × 113.5 m',height:'约 44.5 m',content:'建筑、台阶、缓坡、草地、树阵'},
    opera:{name:'广州大剧院',en:'GUANGZHOU OPERA HOUSE',group:operaGroup,anchor:op,coarse:operaCoarse,marker:ui['marker-opera'],prefix:'operahouse',textureGlobal:'OperaHouseTextures',modelGlobal:'OperaHouseModel',size:'双砾主体；范围为既有模型估算',height:'大砾约 43.1 m / 小砾约 28 m',content:'双砾、玻璃口部、平台、水池、草坡'}
  };
  Object.keys(places).forEach(function(id){Object.assign(places[id],{detail:null,textures:null,loading:null,visible:false,desired:false,timer:null});});
  var reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var target=new THREE.Vector3(-210,0,-50),theta=-.65,phi=.86,radius=1850;
  var tween=null,last=performance.now(),fps=60,frames=0,fpsAt=last;
  var pointer=new Map(),dragStart=null,pinch=null;
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
    place.loading=Promise.resolve().then(function(){return window[place.textureGlobal]?null:script(place.prefix+'-textures.js');}).then(function(){return window[place.modelGlobal]?null:script(place.prefix+'-model.js');}).then(function(){
      place.textures=window[place.textureGlobal].build(renderer);
      place.built=window[place.modelGlobal].build({textures:place.textures,low:innerWidth<700,precinctOnly:true});
      place.detail=place.built.root;place.detail.visible=false;place.group.add(place.detail);return place.detail;
    }).catch(function(error){place.loading=null;ui.status.textContent=place.name+'加载失败，点击靠近可重试。';throw error;});return place.loading;
  }
  function changeDetail(place,value){
    clearTimeout(place.timer);place.desired=value;
    if(!value){place.visible=false;if(place.detail)place.detail.visible=false;place.coarse.visible=true;place.timer=setTimeout(function(){disposeDetail(place);},15000);return;}
    ensureDetail(place).then(function(){if(!place.desired)return;place.detail.visible=true;place.coarse.visible=false;place.visible=true;}).catch(function(){});
  }
  var views={
    overview:{target:new THREE.Vector3(-210,0,-50),radius:1850,theta:-.65,phi:.86},
    museum:{target:museumAnchor.clone().add(new THREE.Vector3(0,22,0)),radius:245,theta:-1.05,phi:1.22},
    opera:{target:op.clone().add(new THREE.Vector3(0,20,-45)),radius:255,theta:.45,phi:1.22}
  };
  function updatePanel(){var p=places[selected];ui.details.hidden=!p.visible;if(!p.visible){panelPlace=null;return;}if(panelPlace===selected)return;panelPlace=selected;document.getElementById('place-name').textContent=p.name;document.getElementById('place-en').textContent=p.en;document.getElementById('place-size').textContent=p.size;document.getElementById('place-height').textContent=p.height;document.getElementById('place-content').textContent=p.content;if(window.FusionPoi)window.FusionPoi.activate(selected);}
  function go(name){
    var v;
    if(name==='overview')v=views.overview;
    else if(name==='roof'||name==='entry'){var base=places[selected].anchor;v={target:base.clone().add(new THREE.Vector3(name==='entry'&&selected==='museum'?-40:0,name==='entry'?10:22,selected==='opera'?-45:0)),radius:name==='entry'?170:290,theta:name==='entry'?(selected==='opera'?.55:-1.57):-.8,phi:name==='entry'?1.4:.55};}
    else{selected=name;v=views[name];}
    if(!v)return;
    tween={at:performance.now(),duration:reduced?0:2400,from:{target:target.clone(),radius:radius,theta:theta,phi:phi},to:v};if(name!=='overview')ensureDetail(places[selected]).catch(function(){});
  }
  ui.overview.onclick=ui.return.onclick=function(){go('overview');};ui.visit.onclick=ui.marker.onclick=function(){go('museum');};ui['visit-opera'].onclick=ui['marker-opera'].onclick=function(){go('opera');};ui.roof.onclick=function(){go('roof');};ui.entry.onclick=function(){go('entry');};
  function end(){tween=null;}
  ui.map.addEventListener('pointerdown',function(event){end();ui.map.setPointerCapture(event.pointerId);pointer.set(event.pointerId,{x:event.clientX,y:event.clientY});dragStart={x:event.clientX,y:event.clientY,moved:false};if(pointer.size===2){var pts=Array.from(pointer.values());pinch={distance:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),radius:radius};}});
  ui.map.addEventListener('pointermove',function(event){if(!pointer.has(event.pointerId))return;var old=pointer.get(event.pointerId);pointer.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointer.size===2&&pinch){var pts=Array.from(pointer.values());radius=THREE.MathUtils.clamp(pinch.radius*pinch.distance/Math.max(1,Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)),90,4300);}else{theta-=(event.clientX-old.x)*.005;phi=THREE.MathUtils.clamp(phi+(event.clientY-old.y)*.004,.2,1.48);}if(dragStart&&Math.hypot(event.clientX-dragStart.x,event.clientY-dragStart.y)>6)dragStart.moved=true;});
  function release(event){if(event.type==='pointerup'&&dragStart&&!dragStart.moved&&pointer.size===1){raycaster.setFromCamera(new THREE.Vector2(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2),camera);var hits=[];Object.keys(places).forEach(function(id){var p=places[id];var hit=raycaster.intersectObject(p.visible&&p.detail?p.detail:p.coarse,true)[0];if(hit)hits.push({id:id,distance:hit.distance});});hits.sort(function(a,b){return a.distance-b.distance;});if(hits.length)go(hits[0].id);}pointer.delete(event.pointerId);pinch=null;dragStart=null;}
  ui.map.addEventListener('pointerup',release);ui.map.addEventListener('pointercancel',release);
  ui.map.addEventListener('wheel',function(event){event.preventDefault();end();radius=THREE.MathUtils.clamp(radius*Math.exp(event.deltaY*.001),90,4300);},{passive:false});
  document.addEventListener('keydown',function(event){if(event.target.tagName==='BUTTON'||event.target.tagName==='A'||event.target.closest('aside'))return;var used=true;switch(event.key){case'ArrowLeft':theta-=.08;break;case'ArrowRight':theta+=.08;break;case'ArrowUp':phi=Math.max(.2,phi-.06);break;case'ArrowDown':phi=Math.min(1.48,phi+.06);break;case'+':case'=':radius=Math.max(90,radius*.9);break;case'-':radius=Math.min(4300,radius*1.1);break;default:used=false;}if(used){end();event.preventDefault();}});
  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);}addEventListener('resize',resize);resize();pose();
  function animate(now){requestAnimationFrame(animate);frames++;if(now-fpsAt>1000){fps=Math.round(frames*1000/(now-fpsAt));frames=0;fpsAt=now;}
    if(tween){var p=tween.duration===0?1:Math.min(1,(now-tween.at)/tween.duration);p=p*p*(3-2*p);target.copy(tween.from.target).lerp(tween.to.target,p);radius=Math.exp(THREE.MathUtils.lerp(Math.log(tween.from.radius),Math.log(tween.to.radius),p));theta=THREE.MathUtils.lerp(tween.from.theta,tween.to.theta,p);phi=THREE.MathUtils.lerp(tween.from.phi,tween.to.phi,p);if(p>=1)tween=null;}
    pose();camera.updateMatrixWorld();
    Object.keys(places).forEach(function(id){var p=places[id],distance=camera.position.distanceTo(p.anchor);if(id===selected&&distance<390&&!p.desired)changeDetail(p,true);else if((id!==selected||distance>520)&&p.desired)changeDetail(p,false);var projected=p.anchor.clone().add(new THREE.Vector3(0,65,0)).project(camera);p.marker.hidden=p.visible||projected.z>1||Math.abs(projected.x)>.95||Math.abs(projected.y)>.9;p.marker.style.left=(projected.x*.5+.5)*innerWidth+'px';p.marker.style.top=(-projected.y*.5+.5)*innerHeight+'px';if(p.built&&p.built.waterUniforms)p.built.waterUniforms.uTime.value=now/1000;if(p.built&&p.built.glassUniforms)p.built.glassUniforms.uTime.value=now/1000;});
    updatePanel();labels.forEach(function(s){s.visible=!places[selected].visible;});
    ui.status.textContent=places[selected].visible?places[selected].name+' · 同图细模与周边':'区域总览 · 两个地标按需加载';
    renderer.render(scene,camera);
    ui.metrics.textContent=(document.hidden?'后台暂停统计':fps+' fps')+' · '+renderer.info.render.calls+' calls · '+renderer.info.render.triangles.toLocaleString()+' tris · '+Object.keys(places).map(function(id){var p=places[id];return id+':'+(p.visible?'detail':p.detail?'cached':'unloaded');}).join(' / ');
  }document.addEventListener('visibilitychange',function(){frames=0;fpsAt=performance.now();});requestAnimationFrame(animate);
  window.FusionDebug={get anchors(){return geo.anchors;},get scene(){return scene;},get renderer(){return renderer;},get camera(){return camera;},get detail(){return places[selected].detail;},get detailVisible(){return places[selected].visible;},get places(){return places;},get counts(){return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},go:go};
})();
