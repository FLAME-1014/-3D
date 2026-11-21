export const AU = 149597870.7;
export const EPOCH = Date.UTC(2000, 0, 1, 12);
export const DEG = Math.PI / 180;
export const PLANETS = [
  { id:'sun', name:'太阳', en:'THE SUN', kind:'恒星', color:'#ffcc73', radius:696340, mass:1.9885e30, temperature:5500, tilt:7.25, day:609.12, size:5.3, distance:0, a:0, e:0, inclination:0, period:0, anomaly:0, node:0, perihelion:0, moons:0, subtitle:'在万物中央，燃烧了四十六亿年的恒星', description:'太阳以氢和氦为主要成分，核心的核聚变为整个太阳系提供能量。我们在可见光中看到的是光球；日冕则向外延伸，并不断释放太阳风。太阳光到达地球约需 8 分 19 秒。', composition:'氢约 73% · 氦约 25%（质量占比）', atmosphere:'光球 · 色球 · 日冕', source:'https://science.nasa.gov/sun/' },
  { id:'mercury', name:'水星', en:'MERCURY', kind:'类地行星', color:'#acaaa4', radius:2439.7, mass:3.301e23, temperature:167, tilt:0.034, day:1407.6, size:0.62, distance:18, a:0.3871, e:0.2056, inclination:7.005, period:87.969, anomaly:174.796, node:48.331, perihelion:29.124, moons:0, subtitle:'离太阳最近，拥有布满撞击坑的古老表面', description:'水星是太阳系中最小的行星。它几乎没有能够保温的大气，因此昼夜温差极大。水星每绕太阳公转两周，大约自转三周，形成独特的 3:2 自转轨道共振。', composition:'较大的铁质核心 · 硅酸盐地幔与地壳', atmosphere:'极稀薄外逸层', source:'https://science.nasa.gov/mercury/' },
  { id:'venus', name:'金星', en:'VENUS', kind:'类地行星', color:'#dfc597', radius:6051.8, mass:4.867e24, temperature:464, tilt:177.36, day:-5832.5, size:0.96, distance:29, a:0.7233, e:0.0068, inclination:3.3947, period:224.701, anomaly:50.115, node:76.68, perihelion:54.884, moons:0, subtitle:'云层下的炽热世界，向相反方向缓慢自转', description:'金星与地球大小相近，却拥有截然不同的环境。浓厚的二氧化碳大气与温室效应，使其表面比水星还热。可见光中的浅色外观来自硫酸云层，地表需要借助雷达等方式探测。', composition:'铁质核心 · 岩石地幔和地壳', atmosphere:'约 96.5% 二氧化碳 · 3.5% 氮', source:'https://science.nasa.gov/venus/' },
  { id:'earth', name:'地球', en:'EARTH', kind:'类地行星', color:'#79bfd1', radius:6371, mass:5.972e24, temperature:15, tilt:23.44, day:23.934, size:1.02, distance:41, a:1, e:0.0167, inclination:0, period:365.256, anomaly:357.517, node:0, perihelion:102.947, moons:1, subtitle:'一颗海洋星球，和目前唯一确认存在的生命世界', description:'液态海洋、岩石圈、大气与生物圈共同塑造地球。地表约 71% 被海洋覆盖，自转轴的倾斜带来四季。磁层影响太阳风中带电粒子的运动，而大气中的臭氧吸收大部分有害紫外线。', composition:'铁镍核心 · 硅酸盐地幔 · 岩石地壳 · 液态海洋', atmosphere:'氮约 78% · 氧约 21% · 氩及其他气体', source:'https://science.nasa.gov/earth/' },
  { id:'mars', name:'火星', en:'MARS', kind:'类地行星', color:'#cc7958', radius:3389.5, mass:6.417e23, temperature:-65, tilt:25.19, day:24.623, size:0.81, distance:55, a:1.5237, e:0.0934, inclination:1.85, period:686.98, anomaly:19.373, node:49.558, perihelion:286.502, moons:2, subtitle:'一颗留下古老河谷与湖泊证据的红色星球', description:'火星的红色来自表面含铁矿物的氧化。干涸的河谷、三角洲与沉积物表明，它曾经历与今天不同的水环境。稀薄大气使今天的地表寒冷干燥，而地下仍保存水冰。', composition:'铁、镍、硫核心 · 岩石地幔与地壳', atmosphere:'以二氧化碳为主，气压约为地球的百分之一', source:'https://science.nasa.gov/mars/' },
  { id:'jupiter', name:'木星', en:'JUPITER', kind:'气态巨行星', color:'#dbc4a0', radius:69911, mass:1.898e27, temperature:-110, tilt:3.13, day:9.925, size:2.95, distance:81, a:5.203, e:0.0489, inclination:1.303, period:4332.59, anomaly:20.02, node:100.464, perihelion:273.867, moons:95, subtitle:'巨大的氢氦世界，拥有风暴、磁层与冰卫星', description:'木星是太阳系最大的行星。浅色带与深色带来自不同的大气运动，大红斑是一场持续已久的巨大风暴。木卫一的火山、木卫二的冰壳与地下海洋，使木星系统成为重要的探测目标。', composition:'氢与氦 · 深部可能存在金属氢', atmosphere:'氢、氦，含氨与水等微量成分', source:'https://science.nasa.gov/jupiter/' },
  { id:'saturn', name:'土星', en:'SATURN', kind:'气态巨行星', color:'#e1c997', radius:58232, mass:5.683e26, temperature:-140, tilt:26.73, day:10.7, size:2.5, distance:111, a:9.537, e:0.0565, inclination:2.485, period:10759.22, anomaly:317.02, node:113.665, perihelion:339.392, moons:146, subtitle:'由无数冰粒围绕的世界', description:'土星环由尺寸不同的冰与岩石颗粒组成，并非一整块固体圆盘。土卫六拥有浓厚大气和甲烷湖泊；土卫二向太空喷出含水物质，为研究冰下海洋提供了独特窗口。', composition:'以氢和氦为主 · 深部重元素', atmosphere:'氢与氦，云层中含氨等成分', source:'https://science.nasa.gov/saturn/' },
  { id:'uranus', name:'天王星', en:'URANUS', kind:'冰巨行星', color:'#a2d1d1', radius:25362, mass:8.681e25, temperature:-195, tilt:97.77, day:-17.24, size:1.75, distance:147, a:19.191, e:0.0472, inclination:0.77, period:30688.5, anomaly:142.238, node:74.006, perihelion:96.998, moons:28, subtitle:'侧躺着绕太阳运行的冰巨行星', description:'天王星自转轴的倾角接近直角，使它的季节变化格外极端。大气中的甲烷吸收红光，使这颗行星呈现青色。它也拥有暗淡的环系与一系列冰质卫星。', composition:'岩石与富含水、氨、甲烷的内部物质', atmosphere:'氢、氦与甲烷', source:'https://science.nasa.gov/uranus/' },
  { id:'neptune', name:'海王星', en:'NEPTUNE', kind:'冰巨行星', color:'#5a8ed8', radius:24622, mass:1.024e26, temperature:-200, tilt:28.32, day:16.11, size:1.7, distance:187, a:30.068, e:0.0086, inclination:1.77, period:60182, anomaly:256.228, node:131.784, perihelion:273.187, moons:16, subtitle:'在遥远的蓝色大气中，风暴依然活跃', description:'海王星是八大行星中距离太阳最远的一颗。尽管接收到的阳光很少，它的大气仍有强烈运动。海卫一以逆行轨道运行，可能是一颗被海王星引力捕获的柯伊伯带天体。', composition:'岩石核心 · 富含水、氨和甲烷的内部', atmosphere:'氢、氦与甲烷', source:'https://science.nasa.gov/neptune/' },
  { id:'pluto', name:'冥王星', en:'PLUTO', kind:'矮行星', color:'#c5b8a3', radius:1188.3, mass:1.303e22, temperature:-225, tilt:122.53, day:-153.29, size:0.53, distance:224, a:39.482, e:0.2488, inclination:17.14, period:90560, anomaly:14.53, node:110.299, perihelion:113.834, moons:5, subtitle:'柯伊伯带中，有冰原与高山的小世界', description:'冥王星的轨道偏心率和倾角都较大，与海王星保持 3:2 轨道共振。新视野号在 2015 年的飞掠揭示了氮冰平原、冰山与稀薄大气，也改变了人们对遥远小天体的认识。', composition:'岩石与水冰 · 表面有氮、甲烷等挥发性冰', atmosphere:'稀薄氮气，含甲烷与一氧化碳', source:'https://science.nasa.gov/dwarf-planets/pluto/' }
];

export const MOON = { id:'moon', name:'月球', en:'THE MOON', kind:'天然卫星', color:'#c4c2b8', radius:1737.4, mass:7.342e22, temperature:-20, day:655.7, tilt:6.68, a:0.00257, e:0.0549, period:27.322, moons:0, size:0.29, subtitle:'地球唯一的天然卫星，保存着太阳系早期的撞击记录', description:'月球被潮汐锁定，总是大致以同一面朝向地球。深色月海是古老熔岩平原，明亮高地保存着密集的撞击坑。月球几乎没有大气，极区永久阴影区域可能保存水冰。', composition:'岩石地壳与地幔 · 小型金属核心', atmosphere:'极稀薄外逸层', source:'https://science.nasa.gov/moon/' };

const missionRows = [
  ['sputnik','斯普特尼克一号','SPUTNIK 1',1957,'earth','satellite','苏联','83.6 kg','第一颗人造地球卫星，标志着太空时代的开始。',1958,[1957,'发射并进入地球轨道',1958,'再入大气层']],
  ['explorer','探险者一号','EXPLORER 1',1958,'earth','satellite','NASA / JPL','13.97 kg','携带的宇宙射线探测器为发现范艾伦辐射带提供了重要证据。',1970,[1958,'发射与辐射带发现',1970,'再入大气层']],
  ['vostok','东方一号','VOSTOK 1',1961,'earth','crewed','苏联','4,725 kg','尤里·加加林完成首次载人地球轨道飞行。',1961,[1961,'首次载人轨道飞行']],
  ['mariner2','水手二号','MARINER 2',1962,'venus','probe','NASA / JPL','202.8 kg','首次成功飞掠另一颗行星，测量金星附近的环境。',1963,[1962,'发射并飞掠金星',1963,'任务结束']],
  ['luna9','月球九号','LUNA 9',1966,'moon','lander','苏联','99 kg','首次在月面软着陆并向地球传回月面全景图。',1966,[1966,'月面软着陆']],
  ['apollo11','阿波罗十一号','APOLLO 11',1969,'moon','crewed','NASA','45,931 kg','人类首次登上月球，并把月球岩石样品带回地球。',1969,[1969,'首次载人登月与返回']],
  ['dongfang','东方红一号','DONG FANG HONG 1',1970,'earth','satellite','中国','173 kg','中国第一颗人造地球卫星。',1970,[1970,'发射入轨']],
  ['pioneer10','先驱者十号','PIONEER 10',1972,'jupiter','probe','NASA','258 kg','首次穿越小行星带并近距离探测木星的航天器。',2003,[1972,'发射',1973,'飞掠木星',2003,'最后一次收到信号']],
  ['landsat','陆地卫星一号','LANDSAT 1',1972,'earth','satellite','NASA / USGS','953 kg','开启持续至今的陆地卫星地表观测记录。',1978,[1972,'发射',1978,'任务结束']],
  ['pioneer11','先驱者十一号','PIONEER 11',1973,'saturn','probe','NASA','259 kg','飞掠木星，并首次近距离探测土星。',1995,[1973,'发射',1974,'飞掠木星',1979,'飞掠土星',1995,'任务结束']],
  ['viking','海盗一号','VIKING 1',1975,'mars','lander','NASA','3,527 kg','轨道器与着陆器共同探测火星，开展长期地表观测。',1982,[1975,'发射',1976,'火星着陆',1982,'地表任务结束']],
  ['voyager1','旅行者一号','VOYAGER 1',1977,'jupiter','probe','NASA / JPL','825.5 kg','飞掠木星和土星；拍下“暗淡蓝点”，随后进入星际空间。',null,[1977,'发射',1979,'飞掠木星',1980,'飞掠土星',1990,'暗淡蓝点',2012,'穿越日球层顶']],
  ['voyager2','旅行者二号','VOYAGER 2',1977,'neptune','probe','NASA / JPL','825.5 kg','唯一近距离探测过天王星和海王星的航天器。',null,[1977,'发射',1979,'飞掠木星',1981,'飞掠土星',1986,'飞掠天王星',1989,'飞掠海王星',2018,'穿越日球层顶']],
  ['galileo','伽利略号','GALILEO',1989,'jupiter','probe','NASA / JPL','2,223 kg','长期环绕木星，研究大气、磁层与伽利略卫星。',2003,[1989,'发射',1995,'进入木星轨道',2003,'进入木星大气']],
  ['hubble','哈勃空间望远镜','HUBBLE',1990,'earth','telescope','NASA / ESA','11,110 kg','在地球大气层之外开展紫外、可见光与近红外观测。',null,[1990,'部署入轨',1993,'首次维修',2009,'最后一次维修']],
  ['soho','太阳与日球层探测器','SOHO',1995,'sun','probe','ESA / NASA','1,850 kg','在日地 L1 附近持续研究太阳内部、日冕与太阳风。',null,[1995,'发射',1996,'进入日地 L1 周期轨道']],
  ['cassini','卡西尼—惠更斯号','CASSINI–HUYGENS',1997,'saturn','probe','NASA / ESA / ASI','5,712 kg','探索土星环与卫星；惠更斯探测器成功降落土卫六。',2017,[1997,'发射',2004,'进入土星轨道',2005,'惠更斯着陆土卫六',2017,'壮丽终章']],
  ['iss','国际空间站','ISS',1998,'earth','crewed','国际合作','约 420 t','长期载人轨道实验室，用于微重力研究与技术验证。',null,[1998,'开始在轨组装',2000,'开始持续有人驻留']],
  ['chandra','钱德拉 X 射线望远镜','CHANDRA',1999,'earth','telescope','NASA','4,790 kg','通过 X 射线观测黑洞、超新星遗迹与星系团。',null,[1999,'发射并开始科学观测']],
  ['odyssey','火星奥德赛号','MARS ODYSSEY',2001,'mars','probe','NASA / JPL','725 kg','测绘火星表面成分，并为火星地表任务提供通信中继。',null,[2001,'发射并进入火星轨道']],
  ['rosetta','罗塞塔号','ROSETTA',2004,'sun','probe','ESA','3,000 kg','环绕 67P 彗星飞行，并释放菲莱着陆器。',2016,[2004,'发射',2014,'抵达彗星并释放菲莱',2016,'任务结束']],
  ['newhorizons','新视野号','NEW HORIZONS',2006,'pluto','probe','NASA / JHUAPL','478 kg','首次飞掠冥王星，随后继续探索柯伊伯带。',null,[2006,'发射',2015,'飞掠冥王星',2019,'飞掠天涯海角']],
  ['change1','嫦娥一号','CHANG’E 1',2007,'moon','probe','CNSA','2,350 kg','中国首个月球探测器，开展绕月遥感测绘。',2009,[2007,'发射并进入月球轨道',2009,'受控撞击月面']],
  ['kepler','开普勒空间望远镜','KEPLER',2009,'sun','telescope','NASA','1,052 kg','通过凌星法寻找系外行星，揭示银河系中行星的普遍性。',2018,[2009,'发射',2014,'K2 延伸任务',2018,'任务结束']],
  ['juno','朱诺号','JUNO',2011,'jupiter','probe','NASA / JPL','3,625 kg','以极轨道研究木星内部结构、磁场与极区。',null,[2011,'发射',2016,'进入木星轨道']],
  ['curiosity','好奇号','CURIOSITY',2011,'mars','lander','NASA / JPL','899 kg','在盖尔撞击坑研究火星古环境与宜居条件。',null,[2011,'发射',2012,'火星着陆']],
  ['gaia','盖亚','GAIA',2013,'sun','telescope','ESA','2,029 kg','精确测量恒星的位置、运动和亮度，绘制银河系立体地图。',null,[2013,'发射',2016,'首批数据发布',2022,'第三批数据发布']],
  ['tess','凌星系外行星巡天卫星','TESS',2018,'earth','telescope','NASA / MIT','362 kg','对明亮恒星进行全天巡测，寻找凌星系外行星。',null,[2018,'发射并开始巡天']],
  ['parker','帕克太阳探测器','PARKER SOLAR PROBE',2018,'sun','probe','NASA / JHUAPL','685 kg','通过多次金星引力助推，逐步深入太阳日冕。',null,[2018,'发射',2021,'首次进入太阳大气']],
  ['change5','嫦娥五号','CHANG’E 5',2020,'moon','lander','CNSA','8,200 kg','采集月球样品并将其送回地球。',2020,[2020,'发射、采样与返回']],
  ['tianwen','天问一号','TIANWEN-1',2020,'mars','probe','CNSA','约 5,000 kg','通过环绕、着陆和巡视开展火星综合探测。',null,[2020,'发射',2021,'进入火星轨道与祝融号着陆']],
  ['perseverance','毅力号','PERSEVERANCE',2020,'mars','lander','NASA / JPL','1,025 kg','在杰泽罗撞击坑研究古代环境，并封装岩芯样品。',null,[2020,'发射',2021,'火星着陆']],
  ['jwst','詹姆斯·韦布空间望远镜','JAMES WEBB',2021,'sun','telescope','NASA / ESA / CSA','6,200 kg','以红外波段研究早期宇宙、恒星形成与系外行星大气。',null,[2021,'发射',2022,'发布首批科学图像']],
  ['tiangong','中国空间站','TIANGONG',2021,'earth','crewed','中国载人航天','约 90 t','由天和、问天和梦天等舱段组成的载人空间实验平台。',null,[2021,'天和核心舱发射',2022,'完成基本构型组装']],
  ['juice','木星冰卫星探测器','JUICE',2023,'jupiter','probe','ESA','约 6,000 kg','前往木星系统，重点研究冰卫星及其潜在地下海洋。',null,[2023,'发射',2031,'计划抵达木星系统']],
  ['psyche','灵神星探测器','PSYCHE',2023,'sun','probe','NASA / JPL','约 2,747 kg','前往富金属小行星灵神星，研究行星形成的线索。',null,[2023,'发射',2029,'计划抵达目标']],
  ['europaclipper','欧罗巴快船','EUROPA CLIPPER',2024,'jupiter','probe','NASA / JPL','约 6,000 kg','通过多次飞掠木卫二，研究冰壳、海洋与宜居条件。',null,[2024,'发射',2030,'计划抵达木星系统']],
  ['change6','嫦娥六号','CHANG’E 6',2024,'moon','lander','CNSA','约 8,350 kg','执行月球背面采样返回任务。',2024,[2024,'月球背面采样与返回']]
];
export const MISSIONS = missionRows.map(([id,name,en,year,body,category,operator,mass,description,end,milestones]) => ({ id,name,en,year,body,category,operator,mass,description,end,milestones:Array.from({length:milestones.length/2},(_,i)=>({year:milestones[i*2],label:milestones[i*2+1]})), source:body==='moon'?'https://science.nasa.gov/moon/missions/':`https://science.nasa.gov/${body==='sun'?'missions':body}/`, status:end?'已完成':'延伸探索 / 资料状态' }));

export const DEEP_OBJECTS = [
  {id:'m31',name:'仙女座星系',en:'ANDROMEDA GALAXY',type:'星系',ra:10.685,dec:41.269,distance:'约 250 万光年',description:'距离银河系最近的大型旋涡星系。在足够黑暗的天空下，它是肉眼能够看到的最遥远天体之一。',source:'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/'},
  {id:'m42',name:'猎户座大星云',en:'ORION NEBULA',type:'弥漫星云',ra:83.822,dec:-5.391,distance:'约 1,350 光年',description:'一座离地球较近的恒星诞生工厂。年轻恒星的强烈辐射照亮周围的气体与尘埃。',source:'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-42/'},
  {id:'m45',name:'昴星团',en:'PLEIADES',type:'疏散星团',ra:56.75,dec:24.117,distance:'约 444 光年',description:'一群年轻、炽热的蓝色恒星。可见的反射星云来自星光照亮周围尘埃。',source:'https://science.nasa.gov/universe/'},
  {id:'m13',name:'武仙座球状星团',en:'HERCULES CLUSTER',type:'球状星团',ra:250.423,dec:36.461,distance:'约 22,000 光年',description:'数十万颗恒星聚集而成的球状星团，是北半球著名的深空观测目标。',source:'https://science.nasa.gov/mission/hubble/'},
  {id:'m51',name:'涡状星系',en:'WHIRLPOOL GALAXY',type:'星系',ra:202.47,dec:47.195,distance:'约 2,300 万光年',description:'正面朝向我们的旋涡星系，清晰的旋臂和伴星系展示星系相互作用的痕迹。',source:'https://science.nasa.gov/mission/hubble/'},
  {id:'m57',name:'环状星云',en:'RING NEBULA',type:'行星状星云',ra:283.396,dec:33.029,distance:'约 2,500 光年',description:'一颗类太阳恒星晚期抛出的气体壳层。“行星状”来自早期望远镜中的外观，与行星没有形成关系。',source:'https://science.nasa.gov/mission/hubble/'},
  {id:'m8',name:'礁湖星云',en:'LAGOON NEBULA',type:'弥漫星云',ra:270.925,dec:-24.38,distance:'约 4,000 光年',description:'位于银河方向的恒星形成区，年轻恒星正在雕刻周围的气体云。',source:'https://science.nasa.gov/mission/hubble/'},
  {id:'omega',name:'半人马座 ω 星团',en:'OMEGA CENTAURI',type:'球状星团',ra:201.697,dec:-47.479,distance:'约 17,000 光年',description:'银河系中最庞大、最明亮的球状星团之一，包含年龄与化学成分不同的恒星。',source:'https://science.nasa.gov/mission/hubble/'},
  {id:'lmc',name:'大麦哲伦星云',en:'LARGE MAGELLANIC CLOUD',type:'卫星星系',ra:80.9,dec:-69.75,distance:'约 16 万光年',description:'银河系的近邻卫星星系，拥有丰富的恒星形成活动。',source:'https://science.nasa.gov/universe/galaxies/'},
  {id:'smc',name:'小麦哲伦星云',en:'SMALL MAGELLANIC CLOUD',type:'卫星星系',ra:13.187,dec:-72.829,distance:'约 20 万光年',description:'南天的重要近邻星系，为研究低金属丰度环境中的恒星演化提供线索。',source:'https://science.nasa.gov/universe/galaxies/'}
];

export const CONSTELLATIONS = [
  {name:'猎户座',en:'ORION',points:[[88.79,7.41],[81.28,6.35],[83.00,-0.30],[84.05,-1.20],[85.19,-1.94],[86.94,-9.67],[78.63,-8.20],[83.00,-0.30],[88.79,7.41]]},
  {name:'大熊座',en:'URSA MAJOR',points:[[165.93,61.75],[165.46,56.38],[178.46,53.69],[183.86,57.03],[193.51,55.96],[200.98,54.93],[206.89,49.31]]},
  {name:'仙后座',en:'CASSIOPEIA',points:[[2.29,59.15],[10.13,56.54],[14.18,60.72],[21.45,60.24],[28.60,63.67]]},
  {name:'天蝎座',en:'SCORPIUS',points:[[240.08,-22.62],[247.35,-26.43],[252.54,-34.29],[253.50,-42.36],[264.33,-42.99],[265.62,-39.03],[263.40,-37.10]]},
  {name:'天鹅座',en:'CYGNUS',points:[[292.68,27.96],[296.24,45.13],[310.36,45.28],[305.56,40.26],[296.24,45.13],[292.43,51.73],[296.24,45.13],[305.56,40.26]]},
  {name:'狮子座',en:'LEO',points:[[152.09,11.97],[154.99,19.84],[154.17,23.42],[146.46,23.77],[140.53,26.18],[154.17,23.42],[168.56,20.52],[177.26,14.57],[152.09,11.97]]}
];

export const SCIENCE_LAYERS = [
  {id:'magnetic',name:'磁层与太阳风',en:'MAGNETOSPHERES',tag:'模型',group:'空间环境',description:'描绘行星磁场与太阳风相互作用的形态；可查询 NOAA 最近的太阳风观测。',body:'earth'},
  {id:'heliosphere',name:'日球层边界',en:'HELIOSPHERE',tag:'模型',group:'空间环境',description:'太阳风吹出的巨大泡泡。边界以压缩比例显示，实际距离随方向与环境变化。'},
  {id:'resonance',name:'轨道共振几何网',en:'ORBITAL RESONANCE',tag:'模型',group:'轨道动力学',description:'连接地球与金星在不同时刻的位置，观察轨道周期比织出的几何图形。'},
  {id:'roche',name:'洛希极限',en:'ROCHE LIMIT',tag:'模型',group:'轨道动力学',description:'比较土星与流体卫星的潮汐破碎距离。界限取决于双方密度与物体强度。',body:'saturn'},
  {id:'light',name:'光速等时圈',en:'LIGHT TRAVEL TIME',tag:'模型',group:'轨道动力学',description:'光从太阳出发，约 8.3 分钟到地球，约 4 小时到海王星。'},
  {id:'habitable',name:'霜线与宜居带',en:'HABITABLE ZONE',tag:'模型',group:'时间演化',description:'示意液态水可能稳定存在的距离带。宜居带并不保证行星具有生命。'},
  {id:'asteroids',name:'小行星带与特洛伊群',en:'ASTEROID BELT',tag:'示意',group:'小天体',description:'6,000 个生成的轨道粒子用于阅读主带和特洛伊群结构，并非真实小行星星历。'}
];

export const QUOTES = [
  ['万物的中央，坐着太阳。','哥白尼','1543'],
  ['如果说我看得更远，那是因为我站在巨人的肩上。','牛顿','1676'],
  ['哪里有物质，哪里就有几何。','开普勒','1596'],
  ['天文学迫使灵魂向上看，引导我们离开这个世界。','柏拉图','古希腊'],
  ['测量一切可以测量的，并使不可测量的变得可以测量。','伽利略','常见转述']
];

export const OCEAN_CURRENTS = [
  {id:'kuroshio',name:'黑潮',en:'KUROSHIO',warm:true,description:'北太平洋副热带环流西侧的暖流。沿台湾和日本附近向北流动，把热量从低纬度输送到更高纬度。',points:[[123,14],[123,22],[127,29],[137,34],[151,36],[166,37]]},
  {id:'gulf',name:'墨西哥湾暖流',en:'GULF STREAM',warm:true,description:'北大西洋西边界的强暖流。它沿北美东岸流动，随后向东北进入北大西洋。',points:[[-85,23],[-80,26],[-77,33],[-66,40],[-46,43],[-27,49]]},
  {id:'california',name:'加利福尼亚寒流',en:'CALIFORNIA CURRENT',warm:false,description:'沿北美西岸向南流动的东边界流，与沿岸上升流共同影响海洋生态。',points:[[-130,47],[-126,40],[-123,33],[-117,25],[-112,19]]},
  {id:'peru',name:'秘鲁寒流',en:'HUMBOLDT CURRENT',warm:false,description:'沿南美西岸向北流动，沿岸上升流为高生产力海域提供营养盐。',points:[[-77,-48],[-75,-35],[-77,-23],[-82,-12],[-88,-3]]},
  {id:'benguela',name:'本格拉寒流',en:'BENGUELA CURRENT',warm:false,description:'南大西洋东侧向北流动的寒流，非洲西南岸拥有显著的上升流系统。',points:[[17,-36],[12,-28],[10,-20],[7,-12]]},
  {id:'agulhas',name:'厄加勒斯洋流',en:'AGULHAS CURRENT',warm:true,description:'沿非洲东南岸向南输送温暖海水，一部分水通过涡旋进入大西洋。',points:[[43,-13],[37,-23],[31,-31],[23,-37],[16,-39]]},
  {id:'east-australia',name:'东澳大利亚洋流',en:'EAST AUSTRALIAN CURRENT',warm:true,description:'南太平洋西边界暖流，沿澳大利亚东岸向南流动并形成复杂涡旋。',points:[[153,-15],[156,-23],[155,-31],[159,-37],[171,-40]]},
  {id:'labrador',name:'拉布拉多寒流',en:'LABRADOR CURRENT',warm:false,description:'从北极附近沿加拿大东岸向南流动的冷水，在纽芬兰附近与暖水相遇。',points:[[-58,67],[-60,58],[-56,50],[-49,44]]},
  {id:'circumpolar',name:'南极绕极流',en:'ANTARCTIC CIRCUMPOLAR CURRENT',warm:false,description:'在南大洋从西向东绕南极洲流动，连接大西洋、印度洋与太平洋。',points:[[-175,-55],[-130,-54],[-85,-57],[-55,-57],[-10,-51],[35,-49],[80,-52],[125,-55],[175,-55]]},
  {id:'somali',name:'索马里洋流',en:'SOMALI CURRENT',warm:true,description:'受季风显著影响，流向具有季节反转特征；夏季风可驱动强烈上升流。',points:[[48,-2],[51,5],[54,11],[61,16]]},
  {id:'north-equatorial',name:'北赤道洋流',en:'NORTH EQUATORIAL CURRENT',warm:true,description:'信风驱动的大尺度向西流动，是副热带环流的一部分。',points:[[-110,13],[-135,14],[-165,15],[175,16],[150,16],[127,15]]},
  {id:'brazil',name:'巴西暖流',en:'BRAZIL CURRENT',warm:true,description:'沿巴西东岸向南流动的南大西洋西边界流。',points:[[-34,-9],[-38,-18],[-43,-26],[-49,-35]]}
];

export const SPECIES = [
  {id:'whale',name:'抹香鲸',en:'PHYSETER MACROCEPHALUS',depth:'表层至约 2,000 m',class:'哺乳纲 · 鲸偶蹄目',description:'大型齿鲸，能够深潜寻找乌贼等猎物。呼吸时返回海面，声学回声定位帮助它在黑暗中觅食。',icon:'♓',color:'#9caebc'},
  {id:'shark',name:'大白鲨',en:'CARCHARODON CARCHARIAS',depth:'沿岸与外海，多在上层水域',class:'软骨鱼纲 · 鼠鲨目',description:'大型掠食性鲨鱼，具有广泛的迁徙范围。分布与水温、猎物和生命阶段有关，地图位置仅作生态阅读。',icon:'◈',color:'#b7cbd1'},
  {id:'turtle',name:'绿海龟',en:'CHELONIA MYDAS',depth:'浅海与海草床',class:'爬行纲 · 龟鳖目',description:'成体主要取食海草与藻类。它们在觅食海域与产卵沙滩之间迁徙，维系近岸生态联系。',icon:'❈',color:'#92b6a0'},
  {id:'octopus',name:'北太平洋巨型章鱼',en:'ENTEROCTOPUS DOFLEINI',depth:'潮间带至约 1,500 m',class:'头足纲 · 八腕目',description:'生活在北太平洋冷水环境中的大型章鱼，利用伪装、灵敏触腕与学习能力寻找食物。',icon:'✳',color:'#d08d76'},
  {id:'angler',name:'深海鮟鱇',en:'CERATIOIDEI',depth:'约 200–2,000 m，依物种不同',class:'辐鳍鱼纲 · 鮟鱇目',description:'许多深海鮟鱇以发光器吸引猎物。深海食物稀少，不同物种演化出多样的生存策略。',icon:'✦',color:'#a9a0d1'},
  {id:'coral',name:'造礁珊瑚',en:'SCLERACTINIA',depth:'以温暖透光浅海为主',class:'珊瑚纲 · 石珊瑚目',description:'许多造礁珊瑚与光合藻类共生。珊瑚礁为大量海洋生物提供栖息地，也对温度变化十分敏感。',icon:'❋',color:'#e2a187'},
  {id:'jellyfish',name:'海月水母',en:'AURELIA AURITA',depth:'近岸表层水域',class:'钵水母纲 · 旗口水母目',description:'透明钟形身体随水流漂动，以触手捕捉小型浮游生物。其生活史包含水螅体与水母体阶段。',icon:'☂',color:'#c7bcdf'},
  {id:'amphipod',name:'深渊片脚类',en:'AMPHIPODA',depth:'部分种可到 10,000 m 以下',class:'软甲纲 · 端足目',description:'海沟食物网中的重要成员。部分物种适应高压、低温与间歇性的食物供应。',icon:'⋈',color:'#cbb7a0'}
];

export const DIVE_SITES = [
  ['大堡礁 · 鳕鱼洞','澳大利亚',145.67,-14.67,'中等'],['帕劳 · 蓝角','帕劳',134.22,7.13,'强流'],['加拉帕戈斯 · 达尔文岛','厄瓜多尔',-91.99,1.68,'极强流'],['科科斯岛','哥斯达黎加',-87.06,5.53,'强流'],['马尔代夫 · 玛雅提拉','马尔代夫',72.77,4.07,'中等'],['红海 · 穆罕默德角','埃及',34.25,27.74,'中等'],['西巴丹','马来西亚',118.63,4.11,'中等'],['斯米兰群岛','泰国',97.65,8.65,'中等'],['开曼 · 血腥湾墙','开曼群岛',-80.06,19.70,'弱流'],['图巴塔哈群礁','菲律宾',119.86,8.96,'强流'],['四王群岛','印度尼西亚',130.50,-0.55,'中等'],['蒙特雷 · 巨藻林','美国',-121.90,36.62,'中等'],['银湖裂谷','冰岛',-21.12,64.25,'弱流'],['阿利瓦尔浅滩','南非',30.84,-30.25,'强流']
].map(([name,country,lon,lat,current],i)=>({id:`dive-${i}`,name,country,lon,lat,current}));

export const WATER_LAYERS = [
  {name:'透光层',en:'EPIPELAGIC',min:0,max:200,temperature:'18–30 °C',light:'阳光充足 · 主要光合作用区',life:'浮游植物、珊瑚、金枪鱼与海龟',color:'#65d9de'},
  {name:'弱光层',en:'MESOPELAGIC',min:200,max:1000,temperature:'4–20 °C',light:'微弱蓝光 · 昼夜垂直迁徙',life:'灯笼鱼、乌贼、垂直迁徙者',color:'#4593ba'},
  {name:'半深海层',en:'BATHYPELAGIC',min:1000,max:4000,temperature:'2–4 °C',light:'无阳光 · 生物发光常见',life:'深海鮟鱇、深海虾、抹香鲸觅食',color:'#345483'},
  {name:'深海层',en:'ABYSSOPELAGIC',min:4000,max:6000,temperature:'1–2 °C',light:'无光 · 接近冰点的广阔水层',life:'海参、海蛇尾、热泉群落',color:'#263655'},
  {name:'超深渊层',en:'HADOPELAGIC',min:6000,max:11000,temperature:'1–4 °C',light:'无光 · 极高静水压力',life:'狮子鱼、片脚类与嗜压微生物',color:'#1a2239'}
];

export const LESSONS = [
  {title:'气压带',text:'赤道附近受热较强，空气上升；副热带下沉气流形成高压带。不同纬度的压差为行星风系提供动力。'},
  {title:'信风',text:'从副热带高压带吹向赤道的气流，在地球自转影响下偏转，形成东北信风与东南信风。风应力把动量传给海面。'},
  {title:'西风带',text:'中纬度盛行西风推动表层海水向东流动，与低纬度向西的流动一起，为海盆尺度环流建立基础。'},
  {title:'地转偏向力',text:'大尺度运动在北半球向右、南半球向左偏转。科里奥利效应与压力梯度、摩擦和边界共同塑造海水流动。'},
  {title:'闭合与西边界强化',text:'大陆阻挡海水继续前进，使环流沿海盆边缘转向。北半球副热带环流通常顺时针，西侧常形成更窄、更强的边界流。'}
];

export const TEXT = {
  zh:{atlas:'图谱',three:'三维',live:'实时',deep:'深空',flight:'模拟',globe:'地球',home:'回到主页',search:'搜索天体、任务…',science:'科学图层',layers:'图层',quality:'画质',more:'更多',title:'太阳系图谱',subtitle:'一份四维的太阳系 · 空间 · 时间 · 观测',intro:'从太阳的米粒组织到遥远的柯伊伯带。沿着行星轨道，重访人类的探测旅程；再回到这颗蓝色星球，走进洋流、深海与生命。',enter:'进入图谱',enterDeep:'直接看深空',missions:'探测任务',planets:'太阳与行星卫星',particles:'轨道粒子 · 示意',timespan:'航天时代 · 年',close:'关闭',details:'详情',back:'返回太阳系',learnEarth:'探索地球',observations:'观测',model:'模型',objects:'收录任务',replay:'回放这段时期',pause:'暂停回放',guide:'操作指南'},
  en:{atlas:'Atlas',three:'3D',live:'Live',deep:'Deep sky',flight:'Flight',globe:'Earth',home:'Back home',search:'Search worlds, missions…',science:'Science layers',layers:'Layers',quality:'Quality',more:'More',title:'Solar Atlas',subtitle:'A FOUR-DIMENSIONAL SOLAR SYSTEM · SPACE · TIME · OBSERVATION',intro:'From the surface of our star to the distant Kuiper belt. Follow planetary orbits and humanity’s journeys, then return to our blue world to explore ocean currents, the deep sea, and life.',enter:'Enter the atlas',enterDeep:'Explore deep sky',missions:'Missions',planets:'Worlds',particles:'Orbit particles · model',timespan:'Years of exploration',close:'Close',details:'Details',back:'Solar system',learnEarth:'Explore Earth',observations:'Observation',model:'Model',objects:'missions',replay:'Replay this era',pause:'Pause replay',guide:'Controls'}
};

export function planetById(id) { return id==='moon'?MOON:PLANETS.find(p=>p.id===id); }
export function formatNumber(value, digits=0) { return Number(value).toLocaleString('en-US',{maximumFractionDigits:digits}); }
export function orbitalPosition(planet, date = Date.now()) {
  if (!planet.a || !planet.period) return [0,0,0];
  const days=(date-EPOCH)/86400000;
  const M=((planet.anomaly+days*360/planet.period)%360)*DEG;
  let E=M;
  for(let i=0;i<8;i++) E-= (E-planet.e*Math.sin(E)-M)/(1-planet.e*Math.cos(E));
  const x=planet.a*(Math.cos(E)-planet.e), z=planet.a*Math.sqrt(1-planet.e**2)*Math.sin(E);
  const w=planet.perihelion*DEG,n=planet.node*DEG,i=planet.inclination*DEG;
  return [x*(Math.cos(n)*Math.cos(w)-Math.sin(n)*Math.sin(w)*Math.cos(i))-z*(Math.cos(n)*Math.sin(w)+Math.sin(n)*Math.cos(w)*Math.cos(i)),
    (x*Math.sin(w)+z*Math.cos(w))*Math.sin(i),
    x*(Math.sin(n)*Math.cos(w)+Math.cos(n)*Math.sin(w)*Math.cos(i))+z*(-Math.sin(n)*Math.sin(w)+Math.cos(n)*Math.cos(w)*Math.cos(i))];
}
