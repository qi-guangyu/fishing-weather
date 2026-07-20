const weather = require('../../utils/weather')
const { fetchWeather, calcFishScore, getScoreTag, getAIAdvice } = weather
const { isLoggedIn } = require('../../utils/auth')

Page({
  data: {
    // 城市
    currentCity: '常熟',
    cityDisplayName: '定位中...',
    // 评分
    score: 0,
    scoreLevel: '',
    scoreTag: 'normal',
    bestTime: '--:-- / --:--',
    dataSource: '',
    // 实时天气
    weather: {},
    weatherGrid: [],
    // 逐时预报
    hourlyList: [],
    // 15天预报
    forecast15: [],
    // AI建议
    aiAdvice: null,
    // 状态
    loading: true,
    isLoggedIn: false,
    // 城市选择
    showCityPicker: false,
    citySearchKey: '',
    // 优化后的选择器数据
    cityGroups: [],        // 按省份分组（浏览态）
    searchResults: [],     // 搜索态扁平结果
    searching: false,      // 是否处于搜索态
    recentCities: [],      // 最近选择（存储）
    currentCityName: ''    // 当前城市（用于高亮）
  },

  onLoad() {
    const app = getApp()
    try {
      this.setData({ currentCity: app && app.globalData ? app.globalData.currentCity : '常熟', loading: false })
    } catch (e) {
      console.error('[首页] onLoad 初始 setData 失败:', e)
    }
    // 异步加载数据（不再 await，避免任何错误阻塞渲染）
    this.loadWeatherData()
    try {
      this.setData({ isLoggedIn: isLoggedIn() })
    } catch (e) { /* auth 失败不影响主流程 */ }
  },

  onShow() {
    const app = getApp()
    if (app && app.globalData && app.globalData.currentCity !== this.data.currentCity) {
      this.setData({ currentCity: app.globalData.currentCity })
      this.loadWeatherData()
    }
    this.setData({ isLoggedIn: isLoggedIn() })
  },

  onPullDownRefresh() {
    this.loadWeatherData(true)
  },

  // ==================== 加载天气数据 ====================
  async loadWeatherData(forceRefresh) {
    const city = this.data.currentCity

    // 真机首屏兜底：callContainer 可能在真机挂起，先渲染一份本地数据，
    // 保证页面立刻有内容（loading 不阻塞内容），异步拿到真实数据再覆盖。
    if (!this.data.weather || !this.data.weather.city) {
      try {
        const mock = weather.getMockWeather(city)
        this.processWeatherData(mock)
      } catch (e) {
        console.error('[首页] mock 兜底渲染失败:', e && e.message ? e.message : e, e && e.stack ? '\n' + e.stack : '')
        // 兜底失败也强制显示内容（不让 WXML 永远等数据）
        this.setData({ loading: false, weather: { temperature: '--', weather: '暂无数据' }, score: 0, scoreLevel: '无', bestTime: '--:--', dataSource: '数据加载失败' })
      }
    }

    // 检查缓存（30分钟）
    const cacheKey = 'weather_cache_' + city
    if (!forceRefresh) {
      const cached = wx.getStorageSync(cacheKey)
      if (cached && Date.now() - cached.ts < 30 * 60 * 1000) {
        this.processWeatherData(cached.data)
        wx.stopPullDownRefresh()
        return
      }
    }

    try {
      const data = await fetchWeather(city)
      if (!data._isMock) {
        wx.setStorageSync(cacheKey, { ts: Date.now(), data })
      }
      this.processWeatherData(data)
    } catch (e) {
      console.error('[天气] 加载失败:', e)
      // 虽加载失败，但 mock 兜底数据已渲染，取消 loading 让内容显示
      this.setData({ loading: false })
      wx.showToast({ title: '获取天气数据失败', icon: 'none' })
    }
    wx.stopPullDownRefresh()
  },

  // ==================== 处理天气数据 ====================
  processWeatherData(data) {
    this.setData({ weatherData: data, loading: false })

    // 城市显示
    this.setData({
      cityDisplayName: (data.province ? data.province + '·' : '') + data.city
    })

    // 逐时预报处理
    const hourlyWithScore = (data.hourly_forecast || []).map(h => {
      let hour = -1
      try { hour = new Date(h.time).getHours() } catch (e) { }
      if (isNaN(hour) || hour < 0) hour = new Date().getHours()
      const score = calcFishScore({
        pressure: h.pressure, temp: h.temperature, tempDiff: 6,
        windScale: parseInt(h.wind_scale) || 2, precip: 0,
        moon: 0.45, hour
      }).score
      const st = getScoreTag(score)
      const wt = Math.round((h.temperature || 25) * 0.85 * 10) / 10
      const o2 = Math.round((4 + Math.random() * 3) * 10) / 10
      return {
        ...h, hour, score, tagClass: st.tag, tagText: st.text,
        waterTemp: wt, oxygen: o2,
        icon: weather.getWeatherIcon(h.weather || h.text),
        timeLabel: hour === new Date().getHours() ? '现在' : String(hour).padStart(2, '0') + ':00',
        isNow: hour === new Date().getHours()
      }
    })

    // 综合鱼口评分
    const tempDiff = data.forecast && data.forecast[0]
      ? data.forecast[0].temp_max - data.forecast[0].temp_min : 6
    const result = calcFishScore({
      pressure: data.pressure,
      temp: data.temperature,
      tempDiff: tempDiff,
      windScale: parseInt(data.wind_power) || 2,
      precip: data.precipitation,
      moon: 0.45,
      hour: new Date().getHours()
    })

    // 最佳时段
    let bestTime = '--:-- / --:--'
    if (hourlyWithScore.length) {
      const morning = hourlyWithScore.filter(h => h.hour >= 5 && h.hour <= 11)
        .sort((a, b) => b.score - a.score)
      const bestM = morning.length > 0 ? morning[0].hour : 6
      const afternoon = hourlyWithScore.filter(h => h.hour >= 14 && h.hour <= 20)
        .sort((a, b) => b.score - a.score)
      const bestA = afternoon.length > 0 ? afternoon[0].hour : 17
      bestTime = String(bestM).padStart(2, '0') + ':00-' + String(bestM + 2).padStart(2, '0') + ':00'
        + ' / ' + String(bestA).padStart(2, '0') + ':00-' + String(bestA + 2).padStart(2, '0') + ':00'
    }

    // 数据来源标记
    let dataSource = ''
    if (data._isReal) {
      dataSource = '✅ 和风天气·真实数据'
    } else if (data._isMock) {
      dataSource = '⚠️ 模拟数据（API不可用）'
    }

    // 天气网格
    const weatherGrid = [
      { icon: '🌡️', label: '实时气温', value: (data.temperature != null ? data.temperature + '℃' : '--') },
      { icon: '💧', label: '湿度', value: (data.humidity != null ? data.humidity + '%' : '--') },
      { icon: '🌬️', label: '风向风力', value: (data.wind_direction || '--') + ' ' + (data.wind_power || '') },
      { icon: '🌧️', label: '降雨量', value: (data.precipitation != null ? data.precipitation + 'mm' : '0.0mm') },
      { icon: '☀️', label: '紫外线', value: data.uv != null ? (data.uv > 5 ? '强' : data.uv > 2 ? '中等' : '弱') : '--' },
      { icon: '🔽', label: '实时气压', value: (data.pressure || '--') + 'hPa', highlight: true }
    ]

    // 15天预报
    const forecast15 = weather.padForecastTo15Days(data.forecast || [])
    const forecastCards = forecast15.map((d, i) => {
      const avgTemp = (d.temp_max + d.temp_min) / 2
      const score = calcFishScore({
        pressure: null, temp: avgTemp, tempDiff: d.temp_max - d.temp_min,
        windScale: parseInt(d.wind_scale_day) || 2, precip: 0,
        moon: 0.45, hour: 7
      }).score
      const st = getScoreTag(score)
      const sc = score >= 80 ? '#16a34a' : score >= 60 ? '#2563eb' : score >= 40 ? '#d97706' : '#dc2626'
      const comfort = weather.getComfortTag(d.temp_max, null)
      return {
        ...d,
        dayLabel: weather.getDayLabel(i, d.date),
        dateStr: d.date ? d.date.slice(5).replace('-', '/') : 'N/A',
        icon: weather.getWeatherIcon(d.weather_day),
        score, scoreColor: sc,
        comfortText: comfort.text,
        comfortColor: comfort.color,
        comfortBg: comfort.bg,
        isActive: i === 1
      }
    })

    // AI建议
    const aiAdvice = getAIAdvice(data, result.score)

    this.setData({
      score: result.score,
      scoreLevel: result.level,
      scoreTag: result.tag,
      bestTime,
      dataSource,
      weather: data,
      weatherGrid,
      hourlyList: hourlyWithScore,
      forecast15: forecastCards,
      aiAdvice
    })
  },

  // 钓鱼指数模块（钓法/鱼种/日期切换 + 24h鱼情表）已迁移至 pages/fish-index

  // ==================== 城市选择（优化：分组 + 拼音搜索 + 最近选择） ====================
  showCityPicker() {
    const recent = (wx.getStorageSync('recent_cities') || []).filter(c => c !== this.data.currentCity)
    this.setData({
      showCityPicker: true,
      searching: false,
      citySearchKey: '',
      cityGroups: weather.getCitiesGrouped(),
      recentCities: recent,
      currentCityName: this.data.currentCity
    })
  },

  hideCityPicker() {
    this.setData({ showCityPicker: false, citySearchKey: '', searching: false })
  },

  // 仅用于阻止弹窗内部点击冒泡到遮罩（避免点击搜索框/列表误触发关闭）
  noop() {},

  onCitySearch(e) {
    const key = e.detail.value
    if (!key || !key.trim()) {
      this.setData({ citySearchKey: '', searching: false })
      return
    }
    const results = weather.searchCities(key)
    this.setData({ citySearchKey: key, searching: true, searchResults: results })
  },

  selectCity(e) {
    const app = getApp()
    const city = e.currentTarget.dataset.city
    if (!city) return
    // 已是当前城市：仅提示，不刷新、不改变搜索框状态
    if (city === this.data.currentCity) {
      wx.showToast({ title: '当前已在 ' + city, icon: 'none' })
      return
    }
    // 写入最近选择（去重、置顶、最多 6 个）
    let recent = wx.getStorageSync('recent_cities') || []
    recent = [city, ...recent.filter(c => c !== city)].slice(0, 6)
    wx.setStorageSync('recent_cities', recent)
    // 关键修复：选择城市后【不关闭弹窗、不清空搜索框、不改变 searching 状态】，
    // 搜索框内容与状态完全保持不变，仅后台切换城市并刷新天气。
    this.setData({
      currentCity: city,
      currentCityName: city,
      recentCities: recent.filter(c => c !== city)
    })
    app.globalData.currentCity = city
    wx.setStorageSync('currentCity', city)
    this.loadWeatherData(true)
    wx.showToast({ title: '已切换到 ' + city, icon: 'success' })
  },

  // ==================== 刷新 ====================
  refreshData() {
    this.loadWeatherData(true)
    wx.showToast({ title: '刷新中...', icon: 'loading' })
  },

  // ==================== 定位 ====================
  // 地球两点距离（haversine，单位 km），比原始经纬度平方距离精确
  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371
    const toRad = d => d * Math.PI / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  },

  getLocation() {
    const app = getApp()
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        const cities = Object.entries(weather.cityCoords)
        let nearest = cities[0][0]
        let minDist = Infinity
        for (const [name, coord] of cities) {
          const dist = this.haversine(res.latitude, res.longitude, coord.lat, coord.lon)
          if (dist < minDist) { minDist = dist; nearest = name }
        }
        const city = nearest
        this.setData({ currentCity: city })
        app.globalData.currentCity = city
        wx.setStorageSync('currentCity', city)
        this.loadWeatherData(true)
        const tip = minDist > 80 ? ('已定位到 ' + city + '（最近城市）') : ('已定位到 ' + city)
        wx.showToast({ title: tip, icon: 'success' })
      },
      fail: (err) => {
        // 用户拒绝授权或定位失败，引导手动选择，而非只报"定位失败"
        wx.showToast({ title: '定位失败，请手动选择城市', icon: 'none' })
      }
    })
  },

  // ==================== 登录 ====================
  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  }
})
