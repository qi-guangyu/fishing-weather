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
    // 15天预报
    forecast15: [],
    // 钓鱼指数
    fishMode: 'taiwan',
    fishSpeciesList: [],
    fishSpeciesKey: 'jiyu',
    fishDates: [],
    fishDayIndex: 0,
    fishHourly: [],
    // AI建议
    aiAdvice: null,
    // 状态
    loading: true,
    isLoggedIn: false,
    // 城市列表
    cityList: [],
    showCityPicker: false,
    citySearchKey: '',
    // 天气数据
    weatherData: null
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

    // 计算综合评分
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

    // 逐时（仅用于计算最佳时段）
    const hourlyWithScore = (data.hourly_forecast || []).map(h => {
      let hour = -1
      try { hour = new Date(h.time).getHours() } catch (e) { }
      if (isNaN(hour) || hour < 0) hour = new Date().getHours()
      const score = calcFishScore({
        pressure: h.pressure, temp: h.temperature, tempDiff: 6,
        windScale: parseInt(h.wind_scale) || 2, precip: 0,
        moon: 0.45, hour
      }).score
      return { hour, score }
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
      forecast15,
      aiAdvice,
      // 钓鱼指数
      fishSpeciesList: weather.FISH_SPECIES_DATA[this.data.fishMode],
      fishDates: forecast15.map((d, i) => ({
        dayLabel: weather.getDayLabel(i, d.date),
        dateStr: d.date ? d.date.slice(5).replace('-', '/') : 'N/A'
      }))
    })

    // 渲染钓鱼指数表格
    this.renderFishIndexTable()
  },

  // ==================== 钓鱼指数模块 ====================
  switchFishMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({
      fishMode: mode,
      fishSpeciesKey: weather.FISH_SPECIES_DATA[mode][0].key,
      fishSpeciesList: weather.FISH_SPECIES_DATA[mode]
    })
    this.renderFishIndexTable()
  },

  switchFishSpecies(e) {
    this.setData({ fishSpeciesKey: e.currentTarget.dataset.key })
    this.renderFishIndexTable()
  },

  switchFishDay(e) {
    this.setData({ fishDayIndex: e.currentTarget.dataset.idx })
    this.renderFishIndexTable()
  },

  renderFishIndexTable() {
    const data = this.data.weatherData
    if (!data || !data.forecast) return
    const days = weather.padForecastTo15Days(data.forecast)
    const day = days[this.data.fishDayIndex] || days[0]
    const speciesList = weather.FISH_SPECIES_DATA[this.data.fishMode]
    const species = speciesList.find(s => s.key === this.data.fishSpeciesKey) || speciesList[0]
    const hourly = weather.generateDayHourly(day)
    const fishHourly = hourly.map(h => {
      const score = weather.calcHourlyFishScore(h, species, this.data.fishMode)
      const level = weather.getScoreLevel(score)
      return {
        ...h,
        score,
        levelCls: level.cls,
        levelText: level.text,
        icon: weather.getWeatherIcon(h.weather)
      }
    })
    this.setData({ fishHourly })
  },

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
