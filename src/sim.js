import { gravityScenario, asteroidScenario, relativisticScenario, sandboxImpact } from './physics.js';
import { createImpactEffects } from './impact.js';

const $ = s => document.querySelector(s);
const num = n => Math.round(n).toLocaleString('tr-TR');
const fmt = n => (n >= 1e6 ? n.toExponential(2).replace('e+', ' × 10^') : n.toLocaleString('tr-TR', { maximumFractionDigits: 2 }));

const cases = [
  ['asteroid', '☄', 'Asteroit'],
  ['relativistic', '↯', 'İğne / dağ'],
  ['moon', '☾', 'Ay çarpması'],
  ['sun', '☀', 'Güneş yok'],
  ['gravity', '◎', 'Yerçekimi'],
  ['giant', '✹', 'Dev Güneş'],
  ['blackhole', '🕳', 'Kara Delik'],
  ['grb', '⚡', 'Gama & Kalkan'],
  ['storm', '☄', 'Meteor Yağmuru']
];

const range = (label, id, min, max, step, value, unit) =>
  `<div class="sim-row"><div class="sim-row-head"><label for="${id}">${label}</label><output id="${id}-value">${fmt(value)} ${unit}</output></div><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;

const PLANET_PROFILES = {
  mercury: { name: 'Merkür', temp: 167, atmo: 0, vel: 47.4, pop: 0 },
  venus: { name: 'Venüs', temp: 464, atmo: 100, vel: 35.0, pop: 0 },
  earth: { name: 'Dünya', temp: 15, atmo: 100, vel: 29.8, pop: 8.5e9 },
  mars: { name: 'Mars', temp: -65, atmo: 12, vel: 24.1, pop: 1.2e6 },
  jupiter: { name: 'Jüpiter', temp: -110, atmo: 100, vel: 13.1, pop: 0 },
  saturn: { name: 'Satürn', temp: -140, atmo: 100, vel: 9.7, pop: 0 },
  uranus: { name: 'Uranüs', temp: -195, atmo: 100, vel: 6.8, pop: 0 },
  neptune: { name: 'Neptün', temp: -200, atmo: 100, vel: 5.4, pop: 0 }
};

export function createSimulator({
  scene,
  camera,
  controls,
  objects,
  moon,
  ambient,
  light,
  sunFill,
  flyTo,
  select,
  notify,
  setPanel,
  addShake,
  pulseBloom,
  playSfx
}) {
  const earth = objects.get('earth');
  const sun = objects.get('sun');
  let targetId = 'earth';
  const currentTarget = () => objects.get(targetId) || earth;
  const targetProfile = () => PLANET_PROFILES[targetId] || PLANET_PROFILES.earth;
  const effects = createImpactEffects(scene, earth, camera, { objects, moon, addShake, pulseBloom });
  const original = { ambient: ambient.intensity, light: light.intensity, fill: sunFill.intensity };

  let open = false;
  let caseId = 'asteroid';
  let diameter = 500;
  let velocity = 20;
  let beta = 99;
  let massKind = 'needle';
  let gravity = 100;
  let solarSize = 1;
  let bhMass = 8;
  let grbDist = 1500;
  let shieldPct = 40;
  let stormCount = 9;
  let stormIntensity = 65;

  let initial = 8.5e9;
  let survivors = initial;
  let exposure = 1;
  let shelter = 0;
  let sunAge = null;
  let sunRunning = false;
  let environment = null;
  let appliedSunFraction = 0;
  let title = 'Dünya dengede';
  let description = 'Bir deney başlat. Değişiklikler sıfırlayana kadar kalır.';
  let tick = 0;
  let telTick = 0;
  let habTick = 0;
  let bhTelPhase = 0;

  // Live telemetry state
  let telTemp = 15;
  let telAtmo = 100;
  let telVel = 29.8;

  const history = [];

  function logEvent(label, detail) {
    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    history.unshift({ time, label, detail });
    if (history.length > 6) history.pop();
    const el = $('#sim-log');
    if (el) el.innerHTML = history.map(h => `<div class="log-item"><span>${h.time} · <b>${h.label}</b></span><small>${h.detail}</small></div>`).join('');
  }

  function updateTelemetry() {
    const tempEl = $('#tel-temp');
    if (tempEl) tempEl.textContent = Math.round(telTemp).toLocaleString('tr-TR') + '°C';
    const atmoEl = $('#tel-atmo');
    if (atmoEl) atmoEl.textContent = '%' + Math.round(Math.max(0, Math.min(100, telAtmo)));
    const craterEl = $('#tel-craters');
    if (craterEl) craterEl.textContent = String(effects.getCraterCount());
    const velEl = $('#tel-vel');
    if (velEl) {
      velEl.textContent =
        Math.max(0, telVel).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km/s';
    }
  }

  function stats() {
    const initEl = $('#initial-count');
    const survEl = $('#survivor-count');
    const lostEl = $('#lost-count');
    const barEl = $('#life-bar');
    const titleEl = $('#result-title');
    const descEl = $('#result-description');
    if (initEl) initEl.textContent = num(initial);
    if (survEl) survEl.textContent = num(survivors);
    if (lostEl) lostEl.textContent = num(initial - survivors);
    if (barEl) barEl.style.width = (initial ? (survivors / initial) * 100 : 100) + '%';
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = description;
    updateTelemetry();
  }

  function energy() {
    if (caseId === 'asteroid') return asteroidScenario(diameter, velocity);
    if (caseId === 'moon') {
      const j = 0.5 * 7.342e22 * (velocity * 1000) ** 2;
      return { joules: j, megatons: j / 4.184e15 };
    }
    const massMap = { needle: 0.001, car: 1500, mountain: 1e12, neutron: 1e15, antimatter: 1e9, tachyon: 1e6 };
    const m = massMap[massKind] || 0.001;
    // Sci-fi / physics-breaking boost for antimatter, tachyon, and superluminal (>= 100% c) speeds!
    if (massKind === 'antimatter') {
      const j = 2 * m * 299792458 ** 2 * Math.pow(Math.max(1, beta / 50), 2);
      return { joules: j, megatons: j / 4.184e15 };
    }
    if (massKind === 'tachyon' || beta >= 100) {
      const ftlFactor = Math.max(1.5, beta / 100);
      const baseJ = relativisticScenario(m, 99.99).joules;
      const j = baseJ * Math.pow(ftlFactor, 4.5) * (massKind === 'tachyon' ? 1e6 : 25);
      return { joules: j, megatons: j / 4.184e15 };
    }
    return relativisticScenario(m, beta);
  }

  function preview() {
    const el = $('#energy-number');
    if (el) el.textContent = fmt(energy().megatons) + ' Mt TNT';
  }

  function bindRange(id, unit, set) {
    const el = $('#' + id);
    if (el) {
      el.oninput = () => {
        set(+el.value);
        const out = $('#' + id + '-value');
        if (out) out.textContent = fmt(+el.value) + ' ' + unit;
        preview();
      };
    }
  }

  function render() {
    const tabsEl = $('#lab-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = cases
        .map(
          ([id, icon, name]) =>
            `<button class="lab-tab ${id === caseId ? 'active' : ''}" data-case="${id}" aria-pressed="${id === caseId}"><span>${icon}</span>${name}</button>`
        )
        .join('');
    }
    document.querySelectorAll('[data-case]').forEach(b => {
      b.onclick = () => {
        caseId = b.dataset.case;
        if (caseId === 'asteroid') velocity = Math.min(70, Math.max(11, velocity));
        render();
      };
    });

    let h = `<div class="sim-row"><div class="sim-row-head"><label for="target-planet">Hedef Gezegen</label><output>${targetProfile().name}</output></div><select id="target-planet" style="width:100%;background:#131b26;border:1px solid #ffffff26;border-radius:8px;padding:8px;color:#edf1f6">${Object.entries(PLANET_PROFILES)
      .map(([id, p]) => `<option value="${id}" ${id === targetId ? 'selected' : ''}>${p.name}${p.pop > 0 ? '' : ' (Koloni / Yüzey)'}</option>`)
      .join('')}</select></div>`;
    if (caseId === 'asteroid') {
      h +=
        range('Çap', 'diameter-range', 20, 20000, 10, diameter, 'm') +
        `<div class="sim-presets"><button data-size="50">50 m</button><button data-size="1000">1 km</button><button data-size="10000">10 km</button><button data-size="20000">20 km</button></div>` +
        range('Hız', 'velocity-range', 11, 70, 1, velocity, 'km/sn');
    }
    if (caseId === 'relativistic') {
      h +=
        `<div class="sim-presets">${[
          ['needle', 'İğne · 1 g'],
          ['car', 'Otomobil · 1,5 t'],
          ['mountain', 'Everest · 10¹² kg'],
          ['neutron', 'Nötron Parçası'],
          ['antimatter', 'Antimadde'],
          ['tachyon', 'Takyon · FTL']
        ]
          .map(([id, name]) => `<button class="sim-preset ${id === massKind ? 'active' : ''}" data-mass="${id}">${name}</button>`)
          .join('')}</div>` +
        range('Işık hızının yüzdesi', 'rel-speed', 10, 500, 1, beta, '% c') +
        `<div class="sim-presets"><button data-beta="99">%99 c</button><button data-beta="99.99">%99,99</button><button data-beta="100">%100 c</button><button data-beta="250">%250 Takyon</button><button data-beta="500">%500 Yırtık</button></div><p class="sim-tip">Fizik sınırlarını aş: %100 c üzeri Takyon hızları, Antimadde ve Nötron yıldızı parçaları gezegeni delip geçer veya parçalar.</p>`;
    }
    if (caseId === 'moon') {
      h +=
        range('Ay’ın çarpışma hızı', 'velocity-range', 1, 100, 1, velocity, 'km/sn') +
        `<p class="sim-tip">7,342 × 10²² kg. Ay’ı doğrudan ${targetProfile().name} üzerine gönder.</p>`;
    }
    if (caseId === 'sun') {
      h +=
        '<p class="sim-tip">Işık kaybı yaklaşık 8 dk 20 sn sonra ulaşır. Zamanı seçerek ilerle.</p><div class="sim-presets"><button data-day="0">Şimdi</button><button data-day="500">8 dk 20 sn</button><button data-day="86400">1 gün</button><button data-day="604800">1 hafta</button><button data-day="2592000">1 ay</button></div><p class="sim-tip">Soğuma derinleştikçe yüzey donar ve korunaksız nüfus hızla tükenir.</p>';
    }
    if (caseId === 'gravity') {
      h +=
        range('Yüzey yerçekimi', 'gravity-range', 0, 700, 10, gravity, '%') +
        '<p class="sim-tip">24 saatlik kurgusal etki. Yüksek veya sıfır yerçekimi yapıları ve atmosfer dengesini bozar.</p>';
    }
    if (caseId === 'giant') {
      h +=
        range('Güneş boyutu', 'solar-size', 1, 25, 1, solarSize, '×') +
        '<p class="sim-tip">Güneş büyüdükçe yüzey sıcaklığı hızla fırlar, okyanuslar buharlaşır ve atmosfer yanar.</p>';
    }
    if (caseId === 'blackhole') {
      h +=
        range('Kara delik kütlesi', 'bh-mass', 1, 50, 1, bhMass, 'M⊕') +
        '<div class="sim-presets"><button data-bh="3">3 M⊕ · Yakın geçiş</button><button data-bh="15">15 M⊕ · Gelgit</button><button data-bh="40">40 M⊕ · Yutulma</button></div><p class="sim-tip">Hedef gezegen yakınında kara delik ve yığılma diski. 35 M⊕ ve üzerinde gezegen parçalanır.</p>';
    }
    if (caseId === 'grb') {
      h +=
        range('Patlama uzaklığı', 'grb-dist', 100, 6000, 100, grbDist, 'ışık yılı') +
        range('Gezegen kalkanı', 'shield-range', 0, 100, 5, shieldPct, '%') +
        '<p class="sim-tip">Gama ışını patlaması (GRB) demeti ve deneysel gezegen kalkanı. Kalkan ışınımı ve atmosfer ısınmasını sönümler.</p>';
    }
    if (caseId === 'storm') {
      h +=
        range('Meteor sayısı', 'storm-count', 4, 15, 1, stormCount, 'meteor') +
        range('Yağmur yoğunluğu', 'storm-intensity', 20, 100, 5, stormIntensity, '%') +
        '<div class="sim-presets"><button data-storm="5,35">5 · Hafif</button><button data-storm="9,65">9 · Yoğun</button><button data-storm="15,95">15 · Kıyamet</button></div><p class="sim-tip">Farklı 3B yönlerden ardışık meteor bombardımanı. Artan sıcaklık ve atmosfer kaybı yaşamı tamamen bitirebilir.</p>';
    }

    if (['asteroid', 'relativistic', 'moon'].includes(caseId)) {
      h += '<div class="energy-preview">ÇARPIŞMA ENERJİSİ<strong id="energy-number"></strong></div>';
    }

    const pName = targetProfile().name;
    const runLabel = effects.destroyed
      ? `${pName} yok · önce sıfırla`
      : effects.busy
        ? caseId === 'storm'
          ? 'Meteor yağmuru sürüyor…'
          : 'Cisim yaklaşıyor…'
        : caseId === 'sun'
          ? sunRunning
            ? 'Zamanı duraklat'
            : 'Güneş’i yok et / devam'
          : caseId === 'gravity'
            ? 'Yerçekimini uygula'
            : caseId === 'giant'
              ? 'Güneş’i büyüt'
              : caseId === 'blackhole'
                ? 'Kara deliği oluştur 🕳'
                : caseId === 'grb'
                  ? 'Gama patlamasını ateşle ⚡'
                  : caseId === 'storm'
                    ? 'Meteor yağmurunu başlat ☄'
                    : 'Atışı başlat ↗';

    h += `<button class="sim-main-btn" id="run-case" ${effects.busy || effects.destroyed ? 'disabled' : ''}>${runLabel}</button><div class="sim-action-row"><button class="sim-reset" id="random-case" ${effects.busy || effects.destroyed ? 'disabled' : ''}>⚡ Rastgele felaket</button><button class="sim-reset" id="reset-case">↺ ${pName} sıfırla</button></div>`;

    const controlsEl = $('#lab-controls');
    if (controlsEl) controlsEl.innerHTML = h;
    if ($('#target-planet')) {
      $('#target-planet').onchange = e => {
        if (effects.busy) return;
        targetId = e.target.value;
        const entry = currentTarget();
        const prof = targetProfile();
        effects.setTarget(entry);
        initial = targetId === 'earth' ? Math.round(Math.max(0, Math.min(20, Number($('#population')?.value) || 8.5)) * 1e9) : prof.pop;
        survivors = initial;
        telTemp = prof.temp;
        telAtmo = prof.atmo;
        telVel = prof.vel;
        title = `${prof.name} hedef alındı`;
        description = prof.pop > 0 ? `${prof.name} üzerinde deney kurmaya hazırsın.` : `${prof.name} üzerinde yüzey/yörünge deneyi hazır.`;
        select(targetId);
        stats();
        render();
        notify(`HEDEF: ${prof.name.toUpperCase()}`);
      };
    }
    if ($('#run-case')) $('#run-case').onclick = run;
    if ($('#reset-case')) $('#reset-case').onclick = reset;
    if ($('#random-case')) {
      $('#random-case').onclick = () => {
        const pool = ['asteroid', 'relativistic', 'moon', 'gravity', 'giant', 'blackhole', 'grb', 'storm'];
        caseId = pool[Math.floor(Math.random() * pool.length)];
        if (caseId === 'asteroid') {
          diameter = Math.round(100 + Math.random() * 14000);
          velocity = Math.round(15 + Math.random() * 50);
        }
        if (caseId === 'gravity') gravity = Math.round(Math.random() * 65) * 10;
        if (caseId === 'giant') solarSize = Math.round(2 + Math.random() * 18);
        if (caseId === 'blackhole') bhMass = Math.round(2 + Math.random() * 42);
        if (caseId === 'grb') {
          grbDist = Math.round(2 + Math.random() * 40) * 100;
          shieldPct = Math.round(Math.random() * 18) * 5;
        }
        if (caseId === 'storm') {
          stormCount = Math.round(4 + Math.random() * 11);
          stormIntensity = Math.round(4 + Math.random() * 16) * 5;
        }
        render();
        run();
      };
    }

    bindRange('diameter-range', 'm', v => (diameter = v));
    bindRange('velocity-range', 'km/sn', v => (velocity = v));
    bindRange('rel-speed', '% c', v => (beta = v));
    bindRange('gravity-range', '%', v => (gravity = v));
    bindRange('solar-size', '×', v => (solarSize = v));
    bindRange('bh-mass', 'M⊕', v => (bhMass = v));
    bindRange('grb-dist', 'ışık yılı', v => (grbDist = v));
    bindRange('shield-range', '%', v => {
      shieldPct = v;
      effects.setShield(v);
    });
    bindRange('storm-count', 'meteor', v => (stormCount = v));
    bindRange('storm-intensity', '%', v => (stormIntensity = v));

    document.querySelectorAll('[data-size]').forEach(b => {
      b.onclick = () => {
        diameter = +b.dataset.size;
        render();
      };
    });
    document.querySelectorAll('[data-mass]').forEach(b => {
      b.onclick = () => {
        massKind = b.dataset.mass;
        render();
      };
    });
    document.querySelectorAll('[data-beta]').forEach(b => {
      b.onclick = () => {
        beta = +b.dataset.beta;
        render();
      };
    });
    document.querySelectorAll('[data-bh]').forEach(b => {
      b.onclick = () => {
        bhMass = +b.dataset.bh;
        render();
      };
    });
    document.querySelectorAll('[data-storm]').forEach(b => {
      b.onclick = () => {
        const [cnt, inten] = b.dataset.storm.split(',').map(Number);
        stormCount = cnt;
        stormIntensity = inten;
        render();
      };
    });
    document.querySelectorAll('[data-day]').forEach(b => {
      b.onclick = () => {
        if (effects.busy || effects.destroyed) return;
        if (sunAge === null) restoreEnvironment();
        sunAge = Math.max(sunAge || 0, +b.dataset.day);
        sunRunning = false;
        solar();
        render();
      };
    });
    preview();
  }

  function banner(text) {
    const el = $('#event-banner');
    if (el) {
      el.hidden = false;
      el.textContent = text;
    }
  }

  function applyFraction(fraction) {
    const f = Math.max(0, Math.min(1, fraction * exposure * (1 - (shelter / 100) * 0.8)));
    survivors = Math.max(0, survivors - Math.round(survivors * f));
    stats();
  }

  function restoreEnvironment() {
    sunAge = null;
    sunRunning = false;
    appliedSunFraction = 0;
    environment = null;
    sun.mesh.visible = true;
    sun.mesh.scale.setScalar(sun.body.size);
    ambient.intensity = original.ambient;
    light.intensity = original.light;
    sunFill.intensity = original.fill;
    effects.setEnvironmentalHeat(0);
    const halo = earth.mesh.userData.atmosphere;
    if (halo?.material?.uniforms?.intensity) halo.material.uniforms.intensity.value = 0.35;
  }

  function solar() {
    const arrived = sunAge >= 500;
    sun.mesh.visible = !arrived;
    light.intensity = arrived ? 0 : original.light;
    sunFill.intensity = arrived ? 0 : original.fill;
    ambient.intensity = arrived ? 0.11 : original.ambient;
    const days = sunAge / 86400;
    const f = Math.min(0.95, Math.max(0, days - 1) * 0.03) * (1 - (shelter / 100) * 0.8);
    if (f > appliedSunFraction) {
      survivors = Math.max(0, survivors - Math.round((survivors * (f - appliedSunFraction)) / (1 - appliedSunFraction)));
      appliedSunFraction = f;
    }

    if (arrived) {
      const coolNorm = (1 - Math.exp(-Math.max(0, sunAge - 500) / (86400 * 5.2))) / (1 - Math.exp(-(2592000 - 500) / (86400 * 5.2)));
      telTemp = Math.max(-240, 10 - 250 * Math.min(1, coolNorm));
      telAtmo = Math.max(15, 100 - Math.min(85, days * 2.8));
      telVel = Math.max(4.2, 29.8 - 5.4 - Math.min(20, days * 0.7));
    } else {
      telTemp = 15;
      telAtmo = 100;
      telVel = 29.8;
    }

    title = arrived ? 'Güneşsiz Dünya' : 'Son ışık hâlâ yolda';
    description = arrived
      ? 'Karanlık ve soğuma. Geçen süre: ' + fmt(days) + ' gün. Nüfus, kurgusal zaman modeline göre azalır.'
      : 'Işık ve çekim değişiminin ulaşması bekleniyor: ' + Math.max(0, Math.ceil(500 - sunAge)) + ' saniye.';
    banner(title);
    stats();
  }

  function run() {
    if (effects.busy || effects.destroyed) return;
    const tgt = currentTarget();
    const prof = targetProfile();
    select(targetId);
    if (innerWidth <= 760) setPanel(false);

    if (caseId === 'sun') {
      if (sunAge === null) {
        restoreEnvironment();
        sunAge = 0;
      }
      sunRunning = !sunRunning;
      solar();
      logEvent('Güneş Yokluğu', title);
      render();
      return;
    }

    if (caseId === 'gravity') {
      restoreEnvironment();
      environment = { kind: 'gravity', value: gravity, age: 0 };
      const g = gravityScenario(gravity);
      title = g.level;
      description = fmt(g.acceleration) + ' m/s² · ' + prof.name + ' üzerinde 24 saatlik yerçekimi etkisi.';
      telVel = gravity === 0 ? 0 : Math.max(0, prof.vel * Math.sqrt(gravity / 100));
      telAtmo = gravity === 0 ? 0 : Math.max(0, Math.min(100, prof.atmo - Math.abs(gravity - 100) * 0.14));
      telTemp = prof.temp + Math.round((gravity - 100) * 0.08);
      applyFraction(Math.min(0.95, Math.abs(gravity / 100 - 1) * 0.14));
      banner(`${prof.name} · Yerçekimi %${gravity}`);
      logEvent(`${prof.name} · Yerçekimi %${gravity}`, title);
      render();
      return;
    }

    if (caseId === 'giant') {
      restoreEnvironment();
      environment = { kind: 'giant', value: solarSize, age: 0 };
      sun.mesh.scale.setScalar(sun.body.size * solarSize);
      light.intensity = original.light * Math.min(4, solarSize);
      effects.setEnvironmentalHeat(Math.min(0.92, (solarSize - 1) * 0.055));
      if (addShake) addShake(0.12 + solarSize * 0.012, 0.9);
      if (pulseBloom) pulseBloom(0.9 + solarSize * 0.03);
      telTemp = Math.min(5800, prof.temp + (solarSize - 1) * 195);
      telAtmo = Math.max(0, prof.atmo - (solarSize - 1) * 6.0);
      telVel = prof.vel + (solarSize - 1) * 0.6;
      title = 'Güneş ' + solarSize + ' kat büyüdü';
      description = 'Aşırı güneş radyasyonu yüzeyi kavuruyor ve atmosferi buharlaştırıyor.';
      applyFraction(Math.min(1, (solarSize - 1) * 0.06));
      banner(title);
      logEvent('Dev Güneş ' + solarSize + '×', title);
      render();
      return;
    }

    if (caseId === 'blackhole') {
      const shatter = bhMass >= 35;
      bhTelPhase = 0;
      effects.spawnBlackHole(bhMass, shatter);
      playSfx?.('blackhole');
      const tw = tgt.mesh.getWorldPosition(camera.position.clone().set(0, 0, 0));
      const camDir = camera.position.clone().sub(tw).normalize();
      const up = camera.position.clone().set(0, 1, 0);
      const right = up.clone().cross(camDir).normalize();
      const focusPt = tw.clone().addScaledVector(right, 3.1 * Math.max(1, tgt.body.size * 0.8));
      const widePos = focusPt.clone().addScaledVector(camDir, 19.5 * Math.max(1, tgt.body.size * 0.7)).addScaledVector(up, 7.8);
      if (flyTo) flyTo(widePos, focusPt, 1.35);
      telTemp = Math.min(4800, Math.max(telTemp, prof.temp) + bhMass * (shatter ? 75 : 32));
      telAtmo = shatter ? 0 : Math.max(0, telAtmo - bhMass * 2.8);
      telVel = shatter ? 148 + bhMass * 2.4 : prof.vel + bhMass * 2.1;
      if (shatter) {
        survivors = 0;
        title = 'Olay Ufkunda Parçalanma';
        description = `${bhMass} M⊕ kütleli kara delik gelgit kuvvetleriyle ${prof.name} gezegenini esnetip yutuyor.`;
      } else {
        applyFraction(Math.min(0.95, bhMass * 0.03));
        title = 'Kara Delik Gelgit Etkisi';
        description = `${bhMass} M⊕ kara delik ${prof.name} yakınında uzay-zamanı büküyor.`;
      }
      banner(`KARA DELİK · ${prof.name} · ${bhMass} M⊕`);
      stats();
      logEvent(`Kara Delik (${prof.name})`, title);
      render();
      return;
    }

    if (caseId === 'grb') {
      const rawSeverity = Math.max(0.04, Math.min(1, (6200 - grbDist) / 6000));
      const blocked = rawSeverity * (1 - (shieldPct / 100) * 0.85);
      effects.fireGRB(shieldPct, blocked * 0.7);
      playSfx?.('grb');
      telTemp = Math.min(3500, Math.max(telTemp, prof.temp) + Math.round(blocked * 950));
      telAtmo = Math.max(0, telAtmo - blocked * 95);
      applyFraction(blocked * 0.8);
      title = shieldPct >= 80 ? 'Kalkan Gama Darbesini Sönümledi' : 'Gama Işını Patlaması (GRB)';
      description = `${prof.name} · ${grbDist} ışık yılı uzaklıktan gama demeti · Kalkan: %${shieldPct}.`;
      banner(`GRB · ${prof.name} · Kalkan %${shieldPct}`);
      stats();
      logEvent(`GRB (${prof.name})`, title);
      render();
      return;
    }

    if (caseId === 'storm') {
      sunRunning = false;
      const count = stormCount;
      const intenPct = stormIntensity;
      const inten = intenPct / 100;
      title = `${prof.name} · Meteor Yağmuru`;
      description = `${count} meteor farklı 3B yönlerden ${prof.name} yüzeyine yağıyor · Yoğunluk: %${intenPct}.`;
      stats();
      banner(`METEOR YAĞMURU · ${prof.name} · ${count} cisim`);
      effects.launchStorm(
        count,
        (struck, total) => {
          playSfx?.('impact');
          // Non-linear escalating thermal & atmospheric collapse instead of constant % division
          const heatJump = Math.round((12 + inten * 55) * (0.75 + Math.random() * 0.55) * (1 + struck / total));
          const atmoDrop = (2.5 + inten * 7.2) * (0.8 + Math.random() * 0.45);
          telTemp = Math.min(4200, Math.max(telTemp, prof.temp) + heatJump);
          telAtmo = Math.max(0, telAtmo - atmoDrop);

          if (survivors > 0) {
            const heatStress = Math.max(0, (telTemp - 75) / 280);
            const atmoStress = Math.max(0, (30 - telAtmo) / 30);
            const directLoss = Math.round(
              initial * (0.015 + inten * 0.058) * (0.65 + Math.random() * 0.7) * exposure * (1 - (shelter / 100) * 0.6)
            );
            const envLoss = Math.round(survivors * Math.min(0.7, heatStress * 0.4 + atmoStress * 0.48));
            survivors = Math.max(0, survivors - directLoss - envLoss);
            if (telTemp >= 420 || (telAtmo <= 0 && telTemp >= 180)) survivors = 0;
          }

          title = survivors === 0 && initial > 0 ? 'Tam Yok Oluş · Yaşanmaz Gezegen' : `Meteor Yağmuru · ${struck}/${total}`;
          description =
            survivors === 0 && initial > 0
              ? `Yüzey ${Math.round(telTemp)}°C'ye ulaştı ve atmosfer (%${Math.round(telAtmo)}) çöktü — yaşam tamamen sona erdi.`
              : `Yoğunluk %${intenPct} · Sıcaklık hızla artıyor, atmosfer inceliyor.`;
          banner(`METEOR YAĞMURU · ${struck}/${total} çarpma`);
          stats();
        },
        () => {
          if (survivors > 0 && (telTemp >= 380 || telAtmo <= 2)) survivors = 0;
          title = survivors === 0 && initial > 0 ? 'Tam Yok Oluş · Yaşanmaz Gezegen' : 'Meteor Yağmuru Tamamlandı';
          description =
            survivors === 0 && initial > 0
              ? `${count} meteor sonrası yüzey (${Math.round(telTemp)}°C) ve atmosfer (%${Math.round(telAtmo)}) yaşamı imkânsız kıldı.`
              : `${count} meteor (%${intenPct} yoğunluk) ${prof.name} yüzeyine çarptı. Aktif krater: ${effects.getCraterCount()}.`;
          banner(`METEOR YAĞMURU · ${count} çarpma tamamlandı`);
          logEvent(`Meteor (${prof.name})`, `${count} meteor · %${intenPct}`);
          stats();
          render();
        },
        inten
      );
      render();
      return;
    }

    sunRunning = false;
    const e = energy();
    const r = sandboxImpact(e.joules, survivors, exposure, shelter);
    const kind = caseId === 'relativistic' ? massKind : caseId;
    const ftl = caseId === 'relativistic' && (beta >= 100 || kind === 'tachyon' || kind === 'antimatter' || kind === 'neutron');
    title = ftl ? 'Egzotik / Işık Ötesi Atış' : 'Cisim yaklaşıyor';
    description = `${prof.name} hedefte · ${fmt(e.megatons)} Mt TNT.`;
    stats();
    banner(ftl ? `01 / EGZOTİK ATIŞ · ${prof.name} · %${beta} c` : `01 / YAKLAŞMA · ${prof.name}`);
    effects.launch(
      r,
      kind,
      () => {
        playSfx?.(ftl ? 'grb' : 'impact');
        survivors = r.survivors;
        telTemp = Math.min(5500, Math.max(telTemp, prof.temp) + (r.fragment ? 3200 : Math.round(18 + Math.pow(r.damage, 2.0) * 1950)));
        telAtmo = r.fragment ? 0 : Math.max(0, telAtmo - (5 + Math.pow(r.damage, 1.4) * 85));
        if (r.fragment) {
          telVel = 0;
          survivors = 0;
        }
        if (telTemp >= 420 || (telAtmo <= 0 && telTemp >= 180)) survivors = 0;
        title = r.fragment ? `${prof.name} Parçalandı` : survivors === 0 && initial > 0 ? 'Tam Yok Oluş · Yaşanmaz Gezegen' : r.level;
        description =
          fmt(e.megatons) +
          ' Mt TNT · ' +
          (r.fragment
            ? `${prof.name} tamamen parçalandı. Yeni deney için sıfırla.`
            : ftl
              ? `Egzotik atış ${prof.name} gezegenini delip geçti ve aşırı termal şok yarattı.`
              : 'Magma çatlakları, krater ve enkaz sahneye işlendi.');
        stats();
        banner(`02 / SONUÇ · ${title}`);
        logEvent(`${kind.toUpperCase()} (${prof.name})`, `${fmt(e.megatons)} Mt`);
        render();
      },
      { ftl, beta }
    );
    render();
  }

  function reset() {
    effects.reset();
    restoreEnvironment();
    playSfx?.('reset');
    const prof = targetProfile();
    initial = targetId === 'earth' ? Math.round(Math.max(0, Math.min(20, Number($('#population')?.value) || 0)) * 1e9) : prof.pop;
    survivors = initial;
    exposure = Number($('#exposure')?.value) || 1;
    shelter = Number($('#shelter')?.value) || 0;
    telTemp = prof.temp;
    telAtmo = prof.atmo;
    telVel = prof.vel;
    bhTelPhase = 0;
    title = `${prof.name} dengede`;
    description = `Yeni ${prof.name} hazır. Deney sonuçları sıfırlandı.`;
    if ($('#event-banner')) $('#event-banner').hidden = true;
    history.length = 0;
    if ($('#sim-log')) $('#sim-log').innerHTML = '';
    stats();
    render();
    select(targetId);
    notify(`${prof.name.toUpperCase()} VE SİSTEM SIFIRLANDI`);
  }

  if ($('#shelter')) {
    $('#shelter').oninput = e => {
      if ($('#shelter-value')) $('#shelter-value').textContent = '%' + e.target.value;
    };
  }
  if ($('#new-world')) $('#new-world').onclick = reset;

  function enter() {
    open = true;
    document.body.classList.add('sim-mode');
    if ($('#lab')) $('#lab').hidden = false;
    if ($('#outcome')) $('#outcome').hidden = false;
    if ($('#view-sim')) $('#view-sim').classList.add('active');
    if ($('#view-explore')) $('#view-explore').classList.remove('active');
    setPanel(true);
    select('earth');
    render();
    stats();
  }

  function leave() {
    open = false;
    document.body.classList.remove('sim-mode');
    if ($('#lab')) $('#lab').hidden = true;
    if ($('#view-sim')) $('#view-sim').classList.remove('active');
    if ($('#view-explore')) $('#view-explore').classList.add('active');
    setPanel(innerWidth > 760);
  }

  if ($('#view-sim')) $('#view-sim').onclick = enter;
  if ($('#view-explore')) $('#view-explore').onclick = leave;

  return {
    enter,
    leave,
    isOpen: () => open,
    isSunGone: () => sunAge !== null && sunAge >= 500,
    isBodyCaptured: id => effects.isBodyCaptured(id),
    isBlackHoleActive: () => effects.isBlackHoleActive,
    update(dt) {
      effects.update(dt);
      tick += dt;
      telTick += dt;
      habTick += dt;
      // Continuous habitability & extinction engine: uninhabitable planets cannot sustain life!
      if (dt > 0 && habTick >= 0.25 && survivors > 0 && initial > 0) {
        const hdt = habTick;
        habTick = 0;
        const lethalMolten = telTemp >= 350 || (telAtmo <= 2 && telTemp >= 150) || telTemp <= -190;
        const severeUninhabitable = telAtmo <= 12 || telTemp >= 95 || telTemp <= -90;
        if (lethalMolten) {
          const drop = Math.max(Math.ceil(initial * 0.14), Math.round(survivors * Math.min(1, hdt * 1.45)));
          survivors = Math.max(0, survivors - drop);
          if (survivors < initial * 0.002) survivors = 0;
          if (survivors === 0) {
            title = 'Tam Yok Oluş · Yaşanmaz Gezegen';
            description = `Yüzey sıcaklığı (${Math.round(telTemp)}°C) ve atmosfer (%${Math.round(telAtmo)}) tüm yaşamı bitirdi.`;
            banner(`YOK OLUŞ · ${targetProfile().name} artık yaşanmaz`);
          }
          stats();
        } else if (severeUninhabitable) {
          const bunkerCap = Math.round(initial * (shelter / 100) * 0.65);
          const exposed = Math.max(0, survivors - bunkerCap);
          if (exposed > 0) {
            const severity =
              (telAtmo <= 12 ? (15 - telAtmo) / 15 : 0) +
              (telTemp >= 95 ? (telTemp - 85) / 220 : 0) +
              (telTemp <= -90 ? (-80 - telTemp) / 140 : 0);
            const rate = Math.min(0.85, Math.max(0.08, severity * 0.42)) * hdt;
            const loss = Math.max(Math.ceil(exposed * 0.06), Math.round(exposed * rate));
            survivors = Math.max(bunkerCap, survivors - loss);
            if (survivors === 0) {
              title = 'Tam Yok Oluş · Yaşanmaz Gezegen';
              description = `Atmosfer (%${Math.round(telAtmo)}) ve sıcaklık (${Math.round(telTemp)}°C) yaşam koşullarını yok etti.`;
            }
            stats();
          }
        }
      }
      if (sunRunning) {
        sunAge = Math.min(2592000, sunAge + dt * 3600);
        if (sunAge >= 2592000) {
          sunRunning = false;
          render();
        }
        if (tick > 0.15) {
          solar();
          tick = 0;
        }
      }
      if (effects.isBlackHoleActive && dt > 0) {
        bhTelPhase += dt;
        if (telTick > 0.18) {
          telTick = 0;
          if (!earth.mesh.visible) {
            telVel = 0;
            telAtmo = 0;
            telTemp = 4800;
          } else {
            const baseV = bhMass >= 35 ? 148 + bhMass * 2.4 : 29.8 + bhMass * 2.1;
            telVel = baseV + Math.sin(bhTelPhase * 2.4) * (1.8 + bhMass * 0.14);
          }
          updateTelemetry();
        }
      }
      if (environment) {
        environment.age += dt;
        const halo = earth.mesh.userData.atmosphere;
        if (halo?.material?.uniforms?.intensity) {
          halo.material.uniforms.intensity.value =
            environment.kind === 'gravity' ? 0.35 + Math.abs(environment.value - 100) / 700 : 0.35;
        }
      }
    },
    get gravity() {
      return environment?.kind === 'gravity' ? environment.value : 100;
    }
  };
}
