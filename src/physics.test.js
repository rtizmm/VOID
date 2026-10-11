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
