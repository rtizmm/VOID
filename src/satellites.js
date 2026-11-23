import * as THREE from 'three';

/**
 * Natural satellite rosters for all 8 planets in VOID.
 * - `baseRadius`: stylized physical radius in world units (strictly ordered by real astronomical diameter)
 * - `orbitRadius`: orbital radius in multiples of host planet `size` (clear of surface and Saturn's rings)
 * - `speed`: angular velocity in rad/s (negative = retrograde orbit, e.g. Neptune's Triton)
 * - `inclination`: orbital inclination in radians relative to host satellite system plane
 * - `ascNode`: longitude of ascending node in radians
 * - `startAngle`: initial orbital phase in radians (staggered to avoid unnatural alignment)
 */
export const SYSTEM_AXIAL_TILTS = Object.freeze({
  mercury: 0.001,
  venus: 0.046,
  earth: 0, // Earth's Moon orbits near the ecliptic (~0.09 rad inclination), not Earth's 23.4 deg equator
  mars: 0.439,
  jupiter: 0.054,
  saturn: 0.34,
  uranus: 1.65, // ~95-98 deg sideways axial tilt (vertical equatorial moon plane)
  neptune: 0.494
});

export const SATELLITE_SYSTEMS = Object.freeze({
  mercury: Object.freeze([]),
  venus: Object.freeze([]),
  earth: Object.freeze([
    Object.freeze({
      id: 'moon',
      name: 'Ay',
      baseRadius: 0.27,
      orbitRadius: 2.75,
      speed: 0.14,
      inclination: 0.09,
      ascNode: 0.35,
      startAngle: 0.65,
      color: 0xb4b0a6,
      albedo: 0.78,
      orbitOpacity: 0.17,
      eclipseTint: Object.freeze([1.18, 0.70, 0.50]),
      textureType: 'lunar',
      irregular: false,
      retrograde: false
    })
  ]),
  mars: Object.freeze([
    Object.freeze({
      id: 'phobos',
      name: 'Phobos',
      baseRadius: 0.078,
      orbitRadius: 1.85,
      speed: 0.92,
      inclination: 0.019,
      ascNode: 0.8,
      startAngle: 1.1,
      color: 0x8d7b6f,
      albedo: 0.68,
      orbitOpacity: 0.12,
      textureType: 'rocky',
      irregular: true,
      shapeScale: Object.freeze([1.24, 0.92, 0.84]),
      retrograde: false
    }),
    Object.freeze({
      id: 'deimos',
      name: 'Deimos',
      baseRadius: 0.056,
      orbitRadius: 2.95,
      speed: 0.36,
      inclination: 0.032,
      ascNode: 2.4,
      startAngle: 4.15,
      color: 0x9b8b7c,
      albedo: 0.70,
      orbitOpacity: 0.12,
      textureType: 'rocky',
      irregular: true,
      shapeScale: Object.freeze([1.18, 0.94, 0.88]),
      retrograde: false
    })
  ]),
  jupiter: Object.freeze([
    Object.freeze({
      id: 'io',
      name: 'Io',
      baseRadius: 0.27,
      orbitRadius: 1.56,
      speed: 0.44, // 4:2:1 Laplace resonance with Europa & Ganymede
      inclination: 0.015,
      ascNode: 0.2,
      startAngle: 0.72,
      color: 0xe6c85c,
      albedo: 0.84,
      orbitOpacity: 0.15,
      textureType: 'io',
      irregular: false,
      retrograde: false
    }),
    Object.freeze({
      id: 'europa',
      name: 'Europa',
      baseRadius: 0.23,
      orbitRadius: 1.98,
      speed: 0.22,
      inclination: 0.028,
      ascNode: 1.75,
      startAngle: 2.64,
      color: 0xd6e6f0,
      albedo: 0.88,
      orbitOpacity: 0.15,
      textureType: 'europa',
      irregular: false,
      retrograde: false
    }),
    Object.freeze({
      id: 'ganymede',
      name: 'Ganymede',
      baseRadius: 0.38,
      orbitRadius: 2.52,
      speed: 0.11,
      inclination: 0.018,
      ascNode: 3.4,
      startAngle: 4.65,
      color: 0xb7a694,
      albedo: 0.80,
      orbitOpacity: 0.15,
      textureType: 'ganymede',
      irregular: false,
      retrograde: false
    }),
    Object.freeze({
      id: 'callisto',
      name: 'Callisto',
      baseRadius: 0.34,
      orbitRadius: 3.18,
      speed: 0.052,
      inclination: 0.035,
      ascNode: 5.1,
      startAngle: 1.88,
      color: 0x7e7266,
      albedo: 0.72,
      orbitOpacity: 0.14,
      textureType: 'callisto',
      irregular: false,
      retrograde: false
    })
  ]),
  saturn: Object.freeze([
    Object.freeze({
      id: 'enceladus',
      name: 'Enceladus',
      baseRadius: 0.105,
      orbitRadius: 2.42, // Cleanly outside Saturn's outer ring edge (2.18)
      speed: 0.46,
      inclination: 0.012,
      ascNode: 0.45,
      startAngle: 0.55,
      color: 0xe2eef7,
      albedo: 0.90,
      orbitOpacity: 0.14,
      textureType: 'enceladus',
      irregular: false,
      retrograde: false
    }),
    Object.freeze({
      id: 'rhea',
      name: 'Rhea',
      baseRadius: 0.155,
      orbitRadius: 2.95,
      speed: 0.26,
      inclination: 0.022,
      ascNode: 2.15,
      startAngle: 3.72,
      color: 0xc5c2bc,
      albedo: 0.82,
      orbitOpacity: 0.14,
      textureType: 'icy',
      irregular: false,
      retrograde: false
    }),
    Object.freeze({
      id: 'titan',
      name: 'Titan',
      baseRadius: 0.37,
      orbitRadius: 3.65,
      speed: 0.14,
      inclination: 0.025,
      ascNode: 3.9,
      startAngle: 1.92,
      color: 0xdfa658,
      albedo: 0.82,
      orbitOpacity: 0.16,
      textureType: 'titan',
      atmosphere: Object.freeze({ color: 0xe8ac5c, intensity: 0.21, scale: 1.18 }),
      irregular: false,
      retrograde: false
    }),
    Object.freeze({
      id: 'iapetus',
      name: 'Iapetus',
      baseRadius: 0.145,
      orbitRadius: 4.55,
      speed: 0.068,
      inclination: 0.27, // Iconic ~15.5 deg inclined two-tone outer moon
      ascNode: 5.2,
      startAngle: 5.15,
      color: 0xbcb6aa,
      albedo: 0.78,
      orbitOpacity: 0.13,
      textureType: 'iapetus',
      twoTone: true,
      irregular: false,
      retrograde: false
    })
  ]),
  uranus: Object.freeze([
    Object.freeze({
      id: 'miranda',
      name: 'Miranda',
      baseRadius: 0.098,
      orbitRadius: 1.72,
      speed: 0.48,
      inclination: 0.074,
      ascNode: 0.9,
      startAngle: 0.82,
      color: 0xb9c2c9,
      albedo: 0.79,
      orbitOpacity: 0.14,
      textureType: 'icy',
      irregular: false,
      retrograde: false
    }),
    Object.freeze({
      id: 'titania',
      name: 'Titania',
      baseRadius: 0.165,
      orbitRadius: 2.55,
      speed: 0.21,
      inclination: 0.018,
      ascNode: 2.7,
      startAngle: 2.95,
      color: 0xc2b9b2,
      albedo: 0.78,
      orbitOpacity: 0.15,
      textureType: 'icy',
      irregular: false,
      retrograde: false
    }),
    Object.freeze({
      id: 'oberon',
      name: 'Oberon',
      baseRadius: 0.150,
      orbitRadius: 3.30,
      speed: 0.13,
      inclination: 0.024,
      ascNode: 4.4,
      startAngle: 5.1,
      color: 0xa69c98,
      albedo: 0.75,
      orbitOpacity: 0.14,
      textureType: 'callisto',
      irregular: false,
      retrograde: false
    })
  ]),
  neptune: Object.freeze([
    Object.freeze({
      id: 'proteus',
      name: 'Proteus',
      baseRadius: 0.090,
      orbitRadius: 1.82,
      speed: 0.45,
      inclination: 0.016,
      ascNode: 1.15,
      startAngle: 1.4,
      color: 0x7b8089,
      albedo: 0.68,
      orbitOpacity: 0.13,
      textureType: 'rocky',
      irregular: true,
      shapeScale: Object.freeze([1.12, 0.96, 0.92]),
      retrograde: false
    }),
    Object.freeze({
      id: 'triton',
      name: 'Triton',
      baseRadius: 0.22,
      orbitRadius: 2.92,
      speed: -0.19, // Retrograde orbit!
      inclination: 0.40,
      ascNode: 3.65,
      startAngle: 4.25,
      color: 0xd9c8c2,
      albedo: 0.85,
      orbitOpacity: 0.16,
      textureType: 'triton',
      irregular: false,
      retrograde: true
    })
  ])
});

// Pure math helpers (zero DOM / WebGL side effects)

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  if (edge1 <= edge0) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function readVec3(v, fx = 0, fy = 0, fz = 0) {
  if (!v) return [fx, fy, fz];
  if (Array.isArray(v)) {
    const x = Number(v[0]), y = Number(v[1]), z = Number(v[2]);
    return [
      Number.isFinite(x) ? x : fx,
      Number.isFinite(y) ? y : fy,
      Number.isFinite(z) ? z : fz
    ];
  }
  const x = Number(v.x), y = Number(v.y), z = Number(v.z);
  return [
    Number.isFinite(x) ? x : fx,
    Number.isFinite(y) ? y : fy,
    Number.isFinite(z) ? z : fz
  ];
}

/**
 * Computes a smooth, hierarchy-preserving LOD scale multiplier (>= 1.0) for a moon.
 * - Up close (`cameraDistance <= parentSize * 4.5`): returns exact 1.0 (true stylized ratios).
 * - At medium/far distance: smoothly lifts apparent angular size above `minAngularRadius`
 *   while strictly preserving relative size ordering (`r1 < r2 => r1 * s1 < r2 * s2`)
 *   and capping cleanly below host planet proportions.
 */
export function computeLodScale({
  baseRadius,
  parentSize,
  cameraDistance,
  minAngularRadius = 0.0055
} = {}) {
  const r = Number(baseRadius);
  if (!Number.isFinite(r) || r <= 0) return 1;

  const minAng = Number(minAngularRadius);
  if (!Number.isFinite(minAng) || minAng <= 0) return 1;

  const pRaw = Number(parentSize);
  const p = Number.isFinite(pRaw) && pRaw > 0 ? pRaw : Math.max(r * 4, 1);

  const d = Number(cameraDistance);
  if (Number.isNaN(d) || d <= 0) return 1;

  const closeThreshold = p * 4.5;
  if (d <= closeThreshold) return 1;

  const ramp = d === Infinity ? 1 : smoothstep(closeThreshold, p * 11.0, d);
  const h = r / (r + p * 0.14);
  const hierFloor = d === Infinity ? Infinity : minAng * d * (1.0 + 0.35 * h);

  // Strictly increasing cap in `r` so relative moon size ordering holds even when saturated
  const maxScale = 4.5;
  const parentCap = Math.max(r, p * (0.24 + 0.30 * (r / (r + p * 0.16))));
  const capRadius = Math.min(r * maxScale, parentCap);

  const boostedRadius = Math.min(capRadius, Math.max(r, hierFloor));
  const finalRadius = r + ramp * (boostedRadius - r);
  const scale = finalRadius / r;

  return Number.isFinite(scale) && scale >= 1 ? scale : 1;
}

/**
 * Analytic sphere-ray shadow cone eclipse factor in [0.18, 1.0].
 * - Returns 1.0 when moon is sunlit (in front of planet or outside shadow cone).
 * - Smoothly transitions across penumbra into ~0.18 umbra when behind host planet relative to Sun.
 */
export function computeEclipseFactor({
  moonPos,
  planetPos,
  planetRadius,
  sunPos
} = {}) {
  const UMBRA_FLOOR = 0.18;
  const r = Number(planetRadius);
  if (!Number.isFinite(r) || r <= 0) return 1;

  const [mx, my, mz] = readVec3(moonPos, 0, 0, 0);
  const [px, py, pz] = readVec3(planetPos, 0, 0, 0);
  const [sx, sy, sz] = readVec3(sunPos, 0, 0, 0);

  // Ray from moon toward the Sun
  const msx = sx - mx;
  const msy = sy - my;
  const msz = sz - mz;
  const dSunSq = msx * msx + msy * msy + msz * msz;
  if (dSunSq <= 1e-12) return 1;
  const dSun = Math.sqrt(dSunSq);

  const ux = msx / dSun;
  const uy = msy / dSun;
  const uz = msz / dSun;

  // Vector from moon toward host planet center
  const mpx = px - mx;
  const mpy = py - my;
  const mpz = pz - mz;

  const proj = mpx * ux + mpy * uy + mpz * uz;
  // Planet is behind the moon (moon is in front of planet) or beyond the Sun
  if (proj <= 0 || proj >= dSun) return 1;

  const mpLenSq = mpx * mpx + mpy * mpy + mpz * mpz;
  const perpSq = Math.max(0, mpLenSq - proj * proj);
  const perp = Math.sqrt(perpSq);

  // Shadow cone radii (umbra strictly narrower than penumbra)
  const distRatio = Math.min(12, proj / r);
  const umbraR = r * Math.max(0.55, 0.90 - distRatio * 0.025);
  const penumbraR = r * (1.12 + distRatio * 0.035);

  if (perp >= penumbraR) return 1;
  if (perp <= umbraR) return UMBRA_FLOOR;

  const t = smoothstep(umbraR, penumbraR, perp);
  return clamp(UMBRA_FLOOR + (1 - UMBRA_FLOOR) * t, UMBRA_FLOOR, 1);
}

/**
 * Soft reflected light (planetshine) from the host planet's sunlit hemisphere in [0, 1].
 * - Strongest when the moon faces the planet's sunlit side (between planet and Sun).
 * - Scales proportionally with `planetAlbedo` and gently with orbital distance.
 */
export function computePlanetshineIntensity({
  moonPos,
  planetPos,
  sunPos,
  planetAlbedo = 0.35
} = {}) {
  const rawAlbedo = Number(planetAlbedo);
  const albedo = clamp(Number.isFinite(rawAlbedo) ? rawAlbedo : 0.35, 0, 1);
  if (albedo <= 0) return 0;

  const [mx, my, mz] = readVec3(moonPos, 0, 0, 0);
  const [px, py, pz] = readVec3(planetPos, 0, 0, 0);
  const [sx, sy, sz] = readVec3(sunPos, 0, 0, 0);

  const psx = sx - px;
  const psy = sy - py;
  const psz = sz - pz;
  const dSun = Math.hypot(psx, psy, psz);

  const pmx = mx - px;
  const pmy = my - py;
  const pmz = mz - pz;
  const dMoon = Math.hypot(pmx, pmy, pmz);

  if (dSun <= 1e-6 || dMoon <= 1e-6) {
    return clamp(albedo * 0.15, 0, 1);
  }

  const cosPhase = clamp((psx * pmx + psy * pmy + psz * pmz) / (dSun * dMoon), -1, 1);
  const phi = Math.acos(cosPhase);
  // Exact Lambertian sphere phase function: 1 at full sunlit planet, ~0.32 at quadrature, 0 on dark side
  const lambertPhase = (Math.sin(phi) + (Math.PI - phi) * cosPhase) / Math.PI;
  const phaseTerm = 0.08 + 0.92 * clamp(lambertPhase, 0, 1);
  const distFactor = 0.72 + 0.28 / (1 + dMoon * 0.08);

  // Kept naturally in ~0.10-0.22 for typical solar system planets (zero bloom glare)
  return clamp(albedo * phaseTerm * distFactor * 0.38, 0, 1);
}

// ---------- Internal procedural visuals (only invoked inside createSatelliteSystem) ----------

function makeRng(seedStr) {
  let s = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    s ^= seedStr.charCodeAt(i);
    s = Math.imul(s, 16777619) >>> 0;
  }
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function createMoonTexture(def, textureFactory) {
  if (typeof document === 'undefined') {
    return typeof textureFactory === 'function' ? textureFactory({ id: def.id, color: def.color }) : null;
  }
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext && c.getContext('2d');
  if (!ctx) {
    return typeof textureFactory === 'function' ? textureFactory({ id: def.id, color: def.color }) : null;
  }

  const base = new THREE.Color(def.color);
  ctx.fillStyle = '#' + base.getHexString();
  ctx.fillRect(0, 0, 256, 128);

  const rng = makeRng('void-moon-' + def.id);
  const type = def.textureType || 'icy';

  // Soft base regolith mottling
  for (let i = 0; i < 90; i++) {
    const x = rng() * 256, y = rng() * 128;
    const rx = 4 + rng() * 24, ry = 3 + rng() * 12;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,250,240,0.08)' : 'rgba(18,20,28,0.10)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  if (type === 'lunar') {
    // Dark basaltic maria patches
    for (let i = 0; i < 14; i++) {
      const x = rng() * 256, y = 24 + rng() * 80;
      const rx = 12 + rng() * 26, ry = 8 + rng() * 18;
      ctx.fillStyle = 'rgba(66,68,74,0.38)';
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // Crisp impact craters with bright rims
    for (let i = 0; i < 65; i++) {
      const x = rng() * 256, y = 8 + rng() * 112, r = 1.4 + rng() * 6.5;
      ctx.fillStyle = 'rgba(48,48,52,0.34)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,230,224,0.28)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  } else if (type === 'io') {
    // Volcanic sulfur yellows, oranges, pale frost & dark calderas
    const tones = ['rgba(238,214,82,0.35)', 'rgba(218,132,48,0.30)', 'rgba(246,242,196,0.24)'];
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
      ctx.beginPath();
      ctx.ellipse(rng() * 256, rng() * 128, 5 + rng() * 18, 4 + rng() * 12, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 16; i++) {
      const x = rng() * 256, y = 14 + rng() * 100, r = 1.5 + rng() * 4.2;
      ctx.strokeStyle = 'rgba(178,62,24,0.42)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(42,26,18,0.72)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'europa') {
    // Pale icy shell crisscrossed by ochre-rust tectonic lineae
    ctx.fillStyle = 'rgba(232,244,252,0.32)';
    ctx.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 42; i++) {
      const x0 = rng() * 256, y0 = rng() * 128;
      const ang = (rng() - 0.5) * Math.PI;
      const len = 28 + rng() * 90;
      ctx.strokeStyle = rng() > 0.35 ? 'rgba(154,104,76,0.42)' : 'rgba(120,168,196,0.32)';
      ctx.lineWidth = 0.7 + rng() * 1.1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(
        x0 + Math.cos(ang) * len * 0.5 + (rng() - 0.5) * 10,
        y0 + Math.sin(ang) * len * 0.5 + (rng() - 0.5) * 10,
        x0 + Math.cos(ang) * len,
        y0 + Math.sin(ang) * len
      );
      ctx.stroke();
    }
  } else if (type === 'ganymede') {
    // Dark ancient regions + lighter grooved icy bands + bright craters
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = rng() > 0.45 ? 'rgba(92,80,68,0.36)' : 'rgba(218,210,198,0.28)';
      ctx.beginPath();
      ctx.ellipse(rng() * 256, rng() * 128, 12 + rng() * 28, 7 + rng() * 18, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 36; i++) {
      const x = rng() * 256, y = 10 + rng() * 108, r = 1.2 + rng() * 4.0;
      ctx.fillStyle = 'rgba(235,232,226,0.38)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'callisto') {
    // Ancient dark crust speckled with bright icy impact pits
    ctx.fillStyle = 'rgba(42,36,32,0.28)';
    ctx.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 95; i++) {
      const x = rng() * 256, y = 6 + rng() * 116, r = 0.9 + rng() * 2.8;
      ctx.fillStyle = 'rgba(222,218,210,0.44)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'enceladus') {
    // Porcelain bright ice + subtle blue-cyan tiger stripes near south pole
    ctx.fillStyle = 'rgba(242,249,255,0.38)';
    ctx.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 10; i++) {
      const y = 92 + rng() * 26;
      const x = rng() * 220;
      ctx.strokeStyle = 'rgba(116,178,216,0.52)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 22 + rng() * 34, y + (rng() - 0.5) * 7);
      ctx.stroke();
    }
  } else if (type === 'titan') {
    // Golden banded methane haze clouds + subtle polar hood
    for (let i = 0; i < 36; i++) {
      const y = rng() * 128, h = 2 + rng() * 11;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(242,196,118,0.16)' : 'rgba(176,116,44,0.15)';
      ctx.fillRect(0, y, 256, h);
    }
    ctx.fillStyle = 'rgba(130,92,46,0.24)';
    ctx.fillRect(0, 0, 256, 14);
  } else if (type === 'iapetus') {
    // Iconic two-tone dichotomy: dark Cassini Regio on leading hemisphere, bright ice on trailing
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0.0, 'rgba(232,232,228,0.85)');
    grad.addColorStop(0.22, 'rgba(226,224,218,0.82)');
    grad.addColorStop(0.36, 'rgba(64,50,42,0.88)');
    grad.addColorStop(0.72, 'rgba(54,42,36,0.90)');
    grad.addColorStop(0.86, 'rgba(224,222,216,0.80)');
    grad.addColorStop(1.0, 'rgba(232,232,228,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);
    // Subtle craters over both hemispheres
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(20,16,14,0.18)';
      ctx.beginPath();
      ctx.arc(rng() * 256, 10 + rng() * 108, 1.5 + rng() * 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'triton') {
    // Pinkish nitrogen ice + cantaloupe dimples + dark geyser streaks
    for (let i = 0; i < 55; i++) {
      ctx.fillStyle = rng() > 0.45 ? 'rgba(238,208,204,0.22)' : 'rgba(176,154,158,0.20)';
      ctx.beginPath();
      ctx.arc(rng() * 256, rng() * 128, 3 + rng() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 16; i++) {
      const x = rng() * 256, y = 74 + rng() * 44;
      ctx.strokeStyle = 'rgba(68,58,64,0.34)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 12 + rng() * 14, y - 4 + rng() * 8);
      ctx.stroke();
    }
  } else {
    // Generic cratered icy or carbonaceous rocky moon (Phobos, Deimos, Rhea, Miranda, Titania, Proteus)
    for (let i = 0; i < 58; i++) {
      const x = rng() * 256, y = 8 + rng() * 112, r = 1.2 + rng() * 5.2;
      ctx.fillStyle = type === 'rocky' ? 'rgba(34,28,24,0.38)' : 'rgba(72,78,86,0.26)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = type === 'rocky' ? 'rgba(166,152,138,0.22)' : 'rgba(232,238,246,0.24)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function createHaloTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext && c.getContext('2d');
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.24, 'rgba(225,240,255,0.55)');
  grad.addColorStop(0.58, 'rgba(175,212,255,0.16)');
  grad.addColorStop(1.0, 'rgba(140,185,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createMoonGeometry(def) {
  const segW = def.irregular ? 20 : (def.baseRadius >= 0.25 ? 32 : 24);
  const segH = def.irregular ? 14 : (def.baseRadius >= 0.25 ? 24 : 18);
  const geo = new THREE.SphereGeometry(def.baseRadius, segW, segH);

  if (def.irregular) {
    const pos = geo.attributes.position;
    const sx = def.shapeScale ? def.shapeScale[0] : 1.18;
    const sy = def.shapeScale ? def.shapeScale[1] : 0.94;
    const sz = def.shapeScale ? def.shapeScale[2] : 0.86;
    const seed = def.id.length * 1.73 + 0.5;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const len = Math.hypot(vx, vy, vz) || 1;
      const ux = vx / len, uy = vy / len, uz = vz / len;
      // Smooth direction-based displacement guarantees zero seam cracks
      const bump =
        1.0 +
        0.10 * Math.sin(ux * 3.1 + seed) * Math.cos(uy * 2.7 - seed) +
        0.07 * Math.sin((uz * 4.3 + ux * 2.9) + seed * 1.4) +
        0.04 * Math.cos(uy * 5.2 - uz * 3.7);
      pos.setXYZ(i, vx * sx * bump, vy * sy * bump, vz * sz * bump);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return geo;
}

function createMoonSurfaceMaterial(def, tex, parentColorHex) {
  const eclipseRgb = def.eclipseTint || [0.78, 0.86, 1.08];
  const baseCol = new THREE.Color(def.color);
  const rimCol = new THREE.Color(0xcfe4ff).lerp(baseCol, 0.32);
  const surfaceGain = clamp(0.76 + (def.albedo || 0.78) * 0.12, 0.74, 0.87);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex },
      uBaseColor: { value: baseCol },
      uHasMap: { value: tex ? 1.0 : 0.0 },
      uSunPos: { value: new THREE.Vector3(0, 0, 0) },
      uPlanetPos: { value: new THREE.Vector3(0, 0, 0) },
      uSunIntensity: { value: 1.0 },
      uEclipse: { value: 1.0 },
      uEclipseTint: { value: new THREE.Color(eclipseRgb[0], eclipseRgb[1], eclipseRgb[2]) },
      uPlanetshine: { value: 0.05 },
      uPlanetColor: { value: new THREE.Color(parentColorHex || 0x8aa8cc) },
      uRimColor: { value: rimCol },
      uRimStrength: { value: 0.12 },
      uSurfaceGain: { value: surfaceGain },
      uEmissive: { value: new THREE.Color(0x000000) },
      uEmissiveIntensity: { value: 0.0 }
    },
    vertexShader: `
      uniform vec3 uSunPos;
      uniform vec3 uPlanetPos;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      varying vec3 vSunViewDir;
      varying vec3 vPlanetViewDir;

      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mvPos.xyz;
        vViewNormal = normalize(normalMatrix * normal);

        vec3 sunView = (viewMatrix * vec4(uSunPos, 1.0)).xyz;
        vec3 planetView = (viewMatrix * vec4(uPlanetPos, 1.0)).xyz;
        vSunViewDir = sunView - mvPos.xyz;
        vPlanetViewDir = planetView - mvPos.xyz;

        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uBaseColor;
      uniform float uHasMap;
      uniform float uSunIntensity;
      uniform float uEclipse;
      uniform vec3 uEclipseTint;
      uniform float uPlanetshine;
      uniform vec3 uPlanetColor;
      uniform vec3 uRimColor;
      uniform float uRimStrength;
      uniform float uSurfaceGain;
      uniform vec3 uEmissive;
      uniform float uEmissiveIntensity;

      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      varying vec3 vSunViewDir;
      varying vec3 vPlanetViewDir;

      void main() {
        vec3 N = vViewNormal / max(length(vViewNormal), 0.0001);
        vec3 V = (-vViewPos) / max(length(vViewPos), 0.0001);
        vec3 Lsun = vSunViewDir / max(length(vSunViewDir), 0.0001);
        vec3 Lplanet = vPlanetViewDir / max(length(vPlanetViewDir), 0.0001);

        vec3 albedo = mix(uBaseColor, texture2D(uMap, vUv).rgb, uHasMap);

        float ndotl = max(dot(N, Lsun), 0.0);
        float solarDiff = ndotl * 0.84 + smoothstep(0.0, 0.65, ndotl) * 0.16;

        float eclipseMix = 1.0 - smoothstep(0.20, 0.96, uEclipse);
        vec3 shadowTint = mix(vec3(1.0), uEclipseTint, eclipseMix);
        vec3 sunLight = vec3(1.0, 0.97, 0.92) * solarDiff * uEclipse * uSunIntensity * shadowTint;

        float planetWrap = clamp((dot(N, Lplanet) + 0.28) / 1.28, 0.0, 1.0);
        vec3 planetLight = uPlanetColor * uPlanetshine * (0.28 + 0.72 * planetWrap) * uSunIntensity;

        vec3 spaceAmbient = vec3(0.045, 0.055, 0.080) * (0.45 + 0.55 * uSunIntensity);

        vec3 lit = albedo * (sunLight * uSurfaceGain + planetLight + spaceAmbient);

        float ndotv = clamp(dot(N, V), 0.0, 1.0);
        float fresnel = pow(max(1.0 - ndotv, 0.0001), 3.5);
        float rimMod = 0.42 + 0.58 * ndotl * uEclipse * uSunIntensity;
        vec3 rimCol = uRimColor * fresnel * uRimStrength * rimMod;

        vec3 baseFinal = min(lit + rimCol, vec3(0.88));
        vec3 finalCol = baseFinal + uEmissive * uEmissiveIntensity;

        gl_FragColor = vec4(finalCol, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });

  // Expose emissive hooks so impact.js Black Hole tidal heating & reset work seamlessly on Earth's Moon
  mat.emissive = mat.uniforms.uEmissive.value;
  Object.defineProperty(mat, 'emissiveIntensity', {
    get() {
      return mat.uniforms.uEmissiveIntensity.value;
    },
    set(val) {
      mat.uniforms.uEmissiveIntensity.value = Number.isFinite(val) ? val : 0;
    },
    enumerable: true,
    configurable: true
  });

  return mat;
}

function createTitanHazeMaterial(atmo) {
  const col = new THREE.Color(atmo.color || 0xe8ac5c);
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunPos: { value: new THREE.Vector3(0, 0, 0) },
      uColor: { value: col },
      uIntensity: { value: Math.min(0.22, Number(atmo.intensity) || 0.21) },
      uEclipse: { value: 1.0 },
      uSunIntensity: { value: 1.0 }
    },
    vertexShader: `
      uniform vec3 uSunPos;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      varying vec3 vSunViewDir;

      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mvPos.xyz;
        vViewNormal = normalize(normalMatrix * normal);
        vec3 sunView = (viewMatrix * vec4(uSunPos, 1.0)).xyz;
        vSunViewDir = sunView - mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uEclipse;
      uniform float uSunIntensity;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      varying vec3 vSunViewDir;

      void main() {
        vec3 N = vViewNormal / max(length(vViewNormal), 0.0001);
        vec3 V = (-vViewPos) / max(length(vViewPos), 0.0001);
        vec3 L = vSunViewDir / max(length(vSunViewDir), 0.0001);

        float ndotv = clamp(dot(N, V), 0.0, 1.0);
        float rim = pow(max(1.0 - ndotv, 0.0001), 2.5);
        float daySide = 0.25 + 0.75 * smoothstep(-0.25, 0.75, dot(N, L));
        float alpha = rim * uIntensity * daySide * (0.35 + 0.65 * uEclipse) * (0.20 + 0.80 * uSunIntensity);

        gl_FragColor = vec4(uColor * 0.85, clamp(alpha, 0.0, 0.35));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending
  });
}

function createOrbitRing(radius, def) {
  const segments = 96;
  const positions = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * radius;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(a) * radius;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const ringColor = new THREE.Color(def.color).lerp(new THREE.Color(0x6e8aa8), 0.55);
  const mat = new THREE.LineBasicMaterial({
    color: ringColor,
    transparent: true,
    opacity: clamp(Number(def.orbitOpacity) || 0.14, 0.08, 0.20),
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const line = new THREE.Line(geo, mat);
  line.raycast = () => {};
  return line;
}

/**
 * Creates the full 3D natural satellite system for all planets in VOID.
 * Uses an independent world-space THREE.Group per planet (no parent-spin cancellation hacks),
 * custom GLSL eclipse + planetshine surface shading, distance-adaptive visibility halos,
 * and keeps Earth's Moon directly in `scene` for seamless Black Hole capture in `impact.js`.
 */
export function createSatelliteSystem({
  scene,
  objects,
  sunPos = null,
  textureFactory = null
} = {}) {
  const planetSystems = [];
  const allMoons = [];
  let earthMoonMesh = null;
  let orbitsVisible = true;
  let disposed = false;

  const sharedHaloTex = createHaloTexture();

  // Pre-allocated scratch buffers (zero per-frame heap allocations in update())
  const tmpSunPos = new THREE.Vector3(0, 0, 0);
  const tmpParentPos = new THREE.Vector3();
  const tmpMoonWorld = new THREE.Vector3();
  const tmpCamPos = new THREE.Vector3();
  const tmpLocal = new THREE.Vector3();
  const eclipseArgs = { moonPos: tmpMoonWorld, planetPos: tmpParentPos, planetRadius: 1, sunPos: tmpSunPos };
  const shineArgs = { moonPos: tmpMoonWorld, planetPos: tmpParentPos, sunPos: tmpSunPos, planetAlbedo: 0.35 };
  const lodArgs = { baseRadius: 0.1, parentSize: 1, cameraDistance: 10, minAngularRadius: 0.0055 };

  function resolveSunPosition() {
    if (sunPos) {
      const [sx, sy, sz] = readVec3(sunPos, 0, 0, 0);
      tmpSunPos.set(sx, sy, sz);
      return tmpSunPos;
    }
    const sunEntry = objects && typeof objects.get === 'function' ? objects.get('sun') : null;
    if (sunEntry && sunEntry.mesh) {
      sunEntry.mesh.getWorldPosition(tmpSunPos);
      return tmpSunPos;
    }
    tmpSunPos.set(0, 0, 0);
    return tmpSunPos;
  }

  if (scene && objects && typeof objects.get === 'function') {
    for (const planetId of Object.keys(SATELLITE_SYSTEMS)) {
      const roster = SATELLITE_SYSTEMS[planetId];
      if (!roster || roster.length === 0) continue;

      const parentEntry = objects.get(planetId);
      if (!parentEntry || !parentEntry.mesh || !parentEntry.body) continue;

      const body = parentEntry.body;
      const parentSize = Number.isFinite(body.size) && body.size > 0 ? body.size : 1;
      const parentAlbedo = Number.isFinite(body.albedo) ? body.albedo : 0.35;
      const systemTilt = Object.prototype.hasOwnProperty.call(SYSTEM_AXIAL_TILTS, planetId)
        ? SYSTEM_AXIAL_TILTS[planetId]
        : (Number.isFinite(body.axialTilt) ? body.axialTilt : 0);

      const systemGroup = new THREE.Group();
      systemGroup.name = 'sat-system-' + planetId;
      systemGroup.rotation.z = systemTilt;
      parentEntry.mesh.getWorldPosition(tmpParentPos);
      systemGroup.position.copy(tmpParentPos);
      scene.add(systemGroup);

      const moons = [];
      for (const def of roster) {
        const orbitDist = def.orbitRadius * parentSize;
        const orbitPlane = new THREE.Group();
        orbitPlane.rotation.order = 'YXZ';
        orbitPlane.rotation.y = def.ascNode || 0;
        orbitPlane.rotation.x = def.inclination || 0;
        systemGroup.add(orbitPlane);

        const orbitLine = createOrbitRing(orbitDist, def);
        orbitLine.visible = orbitsVisible;
        orbitPlane.add(orbitLine);

        const geo = createMoonGeometry(def);
        const tex = createMoonTexture(def, textureFactory);
        const mat = createMoonSurfaceMaterial(def, tex, body.color);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'moon-' + def.id;
        mesh.userData.id = planetId;
        mesh.userData.moonId = def.id;

        const isEarthMoon = planetId === 'earth' && def.id === 'moon';
        if (isEarthMoon) {
          // Direct child of scene so impact.js Black Hole capture reads/writes world position cleanly
          scene.add(mesh);
          earthMoonMesh = mesh;
        } else {
          orbitPlane.add(mesh);
        }

        // Optional atmospheric haze shell (Titan)
        let hazeMesh = null;
        if (def.atmosphere) {
          const hazeGeo = new THREE.SphereGeometry(def.baseRadius * (def.atmosphere.scale || 1.18), 24, 18);
          const hazeMat = createTitanHazeMaterial(def.atmosphere);
          hazeMesh = new THREE.Mesh(hazeGeo, hazeMat);
          hazeMesh.raycast = () => {};
          mesh.add(hazeMesh);
        }

        // Subtle distance-adaptive visibility halo sprite (fades to 0 up close)
        let haloSprite = null;
        if (sharedHaloTex) {
          const haloCol = new THREE.Color(0xcfe4ff).lerp(new THREE.Color(def.color), 0.28);
          const haloMat = new THREE.SpriteMaterial({
            map: sharedHaloTex,
            color: haloCol,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          haloSprite = new THREE.Sprite(haloMat);
          haloSprite.raycast = () => {};
          haloSprite.visible = false;
          haloSprite.scale.setScalar(def.baseRadius * 3.8);
          mesh.add(haloSprite);
        }

        const record = {
          id: def.id,
          name: def.name,
          parentId: planetId,
          def,
          isEarthMoon,
          orbitDist,
          orbitPlane,
          orbitLine,
          mesh,
          tex,
          haze: hazeMesh,
          halo: haloSprite,
          angle: def.startAngle || 0,
          zeroGravDrift: 0
        };
        moons.push(record);
        allMoons.push(record);
      }

      // Compute initial world transforms so moons (especially Earth's Moon) start in accurate positions immediately
      systemGroup.updateMatrixWorld(true);
      for (const m of moons) {
        const lx = Math.cos(m.angle) * m.orbitDist;
        const lz = Math.sin(m.angle) * m.orbitDist;
        if (m.isEarthMoon) {
          tmpLocal.set(lx, 0, lz).applyMatrix4(m.orbitPlane.matrixWorld);
          m.mesh.position.copy(tmpLocal);
        } else {
          m.mesh.position.set(lx, 0, lz);
        }
        m.mesh.rotation.y = -m.angle + Math.PI;
      }

      planetSystems.push({
        planetId,
        parentEntry,
        parentSize,
        parentAlbedo,
        systemGroup,
        moons
      });
    }
  }

  function update(dt, state = {}) {
    if (disposed) return;

    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
    const {
      paused = false,
      speed = 1,
      gravity = 100,
      camera = null,
      isBodyCaptured = null,
      sunGone = false
    } = state || {};

    const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 1;
    const safeGravity = Number.isFinite(gravity) ? Math.max(0, gravity) : 100;
    const gravScale = safeGravity > 0 ? Math.sqrt(safeGravity / 100) : 0;
    const sunIntensity = sunGone ? 0.08 : 1.0;

    resolveSunPosition();

    const hasCamera = Boolean(camera && camera.position);
    if (hasCamera) {
      if (typeof camera.getWorldPosition === 'function') {
        camera.getWorldPosition(tmpCamPos);
      } else {
        tmpCamPos.copy(camera.position);
      }
    }

    for (let sIdx = 0; sIdx < planetSystems.length; sIdx++) {
      const sys = planetSystems[sIdx];
      const parentMesh = sys.parentEntry.mesh;
      const parentVisible = Boolean(parentMesh.visible);
      const parentCaptured = typeof isBodyCaptured === 'function' ? Boolean(isBodyCaptured(sys.planetId)) : false;

      parentMesh.getWorldPosition(tmpParentPos);
      sys.systemGroup.position.copy(tmpParentPos);
      sys.systemGroup.visible = parentVisible;
      sys.systemGroup.updateMatrixWorld(true);

      for (let mIdx = 0; mIdx < sys.moons.length; mIdx++) {
        const m = sys.moons[mIdx];
        const moonCaptured = m.isEarthMoon && typeof isBodyCaptured === 'function'
          ? Boolean(isBodyCaptured('moon'))
          : false;

        // Orbit ring visibility (cleanly hidden when host/moon is captured or hidden)
        m.orbitLine.visible = orbitsVisible && parentVisible && !parentCaptured && !moonCaptured;

        if (!moonCaptured) {
          if (m.isEarthMoon) {
            if (safeGravity === 0) {
              if (!paused && safeDt > 0) {
                m.zeroGravDrift = Math.min(6.0, m.zeroGravDrift + safeDt * 0.35);
              }
            } else {
              if (m.zeroGravDrift > 0) {
                m.zeroGravDrift = paused ? 0 : Math.max(0, m.zeroGravDrift - safeDt * 3.0);
              }
              if (!paused && safeDt > 0) {
                m.angle += m.def.speed * safeDt * safeSpeed * gravScale;
              }
            }
          } else if (!paused && safeDt > 0) {
            m.angle += m.def.speed * safeDt * safeSpeed;
          }

          const lx = Math.cos(m.angle) * m.orbitDist;
          const lz = Math.sin(m.angle) * m.orbitDist;
          if (m.isEarthMoon) {
            tmpLocal.set(lx, m.zeroGravDrift, lz).applyMatrix4(m.orbitPlane.matrixWorld);
            m.mesh.position.copy(tmpLocal);
            m.mesh.visible = parentVisible;
            m.mesh.rotation.set(0, -m.angle + Math.PI, 0);
          } else {
            m.mesh.position.set(lx, 0, lz);
            m.mesh.visible = parentVisible;
            m.mesh.rotation.y = -m.angle + Math.PI;
          }
        }

        // Resolve exact moon world position for lighting, eclipse, planetshine & LOD
        if (m.isEarthMoon) {
          tmpMoonWorld.copy(m.mesh.position);
        } else {
          m.mesh.updateWorldMatrix(true, false);
          tmpMoonWorld.setFromMatrixPosition(m.mesh.matrixWorld);
        }

        // Analytic eclipse shadow & planetshine
        eclipseArgs.planetRadius = sys.parentSize;
        const eclipse = sunGone ? 0.20 : computeEclipseFactor(eclipseArgs);

        shineArgs.planetAlbedo = sys.parentAlbedo;
        const planetshine = sunGone ? 0 : computePlanetshineIntensity(shineArgs);

        const uniforms = m.mesh.material.uniforms;
        uniforms.uSunPos.value.copy(tmpSunPos);
        uniforms.uPlanetPos.value.copy(tmpParentPos);
        uniforms.uSunIntensity.value = sunIntensity;
        uniforms.uEclipse.value = eclipse;
        uniforms.uPlanetshine.value = planetshine;

        if (m.haze) {
          const hUni = m.haze.material.uniforms;
          hUni.uSunPos.value.copy(tmpSunPos);
          hUni.uEclipse.value = eclipse;
          hUni.uSunIntensity.value = sunIntensity;
        }

        // Camera-distance adaptive LOD scale & subtle far visibility halo
        if (hasCamera) {
          const camDist = tmpCamPos.distanceTo(tmpMoonWorld);
          if (!moonCaptured) {
            lodArgs.baseRadius = m.def.baseRadius;
            lodArgs.parentSize = sys.parentSize;
            lodArgs.cameraDistance = camDist;
            const lodScale = computeLodScale(lodArgs);
            m.mesh.scale.setScalar(lodScale);
          }

          if (m.halo) {
            if (!m.mesh.visible || moonCaptured) {
              m.halo.visible = false;
              m.halo.material.opacity = 0;
            } else {
              // Fades strictly to 0 up close (<= 6.0 * parentSize), ramps gently across 6.0..20.0 * parentSize
              const farRamp = smoothstep(sys.parentSize * 6.0, sys.parentSize * 20.0, camDist);
              const haloOpacity = farRamp * 0.25 * (0.45 + 0.55 * eclipse) * (0.25 + 0.75 * sunIntensity);
              if (haloOpacity > 0.004) {
                m.halo.visible = true;
                m.halo.material.opacity = haloOpacity;
                m.halo.scale.setScalar(m.def.baseRadius * (3.4 + 1.8 * farRamp));
              } else {
                m.halo.visible = false;
                m.halo.material.opacity = 0;
              }
            }
          }
        }
      }
    }
  }

  function setOrbitsVisible(visible) {
    orbitsVisible = Boolean(visible);
    if (disposed) return;
    for (let i = 0; i < allMoons.length; i++) {
      allMoons[i].orbitLine.visible = orbitsVisible;
    }
  }

  function getEarthMoonMesh() {
    return earthMoonMesh;
  }

  function getAllMoons() {
    return allMoons.map(m => ({
      id: m.id,
      name: m.name,
      parentId: m.parentId,
      mesh: m.mesh,
      halo: m.halo,
      orbitLine: m.orbitLine,
      def: m.def
    }));
  }

  function dispose() {
    if (disposed) return;
    disposed = true;

    for (let i = 0; i < allMoons.length; i++) {
      const m = allMoons[i];
      if (m.isEarthMoon && scene && m.mesh.parent === scene) {
        scene.remove(m.mesh);
      }
      if (m.haze) {
        m.haze.geometry?.dispose();
        m.haze.material?.dispose();
      }
      if (m.halo) {
        m.halo.material?.dispose();
      }
      m.orbitLine.geometry?.dispose();
      m.orbitLine.material?.dispose();
      m.mesh.geometry?.dispose();
      m.mesh.material?.dispose();
      if (m.tex && typeof m.tex.dispose === 'function') {
        m.tex.dispose();
      }
    }

    for (let i = 0; i < planetSystems.length; i++) {
      const sys = planetSystems[i];
      if (scene && sys.systemGroup.parent === scene) {
        scene.remove(sys.systemGroup);
      }
    }

    if (sharedHaloTex && typeof sharedHaloTex.dispose === 'function') {
      sharedHaloTex.dispose();
    }

    allMoons.length = 0;
    planetSystems.length = 0;
    earthMoonMesh = null;
  }

  return {
    update,
    setOrbitsVisible,
    getEarthMoonMesh,
    getAllMoons,
    dispose
  };
}
