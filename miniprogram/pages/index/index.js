const weather = require('../../utils/weather')
const { fetchWeather, calcFishScore, getScoreTag, getAIAdvice } = weather
const { isLoggedIn } = require('../../utils/auth')

const app = getApp()

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
    // 城市列表
    cityList: [],
    showCityPicker: false,
    citySearchKey: ''
  },

  onLoad() {
    this.setData({ currentCity: app.globalData.currentCity })
    this.loadWeatherData()
    this.setData({ isLoggedIn: isLoggedIn() })
  },

  onShow() {
    if (app.globalData.currentCity !== this.data.currentCity) {
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
    this.setData({ loading: true })

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
      hourlyList: hourlyWithScore.slice(0, 12),
      forecast15: forecastCards,
      aiAdvice
    })
  },

  // 钓鱼指数模块（钓法/鱼种/日期切换 + 24h鱼情表）已迁移至 pages/fish-index

  // ==================== 城市选择 ====================
  showCityPicker() {
    const cities = Object.keys(weather.cityCoords)
    this.setData({
      showCityPicker: true,
      cityList: cities.map(c => ({ name: c, province: weather.getProvinceForCity(c) }))
    })
  },

  hideCityPicker() {
    this.setData({ showCityPicker: false, citySearchKey: '' })
  },

  onCitySearch(e) {
    const key = e.detail.value
    const cities = Object.keys(weather.cityCoords)
    const filtered = cities.filter(c => c.includes(key) || (weather.getProvinceForCity(c) || '').includes(key))
    this.setData({
      citySearchKey: key,
      cityList: filtered.map(c => ({ name: c, province: weather.getProvinceForCity(c) }))
    })
  },

  selectCity(e) {
    const city = e.currentTarget.dataset.city
    this.setData({ showCityPicker: false, currentCity: city, citySearchKey: '' })
    app.globalData.currentCity = city
    wx.setStorageSync('currentCity', city)
    this.loadWeatherData(true)
  },

  // ==================== 刷新 ====================
  refreshData() {
    this.loadWeatherData(true)
    wx.showToast({ title: '刷新中...', icon: 'loading' })
  },

  // ==================== 定位 ====================
  getLocation() {
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        // 简单匹配最近城市
        const cities = Object.entries(weather.cityCoords)
        let nearest = cities[0]
        let minDist = Infinity
        for (const [name, coord] of cities) {
          const dist = Math.pow(coord.lat - res.latitude, 2) + Math.pow(coord.lon - res.longitude, 2)
          if (dist < minDist) {
            minDist = dist
            nearest = [name, coord]
          }
        }
        const city = nearest[0]
        this.setData({ currentCity: city })
        app.globalData.currentCity = city
        wx.setStorageSync('currentCity', city)
        this.loadWeatherData(true)
        wx.showToast({ title: '已定位到' + city, icon: 'success' })
      },
      fail: () => {
        wx.showToast({ title: '定位失败', icon: 'none' })
      }
    })
  },

  // ==================== 登录 ====================
  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  }
})
