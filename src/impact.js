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

function createMagmaHeatMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uHeat: { value: 0 },
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec3 vObjPos;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      void main(){
        vObjPos = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalDir = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uHeat;
      uniform float uTime;
      varying vec3 vObjPos;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      ${NOISE_GLSL}
      void main(){
        if(uHeat <= 0.005) discard;
        vec2 uv = vec2(atan(vObjPos.z, vObjPos.x) * 2.4, acos(clamp(vObjPos.y, -1.0, 1.0)) * 3.0);
        float n1 = fbm(uv * 2.2 + vec2(uTime * 0.06, -uTime * 0.04));
        float n2 = fbm(uv * 5.2 - vec2(uTime * 0.08, uTime * 0.05) + n1 * 1.4);
        // Ridged magma fissures (cracked crust rather than solid orange paint)
        float ridge = 1.0 - abs(n2 * 2.0 - 1.0);
        float crack = pow(clamp(ridge, 0.0, 1.0), 3.6 - uHeat * 1.6);
        float charMask = smoothstep(0.28, 0.78, n1) * uHeat * 0.62;
        float rim = pow(1.0 - max(dot(normalize(vNormalDir), normalize(vViewDir)), 0.0), 2.5);

        vec3 basalt = vec3(0.08, 0.05, 0.04);
        vec3 lavaRed = vec3(0.95, 0.24, 0.04);
        vec3 lavaGold = vec3(1.45, 0.78, 0.22);
        vec3 col = mix(basalt, lavaRed, smoothstep(0.18, 0.62, crack));
        col = mix(col, lavaGold, smoothstep(0.58, 0.92, crack));
        col += vec3(0.9, 0.3, 0.08) * rim * uHeat * 0.75;

        float alpha = clamp(charMask + crack * uHeat * 1.15 + rim * uHeat * 0.32, 0.0, 0.92);
        if(alpha < 0.02) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false
  });
}

function createCraterTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  // Soft charred scorched rim fading smoothly into planet texture
  const outer = g.createRadialGradient(64, 64, 14, 64, 64, 62);
  outer.addColorStop(0, 'rgba(18, 10, 8, 0.95)');
  outer.addColorStop(0.45, 'rgba(42, 18, 10, 0.78)');
  outer.addColorStop(0.72, 'rgba(95, 36, 14, 0.32)');
  outer.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = outer;
  g.fillRect(0, 0, 128, 128);

  // Subtle glowing molten crater core + cracked radial magma rays
  const core = g.createRadialGradient(64, 64, 1, 64, 64, 34);
  core.addColorStop(0, 'rgba(255, 210, 110, 0.95)');
  core.addColorStop(0.32, 'rgba(255, 102, 28, 0.78)');
  core.addColorStop(0.68, 'rgba(165, 34, 8, 0.28)');
  core.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = core;
  g.fillRect(0, 0, 128, 128);

  g.strokeStyle = 'rgba(255, 140, 48, 0.55)';
  g.lineWidth = 1.6;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    g.beginPath();
    g.moveTo(64 + Math.cos(a) * 6, 64 + Math.sin(a) * 6);
    g.lineTo(64 + Math.cos(a + 0.14) * 24, 64 + Math.sin(a + 0.14) * 24);
    g.lineTo(64 + Math.cos(a - 0.08) * 44, 64 + Math.sin(a - 0.08) * 44);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Stylised persistent effects. All visual sizes and timing are exaggerated.
export function createImpactEffects(scene, earth, camera, extras = {}) {
  const { objects, moon, addShake = () => {}, pulseBloom = () => {} } = extras;
  let target = earth;
  let sphere = earth.mesh;

  const heatMat = createMagmaHeatMaterial();
  const heat = new THREE.Mesh(new THREE.SphereGeometry(1.022, 44, 30), heatMat);
  heat.raycast = () => {};
  sphere.add(heat);

  const craterTex = createCraterTexture();
  const scarRoot = new THREE.Group();
  sphere.add(scarRoot);

  // Exotic / Relativistic pierce-through plasma tunnel beam
  const pierceBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.22, 18, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x70f5ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  scene.add(pierceBeam);
  pierceBeam.visible = false;
  let pierceTime = 0;
  let heatTime = 0;

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
  const stormGroup = new THREE.Group();
  scene.add(stormGroup);
  const pulseGroup = new THREE.Group();
  scene.add(pulseGroup);

  // Glowing tidal & impact spark particle pool
  const SPARK_COUNT = 360;
  const sparkPos = new Float32Array(SPARK_COUNT * 3);
  const sparkCol = new Float32Array(SPARK_COUNT * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  const sparkMat = new THREE.PointsMaterial({
    size: 0.24,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.frustumCulled = false;
  sparkPoints.visible = false;
  scene.add(sparkPoints);
  const sparkPool = Array.from({ length: SPARK_COUNT }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    life: 0,
    maxLife: 1,
    r: 1,
    g: 0.6,
    b: 0.2,
    gravPull: false
  }));
  let sparkCursor = 0;

  function emitSpark(origin, velocity, colorHex, maxLife = 1.1, gravPull = false) {
    const s = sparkPool[sparkCursor];
    sparkCursor = (sparkCursor + 1) % SPARK_COUNT;
    s.active = true;
    s.pos.copy(origin);
    s.vel.copy(velocity);
    s.life = 0;
    s.maxLife = maxLife;
    const c = new THREE.Color(colorHex);
    s.r = c.r;
    s.g = c.g;
    s.b = c.b;
    s.gravPull = gravPull;
    sparkPoints.visible = true;
  }

  function clearSparks() {
    for (let i = 0; i < SPARK_COUNT; i++) {
      sparkPool[i].active = false;
      sparkPos[i * 3] = 0;
      sparkPos[i * 3 + 1] = -9999;
      sparkPos[i * 3 + 2] = 0;
      sparkCol[i * 3] = 0;
      sparkCol[i * 3 + 1] = 0;
      sparkCol[i * 3 + 2] = 0;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
    sparkPoints.visible = false;
  }

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

  let capturedBodies = []; // { id, mesh, pos, vel, baseScale, trail, swallowed, isEarth, isMoon, isRogue, colorHex }
  let bhActive = false;
  let bhMassVal = 8;
  let bhScale = 1;
  let bhPos = new THREE.Vector3();
  let bhOrigin = new THREE.Vector3();
  let bhAge = 0;
  let bhDriftPhase = 0;
  let earthWillShatter = false;
  let earthSwallowed = false;
  let grbTime = 0;
  let flashTime = 0;
  let storm = null;
  const activePulses = [];

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

  function clearStorm() {
    if (!storm) return;
    for (const m of storm.meteors) {
      if (m.mesh) {
        stormGroup.remove(m.mesh);
        m.mesh.geometry?.dispose();
        m.mesh.material?.dispose();
      }
      if (m.tail) {
        stormGroup.remove(m.tail);
        m.tail.geometry?.dispose();
        m.tail.material?.dispose();
      }
      if (m.trail) {
        trailGroup.remove(m.trail.line, m.trail.sparks);
        m.trail.dispose();
      }
    }
    storm = null;
  }

  function clearPulses() {
    for (const p of activePulses) {
      if (p.ring) {
        pulseGroup.remove(p.ring);
        p.ring.geometry?.dispose();
        p.ring.material?.dispose();
      }
      if (p.flash) {
        pulseGroup.remove(p.flash);
        p.flash.geometry?.dispose();
        p.flash.material?.dispose();
      }
    }
    activePulses.length = 0;
  }

  function addCraterAt(hitNormal, damage, tintHex = 0xffaa66) {
    localNormal.copy(hitNormal).applyQuaternion(sphere.getWorldQuaternion(new THREE.Quaternion()).invert());
    const radius = Math.min(0.62, 0.08 + damage * 0.42);
    // Soft feathered magma-crater decal blended organically onto the sphere surface
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2, radius * 2),
      new THREE.MeshBasicMaterial({
        map: craterTex,
        color: tintHex,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2
      })
    );
    mark.position.copy(localNormal).multiplyScalar(1.024);
    mark.quaternion.setFromUnitVectors(zAxis, localNormal);
    mark.rotateZ(Math.random() * Math.PI * 2);
    scarRoot.add(mark);
    while (scarRoot.children.length > 24) {
      const old = scarRoot.children[0];
      old.geometry?.dispose();
      old.material?.dispose();
      scarRoot.remove(old);
    }
  }

  function spawnImpactPulse(hitPos, hitNormal, scaleFactor = 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.76, 1.0, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffc67d,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    ring.position.copy(hitPos).addScaledVector(hitNormal, 0.04);
    ring.quaternion.setFromUnitVectors(zAxis, hitNormal);
    ring.scale.setScalar(0.12);

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.42 * scaleFactor, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffe4b8,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    flash.position.copy(hitPos);
    flash.scale.setScalar(0.25);

    pulseGroup.add(ring, flash);
    activePulses.push({
      ring,
      flash,
      age: 0,
      duration: 0.95 + scaleFactor * 0.35,
      scaleFactor,
      normal: hitNormal.clone()
    });
  }

  function capturePlanet(id, entry, gm, shatter) {
    if (capturedBodies.some(c => c.id === id)) return;
    const wPos = entry.mesh.getWorldPosition(new THREE.Vector3());
    scene.attach(entry.mesh);

    const toBh = bhPos.clone().sub(wPos);
    const dist = Math.max(1.8, toBh.length());
    const vKepler = Math.sqrt(gm / dist);
    const tiltAxis = new THREE.Vector3((Math.random() - 0.5) * 0.35, 1, (Math.random() - 0.5) * 0.35).normalize();
    const tang = new THREE.Vector3().crossVectors(toBh, tiltAxis).normalize();
    const speedRatio = id === target.body.id ? (shatter ? 0.78 : 0.96) : 0.8 + Math.random() * 0.12;
    const trail = createTrailRibbon(entry.body.color, id === target.body.id ? 88 : 68);
    trailGroup.add(trail.line, trail.sparks);

    capturedBodies.push({
      id,
      mesh: entry.mesh,
      pos: wPos,
      vel: tang.multiplyScalar(vKepler * speedRatio),
      baseScale: originalBodies.get(id).baseScale.clone(),
      trail,
      swallowed: false,
      isMoon: false,
      isEarth: id === target.body.id,
      isRogue: false,
      colorHex: entry.body.color,
      lockedToSafeOrbit: id === target.body.id && !shatter
    });
  }

  function initBlackHoleCapture(massMultiplier, shatter) {
    clearCapturedBodies();
    const earthWorld = sphere.getWorldPosition(new THREE.Vector3());
    const camDir = camera.position.clone().sub(earthWorld).normalize();
    const right = new THREE.Vector3().crossVectors(upVec, camDir).normalize();

    // Position the Black Hole dramatically in view near Earth
    bhPos.copy(earthWorld).addScaledVector(right, 6.2).addScaledVector(camDir, -2.4);
    bhPos.y = earthWorld.y + 0.4;
    bhOrigin.copy(bhPos);
    bhDriftPhase = 0;
    bhGroup.position.copy(bhPos);

    // Position spacetime grid centered under the Black Hole
    spacetimeGrid.position.set(bhPos.x, bhPos.y - 2.2, bhPos.z);
    spacetimeGrid.visible = true;
    gridMat.uniforms.uBhPos.value.copy(bhPos);

    const gm = 26 + massMultiplier * 2.4;

    // 1. Capture the Moon immediately for dramatic 3D Keplerian spiral + spaghettification
    if (moon) {
      const mPos = moon.position.clone();
      const toBh = bhPos.clone().sub(mPos);
      const mDist = Math.max(1.8, toBh.length());
      const vKepler = Math.sqrt(gm / mDist);
      const tiltAxis = new THREE.Vector3(0.22, 1, -0.18).normalize();
      const tang = new THREE.Vector3().crossVectors(toBh, tiltAxis).normalize();
      const trail = createTrailRibbon(0x9ce2ff, 80);
      trailGroup.add(trail.line, trail.sparks);
      capturedBodies.push({
        id: 'moon',
        mesh: moon,
        pos: mPos,
        vel: tang.multiplyScalar(vKepler * 0.84),
        baseScale: new THREE.Vector3(1, 1, 1),
        trail,
        swallowed: false,
        isMoon: true,
        isEarth: false,
        isRogue: false,
        colorHex: 0x9ce2ff
      });
    }

    // 2. Capture target planet & nearby planets (detaching temporarily to scene space for free 3D spiral orbits)
    const pullRadius = 22 + massMultiplier * 2.1;
    if (objects) {
      for (const [id, entry] of objects.entries()) {
        if (id === 'sun') continue;
        const wPos = entry.mesh.getWorldPosition(new THREE.Vector3());
        const dist = wPos.distanceTo(bhPos);
        if (id === target.body.id || dist < pullRadius) {
          capturePlanet(id, entry, gm, shatter);
        }
      }
    }

    // 3. Spawn 8 bright rogue planetoids/comets on varied 3D inclined Keplerian spirals
    const rogueColors = [0x78e6ff, 0xffb366, 0xd19aff, 0x8ef5c2, 0xff7e9d, 0xffe484, 0x6cb8ff, 0xff9d6e];
    for (let i = 0; i < rogueColors.length; i++) {
      const angle = (i / rogueColors.length) * Math.PI * 2 + 0.35;
      const dist = 5.4 + (i % 4) * 2.55;
      const elev = (i % 2 ? 1 : -1) * (0.7 + (i % 3) * 0.75);
      const rPos = bhPos.clone().add(new THREE.Vector3(Math.cos(angle) * dist, elev, Math.sin(angle) * dist));
      const rSize = 0.15 + (i % 3) * 0.08;
      const rMesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(rSize, 2),
        new THREE.MeshStandardMaterial({
          color: rogueColors[i],
          emissive: rogueColors[i],
          emissiveIntensity: 0.5,
          roughness: 0.65
        })
      );
      rMesh.position.copy(rPos);
      rogueGroup.add(rMesh);

      const toBh = bhPos.clone().sub(rPos);
      const rDist = Math.max(1.8, toBh.length());
      const vKepler = Math.sqrt(gm / rDist);
      const tiltAxis = new THREE.Vector3((i % 2 ? 0.3 : -0.25), 1, (i % 3 ? -0.22 : 0.28)).normalize();
      const tang = new THREE.Vector3().crossVectors(toBh, tiltAxis).normalize();
      const trail = createTrailRibbon(rogueColors[i], 64);
      trailGroup.add(trail.line, trail.sparks);

      capturedBodies.push({
        id: 'rogue-' + i,
        mesh: rMesh,
        pos: rPos,
        vel: tang.multiplyScalar(vKepler * (0.78 + (i % 3) * 0.06)),
        baseScale: new THREE.Vector3(1, 1, 1),
        trail,
        swallowed: false,
        isMoon: false,
        isEarth: false,
        isRogue: true,
        colorHex: rogueColors[i]
      });
    }
  }

  function impact(r, kind = 'asteroid', opts = {}) {
    result = r;
    age = 0;
    debris.visible = true;
    const ringNormal = normal.clone();
    const isExotic = ['needle', 'neutron', 'antimatter', 'tachyon'].includes(kind) || opts.ftl;
    const exoticColor = kind === 'antimatter' ? 0xd966ff : kind === 'tachyon' ? 0xff66d9 : 0x6ef2ff;

    addCraterAt(ringNormal, r.damage, isExotic ? exoticColor : 0xffaa66);
    if (isExotic && !r.fragment) {
      // Punch clean through the planet: exit wound + Cherenkov plasma tunnel!
      addCraterAt(ringNormal.clone().negate(), Math.min(1, r.damage * 1.15), exoticColor);
      pierceTime = 1.45;
      pierceBeam.visible = true;
      pierceBeam.material.color.setHex(exoticColor);
      pierceBeam.position.copy(center);
      pierceBeam.quaternion.setFromUnitVectors(upVec, ringNormal);
      pierceBeam.scale.set(1 + r.damage * 1.8, Math.max(1, target.body.size * 1.4), 1 + r.damage * 1.8);
    }

    totalHeat = Math.min(0.95, totalHeat + Math.max(0.08, r.damage - 0.2) * 0.72);
    heatMat.uniforms.uHeat.value = totalHeat;
    wave.material.color.setHex(isExotic ? exoticColor : 0xffc482);
    wave.quaternion.setFromUnitVectors(zAxis, ringNormal);
    sphere.visible = !r.fragment;

    // Emit fiery or Cherenkov spark burst from impact point
    const hitPoint = center.clone().addScaledVector(ringNormal, target.body.size);
    const exitPoint = center.clone().addScaledVector(ringNormal, -target.body.size);
    for (let i = 0; i < 28; i++) {
      const spread = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2.6);
      const fromExit = isExotic && i % 2 === 0;
      const dirSign = fromExit ? -1 : 1;
      const vel = ringNormal.clone().multiplyScalar(dirSign * (2.4 + Math.random() * 5.2)).add(spread);
      const sparkCol = isExotic ? (i % 3 === 0 ? 0xffffff : exoticColor) : (i % 2 ? 0xffb35c : 0xff6526);
      emitSpark(fromExit ? exitPoint : hitPoint, vel, sparkCol, 0.75 + Math.random() * 0.7, false);
    }

    // Cinematic impact flash, controlled bloom burst, and camera shake
    flashTime = 0.85;
    flashSphere.visible = true;
    flashSphere.material.color.setHex(isExotic ? exoticColor : 0xffe2b5);
    flashSphere.position.copy(center).addScaledVector(ringNormal, target.body.size * 0.92);
    flashSphere.scale.setScalar(0.35 * target.body.size);
    addShake(0.18 + r.damage * 0.75, 0.65 + r.damage * 0.85);
    pulseBloom(isExotic ? 1.5 : 1.0 + r.damage * 0.8);
  }

  function updateSparks(dt) {
    if (!sparkPoints.visible) return;
    let anyActive = false;
    const gm = 26 + bhMassVal * 2.4;
    for (let i = 0; i < SPARK_COUNT; i++) {
      const s = sparkPool[i];
      if (!s.active) {
        sparkCol[i * 3] = 0;
        sparkCol[i * 3 + 1] = 0;
        sparkCol[i * 3 + 2] = 0;
        continue;
      }
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        sparkPos[i * 3 + 1] = -9999;
        sparkCol[i * 3] = 0;
        sparkCol[i * 3 + 1] = 0;
        sparkCol[i * 3 + 2] = 0;
        continue;
      }
      anyActive = true;
      if (s.gravPull && bhActive) {
        tmpDir.copy(bhPos).sub(s.pos);
        const d = tmpDir.length();
        if (d < bhScale * 1.05) {
          s.active = false;
          sparkPos[i * 3 + 1] = -9999;
          continue;
        }
        tmpDir.multiplyScalar(1 / Math.max(d, 0.2));
        s.vel.addScaledVector(tmpDir, (gm * 1.25 / (d * d + 0.8)) * dt);
        s.vel.multiplyScalar(Math.pow(0.985, dt * 60));
      } else {
        s.vel.multiplyScalar(Math.pow(0.96, dt * 60));
      }
      s.pos.addScaledVector(s.vel, dt);
      const fade = Math.pow(1 - s.life / s.maxLife, 1.4);
      sparkPos[i * 3] = s.pos.x;
      sparkPos[i * 3 + 1] = s.pos.y;
      sparkPos[i * 3 + 2] = s.pos.z;
      sparkCol[i * 3] = s.r * fade * 1.65;
      sparkCol[i * 3 + 1] = s.g * fade * 1.65;
      sparkCol[i * 3 + 2] = s.b * fade * 1.65;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
    if (!anyActive) sparkPoints.visible = false;
  }

  function updatePulses(dt) {
    for (let i = activePulses.length - 1; i >= 0; i--) {
      const p = activePulses[i];
      p.age += dt;
      const t = clamp01(p.age / p.duration);
      const inv = 1 - t;
      p.ring.position.copy(center).addScaledVector(p.normal, target.body.size * 1.03);
      p.ring.scale.setScalar(0.12 * target.body.size + t * (1.5 + p.scaleFactor * 1.6) * target.body.size);
      p.ring.material.opacity = inv * inv * 0.78;
      p.flash.position.copy(center).addScaledVector(p.normal, target.body.size * 0.98);
      p.flash.scale.setScalar(0.2 * target.body.size + t * (1.8 * p.scaleFactor) * target.body.size);
      p.flash.material.opacity = inv * inv * 0.82;
      if (t >= 1) {
        pulseGroup.remove(p.ring, p.flash);
        p.ring.geometry?.dispose();
        p.ring.material?.dispose();
        p.flash.geometry?.dispose();
        p.flash.material?.dispose();
        activePulses.splice(i, 1);
      }
    }
  }

  function updateStorm(dt) {
    if (!storm) return;
    storm.elapsed += dt;
    let remaining = 0;

    for (const m of storm.meteors) {
      if (m.hit) continue;
      remaining++;
      if (storm.elapsed < m.delay) continue;

      if (!m.launched) {
        m.launched = true;
        m.mesh.visible = true;
        m.tail.visible = true;
      }

      m.flightTime += dt;
      const t = clamp01(m.flightTime / m.duration);
      const easeT = t * t * (0.45 + 0.55 * t); // Accelerating infall
      const dist = target.body.size + m.startDist * target.body.size * (1 - easeT);
      const arc = Math.sin(t * Math.PI) * m.arcAmp * target.body.size;

      tmpVec
        .copy(center)
        .addScaledVector(m.dir, dist)
        .addScaledVector(m.tangent, arc);
      m.mesh.position.copy(tmpVec);
      m.mesh.rotation.x += dt * 4.5;
      m.mesh.rotation.y += dt * 3.8;

      tmpDir.copy(tmpVec).sub(center).normalize();
      m.tail.position.copy(tmpVec).addScaledVector(tmpDir, 0.9 * target.body.size);
      m.tail.quaternion.setFromUnitVectors(upVec, tmpDir);
      m.trail.push(tmpVec, 0.65 + t * 0.35);

      if (t >= 1) {
        m.hit = true;
        remaining--;
        storm.struck++;

        // Remove meteor mesh & tail, dispose trail
        stormGroup.remove(m.mesh, m.tail);
        m.mesh.geometry?.dispose();
        m.mesh.material?.dispose();
        m.tail.geometry?.dispose();
        m.tail.material?.dispose();
        trailGroup.remove(m.trail.line, m.trail.sparks);
        m.trail.dispose();
        m.mesh = null;
        m.tail = null;
        m.trail = null;

        const hitDir = m.dir.clone().normalize();
        const hitPos = center.clone().addScaledVector(hitDir, target.body.size);
        const dmg = 0.14 + storm.intensity * 0.32;
        addCraterAt(hitDir, dmg);
        spawnImpactPulse(hitPos, hitDir, 0.65 + storm.intensity * 0.75);

        // Burst of fiery sparks from impact site
        const sparkN = 12 + Math.round(storm.intensity * 10);
        for (let k = 0; k < sparkN; k++) {
          const jitter = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2.4);
          const sVel = hitDir.clone().multiplyScalar(1.6 + Math.random() * 3.4).add(jitter);
          emitSpark(hitPos, sVel, k % 2 ? 0xffcb78 : 0xff5e1f, 0.55 + Math.random() * 0.5, false);
        }

        totalHeat = Math.min(0.95, totalHeat + 0.035 + storm.intensity * 0.055);
        heatMat.uniforms.uHeat.value = totalHeat;
        addShake(0.08 + storm.intensity * 0.18, 0.25 + storm.intensity * 0.16);
        pulseBloom(0.65 + storm.intensity * 0.5);

        storm.onStrike?.(storm.struck, storm.total);
      }
    }

    if (remaining === 0) {
      const doneCb = storm.onComplete;
      storm = null;
      doneCb?.();
    }
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
    const tidalRadius = 5.8 * bhScale;
    const gm = 26 + bhMassVal * 2.4;
    const pullRadius = 22 + bhMassVal * 2.1;

    // Dynamically pull in any nearby planet that enters the drifting Black Hole's sphere of influence
    if (objects) {
      for (const [id, entry] of objects.entries()) {
        if (id === 'sun') continue;
        if (capturedBodies.some(c => c.id === id)) continue;
        const wPos = entry.mesh.getWorldPosition(tmpVec);
        if (wPos.distanceTo(bhPos) < pullRadius) {
          capturePlanet(id, entry, gm, earthWillShatter);
        }
      }
    }

    const subSteps = 4;
    const h = dt / subSteps;

    for (const item of capturedBodies) {
      if (item.swallowed) continue;

      let dist = 10;
      for (let step = 0; step < subSteps; step++) {
        tmpDir.copy(bhPos).sub(item.pos);
        dist = tmpDir.length();
        const invDist = 1 / Math.max(dist, 0.001);
        tmpDir.multiplyScalar(invDist);

        // Softened Newtonian pull for smooth Keplerian curves
        const accel = gm / (dist * dist + 1.15);
        item.vel.addScaledVector(tmpDir, accel * h);

        if (item.lockedToSafeOrbit) {
          // Keep Earth in an exhilarating perturbed 3D Keplerian tidal orbit without swallowing
          const safeR = tidalRadius * 0.84;
          const radialVel = item.vel.dot(tmpDir);
          if (dist < safeR) {
            const cushion = (safeR - dist) * 6.5;
            item.vel.addScaledVector(tmpDir, -cushion * h);
            if (radialVel > 0) item.vel.addScaledVector(tmpDir, -radialVel * 3.2 * h);
          } else if (dist > safeR * 2.1) {
            item.vel.addScaledVector(tmpDir, (dist - safeR * 2.1) * 0.8 * h);
          }
          // Gently steer speed toward local Keplerian velocity so orbit stays graceful
          const targetV = Math.sqrt(gm / Math.max(dist, safeR * 0.8));
          const speedNow = item.vel.length();
          if (speedNow > 0.01) {
            const blend = 1 + clamp01(h * 1.4) * (targetV / speedNow - 1);
            item.vel.multiplyScalar(blend);
          }
        } else {
          // Subtle frame-dragging swirl near the ergosphere + smooth orbital decay
          if (dist < tidalRadius * 1.35) {
            tmpVec.set(-tmpDir.z, 0.08 * tmpDir.y, tmpDir.x).normalize();
            item.vel.addScaledVector(tmpVec, (gm * 0.045 / (dist + 0.8)) * h);
          }
          const drag = dist < tidalRadius ? 0.982 : 0.994;
          item.vel.multiplyScalar(Math.pow(drag, h * 60));
        }

        item.pos.addScaledVector(item.vel, h);
      }

      item.mesh.position.copy(item.pos);

      // Recompute final radial vector for tidal alignment
      tmpDir.copy(bhPos).sub(item.pos);
      dist = tmpDir.length();
      tmpDir.multiplyScalar(1 / Math.max(dist, 0.001));

      // Tidal stretching (Spaghettification!) as body enters tidal radius
      const prox = clamp01(1 - (dist - ehRadius) / Math.max(0.5, tidalRadius - ehRadius));
      if (prox > 0.02) {
        const stretch = 1 + Math.pow(prox, 1.75) * (item.lockedToSafeOrbit ? 0.65 : 4.9);
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
          item.mesh.material.emissive.setRGB(1.0 * prox, 0.42 * prox, 0.14 * prox);
          item.mesh.material.emissiveIntensity = prox * 2.35;
        }
        // Shed glowing tidal sparks ripped toward the accretion disk
        if (prox > 0.16 && Math.random() < prox * 0.65) {
          const sparkVel = item.vel.clone().multiplyScalar(0.55)
            .addScaledVector(tmpDir, 1.8 + prox * 3.5)
            .add(new THREE.Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 1.4));
          emitSpark(item.pos, sparkVel, prox > 0.6 ? 0xffb86b : (item.colorHex || 0x8be2ff), 0.75 + Math.random() * 0.55, true);
        }
      } else {
        item.mesh.scale.copy(item.baseScale);
      }

      // Push glowing spiral trail point
      item.trail.push(item.pos, prox);

      // Swallowed at the Event Horizon!
      if (!item.lockedToSafeOrbit && dist <= ehRadius * 1.18) {
        item.swallowed = true;
        item.mesh.visible = false;
        // Dramatic flare burst of accretion sparks on swallow
        const burstN = item.isEarth ? 36 : 16;
        for (let k = 0; k < burstN; k++) {
          const ang = (k / burstN) * Math.PI * 2;
          const bVel = new THREE.Vector3(Math.cos(ang) * 4.2, (Math.random() - 0.5) * 2.4, Math.sin(ang) * 4.2);
          emitSpark(item.pos, bVel, k % 2 ? 0xffd28a : (item.colorHex || 0xff7b42), 0.9 + Math.random() * 0.6, true);
        }
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
    setTarget(entry) {
      if (!entry || entry === target) return;
      // Cleanly re-parent surface overlays to the newly selected planet
      sphere.remove(heat, scarRoot, shieldDome);
      for (const mark of [...scarRoot.children]) {
        mark.geometry?.dispose();
        mark.material?.dispose();
        scarRoot.remove(mark);
      }
      target = entry;
      sphere = entry.mesh;
      sphere.add(heat, scarRoot, shieldDome);
      totalHeat = 0;
      heatMat.uniforms.uHeat.value = 0;
      shieldDome.material.opacity = 0;
      result = null;
      earthWillShatter = false;
      earthSwallowed = false;
    },
    launch(r, kind, onHit, opts = {}) {
      sphere.getWorldPosition(center);
      normal.copy(camera.position).sub(center).normalize();
      const isFastExotic = ['needle', 'neutron', 'antimatter', 'tachyon'].includes(kind) || opts.ftl;
      const duration = kind === 'tachyon' ? 0.45 : isFastExotic ? 1.15 : 2.35;
      flight = { time: 0, duration, r, kind, onHit, opts };
      rock.visible = true;
      tail.visible = true;
      const tSize = target.body.size;
      const scale =
        kind === 'needle' ? 0.08 * tSize :
        kind === 'neutron' ? 0.24 * tSize :
        kind === 'antimatter' ? 0.34 * tSize :
        kind === 'tachyon' ? 0.16 * tSize :
        kind === 'moon' ? tSize * 0.52 :
        Math.max(0.18, r.damage * 0.72) * tSize;
      rock.scale.setScalar(scale);
      const col =
        kind === 'needle' ? 0x9cf4ff :
        kind === 'neutron' ? 0xd8f3ff :
        kind === 'antimatter' ? 0xe070ff :
        kind === 'tachyon' ? 0xff70e0 :
        kind === 'moon' ? 0xb4b1a6 : 0x91867b;
      rock.material.color.setHex(col);
      rock.material.emissive.setHex(isFastExotic ? col : 0x6b220a);
      rock.material.emissiveIntensity = isFastExotic ? 2.2 : 0.9;
      tail.material.color.setHex(isFastExotic ? col : 0xffaa5c);
      tail.scale.set(isFastExotic ? 1.1 : 0.85, isFastExotic ? 2.4 : 1.0, isFastExotic ? 1.1 : 0.85);
    },
    launchStorm(count = 9, onStrike, onComplete, intensity = 0.55) {
      clearStorm();
      sphere.getWorldPosition(center);
      const total = Math.max(1, Math.min(24, Math.round(Number(count) || 9)));
      const clampedInt = clamp01(Number.isFinite(intensity) ? intensity : 0.55);

      const camDir = camera.position.clone().sub(center).normalize();
      const right = new THREE.Vector3().crossVectors(upVec, camDir);
      if (right.lengthSq() < 0.001) right.set(1, 0, 0);
      right.normalize();
      const camUp = new THREE.Vector3().crossVectors(camDir, right).normalize();

      const meteors = [];
      for (let i = 0; i < total; i++) {
        // Golden-angle distribution across 3D directions biased toward visible hemisphere
        const phi = i * 2.39996 + Math.random() * 0.45;
        const spread = 0.28 + Math.random() * 0.92;
        const dir = camDir.clone()
          .multiplyScalar(0.65 + Math.random() * 0.55)
          .addScaledVector(right, Math.cos(phi) * spread)
          .addScaledVector(camUp, Math.sin(phi) * spread)
          .normalize();

        const tangent = new THREE.Vector3().crossVectors(dir, upVec);
        if (tangent.lengthSq() < 0.001) tangent.set(1, 0, 0);
        tangent.normalize();

        const size = 0.10 + clampedInt * 0.13 + Math.random() * 0.05;
        const mMesh = new THREE.Mesh(
          new THREE.IcosahedronGeometry(size, 1),
          new THREE.MeshStandardMaterial({
            color: 0xffd1a3,
            emissive: 0xff6b1c,
            emissiveIntensity: 1.6,
            roughness: 0.6
          })
        );
        mMesh.visible = false;

        const mTail = new THREE.Mesh(
          new THREE.ConeGeometry(size * 1.15, 2.1 + clampedInt * 1.2, 12, 1, true),
          new THREE.MeshBasicMaterial({
            color: 0xffa64d,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
          })
        );
        mTail.visible = false;
        stormGroup.add(mMesh, mTail);

        const trail = createTrailRibbon(i % 2 ? 0xff9b42 : 0xffd27d, 26);
        trailGroup.add(trail.line, trail.sparks);

        const baseDelay = total > 1 ? (i / (total - 1)) * 3.05 : 0;
        const jitter = total > 1 ? (Math.random() - 0.5) * 0.18 : 0;
        meteors.push({
          dir,
          tangent,
          startDist: 10.5 + Math.random() * 4.5,
          arcAmp: (i % 2 ? 1 : -1) * (1.2 + Math.random() * 1.4),
          delay: Math.max(0, baseDelay + jitter),
          duration: 0.76 + Math.random() * 0.26,
          flightTime: 0,
          launched: false,
          hit: false,
          mesh: mMesh,
          tail: mTail,
          trail
        });
      }

      storm = {
        meteors,
        elapsed: 0,
        struck: 0,
        total,
        intensity: clampedInt,
        onStrike,
        onComplete
      };
    },
    getCraterCount() {
      return scarRoot.children.length;
    },
    reset() {
      flight = null;
      clearStorm();
      clearPulses();
      clearSparks();
      result = null;
      age = 0;
      totalHeat = 0;
      heatMat.uniforms.uHeat.value = 0;
      sphere.visible = true;
      debris.visible = false;
      rock.visible = false;
      tail.visible = false;
      wave.material.opacity = 0;
      flashTime = 0;
      flashSphere.visible = false;
      pierceTime = 0;
      pierceBeam.visible = false;
      bhActive = false;
      bhAge = 0;
      bhDriftPhase = 0;
      earthWillShatter = false;
      earthSwallowed = false;
      bhGroup.visible = false;
      bhLight.intensity = 0;
      jetMat.opacity = 0;
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
      bhDriftPhase = 0;
      earthWillShatter = shatter;
      earthSwallowed = false;
      bhScale = Math.max(0.65, Math.min(2.35, 0.55 + massMultiplier * 0.036));
      bhGroup.visible = true;
      bhGroup.scale.setScalar(0.05); // Smooth dramatic expansion animation in update()
      bhLensingMat.uniforms.uMass.value = clamp01(massMultiplier / 35);
      jetMat.opacity = massMultiplier >= 14 ? Math.min(0.42, (massMultiplier - 12) * 0.014) : 0;
      bhLight.intensity = 140 + massMultiplier * 10;

      initBlackHoleCapture(massMultiplier, shatter);

      if (!shatter) {
        totalHeat = Math.min(0.85, totalHeat + massMultiplier * 0.015);
        heatMat.uniforms.uHeat.value = totalHeat;
      }

      addShake(0.32 + massMultiplier * 0.015, 1.35);
      pulseBloom(1.3 + massMultiplier * 0.02);
    },
    fireGRB(shieldPct, heatAdd) {
      sphere.getWorldPosition(center);
      normal.copy(camera.position).sub(center).normalize();
      grbTime = 4.2;
      grbGroup.visible = true;
      shieldDome.material.opacity = shieldPct > 0 ? Math.min(0.72, (shieldPct / 100) * 0.8) : 0;
      totalHeat = Math.min(0.95, totalHeat + heatAdd);
      heatMat.uniforms.uHeat.value = totalHeat;
      addShake(0.45 * (1 - (shieldPct / 100) * 0.6), 1.1);
      pulseBloom(1.4);
    },
    setShield(pct) {
      shieldDome.material.opacity = pct > 0 ? Math.min(0.55, (pct / 100) * 0.6) : 0;
    },
    setEnvironmentalHeat(value) {
      heatMat.uniforms.uHeat.value = Math.max(totalHeat, value);
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
      heatTime += dt;
      heatMat.uniforms.uTime.value = heatTime;

      if (flight) {
        flight.time += dt;
        const dur = flight.duration || 2.35;
        const t = Math.min(1, flight.time / dur);
        const tangent = new THREE.Vector3().crossVectors(normal, upVec).normalize();
        const tSize = target.body.size;
        const startOff = 7.5 * tSize;
        rock.position.copy(center).addScaledVector(normal, tSize + startOff * (1 - t)).addScaledVector(tangent, -startOff * 0.72 * (1 - t));
        rock.rotation.x += dt * 2;
        rock.rotation.y += dt * 2.4;
        tail.position.copy(rock.position).addScaledVector(normal, 1.35 * tSize);
        tail.quaternion.setFromUnitVectors(upVec, normal);
        if (t >= 1) {
          const f = flight;
          flight = null;
          rock.visible = false;
          tail.visible = false;
          impact(f.r, f.kind, f.opts);
          f.onHit();
        }
      }

      if (pierceTime > 0) {
        pierceTime = Math.max(0, pierceTime - dt);
        const fade = pierceTime / 1.45;
        pierceBeam.position.copy(center);
        pierceBeam.material.opacity = fade * fade * 0.85;
        if (pierceTime === 0) pierceBeam.visible = false;
      }

      if (dt > 0) {
        updateStorm(dt);
        updatePulses(dt);
        updateSparks(dt);
      }

      if (flashTime > 0) {
        flashTime = Math.max(0, flashTime - dt);
        const p = 1 - flashTime / 0.85;
        flashSphere.scale.setScalar((0.35 + p * 3.4) * target.body.size);
        flashSphere.material.opacity = (1 - p) * (1 - p) * 0.85;
        if (flashTime === 0) flashSphere.visible = false;
      }

      if (bhActive) {
        bhAge += dt;
        const easeIn = clamp01(bhAge / 1.15);
        const smoothScale = bhScale * (1 - Math.pow(1 - easeIn, 3));
        bhGroup.scale.setScalar(Math.max(0.05, smoothScale));

        // Gentle orbital-plane drift of the Black Hole while perturbing nearby planets & moons
        if (dt > 0) {
          bhDriftPhase += dt * (0.26 + Math.min(0.24, bhMassVal * 0.0055));
          const driftR = 1.85 + Math.min(2.6, bhMassVal * 0.055);
          const driftRamp = clamp01(bhAge / 2.0);
          bhPos.set(
            bhOrigin.x + Math.sin(bhDriftPhase) * driftR * driftRamp,
            bhOrigin.y + Math.sin(bhDriftPhase * 1.65) * 0.52 * driftRamp,
            bhOrigin.z + (Math.cos(bhDriftPhase * 0.85) - 1) * driftR * 0.85 * driftRamp
          );
          bhGroup.position.copy(bhPos);
          spacetimeGrid.position.set(bhPos.x, bhPos.y - 2.2, bhPos.z);
          if (earthSwallowed) debris.position.copy(bhPos);
        }

        // Subtle relativistic disk precession & polar jet pulsation
        bhDisk.rotation.x = Math.PI * 0.41 + Math.sin(bhAge * 0.65) * 0.055;
        bhDisk.rotation.y = 0.18 + Math.cos(bhAge * 0.48) * 0.075;
        if (bhMassVal >= 14) {
          const baseJet = Math.min(0.45, (bhMassVal - 12) * 0.015);
          jetMat.opacity = baseJet * (0.82 + 0.18 * Math.sin(bhAge * 5.2)) * easeIn;
        }
        bhLight.intensity = (180 + bhMassVal * 14) * (0.92 + 0.08 * Math.sin(bhAge * 6.5)) * easeIn;

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
            dummy.position.copy(dirs[i]).multiplyScalar(target.body.size + spread * (0.4 + (i % 13) / 13));
            if (!result.fragment) dummy.position.multiplyScalar(0.45).addScaledVector(normal, target.body.size * 0.8);
          }
          dummy.rotation.set(age * (i % 5) * 0.2, i + age * 0.12, age * 0.3);
          dummy.scale.setScalar(result.fragment ? 1.35 + (i % 9) * 0.35 : Math.max(0.01, 1 - age / 12) * (0.3 + (i % 7) * 0.1));
          dummy.updateMatrix();
          fragments.setMatrixAt(i, dummy.matrix);
        }
        fragments.instanceMatrix.needsUpdate = true;
        if (!result.fragment && age > 12) debris.visible = false;
        wave.position.copy(center).addScaledVector(normal, target.body.size * 1.025);
        wave.scale.setScalar((0.1 + age * (1 + result.damage * 2.2)) * target.body.size);
        wave.material.opacity = Math.max(0, 0.72 - age * 0.22);
      }
    },
    get busy() {
      return !!(flight || storm);
    },
    get destroyed() {
      return !!(result?.fragment || earthWillShatter || earthSwallowed);
    }
  };
}
