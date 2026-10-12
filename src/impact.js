import * as THREE from 'three';

// Stylised persistent effects. All visual sizes and timing are exaggerated.
export function createImpactEffects(scene, earth, camera) {
 const sphere=earth.mesh;
 const heat=new THREE.Mesh(new THREE.SphereGeometry(1.008,40,28),new THREE.MeshBasicMaterial({color:0xff4d12,transparent:true,opacity:0,depthWrite:false}));
 sphere.add(heat);
 const scarRoot=new THREE.Group();sphere.add(scarRoot);
 const debris=new THREE.Group();scene.add(debris);
 const fragments=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.07,1),new THREE.MeshStandardMaterial({color:0x8b7165,emissive:0x702006,emissiveIntensity:.8,roughness:1}),220);
 fragments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);fragments.frustumCulled=false;debris.add(fragments);debris.visible=false;
 const wave=new THREE.Mesh(new THREE.RingGeometry(.92,1,96),new THREE.MeshBasicMaterial({color:0xffb277,side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(wave);
 const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshStandardMaterial({color:0x91867b,roughness:.95,emissive:0x341108}));scene.add(rock);rock.visible=false;
 const tail=new THREE.Mesh(new THREE.ConeGeometry(.25,3,16,1,true),new THREE.MeshBasicMaterial({color:0xffa35f,transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));scene.add(tail);tail.visible=false;
 const dirs=Array.from({length:220},(_,i)=>{const y=1-2*(i+.5)/220,a=i*2.39996;return new THREE.Vector3(Math.sqrt(1-y*y)*Math.cos(a),y,Math.sqrt(1-y*y)*Math.sin(a))});
 const dummy=new THREE.Object3D(),center=new THREE.Vector3();
 let flight=null,age=0,result=null,normal=new THREE.Vector3(),localNormal=new THREE.Vector3();
 let totalHeat=0;
 function impact(r){
  result=r;age=0;debris.visible=true;
  const ringNormal=normal.clone();
  localNormal.copy(normal).applyQuaternion(sphere.getWorldQuaternion(new THREE.Quaternion()).invert());
  const mark=new THREE.Group();mark.position.copy(localNormal).multiplyScalar(1.012);
  mark.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),localNormal);
  const radius=Math.min(.7,.035+r.damage*.5);
  const crater=new THREE.Mesh(new THREE.CircleGeometry(radius,48),new THREE.MeshBasicMaterial({color:0x130e0c,side:THREE.DoubleSide}));
  const rim=new THREE.Mesh(new THREE.RingGeometry(radius*.83,radius,48),new THREE.MeshBasicMaterial({color:0xff782e,side:THREE.DoubleSide}));rim.position.z=.004;mark.add(crater,rim);scarRoot.add(mark);
  // Bound retained GPU resources after repeated launches.
  while(scarRoot.children.length>16){const old=scarRoot.children[0];old.traverse(x=>{x.geometry?.dispose();x.material?.dispose()});scarRoot.remove(old)}
  totalHeat=Math.min(.8,totalHeat+Math.max(0,r.damage-.38)*.7);heat.material.opacity=totalHeat;
  wave.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),ringNormal);
  sphere.visible=!r.fragment;
 }
 return {
  launch(r,kind,onHit){
   sphere.getWorldPosition(center);
   normal.copy(camera.position).sub(center).normalize();
   flight={time:0,r,kind,onHit};rock.visible=true;tail.visible=true;
   rock.scale.setScalar(kind==='needle'?.065:kind==='moon'?earth.body.size*.6:Math.max(.2,r.damage*.9));
   rock.material.color.setHex(kind==='needle'?0xb5dbea:kind==='moon'?0xb4b1a6:0x91867b);
  },
  reset(){
   flight=null;result=null;totalHeat=0;heat.material.opacity=0;sphere.visible=true;debris.visible=false;rock.visible=false;tail.visible=false;wave.material.opacity=0;
   for(const mark of [...scarRoot.children]){mark.traverse(x=>{x.geometry?.dispose();x.material?.dispose()});scarRoot.remove(mark)}
  },
  setEnvironmentalHeat(value){heat.material.opacity=Math.max(totalHeat,value)},
  update(dt){
   sphere.getWorldPosition(center);debris.position.copy(center);
   if(flight){
    flight.time+=dt;const t=Math.min(1,flight.time/2.8);
    const tangent=new THREE.Vector3().crossVectors(normal,new THREE.Vector3(0,1,0)).normalize();
    rock.position.copy(center).addScaledVector(normal,earth.body.size+8*(1-t)).addScaledVector(tangent,-7*(1-t));
    rock.rotation.x+=dt;rock.rotation.y+=dt*1.2;
    tail.position.copy(rock.position).addScaledVector(normal,1.5);
    tail.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
    if(t>=1){const f=flight;flight=null;rock.visible=false;tail.visible=false;impact(f.r);f.onHit()}
   }
   if(result){
    age+=dt;
    const spread=result.fragment?Math.min(18,age*.7):Math.min(6,age*1.3);
    for(let i=0;i<dirs.length;i++){
     dummy.position.copy(dirs[i]).multiplyScalar(earth.body.size+spread*(.4+(i%13)/13));
     if(!result.fragment)dummy.position.multiplyScalar(.45).addScaledVector(normal,earth.body.size*.8);
     dummy.rotation.set(age*(i%5)*.2,i+age*.12,age*.3);
     dummy.scale.setScalar(result.fragment?1.5+(i%9)*.4:Math.max(.01,1-age/12)*(.3+(i%7)*.1));
     dummy.updateMatrix();fragments.setMatrixAt(i,dummy.matrix);
    }
    fragments.instanceMatrix.needsUpdate=true;
    if(!result.fragment&&age>12)debris.visible=false;
    wave.position.copy(center).addScaledVector(normal,earth.body.size*1.025);
    wave.scale.setScalar(.1+age*(1+result.damage*2));wave.material.opacity=Math.max(0,.75-age*.22);
   }
  },
  get busy(){return !!flight},get destroyed(){return !!result?.fragment}
 };
}
