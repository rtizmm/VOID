// VOID LAB — simplified educational physics calculations.
// Kinetic energy is physical; population effects below are explicitly fictional gameplay.
export const LIGHT_SPEED=299792458;
export const TNT_MEGATON=4.184e15;
export const EARTH_GRAVITY=9.80665;
export const SOLAR_DELAY=500; // approximate seconds to propagate Sun's light/gravity to Earth
export function gravityScenario(percent){
  const p=Math.max(0,Math.min(700,Number(percent)||0));
  const acceleration=EARTH_GRAVITY*p/100;
  return {percent:p,acceleration,forcePerKg:acceleration,fallTenMeters:acceleration>0?Math.sqrt(20/acceleration):null,
    level:p===100?'NORMAL':p===0?'AĞIRLIKSIZLIK':p<100?'DÜŞÜK YERÇEKİMİ':p<=200?'YÜKSEK YERÇEKİMİ':'AŞIRI YERÇEKİMİ'};
}
export function asteroidScenario(diameterMeters,speedKmS){
  const d=Math.max(1,Math.min(20000,Number(diameterMeters)||1));
  const v=Math.max(1,Math.min(70,Number(speedKmS)||1));
  const density=3000; // kg/m3: illustrative rock
  const mass=(4/3)*Math.PI*Math.pow(d/2,3)*density;
  const joules=.5*mass*Math.pow(v*1000,2);
  const megatons=joules/TNT_MEGATON;
  const risk=d<25?'ATMOSFERDE PARÇALANMA OLASI':d<140?'YEREL ETKİ OLASI':d<1000?'BÖLGESEL ETKİ OLASI':'KÜRESEL ETKİ OLASI';
  return {diameter:d,speed:v,density,mass,joules,megatons,risk};
}
export function relativisticScenario(massKg,percentOfC){
  const pct=Math.max(1,Math.min(99.99,Number(percentOfC)||1));
  const beta=pct/100;
  const gamma=1/Math.sqrt(1-beta*beta);
  const mass=Math.max(0,Number(massKg)||0);
  const joules=(gamma-1)*mass*LIGHT_SPEED**2;
  return {mass,pct,beta,gamma,joules,megatons:joules/TNT_MEGATON,velocity:beta*LIGHT_SPEED};
}
export function sunScenario(seconds){
  const t=Math.max(0,Number(seconds)||0),arrived=t>=SOLAR_DELAY;
  return {seconds:t,arrived,stage:!arrived?'SİNYAL HENÜZ ULAŞMADI':t<3600?'SON IŞIK VE ÇEKİM KAYBOLDU':t<86400?'KARANLIK DÜNYA':t<604800?'UZUN SÜRELİ SOĞUMA':'GEZEGENLER ARASI BOŞLUKTA'};
}

// Deliberately game-defined coefficients, NOT a hazard or casualty forecast.
export function sandboxImpact(joules,population=8.5e9,exposure=1,shelter=0){
 const bounded=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
 const e=bounded(joules,0,1e40,0),pop=Math.round(bounded(population,0,20e9,8.5e9));
 const dose=e/4.184e15;
 const local=Math.min(.12,Math.pow(dose/1e5,.72)*.025);
 const global=Math.min(1,Math.max(0,(Math.log10(Math.max(e,1))-21)/9));
 const fragment=e>=2.24e32;
 const fraction=fragment?1:Math.min(1,(local+global)*bounded(exposure,.1,2,1)*(1-bounded(shelter,0,100,0)/100*.8));
 const lost=Math.min(pop,Math.round(pop*fraction));
 return {survivors:pop-lost,lost,fraction,fragment,damage:e===0?0:Math.min(1,Math.max(.03,(Math.log10(e)-11)/20)),
  level:fragment?'Gezegen parçalanması':e>=1e29?'Küresel erime':e>=1e23?'Küresel yıkım':e>=1e20?'Kıtasal etki':e>=1e17?'Bölgesel yıkım':e>0?'Yerel çarpışma':'Denge'};
}
