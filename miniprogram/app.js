const { API_BASE } = require('./config.js');

App({
  globalData: {
    // 后端API地址：见 miniprogram/config.js（部署后改为云托管 HTTPS 域名）
    apiBase: API_BASE,
    // 用户信息
    userInfo: null,
    token: null,
    // 当前城市
    currentCity: '常熟'
  },
  onLaunch() {
    // 从本地存储恢复登录状态
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')
    if (token) {
      this.globalData.token = token
      this.globalData.userInfo = userInfo
    }
    // 从本地存储恢复城市
    const savedCity = wx.getStorageSync('currentCity')
    if (savedCity) {
      this.globalData.currentCity = savedCity
    }
  }
})
