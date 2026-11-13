import * as THREE from 'three';
import { getRobotState, getWeldingState, ROBOT_CONFIGS, ROBOT_SHOULDER_HEIGHT, STATION_POSITIONS, type BodyAssembly, type RobotPose } from './logic';
import { applyOriginalBudget, selectLOD, type LODLevel, type LODQuality } from '../core/lod';
import { createFactoryMaterials, type FactoryMaterials } from '../prefabs/materials';
import { beam, box, cylinder, floor, hall, instances, label, mergeStatic, placement, railing } from '../prefabs/factory';
import { createBody, type BodyModel } from '../prefabs/carBody';
import { createRobot } from '../prefabs/robot';
import { SparkPool, type SparkSource } from '../prefabs/sparks';
import type { Pickable, Station, World } from '../scene/types';

const STATIONS:Station[]=[
  {id:'UB-10',name:'下车体连接',en:'UNDERBODY / SPR',x:-42,robots:4,description:'前地板、后地板与机舱总成依次进入定位销，夹紧后采用自冲铆接连接。'},
  {id:'BS-20',name:'侧围总成',en:'BODY SIDE ASSEMBLY',x:-30,robots:4,description:'左右侧围从线边料架上件，经侧向门架定位后与下车体合拢。'},
  {id:'FR-30',name:'主拼',en:'FRAMING / GEOMETRY',x:-18,robots:4,description:'主拼门架夹紧侧围、地板和顶框横梁，建立白车身几何基准后点焊。'},
  {id:'RS-40',name:'补焊',en:'RESPOT WELDING',x:-6,robots:4,description:'机器人在侧围与门槛区域完成补焊。火花仅在电极夹住板件时发射。'},
  {id:'RL-50',name:'顶盖连接',en:'ROOF LASER BRAZING',x:6,robots:2,description:'顶盖定位与夹紧后，在封闭防护房内沿边缘进行激光钎焊，无点焊火花。'},
  {id:'CL-60',name:'四门两盖',en:'CLOSURES ASSEMBLY',x:18,robots:4,description:'先装后门，再装前门，最后装前盖与尾门；该工位是装配工序。'},
  {id:'QM-70',name:'在线测量',en:'IN-LINE METROLOGY',x:30,robots:0,description:'扫描门架测量代表性几何测点，面板中的偏差属于演示数据。'},
  {id:'LIFT-80',name:'升降出线',en:'LIFT / PAINT TRANSFER',x:42,robots:0,description:'载车滑橇从 1 米升至 5 米，转入高位输送桥，升降台空载下降。'},
];

function rollerBed(parent:THREE.Group,m:FactoryMaterials):void {
  const staticParts=new THREE.Group();parent.add(staticParts);
  for(const z of [-1.08,1.08]){
    box(staticParts,[109,.24,.18],[0,.77,z],m.darkSteel);
    for(let x=-52;x<=52;x+=4)box(staticParts,[.17,.68,.23],[x,.35,z],m.darkSteel);
  }
  for(let x=-52;x<53;x+=3)box(staticParts,[.12,.13,2.36],[x,.5,0],m.darkSteel);
  const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  const matrices:THREE.Matrix4[]=[];for(let x=-54;x<=54;x+=.42)matrices.push(placement([x,.87,0],[1,1,1],rotation));
  instances(parent,new THREE.CylinderGeometry(.095,.095,2.04,12),m.steel,matrices);mergeStatic(staticParts);
}

function carrier(parent:THREE.Group,m:FactoryMaterials):{group:THREE.Group;body:BodyModel} {
  const group=new THREE.Group();parent.add(group);const skid=new THREE.Group();skid.name='载车滑橇';group.add(skid);
  for(const z of [-.72,.72])box(skid,[5.2,.11,.16],[0,.02,z],m.darkSteel);
  for(const x of [-2,-.8,.8,2])box(skid,[.13,.09,1.65],[x,.02,0],m.darkSteel);
  for(const x of [-1.45,1.45])for(const z of [-.65,.65]){
    cylinder(skid,.055,.23,[x,.17,z],m.steel,12);
    box(skid,[.22,.04,.2],[x,.28,z],m.blue);
  }
  box(skid,[.75,.12,.06],[0,.1,1.04],m.yellow);mergeStatic(skid);
  const body=createBody(m);group.add(body.group);return {group,body};
}

function fixtures(parent:THREE.Group,x:number,m:FactoryMaterials,main=false):{gates:THREE.Group[];jaws:THREE.Group[]} {
  const foundation=new THREE.Group();parent.add(foundation);
  for(const z of [-1.9,1.9])box(foundation,[5.9,.12,.55],[x,.14,z],m.blue);
  const gates:THREE.Group[]=[],jaws:THREE.Group[]=[];
  for(const side of [-1,1]){
    const gate=new THREE.Group();gate.position.set(x,0,side*2.25);parent.add(gate);gates.push(gate);
    for(const dx of [-2.2,2.2]){
      box(gate,[.17,main?3.4:1.5,.18],[dx,main?1.7:.75,0],m.blue);
      box(gate,[.5,.12,.46],[dx,.19,0],m.darkSteel);
    }
    if(main){beam(gate,[-2.2,3.4,0],[2.2,3.4,0],.15,m.blue);beam(gate,[-2.2,1.5,0],[2.2,1.5,0],.11,m.blue)}
    else beam(gate,[-2.2,1.25,0],[2.2,1.25,0],.11,m.blue);
    for(const dx of [-1.85,-.15,1.8]){
      cylinder(gate,.07,.48,[dx,1.24,0],m.steel,12);
      const jaw=new THREE.Group();jaw.position.set(dx,1.48,0);gate.add(jaw);jaws.push(jaw);
      box(jaw,[.14,.11,.42],[0,0,-side*.13],m.yellow);
      cylinder(jaw,.032,.17,[0,-.11,-side*.3],m.steel,10);
    }
    // Jaws remain articulated; only structural leaves are combined.
    const held=jaws.filter(jaw=>jaw.parent===gate);held.forEach(jaw=>jaw.removeFromParent());mergeStatic(gate);held.forEach(jaw=>gate.add(jaw));
  }
  mergeStatic(foundation);return {gates,jaws};
}

function lineRack(parent:THREE.Group,x:number,z:number,m:FactoryMaterials,kind:'sides'|'doors'|'roof'):void {
  const rack=new THREE.Group();rack.position.set(x,0,z);parent.add(rack);
  for(const side of [-1,1]){
    beam(rack,[-2.5,.14,side*1.1],[2.5,.14,side*1.1],.12,m.blue);
    for(const dx of [-2.4,2.4])beam(rack,[dx,.12,side*1.1],[dx,2.4,side*1.1],.1,m.blue);
  }
  const prototype=createBody(m);prototype.setLOD('low',0);const source=prototype.parts[kind==='doors'?'frontDoors':kind==='roof'?'roof':'sides']!;
  for(let index=0;index<4;index++){
    const clone=source.clone(true);clone.position.set(0,kind==='roof'?.25+index*.12:.3,-.45+index*.3);rack.add(clone);
  }
  mergeStatic(rack);
  prototype.dispose();
  label(parent,kind==='sides'?'侧围料架':kind==='doors'?'门盖料架':'顶盖料架','LINE-SIDE PARTS',[x,2.8,z+1.15],4,.65);
}

export function createWeldingWorld():World {
  const group=new THREE.Group();group.name='焊装车间';const m=createFactoryMaterials();floor(group,120,36,m,1.8);const roof=hall(group,120,36,m);
  const pickables:Pickable[]=[];
  const pick=(object:THREE.Object3D,index:number,name:string,description:string,id=STATIONS[index]!.id)=>{
    object.userData={...object.userData,id,station:index,name,description};
    object.traverse(child=>{if(child instanceof THREE.Mesh){let node:THREE.Object3D|null=child.parent;while(node&&node!==object&&!node.userData.component)node=node.parent;child.userData={...child.userData,id,station:index,name:node?.userData.component?node.name:name,description:node?.userData.component?node.userData.description:description}}});
    const record={object,id,station:index,name,description};pickables.push(record);return record;
  };
  rollerBed(group,m);
  const stationPads=new THREE.Group();group.add(stationPads);
  for(const [index,x] of STATION_POSITIONS.entries()){
    box(stationPads,[8.9,.035,8.5],[x,0,0],m.floor);
    const border:THREE.Matrix4[]=[placement([x-.0,.025,-4.3],[9,.012,.075]),placement([x,.025,4.3],[9,.012,.075]),placement([x-4.45,.025,0],[.075,.012,8.6]),placement([x+4.45,.025,0],[.075,.012,8.6])];
    instances(stationPads,new THREE.BoxGeometry(1,1,1),m.yellow,border);
    label(group,`${STATIONS[index]!.id}  ${STATIONS[index]!.name}`,STATIONS[index]!.en,[x,4.5,-5.4],7.4,.85);
    for(const z of [-5.7,5.7]){
      box(stationPads,[.9,1.7,.48],[x-4.2,.85,z],m.white);
      box(stationPads,[.53,.37,.027],[x-4.2,1.23,z+.25],m.black);
      box(stationPads,[.45,.27,.028],[x-4.2,1.23,z+.27],m.blue);
      cylinder(stationPads,.04,.22,[x-4.2,1.94,z],m.green,12);
    }
  }
  mergeStatic(stationPads);
  const fixtureModels=STATION_POSITIONS.slice(0,6).map((x,index)=>{const model=fixtures(group,x,m,index===2);model.gates.forEach((gate,side)=>pick(gate,index,`${STATIONS[index]!.name} ${side===0?'左':'右'}夹具`,STATIONS[index]!.description,`${STATIONS[index]!.id}-FIX-${side}`));return model});
  const robots=ROBOT_CONFIGS.map(config=>{const robot=createRobot(config,m);group.add(robot.group);pick(robot.group,config.station,robot.group.name,STATIONS[config.station]!.description,`ROBOT-${String(config.index+1).padStart(2,'0')}`);return robot});
  lineRack(group,-43,-9,m,'roof');lineRack(group,-30,-9,m,'sides');lineRack(group,-30,8,m,'sides');
  lineRack(group,6,-9,m,'roof');lineRack(group,18,-9,m,'doors');lineRack(group,18,8,m,'doors');
  const ub=new THREE.Group();group.add(ub);
  for(const x of [-45.4,-39.3]){
    box(ub,[1.7,.65,3.2],[x,.35,-6.6],m.blue);box(ub,[1.6,.05,3.1],[x,.72,-6.6],m.steel);
  }
  label(ub,'自冲铆接 · SPR','MECHANICAL JOINING / NO SPARK',[-42,2.8,-7.7],6,.7);mergeStatic(ub);pick(ub,0,'下车体上件与 SPR 工位',STATIONS[0]!.description,'UB-FEED');
  const cabin=new THREE.Group();group.add(cabin);
  for(const x of [1.5,10.5])for(const z of [-4.55,4.55])box(cabin,[.17,4.4,.17],[x,2.2,z],m.white);
  for(const z of [-4.55,4.55]){
    box(cabin,[9,2.35,.05],[6,2.72,z],m.glass);box(cabin,[9,.85,.16],[6,.42,z],m.white);box(cabin,[9,.28,.18],[6,4.35,z],m.white);
  }
  for(const x of [1.5,10.5]){
    box(cabin,[.09,3.8,1.4],[x,1.9,-3.83],m.white);box(cabin,[.09,3.8,1.4],[x,1.9,3.83],m.white);
    box(cabin,[.16,.6,9.1],[x,4.1,0],m.white);
  }
  box(cabin,[9,.05,9.1],[6,4.48,0],m.glass);
  label(cabin,'激光钎焊防护房','ENCLOSED LASER BRAZING / NO SPARKS',[6,4.75,4.7],8.4,.8);mergeStatic(cabin);pick(cabin,4,'封闭激光钎焊防护房',STATIONS[4]!.description,'LASER-CABIN');
  const laserTrace=new THREE.InstancedMesh(new THREE.SphereGeometry(.026,12,8),new THREE.MeshStandardMaterial({color:'#ffcf50',emissive:'#ffbb33',emissiveIntensity:2,roughness:.6}),2);group.add(laserTrace);
  const laserTrails=Array.from({length:2},()=>{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(32*3),3));const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#f4bd65',transparent:true,opacity:.67,toneMapped:false}));group.add(line);return line});
  const sparks=new SparkPool(group);
  const measurement=new THREE.Group();measurement.position.x=30;group.add(measurement);
  for(const z of [-2.2,2.2])box(measurement,[.28,3.5,.3],[0,1.75,z],m.white);
  box(measurement,[.3,.42,4.7],[0,3.5,0],m.white);box(measurement,[.32,.1,4.7],[0,3.7,0],m.blue);
  const scanner=new THREE.Group();measurement.add(scanner);
  for(const z of [-1.05,0,1.05]){box(scanner,[.34,.17,.24],[0,3.11,z],m.darkSteel);box(scanner,[.15,.025,.15],[0,3.01,z],m.blue)}
  const held=scanner;held.removeFromParent();mergeStatic(measurement);measurement.add(held);pick(measurement,6,'在线几何测量门架',STATIONS[6]!.description);
  const scan=new THREE.Mesh(new THREE.PlaneGeometry(4.5,1.7),new THREE.MeshBasicMaterial({color:'#70d3d2',transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false}));scan.rotation.x=-Math.PI/2;group.add(scan);
  const liftStructure=new THREE.Group();group.add(liftStructure);
  for(const x of [39,45])for(const z of [-2.2,2.2]){
    box(liftStructure,[.23,6.0,.24],[x,3,z],m.white);
    beam(liftStructure,[x,1,z+.05],[x,5.7,z+.05],.07,m.steel);
    box(liftStructure,[.5,.18,.55],[x,.16,z],m.darkSteel);
  }
  for(const z of [-2.2,2.2])beam(liftStructure,[39,6,z],[45,6,z],.19,m.darkSteel);
  const liftPlatform=new THREE.Group();group.add(liftPlatform);
  box(liftPlatform,[6.3,.17,3.7],[42,-.06,0],m.blue);
  for(const z of [-1.08,1.08])box(liftPlatform,[6.1,.12,.13],[42,.07,z],m.steel);
  for(const z of [-1.9,1.9]){beam(liftPlatform,[39,1,z],[45,1,z],.04,m.yellow);for(const x of [39,42,45])beam(liftPlatform,[x,.07,z],[x,1,z],.04,m.yellow)}
  mergeStatic(liftPlatform);mergeStatic(liftStructure);pick(liftStructure,7,'四柱升降出线台',STATIONS[7]!.description);
  const bridge=new THREE.Group();group.add(bridge);
  for(const z of [-1.15,1.15])box(bridge,[64,.25,.2],[74,4.77,z],m.darkSteel);
  for(let x=45;x<=106;x+=9){for(const z of [-1.3,1.3])box(bridge,[.23,4.7,.23],[x,2.35,z],m.white);box(bridge,[.15,.15,2.65],[x,4.68,0],m.darkSteel)}
  const bridgeRollers:THREE.Matrix4[]=[];const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  for(let x=42;x<106;x+=.46)bridgeRollers.push(placement([x,4.9,0],[1,1,1],rotation));instances(bridge,new THREE.CylinderGeometry(.08,.08,2.05,10),m.steel,bridgeRollers);
  for(const z of [-1.75,1.75]){beam(bridge,[45,5.95,z],[106,5.95,z],.05,m.yellow);for(let x=45;x<106;x+=3)beam(bridge,[x,4.8,z],[x,5.95,z],.04,m.yellow)}
  label(bridge,'高位输送桥  →  涂装','52 m HIGH-LEVEL TRANSFER TO PAINT',[70,6.8,2],10,.8);mergeStatic(bridge);pick(bridge,7,'高位输送桥','厂房出口后的 52 米高位桥，接续 12 米升降交接段。','HIGH-BRIDGE');
  const carriers=STATION_POSITIONS.map((_,index)=>{const model=carrier(group,m);const record=pick(model.group,index,'白车身与滑橇',STATIONS[index]!.description,`CAR-${index}`);return {...model,record}});
  const outbound=Array.from({length:2},()=>{const model=carrier(group,m);model.group.visible=false;const record=pick(model.group,7,'高位转运白车身',STATIONS[7]!.description,'OUTBOUND');return {...model,record}});
  for(const z of [-6.1,6.1]){railing(group,-43,z,9,m);railing(group,-18,z,9,m);railing(group,-6,z,9,m);railing(group,30,z,9,m)}
  const identify=(model:typeof carriers[number],carId:string,skidId:string)=>{
    model.record.id=carId;model.group.userData={...model.group.userData,id:carId,carId,skidId};
    model.group.traverse(child=>{child.userData.id=carId;child.userData.carId=carId;child.userData.skidId=skidId});
  };
  let lastPoses:RobotPose[]=ROBOT_CONFIGS.map(config=>getRobotState(0,config.index));
  let lastCamera:THREE.Camera|undefined;
  let wallSeconds=0;
  let lastQuality:LODQuality='balanced';
  const lodCounts:Record<string,number>={proxy:0,low:0,medium:0,original:0,robotOriginalResident:0};
  const robotCenters=ROBOT_CONFIGS.map(config=>new THREE.Vector3(...config.base).add(new THREE.Vector3(0,ROBOT_SHOULDER_HEIGHT,0)));
  const cameraPosition=new THREE.Vector3(64,48,82),bodyCenter=new THREE.Vector3();
  const viewFrustum=new THREE.Frustum(),viewMatrix=new THREE.Matrix4(),viewSphere=new THREE.Sphere();
  const robotVisible=robots.map(()=>true),bodyVisible=[...carriers,...outbound].map(model=>model.group.visible);
  const levels:LODLevel[]=['proxy','low','medium','original'];
  const inView=(center:THREE.Vector3,radius:number)=>!lastCamera||viewFrustum.intersectsSphere(viewSphere.set(center,radius));
  const countLODs=()=>{
    for(const level of levels){lodCounts[level]=0;lodCounts[`robots_${level}`]=0;lodCounts[`bodies_${level}`]=0}
    robots.forEach((robot,index)=>{if(robotVisible[index]){lodCounts[robot.level]++;lodCounts[`robots_${robot.level}`]++}});
    [...carriers,...outbound].forEach((model,index)=>{if(model.group.visible&&bodyVisible[index]){lodCounts[model.body.level]++;lodCounts[`bodies_${model.body.level}`]++}});
    // Every non-selected original is evicted before allocation, so resident originals equal active originals.
    lodCounts.robotOriginalResident=robots.filter(robot=>robot.level==='original').length;
  };
  const maintain=(now:number)=>{
    if(Number.isFinite(now))wallSeconds=Math.max(wallSeconds,now);
    robots.forEach(robot=>robot.maintain(wallSeconds));
    [...carriers,...outbound].forEach(model=>model.body.maintain(wallSeconds));
  };
  const actualTCPs=ROBOT_CONFIGS.map(()=>new THREE.Vector3());
  return {shop:'welding',group,roof,stations:STATIONS,pickables,lodCounts,maintain,dispose:()=>{
    robots.forEach(robot=>robot.dispose());
    [...carriers,...outbound].forEach(model=>model.body.dispose());
  },camera:{position:[64,48,82],target:[2,1.8,0]},debug:()=>{
    group.updateWorldMatrix(true,true);
    const robotContacts=robots.map((robot,index)=>{
      const pose=lastPoses[index]!,config=ROBOT_CONFIGS[index]!,actual=robot.tcp.getWorldPosition(new THREE.Vector3()),planned=new THREE.Vector3(...pose.toolPoint);
      const electrodeMidpoint=robot.electrodeTips.length===2?robot.electrodeTips[0]!.getWorldPosition(new THREE.Vector3()).add(robot.electrodeTips[1]!.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5):actual;
      return {index,station:config.station,process:config.process,actualTCP:actual.toArray(),plannedTCP:planned.toArray(),contactError:actual.distanceTo(planned),electrodeError:electrodeMidpoint.distanceTo(actual),targetError:actual.distanceTo(new THREE.Vector3(...pose.contactPoint)),active:pose.welding||pose.riveting||pose.laser,carrying:pose.carrying,cargoPart:pose.cargoPart};
    });
    const robotLOD=robots.map((robot,index)=>({index,visible:robotVisible[index],...robot.lodStats}));
    const bodyLOD=[...carriers,...outbound].map((model,index)=>({index,id:model.record.id,visible:model.group.visible&&bodyVisible[index],...model.body.lodStats}));
    const residentOriginalRobots=robotLOD.filter(robot=>robot.resident.some(variant=>variant.level==='original')).length;
    return {robots:robots.length,robotContacts,maxContactError:Math.max(...robotContacts.map(contact=>contact.contactError)),sparks:sparks.debug(),lod:{quality:lastQuality,counts:{...lodCounts},residentOriginalRobots,originalRobotLimit:3,robotLOD,bodyLOD}};
  },update:(time,exploded,selected,camera,quality)=>{
    const state=getWeldingState(time);
    lastQuality=quality==='fine'||quality==='smooth'?quality:'balanced';
    const now=typeof performance==='undefined'?wallSeconds:performance.now()/1000;
    if(Number.isFinite(now))wallSeconds=Math.max(wallSeconds,now);
    if(camera){lastCamera=camera;camera.updateMatrixWorld();camera.getWorldPosition(cameraPosition);viewFrustum.setFromProjectionMatrix(viewMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse))}
    const robotDistances=robotCenters.map((center,index)=>{robotVisible[index]=inView(center,3.2);return robotVisible[index]?cameraPosition.distanceTo(center):Infinity});
    const wanted=robots.map((robot,index)=>selectLOD(robot.level,robotDistances[index]!,lastQuality));
    const budgeted=applyOriginalBudget(wanted,robotDistances,lastQuality);
    robots.forEach((robot,index)=>{if(budgeted[index]!=='original')robot.releaseOriginal()});
    robots.forEach((robot,index)=>robot.setLOD(budgeted[index]!,wallSeconds));
    const setBodyLOD=(model:typeof carriers[number],index:number)=>{
      bodyCenter.copy(model.group.position);bodyCenter.y+=.85;
      bodyVisible[index]=model.group.visible&&inView(bodyCenter,3.6);
      const distance=bodyVisible[index]?cameraPosition.distanceTo(bodyCenter):Infinity;
      model.body.setLOD(selectLOD(model.body.level,distance,lastQuality),wallSeconds);
    };
    carriers.forEach((model,index)=>{const station=state.stations[index]!;model.group.visible=station.occupied;model.group.position.set(station.carX,station.skidY,0);setBodyLOD(model,index);model.body.update(station.assembly);identify(model,station.carId,station.skidId);
      for(const [partIndex,part] of Object.values(model.body.parts).entries()){if(exploded&&selected===station.carId)part.position.y+=(partIndex+1)*.3}
    });
    outbound.forEach((model,index)=>{const item=state.outbound[index];model.group.visible=!!item&&item.carX<110;if(item){model.group.position.set(item.carX,item.skidY,0);setBodyLOD(model,carriers.length+index);model.body.update(item.assembly as BodyAssembly);identify(model,item.carId,item.skidId)}else setBodyLOD(model,carriers.length+index)});
    lastPoses=ROBOT_CONFIGS.map(config=>getRobotState(time,config.index));
    robots.forEach((robot,index)=>{robot.apply(lastPoses[index]!);if(exploded&&selected===`ROBOT-${String(index+1).padStart(2,'0')}`){robot.joints[1]!.position.x-=.4;robot.joints[2]!.position.x+=.6;robot.joints[3]!.position.x+=.6;robot.joints[4]!.position.x+=.28;robot.joints[5]!.position.x+=.28}});
    fixtureModels.forEach((model,index)=>{const clamp=state.stations[index]!.clamp;model.gates.forEach((gate,side)=>{gate.position.z=(side===0?-1:1)*(2.25-1.15*clamp);gate.position.x=STATION_POSITIONS[index]!+(exploded&&selected===`${STATIONS[index]!.id}-FIX-${side}`?(side===0?-2:2):0)});model.jaws.forEach(jaw=>jaw.rotation.x=.7*(1-clamp))});
    liftPlatform.position.y=state.lift.height;
    scanner.position.x=-2.2+4.4*state.stations[6]!.measurement;scan.visible=state.stations[6]!.working;scan.position.set(state.stations[6]!.carX,1.37+1.4*Math.sin(state.stations[6]!.measurement*Math.PI),0);
    group.updateWorldMatrix(true,true);robots.forEach((robot,index)=>robot.tcp.getWorldPosition(actualTCPs[index]!));
    const sources:SparkSource[]=[];
    let laserCount=0,activeLaserCount=0;
    lastPoses.forEach((pose,index)=>{
      const point=actualTCPs[index]!,config=ROBOT_CONFIGS[index]!;
      if(pose.welding&&!(exploded&&selected===`ROBOT-${String(index+1).padStart(2,'0')}`))sources.push({position:point.toArray() as [number,number,number],age:pose.sparkAge,seed:index,side:config.side});
      if(config.process==='laser'){
        const trail=laserTrails[laserCount]!;trail.visible=pose.laser;
        if(pose.laser){laserTrace.setMatrixAt(activeLaserCount++,placement(point.toArray() as [number,number,number]));const positions=trail.geometry.attributes.position!;for(let vertex=0;vertex<32;vertex++){const previous=getRobotState(Math.max(time-(31-vertex)/31*1.3,time-state.cycleTime+26),index).toolPoint;positions.setXYZ(vertex,...previous)}positions.needsUpdate=true;trail.geometry.computeBoundingSphere()}
        laserCount++;
      }
    });
    laserTrace.visible=activeLaserCount>0;laserTrace.count=activeLaserCount;laserTrace.instanceMatrix.needsUpdate=true;
    if(lastCamera)sparks.update(time,lastCamera,sources);
    countLODs();
  }};
}
