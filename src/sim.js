import * as THREE from 'three';
import {gravityScenario,asteroidScenario,relativisticScenario,sunScenario} from './physics.js';
import './sim.css';

const $=(sel)=>document.querySelector(sel);
const trNum=(value,digits=1)=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:digits}).format(value);
const exponent=(n)=>Number(n).toExponential(2).replace('e+',' × 10^').replace('e-',' × 10^-');
function energyText(mt){return mt<.01?trNum(mt,5)+' Mt':mt<1e5?trNum(mt,2)+' Mt':exponent(mt)+' Mt'}
function secondsText(t){if(t<60)return trNum(t,0)+' saniye';if(t<3600)return trNum(t/60,1)+' dakika';if(t<86400)return trNum(t/3600,1)+' saat';return trNum(t/86400,1)+' gün'}
const sourceLinks={
  sun:[['NASA — Işık ve çekim gecikmesi','https://gracefo.jpl.nasa.gov/news/5/what-is-gravity/']],
  gravity:[['NASA — Yerçekimi nedir?','https://spaceplace.nasa.gov/what-is-gravity/en/']],
  asteroid:[['NASA — Asteroit etkileri','https://science.nasa.gov/solar-system/asteroids/facts/']],
  relativistic:[['CERN — Özel görelilik','https://cds.cern.ch/record/2928188']]
};
const cases=[
  {id:'sun',icon:'☀',title:'Güneş yok olursa'},
  {id:'gravity',icon:'◉',title:'Yerçekimi değişirse'},
  {id:'asteroid',icon:'☄',title:'Asteroit çarpması'},
  {id:'relativistic',icon:'⚡',title:'Işık hızına yakın'}
];
const times=[{t:0,text:'Şimdi'},{t:499,text:'8 dk 19 sn'},{t:500,text:'8 dk 20 sn'},{t:3600,text:'1 saat'},{t:86400,text:'1 gün'},{t:604800,text:'1 hafta'}];
const metric=(name,val)=>'<div class="outcome-metric"><label>'+name+'</label><strong>'+val+'</strong></div>';
function slider(name,id,min,max,step,value,suffix,low,high){
  return '<div class="sim-row"><div class="sim-row-head"><label for="'+id+'">'+name+'</label><output id="'+id+'-value">'+trNum(value,1)+suffix+'</output></div><input type="range" id="'+id+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'"><div class="sim-scale"><span>'+low+'</span><span>'+high+'</span></div></div>';
}
export function createSimulator({scene,camera,controls,objects,ambient,light,sunFill,flyTo,select,notify}){
  let open=false,caseId='sun',timer=0,sunActive=false,sunRunning=false,gravityPct=100,gravityApplied=false;
  let diameter=120,velocity=20,massKind='needle',beta=90,flight=null;
  let frameTime=0,impactFlash=0,flashNow=0;
  const originalLight={ambient:ambient.intensity,light:light.intensity,fill:sunFill.intensity};
  const sun=objects.get('sun'),earth=objects.get('earth');
  const tabs=$('#lab-tabs');
  const visual=$('#event-banner'),flasher=$('#impact-flash'),horizon=$('#sim-horizon');
  const asteroidGeo=new THREE.IcosahedronGeometry(1,2);
  const pos=asteroidGeo.attributes.position;
  let randSeed=6423;const rand=()=>{randSeed=(randSeed*1664525+1013904223)>>>0;return randSeed/4294967296};
  for(let i=0;i<pos.count;i++){const f=.82+rand()*.28;pos.setXYZ(i,pos.getX(i)*f,pos.getY(i)*f,pos.getZ(i)*f)}
  asteroidGeo.computeVertexNormals();
  const rock=new THREE.Mesh(asteroidGeo,new THREE.MeshStandardMaterial({color:0x7e8799,roughness:.85,metalness:.12,emissive:0x1c3046}));
  scene.add(rock);rock.visible=false;
  const trail=new THREE.Mesh(new THREE.ConeGeometry(.5,4,20,1,true),new THREE.MeshBasicMaterial({color:0x90b8ff,transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  trail.visible=false;scene.add(trail);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.68,.013,8,132),new THREE.MeshBasicMaterial({color:0xa8c9ff,transparent:true,opacity:.0,depthWrite:false}));
  halo.rotation.x=Math.PI/2;scene.add(halo);
  const impactRing=new THREE.Mesh(new THREE.TorusGeometry(1,.045,12,160),new THREE.MeshBasicMaterial({color:0xffc892,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
  scene.add(impactRing);
  const activeBody=()=>earth.mesh.getWorldPosition(new THREE.Vector3());
  function setVisual(){
    const activeSun=open&&caseId==='sun'&&sunActive;
    const arrived=activeSun&&timer>=500;
    sun.mesh.visible=!arrived;
    light.intensity=arrived?0:originalLight.light;
    sunFill.intensity=arrived?0:originalLight.fill;
    ambient.intensity=arrived?.045:originalLight.ambient;
    horizon.style.opacity=open&&caseId==='sun'&&sunActive&&!arrived?'0.64':'0';
    if(open&&caseId==='sun'&&sunActive){
      visual.hidden=false;
      visual.innerHTML=arrived?'<strong>GÜNEŞ SİNYALİ KESİLDİ</strong> · DÜNYA ARTIK DOĞRUDAN GÜNEŞ IŞIĞI ALMIYOR':'<strong>SON IŞIK YOLDA</strong> · ETKİ HENÜZ DÜNYA’YA ULAŞMADI';
    }else visual.hidden=true;
  }
  function resetEffects(){
    sunActive=false;sunRunning=false;timer=0;
    gravityPct=100;gravityApplied=false;flight=null;flashNow=0;impactFlash=0;
    rock.visible=false;trail.visible=false;halo.material.opacity=0;impactRing.material.opacity=0;flasher.style.opacity=0;
    earth.mesh.position.z=0;setVisual();
  }
  function showOutcome(){
    let title,lead,metrics,status,warning='Hayatta kalabilecek insan sayısı bu basit modelden güvenilir biçimde hesaplanamaz. Gerçek sonuçlar konuma, koşullara ve müdahalelere bağlıdır.';
    if(caseId==='sun'){
      const s=sunScenario(timer);title=s.stage;
      lead=!sunActive?'Başlangıç senaryosu: Güneş’in bir anda yok olduğu varsayımsal durum.':'Başlangıçtan itibaren geçen süre: '+secondsText(timer)+'.';
      metrics=metric('IŞIK / ÇEKİM GECİKMESİ','~8 dk 20 sn')+metric('DÜNYA’YA ETKİ',!sunActive?'Başlatılmadı':s.arrived?'Ulaştı':'Henüz yok')+metric('GÜNEŞ IŞIĞI',!sunActive||!s.arrived?'Görünür':'Kesildi')+metric('HAYATTA KALAN','Belirsiz');
      status=!sunActive?'Güneş’i yok et ve zaman çizelgesini ilerlet.':s.arrived?'Dünya eski Güneş yörüngesini terk eder; ardından uzun vadeli soğuma başlar.':'Işık ve çekim değişikliği henüz Dünya’ya ulaşmadı. Dünya şimdilik normal yörüngesinde.';
      warning='Bu olanaksız bir varsayımdır. 3D efektler temsilidir; gezegen yörüngeleri tam N-cisim hesabıyla çözülmez. Can kaybı sayısı verilmez.';
    }else if(caseId==='gravity'){
      const s=gravityScenario(gravityPct);title=s.level;
      lead='Yeryüzündeki çekim ivmesi %'+gravityPct+' değerine ayarlandı. Güneş’in çekimi bu senaryoda değiştirilmez.';
      metrics=metric('YERÇEKİMİ',trNum(s.acceleration,2)+' m/s²')+metric('1 KG’A ETKİ EDEN KUVVET',trNum(s.forcePerKg,2)+' N')+metric('10 M SERBEST DÜŞÜŞ',s.fallTenMeters===null?'Düşmez':trNum(s.fallTenMeters,2)+' sn')+metric('HAYATTA KALAN','Hesaplanamaz');
      status=gravityPct===100?'Dünya’nın bugünkü ortalama yerçekimine yakın.':gravityPct===0?'Basitleştirilmiş modelde 10 m yükseklikten bırakılan cisim aşağı doğru ivmelenmez.':gravityPct>100?'Daha yüksek ivme hareket ve yapıların üzerindeki yükleri artırabilir.':'Daha düşük ivme serbest düşüşü yavaşlatır.';
      warning='Yerçekimini değiştirmek gerçek Dünya’da pek çok fiziksel sistemi etkiler. Hesap yalnızca düşey ivmeyi ele alır; insan sağkalımını veya atmosfer değişimini modellemez.';
    }else if(caseId==='asteroid'){
      const s=asteroidScenario(diameter,velocity);title=s.risk;
      lead=trNum(diameter,0)+' m çapında, '+velocity+' km/sn hızla ilerleyen varsayımsal kayaç asteroit.';
      metrics=metric('ÇARPIŞMA ENERJİSİ',energyText(s.megatons))+metric('TAHMİNİ KÜTLE',exponent(s.mass)+' kg')+metric('GİRİŞ HIZI',velocity+' km/sn')+metric('HAYATTA KALAN','Hesaplanamaz');
      status=diameter<25?'Bu boyuttaki kayaçlar çoğunlukla atmosferde parçalanabilir.':diameter<1000?'Etki; atmosfere giriş açısı, zemin, okyanus ve konuma göre çok farklı olabilir.':'Bu büyüklükteki bir gök cismi küresel sonuçlar doğurabilir.';
      warning='Enerji = ½mv² (küresel, 3000 kg/m³ yoğunluklu kayaç). Krater, tsunami, hava patlaması veya nüfus kaybı hesaplanmıyor. Sahne ölçekli değildir.';
    }else{
      const mass=massKind==='needle'?.001:1e12,s=relativisticScenario(mass,beta);
      title='GÖRELİ HIZ SENARYOSU';
      lead=(massKind==='needle'?'1 gramlık hayali iğne':'10¹² kg kütleli hayali dağ')+' · ışık hızının %'+beta+' kadarı.';
      metrics=metric('HIZ',trNum(s.velocity/1000,0)+' km/sn')+metric('LORENTZ FAKTÖRÜ',trNum(s.gamma,3)+' γ')+metric('GÖRELİ KİNETİK ENERJİ',energyText(s.megatons))+metric('HAYATTA KALAN','Hesaplanamaz');
      status='E = (γ−1)mc². Cisim ışık hızına yaklaştıkça gerekli enerji hızla büyür.';
      warning='Kütleli bir cisim ışık hızının tam %100’üne ulaşamaz. Bu senaryo hayali bir deneydir; atmosfer, madde etkileşimleri, çarpışma sonucu ve ölüm sayısı modellenmez.';
    }
    const src=sourceLinks[caseId];
    $('#outcome').innerHTML='<div class="outcome-top"><span>◈ ANALİZ PANELİ / 02</span><span class="outcome-indicator">● AKTİF</span></div>'+
      '<h2>'+title+'</h2><p class="outcome-lead">'+lead+'</p><div class="outcome-grid">'+metrics+'</div><div class="outcome-status">'+status+'</div>'+
      '<div class="outcome-warning"><b>MODELİN SINIRLARI</b>'+warning+'</div><div class="outcome-source">KAYNAK'+src.map(x=>'<a href="'+x[1]+'" target="_blank" rel="noopener noreferrer">'+x[0]+' ↗</a>').join('')+'</div>';
  }
  function renderControls(){
    const panel=$('#lab-controls');
    let html='<div class="lab-section-label">DENEY PARAMETRELERİ / '+caseId.toUpperCase()+'</div>';
    if(caseId==='sun'){
      html+='<div class="sim-row"><div class="sim-row-head"><label>Gözlem zamanı</label><output id="sun-value">'+secondsText(timer)+'</output></div><input id="sun-time" type="range" min="0" max="604800" step="1" value="'+timer+'"><div class="sim-scale"><span>0 saniye</span><span>7 gün</span></div><div class="sim-presets">'+times.map(t=>'<button class="sim-preset '+(t.t===timer?'active':'')+'" data-time="'+t.t+'">'+t.text+'</button>').join('')+'</div></div>';
      html+='<button class="sim-main-btn" id="run-case">'+(sunRunning?'DURAKLAT':sunActive?'ZAMANI İLERLET':'GÜNEŞ’İ YOK ET')+' <span>↗</span></button>';
      html+='<p class="sim-tip">Oynatmada 1 gerçek saniye = 5 simülasyon dakikası. Zaman seçerek sonuçları anında inceleyebilirsin.</p>';
    }else if(caseId==='gravity'){
      html+=slider('Yerçekimi oranı','gravity-range',0,700,10,gravityPct,'%', '0%', '700%');
      html+='<button class="sim-main-btn" id="run-case">ETKİYİ GÖSTER <span>↗</span></button>';
      html+='<p class="sim-tip">Bu kaydırıcı Dünya yüzeyindeki çekim ivmesini değiştirir; uzaydaki yörüngeleri fiziksel olarak değiştirmez.</p>';
    }else if(caseId==='asteroid'){
      html+=slider('Asteroit çapı','diameter-range',20,1500,10,diameter,' m','20 m','1.500 m');
      html+=slider('Geliş hızı','velocity-range',11,70,1,velocity,' km/sn','11 km/sn','70 km/sn');
      html+='<button class="sim-main-btn" id="run-case">ASTEROİDİ GÖNDER <span>↗</span></button>';
      html+='<p class="sim-tip">Çarpışma görseli temsilidir; enerji hesabı çap ve hızla birlikte güncellenir.</p>';
    }else{
      html+='<div class="sim-row"><div class="sim-row-head"><label>Cisim türü</label><output>'+ (massKind==='needle'?'1 gram':'10¹² kg')+'</output></div><div class="sim-presets"><button class="sim-preset '+(massKind==='needle'?'active':'')+'" data-mass="needle">İğne · 1 g</button><button class="sim-preset '+(massKind==='mountain'?'active':'')+'" data-mass="mountain">Dağ · 10¹² kg</button></div></div>';
      html+=slider('Işık hızının yüzdesi','rel-speed',10,99,1,beta,'% c','%10 c','%99 c');
      html+='<button class="sim-main-btn" id="run-case">DENEYİ GÖRSELLEŞTİR <span>↗</span></button>';
      html+='<p class="sim-tip">%100 c seçeneklerde yok; sıfırdan farklı kütleler bu hıza erişemez. Görsel çarpışma tam fizik çözümü değildir.</p>';
    }
    html+='<button class="sim-reset" id="reset-case">↺ DENEYİ SIFIRLA</button>';
    panel.innerHTML=html;
    panel.querySelector('#run-case').onclick=run;
    panel.querySelector('#reset-case').onclick=()=>{resetEffects();renderControls();showOutcome();notify('DENEY SIFIRLANDI')};
    if(caseId==='sun'){
      panel.querySelector('#sun-time').oninput=e=>{timer=Number(e.target.value);sunActive=true;$('#sun-value').textContent=secondsText(timer);sunRunning=false;setVisual();showOutcome()};
      panel.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{timer=Number(b.dataset.time);sunActive=true;sunRunning=false;setVisual();renderControls();showOutcome()});
    }
    if(caseId==='gravity')panel.querySelector('#gravity-range').oninput=e=>{gravityPct=Number(e.target.value);gravityApplied=true;$('#gravity-range-value').textContent=gravityPct+'%';showOutcome()};
    if(caseId==='asteroid'){
      panel.querySelector('#diameter-range').oninput=e=>{diameter=+e.target.value;$('#diameter-range-value').textContent=trNum(diameter,0)+' m';showOutcome()};
      panel.querySelector('#velocity-range').oninput=e=>{velocity=+e.target.value;$('#velocity-range-value').textContent=velocity+' km/sn';showOutcome()};
    }
    if(caseId==='relativistic'){
      panel.querySelector('#rel-speed').oninput=e=>{beta=+e.target.value;$('#rel-speed-value').textContent=beta+'% c';showOutcome()};
      panel.querySelectorAll('[data-mass]').forEach(b=>b.onclick=()=>{massKind=b.dataset.mass;renderControls();showOutcome()});
    }
  }
  function run(){
    if(caseId==='sun'){
      if(!sunActive){timer=0;sunActive=true;sunRunning=true}
      else sunRunning=!sunRunning;
      setVisual();renderControls();showOutcome();return;
    }
    if(caseId==='gravity'){
      gravityApplied=true;notify('YERÇEKİMİ %'+gravityPct+' · TEMSİLİ GÖRSEL ETKİ');return;
    }
    const start=activeBody().add(new THREE.Vector3(-10,3,5));
    const end=activeBody().add(new THREE.Vector3(-1.0,.10,.36));
    flight={kind:caseId,time:0,duration:caseId==='asteroid'?3.6:2.4,start,end,hit:false};
    rock.visible=true;trail.visible=true;
    rock.scale.setScalar(caseId==='relativistic'?massKind==='needle'?.09:.82:Math.max(.14,Math.min(.85,diameter/900)));
    rock.material.color.setHex(caseId==='relativistic'?0xb1dfff:0x848080);
    trail.material.color.setHex(caseId==='relativistic'?0x7faaff:0xf6aa77);
    notify(caseId==='asteroid'?'ASTEROİT YAKLAŞIYOR':'GÖRELİ HIZ GÖRSELİ BAŞLATILDI');
  }
  function choose(next){
    if(next===caseId)return;
    resetEffects();caseId=next;
    tabs.querySelectorAll('button').forEach(el=>el.classList.toggle('active',el.dataset.case===caseId));
    renderControls();showOutcome();
  }
  cases.forEach(c=>{
    const b=document.createElement('button');b.type='button';b.className='lab-tab';b.dataset.case=c.id;
    b.innerHTML='<span>'+c.icon+'</span>'+c.title;
    b.onclick=()=>choose(c.id);
    tabs.appendChild(b);
  });
  function enter(){
    if(open)return;
    open=true;document.body.classList.add('sim-mode');
    $('#lab').hidden=false;$('#outcome').hidden=false;
    $('#view-sim').classList.add('active');$('#view-explore').classList.remove('active');
    select('earth',false);
    const p=activeBody();
    flyTo(p.clone().add(new THREE.Vector3(-4,2.3,8.8)),p,1.8);
    choose(caseId);resetEffects();renderControls();showOutcome();
    tabs.querySelectorAll('button').forEach(el=>el.classList.toggle('active',el.dataset.case===caseId));
    notify('OLASILIK LABORATUVARI AÇILDI');
  }
  function leave(){
    if(!open)return;
    resetEffects();open=false;document.body.classList.remove('sim-mode');
    $('#lab').hidden=true;$('#outcome').hidden=true;
    $('#view-sim').classList.remove('active');$('#view-explore').classList.add('active');
    select('earth',true);notify('KEŞİF MODUNA DÖNÜLDÜ');
  }
  $('#view-sim').onclick=enter;
  $('#view-explore').onclick=leave;
  const banner=()=>{
    const p=activeBody();
    if(rock.visible)rock.position.copy(p).add(new THREE.Vector3(-4,1,5));
  };
  banner();
  function update(dt){
    frameTime+=dt;
    if(!open)return;
    const p=activeBody();
    if(caseId==='sun'&&sunActive&&sunRunning){
      timer=Math.min(604800,timer+dt*300);
      if(timer>=604800)sunRunning=false;
      const slider=$('#sun-time');
      if(slider){slider.value=Math.round(timer);$('#sun-value').textContent=secondsText(timer)}
      setVisual();
      if(frameTime%1<dt)showOutcome();
    }
    const beforeDrift=activeBody();
    if(caseId==='sun'&&sunActive&&timer>=500){
      // Exaggerated tangential motion: educational illustration, NOT orbital mechanics.
      const drift=Math.min(18,(timer-500)/604800*18);
      earth.mesh.position.z=-drift;
    } else earth.mesh.position.z=0;
    const earthPos=activeBody();
    const driftShift=earthPos.clone().sub(beforeDrift);
    if(controls.enabled && driftShift.lengthSq()>0){camera.position.add(driftShift);controls.target.add(driftShift)}
    halo.position.copy(earthPos);halo.rotation.z+=dt*.45;
    halo.material.opacity=caseId==='gravity'&&gravityApplied?Math.min(.58,Math.abs(gravityPct-100)/700*.85):0;
    halo.scale.setScalar(1+(gravityPct<100?(100-gravityPct)/230:-(gravityPct-100)/1400));
    impactRing.position.copy(earthPos);
    if(flight){
      flight.time+=dt;
      const ratio=Math.min(1,flight.time/flight.duration);
      const pulse=Math.min(1,ratio*1.7);
      const origin=earthPos.clone().add(new THREE.Vector3(-10,3,5));
      const end=earthPos.clone().add(new THREE.Vector3(-1,.1,.36));
      rock.position.lerpVectors(origin,end,ratio*ratio*(3-2*ratio));
      rock.rotation.x+=dt*1.8;rock.rotation.y+=dt*2.4;
      trail.position.copy(rock.position).add(new THREE.Vector3(-1,.3,.5));
      trail.rotation.z=Math.PI*.5;trail.scale.setScalar(flight.kind==='relativistic'?.7:1);
      trail.material.opacity=Math.min(.68,.12+pulse*.42);
      if(ratio===1&&!flight.hit){
        flight.hit=true;impactFlash=1;flashNow=0;
        rock.visible=false;trail.visible=false;
        notify(flight.kind==='asteroid'?'TEMSİLİ ÇARPIŞMA GÖRSELİ':'GÖRELİ ENERJİ GÖRSELİ');
      }
      if(flight.hit){
        flashNow+=dt;impactFlash=Math.max(0,1-flashNow/1.3);
        impactRing.scale.setScalar(1+flashNow*3.1);
        impactRing.material.opacity=Math.max(0,.7-flashNow*.55);
        flasher.style.opacity=String(Math.max(0,impactFlash*.55));
        if(flashNow>1.45){flight=null;impactRing.material.opacity=0;flasher.style.opacity='0'}
      }
    }
  }
  return {enter,leave,isOpen:()=>open,isSunGone:()=>open&&caseId==='sun'&&sunActive&&timer>=500,update};
}
