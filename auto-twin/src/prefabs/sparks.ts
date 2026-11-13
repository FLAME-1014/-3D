import * as THREE from 'three';
export const SPARK_CAPACITY=6000;
export const SPARKS_PER_CONTACT=320;
export interface SparkSource {position:[number,number,number];age:number;seed:number;side?:number}
function hash(n:number){let v=(n^0x85ebca6b)>>>0;v=Math.imul(v^(v>>>16),0x7feb352d);v=Math.imul(v^(v>>>15),0x846ca68b);return ((v^(v>>>16))>>>0)/4294967296}
/** Evaluated from the absolute burst age; no previous-frame particle state. */
export function sparkParticle(source:SparkSource,index:number){
 const k=source.seed*17041+index*13,r=hash(k),birth=r*r*r*.18,age=source.age-birth;
 if(!Number.isFinite(age)||age<0||source.age>=.8)return null;
 const az=hash(k+1)*Math.PI*2,speed=1.1+hash(k+2)*3.9;
 const vx=Math.cos(az)*speed,vy=-.2+hash(k+3)*1.8,vz=Math.sin(az)*speed+(source.side||1)*.7;
 const pos:[number,number,number]=[source.position[0]+vx*age,source.position[1]+vy*age-4.905*age*age,source.position[2]+vz*age];
 const life=.3+hash(k+4)*.35;if(age>life||pos[1]<=.04)return null;
 return {position:pos,velocity:[vx,vy-9.81*age,vz] as [number,number,number],fade:Math.max(0,1-age/life),width:.012+hash(k+5)*.02,length:.07+speed*.045};
}
const vertex=`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`;
const fragment=`varying vec2 vUv;void main(){float edge=clamp(1.0-abs(vUv.x-.5)*2.0,0.0,1.0);float tail=smoothstep(0.0,.2,vUv.y);float a=pow(edge,1.4)*tail;vec3 c=mix(vec3(1.7,.12,.018),vec3(4.8,3.65,1.35),pow(clamp(vUv.y,0.0,1.0),2.0));gl_FragColor=vec4(clamp(c,vec3(0.0),vec3(8.0)),a*.88);}`;
const arcFragment=`varying vec2 vUv;void main(){float d=length((vUv-.5)*2.0);float a=pow(clamp(1.0-d,0.0,1.0),2.0);gl_FragColor=vec4(vec3(5.0,3.6,1.0),a*.75);}`;
export class SparkPool {
 group=new THREE.Group();particles:THREE.InstancedMesh;arcs:THREE.InstancedMesh;lights:THREE.PointLight[]=[];
 matrix=new THREE.Matrix4();pos=new THREE.Vector3();scale=new THREE.Vector3();quat=new THREE.Quaternion();roll=new THREE.Quaternion();velocity=new THREE.Vector3();inverseCamera=new THREE.Quaternion();live=0;
 constructor(parent:THREE.Group){
  const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,transparent:true,blending:THREE.NormalBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  this.particles=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),material,SPARK_CAPACITY);this.particles.count=0;this.particles.frustumCulled=false;this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particles.name='固定容量焊接火花池';
  this.arcs=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:arcFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),16);this.arcs.count=0;this.arcs.frustumCulled=false;
  this.group.add(this.particles,this.arcs);parent.add(this.group);
  for(let i=0;i<16;i++){const l=new THREE.PointLight(0xffb23c,0,3.6,2);this.lights.push(l);this.group.add(l)}
 }
 update(time:number,camera:THREE.Camera,sources:SparkSource[]){
  let live=0,contacts=0;this.inverseCamera.copy(camera.quaternion).invert();
  for(const source of sources.slice(0,16)){
   if(source.age<0||source.age>=.8)continue;
   for(let i=0;i<SPARKS_PER_CONTACT&&live<SPARK_CAPACITY;i++){
    const p=sparkParticle(source,i);if(!p)continue;this.pos.set(...p.position);this.velocity.set(...p.velocity).applyQuaternion(this.inverseCamera);
    this.roll.setFromAxisAngle(new THREE.Vector3(0,0,1),-Math.atan2(this.velocity.x,this.velocity.y));this.quat.copy(camera.quaternion).multiply(this.roll);
    this.scale.set(p.width*p.fade,p.length*p.fade,1);this.matrix.compose(this.pos,this.quat,this.scale);this.particles.setMatrixAt(live++,this.matrix);
   }
   const flicker=.8+.2*Math.sin(time*157+source.seed*13),arcSize=(.14+.1*Math.exp(-source.age*7))*flicker;
   this.pos.set(...source.position);this.scale.setScalar(arcSize);this.matrix.compose(this.pos,camera.quaternion,this.scale);this.arcs.setMatrixAt(contacts,this.matrix);
   const light=this.lights[contacts]!;light.position.copy(this.pos);light.intensity=(source.age<.35?45:14)*flicker;contacts++;
  }
  for(let i=contacts;i<this.lights.length;i++)this.lights[i]!.intensity=0;
  this.particles.count=this.live=live;this.arcs.count=contacts;this.particles.instanceMatrix.needsUpdate=true;this.arcs.instanceMatrix.needsUpdate=true;
 }
 debug(){return {capacity:SPARK_CAPACITY,live:this.live,particleDrawCalls:this.live?1:0,emitterBudget:16,sparksPerContact:SPARKS_PER_CONTACT,normalBlending:true}}
}
