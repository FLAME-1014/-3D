import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createRobot} from './robot';
import {createFactoryMaterials} from './materials';
import {ROBOT_CONFIGS,getRobotState,robotToolPoint,WELD_WINDOWS,type JointAngles} from '../welding/logic';
describe('rendered robot kinematics',()=>{
 it('keeps the physical electrode TCP at the planned coordinate for22 robots',()=>{const materials=createFactoryMaterials();for(const config of ROBOT_CONFIGS){const robot=createRobot(config,materials);for(const time of WELD_WINDOWS){const pose=getRobotState(time+.2,config.index);robot.apply(pose);robot.group.updateMatrixWorld(true);const actual=robot.tcp.getWorldPosition(new THREE.Vector3());expect(actual.distanceTo(new THREE.Vector3(...pose.toolPoint))).toBeLessThan(1e-6)}}});
 it('matches six pivot transforms for arbitrary joint orientations',()=>{const config=ROBOT_CONFIGS[0]!,robot=createRobot(config,createFactoryMaterials());const angles:JointAngles=[.43,.68,-1.4,.28,-.51,.92];robot.apply({...getRobotState(0,0),jointAngles:angles});robot.group.updateMatrixWorld(true);expect(robot.tcp.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...robotToolPoint(config,angles)))).toBeLessThan(1e-6)});
});
