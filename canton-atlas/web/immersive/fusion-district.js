(function(root){'use strict';
 var ids=['museum','library','opera'];
 function next(id){var i=ids.indexOf(id);return i>=0&&i<ids.length-1?ids[i+1]:null;}
 function fit(points,aspect,fov){var minX=Math.min.apply(null,points.map(p=>p.x)),maxX=Math.max.apply(null,points.map(p=>p.x)),minZ=Math.min.apply(null,points.map(p=>p.z)),maxZ=Math.max.apply(null,points.map(p=>p.z));var span=Math.max(maxZ-minZ+220,(maxX-minX+220)/Math.max(.3,aspect));return {target:[(minX+maxX)/2,0,(minZ+maxZ)/2],radius:Math.max(680,span/(2*Math.tan(fov*Math.PI/360)))*1.15,theta:0,phi:.48};}
 var api={ids:ids,next:next,fit:fit};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FusionDistrict=api;
})(typeof window!=='undefined'?window:this);
