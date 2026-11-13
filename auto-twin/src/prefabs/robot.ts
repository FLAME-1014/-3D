import * as THREE from 'three';
import type { RobotConfig, RobotPose } from '../welding/logic';
import { ROBOT_LINKS, ROBOT_SHOULDER_HEIGHT, ROBOT_TCP_OFFSET } from '../welding/logic';
import type { FactoryMaterials } from './materials';
import { beam, box, mergeStatic } from './factory';
import type { LODLevel } from '../core/lod';

interface RobotVariant {group:THREE.Group;joints:THREE.Group[];tool:THREE.Group;tcp:THREE.Group;electrodeTips:THREE.Group[];apply:(pose:RobotPose)=>void}
export interface LODStats {level:LODLevel;resident:{level:LODLevel;triangles:number;geometries:number}[]}
export interface RobotModel extends RobotVariant {setLOD:(level:LODLevel,wallSeconds:number)=>void;releaseOriginal:()=>void;maintain:(wallSeconds:number)=>void;dispose:()=>void;readonly level:LODLevel;readonly lodStats:LODStats}

export function modelGeometryStats(group:THREE.Object3D):{triangles:number;geometries:number} {
  let triangles=0;const geometries=new Set<THREE.BufferGeometry>();group.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);triangles+=(object.geometry.index?.count??object.geometry.attributes.position!.count)/3*(object instanceof THREE.InstancedMesh?object.count:1)}});return {triangles,geometries:geometries.size};
}
export function disposeModelGeometry(group:THREE.Object3D):void {
  const geometries=new Set<THREE.BufferGeometry>();group.traverse(object=>{if(object instanceof THREE.Mesh)geometries.add(object.geometry)});geometries.forEach(geometry=>geometry.dispose());group.removeFromParent();
}
function propagateIdentity(parent:THREE.Group,child:THREE.Group):void {
  const fields=['id','partId','carId','skidId','station'];child.traverse(object=>{for(const field of fields)if(parent.userData[field]!==undefined)object.userData[field]=parent.userData[field]});
}

/** Six named pivots preserve shoulder/elbow dimensions across every detail level. */
function buildRobot(config:RobotConfig,m:FactoryMaterials,level:LODLevel):RobotVariant {
  const detail=level==='original'?144:level==='medium'?96:52;
  const axialSegments=level==='original'?7:level==='medium'?5:4;
  const fine=level==='original'||level==='medium';
  const cyl=(parent:THREE.Object3D,radius:number,height:number,position:[number,number,number],material:THREE.Material,segments=detail)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,Math.min(detail,segments),segments===detail?axialSegments:1),material);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh};
  const group=new THREE.Group();group.name=`机器人 R${String(config.index+1).padStart(2,'0')}`;group.position.set(...config.base);
  const foundation=new THREE.Group();group.add(foundation);
  if(config.base[1]>0)box(foundation,[1.2,config.base[1],1.2],[0,-config.base[1]/2,0],m.white);
  cyl(foundation,.52,.24,[0,.12,0],m.darkSteel);box(foundation,[1.08,.1,1.08],[0,.045,0],m.darkSteel);
  if(fine)for(const x of [-.4,.4])for(const z of [-.4,.4])cyl(foundation,.055,.05,[x,.12,z],m.steel,8);
  mergeStatic(foundation);
  const joints=Array.from({length:6},(_,index)=>{const joint=new THREE.Group();joint.name=`A${index+1}`;joint.userData={component:true,name:`第 ${index+1} 轴`,description:['底座回转轴','大臂俯仰轴','小臂俯仰轴','腕部姿态轴','腕部滚转轴','工具回转轴'][index]};return joint});
  group.add(joints[0]!);joints[0]!.position.y=ROBOT_SHOULDER_HEIGHT;
  const baseCover=new THREE.Group();joints[0]!.add(baseCover);
  cyl(baseCover,.37,1.23,[0,-.77,0],m.orange);
  cyl(baseCover,.42,.19,[0,-1.08,0],m.darkSteel);
  box(baseCover,[.42,.61,.52],[-.21,-.35,0],m.orange);
  mergeStatic(baseCover);
  joints[0]!.add(joints[1]!);
  const upper=new THREE.Group();joints[1]!.add(upper);
  cyl(upper,.29,.51,[0,0,0],m.darkSteel).rotation.x=Math.PI/2;
  cyl(upper,.25,.54,[0,0,0],m.orange).rotation.x=Math.PI/2;
  box(upper,[ROBOT_LINKS[0],.34,.36],[ROBOT_LINKS[0]/2,.04,0],m.orange);
  if(fine){box(upper,[.9,.09,.045],[.65,.21,.19],m.darkSteel);beam(upper,[.15,-.18,.2],[1.12,-.18,.2],.055,m.steel)}
  if(level==='original')for(let bolt=0;bolt<8;bolt++){const angle=bolt*Math.PI/4;cyl(upper,.021,.055,[.22*Math.cos(angle),.22*Math.sin(angle),.29],m.steel,12).rotation.x=Math.PI/2}
  box(upper,[.4,.15,.4],[-.22,-.22,0],m.darkSteel);mergeStatic(upper);
  joints[1]!.add(joints[2]!);joints[2]!.position.x=ROBOT_LINKS[0];
  const lower=new THREE.Group();joints[2]!.add(lower);
  cyl(lower,.25,.46,[0,0,0],m.orange).rotation.x=Math.PI/2;
  cyl(lower,.145,.48,[0,0,0],m.darkSteel).rotation.x=Math.PI/2;
  box(lower,[ROBOT_LINKS[1],.26,.28],[ROBOT_LINKS[1]/2,0,0],m.orange);
  if(fine){box(lower,[.87,.04,.045],[.6,.15,.16],m.darkSteel);beam(lower,[.12,.18,.19],[1.1,.18,.19],.038,m.black)}
  if(level==='original')for(let bolt=0;bolt<8;bolt++){const angle=bolt*Math.PI/4;cyl(lower,.018,.045,[.18*Math.cos(angle),.18*Math.sin(angle),.25],m.steel,12).rotation.x=Math.PI/2}mergeStatic(lower);
  joints[2]!.add(joints[3]!);joints[3]!.position.x=ROBOT_LINKS[1];
  cyl(joints[3]!,.15,.23,[-.1,0,0],m.darkSteel).rotation.z=Math.PI/2;
  joints[3]!.add(joints[4]!);cyl(joints[4]!,.12,.16,[-.045,0,0],m.orange).rotation.x=Math.PI/2;
  joints[4]!.add(joints[5]!);cyl(joints[5]!,.09,.06,[.025,0,0],m.steel).rotation.z=Math.PI/2;
  const tool=new THREE.Group();tool.position.x=ROBOT_TCP_OFFSET;tool.name=config.process==='spr'?'SPR 自冲铆接钳':config.process==='laser'?'激光钎焊头':config.process==='spot'?'点焊 C 型焊钳':'真空装配抓手';joints[5]!.add(tool);
  const tcp=new THREE.Group();tcp.name='TCP 电极接触点';tool.add(tcp);
  const jawA=new THREE.Group(),jawB=new THREE.Group();tool.add(jawA,jawB);
  const electrodeTips:THREE.Group[]=[];
  if(config.process==='spot'||config.process==='spr'){
    box(tool,[.23,.17,.3],[-.24,.02,0],config.process==='spr'?m.blue:m.darkSteel);
    box(tool,[.14,.08,.17],[-.28,.14,0],m.orange);
    for(const [jaw,sign] of [[jawA,-1],[jawB,1]] as const){
      box(jaw,[.07,.2,.07],[sign*.12,-.07,0],m.steel);
      cyl(jaw,.027,.126,[sign*.075,0,0],m.yellow).rotation.z=Math.PI/2;
      const end=new THREE.Group();end.name=sign===-1?'固定电极触点':'活动电极触点';end.position.x=sign*.012;jaw.add(end);electrodeTips.push(end);
    }
    beam(tool,[-.3,-.17,0],[.14,-.17,0],.075,m.darkSteel);
  }else if(config.process==='laser'){
    cyl(tool,.11,.3,[-.16,0,0],m.darkSteel).rotation.z=Math.PI/2;
    cyl(tool,.046,.1,[-.05,0,0],m.steel).rotation.z=Math.PI/2;
    box(tool,[.15,.12,.18],[-.25,.12,0],m.blue);
  }else{
    box(tool,[.1,.08,.61],[-.12,0,0],m.darkSteel);
    for(const z of [-.24,.24])cyl(tool,.075,.12,[-.06,0,z],m.black).rotation.z=Math.PI/2;
  }
  tool.userData={component:true,name:tool.name,description:config.process==='spr'?'机械铆接，演示不产生焊接火花。':config.process==='laser'?'封闭工房内的激光钎焊，演示不产生火花。':'工艺工具的 TCP 与预先规划的车身接触点一致。'};
  const origins=joints.map(joint=>joint.position.clone());
  return {group,joints,tool,tcp,electrodeTips,apply:(pose)=>{
    joints.forEach((joint,index)=>joint.position.copy(origins[index]!));
    const angles=pose.jointAngles;
    joints[0]!.rotation.y=-angles[0];joints[1]!.rotation.z=angles[1];joints[2]!.rotation.z=angles[2];
    joints[3]!.rotation.set(angles[3],0,0);joints[4]!.rotation.set(0,0,angles[4]);joints[5]!.rotation.set(angles[5],0,0);
    const gap=.08*(1-pose.gunClosed);jawA.position.x=-gap;jawB.position.x=gap;
    group.userData.phase=pose.phase;group.userData.process=config.process;
  }};
}

function proxyRobot(config:RobotConfig,m:FactoryMaterials):RobotVariant {
  const group=new THREE.Group();group.position.set(...config.base);group.name=`机器人 R${String(config.index+1).padStart(2,'0')}`;
  if(config.base[1]>0)box(group,[1.2,config.base[1],1.2],[0,-config.base[1]/2,0],m.white);
  box(group,[1.08,.24,1.08],[0,.12,0],m.darkSteel);
  const joints=Array.from({length:6},(_,index)=>{const node=new THREE.Group();node.name=`A${index+1}`;node.userData={component:true,name:`第 ${index+1} 轴`};return node});
  group.add(joints[0]!);joints[0]!.position.y=ROBOT_SHOULDER_HEIGHT;box(joints[0]! ,[.74,1.23,.74],[0,-.77,0],m.orange);
  joints[0]!.add(joints[1]!);box(joints[1]! ,[1.3,.34,.36],[.65,.04,0],m.orange);
  joints[1]!.add(joints[2]!);joints[2]!.position.x=ROBOT_LINKS[0];box(joints[2]! ,[1.25,.26,.28],[.625,0,0],m.orange);
  joints[2]!.add(joints[3]!);joints[3]!.position.x=ROBOT_LINKS[1];box(joints[3]! ,[.23,.3,.3],[-.1,0,0],m.darkSteel);
  joints[3]!.add(joints[4]!);joints[4]!.add(joints[5]!);
  const tool=new THREE.Group();tool.position.x=ROBOT_TCP_OFFSET;tool.name=config.process==='laser'?'激光头':config.process==='spot'?'点焊钳':config.process==='spr'?'SPR 铆接钳':'真空抓手';joints[5]!.add(tool);
  const tcp=new THREE.Group();tool.add(tcp);const jaws=[new THREE.Group(),new THREE.Group()];tool.add(...jaws);const electrodeTips:THREE.Group[]=[];
  box(tool,[.26,.17,.3],[-.24,.02,0],config.process==='handling'||config.process==='assembly'?m.darkSteel:m.blue);
  if(config.process==='spot'||config.process==='spr')for(let index=0;index<2;index++){const sign=index===0?-1:1;box(jaws[index]! ,[.126,.054,.054],[sign*.075,0,0],m.yellow);const point=new THREE.Group();point.position.x=sign*.012;jaws[index]!.add(point);electrodeTips.push(point)}
  else if(config.process==='laser')box(tool,[.1,.092,.092],[-.05,0,0],m.steel);
  else for(const z of [-.24,.24])box(tool,[.12,.15,.15],[-.06,0,z],m.black);
  const origins=joints.map(joint=>joint.position.clone());
  return {group,joints,tool,tcp,electrodeTips,apply:pose=>{const q=pose.jointAngles;joints.forEach((joint,index)=>joint.position.copy(origins[index]!));joints[0]!.rotation.y=-q[0];joints[1]!.rotation.z=q[1];joints[2]!.rotation.z=q[2];joints[3]!.rotation.set(q[3],0,0);joints[4]!.rotation.set(0,0,q[4]);joints[5]!.rotation.set(q[5],0,0);const gap=.08*(1-pose.gunClosed);jaws[0]!.position.x=-gap;jaws[1]!.position.x=gap}};
}

/** Stable identity/picking root; variant geometry appears only when first selected. */
export function createRobot(config:RobotConfig,m:FactoryMaterials):RobotModel {
  const group=new THREE.Group();group.position.set(...config.base);group.name=`机器人 R${String(config.index+1).padStart(2,'0')}`;
  const cache=new Map<LODLevel,{model:RobotVariant;used:number}>();let level:LODLevel='proxy',now=0,lastPose:RobotPose|undefined;
  const make=(next:LODLevel)=>{const model=next==='proxy'?proxyRobot(config,m):buildRobot(config,m,next);model.group.position.set(0,0,0);cache.set(next,{model,used:now});return model};
  let current=make(level);group.add(current.group);
  const advance=(wallSeconds:number)=>{if(Number.isFinite(wallSeconds))now=Math.max(now,wallSeconds)};
  const maintain=(wallSeconds:number)=>{advance(wallSeconds);for(const [key,item] of cache)if(key!==level&&now-item.used>=8){disposeModelGeometry(item.model.group);cache.delete(key)}};
  const setLOD=(next:LODLevel,wallSeconds:number)=>{advance(wallSeconds);if(next!==level){cache.get(level)!.used=now;current.group.removeFromParent();current=cache.get(next)?.model??make(next);level=next;group.add(current.group);if(lastPose)current.apply(lastPose)}propagateIdentity(group,current.group);cache.get(level)!.used=now;maintain(now)};
  return {group,get joints(){return current.joints},get tool(){return current.tool},get tcp(){return current.tcp},get electrodeTips(){return current.electrodeTips},get level(){return level},get lodStats(){return {level,resident:[...cache].map(([key,item])=>({level:key,...modelGeometryStats(item.model.group)}))}},setLOD,maintain,
    releaseOriginal:()=>{if(level==='original')setLOD('medium',now);const original=cache.get('original');if(original){disposeModelGeometry(original.model.group);cache.delete('original')}},
    dispose:()=>{for(const item of cache.values())disposeModelGeometry(item.model.group);cache.clear();group.clear()},
    apply:pose=>{lastPose=pose;current.apply(pose);group.userData.phase=pose.phase;group.userData.process=config.process},
  };
}
