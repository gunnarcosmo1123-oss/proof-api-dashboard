'use strict';
/* ============================================================
   构建脚本:ne110m.geojson(Natural Earth 110m,公共领域)
   → js/map-data.js(嵌入式 SVG 路径,「行动地图」页签用)
   用法: node build/build-map.js [输入 geojson 路径]
        默认读取 build/ne110m.geojson(下载自
        https://github.com/nvkelso/natural-earth-vector/geojson/)

   与 ClimateOS 同源管线:GeoJSON 每国坐标自包含、结构上不可能
   交叉引用;路径经 Douglas-Peucker 简化(tol=0.05°,110m 数据
   顶点本就稀疏,大容差会吃掉海岸线;地图为背景层,精度需求低)
   + y 轴取负保证 SVG 北在上。
   跳过南极洲与法属南半球领地以压缩体积并收紧视野。
   110m 相比 50m 显著缩小首屏体积(手机扫码演示加载更快),
   对演示受众无可见精度损失。
   ============================================================ */
const fs = require('fs');
const path = require('path');

const INPUT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'ne110m.geojson');
const gj = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

/* ---- 中文名(与 ClimateOS 同表) ---- */
const ZH = {
  'China':'中国','United States of America':'美国','India':'印度','Brazil':'巴西','Russia':'俄罗斯',
  'Canada':'加拿大','Australia':'澳大利亚','Japan':'日本','South Korea':'韩国','Germany':'德国',
  'France':'法国','United Kingdom':'英国','Italy':'意大利','Spain':'西班牙','Netherlands':'荷兰',
  'Poland':'波兰','Sweden':'瑞典','Norway':'挪威','Finland':'芬兰','Denmark':'丹麦','Portugal':'葡萄牙',
  'Greece':'希腊','Ireland':'爱尔兰','Ukraine':'乌克兰','Turkey':'土耳其','Saudi Arabia':'沙特阿拉伯',
  'Iran':'伊朗','Iraq':'伊拉克','Egypt':'埃及','South Africa':'南非','Nigeria':'尼日利亚','Ethiopia':'埃塞俄比亚',
  'Kenya':'肯尼亚','Tanzania':'坦桑尼亚','Dem. Rep. Congo':'刚果(金)','Madagascar':'马达加斯加',
  'Mozambique':'莫桑比克','Zimbabwe':'津巴布韦','Sudan':'苏丹','S. Sudan':'南苏丹','Algeria':'阿尔及利亚','Morocco':'摩洛哥',
  'Indonesia':'印度尼西亚','Philippines':'菲律宾','Vietnam':'越南','Thailand':'泰国','Myanmar':'缅甸',
  'Malaysia':'马来西亚','Bangladesh':'孟加拉国','Pakistan':'巴基斯坦','Kazakhstan':'哈萨克斯坦',
  'Mongolia':'蒙古','Uzbekistan':'乌兹别克斯坦','Mexico':'墨西哥','Argentina':'阿根廷','Chile':'智利',
  'Peru':'秘鲁','Colombia':'哥伦比亚','Venezuela':'委内瑞拉','New Zealand':'新西兰','Papua New Guinea':'巴布亚新几内亚',
  'Iceland':'冰岛','Greenland':'格陵兰','United Arab Emirates':'阿联酋','Haiti':'海地','Sri Lanka':'斯里兰卡',
  'Nepal':'尼泊尔','Afghanistan':'阿富汗','Cuba':'古巴','Bolivia':'玻利维亚','Ecuador':'厄瓜多尔',
  'Paraguay':'巴拉圭','Uruguay':'乌拉圭','Switzerland':'瑞士','Austria':'奥地利','Belgium':'比利时',
  'Czechia':'捷克','Hungary':'匈牙利','Romania':'罗马尼亚','Bulgaria':'保加利亚','Slovakia':'斯洛伐克',
  'Belarus':'白俄罗斯','Israel':'以色列','Jordan':'约旦','Syria':'叙利亚','Lebanon':'黎巴嫩',
  'Libya':'利比亚','Tunisia':'突尼斯','Mali':'马里','Niger':'尼日尔','Chad':'乍得','Somalia':'索马里',
  'Uganda':'乌干达','Cameroon':'喀麦隆','Ghana':'加纳','Côte d\'Ivoire':'科特迪瓦','Senegal':'塞内加尔',
  'Angola':'安哥拉','Zambia':'赞比亚','Malawi':'马拉维','Botswana':'博茨瓦纳','Namibia':'纳米比亚',
  'Laos':'老挝','Cambodia':'柬埔寨','Taiwan':'中国台湾','Costa Rica':'哥斯达黎加','Panama':'巴拿马',
  'Guatemala':'危地马拉','Honduras':'洪都拉斯','Nicaragua':'尼加拉瓜','El Salvador':'萨尔瓦多',
  'Dominican Rep.':'多米尼加','Jamaica':'牙买加','Trinidad and Tobago':'特立尼达和多巴哥',
  'Antarctica':'南极洲','Falkland Is.':'福克兰群岛','Somaliland':'索马里兰','W. Sahara':'西撒哈拉',
  'North Korea':'朝鲜','South Sudan':'南苏丹','Timor-Leste':'东帝汶','Bhutan':'不丹','Brunei':'文莱',
  'Solomon Is.':'所罗门群岛','Vanuatu':'瓦努阿图','Fiji':'斐济','New Caledonia':'新喀里多尼亚',
  'Puerto Rico':'波多黎各','Bosnia and Herz.':'波黑','Croatia':'克罗地亚','Serbia':'塞尔维亚',
  'Slovenia':'斯洛文尼亚','North Macedonia':'北马其顿','Albania':'阿尔巴尼亚','Montenegro':'黑山',
  'Kosovo':'科索沃','Georgia':'格鲁吉亚','Armenia':'亚美尼亚','Azerbaijan':'阿塞拜疆',
  'Kyrgyzstan':'吉尔吉斯斯坦','Tajikistan':'塔吉克斯坦','Turkmenistan':'土库曼斯坦',
  'Oman':'阿曼','Yemen':'也门','Qatar':'卡塔尔','Kuwait':'科威特','Bahrain':'巴林',
  'Eritrea':'厄立特里亚','Djibouti':'吉布提','Rwanda':'卢旺达','Burundi':'布隆迪',
  'Eq. Guinea':'赤道几内亚','Gabon':'加蓬','Congo':'刚果(布)','Central African Rep.':'中非',
  'Benin':'贝宁','Togo':'多哥','Burkina Faso':'布基纳法索','Guinea':'几内亚','Sierra Leone':'塞拉利昂',
  'Liberia':'利比里亚','Mauritania':'毛里塔尼亚','Gambia':'冈比亚','Guinea-Bissau':'几内亚比绍',
  'Estonia':'爱沙尼亚','Latvia':'拉脱维亚','Lithuania':'立陶宛','Moldova':'摩尔多瓦',
  'The Bahamas':'巴哈马','Belize':'伯利兹','Suriname':'苏里南','Guyana':'圭亚那',
  'eSwatini':'斯威士兰','Lesotho':'莱索托','Cyprus':'塞浦路斯','Maldives':'马尔代夫'
};

const SKIP = { 'Antarctica': 1, 'Fr. S. Antarctic Lands': 1 };

/* ---- Douglas-Peucker 简化 ---- */
function distToSeg(p, a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if(len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function simplify(pts, tol){
  if(pts.length < 4) return pts;
  const tol2 = tol * tol;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while(stack.length){
    const [a, b] = stack.pop();
    let maxD = 0, maxI = -1;
    for(let i = a + 1; i < b; i++){
      const d = distToSeg(pts[i], pts[a], pts[b]);
      if(d > maxD){ maxD = d; maxI = i; }
    }
    if(maxD > tol2){ keep[maxI] = true; stack.push([a, maxI], [maxI, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/* 环 → 路径段(lon→x, -lat→y,北在上) */
function ringToPath(ring){
  const s = simplify(ring, 0.05);
  let d = 'M';
  for(let i = 0; i < s.length; i++){
    d += (i ? 'L' : '') + (+s[i][0]).toFixed(1) + ' ' + (+(-s[i][1])).toFixed(1);
  }
  return d + 'Z';
}
function geomToPath(g){
  let d = '';
  if(g.type === 'Polygon'){ g.coordinates.forEach(r => { d += ringToPath(r); }); }
  else if(g.type === 'MultiPolygon'){ g.coordinates.forEach(poly => poly.forEach(r => { d += ringToPath(r); })); }
  return d;
}

const countries = [];
gj.features.forEach(f => {
  const name = f.properties.NAME;
  if(SKIP[name]) return;
  const rec = { name, d: geomToPath(f.geometry) };
  if(ZH[name]) rec.zh = ZH[name];
  countries.push(rec);
});
/* 大面积先绘制(在下层),小面积后绘制(便于点击) */
countries.sort((a, b) => b.d.length - a.d.length);

const out = '/* 由 build/build-map.js 自动生成,数据源:Natural Earth 110m(公共领域),勿手改 */\n'
  + 'const MAP_DATA = ' + JSON.stringify({ countries }) + ';\n';

fs.writeFileSync(path.join(__dirname, '..', 'js', 'map-data.js'), out);
console.log('OK: js/map-data.js', (out.length / 1024).toFixed(1) + ' KB,', countries.length, 'countries');
