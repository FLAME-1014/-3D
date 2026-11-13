import {disposeSceneResources} from '../core/resources';
import * as THREE from 'three';
import { getStampingState, PRESS_NAMES, PRESS_POSITIONS, stampingPartId } from '../core/production';
import { rangeProgress } from '../core/clock';
import { applyOriginalBudget, selectLOD, type LODLevel, type LODQuality } from '../core/lod';
import { createFactoryMaterials, type FactoryMaterials } from '../prefabs/materials';
import { beam, box, cylinder, floor, hall, instances, label, mergeStatic, placement, railing, type Point3 } from '../prefabs/factory';
import { disposeModelGeometry, modelGeometryStats, type LODStats } from '../prefabs/robot';
import type { Pickable, Station, World } from './types';

const STATIONS: Station[] = [
  {id:'COIL',name:'钢卷库',en:'COIL STORAGE',x:-49,description:'鞍座存储钢卷，C 形钩依次下降、插入、起吊、平移、放卷、退出与返回。'},
  {id:'BLANK',name:'开卷落料',en:'DECOILING & BLANKING',x:-36,description:'钢带经过开卷、矫平和落料压机，切成标准料片后堆垛。'},
  {id:'WASH',name:'拆垛 · 清洗 · 对中',en:'DESTACK · WASH · CENTRE',x:-25,description:'分离单张料片，清洗表面并在对中台上完成送料定位。'},
  ...PRESS_POSITIONS.map((x,index)=>({id:`OP${(index+1)*10}`,name:PRESS_NAMES[index]!.slice(5),en:['SERVO DRAWING','TRIM & PIERCE','TRIM & RESTRAIN','FLANGE & CUT'][index]!,x,description:['伺服滑块以快下、慢压、保压、回程曲线拉延侧围外板。','修边并冲出门窗轮廓，废料通过溜槽落入地下输送带。','修整轮廓并校准板件几何，稳定后续装配基准。','完成翻边、冲孔与切断，形成可转入焊装的侧围外板。'][index]!})),
  {id:'PACK',name:'线尾检查 · 装框',en:'INSPECTION & RACKING',x:33,robots:2,description:'双线机器人检查并装框，每框 120 件，满框后 AGV 在 42 秒内完成交换。'},
  {id:'DISPATCH',name:'冲压件库 · 发货',en:'PARTS STORAGE & DISPATCH',x:49,description:'满框零件按编号排队等待配送至焊装车间。'},
];

interface Component {group:THREE.Group;origin:THREE.Vector3;offset:THREE.Vector3}
interface PressModel {group:THREE.Group;slider:THREE.Group;components:Component[];status:THREE.Mesh}
function component(parent:THREE.Group,name:string,description:string,offset:Point3):Component {
  const group=new THREE.Group();group.name=name;group.userData={name,description,component:true};parent.add(group);
  return {group,origin:group.position.clone(),offset:new THREE.Vector3(...offset)};
}

function press(parent:THREE.Group,x:number,index:number,m:FactoryMaterials):PressModel {
  const group=new THREE.Group();group.position.x=x;group.name=`OP${(index+1)*10}`;parent.add(group);
  const parts:Component[]=[];
  const base=component(group,'移动工作台','承载下模，可沿轨道驶入后方换模区。',[0,0,5]);parts.push(base);
  box(base.group,[8,.48,5.3],[0,.24,0],m.darkSteel);
  box(base.group,[6.7,.6,4.4],[0,.78,0],m.white);
  box(base.group,[5.9,.18,3.8],[0,1.18,0],m.steel);
  box(base.group,[5.6,.3,2.9],[0,1.44,0],m.darkSteel);
  const slots:THREE.Matrix4[]=[];for(let sx=-2.6;sx<2.7;sx+=.4)slots.push(placement([sx,1.282,0],[.018,.02,3.65]));
  instances(base.group,new THREE.BoxGeometry(1,1,1),m.black,slots);
  const columns=component(group,'四柱机架','四根立柱将压制载荷传递到基础。',[0,0,-3.1]);parts.push(columns);
  for(const sx of [-3.4,3.4])for(const z of [-2.15,2.15]){
    box(columns.group,[.92,7.25,.98],[sx,4.07,z],m.white);
    box(columns.group,[1.18,.36,1.2],[sx,.57,z],m.darkSteel);
    box(columns.group,[1.12,.34,1.12],[sx,7.9,z],m.darkSteel);
    box(columns.group,[.94,1.9,.025],[sx,1.72,z+.504],m.yellow);
    for(let stripe=0;stripe<5;stripe++){
      const warning=box(columns.group,[.13,2.04,.028],[sx-.43+stripe*.21,1.72,z+.523],m.black);warning.rotation.z=-.38;
    }
    box(columns.group,[.12,5.3,.12],[sx+(sx<0?.49:-.49),4.32,z],m.steel);
  }
  const crown=component(group,'顶部横梁 / 伺服传动','顶部横梁包含主传动与压机控制系统。',[0,3.2,0]);parts.push(crown);
  box(crown.group,[7.75,1.48,4.2],[0,8.96,0],m.white);
  box(crown.group,[7.82,.12,4.25],[0,9.7,0],m.darkSteel);
  for(const sx of [-2.2,2.2]){
    cylinder(crown.group,.48,.74,[sx,10.05,0],m.darkSteel,24);
    cylinder(crown.group,.34,.82,[sx,10.2,0],m.blue,20);
  }
  for(let sx=-3;sx<3.2;sx+=.6)box(crown.group,[.32,.035,.08],[sx,9.46,2.13],m.darkSteel);
  label(crown.group,`OP${(index+1)*10}  ${PRESS_NAMES[index]!.slice(5)}`,['SERVO DRAW PRESS','TRIM / PIERCE','RESTRAIN PRESS','FLANGE PRESS'][index]!,[0,8.95,2.14],5.7,.72);
  const slide=component(group,'滑块 / 上模','行程 1.35 米，快下 → 慢压 → 保压 → 回程。',[0,1.7,1.6]);parts.push(slide);
  const slider=new THREE.Group();slide.group.add(slider);
  box(slider,[6.2,1.15,3.9],[0,0,0],m.white);
  box(slider,[6.25,.18,3.94],[0,-.58,0],m.darkSteel);
  for(const sx of [-2.05,2.05])box(slider,[.42,1.15,2.25],[sx,-1.22,0],m.darkSteel);
  box(slider,[5.75,.45,2.95],[0,-2.1,0],m.steel);
  for(const sx of [-2.2,2.2])cylinder(slider,.16,2.25,[sx,1.72,0],m.steel,16);
  const safety=component(group,'检修平台 / 爬梯','黄黑安全标识、检修爬梯和顶部护栏。',[4,0,0]);parts.push(safety);
  for(const z of [-1.6,-.9])beam(safety.group,[4.02,.3,z],[4.02,8.1,z],.07,m.darkSteel);
  for(let y=.5;y<8.1;y+=.35)beam(safety.group,[4.04,y,-1.6],[4.04,y,-.9],.045,m.steel);
  box(safety.group,[1.25,.13,4.5],[4.12,7.78,0],m.darkSteel);
  for(const z of [-2.2,2.2]){
    beam(safety.group,[3.8,8.9,z],[4.8,8.9,z],.045,m.yellow);
    for(const sx of [3.8,4.8])beam(safety.group,[sx,7.83,z],[sx,8.9,z],.04,m.yellow);
  }
  beam(safety.group,[4.8,8.9,-2.2],[4.8,8.9,2.2],.045,m.yellow);
  const controls=component(group,'操作台 / 配电柜','伺服位置、压力和互锁状态监控。',[-3.2,0,2.3]);parts.push(controls);
  box(controls.group,[.72,1.7,.5],[-3.82,.9,3.28],m.white);
  box(controls.group,[.52,.36,.025],[-3.82,1.3,3.55],m.black);
  box(controls.group,[.44,.25,.03],[-3.82,1.3,3.57],m.blue);
  cylinder(controls.group,.045,.04,[-3.99,1.0,3.57],m.red,12).rotation.x=Math.PI/2;
  const status=cylinder(group,.085,.24,[3.83,2.05,3.26],m.green,12);
  const pipe=new THREE.Group();group.add(pipe);
  for(const z of [-2.6,2.6])beam(pipe,[-3.35,.15,z],[3.35,.15,z],.07,m.steel);
  mergeStatic(pipe);parts.forEach(part=>{if(part.group!==slide.group)mergeStatic(part.group)});mergeStatic(slider);
  return {group,slider,components:parts,status};
}

function rollerConveyor(parent:THREE.Group,x:number,z:number,length:number,width:number,m:FactoryMaterials,y=1.35):THREE.Group {
  const group=new THREE.Group();group.position.set(x,0,z);parent.add(group);
  for(const side of [-1,1])box(group,[length,.25,.15],[0,y-.15,side*width/2],m.darkSteel);
  for(const sx of [-length/2+.3,length/2-.3])for(const sz of [-width/2,width/2])box(group,[.12,y-.2,.15],[sx,(y-.2)/2,sz],m.darkSteel);
  const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  const transforms:THREE.Matrix4[]=[];for(let sx=-length/2+.18;sx<length/2;sx+=.32)transforms.push(placement([sx,y,0],[1,1,1],rotation));
  instances(group,new THREE.CylinderGeometry(.09,.09,width,12),m.steel,transforms);mergeStatic(group);return group;
}

function rack(parent:THREE.Group,position:Point3,m:FactoryMaterials,filled=true):THREE.Group {
  const group=new THREE.Group();group.position.set(...position);parent.add(group);
  for(const z of [-1.35,1.35]){
    beam(group,[-2.7,.18,z],[2.7,.18,z],.15,m.blue);
    for(const x of [-2.6,2.6])beam(group,[x,.2,z],[x,2.6,z],.12,m.blue);
    beam(group,[-2.65,2.58,z],[2.65,2.58,z],.1,m.blue);
  }
  for(const x of [-2.6,2.6])beam(group,[x,.2,-1.35],[x,.2,1.35],.15,m.blue);
  if(filled){
    const matrices:THREE.Matrix4[]=[];for(let n=0;n<60;n++)matrices.push(placement([0,1.3,-1.17+n*.039]));
    const geometry=sideGeometry(true);geometry.rotateX(Math.PI/2);
    instances(group,geometry,m.steel,matrices);
  }
  mergeStatic(group);return group;
}

/** Bisect the longest triangle edge so forming gains surface samples, rather than invisible thickness rings. */
function subdivideSheet(source:THREE.BufferGeometry,passes:number):THREE.BufferGeometry {
  let positions=new Float32Array(source.attributes.position!.array),uvs=new Float32Array(source.attributes.uv!.array);
  for(let pass=0;pass<passes;pass++){
    const nextPositions=new Float32Array(positions.length*2),nextUVs=new Float32Array(uvs.length*2);let output=0;
    for(let vertex=0;vertex<positions.length/3;vertex+=3){
      const distance=(a:number,b:number)=>{let value=0;for(let axis=0;axis<3;axis++)value+=(positions[(vertex+a)*3+axis]!-positions[(vertex+b)*3+axis]!)**2;return value};
      const lengths=[distance(0,1),distance(1,2),distance(2,0)];const edge=lengths.indexOf(Math.max(...lengths)),a=edge,b=(edge+1)%3,c=(edge+2)%3;
      // Both child triangles have the winding of the source triangle.
      for(const index of [a,-1,c,-1,b,c]){
        for(let axis=0;axis<3;axis++)nextPositions[output*3+axis]=index<0?(positions[(vertex+a)*3+axis]!+positions[(vertex+b)*3+axis]!)/2:positions[(vertex+index)*3+axis]!;
        for(let axis=0;axis<2;axis++)nextUVs[output*2+axis]=index<0?(uvs[(vertex+a)*2+axis]!+uvs[(vertex+b)*2+axis]!)/2:uvs[(vertex+index)*2+axis]!;
        output++;
      }
    }
    positions=nextPositions;uvs=nextUVs;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.computeVertexNormals();source.dispose();return geometry;
}

function sideGeometry(trimmed:boolean,level:LODLevel='proxy'):THREE.BufferGeometry {
  const outline=new THREE.Shape();
  outline.moveTo(-2.45,-.78);outline.lineTo(2.45,-.78);outline.lineTo(2.4,.12);outline.lineTo(1.65,.28);outline.lineTo(.83,.92);outline.lineTo(-.85,.92);outline.lineTo(-1.62,.29);outline.lineTo(-2.38,.13);outline.closePath();
  if(trimmed){
    const front=new THREE.Path();front.moveTo(-1.37,-.56);front.lineTo(-1.37,.14);front.lineTo(-.74,.71);front.lineTo(-.12,.71);front.lineTo(-.12,-.56);front.closePath();outline.holes.push(front);
    const rear=new THREE.Path();rear.moveTo(.1,-.56);rear.lineTo(.1,.71);rear.lineTo(.73,.71);rear.lineTo(1.34,.12);rear.lineTo(1.34,-.56);rear.closePath();outline.holes.push(rear);
  }
  // All variants retain the same sheet outline, apertures and edge dimensions.
  const bevelSegments=level==='original'?4:level==='medium'?2:1;
  const steps=1;
  const geo=new THREE.ExtrudeGeometry(outline,{depth:.012,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments,steps,curveSegments:1});
  geo.rotateX(-Math.PI/2);return level==='proxy'?geo:subdivideSheet(geo,5);
}
interface PartVariant {group:THREE.Group;blank:THREE.Mesh;drawn:THREE.Mesh;trimmed:THREE.Mesh;drawBase:Float32Array;trimBase:Float32Array;details:{mesh:THREE.Mesh;base:Float32Array;trimmed:boolean}[]}
interface LocalLODModel {group:THREE.Group;setLOD:(level:LODLevel,wallSeconds:number)=>void;maintain:(wallSeconds:number)=>void;dispose:()=>void;readonly level:LODLevel;readonly lodStats:LODStats}
interface PartModel extends LocalLODModel {pick:Pickable;apply:(shape:number)=>void}

function panelVariant(m:FactoryMaterials,level:LODLevel):PartVariant {
  const group=new THREE.Group();group.name=`侧围板 ${level}`;
  const material=()=>{const mat=m.steel.clone();mat.transparent=true;return mat};
  const blank=box(group,[4.95,.035,1.96],[0,.02,0],material());
  const drawn=new THREE.Mesh(sideGeometry(false,level),material());group.add(drawn);
  const trimmed=new THREE.Mesh(sideGeometry(true,level),material());group.add(trimmed);
  drawn.castShadow=trimmed.castShadow=true;
  const details:PartVariant['details']=[];
  if(level==='original')for(const [surface,isTrimmed] of [[drawn,false],[trimmed,true]] as const){
    // Pressed sill/roof beads stay inside the solid sheet, clear of both door openings.
    for(const [length,x,z] of [[4.48,0,.715],[1.5,0,-.84]] as const){
      const geometry=new THREE.BoxGeometry(length,.013,.022,8,1,1).translate(x,.023,z);
      const mesh=new THREE.Mesh(geometry,surface.material);mesh.castShadow=true;surface.add(mesh);
      details.push({mesh,base:new Float32Array(geometry.attributes.position!.array),trimmed:isTrimmed});
    }
  }
  return {group,blank,drawn,trimmed,drawBase:new Float32Array(drawn.geometry.attributes.position!.array),trimBase:new Float32Array(trimmed.geometry.attributes.position!.array),details};
}

function propagateLODIdentity(parent:THREE.Group,child:THREE.Group):void {
  child.traverse(object=>{
    for(const field of ['id','partId','carId','skidId','station'])if(parent.userData[field]!==undefined)object.userData[field]=parent.userData[field];
    if(!object.userData.component){object.userData.name=parent.userData.name;object.userData.description=parent.userData.description}
  });
}

function disposePanelVariant(model:PartVariant):void {
  const materials=new Set<THREE.Material>();model.group.traverse(object=>{if(object instanceof THREE.Mesh)(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material))});
  disposeModelGeometry(model.group);materials.forEach(material=>material.dispose());
}

function panel(parent:THREE.Group,m:FactoryMaterials,slot:number):PartModel {
  const group=new THREE.Group();parent.add(group);group.name='侧围外板';
  const cache=new Map<LODLevel,{model:PartVariant;used:number}>();let level:LODLevel='proxy',now=0,lastShape=0,closed=false;
  const make=(next:LODLevel)=>{const model=panelVariant(m,next);cache.set(next,{model,used:now});return model};
  let current=make(level);group.add(current.group);
  const apply=(shape:number)=>{
    lastShape=shape;const draw=Math.min(1,shape),trim=Math.max(0,Math.min(1,shape-1));
    (current.blank.material as THREE.MeshStandardMaterial).opacity=1-draw;
    (current.drawn.material as THREE.MeshStandardMaterial).opacity=draw*(1-trim);
    (current.trimmed.material as THREE.MeshStandardMaterial).opacity=trim;
    current.blank.visible=draw<.999;current.drawn.visible=draw>.001&&trim<.999;current.trimmed.visible=trim>.001;
    const trimAmount=Math.min(1.35,draw+(shape-2)*.08);
    deformPanel(current.drawn,current.drawBase,draw);deformPanel(current.trimmed,current.trimBase,trimAmount);
    current.details.forEach(detail=>deformPanel(detail.mesh,detail.base,detail.trimmed?trimAmount:draw));
  };
  const maintain=(wallSeconds:number)=>{if(closed)return;if(Number.isFinite(wallSeconds))now=Math.max(now,wallSeconds);for(const [key,item] of cache)if(key!==level&&now-item.used>=8){disposePanelVariant(item.model);cache.delete(key)}};
  const setLOD=(next:LODLevel,wallSeconds:number)=>{if(closed)return;if(Number.isFinite(wallSeconds))now=Math.max(now,wallSeconds);if(next!==level){cache.get(level)!.used=now;current.group.removeFromParent();current=cache.get(next)?.model??make(next);level=next;group.add(current.group);propagateLODIdentity(group,current.group);apply(lastShape)}cache.get(level)!.used=now;maintain(now)};
  apply(0);
  return {group,apply,setLOD,maintain,get level(){return level},get lodStats(){return {level,resident:[...cache].map(([key,item])=>({level:key,...modelGeometryStats(item.model.group)}))}},
    dispose:()=>{if(closed)return;closed=true;for(const item of cache.values())disposePanelVariant(item.model);cache.clear();group.clear()},
    pick:{object:group,id:'',name:'侧围外板',station:Math.min(7,slot+3),description:'唯一零件编号从落料到装框始终保持一致。'},
  };
}

function deformPanel(mesh:THREE.Mesh,base:Float32Array,amount:number):void {
  const position=mesh.geometry.attributes.position!;
  for(let vertex=0;vertex<position.count;vertex++){
    const i=vertex*3;const x=base[i]!,y=base[i+1]!,z=base[i+2]!;
    position.setXYZ(vertex,x,y+amount*(.14*Math.cos(z*1.55)+.055*Math.sin(x*1.8)**2),z);
  }
  position.needsUpdate=true;mesh.geometry.computeVertexNormals();
}

interface TailRobotVariant {group:THREE.Group;joints:THREE.Group[];tool:THREE.Group}
interface TailRobotModel extends LocalLODModel {readonly joints:THREE.Group[];readonly tool:THREE.Group;releaseOriginal:()=>void}
function tailRobotVariant(m:FactoryMaterials,level:LODLevel):TailRobotVariant {
  const group=new THREE.Group();group.name=`装框机器人 ${level}`;
  const segments=level==='original'?112:level==='medium'?80:60;
  const heightSegments=level==='original'?8:level==='medium'?6:4;
  const shaft=(parent:THREE.Object3D,radius:number,height:number,position:Point3,material:THREE.Material)=>{
    if(level==='proxy')return box(parent,[radius*2,height,radius*2],position,material);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,segments,heightSegments),material);mesh.position.set(...position);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const base=shaft(group,.58,.38,[0,.19,0],m.darkSteel);
  base.userData={name:'机器人底座',description:'承载六轴机器人。'};
  const j0=new THREE.Group();j0.position.y=.38;group.add(j0);
  shaft(j0,.44,1.1,[0,.55,0],m.orange);
  const j1=new THREE.Group();j1.position.y=1.1;j0.add(j1);
  if(level!=='proxy')shaft(j1,.29,.5,[0,0,0],m.darkSteel).rotation.x=Math.PI/2;
  box(j1,[.36,1.3,.34],[0,.65,0],m.orange);
  const j2=new THREE.Group();j2.position.y=1.3;j1.add(j2);
  if(level!=='proxy')shaft(j2,.25,.46,[0,0,0],m.orange).rotation.x=Math.PI/2;
  box(j2,[.29,1.25,.29],[0,.625,0],m.orange);
  const j3=new THREE.Group();j3.position.y=1.25;j2.add(j3);
  if(level==='proxy')box(j3,[.32,.61,.32],[0,.305,0],m.darkSteel);else shaft(j3,.16,.25,[0,.12,0],m.darkSteel);
  const j4=new THREE.Group();j4.position.y=.22;j3.add(j4);
  if(level!=='proxy')shaft(j4,.14,.2,[0,.1,0],m.orange);
  const j5=new THREE.Group();j5.position.y=.17;j4.add(j5);
  const tool=new THREE.Group();j5.add(tool);
  box(tool,[.8,level==='proxy'?.22:.08,.4],[0,level==='proxy'?.18:.14,0],m.darkSteel);
  if(level!=='proxy')for(const sx of [-.3,.3])for(const sz of [-.13,.13])shaft(tool,.06,.12,[sx,.23,sz],m.black);
  const joints=[j0,j1,j2,j3,j4,j5];
  joints.forEach((joint,index)=>{joint.name=`A${index+1}`;joint.userData={component:true,name:`第 ${index+1} 轴`,description:['底座回转，将手臂转向出料线或料架。','大臂俯仰，控制送料高度与水平距离。','小臂俯仰，调整真空抓手的伸出距离。','腕部姿态轴，在搬运时保持板件方向。','腕部滚转轴，调整工具姿态。','工具回转轴，保持装框方向。'][index]}});
  tool.name='真空装框抓手';tool.userData={component:true,name:tool.name,description:'四个真空吸盘吸附侧围外板，随机器人移送至料架。'};
  if(level==='medium'||level==='original'){
    box(j1,[.055,.93,.018],[.185,.67,.12],m.darkSteel);
    box(j2,[.042,.87,.018],[.147,.63,.1],m.darkSteel);
    for(const sx of [-.3,.3])beam(tool,[sx,.13,0],[sx,.22,.13],.018,m.steel);
  }
  if(level==='original'){
    for(let bolt=0;bolt<8;bolt++){
      const angle=bolt*Math.PI/4;cylinder(group,.021,.025,[.45*Math.cos(angle),.392,.45*Math.sin(angle)],m.steel,8);
      for(const [joint,radius,z] of [[j1,.225,.26],[j2,.19,.24]] as const)cylinder(joint,.019,.022,[radius*Math.cos(angle),radius*Math.sin(angle),z],m.steel,8).rotation.x=Math.PI/2;
    }
    for(const sz of [-.13,.13])beam(tool,[-.3,.185,sz],[.3,.185,sz],.012,m.steel);
  }
  return {group,joints,tool};
}

function tailRobot(parent:THREE.Group,x:number,z:number,m:FactoryMaterials):TailRobotModel {
  const group=new THREE.Group();group.position.set(x,0,z);group.name='装框机器人';parent.add(group);
  const cache=new Map<LODLevel,{model:TailRobotVariant;used:number}>();let level:LODLevel='proxy',now=0,closed=false;
  const make=(next:LODLevel)=>{const model=tailRobotVariant(m,next);cache.set(next,{model,used:now});return model};
  let current=make(level);group.add(current.group);
  const maintain=(wallSeconds:number)=>{if(closed)return;if(Number.isFinite(wallSeconds))now=Math.max(now,wallSeconds);for(const [key,item] of cache)if(key!==level&&now-item.used>=8){disposeModelGeometry(item.model.group);cache.delete(key)}};
  const setLOD=(next:LODLevel,wallSeconds:number)=>{if(closed)return;if(Number.isFinite(wallSeconds))now=Math.max(now,wallSeconds);if(next!==level){
    const pose=current.joints.map(joint=>({position:joint.position.clone(),quaternion:joint.quaternion.clone()}));
    cache.get(level)!.used=now;current.group.removeFromParent();current=cache.get(next)?.model??make(next);level=next;group.add(current.group);propagateLODIdentity(group,current.group);
    current.joints.forEach((joint,index)=>{joint.position.copy(pose[index]!.position);joint.quaternion.copy(pose[index]!.quaternion)});
  }cache.get(level)!.used=now;maintain(now)};
  return {group,get joints(){return current.joints},get tool(){return current.tool},get level(){return level},get lodStats(){return {level,resident:[...cache].map(([key,item])=>({level:key,...modelGeometryStats(item.model.group)}))}},setLOD,maintain,
    releaseOriginal:()=>{if(closed)return;if(level==='original')setLOD('medium',now);const item=cache.get('original');if(item){disposeModelGeometry(item.model.group);cache.delete('original')}},
    dispose:()=>{if(closed)return;closed=true;for(const item of cache.values())disposeModelGeometry(item.model.group);cache.clear();group.clear()},
  };
}

export function createStampingWorld():World {
  const group=new THREE.Group();group.name='冲压车间';const m=createFactoryMaterials();
  floor(group,132,56,m,2.4);const roof=hall(group,132,56,m);
  const pickables:Pickable[]=[];
  const addPick=(object:THREE.Object3D,station:number,name:string,description?:string,id=STATIONS[station]!.id)=>{
    object.userData={...object.userData,station,id,name,description};
    object.traverse(child=>{if(child instanceof THREE.Mesh){let ancestor:THREE.Object3D|null=child.parent;while(ancestor&&ancestor!==object&&!ancestor.userData.component)ancestor=ancestor.parent;child.userData={...child.userData,station,id,name:ancestor?.userData.component?ancestor.name:name,description:ancestor?.userData.component?ancestor.userData.description:description}}});
    pickables.push({object,station,id,name,description});
  };
  const storage=new THREE.Group();group.add(storage);
  const coilGeo=new THREE.TorusGeometry(.64,.22,12,40);
  const coils:THREE.Matrix4[]=[];const saddles:THREE.Matrix4[]=[];
  for(const x of [-53,-49,-45])for(const z of [-13,-9,-5,5,9]){
    coils.push(placement([x,1.05,z]));saddles.push(placement([x,.23,z],[1.85,.42,1.5]));
    saddles.push(placement([x-.57,.5,z],[.18,.45,1.4]));saddles.push(placement([x+.57,.5,z],[.18,.45,1.4]));
  }
  const storedCoils=instances(storage,coilGeo,m.steel,coils);storedCoils.userData={instanceIds:coils.map((_,i)=>`COIL-${String(i+1).padStart(3,'0')}`)};
  instances(storage,new THREE.BoxGeometry(1,1,1),m.darkSteel,saddles);addPick(storage,0,'钢卷鞍座库',STATIONS[0]!.description);
  label(group,'01  钢卷库','COIL STORAGE',[-49,4,-14],6,.85);
  const crane=new THREE.Group();group.add(crane);
  for(const z of [-17,11]){
    for(const x of [-56,-31])box(crane,[.32,8.5,.32],[x,4.25,z],m.darkSteel);
    box(crane,[26,.5,.34],[-43.5,8.4,z],m.yellow);
  }
  const bridge=new THREE.Group();crane.add(bridge);
  box(bridge,[.7,.65,28],[-49,8.25,-3],m.yellow);
  const trolley=new THREE.Group();crane.add(trolley);
  box(trolley,[1.2,.35,1],[0,0,0],m.darkSteel);
  const rope=cylinder(crane,.024,1,[0,0,0],m.black,8);
  const hook=new THREE.Group();crane.add(hook);
  beam(hook,[0,.95,0],[0,-.9,0],.12,m.yellow);beam(hook,[0,-.9,0],[0,-.9,-1.1],.16,m.yellow);beam(hook,[0,-.9,-1.1],[0,-.38,-1.1],.16,m.yellow);
  const liftedCoil=new THREE.Mesh(coilGeo.clone(),m.steel);group.add(liftedCoil);liftedCoil.castShadow=true;
  addPick(crane,0,'C 形钩行车','连续吊卷：下降 → 插入 → 起吊 → 平移 → 放置 → 退出 → 返回。','CRANE');
  const decoiler=new THREE.Group();decoiler.position.x=-36;group.add(decoiler);
  box(decoiler,[2.2,1.1,3],[0,.55,0],m.white);
  const reel=new THREE.Group();reel.position.set(0,1.7,0);decoiler.add(reel);
  cylinder(reel,.87,1.7,[0,0,0],m.steel,40).rotation.x=Math.PI/2;
  for(const z of [-.86,.86])for(let spoke=0;spoke<4;spoke++){
    const angle=spoke*Math.PI/2;beam(reel,[.31*Math.cos(angle),.31*Math.sin(angle),z],[.81*Math.cos(angle),.81*Math.sin(angle),z],.045,m.darkSteel);
  }
  cylinder(decoiler,.32,2.8,[0,1.7,0],m.darkSteel,24).rotation.x=Math.PI/2;
  box(decoiler,[6.7,.035,1.65],[3.9,1.65,0],m.steel);
  for(const sx of [2.3,4.5]){
    box(decoiler,[1.1,1.9,2.5],[sx,.95,0],m.white);
    box(decoiler,[1.2,.38,2.6],[sx,2.22,0],m.darkSteel);
    for(const sz of [-1.32,1.32])box(decoiler,[.8,1.35,.25],[sx,1.95,sz],m.white);
  }
  box(decoiler,[1.8,.75,2.7],[6.3,.4,0],m.white);
  for(const x of [5.55,7.05])for(const z of [-1.17,1.17])box(decoiler,[.17,2.55,.19],[x,1.95,z],m.white);
  box(decoiler,[1.95,.5,2.9],[6.3,3.45,0],m.darkSteel);
  const blankingSlider=new THREE.Group();blankingSlider.position.set(6.3,2.55,0);decoiler.add(blankingSlider);
  box(blankingSlider,[1.6,.4,2.1],[0,0,0],m.orange);box(blankingSlider,[1.6,.17,1.96],[0,-.27,0],m.steel);
  for(const x of [-.55,.55])cylinder(blankingSlider,.06,.5,[x,.38,0],m.steel,12);
  reel.removeFromParent();blankingSlider.removeFromParent();
  mergeStatic(decoiler);addPick(decoiler,1,'开卷 · 矫平 · 落料线',STATIONS[1]!.description);
  decoiler.add(reel,blankingSlider);addPick(reel,1,'开卷机主轴与钢卷','以同一个生产时钟确定角度，连续放出钢带。','DECOIL-REEL');addPick(blankingSlider,1,'落料压机滑块','四秒循环完成下压、切断、保压和回程。','BLANKING-SLIDER');
  const stripMarks=instances(group,new THREE.BoxGeometry(.012,.003,1.56),m.darkSteel,Array.from({length:12},()=>new THREE.Matrix4()));
  label(group,'02  开卷落料线','DECOIL · STRAIGHTEN · BLANK',[-35,4.1,-3.5],6.8,.8);
  rollerConveyor(group,-29,0,3.3,2.2,m,1.5);
  const washing=new THREE.Group();washing.position.x=-25;group.add(washing);
  box(washing,[3.2,.55,5.8],[0,.3,0],m.darkSteel);
  const stacks:THREE.Matrix4[]=[];for(let n=0;n<18;n++)stacks.push(placement([-1.65,.63+n*.022,0],[1.65,.014,4.95]));
  instances(washing,new THREE.BoxGeometry(1,1,1),m.steel,stacks);
  for(const z of [-2.85,2.85]){box(washing,[5.8,.2,.2],[.7,3.1,z],m.yellow);for(const x of [-2,3.4])box(washing,[.16,3.1,.16],[x,1.55,z],m.darkSteel)}
  box(washing,[2.9,.25,5.7],[1.3,2.5,0],m.white);
  box(washing,[2.9,2.35,.13],[1.3,1.18,-2.79],m.white);
  box(washing,[2.9,.9,.13],[1.3,.45,2.79],m.white);
  box(washing,[2.9,.23,.13],[1.3,2.2,2.79],m.white);
  box(washing,[2.7,1.08,.04],[1.3,1.43,2.87],m.glass);
  for(const x of [-.12,2.72])for(const z of [-2.8,2.8])box(washing,[.13,2.4,.13],[x,1.2,z],m.white);
  box(washing,[1.8,.18,5.3],[2.5,1.5,0],m.steel);
  mergeStatic(washing);addPick(washing,2,'拆垛 · 清洗 · 对中设备',STATIONS[2]!.description);
  const destackHead=new THREE.Group();washing.add(destackHead);box(destackHead,[1.25,.1,1.65],[0,0,0],m.darkSteel);
  for(const x of [-.48,.48])for(const z of [-.6,.6])cylinder(destackHead,.065,.16,[x,-.1,z],m.black,12);
  const destackRod=cylinder(washing,.042,1,[0,2.6,0],m.steel,12);
  addPick(destackHead,2,'拆垛真空抓手','提升单张料片、穿过清洗窗口，并放到对中平台。','DESTACK-HEAD');
  const sprayMaterial=new THREE.MeshBasicMaterial({color:'#a9d2d7',transparent:true,opacity:.19,depthWrite:false});
  const washingSprays=Array.from({length:6},(_,index)=>{const spray=cylinder(washing,.009,.55,[.35+(index%3)*.6,1.98,index<3?-.56:.56],sprayMaterial,5);return spray});
  label(group,'03  拆垛 · 清洗 · 对中','DESTACKING / WASHING / CENTRING',[-24,4.1,-3.3],7,.8);
  const presses=PRESS_POSITIONS.map((x,index)=>{const model=press(group,x,index,m);addPick(model.group,index+3,`OP${(index+1)*10} ${PRESS_NAMES[index]!.slice(5)}`,STATIONS[index+3]!.description);return model});
  const transfer=new THREE.Group();group.add(transfer);
  for(const z of [-1.75,1.75])box(transfer,[45,.12,.12],[.5,2.15,z],m.darkSteel);
  for(const x of [-20,-9,0,9,20])for(const z of [-1.5,1.5]){
    box(transfer,[.9,.07,.15],[x,1.82,z],m.steel);
    cylinder(transfer,.045,.13,[x,1.7,z],m.black,8);
  }
  mergeStatic(transfer);
  const dieZone=new THREE.Group();group.add(dieZone);
  for(const x of [-17,-10]){
    const die=new THREE.Group();dieZone.add(die);
    box(die,[5.8,.8,3.6],[x,.4,-11],m.blue);box(die,[5.9,.25,3.7],[x,.93,-11],m.steel);
    for(const z of [-12.5,-9.5])box(die,[.5,.4,.5],[x,1.18,z],m.darkSteel);
    label(die,'侧围外板模具','DIE SET / QUICK CHANGE',[x,1.7,-8.98],4.5,.65);mergeStatic(die);
  }
  for(const x of [-16.25,-10.75])box(dieZone,[.075,.025,14],[x,.015,-6.7],m.steel);
  label(group,'快速换模区','QUICK DIE CHANGE / TOOLING',[-13.5,3.1,-15],7,.85);
  addPick(dieZone,3,'快速换模区','移动工作台沿轨道进入线后模具准备区。','DIE-CHANGE');
  const scrap=new THREE.Group();group.add(scrap);
  box(scrap,[35,.26,1.3],[4,.2,-5.2],m.darkSteel);
  for(const x of PRESS_POSITIONS)beam(scrap,[x,1.2,-1.2],[x,.5,-5.2],.08,m.steel,.8);
  box(scrap,[3.8,1.6,2.8],[21,.8,-5.2],m.blue);
  const scraps:THREE.Matrix4[]=[];for(let n=0;n<32;n++)scraps.push(placement([19.6+(n%7)*.39,1.5+Math.floor(n/7)*.035,-6.1+(n%5)*.37],[.44,.018,.3],new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),n*.71)));
  instances(scrap,new THREE.BoxGeometry(1,1,1),m.steel,scraps);mergeStatic(scrap);
  const movingScrap=instances(group,new THREE.BoxGeometry(1,1,1),m.steel,Array.from({length:48},()=>new THREE.Matrix4()));
  label(group,'废料回收','SCRAP RECOVERY',[21,2.7,-6.5],4.2,.65);
  const tails=new THREE.Group();group.add(tails);
  for(const z of [-3.4,3.4])rollerConveyor(tails,27,z,12,2.1,m,1.53);
  for(const z of [-4.7,4.7]){box(tails,[.2,3.6,.2],[24,1.8,z],m.white);box(tails,[.2,3.6,.2],[28,1.8,z],m.white)}
  box(tails,[4.2,.4,9.4],[26,3.5,0],m.white);
  const inspection=new THREE.Group();tails.add(inspection);box(inspection,[.7,.35,.55],[25,3.2,-3.4],m.darkSteel);box(inspection,[.7,.35,.55],[25,3.2,3.4],m.darkSteel);
  mergeStatic(tails);
  const movingRobots=[tailRobot(group,33,-5.7,m),tailRobot(group,33,5.7,m)];
  const liveRacks=[rack(group,[33,0,-8],m,false),rack(group,[33,0,8],m,false)];
  movingRobots.forEach((robot,index)=>addPick(robot.group,7,index===0?'左线装框机器人':'右线装框机器人','六轴机器人采用真空抓手将冲压件装入料架。',`PACK-ROBOT-${index+1}`));
  addPick(tails,7,'线尾检查与出料输送线',STATIONS[7]!.description);
  label(group,'08  线尾检查 · 自动装框','INSPECTION / ROBOTIC RACKING',[31,4.5,-11.9],8.8,.85);
  const dispatch=new THREE.Group();group.add(dispatch);
  let stockIndex=0;
  for(const x of [45,52,59])for(const z of [-11,-5,5,11]){
    const stock=rack(dispatch,[x,0,z],m,true);
    stock.traverse(child=>{if(child instanceof THREE.InstancedMesh){child.userData.instanceIds=Array.from({length:60},(_,index)=>`SP-SIDE-L-${String(stockIndex*60+index+1).padStart(5,'0')}`)}});stockIndex++;
  }
  label(dispatch,'09  冲压件库 · 发货','PARTS WAREHOUSE / TO BODY SHOP',[51,4,-15],9,.9);
  for(const x of [42,48,54,60])box(dispatch,[.075,.012,25],[x,0,0],m.yellow);
  addPick(dispatch,8,'冲压件物流缓存',STATIONS[8]!.description);
  const agv=new THREE.Group();group.add(agv);box(agv,[2.1,.42,1.4],[0,.31,0],m.yellow);box(agv,[1.8,.16,1.2],[0,.58,0],m.darkSteel);
  for(const sx of [-.7,.7])for(const z of [-.62,.62])cylinder(agv,.2,.16,[sx,.22,z],m.black,16).rotation.x=Math.PI/2;
  box(agv,[.8,.1,.025],[0,.34,.72],m.blue);mergeStatic(agv);addPick(agv,7,'料架交换 AGV','满框转出、空框进入，全程 42 秒。','AGV');
  for(const z of [-7,7]){railing(group,-40,z,17,m);railing(group,0,z,35,m);railing(group,29,z,12,m)}
  const panelModels=Array.from({length:6},(_,slot)=>panel(group,m,slot));panelModels.forEach(model=>pickables.push(model.pick));
  const upstreamParts=Array.from({length:2},(_,index)=>{
    const object=new THREE.Group();group.add(object);box(object,[4.95,.035,1.96],[0,.02,0],m.steel);const record:Pickable={object,id:'',name:index===0?'落料料片':'清洗对中料片',station:index+1,description:'原始落料编号贯穿清洗、对中、四道冲压与装框。'};pickables.push(record);return {object,record};
  });
  let lastUpstream:{id:string;x:number;y:number;stage:string}[]=[];let lastReelAngle=0,lastBlankingStroke=0;
  const rackLoads=liveRacks.map((rackGroup,index)=>{const transforms=Array.from({length:60},(_,n)=>placement([0,1.3,-1.17+n*.039]));const geometry=sideGeometry(true);geometry.rotateX(Math.PI/2);const mesh=instances(rackGroup,geometry,m.steel,transforms);addPick(rackGroup,7,index===0?'左线料架':'右线料架','每个实际存储实例都关联完整零件编号。',`LIVE-RACK-${index}`);return mesh});
  const direction=new THREE.Group();group.add(direction);
  for(const x of [-57,-23,20,57]){
    label(direction,'物料流向  →','MATERIAL FLOW / STAMPING',[x,.03,14],6,.85).rotation.x=-Math.PI/2;
  }
  const lodModels:LocalLODModel[]=[...movingRobots,...panelModels];
  const lodVisible=lodModels.map(()=>true);
  let wallSeconds=0,disposed=false;
  const lodCounts=()=>{const counts:Record<LODLevel,number>={proxy:0,low:0,medium:0,original:0};if(!disposed)lodModels.forEach((model,index)=>{if(lodVisible[index])counts[model.level]++});return counts};
  const maintain=(now:number)=>{if(disposed)return;if(Number.isFinite(now))wallSeconds=Math.max(wallSeconds,now);lodModels.forEach(model=>model.maintain(wallSeconds))};
  const lodDebug=()=>{
    const models=lodModels.map((model,index)=>({id:model.group.userData.id??'',kind:index<movingRobots.length?'robot':'panel',visible:!disposed&&lodVisible[index],...model.lodStats}));
    const resident=models.flatMap(model=>model.resident);const inactive=models.flatMap(model=>model.resident.filter(variant=>variant.level!==model.level));
    const worldStats=modelGeometryStats(group);
    return {active:lodCounts(),residentVariants:resident.length,residentRobotOriginals:models.filter(model=>model.kind==='robot').reduce((sum,model)=>sum+model.resident.filter(variant=>variant.level==='original').length,0),residentTriangles:resident.reduce((sum,variant)=>sum+variant.triangles,0),residentGeometries:resident.reduce((sum,variant)=>sum+variant.geometries,0),residentWorldTriangles:worldStats.triangles+inactive.reduce((sum,variant)=>sum+variant.triangles,0),residentWorldGeometries:worldStats.geometries+inactive.reduce((sum,variant)=>sum+variant.geometries,0),wallSeconds,models};
  };
  return {
    shop:'stamping',group,roof,stations:STATIONS,pickables,
    camera:{position:[61,58,90],target:[-2,2.5,-2]},
    get lodCounts(){return lodCounts()},maintain,
    dispose:()=>{
      if(disposed)return;disposed=true;lodModels.forEach(model=>model.dispose());
      disposeSceneResources(group,Object.values(m));group.clear();
    },
    debug:()=>({upstreamParts:lastUpstream,reelAngle:lastReelAngle,blankingStroke:lastBlankingStroke,scrapInstances:movingScrap.count,lod:lodDebug(),robotTools:movingRobots.map(robot=>({id:robot.group.userData.id,level:robot.level,tool:robot.tool.getWorldPosition(new THREE.Vector3()).toArray(),jointOrigins:robot.joints.map(joint=>joint.position.toArray())}))}),
    update:(time,exploded,selected,camera,quality)=>{
      if(disposed)return;
      const state=getStampingState(time);
      reel.rotation.z=-time/.87;lastReelAngle=reel.rotation.z;
      const t=state.cycleTime;
      const blankingStroke=t<1.2?.45*rangeProgress(t,.95,1.2):t<1.45?.45+.1*rangeProgress(t,1.2,1.45):t<1.65?.55:.55*(1-rangeProgress(t,1.65,2.2));
      blankingSlider.position.y=2.55-blankingStroke;lastBlankingStroke=blankingStroke;
      for(let index=0;index<12;index++){const x=-35.5+((time+index*(6.7/12))%6.7);stripMarks.setMatrixAt(index,placement([x,1.671,0]))}stripMarks.instanceMatrix.needsUpdate=true;
      const washProgress=rangeProgress(t,.15,2.6),vacuumLift=.38*Math.sin(Math.PI*rangeProgress(t,.15,2.6));
      const upstreamPoses=[{id:stampingPartId(1002+state.cycle),x:-29+4*rangeProgress(t,1.65,3.75),y:1.62,stage:'落料 → 拆垛'},{id:stampingPartId(1001+state.cycle),x:-25+2.5*washProgress,y:1.62+vacuumLift,stage:'单张清洗 → 对中'}];
      lastUpstream=upstreamPoses;
      upstreamParts.forEach((part,index)=>{const pose=upstreamPoses[index]!;part.object.position.set(pose.x,pose.y,0);part.object.rotation.y=index===0?Math.PI/2*rangeProgress(t,1.65,3.35):Math.PI/2;part.record.id=pose.id;part.object.traverse(child=>{child.userData={partId:pose.id,id:pose.id,name:part.record.name,description:`${pose.id} · ${pose.stage}`,station:part.record.station}})});
      destackHead.position.set(2.5*washProgress,1.84+vacuumLift,0);
      const rodBottom=destackHead.position.y+.1;destackRod.position.set(destackHead.position.x,(3.1+rodBottom)/2,0);destackRod.scale.y=3.1-rodBottom;
      washingSprays.forEach(spray=>{spray.visible=t>.65&&t<2.6});sprayMaterial.opacity=.12+.08*(.5+.5*Math.sin(time*12));
      for(let index=0;index<48;index++){const phase=(time*.8+index*.713)%34.6;movingScrap.setMatrixAt(index,placement([-13.4+phase,.365+.013*Math.sin(index*2.31),-5.2+.35*Math.sin(index*1.87)],[.22+(index%4)*.052,.012,.15+(index%3)*.037],new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),index*1.71)))}movingScrap.instanceMatrix.needsUpdate=true;
      presses.forEach((model,index)=>{
        model.slider.position.y=state.presses[index]!.sliderY;
        for(const part of model.components){const u=exploded&&selected===`OP${(index+1)*10}`?1:0;part.group.position.copy(part.origin).addScaledVector(part.offset,u)}
        model.status.scale.y=state.presses[index]!.phase==='保压'?1.4:1;
      });
      transfer.position.x=state.transfer.progress*9;transfer.position.y=state.transfer.lift;
      hook.position.set(...state.coil.hook);liftedCoil.position.set(...state.coil.coil);
      bridge.position.x=state.coil.hook[0]+49;trolley.position.set(state.coil.hook[0],8.2,state.coil.hook[2]);
      rope.position.set(state.coil.hook[0],(8.2+state.coil.hook[1]+.9)/2,state.coil.hook[2]);rope.scale.y=Math.max(.05,8.2-state.coil.hook[1]-.9);
      state.parts.forEach((part,index)=>{
        const model=panelModels[index]!;model.group.position.set(part.x,part.y,part.z);
        if(index===0){model.group.position.x=-22.5+9*state.transfer.progress;model.group.rotation.y=Math.PI/2*(1-state.transfer.progress)}
        if(index===5){const pack=rangeProgress(state.cycleTime,1.05,3.15);model.group.position.x+=1.7*Math.sin(pack*Math.PI);model.group.position.z=part.z+(part.serial%2===0?-4.6:4.6)*pack;model.group.position.y=part.y+Math.sin(pack*Math.PI)*.8;model.group.visible=state.cycleTime<3.2}
        model.apply(part.shape);
        model.group.userData={id:part.id,partId:part.id,name:'侧围外板',description:`${part.id} · 工序 ${Math.min(4,Math.ceil(part.shape))} / 4`,station:model.pick.station};model.group.traverse(child=>{child.userData={...model.group.userData}});model.pick.id=part.id;
      });
      movingRobots.forEach((robot,index)=>{
        const side=index===0?-1:1;const active=(state.parts[5]!.serial%2===0?0:1)===index;
        let targetY=2.8,targetZ=side*4.4,targetX=0;
        if(active){
          if(state.cycleTime<1.05){const approach=rangeProgress(state.cycleTime,0,1.05);targetY=2.8+(1.78-2.8)*approach;targetZ=side*(4.4-approach)}
          else if(state.cycleTime<3.15){const p=rangeProgress(state.cycleTime,1.05,3.15);targetX=1.7*Math.sin(p*Math.PI);targetY=1.78+.8*Math.sin(p*Math.PI);targetZ=side*(3.4+4.6*p)}
          else {const withdraw=rangeProgress(state.cycleTime,3.15,4);targetX=1.7*Math.sin(Math.PI*withdraw);targetY=1.78+(2.8-1.78)*withdraw+.3*Math.sin(Math.PI*withdraw);targetZ=side*(8-3.6*withdraw)}
        }
        const dx=targetX,dz=targetZ-robot.group.position.z;const radial=Math.hypot(dx,dz),dy=targetY+.62-1.48;
        const elbow=-Math.acos(Math.max(-1,Math.min(1,(radial*radial+dy*dy-1.3**2-1.25**2)/(2*1.3*1.25))));
        const shoulder=Math.atan2(dy,radial)-Math.atan2(1.25*Math.sin(elbow),1.3+1.25*Math.cos(elbow));
        robot.joints[0]!.rotation.y=-Math.atan2(dz,dx);
        robot.joints[1]!.rotation.z=shoulder-Math.PI/2;
        robot.joints[2]!.rotation.z=elbow;
        robot.joints[3]!.rotation.z=-Math.PI/2-shoulder-elbow;
        robot.joints[4]!.rotation.y=0;robot.joints[5]!.rotation.z=0;
      });
      liveRacks.forEach((rackGroup,index)=>{rackGroup.position.x=33+(index===0&&state.rack.exchanging?state.rack.fullRackX-33:0)});
      rackLoads.forEach((mesh,index)=>{const line=state.rack.lines[index]!;mesh.count=line.filled;mesh.userData.instanceIds=line.storedParts.map(part=>part.id);mesh.userData.rackId=line.id;mesh.userData.partRecords=line.storedParts});
      agv.position.set(state.rack.agvX,0,state.rack.agvZ);
      wallSeconds=Math.max(wallSeconds,performance.now()/1000);
      camera?.updateMatrixWorld(true);
      const eye=camera?camera.getWorldPosition(new THREE.Vector3()):new THREE.Vector3(61,58,90);
      const lodQuality:LODQuality=quality==='fine'||quality==='smooth'?quality:'balanced';
      const frustum=camera?new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)):null;
      const distances=lodModels.map((model,index)=>{
        const center=model.group.position.clone();if(index<movingRobots.length)center.y+=1.5;
        lodVisible[index]=model.group.visible&&(!frustum||frustum.intersectsSphere(new THREE.Sphere(center,index<movingRobots.length?3.2:3.6)));
        return lodVisible[index]?eye.distanceTo(model.group.position):Infinity;
      });
      const desired=lodModels.map((model,index)=>selectLOD(model.level,distances[index]!,lodQuality));
      const robotLevels=applyOriginalBudget(desired.slice(0,movingRobots.length),distances.slice(0,movingRobots.length),lodQuality);
      // Evict displaced originals in a separate pass before constructing any new ones.
      movingRobots.forEach((robot,index)=>{if(robotLevels[index]!=='original')robot.releaseOriginal()});
      movingRobots.forEach((robot,index)=>robot.setLOD(robotLevels[index]!,wallSeconds));
      panelModels.forEach((model,index)=>model.setLOD(desired[index+movingRobots.length]!,wallSeconds));
      maintain(wallSeconds);group.updateMatrixWorld(true);
    },
  };
}
