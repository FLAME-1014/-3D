import * as THREE from 'three';

/** A procedural architectural interpretation. Coordinates are approximate meters. */
export function createEiffelTower() {
  const root = new THREE.Group();
  root.name = 'Eiffel Tower';
  const stages = [];
  const batches = new Map();
  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const up = new THREE.Vector3(0, 1, 0);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let disposed = false;
  const bronze = material('#9d7653', { metalness: 0.62, roughness: 0.54 });
  const edge = material('#6d503b', { metalness: 0.64, roughness: 0.6 });
  const rail = material('#b89166', { metalness: 0.64, roughness: 0.44 });
  const stone = material('#c9b69b', { roughness: 0.92 });
  const dark = material('#483b30', { metalness: 0.25, roughness: 0.65 });
  const glass = material('#7d9b9d', { metalness: 0.3, roughness: 0.22 });
  const lampMaterial = new THREE.MeshBasicMaterial({ color: '#ffdf99', transparent: true, opacity: 0 });
  ownedMaterials.add(lampMaterial);

  function material(color, options = {}) {
    const mat = new THREE.MeshStandardMaterial({ color, ...options });
    ownedMaterials.add(mat);
    return mat;
  }
  function stage(name, title) {
    const group = new THREE.Group();
    group.name = name;
    group.userData.title = title;
    root.add(group);
    stages.push(group);
    return group;
  }
  function geometry(geo) { ownedGeometries.add(geo); return geo; }
  const beamGeometry = geometry(new THREE.BoxGeometry(1, 1, 1));
  const lampGeometry = geometry(new THREE.SphereGeometry(0.4, 6, 4));

  function beam(parent, a, b, width, mat = bronze, depth = width) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const difference = end.sub(start);
    const length = difference.length();
    if (length < 0.0001) return;
    position.copy(start).addScaledVector(difference, 0.5);
    quaternion.setFromUnitVectors(up, difference.normalize());
    scale.set(width, length, depth);
    matrix.compose(position, quaternion, scale);
    const key = `${parent.uuid}:${mat.uuid}`;
    if (!batches.has(key)) batches.set(key, { parent, mat, transforms: [] });
    batches.get(key).transforms.push(matrix.clone());
  }
  function box(parent, x, y, z, sx, sy, sz, mat = bronze) {
    beam(parent, [x, y - sy / 2, z], [x, y + sy / 2, z], sx, mat, sz);
  }
  function ring(parent, y, radius, width, mat = bronze) {
    beam(parent, [-radius,y,-radius], [radius,y,-radius], width, mat);
    beam(parent, [radius,y,-radius], [radius,y,radius], width, mat);
    beam(parent, [radius,y,radius], [-radius,y,radius], width, mat);
    beam(parent, [-radius,y,radius], [-radius,y,-radius], width, mat);
  }
  function horizontalGrille(parent, y, radius, step, width, mat = bronze) {
    for (let a = -radius; a <= radius + 0.01; a += step) {
      beam(parent, [a,y,-radius], [a,y,radius], width, mat);
      beam(parent, [-radius,y,a], [radius,y,a], width, mat);
    }
  }
  function railing(parent, y, radius, height, step = 2.1) {
    ring(parent,y,radius,0.22,rail);
    ring(parent,y+height,radius,0.23,rail);
    ring(parent,y+height*0.45,radius,0.13,rail);
    for (let p=-radius; p<=radius+0.01; p+=step) {
      for (const sign of [-1,1]) {
        beam(parent,[p,y,sign*radius],[p,y+height,sign*radius],0.15,rail);
        beam(parent,[sign*radius,y,p],[sign*radius,y+height,p],0.15,rail);
      }
    }
  }
  function deck(parent, y, radius, thickness, openRadius, railingHeight = 2.4) {
    const band = radius-openRadius;
    box(parent,0,y,-radius+band/2,radius*2,thickness,band,edge);
    box(parent,0,y,radius-band/2,radius*2,thickness,band,edge);
    box(parent,-radius+band/2,y,0,band,thickness,openRadius*2,edge);
    box(parent,radius-band/2,y,0,band,thickness,openRadius*2,edge);
    ring(parent,y-thickness*0.5,radius+0.4,0.45,rail);
    ring(parent,y+thickness*0.5,radius+0.6,0.4,rail);
    railing(parent,y+thickness*0.5,radius,railingHeight);
    if (openRadius>0) railing(parent,y+thickness*0.5,openRadius,railingHeight*0.78);
    for(let i=-radius;i<radius;i+=3.2) {
      for(const sign of [-1,1]) {
        beam(parent,[i,y-thickness*0.35,sign*radius],[i+3.1,y+thickness*0.35,sign*radius],0.16,rail);
        beam(parent,[sign*radius,y-thickness*0.35,i],[sign*radius,y+thickness*0.35,i+3.1],0.16,rail);
      }
    }
  }

  const foundation = stage('foundations','Four foundations');
  const lower = stage('lower-structure','The great arches');
  const first = stage('first-floor','First floor · 57 m');
  const middle = stage('second-floor','Second floor · 115 m');
  const upper = stage('upper-structure','The rising lattice');
  const summit = stage('summit','Summit & antenna · 330 m');

  const profile = [
    [0,53.5,8.0], [13,46.8,7.4], [26,40.5,6.6], [40,34.9,5.7],
    [57,29.5,4.8], [71,26.1,4.4], [86,22.9,4.1], [101,20.1,3.9], [115,18.1,3.7],
  ];
  function legProfile(y) {
    let index = profile.findIndex(row => row[0] >= y);
    if(index<=0) return profile[0].slice(1);
    const a=profile[index-1], b=profile[index];
    const t=(y-a[0])/(b[0]-a[0]);
    return [THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t)];
  }
  function legPoint(y,sx,sz,cx,cz) {
    const [center,width]=legProfile(y);
    return [sx*center+cx*width,y,sz*center+cz*width];
  }
  const corners = [[-1,-1],[1,-1],[1,1],[-1,1]];
  for(const sx of [-1,1]) for(const sz of [-1,1]) {
    box(foundation,sx*53.5,-0.8,sz*53.5,22,3,22,stone);
    box(foundation,sx*53.5,1.0,sz*53.5,18,1.2,18,dark);
    for(let p=0;p<profile.length-1;p++) {
      const y0=profile[p][0]+(p===0?1.3:0), y1=profile[p+1][0];
      const parent=y0<57?lower:middle;
      const points0=corners.map(([cx,cz])=>legPoint(y0,sx,sz,cx,cz));
      const points1=corners.map(([cx,cz])=>legPoint(y1,sx,sz,cx,cz));
      for(let side=0;side<4;side++) {
        const next=(side+1)%4;
        beam(parent,points0[side],points1[side],p<4?1.05:0.78,bronze);
        beam(parent,points0[side],points0[next],0.46,edge);
        beam(parent,points1[side],points1[next],0.46,edge);
        beam(parent,points0[side],points1[next],p<4?0.34:0.29,bronze);
        beam(parent,points0[next],points1[side],p<4?0.34:0.29,bronze);
        const ym=(y0+y1)/2;
        const mid0=legPoint(ym,sx,sz,...corners[side]);
        const mid1=legPoint(ym,sx,sz,...corners[next]);
        beam(parent,mid0,mid1,0.22,rail);
        const center0=points0[side].map((v,i)=>(v+points0[next][i])/2);
        const center1=points1[side].map((v,i)=>(v+points1[next][i])/2);
        beam(parent,center0,center1,0.24,edge);
        beam(parent,mid0,center0,0.15,rail);
        beam(parent,mid1,center0,0.15,rail);
        beam(parent,mid0,center1,0.15,rail);
        beam(parent,mid1,center1,0.15,rail);
      }
    }
    // A slender diagonal lift rail reads clearly inside each open leg.
    for(const offset of [-0.9,0.9]) {
      for(let p=0;p<profile.length-1;p++) {
        const a=legPoint(profile[p][0]+(p===0?1.6:0),sx,sz,offset*0.05,offset*0.05);
        const b=legPoint(profile[p+1][0],sx,sz,offset*0.05,offset*0.05);
        beam(p<4?lower:middle,a,b,0.25,dark);
      }
    }
    const [liftC] = legProfile(36);
    box(lower,sx*liftC,36,sz*liftC,3.8,4.8,3.8,dark);
    box(lower,sx*liftC,36.5,sz*liftC,3.95,2.2,3.95,glass);
  }

  // The arch ribs follow the sloping faces of the four legs. Their spandrels
  // lean inward to meet the actual first-floor edge, rather than ending outside it.
  function sidePoint(side, horizontal, y, outward) {
    if(side===0) return [horizontal,y,outward];
    if(side===1) return [outward,y,horizontal];
    if(side===2) return [horizontal,y,-outward];
    return [-outward,y,horizontal];
  }
  function archPoint(t,side,layer=0,offset=0) {
    const x=49*t;
    const y=11+39.4*(1-t*t)+offset;
    const [c,w]=legProfile(Math.max(0,Math.min(57,y)));
    const z=c+w+layer;
    return sidePoint(side,x,y,z);
  }
  for(let side=0;side<4;side++) {
    const count=36;
    for(let i=0;i<count;i++) {
      const t=-1+2*i/count, next=-1+2*(i+1)/count;
      for(const layer of [-1.0,0.8]) {
        beam(lower,archPoint(t,side,layer),archPoint(next,side,layer),0.8,bronze);
        beam(lower,archPoint(t,side,layer,-2.0),archPoint(next,side,layer,-2.0),0.52,edge);
        beam(lower,archPoint(t,side,layer),archPoint(next,side,layer,-2.0),0.19,rail);
        beam(lower,archPoint(t,side,layer,-2.0),archPoint(next,side,layer),0.19,rail);
      }
      beam(lower,archPoint(t,side,-1.0),archPoint(t,side,0.8),0.25,bronze);
      // Tie each rib separately to the floor's underside. Keeping the attachment
      // inside its 37.8 m half-width makes every top endpoint land in solid deck.
      if(Math.abs(49*t)<=36.9) {
        for(const layer of [-1.0,0.8]) {
          const top=archPoint(t,side,layer);
          beam(lower,top,sidePoint(side,49*t,55.65,36.9+layer*0.45),0.19,edge);
        }
      }
    }
    // Close both rib ends and seat them on crossmembers spanning the leg chords.
    for(const t of [-1,1]) {
      for(const offset of [0,-2]) {
        const outer=archPoint(t,side,0.8,offset);
        const inner=archPoint(t,side,-1.0,offset);
        beam(lower,inner,outer,0.3,bronze);
        const [center,width]=legProfile(outer[1]);
        const left=sidePoint(side,t*center-width,outer[1],center+width);
        const right=sidePoint(side,t*center+width,outer[1],center+width);
        beam(lower,left,right,0.5,edge);
        beam(lower,inner,sidePoint(side,49*t,outer[1],center+width),0.35,bronze);
        beam(lower,outer,sidePoint(side,49*t,outer[1],center+width),0.35,bronze);
      }
    }
  }

  deck(first,57,37.8,2.7,18.8,2.4);
  ring(first,54.6,36.9,0.65,bronze);
  // The first floor has a glass pavilion along the two sides of its open court.
  for(const sign of [-1,1]) {
    box(first,0,61.1,sign*29.2,42,4.1,9.8,glass);
    box(first,0,63.5,sign*29.2,44,0.6,11.2,edge);
    for(let i=-21;i<=21;i+=3.0) {
      for(const face of [-1,1]) box(first,i,61.1,sign*29.2+face*4.95,0.22,4.2,0.23,rail);
    }
  }
  deck(middle,115,26.5,2.8,10.7,2.1);
  deck(middle,120.0,24.1,0.9,11.0,1.9);
  for(let side=0;side<4;side++) {
    for(let i=-22;i<=22;i+=3.7) {
      const a = side%2===0 ? [i,116.4,(side===0?1:-1)*23.8] : [(side===1?1:-1)*23.8,116.4,i];
      const b = [a[0],119.7,a[2]];
      beam(middle,a,b,0.28,bronze);
    }
  }

  const shaft = [[120,17.9],[132,15.9],[145,14.0],[158,12.4],[172,11.0],[187,9.8],[202,8.9],[217,8.0],[232,7.2],[247,6.5],[261,5.9],[274,5.4]];
  for(let p=0;p<shaft.length-1;p++) {
    const [y0,r0]=shaft[p], [y1,r1]=shaft[p+1];
    ring(upper,y0,r0,0.42,edge);
    for(let side=0;side<4;side++) {
      const [cx,cz]=corners[side], [nx,nz]=corners[(side+1)%4];
      const a=[cx*r0,y0,cz*r0], b=[cx*r1,y1,cz*r1];
      const c=[nx*r0,y0,nz*r0], d=[nx*r1,y1,nz*r1];
      beam(upper,a,b,0.85-p*0.035,bronze);
      beam(upper,a,d,0.3-p*0.01,bronze);
      beam(upper,c,b,0.3-p*0.01,bronze);
      const m0=[(a[0]+c[0])/2,y0,(a[2]+c[2])/2];
      const m1=[(b[0]+d[0])/2,y1,(b[2]+d[2])/2];
      beam(upper,m0,m1,0.20,edge);
      const ym=(y0+y1)/2, rm=(r0+r1)/2;
      const left=[cx*rm,ym,cz*rm], right=[nx*rm,ym,nz*rm];
      beam(upper,left,right,0.18,rail);
      beam(upper,left,m0,0.13,rail);
      beam(upper,right,m0,0.13,rail);
      beam(upper,left,m1,0.13,rail);
      beam(upper,right,m1,0.13,rail);
    }
  }
  // Visible central elevator core remains narrow enough to retain the lattice silhouette.
  for(const x of [-1.2,1.2]) for(const z of [-1.2,1.2]) {
    beam(upper,[x,122,z],[x,274,z],0.22,dark);
  }
  for(let y=128;y<274;y+=12) ring(upper,y,1.2,0.16,dark);
  ring(upper,274,5.4,0.5,bronze);
  for(const [x,z] of corners) {
    beam(upper,[x*5.4,274,z*5.4],[x*5.4,275,z*5.4],0.65,bronze);
  }

  deck(summit,275,10.8,1.3,0,2.1);
  box(summit,0,278.9,0,16.8,5.7,16.8,glass);
  for(let i=-8.4;i<=8.5;i+=2.1) for(const sign of [-1,1]) {
    box(summit,i,278.9,sign*8.45,0.22,5.7,0.25,rail);
    box(summit,sign*8.45,278.9,i,0.25,5.7,0.22,rail);
  }
  deck(summit,282.1,10.2,0.8,0,2.1);
  box(summit,0,285.3,0,11.6,4.9,11.6,dark);
  ring(summit,288,6.4,0.7,rail);
  for(const [x,z] of corners) {
    beam(summit,[x*6.1,288,z*6.1],[x*2.4,298,z*2.4],0.5,bronze);
    beam(summit,[x*6.1,288,z*6.1],[-x*2.4,298,z*2.4],0.22,rail);
  }
  ring(summit,298,2.5,0.5,rail);
  const mastProfile=[[298,2.2],[307,1.65],[315,1.2],[324,0.62],[330,0.13]];
  for(let p=0;p<mastProfile.length-1;p++) {
    const [y0,r0]=mastProfile[p], [y1,r1]=mastProfile[p+1];
    for(let side=0;side<4;side++) {
      const [x,z]=corners[side], [nx,nz]=corners[(side+1)%4];
      beam(summit,[x*r0,y0,z*r0],[x*r1,y1,z*r1],0.3,rail);
      beam(summit,[x*r0,y0,z*r0],[nx*r1,y1,nz*r1],0.13,rail);
    }
    ring(summit,y0,r0+0.2,0.21,bronze);
  }
  for(let y=300;y<=313;y+=3.7) {
    box(summit,0,y,0,5.8-(y-300)*0.17,0.4,5.8-(y-300)*0.17,rail);
  }

  for(const [y,r,parent] of [[58.5,37.9,first],[116.5,26.6,middle],[283,10.4,summit]]) {
    const lampTransforms = [];
    for(let i=-r;i<=r;i+=2.7) for(const sign of [-1,1]) {
      for(const [x,z] of [[i,sign*r],[sign*r,i]]) {
        lampTransforms.push(new THREE.Matrix4().makeTranslation(x,y,z));
      }
    }
    const lamps = new THREE.InstancedMesh(lampGeometry,lampMaterial,lampTransforms.length);
    lamps.name = `${parent.name} / golden lamps`;
    lampTransforms.forEach((transform,index)=>lamps.setMatrixAt(index,transform));
    lamps.instanceMatrix.needsUpdate=true;
    lamps.computeBoundingSphere();
    parent.add(lamps);
  }

  for(const {parent,mat,transforms} of batches.values()) {
    const mesh = new THREE.InstancedMesh(beamGeometry,mat,transforms.length);
    mesh.name = `${parent.name} / ironwork`;
    transforms.forEach((transform,index)=>mesh.setMatrixAt(index,transform));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    parent.add(mesh);
  }
  root.userData.height = 330;
  root.userData.baseWidth = 125;
  root.userData.description = 'Procedural interpretation of the Eiffel Tower, Paris';
  const floors = { first: new THREE.Vector3(0,57,0), second: new THREE.Vector3(0,115,0), summit: new THREE.Vector3(0,276,0) };

  function setStage(index) {
    const last = THREE.MathUtils.clamp(Math.floor(index),-1,stages.length-1);
    stages.forEach((group,i)=>{ group.visible=i<=last; group.scale.y=1; });
  }
  function setProgress(progress) {
    const count=THREE.MathUtils.clamp(progress,0,1)*stages.length;
    stages.forEach((group,i)=>{
      group.visible = count>i;
      group.scale.y = Math.max(0.001,Math.min(1,count-i));
    });
  }
  function setNight(value) {
    const amount=typeof value==='boolean'?(value?1:0):THREE.MathUtils.clamp(value,0,1);
    bronze.emissive.set('#e29a42');
    bronze.emissiveIntensity=amount*0.16;
    rail.emissive.set('#ffb850');
    rail.emissiveIntensity=amount*0.22;
    lampMaterial.opacity=amount;
  }
  function dispose() {
    if(disposed) return;
    disposed=true;
    ownedGeometries.forEach(geo=>geo.dispose());
    ownedMaterials.forEach(mat=>mat.dispose());
    root.clear();
  }
  return { root, group:root, stages, floors, height:330, baseWidth:125, setStage, setProgress, setNight, dispose };
}

export const createEiffelModel = createEiffelTower;
