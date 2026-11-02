/* Regional anchors from archived OSM research, WGS84; not surveyed footprints. */
(function (root) {
  'use strict';
  var origin = [113.32142, 23.11741];
  var anchors = {
    museum: {name:'广东省博物馆',coord:origin.slice()},
    opera: {name:'广州大剧院',coord:[113.31711,23.11778]},
    library: {name:'广州图书馆',coord:[113.32059,23.11885]},
    youth: {name:'第二少年宫',coord:[113.31767,23.11896]},
    ifc: {name:'西塔 IFC',coord:[113.31786,23.12025]},
    ctf: {name:'东塔 CTF',coord:[113.32056,23.12020]},
    tower: {name:'广州塔',coord:[113.31915,23.10902]},
    south: {name:'花城广场南端',coord:[113.31940,23.11560]}
  };
  var R=6378137,rad=Math.PI/180,cos=Math.cos(origin[1]*rad);
  function toLocal(coord,system) {
    if(system!=='WGS84')throw new Error('Explicit WGS84 coordinates required; do not mix GCJ-02');
    if(!Array.isArray(coord)||coord.length!==2||!coord.every(Number.isFinite)||Math.abs(coord[0]-origin[0])>.1||Math.abs(coord[1]-origin[1])>.1)throw new Error('Coordinate outside regional approximation');
    return {x:(coord[0]-origin[0])*rad*R*cos,z:-(coord[1]-origin[1])*rad*R || 0};
  }
  function toGeo(point){return [origin[0]+point.x/(rad*R*cos),origin[1]-point.z/(rad*R)];}
  var api={origin:origin,anchors:anchors,toLocal:toLocal,toGeo:toGeo,system:'WGS84',source:'qoder-docs/superpowers/research/2026-10-31-huacheng-facts.md',accuracy:'Archived approximate POI anchors; not survey data',unit:'meter',axes:'+X east, +Z south'};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FusionGeo=api;
})(typeof window!=='undefined'?window:this);

