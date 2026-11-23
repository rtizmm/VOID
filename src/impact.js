import * as THREE from 'three';

// Shared GLSL value noise for accretion plasma & lensing shimmer
const NOISE_GLSL = `
float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise2(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for(int i = 0; i < 4; i++){
    v += a * noise2(p);
    p = rot * p * 2.05;
    a *= 0.5;
  }
  return v;
}
`;

function createAccretionMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1.0 }
    },
    vertexShader: `
      varying vec2 vPos;
      varying vec3 vWorldPos;
      void main(){
        vPos = position.xy;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vPos;
      varying vec3 vWorldPos;
      ${NOISE_GLSL}
      void main(){
        float r = length(vPos);
        if(r < 1.06 || r > 4.6) discard;
        float normR = clamp((r - 1.08) / 3.52, 0.0, 1.0);
        float angle = atan(vPos.y, vPos.x);

        // Differential Keplerian shear: inner plasma whips around much faster
        float omega = 2.6 / pow(max(0.35, r * 0.55), 1.35);
        float swirl = angle + log(r) * 5.2 - uTime * omega;
        vec2 uv1 = vec2(cos(swirl) * 2.2, sin(swirl) * 2.2) + vec2(r * 1.4, -uTime * 0.35);
        vec2 uv2 = vec2(cos(swirl * 2.0 + 1.5), sin(swirl * 2.0 + 1.5)) * 1.6 + vec2(r * 2.8, uTime * 0.5);

        float n1 = fbm(uv1);
        float n2 = fbm(uv2);
        float rings = 0.55 + 0.45 * sin(r * 13.0 - uTime * 3.0 + n1 * 4.5);
        float plasma = clamp((n1 * 0.65 + n2 * 0.55) * rings, 0.0, 1.4);

        // Relativistic Doppler beaming (left/approaching side brighter & hotter)
        float doppler = 0.72 + 0.55 * clamp(vPos.x / max(r, 0.001), -1.0, 1.0);

        // Soft inner & outer edges
        float innerEdge = smoothstep(1.06, 1.24, r);
        float outerEdge = 1.0 - smoothstep(2.9, 4.55, r);
        float alpha = innerEdge * outerEdge * (0.28 + plasma * 0.92);

        // Blackbody temperature gradient: blazing white-cyan -> gold -> fiery orange -> deep crimson/violet
        vec3 hotInner = vec3(1.55, 1.42, 1.25);
        vec3 goldMid = vec3(1.45, 0.68, 0.18);
        vec3 outerCrimson = vec3(0.68, 0.14, 0.36);
        vec3 col = mix(hotInner, goldMid, smoothstep(0.0, 0.42, normR));
        col = mix(col, outerCrimson, smoothstep(0.38, 0.95, normR));
        col *= (0.7 + plasma * 1.15) * doppler * uIntensity;

        // Sharp photon-ring boost right along the inner rim
        float photonRim = exp(-pow((r - 1.13) * 16.0, 2.0)) * 1.8;
        col += vec3(1.2, 1.35, 1.65) * photonRim;

        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
}

function createLensingHaloMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMass: { value: 1.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uMass;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main(){
        vec2 p = vUv * 4.5;
        float r = length(p);
        if(r > 4.4) discard;
        float a = atan(p.y, p.x);

        // Gravitational deflection bends light into top & bottom Einstein arches (Interstellar Gargantua style)
        float einstein = exp(-pow((r - 1.06) * 12.5, 2.0));
        float outerLens = exp(-pow((r - 1.55) * 2.6, 2.0));

        // Bent far-side disk arch stronger at top & bottom (|sin(a)|)
        float archMask = pow(abs(sin(a)), 1.35) * exp(-pow((r - 1.48) * 3.1, 2.0));
        float warpSwirl = fbm(vec2(a * 3.0 + uTime * 1.4, r * 3.2 - uTime * 0.9));
        float caustic = fbm(vec2(cos(a) * 2.5 + uTime * 0.4, sin(a) * 2.5 - uTime * 0.35));

        // Chromatic gravitational dispersion (cyan/violet lensing arcs + golden bent disk)
        vec3 photonColor = vec3(1.6, 1.38, 1.15) * einstein * (1.25 + 0.35 * warpSwirl);
        vec3 archColor = mix(vec3(1.45, 0.72, 0.24), vec3(0.75, 0.45, 1.35), smoothstep(1.15, 2.3, r)) * archMask * (0.75 + 0.95 * warpSwirl);
        vec3 lensGlow = vec3(0.42, 0.62, 1.25) * outerLens * caustic * 0.42;

        // Subtle starlight bending streaks around r = 1.8 - 3.6
        float streakRing = smoothstep(1.2, 1.7, r) * (1.0 - smoothstep(2.4, 4.2, r));
        float streaks = pow(fbm(vec2(a * 8.0 + 2.4 / max(r, 0.4), r * 2.0 - uTime * 0.25)), 3.0);
        vec3 lensedStars = vec3(0.65, 0.8, 1.35) * streaks * streakRing * 0.6;

        // Inner shadow cutoff inside event horizon
        float outsideCore = smoothstep(0.92, 1.03, r);
        vec3 col = (photonColor + archColor + lensGlow + lensedStars) * outsideCore * (0.85 + 0.15 * uMass);
        float alpha = clamp((einstein * 1.1 + archMask * 0.85 + outerLens * 0.35 + streaks * streakRing * 0.45) * outsideCore, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
}

function createSpacetimeGridMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBhPos: { value: new THREE.Vector3() },
      uWellDepth: { value: 0 },
      uOpacity: { value: 0 }
    },
    vertexShader: `
      uniform float uTime;
      uniform vec3 uBhPos;
      uniform float uWellDepth;
      varying vec2 vWorldXZ;
      varying float vDist;
      varying float vDepth;
      varying float vRipple;
      void main(){
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vec2 delta = worldPos.xz - uBhPos.xz;
        float d = length(delta);

        // Deep gravitational funnel + radial coordinate pinch
        float funnel = -uWellDepth / (1.0 + d * d * 0.016);
        float pinch = min(0.55, uWellDepth * 0.032 / (1.0 + d * 0.28));
        worldPos.xz -= normalize(delta + vec2(0.0001)) * pinch * min(d, 10.0);

        // Propagating spacetime gravitational wave ripples
        float ripple = sin(d * 0.72 - uTime * 3.6) * exp(-d * 0.028) * min(1.3, uWellDepth * 0.075);
        worldPos.y += funnel + ripple;

        vWorldXZ = worldPos.xz;
        vDist = d;
        vDepth = clamp(-funnel / max(uWellDepth, 0.001), 0.0, 1.0);
        vRipple = ripple;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vWorldXZ;
      varying float vDist;
      varying float vDepth;
      varying float vRipple;
      void main(){
        if(uOpacity <= 0.005) discard;
        // Procedural anti-aliased spacetime grid (major + minor lines)
        vec2 gMinor = vWorldXZ * 0.45;
        vec2 gMajor = vWorldXZ * 0.1125;
        vec2 dMinor = abs(fract(gMinor - 0.5) - 0.5) / max(fwidth(gMinor), vec2(0.001));
        vec2 dMajor = abs(fract(gMajor - 0.5) - 0.5) / max(fwidth(gMajor), vec2(0.001));
        float minorLine = 1.0 - min(min(dMinor.x, dMinor.y), 1.0);
        float majorLine = 1.0 - min(min(dMajor.x, dMajor.y), 1.0);

        // Concentric gravitational wave rings
        float waveRing = smoothstep(0.75, 0.98, sin(vDist * 0.72 - uTime * 3.6)) * exp(-vDist * 0.035);

        float edgeFade = 1.0 - smoothstep(45.0, 92.0, vDist);
        float lineStrength = max(minorLine * 0.42, majorLine * 0.85) + waveRing * 0.55;

        // Color shifts by spacetime curvature: flat indigo -> cyan ripples -> molten violet/gold funnel
        vec3 flatCol = vec3(0.24, 0.48, 0.88);
        vec3 waveCol = vec3(0.35, 0.92, 1.15);
        vec3 deepCol = vec3(1.45, 0.52, 0.95);
        vec3 col = mix(flatCol, waveCol, clamp(abs(vRipple) * 1.4 + waveRing, 0.0, 1.0));
        col = mix(col, deepCol, smoothstep(0.15, 0.85, vDepth));

        float alpha = lineStrength * edgeFade * uOpacity * (0.55 + vDepth * 0.9);
        if(alpha < 0.01) discard;
        gl_FragColor = vec4(col * (0.9 + vDepth * 0.85), clamp(alpha, 0.0, 0.92));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
}

function createTrailRibbon(colorHex, maxPoints = 56) {
  const positions = new Float32Array(maxPoints * 3);
  const colors = new Float32Array(maxPoints * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;

  // Glowing spark points along the trail
  const sparkMat = new THREE.PointsMaterial({
    size: 0.28,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sparks = new THREE.Points(geo, sparkMat);
  sparks.frustumCulled = false;

  const baseColor = new THREE.Color(colorHex);
  const hotColor = new THREE.Color(0xff9c4a);
  const points = [];

  return {
    line,
    sparks,
    push(vec3, heat = 0) {
      points.unshift(vec3.clone());
      if (points.length > maxPoints) points.pop();
      const count = points.length;
      const c = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const p = points[i];
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        const fade = Math.pow(1 - i / maxPoints, 1.65);
        c.copy(baseColor).lerp(hotColor, clamp01(heat * (1 - i / maxPoints * 0.5)));
        colors[i * 3] = c.r * fade * 1.4;
        colors[i * 3 + 1] = c.g * fade * 1.4;
        colors[i * 3 + 2] = c.b * fade * 1.4;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, count);
    },
    clear() {
      points.length = 0;
      geo.setDrawRange(0, 0);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      sparkMat.dispose();
    }
  };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// Stylised persistent effects. All visual sizes and timing are exaggerated.
export function createImpactEffects(scene, earth, camera, extras = {}) {
  const { objects, moon, addShake = () => {}, pulseBloom = () => {} } = extras;
  const sphere = earth.mesh;

  const heat = new THREE.Mesh(
    new THREE.SphereGeometry(1.008, 40, 28),
    new THREE.MeshBasicMaterial({ color: 0xff4d12, transparent: true, opacity: 0, depthWrite: false })
  );
  sphere.add(heat);

  const scarRoot = new THREE.Group();
  sphere.add(scarRoot);

  const debris = new THREE.Group();
  scene.add(debris);
  const fragments = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.075, 1),
    new THREE.MeshStandardMaterial({ color: 0xa68270, emissive: 0xff5a18, emissiveIntensity: 1.35, roughness: 0.85 }),
    220
  );
  fragments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fragments.frustumCulled = false;
  debris.add(fragments);
  debris.visible = false;

  const wave = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1.0, 96),
    new THREE.MeshBasicMaterial({ color: 0xffc482, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  scene.add(wave);

  // Volumetric impact flash sphere
  const flashSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe2b5, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  scene.add(flashSphere);
  flashSphere.visible = false;

  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 2),
    new THREE.MeshStandardMaterial({ color: 0x91867b, roughness: 0.9, emissive: 0x6b220a, emissiveIntensity: 0.9 })
  );
  scene.add(rock);
  rock.visible = false;

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 3.6, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffaa5c, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  scene.add(tail);
  tail.visible = false;

  // === CINEMATIC BLACK HOLE SYSTEM ===
  const bhGroup = new THREE.Group();
  scene.add(bhGroup);
  bhGroup.visible = false;

  // Pitch-black Event Horizon core + subtle dark contrast halo
  const bhCore = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  const bhAccretionMat = createAccretionMaterial();
  const bhDisk = new THREE.Mesh(new THREE.RingGeometry(1.06, 4.6, 128, 8), bhAccretionMat);
  bhDisk.rotation.x = Math.PI * 0.41;
  bhDisk.rotation.y = 0.18;

  const bhLensingMat = createLensingHaloMaterial();
  const bhLensing = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 9.2), bhLensingMat);

  // Relativistic polar jets (visible at high BH mass)
  const jetGeo = new THREE.ConeGeometry(0.55, 11, 24, 1, true);
  const jetMat = new THREE.MeshBasicMaterial({
    color: 0x7c8cff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const bhJetTop = new THREE.Mesh(jetGeo, jetMat);
  bhJetTop.position.y = 6.2;
  bhJetTop.rotation.x = Math.PI;
  const bhJetBottom = new THREE.Mesh(jetGeo, jetMat);
  bhJetBottom.position.y = -6.2;

  // Accretion point light illuminating nearby planets with fiery orange-violet light
  const bhLight = new THREE.PointLight(0xff9448, 0, 95, 1.4);

  // Swirling captured accretion particle swarm (500 glowing motes spiralling into BH)
  const SWARM_COUNT = 500;
  const swarmPos = new Float32Array(SWARM_COUNT * 3);
  const swarmCol = new Float32Array(SWARM_COUNT * 3);
  const swarmMeta = Array.from({ length: SWARM_COUNT }, () => ({
    angle: Math.random() * Math.PI * 2,
    radius: 1.5 + Math.random() * 11.0,
    height: (Math.random() - 0.5) * 1.4,
    speed: 0.7 + Math.random() * 1.4
  }));
  const swarmGeo = new THREE.BufferGeometry();
  swarmGeo.setAttribute('position', new THREE.BufferAttribute(swarmPos, 3));
  swarmGeo.setAttribute('color', new THREE.BufferAttribute(swarmCol, 3));
  const swarmMat = new THREE.PointsMaterial({
    size: 0.16,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const bhSwarm = new THREE.Points(swarmGeo, swarmMat);
  bhSwarm.frustumCulled = false;

  bhGroup.add(bhCore, bhDisk, bhLensing, bhJetTop, bhJetBottom, bhLight, bhSwarm);

  // Dynamic Spacetime Curvature Grid
  const gridMat = createSpacetimeGridMaterial();
  const spacetimeGrid = new THREE.Mesh(new THREE.PlaneGeometry(180, 180, 108, 108), gridMat);
  spacetimeGrid.rotation.x = -Math.PI / 2;
  spacetimeGrid.visible = false;
  spacetimeGrid.frustumCulled = false;
  scene.add(spacetimeGrid);

  // Gamma-Ray Burst dual-core beam + Planetary Shield dome
  const grbGroup = new THREE.Group();
  const grbOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 1.55, 32, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x4aeaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
  );
  const grbCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.55, 32, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
  );
  grbGroup.add(grbOuter, grbCore);
  scene.add(grbGroup);
  grbGroup.visible = false;

  const shieldDome = new THREE.Mesh(
    new THREE.SphereGeometry(1.19, 36, 24),
    new THREE.MeshBasicMaterial({ color: 0x5ce1e6, wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  sphere.add(shieldDome);

  // === SYSTEM-WIDE ORBITAL PERTURBATION & SPAGHETTIFICATION STATE ===
  const trailGroup = new THREE.Group();
  scene.add(trailGroup);
  const rogueGroup = new THREE.Group();
  scene.add(rogueGroup);

  // Snapshot original Solar System state for clean reset()
  const originalBodies = new Map();
  if (objects) {
    for (const [id, entry] of objects.entries()) {
      originalBodies.set(id, {
        pivot: entry.pivot,
        localPos: entry.mesh.position.clone(),
        baseScale: entry.mesh.scale.clone(),
        baseRotZ: entry.mesh.rotation.z,
        baseEmissive: entry.mesh.material?.emissive ? entry.mesh.material.emissive.clone() : null,
        baseEmissiveIntensity: entry.mesh.material?.emissiveIntensity ?? 0
      });
    }
  }

  let capturedBodies = []; // { id, mesh, pos, vel, baseScale, trail, swallowed, isEarth, isMoon, isRogue }
  let bhActive = false;
  let bhMassVal = 8;
  let bhScale = 1;
  let bhPos = new THREE.Vector3();
  let bhAge = 0;
  let earthWillShatter = false;
  let earthSwallowed = false;
  let grbTime = 0;
  let flashTime = 0;

  const dirs = Array.from({ length: 220 }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / 220;
    const a = i * 2.39996;
    return new THREE.Vector3(Math.sqrt(1 - y * y) * Math.cos(a), y, Math.sqrt(1 - y * y) * Math.sin(a));
  });
  const dummy = new THREE.Object3D();
  const center = new THREE.Vector3();
  const tmpVec = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);
  const zAxis = new THREE.Vector3(0, 0, 1);

  let flight = null;
  let age = 0;
  let result = null;
  let normal = new THREE.Vector3();
  let localNormal = new THREE.Vector3();
  let totalHeat = 0;

  function clearCapturedBodies() {
    for (const item of capturedBodies) {
      if (item.trail) {
        trailGroup.remove(item.trail.line, item.trail.sparks);
        item.trail.dispose();
      }
      if (item.isRogue) {
        rogueGroup.remove(item.mesh);
        item.mesh.geometry?.dispose();
        item.mesh.material?.dispose();
      } else if (item.isMoon && moon) {
        moon.visible = true;
        moon.scale.setScalar(1);
        moon.quaternion.identity();
        if (moon.material?.emissive) {
          moon.material.emissive.setHex(0x000000);
          moon.material.emissiveIntensity = 0;
        }
      } else if (objects && originalBodies.has(item.id)) {
        const orig = originalBodies.get(item.id);
        const entry = objects.get(item.id);
        if (entry) {
          if (entry.mesh.parent !== orig.pivot) {
            orig.pivot.add(entry.mesh);
          }
          entry.mesh.position.copy(orig.localPos);
          entry.mesh.scale.copy(orig.baseScale);
          entry.mesh.quaternion.identity();
          entry.mesh.rotation.z = orig.baseRotZ;
          entry.mesh.visible = true;
          if (orig.baseEmissive && entry.mesh.material?.emissive) {
            entry.mesh.material.emissive.copy(orig.baseEmissive);
            entry.mesh.material.emissiveIntensity = orig.baseEmissiveIntensity;
          }
        }
      }
    }
    capturedBodies = [];
    earthSwallowed = false;
  }

  function initBlackHoleCapture(massMultiplier, shatter) {
    clearCapturedBodies();
    const earthWorld = sphere.getWorldPosition(new THREE.Vector3());
    const camDir = camera.position.clone().sub(earthWorld).normalize();
    const right = new THREE.Vector3().crossVectors(upVec, camDir).normalize();

    // Position the Black Hole dramatically in view near Earth
    bhPos.copy(earthWorld).addScaledVector(right, 6.2).addScaledVector(camDir, -2.4);
    bhPos.y = earthWorld.y + 0.4;
    bhGroup.position.copy(bhPos);

    // Position spacetime grid centered under the Black Hole
    spacetimeGrid.position.set(bhPos.x, bhPos.y - 2.2, bhPos.z);
    spacetimeGrid.visible = true;
    gridMat.uniforms.uBhPos.value.copy(bhPos);

    // 1. Capture the Moon immediately so user sees dramatic spiral + spaghettification right away
    if (moon) {
      const mPos = moon.position.clone();
      const toBh = bhPos.clone().sub(mPos);
      const tang = new THREE.Vector3(-toBh.z, 0.25, toBh.x).normalize();
      const trail = createTrailRibbon(0x9ce2ff, 64);
      trailGroup.add(trail.line, trail.sparks);
      capturedBodies.push({
        id: 'moon',
        mesh: moon,
        pos: mPos,
        vel: tang.multiplyScalar(3.4 + massMultiplier * 0.04),
        baseScale: new THREE.Vector3(1, 1, 1),
        trail,
        swallowed: false,
        isMoon: true,
        isEarth: false,
        isRogue: false
      });
    }

    // 2. Capture Earth & nearby planets (detaching temporarily to scene space for free 3D spiral orbits)
    const pullRadius = 18 + massMultiplier * 1.9;
    if (objects) {
      for (const [id, entry] of objects.entries()) {
        if (id === 'sun') continue;
        const wPos = entry.mesh.getWorldPosition(new THREE.Vector3());
        const dist = wPos.distanceTo(bhPos);
        const shouldCapture = id === 'earth' || dist < pullRadius;
        if (!shouldCapture) continue;

        // Move mesh to world space while preserving visual transform
        scene.attach(entry.mesh);
        const toBh = bhPos.clone().sub(wPos);
        const tang = new THREE.Vector3(-toBh.z, (Math.random() - 0.5) * 0.2, toBh.x).normalize();
        const speedFactor = id === 'earth' ? (shatter ? 2.4 : 3.9) : 2.6 + Math.min(3.5, dist * 0.06);
        const trail = createTrailRibbon(entry.body.color, id === 'earth' ? 72 : 58);
        trailGroup.add(trail.line, trail.sparks);

        capturedBodies.push({
          id,
          mesh: entry.mesh,
          pos: wPos,
          vel: tang.multiplyScalar(speedFactor),
          baseScale: originalBodies.get(id).baseScale.clone(),
          trail,
          swallowed: false,
          isMoon: false,
          isEarth: id === 'earth',
          isRogue: false,
          lockedToSafeOrbit: id === 'earth' && !shatter
        });
      }
    }

    // 3. Spawn 6 bright rogue planetoids/comets around the vicinity for immediate spaghettification fireworks
    const rogueColors = [0x78e6ff, 0xffb366, 0xd19aff, 0x8ef5c2, 0xff7e9d, 0xffe484];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.35;
      const dist = 5.5 + (i % 3) * 3.1;
      const rPos = bhPos.clone().add(new THREE.Vector3(Math.cos(angle) * dist, (i % 2 ? 1 : -1) * (0.6 + i * 0.25), Math.sin(angle) * dist));
      const rSize = 0.16 + (i % 3) * 0.08;
      const rMesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(rSize, 2),
        new THREE.MeshStandardMaterial({
          color: rogueColors[i],
          emissive: rogueColors[i],
          emissiveIntensity: 0.45,
          roughness: 0.7
        })
      );
      rMesh.position.copy(rPos);
      rogueGroup.add(rMesh);

      const toBh = bhPos.clone().sub(rPos);
      const tang = new THREE.Vector3(-toBh.z, (i % 2 ? 0.35 : -0.35), toBh.x).normalize();
      const trail = createTrailRibbon(rogueColors[i], 52);
      trailGroup.add(trail.line, trail.sparks);

      capturedBodies.push({
        id: 'rogue-' + i,
        mesh: rMesh,
        pos: rPos,
        vel: tang.multiplyScalar(2.8 + (i % 3) * 0.65),
        baseScale: new THREE.Vector3(1, 1, 1),
        trail,
        swallowed: false,
        isMoon: false,
        isEarth: false,
        isRogue: true
      });
    }
  }

  function impact(r) {
    result = r;
    age = 0;
    debris.visible = true;
    const ringNormal = normal.clone();
    localNormal.copy(normal).applyQuaternion(sphere.getWorldQuaternion(new THREE.Quaternion()).invert());
    const mark = new THREE.Group();
    mark.position.copy(localNormal).multiplyScalar(1.012);
    mark.quaternion.setFromUnitVectors(zAxis, localNormal);
    const radius = Math.min(0.7, 0.035 + r.damage * 0.5);
    const crater = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ color: 0x130e0c, side: THREE.DoubleSide }));
    const rim = new THREE.Mesh(new THREE.RingGeometry(radius * 0.83, radius, 48), new THREE.MeshBasicMaterial({ color: 0xff8b38, side: THREE.DoubleSide }));
    rim.position.z = 0.004;
    mark.add(crater, rim);
    scarRoot.add(mark);
    while (scarRoot.children.length > 16) {
      const old = scarRoot.children[0];
      old.traverse(x => {
        x.geometry?.dispose();
        x.material?.dispose();
      });
      scarRoot.remove(old);
    }
    totalHeat = Math.min(0.85, totalHeat + Math.max(0, r.damage - 0.35) * 0.72);
    heat.material.opacity = totalHeat;
    wave.quaternion.setFromUnitVectors(zAxis, ringNormal);
    sphere.visible = !r.fragment;

    // Cinematic impact flash, bloom burst, and camera shake
    flashTime = 0.85;
    flashSphere.visible = true;
    flashSphere.position.copy(center).addScaledVector(ringNormal, earth.body.size * 0.95);
    flashSphere.scale.setScalar(0.35);
    addShake(0.18 + r.damage * 0.75, 0.65 + r.damage * 0.85);
    pulseBloom(1.35 + r.damage * 1.15);
  }

  function updateSwarm(dt) {
    const c = new THREE.Color();
    for (let i = 0; i < SWARM_COUNT; i++) {
      const m = swarmMeta[i];
      const angVel = (1.6 / Math.pow(Math.max(0.7, m.radius * 0.5), 1.3)) * m.speed;
      m.angle += angVel * dt;
      m.radius -= (0.45 + 2.4 / (m.radius * m.radius)) * dt;
      m.height *= 1 - Math.min(0.9, dt * 0.65);

      if (m.radius < 1.05) {
        m.radius = 6.5 + Math.random() * 7.5;
        m.angle = Math.random() * Math.PI * 2;
        m.height = (Math.random() - 0.5) * 1.8;
      }

      const tilt = 0.25;
      const x = Math.cos(m.angle) * m.radius;
      const z = Math.sin(m.angle) * m.radius;
      const y = m.height + Math.sin(m.angle) * m.radius * tilt;
      swarmPos[i * 3] = x;
      swarmPos[i * 3 + 1] = y;
      swarmPos[i * 3 + 2] = z;

      const heatFrac = clamp01(1 - (m.radius - 1.05) / 7.5);
      c.setHSL(0.08 + (1 - heatFrac) * 0.58, 0.95, 0.55 + heatFrac * 0.4);
      swarmCol[i * 3] = c.r * (0.9 + heatFrac * 1.2);
      swarmCol[i * 3 + 1] = c.g * (0.9 + heatFrac * 1.2);
      swarmCol[i * 3 + 2] = c.b * (0.9 + heatFrac * 1.2);
    }
    swarmGeo.attributes.position.needsUpdate = true;
    swarmGeo.attributes.color.needsUpdate = true;
  }

  function updateCapturedBodies(dt) {
    const ehRadius = 1.05 * bhScale;
    const tidalRadius = 5.4 * bhScale;
    const gm = 24 + bhMassVal * 2.2;

    for (const item of capturedBodies) {
      if (item.swallowed) continue;

      tmpDir.copy(bhPos).sub(item.pos);
      const dist = tmpDir.length();
      const invDist = 1 / Math.max(dist, 0.001);
      tmpDir.multiplyScalar(invDist);

      // Gravitational pull + orbital decay drag to create dramatic tightening spirals
      const accel = gm / (dist * dist + 1.4);
      item.vel.addScaledVector(tmpDir, accel * dt);

      // If Earth is in non-shatter mode, keep it in a dramatic perturbed tidal orbit rather than swallowing
      if (item.lockedToSafeOrbit && dist < tidalRadius * 0.78) {
        const radialVel = item.vel.dot(tmpDir);
        if (radialVel > 0) item.vel.addScaledVector(tmpDir, -radialVel * 1.4);
      } else {
        // Gentle orbital decay so spiral curves inevitably tighten into the singularity
        const drag = dist < tidalRadius ? 0.975 : 0.992;
        item.vel.multiplyScalar(Math.pow(drag, dt * 60));
      }

      item.pos.addScaledVector(item.vel, dt);
      item.mesh.position.copy(item.pos);

      // Tidal stretching (Spaghettification!) as body enters tidal radius
      const prox = clamp01(1 - (dist - ehRadius) / Math.max(0.5, tidalRadius - ehRadius));
      if (prox > 0.02) {
        const stretch = 1 + Math.pow(prox, 1.8) * (item.lockedToSafeOrbit ? 0.55 : 4.6);
        const squeeze = 1 / Math.sqrt(stretch);
        // Orient local +Z along tidal vector toward the Black Hole, then stretch Z and squeeze X/Y
        item.mesh.quaternion.setFromUnitVectors(zAxis, tmpDir);
        item.mesh.scale.set(
          item.baseScale.x * squeeze,
          item.baseScale.y * squeeze,
          item.baseScale.z * stretch
        );
        // Tidal heating glow as matter is ripped apart
        if (item.mesh.material?.emissive) {
          item.mesh.material.emissive.setRGB(1.0 * prox, 0.42 * prox, 0.12 * prox);
          item.mesh.material.emissiveIntensity = prox * 2.2;
        }
      } else {
        item.mesh.scale.copy(item.baseScale);
      }

      // Push glowing trail point
      item.trail.push(item.pos, prox);

      // Swallowed at the Event Horizon!
      if (!item.lockedToSafeOrbit && dist <= ehRadius * 1.18) {
        item.swallowed = true;
        item.mesh.visible = false;
        addShake(item.isEarth ? 0.95 : 0.28, item.isEarth ? 1.4 : 0.5);
        pulseBloom(item.isEarth ? 2.4 : 1.45);
        if (item.isEarth && !earthSwallowed) {
          earthSwallowed = true;
          result = { damage: 1, fragment: true };
          age = 0;
          debris.visible = true;
          debris.position.copy(bhPos);
        }
      }
    }
  }

  return {
    launch(r, kind, onHit) {
      sphere.getWorldPosition(center);
      normal.copy(camera.position).sub(center).normalize();
      flight = { time: 0, r, kind, onHit };
      rock.visible = true;
      tail.visible = true;
      rock.scale.setScalar(kind === 'needle' ? 0.065 : kind === 'moon' ? earth.body.size * 0.6 : Math.max(0.2, r.damage * 0.9));
      rock.material.color.setHex(kind === 'needle' ? 0xb5dbea : kind === 'moon' ? 0xb4b1a6 : 0x91867b);
    },
    reset() {
      flight = null;
      result = null;
      totalHeat = 0;
      heat.material.opacity = 0;
      sphere.visible = true;
      debris.visible = false;
      rock.visible = false;
      tail.visible = false;
      wave.material.opacity = 0;
      flashTime = 0;
      flashSphere.visible = false;
      bhActive = false;
      bhAge = 0;
      bhGroup.visible = false;
      bhLight.intensity = 0;
      spacetimeGrid.visible = false;
      gridMat.uniforms.uOpacity.value = 0;
      gridMat.uniforms.uWellDepth.value = 0;
      grbTime = 0;
      grbGroup.visible = false;
      shieldDome.material.opacity = 0;
      clearCapturedBodies();
      for (const mark of [...scarRoot.children]) {
        mark.traverse(x => {
          x.geometry?.dispose();
          x.material?.dispose();
        });
        scarRoot.remove(mark);
      }
    },
    spawnBlackHole(massMultiplier, shatter) {
      bhActive = true;
      bhMassVal = massMultiplier;
      bhAge = 0;
      earthWillShatter = shatter;
      earthSwallowed = false;
      bhScale = Math.max(0.65, Math.min(2.35, 0.55 + massMultiplier * 0.036));
      bhGroup.visible = true;
      bhGroup.scale.setScalar(0.05); // Smooth dramatic expansion animation in update()
      bhLensingMat.uniforms.uMass.value = clamp01(massMultiplier / 35);
      jetMat.opacity = massMultiplier >= 14 ? Math.min(0.42, (massMultiplier - 12) * 0.014) : 0;
      bhLight.intensity = 180 + massMultiplier * 14;

      initBlackHoleCapture(massMultiplier, shatter);

      if (!shatter) {
        totalHeat = Math.min(0.75, totalHeat + massMultiplier * 0.012);
        heat.material.opacity = totalHeat;
      }

      addShake(0.32 + massMultiplier * 0.015, 1.35);
      pulseBloom(1.8 + massMultiplier * 0.02);
    },
    fireGRB(shieldPct, heatAdd) {
      sphere.getWorldPosition(center);
      normal.copy(camera.position).sub(center).normalize();
      grbTime = 4.2;
      grbGroup.visible = true;
      shieldDome.material.opacity = shieldPct > 0 ? Math.min(0.72, (shieldPct / 100) * 0.8) : 0;
      totalHeat = Math.min(0.85, totalHeat + heatAdd);
      heat.material.opacity = totalHeat;
      addShake(0.45 * (1 - (shieldPct / 100) * 0.6), 1.1);
      pulseBloom(2.0);
    },
    setShield(pct) {
      shieldDome.material.opacity = pct > 0 ? Math.min(0.55, (pct / 100) * 0.6) : 0;
    },
    setEnvironmentalHeat(value) {
      heat.material.opacity = Math.max(totalHeat, value);
    },
    isBodyCaptured(id) {
      return bhActive && capturedBodies.some(c => c.id === id);
    },
    get isBlackHoleActive() {
      return bhActive;
    },
    update(dt) {
      sphere.getWorldPosition(center);
      if (!earthSwallowed) debris.position.copy(center);

      if (flight) {
        flight.time += dt;
        const t = Math.min(1, flight.time / 2.8);
        const tangent = new THREE.Vector3().crossVectors(normal, upVec).normalize();
        rock.position.copy(center).addScaledVector(normal, earth.body.size + 8 * (1 - t)).addScaledVector(tangent, -7 * (1 - t));
        rock.rotation.x += dt;
        rock.rotation.y += dt * 1.2;
        tail.position.copy(rock.position).addScaledVector(normal, 1.5);
        tail.quaternion.setFromUnitVectors(upVec, normal);
        if (t >= 1) {
          const f = flight;
          flight = null;
          rock.visible = false;
          tail.visible = false;
          impact(f.r);
          f.onHit();
        }
      }

      if (flashTime > 0) {
        flashTime = Math.max(0, flashTime - dt);
        const p = 1 - flashTime / 0.85;
        flashSphere.scale.setScalar(0.35 + p * 3.8);
        flashSphere.material.opacity = (1 - p) * (1 - p) * 0.95;
        if (flashTime === 0) flashSphere.visible = false;
      }

      if (bhActive) {
        bhAge += dt;
        const easeIn = clamp01(bhAge / 1.15);
        const smoothScale = bhScale * (1 - Math.pow(1 - easeIn, 3));
        bhGroup.scale.setScalar(Math.max(0.05, smoothScale));

        bhAccretionMat.uniforms.uTime.value = bhAge;
        bhAccretionMat.uniforms.uIntensity.value = 1.0 + Math.sin(bhAge * 3.2) * 0.08;
        bhLensingMat.uniforms.uTime.value = bhAge;
        bhLensing.lookAt(camera.position);

        // Animate spacetime gravity well & ripples
        gridMat.uniforms.uTime.value = bhAge;
        gridMat.uniforms.uBhPos.value.copy(bhPos);
        gridMat.uniforms.uWellDepth.value = (4.5 + bhMassVal * 0.28) * easeIn;
        gridMat.uniforms.uOpacity.value = 0.82 * easeIn;

        updateSwarm(dt);
        if (dt > 0) updateCapturedBodies(dt);
      }

      if (grbTime > 0) {
        grbTime = Math.max(0, grbTime - dt);
        const dir = tmpVec.set(1, 0.35, -0.4).normalize();
        grbGroup.position.copy(center).addScaledVector(dir, 14);
        grbGroup.quaternion.setFromUnitVectors(upVec, dir);
        const pulse = 0.85 + Math.sin(grbTime * 22) * 0.15;
        grbOuter.material.opacity = Math.min(0.8, grbTime * 0.3) * pulse;
        grbCore.material.opacity = Math.min(0.95, grbTime * 0.42) * pulse;
        shieldDome.rotation.y += dt * 1.8;
        if (grbTime === 0) grbGroup.visible = false;
      }

      if (result) {
        age += dt;
        const spread = result.fragment ? Math.min(18, age * 0.7) : Math.min(6, age * 1.3);
        for (let i = 0; i < dirs.length; i++) {
          if (earthSwallowed) {
            // Spiral Earth's shattered remnants into the Black Hole accretion disk!
            const a = i * 0.31 + age * (1.8 + (i % 7) * 0.25);
            const r = Math.max(1.1 * bhScale, (5.5 - age * 0.65) * (0.45 + (i % 11) / 11));
            dummy.position.set(Math.cos(a) * r, ((i % 9) - 4) * 0.14, Math.sin(a) * r);
          } else {
            dummy.position.copy(dirs[i]).multiplyScalar(earth.body.size + spread * (0.4 + (i % 13) / 13));
            if (!result.fragment) dummy.position.multiplyScalar(0.45).addScaledVector(normal, earth.body.size * 0.8);
          }
          dummy.rotation.set(age * (i % 5) * 0.2, i + age * 0.12, age * 0.3);
          dummy.scale.setScalar(result.fragment ? 1.35 + (i % 9) * 0.35 : Math.max(0.01, 1 - age / 12) * (0.3 + (i % 7) * 0.1));
          dummy.updateMatrix();
          fragments.setMatrixAt(i, dummy.matrix);
        }
        fragments.instanceMatrix.needsUpdate = true;
        if (!result.fragment && age > 12) debris.visible = false;
        wave.position.copy(center).addScaledVector(normal, earth.body.size * 1.025);
        wave.scale.setScalar(0.1 + age * (1 + result.damage * 2.2));
        wave.material.opacity = Math.max(0, 0.82 - age * 0.22);
      }
    },
    get busy() {
      return !!flight;
    },
    get destroyed() {
      return !!(result?.fragment || earthWillShatter);
    }
  };
}
