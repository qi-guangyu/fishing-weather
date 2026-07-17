App({
  globalData: {
    // 后端API地址：本地开发时指向 localhost，生产部署后替换为 HTTPS 域名
    apiBase: 'http://localhost:3456',
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
