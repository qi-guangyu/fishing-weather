const weather = require('../../utils/weather')
const { fetchWeather, calcFishScore, getAIAdvice } = weather

Page({
  data: {
    currentCity: '常熟',
    cityDisplayName: '定位中...',
    weather: {},
    score: 0,
    scoreLevel: '',
    scoreTag: '',
    aiAdvice: null,
    loading: true
  },

  onLoad() {
    const app = getApp()
    this.setData({ currentCity: app.globalData.currentCity || '常熟' })
    this.loadData()
  },

  onShow() {
    const app = getApp()
    const city = app.globalData.currentCity || '常熟'
    if (city !== this.data.currentCity) {
      this.setData({ currentCity: city }, () => this.loadData())
    }
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const data = await fetchWeather(this.data.currentCity)
      this.processWeatherData(data)
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  processWeatherData(data) {
    this.setData({
      weather: data,
      loading: false,
      cityDisplayName: (data.province ? data.province + '·' : '') + data.city
    })

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

    const aiAdvice = getAIAdvice(data, result.score)

    this.setData({
      score: result.score,
      scoreLevel: result.level,
      scoreTag: result.tag,
      aiAdvice
    })
  },

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
        const app = getApp()
        app.globalData.currentCity = city
        wx.setStorageSync('currentCity', city)
        this.setData({ currentCity: city }, () => this.loadData())
        wx.showToast({ title: '已定位到' + city, icon: 'success' })
      },
      fail: () => {
        wx.showToast({ title: '定位失败', icon: 'none' })
      }
    })
  },

  refreshData() {
    this.loadData()
  }
})
