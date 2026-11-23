import { gravityScenario, asteroidScenario, relativisticScenario, sandboxImpact } from './physics.js';
import { createImpactEffects } from './impact.js';

const $ = s => document.querySelector(s);
const hasOwn = Object.prototype.hasOwnProperty;

function clampFinite(value, min, max, fallback) {
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function isAllowedKey(obj, key) {
  return typeof key === 'string' && hasOwn.call(obj, key);
}

const num = n => (Number.isFinite(n) ? Math.round(n).toLocaleString('tr-TR') : '0');
const fmt = n => {
  if (!Number.isFinite(n)) return '0';
  return n >= 1e6 ? n.toExponential(2).replace('e+', ' × 10^') : n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
};

const CASES = Object.freeze([
  Object.freeze(['asteroid', '☄', 'Asteroit']),
  Object.freeze(['relativistic', '↯', 'İğne / dağ']),
  Object.freeze(['moon', '☾', 'Ay çarpması']),
  Object.freeze(['sun', '☀', 'Güneş yok']),
  Object.freeze(['gravity', '◎', 'Yerçekimi']),
  Object.freeze(['giant', '✹', 'Dev Güneş']),
  Object.freeze(['blackhole', '🕳', 'Kara Delik']),
  Object.freeze(['grb', '⚡', 'Gama & Kalkan']),
  Object.freeze(['storm', '☄', 'Meteor Yağmuru'])
]);
const CASE_IDS = new Set(CASES.map(([id]) => id));

const PLANET_PROFILES = Object.freeze({
  sun: Object.freeze({ name: 'Güneş', temp: 5500, atmo: 0, vel: 0, pop: 0 }),
  mercury: Object.freeze({ name: 'Merkür', temp: 167, atmo: 0, vel: 47.4, pop: 0 }),
  venus: Object.freeze({ name: 'Venüs', temp: 464, atmo: 100, vel: 35.0, pop: 0 }),
  earth: Object.freeze({ name: 'Dünya', temp: 15, atmo: 100, vel: 29.8, pop: 8.5e9 }),
  mars: Object.freeze({ name: 'Mars', temp: -65, atmo: 12, vel: 24.1, pop: 1.2e6 }),
  jupiter: Object.freeze({ name: 'Jüpiter', temp: -110, atmo: 100, vel: 13.1, pop: 0 }),
  saturn: Object.freeze({ name: 'Satürn', temp: -140, atmo: 100, vel: 9.7, pop: 0 }),
  uranus: Object.freeze({ name: 'Uranüs', temp: -195, atmo: 100, vel: 6.8, pop: 0 }),
  neptune: Object.freeze({ name: 'Neptün', temp: -200, atmo: 100, vel: 5.4, pop: 0 })
});
const PLANET_IDS = Object.freeze(Object.keys(PLANET_PROFILES));

const MASS_MAP = Object.freeze({
  needle: 0.001,
  car: 1500,
  mountain: 1e12,
  neutron: 1e15,
  antimatter: 1e9,
  tachyon: 1e6
});

const EXOTIC_MASS_PRESETS = Object.freeze([
  Object.freeze(['needle', 'İğne · 1 g']),
  Object.freeze(['car', 'Otomobil · 1,5 t']),
  Object.freeze(['mountain', 'Everest · 10¹² kg']),
  Object.freeze(['neutron', 'Nötron Parçası']),
  Object.freeze(['antimatter', 'Antimadde']),
  Object.freeze(['tachyon', 'Takyon · FTL'])
]);

const ACTION_COOLDOWN_MS = 180;
const nowMs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

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
  const currentTarget = () =>
    (isAllowedKey(PLANET_PROFILES, targetId) && objects.get(targetId)) || earth;
  const targetProfile = () =>
    isAllowedKey(PLANET_PROFILES, targetId) ? PLANET_PROFILES[targetId] : PLANET_PROFILES.earth;
  const effects = createImpactEffects(scene, earth, camera, { objects, moon, addShake, pulseBloom });
  const original = {
    ambient: ambient.intensity,
    light: light.intensity,
    fill: sunFill.intensity,
    earthAtmo: earth?.mesh?.userData?.atmosphere?.material?.uniforms?.intensity?.value ?? 0.35
  };

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
  let experimentRun = false;
  let launching = false;
  let runEpoch = 0;
  let lastRunAt = 0;

  // Live telemetry state
  let telTemp = 15;
  let telAtmo = 100;
  let telVel = 29.8;

  const history = [];

  function readPopulationBillions(fallback = 8.5) {
    return clampFinite($('#population')?.value, 0, 20, fallback);
  }

  function readExposureInput() {
    return clampFinite($('#exposure')?.value, 0.1, 2, 1);
  }

  function readShelterInput() {
    return Math.round(clampFinite($('#shelter')?.value, 0, 100, 0));
  }

  function renderLog() {
    const el = $('#sim-log');
    if (!el) return;
    const nodes = history.map(h => {
      const row = document.createElement('div');
      row.className = 'log-item';
      const head = document.createElement('span');
      head.append(document.createTextNode(`${h.time} · `));
      const strong = document.createElement('b');
      strong.textContent = h.label;
      head.append(strong);
      const small = document.createElement('small');
      small.textContent = h.detail;
      row.append(head, small);
      return row;
    });
    el.replaceChildren(...nodes);
  }

  function logEvent(label, detail) {
    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    history.unshift({
      time,
      label: String(label ?? ''),
      detail: String(detail ?? '')
    });
    if (history.length > 6) history.pop();
    renderLog();
  }

  function updateTelemetry() {
    const tempEl = $('#tel-temp');
    if (tempEl) {
      const safeTemp = clampFinite(telTemp, -273, 10000, targetProfile().temp);
      tempEl.textContent = Math.round(safeTemp).toLocaleString('tr-TR') + '°C';
    }
    const atmoEl = $('#tel-atmo');
    if (atmoEl) {
      const safeAtmo = clampFinite(telAtmo, 0, 100, targetProfile().atmo);
      atmoEl.textContent = '%' + Math.round(safeAtmo);
    }
    const craterEl = $('#tel-craters');
    if (craterEl) craterEl.textContent = String(Math.max(0, Math.round(clampFinite(effects.getCraterCount(), 0, 1000, 0))));
    const velEl = $('#tel-vel');
    if (velEl) {
      const safeVel = clampFinite(telVel, 0, 100000, targetProfile().vel);
      velEl.textContent =
        safeVel.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km/s';
    }
  }

  function stats() {
    const initEl = $('#initial-count');
    const survEl = $('#survivor-count');
    const lostEl = $('#lost-count');
    const barEl = $('#life-bar');
    const titleEl = $('#result-title');
    const descEl = $('#result-description');
    const safeInitial = Math.max(0, clampFinite(initial, 0, 20e9, 0));
    const safeSurvivors = clampFinite(survivors, 0, safeInitial, 0);
    if (initEl) initEl.textContent = num(safeInitial);
    if (survEl) survEl.textContent = num(safeSurvivors);
    if (lostEl) lostEl.textContent = num(Math.max(0, safeInitial - safeSurvivors));
    if (barEl) {
      const pct = safeInitial > 0 ? clampFinite((safeSurvivors / safeInitial) * 100, 0, 100, 0) : 100;
      barEl.style.width = pct + '%';
    }
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = description;
    updateTelemetry();
  }

  function energy() {
    if (caseId === 'asteroid') {
      return asteroidScenario(clampFinite(diameter, 20, 20000, 500), clampFinite(velocity, 11, 70, 20));
    }
    if (caseId === 'moon') {
      const safeVel = clampFinite(velocity, 1, 100, 20);
      const j = 0.5 * 7.342e22 * (safeVel * 1000) ** 2;
      return { joules: j, megatons: j / 4.184e15 };
    }
    const safeKind = isAllowedKey(MASS_MAP, massKind) ? massKind : 'needle';
    const m = MASS_MAP[safeKind];
    const safeBeta = clampFinite(beta, 10, 500, 99);
    // Sci-fi / physics-breaking boost for antimatter, tachyon, and superluminal (>= 100% c) speeds!
    if (safeKind === 'antimatter') {
      const j = 2 * m * 299792458 ** 2 * Math.pow(Math.max(1, safeBeta / 50), 2);
      return { joules: Number.isFinite(j) ? j : 1e40, megatons: Number.isFinite(j) ? j / 4.184e15 : 1e40 / 4.184e15 };
    }
    if (safeKind === 'tachyon' || safeBeta >= 100) {
      const ftlFactor = Math.max(1.5, safeBeta / 100);
      const baseJ = relativisticScenario(m, 99.99).joules;
      const j = baseJ * Math.pow(ftlFactor, 4.5) * (safeKind === 'tachyon' ? 1e6 : 25);
      const safeJ = Number.isFinite(j) ? j : 1e40;
      return { joules: safeJ, megatons: safeJ / 4.184e15 };
    }
    return relativisticScenario(m, safeBeta);
  }

  function preview() {
    const el = $('#energy-number');
    if (el) el.textContent = fmt(energy().megatons) + ' Mt TNT';
  }

  function createRangeControl({ label, id, min, max, step, value, unit, onChange }) {
    const safeVal = clampFinite(value, min, max, min);
    const row = document.createElement('div');
    row.className = 'sim-row';

    const head = document.createElement('div');
    head.className = 'sim-row-head';
    const lbl = document.createElement('label');
    lbl.htmlFor = id;
    lbl.textContent = label;
    const out = document.createElement('output');
    out.id = `${id}-value`;
    out.textContent = `${fmt(safeVal)} ${unit}`;
    head.append(lbl, out);

    const input = document.createElement('input');
    input.id = id;
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(safeVal);
    input.oninput = () => {
      const v = clampFinite(input.value, min, max, safeVal);
      onChange(v);
      out.textContent = `${fmt(v)} ${unit}`;
      preview();
    };

    row.append(head, input);
    return row;
  }

  function createPresetGroup(items) {
    const wrap = document.createElement('div');
    wrap.className = 'sim-presets';
    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      if (item.className) btn.className = item.className;
      if (item.dataset) {
        for (const [k, v] of Object.entries(item.dataset)) {
          btn.dataset[k] = String(v);
        }
      }
      btn.textContent = item.label;
      btn.onclick = item.onClick;
      wrap.append(btn);
    }
    return wrap;
  }

  function createTip(text) {
    const p = document.createElement('p');
    p.className = 'sim-tip';
    p.textContent = text;
    return p;
  }

  function switchTarget(nextId) {
    if (effects.busy) return false;
    if (!isAllowedKey(PLANET_PROFILES, nextId) || !objects.has(nextId)) return false;
    runEpoch++;
    lastRunAt = 0;
    experimentRun = false;
    if (effects.isBlackHoleActive || effects.destroyed) effects.reset();
    if (sunAge !== null || environment) restoreEnvironment();
    targetId = nextId;
    const entry = currentTarget();
    const prof = targetProfile();
    effects.setTarget(entry);
    exposure = readExposureInput();
    shelter = readShelterInput();
    initial = targetId === 'earth' ? Math.round(readPopulationBillions(8.5) * 1e9) : prof.pop;
    survivors = initial;
    telTemp = prof.temp;
    telAtmo = prof.atmo;
    telVel = prof.vel;
    bhTelPhase = 0;
    title = `${prof.name} hedef alındı`;
    description =
      prof.pop > 0
        ? `${prof.name} üzerinde deney kurmaya hazırsın.`
        : `${prof.name} üzerinde yüzey/yörünge deneyi hazır.`;
    if ($('#event-banner')) $('#event-banner').hidden = true;
    select(targetId);
    stats();
    render();
    notify(`HEDEF: ${prof.name.toUpperCase()}`);
    return true;
  }

  function render() {
    const tabsEl = $('#lab-tabs');
    if (tabsEl) {
      const tabNodes = CASES.map(([id, icon, name]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = id === caseId ? 'lab-tab active' : 'lab-tab';
        btn.dataset.case = id;
        btn.setAttribute('aria-pressed', String(id === caseId));
        const iconSpan = document.createElement('span');
        iconSpan.textContent = icon;
        btn.append(iconSpan, document.createTextNode(name));
        btn.onclick = () => {
          if (!CASE_IDS.has(id)) return;
          caseId = id;
          if (caseId === 'asteroid') velocity = clampFinite(velocity, 11, 70, 20);
          render();
        };
        return btn;
      });
      tabsEl.replaceChildren(...tabNodes);
    }

    const controlsEl = $('#lab-controls');
    if (!controlsEl) return;

    const pName = targetProfile().name;
    const nodes = [];

    // Target planet selector (styled via .sim-select — zero inline styles)
    const targetRow = document.createElement('div');
    targetRow.className = 'sim-row';
    const targetHead = document.createElement('div');
    targetHead.className = 'sim-row-head';
    const targetLbl = document.createElement('label');
    targetLbl.htmlFor = 'target-planet';
    targetLbl.textContent = 'Hedef Gezegen';
    const targetOut = document.createElement('output');
    targetOut.textContent = pName;
    targetHead.append(targetLbl, targetOut);

    const targetSelect = document.createElement('select');
    targetSelect.id = 'target-planet';
    targetSelect.className = 'sim-select';
    targetSelect.disabled = effects.busy;
    for (const id of PLANET_IDS) {
      const p = PLANET_PROFILES[id];
      const opt = document.createElement('option');
      opt.value = id;
      opt.selected = id === targetId;
      opt.textContent = p.pop > 0 ? p.name : `${p.name} (Koloni / Yüzey)`;
      targetSelect.append(opt);
    }
    targetSelect.onchange = e => {
      if (!switchTarget(e.target.value)) {
        e.target.value = targetId;
      }
    };
    targetRow.append(targetHead, targetSelect);
    nodes.push(targetRow);

    if (caseId === 'asteroid') {
      nodes.push(
        createRangeControl({
          label: 'Çap',
          id: 'diameter-range',
          min: 20,
          max: 20000,
          step: 10,
          value: diameter,
          unit: 'm',
          onChange: v => {
            diameter = v;
          }
        }),
        createPresetGroup([
          { label: '50 m', dataset: { size: 50 }, onClick: () => { diameter = 50; render(); } },
          { label: '1 km', dataset: { size: 1000 }, onClick: () => { diameter = 1000; render(); } },
          { label: '10 km', dataset: { size: 10000 }, onClick: () => { diameter = 10000; render(); } },
          { label: '20 km', dataset: { size: 20000 }, onClick: () => { diameter = 20000; render(); } }
        ]),
        createRangeControl({
          label: 'Hız',
          id: 'velocity-range',
          min: 11,
          max: 70,
          step: 1,
          value: velocity,
          unit: 'km/sn',
          onChange: v => {
            velocity = v;
          }
        })
      );
    }

    if (caseId === 'relativistic') {
      nodes.push(
        createPresetGroup(
          EXOTIC_MASS_PRESETS.map(([id, name]) => ({
            label: name,
            className: id === massKind ? 'sim-preset active' : 'sim-preset',
            dataset: { mass: id },
            onClick: () => {
              if (!isAllowedKey(MASS_MAP, id)) return;
              massKind = id;
              render();
            }
          }))
        ),
        createRangeControl({
          label: 'Işık hızının yüzdesi',
          id: 'rel-speed',
          min: 10,
          max: 500,
          step: 0.01,
          value: beta,
          unit: '% c',
          onChange: v => {
            beta = v;
          }
        }),
        createPresetGroup([
          { label: '%99 c', dataset: { beta: 99 }, onClick: () => { beta = 99; render(); } },
          { label: '%99,99', dataset: { beta: 99.99 }, onClick: () => { beta = 99.99; render(); } },
          { label: '%100 c', dataset: { beta: 100 }, onClick: () => { beta = 100; render(); } },
          { label: '%250 Takyon', dataset: { beta: 250 }, onClick: () => { beta = 250; render(); } },
          { label: '%500 Yırtık', dataset: { beta: 500 }, onClick: () => { beta = 500; render(); } }
        ]),
        createTip(
          'Fizik sınırlarını aş: %100 c üzeri Takyon hızları, Antimadde ve Nötron yıldızı parçaları gezegeni delip geçer veya parçalar.'
        )
      );
    }

    if (caseId === 'moon') {
      nodes.push(
        createRangeControl({
          label: 'Ay’ın çarpışma hızı',
          id: 'velocity-range',
          min: 1,
          max: 100,
          step: 1,
          value: velocity,
          unit: 'km/sn',
          onChange: v => {
            velocity = v;
          }
        }),
        createTip(`7,342 × 10²² kg. Ay’ı doğrudan ${pName} üzerine gönder.`)
      );
    }

    if (caseId === 'sun') {
      const jumpDay = dayVal => {
        if (launching || effects.busy || effects.destroyed) return;
        if (sunAge === null) restoreEnvironment();
        const safeDay = clampFinite(dayVal, 0, 2592000, 0);
        sunAge = Math.max(sunAge || 0, safeDay);
        sunRunning = false;
        experimentRun = true;
        solar();
        render();
      };
      nodes.push(
        createTip('Işık kaybı yaklaşık 8 dk 20 sn sonra ulaşır. Zamanı seçerek ilerle.'),
        createPresetGroup([
          { label: 'Şimdi', dataset: { day: 0 }, onClick: () => jumpDay(0) },
          { label: '8 dk 20 sn', dataset: { day: 500 }, onClick: () => jumpDay(500) },
          { label: '1 gün', dataset: { day: 86400 }, onClick: () => jumpDay(86400) },
          { label: '1 hafta', dataset: { day: 604800 }, onClick: () => jumpDay(604800) },
          { label: '1 ay', dataset: { day: 2592000 }, onClick: () => jumpDay(2592000) }
        ]),
        createTip('Soğuma derinleştikçe yüzey donar ve korunaksız nüfus hızla tükenir.')
      );
    }

    if (caseId === 'gravity') {
      nodes.push(
        createRangeControl({
          label: 'Yüzey yerçekimi',
          id: 'gravity-range',
          min: 0,
          max: 700,
          step: 10,
          value: gravity,
          unit: '%',
          onChange: v => {
            gravity = v;
          }
        }),
        createTip('24 saatlik kurgusal etki. Yüksek veya sıfır yerçekimi yapıları ve atmosfer dengesini bozar.')
      );
    }

    if (caseId === 'giant') {
      nodes.push(
        createRangeControl({
          label: 'Güneş boyutu',
          id: 'solar-size',
          min: 1,
          max: 25,
          step: 1,
          value: solarSize,
          unit: '×',
          onChange: v => {
            solarSize = v;
          }
        }),
        createTip('Güneş büyüdükçe yüzey sıcaklığı hızla fırlar, okyanuslar buharlaşır ve atmosfer yanar.')
      );
    }

    if (caseId === 'blackhole') {
      nodes.push(
        createRangeControl({
          label: 'Kara delik kütlesi',
          id: 'bh-mass',
          min: 1,
          max: 50,
          step: 1,
          value: bhMass,
          unit: 'M⊕',
          onChange: v => {
            bhMass = v;
          }
        }),
        createPresetGroup([
          { label: '3 M⊕ · Yakın geçiş', dataset: { bh: 3 }, onClick: () => { bhMass = 3; render(); } },
          { label: '15 M⊕ · Gelgit', dataset: { bh: 15 }, onClick: () => { bhMass = 15; render(); } },
          { label: '40 M⊕ · Yutulma', dataset: { bh: 40 }, onClick: () => { bhMass = 40; render(); } }
        ]),
        createTip('Hedef gezegen yakınında kara delik ve yığılma diski. 35 M⊕ ve üzerinde gezegen parçalanır.')
      );
    }

    if (caseId === 'grb') {
      nodes.push(
        createRangeControl({
          label: 'Patlama uzaklığı',
          id: 'grb-dist',
          min: 100,
          max: 6000,
          step: 100,
          value: grbDist,
          unit: 'ışık yılı',
          onChange: v => {
            grbDist = v;
          }
        }),
        createRangeControl({
          label: 'Gezegen kalkanı',
          id: 'shield-range',
          min: 0,
          max: 100,
          step: 5,
          value: shieldPct,
          unit: '%',
          onChange: v => {
            shieldPct = v;
            effects.setShield(v);
          }
        }),
        createTip(
          'Gama ışını patlaması (GRB) demeti ve deneysel gezegen kalkanı. Kalkan ışınımı ve atmosfer ısınmasını sönümler.'
        )
      );
    }

    if (caseId === 'storm') {
      const setStorm = (cnt, inten) => {
        stormCount = Math.round(clampFinite(cnt, 4, 15, 9));
        stormIntensity = Math.round(clampFinite(inten, 20, 100, 65));
        render();
      };
      nodes.push(
        createRangeControl({
          label: 'Meteor sayısı',
          id: 'storm-count',
          min: 4,
          max: 15,
          step: 1,
          value: stormCount,
          unit: 'meteor',
          onChange: v => {
            stormCount = Math.round(v);
          }
        }),
        createRangeControl({
          label: 'Yağmur yoğunluğu',
          id: 'storm-intensity',
          min: 20,
          max: 100,
          step: 5,
          value: stormIntensity,
          unit: '%',
          onChange: v => {
            stormIntensity = Math.round(v);
          }
        }),
        createPresetGroup([
          { label: '5 · Hafif', dataset: { storm: '5,35' }, onClick: () => setStorm(5, 35) },
          { label: '9 · Yoğun', dataset: { storm: '9,65' }, onClick: () => setStorm(9, 65) },
          { label: '15 · Kıyamet', dataset: { storm: '15,95' }, onClick: () => setStorm(15, 95) }
        ]),
        createTip(
          'Farklı 3B yönlerden ardışık meteor bombardımanı. Artan sıcaklık ve atmosfer kaybı yaşamı tamamen bitirebilir.'
        )
      );
    }

    if (caseId === 'asteroid' || caseId === 'relativistic' || caseId === 'moon') {
      const energyBox = document.createElement('div');
      energyBox.className = 'energy-preview';
      energyBox.append(document.createTextNode('ÇARPIŞMA ENERJİSİ'));
      const energyStrong = document.createElement('strong');
      energyStrong.id = 'energy-number';
      energyBox.append(energyStrong);
      nodes.push(energyBox);
    }

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

    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'sim-main-btn';
    runBtn.id = 'run-case';
    runBtn.disabled = Boolean(effects.busy || effects.destroyed);
    runBtn.textContent = runLabel;
    runBtn.onclick = run;
    nodes.push(runBtn);

    const actionRow = document.createElement('div');
    actionRow.className = 'sim-action-row';

    const randomBtn = document.createElement('button');
    randomBtn.type = 'button';
    randomBtn.className = 'sim-reset';
    randomBtn.id = 'random-case';
    randomBtn.disabled = Boolean(effects.busy || effects.destroyed);
    randomBtn.textContent = '⚡ Rastgele felaket';
    randomBtn.onclick = () => {
      if (launching || effects.busy || effects.destroyed) return;
      const now = nowMs();
      if (now - lastRunAt < ACTION_COOLDOWN_MS) return;
      const pool = ['asteroid', 'relativistic', 'moon', 'gravity', 'giant', 'blackhole', 'grb', 'storm'];
      caseId = pool[Math.floor(Math.random() * pool.length)];
      if (caseId === 'asteroid') {
        diameter = clampFinite(Math.round(100 + Math.random() * 14000), 20, 20000, 500);
        velocity = clampFinite(Math.round(15 + Math.random() * 50), 11, 70, 20);
      }
      if (caseId === 'gravity') gravity = clampFinite(Math.round(Math.random() * 65) * 10, 0, 700, 100);
      if (caseId === 'giant') solarSize = clampFinite(Math.round(2 + Math.random() * 18), 1, 25, 4);
      if (caseId === 'blackhole') bhMass = clampFinite(Math.round(2 + Math.random() * 42), 1, 50, 8);
      if (caseId === 'grb') {
        grbDist = clampFinite(Math.round(2 + Math.random() * 40) * 100, 100, 6000, 1500);
        shieldPct = clampFinite(Math.round(Math.random() * 18) * 5, 0, 100, 40);
      }
      if (caseId === 'storm') {
        stormCount = Math.round(clampFinite(4 + Math.random() * 11, 4, 15, 9));
        stormIntensity = Math.round(clampFinite(Math.round(4 + Math.random() * 16) * 5, 20, 100, 65));
      }
      render();
      run();
    };

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'sim-reset';
    resetBtn.id = 'reset-case';
    resetBtn.textContent = `↺ ${pName} sıfırla`;
    resetBtn.onclick = reset;

    actionRow.append(randomBtn, resetBtn);
    nodes.push(actionRow);

    controlsEl.replaceChildren(...nodes);
    preview();
  }

  function banner(text) {
    const el = $('#event-banner');
    if (el) {
      el.hidden = false;
      el.textContent = String(text ?? '');
    }
  }

  function applyFraction(fraction) {
    const safeFrac = clampFinite(fraction, 0, 1, 0);
    const f = clampFinite(safeFrac * exposure * (1 - (shelter / 100) * 0.8), 0, 1, 0);
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
    if (halo?.material?.uniforms?.intensity) halo.material.uniforms.intensity.value = original.earthAtmo;
  }

  function solar() {
    const prof = targetProfile();
    const safeAge = clampFinite(sunAge, 0, 2592000, 0);
    sunAge = safeAge;
    const arrived = safeAge >= 500;
    sun.mesh.visible = !arrived;
    light.intensity = arrived ? 0 : original.light;
    sunFill.intensity = arrived ? 0 : original.fill;
    ambient.intensity = arrived ? 0.11 : original.ambient;
    const days = safeAge / 86400;
    const f = Math.min(0.95, Math.max(0, days - 1) * 0.03) * (1 - (shelter / 100) * 0.8);
    if (f > appliedSunFraction) {
      const denom = Math.max(1e-6, 1 - appliedSunFraction);
      survivors = Math.max(0, survivors - Math.round((survivors * (f - appliedSunFraction)) / denom));
      appliedSunFraction = f;
    }

    if (arrived) {
      const coolNorm =
        (1 - Math.exp(-Math.max(0, safeAge - 500) / (86400 * 5.2))) /
        (1 - Math.exp(-(2592000 - 500) / (86400 * 5.2)));
      telTemp = Math.max(-240, Math.min(prof.temp, 10) - 250 * Math.min(1, coolNorm));
      telAtmo = Math.max(0, Math.min(prof.atmo, Math.max(15, 100 - Math.min(85, days * 2.8))));
      telVel = Math.max(4.2, prof.vel - 5.4 - Math.min(20, days * 0.7));
    } else {
      telTemp = prof.temp;
      telAtmo = prof.atmo;
      telVel = prof.vel;
    }

    title = arrived ? `Güneşsiz ${prof.name}` : 'Son ışık hâlâ yolda';
    description = arrived
      ? 'Karanlık ve soğuma. Geçen süre: ' + fmt(days) + ' gün. Nüfus, kurgusal zaman modeline göre azalır.'
      : 'Işık ve çekim değişiminin ulaşması bekleniyor: ' + Math.max(0, Math.ceil(500 - safeAge)) + ' saniye.';
    banner(title);
    stats();
  }

  function updateHabitability(dt) {
    if (!experimentRun || dt <= 0 || survivors <= 0 || initial <= 0) return;
    habTick += dt;
    if (habTick < 0.25) return;
    const hdt = habTick;
    habTick = 0;

    const prof = targetProfile();
    const severeAtmo = Math.min(12, Math.max(1, prof.atmo - 3));
    const lethalMolten = telTemp >= 350 || telAtmo <= 0 || (telAtmo <= 2 && telTemp >= 150) || telTemp <= -190;
    const severeUninhabitable = telAtmo <= severeAtmo || telTemp >= 95 || telTemp <= -90;
    if (lethalMolten) {
      const drop = Math.max(Math.ceil(initial * 0.14), Math.round(survivors * Math.min(1, hdt * 1.45)));
      survivors = Math.max(0, survivors - drop);
      if (survivors < initial * 0.002) survivors = 0;
      if (survivors === 0) {
        title = 'Tam Yok Oluş · Yaşanmaz Gezegen';
        description = `Yüzey sıcaklığı (${Math.round(telTemp)}°C) ve atmosfer (%${Math.round(telAtmo)}) tüm yaşamı bitirdi.`;
        banner(`YOK OLUŞ · ${prof.name} artık yaşanmaz`);
      }
      stats();
    } else if (severeUninhabitable) {
      const bunkerCap = Math.round(initial * (shelter / 100) * 0.65);
      const exposed = Math.max(0, survivors - bunkerCap);
      if (exposed > 0) {
        const atmoSpan = severeAtmo + 3;
        const severity =
          (telAtmo <= severeAtmo ? (atmoSpan - telAtmo) / atmoSpan : 0) +
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

  function run() {
    if (launching || effects.busy || effects.destroyed) return;
    if (!CASE_IDS.has(caseId)) return;

    const now = nowMs();
    if (caseId !== 'sun' && now - lastRunAt < ACTION_COOLDOWN_MS) return;
    lastRunAt = now;

    launching = true;
    try {
      const tgt = currentTarget();
      const prof = targetProfile();
      const epoch = runEpoch;
      experimentRun = true;
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
        const safeGravity = clampFinite(gravity, 0, 700, 100);
        gravity = safeGravity;
        environment = { kind: 'gravity', value: safeGravity, age: 0 };
        const g = gravityScenario(safeGravity);
        title = g.level;
        description = fmt(g.acceleration) + ' m/s² · ' + prof.name + ' üzerinde 24 saatlik yerçekimi etkisi.';
        telVel = safeGravity === 0 ? 0 : Math.max(0, prof.vel * Math.sqrt(safeGravity / 100));
        telAtmo = safeGravity === 0 ? 0 : Math.max(0, Math.min(100, prof.atmo - Math.abs(safeGravity - 100) * 0.14));
        telTemp = prof.temp + Math.round((safeGravity - 100) * 0.08);
        applyFraction(Math.min(0.95, Math.abs(safeGravity / 100 - 1) * 0.14));
        banner(`${prof.name} · Yerçekimi %${safeGravity}`);
        logEvent(`${prof.name} · Yerçekimi %${safeGravity}`, title);
        render();
        return;
      }

      if (caseId === 'giant') {
        restoreEnvironment();
        const safeSolar = clampFinite(solarSize, 1, 25, 1);
        solarSize = safeSolar;
        environment = { kind: 'giant', value: safeSolar, age: 0 };
        sun.mesh.scale.setScalar(sun.body.size * safeSolar);
        light.intensity = original.light * Math.min(4, safeSolar);
        effects.setEnvironmentalHeat(Math.min(0.92, (safeSolar - 1) * 0.055));
        if (addShake) addShake(0.12 + safeSolar * 0.012, 0.9);
        if (pulseBloom) pulseBloom(0.9 + safeSolar * 0.03);
        telTemp = Math.min(5800, prof.temp + (safeSolar - 1) * 195);
        telAtmo = Math.max(0, prof.atmo - (safeSolar - 1) * 6.0);
        telVel = prof.vel + (safeSolar - 1) * 0.6;
        title = 'Güneş ' + safeSolar + ' kat büyüdü';
        description = 'Aşırı güneş radyasyonu yüzeyi kavuruyor ve atmosferi buharlaştırıyor.';
        applyFraction(Math.min(1, (safeSolar - 1) * 0.06));
        banner(title);
        logEvent('Dev Güneş ' + safeSolar + '×', title);
        render();
        return;
      }

      if (caseId === 'blackhole') {
        sunRunning = false;
        const safeBhMass = clampFinite(bhMass, 1, 50, 8);
        bhMass = safeBhMass;
        const shatter = safeBhMass >= 35;
        bhTelPhase = 0;
        const swallowedList = [];
        effects.spawnBlackHole(safeBhMass, shatter, (bodyId, bodyName) => {
          if (epoch !== runEpoch) return;
          const label = hasOwnProp(PLANET_PROFILES, bodyId) ? PLANET_PROFILES[bodyId].name : bodyName;
          swallowedList.push(label);
          if (bodyId === 'sun') {
            light.intensity = 0;
            sunFill.intensity = 0;
            ambient.intensity = 0.09;
            playSfx?.('blackhole');
            title = 'Güneş Yutuldu · Sistem Karanlıkta';
            description = `Kara delik Güneş'i tamamen yuttu! Tüm sistem karanlığa gömüldü (${swallowedList.length} gök cismi yutuldu).`;
            banner('KARA DELİK · GÜNEŞ YUTULDU · SİSTEM KARANLIĞA GÖMÜLDÜ');
            logEvent('GÜNEŞ YUTULDU', 'Kara delik yıldızı söndürdü');
          } else {
            if (bodyId === 'earth') survivors = 0;
            banner(`KARA DELİK · ${label.toUpperCase()} YUTULDU (${swallowedList.length} cisim)`);
            logEvent(`${label} Yutuldu`, 'Olay ufkuna çekildi');
          }
          stats();
          render();
        });
        playSfx?.('blackhole');
        const tw = tgt.mesh.getWorldPosition(camera.position.clone().set(0, 0, 0));
        const camDir = camera.position.clone().sub(tw);
        if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, 1);
        else camDir.normalize();
        const up = camera.position.clone().set(0, 1, 0);
        const right = up.clone().cross(camDir);
        if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
        else right.normalize();
        const focusPt = tw.clone().addScaledVector(right, 3.1 * Math.max(1, tgt.body.size * 0.8));
        const widePos = focusPt
          .clone()
          .addScaledVector(camDir, 19.5 * Math.max(1, tgt.body.size * 0.7))
          .addScaledVector(up, 7.8);
        if (flyTo) flyTo(widePos, focusPt, 1.35);
        telTemp = Math.min(4800, Math.max(telTemp, prof.temp) + safeBhMass * (shatter ? 75 : 32));
        telAtmo = shatter ? 0 : Math.max(0, telAtmo - safeBhMass * 2.8);
        telVel = shatter ? 148 + safeBhMass * 2.4 : prof.vel + safeBhMass * 2.1;
        if (shatter) {
          survivors = 0;
          title = 'Olay Ufkunda Parçalanma';
          description = `${safeBhMass} M⊕ kütleli kara delik gelgit kuvvetleriyle ${prof.name} gezegenini esnetip yutuyor.`;
        } else {
          applyFraction(Math.min(0.95, safeBhMass * 0.03));
          title = 'Kara Delik Gelgit Etkisi';
          description = `${safeBhMass} M⊕ kara delik ${prof.name} yakınında uzay-zamanı büküyor.`;
        }
        banner(`KARA DELİK · ${prof.name} · ${safeBhMass} M⊕`);
        stats();
        logEvent(`Kara Delik (${prof.name})`, title);
        render();
        return;
      }

      if (caseId === 'grb') {
        sunRunning = false;
        const safeDist = clampFinite(grbDist, 100, 6000, 1500);
        const safeShield = clampFinite(shieldPct, 0, 100, 40);
        grbDist = safeDist;
        shieldPct = safeShield;
        const rawSeverity = Math.max(0.04, Math.min(1, (6200 - safeDist) / 6000));
        const blocked = rawSeverity * (1 - (safeShield / 100) * 0.85);
        effects.fireGRB(safeShield, blocked * 0.7);
        playSfx?.('grb');
        telTemp = Math.min(3500, Math.max(telTemp, prof.temp) + Math.round(blocked * 950));
        telAtmo = Math.max(0, telAtmo - blocked * 95);
        applyFraction(blocked * 0.8);
        title = safeShield >= 80 ? 'Kalkan Gama Darbesini Sönümledi' : 'Gama Işını Patlaması (GRB)';
        description = `${prof.name} · ${safeDist} ışık yılı uzaklıktan gama demeti · Kalkan: %${safeShield}.`;
        banner(`GRB · ${prof.name} · Kalkan %${safeShield}`);
        stats();
        logEvent(`GRB (${prof.name})`, title);
        render();
        return;
      }

      if (caseId === 'storm') {
        sunRunning = false;
        const count = Math.round(clampFinite(stormCount, 4, 15, 9));
        const intenPct = Math.round(clampFinite(stormIntensity, 20, 100, 65));
        stormCount = count;
        stormIntensity = intenPct;
        const inten = intenPct / 100;
        title = `${prof.name} · Meteor Yağmuru`;
        description = `${count} meteor farklı 3B yönlerden ${prof.name} yüzeyine yağıyor · Yoğunluk: %${intenPct}.`;
        stats();
        banner(`METEOR YAĞMURU · ${prof.name} · ${count} cisim`);
        effects.launchStorm(
          count,
          (struck, total) => {
            if (epoch !== runEpoch) return;
            playSfx?.('impact');
            // Non-linear escalating thermal & atmospheric collapse instead of constant % division
            const heatJump = Math.round((12 + inten * 55) * (0.75 + Math.random() * 0.55) * (1 + struck / Math.max(1, total)));
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
            if (epoch !== runEpoch) return;
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
      const safeMassKind = isAllowedKey(MASS_MAP, massKind) ? massKind : 'needle';
      const kind = caseId === 'relativistic' ? safeMassKind : caseId;
      const safeBeta = clampFinite(beta, 10, 500, 99);
      const ftl =
        caseId === 'relativistic' &&
        (safeBeta >= 100 || kind === 'tachyon' || kind === 'antimatter' || kind === 'neutron');
      title = ftl ? 'Egzotik / Işık Ötesi Atış' : 'Cisim yaklaşıyor';
      description = `${prof.name} hedefte · ${fmt(e.megatons)} Mt TNT.`;
      stats();
      banner(ftl ? `01 / EGZOTİK ATIŞ · ${prof.name} · %${safeBeta} c` : `01 / YAKLAŞMA · ${prof.name}`);
      effects.launch(
        r,
        kind,
        () => {
          if (epoch !== runEpoch) return;
          playSfx?.(ftl ? 'grb' : 'impact');
          survivors = r.survivors;
          telTemp = Math.min(
            5500,
            Math.max(telTemp, prof.temp) + (r.fragment ? 3200 : Math.round(18 + Math.pow(r.damage, 2.0) * 1950))
          );
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
        { ftl, beta: safeBeta }
      );
      render();
    } finally {
      launching = false;
    }
  }

  function reset() {
    runEpoch++;
    lastRunAt = 0;
    launching = false;
    experimentRun = false;
    effects.reset();
    restoreEnvironment();
    playSfx?.('reset');
    const prof = targetProfile();
    const safePopBillions = readPopulationBillions(8.5);
    const popInput = $('#population');
    if (popInput) popInput.value = String(safePopBillions);
    initial = targetId === 'earth' ? Math.round(safePopBillions * 1e9) : prof.pop;
    survivors = initial;
    exposure = readExposureInput();
    shelter = readShelterInput();
    const shelterInput = $('#shelter');
    if (shelterInput) shelterInput.value = String(shelter);
    if ($('#shelter-value')) $('#shelter-value').textContent = '%' + shelter;
    telTemp = prof.temp;
    telAtmo = prof.atmo;
    telVel = prof.vel;
    bhTelPhase = 0;
    habTick = 0;
    title = `${prof.name} dengede`;
    description = `Yeni ${prof.name} hazır. Deney sonuçları sıfırlandı.`;
    if ($('#event-banner')) $('#event-banner').hidden = true;
    history.length = 0;
    renderLog();
    stats();
    render();
    select(targetId);
    notify(`${prof.name.toUpperCase()} VE SİSTEM SIFIRLANDI`);
  }

  const popInput = $('#population');
  if (popInput) {
    popInput.onchange = e => {
      const safePop = clampFinite(e.target.value, 0, 20, 8.5);
      e.target.value = String(safePop);
    };
  }
  const shelterInput = $('#shelter');
  if (shelterInput) {
    shelterInput.oninput = e => {
      const safeShelter = Math.round(clampFinite(e.target.value, 0, 100, 0));
      if ($('#shelter-value')) $('#shelter-value').textContent = '%' + safeShelter;
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
    select(targetId);
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
    isSunGone: () => (sunAge !== null && sunAge >= 500) || effects.isSunSwallowed(),
    isBodyCaptured: id => effects.isBodyCaptured(id),
    isBlackHoleActive: () => effects.isBlackHoleActive,
    update(dt) {
      const safeDt = clampFinite(dt, 0, 0.25, 0);
      effects.update(safeDt);
      tick += safeDt;
      telTick += safeDt;

      // Continuous habitability & extinction engine: uninhabitable planets cannot sustain life!
      updateHabitability(safeDt);

      if (sunRunning) {
        sunAge = Math.min(2592000, clampFinite(sunAge, 0, 2592000, 0) + safeDt * 3600);
        if (sunAge >= 2592000) {
          sunRunning = false;
          render();
        }
        if (tick > 0.15) {
          solar();
          tick = 0;
        }
      }
      if (effects.isBlackHoleActive && safeDt > 0) {
        bhTelPhase += safeDt;
        if (telTick > 0.18) {
          telTick = 0;
          const tgt = currentTarget();
          const prof = targetProfile();
          if (!tgt.mesh.visible) {
            telVel = 0;
            telAtmo = 0;
            telTemp = 4800;
          } else {
            const baseV = bhMass >= 35 ? 148 + bhMass * 2.4 : prof.vel + bhMass * 2.1;
            telVel = baseV + Math.sin(bhTelPhase * 2.4) * (1.8 + bhMass * 0.14);
          }
          updateTelemetry();
        }
      }
      if (environment) {
        environment.age += safeDt;
        const halo = earth.mesh.userData.atmosphere;
        if (halo?.material?.uniforms?.intensity) {
          halo.material.uniforms.intensity.value =
            environment.kind === 'gravity'
              ? original.earthAtmo + Math.abs(environment.value - 100) / 700
              : original.earthAtmo;
        }
      }
    },
    get gravity() {
      return environment?.kind === 'gravity' ? environment.value : 100;
    }
  };
}
