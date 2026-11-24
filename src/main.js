import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { bodies } from './data.js';
import { createSimulator } from './sim.js';
import { createSatelliteSystem } from './satellites.js';
import { createCosmosExtras } from './cosmos-fx.js';
import { createCockpitAndRecorder } from './cockpit.js';
import { createOrbitalDefense } from './defense.js';
import { createTerraformSystem } from './terraform.js';
import { createDysonSphere } from './dyson.js';
import { createWormholeSystem } from './wormhole.js';
import { createGalaxyCollision } from './galaxy.js';
import { createSurfaceView } from './surface-view.js';

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
renderer.toneMappingExposure=1.02;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x02040a);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3200);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=2;controls.maxDistance=1000;
controls.maxPolarAngle=Math.PI*.96;
const ambient=new THREE.AmbientLight(0x92b1dd,.20);scene.add(ambient);
const light=new THREE.PointLight(0xffdeb0,2100,320,1.25);scene.add(light);
const sunFill=new THREE.PointLight(0xffa34b,75,90);scene.add(sunFill);

// Post-processing Bloom pipeline (crisp, non-fatiguing glow with graceful fallback)
let composer=null,bloomPass=null,bloomBase=.22,bloomBoost=0;
try {
  composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),bloomBase,.32,.92);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
} catch {
  composer=null;bloomPass=null;
}
function pulseBloom(boost=1.0){bloomBoost=Math.min(.42,Math.max(bloomBoost,boost*.24))}

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
const farStars=makeStarLayer(6400,260,1200,1.2,3.4,.85);
const brightStars=makeStarLayer(1400,190,820,2.2,5.6,1.05);
// Layer 3: Near-field drifting cosmic dust for 3D parallax depth
const nearDust=makeStarLayer(700,20,160,1.0,2.6,.42);
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
  if(body.id==='jupiter'){
    // Rich equatorial cloud bands + iconic Great Red Spot anticyclone
    const bands=[[44,18,'rgba(166,112,74,.45)'],[92,26,'rgba(240,224,198,.38)'],[142,22,'rgba(148,88,58,.48)'],[196,28,'rgba(232,208,176,.42)'],[252,26,'rgba(164,96,62,.52)'],[305,20,'rgba(220,196,166,.35)']];
    for(const [y,h,col] of bands){ctx.fillStyle=col;ctx.fillRect(0,y,768,h)}
    // Great Red Spot (southern tropical storm vortex)
    ctx.save();ctx.translate(460,244);ctx.rotate(-0.08);
    const spot=ctx.createRadialGradient(0,0,4,0,0,44);
    spot.addColorStop(0,'rgba(218,78,42,.92)');
    spot.addColorStop(.45,'rgba(186,62,36,.78)');
    spot.addColorStop(.78,'rgba(232,148,96,.48)');
    spot.addColorStop(1,'rgba(200,145,105,0)');
    ctx.fillStyle=spot;ctx.scale(1.55,.82);
    ctx.beginPath();ctx.arc(0,0,44,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(255,212,174,.38)';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.ellipse(0,0,26,18,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
}
function glowTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d'),grad=g.createRadialGradient(64,64,1,64,64,64);
  grad.addColorStop(0,'rgba(255,244,210,1)');grad.addColorStop(.16,'rgba(255,180,90,.85)');grad.addColorStop(.48,'rgba(255,133,55,.3)');grad.addColorStop(1,'rgba(255,100,20,0)');
  g.fillStyle=grad;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}
function earthCloudTexture(){
  const c=document.createElement('canvas');c.width=1024;c.height=512;
  const ctx=c.getContext('2d');
  let s=918273;
  const rng=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
  // Soft wispy trade-wind cloud bands & swirling cyclone streaks
  for(let i=0;i<260;i++){
    const x=rng()*1024,y=36+rng()*440;
    const rx=16+rng()*74,ry=4+rng()*16,rot=(rng()-.5)*.45;
    const alpha=.06+rng()*.16;
    ctx.save();ctx.translate(x,y);ctx.rotate(rot);
    const g=ctx.createRadialGradient(0,0,rx*.1,0,0,rx);
    g.addColorStop(0,`rgba(255,255,255,${alpha.toFixed(3)})`);
    g.addColorStop(.55,`rgba(240,248,255,${(alpha*.55).toFixed(3)})`);
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;ctx.scale(1,ry/rx);
    ctx.beginPath();ctx.arc(0,0,rx,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  // Swirling storm fronts
  for(let i=0;i<14;i++){
    const cx=rng()*1024,cy=90+rng()*330,arms=2+Math.floor(rng()*2),rad=18+rng()*30;
    for(let a=0;a<arms;a++){
      for(let k=0;k<18;k++){
        const t=k/18,ang=a*(Math.PI*2/arms)+t*3.1,r=t*rad;
        const px=cx+Math.cos(ang)*r*1.35,py=cy+Math.sin(ang)*r*.75;
        const pr=3+(1-t)*9;
        const g=ctx.createRadialGradient(px,py,0,px,py,pr);
        g.addColorStop(0,'rgba(255,255,255,0.22)');g.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);ctx.fill();
      }
    }
  }
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=THREE.RepeatWrapping;tex.anisotropy=4;return tex;
}
function createSunShaderMaterial(){
  return new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0}},
    vertexShader:`
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      varying vec3 vObjPos;
      void main(){
        vObjPos=normalize(position);
        vec4 mvPos=modelViewMatrix*vec4(position,1.0);
        vNormalDir=normalize(normalMatrix*normal);
        vViewDir=normalize(-mvPos.xyz);
        gl_Position=projectionMatrix*mvPos;
      }
    `,
    fragmentShader:`
      uniform float uTime;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      varying vec3 vObjPos;
      float sHash(vec3 p){
        p=fract(p*0.3183099+vec3(0.11,0.17,0.23));
        p*=17.0;
        return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
      }
      float sNoise(vec3 x){
        vec3 i=floor(x),f=fract(x);
        f=f*f*(3.0-2.0*f);
        return mix(
          mix(mix(sHash(i+vec3(0.0,0.0,0.0)),sHash(i+vec3(1.0,0.0,0.0)),f.x),
              mix(sHash(i+vec3(0.0,1.0,0.0)),sHash(i+vec3(1.0,1.0,0.0)),f.x),f.y),
          mix(mix(sHash(i+vec3(0.0,0.0,1.0)),sHash(i+vec3(1.0,0.0,1.0)),f.x),
              mix(sHash(i+vec3(0.0,1.0,1.0)),sHash(i+vec3(1.0,1.0,1.0)),f.x),f.y),f.z);
      }
      float sFbm(vec3 p){
        float v=0.0,a=0.5;
        for(int i=0;i<5;i++){
          v+=a*sNoise(p);
          p=p*2.07+vec3(0.21,-0.17,0.13);
          a*=0.5;
        }
        return v;
      }
      void main(){
        vec3 p=normalize(vObjPos);
        float t=uTime*0.22;
        vec3 q=vec3(
          sFbm(p*3.1+vec3(t,-t*0.6,t*0.4)),
          sFbm(p*3.1+vec3(-t*0.5,t*0.8,1.7)),
          sFbm(p*3.1+vec3(2.3,t*0.4,-t*0.7))
        );
        float plasma=sFbm(p*5.2+q*1.9+vec3(0.0,t*0.5,-t*0.35));
        float granules=sFbm(p*13.5-q*1.2+vec3(t*0.9));
        float flares=smoothstep(0.62,0.92,plasma*0.75+granules*0.45);
        float spots=1.0-smoothstep(0.16,0.32,plasma);

        vec3 deepAmber=vec3(0.75,0.20,0.02);
        vec3 solarOrange=vec3(1.05,0.52,0.10);
        vec3 solarGold=vec3(1.28,0.88,0.34);
        vec3 whiteHot=vec3(1.55,1.36,0.95);

        vec3 col=mix(deepAmber,solarOrange,smoothstep(0.22,0.54,plasma));
        col=mix(col,solarGold,smoothstep(0.48,0.78,plasma*0.65+granules*0.5));
        col=mix(col,whiteHot,flares*0.75);
        col*=(1.0-spots*0.42);

        float ndotv=max(dot(normalize(vNormalDir),normalize(vViewDir)),0.0);
        float rim=pow(1.0-ndotv,2.6);
        float innerCorona=pow(1.0-ndotv,4.8);
        col+=vec3(1.15,0.52,0.14)*rim*(0.75+0.25*granules);
        col+=vec3(1.45,1.08,0.58)*innerCorona*0.65;

        gl_FragColor=vec4(col,1.0);
      }
    `
  });
}

const sunMat=createSunShaderMaterial();
const orbitLinesGroup=new THREE.Group();scene.add(orbitLinesGroup);
const sphere=new THREE.SphereGeometry(1,64,48),objects=new Map(),pickables=[];
for(const body of bodies){
  const pivot=new THREE.Group();
  pivot.rotation.x=body.inclination||0;
  pivot.rotation.y=body.startAngle||0;
  scene.add(pivot);
  const material=body.id==='sun'?sunMat:new THREE.MeshStandardMaterial({map:texture(body),roughness:1,metalness:0});
  const mesh=new THREE.Mesh(sphere,material);
  mesh.scale.setScalar(body.size);mesh.position.x=body.distance;mesh.userData.id=body.id;pivot.add(mesh);
  pickables.push(mesh);objects.set(body.id,{body,pivot,mesh});
  if(body.distance>0){
    const orbitTrack=new THREE.Group();
    orbitTrack.rotation.x=body.inclination||0;
    orbitLinesGroup.add(orbitTrack);
    const points=[];
    for(let i=0;i<=256;i++){const a=i*Math.PI*2/256;points.push(new THREE.Vector3(Math.cos(a)*body.distance,0,Math.sin(a)*body.distance))}
    const orbitColor=new THREE.Color(0x5d7aa0).lerp(new THREE.Color(body.color),.34);
    orbitTrack.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({color:orbitColor,transparent:true,opacity:.36,blending:THREE.AdditiveBlending,depthWrite:false})
    ));
    const orbitHalo=new THREE.Mesh(
      new THREE.RingGeometry(body.distance-.075,body.distance+.075,192),
      new THREE.MeshBasicMaterial({color:orbitColor,side:THREE.DoubleSide,transparent:true,opacity:.085,blending:THREE.AdditiveBlending,depthWrite:false})
    );
    orbitHalo.rotation.x=-Math.PI/2;
    orbitTrack.add(orbitHalo);
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
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:0xffa84c,transparent:true,opacity:.32,blending:THREE.AdditiveBlending,depthWrite:false}));
    glow.scale.set(13.5,13.5,1);mesh.add(glow);
  }
}
const earthEntry=objects.get('earth');
const earthClouds=new THREE.Mesh(
  new THREE.SphereGeometry(1.018,56,40),
  new THREE.MeshStandardMaterial({map:earthCloudTexture(),transparent:true,opacity:.8,roughness:.95,metalness:0,depthWrite:false})
);
earthClouds.raycast=()=>{};
earthEntry.mesh.add(earthClouds);earthEntry.mesh.userData.clouds=earthClouds;

// Subtle, non-blooming atmospheric Fresnel rim shells (shared SphereGeometry, rgb * intensity <= 0.30 < 0.92 bloom threshold)
const atmoGeo=new THREE.SphereGeometry(1,48,32);
function createAtmosphereRimMaterial(r,g,b,intensityVal,powerVal){
  return new THREE.ShaderMaterial({
    uniforms:{
      uColor:{value:new THREE.Vector3(r,g,b)},
      intensity:{value:intensityVal},
      uPower:{value:powerVal}
    },
    vertexShader:`
      varying vec3 n;
      varying vec3 v;
      void main(){
        vec4 p=modelViewMatrix*vec4(position,1.0);
        n=normalize(normalMatrix*normal);
        v=normalize(-p.xyz);
        gl_Position=projectionMatrix*p;
      }
    `,
    fragmentShader:`
      varying vec3 n;
      varying vec3 v;
      uniform vec3 uColor;
      uniform float intensity;
      uniform float uPower;
      void main(){
        float rim=pow(clamp(1.0-abs(dot(normalize(n),normalize(v))),0.0,1.0),uPower);
        gl_FragColor=vec4(uColor,rim*intensity);
      }
    `,
    transparent:true,
    depthWrite:false,
    side:THREE.FrontSide,
    blending:THREE.AdditiveBlending
  });
}
const planetAtmosphereSpecs=[
  {id:'venus',rgb:[0.86,0.68,0.42],intensity:0.28,power:2.8,radius:1.052},
  {id:'earth',rgb:[0.22,0.55,1.00],intensity:0.35,power:3.0,radius:1.045},
  {id:'mars',rgb:[0.82,0.48,0.34],intensity:0.20,power:3.6,radius:1.038},
  {id:'jupiter',rgb:[0.80,0.68,0.54],intensity:0.22,power:3.3,radius:1.040},
  {id:'saturn',rgb:[0.84,0.75,0.56],intensity:0.21,power:3.4,radius:1.042},
  {id:'uranus',rgb:[0.45,0.80,0.84],intensity:0.27,power:3.0,radius:1.046},
  {id:'neptune',rgb:[0.26,0.52,0.88],intensity:0.32,power:2.9,radius:1.048}
];
for(const spec of planetAtmosphereSpecs){
  const entry=objects.get(spec.id);
  if(!entry)continue;
  const atmo=new THREE.Mesh(
    atmoGeo,
    createAtmosphereRimMaterial(spec.rgb[0],spec.rgb[1],spec.rgb[2],spec.intensity,spec.power)
  );
  atmo.scale.setScalar(spec.radius);
  atmo.raycast=()=>{};
  entry.mesh.add(atmo);
  entry.mesh.userData.atmosphere=atmo;
}

// Main Asteroid Belt (between Mars r=29 and Jupiter r=41): 2 static pre-baked InstancedMesh concentric sub-rings
// rotated on GPU at differential Keplerian speeds (0 per-frame CPU matrix rebuilds)
const INNER_ASTEROID_COUNT=550;
const OUTER_ASTEROID_COUNT=550;
const asteroidGeo=new THREE.DodecahedronGeometry(1,0);
{
  const posAttr=asteroidGeo.attributes.position;
  for(let i=0;i<posAttr.count;i++){
    const vx=posAttr.getX(i),vy=posAttr.getY(i),vz=posAttr.getZ(i);
    const h=Math.sin(vx*12.9898+vy*78.233+vz*37.719)*43758.5453;
    const f=.78+(h-Math.floor(h))*.42;
    posAttr.setXYZ(i,vx*f,vy*f,vz*f);
  }
  asteroidGeo.computeVertexNormals();
}
const asteroidMat=new THREE.MeshStandardMaterial({color:0x4a4540,roughness:.98,metalness:0});
const asteroidBeltGroup=new THREE.Group();
asteroidBeltGroup.rotation.x=.026;
scene.add(asteroidBeltGroup);

const astDummy=new THREE.Object3D();
const astColor=new THREE.Color();
const astPalette=[new THREE.Color(0x9b8f82),new THREE.Color(0x7c756d),new THREE.Color(0xb0997e),new THREE.Color(0x6c6662),new THREE.Color(0xa69b8f)];
function buildAsteroidRing(count,rMin,rSpan,ySpread){
  const mesh=new THREE.InstancedMesh(asteroidGeo,asteroidMat,count);
  mesh.frustumCulled=false;
  for(let i=0;i<count;i++){
    const r=rMin+(rand()+rand())*.5*rSpan;
    const a=rand()*Math.PI*2;
    const y=(rand()+rand()-1)*ySpread;
    const base=.05+Math.pow(rand(),2.1)*.14;
    astDummy.position.set(Math.cos(a)*r,y,Math.sin(a)*r);
    astDummy.rotation.set(rand()*Math.PI*2,rand()*Math.PI*2,rand()*Math.PI*2);
    astDummy.scale.set(base*(.72+rand()*.6),base*(.62+rand()*.52),base*(.72+rand()*.6));
    astDummy.updateMatrix();
    mesh.setMatrixAt(i,astDummy.matrix);
    astColor.copy(astPalette[Math.floor(rand()*astPalette.length)]).multiplyScalar(.38+rand()*.24);
    mesh.setColorAt(i,astColor);
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  return mesh;
}
const innerAsteroidRing=buildAsteroidRing(INNER_ASTEROID_COUNT,32.0,3.4,1.35);
const outerAsteroidRing=buildAsteroidRing(OUTER_ASTEROID_COUNT,35.0,3.6,1.55);
outerAsteroidRing.rotation.z=.012;
asteroidBeltGroup.add(innerAsteroidRing,outerAsteroidRing);

// Distant Kuiper Belt (~750 icy glinting particles at r=90..115)
const KUIPER_COUNT=750;
const kPos=new Float32Array(KUIPER_COUNT*3),kCol=new Float32Array(KUIPER_COUNT*3),kSz=new Float32Array(KUIPER_COUNT),kPh=new Float32Array(KUIPER_COUNT);
const kPalette=[new THREE.Color(0xb8ecff),new THREE.Color(0x8ec8ff),new THREE.Color(0xeef7ff),new THREE.Color(0xcfd8ff)];
for(let i=0;i<KUIPER_COUNT;i++){
  const r=90+rand()*25,a=rand()*Math.PI*2,y=(rand()+rand()-1)*5.6;
  kPos[i*3]=Math.cos(a)*r;kPos[i*3+1]=y;kPos[i*3+2]=Math.sin(a)*r;
  const c=kPalette[Math.floor(rand()*kPalette.length)];
  const b=.7+rand()*.8;
  kCol[i*3]=c.r*b;kCol[i*3+1]=c.g*b;kCol[i*3+2]=c.b*b;
  kSz[i]=1.8+Math.pow(rand(),1.9)*4.2;
  kPh[i]=rand()*Math.PI*2;
}
const kuiperGeo=new THREE.BufferGeometry();
kuiperGeo.setAttribute('position',new THREE.BufferAttribute(kPos,3));
kuiperGeo.setAttribute('color',new THREE.BufferAttribute(kCol,3));
kuiperGeo.setAttribute('aSize',new THREE.BufferAttribute(kSz,1));
kuiperGeo.setAttribute('aPhase',new THREE.BufferAttribute(kPh,1));
const kuiperMat=new THREE.ShaderMaterial({
  uniforms:{uTime:{value:0},uOpacity:{value:.78},uPr:{value:Math.min(devicePixelRatio,1.65)}},
  vertexShader:`
    attribute float aSize;
    attribute float aPhase;
    varying vec3 vColor;
    varying float vGlint;
    uniform float uTime;
    uniform float uPr;
    void main(){
      vColor=color;
      float s=0.5+0.5*sin(uTime*(1.8+fract(aPhase)*2.6)+aPhase*6.2831);
      vGlint=0.45+0.95*pow(s,3.0);
      vec4 mv=modelViewMatrix*vec4(position,1.0);
      gl_PointSize=clamp(aSize*uPr*(240.0/max(-mv.z,45.0)),1.4,8.5);
      gl_Position=projectionMatrix*mv;
    }
  `,
  fragmentShader:`
    varying vec3 vColor;
    varying float vGlint;
    uniform float uOpacity;
    void main(){
      vec2 uv=gl_PointCoord-0.5;
      float d=length(uv)*2.0;
      if(d>1.0)discard;
      float core=exp(-d*d*7.5);
      float crossGlint=exp(-abs(uv.x)*14.0)*exp(-abs(uv.y)*4.5)+exp(-abs(uv.y)*14.0)*exp(-abs(uv.x)*4.5);
      float alpha=(core+crossGlint*0.35)*vGlint*uOpacity;
      gl_FragColor=vec4(vColor*(0.9+core*0.85+crossGlint*0.4),clamp(alpha,0.0,1.0));
    }
  `,
  transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending
});
const kuiperBelt=new THREE.Points(kuiperGeo,kuiperMat);
kuiperBelt.rotation.x=.045;
scene.add(kuiperBelt);

scene.updateMatrixWorld(true);
const satSystem=createSatelliteSystem({scene,objects,textureFactory:texture});
const moon=satSystem.getEarthMoonMesh();
let selected='earth',quality='HIGH',paused=false,speed=1,mode='orbit',transition=null;
const temp=new THREE.Vector3(),prev=new THREE.Vector3(),nextPos=new THREE.Vector3(),flightDir=new THREE.Vector3();
const saturn=objects.get('saturn').mesh.getWorldPosition(new THREE.Vector3());
controls.target.copy(saturn);camera.position.copy(saturn).add(new THREE.Vector3(14,8,22));camera.lookAt(saturn);controls.update();
const nav=$('#planet-list');
bodies.forEach((body,i)=>{
  const button=document.createElement('button');button.type='button';button.className='planet-item';button.dataset.id=body.id;
  const numSpan=document.createElement('span');numSpan.className='planet-number';numSpan.textContent=String(i+1).padStart(2,'0');
  const iconSpan=document.createElement('span');iconSpan.className='planet-icon';iconSpan.style.color='#'+body.color.toString(16).padStart(6,'0');iconSpan.textContent=body.icon;
  const nameSpan=document.createElement('span');nameSpan.textContent=body.name;
  const arrowSpan=document.createElement('span');arrowSpan.className='planet-arrow';arrowSpan.textContent='↗';
  button.append(numSpan,iconSpan,nameSpan,arrowSpan);
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
  $('#description').textContent=b.description;
  const bodyIdx=bodies.indexOf(b);
  $('#index').textContent=bodyIdx>=0?String(bodyIdx+1).padStart(2,'0')+' — 09':'ÖZEL · '+b.id.toUpperCase();
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
$('#speed').oninput=e=>{const v=Number(e.target.value);speed=Number.isFinite(v)?Math.max(0.05,Math.min(5,v)):1;$('#speed-label').textContent=speed.toFixed(speed<0.5?2:1)+'×';const sm=$('#slowmo');if(sm)sm.setAttribute('aria-pressed',String(speed<=0.15))};
const slowMoBtn=$('#slowmo');
if(slowMoBtn){
  let savedNormalSpeed=1;
  slowMoBtn.onclick=()=>{
    if(speed<=0.15){speed=savedNormalSpeed||1}
    else{savedNormalSpeed=speed;speed=0.1}
    if($('#speed'))$('#speed').value=String(speed);
    $('#speed-label').textContent=speed.toFixed(speed<0.5?2:1)+'×';
    slowMoBtn.setAttribute('aria-pressed',String(speed<=0.15));
    notify(speed<=0.15?'SİNEMATİK AĞIR ÇEKİM (0.1×)':'NORMAL ZAMAN AKIŞI');
  };
}
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
  kuiperMat.uniforms.uOpacity.value=quality==='HIGH'?.78:.35;
  kuiperMat.uniforms.uPr.value=pr;
  bloomBase=quality==='HIGH'?.22:.10;
  $('#quality').textContent='GRAFİK: '+(quality==='HIGH'?'YÜKSEK':'DÜŞÜK');
};
const toggleOrbitsBtn=$('#toggle-orbits');
if(toggleOrbitsBtn){
  toggleOrbitsBtn.onclick=()=>{
    orbitLinesGroup.visible=!orbitLinesGroup.visible;
    satSystem.setOrbitsVisible(orbitLinesGroup.visible);
    toggleOrbitsBtn.setAttribute('aria-pressed',String(orbitLinesGroup.visible));
    notify(orbitLinesGroup.visible?'YÖRÜNGE ÇİZGİLERİ AÇILDI':'YÖRÜNGE ÇİZGİLERİ GİZLENDİ');
  };
}
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
addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.code==='Space'&&document.activeElement.tagName==='BUTTON')return;if(e.code==='KeyF'){select(selected);return}if(e.code==='KeyV'&&mode==='cockpit'){cockpitCtrl.toggleWarp();return}if(e.code==='Escape'){setPanel(false);return}keys.add(e.code);if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault()});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key)};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>keys.delete(b.dataset.key)});
let audioContext=null,audioNodes=[],sfxNoiseBuf=null;
function stopAudio(){for(const osc of audioNodes)try{osc.stop()}catch{}audioNodes=[];sfxNoiseBuf=null;if(audioContext){audioContext.close();audioContext=null}}
function getSfxNoiseBuffer(){
  if(!audioContext)return null;
  if(sfxNoiseBuf)return sfxNoiseBuf;
  const len=audioContext.sampleRate;
  const buf=audioContext.createBuffer(1,len,audioContext.sampleRate);
  const data=buf.getChannelData(0);
  for(let i=0;i<len;i++)data[i]=Math.random()*2-1;
  sfxNoiseBuf=buf;
  return buf;
}
function playSfx(type){
  if(!audioContext||audioContext.state!=='running')return;
  try{
    const now=audioContext.currentTime;
    if(type==='impact'){
      // Deep sub-bass boom + filtered blast burst
      const sub=audioContext.createOscillator(),subGain=audioContext.createGain();
      sub.type='sine';
      sub.frequency.setValueAtTime(118,now);
      sub.frequency.exponentialRampToValueAtTime(24,now+1.15);
      subGain.gain.setValueAtTime(0.001,now);
      subGain.gain.linearRampToValueAtTime(0.26,now+0.02);
      subGain.gain.exponentialRampToValueAtTime(0.0008,now+1.2);
      sub.connect(subGain).connect(audioContext.destination);
      sub.start(now);sub.stop(now+1.22);

      const bodyOsc=audioContext.createOscillator(),bodyGain=audioContext.createGain();
      bodyOsc.type='triangle';
      bodyOsc.frequency.setValueAtTime(68,now);
      bodyOsc.frequency.exponentialRampToValueAtTime(19,now+0.75);
      bodyGain.gain.setValueAtTime(0.14,now);
      bodyGain.gain.exponentialRampToValueAtTime(0.0008,now+0.78);
      bodyOsc.connect(bodyGain).connect(audioContext.destination);
      bodyOsc.start(now);bodyOsc.stop(now+0.8);

      const nBuf=getSfxNoiseBuffer();
      if(nBuf){
        const src=audioContext.createBufferSource(),flt=audioContext.createBiquadFilter(),ng=audioContext.createGain();
        src.buffer=nBuf;
        flt.type='lowpass';
        flt.frequency.setValueAtTime(920,now);
        flt.frequency.exponentialRampToValueAtTime(110,now+0.55);
        ng.gain.setValueAtTime(0.16,now);
        ng.gain.exponentialRampToValueAtTime(0.001,now+0.58);
        src.connect(flt).connect(ng).connect(audioContext.destination);
        src.start(now);src.stop(now+0.6);
      }
    }else if(type==='blackhole'){
      // Resonant low gravitational sweep + eerie harmonic swell
      const flt=audioContext.createBiquadFilter(),g=audioContext.createGain();
      flt.type='lowpass';flt.Q.value=6.8;
      flt.frequency.setValueAtTime(560,now);
      flt.frequency.exponentialRampToValueAtTime(88,now+1.85);
      g.gain.setValueAtTime(0.001,now);
      g.gain.linearRampToValueAtTime(0.16,now+0.18);
      g.gain.exponentialRampToValueAtTime(0.0008,now+1.95);
      flt.connect(g).connect(audioContext.destination);

      [[92,28,'sawtooth'],[138,42,'triangle']].forEach(([f0,f1,wave])=>{
        const o=audioContext.createOscillator();
        o.type=wave;
        o.frequency.setValueAtTime(f0,now);
        o.frequency.exponentialRampToValueAtTime(f1,now+1.9);
        o.connect(flt);o.start(now);o.stop(now+1.98);
      });

      const shimmer=audioContext.createOscillator(),sg=audioContext.createGain();
      shimmer.type='sine';
      shimmer.frequency.setValueAtTime(390,now);
      shimmer.frequency.exponentialRampToValueAtTime(195,now+1.6);
      sg.gain.setValueAtTime(0.001,now);
      sg.gain.linearRampToValueAtTime(0.035,now+0.35);
      sg.gain.exponentialRampToValueAtTime(0.0006,now+1.7);
      shimmer.connect(sg).connect(audioContext.destination);
      shimmer.start(now);shimmer.stop(now+1.75);
    }else if(type==='grb'){
      // High sci-fi energy beam & resonant chime
      [[1560,620,'sine',0.095],[2340,930,'triangle',0.05]].forEach(([f0,f1,wave,amp])=>{
        const o=audioContext.createOscillator(),g=audioContext.createGain();
        o.type=wave;
        o.frequency.setValueAtTime(f0,now);
        o.frequency.exponentialRampToValueAtTime(f1,now+0.88);
        g.gain.setValueAtTime(0.001,now);
        g.gain.linearRampToValueAtTime(amp,now+0.03);
        g.gain.exponentialRampToValueAtTime(0.0008,now+0.92);
        o.connect(g).connect(audioContext.destination);
        o.start(now);o.stop(now+0.95);
      });
      const nBuf=getSfxNoiseBuffer();
      if(nBuf){
        const src=audioContext.createBufferSource(),bp=audioContext.createBiquadFilter(),ng=audioContext.createGain();
        src.buffer=nBuf;
        bp.type='bandpass';bp.Q.value=4.2;
        bp.frequency.setValueAtTime(2400,now);
        bp.frequency.exponentialRampToValueAtTime(750,now+0.72);
        ng.gain.setValueAtTime(0.075,now);
        ng.gain.exponentialRampToValueAtTime(0.0008,now+0.75);
        src.connect(bp).connect(ng).connect(audioContext.destination);
        src.start(now);src.stop(now+0.78);
      }
    }else if(type==='reset'){
      // Clean crystalline ascending restore chime
      [523.25,659.25,1046.5].forEach((hz,i)=>{
        const t0=now+i*0.065;
        const o=audioContext.createOscillator(),g=audioContext.createGain();
        o.type='sine';o.frequency.setValueAtTime(hz,t0);
        g.gain.setValueAtTime(0.001,t0);
        g.gain.linearRampToValueAtTime(0.065,t0+0.02);
        g.gain.exponentialRampToValueAtTime(0.0007,t0+0.42);
        o.connect(g).connect(audioContext.destination);
        o.start(t0);o.stop(t0+0.45);
      });
    }
  }catch{}
}
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

const coordsEl=$('#coordinates');
const flightSpeedEl=$('#flight-speed');
let last=performance.now(),counter=0,elapsed=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;

  // Animate multi-layer deep space background, solar plasma shader, and icy Kuiper glint
  nebulaMat.uniforms.uTime.value=elapsed;
  farStars.mat.uniforms.uTime.value=elapsed;
  brightStars.mat.uniforms.uTime.value=elapsed;
  nearDust.mat.uniforms.uTime.value=elapsed;
  sunMat.uniforms.uTime.value=elapsed;
  kuiperMat.uniforms.uTime.value=elapsed;
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
  if(!bhOn&&asteroidBeltGroup.scale.x!==1){
    asteroidBeltGroup.position.set(0,0,0);asteroidBeltGroup.scale.setScalar(1);asteroidBeltGroup.visible=true;
    kuiperBelt.position.set(0,0,0);kuiperBelt.scale.setScalar(1);kuiperBelt.visible=true;
  }
  if(!objects.has(selected))selected='earth';
  if(!paused){
    objects.get(selected).mesh.getWorldPosition(prev);
    for(const e of objects.values()){
      if(simulator.isBodyCaptured(e.body.id)||cosmosFx.isBodyInCollision(e.body.id))continue;
      e.mesh.rotation.y+=e.body.spin*dt*60*speed;
      if(e.body.orbit && !(e.body.id==='earth'&&simulator.isSunGone()))e.pivot.rotation.y+=e.body.orbit*dt*speed*.30;
    }
    if(!simulator.isBodyCaptured('earth')){
      earthClouds.rotation.y+=dt*.045*speed;
    }
    // Pure GPU Keplerian rotation of dual concentric asteroid sub-rings (0 CPU matrix rebuilds)
    if(bhOn){
      simulator.getBlackHolePosition(temp);
      const pullStep=Math.min(1,dt*.55);
      asteroidBeltGroup.position.lerp(temp,pullStep);
      kuiperBelt.position.lerp(temp,pullStep*.65);
      const astS=Math.max(.03,asteroidBeltGroup.scale.x*(1-dt*.24));
      const kuiS=Math.max(.03,kuiperBelt.scale.x*(1-dt*.18));
      asteroidBeltGroup.scale.setScalar(astS);
      kuiperBelt.scale.setScalar(kuiS);
      asteroidBeltGroup.visible=astS>.04;
      kuiperBelt.visible=kuiS>.04;
      innerAsteroidRing.rotation.y+=dt*.22*Math.max(1,speed);
      outerAsteroidRing.rotation.y+=dt*.16*Math.max(1,speed);
      kuiperBelt.rotation.y+=dt*.06*Math.max(1,speed);
    }else{
      if(asteroidBeltGroup.scale.x!==1){
        asteroidBeltGroup.position.set(0,0,0);asteroidBeltGroup.scale.setScalar(1);asteroidBeltGroup.visible=true;
        kuiperBelt.position.set(0,0,0);kuiperBelt.scale.setScalar(1);kuiperBelt.visible=true;
      }
      innerAsteroidRing.rotation.y+=dt*.0155*speed;
      outerAsteroidRing.rotation.y+=dt*.0112*speed;
      kuiperBelt.rotation.y+=dt*.0024*speed;
    }
    objects.get(selected).mesh.getWorldPosition(nextPos);
    if(mode==='orbit'&&!transition&&selected!=='sun'&&!bhOn&&!surfaceSys.isActive()){
      nextPos.sub(prev);controls.target.add(nextPos);camera.position.add(nextPos);
    }
  }
  if(transition){
    transition.time+=dt;
    const t=smooth(Math.min(1,transition.time/transition.duration));
    camera.position.lerpVectors(transition.start,transition.end,t);
    controls.target.lerpVectors(transition.target,transition.look,t);
    if(t>=1)transition=null;
  }
  let curFlightSpeed=20,moveLen=0;
  if(mode==='orbit'){controls.update()}
  else{
    const rawFlight=Number(flightSpeedEl?.value);
    curFlightSpeed=Number.isFinite(rawFlight)?Math.max(2,Math.min(100,rawFlight)):20;
    const travel=curFlightSpeed*(keys.has('ShiftLeft')||keys.has('ShiftRight')?4:1)*dt;
    flightDir.set(0,0,0);
    if(keys.has('KeyW'))flightDir.z-=1;if(keys.has('KeyS'))flightDir.z+=1;
    if(keys.has('KeyA'))flightDir.x-=1;if(keys.has('KeyD'))flightDir.x+=1;
    if(keys.has('KeyQ'))flightDir.y-=1;if(keys.has('KeyE'))flightDir.y+=1;
    moveLen=flightDir.lengthSq();
    if(moveLen){flightDir.normalize().applyQuaternion(camera.quaternion).multiplyScalar(travel);camera.position.add(flightDir)}
  }
  cockpitCtrl.update(dt,{mode,flightSpeed:curFlightSpeed,moveLen});
  if(++counter%15===0&&coordsEl)coordsEl.textContent='KAMERA / '+camera.position.x.toFixed(1)+' · '+camera.position.y.toFixed(1)+' · '+camera.position.z.toFixed(1);
  const simDt=paused?0:dt*(speed<0.5?speed:1);
  simulator.update(simDt);
  cosmosFx.update(simDt,{paused,speed});
  defenseSys.update(simDt,{paused,speed,effects:simulator.getEffects?.()});
  terraformSys.update(simDt);
  dysonSys.update(simDt,{paused,speed});
  wormholeSys.update(dt,{mode});
  galaxySys.update(simDt,{paused,speed});
  surfaceSys.update();

  satUpdateState.paused=paused;
  satUpdateState.speed=speed;
  satUpdateState.gravity=simulator.gravity;
  satUpdateState.sunGone=simulator.isSunGone();
  satSystem.update(dt,satUpdateState);

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
const cosmosFx=createCosmosExtras({scene,objects,pickables,sun:objects.get('sun'),earth:earthEntry,light,sunFill,ambient,addShake,pulseBloom,playSfx,textureFactory:texture});
const cockpitCtrl=createCockpitAndRecorder({scene,camera,canvas,objects,notify,addShake});
const defenseSys=createOrbitalDefense({scene,earth:earthEntry,playSfx,pulseBloom});
const terraformSys=createTerraformSystem({objects,sun:objects.get('sun')});
const dysonSys=createDysonSphere({scene,sun:objects.get('sun'),light,sunFill});
const wormholeSys=createWormholeSystem({scene,objects,camera,flyTo,notify,addShake,pulseBloom,playSfx});
const galaxySys=createGalaxyCollision({scene,flyTo,notify,pulseBloom});
const surfaceSys=createSurfaceView({scene,objects,camera,controls,notify});
const megaSystems={defenseSys,terraformSys,dysonSys,wormholeSys,galaxySys,surfaceSys};
const simulator=createSimulator({scene,camera,controls,objects,moon,ambient,light,sunFill,flyTo,select,notify,setPanel,addShake,pulseBloom,playSfx,cosmosFx,megaSystems});
const satUpdateState={paused:false,speed:1,gravity:100,camera,isBodyCaptured:id=>simulator.isBodyCaptured(id),sunGone:false};
requestAnimationFrame(frame);
setTimeout(()=>$('#loading').classList.add('done'),reduceMotion?50:350);

