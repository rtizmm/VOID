import * as THREE from 'three';

const TF_NOISE = `
float th21(vec2 p){
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float tn2(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(th21(i), th21(i + vec2(1.0, 0.0)), f.x),
    mix(th21(i + vec2(0.0, 1.0)), th21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float tfbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 4; i++){
    v += a * tn2(p);
    p = p * 2.03 + vec2(1.3, -1.7);
    a *= 0.5;
  }
  return v;
}
`;

function createTerraformMaterial(isIceAge = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uSunPos: { value: new THREE.Vector3(0, 0, 0) },
      uIsIce: { value: isIceAge ? 1.0 : 0.0 }
    },
    vertexShader: `
      varying vec3 vObjPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main(){
        vObjPos = normalize(position);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uProgress;
      uniform float uTime;
      uniform vec3 uSunPos;
      uniform float uIsIce;
      varying vec3 vObjPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      ${TF_NOISE}
      void main(){
        float p = clamp(uProgress, 0.0, 1.0);
        if(p <= 0.005) discard;
        vec2 uv = vec2(atan(vObjPos.z, vObjPos.x) * 1.9, acos(clamp(vObjPos.y, -1.0, 1.0)) * 2.2);
        vec3 toSun = normalize(uSunPos - vWorldPos);
        float ndotl = dot(normalize(vWorldNormal), toSun);
        float lit = 0.16 + 0.84 * max(ndotl, 0.0);

        if(uIsIce > 0.5){
          // Snowball Earth: glaciation creeps from poles to equator
          float lat = abs(vObjPos.y);
          float n = tfbm(uv * 3.0);
          float freezeFront = 1.05 - p * 1.18 + (n - 0.5) * 0.25;
          float iceMask = smoothstep(freezeFront - 0.12, freezeFront + 0.12, lat);
          if(iceMask * p < 0.02) discard;
          vec3 iceCol = mix(vec3(0.68, 0.84, 0.96), vec3(0.92, 0.96, 1.0), n) * lit;
          gl_FragColor = vec4(iceCol, clamp(iceMask * min(1.0, p * 1.15), 0.0, 0.94));
          return;
        }

        // Mars / Venus Terraforming: oceans -> green vegetation -> clouds -> colony night lights
        float h = tfbm(uv * 2.4);
        float clouds = tfbm(uv * 3.8 + vec2(uTime * 0.04, 0.0));
        float isOcean = 1.0 - smoothstep(0.46, 0.54, h);
        vec3 oceanCol = mix(vec3(0.06, 0.24, 0.54), vec3(0.10, 0.42, 0.72), h);
        vec3 landCol = mix(vec3(0.18, 0.48, 0.24), vec3(0.36, 0.62, 0.30), smoothstep(0.52, 0.78, h));
        vec3 surf = mix(landCol, oceanCol, isOcean);
        float cloudMask = smoothstep(0.54, 0.80, clouds) * smoothstep(0.25, 0.85, p);
        surf = mix(surf, vec3(0.94, 0.97, 1.0), cloudMask * 0.68) * lit;

        // Golden colony city lights on the night side when terraforming > 50%
        float night = 1.0 - smoothstep(-0.15, 0.15, ndotl);
        float cityDots = smoothstep(0.74, 0.92, tfbm(uv * 11.0)) * (1.0 - isOcean) * smoothstep(0.45, 0.95, p);
        surf += vec3(1.0, 0.78, 0.38) * cityDots * night * 0.85;

        gl_FragColor = vec4(surf, clamp(p * 0.96, 0.0, 0.96));
      }
    `,
    transparent: true,
    depthWrite: false
  });
}

export function createTerraformSystem({ objects, sun }) {
  const overlays = new Map();
  const state = { mars: 0, venus: 0, earthIce: 0 };

  function ensureOverlay(planetId, isIce) {
    const key = isIce ? 'earthIce' : planetId;
    if (overlays.has(key)) return overlays.get(key);
    const entry = objects.get(planetId);
    if (!entry) return null;
    const mat = createTerraformMaterial(isIce);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.012, 44, 30), mat);
    mesh.raycast = () => {};
    mesh.visible = false;
    entry.mesh.add(mesh);
    const rec = { mesh, mat };
    overlays.set(key, rec);
    return rec;
  }

  const tmpSun = new THREE.Vector3();

  return {
    applyTerraform(planetId, percent) {
      const p = Math.max(0, Math.min(100, Number(percent) || 0)) / 100;
      if (planetId === 'earth') {
        state.earthIce = p;
        const rec = ensureOverlay('earth', true);
        if (rec) {
          rec.mat.uniforms.uProgress.value = p;
          rec.mesh.visible = p > 0.005;
        }
        return {
          temp: Math.round(15 - p * 73),
          atmo: Math.round(100 - p * 12),
          colonyPop: null
        };
      }
      if (planetId === 'mars' || planetId === 'venus') {
        state[planetId] = p;
        const rec = ensureOverlay(planetId, false);
        if (rec) {
          rec.mat.uniforms.uProgress.value = p;
          rec.mesh.visible = p > 0.005;
        }
        const baseTemp = planetId === 'mars' ? -65 : 464;
        const targetTemp = planetId === 'mars' ? 16 : 22;
        const baseAtmo = planetId === 'mars' ? 12 : 100;
        return {
          temp: Math.round(baseTemp + (targetTemp - baseTemp) * p),
          atmo: Math.round(baseAtmo + (98 - baseAtmo) * p),
          colonyPop: Math.round(p * (planetId === 'mars' ? 2.4e9 : 1.6e9))
        };
      }
      return null;
    },
    getState: () => ({ ...state }),
    reset() {
      state.mars = 0;
      state.venus = 0;
      state.earthIce = 0;
      for (const rec of overlays.values()) {
        rec.mat.uniforms.uProgress.value = 0;
        rec.mesh.visible = false;
      }
    },
    update(dt) {
      sun.mesh.getWorldPosition(tmpSun);
      for (const rec of overlays.values()) {
        if (!rec.mesh.visible) continue;
        rec.mat.uniforms.uTime.value += dt;
        rec.mat.uniforms.uSunPos.value.copy(tmpSun);
      }
    }
  };
}
