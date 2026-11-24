import * as THREE from 'three';

export function createOrbitalDefense({ scene, earth, playSfx = () => {}, pulseBloom = () => {} }) {
  let target = earth;
  const root = new THREE.Group();
  scene.add(root);
  root.visible = false;

  const laserGroup = new THREE.Group();
  scene.add(laserGroup);

  const stationGroup = new THREE.Group();
  const satNodes = [];
  const activeLasers = [];
  let satCount = 0;
  let intercepted = 0;
  let fireCooldown = 0;

  // Build ISS-style Space Station
  const trussMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.45, metalness: 0.72 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x2b5c9e, emissive: 0x10284c, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.6 });
  const coreMod = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.24, 12), trussMat);
  coreMod.rotation.z = Math.PI / 2;
  const crossTruss = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.018, 0.018), trussMat);
  const wingGeo = new THREE.BoxGeometry(0.075, 0.006, 0.26);
  const w1 = new THREE.Mesh(wingGeo, solarMat); w1.position.set(-0.16, 0, 0);
  const w2 = new THREE.Mesh(wingGeo, solarMat); w2.position.set(0.16, 0, 0);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshBasicMaterial({ color: 0x58ffba }));
  beacon.position.set(0, 0.04, 0);
  stationGroup.add(coreMod, crossTruss, w1, w2, beacon);
  root.add(stationGroup);

  const satGeo = new THREE.OctahedronGeometry(0.042, 0);
  const satMat = new THREE.MeshStandardMaterial({ color: 0xd8ecff, emissive: 0x24d898, emissiveIntensity: 0.85, roughness: 0.35, metalness: 0.7 });
  const satWingGeo = new THREE.BoxGeometry(0.14, 0.008, 0.035);

  function rebuildSatellites(count) {
    for (const s of satNodes) {
      root.remove(s.mesh);
    }
    satNodes.length = 0;
    satCount = Math.max(0, Math.min(8, Math.round(Number(count) || 0)));
    root.visible = satCount > 0;
    if (satCount === 0) return;

    const rBase = target.body.size * 1.48;
    for (let i = 0; i < satCount; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(satGeo, satMat);
      const wing = new THREE.Mesh(satWingGeo, solarMat);
      g.add(body, wing);
      root.add(g);
      satNodes.push({
        mesh: g,
        angle: (i / satCount) * Math.PI * 2,
        inc: ((i % 3) - 1) * 0.42,
        radius: rBase * (1 + (i % 2) * 0.14),
        speed: 0.55 + (i % 3) * 0.16
      });
    }
  }

  function spawnLaser(fromPos, toPos) {
    const pts = [fromPos.clone(), toPos.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0x52ffbc,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    const burst = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x8effd4, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    burst.position.copy(toPos);
    laserGroup.add(line, burst);
    activeLasers.push({ line, burst, age: 0, dur: 0.32 });
    playSfx('grb');
    pulseBloom(0.45);
  }

  function clearLasers() {
    for (const l of activeLasers) {
      laserGroup.remove(l.line, l.burst);
      l.line.geometry.dispose();
      l.line.material.dispose();
      l.burst.geometry.dispose();
      l.burst.material.dispose();
    }
    activeLasers.length = 0;
  }

  const center = new THREE.Vector3();
  const satWorld = new THREE.Vector3();
  let stationAngle = 0;

  return {
    setTarget(entry) {
      if (!entry) return;
      target = entry;
      if (satCount > 0) rebuildSatellites(satCount);
    },
    deploy(count = 4) {
      rebuildSatellites(count);
      return satCount;
    },
    getCount: () => satCount,
    getIntercepted: () => intercepted,
    reset() {
      clearLasers();
      intercepted = 0;
      rebuildSatellites(0);
    },
    update(dt, { paused = false, speed = 1, effects } = {}) {
      // Fade active laser beams
      for (let i = activeLasers.length - 1; i >= 0; i--) {
        const l = activeLasers[i];
        l.age += dt;
        const t = Math.min(1, l.age / l.dur);
        l.line.material.opacity = (1 - t) * 0.95;
        l.burst.scale.setScalar(1 + t * 2.4);
        l.burst.material.opacity = (1 - t) * (1 - t) * 0.9;
        if (t >= 1) {
          laserGroup.remove(l.line, l.burst);
          l.line.geometry.dispose();
          l.line.material.dispose();
          l.burst.geometry.dispose();
          l.burst.material.dispose();
          activeLasers.splice(i, 1);
        }
      }

      if (satCount === 0 || !target?.mesh?.visible) {
        root.visible = false;
        return;
      }
      root.visible = true;
      target.mesh.getWorldPosition(center);
      root.position.copy(center);

      if (!paused) {
        const step = dt * Math.max(0.2, speed);
        stationAngle += step * 0.42;
        const sr = target.body.size * 1.32;
        stationGroup.position.set(Math.cos(stationAngle) * sr, Math.sin(stationAngle * 1.2) * sr * 0.25, Math.sin(stationAngle) * sr);
        stationGroup.lookAt(center);

        for (const s of satNodes) {
          s.angle += s.speed * step;
          const x = Math.cos(s.angle) * s.radius;
          const z = Math.sin(s.angle) * s.radius;
          const y = Math.sin(s.angle) * s.radius * Math.sin(s.inc);
          s.mesh.position.set(x, y, z);
          s.mesh.lookAt(center);
        }
      }

      // Auto-intercept incoming storm meteors AND small/medium asteroids via defense lasers
      if (!paused && effects && satNodes.length > 0) {
        fireCooldown = Math.max(0, fireCooldown - dt);
        const interval = Math.max(0.16, 0.72 - satCount * 0.065);
        if (fireCooldown <= 0) {
          const hitPos = effects.interceptNextMeteor?.() || effects.interceptActiveFlight?.(satCount);
          if (hitPos) {
            const shooter = satNodes[intercepted % satNodes.length];
            shooter.mesh.getWorldPosition(satWorld);
            spawnLaser(satWorld, hitPos);
            intercepted++;
            fireCooldown = interval;
          }
        }
      }
    }
  };
}
