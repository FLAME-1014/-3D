(function(root){
  'use strict';
  var places=[
    {id:'museum',name:'广东省博物馆',aliases:['省博','博物馆'],area:'珠江新城',category:'文化地标',level:'细模',views:[{id:'main',label:'建筑全貌',offset:[0,22,0],radius:245,theta:-1.05,phi:1.22},{id:'entry',label:'西门入口',offset:[-40,10,0],radius:170,theta:-1.57,phi:1.4},{id:'roof',label:'回字屋面',offset:[0,22,0],radius:290,theta:-.8,phi:.55}]},
    {id:'opera',name:'广州大剧院',aliases:['大剧院','剧院'],area:'珠江新城',category:'文化地标',level:'细模',views:[{id:'main',label:'双砾全貌',offset:[0,20,-45],radius:255,theta:.45,phi:1.22},{id:'entry',label:'玻璃口部',offset:[0,10,-45],radius:170,theta:.55,phi:1.4},{id:'roof',label:'双砾俯瞰',offset:[0,22,-45],radius:290,theta:-.8,phi:.55}]}
  ];
  function search(query){var text=String(query||'').trim().toLocaleLowerCase();return places.filter(function(p){return [p.name,p.area,p.category].concat(p.aliases).join(' ').toLocaleLowerCase().includes(text);});}
  var api={places:places,search:search,get:function(id){return places.find(function(p){return p.id===id;});}};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FusionCatalog=api;
})(typeof window!=='undefined'?window:this);
