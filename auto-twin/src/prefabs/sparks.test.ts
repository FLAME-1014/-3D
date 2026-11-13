import {describe,it,expect} from 'vitest';
import {sparkParticle,SPARK_CAPACITY,SPARKS_PER_CONTACT} from './sparks';
describe('deterministic sparks',()=>{
 it('reserves enough capacity for16 simultaneous contacts',()=>expect(16*SPARKS_PER_CONTACT).toBeLessThanOrEqual(SPARK_CAPACITY));
 it('repeats trajectories and clips particles at the floor and window boundary',()=>{const s={position:[0,1.9,0] as [number,number,number],age:.2,seed:6};for(let i=0;i<320;i++){const p=sparkParticle(s,i);expect(sparkParticle(s,i)).toEqual(p);if(p){expect(p.position.every(Number.isFinite)).toBe(true);expect(p.position[1]).toBeGreaterThan(.04)}}expect(sparkParticle({...s,age:.8},5)).toBeNull();expect(sparkParticle({...s,age:NaN},5)).toBeNull()});
});
