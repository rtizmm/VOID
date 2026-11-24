import * as THREE from 'three';

function createPortalMaterial(tintHex) {
  const c = new THREE.Color(tintHex);
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: c }
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
      uniform vec3 uTint;
      varying vec2 vUv;
      void main(){
        float r = length(vUv);
        if(r > 1.0) discard;
        float a = atan(vUv.y, vUv.x);
        float twist = a + 5.5 / (r + 0.18) - uTime * 3.2;
        float spiral = 0.5 + 0.5 * sin(twist * 4.0);
        float ring = exp(-pow((r - 0.82) * 9.5, 2.0));
        float throat = 1.0 - smoothstep(0.0, 0.36, r);
        vec3 rimCol = mix(uTint, vec3(0.95, 0.98, 1.0), ring * 0.75);
        vec3 col = rimCol * (0.35 + spiral * 0.85) + vec3(0.45, 0.88, 1.2) * ring * 1.1;
        col *= (1.0 - throat * 0.85);
        float alpha = clamp((1.0 - smoothstep(0.84, 1.0, r)) * (0.55 + ring * 0.65 + spiral * 0.25), 0.0, 0.95);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
}

export function createWormholeSystem({ scene, objects, camera, flyTo, notify = () => {}, addShake = () => {}, pulseBloom = () => {}, playSfx = () => {} }) {
  const group = new THREE.Group();
  scene.add(group);
  group.visible = false;

  const matA = createPortalMaterial(0x4ae6ff);
  const matB = createPortalMaterial(0xc06bff);
  const geo = new THREE.PlaneGeometry(4.2, 4.2);
  const portalA = new THREE.Mesh(geo, matA);
  const portalB = new THREE.Mesh(geo, matB);
  group.add(portalA, portalB);

  let active = false;
  let idA = 'earth';
  let idB = 'saturn';
  let cooldown = 0;
  let age = 0;

  const posA = new THREE.Vector3();
  const posB = new THREE.Vector3();
  const tmpPos = new THREE.Vector3();

  function positionPortals() {
    const eA = objects.get(idA);
    const eB = objects.get(idB);
    if (!eA || !eB) return;
    eA.mesh.getWorldPosition(posA);
    eB.mesh.getWorldPosition(posB);
    posA.x += eA.body.size * 2.4 + 1.2;
    posA.y += 0.6;
    posB.x -= eB.body.size * 2.4 + 1.2;
    posB.y += 0.6;
    portalA.position.copy(posA);
    portalB.position.copy(posB);
  }

  return {
    open(fromId, toId) {
      if (!objects.has(fromId) || !objects.has(toId) || fromId === toId) return false;
      idA = fromId;
      idB = toId;
      active = true;
      age = 0;
      cooldown = 1.2;
      group.visible = true;
      positionPortals();
      pulseBloom(0.9);
      playSfx('grb');
      return true;
    },
    jumpToExit() {
      if (!active) return false;
      positionPortals();
      const dA = camera.position.distanceTo(posA);
      const dB = camera.position.distanceTo(posB);
      const dest = dA <= dB ? posB : posA;
      const destId = dA <= dB ? idB : idA;
      const destEntry = objects.get(destId);
      const offset = new THREE.Vector3(destEntry.body.size * 3.2, destEntry.body.size * 1.4, destEntry.body.size * 4.2);
      if (flyTo) flyTo(dest.clone().add(offset), destEntry.mesh.getWorldPosition(tmpPos).clone(), 0.75);
      addShake(0.32, 0.65);
      pulseBloom(1.4);
      playSfx('grb');
      notify(`SOLUCAN DELİĞİ → ${destEntry.body.name}`);
      return true;
    },
    isActive: () => active,
    reset() {
      active = false;
      group.visible = false;
      cooldown = 0;
    },
    update(dt, { mode }) {
      if (!active) return;
      age += dt;
      if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
      positionPortals();
      matA.uniforms.uTime.value = age;
      matB.uniforms.uTime.value = age + 1.7;
      portalA.lookAt(camera.position);
      portalB.lookAt(camera.position);

      // In Free Flight / Cockpit mode, flying through either portal teleports you to the other!
      if (mode === 'cockpit' && cooldown <= 0) {
        if (camera.position.distanceTo(posA) < 2.4) {
          camera.position.copy(posB).add(new THREE.Vector3(0, 0.5, 4.2));
          cooldown = 2.5;
          addShake(0.35, 0.7);
          pulseBloom(1.5);
          playSfx('grb');
          notify(`IŞINLANDIN → ${objects.get(idB)?.body?.name || idB}`);
        } else if (camera.position.distanceTo(posB) < 2.4) {
          camera.position.copy(posA).add(new THREE.Vector3(0, 0.5, 4.2));
          cooldown = 2.5;
          addShake(0.35, 0.7);
          pulseBloom(1.5);
          playSfx('grb');
          notify(`IŞINLANDIN → ${objects.get(idA)?.body?.name || idA}`);
        }
      }
    }
  };
}
