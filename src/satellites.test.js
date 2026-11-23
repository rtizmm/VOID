import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodies } from './data.js';
import {
  SATELLITE_SYSTEMS,
  SYSTEM_AXIAL_TILTS,
  computeLodScale,
  computeEclipseFactor,
  computePlanetshineIntensity
} from './satellites.js';

const bodyById = new Map(bodies.map(b => [b.id, b]));
const PLANET_IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

test('natural satellite rosters cover all 8 planets with expected counts and astronomy', () => {
  for (const id of PLANET_IDS) {
    assert.ok(Object.prototype.hasOwnProperty.call(SATELLITE_SYSTEMS, id), `missing roster for ${id}`);
    assert.ok(Array.isArray(SATELLITE_SYSTEMS[id]), `roster for ${id} must be an array`);
    assert.ok(bodyById.has(id), `planet ${id} missing from data.js`);
  }

  assert.equal(SATELLITE_SYSTEMS.mercury.length, 0);
  assert.equal(SATELLITE_SYSTEMS.venus.length, 0);

  assert.equal(SATELLITE_SYSTEMS.earth.length, 1);
  assert.equal(SATELLITE_SYSTEMS.earth[0].id, 'moon');
  assert.ok(SATELLITE_SYSTEMS.earth[0].speed > 0);
  assert.ok(SATELLITE_SYSTEMS.earth[0].inclination > 0);

  assert.equal(SATELLITE_SYSTEMS.mars.length, 2);
  const marsIds = SATELLITE_SYSTEMS.mars.map(m => m.id);
  assert.ok(marsIds.includes('phobos') && marsIds.includes('deimos'));
  const phobos = SATELLITE_SYSTEMS.mars.find(m => m.id === 'phobos');
  const deimos = SATELLITE_SYSTEMS.mars.find(m => m.id === 'deimos');
  assert.ok(phobos.orbitRadius < deimos.orbitRadius);
  assert.ok(phobos.speed > deimos.speed);
  assert.equal(phobos.irregular, true);

  assert.equal(SATELLITE_SYSTEMS.jupiter.length, 4);
  const jupIds = SATELLITE_SYSTEMS.jupiter.map(m => m.id);
  assert.deepEqual(jupIds, ['io', 'europa', 'ganymede', 'callisto']);
  const ganymede = SATELLITE_SYSTEMS.jupiter.find(m => m.id === 'ganymede');
  for (const m of SATELLITE_SYSTEMS.jupiter) {
    assert.ok(ganymede.baseRadius >= m.baseRadius, 'Ganymede should be Jupiter largest moon');
  }

  assert.ok(SATELLITE_SYSTEMS.saturn.length >= 3);
  const satIds = SATELLITE_SYSTEMS.saturn.map(m => m.id);
  assert.ok(satIds.includes('enceladus') && satIds.includes('titan'));
  const enceladus = SATELLITE_SYSTEMS.saturn.find(m => m.id === 'enceladus');
  const titan = SATELLITE_SYSTEMS.saturn.find(m => m.id === 'titan');
  assert.ok(enceladus.orbitRadius > 2.18, 'Enceladus must orbit outside Saturn outer ring');
  assert.ok(titan.atmosphere && titan.atmosphere.intensity > 0, 'Titan should define haze atmosphere');

  assert.ok(SATELLITE_SYSTEMS.uranus.length >= 3);
  assert.ok(SYSTEM_AXIAL_TILTS.uranus > 1.5, 'Uranus system must carry ~98 deg axialTilt');
  assert.ok(bodyById.get('uranus').axialTilt > 1.5, 'Uranus data entry must expose axialTilt');

  assert.ok(SATELLITE_SYSTEMS.neptune.length >= 1);
  const triton = SATELLITE_SYSTEMS.neptune.find(m => m.id === 'triton');
  assert.ok(triton, 'Neptune roster must include Triton');
  assert.ok(triton.speed < 0, 'Triton must orbit retrograde (speed < 0)');
  assert.equal(triton.retrograde, true);
});

test('all satellite definitions have valid unique IDs and physical orbital invariants', () => {
  const seenIds = new Set();
  for (const planetId of PLANET_IDS) {
    const roster = SATELLITE_SYSTEMS[planetId];
    for (const moon of roster) {
      assert.ok(typeof moon.id === 'string' && moon.id.length > 0);
      assert.ok(!seenIds.has(moon.id), `duplicate satellite id: ${moon.id}`);
      seenIds.add(moon.id);
      assert.ok(Number.isFinite(moon.baseRadius) && moon.baseRadius > 0);
      assert.ok(Number.isFinite(moon.orbitRadius) && moon.orbitRadius > 1.0);
      assert.ok(Number.isFinite(moon.speed) && moon.speed !== 0);
      assert.ok(Number.isFinite(moon.inclination) && moon.inclination >= 0);
      assert.ok(Number.isFinite(moon.startAngle));
      assert.ok(Number.isFinite(moon.albedo) && moon.albedo > 0 && moon.albedo <= 1);
    }
  }
});

test('computeLodScale preserves exact physical proportions at close range', () => {
  for (const planetId of PLANET_IDS) {
    const parentSize = bodyById.get(planetId).size;
    for (const moon of SATELLITE_SYSTEMS[planetId]) {
      for (const factor of [1.5, 3.0, 4.5]) {
        const scale = computeLodScale({
          baseRadius: moon.baseRadius,
          parentSize,
          cameraDistance: parentSize * factor
        });
        assert.equal(scale, 1, `${moon.id} should stay unscaled at ${factor}x parentSize`);
      }
    }
  }
});

test('computeLodScale applies far-range visibility floor on Jupiter, Mars, and Saturn moons', () => {
  const cases = [
    { planet: 'jupiter', moonId: 'europa', distance: 100 },
    { planet: 'jupiter', moonId: 'io', distance: 100 },
    { planet: 'mars', moonId: 'phobos', distance: 30 },
    { planet: 'mars', moonId: 'deimos', distance: 30 },
    { planet: 'saturn', moonId: 'enceladus', distance: 70 },
    { planet: 'saturn', moonId: 'rhea', distance: 80 }
  ];
  const minAngularRadius = 0.0055;
  for (const c of cases) {
    const parentSize = bodyById.get(c.planet).size;
    const moon = SATELLITE_SYSTEMS[c.planet].find(m => m.id === c.moonId);
    const scale = computeLodScale({
      baseRadius: moon.baseRadius,
      parentSize,
      cameraDistance: c.distance,
      minAngularRadius
    });
    assert.ok(scale > 1.2, `${c.moonId} should be boosted at distance ${c.distance}`);
    const apparentAngular = (moon.baseRadius * scale) / c.distance;
    assert.ok(
      apparentAngular >= minAngularRadius,
      `${c.moonId} apparent angular radius ${apparentAngular} fell below floor ${minAngularRadius}`
    );
  }
});

test('computeLodScale enforces strict finite bounds and monotonicity across edge inputs', () => {
  const badInputs = [
    {},
    { baseRadius: 0, parentSize: 2, cameraDistance: 50 },
    { baseRadius: -0.2, parentSize: 2, cameraDistance: 50 },
    { baseRadius: NaN, parentSize: 2, cameraDistance: 50 },
    { baseRadius: Infinity, parentSize: 2, cameraDistance: 50 },
    { baseRadius: 0.2, parentSize: 0, cameraDistance: 50 },
    { baseRadius: 0.2, parentSize: -3, cameraDistance: 50 },
    { baseRadius: 0.2, parentSize: NaN, cameraDistance: 50 },
    { baseRadius: 0.2, parentSize: 2, cameraDistance: 0 },
    { baseRadius: 0.2, parentSize: 2, cameraDistance: -10 },
    { baseRadius: 0.2, parentSize: 2, cameraDistance: NaN },
    { baseRadius: 0.2, parentSize: 2, cameraDistance: Infinity },
    { baseRadius: 0.2, parentSize: 2, cameraDistance: 1e9 },
    { baseRadius: 0.2, parentSize: 2, cameraDistance: 100, minAngularRadius: 0 },
    { baseRadius: 0.2, parentSize: 2, cameraDistance: 100, minAngularRadius: -0.01 },
    { baseRadius: 0.2, parentSize: 2, cameraDistance: 100, minAngularRadius: NaN }
  ];
  for (const args of badInputs) {
    const s = computeLodScale(args);
    assert.ok(Number.isFinite(s), `non-finite scale for ${JSON.stringify(args)}`);
    assert.ok(s >= 1 && s <= 4.5, `scale ${s} out of [1, 4.5] for ${JSON.stringify(args)}`);
  }

  let prev = 1;
  for (const d of [5, 10, 15, 22, 35, 60, 120, 300, 1000]) {
    const cur = computeLodScale({ baseRadius: 0.23, parentSize: 3.3, cameraDistance: d });
    assert.ok(cur >= prev, `scale decreased from ${prev} to ${cur} at distance ${d}`);
    prev = cur;
  }
});

test('computeLodScale strictly preserves relative moon size ordering at every distance', () => {
  for (const planetId of ['mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
    const parentSize = bodyById.get(planetId).size;
    const sorted = [...SATELLITE_SYSTEMS[planetId]].sort((a, b) => a.baseRadius - b.baseRadius);
    for (const distMult of [2, 5, 8, 15, 40, 150, Infinity]) {
      const cameraDistance = distMult === Infinity ? Infinity : parentSize * distMult;
      for (let i = 0; i < sorted.length - 1; i++) {
        const smaller = sorted[i];
        const larger = sorted[i + 1];
        if (smaller.baseRadius >= larger.baseRadius) continue;
        const rSmall = smaller.baseRadius * computeLodScale({ baseRadius: smaller.baseRadius, parentSize, cameraDistance });
        const rLarge = larger.baseRadius * computeLodScale({ baseRadius: larger.baseRadius, parentSize, cameraDistance });
        assert.ok(
          rSmall < rLarge,
          `${planetId}: ${smaller.id} (${rSmall}) should stay smaller than ${larger.id} (${rLarge}) at dist=${cameraDistance}`
        );
      }
    }
  }
});

test('computeEclipseFactor darkens behind planet umbra, transitions through penumbra, and stays sunlit in front', () => {
  const sunPos = { x: 0, y: 0, z: 0 };
  const planetPos = { x: 20, y: 0, z: 0 };
  const planetRadius = 1.0;

  const sunlitQuadrature = computeEclipseFactor({
    moonPos: { x: 20, y: 0, z: 3 },
    planetPos,
    planetRadius,
    sunPos
  });
  assert.ok(Math.abs(sunlitQuadrature - 1) < 1e-6);

  const inFront = computeEclipseFactor({
    moonPos: { x: 17, y: 0, z: 0 },
    planetPos,
    planetRadius,
    sunPos
  });
  assert.ok(Math.abs(inFront - 1) < 1e-6);

  const inUmbra = computeEclipseFactor({
    moonPos: { x: 23, y: 0, z: 0 },
    planetPos,
    planetRadius,
    sunPos
  });
  assert.ok(inUmbra >= 0 && inUmbra < 0.45, `umbra factor ${inUmbra} should darken below 0.45`);

  const inPenumbra = computeEclipseFactor({
    moonPos: { x: 23, y: 1.1, z: 0 },
    planetPos,
    planetRadius,
    sunPos
  });
  assert.ok(inPenumbra > inUmbra && inPenumbra < 1, `penumbra factor ${inPenumbra} should lie between umbra and 1`);

  const arrayForm = computeEclipseFactor({
    moonPos: [23, 0, 0],
    planetPos: [20, 0, 0],
    planetRadius,
    sunPos: [0, 0, 0]
  });
  assert.equal(arrayForm, inUmbra);
});

test('computeEclipseFactor remains strictly bounded in [0, 1] for degenerate inputs', () => {
  const edgeCases = [
    {},
    { moonPos: { x: 0, y: 0, z: 0 }, planetPos: { x: 0, y: 0, z: 0 }, planetRadius: 1, sunPos: { x: 0, y: 0, z: 0 } },
    { moonPos: { x: 23, y: 0, z: 0 }, planetPos: { x: 20, y: 0, z: 0 }, planetRadius: 0, sunPos: { x: 0, y: 0, z: 0 } },
    { moonPos: { x: 23, y: 0, z: 0 }, planetPos: { x: 20, y: 0, z: 0 }, planetRadius: -2, sunPos: { x: 0, y: 0, z: 0 } },
    { moonPos: { x: NaN, y: 0, z: 0 }, planetPos: { x: 20, y: 0, z: 0 }, planetRadius: 1, sunPos: { x: 0, y: 0, z: 0 } },
    { moonPos: { x: 23, y: 0, z: 0 }, planetPos: { x: 20, y: 0, z: 0 }, planetRadius: NaN, sunPos: { x: 0, y: 0, z: 0 } }
  ];
  for (const args of edgeCases) {
    const f = computeEclipseFactor(args);
    assert.ok(Number.isFinite(f) && f >= 0 && f <= 1, `eclipse factor ${f} out of [0, 1]`);
  }
});

test('computePlanetshineIntensity stays bounded [0, 1] and varies with phase angle and planet albedo', () => {
  const sunPos = { x: 0, y: 0, z: 0 };
  const planetPos = { x: 20, y: 0, z: 0 };

  const fullSunlitHost = computePlanetshineIntensity({
    moonPos: { x: 17, y: 0, z: 0 },
    planetPos,
    sunPos,
    planetAlbedo: 0.5
  });
  const quadratureHost = computePlanetshineIntensity({
    moonPos: { x: 20, y: 0, z: 3 },
    planetPos,
    sunPos,
    planetAlbedo: 0.5
  });
  const nightSideHost = computePlanetshineIntensity({
    moonPos: { x: 23, y: 0, z: 0 },
    planetPos,
    sunPos,
    planetAlbedo: 0.5
  });

  assert.ok(fullSunlitHost > quadratureHost && quadratureHost > nightSideHost);
  assert.ok(nightSideHost >= 0 && fullSunlitHost <= 1);

  const zeroAlbedo = computePlanetshineIntensity({
    moonPos: { x: 17, y: 0, z: 0 },
    planetPos,
    sunPos,
    planetAlbedo: 0
  });
  const lowAlbedo = computePlanetshineIntensity({
    moonPos: { x: 17, y: 0, z: 0 },
    planetPos,
    sunPos,
    planetAlbedo: 0.2
  });
  const highAlbedo = computePlanetshineIntensity({
    moonPos: { x: 17, y: 0, z: 0 },
    planetPos,
    sunPos,
    planetAlbedo: 0.8
  });

  assert.equal(zeroAlbedo, 0);
  assert.ok(lowAlbedo > zeroAlbedo && highAlbedo > lowAlbedo);
  assert.ok(highAlbedo <= 1);

  for (const badAlbedo of [-1, 0, 5, NaN, Infinity, -Infinity]) {
    const v = computePlanetshineIntensity({
      moonPos: { x: 17, y: 0, z: 0 },
      planetPos,
      sunPos,
      planetAlbedo: badAlbedo
    });
    assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, `planetshine ${v} out of [0, 1] for albedo=${badAlbedo}`);
  }

  const degenerate = computePlanetshineIntensity({
    moonPos: { x: 20, y: 0, z: 0 },
    planetPos: { x: 20, y: 0, z: 0 },
    sunPos: { x: 20, y: 0, z: 0 },
    planetAlbedo: 0.5
  });
  assert.ok(Number.isFinite(degenerate) && degenerate >= 0 && degenerate <= 1);
});
