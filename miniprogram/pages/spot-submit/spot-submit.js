const { isLoggedIn } = require('../../utils/auth')
const { request } = require('../../utils/request')

const WATER_TYPES = [
  { key: 'river', label: '江河' },
  { key: 'reservoir', label: '水库' },
  { key: 'lake', label: '湖泊' },
  { key: 'pond', label: '池塘' },
  { key: 'stream', label: '溪流' }
]
const FEE_TYPES = [
  { key: 'free', label: '免费' },
  { key: 'daily', label: '按天收费' },
  { key: 'weight', label: '按斤收费' },
  { key: 'other', label: '其他收费' }
]

Page({
  data: {
    name: '',
    // 定位
    latitude: '',
    longitude: '',
    locName: '',
    address: '',
    // 选择
    waterIndex: 0,
    waterTypes: WATER_TYPES,
    feeIndex: 0,
    feeTypes: FEE_TYPES,
    feePrice: '',
    targetFish: '',
    avgDepth: '',
    bestTime: '',
    bestSeason: '',
    parking: false,
    restroom: false,
    shade: false,
    rodLimit: '',
    floodWarning: '',
    description: '',
    city: '',
    imagePath: '',
    submitting: false
  },

  onLoad() {
    const app = getApp()
    if (!isLoggedIn()) {
      wx.showModal({
        title: '提示', content: '请先登录后再投稿钓点', showCancel: false,
        success: () => wx.navigateTo({ url: '/pages/login/login' })
      })
      return
    }
    this.setData({ city: app.globalData.currentCity || '' })
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          locName: res.name || '',
          address: res.address || ''
        })
      },
      fail: (err) => {
        if (/cancel/.test(err.errMsg || '')) return
        wx.showToast({ title: '定位失败，请重试', icon: 'none' })
      }
    })
  },

  onName(e) { this.setData({ name: e.detail.value }) },
  onFeePrice(e) { this.setData({ feePrice: e.detail.value }) },
  onTargetFish(e) { this.setData({ targetFish: e.detail.value }) },
  onAvgDepth(e) { this.setData({ avgDepth: e.detail.value }) },
  onBestTime(e) { this.setData({ bestTime: e.detail.value }) },
  onBestSeason(e) { this.setData({ bestSeason: e.detail.value }) },
  onRodLimit(e) { this.setData({ rodLimit: e.detail.value }) },
  onFloodWarning(e) { this.setData({ floodWarning: e.detail.value }) },
  onDescription(e) { this.setData({ description: e.detail.value }) },

  onWaterChange(e) { this.setData({ waterIndex: Number(e.detail.value) }) },
  onFeeChange(e) { this.setData({ feeIndex: Number(e.detail.value) }) },
  onParking(e) { this.setData({ parking: e.detail.value }) },
  onRestroom(e) { this.setData({ restroom: e.detail.value }) },
  onShade(e) { this.setData({ shade: e.detail.value }) },

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
    const d = this.data
    if (!d.name.trim()) { wx.showToast({ title: '请填写钓点名称', icon: 'none' }); return }
    if (!d.latitude || !d.longitude) { wx.showToast({ title: '请先选择位置', icon: 'none' }); return }

    const fields = {
      name: d.name.trim(),
      latitude: d.latitude,
      longitude: d.longitude,
      address: d.address || d.locName || '',
      water_type: d.waterTypes[d.waterIndex].key,
      fee_type: d.feeTypes[d.feeIndex].key,
      fee_price: d.feePrice || '',
      target_fish: d.targetFish || '',
      avg_depth: d.avgDepth || '',
      best_time: d.bestTime || '',
      best_season: d.bestSeason || '',
      parking: d.parking ? 1 : 0,
      restroom: d.restroom ? 1 : 0,
      shade: d.shade ? 1 : 0,
      rod_limit: d.rodLimit || '',
      flood_warning: d.floodWarning || '',
      description: d.description || '',
      city: d.city || ''
    }

    this.setData({ submitting: true })
    const token = wx.getStorageSync('token')
    const fail = (m) => { this.setData({ submitting: false }); wx.showToast({ title: m, icon: 'none' }) }

    try {
      if (d.imagePath) {
        await new Promise((resolve, reject) => {
          wx.uploadFile({
            url: app.globalData.apiBase + '/api/spots/submit',
            filePath: d.imagePath,
            name: 'images',
            formData: fields,
            header: { 'Authorization': token ? 'Bearer ' + token : '' },
            success: (res) => {
              if (res.statusCode >= 200 && res.statusCode < 300) resolve()
              else { try { reject((JSON.parse(res.data).error) || '投稿失败') } catch (e) { reject('投稿失败') } }
            },
            fail: (err) => reject(err.errMsg || '上传失败')
          })
        })
      } else {
        await request({ url: '/api/spots/submit', method: 'POST', data: fields })
      }
      this.setData({ submitting: false })
      wx.showToast({ title: '投稿成功，待审核', icon: 'success' })
      setTimeout(() => {
        const pages = getCurrentPages()
        const prev = pages[pages.length - 2]
        if (prev && prev.loadStats) prev.loadStats()
        wx.navigateBack()
      }, 900)
    } catch (e) {
      fail(typeof e === 'string' ? e : (e.message || '投稿失败'))
    }
  }
})
