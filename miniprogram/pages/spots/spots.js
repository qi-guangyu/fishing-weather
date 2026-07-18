const weather = require('../../utils/weather')
const { fetchWeather, calcFishScore, getAIAdvice } = weather
const { request } = require('../../utils/request')

const WATER_TYPES = [
  { value: '', label: '全部' },
  { value: 'river', label: '江河' },
  { value: 'reservoir', label: '水库' },
  { value: 'lake', label: '湖泊' },
  { value: 'pond', label: '池塘' },
  { value: 'stream', label: '溪流' }
]
const FEE_TYPES = [
  { value: '', label: '全部' },
  { value: 'free', label: '免费' },
  { value: 'daily', label: '按天' },
  { value: 'weight', label: '按斤' },
  { value: 'other', label: '其他' }
]
const SORTS = [
  { value: '', label: '综合' },
  { value: 'nearest', label: '最近' },
  { value: 'favorites', label: '最热' },
  { value: 'comments', label: '讨论' }
]
const WATER_LABEL = { river: '江河', reservoir: '水库', lake: '湖泊', pond: '池塘', stream: '溪流' }
const FEE_LABEL = { free: '免费', daily: '按天收费', weight: '按斤收费', other: '其他收费' }

function levelOf(idx) {
  const v = idx || 0
  if (v >= 75) return { key: 'excellent', label: '优' }
  if (v >= 60) return { key: 'good', label: '良' }
  if (v >= 40) return { key: 'normal', label: '一般' }
  return { key: 'terrible', label: '差' }
}

function parseImages(imgs) {
  if (!imgs) return []
  if (Array.isArray(imgs)) return imgs
  try { const a = JSON.parse(imgs); return Array.isArray(a) ? a : [] } catch (e) { return [] }
}

function fullUrl(p) {
  if (!p) return ''
  if (p.startsWith('http')) return p
  const base = getApp().globalData.apiBase || ''
  return base + p
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

Page({
  data: {
    currentCity: '常熟',
    cityDisplayName: '定位中...',
    weather: {},
    score: 0,
    scoreLevel: '',
    scoreTag: '',
    aiAdvice: null,
    loading: true,

    // 列表
    spots: [],
    page: 1,
    size: 10,
    total: 0,
    totalPages: 1,
    loadingMore: false,
    finished: false,
    keyword: '',
    waterType: '',
    feeType: '',
    sort: '',
    waterTypes: WATER_TYPES,
    feeTypes: FEE_TYPES,
    sorts: SORTS,
    userLat: null,
    userLon: null,
    showFilters: false,
    _searchTimer: null
  },

  onLoad() {
    const app = getApp()
    const city = app.globalData.currentCity || '常熟'
    const lat = wx.getStorageSync('userLat')
    const lon = wx.getStorageSync('userLon')
    this.setData({
      currentCity: city,
      userLat: (typeof lat === 'number' && !isNaN(lat)) ? lat : null,
      userLon: (typeof lon === 'number' && !isNaN(lon)) ? lon : null
    })
    this.loadWeather()
    this.loadSpots(true)
  },

  onShow() {
    const app = getApp()
    const city = app.globalData.currentCity || '常熟'
    if (city !== this.data.currentCity) {
      this.setData({ currentCity: city }, () => this.loadWeather())
    }
  },

  onPullDownRefresh() {
    this.loadWeather()
    this.loadSpots(true).then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.finished && !this.data.loadingMore) this.loadSpots(false)
  },

  // ---------- 天气上下文 ----------
  async loadWeather() {
    this.setData({ loading: true })
    try {
      const data = await fetchWeather(this.data.currentCity)
      this.processWeatherData(data)
    } catch (err) {
      this.setData({ loading: false })
    }
  },

  processWeatherData(data) {
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
      weather: data,
      loading: false,
      cityDisplayName: (data.province ? data.province + '·' : '') + data.city,
      score: result.score,
      scoreLevel: result.level,
      scoreTag: result.tag,
      aiAdvice
    })
  },

  // ---------- 钓点列表 ----------
  async loadSpots(reset) {
    if (reset) {
      this.setData({ page: 1, spots: [], finished: false })
    }
    if (this.data.finished && !reset) return
    this.setData({ loadingMore: true })
    const { page, size, keyword, waterType, feeType, sort, userLat, userLon } = this.data
    const params = { page, size }
    if (keyword) params.keyword = keyword
    if (waterType) params.water_type = waterType
    if (feeType) params.fee_type = feeType
    if (sort) params.sort = sort
    if (userLat != null && userLon != null) { params.lat = userLat; params.lon = userLon }
    try {
      const res = await request({ url: '/api/spots', data: params })
      const list = (res.data || []).map(s => {
        const imgs = parseImages(s.images)
        const cover = imgs[0] ? fullUrl(imgs[0]) : ''
        let distText = ''
        if (userLat != null && userLon != null && s.latitude && s.longitude) {
          const d = haversine(userLat, userLon, s.latitude, s.longitude)
          distText = d < 1 ? Math.round(d * 1000) + 'm' : d.toFixed(1) + 'km'
        }
        const lv = levelOf(s.fishing_index)
        return {
          id: s.id,
          name: s.name,
          city: s.city || '',
          district: s.district || '',
          water_type: s.water_type,
          fee_type: s.fee_type,
          fishing_index: s.fishing_index || 0,
          favorites_count: s.favorites_count || 0,
          catches_count: s.catches_count || 0,
          comments_count: s.comments_count || 0,
          cover,
          images: imgs.map(fullUrl),
          distText,
          levelKey: lv.key,
          levelLabel: lv.label,
          waterLabel: WATER_LABEL[s.water_type] || '水域',
          feeLabel: FEE_LABEL[s.fee_type] || ''
        }
      })
      const merged = reset ? list : this.data.spots.concat(list)
      const pg = res.pagination || {}
      const totalPages = pg.totalPages || 1
      this.setData({
        spots: merged,
        total: pg.total || 0,
        totalPages,
        page: page + 1,
        finished: page >= totalPages,
        loadingMore: false
      })
    } catch (e) {
      this.setData({ loadingMore: false })
      wx.showToast({ title: '钓点加载失败', icon: 'none' })
    }
  },

  loadMore() {
    if (!this.data.finished && !this.data.loadingMore) this.loadSpots(false)
  },

  // ---------- 搜索 / 筛选 ----------
  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ keyword })
    if (this.data._searchTimer) clearTimeout(this.data._searchTimer)
    const t = setTimeout(() => this.loadSpots(true), 400)
    this.setData({ _searchTimer: t })
  },

  clearKeyword() {
    this.setData({ keyword: '' }, () => this.loadSpots(true))
  },

  toggleFilters() {
    this.setData({ showFilters: !this.data.showFilters })
  },

  pickWater(e) {
    this.setData({ waterType: e.currentTarget.dataset.val }, () => this.loadSpots(true))
  },
  pickFee(e) {
    this.setData({ feeType: e.currentTarget.dataset.val }, () => this.loadSpots(true))
  },
  pickSort(e) {
    this.setData({ sort: e.currentTarget.dataset.val }, () => this.loadSpots(true))
  },
  resetFilters() {
    this.setData({ waterType: '', feeType: '', sort: '', keyword: '' }, () => this.loadSpots(true))
  },

  // ---------- 收藏 ----------
  async toggleFav(e) {
    const id = e.currentTarget.dataset.id
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 700)
      return
    }
    const idx = this.data.spots.findIndex(s => s.id === id)
    if (idx < 0) return
    const cur = this.data.spots[idx]
    const nextFav = !cur.favorited
    const spots = this.data.spots.slice()
    spots[idx] = { ...cur, favorited: nextFav, favorites_count: cur.favorites_count + (nextFav ? 1 : -1) }
    this.setData({ spots })
    try {
      const r = await request({ url: `/api/spots/${id}/favorite`, method: 'POST' })
      const spots2 = this.data.spots.slice()
      spots2[idx] = { ...spots2[idx], favorited: r.favorited }
      this.setData({ spots: spots2 })
    } catch (err) {
      const spots2 = this.data.spots.slice()
      spots2[idx] = { ...cur }
      this.setData({ spots: spots2 })
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  },

  // ---------- 跳转详情 ----------
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/spot-detail/spot-detail?id=' + id })
  },

  // ---------- 定位 ----------
  getLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        wx.setStorageSync('userLat', res.latitude)
        wx.setStorageSync('userLon', res.longitude)
        const cities = Object.entries(weather.cityCoords)
        let nearest = cities[0]
        let minDist = Infinity
        for (const [name, coord] of cities) {
          const dist = Math.pow(coord.lat - res.latitude, 2) + Math.pow(coord.lon - res.longitude, 2)
          if (dist < minDist) { minDist = dist; nearest = [name, coord] }
        }
        const city = nearest[0]
        const app = getApp()
        app.globalData.currentCity = city
        wx.setStorageSync('currentCity', city)
        this.setData({ currentCity: city, userLat: res.latitude, userLon: res.longitude }, () => {
          this.loadWeather()
          this.loadSpots(true)
        })
        wx.showToast({ title: '已定位到' + city, icon: 'success' })
      },
      fail: () => wx.showToast({ title: '定位失败', icon: 'none' })
    })
  },

  refreshData() {
    this.loadWeather()
    this.loadSpots(true)
  }
})
