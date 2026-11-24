import * as THREE from 'three';

export function createGalaxyCollision({ scene, flyTo, notify = () => {}, pulseBloom = () => {} }) {
  const COUNT = 8000;
  const HALF = COUNT / 2;
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const mat = new THREE.PointsMaterial({
    size: 1.55,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const stars = new THREE.Points(geo, mat);
  stars.frustumCulled = false;
  group.add(stars);

  // Luminous galactic cores (Milky Way + Andromeda)
  const coreA = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xffe4b8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  const coreB = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xe6c8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(coreA, coreB);

  const centerOffset = new THREE.Vector3(0, 160, 0);
  group.position.copy(centerOffset);

  const cA = new THREE.Vector3();
  const vA = new THREE.Vector3();
  const cB = new THREE.Vector3();
  const vB = new THREE.Vector3();
  let active = false;

  function initGalaxies() {
    cA.set(-48, -6, 12);
    vA.set(6.2, 0.9, -2.4);
    cB.set(48, 8, -14);
    vB.set(-5.8, -0.8, 2.2);

    const tmpC = new THREE.Color();
    const gmCore = 520;

    function fillGalaxy(startIdx, count, center, baseVel, tiltX, tiltZ, isAndromeda) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, 0, tiltZ));
      const p = new THREE.Vector3();
      const v = new THREE.Vector3();
      const arms = isAndromeda ? 3 : 2;

      for (let i = 0; i < count; i++) {
        const idx = (startIdx + i) * 3;
        const r = 2.4 + Math.pow(Math.random(), 1.35) * 34;
        const arm = i % arms;
        const angle = (arm / arms) * Math.PI * 2 + r * 0.24 + (Math.random() - 0.5) * (0.45 + r * 0.015);
        const y = (Math.random() - 0.5) * (1.8 / (1 + r * 0.08));

        p.set(Math.cos(angle) * r, y, Math.sin(angle) * r).applyQuaternion(q);
        const spd = Math.sqrt(gmCore / (r + 2.2));
        v.set(-Math.sin(angle) * spd, 0, Math.cos(angle) * spd).applyQuaternion(q);

        pos[idx] = center.x + p.x;
        pos[idx + 1] = center.y + p.y;
        pos[idx + 2] = center.z + p.z;
        vel[idx] = baseVel.x + v.x;
        vel[idx + 1] = baseVel.y + v.y;
        vel[idx + 2] = baseVel.z + v.z;

        const radialFrac = Math.min(1, r / 36);
        if (isAndromeda) {
          tmpC.setHSL(0.74 - radialFrac * 0.14, 0.72, 0.65 - radialFrac * 0.18);
        } else {
          tmpC.setHSL(0.58 - radialFrac * 0.44, 0.75, 0.68 - radialFrac * 0.16);
        }
        col[idx] = tmpC.r;
        col[idx + 1] = tmpC.g;
        col[idx + 2] = tmpC.b;
      }
    }

    fillGalaxy(0, HALF, cA, vA, 0.32, 0.18, false);
    fillGalaxy(HALF, HALF, cB, vB, -0.42, -0.25, true);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    coreA.position.copy(cA);
    coreB.position.copy(cB);
  }

  return {
    start() {
      initGalaxies();
      active = true;
      group.visible = true;
      if (flyTo) {
        flyTo(
          new THREE.Vector3(0, 235, 138),
          centerOffset.clone(),
          1.4
        );
      }
      pulseBloom(0.9);
      notify('GALAKSİ ÇARPIŞMASI · SAMANYOLU × ANDROMEDA');
    },
    stop() {
      active = false;
      group.visible = false;
    },
    isActive: () => active,
    reset() {
      active = false;
      group.visible = false;
    },
    update(dt, { paused = false, speed = 1 } = {}) {
      if (!active || paused) return;
      const step = Math.min(0.04, dt * Math.max(0.2, speed));
      const gmCore = 520;
      const soft = 26;

      // Mutual attraction between galactic cores + dynamical friction so they merge!
      const dxC = cB.x - cA.x;
      const dyC = cB.y - cA.y;
      const dzC = cB.z - cA.z;
      const d2C = dxC * dxC + dyC * dyC + dzC * dzC + soft * 2;
      const invC = 1 / Math.sqrt(d2C);
      const aCore = (gmCore * 0.55) / d2C;
      vA.x += dxC * invC * aCore * step;
      vA.y += dyC * invC * aCore * step;
      vA.z += dzC * invC * aCore * step;
      vB.x -= dxC * invC * aCore * step;
      vB.y -= dyC * invC * aCore * step;
      vB.z -= dzC * invC * aCore * step;
      const damp = Math.pow(0.9965, step * 60);
      vA.multiplyScalar(damp);
      vB.multiplyScalar(damp);
      cA.addScaledVector(vA, step);
      cB.addScaledVector(vB, step);
      coreA.position.copy(cA);
      coreB.position.copy(cB);

      // Update all 8,000 stars under dual-core tidal gravity -> sweeping tidal tails!
      const ax = cA.x, ay = cA.y, az = cA.z;
      const bx = cB.x, by = cB.y, bz = cB.z;
      for (let i = 0; i < COUNT; i++) {
        const idx = i * 3;
        const px = pos[idx], py = pos[idx + 1], pz = pos[idx + 2];

        const dAx = ax - px, dAy = ay - py, dAz = az - pz;
        const rA2 = dAx * dAx + dAy * dAy + dAz * dAz + soft;
        const fA = gmCore / (rA2 * Math.sqrt(rA2));

        const dBx = bx - px, dBy = by - py, dBz = bz - pz;
        const rB2 = dBx * dBx + dBy * dBy + dBz * dBz + soft;
        const fB = gmCore / (rB2 * Math.sqrt(rB2));

        vel[idx] += (dAx * fA + dBx * fB) * step;
        vel[idx + 1] += (dAy * fA + dBy * fB) * step;
        vel[idx + 2] += (dAz * fA + dBz * fB) * step;

        pos[idx] = px + vel[idx] * step;
        pos[idx + 1] = py + vel[idx + 1] * step;
        pos[idx + 2] = pz + vel[idx + 2] * step;
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}
