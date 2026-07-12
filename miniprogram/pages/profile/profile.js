const { isLoggedIn, logout } = require('../../utils/auth')
const app = getApp()

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    currentCity: ''
  },

  onShow() {
    const logged = isLoggedIn()
    this.setData({
      isLoggedIn: logged,
      userInfo: logged ? wx.getStorageSync('userInfo') : null,
      currentCity: app.globalData.currentCity
    })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录',
      success: (res) => {
        if (res.confirm) {
          logout()
          this.setData({ isLoggedIn: false, userInfo: null })
          wx.showToast({ title: '已退出登录', icon: 'success' })
        }
      }
    })
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除所有本地天气数据和设置',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
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
