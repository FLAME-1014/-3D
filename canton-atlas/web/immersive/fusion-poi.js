(function(){
  'use strict';
  var data=window.FusionPoiData,container=document.getElementById('poi-list'),status=document.getElementById('poi-status'),retry=document.getElementById('poi-retry');
  var sdk=null,origin=null,active='food',sequence=0,cache={},started=false;
  var categories={food:'050000',shopping:'060000'};
  function sdkLoad(){
    if(sdk)return sdk;
    sdk=new Promise(function(resolve,reject){
      var cfg=window.CANTON_AMAP;if(!cfg||!cfg.enabled||!cfg.key||!cfg.securityJsCode){reject(new Error('not_configured'));return;}
      if(window.AMap&&window.AMap.PlaceSearch){resolve(window.AMap);return;}
      window._AMapSecurityConfig={securityJsCode:cfg.securityJsCode};
      var timer=setTimeout(function(){reject(new Error('sdk_timeout'));},15000);
      var script=document.createElement('script');script.src='https://webapi.amap.com/maps?v=2.0&key='+encodeURIComponent(cfg.key);script.async=true;
      script.onerror=function(){clearTimeout(timer);script.remove();reject(new Error('sdk_load_failed'));};
      script.onload=function(){if(!window.AMap){clearTimeout(timer);reject(new Error('sdk_missing'));return;}window.AMap.plugin('AMap.PlaceSearch',function(){clearTimeout(timer);if(window.AMap.PlaceSearch)resolve(window.AMap);else reject(new Error('plugin_missing'));});};document.head.appendChild(script);
    }).catch(function(error){sdk=null;throw error;});return sdk;
  }
  function search(AMap,options,method,args){return new Promise(function(resolve,reject){var timer=setTimeout(function(){reject(new Error('query_timeout'));},15000);var service=new AMap.PlaceSearch(options);service[method].apply(service,args.concat(function(state,result){clearTimeout(timer);if(state==='no_data'){resolve([]);return;}if(state==='complete'&&result&&result.poiList&&Array.isArray(result.poiList.pois)){resolve(result.poiList.pois);return;}var info=result&&typeof result.info==='string'?result.info:'';reject(new Error(/INVALID_USER_DOMAIN/.test(info)?'domain_rejected':/INVALID_USER_KEY|USERKEY_PLAT_NOMATCH/.test(info)?'key_rejected':'query_failed'));}));});}
  async function anchor(AMap){
    if(origin)return origin;
    // Resolve the destination with AMap itself instead of relabeling a WGS84 anchor as GCJ-02.
    var pois=await search(AMap,{city:'广州',citylimit:true,pageSize:10,extensions:'base'},'search',['广东省博物馆']);
    var match=pois.find(function(p){return /^广东省博物馆(?:\(|（|$)/.test(p.name||'')&&data.coord(p.location);});
    if(!match)throw new Error('anchor_missing');origin=data.coord(match.location);return origin;
  }
  function render(pois){container.replaceChildren();if(!pois.length){status.textContent='高德没有返回该分类的周边地点。';return;}status.textContent='高德 · 省博周边 800 米 · '+pois.length+' 条结果';pois.forEach(function(p){var item=document.createElement('li'),title=document.createElement('strong'),address=document.createElement('p'),meta=document.createElement('small');title.textContent=p.name;address.textContent=p.address||'暂无详细地址';meta.textContent=(p.type.split(';').pop()||'地点')+(p.distance===null?'':' · 接口距离约 '+p.distance+' 米');item.append(title,address,meta);var href=data.link(p);if(href){var a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='在高德中查看 / 导航 ↗';item.append(a);}container.append(item);});}
  async function query(force){
    var token=++sequence,category=active;retry.hidden=true;container.replaceChildren();status.textContent='正在查询省博周边地点…';
    if(!force&&cache[category]&&Date.now()-cache[category].at<300000){render(cache[category].pois);return;}
    try{var AMap=await sdkLoad(),center=await anchor(AMap);var result=await search(AMap,{city:'广州',type:categories[category],pageSize:6,extensions:'base'},'searchNearBy',['',center,800]);var pois=result.map(data.normalize);cache[category]={at:Date.now(),pois:pois};if(token===sequence)render(pois);}
    catch(error){if(token!==sequence)return;var messages={not_configured:'高德未配置。请通过 npm run dev 打开本地页面。',sdk_load_failed:'浏览器未能加载高德 SDK。',sdk_timeout:'高德 SDK 加载超时。',sdk_missing:'高德 SDK 未就绪。',plugin_missing:'地点搜索插件未就绪。',query_timeout:'地点查询超时。',domain_rejected:'当前访问域名未获高德 Key 允许。',key_rejected:'高德 Key 类型或权限不匹配。',anchor_missing:'未能确定广州省博的查询中心。',query_failed:'高德查询失败，请稍后重试。'};status.textContent=messages[error.message]||'地点查询异常，请重试。';retry.hidden=false;}
  }
  document.querySelectorAll('[data-poi-category]').forEach(function(button){button.onclick=function(){active=button.dataset.poiCategory;document.querySelectorAll('[data-poi-category]').forEach(function(b){b.setAttribute('aria-pressed',String(b===button));});query(false);};});retry.onclick=function(){query(true);};
  window.FusionPoi={activate:function(){if(started)return;started=true;query(false);}};
})();
