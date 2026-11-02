(function(root){'use strict';
function overlaps(a,b,pad){pad=pad||0;return a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad;}
function selectLabels(items,obstacles,bounds,limit){var chosen=[];items.slice().sort(function(a,b){return b.priority-a.priority;}).forEach(function(item){if(chosen.length>=limit||item.left<0||item.top<0||item.right>bounds.width||item.bottom>bounds.height)return;if(obstacles.concat(chosen).some(function(o){return overlaps(item,o,8);}))return;chosen.push(item);});return chosen;}
function pan(dx,dy,radius,theta,height,fov){var scale=2*radius*Math.tan(fov*Math.PI/360)/Math.max(1,height);return {x:(-dx*Math.cos(theta)-dy*Math.sin(theta))*scale,z:(dx*Math.sin(theta)-dy*Math.cos(theta))*scale};}
var api={overlaps:overlaps,selectLabels:selectLabels,pan:pan};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FusionInteraction=api;
})(typeof window!=='undefined'?window:this);
