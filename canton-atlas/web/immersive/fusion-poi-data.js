/* Pure POI normalization/link helpers. GCJ-02 values never enter FusionGeo. */
(function(root){
  'use strict';
  function coord(value){var a=Array.isArray(value)?value:typeof value==='string'?value.split(','):value&&typeof value.getLng==='function'?[value.getLng(),value.getLat()]:null;if(!a||a.length!==2)return null;var x=Number(a[0]),y=Number(a[1]);return Number.isFinite(x)&&Number.isFinite(y)&&x>=73&&x<=136&&y>=3&&y<=54?[x,y]:null;}
  function normalize(p){return {id:String(p.id||'').slice(0,80),name:String(p.name||'未命名地点').slice(0,100),address:typeof p.address==='string'?p.address.slice(0,200):'',type:String(p.type||'').slice(0,100),distance:Number.isFinite(Number(p.distance))&&p.distance!==''&&p.distance!=null?Math.max(0,Math.round(Number(p.distance))):null,location:coord(p.location),system:'GCJ-02'};}
  function link(p){if(p.system!=='GCJ-02')return null;var c=coord(p.location);if(!c)return null;return 'https://uri.amap.com/marker?position='+c.join(',')+'&name='+encodeURIComponent(p.name)+'&coordinate=gaode&callnative=0';}
  var api={coord:coord,normalize:normalize,link:link};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FusionPoiData=api;
})(typeof window!=='undefined'?window:this);
