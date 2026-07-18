const { request } = require('../../utils/request')

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
  return (getApp().globalData.apiBase || '') + p
}

Page({
  data: {
    id: '',
    spot: null,
    images: [],
    weatherData: null,
    loading: true,
    favorited: false,
    favoritesCount: 0,
    levelKey: 'normal',
    levelLabel: '一般',
    waterLabel: '水域',
    feeLabel: '',
    comments: [],
    catches: [],
    commentText: '',
    posting: false
  },

  onLoad(opt) {
    this.setData({ id: opt.id || '' })
    this.loadDetail()
  },

  async loadDetail() {
    if (!this.data.id) { this.setData({ loading: false }); return }
    try {
      const res = await request({ url: `/api/spots/${this.data.id}` })
      const s = res.data || {}
      const imgs = parseImages(s.images)
      const lv = levelOf(s.fishing_index)
      wx.setNavigationBarTitle({ title: s.name || '钓点详情' })
      this.setData({
        spot: s,
        images: imgs.map(fullUrl),
        weatherData: s.weather_data || null,
        loading: false,
        favorited: !!s.favorited,
        favoritesCount: s.favorites_count || 0,
        levelKey: lv.key,
        levelLabel: lv.label,
        waterLabel: WATER_LABEL[s.water_type] || '水域',
        feeLabel: FEE_LABEL[s.fee_type] || ''
      })
      this.loadComments()
      this.loadCatches()
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadComments() {
    try {
      const r = await request({ url: `/api/spots/${this.data.id}/comments` })
      this.setData({
        comments: (r.data || []).map(c => ({
          id: c.id,
          nickname: c.nickname || c.username || '钓友',
          content: c.content,
          image: c.image ? fullUrl(c.image) : '',
          created_at: c.created_at
        }))
      })
    } catch (e) { /* 忽略 */ }
  },

  async loadCatches() {
    try {
      const r = await request({ url: `/api/spots/${this.data.id}/catches` })
      this.setData({
        catches: (r.data || []).map(c => ({
          id: c.id,
          image: c.image ? fullUrl(c.image) : '',
          weight: c.weight || 0,
          feeling: c.feeling || ''
        }))
      })
    } catch (e) { /* 忽略 */ }
  },

  goPublishCatch() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 700)
      return
    }
    wx.navigateTo({
      url: '/pages/catch-publish/catch-publish?spotId=' + this.data.id +
        '&spotName=' + encodeURIComponent(this.data.spot.name || '')
    })
  },

  async toggleFav() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 700)
      return
    }
    try {
      const r = await request({ url: `/api/spots/${this.data.id}/favorite`, method: 'POST' })
      this.setData({
        favorited: r.favorited,
        favoritesCount: Math.max(0, this.data.favoritesCount + (r.favorited ? 1 : -1))
      })
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' })
    }
  },

  onCommentInput(e) { this.setData({ commentText: e.detail.value }) },

  async submitComment() {
    const token = wx.getStorageSync('token')
    if (!token) { wx.showToast({ title: '请先登录', icon: 'none' }); return }
    const text = (this.data.commentText || '').trim()
    if (!text) { wx.showToast({ title: '说点什么吧', icon: 'none' }); return }
    this.setData({ posting: true })
    try {
      await request({ url: `/api/spots/${this.data.id}/comments`, method: 'POST', data: { content: text } })
      this.setData({ commentText: '' })
      wx.showToast({ title: '评论成功', icon: 'success' })
      this.loadComments()
    } catch (e) {
      wx.showToast({ title: e.message || '评论失败', icon: 'none' })
    } finally {
      this.setData({ posting: false })
    }
  },

  previewImg(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ current: url, urls: this.data.images.length ? this.data.images : [url] })
  }
})
