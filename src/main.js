import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { bodies } from './data.js';
import { createSimulator } from './sim.js';

const $=selector=>document.querySelector(selector);
const canvas=$('#space');
let renderer;
try {
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
} catch(error) {
  $('#error').classList.add('show'); $('#loading').classList.add('done'); throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.65));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.28;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x02040a);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3200);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=2;controls.maxDistance=1000;
controls.maxPolarAngle=Math.PI*.96;
const ambient=new THREE.AmbientLight(0x92b1dd,.22);scene.add(ambient);
const light=new THREE.PointLight(0xffdeb0,2700,320,1.2);scene.add(light);
const sunFill=new THREE.PointLight(0xffa34b,100,90);scene.add(sunFill);

// Post-processing Bloom pipeline (with graceful fallback)
let composer=null,bloomPass=null,bloomBase=.68,bloomBoost=0;
try {
  composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),bloomBase,.58,.64);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
} catch {
  composer=null;bloomPass=null;
}
function pulseBloom(boost=1.4){bloomBoost=Math.max(bloomBoost,boost)}

// Layer 0: Multi-layer animated deep-space Nebula Sky Dome
const nebulaMat=new THREE.ShaderMaterial({
  uniforms:{uTime:{value:0}},
  vertexShader:`
    varying vec3 vDir;
    void main(){
      vDir=normalize(position);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    }
  `,
  fragmentShader:`
    uniform float uTime;
    varying vec3 vDir;
    float hash3(vec3 p){
      p=fract(p*0.3183099+vec3(0.1,0.2,0.3));
      p*=17.0;
      return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
    }
    float vnoise(vec3 x){
      vec3 i=floor(x),f=fract(x);
      f=f*f*(3.0-2.0*f);
      return mix(
        mix(mix(hash3(i+vec3(0,0,0)),hash3(i+vec3(1,0,0)),f.x),
            mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
            mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    float fbm3(vec3 p){
      float v=0.0,a=0.5;
      for(int i=0;i<4;i++){
        v+=a*vnoise(p);
        p=p*2.03+vec3(0.17,-0.11,0.23);
        a*=0.5;
      }
      return v;
    }
    void main(){
      vec3 d=normalize(vDir);
      float drift=uTime*0.015;
      // Galactic band tilted across the sky
      float band=exp(-pow(abs(d.y*0.82+d.x*0.36-d.z*0.25)*3.4,1.6));
      float n1=fbm3(d*2.4+vec3(drift,-drift*0.6,drift*0.4));
      float n2=fbm3(d*5.2-vec3(drift*0.8,drift*0.5,-drift*0.7)+n1*1.4);
      vec3 deepVoid=vec3(0.010,0.016,0.036);
      vec3 indigoCloud=vec3(0.06,0.10,0.24)*smoothstep(0.32,0.82,n1);
      vec3 violetDust=vec3(0.18,0.07,0.26)*smoothstep(0.45,0.88,n2)*(0.45+band*0.9);
      vec3 tealNebula=vec3(0.04,0.19,0.25)*smoothstep(0.48,0.92,n1*n2*1.9)*band;
      vec3 milkyGlow=vec3(0.14,0.12,0.20)*band*smoothstep(0.28,0.78,n2);
      vec3 col=deepVoid+indigoCloud+violetDust+tealNebula+milkyGlow;
      gl_FragColor=vec4(col,1.0);
    }
  `,
  side:THREE.BackSide,
  depthWrite:false
});
const nebulaDome=new THREE.Mesh(new THREE.SphereGeometry(1550,36,24),nebulaMat);
scene.add(nebulaDome);

// Layer 1 & 2: Twinkling multi-temperature starfield shader
let seed=14389;
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function makeStarLayer(count,rMin,rMax,sizeMin,sizeMax,brightBoost){
  const pos=new Float32Array(count*3),col=new Float32Array(count*3),sz=new Float32Array(count),ph=new Float32Array(count);
  const palette=[new THREE.Color(0xcde2ff),new THREE.Color(0xfff4e0),new THREE.Color(0x9fc5ff),new THREE.Color(0xffd2a1),new THREE.Color(0xd9c2ff)];
  for(let i=0;i<count;i++){
    const r=rMin+rand()*(rMax-rMin),theta=rand()*Math.PI*2,phi=Math.acos(2*rand()-1);
    pos[i*3]=r*Math.sin(phi)*Math.cos(theta);
    pos[i*3+1]=r*Math.cos(phi);
    pos[i*3+2]=r*Math.sin(phi)*Math.sin(theta);
    const c=palette[Math.floor(rand()*palette.length)];
    const b=brightBoost*(0.55+rand()*0.85);
    col[i*3]=c.r*b;col[i*3+1]=c.g*b;col[i*3+2]=c.b*b;
    sz[i]=sizeMin+Math.pow(rand(),2.2)*(sizeMax-sizeMin);
    ph[i]=rand()*Math.PI*2;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  geo.setAttribute('aSize',new THREE.BufferAttribute(sz,1));
  geo.setAttribute('aPhase',new THREE.BufferAttribute(ph,1));
  const mat=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uOpacity:{value:.92},uPr:{value:Math.min(devicePixelRatio,1.65)}},
    vertexShader:`
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uTime;
      uniform float uPr;
      void main(){
        vColor=color;
        vTwinkle=0.72+0.28*sin(uTime*(1.4+fract(aPhase)*2.2)+aPhase);
        vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize=aSize*uPr*(280.0/max(-mv.z,60.0));
        gl_PointSize=clamp(gl_PointSize,1.2,10.0);
        gl_Position=projectionMatrix*mv;
      }
    `,
    fragmentShader:`
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uOpacity;
      void main(){
        vec2 uv=gl_PointCoord-0.5;
        float d=length(uv)*2.0;
        if(d>1.0)discard;
        float core=exp(-d*d*5.5);
        float halo=exp(-d*2.4)*0.45;
        float alpha=(core+halo)*vTwinkle*uOpacity;
        gl_FragColor=vec4(vColor*(1.0+core*0.85),alpha);
      }
    `,
    transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending
  });
  const pts=new THREE.Points(geo,mat);
  scene.add(pts);
  return {pts,mat};
}
const farStars=makeStarLayer(6400,260,1200,1.4,4.2,1.05);
const brightStars=makeStarLayer(1400,190,820,2.8,7.4,1.55);
// Layer 3: Near-field drifting cosmic dust for 3D parallax depth
const nearDust=makeStarLayer(700,20,160,1.2,3.1,0.52);
const starMaterial=farStars.mat;

function texture(body){
  const c=document.createElement('canvas');c.width=768;c.height=384;
  const ctx=c.getContext('2d'),color=new THREE.Color(body.color);
  ctx.fillStyle='#'+color.getHexString();ctx.fillRect(0,0,c.width,c.height);
  let s=body.id.length*139+77;
  const rng=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
  for(let i=0;i<180;i++){
    const y=rng()*384,h=.5+rng()*19;
    ctx.fillStyle=rng()>.5?'rgba(255,232,205,.075)':'rgba(17,20,37,.085)';
    ctx.fillRect(0,y,768,h);
  }
  for(let i=0;i<330;i++){
    ctx.beginPath();ctx.ellipse(rng()*768,rng()*384,1+rng()*22,1+rng()*8,rng()*.2,0,Math.PI*2);
    ctx.fillStyle=rng()>.5?'rgba(255,246,227,.07)':'rgba(18,19,23,.10)';ctx.fill();
  }
  if(body.id==='earth'){
    ctx.fillStyle='#174c82';ctx.fillRect(0,0,768,384);
    const continents=[[[.06,.19],[.15,.12],[.24,.17],[.28,.29],[.22,.36],[.20,.47],[.15,.4],[.11,.32]],[[.23,.46],[.31,.49],[.34,.58],[.31,.72],[.27,.88],[.24,.72]],[[.44,.24],[.51,.18],[.56,.23],[.54,.33],[.47,.35]],[[.46,.36],[.55,.33],[.61,.44],[.56,.63],[.52,.76],[.47,.59],[.44,.44]],[[.56,.2],[.7,.13],[.87,.22],[.88,.32],[.79,.39],[.72,.5],[.66,.41],[.61,.47],[.57,.34]],[[.79,.66],[.87,.61],[.92,.68],[.88,.78],[.80,.76]],[[.31,.08],[.38,.1],[.37,.24],[.32,.23]]];
    for(const path of continents){ctx.beginPath();path.forEach(([x,y],i)=>i?ctx.lineTo(x*768,y*384):ctx.moveTo(x*768,y*384));ctx.closePath();ctx.fillStyle='#52785c';ctx.fill();}
    ctx.fillStyle='#c4cabd';ctx.fillRect(0,365,768,19);
    for(let i=0;i<110;i++){ctx.beginPath();ctx.ellipse(rng()*768,rng()*384,4+rng()*40,1+rng()*5,-.2,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.18)';ctx.fill()}
  }
  if(body.id==='mars'){for(let i=0;i<55;i++){ctx.fillStyle='rgba(77,38,26,.18)';ctx.beginPath();ctx.arc(rng()*768,rng()*384,2+rng()*22,0,Math.PI*2);ctx.fill()}}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
}
function glowTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d'),grad=g.createRadialGradient(64,64,1,64,64,64);
  grad.addColorStop(0,'rgba(255,244,210,1)');grad.addColorStop(.16,'rgba(255,180,90,.85)');grad.addColorStop(.48,'rgba(255,133,55,.3)');grad.addColorStop(1,'rgba(255,100,20,0)');
  g.fillStyle=grad;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}
const sphere=new THREE.SphereGeometry(1,64,48),objects=new Map(),pickables=[];
for(const body of bodies){
  const pivot=new THREE.Group();scene.add(pivot);
  const material=body.id==='sun'?new THREE.MeshBasicMaterial({color:0xffd18a}):new THREE.MeshStandardMaterial({map:texture(body),roughness:1,metalness:0});
  const mesh=new THREE.Mesh(sphere,material);
  mesh.scale.setScalar(body.size);mesh.position.x=body.distance;mesh.userData.id=body.id;pivot.add(mesh);
  pickables.push(mesh);objects.set(body.id,{body,pivot,mesh});
  if(body.distance>0){
    const points=[];
    for(let i=0;i<=256;i++){const a=i*Math.PI*2/256;points.push(new THREE.Vector3(Math.cos(a)*body.distance,0,Math.sin(a)*body.distance))}
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x536982,transparent:true,opacity:.19,depthWrite:false})));
  }
  if(body.id==='saturn'){
    const palette=[0xc9b58c,0xefe0c1,0x9c8668,0xd7c5a5,0x988268];
    for(let i=0;i<5;i++){
      const inner=1.28+i*.18,outer=inner+.18;
      const ring=new THREE.Mesh(new THREE.RingGeometry(inner,outer,128),new THREE.MeshStandardMaterial({color:palette[i],side:THREE.DoubleSide,transparent:true,opacity:.52+(i%2)*.16,depthWrite:false,roughness:1}));
      ring.rotation.x=-Math.PI/2;mesh.add(ring);
    }
    mesh.rotation.z=.34;
  }
  if(body.id==='uranus')mesh.rotation.z=1.65;
  if(body.id==='sun'){
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:0xffb66e,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
    glow.scale.set(25,25,1);mesh.add(glow);
  }
}
const earthEntry=objects.get('earth');
const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(1.045,48,32),new THREE.ShaderMaterial({
 uniforms:{intensity:{value:.35}},vertexShader:`varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
 fragmentShader:`varying vec3 n;varying vec3 v;uniform float intensity;void main(){float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),3.0);gl_FragColor=vec4(0.22,0.55,1.0,rim*intensity);}`,
 transparent:true,depthWrite:false,side:THREE.FrontSide,blending:THREE.AdditiveBlending}));earthEntry.mesh.add(atmosphere);earthEntry.mesh.userData.atmosphere=atmosphere;
const moon=new THREE.Mesh(new THREE.SphereGeometry(.27,24,16),new THREE.MeshStandardMaterial({map:texture({id:'moon',color:0xaaa69b}),roughness:1}));scene.add(moon);
let moonAngle=0;
let selected='earth',quality='HIGH',paused=false,speed=1,mode='orbit',transition=null;
const target=new THREE.Vector3(),temp=new THREE.Vector3(),prev=new THREE.Vector3();
const saturn=objects.get('saturn').mesh.getWorldPosition(new THREE.Vector3());
controls.target.copy(saturn);camera.position.copy(saturn).add(new THREE.Vector3(14,8,22));camera.lookAt(saturn);controls.update();
const nav=$('#planet-list');
bodies.forEach((body,i)=>{
  const button=document.createElement('button');button.type='button';button.className='planet-item';button.dataset.id=body.id;
  button.innerHTML='<span class="planet-number">'+String(i+1).padStart(2,'0')+'</span><span class="planet-icon" style="color:#'+body.color.toString(16).padStart(6,'0')+'">'+body.icon+'</span><span>'+body.name+'</span><span class="planet-arrow">↗</span>';
  button.onclick=()=>{select(body.id);(innerWidth<=760&&setPanel(false))};nav.append(button);
});
const reduceMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
function smooth(t){return t*t*(3-2*t)}
function flyTo(pos,tgt,duration=1.8){
  mode='orbit';controls.enabled=true;$('#mode-label').textContent='YÖRÜNGE';$('#flight-speed-label').hidden=true;$('#touch-flight').hidden=true;
  transition={start:camera.position.clone(),target:controls.target.clone(),end:pos.clone(),look:tgt.clone(),time:0,duration:reduceMotion?.01:duration};
}
function select(id,animate=true){
  if(!objects.has(id))return;
  selected=id;const entry=objects.get(id),b=entry.body;
  document.querySelectorAll('.planet-item').forEach(el=>el.classList.toggle('active',el.dataset.id===id));
  $('#title').textContent=$('#detail-title').textContent=b.name;
  $('#subtitle').textContent=b.subtitle;$('#category').textContent=b.category;
  $('#description').textContent=b.description;$('#index').textContent=String(bodies.indexOf(b)+1).padStart(2,'0')+' — 09';
  for(const key of ['diameter','temp','moons','period'])$('#'+key).textContent=b[key];
  if(animate){
    const destination=entry.mesh.getWorldPosition(new THREE.Vector3());
    const dist=b.id==='sun'?28:Math.max(5.5,b.size*7);
    const offset=new THREE.Vector3(dist*.52,dist*.24,dist*.83);
    flyTo(destination.clone().add(offset),destination);
  }
}
$('#explore').onclick=()=>select(selected);
$('#reset').onclick=()=>{selected='sun';flyTo(new THREE.Vector3(97,68,120),new THREE.Vector3(0,0,0),1.5);if(innerWidth<=760)setPanel(false)};
$('#pause').onclick=()=>{paused=!paused;$('#pause').textContent=paused?'▶ DEVAM':'Ⅱ DURAKLAT'};
$('#speed').oninput=e=>{speed=+e.target.value;$('#speed-label').textContent=speed.toFixed(1)+'×'};
function renderScene(){
  if(composer)composer.render();
  else renderer.render(scene,camera);
}
$('#quality').onclick=()=>{
  quality=quality==='HIGH'?'LOW':'HIGH';
  const pr=Math.min(devicePixelRatio,quality==='HIGH'?1.65:1);
  renderer.setPixelRatio(pr);
  if(composer)composer.setPixelRatio(pr);
  farStars.mat.uniforms.uOpacity.value=quality==='HIGH'?.92:.5;
  farStars.mat.uniforms.uPr.value=pr;
  brightStars.mat.uniforms.uOpacity.value=quality==='HIGH'?.95:.55;
  brightStars.mat.uniforms.uPr.value=pr;
  nearDust.mat.uniforms.uOpacity.value=quality==='HIGH'?.7:.25;
  bloomBase=quality==='HIGH'?.68:.32;
  $('#quality').textContent='GRAFİK: '+(quality==='HIGH'?'YÜKSEK':'DÜŞÜK');
};
function setPanel(open){document.body.classList.toggle('panel-hidden',!open);$('#menu').setAttribute('aria-expanded',String(open))}
$('#menu').onclick=()=>setPanel(document.body.classList.contains('panel-hidden'));
setPanel(innerWidth>760);
$('#home').onclick=()=>select('earth');
if($('#snap'))$('#snap').onclick=()=>{
  renderScene();
  const a=document.createElement('a');
  a.href=canvas.toDataURL('image/png');
  a.download=`void-kozmos-${Date.now()}.png`;
  a.click();
  notify('SAHNE FOTOĞRAFI İNDİRİLDİ');
};
const keys=new Set();let looking=false,yaw=0,pitch=0;
const notify=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.remove('show'),2400)};
$('#mode').onclick=()=>{
  transition=null;
  if(mode==='orbit'){
    mode='cockpit';controls.enabled=false;
    const euler=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');yaw=euler.y;pitch=euler.x;
    $('#mode-label').textContent='SERBEST UÇUŞ';$('#flight-speed-label').hidden=false;$('#touch-flight').hidden=false;$('#control-hint').textContent='WASD · uç / Q E · yüksel-alçal / Shift · hızlan / F · odaklan';setPanel(false);notify('WASD ile uç · sürükleyerek bak · Shift ile hızlan');
  }else{
    mode='orbit';controls.enabled=true;
    camera.getWorldDirection(temp);controls.target.copy(camera.position).addScaledVector(temp,20);
    $('#mode-label').textContent='YÖRÜNGE';$('#flight-speed-label').hidden=true;$('#touch-flight').hidden=true;$('#control-hint').textContent='Sürükle · döndür / Tekerlek · yaklaş';notify('Yörünge kamerası');
  }
};
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let down=null;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);down={x:e.clientX,y:e.clientY};looking=true});
canvas.addEventListener('pointerup',e=>{
  looking=false;if(!down)return;
  const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;
  if(mode!=='orbit'||moved>5)return;
  mouse.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(pickables);
  if(hits.length)select(hits[0].object.userData.id);
});
canvas.addEventListener('pointercancel',()=>{down=null;looking=false});
canvas.addEventListener('pointermove',e=>{
  if(mode!=='cockpit'||!looking||!down)return;
  yaw-=e.movementX*.003;pitch=Math.max(-1.5,Math.min(1.5,pitch-e.movementY*.003));
  camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0,'YXZ');
});
controls.addEventListener('start',()=>{transition=null});
addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.code==='Space'&&document.activeElement.tagName==='BUTTON')return;if(e.code==='KeyF'){select(selected);return}if(e.code==='Escape'){setPanel(false);return}keys.add(e.code);if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault()});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key)};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>keys.delete(b.dataset.key)});
let audioContext=null,audioNodes=[];
function stopAudio(){for(const osc of audioNodes)try{osc.stop()}catch{}audioNodes=[];if(audioContext){audioContext.close();audioContext=null}}
$('#audio').onclick=async()=>{
  if(audioContext){stopAudio();$('#audio').textContent='♫ KAPALI';return}
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;audioContext=new Ctx();
    const master=audioContext.createGain();master.gain.value=.035;master.connect(audioContext.destination);
    [55,82.41,110,164.81].forEach((hz,i)=>{
      const osc=audioContext.createOscillator(),gain=audioContext.createGain();
      osc.type=i%2?'sine':'triangle';osc.frequency.value=hz;gain.gain.value=i===0?.33:.1;
      osc.connect(gain).connect(master);osc.start();audioNodes.push(osc);
    });
    await audioContext.resume();$('#audio').textContent='♫ AÇIK';notify('ORTAM SESİ AÇILDI');
  }catch(e){stopAudio();notify('SES BAŞLATILAMADI')}
};
let shakeAmp=0,shakeTime=0,shakeDur=0;
const shakeOffset=new THREE.Vector3(),savedCamPos=new THREE.Vector3();
function addShake(intensity=.35,duration=.8){
  if(reduceMotion)return;
  shakeAmp=Math.max(shakeAmp,intensity);
  shakeDur=Math.max(shakeDur,duration);
  shakeTime=Math.max(shakeTime,duration);
}

let last=performance.now(),counter=0,elapsed=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;

  // Animate multi-layer deep space background (nebula clouds + twinkling stars + parallax dust)
  nebulaMat.uniforms.uTime.value=elapsed;
  farStars.mat.uniforms.uTime.value=elapsed;
  brightStars.mat.uniforms.uTime.value=elapsed;
  nearDust.mat.uniforms.uTime.value=elapsed;
  if(!reduceMotion){
    nebulaDome.rotation.y+=dt*0.004;
    nearDust.pts.rotation.y-=dt*0.008;
    nearDust.pts.rotation.x+=dt*0.003;
  }

  // Smoothly decay transient bloom surge back to baseline
  if(bloomPass){
    bloomBoost=Math.max(0,bloomBoost-dt*1.35);
    bloomPass.strength=bloomBase+bloomBoost;
  }

  const bhOn=simulator.isBlackHoleActive();
  if(!paused){
    prev.copy(objects.get(selected).mesh.getWorldPosition(new THREE.Vector3()));
    for(const e of objects.values()){
      if(simulator.isBodyCaptured(e.body.id))continue;
      e.mesh.rotation.y+=e.body.spin*dt*60*speed;
      if(e.body.orbit && !(e.body.id==='earth'&&simulator.isSunGone()))e.pivot.rotation.y+=e.body.orbit*dt*speed*.30;
    }
    const next=objects.get(selected).mesh.getWorldPosition(new THREE.Vector3());
    if(mode==='orbit'&&!transition&&selected!=='sun'&&!bhOn){
      const shift=next.sub(prev);controls.target.add(shift);camera.position.add(shift);
    }
  }
  if(transition){
    transition.time+=dt;
    const t=smooth(Math.min(1,transition.time/transition.duration));
    camera.position.lerpVectors(transition.start,transition.end,t);
    controls.target.lerpVectors(transition.target,transition.look,t);
    if(t>=1)transition=null;
  }
  if(mode==='orbit'){controls.update()}
  else{
    const travel=Number($('#flight-speed').value)*(keys.has('ShiftLeft')||keys.has('ShiftRight')?4:1)*dt;
    const direction=new THREE.Vector3();
    if(keys.has('KeyW'))direction.z-=1;if(keys.has('KeyS'))direction.z+=1;
    if(keys.has('KeyA'))direction.x-=1;if(keys.has('KeyD'))direction.x+=1;
    if(keys.has('KeyQ'))direction.y-=1;if(keys.has('KeyE'))direction.y+=1;
    if(direction.lengthSq()){direction.normalize().applyQuaternion(camera.quaternion).multiplyScalar(travel);camera.position.add(direction)}
  }
  if(++counter%15===0)$('#coordinates').textContent='KAMERA / '+[camera.position.x,camera.position.y,camera.position.z].map(v=>v.toFixed(1)).join(' · ');
  simulator.update(paused?0:dt);

  if(!simulator.isBodyCaptured('moon')){
    if(!paused)moonAngle+=dt*.12*Math.sqrt(simulator.gravity/100);
    const earthWorld=earthEntry.mesh.getWorldPosition(temp);
    moon.position.copy(earthWorld).add(new THREE.Vector3(Math.cos(moonAngle)*3,.4,Math.sin(moonAngle)*3));
    moon.visible=earthEntry.mesh.visible;
    if(simulator.gravity===0)moon.position.y+=Math.min(8,now/1000%30)*.2;
  }

  // Non-destructive damped camera shake
  if(shakeTime>0){
    shakeTime=Math.max(0,shakeTime-dt);
    const decay=shakeDur>0?(shakeTime/shakeDur):0;
    const mag=shakeAmp*decay*decay;
    shakeOffset.set(
      (Math.sin(elapsed*43.1)+Math.cos(elapsed*67.3))*0.5*mag,
      (Math.cos(elapsed*51.7)+Math.sin(elapsed*79.1))*0.5*mag,
      (Math.sin(elapsed*37.9)-Math.cos(elapsed*61.3))*0.35*mag
    );
    savedCamPos.copy(camera.position);
    camera.position.add(shakeOffset);
    renderScene();
    camera.position.copy(savedCamPos);
    if(shakeTime===0){shakeAmp=0;shakeDur=0}
  }else{
    renderScene();
  }
}
function resize(){
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  if(composer)composer.setSize(innerWidth,innerHeight);
  if(bloomPass)bloomPass.setSize(innerWidth,innerHeight);
}
addEventListener('resize',resize);
select('earth',true);
const simulator=createSimulator({scene,camera,controls,objects,moon,ambient,light,sunFill,flyTo,select,notify,setPanel,addShake,pulseBloom});
requestAnimationFrame(frame);
setTimeout(()=>$('#loading').classList.add('done'),reduceMotion?50:350);

