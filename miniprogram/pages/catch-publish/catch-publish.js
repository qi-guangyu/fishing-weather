const { isLoggedIn } = require('../../utils/auth')
const { request } = require('../../utils/request')

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
    const app = getApp()
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
      // callContainer 模式下 wx.uploadFile 直连被网关拦截，故改为读文件为 base64
      // 经 request() 走私有协议上报（与头像上传一致）。无图则直接 JSON 提交。
      let imageBase64 = null
      if (this.data.imagePath) {
        imageBase64 = await this.fileToBase64(this.data.imagePath)
      }
      const data = { weight: String(weight), feeling }
      if (imageBase64) data.imageBase64 = imageBase64
      await request({
        url: '/api/spots/' + spotId + '/catches',
        method: 'POST',
        data
      })
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
  },

  // 将本地临时图片读为 base64 data URI（callContainer 下经私有协议上报）
  fileToBase64(filePath) {
    return new Promise((resolve, reject) => {
      const ext = (filePath.match(/\.(\w+)(?:\?.*)?$/) || [, 'png'])[1].toLowerCase()
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'webp' ? 'image/webp'
        : ext === 'gif' ? 'image/gif' : 'image/png'
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (r) => resolve('data:' + mime + ';base64,' + r.data),
        fail: () => reject(new Error('图片读取失败'))
      })
    })
  }
})
