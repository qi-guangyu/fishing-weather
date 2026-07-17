/**
 * 天气数据与钓鱼评分核心模块
 * 从 fishing-weather-prototype.html 移植
 */
const { qweatherRequest } = require('./request')

// ==================== 城市坐标 ====================
const cityCoords = {
  '三亚': { lat: 18.25, lon: 109.51 },
  '上海': { lat: 31.23, lon: 121.47 },
  '东莞': { lat: 23.05, lon: 113.76 },
  '中山': { lat: 22.52, lon: 113.39 },
  '乌鲁木齐': { lat: 43.78, lon: 87.68 },
  '九江': { lat: 29.70, lon: 115.97 },
  '佛山': { lat: 23.02, lon: 113.12 },
  '保定': { lat: 38.87, lon: 115.47 },
  '兰州': { lat: 36.05, lon: 103.81 },
  '北京': { lat: 39.92, lon: 116.41 },
  '南京': { lat: 32.06, lon: 118.80 },
  '南宁': { lat: 22.82, lon: 108.37 },
  '南昌': { lat: 28.68, lon: 115.89 },
  '南通': { lat: 32.01, lon: 120.89 },
  '厦门': { lat: 24.47, lon: 118.08 },
  '台州': { lat: 28.65, lon: 121.42 },
  '合肥': { lat: 31.86, lon: 117.27 },
  '呼和浩特': { lat: 40.84, lon: 111.75 },
  '哈尔滨': { lat: 45.75, lon: 126.64 },
  '唐山': { lat: 39.63, lon: 118.20 },
  '嘉兴': { lat: 30.77, lon: 120.76 },
  '大连': { lat: 38.92, lon: 121.62 },
  '天津': { lat: 39.34, lon: 117.36 },
  '太原': { lat: 37.87, lon: 112.55 },
  '威海': { lat: 37.51, lon: 122.11 },
  '宁波': { lat: 29.87, lon: 121.56 },
  '安庆': { lat: 30.53, lon: 117.05 },
  '宜昌': { lat: 30.70, lon: 111.29 },
  '常州': { lat: 31.81, lon: 119.97 },
  '常熟': { lat: 31.64, lon: 120.75 },
  '广州': { lat: 23.13, lon: 113.26 },
  '徐州': { lat: 34.26, lon: 117.19 },
  '惠州': { lat: 23.11, lon: 114.42 },
  '成都': { lat: 30.57, lon: 104.07 },
  '扬州': { lat: 32.39, lon: 119.42 },
  '拉萨': { lat: 29.65, lon: 91.13 },
  '无锡': { lat: 31.49, lon: 120.31 },
  '日照': { lat: 35.41, lon: 119.48 },
  '昆明': { lat: 25.04, lon: 102.68 },
  '杭州': { lat: 30.27, lon: 120.16 },
  '柳州': { lat: 24.32, lon: 109.40 },
  '桂林': { lat: 25.28, lon: 110.29 },
  '武汉': { lat: 30.59, lon: 114.31 },
  '江门': { lat: 22.58, lon: 113.08 },
  '沈阳': { lat: 41.80, lon: 123.39 },
  '泰州': { lat: 32.46, lon: 119.92 },
  '洛阳': { lat: 34.62, lon: 112.43 },
  '济南': { lat: 36.65, lon: 117.00 },
  '海口': { lat: 20.02, lon: 110.29 },
  '淮安': { lat: 33.60, lon: 119.01 },
  '深圳': { lat: 22.54, lon: 114.06 },
  '温州': { lat: 28.01, lon: 120.65 },
  '湖州': { lat: 30.89, lon: 120.09 },
  '潍坊': { lat: 36.72, lon: 119.16 },
  '烟台': { lat: 37.46, lon: 121.40 },
  '珠海': { lat: 22.27, lon: 113.38 },
  '盐城': { lat: 33.35, lon: 120.15 },
  '石家庄': { lat: 38.04, lon: 114.47 },
  '福州': { lat: 26.07, lon: 119.30 },
  '秦皇岛': { lat: 39.93, lon: 119.59 },
  '绍兴': { lat: 30.03, lon: 120.58 },
  '芜湖': { lat: 31.35, lon: 118.37 },
  '苏州': { lat: 31.30, lon: 120.59 },
  '蚌埠': { lat: 32.94, lon: 117.36 },
  '襄阳': { lat: 32.00, lon: 112.13 },
  '西宁': { lat: 36.63, lon: 101.76 },
  '西安': { lat: 34.34, lon: 108.94 },
  '贵阳': { lat: 26.64, lon: 106.62 },
  '赣州': { lat: 25.83, lon: 114.93 },
  '连云港': { lat: 34.60, lon: 119.18 },
  '遵义': { lat: 27.70, lon: 106.91 },
  '郑州': { lat: 34.76, lon: 113.65 },
  '重庆': { lat: 29.43, lon: 106.91 },
  '金华': { lat: 29.12, lon: 119.64 },
  '银川': { lat: 38.47, lon: 106.27 },
  '镇江': { lat: 32.19, lon: 119.42 },
  '长春': { lat: 43.88, lon: 125.34 },
  '长沙': { lat: 28.23, lon: 112.94 },
  '青岛': { lat: 36.07, lon: 120.38 },
}

function getProvinceForCity(city) {
  const provinceMap = {
    '北京': '北京市', '天津': '天津市', '上海': '上海市', '重庆': '重庆市',
    '石家庄': '河北省', '唐山': '河北省', '秦皇岛': '河北省',
    '太原': '山西省', '呼和浩特': '内蒙古自治区',
    '沈阳': '辽宁省', '大连': '辽宁省', '长春': '吉林省', '哈尔滨': '黑龙江省',
    '南京': '江苏省', '无锡': '江苏省', '苏州': '江苏省', '常州': '江苏省',
    '南通': '江苏省', '常熟': '江苏省', '徐州': '江苏省', '扬州': '江苏省',
    '杭州': '浙江省', '宁波': '浙江省', '温州': '浙江省', '嘉兴': '浙江省',
    '合肥': '安徽省', '芜湖': '安徽省',
    '福州': '福建省', '厦门': '福建省', '泉州': '福建省',
    '南昌': '江西省',
    '济南': '山东省', '青岛': '山东省', '烟台': '山东省',
    '郑州': '河南省', '洛阳': '河南省',
    '武汉': '湖北省', '宜昌': '湖北省',
    '长沙': '湖南省', '株洲': '湖南省',
    '广州': '广东省', '深圳': '广东省', '东莞': '广东省', '佛山': '广东省', '珠海': '广东省',
    '南宁': '广西壮族自治区', '桂林': '广西壮族自治区',
    '海口': '海南省', '三亚': '海南省',
    '成都': '四川省', '绵阳': '四川省',
    '贵阳': '贵州省', '昆明': '云南省', '拉萨': '西藏自治区',
    '西安': '陕西省', '兰州': '甘肃省', '西宁': '青海省', '银川': '宁夏回族自治区',
    '乌鲁木齐': '新疆维吾尔自治区'
  }
  return provinceMap[city] || ''
}

// ==================== 钓鱼评分算法 ====================
function calcFishScore(p) {
  const safe = (v, def) => (v !== null && v !== undefined && !isNaN(Number(v))) ? Number(v) : def
  const pressure = safe(p.pressure, 1013)
  const temp = safe(p.temp, 25)
  const tempDiff = safe(p.tempDiff, 6)
  const wind = safe(p.windScale, 2)
  const precip = safe(p.precip, 0)
  const moon = safe(p.moon, 0.5)
  const hour = safe(p.hour, new Date().getHours())
  if (hour < 0 || hour > 23) return { score: 50, level: '一般', tag: 'normal' }

  // 1. 气压权重 40分
  let s1 = 0
  const diff = Math.abs(pressure - 1013)
  if (diff <= 3) s1 = 38 + (3 - diff) * 0.7
  else if (diff <= 8) s1 = 28 + (8 - diff) * 2
  else if (diff <= 15) s1 = 14 + (15 - diff) * 2
  else s1 = Math.max(0, 20 - (diff - 15) * 2)
  s1 = Math.min(40, Math.max(0, Math.round(s1)))

  // 2. 温度+温差权重 25分
  let s2 = 0
  if (temp >= 18 && temp <= 26) s2 = 15 + (tempDiff <= 8 ? 10 : 10 - (tempDiff - 8) * 1.2)
  else if (temp >= 12 && temp < 18) s2 = 10 + (tempDiff <= 8 ? 5 : 5 - (tempDiff - 8))
  else if (temp > 26 && temp <= 32) s2 = 10 + (tempDiff <= 8 ? 5 : 5 - (tempDiff - 8))
  else s2 = Math.max(0, 8 - Math.abs(temp - 22) * 0.3)
  s2 = Math.min(25, Math.max(0, Math.round(s2)))

  // 3. 风力权重 15分
  let s3 = 0
  if (wind <= 1) s3 = 8
  else if (wind <= 3) s3 = 15
  else if (wind <= 4) s3 = 12
  else if (wind <= 5) s3 = 8
  else if (wind <= 6) s3 = 5
  else s3 = Math.max(0, 8 - (wind - 6) * 2)
  s3 = Math.min(15, Math.max(0, Math.round(s3)))

  // 4. 降雨权重 10分
  let s4 = 0
  const moonFactor = moon > 0.4 && moon < 0.6 ? 1.0 : 0.7
  if (precip === 0) s4 = 10
  else if (precip <= 0.5) s4 = 8
  else if (precip <= 2) s4 = 6 - 2 * moonFactor
  else if (precip <= 5) s4 = 4 - 3 * moonFactor
  else if (precip <= 10) s4 = 2 - 3 * moonFactor
  else s4 = 0
  s4 = Math.min(10, Math.max(0, Math.round(s4)))

  // 5. 月相权重 10分
  let s5 = 0
  if (moon <= 0.15 || moon >= 0.85) s5 = 10
  else if (moon <= 0.25 || moon >= 0.75) s5 = 8
  else if (moon <= 0.4 || moon >= 0.6) s5 = 5
  else s5 = 3
  s5 = Math.min(10, Math.max(0, Math.round(s5)))

  let total = s1 + s2 + s3 + s4 + s5

  // 6. 时段修正
  const hourFactor = (hour >= 5 && hour <= 8) ? 0.12 :
    (hour >= 16 && hour <= 19) ? 0.10 :
      (hour >= 11 && hour <= 14) ? -0.08 :
        (hour >= 22 || hour <= 3) ? -0.06 : 0
  total = Math.round(total * (1 + hourFactor))

  const score = Math.max(0, Math.min(100, Math.round(total)))
  let level, tag
  if (score >= 80) { level = '绝佳爆口'; tag = 'excellent' }
  else if (score >= 60) { level = '良好'; tag = 'good' }
  else if (score >= 40) { level = '一般'; tag = 'normal' }
  else if (score >= 20) { level = '较差'; tag = 'poor' }
  else { level = '极差'; tag = 'terrible' }

  return { score, level, tag }
}

function getScoreTag(score) {
  if (score >= 80) return { tag: 'excellent', text: '爆口' }
  if (score >= 60) return { tag: 'good', text: '正常' }
  if (score >= 40) return { tag: 'poor', text: '慢口' }
  return { tag: 'bad', text: '停口' }
}

function getScoreLevel(score) {
  if (score >= 80) return { cls: 'excellent', text: '爆护' }
  if (score >= 65) return { cls: 'good', text: '有口' }
  if (score >= 45) return { cls: 'fair', text: '口差' }
  return { cls: 'poor', text: '空军' }
}

// ==================== 鱼种数据 ====================
const FISH_SPECIES_DATA = {
  taiwan: [
    { key: 'jiyu', name: '鲫鱼', icon: '🐟', temp: [15, 25] },
    { key: 'liyu', name: '鲤鱼', icon: '🐠', temp: [18, 28] },
    { key: 'caoyu', name: '草鱼', icon: '🐡', temp: [20, 30] },
    { key: 'qingyu', name: '青鱼', icon: '🦈', temp: [18, 28] }
  ],
  lure: [
    { key: 'qiaozui', name: '翘嘴', icon: '🐟', temp: [18, 28] },
    { key: 'luyu', name: '鲈鱼', icon: '🐠', temp: [16, 26] },
    { key: 'guiyu', name: '鳜鱼', icon: '🐡', temp: [15, 25] },
    { key: 'heiyu', name: '黑鱼', icon: '🦈', temp: [20, 30] }
  ],
  sea: [
    { key: 'daiyu', name: '带鱼', icon: '🐟', temp: [18, 26] },
    { key: 'diaoyu', name: '鲷鱼', icon: '🐠', temp: [16, 26] },
    { key: 'luyu2', name: '海鲈', icon: '🐡', temp: [15, 25] },
    { key: 'bayu', name: '鲅鱼', icon: '🦈', temp: [16, 24] }
  ]
}

// ==================== 天气图标映射 ====================
const weatherIcons = {
  '晴': '☀️', '多云': '⛅', '阴': '☁️', '小雨': '🌦️', '中雨': '🌧️',
  '大雨': '🌧️', '雷阵雨': '⛈️', '小雪': '🌨️', '中雪': '🌨️', '大雪': '❄️',
  '雾': '🌫️', '晴间多云': '🌤️', '阵雨': '🌦️', '雨夹雪': '🌨️'
}

function getWeatherIcon(weather) {
  return weatherIcons[weather] || '🌤️'
}

// ==================== 15天补足 ====================
function padForecastTo15Days(forecast) {
  if (!forecast || !forecast.length) return []
  const result = [...forecast]
  const weathers = ['晴', '多云', '阴', '小雨', '中雨', '大雨', '雷阵雨']
  const winds = ['东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风', '北风']
  const lastDate = new Date(result[result.length - 1].date || new Date())
  const lastDay = result[result.length - 1]
  while (result.length < 15) {
    const i = result.length
    const d = new Date(lastDate)
    d.setDate(d.getDate() + (i - forecast.length + 1))
    const baseMax = lastDay.temp_max || 28
    const baseMin = lastDay.temp_min || 22
    const weather = lastDay.weather_day || weathers[(i + 2) % weathers.length]
    const windScale = (lastDay.wind_scale_day || 2) + (Math.random() > 0.7 ? 1 : 0)
    const windDir = lastDay.wind_dir_day || winds[i % winds.length]
    result.push({
      date: d.toISOString().split('T')[0],
      weather_day: weather,
      weather_night: weather,
      temp_max: Math.round(baseMax + (Math.random() - 0.5) * 4),
      temp_min: Math.round(baseMin + (Math.random() - 0.5) * 3),
      wind_scale_day: Math.max(1, Math.min(6, windScale)),
      wind_dir_day: windDir,
      uv_index: 3
    })
  }
  return result.slice(0, 15)
}

function getDayLabel(i, date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d - today) / 86400000)
  const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  if (diff === -1) return '昨天'
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  return weekNames[d.getDay()]
}

function getComfortTag(tempMax, humidity) {
  const hum = humidity || 65
  if (tempMax >= 35 || (tempMax >= 32 && hum >= 70)) return { text: '闷热', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
  if (tempMax >= 32) return { text: '热', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
  if (tempMax <= 18) return { text: '凉', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' }
  if (tempMax <= 12) return { text: '冷', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' }
  return { text: '舒适', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
}

// ==================== 生成每日24小时模拟数据 ====================
function generateDayHourly(dayData) {
  const maxT = dayData.temp_max || 25
  const minT = dayData.temp_min || 18
  const weather = dayData.weather_day || '多云'
  const windDir = dayData.wind_dir_day || '东南风'
  const windScale = dayData.wind_scale_day || 2
  const pressure = 1000 + Math.round(Math.random() * 25)
  const hours = []
  for (let h = 0; h < 24; h++) {
    const t = minT + (maxT - minT) * Math.max(0, Math.sin((h - 4) / 12 * Math.PI))
    const temp = Math.round(t * 10) / 10
    const hWeather = (h >= 0 && h <= 5) ? dayData.weather_night || weather : weather
    hours.push({
      hour: h,
      time: String(h).padStart(2, '0') + ':00',
      weather: hWeather,
      temperature: temp,
      pressure: Math.round(pressure + Math.sin(h / 12 * Math.PI) * 3),
      wind_dir: windDir,
      wind_scale: Math.max(1, windScale + Math.round((Math.random() - 0.5) * 1)),
      waterTemp: Math.round(temp * 0.85 * 10) / 10,
      oxygen: Math.round((4 + Math.random() * 3) * 10) / 10
    })
  }
  return hours
}

// ==================== 逐小时鱼情评分 ====================
function calcHourlyFishScore(h, species, mode) {
  let score = 60
  const [tMin, tMax] = species.temp
  if (h.temperature >= tMin && h.temperature <= tMax) score += 12
  else if (h.temperature >= tMin - 3 && h.temperature <= tMax + 3) score += 5
  else score -= 8
  if (h.pressure >= 1008 && h.pressure <= 1018) score += 10
  else if (h.pressure >= 1005 && h.pressure < 1008) score += 5
  else score -= 5
  if (h.wind_scale <= 2) score += 8
  else if (h.wind_scale <= 3) score += 4
  else if (h.wind_scale <= 4) score -= 3
  else score -= 10
  if (h.weather === '中雨' || h.weather === '大雨' || h.weather === '雷阵雨') score -= 12
  else if (h.weather === '小雨') score -= 5
  else if (/雨|雪/.test(h.weather)) score -= 3
  else score += 4
  if (h.hour >= 5 && h.hour <= 8) score += 8
  else if (h.hour >= 17 && h.hour <= 20) score += 6
  else if (h.hour >= 11 && h.hour <= 15) score -= 3
  else if (h.hour >= 0 && h.hour <= 4) score -= 5
  if (mode === 'lure' && (h.hour >= 5 && h.hour <= 8 || h.hour >= 17 && h.hour <= 20)) score += 3
  if (mode === 'sea' && (h.hour >= 6 && h.hour <= 9 || h.hour >= 16 && h.hour <= 19)) score += 3
  return Math.max(0, Math.min(100, score))
}

// ==================== AI垂钓建议 ====================
function getAIAdvice(data, score) {
  var p = data.pressure || 1013
  var w = parseInt(data.wind_power) || 2
  var isRain = (data.weather || '').includes('雨')
  var isWindy = w >= 4
  if (score >= 80) {
    return {
      title: '🔥 绝佳爆口 · 精细连杆思路',
      approach: '🎯 调低钓低(调3钓2)，高频雾化拉饵诱鱼，节奏30秒一竿。多窝轮钓浅滩1.2-1.8m。' + (isRain ? '雨天溶氧高可放慢守大物。' : '') + (isWindy ? '轻风选下风口。' : ''),
      tackle: '🔧 主线1.0-1.2#+子线0.6-0.8#，袖4-5号，吃铅1.2g枣核漂调3钓2。腥香拉饵+10%轻麸，快抽20竿做窝见口抓死口。',
      spot: '📍 早5-9点/晚16-19点窗口期。浅滩水草区边缘或铧尖，水深1.2-2m。气压' + p + 'hPa适宜，可钓灵。'
    }
  } else if (score >= 60) {
    return {
      title: '✅ 良好鱼情 · 融合思路',
      approach: '🎯 早晚精细抓口(调4钓2拉饵)，正午搓饵钓钝守大鱼。' + ((data.temperature || 25) > 28 ? '午后升温鱼上浮改钓浮。' : '温差大鱼层不稳，早上浅中午深。'),
      tackle: '🔧 主线1.2-1.5#+子线0.8-1.0#，海夕5号。早晚拉饵调4钓2，正午搓饵调5钓3。饵料腥香+酒米留窝。',
      spot: '📍 早5-8点浅滩草边1.5m，晚17-19点铧尖2-2.5m，正午深水树荫。气压' + p + 'hPa。'
    }
  } else if (score >= 40) {
    return {
      title: '⚠️ 一般鱼情 · 稳守思路',
      approach: '🎯 钓钝(调平水钓2-3目)，搓大饵守钓减频率避惊鱼。深水重窝。' + (isWindy ? '选背风湾子钓3-4m。' : '静水深水耐心守。'),
      tackle: '🔧 主线1.5-2.0#+子线1.0-1.2#，伊势尼4-6号，吃铅2.5-3g长脚漂调平水钓2-3目。',
      spot: '📍 深水区2.5-4m，铧尖/大回湾/陡坡下。窗口早6-8点/晚17-18点。气压' + p + 'hPa偏低。'
    }
  } else {
    return {
      title: '🐢 鱼情较差 · 保守方案',
      approach: '🎯 死守深水3-5m，谷物大饵(鲜玉米+麦粒)，10-15分钟一竿少惊鱼。' + (isRain ? '雨天溶氧短暂提升可浅处试钓。' : '多打2-3窝轮换人找鱼。'),
      tackle: '🔧 主线2.0-2.5#+子线1.2-1.5#，伊势尼6-8号，吃铅3-4g大漂调1钓3-4极钝。',
      spot: '📍 主钓10-15点水温最高时段。最深最静区域3-5m回湾/坝前深潭。气压' + p + 'hPa偏低温差大。'
    }
  }
}

// ==================== 获取天气数据 ====================
async function fetchWeather(city) {
  const coord = cityCoords[city]
  if (!coord) return getMockWeather(city)
  try {
    const loc = coord.lon + ',' + coord.lat
    const nowData = await qweatherRequest('/v7/weather/now', { location: loc })
    if (nowData.code !== '200') throw new Error('now:' + nowData.code)
    const now = nowData.now
    const hrData = await qweatherRequest('/v7/weather/24h', { location: loc })
    const hourly = hrData.hourly || []
    const dData = await qweatherRequest('/v7/weather/7d', { location: loc })
    const daily = dData.daily || []
    return {
      province: getProvinceForCity(city) || '',
      city: city,
      weather: now.text,
      temperature: parseInt(now.temp),
      humidity: parseInt(now.humidity),
      pressure: parseInt(now.pressure),
      wind_direction: now.windDir,
      wind_power: now.windScale + '级',
      precipitation: parseFloat(now.precip || '0'),
      uv: daily.length ? parseInt(daily[0].uvIndex) : 3,
      report_time: now.obsTime,
      hourly_forecast: hourly.map(function (h) {
        return {
          time: h.fxTime, weather: h.text, temperature: parseInt(h.temp),
          pressure: parseInt(h.pressure || '1013'), wind_scale: parseInt(h.windScale) || 1,
          wind_dir: h.windDir || '', uv_index: 3
        }
      }),
      forecast: daily.map(function (dd) {
        return {
          date: dd.fxDate, weather_day: dd.textDay, weather_night: dd.textNight,
          temp_max: parseInt(dd.tempMax), temp_min: parseInt(dd.tempMin),
          wind_scale_day: parseInt(dd.windScaleDay) || 2,
          wind_dir_day: dd.windDirDay || '',
          uv_index: parseInt(dd.uvIndex || '3')
        }
      }),
      _isReal: true, _fromServer: false, life_indices: {}
    }
  } catch (e) {
    console.warn('[天气] API失败:', e)
    return getMockWeather(city)
  }
}

// ==================== 模拟天气数据 ====================
function getMockWeather(city) {
  const now = new Date()
  const hour = now.getHours()
  const cityData = {
    '北京': { temp: 21, weather: '雾', wind: '北风 2级', humidity: 94, pressure: 1013 },
    '上海': { temp: 25, weather: '多云', wind: '东风 3级', humidity: 78, pressure: 1015 },
    '广州': { temp: 28, weather: '晴', wind: '南风 2级', humidity: 65, pressure: 1012 },
    '深圳': { temp: 29, weather: '晴', wind: '东南风 2级', humidity: 70, pressure: 1011 },
    '成都': { temp: 22, weather: '阴', wind: '西风 1级', humidity: 85, pressure: 1009 },
    '苏州': { temp: 24, weather: '多云', wind: '东南风 2级', humidity: 72, pressure: 1014 },
    '常熟': { temp: 24, weather: '多云', wind: '东南风 2级', humidity: 73, pressure: 1014 },
  }
  const data = cityData[city] || cityData['北京']
  const baseTemp = data.temp
  const hourly = []
  for (let i = 0; i < 24; i++) {
    const h = (hour + i) % 24
    const temp = baseTemp + Math.round(Math.sin(i / 6) * 3)
    hourly.push({ hour: h, temp: temp, weather: i < 6 ? data.weather : (temp > 26 ? '晴' : '多云'), wind: data.wind })
  }
  const forecast = []
  const weathers = ['晴', '多云', '阴', '小雨', '中雨']
  const winds = ['东北风', '东风', '东南风', '南风', '西南风', '西风', '北风']
  for (let i = 0; i < 15; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    forecast.push({
      date: d.toISOString().split('T')[0],
      day: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()],
      weather: weathers[(i + 2) % weathers.length],
      temp_max: baseTemp + Math.round(Math.random() * 5),
      temp_min: baseTemp - Math.round(Math.random() * 5 + 3),
      wind_scale_day: 1 + Math.round(Math.random() * 3),
      wind_dir_day: winds[i % winds.length]
    })
  }
  return {
    province: getProvinceForCity(city) || '',
    city: city,
    weather: data.weather,
    temperature: baseTemp,
    wind_direction: data.wind.split(' ')[0],
    wind_power: data.wind.split(' ')[1],
    humidity: data.humidity,
    pressure: data.pressure,
    precipitation: 0,
    uv: 3,
    report_time: new Date().toLocaleString('zh-CN'),
    hourly_forecast: hourly.map(h => ({
      time: new Date().toISOString().slice(0, 10) + 'T' + String(h.hour).padStart(2, '0') + ':00',
      weather: h.weather, temperature: h.temp,
      pressure: data.pressure + Math.round((Math.random() - 0.5) * 4),
      wind_scale: 2, uv_index: 3
    })),
    forecast: forecast.map(f => ({
      date: f.date, weather_day: f.weather, weather_night: f.weather,
      temp_max: f.temp_max, temp_min: f.temp_min,
      wind_scale_day: 2, wind_dir_day: f.wind_dir_day, uv_index: 3
    })),
    _isMock: true, life_indices: {}
  }
}

module.exports = {
  cityCoords,
  getProvinceForCity,
  calcFishScore,
  getScoreTag,
  getScoreLevel,
  getWeatherIcon,
  weatherIcons,
  FISH_SPECIES_DATA,
  padForecastTo15Days,
  getDayLabel,
  getComfortTag,
  generateDayHourly,
  calcHourlyFishScore,
  getAIAdvice,
  fetchWeather,
  getMockWeather
}
