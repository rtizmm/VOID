import * as THREE from 'three';

const NOISE_GLSL = `
float h21(vec2 p){
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float n2(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
    mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm2(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 4; i++){
    v += a * n2(p);
    p = p * 2.04 + vec2(1.7, -1.2);
    a *= 0.5;
  }
  return v;
}
`;

// Generates a realistic procedural continent-clustered city lights mask for Earth's night side
function createCityLightsTexture() {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 384;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 768, 384);

  // Match Earth's schematic continent polygons so city lights sit on land
  const regions = [
    { cx: 0.17, cy: 0.27, rx: 0.075, ry: 0.085, n: 170 }, // North America
    { cx: 0.28, cy: 0.62, rx: 0.036, ry: 0.14, n: 90 },   // South America
    { cx: 0.50, cy: 0.25, rx: 0.055, ry: 0.06, n: 210 },  // Europe
    { cx: 0.52, cy: 0.48, rx: 0.055, ry: 0.12, n: 95 },   // Africa
    { cx: 0.72, cy: 0.30, rx: 0.13, ry: 0.11, n: 320 },   // Asia
    { cx: 0.85, cy: 0.70, rx: 0.045, ry: 0.05, n: 55 }    // Australia
  ];
  let seed = 918273;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (const reg of regions) {
    // Major metro hubs
    for (let h = 0; h < 6; h++) {
      const hx = (reg.cx + (rng() - 0.5) * reg.rx * 1.4) * 768;
      const hy = (reg.cy + (rng() - 0.5) * reg.ry * 1.4) * 384;
      const grad = ctx.createRadialGradient(hx, hy, 0.5, hx, hy, 6 + rng() * 8);
      grad.addColorStop(0, 'rgba(255, 224, 148, 0.95)');
      grad.addColorStop(0.45, 'rgba(255, 178, 86, 0.45)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(hx, hy, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fine city clusters
    for (let i = 0; i < reg.n; i++) {
      const a = rng() * Math.PI * 2;
      const rad = Math.pow(rng(), 0.65);
      const x = (reg.cx + Math.cos(a) * reg.rx * rad) * 768;
      const y = (reg.cy + Math.sin(a) * reg.ry * rad) * 384;
      const r = 0.7 + rng() * 1.9;
      ctx.fillStyle = rng() > 0.35 ? 'rgba(255, 214, 130, 0.85)' : 'rgba(255, 165, 85, 0.72)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createEarthNightLights(earthMesh) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: createCityLightsTexture() },
      uSunPos: { value: new THREE.Vector3(0, 0, 0) },
      uAlive: { value: 1.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uSunPos;
      uniform float uAlive;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main(){
        if(uAlive <= 0.01) discard;
        vec3 toSun = normalize(uSunPos - vWorldPos);
        float ndotl = dot(normalize(vWorldNormal), toSun);
        // Smooth night-side mask across the terminator (edge0 < edge1)
        float nightMask = 1.0 - smoothstep(-0.18, 0.14, ndotl);
        vec3 city = texture2D(uMap, vUv).rgb;
        float lum = max(city.r, max(city.g, city.b));
        if(lum * nightMask * uAlive < 0.02) discard;
        // Keep below 0.92 bloom threshold for crisp golden pinpoint city lights
        gl_FragColor = vec4(city * 0.82 * nightMask * uAlive, clamp(lum * nightMask * uAlive, 0.0, 0.92));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.005, 48, 32), mat);
  mesh.raycast = () => {};
  earthMesh.add(mesh);
  return { mesh, mat };
}

export function createEarthAurora(earthMesh) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBoost: { value: 1.0 }
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
      uniform float uTime;
      uniform float uBoost;
      varying vec3 vObjPos;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      ${NOISE_GLSL}
      void main(){
        float absY = abs(vObjPos.y);
        // Polar oval band around magnetic poles (lat ~66-80 deg)
        float band = smoothstep(0.84, 0.915, absY) * (1.0 - smoothstep(0.935, 0.985, absY));
        if(band < 0.01) discard;
        float lon = atan(vObjPos.z, vObjPos.x);
        float wave1 = fbm2(vec2(lon * 3.5 + uTime * 0.35, absY * 18.0 - uTime * 0.45));
        float curtains = smoothstep(0.32, 0.82, wave1) * (0.6 + 0.4 * sin(lon * 11.0 - uTime * 2.2));
        float rim = 0.45 + 0.55 * pow(1.0 - abs(dot(normalize(vNormalDir), normalize(vViewDir))), 1.6);
        vec3 green = vec3(0.18, 0.88, 0.52);
        vec3 violet = vec3(0.55, 0.28, 0.92);
        vec3 col = mix(green, violet, smoothstep(0.88, 0.95, absY)) * (0.72 * uBoost);
        float alpha = clamp(band * curtains * rim * 0.78 * uBoost, 0.0, 0.85);
        if(alpha < 0.015) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.048, 48, 32), mat);
  mesh.raycast = () => {};
  earthMesh.add(mesh);
  return { mesh, mat };
}

function createSupernovaShellMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 }
    },
    vertexShader: `
      varying vec3 vPos;
      varying vec3 vN;
      varying vec3 vV;
      void main(){
        vPos = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uProgress;
      varying vec3 vPos;
      varying vec3 vN;
      varying vec3 vV;
      ${NOISE_GLSL}
      void main(){
        float p = clamp(uProgress, 0.0, 1.0);
        vec2 uv = vec2(atan(vPos.z, vPos.x) * 2.2, acos(clamp(vPos.y, -1.0, 1.0)) * 2.5);
        float fil = fbm2(uv * 3.2 + vec2(uTime * 0.25, -uTime * 0.18));
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.7);
        vec3 cyan = vec3(0.28, 0.95, 1.25);
        vec3 magenta = vec3(1.18, 0.32, 0.82);
        vec3 gold = vec3(1.35, 0.82, 0.25);
        vec3 col = mix(gold, cyan, smoothstep(0.05, 0.55, p));
        col = mix(col, magenta, smoothstep(0.35, 0.88, fil));
        float fade = (1.0 - smoothstep(0.55, 1.0, p)) * smoothstep(0.0, 0.06, p);
        float alpha = clamp((0.35 + fil * 0.75) * (0.45 + rim * 0.9) * fade, 0.0, 0.88);
        if(alpha < 0.01) discard;
        gl_FragColor = vec4(col * (0.85 + (1.0 - p) * 0.7), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
}

export function createCosmosExtras({
  scene,
  objects,
  pickables = [],
  sun,
  earth,
  light,
  sunFill,
  ambient,
  addShake = () => {},
  pulseBloom = () => {},
  playSfx = () => {},
  textureFactory
}) {
  const originalLight = { light: light.intensity, fill: sunFill.intensity, ambient: ambient.intensity };
  const nightLights = createEarthNightLights(earth.mesh);
  const aurora = createEarthAurora(earth.mesh);

  // === SUPERNOVA & PULSAR (NEUTRON STAR) STATE ===
  const snGroup = new THREE.Group();
  scene.add(snGroup);
  snGroup.visible = false;

  const snShellMat = createSupernovaShellMaterial();
  const snShell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), snShellMat);
  const snWave = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1.0, 96),
    new THREE.MeshBasicMaterial({ color: 0x7ef2ff, side: THREE.DoubleSide, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  snWave.rotation.x = -Math.PI / 2;

  // Spinning Pulsar remnant (dense blue-white neutron star + twin tilted lighthouse jets)
  const pulsarGroup = new THREE.Group();
  pulsarGroup.visible = false;
  const pulsarCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xdff7ff })
  );
  const pulsarHalo = new THREE.Mesh(
    new THREE.SphereGeometry(1.55, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x6ce5ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  const beamGeo = new THREE.ConeGeometry(1.85, 85, 24, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x8ef2ff,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const beamA = new THREE.Mesh(beamGeo, beamMat);
  beamA.position.y = 43;
  beamA.rotation.x = Math.PI;
  const beamB = new THREE.Mesh(beamGeo, beamMat);
  beamB.position.y = -43;
  const pulsarTilt = new THREE.Group();
  pulsarTilt.rotation.z = 0.58; // Magnetic axis offset from rotation axis -> lighthouse sweep!
  pulsarTilt.add(beamA, beamB);
  const pulsarLight = new THREE.PointLight(0x88e8ff, 0, 320, 1.2);
  pulsarGroup.add(pulsarCore, pulsarHalo, pulsarTilt, pulsarLight);

  snGroup.add(snShell, snWave, pulsarGroup);
  let supernova = null; // { phase: 'swell'|'remnant', age, onDetonate }

  // === PLANET <-> PLANET COLLISION + DEBRIS RING STATE ===
  const collisionGroup = new THREE.Group();
  scene.add(collisionGroup);
  const debrisRings = [];
  let activeCollision = null;
  const savedOriginals = new Map();
  for (const [id, entry] of objects.entries()) {
    savedOriginals.set(id, {
      pivot: entry.pivot,
      localPos: entry.mesh.position.clone(),
      scale: entry.mesh.scale.clone(),
      rotZ: entry.mesh.rotation.z
    });
  }

  function spawnDebrisRing(hostMesh, hostSize, colorHex) {
    const ringGroup = new THREE.Group();
    ringGroup.rotation.x = 0.18 + Math.random() * 0.25;
    ringGroup.rotation.z = (Math.random() - 0.5) * 0.3;

    // Glowing molten dust disk
    const dustRing = new THREE.Mesh(
      new THREE.RingGeometry(1.38, 2.55, 96),
      new THREE.MeshBasicMaterial({
        color: 0xff8d42,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    dustRing.rotation.x = -Math.PI / 2;
    ringGroup.add(dustRing);

    // 260 tumbling instanced rocky/molten fragments orbiting the surviving planet
    const COUNT = 260;
    const chunkGeo = new THREE.DodecahedronGeometry(0.055, 0);
    const chunkMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: 0xff5a18,
      emissiveIntensity: 0.75,
      roughness: 0.88
    });
    const inst = new THREE.InstancedMesh(chunkGeo, chunkMat, COUNT);
    const d = new THREE.Object3D();
    for (let i = 0; i < COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2 + Math.random() * 0.3;
      const r = 1.42 + Math.random() * 1.15;
      const y = (Math.random() - 0.5) * 0.12;
      d.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      d.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const s = 0.45 + Math.random() * 1.25;
      d.scale.set(s, s * 0.75, s * 0.9);
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    ringGroup.add(inst);
    hostMesh.add(ringGroup);
    debrisRings.push({ hostMesh, ringGroup, dustRing, inst, chunkGeo, chunkMat });
  }

  // === CUSTOM CREATOR BODIES (PLANETS & BINARY STARS — FIRST-CLASS SOLAR SYSTEM CITIZENS!) ===
  const customGroup = new THREE.Group();
  scene.add(customGroup);
  const customBodies = [];
  let customSeq = 0;

  function spawnCustomBody({
    kind = 'planet',
    name = '',
    size = 1.3,
    distance = 35,
    color = 0x56c8ff,
    hasRings = true,
    hasAtmo = true,
    orbitMult = 1.0,
    temp = null,
    pop = 0
  }) {
    customSeq++;
    const id = `custom-${customSeq}`;
    const safeSize = Math.max(0.35, Math.min(kind === 'star' ? 6.5 : 4.2, Number(size) || 1.3));
    const safeDist = Math.max(10, Math.min(105, Number(distance) || 35));
    const safeOrbitMult = Math.max(0.1, Math.min(4.0, Number(orbitMult) || 1.0));
    const colHex = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) || 0x56c8ff : color;
    const displayName = (name && String(name).trim()) || (kind === 'star' ? `Yıldız #${customSeq}` : `Gezegen #${customSeq}`);
    const baseTemp = Number.isFinite(Number(temp)) ? Math.round(Number(temp)) : kind === 'star' ? 6200 : Math.round(280 / Math.sqrt(safeDist / 10) - 180);

    const pivot = new THREE.Group();
    pivot.rotation.y = Math.random() * Math.PI * 2;
    pivot.rotation.x = (Math.random() - 0.5) * 0.14;
    customGroup.add(pivot);

    // Orbit ring
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i * Math.PI * 2) / 160;
      pts.push(new THREE.Vector3(Math.cos(a) * safeDist, 0, Math.sin(a) * safeDist));
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const orbitMat = new THREE.LineBasicMaterial({
      color: colHex,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
    pivot.add(orbitLine);

    const meshGeo = new THREE.SphereGeometry(1, 40, 28);
    let meshMat;
    if (kind === 'star') {
      meshMat = new THREE.MeshBasicMaterial({ color: colHex });
    } else {
      const tex = textureFactory ? textureFactory({ id, color: colHex }) : null;
      meshMat = new THREE.MeshStandardMaterial({ map: tex, color: tex ? 0xffffff : colHex, roughness: 0.92, metalness: 0.04 });
    }
    const mesh = new THREE.Mesh(meshGeo, meshMat);
    mesh.scale.setScalar(safeSize);
    mesh.position.x = safeDist;
    mesh.userData.id = id;
    pivot.add(mesh);

    let ringMesh = null;
    if (kind === 'star') {
      const starLight = new THREE.PointLight(colHex, 1400, 260, 1.3);
      mesh.add(starLight);
      const glowMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.24, 24, 16),
        new THREE.MeshBasicMaterial({ color: colHex, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      glowMesh.raycast = () => {};
      mesh.add(glowMesh);
    } else {
      if (hasAtmo) {
        const atmoColor = new THREE.Color(colHex);
        const atmoMesh = new THREE.Mesh(
          new THREE.SphereGeometry(1.06, 32, 22),
          new THREE.ShaderMaterial({
            uniforms: { uColor: { value: atmoColor } },
            vertexShader: `varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
            fragmentShader: `varying vec3 n;varying vec3 v;uniform vec3 uColor;void main(){float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),2.8);gl_FragColor=vec4(uColor*0.85,rim*0.38);}`,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
          })
        );
        atmoMesh.raycast = () => {};
        mesh.add(atmoMesh);
      }
      ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(1.32, 2.15, 72),
        new THREE.MeshStandardMaterial({
          color: colHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.52,
          roughness: 0.95,
          depthWrite: false
        })
      );
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.raycast = () => {};
      ringMesh.visible = Boolean(hasRings);
      mesh.rotation.z = hasRings ? 0.28 : 0;
      mesh.add(ringMesh);
    }

    const baseOrbit = (kind === 'star' ? 0.008 : 0.012) * Math.sqrt(25 / safeDist);
    const orbit = baseOrbit * safeOrbitMult;
    const body = {
      id,
      name: displayName,
      category: kind === 'star' ? 'ÖZEL YILDIZ' : 'ÖZEL GEZEGEN',
      icon: kind === 'star' ? '⭐' : '🪐',
      color: colHex,
      size: safeSize,
      distance: safeDist,
      orbit,
      spin: kind === 'star' ? 0.004 : 0.012,
      subtitle: kind === 'star' ? 'Kullanıcı yapımı yoldaş yıldız' : 'Kullanıcı yapımı gezegen',
      diameter: `${Math.round(safeSize * 12000).toLocaleString('tr-TR')} km`,
      temp: `${baseTemp}°C`,
      moons: '0',
      period: `${Math.round(safeDist * 14)} gün`,
      description: 'Sistem Kurucu ile oluşturulan ve tüm fizik / kara delik olaylarına katılan özel gök cismi.',
      isCustom: true,
      isStar: kind === 'star'
    };

    const objEntry = { body, pivot, mesh };
    objects.set(id, objEntry);
    pickables.push(mesh);
    savedOriginals.set(id, {
      pivot,
      localPos: mesh.position.clone(),
      scale: mesh.scale.clone(),
      rotZ: mesh.rotation.z
    });

    const rec = {
      id,
      kind,
      name: displayName,
      body,
      objEntry,
      pivot,
      mesh,
      ringMesh,
      orbitLine,
      baseOrbit,
      orbitMult: safeOrbitMult,
      temp: baseTemp,
      pop: Math.max(0, Math.round(Number(pop) || 0)),
      hasRings: Boolean(hasRings)
    };
    customBodies.push(rec);
    return rec;
  }

  function updateCustomBody(id, patch = {}) {
    const rec = customBodies.find(b => b.id === id);
    if (!rec) return null;
    if (patch.name !== undefined) {
      const clean = String(patch.name).trim();
      if (clean) {
        rec.name = clean;
        rec.body.name = clean;
      }
    }
    if (patch.size !== undefined) {
      const s = Math.max(0.35, Math.min(rec.kind === 'star' ? 6.5 : 4.2, Number(patch.size) || rec.body.size));
      rec.body.size = s;
      rec.body.diameter = `${Math.round(s * 12000).toLocaleString('tr-TR')} km`;
      rec.mesh.scale.setScalar(s);
      const orig = savedOriginals.get(id);
      if (orig) orig.scale.setScalar(s);
    }
    if (patch.distance !== undefined) {
      const d = Math.max(10, Math.min(105, Number(patch.distance) || rec.body.distance));
      rec.body.distance = d;
      rec.body.period = `${Math.round(d * 14)} gün`;
      if (rec.mesh.parent === rec.pivot) rec.mesh.position.x = d;
      const orig = savedOriginals.get(id);
      if (orig) orig.localPos.set(d, 0, 0);
      const pts = [];
      for (let i = 0; i <= 160; i++) {
        const a = (i * Math.PI * 2) / 160;
        pts.push(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d));
      }
      rec.orbitLine.geometry.dispose();
      rec.orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      rec.baseOrbit = (rec.kind === 'star' ? 0.008 : 0.012) * Math.sqrt(25 / d);
      rec.body.orbit = rec.baseOrbit * rec.orbitMult;
    }
    if (patch.orbitMult !== undefined) {
      rec.orbitMult = Math.max(0.1, Math.min(4.0, Number(patch.orbitMult) || 1));
      rec.body.orbit = rec.baseOrbit * rec.orbitMult;
    }
    if (patch.hasRings !== undefined && rec.ringMesh) {
      rec.hasRings = Boolean(patch.hasRings);
      rec.ringMesh.visible = rec.hasRings;
      rec.mesh.rotation.z = rec.hasRings ? 0.28 : 0;
      const orig = savedOriginals.get(id);
      if (orig) orig.rotZ = rec.mesh.rotation.z;
    }
    if (patch.temp !== undefined && Number.isFinite(Number(patch.temp))) {
      rec.temp = Math.round(Number(patch.temp));
      rec.body.temp = `${rec.temp}°C`;
    }
    if (patch.pop !== undefined && Number.isFinite(Number(patch.pop))) {
      rec.pop = Math.max(0, Math.round(Number(patch.pop)));
    }
    return rec;
  }

  function removeCustomBody(id) {
    const idx = customBodies.findIndex(b => b.id === id);
    if (idx === -1) return false;
    const b = customBodies[idx];
    objects.delete(id);
    savedOriginals.delete(id);
    const pIdx = pickables.indexOf(b.mesh);
    if (pIdx !== -1) pickables.splice(pIdx, 1);
    if (b.mesh.parent && b.mesh.parent !== b.pivot) b.mesh.parent.remove(b.mesh);
    b.pivot.traverse(obj => {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material?.dispose();
    });
    customGroup.remove(b.pivot);
    customBodies.splice(idx, 1);
    return true;
  }

  function clearCustomBodies() {
    const removedIds = customBodies.map(b => b.id);
    while (customBodies.length > 0) {
      removeCustomBody(customBodies[0].id);
    }
    return removedIds;
  }

  function clearDebrisRings() {
    for (const r of debrisRings) {
      r.hostMesh.remove(r.ringGroup);
      r.dustRing.geometry.dispose();
      r.dustRing.material.dispose();
      r.chunkGeo.dispose();
      r.chunkMat.dispose();
    }
    debrisRings.length = 0;
  }

  function restoreCollidedBodies() {
    if (activeCollision) {
      if (activeCollision.trailLine) {
        collisionGroup.remove(activeCollision.trailLine);
        activeCollision.trailLine.geometry.dispose();
        activeCollision.trailLine.material.dispose();
      }
      activeCollision = null;
    }
    for (const [id, orig] of savedOriginals.entries()) {
      const entry = objects.get(id);
      if (!entry) continue;
      if (entry.mesh.parent !== orig.pivot) {
        orig.pivot.add(entry.mesh);
      }
      entry.mesh.position.copy(orig.localPos);
      entry.mesh.scale.copy(orig.scale);
      entry.mesh.rotation.z = orig.rotZ;
      entry.mesh.visible = true;
    }
  }

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpSun = new THREE.Vector3();

  return {
    setEarthLifeFraction(frac) {
      nightLights.mat.uniforms.uAlive.value = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 1));
    },
    boostAurora(level = 1.0) {
      aurora.mat.uniforms.uBoost.value = Math.max(0.5, Math.min(2.6, level));
    },
    triggerSupernova(onDetonate, onShockwave = null, onVaporize = null) {
      supernova = {
        phase: 'swell',
        age: 0,
        onDetonate,
        onShockwave,
        onVaporize,
        shockwaveHit: false,
        vaporized: new Set()
      };
      snGroup.visible = true;
      pulsarGroup.visible = false;
      pulsarLight.intensity = 0;
      snShell.visible = false;
      snWave.visible = false;
      snGroup.position.copy(sun.mesh.getWorldPosition(tmpSun));
      addShake(0.22, 1.8);
      playSfx('blackhole');
    },
    launchPlanetCollision(sourceId, targetId, onImpact) {
      const srcEntry = objects.get(sourceId);
      const tgtEntry = objects.get(targetId);
      if (!srcEntry || !tgtEntry || sourceId === targetId) return false;

      const startPos = srcEntry.mesh.getWorldPosition(new THREE.Vector3());
      const endPos = tgtEntry.mesh.getWorldPosition(new THREE.Vector3());
      scene.attach(srcEntry.mesh);

      const trailGeo = new THREE.BufferGeometry().setFromPoints([startPos.clone(), startPos.clone()]);
      const trailMat = new THREE.LineBasicMaterial({
        color: 0xffa652,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const trailLine = new THREE.Line(trailGeo, trailMat);
      trailLine.frustumCulled = false;
      collisionGroup.add(trailLine);

      activeCollision = {
        sourceId,
        targetId,
        srcEntry,
        tgtEntry,
        startPos,
        endPos,
        age: 0,
        duration: 2.6,
        trailPoints: [startPos.clone()],
        trailLine,
        onImpact
      };
      return true;
    },
    spawnCustomBody,
    updateCustomBody,
    removeCustomBody,
    clearCustomBodies,
    getCustomBodies() {
      return [...customBodies];
    },
    getBinaryStarCount() {
      return customBodies.filter(b => b.kind === 'star').length;
    },
    getCustomBodyCount() {
      return customBodies.length;
    },
    isCollisionBusy() {
      return !!activeCollision;
    },
    isSupernovaActive() {
      return !!supernova;
    },
    isBodyInCollision(id) {
      return !!(activeCollision && activeCollision.sourceId === id);
    },
    reset() {
      supernova = null;
      snGroup.visible = false;
      pulsarGroup.visible = false;
      pulsarLight.intensity = 0;
      snShell.visible = false;
      snWave.visible = false;
      sun.mesh.visible = true;
      sun.mesh.scale.setScalar(sun.body.size);
      light.intensity = originalLight.light;
      sunFill.intensity = originalLight.fill;
      ambient.intensity = originalLight.ambient;
      nightLights.mat.uniforms.uAlive.value = 1.0;
      aurora.mat.uniforms.uBoost.value = 1.0;
      clearDebrisRings();
      restoreCollidedBodies();
    },
    update(dt, { paused = false, speed = 1 } = {}) {
      // Update Earth night city lights sun direction & polar aurora animation
      sun.mesh.getWorldPosition(tmpSun);
      nightLights.mat.uniforms.uSunPos.value.copy(tmpSun);
      nightLights.mesh.visible = earth.mesh.visible;
      aurora.mesh.visible = earth.mesh.visible;
      aurora.mat.uniforms.uTime.value += dt;

      // Rotate planetary collision debris rings (custom bodies orbit via main.js objects loop so they obey black hole capture!)
      if (!paused) {
        for (const r of debrisRings) {
          r.ringGroup.rotation.y += dt * 0.38 * Math.max(0.25, speed);
        }
      }

      // Supernova lifecycle -> Red Giant destabilize -> Detonation -> Shockwave vaporization -> Spinning Pulsar
      if (supernova) {
        supernova.age += dt;
        if (supernova.phase === 'swell') {
          const t = Math.min(1, supernova.age / 1.85);
          const swellScale = sun.body.size * (1 + t * 2.1 + Math.sin(supernova.age * 24) * 0.12 * t);
          sun.mesh.scale.setScalar(swellScale);
          light.intensity = originalLight.light * (1 + t * 2.2);
          if (t >= 1) {
            supernova.phase = 'remnant';
            supernova.age = 0;
            sun.mesh.visible = false;
            snShell.visible = true;
            snWave.visible = true;
            pulsarGroup.visible = true;
            light.intensity = 0;
            sunFill.intensity = 0;
            ambient.intensity = 0.14;
            pulsarLight.intensity = 1750;
            addShake(1.15, 1.9);
            pulseBloom(2.4);
            playSfx('impact');
            supernova.onDetonate?.();
          }
        } else {
          const p = Math.min(1, supernova.age / 14.0);
          const snRadius = 4 + supernova.age * 18.0;
          snShellMat.uniforms.uTime.value = supernova.age;
          snShellMat.uniforms.uProgress.value = p;
          snShell.scale.setScalar(4 + supernova.age * 11.5);
          snWave.scale.setScalar(snRadius);
          snWave.material.opacity = Math.max(0, (1 - p * 1.4) * 0.72);
          // Rapidly spinning Pulsar lighthouse beams!
          pulsarGroup.rotation.y += dt * 7.5;
          pulsarLight.intensity = 1550 + Math.sin(supernova.age * 15.0) * 320;

          // Shockwave physically vaporizes inner rocky planets (Mercury, Venus, close custom planets)
          for (const [id, entry] of objects.entries()) {
            if (id === 'sun' || entry.body.isStar) continue;
            if (entry.body.distance > 0 && entry.body.distance <= 19.5 && snRadius >= entry.body.distance) {
              if (!supernova.vaporized.has(id)) {
                supernova.vaporized.add(id);
                entry.mesh.visible = false;
                addShake(0.35, 0.55);
                pulseBloom(1.4);
                supernova.onVaporize?.(id, entry.body.name);
              }
            }
          }
          // When shockwave reaches Earth's orbit (22.8), ignite molten crust scorch!
          if (!supernova.shockwaveHit && snRadius >= 22.8) {
            supernova.shockwaveHit = true;
            addShake(0.65, 1.1);
            pulseBloom(1.8);
            supernova.onShockwave?.();
          }
        }
      }

      // Planet <-> Planet Collision trajectory
      if (activeCollision && !paused) {
        const col = activeCollision;
        col.age += dt;
        const t = Math.min(1, col.age / col.duration);
        const ease = t * t * (0.4 + 0.6 * t);
        col.tgtEntry.mesh.getWorldPosition(tmpB);
        tmpA.lerpVectors(col.startPos, tmpB, ease);
        // Dramatic curved gravitational sling arc
        tmpA.y += Math.sin(t * Math.PI) * 3.8;
        col.srcEntry.mesh.position.copy(tmpA);
        col.srcEntry.mesh.rotation.y += dt * 4.2;

        col.trailPoints.push(tmpA.clone());
        if (col.trailPoints.length > 48) col.trailPoints.shift();
        col.trailLine.geometry.dispose();
        col.trailLine.geometry = new THREE.BufferGeometry().setFromPoints(col.trailPoints);

        if (t >= 1) {
          const src = col.srcEntry;
          const tgt = col.tgtEntry;
          const cb = col.onImpact;
          collisionGroup.remove(col.trailLine);
          col.trailLine.geometry.dispose();
          col.trailLine.material.dispose();
          activeCollision = null;

          // Smaller body shatters into a glowing molten debris ring around the larger planet!
          const srcBigger = src.body.size > tgt.body.size * 1.35;
          const survivorEntry = srcBigger ? src : tgt;
          const destroyedEntry = srcBigger ? tgt : src;
          destroyedEntry.mesh.visible = false;

          spawnDebrisRing(survivorEntry.mesh, survivorEntry.body.size, destroyedEntry.body.color);
          addShake(0.95, 1.5);
          pulseBloom(2.0);
          playSfx('impact');
          cb?.({ survivor: survivorEntry.body, destroyed: destroyedEntry.body });
        }
      }
    }
  };
}
