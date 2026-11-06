/* 广州立体志 · 立体书目录
 *
 * 展品顺序即书页顺序；each entry:
 *   [id, theme, lead, themeLabel(兼容旧版第 4 列), shots]
 *
 * shots 为三镜导览数据（引用已有 preset，不新增机位）：
 *   { preset: <spot.json presets 之一>, text: "≤20 字短句" }
 * 第一镜一律 overview（远观认出它），后两镜从该件自己的 preset 里挑。
 *
 * 素材路径指向 scripts/preview.mjs 导出的 refs/preview/*.png：
 *   cover                 透明底 / overview 机位干净封面
 *   silhouette            正交正立面墨色剪影（目录印谱 / 每页落脚印）
 *   silhouette-persp      overview 机位透视剪影（立起起点，与 3D 首帧对齐）
 */
(function () {
  "use strict";

  var ASSET_BASE = "refs/preview/";

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
    ["chenjiaci", "roofs", "一座书院，把岭南工艺的层层心思留在屋脊、门堂与院落里。", "屋檐与街巷", [
      { preset: "overview", text: "先看整座书院的院落格局" },
      { preset: "detail", text: "屋脊陶塑：一条脊就是一台戏" },
      { preset: "alley", text: "青云巷，书院之间的那道窄缝" }
    ]],
    ["yongqingfang", "roofs", "骑楼底下，老西关和新的日常挤在同一条巷子里。", "屋檐与街巷", [
      { preset: "overview", text: "认一认岭南街巷的剖面" },
      { preset: "stage", text: "广福台的戏台，正对一湾水" },
      { preset: "street", text: "站在街面，看连续的骑楼廊" }
    ]],
    ["shamian", "roofs", "一座江心小岛，把不同年代的建筑排成一条安静的林荫路。", "屋檐与街巷", [
      { preset: "overview", text: "0.3 平方公里的岛，一条林荫" },
      { preset: "avenue", text: "沿街的拱廊一路排开" },
      { preset: "park", text: "绿地与旧建筑面对面" }
    ]],
    ["beijinglu", "memory", "脚下是叠压的千年古道，头顶是广州最热闹的商业街。", "城市记忆", [
      { preset: "overview", text: "一条街叠着十几个朝代" },
      { preset: "ancient-road", text: "玻璃罩下的千年古道遗迹" },
      { preset: "temple", text: "街心的千年古寺旧址" }
    ]],
    ["yuexiu-park", "landscape", "五羊石像、明城墙和山脊，把羊城的名字留在城市高处。", "山水入城", [
      { preset: "overview", text: "城市高处，羊城名字的来处" },
      { preset: "zhenhai", text: "镇海楼压在山脊线上" },
      { preset: "wuyang", text: "五羊石像，五只羊望着城" }
    ]],
    ["lizhiwan", "landscape", "一湾溪水绿，两岸荔枝红；西关的水乡底子还在流动。", "山水入城", [
      { preset: "overview", text: "一湾溪水，两岸人家" },
      { preset: "canal", text: "河涌从大屋之间穿过" },
      { preset: "bridge", text: "龙津桥，桥上看两岸" }
    ]],
    ["shangxiajiu", "roofs", "骑楼连廊一路遮阳挡雨，是老西关最热闹的商业切面。", "屋檐与街巷", [
      { preset: "overview", text: "连续骑楼，一条商业切面" },
      { preset: "qilou", text: "骑楼廊柱，一段遮阴的距离" },
      { preset: "taotao", text: "陶陶居，老字号的灯" }
    ]],
    ["opera-museum", "belief", "水院、廊桥与戏台相连，在岭南园林里听一段粤剧。", "城中的信仰", [
      { preset: "overview", text: "一座水院绕着戏台" },
      { preset: "stage", text: "广福台，水上看戏" },
      { preset: "courtyard", text: "廊桥与庭院连成一线" }
    ]],
    ["guangxiao", "belief", "未有羊城，先有光孝；古树与院落把城市时间压得很慢。", "城中的信仰", [
      { preset: "overview", text: "未有羊城，先有这座寺" },
      { preset: "hall", text: "大殿，斗拱与梁架" },
      { preset: "pagoda", text: "院中古塔，抬头看它" }
    ]],
    ["six-banyan", "belief", "九级花塔从老城屋脊升起，苏东坡留下的两个字也留了下来。", "城中的信仰", [
      { preset: "overview", text: "九级花塔从屋脊升起" },
      { preset: "pagoda", text: "看塔身的层层收分" },
      { preset: "hall", text: "殿前，六祖与东坡的痕迹" }
    ]],
    ["memorial-hall", "memory", "八角形的蓝顶会堂，把一段近代广州的公共记忆托在树影之间。", "城市记忆", [
      { preset: "overview", text: "一座会堂，托在树影之间" },
      { preset: "front", text: "看八角形的正立面" },
      { preset: "courtyard", text: "庭院与前廊之间的空隙" }
    ]],
    ["yuntai", "landscape", "花园正对白云山，喷泉、柱廊和四季花色在一个画面里相遇。", "山水入城", [
      { preset: "overview", text: "花园正对一座山" },
      { preset: "park", text: "喷泉与四季花台" },
      { preset: "courtyard", text: "柱廊围出的院落" }
    ]],
    ["nanyue-museum", "memory", "一座西汉王墓从象岗山里打开，让两千年前的广州重新显形。", "城市记忆", [
      { preset: "overview", text: "两千年，从象岗打开" },
      { preset: "tomb", text: "墓室，石构的墓室顶" },
      { preset: "jade", text: "玉圭门阙，出土器物的位置" }
    ]],
    ["baiyun", "landscape", "登上摩星岭，山路、牌坊和城市远景组成广州的另一条天际线。", "山水入城", [
      { preset: "overview", text: "城区最高处的另一条天际线" },
      { preset: "summit", text: "登上摩星岭" },
      { preset: "paifang", text: "山门牌坊，一步一步" }
    ]],
    ["canton-tower", "geometry", "一条扭转的曲线从珠江边升起，成为广州最容易被认出的轮廓。", "新城的几何", [
      { preset: "overview", text: "珠江边上那条扭转的曲线" },
      { preset: "lattice", text: "24 根立柱与斜撑编出的网" },
      { preset: "river", text: "从北岸回望这条曲线" }
    ]],
    ["sacred-heart", "belief", "整座花岗岩教堂把尖塔、玫瑰窗和光线固定成一件石头的乐章。", "城中的信仰", [
      { preset: "overview", text: "一整块石头立成的乐章" },
      { preset: "rose", text: "玫瑰窗，透进来的光" },
      { preset: "facade", text: "正立面，两座尖塔之间" }
    ]],
    ["gd-museum", "geometry", "一只悬在新中轴上的月光宝盒，把岭南的历史、艺术与自然收在其中。", "新城的几何", [
      { preset: "overview", text: "悬在中轴上的一只宝盒" },
      { preset: "box", text: "盒体的层层错动" },
      { preset: "plaza", text: "草坡入口，慢慢走上屋顶" }
    ]],
    ["opera-house", "geometry", "两块没有直角的砾石，把剧场变成一件可以绕行观看的雕塑。", "新城的几何", [
      { preset: "overview", text: "两块没有直角的石头" },
      { preset: "mouth", text: "玻璃口部，光从缝里进来" },
      { preset: "pool", text: "水池在前，倒影补全了它" }
    ]]
  ];

  var byId = {};
  var catalog = entries.map(function (row, index) {
    var place = (window.__ATLAS_PLACES || []).filter(function (item) { return item.id === row[0]; })[0] || {};
    var item = {
      id: row[0], theme: row[1], themeLabel: row[3], lead: row[2],
      no: String(index + 1).padStart(2, "0"),
      name: place.name || row[0], en: place.en || "",
      sig: place.sig || "", cluster: place.cluster || "",
      shots: (row[4] || []).slice(0, 3),
      cover: "assets/museum/" + row[0] + ".jpg",
      coverClean: ASSET_BASE + row[0] + "-cover.png",
      silhouetteOrtho: ASSET_BASE + row[0] + "-silhouette.png",
      silhouettePersp: ASSET_BASE + row[0] + "-silhouette-persp.png"
    };
    byId[item.id] = item;
    return item;
  });

  window.MUSEUM_CATALOG = { themeList: themeList, themes: themes, entries: catalog, byId: byId, indexOf: function (id) {
    for (var i = 0; i < catalog.length; i++) if (catalog[i].id === id) return i;
    return -1;
  } };
}());
