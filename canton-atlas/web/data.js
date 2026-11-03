/* 广州城市图鉴 · 数据层
   地点资料按公开常识整理，开放时间 / 门票 / 演出以官方公告为准。
   地图坐标为风格化示意坐标，不是导航数据。 */

const CATS = {
  landmark: { name: "地标", en: "LANDMARK", color: "#b5432f" },
  street: { name: "街巷", en: "STREET", color: "#2f6b5f" },
  food: { name: "味道", en: "FLAVOR", color: "#b07a1e" },
  nature: { name: "自然", en: "NATURE", color: "#5b7f3a" },
  experience: { name: "体验", en: "EXPERIENCE", color: "#6b4f8a" }
};

const CLUSTERS = {
  xiguan: { name: "西关", en: "XIGUAN", color: "#a9573c" },
  laocheng: { name: "老城", en: "OLD TOWN", color: "#4f6b52" },
  tianhe: { name: "天河", en: "TIANHE", color: "#3f5f7a" },
  haizhu: { name: "海珠", en: "HAIZHU", color: "#8a6a2f" },
  baiyun: { name: "白云", en: "BAIYUN", color: "#5c7245" }
};

const PLACES = [
  {
    id: "chenjiaci", no: "01", name: "陈家祠", en: "CHEN CLAN ANCESTRAL HALL",
    cat: "landmark", cluster: "xiguan", x: 300, y: 330, dur: 90, must: true,
    sig: "一座书院，把岭南的「三雕两塑一铸」全刻在身上。",
    facts: [["建成", "1894 年"], ["工艺", "三雕两塑一铸"], ["现为", "广东民间工艺博物馆"]],
    highlights: [
      "屋脊上的陶塑和灰塑，一条脊就是一台戏",
      "木雕、石雕、砖雕分布在门堂、梁架和栏板上",
      "馆内常设广东民间工艺展，广绣、广彩、潮州木雕一次看完"
    ],
    best: "上午光线斜进天井，屋脊细节最清楚",
    tip: "和荔枝湾、永庆坊排在同一天，步行或地铁都顺路",
    tags: ["岭南建筑", "书院", "工艺", "必看"]
  },
  {
    id: "lizhiwan", no: "02", name: "荔枝湾", en: "LIZHIWAN",
    cat: "street", cluster: "xiguan", x: 250, y: 372, dur: 75,
    sig: "「一湾溪水绿，两岸荔枝红」，西关的水乡底子。",
    facts: [["形态", "河涌 + 荔湾湖"], ["名句", "一湾溪水绿"], ["片区", "西关"]],
    highlights: [
      "沿河涌走，能看到西关大屋和石脚青砖",
      "荔湾湖上的曲桥和画舫，适合傍晚散步",
      "附近就是泮塘，小吃和糖水可以一起解决"
    ],
    best: "傍晚到入夜，灯亮之后水面最好看",
    tip: "从陈家祠步行过来约 20 分钟，会穿过老西关街巷",
    tags: ["水乡", "西关", "散步"]
  },
  {
    id: "pantang", no: "03", name: "泮塘五秀", en: "PANTANG",
    cat: "food", cluster: "xiguan", x: 232, y: 402, dur: 45,
    sig: "马蹄、莲藕、菱角、茭笋、茨菇，水里长出的五种味道。",
    facts: [["五秀", "马蹄·莲藕·菱角·茭笋·茨菇"], ["片区", "泮塘"], ["形态", "水乡食材"]],
    highlights: [
      "泮塘马蹄糕是招牌，煎过之后外脆内软",
      "莲藕和菱角入菜，能吃到广州水乡的底味",
      "老铺多在泮塘路一带，适合边走边吃"
    ],
    best: "午后到傍晚",
    tip: "别只买马蹄糕，试试马蹄爽和莲藕汤",
    tags: ["小吃", "马蹄糕", "水乡"]
  },
  {
    id: "yongqingfang", no: "04", name: "永庆坊 · 恩宁路", en: "YONGQING FANG",
    cat: "street", cluster: "xiguan", x: 286, y: 386, dur: 90, must: true,
    sig: "骑楼底下做微改造，老西关和新店铺挤在同一条巷子。",
    facts: [["位置", "恩宁路"], ["形态", "骑楼街 + 微改造街区"], ["看点", "李小龙祖居、粤剧馆"]],
    highlights: [
      "骑楼底下的老铺和新店混在一起，适合慢慢逛",
      "李小龙祖居藏在巷子里，留意指示牌",
      "粤剧艺术博物馆的园林部分值得单独留时间"
    ],
    best: "下午到傍晚，店铺全开，光线也柔",
    tip: "恩宁路本身就是广州骑楼街的代表，别只走主巷",
    tags: ["骑楼", "微改造", "西关", "必看"]
  },
  {
    id: "morning-tea", no: "05", name: "西关早茶", en: "MORNING TEA",
    cat: "food", cluster: "xiguan", x: 270, y: 420, dur: 60, slot: "morning",
    sig: "一盅两件，广州人的早晨从一壶茶开始。",
    facts: [["组合", "一盅两件"], ["必点", "虾饺·烧卖·叉烧包"], ["时段", "早市"]],
    highlights: [
      "虾饺看皮，薄到透光还不破",
      "干蒸烧卖要猪肉和虾的比例刚好",
      "老茶楼里推车和点心牌，是早茶的另一半"
    ],
    best: "早上 8 点到 10 点，点心最全",
    tip: "周末排队久，尽量工作日去；茶位和点心分开计费",
    tags: ["早茶", "点心", "老字号"]
  },
  {
    id: "shangxiajiu", no: "06", name: "上下九", en: "SHANGXIAJIU",
    cat: "street", cluster: "xiguan", x: 320, y: 408, dur: 60,
    sig: "骑楼连廊一路遮阳挡雨，老西关的商业街范本。",
    facts: [["形态", "骑楼商业步行街"], ["片区", "西关"], ["关键词", "老字号·骑楼"]],
    highlights: [
      "整条街的骑楼连廊，是岭南商业街的典型做法",
      "老字号和现代店铺混在一起，适合看招牌",
      "拐进旁边的巷子，能看到更日常的西关"
    ],
    best: "傍晚亮灯后",
    tip: "主街人多，想安静可以往宝华路、多宝路方向走",
    tags: ["骑楼", "商业街", "西关"]
  },
  {
    id: "shamian", no: "07", name: "沙面 · 沙面岛", en: "SHAMIAN ISLAND",
    cat: "street", cluster: "xiguan", x: 342, y: 438, dur: 90, must: true,
    sig: "0.3 平方公里的岛上，排着上百栋欧陆建筑。",
    facts: [["面积", "约 0.3 平方公里"], ["建筑", "150 栋以上"], ["前身", "英法租界"]],
    highlights: [
      "沙面大街两侧的欧陆建筑，几乎一栋一个样",
      "露德圣母堂和沙面堂，是岛上最容易被认出的两座",
      "白天鹅宾馆就在岛边，1983 年建成"
    ],
    best: "早上或傍晚，旅行团少",
    tip: "从沙面过桥就是上下九，可以串成一条线",
    tags: ["欧陆建筑", "租界", "必看"]
  },
  {
    id: "fangcun", no: "08", name: "芳村宵夜", en: "FANGCUN NIGHT STALLS",
    cat: "food", cluster: "xiguan", x: 262, y: 482, dur: 60, slot: "night",
    sig: "大排档的塑料凳一摆，广州的夜才真正开始。",
    facts: [["形态", "大排档"], ["时段", "深夜"], ["片区", "荔湾"]],
    highlights: [
      "塑料凳、折叠桌和一口锅，是广州宵夜的标准配置",
      "炒牛河、砂锅粥、炭烧生蚝，各点一样就够一桌",
      "越晚越热闹，很多店做到凌晨"
    ],
    best: "晚上 10 点之后",
    tip: "先看本地人坐哪家，再决定坐下",
    tags: ["宵夜", "大排档", "夜生活"]
  },
  {
    id: "opera-museum", no: "09", name: "粤剧艺术博物馆", en: "CANTONESE OPERA MUSEUM",
    cat: "experience", cluster: "xiguan", x: 318, y: 392, dur: 75,
    sig: "在岭南园林里，听一段粤剧的水磨腔。",
    facts: [["位置", "恩宁路"], ["形态", "岭南园林式博物馆"], ["非遗", "粤剧"]],
    highlights: [
      "园林本身就很值得看，廊桥、戏台和水院连在一起",
      "展厅讲粤剧的唱腔、行当和戏服",
      "不定期有折子戏和私伙局演出，进门先看当天安排"
    ],
    best: "下午，逛完永庆坊顺路",
    tip: "演出信息以馆方公告为准，别按固定场次安排",
    tags: ["粤剧", "园林", "非遗"]
  },
  {
    id: "guangxiao", no: "10", name: "光孝寺", en: "GUANGXIAO TEMPLE",
    cat: "landmark", cluster: "laocheng", x: 425, y: 340, dur: 60,
    sig: "「未有羊城，先有光孝」，广州最老的佛寺之一。",
    facts: [["身份", "广州最古老佛寺之一"], ["名句", "未有羊城，先有光孝"], ["关联", "六祖惠能"]],
    highlights: [
      "瘗发塔相传是六祖惠能落发之处",
      "大殿和塔的布局，能看出不同年代的叠加",
      "寺内古树多，夏天很凉"
    ],
    best: "上午",
    tip: "宗教场所，穿着和音量都收一点",
    tags: ["古寺", "六祖", "历史"]
  },
  {
    id: "six-banyan", no: "11", name: "六榕寺", en: "SIX BANYAN TEMPLE",
    cat: "landmark", cluster: "laocheng", x: 450, y: 318, dur: 45,
    sig: "九级花塔，苏东坡在这里题下「六榕」。",
    facts: [["花塔", "高约 57 米"], ["层数", "9 级"], ["题字", "苏东坡"]],
    highlights: [
      "花塔是广州老城最醒目的地标之一",
      "塔身色彩和岭南其他古塔不太一样",
      "苏东坡题「六榕」二字，寺名由此而来"
    ],
    best: "上午或傍晚",
    tip: "塔内是否开放以现场为准，院子本身就值得看",
    tags: ["古塔", "苏东坡", "古寺"]
  },
  {
    id: "yuexiu-park", no: "12", name: "越秀公园", en: "YUEXIU PARK",
    cat: "nature", cluster: "laocheng", x: 470, y: 292, dur: 75,
    sig: "五羊石像立在山顶，广州「羊城」的名号从这里来。",
    facts: [["城标", "五羊石像"], ["古迹", "明城墙"], ["片区", "越秀"]],
    highlights: [
      "五羊石像是广州「羊城」名号的视觉来源",
      "一段明代城墙藏在公园里，可以近距离看",
      "公园够大，适合把镇海楼和中山纪念碑一起走完"
    ],
    best: "早上",
    tip: "从西门进，离五羊石像和镇海楼都近",
    tags: ["城标", "公园", "明城墙"]
  },
  {
    id: "zhenhai", no: "13", name: "镇海楼", en: "ZHENHAI TOWER",
    cat: "landmark", cluster: "laocheng", x: 492, y: 266, dur: 60,
    sig: "1380 年的五层楼，老城中轴上的制高点。",
    facts: [["始建", "1380 年"], ["层数", "5 层"], ["现为", "广州博物馆"]],
    highlights: [
      "五层楼是广州老城最有辨识度的轮廓线",
      "楼内是广州博物馆，城市史一条线讲清楚",
      "楼顶平台能看老城中轴"
    ],
    best: "上午",
    tip: "和越秀公园同一张行程，别分开跑",
    tags: ["明代", "博物馆", "老城"]
  },
  {
    id: "memorial-hall", no: "14", name: "中山纪念堂", en: "SUN YAT-SEN MEMORIAL HALL",
    cat: "landmark", cluster: "laocheng", x: 515, y: 315, dur: 60,
    sig: "八角形宫殿式会堂，内部没有一根柱子挡视线。",
    facts: [["建成", "1931 年"], ["设计", "吕彦直"], ["形制", "八角宫殿式"]],
    highlights: [
      "八角形会堂，内部大跨度、没有柱子挡视线",
      "蓝琉璃瓦和红柱，是近代广州的公共建筑范本",
      "堂前广场的木棉树，春天最好看"
    ],
    best: "上午或木棉花季",
    tip: "看演出和参观是两条动线，进厅参观看当天开放情况",
    tags: ["近代建筑", "吕彦直", "木棉"]
  },
  {
    id: "nanyue-museum", no: "15", name: "南越王博物院", en: "NANYUE KING MUSEUM",
    cat: "landmark", cluster: "laocheng", x: 500, y: 345, dur: 90,
    sig: "1983 年发现的西汉石室墓，出土丝缕玉衣与文帝行玺。",
    facts: [["发现", "1983 年"], ["墓主", "赵眜"], ["镇馆", "丝缕玉衣·文帝行玺"]],
    highlights: [
      "西汉石室墓原址保护，走进去能感到墓室尺度",
      "丝缕玉衣是这里最有名的一件",
      "文帝行玺金印，证明墓主身份"
    ],
    best: "上午，人少",
    tip: "王墓展区和王宫展区不在同一处，别走错",
    tags: ["西汉", "考古", "玉衣"]
  },
  {
    id: "beijinglu", no: "16", name: "北京路", en: "BEIJING ROAD",
    cat: "street", cluster: "laocheng", x: 545, y: 378, dur: 60, must: true,
    sig: "脚下玻璃罩着千年古道，头上是广州最热闹的商业街。",
    facts: [["古道", "千年"], ["遗址", "玻璃罩展示"], ["地标", "大佛寺"]],
    highlights: [
      "路面玻璃罩着历代古道，层层叠压",
      "商业街底下就是遗址，逛街和看地层同时发生",
      "拐进大佛寺，闹市里突然安静"
    ],
    best: "傍晚",
    tip: "想看古道遗址，留意主街中间的玻璃段",
    tags: ["千年古道", "商业街", "大佛寺", "必看"]
  },
  {
    id: "huifu", no: "17", name: "惠福东路", en: "HUIFU EAST ROAD",
    cat: "food", cluster: "laocheng", x: 520, y: 408, dur: 45,
    sig: "北京路旁的一条街，把牛杂、肠粉、煲仔饭一次吃齐。",
    facts: [["类型", "美食街"], ["邻接", "北京路"], ["必吃", "牛杂·肠粉·煲仔饭"]],
    highlights: [
      "一条街把广州日常小吃凑齐",
      "牛杂萝卜入味，肠粉看米浆",
      "煲仔饭要等，最好留出时间"
    ],
    best: "午市和晚市",
    tip: "和北京路一起安排，逛完直接吃",
    tags: ["小吃", "美食街", "北京路"]
  },
  {
    id: "wenming", no: "18", name: "文明路糖水", en: "WENMING ROAD",
    cat: "food", cluster: "laocheng", x: 590, y: 386, dur: 40,
    sig: "双皮奶、姜撞奶、芝麻糊，老广的糖水一条街。",
    facts: [["类型", "糖水铺一条街"], ["必点", "双皮奶·姜撞奶·芝麻糊"], ["片区", "越秀"]],
    highlights: [
      "老广的糖水不是甜品店，是日常的一碗",
      "双皮奶看奶皮，姜撞奶看凝固",
      "几家老铺挨着开，可以一家点一样"
    ],
    best: "下午到夜宵",
    tip: "热的和冻的是两种体验，第一次建议点热的",
    tags: ["糖水", "甜品", "老字号"]
  },
  {
    id: "sacred-heart", no: "19", name: "石室圣心大教堂", en: "SACRED HEART CATHEDRAL",
    cat: "landmark", cluster: "laocheng", x: 565, y: 418, dur: 60,
    sig: "整座教堂用花岗岩砌成，国内少见的全石构哥特。",
    facts: [["建成", "1888 年"], ["材质", "花岗岩"], ["双塔", "高约 58.5 米"]],
    highlights: [
      "整座教堂用花岗岩砌成，国内少见",
      "双尖塔是广州老城天际线的一部分",
      "彩色玻璃和石构细节，进内部才看得全"
    ],
    best: "上午，光线进窗",
    tip: "开放时间和弥撒时段以教堂公告为准",
    tags: ["哥特", "石构", "教堂"]
  },
  {
    id: "dongshankou", no: "20", name: "东山口", en: "DONGSHANKOU",
    cat: "street", cluster: "laocheng", x: 625, y: 392, dur: 75,
    sig: "红砖洋楼、麻石小巷和咖啡店，老东山的气质。",
    facts: [["建筑", "红砖洋楼"], ["代表", "五大侨园"], ["气质", "老街 + 咖啡"]],
    highlights: [
      "红砖洋楼和麻石巷，和西关是完全不同的气质",
      "五大侨园散落在街区里，适合步行找",
      "咖啡店和小店密度高，适合慢慢逛"
    ],
    best: "下午到傍晚",
    tip: "从署前路往庙前西街走，别只逛主路",
    tags: ["洋楼", "咖啡", "街区"]
  },
  {
    id: "ersha", no: "21", name: "二沙岛", en: "ERSHA ISLAND",
    cat: "street", cluster: "laocheng", x: 660, y: 456, dur: 60,
    sig: "珠江上的艺术岛，音乐厅和美术馆隔街相望。",
    facts: [["位置", "珠江江心"], ["地标", "星海音乐厅·广东美术馆"], ["气质", "艺术岛"]],
    highlights: [
      "星海音乐厅和广东美术馆隔街相望",
      "江边绿道适合骑车和散步",
      "从岛上看珠江新城天际线，角度很正"
    ],
    best: "傍晚",
    tip: "和花城广场、广州塔排在同一条江岸线上",
    tags: ["艺术", "江心岛", "骑行"]
  },
  {
    id: "river-cruise", no: "22", name: "珠江夜游", en: "PEARL RIVER NIGHT CRUISE",
    cat: "experience", cluster: "laocheng", x: 470, y: 442, dur: 90, slot: "night",
    sig: "从江面看广州塔和两岸灯光，一次收齐。",
    facts: [["码头", "天字码头等"], ["看点", "广州塔与两岸灯光"], ["时段", "日落后"]],
    highlights: [
      "从水面看广州塔，比在岸上更完整",
      "两岸灯光同时亮起，是广州最直接的城市名片",
      "航线和码头不止一个，按当晚班次选"
    ],
    best: "日落后首班",
    tip: "船票和班次以码头公告为准，提前到",
    tags: ["夜游", "珠江", "灯光"]
  },
  {
    id: "huacheng", no: "23", name: "花城广场", en: "HUACHENG SQUARE",
    cat: "street", cluster: "tianhe", x: 665, y: 365, dur: 60,
    sig: "城市新中轴，抬头双子塔，回头广州塔。",
    facts: [["中轴", "城市新中轴"], ["周边", "双子塔"], ["视角", "看广州塔"]],
    highlights: [
      "广场尽头正对广州塔，是最好认的城市机位",
      "东西塔在两侧，抬头就是珠江新城的天际线",
      "地下是花城汇，吃饭和躲雨都方便"
    ],
    best: "日落前到亮灯",
    tip: "从广场走到海心沙，视角会更好",
    tags: ["中轴", "天际线", "夜景"]
  },
  {
    id: "opera-house", no: "24", name: "广州大剧院", en: "GUANGZHOU OPERA HOUSE",
    cat: "landmark", cluster: "tianhe", x: 700, y: 340, dur: 60,
    sig: "扎哈·哈迪德的两块「圆润双砾」，几乎找不到直角。",
    facts: [["设计", "扎哈·哈迪德"], ["造型", "圆润双砾"], ["启用", "2010 年"]],
    highlights: [
      "两块「砾石」没有标准立面，走一圈角度一直在变",
      "内部声学空间和外形一样讲究",
      "夜景灯光下，建筑的曲面更明显"
    ],
    best: "傍晚",
    tip: "有演出时才能进内场，外观随时可看",
    tags: ["当代建筑", "扎哈", "剧院"]
  },
  {
    id: "gd-museum", no: "25", name: "广东省博物馆", en: "GUANGDONG MUSEUM",
    cat: "landmark", cluster: "tianhe", x: 710, y: 392, dur: 90,
    sig: "「月光宝盒」造型，外墙镂空，装着岭南的全部家底。",
    facts: [["造型", "月光宝盒"], ["启用", "2010 年"], ["位置", "珠江新城"]],
    highlights: [
      "外墙镂空铝板，白天和晚上是两种表情",
      "馆藏覆盖岭南历史、艺术和自然",
      "免费但通常要预约，按官方渠道来"
    ],
    best: "上午",
    tip: "和广州图书馆、大剧院在同一个街区，一次走完",
    tags: ["博物馆", "月光宝盒", "免费"]
  },
  {
    id: "canton-tower", no: "26", name: "广州塔", en: "CANTON TOWER",
    cat: "landmark", cluster: "haizhu", x: 655, y: 505, dur: 120, must: true,
    sig: "600 米扭转双曲面，世界高塔里少见的「小蛮腰」。",
    facts: [["总高", "600 米"], ["主体", "454 米"], ["昵称", "小蛮腰"]],
    highlights: [
      "扭转双曲面结构，世界高塔里辨识度极高",
      "450 米摩天轮和 488 米观光层，是两种看法",
      "夜里灯光变色，在珠江两岸都能看到"
    ],
    best: "日落前上塔，等到亮灯",
    tip: "观光层和摩天轮分开售票，天气不好会停运",
    tags: ["地标", "小蛮腰", "夜景", "必看"]
  },
  {
    id: "taigucang", no: "27", name: "太古仓", en: "TAIGU WHARF",
    cat: "street", cluster: "haizhu", x: 425, y: 520, dur: 75, slot: "night",
    sig: "百年前的太古仓码头，仓库改成江边餐吧。",
    facts: [["前身", "太古仓码头"], ["年代", "1900 年代初"], ["现在", "江边餐吧·影院"]],
    highlights: [
      "百年仓库的红砖和钢架还保留着",
      "江边一字排开的餐吧，适合看日落",
      "旧码头结构和新商业叠在一起"
    ],
    best: "傍晚到夜里",
    tip: "和沙面隔江相望，可以安排在一天的两头",
    tags: ["码头", "日落", "餐吧"]
  },
  {
    id: "tongfu", no: "28", name: "同福路", en: "TONGFU ROAD",
    cat: "food", cluster: "haizhu", x: 480, y: 535, dur: 45,
    sig: "竹升面压出来的筋道，老海珠的日常一碗。",
    facts: [["类型", "老街食肆"], ["必吃", "竹升面·云吞面"], ["片区", "海珠"]],
    highlights: [
      "竹升面用鸭蛋和碱水，压出来才够筋道",
      "云吞面讲汤底和面身，老店各有各的做法",
      "同福路一带骑楼还在，吃饭顺便看街"
    ],
    best: "午市",
    tip: "面要趁热吃，放久了就坨",
    tags: ["竹升面", "云吞面", "老街"]
  },
  {
    id: "party-pier", no: "29", name: "琶醍", en: "PARTY PIER",
    cat: "street", cluster: "haizhu", x: 745, y: 510, dur: 90, slot: "night",
    sig: "珠江啤酒厂旧址，江边喝酒看日落。",
    facts: [["前身", "珠江啤酒厂"], ["现在", "江边酒吧街"], ["时段", "日落至深夜"]],
    highlights: [
      "旧厂房和啤酒罐变成江边酒吧",
      "正对珠江新城天际线，日落位很抢手",
      "有轨电车和琶洲大桥都在附近"
    ],
    best: "日落前占位",
    tip: "周末人多，想安静就工作日去",
    tags: ["日落", "酒吧", "旧厂房"]
  },
  {
    id: "whampoa", no: "30", name: "黄埔古港", en: "WHAMPOA ANCHORAGE",
    cat: "street", cluster: "haizhu", x: 860, y: 540, dur: 75,
    sig: "海上丝绸之路的码头，粤海第一关还立在村口。",
    facts: [["身份", "海上丝路港口"], ["遗迹", "粤海第一关"], ["片区", "海珠"]],
    highlights: [
      "古港是广州对外贸易史的一页",
      "粤海第一关纪念馆讲海关和船务",
      "村里的艇仔粥和姜撞奶，是顺路的奖励"
    ],
    best: "上午",
    tip: "离市区有点远，和琶洲、琶醍排在一起更顺",
    tags: ["古港", "海上丝路", "村落"]
  },
  {
    id: "baiyun", no: "31", name: "白云山", en: "BAIYUN MOUNTAIN",
    cat: "nature", cluster: "baiyun", x: 420, y: 168, dur: 150, must: true,
    sig: "摩星岭 382 米，广州城区的最高点，能看见整条中轴。",
    facts: [["主峰", "摩星岭 382 米"], ["别称", "羊城第一秀"], ["玩法", "登山·缆车"]],
    highlights: [
      "摩星岭是广州城区最高点，能看见城市中轴",
      "山路选择多，从轻松散步到正经爬升都有",
      "云台花园在南门，适合作为起点或终点"
    ],
    best: "早上或傍晚",
    tip: "穿好走的鞋，带水；缆车和门票以景区公告为准",
    tags: ["登山", "摩星岭", "城市高点", "必看"]
  },
  {
    id: "yuntai", no: "32", name: "云台花园", en: "YUNTAI GARDEN",
    cat: "nature", cluster: "baiyun", x: 408, y: 238, dur: 75,
    sig: "白云山南门的花园，四季有花，喷泉对着山。",
    facts: [["位置", "白云山南门"], ["特色", "四季花展·喷泉"], ["片区", "白云"]],
    highlights: [
      "花园正对白云山，喷泉和山体在同一个画面里",
      "四季换花，什么时候去都有东西看",
      "和白云山南门连着，适合排在登山前"
    ],
    best: "上午",
    tip: "花期以园区公告为准，别按固定花种安排",
    tags: ["花园", "花展", "白云山"]
  }
];

const PRESETS = [
  {
    id: "classic-day", name: "经典一日", desc: "西关 → 老城 → 广州塔",
    mode: "day",
    start: "09:00", ids: ["chenjiaci", "yongqingfang", "shamian", "beijinglu", "canton-tower"]
  },
  {
    id: "xiguan-half", name: "西关慢游", desc: "骑楼、园林和一盅两件",
    mode: "day",
    start: "09:00", ids: ["chenjiaci", "lizhiwan", "yongqingfang", "shamian", "morning-tea"]
  },
  {
    id: "night", name: "夜景路线", desc: "从新中轴到江面",
    mode: "half",
    start: "17:30", ids: ["huacheng", "canton-tower", "party-pier"]
  },
  {
    id: "architecture", name: "建筑路线", desc: "石室、纪念堂、陈家祠与沙面",
    mode: "day",
    start: "09:00", ids: ["sacred-heart", "memorial-hall", "chenjiaci", "shamian"]
  }
];
