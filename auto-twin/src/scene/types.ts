import type * as THREE from 'three';
import type {Shop} from '../app/store';
export interface Station {id:string;name:string;en:string;x:number;description:string;robots?:number}
export interface Pickable {object:THREE.Object3D;id:string;name:string;station:number;description?:string}
export interface World {group:THREE.Group;roof?:THREE.Group;stations:Station[];pickables:Pickable[];update:(time:number,exploded:boolean,selected:string|null,camera?:THREE.Camera,quality?:string)=>void;camera:{position:[number,number,number];target:[number,number,number]};dispose?:()=>void;maintain?:(wallSeconds:number)=>void;shop:Shop;lodCounts?:Record<string,number>;debug?:()=>Record<string,unknown>}
