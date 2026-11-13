import * as THREE from 'three';
import type { BodyAssembly } from '../welding/logic';
import type { FactoryMaterials } from './materials';
import { beam, box, mergeStatic } from './factory';
import type { LODLevel } from '../core/lod';
import { disposeModelGeometry, modelGeometryStats, type LODStats } from './robot';

interface BodyVariant {group:THREE.Group;parts:Record<string,THREE.Group>;update:(assembly:BodyAssembly)=>void}
export interface BodyModel extends BodyVariant {setLOD:(level:LODLevel,wallSeconds:number)=>void;maintain:(wallSeconds:number)=>void;dispose:()=>void;readonly level:LODLevel;readonly lodStats:LODStats}

function sheet(shape:THREE.Shape,material:THREE.Material,depth=.024,level:LODLevel='medium'):THREE.Mesh {
  const curveSegments=level==='original'?96:level==='medium'?64:level==='low'?32:2;
  let geometry:THREE.BufferGeometry;
  if(level==='proxy'){
    const cap=new THREE.ShapeGeometry(shape,curveSegments).toNonIndexed(),position=cap.attributes.position!,uv=cap.attributes.uv!;
    const vertices=new Float32Array(position.count*6),normals=new Float32Array(position.count*6),uvs=new Float32Array(position.count*4);
    cap.computeBoundingBox();const bounds=cap.boundingBox!,width=bounds.max.x-bounds.min.x,height=bounds.max.y-bounds.min.y,cx=(bounds.max.x+bounds.min.x)/2,cy=(bounds.max.y+bounds.min.y)/2;
    for(let index=0;index<position.count;index++)for(let face=0;face<2;face++){
      const source=face===0?index:Math.floor(index/3)*3+(2-index%3),target=index+face*position.count;
      vertices[target*3]=cx+(position.getX(source)-cx)*(1+.012/width);vertices[target*3+1]=cy+(position.getY(source)-cy)*(1+.012/height);vertices[target*3+2]=face===0?depth+.006:-.006;normals[target*3+2]=face===0?1:-1;uvs[target*2]=uv.getX(source);uvs[target*2+1]=uv.getY(source);
    }
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));cap.dispose();
  }else geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.006,bevelSize:.006,bevelSegments:level==='original'?3:level==='medium'?2:1,steps:1,curveSegments});
  const mesh=new THREE.Mesh(geometry,material);
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}

function bodySide(material:THREE.Material,level:LODLevel):THREE.Group {
  const group=new THREE.Group();
  const outline=new THREE.Shape();
  outline.moveTo(-2.3,.42);outline.lineTo(-1.96,.42);outline.absarc(-1.55,.42,.41,Math.PI,0,true);
  outline.lineTo(1.15,.42);outline.absarc(1.55,.42,.4,Math.PI,0,true);outline.lineTo(2.3,.42);
  outline.lineTo(2.3,1.0);outline.lineTo(1.91,1.45);outline.lineTo(-.85,1.5);outline.lineTo(-1.46,1.04);outline.lineTo(-2.3,.92);outline.closePath();
  const front=new THREE.Path();front.moveTo(-1.0,.57);front.lineTo(-1.0,1.01);front.lineTo(-.72,1.36);front.lineTo(-.08,1.36);front.lineTo(-.08,.57);front.closePath();
  const rear=new THREE.Path();rear.moveTo(.1,.57);rear.lineTo(.1,1.36);rear.lineTo(.89,1.36);rear.lineTo(1.28,1.03);rear.lineTo(1.28,.57);rear.closePath();
  const quarter=new THREE.Path();quarter.moveTo(1.43,1.03);quarter.lineTo(1.11,1.34);quarter.lineTo(1.82,1.31);quarter.lineTo(2.05,1.03);quarter.closePath();
  outline.holes.push(front,rear,quarter);
  group.add(sheet(outline,material,.024,level));
  if(level!=='proxy'){
    beam(group,[-1.1,.48,.04],[1.1,.48,.04],.085,material,.1);
    beam(group,[-.01,.53,.045],[-.01,1.43,.045],.075,material,.09);
    beam(group,[-1.02,1.04,.045],[-.77,1.43,.045],.068,material,.085);
    beam(group,[1.35,.79,.045],[.98,1.4,.045],.08,material,.085);
  }
  if(level==='original')for(const y of [.65,.75,.85])for(const x of [-1.35,1.76])box(group,[.2,.012,.025],[x,y,.028],material);
  mergeStatic(group);return group;
}

function door(material:THREE.Material,rear:boolean,level:LODLevel):THREE.Group {
  const group=new THREE.Group();const outline=new THREE.Shape();
  if(rear){outline.moveTo(.1,.56);outline.lineTo(1.26,.56);outline.lineTo(1.27,1.02);outline.lineTo(.89,1.36);outline.lineTo(.1,1.36)}
  else {outline.moveTo(-1.0,.56);outline.lineTo(-.09,.56);outline.lineTo(-.09,1.36);outline.lineTo(-.71,1.36);outline.lineTo(-1,1.01)}
  outline.closePath();const window=new THREE.Path();
  if(rear){window.moveTo(.2,1.01);window.lineTo(1.13,1.01);window.lineTo(.83,1.27);window.lineTo(.2,1.27)}
  else {window.moveTo(-.9,1.01);window.lineTo(-.2,1.01);window.lineTo(-.2,1.27);window.lineTo(-.65,1.27)}
  window.closePath();outline.holes.push(window);group.add(sheet(outline,material,.018,level));
  if(level==='original')for(const y of [.64,.78])box(group,[rear?.82:.65,.014,.012],[rear?.67:-.56,y,.03],material);
  if(level!=='proxy')box(group,[rear?.09:.08,.025,.028],[rear?.98:-.25,.91,.028],material);mergeStatic(group);return group;
}

/** Thin automotive sheet geometry: open apertures, wheel housings and structural rails. */
function buildBody(materials:FactoryMaterials,level:LODLevel):BodyVariant {
  const group=new THREE.Group();group.name='白车身';const parts:Record<string,THREE.Group>={};
  const proxy=level==='proxy';
  const plate=(parent:THREE.Group,width:number,depth:number,position:[number,number,number])=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),materials.steel);mesh.rotation.x=-Math.PI/2;mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh};
  const make=(key:string,name:string,description:string)=>{const part=new THREE.Group();part.name=name;part.userData={component:true,name,description};parts[key]=part;group.add(part);return part};
  const floor=make('floor','中段地板与门槛','中央地板、传动通道和纵向门槛构成下车体承载结构。');
  const floorShape=new THREE.Shape();floorShape.moveTo(-1.2,-.86);floorShape.lineTo(1.25,-.86);floorShape.lineTo(1.25,.86);floorShape.lineTo(-1.2,.86);floorShape.closePath();
  if(proxy)box(floor,[4.35,.186,1.84],[0,.387,0],materials.steel);
  else {const floorSheet=sheet(floorShape,materials.steel,.035,level);floorSheet.rotation.x=-Math.PI/2;floorSheet.position.y=.3;floor.add(floorSheet)}
  if(!proxy)for(const z of [-.87,.87])box(floor,[4.35,.11,.1],[0,.4,z],materials.steel);
  if(!proxy)for(const x of [-.95,-.5,.03,.52,1.02])box(floor,[.11,.055,1.65],[x,.36,0],materials.steel);
  if(level==='original')for(let x=-1.05;x<1.25;x+=.16)for(const z of [-.46,.46])box(floor,[.022,.025,.56],[x,.347,z],materials.steel);
  if(!proxy)box(floor,[2.6,.16,.23],[.02,.4,0],materials.steel);
  const frontFloor=make('frontFloor','前地板总成','前地板与发动机舱通过定位销和 SPR 铆接连接。');
  if(proxy)box(frontFloor,[1.3,.16,1.58],[-1.68,.47,0],materials.steel);else box(frontFloor,[1.0,.06,1.58],[-1.72,.42,0],materials.steel);
  if(!proxy)for(const z of [-.61,.61])box(frontFloor,[1.3,.1,.14],[-1.68,.5,z],materials.steel);
  const rearFloor=make('rearFloor','后地板总成','后部地板包含行李舱承载板和后轮罩。');
  if(proxy)box(rearFloor,[1.226,.692,1.741],[1.647,.67,.0655],materials.steel);else box(rearFloor,[1.0,.065,1.61],[1.76,.57,0],materials.steel);
  if(!proxy)for(const z of [-.73,.73]){
    const arch=new THREE.Shape();arch.moveTo(-.51,0);arch.lineTo(-.51,.17);arch.absarc(0,.17,.51,Math.PI,0,true);arch.lineTo(.51,0);arch.closePath();
    const hole=new THREE.Path();hole.moveTo(-.37,0);hole.absarc(0,.01,.37,Math.PI,0,true);hole.lineTo(-.37,0);hole.closePath();arch.holes.push(hole);
    const mesh=sheet(arch,materials.steel,.2,level);mesh.position.set(1.55,.33,z);rearFloor.add(mesh);
  }
  const engine=make('engineBay','发动机舱总成','发动机舱纵梁、减振塔和前围连接前地板。');
  if(!proxy)for(const z of [-.59,.59]){
      beam(engine,[-2.25,.56,z],[-1.13,.64,z],.16,materials.steel,.19);
      const tower=box(engine,[.48,.42,.36],[-1.57,.73,z],materials.steel);tower.rotation.z=.1;
  }
  if(proxy)box(engine,[1.1357,.483,1.7],[-1.68785,.7215,0],materials.steel);
  else {box(engine,[.06,.38,1.64],[-1.15,.67,0],materials.steel);box(engine,[.11,.15,1.7],[-2.2,.59,0],materials.steel)}
  const sides=make('sides','左右侧围总成','A / B / C / D 柱、门洞和轮罩保证车身轮廓与结构连续。');
  const left=bodySide(materials.steel,level),right=bodySide(materials.steel,level);left.name='左侧围';right.name='右侧围';sides.add(left,right);
  left.position.z=-.952;right.position.z=.928;
  const roofFrame=make('roofFrame','顶框与横梁','主拼建立车身几何基准后，将顶框与横梁定位。');
  for(const x of [-.77,.04,1.05,1.85]){if(proxy)plate(roofFrame,.065,1.78,[x,1.45,0]);else beam(roofFrame,[x,1.45,-.89],[x,1.45,.89],.065,materials.steel,.095)}
  for(const z of [-.86,.86]){if(proxy)plate(roofFrame,2.62,.08,[.54,1.45,z]);else beam(roofFrame,[-.77,1.45,z],[1.85,1.45,z],.08,materials.steel)}
  if(proxy)plate(roofFrame,.08,1.74,[-1.05,.99,0]);else beam(roofFrame,[-1.05,.99,-.87],[-1.05,.99,.87],.08,materials.steel);
  const roof=make('roof','顶盖','激光钎焊将顶盖与侧围上部轮廓连接。');
  const subdivisions=level==='original'?[48,32]:level==='medium'?[24,16]:level==='low'?[14,8]:[2,2];
  const roofGeometry=new THREE.PlaneGeometry(2.68,1.68,subdivisions[0],subdivisions[1]);roofGeometry.rotateX(-Math.PI/2);const positions=roofGeometry.attributes.position!;
  for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);positions.setY(i,.052*(1-(z/.84)**2)+.023*Math.cos(x*1.2))}
  roofGeometry.computeVertexNormals();const roofMesh=new THREE.Mesh(roofGeometry,materials.steel);roofMesh.position.set(.55,1.485,0);roofMesh.castShadow=true;roof.add(roofMesh);
  const rearDoors=make('rearDoors','后门总成','左右后门优先上件，再安装前门和前后盖。');
  const frontDoors=make('frontDoors','前门总成','左右前门安装到侧围铰链基准，保留开放的玻璃窗洞。');
  const rearLeft=door(materials.steel,true,level),rearRight=door(materials.steel,true,level),frontLeft=door(materials.steel,false,level),frontRight=door(materials.steel,false,level);
  rearDoors.add(rearLeft,rearRight);frontDoors.add(frontLeft,frontRight);rearLeft.position.z=frontLeft.position.z=-.958;rearRight.position.z=frontRight.position.z=.94;
  const hood=make('hood','前盖总成','最后安装的发动机舱前盖。');
  const hoodGeometry=new THREE.PlaneGeometry(1.16,1.7,subdivisions[0],subdivisions[1]);hoodGeometry.rotateX(-Math.PI/2);const hoodPositions=hoodGeometry.attributes.position!;
  for(let i=0;i<hoodPositions.count;i++){const x=hoodPositions.getX(i),z=hoodPositions.getZ(i);hoodPositions.setY(i,.06*(1-(z/.85)**2)+x*.14)}hoodGeometry.computeVertexNormals();
  const hoodMesh=new THREE.Mesh(hoodGeometry,materials.steel);hoodMesh.position.set(-1.7,.97,0);hood.add(hoodMesh);
  const tailgate=make('tailgate','尾门总成','尾门框架保留后窗开口，闭合到车身后端。');
  const tailShape=new THREE.Shape();tailShape.moveTo(-.81,.47);tailShape.lineTo(.81,.47);tailShape.lineTo(.78,1.35);tailShape.lineTo(-.78,1.35);tailShape.closePath();
  const rearWindow=new THREE.Path();rearWindow.moveTo(-.68,.94);rearWindow.lineTo(-.65,1.23);rearWindow.lineTo(.65,1.23);rearWindow.lineTo(.68,.94);rearWindow.closePath();tailShape.holes.push(rearWindow);
  const tailSheet=sheet(tailShape,materials.steel,.018,level);tailSheet.rotation.y=Math.PI/2;tailSheet.position.x=2.17;tailgate.add(tailSheet);
  for(const part of [floor,frontFloor,rearFloor,engine,roofFrame,roof,hood,tailgate])mergeStatic(part);
  const progress=(assembly:BodyAssembly,key:string,fallback=1)=>(assembly as unknown as Record<string,number>)[key]??fallback;
  return {group,parts,update:(assembly)=>{
    for(const part of Object.values(parts))part.position.set(0,0,0);
    frontFloor.visible=progress(assembly,'frontFloor')>.001;frontFloor.position.x=-1.4*(1-progress(assembly,'frontFloor'));
    rearFloor.visible=progress(assembly,'rearFloor')>.001;rearFloor.position.x=1.4*(1-progress(assembly,'rearFloor'));
    engine.visible=progress(assembly,'engineBay')>.001;engine.position.y=1.2*(1-progress(assembly,'engineBay'));
    sides.visible=assembly.sides>.001;left.position.z=-.952-2.4*(1-assembly.sides);right.position.z=.928+2.4*(1-assembly.sides);
    roofFrame.visible=assembly.roofFrame>.001;roofFrame.position.y=1.6*(1-assembly.roofFrame);
    roof.visible=assembly.roof>.001;roof.position.y=1.8*(1-assembly.roof);
    rearDoors.visible=assembly.rearDoors>.001;rearLeft.position.z=-.958-2.0*(1-assembly.rearDoors);rearRight.position.z=.94+2.0*(1-assembly.rearDoors);
    frontDoors.visible=assembly.frontDoors>.001;frontLeft.position.z=-.958-2.1*(1-assembly.frontDoors);frontRight.position.z=.94+2.1*(1-assembly.frontDoors);
    hood.visible=assembly.hood>.001;hood.position.y=1.55*(1-assembly.hood);hood.position.x=-.35*(1-assembly.hood);
    tailgate.visible=assembly.tailgate>.001;tailgate.position.y=1.5*(1-assembly.tailgate);tailgate.position.x=.5*(1-assembly.tailgate);
  }};
}

/** The outer identity and part assembly coordinates survive every lazy mesh switch. */
export function createBody(materials:FactoryMaterials):BodyModel {
  const group=new THREE.Group();group.name='白车身';
  const cache=new Map<LODLevel,{model:BodyVariant;used:number}>();
  let level:LODLevel='proxy',now=0,lastAssembly:BodyAssembly|undefined;
  const advance=(wallSeconds:number)=>{if(Number.isFinite(wallSeconds))now=Math.max(now,wallSeconds)};
  const make=(next:LODLevel)=>{const model=buildBody(materials,next);cache.set(next,{model,used:now});return model};
  let current=make(level);group.add(current.group);
  const maintain=(wallSeconds:number)=>{advance(wallSeconds);for(const [key,item] of cache)if(key!==level&&now-item.used>=8){disposeModelGeometry(item.model.group);cache.delete(key)}};
  const setLOD=(next:LODLevel,wallSeconds:number)=>{
    advance(wallSeconds);
    if(next!==level){
      cache.get(level)!.used=now;current.group.removeFromParent();current=cache.get(next)?.model??make(next);level=next;group.add(current.group);
      if(lastAssembly)current.update(lastAssembly);
    }
    current.group.traverse(object=>{for(const field of ['id','partId','carId','skidId','station'])if(group.userData[field]!==undefined)object.userData[field]=group.userData[field]});
    cache.get(level)!.used=now;maintain(now);
  };
  return {group,get parts(){return current.parts},get level(){return level},get lodStats(){return {level,resident:[...cache].map(([key,item])=>({level:key,...modelGeometryStats(item.model.group)}))}},setLOD,maintain,
    update:assembly=>{lastAssembly={...assembly};current.update(assembly)},
    dispose:()=>{for(const item of cache.values())disposeModelGeometry(item.model.group);cache.clear();group.clear()},
  };
}
