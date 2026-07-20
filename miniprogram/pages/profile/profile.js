const { isLoggedIn, logout } = require('../../utils/auth')

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    avatar: '',
    displayName: '',
    currentCity: '',
    // 本地偏好（设置项）
    msgNotify: true,
    privacyPersonalize: true,
    privacyShowActivity: true,
    // 弹窗状态
    showPrivacy: false
  },

  onLoad() {
    this.loadSettings()
  },

  onShow() {
    const app = getApp()
    const logged = isLoggedIn()
    const userInfo = logged ? wx.getStorageSync('userInfo') : null
    this.setData({
      isLoggedIn: logged,
      userInfo,
      avatar: userInfo ? (userInfo.avatar || '') : '',
      displayName: this.calcName(userInfo),
      currentCity: app.globalData.currentCity
    })
  },

  onPullDownRefresh() {
    wx.stopPullDownRefresh()
  },

  noop() {},

  calcName(u) {
    if (!u) return ''
    return u.nickname || u.username || '钓鱼爱好者'
  },

  // ---------- 设置项（本地偏好） ----------
  loadSettings() {
    const s = wx.getStorageSync('settings') || {}
    this.setData({
      msgNotify: s.msgNotify !== false,
      privacyPersonalize: s.privacyPersonalize !== false,
      privacyShowActivity: s.privacyShowActivity !== false
    })
  },
  saveSettings(patch) {
    const s = wx.getStorageSync('settings') || {}
    Object.assign(s, patch)
    wx.setStorageSync('settings', s)
  },

  // ---------- 登录/发布/编辑 ----------
  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  goPublish(e) {
    if (!isLoggedIn()) { this.goLogin(); return }
    const page = e.currentTarget.dataset.page
    wx.navigateTo({ url: '/pages/' + page + '/' + page })
  },

  // ---------- 编辑资料（进入独立编辑页） ----------
  goEdit() {
    if (!isLoggedIn()) { this.goLogin(); return }
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile' })
  },

  // ---------- 系统设置：消息通知 ----------
  onToggleNotify(e) {
    const v = e.detail.value
    this.setData({ msgNotify: v })
    this.saveSettings({ msgNotify: v })
  },

  // ---------- 系统设置：隐私 ----------
  openPrivacy() {
    this.loadSettings()
    this.setData({ showPrivacy: true })
  },
  closePrivacy() { this.setData({ showPrivacy: false }) },
  onTogglePrivacyPersonalize(e) {
    const v = e.detail.value
    this.setData({ privacyPersonalize: v })
    this.saveSettings({ privacyPersonalize: v })
  },
  onTogglePrivacyShowActivity(e) {
    const v = e.detail.value
    this.setData({ privacyShowActivity: v })
    this.saveSettings({ privacyShowActivity: v })
  },

  // ---------- 系统设置：清除缓存 ----------
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除本地天气数据和设置（不会退出登录）',
      success: (res) => {
        if (res.confirm) {
          const app = getApp()
          // 仅清业务缓存，保留登录态(token/userInfo)与隐私授权(privacyConsent)
          const keep = {
            token: wx.getStorageSync('token'),
            userInfo: wx.getStorageSync('userInfo'),
            privacyConsent: wx.getStorageSync('privacyConsent')
          }
          wx.clearStorageSync()
          if (keep.token) wx.setStorageSync('token', keep.token)
          if (keep.userInfo) wx.setStorageSync('userInfo', keep.userInfo)
          if (keep.privacyConsent) wx.setStorageSync('privacyConsent', keep.privacyConsent)
          // 用户偏好设置重新写回
          this.saveSettings({
            msgNotify: this.data.msgNotify,
            privacyPersonalize: this.data.privacyPersonalize,
            privacyShowActivity: this.data.privacyShowActivity
          })
          if (app && app.globalData) app.globalData.currentCity = '常熟'
          wx.showToast({ title: '清除成功', icon: 'success' })
          setTimeout(() => { wx.reLaunch({ url: '/pages/index/index' }) }, 1000)
        }
      }
    })
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录',
      success: (res) => {
        if (res.confirm) {
          logout()
          this.setData({
            isLoggedIn: false,
            userInfo: null,
            avatar: '',
            displayName: ''
          })
          wx.showToast({ title: '已退出登录', icon: 'success' })
        }
      }
    })
  }
})
