// VOID LAB — simplified educational physics calculations.
// No casualty / survival counts: they require comprehensive regional hazard models.
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
  const d=Math.max(1,Math.min(1500,Number(diameterMeters)||1));
  const v=Math.max(1,Math.min(70,Number(speedKmS)||1));
  const density=3000; // kg/m3: illustrative rock
  const mass=(4/3)*Math.PI*Math.pow(d/2,3)*density;
  const joules=.5*mass*Math.pow(v*1000,2);
  const megatons=joules/TNT_MEGATON;
  const risk=d<25?'ATMOSFERDE PARÇALANMA OLASI':d<140?'YEREL ETKİ OLASI':d<1000?'BÖLGESEL ETKİ OLASI':'KÜRESEL ETKİ OLASI';
  return {diameter:d,speed:v,density,mass,joules,megatons,risk};
}
export function relativisticScenario(massKg,percentOfC){
  const pct=Math.max(1,Math.min(99,Number(percentOfC)||1));
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
