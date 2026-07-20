const weather = require('../../utils/weather')
const { fetchWeather } = weather
const { isLoggedIn } = require('../../utils/auth')

Page({
  data: {
    // 城市
    currentCity: '常熟',
    cityDisplayName: '定位中...',
    // 钓鱼指数
    fishMode: 'taiwan',
    fishSpeciesList: [],
    fishSpeciesKey: 'jiyu',
    fishDates: [],
    fishDayIndex: 0,
    fishHourly: [],
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
    const app = getApp()
    this.setData({ currentCity: app && app.globalData ? app.globalData.currentCity : '常熟' })
    this.loadWeatherData()
    this.setData({ isLoggedIn: isLoggedIn() })
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
    this.setData({
      weatherData: data,
      loading: false,
      cityDisplayName: (data.province ? data.province + '·' : '') + data.city
    })

    // 仅生成钓鱼指数所需数据（鱼情表按日切换依赖 15 天日期）
    const forecast15 = weather.padForecastTo15Days(data.forecast || [])
    this.setData({
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

  // 仅用于阻止弹窗内部点击冒泡到遮罩（避免点击搜索框/列表误触发关闭）
  noop() {},

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
    const app = getApp()
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
    const app = getApp()
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
