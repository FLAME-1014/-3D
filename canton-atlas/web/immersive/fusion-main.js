(function () {
  'use strict';
  var ui = {};
  ['map','overview','visit','roof','marker','details','return','status','metrics','failure'].forEach(function(id){ui[id]=document.getElementById(id);});
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
  var museumAnchor=new THREE.Vector3(280,0,-230);
  var baseMat=new THREE.MeshStandardMaterial({color:0x889889,roughness:1});
  var roadMat=new THREE.MeshStandardMaterial({color:0x566b71,roughness:1});
  var parkMat=new THREE.MeshStandardMaterial({color:0x607f65,roughness:1});
  var waterMat=new THREE.MeshStandardMaterial({color:0x317f99,roughness:.4,metalness:.1});
  function box(parent,w,h,d,x,y,z,mat){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;}
  box(city,5600,5,4000,0,-5,0,baseMat);
  box(city,5600,2,380,0,-.9,400,waterMat);
  box(city,5600,1,25,0,0,175,roadMat);box(city,5600,1,25,0,0,625,roadMat);
  [-1450,-700,0,750,1500].forEach(function(x){box(city,24,1,1800,x,.4,-750,roadMat);});
  [-1400,-900,-450].forEach(function(z){box(city,4500,1,22,0,.3,z,roadMat);});
  box(city,180,1,750,30,.7,-200,parkMat);
  box(city,270,1,260,museumAnchor.x,1,museumAnchor.z,new THREE.MeshStandardMaterial({color:0xb8b8a5,roughness:.9}));
  // All context is deliberately schematic. Never represent these as surveyed coordinates.
  var randomSeed=49;
  function random(){randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;}
  var instances=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xa5b5b8,roughness:.85}),220);
  var matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),index=0;
  for(var i=0;i<220;i++){
    var x=(random()-.5)*3500,z=-120-random()*1450;
    if(Math.abs(x)<130 || (Math.abs(x-museumAnchor.x)<210 && Math.abs(z-museumAnchor.z)<230)) {i--;continue;}
    var h=22+random()*120;if(x<0&&x>-650&&z<-500&&z>-1100)h+=120;
    matrix.compose(new THREE.Vector3(x,h/2,z),quat,new THREE.Vector3(35+random()*45,h,35+random()*45));instances.setMatrixAt(index++,matrix);
  }city.add(instances);
  var bridgeMat=new THREE.MeshStandardMaterial({color:0xb9c8c7,roughness:.7});
  [-900,1150].forEach(function(x){box(city,32,8,440,x,14,400,bridgeMat);});
  var towerGroup=new THREE.Group();towerGroup.position.set(-90,0,850);city.add(towerGroup);
  var towerProfile=[[0,35],[80,30],[240,16],[340,19],[455,30]];
  var profile=towerProfile.map(function(p){return new THREE.Vector2(p[1],p[0]);});
  var tower=new THREE.Mesh(new THREE.LatheGeometry(profile,24),new THREE.MeshStandardMaterial({color:0xc8d9dc,wireframe:true}));towerGroup.add(tower);
  box(towerGroup,3,145,3,0,527.5,0,bridgeMat);
  function label(text,x,y,z){var c=document.createElement('canvas');c.width=512;c.height=96;var ctx=c.getContext('2d');ctx.fillStyle='rgba(18,39,51,.8)';ctx.fillRect(0,0,512,96);ctx.font='34px Microsoft YaHei, sans-serif';ctx.textAlign='center';ctx.fillStyle='#ecf3f2';ctx.fillText(text,256,62);var texture=new THREE.CanvasTexture(c);var sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true}));sprite.position.set(x,y,z);sprite.scale.set(230,43,1);city.add(sprite);return sprite;}
  var labels=[label('珠江 · 示意',-850,18,400),label('广州塔 · 简化',-90,640,850),label('珠江新城 · 示意',-450,380,-900)];
  var museum=new THREE.Group();museum.position.copy(museumAnchor);scene.add(museum);
  var coarse=new THREE.Group();museum.add(coarse);
  box(coarse,113.5,35.5,113.5,0,26.75,0,new THREE.MeshStandardMaterial({color:0x414448,roughness:.7,metalness:.15}));
  box(coarse,65,9,65,0,4.5,0,new THREE.MeshStandardMaterial({color:0x96b9ba,roughness:.3}));
  box(coarse,2,17,25,-57.9,25,15,new THREE.MeshStandardMaterial({color:0xc54135}));
  var detail=null,textures=null,loading=null,detailVisible=false,desiredDetail=false;
  var reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var target=new THREE.Vector3(0,0,-180),theta=-.65,phi=.86,radius=2500;
  var tween=null,last=performance.now(),fps=60,frames=0,fpsAt=last;
  var pointer=new Map(),dragStart=null,pinch=null;
  var raycaster=new THREE.Raycaster();
  function pose(){camera.position.set(target.x+radius*Math.sin(phi)*Math.sin(theta),target.y+radius*Math.cos(phi),target.z+radius*Math.sin(phi)*Math.cos(theta));camera.lookAt(target);}
  function script(src){return new Promise(function(resolve,reject){var element=document.createElement('script');element.src=src;element.onload=resolve;element.onerror=function(){element.remove();reject(new Error('asset_script_failed'));};document.head.appendChild(element);});}
  function ensureDetail(){
    if(detail)return Promise.resolve(detail);
    if(loading)return loading;
    ui.status.textContent='正在按需加载省博细模…';
    loading=Promise.resolve().then(function(){return window.GdMuseumTextures?null:script('gd-museum-textures.js');}).then(function(){return window.GdMuseumModel?null:script('gd-museum-model.js');}).then(function(){
      textures=window.GdMuseumTextures.build(renderer);
      detail=window.GdMuseumModel.build({textures:textures,low:innerWidth<700,assetOnly:true}).root;
      detail.visible=false;museum.add(detail);return detail;
    }).catch(function(error){loading=null;ui.status.textContent='细模加载失败，仍可浏览简模；点击靠近可重试。';throw error;});
    return loading;
  }
  function changeDetail(value){
    desiredDetail=value;
    if(!value){detailVisible=false;if(detail)detail.visible=false;coarse.visible=true;ui.details.hidden=true;return;}
    ensureDetail().then(function(){if(!desiredDetail)return;detail.visible=true;coarse.visible=false;detailVisible=true;ui.details.hidden=false;}).catch(function(){});
  }
  var views={
    overview:{target:new THREE.Vector3(0,0,-180),radius:2500,theta:-.65,phi:.86},
    museum:{target:museumAnchor.clone().add(new THREE.Vector3(0,22,0)),radius:205,theta:-.95,phi:1.30},
    roof:{target:museumAnchor.clone().add(new THREE.Vector3(0,22,0)),radius:260,theta:-.8,phi:.55}
  };
  function go(name){var v=views[name];tween={at:performance.now(),duration:reduced?0:2200,from:{target:target.clone(),radius:radius,theta:theta,phi:phi},to:v};if(name!=='overview')ensureDetail().catch(function(){});}
  ui.overview.onclick=ui.return.onclick=function(){go('overview');};ui.visit.onclick=ui.marker.onclick=function(){go('museum');};ui.roof.onclick=function(){go('roof');};
  function end(){tween=null;}
  ui.map.addEventListener('pointerdown',function(event){end();ui.map.setPointerCapture(event.pointerId);pointer.set(event.pointerId,{x:event.clientX,y:event.clientY});dragStart={x:event.clientX,y:event.clientY,moved:false};if(pointer.size===2){var pts=Array.from(pointer.values());pinch={distance:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),radius:radius};}});
  ui.map.addEventListener('pointermove',function(event){if(!pointer.has(event.pointerId))return;var old=pointer.get(event.pointerId);pointer.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointer.size===2&&pinch){var pts=Array.from(pointer.values());radius=THREE.MathUtils.clamp(pinch.radius*pinch.distance/Math.max(1,Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)),90,4300);}else{theta-=(event.clientX-old.x)*.005;phi=THREE.MathUtils.clamp(phi+(event.clientY-old.y)*.004,.2,1.48);}if(dragStart&&Math.hypot(event.clientX-dragStart.x,event.clientY-dragStart.y)>6)dragStart.moved=true;});
  function release(event){if(event.type==='pointerup'&&dragStart&&!dragStart.moved&&pointer.size===1){raycaster.setFromCamera(new THREE.Vector2(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2),camera);if(raycaster.intersectObject(museum,true).length)go('museum');}pointer.delete(event.pointerId);pinch=null;dragStart=null;}
  ui.map.addEventListener('pointerup',release);ui.map.addEventListener('pointercancel',release);
  ui.map.addEventListener('wheel',function(event){event.preventDefault();end();radius=THREE.MathUtils.clamp(radius*Math.exp(event.deltaY*.001),90,4300);},{passive:false});
  document.addEventListener('keydown',function(event){if(event.target.tagName==='BUTTON'||event.target.tagName==='A')return;var used=true;end();switch(event.key){case'ArrowLeft':theta-=.08;break;case'ArrowRight':theta+=.08;break;case'ArrowUp':phi=Math.max(.2,phi-.06);break;case'ArrowDown':phi=Math.min(1.48,phi+.06);break;case'+':case'=':radius=Math.max(90,radius*.9);break;case'-':radius=Math.min(4300,radius*1.1);break;default:used=false;}if(used)event.preventDefault();});
  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);}addEventListener('resize',resize);resize();pose();
  function animate(now){requestAnimationFrame(animate);frames++;if(now-fpsAt>1000){fps=Math.round(frames*1000/(now-fpsAt));frames=0;fpsAt=now;}
    if(tween){var p=tween.duration===0?1:Math.min(1,(now-tween.at)/tween.duration);p=p*p*(3-2*p);target.copy(tween.from.target).lerp(tween.to.target,p);radius=Math.exp(THREE.MathUtils.lerp(Math.log(tween.from.radius),Math.log(tween.to.radius),p));theta=THREE.MathUtils.lerp(tween.from.theta,tween.to.theta,p);phi=THREE.MathUtils.lerp(tween.from.phi,tween.to.phi,p);if(p>=1)tween=null;}
    pose();var distance=camera.position.distanceTo(museumAnchor);
    if(distance<470&&!desiredDetail)changeDetail(true);else if(distance>620&&desiredDetail)changeDetail(false);
    labels.forEach(function(s){s.visible=distance>620;});
    camera.updateMatrixWorld();var projected=museumAnchor.clone().add(new THREE.Vector3(0,60,0)).project(camera);
    ui.marker.hidden=detailVisible||projected.z>1||Math.abs(projected.x)>.95||Math.abs(projected.y)>.9;
    ui.marker.style.left=(projected.x*.5+.5)*innerWidth+'px';ui.marker.style.top=(-projected.y*.5+.5)*innerHeight+'px';
    if(!loading||detail)ui.status.textContent=detailVisible?'省博细模 · 与城市共用一个场景':'城市总览 · 地标简模';
    renderer.render(scene,camera);
    ui.metrics.textContent=(document.hidden?'后台暂停统计':fps+' fps')+' · '+renderer.info.render.calls+' calls · '+renderer.info.render.triangles.toLocaleString()+' tris · '+(detailVisible?'detail':'overview');
  }document.addEventListener('visibilitychange',function(){frames=0;fpsAt=performance.now();});requestAnimationFrame(animate);
  window.FusionDebug={get scene(){return scene;},get renderer(){return renderer;},get camera(){return camera;},get detail(){return detail;},get detailVisible(){return detailVisible;},get counts(){return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},go:go};
})();
