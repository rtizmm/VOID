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

test('zero-gravity and gravity clamping boundaries',()=>{
 const zero=gravityScenario(0);
 assert.equal(zero.percent,0);
 assert.equal(zero.acceleration,0);
 assert.equal(zero.forcePerKg,0);
 assert.equal(zero.fallTenMeters,null);
 assert.equal(zero.level,'AĞIRLIKSIZLIK');
 for(const bad of [-100,-0.01,NaN,undefined]){
  const g=gravityScenario(bad);
  assert.equal(g.percent,0);
  assert.equal(g.acceleration,0);
  assert.equal(g.fallTenMeters,null);
  assert.equal(g.level,'AĞIRLIKSIZLIK');
 }
 assert.equal(gravityScenario(50).level,'DÜŞÜK YERÇEKİMİ');
 assert.equal(gravityScenario(100).level,'NORMAL');
 assert.equal(gravityScenario(200).level,'YÜKSEK YERÇEKİMİ');
 assert.equal(gravityScenario(201).level,'AŞIRI YERÇEKİMİ');
 assert.equal(gravityScenario(1500).percent,700);
 const infG=gravityScenario(Infinity);
 assert.equal(infG.percent,700);
 assert.ok(Number.isFinite(infG.fallTenMeters));
});

test('extreme energy boundaries and fragmentation threshold',()=>{
 for(const e of [0,-1,-1e35,NaN,Infinity,-Infinity]){
  const r=sandboxImpact(e,8.5e9,1,0);
  assert.equal(r.damage,0);
  assert.equal(r.fraction,0);
  assert.equal(r.lost,0);
  assert.equal(r.survivors,8.5e9);
  assert.equal(r.fragment,false);
  assert.equal(r.level,'Denge');
 }
 const tiny=sandboxImpact(1,8.5e9,1,0);
 assert.equal(tiny.damage,0.03);
 assert.equal(tiny.fragment,false);
 assert.equal(tiny.level,'Yerel çarpışma');
 const below=sandboxImpact(2.23e32,8.5e9,1,100);
 assert.equal(below.fragment,false);
 assert.equal(below.level,'Küresel erime');
 assert.ok(below.survivors>0);
 const atThreshold=sandboxImpact(2.24e32,8.5e9,0.1,100);
 assert.equal(atThreshold.fragment,true);
 assert.equal(atThreshold.fraction,1);
 assert.equal(atThreshold.survivors,0);
 assert.equal(atThreshold.lost,8.5e9);
 assert.equal(atThreshold.level,'Gezegen parçalanması');
 const ultra=sandboxImpact(1e50,8.5e9,1,0);
 assert.equal(ultra.fragment,true);
 assert.equal(ultra.damage,1);
 assert.equal(ultra.fraction,1);
 assert.equal(ultra.survivors,0);
 assert.ok(Number.isFinite(ultra.damage) && Number.isFinite(ultra.fraction));
 assert.equal(sandboxImpact(1e17,8.5e9,1,0).level,'Bölgesel yıkım');
 assert.equal(sandboxImpact(1e20,8.5e9,1,0).level,'Kıtasal etki');
 assert.equal(sandboxImpact(1e23,8.5e9,1,0).level,'Küresel yıkım');
 assert.equal(sandboxImpact(1e29,8.5e9,1,0).level,'Küresel erime');
});

test('shelter, exposure, and population clamping boundaries',()=>{
 const base=sandboxImpact(1e20,8.5e9,1,0);
 const fullShelter=sandboxImpact(1e20,8.5e9,1,100);
 const overShelter=sandboxImpact(1e20,8.5e9,1,250);
 const negShelter=sandboxImpact(1e20,8.5e9,1,-50);
 const nanShelter=sandboxImpact(1e20,8.5e9,1,NaN);
 const infShelter=sandboxImpact(1e20,8.5e9,1,Infinity);
 assert.ok(base.fraction>0);
 assert.ok(Math.abs(fullShelter.fraction-base.fraction*0.2)<1e-12);
 assert.ok(fullShelter.lost>0 && fullShelter.survivors<8.5e9);
 assert.equal(overShelter.fraction,fullShelter.fraction);
 assert.equal(overShelter.survivors,fullShelter.survivors);
 assert.equal(negShelter.fraction,base.fraction);
 assert.equal(negShelter.survivors,base.survivors);
 assert.equal(nanShelter.fraction,base.fraction);
 assert.equal(infShelter.fraction,base.fraction);
 assert.equal(sandboxImpact(1e20,8.5e9,-5,0).fraction,sandboxImpact(1e20,8.5e9,0.1,0).fraction);
 assert.equal(sandboxImpact(1e20,8.5e9,10,0).fraction,sandboxImpact(1e20,8.5e9,2,0).fraction);
 assert.equal(sandboxImpact(1e20,8.5e9,NaN,0).fraction,base.fraction);
 const negPop=sandboxImpact(1e20,-1e9,1,0);
 assert.equal(negPop.survivors,0);
 assert.equal(negPop.lost,0);
 const maxPop=sandboxImpact(1e20,99e9,1,0);
 assert.equal(maxPop.survivors+maxPop.lost,20e9);
 const nanPop=sandboxImpact(1e20,NaN,1,0);
 assert.equal(nanPop.survivors+nanPop.lost,8.5e9);
});

test('asteroid, relativistic, and sun scenario clamping boundaries',()=>{
 const minAst=asteroidScenario(-10,-5);
 assert.equal(minAst.diameter,1);
 assert.equal(minAst.speed,1);
 assert.equal(minAst.risk,'ATMOSFERDE PARÇALANMA OLASI');
 const maxAst=asteroidScenario(999999,500);
 assert.equal(maxAst.diameter,20000);
 assert.equal(maxAst.speed,70);
 assert.equal(maxAst.risk,'KÜRESEL ETKİ OLASI');
 const minRel=relativisticScenario(-50,0);
 assert.equal(minRel.mass,0);
 assert.equal(minRel.pct,1);
 assert.equal(minRel.joules,0);
 const maxRel=relativisticScenario(1,250);
 assert.equal(maxRel.pct,99.99);
 assert.ok(maxRel.velocity<LIGHT_SPEED && Number.isFinite(maxRel.joules));
 const negSun=sunScenario(-42);
 assert.equal(negSun.seconds,0);
 assert.equal(negSun.arrived,false);
 assert.equal(negSun.stage,'SİNYAL HENÜZ ULAŞMADI');
 assert.equal(sunScenario(700000).stage,'GEZEGENLER ARASI BOŞLUKTA');
});
