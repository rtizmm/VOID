import * as THREE from 'three';

export function createDysonSphere({ scene, sun, light, sunFill }) {
  const baseLight = light.intensity;
  const baseFill = sunFill.intensity;
  const root = new THREE.Group();
  scene.add(root);
  root.visible = false;

  const PANEL_COUNT = 160;
  const panelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.08, 6);
  panelGeo.rotateX(Math.PI / 2);
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0xd4b26a,
    emissive: 0xffa638,
    emissiveIntensity: 0.42,
    roughness: 0.32,
    metalness: 0.85
  });
  const panels = new THREE.InstancedMesh(panelGeo, panelMat, PANEL_COUNT);
  panels.count = 0;
  root.add(panels);

  // Precompute Fibonacci-sphere collector panel transforms around the Sun
  const rShell = sun.body.size * 1.44;
  const dummy = new THREE.Object3D();
  const origin = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i < PANEL_COUNT; i++) {
    const y = 1 - (2 * (i + 0.5)) / PANEL_COUNT;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.3999632;
    dummy.position.set(Math.cos(theta) * rad * rShell, y * rShell, Math.sin(theta) * rad * rShell);
    dummy.lookAt(origin);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    panels.setMatrixAt(i, dummy.matrix);
  }
  panels.instanceMatrix.needsUpdate = true;

  // 3 counter-rotating glowing energy conduit rings
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x6ce8ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const rings = [0, 1, 2].map(i => {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(rShell * (1.03 + i * 0.045), 0.06, 12, 96), ringMat.clone());
    torus.rotation.x = Math.PI * (0.35 + i * 0.28);
    torus.rotation.y = i * 0.8;
    root.add(torus);
    return torus;
  });

  // Geodesic lattice shell that fades in above 50% completion
  const lattice = new THREE.Mesh(
    new THREE.IcosahedronGeometry(rShell * 1.01, 2),
    new THREE.MeshBasicMaterial({
      color: 0xffc466,
      wireframe: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  root.add(lattice);

  let progress = 0; // 0..100
  const sunPos = new THREE.Vector3();

  return {
    setProgress(pct) {
      progress = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
      const p = progress / 100;
      root.visible = progress > 0;
      panels.count = Math.round(p * PANEL_COUNT);
      rings.forEach((r, idx) => {
        const thresh = idx * 0.22;
        r.material.opacity = p > thresh ? Math.min(0.65, (p - thresh) * 0.9) : 0;
      });
      lattice.material.opacity = p > 0.45 ? Math.min(0.35, (p - 0.45) * 0.65) : 0;
      // Dim external solar light realistically as Dyson Sphere encloses the star
      light.intensity = baseLight * (1 - p * 0.78);
      sunFill.intensity = baseFill * (1 - p * 0.72);
      return {
        progress,
        watts: p * 3.828e26,
        kardashev: Number((1.0 + p * 1.0).toFixed(2))
      };
    },
    getProgress: () => progress,
    reset() {
      progress = 0;
      root.visible = false;
      panels.count = 0;
      lattice.material.opacity = 0;
      rings.forEach(r => (r.material.opacity = 0));
      light.intensity = baseLight;
      sunFill.intensity = baseFill;
    },
    update(dt, { paused = false, speed = 1 } = {}) {
      if (!root.visible) return;
      sun.mesh.getWorldPosition(sunPos);
      root.position.copy(sunPos);
      if (!paused) {
        const s = dt * Math.max(0.2, speed);
        panels.rotation.y += s * 0.08;
        lattice.rotation.y -= s * 0.05;
        rings[0].rotation.z += s * 0.35;
        rings[1].rotation.x -= s * 0.28;
        rings[2].rotation.y += s * 0.22;
      }
    }
  };
}
