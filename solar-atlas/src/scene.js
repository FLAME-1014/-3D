import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLANETS, MOON, MISSIONS, CONSTELLATIONS, DEEP_OBJECTS, OCEAN_CURRENTS, AU, DEG, orbitalPosition } from './data.js';

const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const astro = (ra,dec,r=1800) => V(Math.cos(dec*DEG)*Math.cos(ra*DEG)*r,Math.sin(dec*DEG)*r,Math.cos(dec*DEG)*Math.sin(ra*DEG)*r);
export const geoPoint = (lon,lat,r=8.04) => V(Math.cos(lat*DEG)*Math.cos(lon*DEG)*r,Math.sin(lat*DEG)*r,-Math.cos(lat*DEG)*Math.sin(lon*DEG)*r);

function seeded(seed=42) { return () => { seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }; }
function line(points,color=0x8d8069,opacity=.3) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));
}
function circle(radius,y=0,n=180) { return Array.from({length:n+1},(_,i)=>V(Math.cos(i/n*Math.PI*2)*radius,y,Math.sin(i/n*Math.PI*2)*radius)); }
function glowTexture() {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const c=canvas.getContext('2d');const gradient=c.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(255,239,202,1)');gradient.addColorStop(.16,'rgba(255,210,125,.85)');gradient.addColorStop(.35,'rgba(255,173,65,.25)');gradient.addColorStop(1,'rgba(255,153,42,0)');
  c.fillStyle=gradient;c.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);
}
function atmosphere(radius,color=0x65badd) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius,40,24),new THREE.ShaderMaterial({
    uniforms:{color:{value:new THREE.Color(color)}},vertexShader:'varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader:'uniform vec3 color; varying vec3 n; varying vec3 v; void main(){float a=pow(1.-max(0.,dot(n,v)),3.);gl_FragColor=vec4(color,a*.38);}',transparent:true,side:THREE.FrontSide,depthWrite:false,blending:THREE.AdditiveBlending
  }));
}

export class AtlasScene {
  constructor(container,labels,callbacks={}) {
    this.container=container;this.labelsElement=labels;this.callbacks=callbacks;
    this.mode='atlas';this.landing=true;this.date=Date.now();this.selected=null;
    this.settings={orbits:true,labels:true,asteroids:true,missions:true,stars:true,clouds:true,grid:false,auto:false};
    this.layers=new Set(['asteroids']);this.records=new Map();this.labelItems=[];this.keys=new Set();this.textures={};this.constellations=[];this.catalogStars=0;
    this.clock=new THREE.Clock();this.elapsed=0;this.frameCount=0;this.lastHUD=0;this.lastFPS=0;this.fps=60;
    this.scene=new THREE.Scene();
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',logarithmicDepthBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor(0x040608);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;
    this.renderer.domElement.setAttribute('aria-label','可交互的三维太阳系与星空');this.renderer.domElement.setAttribute('role','img');
    container.append(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(48,1,.00001,30000);this.camera.position.set(78,135,235);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.065;this.controls.minDistance=.002;this.controls.maxDistance=650;this.controls.target.set(70,0,0);this.controls.enablePan=true;
    this.scene.add(new THREE.AmbientLight(0x9ba9bf,1.35));this.light=new THREE.DirectionalLight(0xffecd5,3.1);this.light.position.set(-15,28,45);this.scene.add(this.light);
    this.solarRoot=new THREE.Group();this.scene.add(this.solarRoot);this.orbitRoot=new THREE.Group();this.solarRoot.add(this.orbitRoot);
    this.scienceRoot=new THREE.Group();this.solarRoot.add(this.scienceRoot);this.skyRoot=new THREE.Group();this.scene.add(this.skyRoot);
    this.globeRoot=new THREE.Group();this.globeRoot.visible=false;this.scene.add(this.globeRoot);
    this.flight={velocity:V(),target:'earth',speed:1142,autopilot:false,travelled:0,yaw:0,pitch:0};
    this.pointer={down:false,moved:false,startX:0,startY:0,lastX:0,lastY:0};
    this.raycaster=new THREE.Raycaster();this.raycaster.params.Points.threshold=.5;
    this.addEvents();this.resize();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
  }

  async init() {
    const loader=new THREE.TextureLoader();const names=[...PLANETS.map(p=>p.id),'moon','earth-night','earth-clouds','saturn-ring'];let done=0;
    await Promise.all(names.map(async name=>{
      try {const tex=await loader.loadAsync(`./assets/textures/${name}.${name==='saturn-ring'?'png':'jpg'}`);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(this.renderer.capabilities.getMaxAnisotropy(),8);this.textures[name]=tex;}
      catch {this.callbacks.onWarning?.(`贴图 ${name} 暂不可用`);}
      this.callbacks.onProgress?.(++done/names.length*.75,name);
    }));
    this.buildPlanets();this.buildAsteroids();this.buildMissionMarkers();this.buildSkyFallback();this.buildGlobe();
    this.updatePositions();this.setLanding(true);this.renderer.setAnimationLoop(()=>this.animate());
    this.renderer.domElement.dataset.ready='true';
    this.callbacks.onProgress?.(1,'READY');this.callbacks.onReady?.();
    this.loadSky().catch(()=>this.callbacks.onWarning?.('部分星表暂不可用，基础星图仍可浏览'));
    return this;
  }

  buildPlanets() {
    const sphere=new THREE.SphereGeometry(1,56,36);
    for(const p of [...PLANETS,MOON]) {
      const group=new THREE.Group();const isSun=p.id==='sun';
      const material=isSun?new THREE.MeshBasicMaterial({map:this.textures[p.id],color:0xffe0a3}):new THREE.MeshStandardMaterial({map:this.textures[p.id],color:this.textures[p.id]?0xffffff:p.color,roughness:1,metalness:0});
      const mesh=new THREE.Mesh(sphere,material);mesh.rotation.z=p.tilt*DEG;mesh.userData={type:'planet',id:p.id};group.add(mesh);
      const record={data:p,group,mesh,position:V(),orbit:null,visualSize:p.size*1.6};
      if(p.id==='sun') {const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));glow.scale.set(5.8,5.8,1);mesh.add(glow);record.glow=glow;}
      if(p.id==='earth') {
        const clouds=new THREE.Mesh(new THREE.SphereGeometry(1.012,48,32),new THREE.MeshStandardMaterial({map:this.textures['earth-clouds'],alphaMap:this.textures['earth-clouds'],transparent:true,opacity:.5,depthWrite:false,roughness:1}));mesh.add(clouds);record.clouds=clouds;mesh.add(atmosphere(1.06));
      }
      if(p.id==='saturn') {
        const geometry=new THREE.RingGeometry(1.35,2.35,128);const pos=geometry.attributes.position;const uv=geometry.attributes.uv;
        for(let i=0;i<pos.count;i++){const r=Math.hypot(pos.getX(i),pos.getY(i));uv.setXY(i,(r-1.35),.5);}
        const ring=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:this.textures['saturn-ring'],side:THREE.DoubleSide,transparent:true,opacity:.9,color:0xd9c69e,depthWrite:false}));ring.rotation.x=-Math.PI/2;mesh.add(ring);
      }
      if(p.a&&p.id!=='moon') {
        const points=Array.from({length:301},(_,i)=>{const q=orbitalPosition(p,Date.UTC(2000,0,1,12)+i/300*p.period*86400000);return V(...q).multiplyScalar(p.distance/p.a);});
        record.orbit=line(points,p.id==='pluto'?0x7895b5:0xa08a65,p.id==='earth'?.5:.23);this.orbitRoot.add(record.orbit);
      }
      this.records.set(p.id,record);this.solarRoot.add(group);
      const label=this.makeLabel(p.en,p.name,()=>this.callbacks.onSelect?.({type:'planet',id:p.id}),'planet');record.label=label;this.labelItems.push({element:label,record,kind:'planet'});
    }
    this.moonOrbit=line(circle(3.5),0x96a5b3,.3);this.solarRoot.add(this.moonOrbit);
    const grid=new THREE.PolarGridHelper(250,24,12,240,0x554b3b,0x282b30);grid.material.transparent=true;grid.material.opacity=.28;grid.visible=false;this.grid=grid;this.solarRoot.add(grid);
  }

  makeLabel(primary,secondary,onClick,kind='planet') {
    const label=document.createElement('button');label.type='button';label.className=`scene-label ${kind}-label`;label.innerHTML=`<span>${primary}</span><small>${secondary}</small>`;
    label.addEventListener('pointerdown',event=>event.stopPropagation());label.addEventListener('click',event=>{event.stopPropagation();onClick();});this.labelsElement.append(label);return label;
  }

  buildAsteroids() {
    const random=seeded(305);const positions=[];const colors=[];const c=new THREE.Color();
    for(let i=0;i<6000;i++) {const a=random()*Math.PI*2;const r=lerp(60,71,random());positions.push(Math.cos(a)*r,(random()-.5)*2.2,Math.sin(a)*r);c.setHSL(.1,.1,lerp(.28,.75,random()));colors.push(c.r,c.g,c.b);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.asteroids=new THREE.Points(geo,new THREE.PointsMaterial({size:.12,vertexColors:true,transparent:true,opacity:.8,sizeAttenuation:true,depthWrite:false}));this.solarRoot.add(this.asteroids);
  }

  buildMissionMarkers() {
    this.missionRoot=new THREE.Group();this.solarRoot.add(this.missionRoot);this.missionRecords=[];
    for(let i=0;i<MISSIONS.length;i++) {
      const m=MISSIONS[i];const group=new THREE.Group();group.userData={type:'mission',id:m.id};
      const core=new THREE.Mesh(new THREE.OctahedronGeometry(.18),new THREE.MeshBasicMaterial({color:0xffcf8c}));core.userData=group.userData;group.add(core);
      const a=line([V(-.5,0,0),V(.5,0,0)],0xd4b88c,.8);group.add(a);this.missionRoot.add(group);this.missionRecords.push({data:m,group,index:i});
    }
  }

  buildSkyFallback() {
    const random=seeded(1002),positions=[],colors=[];
    for(let i=0;i<3500;i++){const ra=random()*360,dec=Math.asin(random()*2-1)/DEG;const p=astro(ra,dec,2200);positions.push(p.x,p.y,p.z);const b=.3+random()*.5;colors.push(b*.9,b*.95,b);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.starPoints=new THREE.Points(geometry,new THREE.PointsMaterial({size:1.35,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.8,depthWrite:false}));this.skyRoot.add(this.starPoints);
    this.constellationRoot=new THREE.Group();this.constellationRoot.visible=false;this.skyRoot.add(this.constellationRoot);
    this.constellations=CONSTELLATIONS.map(c=>({...c,lines:[c.points],coord:c.points[Math.floor(c.points.length/2)]}));
    this.refreshConstellations();
    for(const d of DEEP_OBJECTS){const label=this.makeLabel(d.name,d.en,()=>this.callbacks.onSelect?.({type:'deep',id:d.id}),'deep');this.labelItems.push({element:label,position:astro(d.ra,d.dec,1700),kind:'deep',id:d.id});}
  }

  async loadSky() {
    const texturePromise=new THREE.TextureLoader().loadAsync('./assets/textures/milky-way.jpg').then(texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.SphereGeometry(5000,64,36),new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide,color:0x8b8b8b,depthWrite:false}));mesh.rotation.y=Math.PI/2;this.skyRoot.add(mesh);this.milkyWay=mesh;
    });
    const catalog=await fetch('./assets/catalog/constellations.json').then(r=>r.json());
    if(Array.isArray(catalog.stars)) {
      const positions=[],colors=[];const color=new THREE.Color();
      for(const [ra,dec,mag,bv] of catalog.stars){const p=astro(ra,dec,2200);positions.push(p.x,p.y,p.z);color.set(bv>1.2?0xffd3a3:bv<.2?0xc5dcff:0xf5f0dd);color.multiplyScalar(clamp(1.2-(mag+1)*.105,.25,1.2));colors.push(color.r,color.g,color.b);}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));this.starPoints.geometry.dispose();this.starPoints.geometry=geometry;this.catalogStars=catalog.stars.length;
    }
    if(catalog.figures?.length){this.constellations=catalog.figures;this.refreshConstellations();this.callbacks.onCatalog?.(catalog);}
    await texturePromise;
  }

  refreshConstellations() {
    for(const item of this.labelItems.filter(i=>i.kind==='constellation'))item.element.remove();this.labelItems=this.labelItems.filter(i=>i.kind!=='constellation');
    while(this.constellationRoot.children.length){const child=this.constellationRoot.children[0];child.geometry?.dispose();child.material?.dispose();this.constellationRoot.remove(child);}
    for(const c of this.constellations){for(const points of c.lines)this.constellationRoot.add(line(points.map(p=>astro(p[0],p[1])),0x9ab6cf,.3));const coord=c.coord||c.lines[0][0];const label=this.makeLabel(c.name,c.en,()=>this.lookAtSky(coord[0],coord[1]),'constellation');this.labelItems.push({element:label,position:astro(coord[0],coord[1],1600),kind:'constellation',id:c.id});}
  }

  buildGlobe() {
    this.globe=new THREE.Mesh(new THREE.SphereGeometry(8,80,56),new THREE.MeshStandardMaterial({map:this.textures.earth,roughness:.96,metalness:0}));this.globeRoot.add(this.globe);this.globeRoot.add(atmosphere(8.14));
    this.globeClouds=new THREE.Mesh(new THREE.SphereGeometry(8.055,64,40),new THREE.MeshStandardMaterial({map:this.textures['earth-clouds'],alphaMap:this.textures['earth-clouds'],transparent:true,opacity:.48,depthWrite:false}));this.globeRoot.add(this.globeClouds);
    this.currentRoot=new THREE.Group();this.globeRoot.add(this.currentRoot);this.currentRoot.visible=false;this.currentFlows=[];
    for(const current of OCEAN_CURRENTS){const curve=new THREE.CatmullRomCurve3(current.points.map(p=>geoPoint(...p,8.09)));this.currentRoot.add(line(curve.getPoints(160),current.warm?0xf1b36d:0x77c6e2,.7));for(let j=0;j<9;j++){const dot=new THREE.Mesh(new THREE.SphereGeometry(.025,5,4),new THREE.MeshBasicMaterial({color:current.warm?0xffdab0:0x9bdfff}));this.currentRoot.add(dot);this.currentFlows.push({dot,curve,offset:j/9});}}
    this.windRoot=new THREE.Group();this.globeRoot.add(this.windRoot);this.windRoot.visible=false;
    const random=seeded(222);this.windFlows=[];
    for(let j=0;j<100;j++){const lat=-70+random()*140,lon=-180+random()*360;const points=[];const sign=Math.abs(lat)<30?-1:1;for(let k=0;k<14;k++)points.push(geoPoint(lon+k*sign*2.5,lat+Math.sin(k*.23+j)*3,8.10));const curve=new THREE.CatmullRomCurve3(points);this.windRoot.add(line(curve.getPoints(35),0x93d6cc,.25));const dot=new THREE.Mesh(new THREE.SphereGeometry(.018,4,3),new THREE.MeshBasicMaterial({color:0xd9e8c9}));this.windRoot.add(dot);this.windFlows.push({dot,curve,offset:random()});}
    this.precipitation=new THREE.Mesh(new THREE.SphereGeometry(8.04,64,40),new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float time;void main(){float p=sin(vUv.x*42.+sin(vUv.y*29.)*3.+time*.03)*sin(vUv.y*31.+sin(vUv.x*25.));float band=exp(-pow((vUv.y-.5)*6.,2.));float a=smoothstep(.32,.82,p)*band*.7;gl_FragColor=vec4(mix(vec3(.12,.5,.8),vec3(.67,.39,.85),p),a);}',transparent:true,depthWrite:false}));this.precipitation.visible=false;this.globeRoot.add(this.precipitation);
  }

  updatePositions() {
    const physical=this.mode==='flight';
    this.scienceRoot.visible=!physical;
    for(const record of this.records.values()) {
      const p=record.data;if(p.id==='moon')continue;
      let pos=V();
      if(p.a){if(this.mode==='atlas'&&!this.playing){pos.set(p.distance,Math.sin(p.distance)*.15,Math.sin(p.distance*.7)*.8);}else{pos=V(...orbitalPosition(p,this.date)).multiplyScalar(physical?50:p.distance/p.a);}}
      record.position.copy(pos);record.group.position.copy(pos);record.mesh.scale.setScalar(physical?p.radius/AU*50:record.visualSize);
      if(record.orbit){record.orbit.visible=this.settings.orbits&&!physical;}
    }
    const earth=this.records.get('earth'),moon=this.records.get('moon');
    const lunarAngle=(this.date/86400000/27.322)*Math.PI*2;const lunarDistance=physical?384400/AU*50:3.5;
    moon.position.copy(earth.position).add(V(Math.cos(lunarAngle)*lunarDistance,.18*lunarDistance,Math.sin(lunarAngle)*lunarDistance));moon.group.position.copy(moon.position);moon.mesh.scale.setScalar(physical?MOON.radius/AU*50:moon.visualSize);this.moonOrbit.position.copy(earth.position);this.moonOrbit.visible=!physical&&this.settings.orbits;
    for(const m of this.missionRecords){const parent=this.records.get(m.data.body)||earth;const angle=m.index*2.4;const r=parent.data.size*1.9+(m.index%3)*.8;const year=new Date(this.date).getFullYear();m.group.position.copy(parent.position).add(V(Math.cos(angle)*r,Math.sin(angle*.7)*r*.55,Math.sin(angle)*r));m.group.visible=this.settings.missions&&!physical&&year>=m.data.year&&(!this.missionCategory||this.missionCategory==='all'||m.data.category===this.missionCategory);m.group.scale.setScalar(this.selected===parent.data.id?1.4:.7);}
    this.asteroids.visible=this.settings.asteroids&&!physical;this.grid.visible=this.settings.grid&&!physical;
    if(this.magneticGroup)this.magneticGroup.position.copy(earth.position);
  }

  setLanding(value) {
    this.landing=value;
    if(value){this.mode='atlas';this.selected=null;this.solarRoot.visible=true;this.globeRoot.visible=false;this.constellationRoot.visible=false;this.controls.enabled=true;this.controls.minDistance=.002;this.controls.maxDistance=800;this.controls.target.set(45,0,0);this.camera.position.set(64,128,223);this.camera.fov=48;this.camera.updateProjectionMatrix();this.updatePositions();}
  }

  setMode(mode) {
    const previous=this.mode;this.mode=mode;this.landing=false;this.selected=null;this.camera.fov=48;this.camera.up.set(0,1,0);this.camera.updateProjectionMatrix();this.controls.enabled=!['deep','flight'].includes(mode);this.controls.autoRotate=false;this.transition=null;
    this.solarRoot.visible=!['deep','globe'].includes(mode);this.globeRoot.visible=mode==='globe';this.constellationRoot.visible=mode==='deep';
    if(mode==='atlas'){this.controls.target.set(112,0,0);this.camera.position.set(112,65,194);this.camera.fov=44;this.camera.updateProjectionMatrix();}
    if(mode==='three'){this.controls.target.set(0,0,0);this.camera.position.set(65,145,235);}
    if(mode==='live'){this.controls.target.set(0,0,0);this.camera.position.set(0,310,.1);this.date=Date.now();}
    if(mode==='deep'){this.skyYaw=268*DEG;this.skyPitch=-27*DEG;this.camera.position.set(0,0,0);this.camera.fov=72;this.camera.updateProjectionMatrix();this.orientSky();}
    if(mode==='globe'){this.controls.target.set(0,0,0);this.camera.position.set(-12.5,8.3,26.3);this.controls.minDistance=8.5;this.controls.maxDistance=60;}
    else{this.controls.minDistance=.002;this.controls.maxDistance=800;}
    this.updatePositions();
    if(mode==='flight')this.startFlight();
    if(previous==='flight')this.flight.autopilot=false;
    this.callbacks.onMode?.(mode);
  }

  focus(id,instant=false) {
    if(this.mode==='globe'){this.flyToGeo(119,25);return;}
    const record=this.records.get(id);if(!record)return;
    if(['deep','flight'].includes(this.mode))this.setMode('three');
    this.selected=id;this.controls.autoRotate=false;
    const size=record.visualSize;const distance=Math.max(size*(id==='saturn'?8:6),3);
    const target=record.position.clone();const position=target.clone().add(V(distance*.48,distance*.25,distance));
    if(instant){this.camera.position.copy(position);this.controls.target.copy(target);}else this.transition={start:this.elapsed,duration:1.2,from:this.camera.position.clone(),to:position,targetFrom:this.controls.target.clone(),targetTo:target};
  }

  resetView() {this.setMode(this.mode==='globe'?'globe':this.mode==='deep'?'deep':'atlas');}
  zoom(direction) {if(this.mode==='deep'){this.camera.fov=clamp(this.camera.fov+direction*8,8,110);this.camera.updateProjectionMatrix();}else{const d=this.camera.position.clone().sub(this.controls.target);d.multiplyScalar(direction>0?1.3:.77);this.camera.position.copy(this.controls.target).add(d);}}
  setDate(date,playing=false) {this.date=date;this.playing=playing;this.updatePositions();}
  setQuality(level) {const ratios={low:.75,medium:1,high:1.5,auto:Math.min(devicePixelRatio,1.5)};this.renderer.setPixelRatio(ratios[level]||1);this.resize();}
  setSetting(name,value){this.settings[name]=value;if(name==='asteroids')value?this.layers.add('asteroids'):this.layers.delete('asteroids');if(name==='clouds'&&this.mode==='globe')this.setGlobeLayer(this.globeLayer);this.updatePositions();}
  setMissionFilter(category){this.missionCategory=category;this.updatePositions();}
  lookAtSky(ra,dec){if(this.mode!=='deep')this.setMode('deep');this.skyYaw=ra*DEG;this.skyPitch=dec*DEG;this.orientSky();}
  orientSky(){this.camera.lookAt(astro(this.skyYaw/DEG,this.skyPitch/DEG,1));}
  flyToGeo(lon,lat){const direction=geoPoint(lon,lat,29);this.transition={start:this.elapsed,duration:1.2,from:this.camera.position.clone(),to:direction,targetFrom:this.controls.target.clone(),targetTo:V()};}
  setGlobeLayer(layer){this.globeLayer=layer;this.currentRoot.visible=layer==='currents';this.windRoot.visible=layer==='wind';this.precipitation.visible=layer==='rain';this.globeClouds.visible=layer==='natural'&&this.settings.clouds;this.globe.material.color.set(layer==='natural'?0xffffff:0x7997a3);}

  setScience(id,enabled) {
    enabled?this.layers.add(id):this.layers.delete(id);
    if(id==='asteroids'){this.setSetting('asteroids',enabled);return;}
    if(!this.scienceGroups)this.scienceGroups=new Map();
    if(!this.scienceGroups.has(id)) {
      const group=new THREE.Group();this.scienceRoot.add(group);this.scienceGroups.set(id,group);
      if(id==='magnetic') {
        for(let j=0;j<14;j++)for(let l=2;l<=6;l+=1.4){const phi=j/14*Math.PI*2;const points=[];for(let k=1;k<90;k++){const theta=k/90*Math.PI,r=l*Math.sin(theta)**2;points.push(V(Math.sin(theta)*Math.cos(phi)*r,Math.cos(theta)*r,Math.sin(theta)*Math.sin(phi)*r));}group.add(line(points,j%2?0x70c5db:0xaaa0e3,.32));}
        const belt=new THREE.Mesh(new THREE.TorusGeometry(2.4,.45,12,70),new THREE.MeshBasicMaterial({color:0xb889cf,transparent:true,opacity:.08,depthWrite:false,wireframe:true}));belt.rotation.x=Math.PI/2;group.add(belt);this.magneticGroup=group;
        const solarWind=[];for(let i=0;i<60;i++){const y=(i%10-5)*1.3,z=(Math.floor(i/10)-3)*1.3;solarWind.push(V(-13,y,z),V(-7,y,z));}const geom=new THREE.BufferGeometry().setFromPoints(solarWind);group.add(new THREE.LineSegments(geom,new THREE.LineBasicMaterial({color:0xc7a97a,transparent:true,opacity:.22})));
      }
      if(id==='heliosphere') {
        const sphere=new THREE.Mesh(new THREE.SphereGeometry(270,36,20),new THREE.MeshBasicMaterial({color:0x729cae,transparent:true,opacity:.035,wireframe:true,depthWrite:false}));sphere.scale.set(1.15,.8,.9);group.add(sphere);group.add(line(circle(270),0x78b4cc,.4));
      }
      if(id==='resonance') {
        const points=[];for(let d=0;d<=2920;d+=12){const a=V(...orbitalPosition(PLANETS[3],Date.UTC(2000,0,1)+d*86400000)).multiplyScalar(42);const b=V(...orbitalPosition(PLANETS[2],Date.UTC(2000,0,1)+d*86400000)).multiplyScalar(42);points.push(a,b);}
        group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xdeb073,transparent:true,opacity:.28,depthWrite:false})));
      }
      if(id==='roche') {
        const band=new THREE.Mesh(new THREE.RingGeometry(4.5,6.2,120),new THREE.MeshBasicMaterial({color:0xf6b778,transparent:true,opacity:.11,side:THREE.DoubleSide,depthWrite:false}));band.rotation.x=-Math.PI/2;group.add(band);group.add(line(circle(6.2),0xe3bd8d,.75));group.position.copy(this.records.get('saturn').position);this.rocheGroup=group;
      }
      if(id==='light')for(const r of [18,41,81,147,224])group.add(line(circle(r,.03),0x80bbd7,.42));
      if(id==='habitable') {
        const zone=new THREE.Mesh(new THREE.RingGeometry(36,51,180),new THREE.MeshBasicMaterial({color:0x9ec48c,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false}));zone.rotation.x=-Math.PI/2;group.add(zone);group.add(line(circle(36),0xa6c98b,.4));group.add(line(circle(51),0xa6c98b,.4));group.add(line(circle(63),0xa9d8dc,.35));
      }
    }
    this.scienceGroups.get(id).visible=enabled;
  }

  startFlight() {
    this.date=Date.now();this.updatePositions();this.controls.enabled=false;
    const earth=this.records.get('earth');this.camera.position.copy(earth.position).add(V(.006,.003,.0108));this.camera.lookAt(earth.position);this.camera.fov=58;this.camera.updateProjectionMatrix();
    this.flight.velocity.set(0,0,0);this.flight.target='earth';this.flight.autopilot=false;this.flight.travelled=0;this.flight.started=Date.now();this.flight.speed=1142;
    const euler=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');this.flight.yaw=euler.y;this.flight.pitch=euler.x;
  }

  setFlightTarget(id){if(this.records.has(id)){this.flight.target=id;this.flight.autopilot=false;}}
  alignFlight(){const target=this.records.get(this.flight.target);if(!target)return;this.camera.lookAt(target.position);const euler=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');this.flight.yaw=euler.y;this.flight.pitch=euler.x;}
  autopilot(){this.flight.autopilot=!this.flight.autopilot;if(this.flight.autopilot)this.alignFlight();}

  updateFlight(dt) {
    const f=this.flight;const unit=50/AU;const target=this.records.get(f.target);const direction=this.camera.getWorldDirection(V());
    const relative=target.position.clone().sub(this.camera.position);const distance=relative.length()/unit;
    let acceleration=V();let closest=null,closestDistance=Infinity,gravity=0;
    for(const record of this.records.values()){
      const delta=record.position.clone().sub(this.camera.position);const km=Math.max(delta.length()/unit,record.data.radius+1);const g=6.6743e-11*record.data.mass/(km*1000)**2;acceleration.addScaledVector(delta.normalize(),g);
      if(km-record.data.radius<closestDistance){closestDistance=km-record.data.radius;closest=record;gravity=g;}
    }
    if(f.autopilot){
      const stop=target.data.radius*3;const remaining=Math.max(0,distance-stop);const speed=Math.min(remaining/4,299792*.2);f.velocity.copy(relative.normalize()).multiplyScalar(speed*unit);this.camera.lookAt(target.position);
      if(remaining<Math.max(3,target.data.radius*.02)){f.autopilot=false;f.velocity.set(0,0,0);this.callbacks.onArrival?.(target.data.name);}
    }else{
      const desired=V();const side=V(1,0,0).applyQuaternion(this.camera.quaternion);const up=V(0,1,0).applyQuaternion(this.camera.quaternion);
      if(this.keys.has('w'))desired.add(direction);if(this.keys.has('s'))desired.sub(direction);if(this.keys.has('a'))desired.sub(side);if(this.keys.has('d'))desired.add(side);if(this.keys.has('r'))desired.add(up);if(this.keys.has('f'))desired.sub(up);
      if(desired.lengthSq()){desired.normalize().multiplyScalar(Math.min(f.speed*(this.keys.has('shift')?10:1),299792*.95)*unit);f.velocity.lerp(desired,Math.min(1,dt*2.4));}
      f.velocity.addScaledVector(acceleration,dt*unit/1000);
      if(this.keys.has('q'))this.camera.rotateZ(dt*.5);if(this.keys.has('e'))this.camera.rotateZ(-dt*.5);
    }
    if(this.keys.has('x'))f.velocity.set(0,0,0);
    const travelled=f.velocity.length()*dt;this.camera.position.addScaledVector(f.velocity,dt);f.travelled+=travelled/unit;
    if(closestDistance<Math.max(1,closest.data.radius*.005)){
      const normal=this.camera.position.clone().sub(closest.position).normalize();this.camera.position.copy(closest.position).addScaledVector(normal,(closest.data.radius+Math.max(1,closest.data.radius*.006))*unit);f.velocity.set(0,0,0);f.autopilot=false;
    }
    if(this.elapsed-this.lastHUD>.12){
      this.lastHUD=this.elapsed;const sunDistance=this.camera.position.length()/50;const speed=f.velocity.length()/unit;const escaped=Math.sqrt(2*6.6743e-11*closest.data.mass/((closestDistance+closest.data.radius)*1000))/1000;
      this.callbacks.onFlight?.({distance,speed,altitude:closestDistance,closest:closest.data.name,target:target.data.name,gravity,acceleration:acceleration.length(),irradiance:1361/Math.max(sunDistance**2,.0001),sunAU:sunDistance,lightSun:sunDistance*499,travelled:f.travelled,escape:escaped,autopilot:f.autopilot,elapsed:(Date.now()-f.started)/1000,cruise:f.speed,gamma:1/Math.sqrt(1-Math.min((speed/299792)**2,.999999))});
    }
  }

  addEvents() {
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',event=>{this.pointer={down:true,moved:false,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY};if(['deep','flight'].includes(this.mode))canvas.setPointerCapture(event.pointerId);});
    canvas.addEventListener('pointermove',event=>{
      if(!this.pointer.down)return;const dx=event.clientX-this.pointer.lastX,dy=event.clientY-this.pointer.lastY;this.pointer.lastX=event.clientX;this.pointer.lastY=event.clientY;
      if(Math.abs(event.clientX-this.pointer.startX)+Math.abs(event.clientY-this.pointer.startY)>5)this.pointer.moved=true;
      if(this.mode==='deep'){this.skyYaw-=dx*.003;this.skyPitch=clamp(this.skyPitch+dy*.003,-1.5,1.5);this.orientSky();}
      if(this.mode==='flight'){this.flight.yaw-=dx*.003;this.flight.pitch=clamp(this.flight.pitch-dy*.003,-1.5,1.5);this.camera.quaternion.setFromEuler(new THREE.Euler(this.flight.pitch,this.flight.yaw,0,'YXZ'));this.flight.autopilot=false;}
    });
    canvas.addEventListener('pointerup',event=>{
      const moved=this.pointer.moved;this.pointer.down=false;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(moved||this.landing||this.mode==='flight'||this.mode==='deep')return;
      const rect=canvas.getBoundingClientRect();const ndc=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(ndc,this.camera);
      if(this.mode==='globe'){
        const hit=this.raycaster.intersectObject(this.globe)[0];if(hit){const p=hit.point.clone().normalize();this.callbacks.onGlobePick?.({lat:Math.asin(p.y)/DEG,lon:-Math.atan2(p.z,p.x)/DEG});}return;
      }
      const objects=[...this.records.values()].map(r=>r.mesh).concat(this.missionRoot.children.filter(g=>g.visible).flatMap(g=>g.children.filter(c=>c.isMesh)));const hit=this.raycaster.intersectObjects(objects,false)[0];if(hit)this.callbacks.onSelect?.(hit.object.userData);
    });
    canvas.addEventListener('pointercancel',()=>this.pointer.down=false);
    canvas.addEventListener('wheel',event=>{
      if(this.mode==='deep'){event.preventDefault();this.camera.fov=clamp(this.camera.fov+event.deltaY*.025,6,110);this.camera.updateProjectionMatrix();}
      if(this.mode==='flight'){event.preventDefault();this.flight.speed=clamp(this.flight.speed*Math.exp(-event.deltaY*.002),.01,299792*.9);}
    },{passive:false});
    window.addEventListener('keydown',event=>{
      if(event.target.closest('input,textarea,select,[contenteditable]')||event.ctrlKey||event.metaKey||event.altKey)return;const key=event.key.toLowerCase();this.keys.add(key);
      if(this.mode==='flight'){
        if(['w','a','s','d','r','f','q','e',' '].includes(key))event.preventDefault();
        if(key==='x'){this.flight.velocity.set(0,0,0);this.flight.autopilot=false;}if(key==='z')this.alignFlight();if(key==='g')this.autopilot();if(key==='t'){const ids=[...this.records.keys()];this.setFlightTarget(ids[(ids.indexOf(this.flight.target)+1)%ids.length]);this.callbacks.onFlightTarget?.(this.flight.target);}
      }
    });
    window.addEventListener('keyup',event=>this.keys.delete(event.key.toLowerCase()));window.addEventListener('blur',()=>{this.keys.clear();this.pointer.down=false;});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.callbacks.onWarning?.('图形上下文已中断，请刷新页面恢复。');});
  }

  resize(){const w=this.container.clientWidth||innerWidth,h=this.container.clientHeight||innerHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}

  updateLabels() {
    const width=this.container.clientWidth,height=this.container.clientHeight;this.camera.updateMatrixWorld();
    for(const item of this.labelItems){
      const isSky=['deep','constellation'].includes(item.kind);const visible=this.settings.labels&&!this.landing&&this.mode!=='flight'&&this.mode!=='globe'&&(isSky?this.mode==='deep':this.mode!=='deep');
      if(!visible||(!isSky&&item.record.data.id==='sun')||(!isSky&&item.record.data.id==='moon'&&!['earth','moon'].includes(this.selected))){item.element.hidden=true;continue;}
      const pos=item.record?item.record.position.clone():item.position.clone();if(item.record)pos.y+=item.record.visualSize*1.3;
      const local=pos.clone().applyMatrix4(this.camera.matrixWorldInverse);const projected=pos.project(this.camera);
      if(local.z>0||Math.abs(projected.x)>1.08||Math.abs(projected.y)>.9){item.element.hidden=true;continue;}
      item.element.hidden=false;const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
      item.element.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
      item.element.classList.toggle('selected',item.record?.data.id===this.selected);
    }
  }

  animate() {
    const now=performance.now()/1000;if(this.lastRender&&now-this.lastRender<1/45)return;const dt=Math.min(.08,this.lastRender?now-this.lastRender:1/60);this.lastRender=now;this.elapsed+=dt;
    if(this.mode==='live'&&!this.playing){this.date=Date.now();this.updatePositions();}
    if(this.transition){const tr=this.transition;const t=clamp((this.elapsed-tr.start)/tr.duration,0,1);const e=1-(1-t)**3;this.camera.position.lerpVectors(tr.from,tr.to,e);this.controls.target.lerpVectors(tr.targetFrom,tr.targetTo,e);if(t===1)this.transition=null;}
    if(this.mode==='flight')this.updateFlight(dt);
    if(this.controls.enabled){this.controls.autoRotate=this.settings.auto&&!this.transition;this.controls.autoRotateSpeed=.5;this.controls.update();}
    for(const r of this.records.values())r.mesh.rotation.y+=dt*(r.data.id==='sun'?.015:.04);const cloud=this.records.get('earth').clouds;cloud.visible=this.settings.clouds;if(cloud)cloud.rotation.y+=dt*.007;
    if(this.magneticGroup)this.magneticGroup.position.copy(this.records.get('earth').position);if(this.rocheGroup)this.rocheGroup.position.copy(this.records.get('saturn').position);
    if(this.mode==='globe'){for(const flow of this.currentFlows)flow.dot.position.copy(flow.curve.getPointAt((this.elapsed*.035+flow.offset)%1));for(const flow of this.windFlows)flow.dot.position.copy(flow.curve.getPointAt((this.elapsed*.08+flow.offset)%1));this.globeClouds.rotation.y+=dt*.003;this.precipitation.material.uniforms.time.value=this.elapsed;}
    this.starPoints.visible=this.settings.stars;this.updateLabels();this.renderer.render(this.scene,this.camera);this.frameCount++;
    if(now-this.lastFPS>1){this.fps=Math.round(this.frameCount/Math.max(.1,now-this.lastFPS));this.frameCount=0;this.lastFPS=now;this.callbacks.onStats?.({fps:this.fps,stars:this.catalogStars,ra:((this.skyYaw||0)/DEG%360+360)%360,dec:(this.skyPitch||0)/DEG,fov:this.camera.fov});}
  }
}
