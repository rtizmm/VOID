import {gravityScenario,asteroidScenario,relativisticScenario,sandboxImpact} from './physics.js';
import {createImpactEffects} from './impact.js';
const $=s=>document.querySelector(s);
const num=n=>Math.round(n).toLocaleString('tr-TR');
const fmt=n=>n>=1e6?n.toExponential(2).replace('e+',' × 10^'):n.toLocaleString('tr-TR',{maximumFractionDigits:2});
const cases=[['asteroid','☄','Asteroit'],['relativistic','↯','İğne / dağ'],['moon','☾','Ay çarpması'],['sun','☀','Güneş yok'],['gravity','◎','Yerçekimi'],['giant','✹','Dev Güneş'],['blackhole','🕳','Kara Delik'],['grb','⚡','Gama & Kalkan']];
const range=(label,id,min,max,step,value,unit)=>`<div class="sim-row"><div class="sim-row-head"><label for="${id}">${label}</label><output id="${id}-value">${fmt(value)} ${unit}</output></div><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
export function createSimulator({scene,camera,controls,objects,moon,ambient,light,sunFill,flyTo,select,notify,setPanel,addShake,pulseBloom}){
 const earth=objects.get('earth'),sun=objects.get('sun');
 const effects=createImpactEffects(scene,earth,camera,{objects,moon,addShake,pulseBloom});
 const original={ambient:ambient.intensity,light:light.intensity,fill:sunFill.intensity};
 let open=false,caseId='asteroid',diameter=500,velocity=20,beta=99,massKind='needle',gravity=100,solarSize=1,bhMass=8,grbDist=1500,shieldPct=40;
 let initial=8.5e9,survivors=initial,exposure=1,shelter=0,sunAge=null,sunRunning=false,environment=null,appliedSunFraction=0;
 let title='Dünya dengede',description='Bir deney başlat. Değişiklikler dünyayı sıfırlayana kadar kalır.',tick=0;
 const history=[];
 function logEvent(label,detail){
  const time=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  history.unshift({time,label,detail});
  if(history.length>6)history.pop();
  const el=$('#sim-log');
  if(el)el.innerHTML=history.map(h=>`<div class="log-item"><span>${h.time} · <b>${h.label}</b></span><small>${h.detail}</small></div>`).join('');
 }
 function stats(){
  $('#initial-count').textContent=num(initial);$('#survivor-count').textContent=num(survivors);$('#lost-count').textContent=num(initial-survivors);
  $('#life-bar').style.width=(initial?survivors/initial*100:100)+'%';$('#result-title').textContent=title;$('#result-description').textContent=description;
 }
 function energy(){return caseId==='asteroid'?asteroidScenario(diameter,velocity):caseId==='moon'?{joules:.5*7.342e22*(velocity*1000)**2,megatons:.5*7.342e22*(velocity*1000)**2/4.184e15}:relativisticScenario(massKind==='needle'?.001:massKind==='car'?1500:1e12,beta)}
 function preview(){
  const el=$('#energy-number');if(el)el.textContent=fmt(energy().megatons)+' Mt TNT';
 }
 function bindRange(id,unit,set){const el=$('#'+id);if(el)el.oninput=()=>{set(+el.value);$('#'+id+'-value').textContent=fmt(+el.value)+' '+unit;preview()}}
 function render(){
  $('#lab-tabs').innerHTML=cases.map(([id,icon,name])=>`<button class="lab-tab ${id===caseId?'active':''}" data-case="${id}" aria-pressed="${id===caseId}"><span>${icon}</span>${name}</button>`).join('');
  document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>{caseId=b.dataset.case;if(caseId==='asteroid')velocity=Math.min(70,Math.max(11,velocity));render()});
  let h='';
  if(caseId==='asteroid')h=range('Çap','diameter-range',20,20000,10,diameter,'m')+`<div class="sim-presets"><button data-size="50">50 m</button><button data-size="1000">1 km</button><button data-size="10000">10 km</button><button data-size="20000">20 km</button></div>`+range('Hız','velocity-range',11,70,1,velocity,'km/sn');
  if(caseId==='relativistic')h=`<div class="sim-presets">${[['needle','İğne · 1 g'],['car','Otomobil · 1,5 t'],['mountain','Dağ · 10¹² kg']].map(([id,name])=>`<button class="sim-preset ${id===massKind?'active':''}" data-mass="${id}">${name}</button>`).join('')}</div>`+range('Işık hızının yüzdesi','rel-speed',10,99.99,.01,beta,'% c')+`<div class="sim-presets"><button data-beta="90">%90</button><button data-beta="99">%99</button><button data-beta="99.99">%99,99</button></div><p class="sim-tip">Kütleli cisimler tam ışık hızına ulaşamaz. Hareket, izlenebilmesi için yavaşlatılır.</p>`;
  if(caseId==='moon')h=range('Ay’ın çarpışma hızı','velocity-range',1,100,1,velocity,'km/sn')+'<p class="sim-tip">7,342 × 10²² kg. Ay’ı doğrudan Dünya’ya gönder. Yörünge ve gelgit etkileşimleri modellenmez.</p>';
  if(caseId==='sun')h='<p class="sim-tip">Işık kaybı yaklaşık 8 dk 20 sn sonra Dünya’ya ulaşır. Zamanı seçerek ilerle.</p><div class="sim-presets"><button data-day="0">Şimdi</button><button data-day="500">8 dk 20 sn</button><button data-day="86400">1 gün</button><button data-day="604800">1 hafta</button><button data-day="2592000">1 ay</button></div><p class="sim-tip">Oyun kaybı: ilk gün %0; 1–30 gün arası günde +%3, en çok %95. Korunak ayarı azaltır. Fiziksel sağkalım tahmini değildir.</p>';
  if(caseId==='gravity')h=range('Yüzey yerçekimi','gravity-range',0,700,10,gravity,'%')+'<p class="sim-tip">24 saatlik kurgusal etki. Oyun kaybı = |g/100 − 1| × %12, en çok %95; korunak ve maruziyetle değişir. Yörünge değişmez.</p>';
  if(caseId==='giant')h=range('Güneş boyutu','solar-size',1,25,1,solarSize,'×')+'<p class="sim-tip">Görsel boyut artırma deneyi; gerçek yıldız evrimi değildir. Oyun kaybı her ek boyut biriminde +%4,5; en çok %100.</p>';
  if(caseId==='blackhole')h=range('Kara delik kütlesi','bh-mass',1,50,1,bhMass,'M⊕')+'<div class="sim-presets"><button data-bh="3">3 M⊕ · Yakın geçiş</button><button data-bh="15">15 M⊕ · Gelgit</button><button data-bh="40">40 M⊕ · Yutulma</button></div><p class="sim-tip">Dünya yakınında mikro kara delik ve yığılma diski. 35 M⊕ ve üzerinde gezegen parçalanır.</p>';
  if(caseId==='grb')h=range('Patlama uzaklığı','grb-dist',100,6000,100,grbDist,'ışık yılı')+range('Gezegen kalkanı','shield-range',0,100,5,shieldPct,'%')+'<p class="sim-tip">Gama ışını patlaması (GRB) demeti ve deneysel gezegen kalkanı. Kalkan ışınımı ve atmosfer ısınmasını sönümler.</p>';
  if(['asteroid','relativistic','moon'].includes(caseId))h+='<div class="energy-preview">ÇARPIŞMA ENERJİSİ<strong id="energy-number"></strong></div>';
  h+=`<button class="sim-main-btn" id="run-case" ${effects.busy||effects.destroyed?'disabled':''}>${effects.destroyed?'Dünya yok · önce sıfırla':effects.busy?'Cisim yaklaşıyor…':caseId==='sun'?(sunRunning?'Zamanı duraklat':'Güneş’i yok et / devam'):caseId==='gravity'?'Yerçekimini uygula':caseId==='giant'?'Güneş’i büyüt':caseId==='blackhole'?'Kara deliği oluştur 🕳':caseId==='grb'?'Gama patlamasını ateşle ⚡':'Çarpışmayı başlat ↗'}</button><div class="sim-action-row"><button class="sim-reset" id="random-case" ${effects.busy||effects.destroyed?'disabled':''}>⚡ Rastgele felaket</button><button class="sim-reset" id="reset-case">↺ Dünyayı sıfırla</button></div>`;
  $('#lab-controls').innerHTML=h;$('#run-case').onclick=run;$('#reset-case').onclick=reset;
  if($('#random-case'))$('#random-case').onclick=()=>{
   const pool=['asteroid','relativistic','moon','gravity','giant','blackhole','grb'];
   caseId=pool[Math.floor(Math.random()*pool.length)];
   if(caseId==='asteroid'){diameter=Math.round(100+Math.random()*14000);velocity=Math.round(15+Math.random()*50)}
   if(caseId==='gravity')gravity=Math.round(Math.random()*65)*10;
   if(caseId==='giant')solarSize=Math.round(2+Math.random()*18);
   if(caseId==='blackhole')bhMass=Math.round(2+Math.random()*42);
   if(caseId==='grb'){grbDist=Math.round(2+Math.random()*40)*100;shieldPct=Math.round(Math.random()*18)*5}
   render();run();
  };
  bindRange('diameter-range','m',v=>diameter=v);bindRange('velocity-range','km/sn',v=>velocity=v);bindRange('rel-speed','% c',v=>beta=v);bindRange('gravity-range','%',v=>gravity=v);bindRange('solar-size','×',v=>solarSize=v);
  bindRange('bh-mass','M⊕',v=>bhMass=v);bindRange('grb-dist','ışık yılı',v=>grbDist=v);bindRange('shield-range','%',v=>{shieldPct=v;effects.setShield(v)});
  document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{diameter=+b.dataset.size;render()});
  document.querySelectorAll('[data-mass]').forEach(b=>b.onclick=()=>{massKind=b.dataset.mass;render()});
  document.querySelectorAll('[data-beta]').forEach(b=>b.onclick=()=>{beta=+b.dataset.beta;render()});
  document.querySelectorAll('[data-bh]').forEach(b=>b.onclick=()=>{bhMass=+b.dataset.bh;render()});
  document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{if(effects.busy||effects.destroyed)return;if(sunAge===null)restoreEnvironment();sunAge=Math.max(sunAge||0,+b.dataset.day);sunRunning=false;solar();render()});
  preview();
 }
 function banner(text){$('#event-banner').hidden=false;$('#event-banner').textContent=text}
 function applyFraction(fraction){const f=Math.max(0,Math.min(1,fraction*exposure*(1-shelter/100*.8)));survivors=Math.max(0,survivors-Math.round(survivors*f));stats()}
 function restoreEnvironment(){
  sunAge=null;sunRunning=false;appliedSunFraction=0;environment=null;sun.mesh.visible=true;sun.mesh.scale.setScalar(sun.body.size);
  ambient.intensity=original.ambient;light.intensity=original.light;sunFill.intensity=original.fill;effects.setEnvironmentalHeat(0);earth.mesh.userData.atmosphere.material.uniforms.intensity.value=.35;
 }
 function solar(){
  const arrived=sunAge>=500;
  sun.mesh.visible=!arrived;light.intensity=arrived?0:original.light;sunFill.intensity=arrived?0:original.fill;ambient.intensity=arrived?.11:original.ambient;
  const days=sunAge/86400,f=Math.min(.95,Math.max(0,days-1)*.03)*(1-shelter/100*.8);
  if(f>appliedSunFraction){survivors=Math.max(0,survivors-Math.round(survivors*(f-appliedSunFraction)/(1-appliedSunFraction)));appliedSunFraction=f}
  title=arrived?'Güneşsiz Dünya':'Son ışık hâlâ yolda';description=arrived?'Karanlık ve soğuma. Geçen süre: '+fmt(days)+' gün. Nüfus, kurgusal zaman modeline göre azalır.':'Işık ve çekim değişiminin ulaşması bekleniyor: '+Math.max(0,Math.ceil(500-sunAge))+' saniye.';
  banner(title);stats();
 }
 function run(){
  if(effects.busy||effects.destroyed)return;
  select('earth');
  if(innerWidth<=760)setPanel(false);
  if(caseId==='sun'){if(sunAge===null){restoreEnvironment();sunAge=0}sunRunning=!sunRunning;solar();logEvent('Güneş Yokluğu',title);render();return}
  if(caseId==='gravity'){
   restoreEnvironment();environment={kind:'gravity',value:gravity,age:0};const g=gravityScenario(gravity);
   title=g.level;description=fmt(g.acceleration)+' m/s² · 24 saatlik oyun sonucu. Yapıların ve insanların gerçek tepkisi modellenmez.';
   applyFraction(Math.min(.95,Math.abs(gravity/100-1)*.12));banner('Yerçekimi %'+gravity+' · temsili uydu/parçacık hareketi');logEvent('Yerçekimi %'+gravity,title);render();return;
  }
  if(caseId==='giant'){
   restoreEnvironment();environment={kind:'giant',value:solarSize,age:0};sun.mesh.scale.setScalar(sun.body.size*solarSize);
   light.intensity=original.light*Math.min(4,solarSize);effects.setEnvironmentalHeat(Math.min(.8,(solarSize-1)*.045));
   if(addShake)addShake(.12+solarSize*.012,.9);if(pulseBloom)pulseBloom(1.2+solarSize*.04);
   title='Güneş '+solarSize+' kat büyüdü';description='Görsel deney. Nüfus kaybı seçilen boyuta bağlı oyun katsayısıdır.';applyFraction(Math.min(1,(solarSize-1)*.045));banner(title);logEvent('Dev Güneş '+solarSize+'×',title);render();return;
  }
  if(caseId==='blackhole'){
   const shatter=bhMass>=35;
   effects.spawnBlackHole(bhMass,shatter);
   const ew=earth.mesh.getWorldPosition(camera.position.clone().set(0,0,0));
   const camDir=camera.position.clone().sub(ew).normalize();
   const up=camera.position.clone().set(0,1,0);
   const right=up.clone().cross(camDir).normalize();
   const focusPt=ew.clone().addScaledVector(right,3.1);
   const widePos=focusPt.clone().addScaledVector(camDir,19.5).addScaledVector(up,7.8);
   if(flyTo)flyTo(widePos,focusPt,1.35);
   if(shatter){survivors=0;title='Olay Ufkunda Parçalanma';description=bhMass+' M⊕ kütleli kara delik gelgit kuvvetleriyle Dünya’yı esnetip yutuyor.';}
   else{applyFraction(Math.min(.92,bhMass*.026));title='Kara Delik Gelgit Etkisi';description=bhMass+' M⊕ kara delik uzay-zamanı büküyor · yakın cisimler spiral çizerek çekiliyor.';}
   banner('KARA DELİK · '+bhMass+' M⊕ · '+title);stats();logEvent('Kara Delik ('+bhMass+' M⊕)',title);render();return;
  }
  if(caseId==='grb'){
   const rawSeverity=Math.max(.04,Math.min(1,(6200-grbDist)/6000));
   const blocked=rawSeverity*(1-shieldPct/100*.85);
   effects.fireGRB(shieldPct,blocked*.65);
   applyFraction(blocked*.75);
   title=shieldPct>=80?'Kalkan Gama Darbesini Sönümledi':'Gama Işını Patlaması (GRB)';
   description=grbDist+' ışık yılı uzaklıktan gama demeti · Kalkan: %'+shieldPct+'. Atmosfer iyonlaşması oyun modeline göre uygulandı.';
   banner('GRB · '+grbDist+' ly · Kalkan %'+shieldPct);stats();logEvent('Gama Patlaması ('+grbDist+' ly)',title);render();return;
  }
  sunRunning=false;const e=energy(),r=sandboxImpact(e.joules,survivors,exposure,shelter),kind=caseId==='relativistic'?massKind:caseId;
  title='Cisim yaklaşıyor';description='Çarpışma bekleniyor · '+fmt(e.megatons)+' Mt TNT. Seçtiğin değerler bu atış için sabitlendi.';stats();banner('01 / YAKLAŞMA · Çarpışma yavaşlatılmış gösteriliyor');
  effects.launch(r,kind,()=>{survivors=r.survivors;title=r.level;description=fmt(e.megatons)+' Mt TNT · '+(r.fragment?'Dünya parçalandı. Yeni deney için sıfırla.':'Krater, sıcak yüzey ve enkaz kalıcı olarak sahneye işlendi.');stats();banner('02 / SONUÇ · '+r.level+' · görsel ölçek temsilidir');logEvent(caseId.toUpperCase(),fmt(e.megatons)+' Mt · '+r.level);render()});render();
 }
 function reset(){
  effects.reset();restoreEnvironment();initial=Math.round(Math.max(0,Math.min(20,Number($('#population').value)||0))*1e9);survivors=initial;
  exposure=+$('#exposure').value;shelter=+$('#shelter').value;title='Dünya dengede';description='Yeni dünya hazır. Deney sonuçları sıfırlandı.';$('#event-banner').hidden=true;history.length=0;if($('#sim-log'))$('#sim-log').innerHTML='';stats();render();select('earth');notify('Dünya ve nüfus sıfırlandı');
 }
 $('#shelter').oninput=e=>$('#shelter-value').textContent='%'+e.target.value;$('#new-world').onclick=reset;
 function enter(){open=true;document.body.classList.add('sim-mode');$('#lab').hidden=false;$('#outcome').hidden=false;$('#view-sim').classList.add('active');$('#view-explore').classList.remove('active');setPanel(true);select('earth');render();stats()}
 function leave(){open=false;document.body.classList.remove('sim-mode');$('#lab').hidden=true;$('#view-sim').classList.remove('active');$('#view-explore').classList.add('active');setPanel(innerWidth>760)}
 $('#view-sim').onclick=enter;$('#view-explore').onclick=leave;
 return {enter,leave,isOpen:()=>open,isSunGone:()=>sunAge!==null&&sunAge>=500,isBodyCaptured:id=>effects.isBodyCaptured(id),isBlackHoleActive:()=>effects.isBlackHoleActive,
  update(dt){
   effects.update(dt);tick+=dt;
   if(sunRunning){sunAge=Math.min(2592000,sunAge+dt*3600);if(sunAge>=2592000){sunRunning=false;render()}if(tick>.15){solar();tick=0}}
   if(environment){environment.age+=dt;const halo=earth.mesh.userData.atmosphere;if(halo)halo.material.uniforms.intensity.value=environment.kind==='gravity'?.35+Math.abs(environment.value-100)/700:.35}
  },get gravity(){return environment?.kind==='gravity'?environment.value:100}
 };
}

