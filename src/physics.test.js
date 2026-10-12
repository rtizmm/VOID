import * as physics from './physics.js';
const sandboxImpact=(...args)=>physics.sandboxImpact?.(...args);
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gravityScenario,asteroidScenario,relativisticScenario,sunScenario,LIGHT_SPEED} from './physics.js';
test('yerçekimi sıfır ve yedi kat',()=>{
 assert.equal(gravityScenario(0).acceleration,0);
 assert.equal(gravityScenario(0).fallTenMeters,null);
 assert.equal(gravityScenario(700).acceleration,9.80665*7);
 assert.ok(Math.abs(gravityScenario(100).fallTenMeters-1.428)<.01);
});
test('asteroit enerjisi çapa göre kübik artar',()=>{
 const a=asteroidScenario(50,20),b=asteroidScenario(100,20);
 assert.ok(Math.abs(b.joules/a.joules-8)<1e-10);
 assert.equal(asteroidScenario(1500,70).risk,'KÜRESEL ETKİ OLASI');
});
test('ışığa yakın hız hesaplaması göreli',()=>{
 const r=relativisticScenario(.001,99);
 assert.ok(r.gamma>7);
 assert.ok(r.velocity<LIGHT_SPEED);
 assert.ok(r.joules>0);
});
test('güneş gecikmesi',()=>{
 assert.equal(sunScenario(499).arrived,false);
 assert.equal(sunScenario(500).arrived,true);
});

test('sandbox supports large asteroids and subluminal 99.99 percent',()=>{
 assert.equal(asteroidScenario(20000,20).diameter,20000);
 assert.equal(relativisticScenario(1,99.99).pct,99.99);
});
test('fictional population model stays bounded and conserves people',()=>{
 assert.equal(typeof physics.sandboxImpact,'function');
 for(const pop of [0,8.5e9,20e9])for(const energy of [0,1e12,1e20,1e30,1e34]){
  const s=sandboxImpact(energy,pop,1,0);
  assert.ok(Number.isFinite(s.survivors));
  assert.ok(s.survivors>=0 && s.survivors<=pop);
  assert.equal(s.survivors+s.lost,pop);
 }
});
test('needle has local persistent damage; extreme energy can fragment Earth',()=>{
 assert.equal(typeof physics.sandboxImpact,'function');
 const needle=sandboxImpact(relativisticScenario(.001,99).joules,8.5e9,1,0);
 assert.ok(needle.damage>0);
 assert.equal(needle.fragment,false);
 assert.equal(sandboxImpact(1e34,8.5e9,1,0).fragment,true);
});
test('increased energy or exposure cannot improve survival; shelters can',()=>{
 assert.equal(typeof physics.sandboxImpact,'function');
 const low=sandboxImpact(1e19,8.5e9,.3,0);
 assert.ok(sandboxImpact(1e22,8.5e9,.3,0).survivors<=low.survivors);
 assert.ok(sandboxImpact(1e19,8.5e9,1,0).survivors<=low.survivors);
 assert.ok(sandboxImpact(1e19,8.5e9,.3,80).survivors>=low.survivors);
});
