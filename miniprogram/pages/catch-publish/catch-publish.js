const { isLoggedIn } = require('../../utils/auth')
const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    presetSpotId: '',
    selectedSpotName: '',
    spots: [],            // [{id, name}]
    spotIndex: -1,
    selectedSpotId: '',
    weight: '',
    feeling: '',
    imagePath: '',        // 本地临时路径
    submitting: false
  },

  onLoad(opt) {
    if (!isLoggedIn()) {
      wx.showModal({
        title: '提示', content: '请先登录后再发布渔获', showCancel: false,
        success: () => wx.navigateTo({ url: '/pages/login/login' })
      })
      return
    }
    const preset = opt.spotId || ''
    if (preset) {
      this.setData({
        presetSpotId: preset,
        selectedSpotId: preset,
        selectedSpotName: opt.spotName || ''
      })
    }
    this.loadSpots()
  },

  async loadSpots() {
    try {
      const r = await request({ url: '/api/spots?size=200' })
      const list = (r.data || []).map(s => ({ id: s.id, name: s.name }))
      let spotIndex = -1
      if (this.data.selectedSpotId) {
        spotIndex = list.findIndex(s => s.id === this.data.selectedSpotId)
      }
      this.setData({ spots: list, spotIndex })
    } catch (e) {
      // 接口异常时不阻塞，保留手动选择（若已预选仍可用）
    }
  },

  onSpotChange(e) {
    const idx = Number(e.detail.value)
    const spot = this.data.spots[idx]
    if (spot) this.setData({ spotIndex: idx, selectedSpotId: spot.id })
  },

  onWeight(e) { this.setData({ weight: e.detail.value }) },
  onFeeling(e) { this.setData({ feeling: e.detail.value }) },

  chooseImage() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album', 'camera'],
      success: (res) => { this.setData({ imagePath: res.tempFiles[0].tempFilePath }) },
      fail: () => {}
    })
  },
  removeImage() { this.setData({ imagePath: '' }) },

  async submit() {
    if (this.data.submitting) return
    const spotId = this.data.selectedSpotId
    if (!spotId) { wx.showToast({ title: '请选择钓点', icon: 'none' }); return }
    const weight = parseFloat(this.data.weight)
    if (!weight || weight <= 0) { wx.showToast({ title: '请填写有效重量(kg)', icon: 'none' }); return }
    const feeling = (this.data.feeling || '').trim()

    this.setData({ submitting: true })
    const token = wx.getStorageSync('token')
    const fail = (m) => { this.setData({ submitting: false }); wx.showToast({ title: m, icon: 'none' }) }

    try {
      if (this.data.imagePath) {
        await new Promise((resolve, reject) => {
          wx.uploadFile({
            url: app.globalData.apiBase + '/api/spots/' + spotId + '/catches',
            filePath: this.data.imagePath,
            name: 'image',
            formData: { weight: String(weight), feeling },
            header: { 'Authorization': token ? 'Bearer ' + token : '' },
            success: (res) => {
              if (res.statusCode >= 200 && res.statusCode < 300) resolve()
              else { try { reject((JSON.parse(res.data).message) || '发布失败') } catch (e) { reject('发布失败') } }
            },
            fail: (err) => reject(err.errMsg || '上传失败')
          })
        })
      } else {
        await request({
          url: '/api/spots/' + spotId + '/catches',
          method: 'POST',
          data: { weight: String(weight), feeling }
        })
      }
      this.setData({ submitting: false })
      wx.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => {
        const pages = getCurrentPages()
        const prev = pages[pages.length - 2]
        if (prev && prev.loadCatches) prev.loadCatches()
        wx.navigateBack()
      }, 800)
    } catch (e) {
      fail(typeof e === 'string' ? e : (e.message || '发布失败'))
    }
  }
})
