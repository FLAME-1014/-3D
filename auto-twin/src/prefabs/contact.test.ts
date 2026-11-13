import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createBody} from './carBody';
import {createFactoryMaterials} from './materials';
import {ROBOT_CONFIGS,getRobotState,getWeldingState,WELD_WINDOWS} from '../welding/logic';
it('places every spot contact on visible body sheet rather than a door aperture',()=>{
 const body=createBody(createFactoryMaterials());body.update(getWeldingState(70).stations[3]!.assembly);
 for(const robot of ROBOT_CONFIGS.filter(r=>r.process==='spot')){
  body.group.position.set(getWeldingState(70).stations[robot.station]!.x,1,0);body.group.updateMatrixWorld(true);
  for(const t of WELD_WINDOWS){const p=new THREE.Vector3(...getRobotState(t+.2,robot.index).contactPoint);const ray=new THREE.Raycaster(p.clone().add(new THREE.Vector3(0,0,robot.side*.1)),new THREE.Vector3(0,0,-robot.side),0,.13);const hits=ray.intersectObject(body.parts.sides!,true);expect(hits.length,`robot${robot.index} window${t}`).toBeGreaterThan(0);expect(hits[0]!.point.distanceTo(p)).toBeLessThan(.025)}
 }
});
