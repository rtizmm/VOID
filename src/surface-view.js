import * as THREE from 'three';

export function createSurfaceView({ scene, objects, camera, controls, notify = () => {} }) {
  let active = false;
  let hostId = 'earth';
  const hostWorld = new THREE.Vector3();
  const prevHostWorld = new THREE.Vector3();
  const hostDelta = new THREE.Vector3();
  const anchor = new THREE.Vector3();

  // Subtle curved atmospheric horizon glow ring under the observer
  const horizonMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.58, 64),
    new THREE.MeshBasicMaterial({
      color: 0x3b7dd8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  horizonMesh.rotation.x = -Math.PI / 2;
  horizonMesh.visible = false;
  scene.add(horizonMesh);

  function enter(planetId = 'earth') {
    const candidate = objects.get(planetId);
    const id = candidate && !candidate.body.isStar && planetId !== 'sun' ? planetId : 'earth';
    const entry = objects.get(id);
    if (!entry || !entry.mesh.visible) return false;
    hostId = id;
    active = true;
    horizonMesh.material.color.setHex(id === 'mars' ? 0xd97348 : id === 'earth' ? 0x3b86e8 : entry.body.color || 0x58c9ff);
    horizonMesh.visible = true;
    controls.enabled = true;

    entry.mesh.getWorldPosition(hostWorld);
    prevHostWorld.copy(hostWorld);
    const r = entry.body.size;
    // Anchor OrbitControls right on the surface so dragging smoothly pans 360° across the sky with zero drift!
    anchor.set(hostWorld.x, hostWorld.y + r * 1.15, hostWorld.z);
    controls.minDistance = 0.08;
    controls.maxDistance = 0.65;
    controls.target.copy(anchor);
    camera.position.copy(anchor).add(new THREE.Vector3(-0.24, -0.09, 0.24));
    horizonMesh.position.set(hostWorld.x, hostWorld.y + r * 1.04, hostWorld.z);
    controls.update();
    notify(`YÜZEY GÖZLEMİ · ${entry.body.name} GÖKYÜZÜ`);
    return true;
  }

  function exit() {
    if (!active) return;
    active = false;
    horizonMesh.visible = false;
    controls.minDistance = 2;
    controls.maxDistance = 1000;
    notify('YÖRÜNGE KAMERASINA DÖNÜLDÜ');
  }

  return {
    enter,
    exit,
    isActive: () => active,
    getHostId: () => hostId,
    reset: exit,
    update() {
      if (!active) return;
      const entry = objects.get(hostId);
      if (!entry || !entry.mesh.visible) {
        exit();
        return;
      }
      entry.mesh.getWorldPosition(hostWorld);
      const r = entry.body.size;
      // Translate observer + look target smoothly by the host planet's exact orbital displacement
      hostDelta.copy(hostWorld).sub(prevHostWorld);
      camera.position.add(hostDelta);
      controls.target.add(hostDelta);
      prevHostWorld.copy(hostWorld);
      horizonMesh.position.set(hostWorld.x, hostWorld.y + r * 1.04, hostWorld.z);
    }
  };
}
