import * as THREE from 'three';
import type {World} from './types';
export function baseline():World{const group=new THREE.Group();const mesh=new THREE.Mesh(new THREE.BoxGeometry(100,.2,60),new THREE.MeshStandardMaterial({color:'#b8c2bd',roughness:.85}));mesh.receiveShadow=true;group.add(mesh);const hall=new THREE.Mesh(new THREE.BoxGeometry(48,7,24),new THREE.MeshStandardMaterial({color:'#f0f1ec',metalness:.15,roughness:.55}));hall.position.y=3.6;hall.castShadow=true;group.add(hall);return {shop:'park',group,stations:[],pickables:[],camera:{position:[68,64,85],target:[0,0,0]},update:()=>{}}}
