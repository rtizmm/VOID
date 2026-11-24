import * as THREE from 'three';

export function createCockpitAndRecorder({
  scene,
  camera,
  canvas,
  objects,
  notify = () => {},
  addShake = () => {}
}) {
  const $ = s => document.querySelector(s);

  // === 3D HYPERSPACE WARP STAR-STREAKS (attached in camera local space!) ===
  const STREAK_COUNT = 220;
  const streakPos = new Float32Array(STREAK_COUNT * 2 * 3);
  const streakCol = new Float32Array(STREAK_COUNT * 2 * 3);
  const streakMeta = Array.from({ length: STREAK_COUNT }, () => {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.6 + Math.random() * 14.0;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: -Math.random() * 48 - 2,
      speed: 24 + Math.random() * 44,
      hue: Math.random() > 0.35 ? 0 : 1
    };
  });
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  streakGeo.setAttribute('color', new THREE.BufferAttribute(streakCol, 3));
  const streakMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const warpLines = new THREE.LineSegments(streakGeo, streakMat);
  warpLines.frustumCulled = false;
  warpLines.visible = false;
  camera.add(warpLines);
  if (!camera.parent) scene.add(camera);

  let warpActive = false;
  let warpBlend = 0;
  const baseFov = camera.fov;

  const hudEl = $('#cockpit-hud');
  const hudSpeedEl = $('#hud-speed');
  const hudTargetEl = $('#hud-target');
  const hudDistEl = $('#hud-dist');
  const warpBtn = $('#warp-toggle');
  const heatEdgeEl = $('#entry-heat');

  function setWarp(on) {
    warpActive = Boolean(on);
    if (warpBtn) {
      warpBtn.setAttribute('aria-pressed', String(warpActive));
      warpBtn.textContent = warpActive ? '⚡ WARP AKTİF (V)' : '⚡ Warp Atlayışı (V)';
    }
    if (warpActive) {
      addShake(0.14, 0.45);
      notify('HİPERUZAY WARP MOTORU AKTİF');
    }
  }
  if (warpBtn) warpBtn.onclick = () => setWarp(!warpActive);

  // === ONE-CLICK 60 FPS WEBM VIDEO RECORDER ===
  const recBtn = $('#record-video');
  let recorder = null;
  let recChunks = [];
  let recStart = 0;
  let recInterval = null;

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    if (recInterval) {
      clearInterval(recInterval);
      recInterval = null;
    }
    if (recBtn) {
      recBtn.classList.remove('recording');
      recBtn.textContent = '⏺ Kayıt';
    }
  }

  function toggleRecording() {
    if (recorder && recorder.state === 'recording') {
      stopRecording();
      return;
    }
    if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      notify('Tarayıcı video kaydını desteklemiyor');
      return;
    }
    try {
      const stream = canvas.captureStream(60);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : '';
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 }) : new MediaRecorder(stream);
      recChunks = [];
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) recChunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `void-kozmos-${Date.now()}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        notify('60 FPS VİDEO İNDİRİLDİ (.WEBM)');
        recorder = null;
        recChunks = [];
      };
      recorder.start(250);
      recStart = Date.now();
      if (recBtn) {
        recBtn.classList.add('recording');
        recBtn.textContent = '⏹ 00:00';
      }
      recInterval = setInterval(() => {
        const s = Math.floor((Date.now() - recStart) / 1000);
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        if (recBtn) recBtn.textContent = `⏹ ${mm}:${ss}`;
      }, 500);
      notify('VİDEO KAYDI BAŞLADI (60 FPS)');
    } catch {
      notify('Video kaydı başlatılamadı');
      stopRecording();
    }
  }
  if (recBtn) recBtn.onclick = toggleRecording;

  const tmpPos = new THREE.Vector3();
  const fwdVec = new THREE.Vector3();

  return {
    isWarpActive: () => warpActive,
    toggleWarp: () => setWarp(!warpActive),
    setWarp,
    update(dt, { mode, flightSpeed, moveLen }) {
      const inCockpit = mode === 'cockpit';
      if (hudEl) hudEl.hidden = !inCockpit;
      if (!inCockpit && warpActive) setWarp(false);

      // Smooth warp transition & FOV expansion (55 -> 82 deg)
      const targetBlend = inCockpit && warpActive ? 1 : 0;
      warpBlend += (targetBlend - warpBlend) * Math.min(1, dt * 5.5);

      const targetFov = baseFov + warpBlend * 27;
      if (Math.abs(camera.fov - targetFov) > 0.04) {
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }

      if (warpBlend > 0.015) {
        warpLines.visible = true;
        streakMat.opacity = warpBlend * 0.85;
        const streakLen = 1.6 + warpBlend * 8.5;
        for (let i = 0; i < STREAK_COUNT; i++) {
          const m = streakMeta[i];
          m.z += m.speed * (0.4 + warpBlend * 2.2) * dt;
          if (m.z > 0.5) m.z = -46 - Math.random() * 14;
          const idx = i * 6;
          streakPos[idx] = m.x;
          streakPos[idx + 1] = m.y;
          streakPos[idx + 2] = m.z;
          streakPos[idx + 3] = m.x;
          streakPos[idx + 4] = m.y;
          streakPos[idx + 5] = m.z - streakLen;
          // Bright cyan-white head, violet-blue tail
          streakCol[idx] = 0.85;
          streakCol[idx + 1] = 0.96;
          streakCol[idx + 2] = 1.0;
          streakCol[idx + 3] = m.hue ? 0.45 : 0.25;
          streakCol[idx + 4] = m.hue ? 0.35 : 0.65;
          streakCol[idx + 5] = 0.95;
        }
        streakGeo.attributes.position.needsUpdate = true;
        streakGeo.attributes.color.needsUpdate = true;

        // Auto-cruise forward during Warp!
        if (inCockpit && warpActive) {
          camera.getWorldDirection(fwdVec);
          camera.position.addScaledVector(fwdVec, (55 + flightSpeed * 1.6) * dt);
        }
      } else {
        warpLines.visible = false;
      }

      // Compute nearest celestial body for Cockpit target lock & Atmospheric Entry Heat Vignette
      let nearestName = 'DERİN UZAY';
      let nearestDist = Infinity;
      let heatProximity = 0;

      for (const entry of objects.values()) {
        if (!entry.mesh.visible) continue;
        entry.mesh.getWorldPosition(tmpPos);
        const d = camera.position.distanceTo(tmpPos) - entry.body.size;
        if (d < nearestDist) {
          nearestDist = d;
          nearestName = entry.body.name;
        }
        // Atmospheric / Solar proximity entry glow when flying very close to a planet or Sun!
        const hotZone = entry.body.id === 'sun' ? entry.body.size * 2.4 : entry.body.size * 1.15;
        if (d < hotZone) {
          heatProximity = Math.max(heatProximity, Math.max(0, 1 - d / hotZone));
        }
      }

      if (heatEdgeEl) {
        heatEdgeEl.style.opacity = inCockpit && heatProximity > 0.05 ? String((heatProximity * 0.78).toFixed(2)) : '0';
      }

      if (inCockpit) {
        if (hudTargetEl) hudTargetEl.textContent = nearestName;
        if (hudDistEl) hudDistEl.textContent = `${Math.max(0, nearestDist).toFixed(1)} u`;
        if (hudSpeedEl) {
          hudSpeedEl.textContent = warpActive
            ? `WARP ${(2.4 + flightSpeed * 0.08).toFixed(1)}c`
            : `${Math.round(moveLen > 0 ? flightSpeed * 42 : 0).toLocaleString('tr-TR')} km/s`;
        }
      }
    }
  };
}
