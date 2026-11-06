(function () {
  "use strict";

  var themeList = [
    { id: "all", label: "全部展品" },
    { id: "roofs", label: "屋檐与街巷" },
    { id: "belief", label: "城中的信仰" },
    { id: "geometry", label: "新城的几何" },
    { id: "landscape", label: "山水入城" },
    { id: "memory", label: "城市记忆" }
  ];
  var themes = {};
  themeList.forEach(function (theme) { themes[theme.id] = theme; });

  var entries = [
    ["chenjiaci", "roofs", "一座书院，把岭南工艺的层层心思留在屋脊、门堂与院落里。", "屋檐与街巷"],
    ["yongqingfang", "roofs", "骑楼底下，老西关和新的日常挤在同一条巷子里。", "屋檐与街巷"],
    ["shamian", "roofs", "一座江心小岛，把不同年代的建筑排成一条安静的林荫路。", "屋檐与街巷"],
    ["beijinglu", "memory", "脚下是叠压的千年古道，头顶是广州最热闹的商业街。", "城市记忆"],
    ["yuexiu-park", "landscape", "五羊石像、明城墙和山脊，把羊城的名字留在城市高处。", "山水入城"],
    ["lizhiwan", "landscape", "一湾溪水绿，两岸荔枝红；西关的水乡底子还在流动。", "山水入城"],
    ["shangxiajiu", "roofs", "骑楼连廊一路遮阳挡雨，是老西关最热闹的商业切面。", "屋檐与街巷"],
    ["opera-museum", "belief", "水院、廊桥与戏台相连，在岭南园林里听一段粤剧。", "城中的信仰"],
    ["guangxiao", "belief", "未有羊城，先有光孝；古树与院落把城市时间压得很慢。", "城中的信仰"],
    ["six-banyan", "belief", "九级花塔从老城屋脊升起，苏东坡留下的两个字也留了下来。", "城中的信仰"],
    ["memorial-hall", "memory", "八角形的蓝顶会堂，把一段近代广州的公共记忆托在树影之间。", "城市记忆"],
    ["yuntai", "landscape", "花园正对白云山，喷泉、柱廊和四季花色在一个画面里相遇。", "山水入城"],
    ["nanyue-museum", "memory", "一座西汉王墓从象岗山里打开，让两千年前的广州重新显形。", "城市记忆"],
    ["baiyun", "landscape", "登上摩星岭，山路、牌坊和城市远景组成广州的另一条天际线。", "山水入城"],
    ["canton-tower", "geometry", "一条扭转的曲线从珠江边升起，成为广州最容易被认出的轮廓。", "新城的几何"],
    ["sacred-heart", "belief", "整座花岗岩教堂把尖塔、玫瑰窗和光线固定成一件石头的乐章。", "城中的信仰"],
    ["gd-museum", "geometry", "一只悬在新中轴上的月光宝盒，把岭南的历史、艺术与自然收在其中。", "新城的几何"],
    ["opera-house", "geometry", "两块没有直角的砾石，把剧场变成一件可以绕行观看的雕塑。", "新城的几何"]
  ];

  var byId = {};
  var catalog = entries.map(function (row, index) {
    var place = (window.__ATLAS_PLACES || []).filter(function (item) { return item.id === row[0]; })[0] || {};
    var item = {
      id: row[0], theme: row[1], themeLabel: row[3], lead: row[2],
      no: String(index + 1).padStart(2, "0"),
      name: place.name || row[0], en: place.en || "",
      cover: "assets/museum/" + row[0] + ".jpg"
    };
    byId[item.id] = item;
    return item;
  });

  window.MUSEUM_CATALOG = { themeList: themeList, themes: themes, entries: catalog, byId: byId };
}());
