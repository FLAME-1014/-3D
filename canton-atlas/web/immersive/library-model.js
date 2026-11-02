/* Guangzhou Library massing prototype, not a surveyed reconstruction.
 * Archived facts: north 10 floors / south 8 floors; all dimensions below are design estimates.
 * Local axes match FusionGeo: +X east, +Z south. No second ground/city is added.
 */
(function(root){
  'use strict';
  function build(options){
    options=options||{};var T=root.THREE,group=new T.Group();group.name='library-massing-prototype';
    var stone=new T.MeshStandardMaterial({color:0xd6d5c8,roughness:.85});
    var edge=new T.MeshStandardMaterial({color:0xa5a99f,roughness:.9});
    var glass=new T.MeshStandardMaterial({color:0x7295a0,roughness:.32,metalness:.18});
    var unit=new T.BoxGeometry(1,1,1),bodies=[];
    function block(w,h,d,x,y,z,material){var m=new T.Mesh(unit,material);m.scale.set(w,h,d);m.position.set(x,y,z);group.add(m);return m;}
    block(105,50,34,0,25,-25,glass);block(105,40,34,0,20,25,glass);
    // Offset horizontal bands evoke book pages, not a measured facade pattern.
    for(var wing=0;wing<2;wing++){
      var floors=wing===0?10:8,z=wing===0?-25:25;
      for(var f=0;f<floors;f++){var shift=Math.sin(f*.7+(wing?1:0))*2;
        bodies.push({w:107,h:1.2,d:36,x:shift,y:f*5+4.4,z:z});
      }
    }
    var pages=new T.InstancedMesh(unit,stone,bodies.length),matrix=new T.Matrix4(),q=new T.Quaternion();pages.frustumCulled=false;
    bodies.forEach(function(b,i){matrix.compose(new T.Vector3(b.x,b.y,b.z),q,new T.Vector3(b.w,b.h,b.d));pages.setMatrixAt(i,matrix);});group.add(pages);
    block(78,30,16,6,15,0,glass);block(24,2,20,-39,2,0,edge);
    block(28,1,26,-51,.5,0,stone);block(4,34,16,40,17,0,stone);
    return {root:group};
  }
  var api={build:build};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LibraryModel=api;
})(typeof window!=='undefined'?window:globalThis);
