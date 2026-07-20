const { isLoggedIn, logout } = require('../../utils/auth')
const { request } = require('../../utils/request')

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    currentCity: '',
    stats: { catches: 0, favorites: 0, comments: 0, submissions: 0 }
  },

  onShow() {
    const app = getApp()
    const logged = isLoggedIn()
    this.setData({
      isLoggedIn: logged,
      userInfo: logged ? wx.getStorageSync('userInfo') : null,
      currentCity: app.globalData.currentCity
    })
    if (logged) this.loadStats()
  },

  async loadStats() {
    try {
      const [c, f, m, s] = await Promise.all([
        request({ url: '/api/user/catches?size=1' }),
        request({ url: '/api/user/favorites?size=1' }),
        request({ url: '/api/user/comments?size=1' }),
        request({ url: '/api/user/submissions?size=1' })
      ])
      this.setData({
        stats: {
          catches: (c.pagination && c.pagination.total) || 0,
          favorites: (f.pagination && f.pagination.total) || 0,
          comments: (m.pagination && m.pagination.total) || 0,
          submissions: (s.pagination && s.pagination.total) || 0
        }
      })
    } catch (e) {
      // 未登录或网络异常：忽略统计，菜单仍可用
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  goList(e) {
    if (!isLoggedIn()) { this.goLogin(); return }
    const type = e.currentTarget.dataset.type
    wx.navigateTo({ url: '/pages/my-list/my-list?type=' + type })
  },

  goPublish(e) {
    if (!isLoggedIn()) { this.goLogin(); return }
    const page = e.currentTarget.dataset.page
    wx.navigateTo({ url: '/pages/' + page + '/' + page })
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录',
      success: (res) => {
        if (res.confirm) {
          logout()
          this.setData({ isLoggedIn: false, userInfo: null, stats: { catches: 0, favorites: 0, comments: 0, submissions: 0 } })
          wx.showToast({ title: '已退出登录', icon: 'success' })
        }
      }
    })
  },

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
          if (app && app.globalData) app.globalData.currentCity = '常熟'
          wx.showToast({ title: '清除成功', icon: 'success' })
          setTimeout(() => { wx.reLaunch({ url: '/pages/index/index' }) }, 1000)
        }
      }
    })
  },

  showAbout() {
    wx.showModal({
      title: '关于钓鱼气象',
      content: '数据来源：和风天气\n版本：v1.0.0\n提供精准鱼情预报，科学出钓不空军',
      showCancel: false
    })
  },

  switchCity() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
