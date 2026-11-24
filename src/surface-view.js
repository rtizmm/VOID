import * as THREE from 'three';

export function createSurfaceView({ scene, objects, camera, controls, notify = () => {} }) {
  let active = false;
  let hostId = 'earth';
  const hostWorld = new THREE.Vector3();
  const upDir = new THREE.Vector3(0, 1, 0);
  const lookTarget = new THREE.Vector3();

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
    const id = planetId === 'mars' ? 'mars' : 'earth';
    const entry = objects.get(id);
    if (!entry || !entry.mesh.visible) return false;
    hostId = id;
    active = true;
    horizonMesh.material.color.setHex(id === 'mars' ? 0xd97348 : 0x3b86e8);
    horizonMesh.visible = true;
    controls.enabled = true;

    entry.mesh.getWorldPosition(hostWorld);
    const r = entry.body.size;
    // Place observer right on the northern mid-latitude surface looking up into the sky!
    camera.position.set(hostWorld.x, hostWorld.y + r * 1.12, hostWorld.z + r * 0.22);
    controls.target.set(hostWorld.x + 8, hostWorld.y + r * 3.8, hostWorld.z - 6);
    controls.minDistance = 0.4;
    controls.update();
    notify(`YÜZEY GÖZLEMİ · ${entry.body.name} GÖKYÜZÜ`);
    return true;
  }

  function exit() {
    if (!active) return;
    active = false;
    horizonMesh.visible = false;
    controls.minDistance = 2;
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
      // Anchor camera smoothly onto the planet's moving surface while preserving user's sky look angle
      lookTarget.copy(controls.target).sub(camera.position);
      camera.position.set(hostWorld.x, hostWorld.y + r * 1.12, hostWorld.z + r * 0.22);
      controls.target.copy(camera.position).add(lookTarget);
      horizonMesh.position.set(hostWorld.x, hostWorld.y + r * 1.04, hostWorld.z + r * 0.22);
      horizonMesh.quaternion.setFromUnitVectors(upDir, upDir);
    }
  };
}
