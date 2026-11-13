import {describe,it,expect} from 'vitest';
import {MAX_PRODUCTION_SECONDS, positiveTime, ProductionClock} from './clock';
describe('production clock',()=>{
 it('pauses, seeks and scales safely',()=>{const c=new ProductionClock();c.seek(100);c.pause();c.advance(.1);expect(c.time).toBe(100);c.play();c.setSpeed(16);c.advance(99);expect(c.time).toBeCloseTo(101.6);c.advance(-2);c.advance(NaN);expect(c.time).toBeCloseTo(101.6);c.seek(-1);expect(c.time).toBe(0)});
 it('bounds huge finite seeks while preserving valid subsecond targets',()=>{
  const clock=new ProductionClock();
  for(const time of [MAX_PRODUCTION_SECONDS+1,1e20,Number.MAX_VALUE]){
   clock.seek(time);
   expect(clock.time).toBe(MAX_PRODUCTION_SECONDS);
   expect(positiveTime(time)).toBe(MAX_PRODUCTION_SECONDS);
  }
  for(const time of [0,34.2,MAX_PRODUCTION_SECONDS-.25,MAX_PRODUCTION_SECONDS]){
   clock.seek(time);
   expect(clock.time).toBe(time);
   expect(positiveTime(time)).toBe(time);
  }
 });
 it('ignores non-finite seek and frame inputs without poisoning the current clock',()=>{
  const clock=new ProductionClock();
  clock.seek(34.2);
  for(const invalid of [NaN,Infinity,-Infinity]){
   clock.seek(invalid);
   clock.advance(invalid);
   expect(clock.time).toBe(34.2);
   expect(positiveTime(invalid)).toBe(0);
  }
  expect(positiveTime(-Number.MAX_VALUE)).toBe(0);
 });
 it('saturates playback at the same bound as seek and resumes after seeking backward',()=>{
  const clock=new ProductionClock();
  clock.seek(MAX_PRODUCTION_SECONDS-.5);
  clock.setSpeed(16);
  expect(clock.advance(.1)).toBe(MAX_PRODUCTION_SECONDS);
  expect(clock.advance(.1)).toBe(MAX_PRODUCTION_SECONDS);
  clock.seek(34.2);
  expect(clock.advance(.1)).toBeCloseTo(35.8);
 });
});
